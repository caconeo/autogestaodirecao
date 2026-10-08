import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function test() {
  const sql = neon(process.env.DATABASE_URL);
  const res = await sql`
    SELECT 
      t.table_name as tabela,
      COALESCE(s.n_live_tup, 0)::int as total_linhas,
      (
        SELECT count(*)::int 
        FROM information_schema.columns c 
        WHERE c.table_name = t.table_name AND c.table_schema = 'public'
      ) as num_colunas
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema = 'public'
    ORDER BY t.table_name;
  `;
  console.log('Result length:', res.length);
  console.log(res);
}

test();
