/* Auto Gestão de Direção — student-app.js
   Controlador do Portal do Aluno: roteamento e autenticação */

(() => {

  /* ══════════════════════════════════════════════
     ESTADO DO PORTAL DO ALUNO
     ══════════════════════════════════════════════ */

  let studentView = 'aluno-home'; // view atual dentro do portal do aluno
  let studentMode = false;        // true = interface do aluno ativa

  /* ══════════════════════════════════════════════
     UTILITÁRIOS
     ══════════════════════════════════════════════ */

  function toast(text, error = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (error ? ' error' : '');
    t.textContent = text;
    document.querySelector('#toastRoot').append(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* ══════════════════════════════════════════════
     ENTRAR / SAIR DO MODO ALUNO
     ══════════════════════════════════════════════ */

  function enterStudentMode() {
    studentMode = true;
    studentView = 'aluno-home';

    /* sidebar */
    const account = AGDStudent.currentAccount();
    const stdSidebar = document.getElementById('studentSidebar');
    const instSidebar = document.getElementById('instructorSidebar');
    if (stdSidebar && account) {
      stdSidebar.innerHTML = AGDPortal.renderStudentSidebar(account);
      stdSidebar.hidden = false;
    }
    const adminSidebar = document.getElementById('adminSidebar');
    if (adminSidebar) adminSidebar.hidden = true;
    if (instSidebar) instSidebar.hidden = true;

    /* topbar */
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel) modeLabel.textContent = 'Portal do Aluno';

    // Adiciona botão proeminente de saída na topbar
    let topbarExit = document.getElementById('topbarExitStudentBtn');
    if (!topbarExit) {
      const topActions = document.querySelector('.top-actions');
      if (topActions) {
        topbarExit = document.createElement('button');
        topbarExit.id = 'topbarExitStudentBtn';
        topbarExit.className = 'topbar-exit-btn';
        topbarExit.innerHTML = '<span>🚪</span> Sair da Área do Aluno';
        topbarExit.style.cssText = 'background:rgba(220,53,69,0.15);border:1px solid rgba(220,53,69,0.4);color:#ff7878;font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;';
        topActions.prepend(topbarExit);
      }
    }

    renderStudentView();
    bindStudentEvents();
  }

  function exitStudentMode() {

    studentMode = false;
    if (typeof AGDStudent !== 'undefined' && AGDStudent.logout) {
      AGDStudent.logout();
    }

    // Remove botão de saída do topo
    document.getElementById('topbarExitStudentBtn')?.remove();

    // Checa papel ativo no AGDUnifiedAuth
    const unifiedSession = window.AGDUnifiedAuth ? window.AGDUnifiedAuth.getSession() : null;

    /* sidebar */
    const stdSidebar = document.getElementById('studentSidebar');
    const instSidebar = document.getElementById('instructorSidebar');
    const adminSidebar = document.getElementById('adminSidebar');
    if (adminSidebar) adminSidebar.hidden = true;
    if (stdSidebar) { stdSidebar.hidden = true; stdSidebar.innerHTML = ''; }

    /* topbar */
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel) modeLabel.textContent = 'Operação';
    const crumb = document.getElementById('crumb');
    if (crumb) crumb.textContent = 'Visão geral';

    // Se o usuário logou puramente com perfil de aluno, ao sair deve abrir o login
    if (unifiedSession && unifiedSession.role === 'ALUNO') {
      if (instSidebar) instSidebar.hidden = true;
      if (window.AGDUnifiedAuth) {
        window.AGDUnifiedAuth.clearSession();
        window.AGDUnifiedAuth.openLoginModal('Sessão de aluno encerrada. Faça login com outro perfil para acessar o sistema.');
      }
      return;
    }

    // Se for admin, pode retornar direto para o painel de admin ou instrutor
    if (unifiedSession && unifiedSession.role === 'ADMIN') {
      if (instSidebar) instSidebar.hidden = false;
      window.location.hash = '#admin';
      if (window.AGDAdmin && typeof window.AGDAdmin.enterAdminMode === 'function') {
        window.AGDAdmin.enterAdminMode();
        return;
      }
    }

    // Modo padrão (instrutor ou visitante): volta para a visão do instrutor
    if (instSidebar) instSidebar.hidden = false;
    window.location.hash = '#inicio';

    /* voltar para o render do instrutor de forma confiavel */
    if (window.AGDApp && typeof window.AGDApp.showInstructor === 'function') {
      window.AGDApp.showInstructor();
    } else if (typeof render === 'function') {
      render();
    }
  }

  window.AGDStudentApp = {
    enterStudentMode,
    exitStudentMode,
    isStudentMode: () => studentMode
  };

  /* ══════════════════════════════════════════════
     RENDERIZAÇÃO DAS VIEWS DO ALUNO
     ══════════════════════════════════════════════ */

  function renderStudentView() {
    const account = AGDStudent.currentAccount();
    const content = document.getElementById('appContent');
    const crumb = document.getElementById('crumb');
    if (!content || !account) return;

    const labels = {
      'aluno-home': 'Início',
      'progresso': 'Meu Progresso',
      'conquistas': 'Conquistas'
    };

    if (crumb) crumb.textContent = labels[studentView] || 'Aluno';

    /* atualizar nav ativo */
    document.querySelectorAll('.student-nav .nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.studentView === studentView);
    });

    let html = '';
    switch (studentView) {
      case 'aluno-home':
        html = AGDPortal.renderStudentHome(account);
        break;
      case 'progresso':
        html = AGDPortal.renderProgress(account);
        break;
      case 'conquistas':
        html = AGDPortal.renderAchievements(account);
        break;
      default:
        html = AGDPortal.renderStudentHome(account);
    }

    content.innerHTML = html;
  }

  /* ══════════════════════════════════════════════
     LOGIN / CADASTRO
     ══════════════════════════════════════════════ */

  function openStudentAuth() {
    const content = document.getElementById('appContent');
    const crumb = document.getElementById('crumb');
    if (content) content.innerHTML = AGDPortal.renderStudentLogin();
    if (crumb) crumb.textContent = 'Área do Aluno';

    /* garantir conta demo */
    AGDStudent.ensureDemoAccount();

    /* abas login/cadastro */
    const tabLogin = document.getElementById('tabLogin');
    const tabCadastro = document.getElementById('tabCadastro');
    const loginForm = document.getElementById('loginForm');
    const cadForm = document.getElementById('cadastroForm');

    tabLogin?.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabCadastro?.classList.remove('active');
      loginForm && (loginForm.hidden = false);
      cadForm && (cadForm.hidden = true);
    });

    tabCadastro?.addEventListener('click', () => {
      tabCadastro.classList.add('active');
      tabLogin?.classList.remove('active');
      cadForm && (cadForm.hidden = false);
      loginForm && (loginForm.hidden = true);
    });

    /* submit login */
    loginForm?.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value;
      const password = document.getElementById('loginPassword')?.value;
      const errEl = document.getElementById('loginError');
      try {
        AGDStudent.login(email, password);
        toast('Bem-vindo! Entrando na área do aluno…');
        enterStudentMode();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.hidden = false; }
      }
    });

    /* submit cadastro */
    cadForm?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('cadName')?.value;
      const email = document.getElementById('cadEmail')?.value;
      const phone = document.getElementById('cadPhone')?.value;
      const category = cadForm.querySelector('[name="category"]')?.value;
      const password = document.getElementById('cadPassword')?.value;
      const errEl = document.getElementById('cadError');
      try {
        AGDStudent.register({ name, email, phone, category, org: 'org-auto', password });
        AGDStudent.login(email, password);
        toast('Conta criada! Bem-vindo ao Auto Gestão de Direção!');
        enterStudentMode();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.hidden = false; }
      }
    });
  }

  /* ══════════════════════════════════════════════
     DELEGAÇÃO DE EVENTOS DO PORTAL DO ALUNO
     ══════════════════════════════════════════════ */

  function bindStudentEvents() {
    /* logout */
    document.getElementById('studentLogoutBtn')?.addEventListener('click', () => {
      exitStudentMode();
    });
  }

  /* ══════════════════════════════════════════════
     EVENTOS GLOBAIS DO PORTAL DO ALUNO
     (delegação via bubbling para evitar conflito com app.js)
     ══════════════════════════════════════════════ */

  document.addEventListener('click', e => {
    /* abrir área do aluno (botão na sidebar do instrutor) */
    if (e.target.closest('#openStudentAreaBtn')) {
      const session = AGDStudent.currentSession();
      if (session && AGDStudent.currentAccount()) {
        enterStudentMode();
      } else {
        /* exibir autenticação */
        const instSidebar = document.getElementById('instructorSidebar');
        const stdSidebar = document.getElementById('studentSidebar');
        if (instSidebar) instSidebar.hidden = true;
        if (stdSidebar) { stdSidebar.innerHTML = ''; stdSidebar.hidden = true; }
        openStudentAuth();
      }
      return;
    }

    if (!studentMode) return;

    /* navegação entre views do aluno */
    const viewEl = e.target.closest('[data-student-view]');
    if (viewEl) {
      studentView = viewEl.dataset.studentView;
      renderStudentView();
      document.querySelector('#sidebar').classList.remove('open');
      return;
    }

    /* logout / sair do aluno via clique no botão */
    if (e.target.closest('#studentLogoutBtn') || e.target.closest('#studentBackToAppBtn') || e.target.closest('#topbarExitStudentBtn')) {
      exitStudentMode();
      return;
    }
  });

  /* ══════════════════════════════════════════════
     AUTO-RESTAURAR SESSÃO ATIVA
     ══════════════════════════════════════════════ */

  (() => {
    const session = AGDStudent.currentSession();
    if (session && AGDStudent.currentAccount()) {
      /* Há uma sessão ativa — manter no modo instrutor por padrão,
         mas mostrar botão "Área do Aluno" destacado */
      const btn = document.getElementById('openStudentAreaBtn');
      if (btn) btn.classList.add('student-area-link--active');
    }
  })();

})();
