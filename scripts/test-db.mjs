import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function testConnection() {
  try {
    console.log('Conectando ao Neon com a DATABASE_URL fornecida...');
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT NOW() as agora, current_database() as banco, version() as versao;`;
    console.log('✅ CONEXÃO ESTABELECIDA COM SUCESSO!');
    console.log('Data/Hora:', result[0].agora);
    console.log('Banco de Dados:', result[0].banco);
    console.log('Versão PostgreSQL:', result[0].versao);
  } catch (err) {
    console.error('❌ Erro ao conectar ao Neon:', err);
    process.exit(1);
  }
}

testConnection();
