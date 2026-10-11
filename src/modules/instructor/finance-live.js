(() => {
  const API_URL = '/api/instructor';
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(value) || 0) / 100);
  const date = value => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : '—';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  let loading = false;

  async function request(action, options = {}) {
    const token = globalThis.AGDRealAuth?.getToken();
    if (!token) throw new Error('Entre com uma conta real para acessar os dados financeiros.');
    const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o financeiro');
    return body;
  }

  function statusClass(status) {
    if (status === 'QUITADA' || status === 'PAGA') return 'done';
    if (status === 'VENCIDA') return 'cancel';
    return 'open';
  }

  function renderDashboard(data) {
    const content = document.getElementById('appContent');
    if (!content) return;
    const summary = data.summary || {};
    content.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">GESTÃO FINANCEIRA</div><h1>Financeiro</h1><p>Valores reais da sua organização.</p></div><div class="head-actions"><button class="btn" data-live-action="expense">+ Despesa</button><button class="btn primary" data-live-action="package">+ Pacote</button></div></div>
      <section class="grid finance-overview" aria-label="Resumo financeiro">
        <article class="card finance-kpi"><small>Recebido no mês</small><b>${money(summary.recebido_mes_centavos)}</b></article>
        <article class="card finance-kpi"><small>Em aberto</small><b>${money(summary.aberto_centavos)}</b></article>
        <article class="card finance-kpi finance-alert"><small>Vencido</small><b>${money(summary.vencido_centavos)}</b></article>
        <article class="card finance-kpi"><small>Despesas no mês</small><b>${money(summary.despesas_mes_centavos)}</b></article>
        <article class="card finance-kpi"><small>Saldo gerencial</small><b>${money(summary.saldo_mes_centavos)}</b></article>
      </section>
      <section class="card section-spacer"><div class="card-head"><div><h2>Contas a receber</h2><p>Pagamentos parciais e vencimentos</p></div></div><div class="table-wrap"><table class="data-table" data-mobile-cards="true"><thead><tr><th>Aluno</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Saldo</th><th>Status</th><th>Ação</th></tr></thead><tbody>${data.receivables.length ? data.receivables.map(item => `<tr><td data-label="Aluno">${escapeHtml(item.aluno_nome)}</td><td data-label="Descrição">${escapeHtml(item.descricao)}</td><td data-label="Vencimento">${date(item.vencimento)}</td><td data-label="Valor">${money(item.valor_centavos)}</td><td data-label="Saldo">${money(item.saldo_centavos)}</td><td data-label="Status"><span class="badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td data-label="Ação">${item.saldo_centavos > 0 && item.status !== 'CANCELADA' ? `<button class="small-action" data-live-action="payment" data-id="${escapeHtml(item.id)}" data-balance="${item.saldo_centavos}">Receber</button>` : '—'}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">Nenhuma conta encontrada.</td></tr>'}</tbody></table></div></section>
      <div class="grid two-col section-spacer">
        <section class="card"><div class="card-head"><div><h2>Pacotes</h2><p>Saldo de aulas contratado</p></div></div><div class="mini-list">${data.packages.length ? data.packages.map(item => `<div class="mini-row"><span>${escapeHtml(item.nome)} · ${escapeHtml(item.aluno_nome)}<small>${item.saldo_aulas} de ${item.quantidade} aulas</small></span><b>${money(item.valor_centavos)}</b></div>`).join('') : '<div class="empty">Nenhum pacote.</div>'}</div></section>
        <section class="card"><div class="card-head"><div><h2>Despesas</h2><p>Últimos lançamentos</p></div></div><div class="mini-list">${data.expenses.length ? data.expenses.slice(0, 10).map(item => `<div class="mini-row"><span>${escapeHtml(item.descricao)}<small>${date(item.vencimento)} · ${escapeHtml(item.status)}</small></span><b>${money(item.valor_centavos)}</b></div>`).join('') : '<div class="empty">Nenhuma despesa.</div>'}</div></section>
      </div>
      <p class="hint section-spacer">Controle gerencial interno. Não substitui escrituração contábil ou documento fiscal.</p>`;
  }

  function renderError(message) {
    const content = document.getElementById('appContent');
    if (!content) return;
    content.innerHTML = `<div class="page-head"><div><div class="eyebrow">GESTÃO FINANCEIRA</div><h1>Financeiro</h1></div></div><div class="card finance-state" role="alert"><h2>Não foi possível abrir os dados reais</h2><p>${escapeHtml(message)}</p><button class="btn primary" id="openRealLoginBtn">Entrar com conta real</button></div>`;
  }

  async function load() {
    if (loading) return;
    loading = true;
    const content = document.getElementById('appContent');
    if (content) content.innerHTML = '<div class="card finance-state" role="status">Carregando dados financeiros…</div>';
    try {
      renderDashboard(await request('dashboard'));
    } catch (error) {
      renderError(error.message);
    } finally {
      loading = false;
    }
  }

  function field(label, name, type = 'text', attributes = '') {
    return `<div class="field full"><label for="finance-${name}">${label}</label><input id="finance-${name}" name="${name}" type="${type}" ${attributes} required></div>`;
  }

  function openForm(action, trigger) {
    const root = document.getElementById('modalRoot');
    if (!root) return;
    let title;
    let fields;
    if (action === 'payment') {
      title = 'Registrar recebimento';
      fields = `${field('Valor recebido (R$)', 'valor', 'number', `min="0.01" max="${(Number(trigger.dataset.balance) / 100).toFixed(2)}" step="0.01"`)}<div class="field full"><label for="finance-meio">Meio</label><select id="finance-meio" name="meio"><option>PIX</option><option>DINHEIRO</option><option>CARTAO</option><option>TRANSFERENCIA</option><option>OUTRO</option></select></div><input type="hidden" name="contaReceberId" value="${escapeHtml(trigger.dataset.id)}">`;
    } else if (action === 'expense') {
      title = 'Registrar despesa';
      fields = `${field('Descrição', 'descricao')}${field('Valor (R$)', 'valor', 'number', 'min="0.01" step="0.01"')}${field('Vencimento', 'vencimento', 'date')}<div class="field full"><label for="finance-status">Status</label><select id="finance-status" name="status"><option value="PENDENTE">Pendente</option><option value="PAGA">Paga</option></select></div>`;
    } else {
      title = 'Criar pacote';
      fields = `<div class="field full"><label for="finance-aluno">Aluno</label><select id="finance-aluno" name="alunoId" required></select></div>${field('Nome do pacote', 'nome')}${field('Quantidade de aulas', 'quantidade', 'number', 'min="1" max="500"')}${field('Valor total (R$)', 'valor', 'number', 'min="0.01" step="0.01"')}${field('Vencimento', 'vencimento', 'date')}`;
    }
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="finance-modal-title"><div class="modal-head"><h2 id="finance-modal-title">${title}</h2><button type="button" data-live-close aria-label="Fechar">×</button></div><form id="liveFinanceForm" data-action="${action}"><div class="modal-body"><div class="form-grid">${fields}</div><div id="financeFormStatus" class="form-status" role="status"></div></div><div class="modal-foot"><button type="button" class="btn" data-live-close>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form></div></div>`;
    if (action === 'package') populateStudents();
  }

  async function populateStudents() {
    try {
      const data = await request('dashboard');
      const select = document.getElementById('finance-aluno');
      select.innerHTML = data.students.map(student => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)}</option>`).join('');
    } catch (error) {
      document.getElementById('financeFormStatus').textContent = error.message;
    }
  }

  async function submitForm(form) {
    const values = Object.fromEntries(new FormData(form));
    const action = form.dataset.action;
    const payload = { ...values, valorCentavos: Math.round(Number(values.valor) * 100) };
    delete payload.valor;
    if (payload.quantidade) payload.quantidade = Number(payload.quantidade);
    const endpoint = action === 'payment' ? 'record-payment' : action === 'expense' ? 'create-expense' : 'create-package';
    const status = document.getElementById('financeFormStatus');
    try {
      status.textContent = 'Salvando…';
      await request(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('modalRoot').innerHTML = '';
      await load();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error');
    }
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-view="financeiro"]');
    if (nav) queueMicrotask(load);
    const action = event.target.closest('[data-live-action]');
    if (action) openForm(action.dataset.liveAction, action);
    if (event.target.closest('[data-live-close]')) document.getElementById('modalRoot').innerHTML = '';
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'liveFinanceForm') return;
    event.preventDefault();
    submitForm(event.target);
  });

  window.addEventListener('agd:authenticated', () => {
    if (document.querySelector('[data-view="financeiro"].active')) load();
  });
})();
