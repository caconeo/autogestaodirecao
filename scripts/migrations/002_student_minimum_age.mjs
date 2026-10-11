export const id = '002_student_minimum_age';

export async function up(sql) {
  await sql`
    CREATE OR REPLACE FUNCTION validar_maioridade_aluno()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.data_nascimento IS NULL THEN
        RAISE EXCEPTION 'Data de nascimento obrigatória para aluno' USING ERRCODE = '23514';
      END IF;
      IF NEW.data_nascimento > CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de nascimento inválida' USING ERRCODE = '23514';
      END IF;
      IF AGE(CURRENT_DATE, NEW.data_nascimento) < INTERVAL '18 years' THEN
        RAISE EXCEPTION 'Cadastro permitido somente para maiores de 18 anos' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS aluno_validar_maioridade ON aluno`;
  await sql`
    CREATE TRIGGER aluno_validar_maioridade
    BEFORE INSERT OR UPDATE OF data_nascimento ON aluno
    FOR EACH ROW EXECUTE FUNCTION validar_maioridade_aluno()
  `;
}
