import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyJwt } from '../netlify/functions/_security.mjs';
import { fingerprintCpf, hashPassword, normalizeCpf, normalizeEmail, verifyPassword } from '../netlify/functions/_identity.mjs';
import { issueAccessToken } from '../netlify/functions/auth.mjs';

test('normaliza e valida CPF sem armazenar o documento', () => {
  const cpf = normalizeCpf('529.982.247-25');
  assert.equal(cpf, '52998224725');
  const fingerprint = fingerprintCpf(cpf, 'segredo-de-cpf-com-mais-de-32-caracteres');
  assert.equal(fingerprint.length, 64);
  assert.equal(fingerprint.includes(cpf), false);
});

test('rejeita CPF inválido', () => {
  assert.throws(() => normalizeCpf('111.111.111-11'), /CPF inválido/);
  assert.throws(() => normalizeCpf('529.982.247-24'), /CPF inválido/);
});

test('normaliza e valida e-mail', () => {
  assert.equal(normalizeEmail(' Instrutor@Exemplo.com '), 'instrutor@exemplo.com');
  assert.throws(() => normalizeEmail('email-invalido'), /E-mail inválido/);
});

test('hash de senha usa salt e valida sem guardar texto puro', async () => {
  const first = await hashPassword('SenhaSegura123');
  const second = await hashPassword('SenhaSegura123');
  assert.notEqual(first, second);
  assert.equal(first.includes('SenhaSegura123'), false);
  assert.equal(await verifyPassword('SenhaSegura123', first), true);
  assert.equal(await verifyPassword('SenhaErrada123', first), false);
});

test('token emitido contém tenant e modo demo assinados', () => {
  const secret = 'segredo-jwt-de-teste-com-mais-de-32-caracteres';
  const token = issueAccessToken({ id: 'usr_1', papel: 'ADMIN_ORG', organizacao_id: 'org_1', modo_demo: true }, {
    secret,
    issuer: 'agd-tests',
    audience: 'agd-api'
  });
  const claims = verifyJwt(token, secret, { issuer: 'agd-tests', audience: 'agd-api' });
  assert.equal(claims.organizacao_id, 'org_1');
  assert.equal(claims.modo_demo, true);
});
