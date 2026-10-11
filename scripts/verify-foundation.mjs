import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
const sql = neon(process.env.DATABASE_URL);

const migrations = await sql`SELECT id, aplicado_em FROM schema_migration ORDER BY id`;
const [identityTable] = await sql`
  SELECT COUNT(*)::int AS total
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'identidade_acesso'
`;
const columns = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'aluno'
    AND column_name IN ('data_nascimento', 'modo_demo', 'perfil_completo')
  ORDER BY column_name
`;
const [ageTrigger] = await sql`
  SELECT COUNT(*)::int AS total
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table = 'aluno'
    AND trigger_name = 'aluno_validar_maioridade'
`;

const expectedMigrations = ['001_identity_foundation', '002_student_minimum_age'];
const applied = new Set(migrations.map(item => item.id));
if (expectedMigrations.some(id => !applied.has(id))) throw new Error('Migrações obrigatórias ausentes');
if (identityTable.total !== 1) throw new Error('Tabela identidade_acesso ausente');
if (columns.length !== 3) throw new Error('Colunas de aluno incompletas');
if (ageTrigger.total < 1) throw new Error('Trigger de maioridade ausente');

console.log('OK: identidade, campos LGPD/demo e regra de maioridade presentes no Neon.');
