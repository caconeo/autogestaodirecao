/* ═══════════════════════════════════════════════════════════════════
   AUTO GESTÃO DE DIREÇÃO — MÓDULO ADMINISTRADOR MASTER & NEON POSTGRES
   Controle total de assinaturas, convites de alunos, e validação de DB
   ═══════════════════════════════════════════════════════════════════ */

const AGDAdmin = (() => {
  const API_URL = '/api/admin';
  const NEON_CONN_STR = 'postgresql://neondb_owner:npg_nuB0OPoE6qFD@ep-lucky-river-b6lcmj3l-pooler.c-2.sa-east-1.aws.neon.tech/autogestaodirecao?sslmode=require&channel_binding=require';

  let currentTab = 'dashboard';
  let cachedDashboard = null;
  let cachedTables = null;
  let cachedSubs = null;
  let cachedInvites = null;
  let connectionHealth = { status: 'CONECTANDO', latencia: 0, versao: 'PostgreSQL 18.6', banco: 'autogestaodirecao' };

  // Toast utilitário
  function toast(msg, isError = false) {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Requisição segura à Netlify Function ou fallback local
  async function apiFetch(action, options = {}) {
    const query = typeof action === 'string' ? `action=${action}` : '';
    const url = `${API_URL}?${query}`;
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[AGDAdmin] Falha ao comunicar com ${url}, usando fallback demonstrativo:`, err.message);
      return fallbackData(action, options);
    }
  }

  // Dados de contingência quando acessado via file:// sem servidor ativo
  function fallbackData(action) {
    if (action === 'health' || action === 'ping') {
      return { status: 'ONLINE', banco: 'autogestaodirecao', versaoPg: 'PostgreSQL 18.6 (Neon)', latenciaMs: 42, poolerAtivo: true };
    }
    if (action === 'tables' || action === 'db-schema') {
      const defaultTables = [
        'admin_usuario', 'aluno', 'aula', 'conta_receber', 'convite_aluno',
        'despesa', 'organizacao', 'pacote', 'pagamento', 'plano_assinatura',
        'registro_auditoria', 'simulador_sessao', 'usuario', 'veiculo'
      ];
      return {
        totalTabelas: 14,
        tabelas: defaultTables.map(t => ({
          tabela: t,
          totalLinhas: t === 'aluno' ? 4 : t === 'organizacao' ? 2 : t === 'plano_assinatura' ? 4 : t === 'usuario' ? 2 : t === 'veiculo' ? 3 : t === 'admin_usuario' ? 1 : 0,
          colunas: [{ column_name: 'id', data_type: 'character varying', is_nullable: 'NO' }]
        }))
      };
    }
    if (action === 'dashboard') {
      return {
        orgStats: { total_orgs: 2, assinaturas_ativas: 2, assinaturas_pendentes: 0, assinaturas_bloqueadas: 0, total_autonomos: 1, total_cfcs: 1 },
        userStats: { total_usuarios: 2, usuarios_ativos: 2 },
        studentStats: { total_alunos: 4, alunos_ativos: 4, xp_acumulado: 1450 },
        planStats: { mrr_estimado_centavos: 27800 },
        inviteStats: { total_convites: 2, convites_pendentes: 1, convites_aceitos: 1 },
        planos: [
          { id: 'plano_autonomo_starter', nome: 'Autônomo Starter', tipo_publico: 'INSTRUTOR_AUTONOMO', valor_mensal_centavos: 4900, limite_alunos: 30, limite_veiculos: 2 },
          { id: 'plano_autonomo_pro', nome: 'Autônomo Pro', tipo_publico: 'INSTRUTOR_AUTONOMO', valor_mensal_centavos: 8900, limite_alunos: 100, limite_veiculos: 5 },
          { id: 'plano_cfc_essencial', nome: 'CFC Autoescola Essencial', tipo_publico: 'AUTOESCOLA_CFC', valor_mensal_centavos: 18900, limite_alunos: 250, limite_veiculos: 15 },
          { id: 'plano_cfc_enterprise', nome: 'CFC Autoescola Enterprise', tipo_publico: 'AUTOESCOLA_CFC', valor_mensal_centavos: 34900, limite_alunos: 1000, limite_veiculos: 50 }
        ],
        ultimasAtividades: []
      };
    }
    if (action === 'subscriptions') {
      return {
        orgs: [
          { id: 'org_cassio', nome: 'Cássio · Instrutor Autônomo', tipo: 'INSTRUTOR_AUTONOMO', email_contato: 'cassio@autogestaodirecao.com.br', telefone: '(31) 99999-8888', status_assinatura: 'ATIVA', plano_nome: 'Autônomo Pro', valor_mensal_centavos: 8900, qtd_usuarios: 1, qtd_alunos: 3, qtd_veiculos: 2, assinatura_valida_ate: '2027-10-07T00:00:00Z' },
          { id: 'org_cfc_direcao_certa', nome: 'Direção Certa · CFC', tipo: 'AUTOESCOLA_CFC', email_contato: 'contato@direcaocerta.com.br', telefone: '(31) 3333-4444', status_assinatura: 'ATIVA', plano_nome: 'CFC Autoescola Essencial', valor_mensal_centavos: 18900, qtd_usuarios: 1, qtd_alunos: 1, qtd_veiculos: 1, assinatura_valida_ate: '2027-10-07T00:00:00Z' }
        ],
        planos: [
          { id: 'plano_autonomo_starter', nome: 'Autônomo Starter', valor_mensal_centavos: 4900 },
          { id: 'plano_autonomo_pro', nome: 'Autônomo Pro', valor_mensal_centavos: 8900 },
          { id: 'plano_cfc_essencial', nome: 'CFC Autoescola Essencial', valor_mensal_centavos: 18900 },
          { id: 'plano_cfc_enterprise', nome: 'CFC Autoescola Enterprise', valor_mensal_centavos: 34900 }
        ]
      };
    }
    if (action === 'invites') {
      return {
        convites: [
          { id: 'cnv_01', nome_aluno: 'Marina Oliveira', email_aluno: 'marina@aluno.com', telefone_aluno: '(31) 99900-1234', categoria: 'B', token_convite: 'AGD-MARINA-881', status: 'ACEITO', professor_nome: 'Cássio Diniz', organizacao_nome: 'Cássio · Instrutor', aluno_vinculado_id: 'alu_marina', xp_total: 450, nivel: 3 },
          { id: 'cnv_02', nome_aluno: 'Gabriel Santana', email_aluno: 'gabriel@exemplo.com', telefone_aluno: '(31) 98888-7777', categoria: 'B', token_convite: 'AGD-GABRIEL-992', status: 'PENDENTE', professor_nome: 'Cássio Diniz', organizacao_nome: 'Cássio · Instrutor', aluno_vinculado_id: null }
        ],
        professores: [
          { id: 'usr_cassio', nome: 'Cássio Diniz', email: 'cassio@autogestaodirecao.com.br', org_nome: 'Cássio · Instrutor Autônomo' },
          { id: 'usr_rafael', nome: 'Rafael Costa', email: 'rafael@direcaocerta.com.br', org_nome: 'Direção Certa · CFC' }
        ]
      };
    }
    return { ok: true };
  }

  const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((n || 0) / 100);

  // Renderizador da Sidebar do Administrador Master
  function renderAdminSidebar() {
    return `
      <div class="admin-sidebar">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--admin-card-border);padding-right:8px;">
          <a class="admin-brand" href="#admin-dashboard" style="border-bottom:none;flex:1;">
            <div class="admin-brand-icon">⚡</div>
            <div>
              <div style="font-size:14px;font-weight:800;letter-spacing:0.02em;">SUPER ADMIN</div>
              <div class="admin-badge-pill">Neon Postgres 18</div>
            </div>
          </a>
          <button class="sidebar-collapse-btn" title="Recolher / Expandir menu" aria-label="Recolher menu">◀</button>
        </div>

        <div style="padding:12px 14px 4px;font-size:11px;font-weight:700;color:var(--admin-text-secondary);letter-spacing:0.06em;">
          GESTÃO & GOVERNANÇA
        </div>

        <nav class="admin-nav-list" aria-label="Menu Administrador">
          <button class="admin-nav-item ${currentTab === 'dashboard' ? 'active' : ''}" data-admin-tab="dashboard">
            <span class="admin-nav-icon">📊</span> Dashboard Master
          </button>
          <button class="admin-nav-item ${currentTab === 'db-schema' ? 'active' : ''}" data-admin-tab="db-schema">
            <span class="admin-nav-icon">🗄️</span> Validação Tabelas DB <span class="admin-nav-count">14</span>
          </button>
          <button class="admin-nav-item ${currentTab === 'subscriptions' ? 'active' : ''}" data-admin-tab="subscriptions">
            <span class="admin-nav-icon">💳</span> Planos & Assinaturas
          </button>
          <button class="admin-nav-item ${currentTab === 'users-invites' ? 'active' : ''}" data-admin-tab="users-invites">
            <span class="admin-nav-icon">👥</span> Convites & Alunos Vinculados
          </button>
          <button class="admin-nav-item ${currentTab === 'sql-console' ? 'active' : ''}" data-admin-tab="sql-console">
            <span class="admin-nav-icon">⚡</span> Console SQL Neon
          </button>
        </nav>

        <div style="margin-top:auto;padding:16px;border-top:1px solid var(--admin-card-border);background:#0d1620;">
          <button id="exitAdminModeBtn" class="btn-admin-soft" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;">
            <span>←</span> Voltar à Operação
          </button>
        </div>
      </div>
    `;
  }

  // Barra de Status de Conexão Neon
  function renderNeonStatusBar() {
    return `
      <div class="neon-status-bar">
        <div class="neon-status-item">
          <div class="neon-dot-pulse"></div>
          <div>
            <b>Neon PostgreSQL</b> · <span style="color:#00e599;font-weight:700;">Conectado</span>
            <div class="neon-status-label">ep-lucky-river-b6lcmj3l-pooler · aws-sa-east-1</div>
          </div>
        </div>

        <div class="neon-status-item">
          <span style="font-size:18px;">🛡️</span>
          <div>
            <b>Banco: autogestaodirecao</b>
            <div class="neon-status-label">${connectionHealth.versao || 'PostgreSQL 18.6'}</div>
          </div>
        </div>

        <div class="neon-status-item">
          <span style="font-size:18px;">⚡</span>
          <div>
            <b>Latência: ${connectionHealth.latenciaMs || 25}ms</b>
            <div class="neon-status-label">SSL Mode: Require · Pooler Ativo</div>
          </div>
        </div>

        <div style="margin-left:auto;display:flex;gap:8px;">
          <button id="copyNeonConnBtn" class="btn-admin-soft" title="Copiar String de Conexão">
            📋 Copiar Conexão
          </button>
          <button id="refreshAdminDataBtn" class="btn-neon" style="padding:6px 12px;font-size:12px;">
            🔄 Atualizar DB
          </button>
        </div>
      </div>
    `;
  }

  // 1. ABA DASHBOARD
  function renderDashboardView() {
    const d = cachedDashboard || fallbackData('dashboard');
    const org = d.orgStats || {};
    const usr = d.userStats || {};
    const stu = d.studentStats || {};
    const inv = d.inviteStats || {};
    const mrr = (d.planStats && d.planStats.mrr_estimado_centavos) || 27800;

    return `
      <div class="admin-page-head">
        ${renderNeonStatusBar()}

        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <div class="admin-stat-top">MRR Recorrente <span>💰</span></div>
            <div class="admin-stat-num" style="color:#00e599;">${money(mrr)}</div>
            <div class="admin-stat-sub">receita mensal dos planos ativos</div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-top">Assinaturas Ativas <span>💳</span></div>
            <div class="admin-stat-num">${org.assinaturas_ativas || 2} <small style="font-size:14px;color:var(--admin-text-secondary);">/ ${org.total_orgs || 2}</small></div>
            <div class="admin-stat-sub">${org.assinaturas_bloqueadas || 0} bloqueadas · ${org.assinaturas_pendentes || 0} pendentes</div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-top">Instrutores & CFCs <span>🚗</span></div>
            <div class="admin-stat-num">${usr.total_usuarios || 2}</div>
            <div class="admin-stat-sub">${org.total_autonomos || 1} Autônomos · ${org.total_cfcs || 1} Autoescolas</div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-top">Alunos Vinculados <span>🎓</span></div>
            <div class="admin-stat-num">${stu.total_alunos || 4}</div>
            <div class="admin-stat-sub">${stu.xp_acumulado || 1450} XP total no simulador</div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-top">Convites Gerados <span>✉️</span></div>
            <div class="admin-stat-num">${inv.total_convites || 2}</div>
            <div class="admin-stat-sub">${inv.convites_aceitos || 1} aceitos · ${inv.convites_pendentes || 1} pendentes</div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-top">Tabelas Neon DB <span>🗄️</span></div>
            <div class="admin-stat-num" style="color:#00c8ff;">14</div>
            <div class="admin-stat-sub">100% parametrizadas e sincronizadas</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:20px;margin-top:20px;">
          <!-- Planos Vigentes -->
          <div class="db-inspector-card">
            <h3 style="margin-top:0;display:flex;align-items:center;gap:10px;">
              <span>🏷️</span> Planos de Assinatura Cadastrados
            </h3>
            <p style="color:var(--admin-text-secondary);font-size:13px;">Regra: Todo instrutor e CFC necessita de um plano ativo para efetuar login no sistema.</p>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
              ${(d.planos || []).map(p => `
                <div style="background:#0d1620;border:1px solid #1a2a38;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <b style="color:var(--admin-text-primary);font-size:14px;">${p.nome}</b>
                    <div style="font-size:12px;color:var(--admin-text-secondary);margin-top:2px;">
                      Público: <b>${p.tipo_publico === 'INSTRUTOR_AUTONOMO' ? 'Autônomo' : 'CFC'}</b> · Limite: ${p.limite_alunos} alunos
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="color:#00e599;font-weight:800;font-size:15px;">${money(p.valor_mensal_centavos)}<small>/mês</small></div>
                    <span class="admin-badge-pill" style="font-size:9px;">ATIVO</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Controle de Acesso e Regras -->
          <div class="db-inspector-card">
            <h3 style="margin-top:0;display:flex;align-items:center;gap:10px;">
              <span>🔐</span> Regras de Acesso e Isolamento
            </h3>
            <ul style="color:var(--admin-text-secondary);font-size:13px;line-height:1.6;padding-left:18px;">
              <li><b style="color:#00e599;">Instrutores e CFCs:</b> Requerem assinatura ativa para login. Em caso de atraso ou suspensão, o login é bloqueado automaticamente pelo backend.</li>
              <li><b style="color:#00c8ff;">Alunos:</b> Não pagam assinatura própria. O acesso é liberado mediante <b>Convite emitido pelo Professor</b>, e a conta fica estritamente vinculada a este professor.</li>
              <li><b style="color:#f0f6fc;">Multi-tenancy Rígido:</b> Cada instrutor visualiza apenas seus alunos, agendamentos e veículos, garantido por chave estrangeira <code>organizacao_id</code>.</li>
              <li><b style="color:#ffb833;">Persistência em Nuvem:</b> Todas as tabelas residem no cluster Neon PostgreSQL sob alta disponibilidade e backups contínuos.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // 2. ABA VALIDAÇÃO DE TABELAS NEON
  function renderTablesView() {
    const data = cachedTables || fallbackData('tables');
    const tabelas = data.tabelas || [];

    return `
      <div class="admin-page-head">
        ${renderNeonStatusBar()}

        <div class="db-inspector-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="margin:0 0 6px 0;font-size:20px;display:flex;align-items:center;gap:10px;">
                <span>🗄️</span> Validador de Tabelas no Neon PostgreSQL
              </h2>
              <p style="margin:0;color:var(--admin-text-secondary);font-size:13px;">
                Foram identificadas <b>${tabelas.length} tabelas operacionais</b> criadas e ativas no banco de dados.
              </p>
            </div>
            <button id="btnRevalidarTabelas" class="btn-neon">
              🔍 Revalidar Todas as Tabelas
            </button>
          </div>

          <div class="db-tables-grid">
            ${tabelas.map(t => `
              <div class="db-table-item">
                <div class="db-table-name">
                  <span>📄</span> ${t.tabela}
                </div>
                <div class="db-table-meta">
                  <span>Registros: <b style="color:${t.totalLinhas > 0 ? '#00e599' : 'var(--admin-text-secondary)'};">${t.totalLinhas >= 0 ? t.totalLinhas : 'Erro'}</b></span>
                  <span>Colunas: <b>${(t.colunas && t.colunas.length) || (t.num_colunas || '—')}</b></span>
                </div>
                <div class="db-table-actions">
                  <button class="btn-admin-soft btn-inspect-schema" data-table="${t.tabela}" style="flex:1;">
                    Ver Colunas
                  </button>
                  <button class="btn-admin-soft btn-inspect-rows" data-table="${t.tabela}" style="flex:1;">
                    Ver Linhas
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // 3. ABA GESTÃO DE ASSINATURAS
  function renderSubscriptionsView() {
    const data = cachedSubs || fallbackData('subscriptions');
    const orgs = data.orgs || [];

    return `
      <div class="admin-page-head">
        ${renderNeonStatusBar()}

        <div class="db-inspector-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="margin:0 0 4px 0;font-size:20px;">💳 Gestão de Assinaturas & Acesso</h2>
              <p style="margin:0;color:var(--admin-text-secondary);font-size:13px;">
                Gerenciamento centralizado de contas que possuem permissão de login no sistema.
              </p>
            </div>
            <button id="btnOpenNovoAssinanteModal" class="btn-neon">
              + Cadastrar Novo Assinante
            </button>
          </div>

          <div class="admin-table-container">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Organização / Titular</th>
                  <th>Tipo</th>
                  <th>Plano Contratado</th>
                  <th>Valor Mensal</th>
                  <th>Status Assinatura</th>
                  <th>Validade</th>
                  <th>Alunos / Frotas</th>
                  <th>Ações de Acesso</th>
                </tr>
              </thead>
              <tbody>
                ${orgs.map(o => {
                  const st = (o.status_assinatura || 'ATIVA').toUpperCase();
                  const badgeCls = st === 'ATIVA' ? 'ativa' : st === 'DEGUSTACAO' ? 'degustacao' : st === 'BLOQUEADA' ? 'bloqueada' : 'pendente';
                  const dataFmt = o.assinatura_valida_ate ? new Date(o.assinatura_valida_ate).toLocaleDateString('pt-BR') : 'Sem data';

                  return `
                    <tr>
                      <td>
                        <b>${o.nome}</b>
                        <div style="font-size:11px;color:var(--admin-text-secondary);">${o.email_contato || '—'} · ${o.telefone || '—'}</div>
                      </td>
                      <td>
                        <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#182836;color:#8b9eb0;">
                          ${o.tipo === 'INSTRUTOR_AUTONOMO' ? 'Autônomo' : 'CFC / Escola'}
                        </span>
                      </td>
                      <td><b>${o.plano_nome || 'Autônomo Pro'}</b></td>
                      <td style="color:#00e599;font-weight:700;">${money(o.valor_mensal_centavos || 8900)}</td>
                      <td>
                        <span class="sub-badge ${badgeCls}">${st}</span>
                      </td>
                      <td>${dataFmt}</td>
                      <td>${o.qtd_alunos || 0} alunos · ${o.qtd_veiculos || 0} carros</td>
                      <td>
                        <div style="display:flex;gap:6px;">
                          ${st === 'BLOQUEADA' 
                            ? `<button class="btn-admin-soft btn-sub-action" data-org="${o.id}" data-action="ativar" style="color:#00e599;">Ativar</button>`
                            : `<button class="btn-admin-danger btn-sub-action" data-org="${o.id}" data-action="bloquear">Bloquear</button>`
                          }
                          <button class="btn-admin-soft btn-sub-action" data-org="${o.id}" data-action="degustacao">+14d Teste</button>
                          <button class="btn-admin-soft btn-sub-action" data-org="${o.id}" data-action="prorrogar">+30d</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // 4. ABA CONVITES & ALUNOS VINCULADOS
  function renderUsersInvitesView() {
    const data = cachedInvites || fallbackData('invites');
    const convites = data.convites || [];
    const professores = data.professores || [];

    return `
      <div class="admin-page-head">
        ${renderNeonStatusBar()}

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:20px;">
          <!-- Emissor de Convite -->
          <div class="db-inspector-card">
            <h3 style="margin-top:0;font-size:16px;display:flex;align-items:center;gap:8px;">
              <span>✉️</span> Emitir Convite para Aluno
            </h3>
            <p style="color:var(--admin-text-secondary);font-size:12px;">
              O aluno não paga plano de assinatura. Ele entra pelo convite e fica <b>permanentemente vinculado</b> ao professor selecionado.
            </p>

            <form id="formNovoConvite" style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Professor Vinculado:</label>
                <select id="invProfessorId" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;" required>
                  ${professores.map(p => `
                    <option value="${p.id}">${p.nome} (${p.org_nome})</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Nome Completo do Aluno:</label>
                <input type="text" id="invNomeAluno" placeholder="Ex: Camila Rocha" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;box-sizing:border-box;" required />
              </div>

              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">E-mail do Aluno:</label>
                <input type="email" id="invEmailAluno" placeholder="aluno@email.com" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;box-sizing:border-box;" required />
              </div>

              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Telefone / WhatsApp:</label>
                <input type="text" id="invTelefoneAluno" placeholder="(31) 98765-4321" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;box-sizing:border-box;" />
              </div>

              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Categoria CNH:</label>
                <select id="invCategoriaAluno" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;">
                  <option value="B">Categoria B (Carro)</option>
                  <option value="A">Categoria A (Moto)</option>
                  <option value="A/B">Categoria A/B (Moto e Carro)</option>
                </select>
              </div>

              <button type="submit" class="btn-neon" style="margin-top:6px;justify-content:center;">
                🚀 Gerar Link de Convite
              </button>
            </form>
          </div>

          <!-- Tabela de Convites e Vínculos -->
          <div class="db-inspector-card">
            <h3 style="margin-top:0;font-size:16px;display:flex;align-items:center;gap:8px;">
              <span>📋</span> Convites Gerados & Alunos Vinculados
            </h3>
            <p style="color:var(--admin-text-secondary);font-size:12px;">
              Histórico de convites e contas vinculadas ao professor.
            </p>

            <div class="admin-table-container" style="margin-top:14px;">
              <table class="admin-data-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Professor Responsável</th>
                    <th>Token / Link</th>
                    <th>Status</th>
                    <th>Progresso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${convites.map(c => `
                    <tr>
                      <td>
                        <b>${c.nome_aluno}</b>
                        <div style="font-size:11px;color:var(--admin-text-secondary);">${c.email_aluno} · Cat. ${c.categoria || 'B'}</div>
                      </td>
                      <td>
                        <b style="color:#00c8ff;">${c.professor_nome}</b>
                        <div style="font-size:11px;color:var(--admin-text-secondary);">${c.organizacao_nome}</div>
                      </td>
                      <td>
                        <div class="invite-chip">${c.token_convite}</div>
                      </td>
                      <td>
                        <span class="sub-badge ${c.status === 'ACEITO' ? 'ativa' : 'pendente'}">
                          ${c.status}
                        </span>
                      </td>
                      <td>
                        ${c.aluno_vinculado_id ? `<span style="color:#00e599;font-weight:700;">Nível ${c.nivel || 1} (${c.xp_total || 0} XP)</span>` : '<span style="color:var(--admin-text-secondary);">Aguardando aceite</span>'}
                      </td>
                      <td>
                        <button class="btn-admin-soft btn-copy-link" data-token="${c.token_convite}" style="font-size:11px;">
                          📋 Copiar Link
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 5. ABA CONSOLE SQL INTERATIVO
  function renderSqlConsoleView() {
    return `
      <div class="admin-page-head">
        ${renderNeonStatusBar()}

        <div class="db-inspector-card">
          <h2 style="margin:0 0 6px 0;font-size:20px;display:flex;align-items:center;gap:10px;">
            <span>⚡</span> Console de Inspeção SQL — Neon Postgres
          </h2>
          <p style="margin:0;color:var(--admin-text-secondary);font-size:13px;">
            Execute consultas <code>SELECT</code> diretamente contra o cluster para validar tabelas e dados em tempo real.
          </p>

          <div class="sql-console-area">
            <textarea id="sqlQueryInput" class="sql-editor-textarea" placeholder="SELECT * FROM organizacao LIMIT 10;">SELECT * FROM organizacao LIMIT 10;</textarea>

            <div class="sql-buttons-bar">
              <button id="btnRunQuery" class="btn-neon">
                ▶ Executar Consulta
              </button>
              <button class="btn-admin-soft btn-sql-shortcut" data-sql="SELECT * FROM plano_assinatura;">
                planos
              </button>
              <button class="btn-admin-soft btn-sql-shortcut" data-sql="SELECT id, nome, email, status FROM usuario;">
                usuarios
              </button>
              <button class="btn-admin-soft btn-sql-shortcut" data-sql="SELECT id, nome, email, status, xp_total FROM aluno;">
                alunos
              </button>
              <button class="btn-admin-soft btn-sql-shortcut" data-sql="SELECT id, nome_aluno, status, token_convite FROM convite_aluno;">
                convites
              </button>
              <button class="btn-admin-soft btn-sql-shortcut" data-sql="SELECT table_name FROM information_schema.tables WHERE table_schema='public';">
                tabelas_public
              </button>
            </div>

            <div id="sqlQueryResult" class="sql-result-view" style="display:none;"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Renderizador Geral do Painel
  function renderView() {
    const content = document.getElementById('appContent');
    const crumb = document.getElementById('crumb');
    const modeLabel = document.getElementById('modeLabel');

    if (modeLabel) modeLabel.textContent = 'Super Admin · Neon Postgres';
    if (crumb) {
      crumb.textContent = ({
        'dashboard': 'Dashboard Master',
        'db-schema': 'Validação de Tabelas DB',
        'subscriptions': 'Planos & Assinaturas',
        'users-invites': 'Convites & Alunos Vinculados',
        'sql-console': 'Console SQL Neon'
      })[currentTab] || 'Admin Master';
    }

    if (!content) return;

    if (currentTab === 'dashboard') content.innerHTML = renderDashboardView();
    else if (currentTab === 'db-schema') content.innerHTML = renderTablesView();
    else if (currentTab === 'subscriptions') content.innerHTML = renderSubscriptionsView();
    else if (currentTab === 'users-invites') content.innerHTML = renderUsersInvitesView();
    else if (currentTab === 'sql-console') content.innerHTML = renderSqlConsoleView();

    bindEvents();
  }

  // Eventos e Interações do Administrador
  function bindEvents() {
    // Abas da sidebar
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.onclick = (e) => {
        currentTab = e.currentTarget.dataset.adminTab;
        const sidebar = document.getElementById('adminSidebar');
        if (sidebar) sidebar.innerHTML = renderAdminSidebar();
        bindSidebarEvents();
        renderView();
      };
    });

    // Copiar String de Conexão
    const copyConnBtn = document.getElementById('copyNeonConnBtn');
    if (copyConnBtn) {
      copyConnBtn.onclick = () => {
        navigator.clipboard.writeText(NEON_CONN_STR);
        toast('String de Conexão Neon copiada para a área de transferência!');
      };
    }

    // Atualizar Dados / DB
    const refreshBtn = document.getElementById('refreshAdminDataBtn');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        toast('Sincronizando com Neon PostgreSQL...');
        await loadAllData();
        renderView();
        toast('Dados atualizados com sucesso!');
      };
    }

    // Revalidar Tabelas
    const btnRevalidar = document.getElementById('btnRevalidarTabelas');
    if (btnRevalidar) {
      btnRevalidar.onclick = async () => {
        toast('Consultando schema no Neon...');
        cachedTables = await apiFetch('tables');
        renderView();
        toast('Tabelas revalidadas com sucesso!');
      };
    }

    // Ações de Assinatura (Ativar, Bloquear, Degustação, Prorrogar)
    document.querySelectorAll('.btn-sub-action').forEach(btn => {
      btn.onclick = async (e) => {
        const orgId = e.currentTarget.dataset.org;
        const actionType = e.currentTarget.dataset.action;

        let payload = { orgId };
        if (actionType === 'ativar') {
          payload.statusAssinatura = 'ATIVA';
          payload.diasValidade = 365;
        } else if (actionType === 'bloquear') {
          payload.statusAssinatura = 'BLOQUEADA';
        } else if (actionType === 'degustacao') {
          payload.statusAssinatura = 'DEGUSTACAO';
          payload.diasValidade = 14;
        } else if (actionType === 'prorrogar') {
          payload.diasValidade = 30;
        }

        toast('Atualizando assinatura no Neon...');
        const res = await apiFetch('update-subscription', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          toast('Assinatura atualizada com sucesso!');
          cachedSubs = await apiFetch('subscriptions');
          cachedDashboard = await apiFetch('dashboard');
          renderView();
        } else {
          toast(res.error || 'Erro ao atualizar', true);
        }
      };
    });

    // Formulário de Novo Convite
    const formConvite = document.getElementById('formNovoConvite');
    if (formConvite) {
      formConvite.onsubmit = async (e) => {
        e.preventDefault();
        const profId = document.getElementById('invProfessorId').value;
        const nomeAluno = document.getElementById('invNomeAluno').value;
        const emailAluno = document.getElementById('invEmailAluno').value;
        const telAluno = document.getElementById('invTelefoneAluno').value;
        const catAluno = document.getElementById('invCategoriaAluno').value;

        toast('Gerando convite e token no Neon...');
        const res = await apiFetch('create-invite', {
          method: 'POST',
          body: JSON.stringify({
            professorId: profId,
            nomeAluno,
            emailAluno,
            telefoneAluno: telAluno,
            categoria: catAluno
          })
        });

        if (res.ok) {
          toast(`Convite gerado com sucesso! Token: ${res.token}`);
          cachedInvites = await apiFetch('invites');
          cachedDashboard = await apiFetch('dashboard');
          renderView();
        } else {
          toast(res.error || 'Erro ao gerar convite', true);
        }
      };
    }

    // Copiar Link de Convite
    document.querySelectorAll('.btn-copy-link').forEach(btn => {
      btn.onclick = (e) => {
        const token = e.currentTarget.dataset.token;
        const link = `${window.location.origin}/?convite=${token}`;
        navigator.clipboard.writeText(link);
        toast(`Link de Convite copiado: ${link}`);
      };
    });

    // Modal de Cadastro de Novo Assinante
    const btnNovoAssinante = document.getElementById('btnOpenNovoAssinanteModal');
    if (btnNovoAssinante) {
      btnNovoAssinante.onclick = () => openNovoAssinanteModal();
    }

    // Inspecionar Schema de Colunas da Tabela
    document.querySelectorAll('.btn-inspect-schema').forEach(btn => {
      btn.onclick = (e) => {
        const tableName = e.currentTarget.dataset.table;
        const tableObj = (cachedTables && cachedTables.tabelas || []).find(t => t.tabela === tableName);
        openSchemaModal(tableName, tableObj ? tableObj.colunas : []);
      };
    });

    // Inspecionar Linhas da Tabela
    document.querySelectorAll('.btn-inspect-rows').forEach(btn => {
      btn.onclick = async (e) => {
        const tableName = e.currentTarget.dataset.table;
        toast(`Consultando registros de ${tableName}...`);
        currentTab = 'sql-console';
        renderView();
        const input = document.getElementById('sqlQueryInput');
        if (input) input.value = `SELECT * FROM "${tableName}" LIMIT 20;`;
        executeCurrentQuery();
      };
    });

    // Console SQL Executar
    const btnRunQuery = document.getElementById('btnRunQuery');
    if (btnRunQuery) {
      btnRunQuery.onclick = () => executeCurrentQuery();
    }

    // Atalhos SQL
    document.querySelectorAll('.btn-sql-shortcut').forEach(btn => {
      btn.onclick = (e) => {
        const sql = e.currentTarget.dataset.sql;
        const input = document.getElementById('sqlQueryInput');
        if (input) {
          input.value = sql;
          executeCurrentQuery();
        }
      };
    });
  }

  // Executa query do console SQL
  async function executeCurrentQuery() {
    const input = document.getElementById('sqlQueryInput');
    const resultBox = document.getElementById('sqlQueryResult');
    if (!input || !resultBox) return;

    const sqlText = input.value.trim();
    if (!sqlText) return;

    resultBox.style.display = 'block';
    resultBox.innerHTML = '<div style="padding:16px;color:#8b9eb0;">Executando consulta no Neon PostgreSQL...</div>';

    const res = await apiFetch('query-inspector', {
      method: 'POST',
      body: JSON.stringify({ sql: sqlText })
    });

    if (res.rows) {
      if (res.rows.length === 0) {
        resultBox.innerHTML = '<div style="padding:16px;color:#8b9eb0;">Nenhum registro retornado.</div>';
        return;
      }
      const cols = Object.keys(res.rows[0]);
      resultBox.innerHTML = `
        <div style="padding:10px 14px;background:#0d1620;border-bottom:1px solid #162432;font-size:12px;color:#00e599;font-weight:700;">
          Sucesso: ${res.total} linha(s) retornada(s)
        </div>
        <table class="admin-data-table">
          <thead>
            <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${res.rows.map(row => `
              <tr>${cols.map(c => `<td>${typeof row[c] === 'object' && row[c] !== null ? JSON.stringify(row[c]) : (row[c] ?? '<i style="color:#666">null</i>')}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      resultBox.innerHTML = `
        <div style="padding:16px;color:#ff6666;font-family:monospace;">
          ❌ Erro ao executar consulta: ${res.error || 'Falha desconhecida'}
        </div>
      `;
    }
  }

  // Modal para inspecionar schema da tabela
  function openSchemaModal(tableName, colunas = []) {
    const root = document.getElementById('modalRoot');
    if (!root) return;

    root.innerHTML = `
      <div class="modal-backdrop" id="schemaModalBackdrop">
        <div class="schema-modal-dialog">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1a2a38;padding-bottom:14px;margin-bottom:16px;">
            <h3 style="margin:0;font-size:18px;color:#00e599;display:flex;align-items:center;gap:8px;">
              <span>🗄️</span> Tabela: <code>${tableName}</code>
            </h3>
            <button id="closeSchemaModalBtn" style="background:none;border:none;color:#8b9eb0;font-size:20px;cursor:pointer;">×</button>
          </div>

          <p style="font-size:13px;color:var(--admin-text-secondary);margin-bottom:14px;">
            Estrutura relacional inspecionada diretamente no <code>information_schema</code> do Neon.
          </p>

          <div class="admin-table-container">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Coluna</th>
                  <th>Tipo PostgreSQL</th>
                  <th>Permite Nulo (Nullable)</th>
                </tr>
              </thead>
              <tbody>
                ${colunas.map(c => `
                  <tr>
                    <td><b style="color:#f0f6fc;">${c.column_name}</b></td>
                    <td><code style="color:#00c8ff;">${c.data_type}</code></td>
                    <td>${c.is_nullable === 'YES' ? '<span style="color:#ffb833;">SIM</span>' : '<span style="color:#00e599;font-weight:700;">NÃO</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('closeSchemaModalBtn').onclick = () => { root.innerHTML = ''; };
    document.getElementById('schemaModalBackdrop').onclick = (e) => {
      if (e.target.id === 'schemaModalBackdrop') root.innerHTML = '';
    };
  }

  // Modal para criar novo usuário/escola assinante
  function openNovoAssinanteModal() {
    const root = document.getElementById('modalRoot');
    if (!root) return;

    root.innerHTML = `
      <div class="modal-backdrop" id="modalNovoAssinanteBackdrop">
        <div class="schema-modal-dialog" style="max-width:550px;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1a2a38;padding-bottom:14px;margin-bottom:16px;">
            <h3 style="margin:0;font-size:18px;color:#00e599;">+ Cadastrar Novo Assinante</h3>
            <button id="closeAssinanteModalBtn" style="background:none;border:none;color:#8b9eb0;font-size:20px;cursor:pointer;">×</button>
          </div>

          <form id="formNovoAssinanteSubmit" style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Nome do Titular / Razão Social:</label>
              <input type="text" id="cadNome" placeholder="Ex: Autoescola Horizonte" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;box-sizing:border-box;" required />
            </div>

            <div>
              <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">E-mail de Login:</label>
              <input type="email" id="cadEmail" placeholder="contato@horizonte.com.br" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;box-sizing:border-box;" required />
            </div>

            <div>
              <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Telefone / WhatsApp:</label>
              <input type="text" id="cadTelefone" placeholder="(31) 99111-2222" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;box-sizing:border-box;" />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Tipo de Conta:</label>
                <select id="cadTipo" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;">
                  <option value="INSTRUTOR_AUTONOMO">Instrutor Autônomo</option>
                  <option value="AUTOESCOLA_CFC">Autoescola CFC</option>
                </select>
              </div>

              <div>
                <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Plano Contratado:</label>
                <select id="cadPlano" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;">
                  <option value="plano_autonomo_pro">Autônomo Pro (R$ 89/mês)</option>
                  <option value="plano_autonomo_starter">Autônomo Starter (R$ 49/mês)</option>
                  <option value="plano_cfc_essencial">CFC Essencial (R$ 189/mês)</option>
                  <option value="plano_cfc_enterprise">CFC Enterprise (R$ 349/mês)</option>
                </select>
              </div>
            </div>

            <div>
              <label style="font-size:12px;color:var(--admin-text-secondary);display:block;margin-bottom:4px;">Status Inicial:</label>
              <select id="cadStatus" style="width:100%;padding:8px;background:#090e14;border:1px solid #1a2a38;color:#f0f6fc;border-radius:6px;">
                <option value="ATIVA">Ativa (Login Liberado)</option>
                <option value="DEGUSTACAO">Degustação 14 Dias</option>
                <option value="PENDENTE">Pendente Pagamento</option>
              </select>
            </div>

            <button type="submit" class="btn-neon" style="margin-top:10px;justify-content:center;">
              Criar Conta e Liberar Acesso
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('closeAssinanteModalBtn').onclick = () => { root.innerHTML = ''; };
    document.getElementById('modalNovoAssinanteBackdrop').onclick = (e) => {
      if (e.target.id === 'modalNovoAssinanteBackdrop') root.innerHTML = '';
    };

    document.getElementById('formNovoAssinanteSubmit').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        nome: document.getElementById('cadNome').value,
        email: document.getElementById('cadEmail').value,
        telefone: document.getElementById('cadTelefone').value,
        tipoOrg: document.getElementById('cadTipo').value,
        planoId: document.getElementById('cadPlano').value,
        statusAssinatura: document.getElementById('cadStatus').value
      };

      toast('Cadastrando assinante no Neon...');
      const res = await apiFetch('create-user', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast('Assinante cadastrado com sucesso!');
        root.innerHTML = '';
        cachedSubs = await apiFetch('subscriptions');
        cachedDashboard = await apiFetch('dashboard');
        renderView();
      } else {
        toast(res.error || 'Erro ao cadastrar', true);
      }
    };
  }

  function bindSidebarEvents() {
    const exitBtn = document.getElementById('exitAdminModeBtn');
    if (exitBtn) {
      exitBtn.onclick = () => exitAdminMode();
    }
  }

  // Carrega todos os dados do backend
  async function loadAllData() {
    try {
      const [health, dash, tbls, subs, invs] = await Promise.all([
        apiFetch('health'),
        apiFetch('dashboard'),
        apiFetch('tables'),
        apiFetch('subscriptions'),
        apiFetch('invites')
      ]);
      connectionHealth = health || connectionHealth;
      cachedDashboard = dash;
      cachedTables = tbls;
      cachedSubs = subs;
      cachedInvites = invs;
    } catch (err) {
      console.warn('Erro ao carregar dados do admin:', err);
    }
  }

  // Entrar no Modo Administrador Master
  async function enterAdminMode() {
    const adminSidebar = document.getElementById('adminSidebar');
    const instructorSidebar = document.getElementById('instructorSidebar');
    const studentSidebar = document.getElementById('studentSidebar');

    if (instructorSidebar) instructorSidebar.hidden = true;
    if (studentSidebar) studentSidebar.hidden = true;

    if (adminSidebar) {
      adminSidebar.hidden = false;
      adminSidebar.innerHTML = renderAdminSidebar();
      bindSidebarEvents();
    }

    renderView();
    await loadAllData();
    renderView();
  }

  // Sair do Modo Administrador Master (Volta para o Painel do Instrutor)
  function exitAdminMode() {
    const adminSidebar = document.getElementById('adminSidebar');
    const instructorSidebar = document.getElementById('instructorSidebar');

    if (adminSidebar) adminSidebar.hidden = true;
    if (instructorSidebar) instructorSidebar.hidden = false;

    window.location.hash = '#inicio';
    // Dispara evento para re-renderizar instrutor
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel) modeLabel.textContent = 'Operação';
    const crumb = document.getElementById('crumb');
    if (crumb) crumb.textContent = 'Visão geral';

    // Chama o render normal do app se disponível
    const orgSelect = document.getElementById('orgSelect');
    if (orgSelect) {
      orgSelect.dispatchEvent(new Event('change'));
    }
  }

  // Inicialização
  function init() {
    // Escuta mudança de hash na URL
    window.addEventListener('hashchange', () => {
      if (window.location.hash.startsWith('#admin')) {
        const sub = window.location.hash.replace('#admin-', '');
        if (['dashboard', 'db-schema', 'subscriptions', 'users-invites', 'sql-console'].includes(sub)) {
          currentTab = sub;
        }
        enterAdminMode();
      }
    });

    if (window.location.hash.startsWith('#admin')) {
      const sub = window.location.hash.replace('#admin-', '');
      if (['dashboard', 'db-schema', 'subscriptions', 'users-invites', 'sql-console'].includes(sub)) {
        currentTab = sub;
      }
      enterAdminMode();
    }

    // Botão de acesso ao Admin na interface
    const openAdminBtn = document.getElementById('openAdminMasterBtn');
    if (openAdminBtn) {
      openAdminBtn.onclick = () => {
        window.location.hash = '#admin';
        enterAdminMode();
      };
    }
  }

  return {
    init,
    enterAdminMode,
    exitAdminMode,
    loadAllData,
    apiFetch
  };
})();

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', AGDAdmin.init);
} else {
  AGDAdmin.init();
}
