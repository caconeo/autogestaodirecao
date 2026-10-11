export const id = '001_identity_foundation';

export async function up(sql) {
  await sql`ALTER TABLE organizacao ADD COLUMN IF NOT EXISTS modo_demo BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS cpf_fingerprint VARCHAR(64)`;
  await sql`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS cpf_ultimos4 VARCHAR(4)`;
  await sql`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS modo_demo BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS cpf_fingerprint VARCHAR(64)`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS cpf_ultimos4 VARCHAR(4)`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS data_nascimento DATE`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS endereco_json JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS modo_demo BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE aluno ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS usuario_cpf_real_unico ON usuario (cpf_fingerprint) WHERE cpf_fingerprint IS NOT NULL AND modo_demo = FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS identidade_acesso (
    id VARCHAR(64) PRIMARY KEY,
    usuario_id VARCHAR(64) REFERENCES usuario(id) ON DELETE CASCADE,
    aluno_id VARCHAR(64) REFERENCES aluno(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    provedor VARCHAR(30) NOT NULL DEFAULT 'PASSWORD',
    provedor_subject VARCHAR(255),
    senha_hash TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    modo_demo BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_login TIMESTAMPTZ,
    CONSTRAINT identidade_titular_unico CHECK ((usuario_id IS NOT NULL)::int + (aluno_id IS NOT NULL)::int = 1),
    CONSTRAINT identidade_provedor_valido CHECK (provedor IN ('PASSWORD', 'GOOGLE')),
    CONSTRAINT identidade_senha_valida CHECK (provedor <> 'PASSWORD' OR senha_hash IS NOT NULL)
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS identidade_email_provedor_unico ON identidade_acesso (LOWER(email), provedor)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS identidade_google_subject_unico ON identidade_acesso (provedor, provedor_subject) WHERE provedor_subject IS NOT NULL`;
}
