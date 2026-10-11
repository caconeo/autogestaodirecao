import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { HttpError, authorizeRequest, parseJsonBody, requirePositiveInteger } from './_security.mjs';

const PAYMENT_METHODS = new Set(['PIX', 'DINHEIRO', 'CARTAO', 'TRANSFERENCIA', 'OUTRO']);
const EXPENSE_STATUSES = new Set(['PENDENTE', 'PAGA']);

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

function requireText(value, field, maxLength = 255) {
  const text = String(value || '').trim();
  if (!text) throw new HttpError(400, `${field} é obrigatório`);
  if (text.length > maxLength) throw new HttpError(400, `${field} excede o tamanho permitido`);
  return text;
}

function requireDate(value, field) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
    throw new HttpError(400, `${field} inválido`);
  }
  return raw;
}

function requireInteger(value, field, min = 1, max = 10000) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field} inválido`);
  }
  return value;
}

export function normalizePaymentMethod(value) {
  const method = String(value || 'PIX').trim().toUpperCase().replace('Ã', 'A').replace('Ç', 'C');
  if (!PAYMENT_METHODS.has(method)) throw new HttpError(400, 'Meio de pagamento inválido');
  return method;
}

export function normalizeExpenseStatus(value) {
  const status = String(value || 'PENDENTE').trim().toUpperCase();
  if (!EXPENSE_STATUSES.has(status)) throw new HttpError(400, 'Status de despesa inválido');
  return status;
}

async function getDashboard(sql, organizationId) {
  const [summary, receivables, expenses, packages, students, recentPayments] = await Promise.all([
    sql`
      WITH recebimentos AS (
        SELECT
          COALESCE(SUM(valor_centavos) FILTER (
            WHERE recebido_em >= DATE_TRUNC('month', CURRENT_DATE)::date
              AND recebido_em < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
          ), 0)::int AS recebido_mes_centavos
        FROM pagamento
        WHERE organizacao_id = ${organizationId}
      ), contas AS (
        SELECT
          COALESCE(SUM(GREATEST(c.valor_centavos - COALESCE(p.pago, 0), 0)), 0)::int AS aberto_centavos,
          COALESCE(SUM(GREATEST(c.valor_centavos - COALESCE(p.pago, 0), 0)) FILTER (
            WHERE c.vencimento < CURRENT_DATE AND c.status <> 'CANCELADA'
          ), 0)::int AS vencido_centavos
        FROM conta_receber c
        LEFT JOIN (
          SELECT conta_receber_id, SUM(valor_centavos)::int AS pago
          FROM pagamento
          WHERE organizacao_id = ${organizationId}
          GROUP BY conta_receber_id
        ) p ON p.conta_receber_id = c.id
        WHERE c.organizacao_id = ${organizationId} AND c.status <> 'CANCELADA'
      ), despesas AS (
        SELECT
          COALESCE(SUM(valor_centavos) FILTER (
            WHERE status = 'PAGA'
              AND COALESCE(pago_em, vencimento) >= DATE_TRUNC('month', CURRENT_DATE)::date
              AND COALESCE(pago_em, vencimento) < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
          ), 0)::int AS despesas_mes_centavos,
          COALESCE(SUM(valor_centavos) FILTER (WHERE status = 'PENDENTE'), 0)::int AS despesas_pendentes_centavos
        FROM despesa
        WHERE organizacao_id = ${organizationId}
      )
      SELECT r.recebido_mes_centavos, c.aberto_centavos, c.vencido_centavos,
        d.despesas_mes_centavos, d.despesas_pendentes_centavos,
        (r.recebido_mes_centavos - d.despesas_mes_centavos)::int AS saldo_mes_centavos
      FROM recebimentos r CROSS JOIN contas c CROSS JOIN despesas d
    `,
    sql`
      SELECT c.id, c.aluno_id, a.nome AS aluno_nome, c.pacote_id, c.descricao,
        c.valor_centavos, COALESCE(SUM(p.valor_centavos), 0)::int AS pago_centavos,
        GREATEST(c.valor_centavos - COALESCE(SUM(p.valor_centavos), 0), 0)::int AS saldo_centavos,
        c.vencimento,
        CASE
          WHEN c.status = 'CANCELADA' THEN 'CANCELADA'
          WHEN COALESCE(SUM(p.valor_centavos), 0) >= c.valor_centavos THEN 'QUITADA'
          WHEN c.vencimento < CURRENT_DATE THEN 'VENCIDA'
          WHEN COALESCE(SUM(p.valor_centavos), 0) > 0 THEN 'PARCIAL'
          ELSE 'ABERTA'
        END AS status,
        c.origem, c.criado_em
      FROM conta_receber c
      JOIN aluno a ON a.id = c.aluno_id AND a.organizacao_id = c.organizacao_id
      LEFT JOIN pagamento p ON p.conta_receber_id = c.id AND p.organizacao_id = c.organizacao_id
      WHERE c.organizacao_id = ${organizationId}
      GROUP BY c.id, a.nome
      ORDER BY CASE WHEN c.vencimento < CURRENT_DATE THEN 0 ELSE 1 END, c.vencimento, c.criado_em DESC
      LIMIT 200
    `,
    sql`SELECT id, descricao, valor_centavos, vencimento, pago_em, status, criado_em FROM despesa WHERE organizacao_id = ${organizationId} ORDER BY vencimento DESC, criado_em DESC LIMIT 100`,
    sql`SELECT p.id, p.aluno_id, a.nome AS aluno_nome, p.nome, p.quantidade, p.saldo_aulas, p.valor_centavos, p.status, p.criado_em FROM pacote p JOIN aluno a ON a.id = p.aluno_id AND a.organizacao_id = p.organizacao_id WHERE p.organizacao_id = ${organizationId} ORDER BY p.criado_em DESC LIMIT 100`,
    sql`SELECT id, nome, email, status FROM aluno WHERE organizacao_id = ${organizationId} AND status = 'ATIVO' ORDER BY nome`,
    sql`SELECT p.id, p.conta_receber_id, p.valor_centavos, p.recebido_em, p.meio, p.referencia, a.nome AS aluno_nome, c.descricao FROM pagamento p JOIN conta_receber c ON c.id = p.conta_receber_id AND c.organizacao_id = p.organizacao_id JOIN aluno a ON a.id = c.aluno_id AND a.organizacao_id = c.organizacao_id WHERE p.organizacao_id = ${organizationId} ORDER BY p.recebido_em DESC, p.criado_em DESC LIMIT 50`
  ]);
  return { summary: summary[0], receivables, expenses, packages, students, recentPayments };
}

async function createPackage(sql, organizationId, userId, payload) {
  const studentId = requireText(payload.alunoId, 'alunoId', 64);
  const name = requireText(payload.nome, 'nome', 150);
  const quantity = requireInteger(payload.quantidade, 'quantidade', 1, 500);
  const value = requirePositiveInteger(payload.valorCentavos, 'valorCentavos');
  const dueDate = requireDate(payload.vencimento, 'vencimento');
  const packageId = `pct_${randomUUID()}`;
  const receivableId = `rec_${randomUUID()}`;
  const auditId = `aud_${randomUUID()}`;

  const rows = await sql`
    WITH aluno_valido AS (
      SELECT id FROM aluno
      WHERE id = ${studentId} AND organizacao_id = ${organizationId} AND status = 'ATIVO'
    ), novo_pacote AS (
      INSERT INTO pacote (id, organizacao_id, aluno_id, nome, quantidade, saldo_aulas, valor_centavos, status)
      SELECT ${packageId}, ${organizationId}, id, ${name}, ${quantity}, ${quantity}, ${value}, 'ATIVO'
      FROM aluno_valido
      RETURNING id, aluno_id, nome, quantidade, saldo_aulas, valor_centavos, status
    ), nova_conta AS (
      INSERT INTO conta_receber (id, organizacao_id, aluno_id, pacote_id, descricao, valor_centavos, vencimento, status, origem)
      SELECT ${receivableId}, ${organizationId}, aluno_id, id, nome, valor_centavos, ${dueDate}::date, 'ABERTA', 'PACOTE'
      FROM novo_pacote
      RETURNING id
    ), auditoria AS (
      INSERT INTO registro_auditoria (id, autor_tipo, autor_id, acao, tabela_afetada, detalhes_json)
      SELECT ${auditId}, 'USUARIO', ${userId}, 'CRIACAO_PACOTE', 'pacote',
        jsonb_build_object('pacote_id', id, 'aluno_id', aluno_id, 'valor_centavos', valor_centavos)
      FROM novo_pacote
    )
    SELECT p.*, c.id AS conta_receber_id FROM novo_pacote p CROSS JOIN nova_conta c
  `;
  if (!rows.length) throw new HttpError(404, 'Aluno ativo não encontrado nesta organização');
  return rows[0];
}

async function createExpense(sql, organizationId, userId, payload) {
  const description = requireText(payload.descricao, 'descricao', 255);
  const value = requirePositiveInteger(payload.valorCentavos, 'valorCentavos');
  const dueDate = requireDate(payload.vencimento, 'vencimento');
  const status = normalizeExpenseStatus(payload.status);
  const paidAt = status === 'PAGA' ? requireDate(payload.pagoEm || dueDate, 'pagoEm') : null;
  const expenseId = `des_${randomUUID()}`;
  const rows = await sql`
    WITH nova_despesa AS (
      INSERT INTO despesa (id, organizacao_id, descricao, valor_centavos, vencimento, pago_em, status)
      VALUES (${expenseId}, ${organizationId}, ${description}, ${value}, ${dueDate}::date, ${paidAt}::date, ${status})
      RETURNING id, descricao, valor_centavos, vencimento, pago_em, status, criado_em
    ), auditoria AS (
      INSERT INTO registro_auditoria (id, autor_tipo, autor_id, acao, tabela_afetada, detalhes_json)
      SELECT ${`aud_${randomUUID()}`}, 'USUARIO', ${userId}, 'CRIACAO_DESPESA', 'despesa',
        jsonb_build_object('despesa_id', id, 'valor_centavos', valor_centavos, 'status', status)
      FROM nova_despesa
    )
    SELECT * FROM nova_despesa
  `;
  return rows[0];
}

async function recordPayment(sql, organizationId, userId, payload) {
  const receivableId = requireText(payload.contaReceberId, 'contaReceberId', 64);
  const value = requirePositiveInteger(payload.valorCentavos, 'valorCentavos');
  const receivedAt = requireDate(payload.recebidoEm || new Date().toISOString().slice(0, 10), 'recebidoEm');
  const method = normalizePaymentMethod(payload.meio);
  const reference = payload.referencia ? requireText(payload.referencia, 'referencia', 150) : null;
  const paymentId = `pag_${randomUUID()}`;

  const rows = await sql`
    WITH tenant_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${`financeiro:${organizationId}:${receivableId}`}, 0))
    ), saldo AS MATERIALIZED (
      SELECT c.id, c.valor_centavos - COALESCE(SUM(p.valor_centavos), 0)::int AS saldo_centavos
      FROM conta_receber c
      CROSS JOIN tenant_lock
      LEFT JOIN pagamento p ON p.conta_receber_id = c.id AND p.organizacao_id = ${organizationId}
      WHERE c.id = ${receivableId} AND c.organizacao_id = ${organizationId} AND c.status <> 'CANCELADA'
      GROUP BY c.id, c.valor_centavos
    ), novo_pagamento AS (
      INSERT INTO pagamento (id, organizacao_id, conta_receber_id, valor_centavos, recebido_em, meio, referencia)
      SELECT ${paymentId}, ${organizationId}, id, ${value}, ${receivedAt}::date, ${method}, ${reference}
      FROM saldo WHERE saldo_centavos > 0 AND ${value} <= saldo_centavos
      RETURNING id, conta_receber_id, valor_centavos, recebido_em, meio, referencia
    ), atualizada AS (
      UPDATE conta_receber c SET status = CASE WHEN s.saldo_centavos = ${value} THEN 'QUITADA' ELSE 'PARCIAL' END
      FROM saldo s, novo_pagamento p
      WHERE c.id = s.id AND c.organizacao_id = ${organizationId}
      RETURNING c.status
    ), auditoria AS (
      INSERT INTO registro_auditoria (id, autor_tipo, autor_id, acao, tabela_afetada, detalhes_json)
      SELECT ${`aud_${randomUUID()}`}, 'USUARIO', ${userId}, 'REGISTRO_PAGAMENTO', 'pagamento',
        jsonb_build_object('pagamento_id', id, 'conta_receber_id', conta_receber_id, 'valor_centavos', valor_centavos)
      FROM novo_pagamento
    )
    SELECT p.*, a.status AS conta_status FROM novo_pagamento p CROSS JOIN atualizada a
  `;
  if (!rows.length) throw new HttpError(409, 'Conta inexistente, cancelada, quitada ou pagamento superior ao saldo');
  return rows[0];
}

export async function handler(event) {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return json(204, {}, headers);

  try {
    const auth = authorizeRequest(event, { tenant: true });
    if (!['ADMIN_ORG', 'INSTRUTOR'].includes(auth.role)) throw new HttpError(403, 'Perfil sem acesso à gestão do instrutor');
    const sql = getSql();
    const action = event.queryStringParameters?.action || 'dashboard';

    if (action === 'dashboard') return json(200, await getDashboard(sql, auth.organizationId), headers);
    requireMethod(event, 'POST');
    const payload = parseJsonBody(event);
    if (action === 'create-package') return json(201, { ok: true, package: await createPackage(sql, auth.organizationId, auth.userId, payload) }, headers);
    if (action === 'create-expense') return json(201, { ok: true, expense: await createExpense(sql, auth.organizationId, auth.userId, payload) }, headers);
    if (action === 'record-payment') return json(201, { ok: true, payment: await recordPayment(sql, auth.organizationId, auth.userId, payload) }, headers);
    throw new HttpError(400, `Ação desconhecida: ${action}`);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode === 500) console.error('Falha na API do instrutor', error);
    return json(statusCode, { error: statusCode === 500 ? 'Erro interno do servidor' : error.message }, headers);
  }
}
