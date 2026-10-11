import { createHmac, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

function readBearerToken(headers = {}) {
  const authorization = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) throw new HttpError(401, 'Token de acesso ausente');
  return match[1];
}

export function verifyJwt(token, secret, options = {}) {
  if (!secret) throw new Error('AUTH_JWT_SECRET não configurado');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Token de acesso inválido');

  let header;
  let claims;
  try {
    header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
    claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  } catch {
    throw new HttpError(401, 'Token de acesso inválido');
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new HttpError(401, 'Algoritmo de token não permitido');
  }

  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  let received;
  try {
    received = decodeBase64Url(parts[2]);
  } catch {
    throw new HttpError(401, 'Assinatura de token inválida');
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(401, 'Assinatura de token inválida');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!claims.sub || !Number.isInteger(claims.exp) || claims.exp <= now) {
    throw new HttpError(401, 'Token expirado ou sem identidade');
  }
  if (claims.nbf && claims.nbf > now) throw new HttpError(401, 'Token ainda não está válido');
  if (options.issuer && claims.iss !== options.issuer) throw new HttpError(401, 'Emissor do token inválido');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (options.audience && !audiences.includes(options.audience)) {
    throw new HttpError(401, 'Audiência do token inválida');
  }

  return claims;
}

export function authorizeRequest(event, options = {}) {
  const token = readBearerToken(event.headers);
  const claims = verifyJwt(token, process.env.AUTH_JWT_SECRET, {
    issuer: process.env.AUTH_JWT_ISSUER,
    audience: process.env.AUTH_JWT_AUDIENCE
  });
  const role = claims.papel || claims.role;
  const organizationId = claims.organizacao_id || claims.organizationId || null;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  if (!role) throw new HttpError(403, 'Perfil de acesso ausente');
  if (options.superAdmin && !isSuperAdmin) throw new HttpError(403, 'Acesso restrito ao administrador master');
  if (options.tenant && !organizationId) throw new HttpError(403, 'Organização ausente no token');

  return { userId: claims.sub, role, organizationId, isSuperAdmin, claims };
}

export function assertOrganization(auth, requestedOrganizationId) {
  if (requestedOrganizationId && requestedOrganizationId !== auth.organizationId) {
    throw new HttpError(403, 'Acesso negado para a organização informada');
  }
  if (!auth.organizationId) throw new HttpError(403, 'Organização ausente no token');
  return auth.organizationId;
}

export function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw new HttpError(400, 'Corpo JSON inválido');
  }
}

export function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(400, `${field} deve ser um inteiro positivo em centavos`);
  }
  return value;
}