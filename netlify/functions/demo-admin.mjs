import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { HttpError, authorizeRequest, parseJsonBody } from './_security.mjs';
import { hashPassword, normalizeEmail, requireAdultBirthDate } from './_identity.mjs';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  return neon(process.env.DATABASE_URL);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

function requirePost(event) {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Método não permitido');
}

function requireName(value, field = 'nome') {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 150) throw new HttpError(400, `${field} inválido`);
  return name;
}

function demoFingerprint(id) {
  return createHash('sha256').update(`demo:${id}`).digest('hex');
}

async function createDemoInstructor(sql, payload, adminId) {
  const name = requireName(payload.nome);
  const email = normalizeEmail(payload.email);
  const passwordHash = await hashPassword(payload.senha);
  const organizationId = `org_demo_${randomUUID()}`;
  const userId = `usr_demo_${randomUUID()}`;
  const identityId = `idt_demo_${randomUUID()}`;

  try {
    const rows = await sql`
      WITH nova_org AS (
        INSERT INTO organizacao (
          id, tipo, nome, email_contato, status_assinatura, ativa, modo_demo
        ) VALUES (
          ${organizationId}, 'INSTRUTOR_AUTONOMO', ${`${name} · Demonstração`},
          ${email}, 'DEMO', TRUE, TRUE
        ) RETURNING id
      ), novo_usuario AS (
        INSERT INTO usuario (
          id, organizacao_id, nome, email, senha_hash, papel, status,
          cpf_fingerprint, cpf_ultimos4, modo_demo, email_verificado, perfil_completo
        ) SELECT
          ${userId}, id, ${name}, ${email}, ${passwordHash}, 'ADMIN_ORG', 'ATIVO',
          ${demoFingerprint(userId)}, 'DEMO', TRUE, TRUE, TRUE
        FROM nova_org
        RETURNING id, organizacao_id, nome, email, papel, modo_demo
      ), nova_identidade AS (
        INSERT INTO identidade_acesso (id, usuario_id, email, provedor, senha_hash, modo_demo)
        SELECT ${identityId}, id, email, 'PASSWORD', ${passwordHash}, TRUE FROM novo_usuario
      ), auditoria AS (
        INSERT INTO registro_auditoria (id, autor_tipo, autor_id, acao, tabela_afetada, detalhes_json)
        VALUES (
          ${`aud_${randomUUID()}`}, 'SUPER_ADMIN', ${adminId}, 'CRIACAO_INSTRUTOR_DEMO',
          'usuario', ${JSON.stringify({ userId, organizationId })}::jsonb
        )
      )
      SELECT * FROM novo_usuario
    `;
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'E-mail demo já cadastrado');
    throw error;
  }
}

async function createDemoStudent(sql, payload, adminId) {
  const name = requireName(payload.nome);
  const email = normalizeEmail(payload.email);
  const instructorId = String(payload.instrutorId || '').trim();
  if (!instructorId) throw new HttpError(400, 'instrutorId é obrigatório');
  const passwordHash = await hashPassword(payload.senha);
  const birthDate = requireAdultBirthDate(payload.dataNascimento);
  const studentId = `alu_demo_${randomUUID()}`;
  const identityId = `idt_demo_${randomUUID()}`;

  try {
    const rows = await sql`
      WITH instrutor_demo AS (
        SELECT id, organizacao_id
        FROM usuario
        WHERE id = ${instructorId} AND modo_demo = TRUE AND status = 'ATIVO'
      ), novo_aluno AS (
        INSERT INTO aluno (
          id, organizacao_id, instrutor_vinculado_id, nome, email, senha_hash,
          telefone, categoria, status, data_nascimento, modo_demo, email_verificado, perfil_completo
        )
        SELECT
          ${studentId}, organizacao_id, id, ${name}, ${email}, ${passwordHash},
          ${payload.telefone || null}, ${payload.categoria || 'B'}, 'ATIVO', ${birthDate}::date, TRUE, TRUE, TRUE
        FROM instrutor_demo
        RETURNING id, organizacao_id, instrutor_vinculado_id, nome, email, categoria, modo_demo
      ), nova_identidade AS (
        INSERT INTO identidade_acesso (id, aluno_id, email, provedor, senha_hash, modo_demo)
        SELECT ${identityId}, id, email, 'PASSWORD', ${passwordHash}, TRUE FROM novo_aluno
      ), auditoria AS (
        INSERT INTO registro_auditoria (id, autor_tipo, autor_id, acao, tabela_afetada, detalhes_json)
        SELECT
          ${`aud_${randomUUID()}`}, 'SUPER_ADMIN', ${adminId}, 'CRIACAO_ALUNO_DEMO',
          'aluno', ${JSON.stringify({ studentId, instructorId })}::jsonb
        FROM novo_aluno
      )
      SELECT * FROM novo_aluno
    `;
    if (!rows.length) throw new HttpError(404, 'Instrutor demo ativo não encontrado');
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'E-mail demo já cadastrado');
    throw error;
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  try {
    requirePost(event);
    const auth = authorizeRequest(event, { superAdmin: true });
    const payload = parseJsonBody(event);
    const sql = getSql();
    const action = event.queryStringParameters?.action;
    if (action === 'create-instructor') {
      return json(201, { ok: true, instructor: await createDemoInstructor(sql, payload, auth.userId) });
    }
    if (action === 'create-student') {
      return json(201, { ok: true, student: await createDemoStudent(sql, payload, auth.userId) });
    }
    throw new HttpError(400, `Ação desconhecida: ${action || ''}`);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode === 500) console.error('Falha na API administrativa demo', error);
    return json(statusCode, { error: statusCode === 500 ? 'Erro interno do servidor' : error.message });
  }
}
