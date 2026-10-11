import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import * as identityFoundation from './migrations/001_identity_foundation.mjs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL não configurada');
const sql = neon(databaseUrl);
const migrations = [identityFoundation];

await sql`CREATE TABLE IF NOT EXISTS schema_migration (id VARCHAR(100) PRIMARY KEY, aplicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
for (const migration of migrations) {
  const [existing] = await sql`SELECT id FROM schema_migration WHERE id = ${migration.id}`;
  if (existing) {
    console.log(`Migração já aplicada: ${migration.id}`);
    continue;
  }
  await migration.up(sql);
  await sql`INSERT INTO schema_migration (id) VALUES (${migration.id})`;
  console.log(`Migração aplicada: ${migration.id}`);
}
