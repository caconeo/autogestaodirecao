/* Auto Gestão de Direção — student-app.js
   Controlador do Portal do Aluno: roteamento, autenticação e integração com o simulador */

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

    renderStudentView();
    bindStudentEvents();
  }

  function exitStudentMode() {
    /* destruir simulador se ativo */
    if (typeof AGDSimulator !== 'undefined') AGDSimulator.destroy();

    studentMode = false;
    AGDStudent.logout();

    /* sidebar */
    const stdSidebar = document.getElementById('studentSidebar');
    const instSidebar = document.getElementById('instructorSidebar');
    const adminSidebar = document.getElementById('adminSidebar');
    if (adminSidebar) adminSidebar.hidden = true;
    if (stdSidebar) { stdSidebar.hidden = true; stdSidebar.innerHTML = ''; }
    if (instSidebar) instSidebar.hidden = false;

    /* topbar */
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel) modeLabel.textContent = 'Operação';

    /* voltar para o render do instrutor */
    if (typeof render === 'function') render();
  }

  /* ══════════════════════════════════════════════
     RENDERIZAÇÃO DAS VIEWS DO ALUNO
     ══════════════════════════════════════════════ */

  function renderStudentView() {
    const account = AGDStudent.currentAccount();
    const content = document.getElementById('appContent');
    const crumb = document.getElementById('crumb');
    if (!content || !account) return;

    /* destruir simulador se trocar de view */
    if (studentView !== 'simulador' && typeof AGDSimulator !== 'undefined') {
      AGDSimulator.destroy();
    }

    const labels = {
      'aluno-home': 'Início',
      'simulador': 'Simulador',
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
      case 'simulador':
        html = AGDPortal.renderSimulatorPage();
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

    /* iniciar simulador após DOM ser inserido */
    if (studentView === 'simulador') {
      requestAnimationFrame(() => {
        if (typeof AGDSimulator !== 'undefined') AGDSimulator.init();
      });
    }
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
      const targetScenario = viewEl.dataset.selectScenario;
      renderStudentView();
      if (targetScenario && typeof AGDSimulator !== 'undefined' && AGDSimulator.switchScenario) {
        setTimeout(() => AGDSimulator.switchScenario(targetScenario), 80);
      }
      document.querySelector('#sidebar').classList.remove('open');
      return;
    }

    /* logout via clique no botão */
    if (e.target.closest('#studentLogoutBtn')) {
      exitStudentMode();
      return;
    }
  });

  /* ══════════════════════════════════════════════
     EVENTO: resultado do simulador salvo
     ══════════════════════════════════════════════ */

  document.addEventListener('agd:sim-result-saved', e => {
    const detail = e.detail;
    const xp = detail?.xp || 0;
    toast(`✓ Resultado salvo! +${xp} XP ganhos.`);

    /* atualizar sidebar do aluno com novos dados */
    const account = AGDStudent.currentAccount();
    if (account) {
      const stdSidebar = document.getElementById('studentSidebar');
      if (stdSidebar) stdSidebar.innerHTML = AGDPortal.renderStudentSidebar(account);
      bindStudentEvents();
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
