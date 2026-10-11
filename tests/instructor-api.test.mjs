import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { handler, normalizeExpenseStatus, normalizePaymentMethod } from '../netlify/functions/instructor.mjs';

const secret = 'segredo-de-testes-com-mais-de-trinta-e-dois-bytes';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function tokenFor(claims) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: 'usr_test',
    papel: 'ADMIN_ORG',
    organizacao_id: 'org_test',
    exp: Math.floor(Date.now() / 1000) + 300,
    iss: 'agd-tests',
    aud: 'agd-api',
    ...claims
  });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

test('normaliza somente meios de pagamento permitidos', () => {
  assert.equal(normalizePaymentMethod('pix'), 'PIX');
  assert.equal(normalizePaymentMethod('dinheiro'), 'DINHEIRO');
  assert.throws(() => normalizePaymentMethod('criptomoeda'), /inválido/);
});

test('normaliza somente estados válidos de despesa', () => {
  assert.equal(normalizeExpenseStatus('paga'), 'PAGA');
  assert.equal(normalizeExpenseStatus(), 'PENDENTE');
  assert.throws(() => normalizeExpenseStatus('cancelada'), /inválido/);
});

test('API financeira exige autenticação antes de acessar o banco', async () => {
  process.env.AUTH_JWT_SECRET = secret;
  process.env.AUTH_JWT_ISSUER = 'agd-tests';
  process.env.AUTH_JWT_AUDIENCE = 'agd-api';
  delete process.env.DATABASE_URL;
  const result = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { action: 'dashboard' } });
  assert.equal(result.statusCode, 401);
});

test('API financeira bloqueia perfil de aluno antes de acessar o banco', async () => {
  process.env.AUTH_JWT_SECRET = secret;
  process.env.AUTH_JWT_ISSUER = 'agd-tests';
  process.env.AUTH_JWT_AUDIENCE = 'agd-api';
  delete process.env.DATABASE_URL;
  const result = await handler({
    httpMethod: 'GET',
    headers: { authorization: `Bearer ${tokenFor({ papel: 'ALUNO' })}` },
    queryStringParameters: { action: 'dashboard' }
  });
  assert.equal(result.statusCode, 403);
});
