/* ══════════════════════════════════════════════════════════════════════════════
   AUTO GESTÃO DE DIREÇÃO — MÓDULO DE AUTENTICAÇÃO E ROTEAMENTO POR PAPEL (RBAC)
   Controla o acesso conforme o perfil: Aluno, Instrutor/CFC ou Super Administrador
   ══════════════════════════════════════════════════════════════════════════════ */

const AGDUnifiedAuth = (() => {
  const SESSION_KEY = 'agd-unified-session-v1';

  // Base de credenciais conhecidas / demo do sistema (integrado ao Neon)
  const DEMO_USERS = {
    // 1. Super Administrador Master
    'admin@autogestaodirecao.com.br': {
      role: 'ADMIN',
      name: 'Cássio Diniz (Master)',
      email: 'admin@autogestaodirecao.com.br',
      avatar: 'AD',
      orgId: 'all',
      status: 'ATIVO',
      badge: 'Super Admin · Neon DB'
    },
    // 2. Instrutor Autônomo
    'cassio@autogestaodirecao.com.br': {
      role: 'INSTRUTOR',
      name: 'Cássio Diniz',
      email: 'cassio@autogestaodirecao.com.br',
      avatar: 'CD',
      orgId: 'org-auto',
      status: 'ATIVO',
      badge: 'Instrutor Autônomo'
    },
    // 3. Autoescola CFC
    'rafael@direcaocerta.com.br': {
      role: 'CFC',
      name: 'Rafael Costa',
      email: 'rafael@direcaocerta.com.br',
      avatar: 'RC',
      orgId: 'org-cfc',
      status: 'ATIVO',
      badge: 'Direção Certa · CFC'
    },
    // 4. Aluno Cadastrado
    'aluno@demo.com': {
      role: 'ALUNO',
      name: 'Marina Oliveira',
      email: 'aluno@demo.com',
      avatar: 'MO',
      orgId: 'org-auto',
      status: 'ATIVO',
      badge: 'Aluno · Cat. B'
    },
    'marina@aluno.com': {
      role: 'ALUNO',
      name: 'Marina Oliveira',
      email: 'marina@aluno.com',
      avatar: 'MO',
      orgId: 'org-auto',
      status: 'ATIVO',
      badge: 'Aluno · Cat. B'
    }
  };

  function getSession() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    updateTopbarUI();
    applyRole(user.role);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    if (typeof AGDStudent !== 'undefined' && AGDStudent.logout) {
      AGDStudent.logout();
    }
    updateTopbarUI();
  }

  // Identifica o papel pelo e-mail
  function detectRole(email) {
    const e = (email || '').trim().toLowerCase();
    if (DEMO_USERS[e]) return DEMO_USERS[e].role;

    if (e.includes('admin') || e.includes('root') || e.includes('master')) return 'ADMIN';
    if (e.includes('aluno') || e.includes('student') || e.endsWith('@aluno.com')) return 'ALUNO';
    if (e.includes('cfc') || e.includes('autoescola')) return 'CFC';
    return 'INSTRUTOR';
  }

  // Aplica o papel e suas permissões na interface
  function applyRole(role) {
    const instSidebar = document.getElementById('instructorSidebar');
    const stdSidebar = document.getElementById('studentSidebar');
    const adminSidebar = document.getElementById('adminSidebar');
    const openAdminBtn = document.getElementById('openAdminMasterBtn');
    const openStudentBtn = document.getElementById('openStudentAreaBtn');

    // 🎓 PAPEL: ALUNO
    if (role === 'ALUNO') {
      if (instSidebar) instSidebar.hidden = true;
      if (adminSidebar) adminSidebar.hidden = true;
      if (openAdminBtn) openAdminBtn.style.display = 'none';

      // Assegura a conta usada pelo Portal do Aluno
      let stdAccount = typeof AGDStudent !== 'undefined' ? AGDStudent.currentAccount() : null;
      if (!stdAccount && typeof AGDStudent !== 'undefined') {
        const demoEmail = 'aluno@demo.com';
        stdAccount = AGDStudent.loadAccounts?.().find(a => a.email === demoEmail);
        if (stdAccount) {
          AGDStudent.saveSession?.({ studentId: stdAccount.id, email: stdAccount.email });
        }
      }

      if (window.AGDStudentApp && typeof window.AGDStudentApp.enterStudentMode === 'function') {
        window.AGDStudentApp.enterStudentMode();
      }
      return;
    }
    // Se não for aluno, reativar instrutor/admin
    if (stdSidebar) { stdSidebar.hidden = true; stdSidebar.innerHTML = ''; }

    // ⚡ PAPEL: SUPER ADMINISTRADOR MASTER
    if (role === 'ADMIN') {
      if (openAdminBtn) openAdminBtn.style.display = 'flex';
      if (openStudentBtn) openStudentBtn.style.display = 'flex';

      // Se a URL ou estado for #admin, abrir admin
      if (window.location.hash.startsWith('#admin') || window.location.hash === '') {
        window.location.hash = '#admin';
        if (window.AGDAdmin && typeof window.AGDAdmin.enterAdminMode === 'function') {
          window.AGDAdmin.enterAdminMode();
          return;
        }
      } else {
        if (window.AGDApp && typeof window.AGDApp.showInstructor === 'function') {
          window.AGDApp.showInstructor();
        }
      }
      return;
    }

    // 🚗 PAPEL: INSTRUTOR OU AUTOESCOLA (CFC)
    if (role === 'INSTRUTOR' || role === 'CFC') {
      if (adminSidebar) adminSidebar.hidden = true;
      if (openAdminBtn) openAdminBtn.style.display = 'none'; // Instrutor NÃO vê botão do super admin
      if (openStudentBtn) openStudentBtn.style.display = 'flex';

      // Ajusta organização no banco de dados local
      if (window.AGDApp && typeof window.AGDApp.getDb === 'function') {
        const db = window.AGDApp.getDb();
        if (db) {
          db.activeOrg = role === 'CFC' ? 'org-cfc' : 'org-auto';
        }
      }

      if (window.AGDApp && typeof window.AGDApp.showInstructor === 'function') {
        window.AGDApp.showInstructor();
      }
      return;
    }
  }

  // Atualiza o chip de sessão no topo da página
  function updateTopbarUI() {
    const session = getSession();
    let container = document.getElementById('userSessionChip');

    if (!container) {
      const topActions = document.querySelector('.top-actions');
      if (!topActions) return;
      container = document.createElement('div');
      container.id = 'userSessionChip';
      topActions.prepend(container);
    }

    if (!session) {
      container.innerHTML = `
        <button id="openLoginModalBtn" class="btn primary" style="padding:6px 14px;font-size:12px;border-radius:20px;display:flex;align-items:center;gap:6px;">
          <span>🔑</span> Entrar / Login
        </button>
      `;
      document.getElementById('openLoginModalBtn')?.addEventListener('click', () => openLoginModal());
      return;
    }

    const roleIcon = session.role === 'ADMIN' ? '⚡' : session.role === 'ALUNO' ? '🎓' : session.role === 'CFC' ? '🏢' : '🚗';
    const roleColor = session.role === 'ADMIN' ? '#00e599' : session.role === 'ALUNO' ? '#00c8ff' : '#58a875';

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.9);border:1px solid #d7e6db;padding:4px 10px;border-radius:20px;font-size:11px;">
        <span style="font-weight:700;color:${roleColor};display:flex;align-items:center;gap:4px;">
          ${roleIcon} ${session.name.split(' ')[0]}
        </span>
        <span style="color:#77857c;font-size:10px;">(${session.badge || session.role})</span>
        <button id="topbarSwitchRoleBtn" style="border:none;background:none;color:#963e3e;font-weight:700;cursor:pointer;padding:0 4px;font-size:11px;" title="Sair da conta e alternar perfil">
          Sair
        </button>
      </div>
    `;

    document.getElementById('topbarSwitchRoleBtn')?.addEventListener('click', () => {
      clearSession();
      openLoginModal('Sessão encerrada com sucesso. Selecione o perfil desejado para acessar:');
    });
  }

  // Modal Unificado de Login
  function openLoginModal(infoMsg = '') {
    const root = document.getElementById('modalRoot');
    if (!root) return;

    root.innerHTML = `
      <div class="modal-backdrop" id="loginModalBackdrop" style="background:rgba(10,20,15,0.75);backdrop-filter:blur(4px);z-index:9999;">
        <div class="modal" style="max-width:480px;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.5);overflow:hidden;border:1px solid #2a4036;">
          
          <div style="background:linear-gradient(135deg, #14261f, #0d1721);color:#eaf1ec;padding:22px 24px;border-bottom:1px solid #1e342b;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="brand-mark" style="width:36px;height:36px;background:#00e599;color:#0b1b12;font-size:14px;">AG</span>
              <div>
                <b style="font-size:16px;color:#f0f6fc;display:block;">Auto Gestão de Direção</b>
                <small style="color:#93a69a;font-size:11px;">Acesso ao Sistema por Papel</small>
              </div>
            </div>
            <button id="closeLoginModalBtn" style="background:none;border:none;color:#93a69a;font-size:24px;cursor:pointer;">×</button>
          </div>

          <div style="padding:22px 24px;background:#ffffff;">
            ${infoMsg ? `<div style="padding:10px 14px;background:#eef6f0;border-left:4px solid #176b4b;border-radius:6px;font-size:12px;color:#286342;margin-bottom:16px;">${infoMsg}</div>` : ''}

            <p style="margin:0 0 16px;font-size:13px;color:#526158;line-height:1.5;">
              O e-mail digitado determina automaticamente a visão do sistema:
              <b style="color:#14261f;">Alunos</b> acessam o portal de aprendizagem,
              <b style="color:#14261f;">Instrutores</b> operam sua autoescola e
              <b style="color:#14261f;">Administradores</b> controlam todo o sistema.
            </p>

            <form id="formUnifiedLogin" style="display:flex;flex-direction:column;gap:12px;">
              <div>
                <label style="font-size:11px;font-weight:700;color:#526158;display:block;margin-bottom:4px;">E-mail de Acesso:</label>
                <input type="email" id="loginEmailInput" placeholder="seu-email@dominio.com" style="width:100%;padding:10px 12px;border:1px solid #dfe5e0;border-radius:8px;font-size:13px;box-sizing:border-box;" required />
              </div>

              <div>
                <label style="font-size:11px;font-weight:700;color:#526158;display:block;margin-bottom:4px;">Senha:</label>
                <input type="password" id="loginPassInput" placeholder="••••••••" value="123456" style="width:100%;padding:10px 12px;border:1px solid #dfe5e0;border-radius:8px;font-size:13px;box-sizing:border-box;" required />
              </div>

              <button type="submit" class="btn primary" style="padding:11px;font-size:13px;font-weight:700;border-radius:8px;margin-top:6px;justify-content:center;display:flex;">
                Entrar no Sistema →
              </button>
            </form>

            <div style="margin:20px 0 12px;text-align:center;position:relative;">
              <hr style="border:0;border-top:1px solid #e8ece8;" />
              <span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 10px;font-size:11px;color:#8a938c;font-weight:700;text-transform:uppercase;">
                Acesso Rápido Demo (1-Clique)
              </span>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;">
              <button class="btn-fast-login" data-email="aluno@demo.com" style="background:#f0f9ff;border:1px solid #b9e6fe;color:#026aa2;padding:10px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;text-align:left;">
                <span style="font-size:16px;">🎓</span>
                <div><b>Aluno</b><small style="display:block;font-size:10px;opacity:.8;">Portal do Aluno</small></div>
              </button>

              <button class="btn-fast-login" data-email="cassio@autogestaodirecao.com.br" style="background:#f6fbf7;border:1px solid #cce5d5;color:#1e5e39;padding:10px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;text-align:left;">
                <span style="font-size:16px;">🚗</span>
                <div><b>Instrutor</b><small style="display:block;font-size:10px;opacity:.8;">Autônomo</small></div>
              </button>

              <button class="btn-fast-login" data-email="rafael@direcaocerta.com.br" style="background:#fbfbfb;border:1px solid #e0e0e0;color:#333;padding:10px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;text-align:left;">
                <span style="font-size:16px;">🏢</span>
                <div><b>Autoescola</b><small style="display:block;font-size:10px;opacity:.8;">CFC Completo</small></div>
              </button>

              <button class="btn-fast-login" data-email="admin@autogestaodirecao.com.br" style="background:#0e1722;border:1px solid #00e599;color:#00e599;padding:10px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;text-align:left;">
                <span style="font-size:16px;">⚡</span>
                <div><b>Super Admin</b><small style="display:block;font-size:10px;color:#a8b7ae;">Visão Geral Neon</small></div>
              </button>
            </div>

          </div>
        </div>
      </div>
    `;

    document.getElementById('closeLoginModalBtn').onclick = () => { root.innerHTML = ''; };
    document.getElementById('loginModalBackdrop').onclick = (e) => {
      if (e.target.id === 'loginModalBackdrop') root.innerHTML = '';
    };

    // Submissão do formulário
    document.getElementById('formUnifiedLogin').onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmailInput').value.trim();
      const role = detectRole(email);
      const user = DEMO_USERS[email.toLowerCase()] || {
        role,
        name: email.split('@')[0],
        email,
        avatar: email.substring(0, 2).toUpperCase(),
        status: 'ATIVO',
        badge: role
      };

      setSession(user);
      root.innerHTML = '';
    };

    // Cliques nos botões de acesso rápido
    document.querySelectorAll('.btn-fast-login').forEach(btn => {
      btn.onclick = () => {
        const email = btn.dataset.email;
        const user = DEMO_USERS[email];
        if (user) {
          setSession(user);
          root.innerHTML = '';
        }
      };
    });
  }

  function init() {
    let session = getSession();

    // Se não houver sessão salva, inicia por padrão no perfil de Instrutor
    if (!session) {
      session = DEMO_USERS['cassio@autogestaodirecao.com.br'];
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    updateTopbarUI();

    // Se estiver em rota #admin, mas o usuário for ALUNO, redirecionar para aluno
    if (window.location.hash.startsWith('#admin') && session.role === 'ALUNO') {
      window.location.hash = '#aluno-home';
    }

    applyRole(session.role);
  }

  return {
    init,
    getSession,
    setSession,
    clearSession,
    openLoginModal,
    applyRole,
    detectRole
  };
})();

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', AGDUnifiedAuth.init);
} else {
  AGDUnifiedAuth.init();
}
