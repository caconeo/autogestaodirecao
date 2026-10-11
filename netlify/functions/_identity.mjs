import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './_security.mjs';

const scrypt = promisify(scryptCallback);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new HttpError(400, 'E-mail inválido');
  return email;
}

export function normalizeCpf(value) {
  const cpf = String(value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) throw new HttpError(400, 'CPF inválido');
  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) throw new HttpError(400, 'CPF inválido');
  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[10])) throw new HttpError(400, 'CPF inválido');
  return cpf;
}

export function fingerprintCpf(cpf, secret = process.env.CPF_LOOKUP_SECRET) {
  if (!secret || secret.length < 32) throw new Error('CPF_LOOKUP_SECRET deve ter pelo menos 32 caracteres');
  return createHmac('sha256', secret).update(cpf).digest('hex');
}

export function requireAdultBirthDate(value, now = new Date()) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(400, 'Data de nascimento inválida');
  const [year, month, day] = raw.split('-').map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (birthDate.getUTCFullYear() !== year || birthDate.getUTCMonth() !== month - 1 || birthDate.getUTCDate() !== day || birthDate > now) {
    throw new HttpError(400, 'Data de nascimento inválida');
  }
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  if (age < 18) throw new HttpError(422, 'Cadastro permitido somente para maiores de 18 anos');
  return raw;
}
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'A senha deve ter entre 8 e 128 caracteres');
  }
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password, encodedHash) {
  const [algorithm, saltValue, hashValue] = String(encodedHash || '').split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64url');
  const actual = await scrypt(String(password || ''), Buffer.from(saltValue, 'base64url'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
