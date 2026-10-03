/* Auto Gestão de Direção — Módulo de Autenticação do Aluno
   Protótipo local · sem backend · credenciais armazenadas no localStorage
   NÃO usar dados pessoais reais neste protótipo. */

(() => {
  const KEY_STUDENTS = 'agd-student-accounts-v01';
  const KEY_SESSION  = 'agd-student-session-v01';

  /* ── utilidades ── */
  const id = () => 'std-' + Math.random().toString(36).slice(2, 10);

  /* Hash simples (não é segurança real — apenas ofusca a senha no localStorage) */
  function pseudoHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /* ── repositório ── */
  function loadAccounts() {
    try { return JSON.parse(localStorage.getItem(KEY_STUDENTS)) || []; }
    catch { return []; }
  }

  function saveAccounts(accounts) {
    localStorage.setItem(KEY_STUDENTS, JSON.stringify(accounts));
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(KEY_SESSION)); }
    catch { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(KEY_SESSION, JSON.stringify(session));
  }

  /* ── XP / Gamificação ── */
  function freshProgress() {
    return {
      xp: 0, level: 1,
      skills: {
        controle: 0, percepcaoEspacial: 0, estacionamento: 0,
        baliza: 0, distancia: 0, estercamento: 0,
        correcao: 0, retrovisores: 0, seguranca: 0, precisao: 0
      },
      medals: [],
      completedScenarios: [],
      sessions: []
    };
  }

  function xpForLevel(level) { return level * 200; }

  function levelFromXP(xp) {
    let lvl = 1;
    while (xp >= xpForLevel(lvl)) { xp -= xpForLevel(lvl); lvl++; }
    return lvl;
  }

  /* ── API pública ── */

  function register({ name, email, phone, category, org, password }) {
    const accounts = loadAccounts();
    const emailLower = (email || '').trim().toLowerCase();
    if (!emailLower || !password) throw new Error('E‑mail e senha são obrigatórios.');
    if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if (accounts.find(a => a.email === emailLower)) throw new Error('Este e‑mail já está cadastrado.');

    const account = {
      id: id(), org: org || 'org-auto',
      name: name.trim(), email: emailLower,
      phone: (phone || '').trim(), category: category || 'B',
      passwordHash: pseudoHash(password),
      createdAt: new Date().toISOString(),
      progress: freshProgress()
    };
    accounts.push(account);
    saveAccounts(accounts);
    return account;
  }

  function login(email, password) {
    const emailLower = (email || '').trim().toLowerCase();
    const accounts = loadAccounts();
    const account = accounts.find(a => a.email === emailLower);
    if (!account) throw new Error('E‑mail não encontrado.');
    if (account.passwordHash !== pseudoHash(password)) throw new Error('Senha incorreta.');
    const session = { studentId: account.id, email: account.email, loginAt: new Date().toISOString() };
    saveSession(session);
    return { account, session };
  }

  function logout() {
    localStorage.removeItem(KEY_SESSION);
  }

  function currentSession() { return loadSession(); }

  function currentAccount() {
    const session = loadSession();
    if (!session) return null;
    const accounts = loadAccounts();
    return accounts.find(a => a.id === session.studentId) || null;
  }

  function updateProgress(studentId, delta) {
    const accounts = loadAccounts();
    const acc = accounts.find(a => a.id === studentId);
    if (!acc) return;

    const p = acc.progress;
    p.xp = (p.xp || 0) + (delta.xp || 0);
    p.level = levelFromXP(p.xp);

    /* atualizar skills */
    if (delta.skills) {
      for (const [k, v] of Object.entries(delta.skills)) {
        if (k in p.skills) p.skills[k] = Math.min(100, (p.skills[k] || 0) + v);
      }
    }

    /* medalhas */
    if (delta.medal && !p.medals.includes(delta.medal)) p.medals.push(delta.medal);

    /* cenários completados */
    if (delta.scenarioId && !p.completedScenarios.includes(delta.scenarioId)) {
      p.completedScenarios.push(delta.scenarioId);
    }

    /* sessão registrada */
    if (delta.session) {
      p.sessions.push({ ...delta.session, at: new Date().toISOString() });
    }

    saveAccounts(accounts);
    return acc;
  }

  function getAccount(studentId) {
    return loadAccounts().find(a => a.id === studentId) || null;
  }

  /* Criar conta demo para facilitar testes */
  function ensureDemoAccount() {
    const accounts = loadAccounts();
    const demoEmail = 'aluno@demo.com';
    if (!accounts.find(a => a.email === demoEmail)) {
      register({
        name: 'Maria Silva', email: demoEmail, phone: '(31) 99999-0000',
        category: 'B', org: 'org-auto', password: '123456'
      });
    }
  }

  globalThis.AGDStudent = {
    register, login, logout,
    currentSession, currentAccount,
    updateProgress, getAccount,
    xpForLevel, levelFromXP, freshProgress,
    ensureDemoAccount
  };
})();
