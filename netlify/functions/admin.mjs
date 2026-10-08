import { neon } from '@neondatabase/serverless';

const DEFAULT_DB_URL = "postgresql://neondb_owner:npg_nuB0OPoE6qFD@ep-lucky-river-b6lcmj3l-pooler.c-2.sa-east-1.aws.neon.tech/autogestaodirecao?sslmode=require&channel_binding=require";

function getSql() {
  const connStr = process.env.DATABASE_URL || DEFAULT_DB_URL;
  return neon(connStr);
}

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const sql = getSql();
  const query = event.queryStringParameters || {};
  const action = query.action || 'dashboard';

  try {
    // 1. HEALTH / PING
    if (action === 'health' || action === 'ping') {
      const t0 = Date.now();
      const res = await sql`SELECT NOW() as agora, current_database() as banco, version() as versao;`;
      const latencyMs = Date.now() - t0;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ONLINE',
          banco: res[0].banco,
          horarioServidor: res[0].agora,
          versaoPg: res[0].versao,
          latenciaMs: latencyMs,
          poolerAtivo: true
        })
      };
    }

    // 2. VALIDAÇÃO DAS TABELAS NO BANCO DE DADOS
    if (action === 'tables' || action === 'db-schema') {
      const tables = await sql`
        SELECT 
          table_name,
          (
            SELECT count(*) 
            FROM information_schema.columns c 
            WHERE c.table_name = t.table_name AND c.table_schema = 'public'
          )::int as num_colunas
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;

      const details = [];
      for (const t of tables) {
        try {
          const countRes = await sql.query(`SELECT COUNT(*)::int as total FROM "${t.table_name}"`);
          const colsRes = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${t.table_name}
            ORDER BY ordinal_position;
          `;
          details.push({
            tabela: t.table_name,
            totalLinhas: countRes[0].total,
            colunas: colsRes
          });
        } catch (e) {
          details.push({
            tabela: t.table_name,
            totalLinhas: -1,
            erro: e.message
          });
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          totalTabelas: tables.length,
          tabelas: details,
          consultadoEm: new Date().toISOString()
        })
      };
    }

    // 3. DASHBOARD MASTER
    if (action === 'dashboard') {
      const [orgStats] = await sql`
        SELECT 
          COUNT(*)::int as total_orgs,
          COUNT(*) FILTER (WHERE status_assinatura = 'ATIVA')::int as assinaturas_ativas,
          COUNT(*) FILTER (WHERE status_assinatura = 'PENDENTE')::int as assinaturas_pendentes,
          COUNT(*) FILTER (WHERE status_assinatura = 'BLOQUEADA')::int as assinaturas_bloqueadas,
          COUNT(*) FILTER (WHERE tipo = 'INSTRUTOR_AUTONOMO')::int as total_autonomos,
          COUNT(*) FILTER (WHERE tipo = 'AUTOESCOLA_CFC')::int as total_cfcs
        FROM organizacao;
      `;

      const [userStats] = await sql`
        SELECT 
          COUNT(*)::int as total_usuarios,
          COUNT(*) FILTER (WHERE status = 'ATIVO')::int as usuarios_ativos
        FROM usuario;
      `;

      const [studentStats] = await sql`
        SELECT 
          COUNT(*)::int as total_alunos,
          COUNT(*) FILTER (WHERE status = 'ATIVO')::int as alunos_ativos,
          COALESCE(SUM(xp_total), 0)::int as xp_acumulado
        FROM aluno;
      `;

      const [planStats] = await sql`
        SELECT 
          COALESCE(SUM(p.valor_mensal_centavos), 0)::int as mrr_estimado_centavos
        FROM organizacao o
        JOIN plano_assinatura p ON o.plano_id = p.id
        WHERE o.status_assinatura = 'ATIVA';
      `;

      const [inviteStats] = await sql`
        SELECT 
          COUNT(*)::int as total_convites,
          COUNT(*) FILTER (WHERE status = 'PENDENTE')::int as convites_pendentes,
          COUNT(*) FILTER (WHERE status = 'ACEITO')::int as convites_aceitos
        FROM convite_aluno;
      `;

      const planos = await sql`
        SELECT id, nome, tipo_publico, valor_mensal_centavos, limite_alunos, limite_veiculos, ativo
        FROM plano_assinatura
        ORDER BY valor_mensal_centavos ASC;
      `;

      const ultimasAtividades = await sql`
        SELECT id, autor_tipo, acao, tabela_afetada, criado_em, detalhes_json
        FROM registro_auditoria
        ORDER BY criado_em DESC
        LIMIT 10;
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          orgStats,
          userStats,
          studentStats,
          planStats,
          inviteStats,
          planos,
          ultimasAtividades
        })
      };
    }

    // 4. GESTÃO DE ASSINATURAS & ORGANIZAÇÕES
    if (action === 'subscriptions') {
      const orgs = await sql`
        SELECT 
          o.id,
          o.tipo,
          o.nome,
          o.email_contato,
          o.telefone,
          o.status_assinatura,
          o.assinatura_valida_ate,
          o.ativa,
          o.criado_em,
          p.id as plano_id,
          p.nome as plano_nome,
          p.valor_mensal_centavos,
          p.limite_alunos,
          p.limite_veiculos,
          (SELECT count(*)::int FROM usuario u WHERE u.organizacao_id = o.id) as qtd_usuarios,
          (SELECT count(*)::int FROM aluno a WHERE a.organizacao_id = o.id) as qtd_alunos,
          (SELECT count(*)::int FROM veiculo v WHERE v.organizacao_id = o.id) as qtd_veiculos
        FROM organizacao o
        LEFT JOIN plano_assinatura p ON o.plano_id = p.id
        ORDER BY o.criado_em DESC;
      `;

      const planos = await sql`
        SELECT id, nome, tipo_publico, valor_mensal_centavos
        FROM plano_assinatura
        ORDER BY valor_mensal_centavos ASC;
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ orgs, planos })
      };
    }

    // 5. ATUALIZAR STATUS DE ASSINATURA / PLANO
    if (action === 'update-subscription' && event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const { orgId, statusAssinatura, planoId, diasValidade } = payload;

      if (!orgId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId é obrigatório' }) };
      }

      let validaAte = null;
      if (diasValidade) {
        validaAte = new Date(Date.now() + diasValidade * 24 * 60 * 60 * 1000).toISOString();
      }

      await sql`
        UPDATE organizacao
        SET 
          status_assinatura = COALESCE(${statusAssinatura}, status_assinatura),
          plano_id = COALESCE(${planoId}, plano_id),
          assinatura_valida_ate = COALESCE(${validaAte}::timestamptz, assinatura_valida_ate)
        WHERE id = ${orgId};
      `;

      // Log de auditoria
      await sql`
        INSERT INTO registro_auditoria (id, autor_tipo, acao, tabela_afetada, detalhes_json)
        VALUES (
          ${'aud_' + Math.random().toString(36).slice(2, 10)},
          'SUPER_ADMIN',
          'ALTERACAO_ASSINATURA',
          'organizacao',
          ${JSON.stringify({ orgId, statusAssinatura, planoId, diasValidade })}::jsonb
        );
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, mensagem: 'Assinatura atualizada com sucesso' })
      };
    }

    // 6. LISTA DE CONVITES & ALUNOS VINCULADOS
    if (action === 'invites') {
      const convites = await sql`
        SELECT 
          c.id,
          c.nome_aluno,
          c.email_aluno,
          c.telefone_aluno,
          c.categoria,
          c.token_convite,
          c.status,
          c.criado_em,
          c.expira_em,
          o.nome as organizacao_nome,
          u.nome as professor_nome,
          u.email as professor_email,
          a.id as aluno_vinculado_id,
          a.xp_total,
          a.nivel
        FROM convite_aluno c
        JOIN organizacao o ON c.organizacao_id = o.id
        JOIN usuario u ON c.instrutor_id = u.id
        LEFT JOIN aluno a ON c.aluno_id = a.id
        ORDER BY c.criado_em DESC;
      `;

      const professores = await sql`
        SELECT u.id, u.nome, u.email, o.id as org_id, o.nome as org_nome
        FROM usuario u
        JOIN organizacao o ON u.organizacao_id = o.id
        ORDER BY u.nome ASC;
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ convites, professores })
      };
    }

    // 7. EMITIR NOVO CONVITE DE ALUNO VINCULADO AO PROFESSOR
    if (action === 'create-invite' && event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const { professorId, nomeAluno, emailAluno, telefoneAluno, categoria } = payload;

      if (!professorId || !nomeAluno || !emailAluno) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Dados incompletos para o convite' }) };
      }

      const [prof] = await sql`
        SELECT u.id, u.organizacao_id 
        FROM usuario u 
        WHERE u.id = ${professorId};
      `;

      if (!prof) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Professor não encontrado' }) };
      }

      const conviteId = 'cnv_' + Math.random().toString(36).slice(2, 10);
      const token = 'AGD-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await sql`
        INSERT INTO convite_aluno (
          id, organizacao_id, instrutor_id, nome_aluno, email_aluno, telefone_aluno, categoria, token_convite, status, expira_em
        ) VALUES (
          ${conviteId},
          ${prof.organizacao_id},
          ${prof.id},
          ${nomeAluno},
          ${emailAluno},
          ${telefoneAluno || null},
          ${categoria || 'B'},
          ${token},
          'PENDENTE',
          ${expiraEm}::timestamptz
        );
      `;

      // Log de auditoria
      await sql`
        INSERT INTO registro_auditoria (id, autor_tipo, acao, tabela_afetada, detalhes_json)
        VALUES (
          ${'aud_' + Math.random().toString(36).slice(2, 10)},
          'SUPER_ADMIN',
          'CRIACAO_CONVITE_ALUNO',
          'convite_aluno',
          ${JSON.stringify({ conviteId, token, emailAluno, professorId })}::jsonb
        );
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          ok: true,
          conviteId,
          token,
          linkAcesso: `https://autogestaodirecao.netlify.app/?convite=${token}`
        })
      };
    }

    // 8. CADASTRAR NOVO USUÁRIO / PROFESSOR COM PLANO DE ASSINATURA
    if (action === 'create-user' && event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const { nome, email, telefone, tipoOrg, planoId, statusAssinatura } = payload;

      if (!nome || !email || !tipoOrg || !planoId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Preencha todos os campos obrigatórios' }) };
      }

      const orgId = 'org_' + Math.random().toString(36).slice(2, 10);
      const usrId = 'usr_' + Math.random().toString(36).slice(2, 10);
      const dias = statusAssinatura === 'DEGUSTACAO' ? 14 : 365;
      const validaAte = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

      await sql`
        INSERT INTO organizacao (
          id, tipo, nome, email_contato, telefone, status_assinatura, plano_id, assinatura_valida_ate, ativa
        ) VALUES (
          ${orgId},
          ${tipoOrg},
          ${nome + (tipoOrg === 'INSTRUTOR_AUTONOMO' ? ' · Autônomo' : ' · CFC')},
          ${email},
          ${telefone || null},
          ${statusAssinatura || 'ATIVA'},
          ${planoId},
          ${validaAte}::timestamptz,
          TRUE
        );
      `;

      await sql`
        INSERT INTO usuario (
          id, organizacao_id, nome, email, senha_hash, papel, status
        ) VALUES (
          ${usrId},
          ${orgId},
          ${nome},
          ${email},
          '123456',
          'ADMIN_ORG',
          'ATIVO'
        );
      `;

      // Log de auditoria
      await sql`
        INSERT INTO registro_auditoria (id, autor_tipo, acao, tabela_afetada, detalhes_json)
        VALUES (
          ${'aud_' + Math.random().toString(36).slice(2, 10)},
          'SUPER_ADMIN',
          'CRIACAO_USUARIO_ASSINANTE',
          'usuario',
          ${JSON.stringify({ orgId, usrId, email, planoId, statusAssinatura })}::jsonb
        );
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ ok: true, orgId, usrId, mensagem: 'Usuário e assinatura criados com sucesso!' })
      };
    }

    // 9. EXECUTOR DE CONSULTA DE VALIDAÇÃO (SOMENTE LEITURA SELECT)
    if (action === 'query-inspector' && event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const sqlText = (payload.sql || '').trim();

      if (!sqlText.toUpperCase().startsWith('SELECT')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'O inspetor web permite apenas comandos SELECT para segurança.' })
        };
      }

      const rows = await sql.query(sqlText);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ total: rows.length, rows })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Ação desconhecida: ${action}` })
    };
  } catch (error) {
    console.error('Erro na função admin-api:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
}
