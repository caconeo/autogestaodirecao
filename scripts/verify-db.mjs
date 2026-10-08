import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function verify() {
  const sql = neon(process.env.DATABASE_URL);
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log(`\n📊 TABELAS ENCONTRADAS (${tables.length}):`);
  for (const t of tables) {
    const countRes = await sql.query(`SELECT COUNT(*)::int as count FROM ${t.table_name}`);
    console.log(`  • ${t.table_name.padEnd(25)} : ${countRes[0].count} registro(s)`);
  }
}

verify();
