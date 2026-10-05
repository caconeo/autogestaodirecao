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
      <a class="brand" href="#aluno-home" id="studentBrandLink">
        <span class="brand-mark">AG</span>
        <span><b>auto gestão</b><small>de direção</small></span>
      </a>

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
        <button class="nav-item" data-student-view="simulador">
          <span>◉</span> Simulador
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
          <button class="btn primary" data-student-view="simulador">▶ Praticar agora</button>
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
            <button class="text-action" data-student-view="simulador">Acessar →</button>
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
              active ? `<button class="btn primary" data-student-view="simulador" data-select-scenario="${s.id}" style="font-size:10px;padding:6px 10px">Praticar</button>` :
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
            <p>Acesse sua conta para praticar no simulador</p>
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
  function renderSimulatorPage() {
    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">SIMULADOR INTERATIVO</div>
          <h1 id="simPageTitle">Simulador de Direção</h1>
          <p id="simPageSubtitle">Treine manobras e direção defensiva em ambiente visual interativo</p>
        </div>
        <div class="head-actions">
          <button class="btn" id="simHelpBtn">Como usar</button>
        </div>
      </div>

      <!-- Barra de Seleção de Cenários -->
      <div class="sim-scenario-bar" id="simScenarioBar">
        <button class="sim-scen-btn active" id="simBtnBaliza" data-scenario="baliza-basica">
          🚗 Baliza Básica (Estacionamento)
        </button>
        <button class="sim-scen-btn" id="simBtnVias" data-scenario="direcao-vias">
          🛣️ Direção em Vias & Distâncias
        </button>
        <button class="sim-scen-btn" id="simBtnCidade" data-scenario="cidade-ctb">
          🏙️ Simulador Vida Real & CTB (Escola, Preferências, Trens & SAMU)
        </button>
      </div>

      <!-- Painel de Parametrização das Situações Cotidianas CTB -->
      <div class="sim-situation-panel" id="simSituationPanel" style="display:none">
        <div class="sim-sit-top">
          <div class="sim-sit-header">
            <span class="sim-sit-title">🚦 SITUAÇÕES E VIAS COTIDIANAS (CTB BRASIL)</span>
            <span class="sim-sit-subtitle">Velocidades reais, preferências, cruzamentos e eventos surpresa de emergência:</span>
          </div>
          <div class="sim-sit-actions">
            <span class="sim-random-badge" id="simRandomBadge" title="O sistema aciona SAMU 192, Polícia e Trem aleatoriamente durante o percurso">
              🎲 Aleatório: SAMU • Polícia • Trem
            </span>
            <button class="sim-trigger-btn red" id="simTriggerAmbulance" title="Ambulância SAMU pedindo passagem com sirene (Art. 189 CTB)">
              🚨 Chamar SAMU 192
            </button>
            <button class="sim-trigger-btn emerald" id="simTriggerPolice" title="Viatura Policial / PRF com sirene de emergência (Art. 189 CTB)">
              🚓 Acionar Polícia
            </button>
            <button class="sim-trigger-btn blue" id="simTriggerTrain" title="Trem de carga cruzando a passagem de nível com parada obrigatória (Art. 212 CTB)">
              🚂 Acionar Trem
            </button>
            <button class="sim-trigger-btn amber" id="simToggleWarden" title="Alternar entre guarda apitando parada e travessia autônoma de crianças">
              👮 Alternar Guarda
            </button>
          </div>
        </div>
        <div class="sim-sit-pills">
          <button class="sim-sit-pill active" id="simSitSchool" data-stage="escolar">
            🏫 Zona 30 (Escola 30 km/h)
          </button>
          <button class="sim-sit-pill" id="simSitColetora" data-stage="coletora">
            🛑 Bairro / PARE R-1 (40 km/h)
          </button>
          <button class="sim-sit-pill" id="simSitArterial" data-stage="arterial">
            🏙️ Avenida Arterial (60 km/h)
          </button>
          <button class="sim-sit-pill" id="simSitRail" data-stage="ferrovia">
            🚂 Passagem de Nível (40 km/h)
          </button>
          <button class="sim-sit-pill" id="simSitHighway" data-stage="rodovia">
            🛣️ Rodovia BR-101 (100 km/h)
          </button>
        </div>
      </div>

      <!-- Barra de Fiscalização da Lei de Trânsito (CTB & CNH Oficial) -->
      <div class="sim-ctb-bar" id="simCtbBar">
        <div class="sim-cnh-status">
          <div class="sim-cnh-label">CARTEIRA DE HABILITAÇÃO (CNH)</div>
          <div class="sim-cnh-meter">
            <span class="sim-cnh-pts" id="simCnhPoints">0 / 40 pts</span>
            <div class="sim-cnh-track">
              <div class="sim-cnh-fill" id="simCnhFill" style="width:0%"></div>
            </div>
            <span class="sim-cnh-badge regular" id="simCnhBadge">CNH REGULAR</span>
          </div>
        </div>

        <div class="sim-fines-total">
          <div class="sim-fines-label">MULTAS ACUMULADAS</div>
          <div class="sim-fines-val" id="simFinesVal">R$ 0,00</div>
        </div>

        <div class="sim-officer-widget" id="simOfficerWidget" title="Agente da Autoridade de Trânsito">
          <div class="sim-officer-avatar">👮</div>
          <div class="sim-officer-info">
            <span class="sim-officer-name">Agente Silva</span>
            <span class="sim-officer-status"><span class="sim-pulse-dot"></span> Fiscalização Ativa</span>
          </div>
        </div>

        <button class="sim-ait-btn" id="simOpenAitBtn">
          📜 Infrações (AITs) <span class="sim-ait-badge" id="simAitBadgeCount">0</span>
        </button>
      </div>

      <!-- Alerta Interativo do Agente de Trânsito (Policial Legislativo) -->
      <div class="sim-officer-dialog" id="simOfficerDialog" style="display:none">
        <div class="sim-officer-dialog-inner">
          <div class="sim-officer-big-avatar">
            <div class="sim-officer-sprite">👮‍♂️</div>
            <div class="sim-police-lights">
              <span class="p-light blue"></span>
              <span class="p-light red"></span>
            </div>
          </div>
          <div class="sim-officer-speech">
            <div class="sim-officer-header">
              <span class="sim-officer-title">AGENTE DE TRÂNSITO — FISCALIZAÇÃO CTB</span>
              <span class="sim-officer-time" id="simOfficerTime">Agora</span>
            </div>
            <div class="sim-officer-msg" id="simOfficerMsg">
              Atenção, condutor! Mantenha a velocidade e a sinalização conforme o Código de Trânsito Brasileiro.
            </div>
            <div class="sim-officer-fine-card" id="simOfficerFineCard" style="display:none">
              <div class="sim-fine-art" id="simFineArt">Art. 196 do CTB</div>
              <div class="sim-fine-data">
                <span id="simFineSeverity">Gravidade: Grave</span> • 
                <span id="simFinePts">+5 pontos na CNH</span> • 
                <span id="simFinePrice">R$ 195,23</span>
              </div>
            </div>
          </div>
          <button class="sim-officer-close-btn" id="simOfficerCloseBtn" title="Dispensar aviso">✕</button>
        </div>
      </div>

      <div class="simulator-shell" id="simulatorShell">
        <!-- HUD Topo -->
        <div class="sim-hud-top">
          <!-- Cenário Baliza HUD -->
          <div class="sim-scenario-info" id="simBalizaHudInfo">
            <span class="sim-scenario-badge" id="simScenarioBadge">BALIZA BÁSICA</span>
            <span class="sim-mode-badge" id="simModeBadge">TRAJETÓRIA</span>
          </div>

          <!-- Cenário Vias & Cidade HUD -->
          <div class="sim-road-hud" id="simRoadHud" style="display:none">
            <div class="sim-speed-sign" id="simSpeedSign" title="Limite regulamentado da via">
              <span id="simSpeedSignNum">40</span>
              <small>km/h</small>
            </div>
            <div class="sim-road-info">
              <span class="sim-road-badge" id="simRoadBadge">🏙️ CENTRO URBANO</span>
              <div class="sim-stage-timer-wrap">
                <div class="sim-stage-timer-track"><div class="sim-stage-timer-fill" id="simRoadTimerFill" style="width:100%"></div></div>
                <span id="simRoadTimerText">Próximo trecho em: <b>20s</b></span>
              </div>
            </div>
            <div class="sim-status-pill green" id="simStatusPill">
              🟢 SINAL VERDE — Distância Segura
            </div>
          </div>

          <!-- Seletor de Modo da Baliza -->
          <div class="sim-mode-switcher" id="simBalizaModeSwitcher">
            <button class="sim-mode-tab active" id="simTabTrajectory" data-mode="trajectory" title="Posicione o carro e desenhe o trajeto com o mouse">
              ✏️ Trajetória (Mouse)
            </button>
            <button class="sim-mode-tab" id="simTabGuided" data-mode="guided" title="Passo a passo com pedais e volante">
              🧭 Modo Guiado
            </button>
            <button class="sim-mode-tab" id="simTabFree" data-mode="free" title="Manobra livre sem assistência">
              🎮 Volante Livre
            </button>
          </div>

          <div class="sim-score-area">
            <span id="simScoreLabel">Score</span>
            <b id="simScore">—</b>
          </div>
          <div class="sim-controls-top">
            <div class="sim-drive-mode-group" id="simDriveModeGroup">
              <button class="sim-drive-mode-btn" id="simBtnDriveUser" data-drive-mode="manual" title="Você assume o controle dos pedais e volante">
                🚗 Conduzir
              </button>
              <button class="sim-drive-mode-btn active demo-active" id="simBtnDriveDemo" data-drive-mode="demo" title="A IA assume a direção respeitando 100% das leis e ritos do CTB">
                🤖 Demo (IA)
              </button>
            </div>
            <button class="sim-btn-sm" id="simDemoBtn" style="display:none">▶ Demo</button>
            <button class="sim-btn-sm" id="simResetBtn" title="Reiniciar simulação">↺ Reiniciar</button>
          </div>
        </div>

        <!-- Barra de Câmeras (Mobile-Friendly) -->
        <div class="sim-view-mode-bar" id="simViewModeBar">
          <span class="sim-view-mode-label">Câmeras:</span>
          <div class="sim-view-mode-buttons">
            <button class="sim-view-btn active" id="simViewBtnTop" data-view-mode="top" title="Visão Superior ampla (Padrão)">
              🗺️ Visão Superior
            </button>
            <button class="sim-view-btn" id="simViewBtnBoth" data-view-mode="both" title="Ambas as Visões">
              📱 Ambas as Visões
            </button>
            <button class="sim-view-btn" id="simViewBtnDriver" data-view-mode="driver" title="Visão do Condutor com minimapa">
              🚗 Visão do Condutor
            </button>
          </div>
        </div>

        <!-- Viewports com classes de layout dinâmicas -->
        <div class="sim-views layout-top" id="simViewsContainer">
          <!-- VIEW B — Top View (Prioritária no Mobile) -->
          <div class="sim-view-top cursor-grab" id="simViewTop">
            <div class="sim-view-label">VISÃO SUPERIOR (TOP VIEW)</div>
            <canvas id="topCanvas"></canvas>
          </div>

          <!-- VIEW A — Visão do Condutor -->
          <div class="sim-view-driver" id="simViewDriver">
            <div class="sim-view-label">VISÃO DO CONDUTOR</div>
            <canvas id="driverCanvas"></canvas>
            <div class="sim-mirrors">
              <div class="sim-mirror left" id="mirrorLeft" title="Retrovisor Esquerdo"><canvas id="mirrorLeftCanvas"></canvas></div>
              <div class="sim-mirror center" id="mirrorCenter" title="Retrovisor Central Interno"><canvas id="mirrorCenterCanvas"></canvas></div>
              <div class="sim-mirror right" id="mirrorRight" title="Retrovisor Direito"><canvas id="mirrorRightCanvas"></canvas></div>
            </div>
          </div>
        </div>

        <!-- Painel de Instrução com Ações -->
        <div class="sim-instruction-panel" id="simInstPanel">
          <div class="sim-inst-icon" id="simInstIcon">💡</div>
          <div class="sim-inst-text" id="simInstText">
            <b>Passo 1:</b> Arraste o carro com o mouse até a lateral do <b>Veículo A</b> para alinhar os retrovisores.
          </div>
          <div class="sim-inst-actions" id="simInstActions">
            <button class="sim-act-btn primary" id="simExecuteDrawBtn" style="display:none">▶ Executar Manobra</button>
            <button class="sim-act-btn" id="simClearDrawBtn" style="display:none">↺ Redesenhar</button>
            <button class="sim-act-btn" id="simRealignBtn" style="display:none">↔ Reposicionar</button>
          </div>
        </div>

        <!-- Controles do Veículo -->
        <div class="sim-controls-bar">
          <!-- Volante -->
          <div class="sim-steering-wrap">
            <div class="sim-ctrl-label">VOLANTE</div>
            <div class="sim-steering" id="simSteering">
              <canvas id="steeringCanvas" width="90" height="90"></canvas>
            </div>
            <div class="sim-steering-angle" id="simSteeringAngle">0°</div>
          </div>

          <!-- Marcha -->
          <div class="sim-gear-wrap">
            <div class="sim-ctrl-label">MARCHA</div>
            <div class="sim-gear-selector">
              <button class="sim-gear-btn active" id="gearD" data-gear="D">D</button>
              <button class="sim-gear-btn" id="gearN" data-gear="N">N</button>
              <button class="sim-gear-btn" id="gearR" data-gear="R">R</button>
            </div>
          </div>

          <!-- Setas (Sinalização para Mudança de Faixa - CTB Art. 196) -->
          <div class="sim-signals-wrap" id="simSignalsWrap">
            <div class="sim-ctrl-label">SETAS (SINALIZAÇÃO)</div>
            <div class="sim-signal-btns">
              <button class="sim-signal-btn" id="simTurnLeftBtn" title="Seta para a esquerda (Tecla Q ou A)">
                <span class="sim-signal-icon">⇦</span> ESQ
              </button>
              <button class="sim-signal-btn" id="simTurnRightBtn" title="Seta para a direita (Tecla E ou D)">
                DIR <span class="sim-signal-icon">⇨</span>
              </button>
            </div>
            <div class="sim-signal-status" id="simSignalStatus">Seta Desligada</div>
          </div>

          <!-- Acelerador / Freio -->
          <div class="sim-pedals">
            <div class="sim-ctrl-label">VELOCIDADE</div>
            <div class="sim-speed-display" id="simSpeedDisplay">0 km/h</div>
            <div class="sim-pedal-btns">
              <button class="sim-pedal-btn accel" id="pedalAccel" aria-label="Acelerar">▲</button>
              <button class="sim-pedal-btn brake" id="pedalBrake" aria-label="Frear">■</button>
            </div>
          </div>

          <!-- Distâncias -->
          <div class="sim-distances">
            <div class="sim-ctrl-label">DISTÂNCIAS</div>
            <div class="sim-dist-grid">
              <div class="sim-dist-item"><span class="dist-dir">↑</span><span id="distFront">—</span></div>
              <div class="sim-dist-item"><span class="dist-dir">↓</span><span id="distRear">—</span></div>
              <div class="sim-dist-item"><span class="dist-dir">←</span><span id="distLeft">—</span></div>
              <div class="sim-dist-item"><span class="dist-dir">→</span><span id="distRight">—</span></div>
            </div>
          </div>

          <!-- Botão avançar -->
          <div class="sim-action-wrap">
            <button class="btn primary sim-next-btn" id="simNextBtn" hidden>Próximo →</button>
            <button class="btn sim-finish-btn" id="simFinishBtn" hidden>Ver resultado</button>
          </div>
        </div>

        <!-- Overlay de Resultado -->
        <div class="sim-result-overlay" id="simResultOverlay" style="display:none" hidden>
          <div class="sim-result-card">
            <div class="sim-result-title" id="simResultTitle">Manobra concluída!</div>
            <div class="sim-result-score" id="simResultScore">—</div>
            <div class="sim-result-detail" id="simResultDetail"></div>
            <div class="sim-result-actions">
              <button class="btn" id="simTryAgainBtn">↺ Tentar novamente</button>
              <button class="btn primary" id="simSaveResultBtn">✓ Salvar resultado</button>
            </div>
          </div>
        </div>

        <!-- Modal de Autos de Infração de Trânsito (AITs) -->
        <div class="sim-ait-modal-overlay" id="simAitModal" style="display:none">
          <div class="sim-ait-modal-card">
            <div class="sim-ait-modal-header">
              <div class="sim-ait-modal-title">
                <span class="sim-ait-modal-icon">📜</span>
                <div>
                  <h3>Registro de Infrações — CTB Oficial</h3>
                  <p>Fiscalização pelo Policial Legislativo / Agente de Trânsito</p>
                </div>
              </div>
              <button class="sim-ait-modal-close" id="simAitModalCloseBtn">✕</button>
            </div>
            <div class="sim-ait-modal-summary" id="simAitSummary">
              <div class="sim-ait-stat">
                <span class="stat-lbl">PONTOS CNH</span>
                <b class="stat-val" id="simModalCnhPts">0 / 40</b>
              </div>
              <div class="sim-ait-stat">
                <span class="stat-lbl">TOTAL MULTAS</span>
                <b class="stat-val red" id="simModalTotalFines">R$ 0,00</b>
              </div>
              <div class="sim-ait-stat">
                <span class="stat-lbl">STATUS DA CNH</span>
                <b class="stat-val green" id="simModalCnhStatus">REGULAR</b>
              </div>
            </div>
            <div class="sim-ait-list" id="simAitList">
              <div class="sim-ait-empty">
                <span>🛡️ Nenhuma infração registrada nesta sessão. Condução exemplar conforme o CTB!</span>
              </div>
            </div>
            <div class="sim-ait-modal-actions">
              <button class="btn" id="simAitClearBtn">↺ Zerar Histórico</button>
              <button class="btn primary" id="simAitOkBtn">Fechar</button>
            </div>
          </div>
        </div>

        <!-- Modal de Acidente Gravíssimo com Trem (Vidas Podem Ter Sido Perdidas) -->
        <div class="sim-fatal-modal" id="simTrainFatalModal" style="display:none">
          <div class="sim-fatal-box">
            <div class="sim-fatal-badge">⚠️ ACIDENTE GRAVÍSSIMO</div>
            <h2 class="sim-fatal-title">🚨 VIDAS PODEM TER SIDO PERDIDAS!</h2>
            <p class="sim-fatal-text">
              O veículo invadiu a linha férrea e foi colhido pelo trem de carga a plena velocidade! A desaceleração de centenas de toneladas leva centenas de metros e o impacto é devastador.
            </p>
            <div class="sim-fatal-ctb">
              <b>Art. 212 do CTB:</b> Deixar de parar o veículo antes de transpor a linha férrea (Passagem de Nível). Infração Gravíssima (Penalidade: Multa + Suspensão da CNH + Risco Letal).
            </div>
            <div class="sim-fatal-timer" id="simFatalCountdown">Reiniciando o simulador em 4 segundos...</div>
            <button class="sim-fatal-btn" id="simFatalRestartBtn">↺ Reiniciar Agora</button>
          </div>
        </div>
      </div>

      <p class="hint section-spacer" style="margin-top:14px">
        ⓘ Controles: setas do teclado ← → para virar, ↑ para acelerar, ↓ para frear/ré. Toque na tela também é suportado.
      </p>
    `;
  }

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
    renderSimulatorPage,
    renderProgress,
    renderAchievements,
    renderScenarioCards,
    esc
  };
})();
