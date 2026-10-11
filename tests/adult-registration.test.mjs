import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAdultBirthDate } from '../netlify/functions/_identity.mjs';

test('aceita aluno no dia em que completa 18 anos', () => {
  const today = new Date('2026-10-10T12:00:00Z');
  assert.equal(requireAdultBirthDate('2008-10-10', today), '2008-10-10');
});

test('rejeita aluno que ainda não completou 18 anos', () => {
  const today = new Date('2026-10-10T12:00:00Z');
  assert.throws(
    () => requireAdultBirthDate('2008-10-11', today),
    error => error.statusCode === 422
  );
});

test('rejeita datas inexistentes ou futuras', () => {
  const today = new Date('2026-10-10T12:00:00Z');
  assert.throws(() => requireAdultBirthDate('2026-02-30', today), /inválida/);
  assert.throws(() => requireAdultBirthDate('2027-01-01', today), /inválida/);
});
