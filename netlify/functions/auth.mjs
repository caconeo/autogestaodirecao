import { createHmac, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { HttpError, authorizeRequest, parseJsonBody } from './_security.mjs';
import { fingerprintCpf, hashPassword, normalizeCpf, normalizeEmail, verifyPassword } from './_identity.mjs';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  return neon(process.env.DATABASE_URL);
}

function responseHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...(allowedOrigin && origin === allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {})
  };
}

function response(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function requirePost(event) {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Método não permitido');
}

function requireName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 150) throw new HttpError(400, 'Nome inválido');
  return name;
}

export function issueAccessToken(user, options = {}) {
  const secret = options.secret || process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_JWT_SECRET deve ter pelo menos 32 caracteres');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    papel: user.papel,
    organizacao_id: user.organizacao_id,
    modo_demo: Boolean(user.modo_demo),
    iat: now,
    exp: now + 3600,
    iss: options.issuer || process.env.AUTH_JWT_ISSUER,
    aud: options.audience || process.env.AUTH_JWT_AUDIENCE
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

async function registerInstructor(sql, payload) {
  const name = requireName(payload.nome);
  const email = normalizeEmail(payload.email);
  const cpf = normalizeCpf(payload.cpf);
  const cpfFingerprint = fingerprintCpf(cpf);
  const passwordHash = await hashPassword(payload.senha);
  const organizationId = `org_${randomUUID()}`;
  const userId = `usr_${randomUUID()}`;
  const identityId = `idt_${randomUUID()}`;

  try {
    const rows = await sql`
      WITH nova_org AS (
        INSERT INTO organizacao (id, tipo, nome, email_contato, status_assinatura, ativa, modo_demo)
        VALUES (${organizationId}, 'INSTRUTOR_AUTONOMO', ${`${name} · Instrutor`}, ${email}, 'DEGUSTACAO', TRUE, FALSE)
        RETURNING id
      ), novo_usuario AS (
        INSERT INTO usuario (
          id, organizacao_id, nome, email, senha_hash, papel, status,
          cpf_fingerprint, cpf_ultimos4, modo_demo, perfil_completo
        )
        SELECT ${userId}, id, ${name}, ${email}, ${passwordHash}, 'ADMIN_ORG', 'ATIVO',
          ${cpfFingerprint}, ${cpf.slice(-4)}, FALSE, TRUE
        FROM nova_org
        RETURNING id, organizacao_id, nome, email, papel, modo_demo
      ), nova_identidade AS (
        INSERT INTO identidade_acesso (id, usuario_id, email, provedor, senha_hash, modo_demo)
        SELECT ${identityId}, id, email, 'PASSWORD', ${passwordHash}, FALSE FROM novo_usuario
      )
      SELECT * FROM novo_usuario
    `;
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'E-mail ou CPF já cadastrado');
    throw error;
  }
}

async function login(sql, payload) {
  const email = normalizeEmail(payload.email);
  const [identity] = await sql`
    SELECT i.id AS identidade_id, i.senha_hash, u.id, u.organizacao_id, u.nome, u.email,
      u.papel, u.status, u.modo_demo, o.ativa AS organizacao_ativa
    FROM identidade_acesso i
    JOIN usuario u ON u.id = i.usuario_id
    JOIN organizacao o ON o.id = u.organizacao_id
    WHERE LOWER(i.email) = ${email} AND i.provedor = 'PASSWORD' AND i.ativo = TRUE
  `;
  if (!identity || !(await verifyPassword(payload.senha, identity.senha_hash))) {
    throw new HttpError(401, 'E-mail ou senha inválidos');
  }
  if (identity.status !== 'ATIVO' || !identity.organizacao_ativa) throw new HttpError(403, 'Conta inativa');
  await sql`UPDATE identidade_acesso SET ultimo_login = NOW() WHERE id = ${identity.identidade_id}`;
  await sql`UPDATE usuario SET ultimo_acesso = NOW() WHERE id = ${identity.id}`;
  return identity;
}

async function getCurrentUser(sql, event) {
  const auth = authorizeRequest(event, { tenant: true });
  const [user] = await sql`
    SELECT u.id, u.organizacao_id, u.nome, u.email, u.papel, u.status, u.modo_demo,
      u.email_verificado, u.perfil_completo, u.cpf_ultimos4,
      o.nome AS organizacao_nome, o.tipo AS organizacao_tipo
    FROM usuario u
    JOIN organizacao o ON o.id = u.organizacao_id
    WHERE u.id = ${auth.userId} AND u.organizacao_id = ${auth.organizationId}
      AND u.status = 'ATIVO' AND o.ativa = TRUE
  `;
  if (!user) throw new HttpError(401, 'Sessão inválida');
  return user;
}

export async function handler(event) {
  const headers = responseHeaders(event);
  if (event.httpMethod === 'OPTIONS') return response(204, {}, headers);
  const action = event.queryStringParameters?.action || 'me';

  try {
    const sql = getSql();
    if (action === 'register-instructor') {
      requirePost(event);
      const user = await registerInstructor(sql, parseJsonBody(event));
      return response(201, { accessToken: issueAccessToken(user), expiresIn: 3600, user }, headers);
    }
    if (action === 'login') {
      requirePost(event);
      const user = await login(sql, parseJsonBody(event));
      return response(200, { accessToken: issueAccessToken(user), expiresIn: 3600, user: {
        id: user.id,
        organizacao_id: user.organizacao_id,
        nome: user.nome,
        email: user.email,
        papel: user.papel,
        modo_demo: user.modo_demo
      } }, headers);
    }
    if (action === 'me') return response(200, { user: await getCurrentUser(sql, event) }, headers);
    throw new HttpError(400, `Ação desconhecida: ${action}`);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode === 500) console.error('Falha na API de autenticação', error);
    return response(statusCode, { error: statusCode === 500 ? 'Erro interno do servidor' : error.message }, headers);
  }
}
