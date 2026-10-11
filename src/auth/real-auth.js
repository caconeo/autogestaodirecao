(() => {
  const TOKEN_KEY = 'agd-access-token';
  const API_URL = '/api/auth';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  async function request(action, options = {}) {
    const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação');
    return body;
  }

  function mapUser(user) {
    return {
      role: user.papel === 'ADMIN_ORG' ? 'INSTRUTOR' : user.papel,
      name: user.nome,
      email: user.email,
      avatar: user.nome.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
      orgId: user.organizacao_id,
      status: user.status || 'ATIVO',
      badge: user.modo_demo ? 'Conta de demonstração' : 'Instrutor verificado',
      realSession: true
    };
  }

  function field(label, name, type, autocomplete, required = true) {
    return `<div class="field full"><label for="real-${name}">${label}</label><input id="real-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${required ? 'required' : ''}></div>`;
  }

  function openModal(mode = 'login') {
    const root = document.getElementById('modalRoot');
    if (!root) return;
    const isRegister = mode === 'register';
    root.innerHTML = `
      <div class="modal-backdrop" data-real-auth-close>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="real-auth-title">
          <div class="modal-head">
            <h2 id="real-auth-title">${isRegister ? 'Criar conta de instrutor' : 'Entrar na gestão'}</h2>
            <button type="button" data-real-auth-close aria-label="Fechar">×</button>
          </div>
          <form id="realAuthForm" novalidate>
            <div class="modal-body">
              <div class="form-grid">
                ${isRegister ? field('Nome completo', 'nome', 'text', 'name') : ''}
                ${field('E-mail', 'email', 'email', 'email')}
                ${isRegister ? field('CPF', 'cpf', 'text', 'off') : ''}
                ${field('Senha', 'senha', 'password', isRegister ? 'new-password' : 'current-password')}
              </div>
              <p class="hint">${isRegister ? 'Cadastro permitido somente para instrutores com dados próprios e verdadeiros.' : 'Use sua conta real. Contas demo permanecem identificadas e isoladas.'}</p>
              <div id="realAuthStatus" class="form-status" role="status" aria-live="polite"></div>
            </div>
            <div class="modal-foot">
              <button type="button" class="btn" data-switch-auth="${isRegister ? 'login' : 'register'}">${isRegister ? 'Já tenho conta' : 'Criar conta'}</button>
              <button type="submit" class="btn primary">${isRegister ? 'Cadastrar instrutor' : 'Entrar'}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  async function submit(form) {
    const status = document.getElementById('realAuthStatus');
    const values = Object.fromEntries(new FormData(form));
    const isRegister = Boolean(values.nome);
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    status.textContent = 'Validando dados…';
    try {
      const result = await request(isRegister ? 'register-instructor' : 'login', {
        method: 'POST',
        body: JSON.stringify(values)
      });
      setToken(result.accessToken);
      AGDUnifiedAuth.setSession(mapUser(result.user));
      document.getElementById('modalRoot').innerHTML = '';
      window.dispatchEvent(new CustomEvent('agd:authenticated', { detail: result.user }));
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error');
    } finally {
      submitButton.disabled = false;
    }
  }

  async function restore() {
    if (!getToken()) return;
    try {
      const result = await request('me');
      AGDUnifiedAuth.setSession(mapUser(result.user));
      window.dispatchEvent(new CustomEvent('agd:authenticated', { detail: result.user }));
    } catch {
      clearToken();
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#openRealLoginBtn')) {
      openModal('login');
      return;
    }
    const switchButton = event.target.closest('[data-switch-auth]');
    if (switchButton) {
      openModal(switchButton.dataset.switchAuth);
      return;
    }
    const close = event.target.closest('[data-real-auth-close]');
    if (close && (event.target === close || close.tagName === 'BUTTON')) {
      document.getElementById('modalRoot').innerHTML = '';
      return;
    }
    if (event.target.closest('#topbarSwitchRoleBtn')) clearToken();
  }, true);

  document.addEventListener('submit', event => {
    if (event.target.id !== 'realAuthForm') return;
    event.preventDefault();
    submit(event.target);
  });

  function addEntryButton() {
    if (document.getElementById('openRealLoginBtn')) return;
    const actions = document.querySelector('.top-actions');
    if (!actions) return;
    const button = document.createElement('button');
    button.id = 'openRealLoginBtn';
    button.className = 'btn real-login-button';
    button.textContent = getToken() ? 'Conta real ativa' : 'Entrar com conta real';
    actions.prepend(button);
  }

  function init() {
    addEntryButton();
    restore();
  }

  globalThis.AGDRealAuth = { getToken, clearToken, openModal, request };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
