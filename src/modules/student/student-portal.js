/* Auto Gestão de Direção — Portal do Aluno
   Módulo integrado à plataforma · protótipo local
   Depende de: student-auth.js, Three.js (CDN) */

(() => {
  /* ══════════════════════════════════════════════
     1. RENDERIZAÇÃO DO PORTAL DO ALUNO
     ══════════════════════════════════════════════ */

  /* ── Sidebar do aluno (substitui a sidebar do instrutor) ── */
  function renderStudentSidebar(account) {
    const p = account.progress;
    const level = p.level || 1;
    const initials = account.name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const xpCur = p.xp - totalXPForLevel(level - 1);
    const xpNeeded = AGDStudent.xpForLevel(level);
    const pct = Math.min(100, Math.round(xpCur / xpNeeded * 100));
    const medals = p.medals || [];

    return `
      <div class="brand-bar">
        <a class="brand" href="#aluno-home" id="studentBrandLink">
          <span class="brand-mark">AG</span>
          <span><b>auto gestão</b><small>de direção</small></span>
        </a>
        <button class="sidebar-collapse-btn" title="Recolher / Expandir menu" aria-label="Recolher menu">◀</button>
      </div>

      <div class="student-profile-card">
        <div class="student-avatar-wrap">
          <div class="student-avatar">${initials}</div>
          <div class="student-level-badge">Nv ${level}</div>
        </div>
        <div class="student-info">
          <b>${esc(account.name)}</b>
          <small>Cat. ${esc(account.category)} · Aluno</small>
        </div>
      </div>

      <div class="student-xp-bar">
        <div class="xp-label"><span>XP</span><span>${p.xp} · Nível ${level}</span></div>
        <div class="xp-track"><div class="xp-fill" style="width:${pct}%"></div></div>
        <div class="xp-sub">${xpCur} / ${xpNeeded} para o próximo nível</div>
      </div>

      ${medals.length ? `<div class="student-medals">${medals.slice(0, 6).map(m => `<span class="medal" title="${esc(m)}">${medalEmoji(m)}</span>`).join('')}</div>` : ''}

      <nav class="nav-list student-nav" aria-label="Menu do aluno">
        <button class="nav-item active" data-student-view="aluno-home">
          <span>◫</span> Início
        </button>
        <button class="nav-item" data-student-view="progresso">
          <span>▦</span> Meu Progresso
        </button>
        <button class="nav-item" data-student-view="conquistas">
          <span>◎</span> Conquistas
        </button>
      </nav>

      <div class="sidebar-bottom">
        <div class="user-chip">
          <div class="avatar">${initials}</div>
          <span><b>${esc(account.name.split(' ')[0])}</b><small>Área do Aluno</small></span>
          <button class="dots" id="studentLogoutBtn" title="Sair" style="cursor:pointer;border:0;background:none;color:#9daf9f;font-size:13px" aria-label="Sair da conta">Sair</button>
        </div>
        <button id="studentBackToAppBtn" class="btn-student-logout" style="width:100%;margin-top:8px;padding:9px 12px;background:rgba(255,100,100,0.12);border:1px solid rgba(255,100,100,0.25);color:#ffaaaa;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;">
          <span>🚪</span> Sair da Área do Aluno
        </button>
        <div class="version">PORTAL DO ALUNO <span>v0.1</span></div>
      </div>
    `;
  }

  function totalXPForLevel(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) total += AGDStudent.xpForLevel(i);
    return total;
  }

  function medalEmoji(id) {
    const map = {
      'primeira-baliza': '🎯', 'baliza-perfeita': '🏆', 'sem-colisao': '🛡️',
      'precisao-90': '🎖️', 'velocidade': '⚡', 'controle': '🕹️',
      'iniciante': '🌱', 'avancado': '⭐', 'mestre': '👑'
    };
    return map[id] || '🏅';
  }

  /* ── Tela inicial do aluno ── */
  function renderStudentHome(account) {
    const p = account.progress;
    const sessions = p.sessions || [];
    const completed = p.completedScenarios || [];
    const skills = p.skills || {};

    const skillItems = [
      { key: 'baliza', label: 'Baliza' },
      { key: 'controle', label: 'Controle' },
      { key: 'percepcaoEspacial', label: 'Percepção Espacial' },
      { key: 'estacionamento', label: 'Estacionamento' },
      { key: 'precisao', label: 'Precisão' },
      { key: 'seguranca', label: 'Segurança' }
    ];

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">ÁREA DO ALUNO</div>
          <h1>Olá, ${esc(account.name.split(' ')[0])} 👋</h1>
          <p>Continue praticando e evoluindo suas habilidades de condução.</p>
        </div>
        <div class="head-actions">
        </div>
      </div>

      <div class="grid stats-grid" style="margin-bottom:20px">
        <div class="card stat-card">
          <div class="stat-top">XP Total <span class="stat-icon">⭐</span></div>
          <div class="stat-value">${p.xp}</div>
          <div class="stat-foot">Nível ${p.level || 1}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-top">Cenários concluídos <span class="stat-icon">◎</span></div>
          <div class="stat-value">${completed.length.toString().padStart(2, '0')}</div>
          <div class="stat-foot">de 5 disponíveis</div>
        </div>
        <div class="card stat-card">
          <div class="stat-top">Sessões no simulador <span class="stat-icon">▱</span></div>
          <div class="stat-value">${sessions.length.toString().padStart(2, '0')}</div>
          <div class="stat-foot">tentativas registradas</div>
        </div>
        <div class="card stat-card">
          <div class="stat-top">Medalhas <span class="stat-icon">🏅</span></div>
          <div class="stat-value">${(p.medals || []).length.toString().padStart(2, '0')}</div>
          <div class="stat-foot">conquistas desbloqueadas</div>
        </div>
      </div>

      <div class="grid overview-grid">
        <div class="card">
          <div class="card-head">
            <div><h2>Simulador de Direção</h2><p>Treine manobras em ambiente virtual seguro</p></div>
            <span class="badge">Produto separado</span>
          </div>
          <div class="student-scenario-list">
            ${renderScenarioCards(completed)}
          </div>
        </div>
        <div class="right-stack">
          <div class="card">
            <div class="card-head"><div><h2>Habilidades</h2><p>Evolução por categoria</p></div></div>
            <div class="skill-bars" style="padding:14px 18px 18px">
              ${skillItems.map(s => `
                <div class="skill-row">
                  <div class="skill-label-row"><span>${s.label}</span><span>${skills[s.key] || 0}%</span></div>
                  <div class="skill-track"><div class="skill-fill" style="width:${skills[s.key] || 0}%"></div></div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderScenarioCards(completed) {
    const scenarios = [
      { id: 'baliza-basica', title: 'Baliza Básica', desc: 'Manobra de estacionamento paralelo entre dois veículos', level: 1, icon: '🚗' },
      { id: 'direcao-vias', title: 'Direção em Vias & Distâncias', desc: 'Regra da roda dianteira, percepção de ponto cego, anticolisão e retrovisores em vias de 40 a 100 km/h', level: 1, icon: '🛣️' },
      { id: 'estac-frontal', title: 'Estacionamento Frontal', desc: 'Entrar em vaga frontal com precisão', level: 2, icon: '🅿️' },
      { id: 'estac-re', title: 'Estacionamento de Ré', desc: 'Estacionar em vaga de ré com visão de retrovisores', level: 2, icon: '↩️' },
      { id: 'corredor', title: 'Corredor de Cones', desc: 'Passar por um corredor estreito sem tocar', level: 3, icon: '🔶' },
      { id: 'garagem', title: 'Garagem Estreita', desc: 'Entrar em garagem com espaço reduzido', level: 4, icon: '🏠' }
    ];

    return scenarios.map(s => {
      const done = completed.includes(s.id);
      const active = s.id === 'baliza-basica' || s.id === 'direcao-vias';
      return `
        <div class="scenario-card ${done ? 'done' : ''} ${!active && !done ? 'locked' : ''}">
          <div class="scenario-icon">${s.icon}</div>
          <div class="scenario-info">
            <b>${esc(s.title)}</b>
            <small>${esc(s.desc)}</small>
            <div class="scenario-level">Nível ${s.level}</div>
          </div>
          <div class="scenario-status">
            ${done ? '<span class="badge done">Concluído</span>' :
              active ? '<span class="badge">Produto separado</span>' :
              '<span class="badge" style="background:#2a4036;color:#5a7a6a;font-size:9px">Em breve</span>'}
          </div>
        </div>`;
    }).join('');
  }

  /* ── Tela de Progresso ── */
  function renderProgress(account) {
    const p = account.progress;
    const skills = p.skills || {};
    const sessions = p.sessions || [];

    const skillList = [
      { key: 'controle', label: 'Controle do Veículo', desc: 'Aceleração, frenagem e trajetória' },
      { key: 'percepcaoEspacial', label: 'Percepção Espacial', desc: 'Noção de dimensão e posição' },
      { key: 'estacionamento', label: 'Estacionamento', desc: 'Vagas frontais, ré e diagonal' },
      { key: 'baliza', label: 'Baliza', desc: 'Estacionamento paralelo' },
      { key: 'distancia', label: 'Controle de Distância', desc: 'Afastamento lateral e frontal' },
      { key: 'estercamento', label: 'Esterçamento', desc: 'Uso correto do volante' },
      { key: 'correcao', label: 'Correção', desc: 'Ajuste durante manobras' },
      { key: 'retrovisores', label: 'Retrovisores', desc: 'Uso dos retrovisores' },
      { key: 'seguranca', label: 'Segurança', desc: 'Distâncias de segurança e colisões' },
      { key: 'precisao', label: 'Precisão', desc: 'Alinhamento e posição final' }
    ];

    const last5 = sessions.slice(-5).reverse();

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">EVOLUÇÃO</div>
          <h1>Meu Progresso</h1>
          <p>Acompanhe suas habilidades em detalhe.</p>
        </div>
      </div>

      <div class="grid two-col">
        <div class="card">
          <div class="card-head"><div><h2>Habilidades</h2><p>Score por categoria</p></div></div>
          <div style="padding:16px 18px 20px">
            ${skillList.map(s => `
              <div class="skill-row" style="margin-bottom:14px">
                <div class="skill-label-row">
                  <span style="font-size:11px;font-weight:600">${s.label}</span>
                  <span style="font-size:12px;font-weight:700;color:#176b4b">${skills[s.key] || 0}%</span>
                </div>
                <div class="skill-track"><div class="skill-fill" style="width:${skills[s.key] || 0}%"></div></div>
                <div style="font-size:9px;color:#86948c;margin-top:3px">${s.desc}</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="right-stack">
          <div class="card">
            <div class="card-head"><div><h2>Histórico de sessões</h2><p>Últimas 5 tentativas</p></div></div>
            <div class="mini-list">
              ${last5.length ? last5.map(s => `
                <div class="mini-row">
                  <span>${esc(s.scenarioLabel || 'Simulador')}
                    <small>${new Date(s.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                  </span>
                  <b class="amount">${s.score || 0} pts</b>
                </div>`).join('') : '<div class="empty">Nenhuma sessão ainda. Vá ao Simulador!</div>'}
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div><h2>Nível atual</h2><p>XP e progressão</p></div></div>
            <div style="padding:16px 18px">
              <div style="text-align:center;margin-bottom:16px">
                <div style="font:700 48px Manrope;color:#176b4b;letter-spacing:-2px">${p.level || 1}</div>
                <div style="font-size:11px;color:#78837c">Nível atual</div>
              </div>
              <div class="xp-track" style="margin-bottom:8px"><div class="xp-fill" style="width:${Math.min(100, Math.round(((p.xp - totalXPForLevel((p.level||1)-1)) / AGDStudent.xpForLevel(p.level||1)) * 100))}%"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:#78837c">
                <span>${p.xp - totalXPForLevel((p.level||1)-1)} XP</span>
                <span>${AGDStudent.xpForLevel(p.level||1)} XP para Nível ${(p.level||1)+1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Conquistas ── */
  function renderAchievements(account) {
    const earned = account.progress.medals || [];
    const all = [
      { id: 'iniciante', label: 'Iniciante', desc: 'Complete sua primeira sessão no simulador', emoji: '🌱' },
      { id: 'primeira-baliza', label: 'Primeira Baliza', desc: 'Complete o cenário de baliza básica', emoji: '🎯' },
      { id: 'baliza-perfeita', label: 'Baliza Perfeita', desc: 'Faça baliza com score acima de 900', emoji: '🏆' },
      { id: 'sem-colisao', label: 'Sem Colisão', desc: 'Complete um cenário sem nenhum toque', emoji: '🛡️' },
      { id: 'olho-clinico', label: 'Olho Clínico', desc: 'Manteve a regra da roda dianteira visível por mais de 30s', emoji: '👁️' },
      { id: 'piloto-vias', label: 'Piloto de Vias', desc: 'Concluiu com sucesso o ciclo das 4 vias (Urbana a Rodovia)', emoji: '🛣️' },
      { id: 'mestre-anticolisao', label: 'Mestre Anticolisão', desc: 'Manteve sinal verde em vias sem nenhum alerta crítico', emoji: '🟢' },
      { id: 'precisao-90', label: 'Precisão Elite', desc: 'Alcance 90% de precisão em um cenário', emoji: '🎖️' },
      { id: 'controle', label: 'Mestre do Volante', desc: 'Habilidade de controle acima de 80%', emoji: '🕹️' },
      { id: 'avancado', label: 'Avançado', desc: 'Alcance o nível 5', emoji: '⭐' },
      { id: 'mestre', label: 'Mestre', desc: 'Alcance o nível 10', emoji: '👑' }
    ];

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">GAMIFICAÇÃO</div>
          <h1>Conquistas</h1>
          <p>${earned.length} de ${all.length} medalhas desbloqueadas.</p>
        </div>
      </div>

      <div class="achievements-grid">
        ${all.map(a => {
          const done = earned.includes(a.id);
          return `
            <div class="achievement-card ${done ? 'earned' : 'locked'}">
              <div class="achievement-emoji ${done ? '' : 'locked-emoji'}">${a.emoji}</div>
              <div class="achievement-name">${esc(a.label)}</div>
              <div class="achievement-desc">${esc(a.desc)}</div>
              ${done ? '<div class="achievement-status">Conquistada ✓</div>' : '<div class="achievement-status locked-text">Bloqueada</div>'}
            </div>`;
        }).join('')}
      </div>
    `;
  }

  /* ══════════════════════════════════════════════
     2. TELA DE LOGIN / CADASTRO
     ══════════════════════════════════════════════ */
  function renderStudentLogin() {
    return `
      <div id="studentAuthWrap" class="student-auth-wrap">
        <div class="auth-card" id="loginCard">
          <div class="auth-logo">
            <div class="brand-mark" style="width:52px;height:52px;border-radius:16px;background:#d5efdf;color:#165839;display:grid;place-items:center;font-weight:800;font-size:18px;letter-spacing:-1px;margin:0 auto 18px">AG</div>
            <h2>Área do Aluno</h2>
            <p>Acesse sua conta para acompanhar sua evolução</p>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab active" id="tabLogin">Entrar</button>
            <button class="auth-tab" id="tabCadastro">Criar conta</button>
          </div>

          <!-- LOGIN -->
          <form id="loginForm" class="auth-form">
            <div class="field">
              <label>E‑mail</label>
              <input id="loginEmail" type="email" name="email" placeholder="seu@email.com" required autocomplete="email">
            </div>
            <div class="field">
              <label>Senha</label>
              <input id="loginPassword" type="password" name="password" placeholder="••••••" required autocomplete="current-password">
            </div>
            <div id="loginError" class="auth-error" hidden></div>
            <button type="submit" class="btn primary auth-submit">Entrar na conta</button>
            <p class="auth-hint">Conta demo: <b>aluno@demo.com</b> / senha <b>123456</b></p>
          </form>

          <!-- CADASTRO (oculto inicialmente) -->
          <form id="cadastroForm" class="auth-form" hidden>
            <div class="form-grid">
              <div class="field full">
                <label>Nome completo</label>
                <input id="cadName" type="text" name="name" placeholder="Seu nome" required>
              </div>
              <div class="field">
                <label>E‑mail</label>
                <input id="cadEmail" type="email" name="email" placeholder="seu@email.com" required autocomplete="email">
              </div>
              <div class="field">
                <label>Telefone (opcional)</label>
                <input id="cadPhone" type="tel" name="phone" placeholder="(31) 9 0000-0000">
              </div>
              <div class="field">
                <label>Categoria pretendida</label>
                <select name="category">
                  <option value="B">B — Carros</option>
                  <option value="A">A — Motos</option>
                  <option value="A/B">A/B</option>
                </select>
              </div>
              <div class="field">
                <label>Senha (mín. 6 caracteres)</label>
                <input id="cadPassword" type="password" name="password" placeholder="••••••" required autocomplete="new-password">
              </div>
            </div>
            <div id="cadError" class="auth-error" hidden></div>
            <button type="submit" class="btn primary auth-submit">Criar minha conta</button>
            <p class="auth-hint">Dados fictícios · não inserir dados pessoais reais neste protótipo.</p>
          </form>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════
     3. TELA DO SIMULADOR
     ══════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════
     4. EXPORTAÇÃO PÚBLICA
     ══════════════════════════════════════════════ */

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function totalXPForLevel(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) total += AGDStudent.xpForLevel(i);
    return total;
  }

  globalThis.AGDPortal = {
    renderStudentSidebar,
    renderStudentHome,
    renderStudentLogin,
    renderProgress,
    renderAchievements,
    renderScenarioCards,
    esc
  };
})();
