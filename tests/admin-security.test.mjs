import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  HttpError,
  assertOrganization,
  authorizeRequest,
  requirePositiveInteger,
  verifyJwt
} from '../netlify/functions/_security.mjs';

const secret = 'test-secret-with-more-than-thirty-two-bytes';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(claims, header = { alg: 'HS256', typ: 'JWT' }) {
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function eventFor(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

const validClaims = {
  sub: 'usr_1',
  papel: 'ADMIN_ORG',
  organizacao_id: 'org_1',
  exp: Math.floor(Date.now() / 1000) + 300,
  iss: 'agd-tests',
  aud: 'agd-api'
};

test('aceita JWT HS256 válido e deriva o tenant do token', () => {
  const claims = verifyJwt(sign(validClaims), secret, { issuer: 'agd-tests', audience: 'agd-api' });
  assert.equal(claims.organizacao_id, 'org_1');
});

test('rejeita assinatura adulterada', () => {
  const token = `${sign(validClaims).slice(0, -1)}x`;
  assert.throws(() => verifyJwt(token, secret), error => error instanceof HttpError && error.statusCode === 401);
});

test('rejeita token expirado', () => {
  const token = sign({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 1 });
  assert.throws(() => verifyJwt(token, secret), error => error instanceof HttpError && error.statusCode === 401);
});

test('bloqueia acesso cross-tenant mesmo com payload informado', () => {
  assert.throws(
    () => assertOrganization({ organizationId: 'org_1' }, 'org_2'),
    error => error instanceof HttpError && error.statusCode === 403
  );
});

test('exige papel SUPER_ADMIN nas rotas globais', () => {
  process.env.AUTH_JWT_SECRET = secret;
  process.env.AUTH_JWT_ISSUER = 'agd-tests';
  process.env.AUTH_JWT_AUDIENCE = 'agd-api';
  assert.throws(
    () => authorizeRequest(eventFor(sign(validClaims)), { superAdmin: true }),
    error => error instanceof HttpError && error.statusCode === 403
  );

  const admin = authorizeRequest(eventFor(sign({ ...validClaims, papel: 'SUPER_ADMIN' })), { superAdmin: true });
  assert.equal(admin.isSuperAdmin, true);
});

test('aceita somente valores financeiros inteiros e positivos', () => {
  assert.equal(requirePositiveInteger(1250, 'valorCentavos'), 1250);
  assert.throws(() => requirePositiveInteger(12.5, 'valorCentavos'), /inteiro positivo/);
  assert.throws(() => requirePositiveInteger(-1, 'valorCentavos'), /inteiro positivo/);
});