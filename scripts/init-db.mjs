import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERRO: DATABASE_URL não definida no ambiente (.env).');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  console.log('🔄 Iniciando criação e parametrização do schema PostgreSQL no Neon...');

  try {
    // 1. Tabela de Administradores Master
    await sql`
      CREATE TABLE IF NOT EXISTS admin_usuario (
        id VARCHAR(64) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        papel VARCHAR(50) DEFAULT 'SUPER_ADMIN',
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        ultimo_login TIMESTAMPTZ
      );
    `;
    console.log('  ✓ Tabela admin_usuario');

    // 2. Tabela de Planos de Assinatura
    await sql`
      CREATE TABLE IF NOT EXISTS plano_assinatura (
        id VARCHAR(64) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        tipo_publico VARCHAR(50) NOT NULL,
        valor_mensal_centavos INT NOT NULL,
        limite_alunos INT DEFAULT 50,
        limite_veiculos INT DEFAULT 5,
        recursos_json JSONB DEFAULT '{}'::jsonb,
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela plano_assinatura');

    // 3. Tabela de Organizações
    await sql`
      CREATE TABLE IF NOT EXISTS organizacao (
        id VARCHAR(64) PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        documento_fiscal VARCHAR(30),
        telefone VARCHAR(30),
        email_contato VARCHAR(255),
        status_assinatura VARCHAR(30) DEFAULT 'ATIVA',
        plano_id VARCHAR(64) REFERENCES plano_assinatura(id),
        assinatura_valida_ate TIMESTAMPTZ,
        ativa BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela organizacao');

    // 4. Tabela de Usuários (Professores / CFCs)
    await sql`
      CREATE TABLE IF NOT EXISTS usuario (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        papel VARCHAR(50) DEFAULT 'INSTRUTOR',
        status VARCHAR(30) DEFAULT 'ATIVO',
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        ultimo_acesso TIMESTAMPTZ
      );
    `;
    console.log('  ✓ Tabela usuario');

    // 5. Tabela de Convites de Alunos gerados pelo Professor
    await sql`
      CREATE TABLE IF NOT EXISTS convite_aluno (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        instrutor_id VARCHAR(64) REFERENCES usuario(id) ON DELETE CASCADE,
        nome_aluno VARCHAR(255) NOT NULL,
        email_aluno VARCHAR(255) NOT NULL,
        telefone_aluno VARCHAR(30),
        categoria VARCHAR(10) DEFAULT 'B',
        token_convite VARCHAR(128) NOT NULL UNIQUE,
        status VARCHAR(30) DEFAULT 'PENDENTE',
        expira_em TIMESTAMPTZ,
        aluno_id VARCHAR(64),
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela convite_aluno');

    // 6. Tabela de Alunos vinculados ao Professor
    await sql`
      CREATE TABLE IF NOT EXISTS aluno (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        instrutor_vinculado_id VARCHAR(64) REFERENCES usuario(id) ON DELETE SET NULL,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha_hash VARCHAR(255),
        telefone VARCHAR(30),
        categoria VARCHAR(10) DEFAULT 'B',
        status VARCHAR(30) DEFAULT 'ATIVO',
        origem_convite_id VARCHAR(64) REFERENCES convite_aluno(id) ON DELETE SET NULL,
        xp_total INT DEFAULT 0,
        nivel INT DEFAULT 1,
        habilidades_json JSONB DEFAULT '{}'::jsonb,
        conquistas_json JSONB DEFAULT '[]'::jsonb,
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        ultimo_acesso TIMESTAMPTZ
      );
    `;
    console.log('  ✓ Tabela aluno');

    // 7. Tabela de Veículos
    await sql`
      CREATE TABLE IF NOT EXISTS veiculo (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        placa VARCHAR(20) NOT NULL,
        model VARCHAR(100) NOT NULL,
        categoria VARCHAR(10) DEFAULT 'B',
        status VARCHAR(30) DEFAULT 'Disponível',
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela veiculo');

    // 8. Tabela de Aulas
    await sql`
      CREATE TABLE IF NOT EXISTS aula (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        aluno_id VARCHAR(64) REFERENCES aluno(id) ON DELETE CASCADE,
        instrutor_id VARCHAR(64) REFERENCES usuario(id) ON DELETE CASCADE,
        veiculo_id VARCHAR(64) REFERENCES veiculo(id) ON DELETE SET NULL,
        inicio TIMESTAMPTZ NOT NULL,
        fim TIMESTAMPTZ NOT NULL,
        status_local VARCHAR(30) DEFAULT 'AGENDADA',
        topico VARCHAR(255) DEFAULT 'Aula prática',
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela aula');

    // 9. Tabela de Pacotes
    await sql`
      CREATE TABLE IF NOT EXISTS pacote (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        aluno_id VARCHAR(64) REFERENCES aluno(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        quantidade INT NOT NULL,
        saldo_aulas INT NOT NULL,
        valor_centavos INT NOT NULL,
        status VARCHAR(30) DEFAULT 'Ativo',
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela pacote');

    // 10. Tabela de Contas a Receber
    await sql`
      CREATE TABLE IF NOT EXISTS conta_receber (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        aluno_id VARCHAR(64) REFERENCES aluno(id) ON DELETE CASCADE,
        pacote_id VARCHAR(64) REFERENCES pacote(id) ON DELETE SET NULL,
        descricao VARCHAR(255) NOT NULL,
        valor_centavos INT NOT NULL,
        vencimento DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'ABERTA',
        origem VARCHAR(50) DEFAULT 'PACOTE',
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela conta_receber');

    // 11. Tabela de Pagamentos
    await sql`
      CREATE TABLE IF NOT EXISTS pagamento (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        conta_receber_id VARCHAR(64) REFERENCES conta_receber(id) ON DELETE CASCADE,
        valor_centavos INT NOT NULL,
        recebido_em DATE NOT NULL,
        meio VARCHAR(50) DEFAULT 'PIX',
        referencia VARCHAR(255),
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela pagamento');

    // 12. Tabela de Despesas
    await sql`
      CREATE TABLE IF NOT EXISTS despesa (
        id VARCHAR(64) PRIMARY KEY,
        organizacao_id VARCHAR(64) REFERENCES organizacao(id) ON DELETE CASCADE,
        descricao VARCHAR(255) NOT NULL,
        valor_centavos INT NOT NULL,
        vencimento DATE NOT NULL,
        pago_em DATE,
        status VARCHAR(30) DEFAULT 'PAGA',
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela despesa');

    // 13. Tabela de Sessões do Simulador Gamificado
    await sql`
      CREATE TABLE IF NOT EXISTS simulador_sessao (
        id VARCHAR(64) PRIMARY KEY,
        aluno_id VARCHAR(64) REFERENCES aluno(id) ON DELETE CASCADE,
        cenario VARCHAR(50) NOT NULL,
        modo VARCHAR(20) DEFAULT 'IA',
        score INT DEFAULT 100,
        duracao_segundos INT DEFAULT 0,
        infracoes_cometidas JSONB DEFAULT '[]'::jsonb,
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela simulador_sessao');

    // 14. Tabela de Auditoria e Governança
    await sql`
      CREATE TABLE IF NOT EXISTS registro_auditoria (
        id VARCHAR(64) PRIMARY KEY,
        autor_tipo VARCHAR(30) NOT NULL,
        autor_id VARCHAR(64),
        acao VARCHAR(100) NOT NULL,
        tabela_afetada VARCHAR(100) NOT NULL,
        detalhes_json JSONB DEFAULT '{}'::jsonb,
        criado_em TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('  ✓ Tabela registro_auditoria');

    // SEED: Planos de Assinatura Padrão
    console.log('🌱 Inserindo Planos de Assinatura padrão...');
    await sql`
      INSERT INTO plano_assinatura (id, nome, tipo_publico, valor_mensal_centavos, limite_alunos, limite_veiculos, recursos_json)
      VALUES
        ('plano_autonomo_starter', 'Autônomo Starter', 'INSTRUTOR_AUTONOMO', 4900, 30, 2, '{"simulador": true, "portal_aluno": true, "convites_ilimitados": false}'::jsonb),
        ('plano_autonomo_pro', 'Autônomo Pro', 'INSTRUTOR_AUTONOMO', 8900, 100, 5, '{"simulador": true, "portal_aluno": true, "convites_ilimitados": true, "relatorios_avancados": true}'::jsonb),
        ('plano_cfc_essencial', 'CFC Autoescola Essencial', 'AUTOESCOLA_CFC', 18900, 250, 15, '{"simulador": true, "portal_aluno": true, "multi_instrutor": true}'::jsonb),
        ('plano_cfc_enterprise', 'CFC Autoescola Enterprise', 'AUTOESCOLA_CFC', 34900, 1000, 50, '{"simulador": true, "portal_aluno": true, "multi_instrutor": true, "api_detran": true}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        valor_mensal_centavos = EXCLUDED.valor_mensal_centavos,
        limite_alunos = EXCLUDED.limite_alunos,
        limite_veiculos = EXCLUDED.limite_veiculos;
    `;

    // SEED: Administrador Master
    console.log('🌱 Inserindo Administrador Master...');
    await sql`
      INSERT INTO admin_usuario (id, nome, email, senha_hash, papel, ativo)
      VALUES
        ('admin_master_1', 'Cássio Diniz (Master)', 'admin@autogestaodirecao.com.br', 'admin123', 'SUPER_ADMIN', TRUE)
      ON CONFLICT (email) DO NOTHING;
    `;

    // SEED: Organização e Usuário Piloto
    console.log('🌱 Inserindo Organização e Usuário Piloto...');
    await sql`
      INSERT INTO organizacao (id, tipo, nome, email_contato, telefone, status_assinatura, plano_id, assinatura_valida_ate, ativa)
      VALUES
        ('org_cassio', 'INSTRUTOR_AUTONOMO', 'Cássio · Instrutor Autônomo', 'cassio@autogestaodirecao.com.br', '(31) 99999-8888', 'ATIVA', 'plano_autonomo_pro', NOW() + INTERVAL '365 days', TRUE),
        ('org_cfc_direcao_certa', 'AUTOESCOLA_CFC', 'Direção Certa · CFC', 'contato@direcaocerta.com.br', '(31) 3333-4444', 'ATIVA', 'plano_cfc_essencial', NOW() + INTERVAL '365 days', TRUE)
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      INSERT INTO usuario (id, organizacao_id, nome, email, senha_hash, papel, status)
      VALUES
        ('usr_cassio', 'org_cassio', 'Cássio Diniz', 'cassio@autogestaodirecao.com.br', 'senha123', 'ADMIN_ORG', 'ATIVO'),
        ('usr_rafael', 'org_cfc_direcao_certa', 'Rafael Costa', 'rafael@direcaocerta.com.br', 'senha123', 'INSTRUTOR', 'ATIVO')
      ON CONFLICT (email) DO NOTHING;
    `;

    // SEED: Alunos Exemplo Vinculados aos Professores
    console.log('🌱 Inserindo Alunos Exemplo Vinculados...');
    await sql`
      INSERT INTO aluno (id, organizacao_id, instrutor_vinculado_id, nome, email, telefone, categoria, status, xp_total, nivel)
      VALUES
        ('alu_marina', 'org_cassio', 'usr_cassio', 'Marina Oliveira', 'marina@aluno.com', '(31) 99900-1234', 'B', 'ATIVO', 450, 3),
        ('alu_pedro', 'org_cassio', 'usr_cassio', 'Pedro Henrique', 'pedro@aluno.com', '(31) 99800-5678', 'A/B', 'ATIVO', 280, 2),
        ('alu_ana', 'org_cassio', 'usr_cassio', 'Ana Clara Souza', 'ana@aluno.com', '(31) 99700-8765', 'B', 'ATIVO', 120, 1),
        ('alu_lucas', 'org_cfc_direcao_certa', 'usr_rafael', 'Lucas Martins', 'lucas@aluno.com', '(31) 99600-2233', 'B', 'ATIVO', 600, 4)
      ON CONFLICT (email) DO NOTHING;
    `;

    // SEED: Veículos
    await sql`
      INSERT INTO veiculo (id, organizacao_id, placa, model, categoria, status)
      VALUES
        ('vei_1', 'org_cassio', 'RTA-4D29', 'Hyundai HB20', 'B', 'Disponível'),
        ('vei_2', 'org_cassio', 'QPK-8A61', 'Honda CG 160', 'A', 'Disponível'),
        ('vei_3', 'org_cfc_direcao_certa', 'HJK-7B12', 'Chevrolet Onix', 'B', 'Disponível')
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('\n🎉 TODAS AS 14 TABELAS FORAM CRIADAS E POPULADAS NO NEON COM SUCESSO!');
  } catch (err) {
    console.error('❌ Falha na inicialização do schema no Neon:', err);
    process.exit(1);
  }
}

initDatabase();
