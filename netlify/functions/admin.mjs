import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  HttpError,
  assertOrganization,
  authorizeRequest,
  parseJsonBody,
  requirePositiveInteger
} from './_security.mjs';

const TENANT_TABLES = new Set([
  'aluno',
  'aula',
  'veiculo',
  'pacote',
  'conta_receber',
  'pagamento',
  'despesa',
  'usuario'
]);

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  return neon(process.env.DATABASE_URL);
}

function corsHeaders(event) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...(allowedOrigin && requestOrigin === allowedOrigin
      ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' }
      : {})
  };
}

function json(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function requireMethod(event, method) {
  if (event.httpMethod !== method) throw new HttpError(405, `Método ${event.httpMethod} não permitido`);
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${field} é obrigatório`);
  return value.trim();
}

function parseDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new HttpError(400, `${field} inválido`);
  return date;
}

async function getTenantData(sql, organizationId) {
  const [alunos, aulas, veiculos, pacotes, contasReceber, pagamentos, despesas, usuarios] = await Promise.all([
    sql`SELECT id, instrutor_vinculado_id, nome, email, telefone, categoria, status, xp_total, nivel, criado_em FROM aluno WHERE organizacao_id = ${organizationId} ORDER BY nome`,
    sql`SELECT id, aluno_id, instrutor_id, veiculo_id, inicio, fim, status_local, topico, criado_em FROM aula WHERE organizacao_id = ${organizationId} ORDER BY inicio DESC`,
    sql`SELECT id, placa, model, categoria, status, criado_em FROM veiculo WHERE organizacao_id = ${organizationId} ORDER BY placa`,
    sql`SELECT id, aluno_id, nome, quantidade, saldo_aulas, valor_centavos, status, criado_em FROM pacote WHERE organizacao_id = ${organizationId} ORDER BY criado_em DESC`,
    sql`SELECT id, aluno_id, pacote_id, descricao, valor_centavos, vencimento, status, origem, criado_em FROM conta_receber WHERE organizacao_id = ${organizationId} ORDER BY vencimento DESC`,
    sql`SELECT id, conta_receber_id, valor_centavos, recebido_em, meio, referencia, criado_em FROM pagamento WHERE organizacao_id = ${organizationId} ORDER BY recebido_em DESC`,
    sql`SELECT id, descricao, valor_centavos, vencimento, pago_em, status, criado_em FROM despesa WHERE organizacao_id = ${organizationId} ORDER BY vencimento DESC`,
    sql`SELECT id, nome, email, papel, status, criado_em, ultimo_acesso FROM usuario WHERE organizacao_id = ${organizationId} ORDER BY nome`
  ]);
  return { alunos, aulas, veiculos, pacotes, contasReceber, pagamentos, despesas, usuarios };
}

async function createLesson(sql, auth, payload) {
  const organizationId = assertOrganization(auth, payload.organizacao_id);
  const alunoId = requireText(payload.alunoId, 'alunoId');
  const instrutorId = requireText(payload.instrutorId, 'instrutorId');
  const veiculoId = payload.veiculoId ? requireText(payload.veiculoId, 'veiculoId') : null;
  const inicio = parseDate(payload.inicio, 'inicio');
  const fim = parseDate(payload.fim, 'fim');
  if (fim <= inicio) throw new HttpError(400, 'fim deve ser posterior a inicio');

  const lessonId = `aul_${randomUUID()}`;
  const rows = await sql`
    WITH tenant_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${`agenda:${organizationId}`}, 0))
    ), valid_resources AS MATERIALIZED (
      SELECT 1
      FROM aluno a
      JOIN usuario u
        ON u.id = ${instrutorId}
       AND u.organizacao_id = ${organizationId}
       AND u.status = 'ATIVO'
      CROSS JOIN tenant_lock
      WHERE a.id = ${alunoId}
        AND a.organizacao_id = ${organizationId}
        AND a.status = 'ATIVO'
        AND (
          ${veiculoId}::text IS NULL OR EXISTS (
            SELECT 1 FROM veiculo v
            WHERE v.id = ${veiculoId}
              AND v.organizacao_id = ${organizationId}
          )
        )
    )
    INSERT INTO aula (
      id, organizacao_id, aluno_id, instrutor_id, veiculo_id, inicio, fim, status_local, topico
    )
    SELECT
      ${lessonId}, ${organizationId}, ${alunoId}, ${instrutorId}, ${veiculoId},
      ${inicio.toISOString()}::timestamptz, ${fim.toISOString()}::timestamptz,
      'AGENDADA', ${payload.topico || 'Aula prática'}
    FROM valid_resources
    WHERE NOT EXISTS (
      SELECT 1
      FROM aula existente
      WHERE existente.organizacao_id = ${organizationId}
        AND existente.status_local NOT IN ('CANCELADA', 'CANCELADO')
        AND existente.inicio < ${fim.toISOString()}::timestamptz
        AND existente.fim > ${inicio.toISOString()}::timestamptz
        AND (
          existente.aluno_id = ${alunoId}
          OR existente.instrutor_id = ${instrutorId}
          OR (${veiculoId}::text IS NOT NULL AND existente.veiculo_id = ${veiculoId})
        )
    )
    RETURNING id, organizacao_id, aluno_id, instrutor_id, veiculo_id, inicio, fim, status_local, topico;
  `;

  if (!rows.length) throw new HttpError(409, 'Recurso inválido ou conflito de agenda no intervalo informado');
  return rows[0];
}

async function recordPayment(sql, auth, payload) {
  const organizationId = assertOrganization(auth, payload.organizacao_id);
  const contaReceberId = requireText(payload.contaReceberId, 'contaReceberId');
  const valorCentavos = requirePositiveInteger(payload.valorCentavos, 'valorCentavos');
  const recebidoEm = parseDate(payload.recebidoEm || new Date().toISOString(), 'recebidoEm');
  const paymentId = `pag_${randomUUID()}`;

  const rows = await sql`
    WITH account_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${`financeiro:${organizationId}:${contaReceberId}`}, 0))
    ), saldo AS MATERIALIZED (
      SELECT
        c.id,
        c.valor_centavos - COALESCE(SUM(p.valor_centavos), 0)::int AS saldo_centavos
      FROM conta_receber c
      CROSS JOIN account_lock
      LEFT JOIN pagamento p
        ON p.conta_receber_id = c.id
       AND p.organizacao_id = ${organizationId}
      WHERE c.id = ${contaReceberId}
        AND c.organizacao_id = ${organizationId}
      GROUP BY c.id, c.valor_centavos
    ), novo_pagamento AS (
      INSERT INTO pagamento (
        id, organizacao_id, conta_receber_id, valor_centavos, recebido_em, meio, referencia
      )
      SELECT
        ${paymentId}, ${organizationId}, s.id, ${valorCentavos},
        ${recebidoEm.toISOString()}::date, ${payload.meio || 'PIX'}, ${payload.referencia || null}
      FROM saldo s
      WHERE ${valorCentavos} <= s.saldo_centavos
        AND s.saldo_centavos > 0
      RETURNING id, conta_receber_id, valor_centavos, recebido_em, meio, referencia
    ), atualizada AS (
      UPDATE conta_receber c
      SET status = CASE
        WHEN s.saldo_centavos = ${valorCentavos} THEN 'QUITADA'
        ELSE 'PARCIAL'
      END
      FROM saldo s, novo_pagamento p
      WHERE c.id = s.id
        AND c.organizacao_id = ${organizationId}
      RETURNING c.status
    )
    SELECT p.*, a.status AS conta_status
    FROM novo_pagamento p
    CROSS JOIN atualizada a;
  `;

  if (!rows.length) throw new HttpError(409, 'Conta inexistente, quitada ou pagamento superior ao saldo');
  return rows[0];
}

async function createExpense(sql, auth, payload) {
  const organizationId = assertOrganization(auth, payload.organizacao_id);
  const descricao = requireText(payload.descricao, 'descricao');
  const valorCentavos = requirePositiveInteger(payload.valorCentavos, 'valorCentavos');
  const vencimento = parseDate(payload.vencimento, 'vencimento');
  const expenseId = `des_${randomUUID()}`;
  const rows = await sql`
    INSERT INTO despesa (id, organizacao_id, descricao, valor_centavos, vencimento, pago_em, status)
    VALUES (
      ${expenseId}, ${organizationId}, ${descricao}, ${valorCentavos},
      ${vencimento.toISOString()}::date,
      ${payload.pagoEm ? parseDate(payload.pagoEm, 'pagoEm').toISOString() : null}::date,
      ${payload.status || 'PENDENTE'}
    )
    RETURNING id, descricao, valor_centavos, vencimento, pago_em, status;
  `;
  return rows[0];
}

async function getMasterDashboard(sql) {
  const [orgStats, userStats, studentStats, planStats, inviteStats, planos, ultimasAtividades] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total_orgs, COUNT(*) FILTER (WHERE status_assinatura = 'ATIVA')::int AS assinaturas_ativas, COUNT(*) FILTER (WHERE status_assinatura = 'PENDENTE')::int AS assinaturas_pendentes, COUNT(*) FILTER (WHERE status_assinatura = 'BLOQUEADA')::int AS assinaturas_bloqueadas, COUNT(*) FILTER (WHERE tipo = 'INSTRUTOR_AUTONOMO')::int AS total_autonomos, COUNT(*) FILTER (WHERE tipo = 'AUTOESCOLA_CFC')::int AS total_cfcs FROM organizacao`,
    sql`SELECT COUNT(*)::int AS total_usuarios, COUNT(*) FILTER (WHERE status = 'ATIVO')::int AS usuarios_ativos FROM usuario`,
    sql`SELECT COUNT(*)::int AS total_alunos, COUNT(*) FILTER (WHERE status = 'ATIVO')::int AS alunos_ativos, COALESCE(SUM(xp_total), 0)::int AS xp_acumulado FROM aluno`,
    sql`SELECT COALESCE(SUM(p.valor_mensal_centavos), 0)::int AS mrr_estimado_centavos FROM organizacao o JOIN plano_assinatura p ON p.id = o.plano_id WHERE o.status_assinatura = 'ATIVA'`,
    sql`SELECT COUNT(*)::int AS total_convites, COUNT(*) FILTER (WHERE status = 'PENDENTE')::int AS convites_pendentes, COUNT(*) FILTER (WHERE status = 'ACEITO')::int AS convites_aceitos FROM convite_aluno`,
    sql`SELECT id, nome, tipo_publico, valor_mensal_centavos, limite_alunos, limite_veiculos, ativo FROM plano_assinatura ORDER BY valor_mensal_centavos`,
    sql`SELECT id, autor_tipo, autor_id, acao, tabela_afetada, criado_em, detalhes_json FROM registro_auditoria ORDER BY criado_em DESC LIMIT 10`
  ]);
  return { orgStats: orgStats[0], userStats: userStats[0], studentStats: studentStats[0], planStats: planStats[0], inviteStats: inviteStats[0], planos, ultimasAtividades };
}

async function getSubscriptions(sql) {
  const [orgs, planos] = await Promise.all([
    sql`SELECT o.id, o.tipo, o.nome, o.email_contato, o.telefone, o.status_assinatura, o.assinatura_valida_ate, o.ativa, o.criado_em, p.id AS plano_id, p.nome AS plano_nome, p.valor_mensal_centavos, p.limite_alunos, p.limite_veiculos, (SELECT count(*)::int FROM usuario u WHERE u.organizacao_id = o.id) AS qtd_usuarios, (SELECT count(*)::int FROM aluno a WHERE a.organizacao_id = o.id) AS qtd_alunos, (SELECT count(*)::int FROM veiculo v WHERE v.organizacao_id = o.id) AS qtd_veiculos FROM organizacao o LEFT JOIN plano_assinatura p ON p.id = o.plano_id ORDER BY o.criado_em DESC`,
    sql`SELECT id, nome, tipo_publico, valor_mensal_centavos FROM plano_assinatura ORDER BY valor_mensal_centavos`
  ]);
  return { orgs, planos };
}

async function getInvites(sql) {
  const [convites, professores] = await Promise.all([
    sql`SELECT c.id, c.nome_aluno, c.email_aluno, c.telefone_aluno, c.categoria, c.token_convite, c.status, c.criado_em, c.expira_em, o.nome AS organizacao_nome, u.nome AS professor_nome, u.email AS professor_email, a.id AS aluno_vinculado_id, a.xp_total, a.nivel FROM convite_aluno c JOIN organizacao o ON o.id = c.organizacao_id JOIN usuario u ON u.id = c.instrutor_id AND u.organizacao_id = c.organizacao_id LEFT JOIN aluno a ON a.id = c.aluno_id AND a.organizacao_id = c.organizacao_id ORDER BY c.criado_em DESC`,
    sql`SELECT u.id, u.nome, u.email, o.id AS org_id, o.nome AS org_nome FROM usuario u JOIN organizacao o ON o.id = u.organizacao_id ORDER BY u.nome`
  ]);
  return { convites, professores };
}

export async function handler(event) {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return json(204, {}, headers);
  const action = event.queryStringParameters?.action || 'health';

  try {
    if (action === 'health' || action === 'ping') {
      return json(200, { status: 'ONLINE', timestamp: new Date().toISOString() }, headers);
    }

    const sql = getSql();

    if (action === 'tenant-data') {
      const auth = authorizeRequest(event, { tenant: true });
      return json(200, await getTenantData(sql, auth.organizationId), headers);
    }

    if (action === 'create-lesson') {
      requireMethod(event, 'POST');
      const auth = authorizeRequest(event, { tenant: true });
      return json(201, { ok: true, aula: await createLesson(sql, auth, parseJsonBody(event)) }, headers);
    }

    if (action === 'record-payment') {
      requireMethod(event, 'POST');
      const auth = authorizeRequest(event, { tenant: true });
      return json(201, { ok: true, pagamento: await recordPayment(sql, auth, parseJsonBody(event)) }, headers);
    }

    if (action === 'create-expense') {
      requireMethod(event, 'POST');
      const auth = authorizeRequest(event, { tenant: true });
      return json(201, { ok: true, despesa: await createExpense(sql, auth, parseJsonBody(event)) }, headers);
    }

    authorizeRequest(event, { superAdmin: true });

    if (action === 'dashboard') return json(200, await getMasterDashboard(sql), headers);
    if (action === 'subscriptions') return json(200, await getSubscriptions(sql), headers);
    if (action === 'invites') return json(200, await getInvites(sql), headers);

    if (action === 'tables' || action === 'db-schema') {
      const tables = await sql`SELECT table_name AS tabela FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
      const safeTables = tables.filter(({ tabela }) => TENANT_TABLES.has(tabela));
      return json(200, { totalTabelas: safeTables.length, tabelas: safeTables }, headers);
    }

    if (action === 'update-subscription') {
      requireMethod(event, 'POST');
      const payload = parseJsonBody(event);
      const orgId = requireText(payload.orgId, 'orgId');
      const validaAte = payload.diasValidade
        ? new Date(Date.now() + Number(payload.diasValidade) * 86400000).toISOString()
        : null;
      const rows = await sql`UPDATE organizacao SET status_assinatura = COALESCE(${payload.statusAssinatura || null}, status_assinatura), plano_id = COALESCE(${payload.planoId || null}, plano_id), assinatura_valida_ate = COALESCE(${validaAte}::timestamptz, assinatura_valida_ate) WHERE id = ${orgId} RETURNING id`;
      if (!rows.length) throw new HttpError(404, 'Organização não encontrada');
      return json(200, { ok: true }, headers);
    }

    if (action === 'create-invite') {
      requireMethod(event, 'POST');
      const payload = parseJsonBody(event);
      const professorId = requireText(payload.professorId, 'professorId');
      const [professor] = await sql`SELECT id, organizacao_id FROM usuario WHERE id = ${professorId} AND status = 'ATIVO'`;
      if (!professor) throw new HttpError(404, 'Professor não encontrado');
      const inviteId = `cnv_${randomUUID()}`;
      const token = `AGD-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
      const rows = await sql`INSERT INTO convite_aluno (id, organizacao_id, instrutor_id, nome_aluno, email_aluno, telefone_aluno, categoria, token_convite, status, expira_em) VALUES (${inviteId}, ${professor.organizacao_id}, ${professor.id}, ${requireText(payload.nomeAluno, 'nomeAluno')}, ${requireText(payload.emailAluno, 'emailAluno')}, ${payload.telefoneAluno || null}, ${payload.categoria || 'B'}, ${token}, 'PENDENTE', NOW() + INTERVAL '7 days') RETURNING id`;
      return json(201, { ok: true, conviteId: rows[0].id, token }, headers);
    }

    throw new HttpError(400, `Ação desconhecida: ${action}`);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode === 500) console.error('Falha na API administrativa', error);
    return json(statusCode, { error: statusCode === 500 ? 'Erro interno do servidor' : error.message }, headers);
  }
}