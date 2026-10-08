/* Auto Gestão de Direção — protótipo demonstrativo local. Sem integração oficial. */
(() => {
  const KEY = 'agd-prototype-v01';
  const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((n||0)/100);
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = dateKey(new Date());
  const plus = (days, hour='09:00') => {const d=new Date();d.setDate(d.getDate()+days);return `${dateKey(d)}T${hour}`};
  const id = () => Math.random().toString(36).slice(2,10);
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initial = () => ({activeOrg:'org-auto',orgs:[{id:'org-auto',name:'Cássio · Instrutor',type:'INSTRUTOR_AUTONOMO'},{id:'org-cfc',name:'Direção Certa · CFC',type:'AUTOESCOLA'}],students:[
    {id:'s1',org:'org-auto',name:'Marina Oliveira',phone:'(31) 99900-1234',category:'B',status:'Ativo'},
    {id:'s2',org:'org-auto',name:'Pedro Henrique',phone:'(31) 99800-5678',category:'A/B',status:'Ativo'},
    {id:'s3',org:'org-auto',name:'Ana Clara Souza',phone:'(31) 99700-8765',category:'B',status:'Ativo'},
    {id:'s4',org:'org-cfc',name:'Lucas Martins',phone:'(31) 99600-2233',category:'B',status:'Ativo'}],
    instructors:[{id:'i1',org:'org-auto',name:'Cássio Diniz',category:'A/B'},{id:'i2',org:'org-cfc',name:'Rafael Costa',category:'A/B'}],
    vehicles:[{id:'v1',org:'org-auto',plate:'RTA-4D29',model:'Hyundai HB20',category:'B',status:'Disponível'},{id:'v2',org:'org-auto',plate:'QPK-8A61',model:'Honda CG 160',category:'A',status:'Disponível'},{id:'v3',org:'org-cfc',plate:'HJK-7B12',model:'Chevrolet Onix',category:'B',status:'Disponível'}],
    lessons:[
      {id:'l1',org:'org-auto',student:'s1',instructor:'i1',vehicle:'v1',start:plus(0,'09:00'),end:plus(0,'10:00'),status:'AGENDADA',topic:'Controle do veículo'},
      {id:'l2',org:'org-auto',student:'s2',instructor:'i1',vehicle:'v2',start:plus(0,'11:00'),end:plus(0,'12:00'),status:'AGENDADA',topic:'Percurso urbano'},
      {id:'l3',org:'org-auto',student:'s3',instructor:'i1',vehicle:'v1',start:plus(0,'14:00'),end:plus(0,'15:00'),status:'AGENDADA',topic:'Estacionamento'},
      {id:'l4',org:'org-cfc',student:'s4',instructor:'i2',vehicle:'v3',start:plus(0,'10:00'),end:plus(0,'11:00'),status:'AGENDADA',topic:'Aula prática'}],
    packages:[{id:'p1',org:'org-auto',student:'s1',name:'Pacote 5 aulas',quantity:5,balance:3,value:30000,status:'Ativo'}],
    receivables:[{id:'r1',org:'org-auto',student:'s1',package:'p1',description:'Pacote 5 aulas',value:30000,due:today,status:'ABERTA',source:'PACOTE'}],
    payments:[],expenses:[{id:'e1',org:'org-auto',description:'Combustível',value:6500,due:today,status:'PAGA'}],
    selectedDay:today,month:new Date().getMonth(),year:new Date().getFullYear(),banner:true
  });
  let db; try{db=JSON.parse(localStorage.getItem(KEY))||initial()}catch{db=initial()}
  // Migrate ephemeral drafts safely when the demo schema gains fields.
  db.orgs ||= initial().orgs; db.students ||= [];db.instructors ||= [];db.vehicles ||= [];db.lessons ||= [];db.packages ||= [];db.receivables ||= [];db.payments ||= [];db.expenses ||= [];
  let view='inicio',query='',filter='TODAS';
  const org=()=>db.orgs.find(o=>o.id===db.activeOrg)||db.orgs[0];
  const own=key=>AGD.byOrganization(db[key],db.activeOrg);
  const studentName=id=>db.students.find(x=>x.id===id)?.name||'Aluno removido';
  const instructorName=id=>db.instructors.find(x=>x.id===id)?.name||'Instrutor';
  const vehicleName=id=>{const v=db.vehicles.find(x=>x.id===id);return v?v.model+' · '+v.plate:'Veículo';};
  const dateFmt=(str,opt={day:'2-digit',month:'short'})=>{const d=/^\d{4}-\d{2}-\d{2}$/.test(str)?new Date(Number(str.slice(0,4)),Number(str.slice(5,7))-1,Number(str.slice(8,10))):new Date(str);return new Intl.DateTimeFormat('pt-BR',opt).format(d)};
  const timeFmt=str=>new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(str));
  const persist=()=>localStorage.setItem(KEY,JSON.stringify(db));
  const statusBadge=s=>`<span class="badge ${s==='AGENDADA'?'scheduled':s==='FINALIZADA_LOCALMENTE'?'done':s==='CANCELADA'?'cancel':'open'}">${s==='FINALIZADA_LOCALMENTE'?'Concluída localmente':s==='AGENDADA'?'Agendada':s==='CANCELADA'?'Cancelada':esc(s)}</span>`;
  const pageHead=(eyebrow,title,subtitle,actions='')=>`<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="head-actions">${actions}</div></div>`;
  const btn=(text,action,cls='btn')=>`<button class="${cls}" data-action="${action}">${text}</button>`;
  const actionBtn=(text,action,cls='small-action',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
  const activeLessons=()=>own('lessons').filter(x=>x.status==='AGENDADA');
  const openBalance=r=>AGD.balance(r,db.payments);
  function render(){persist();document.querySelector('#orgSelect').innerHTML=db.orgs.map(o=>`<option value="${o.id}" ${o.id===db.activeOrg?'selected':''}>${esc(o.name)}</option>`).join('');document.querySelector('#navTodayCount').textContent=own('lessons').filter(x=>x.start.slice(0,10)===today&&x.status==='AGENDADA').length;
    document.querySelector('#crumb').textContent=({inicio:'Visão geral',agenda:'Agenda',alunos:'Alunos',veiculos:'Veículos',financeiro:'Financeiro',relatorios:'Relatórios'})[view]||(view||'Visão geral');
    const banner=document.querySelector('.prototype-banner');banner.hidden=!db.banner;
    document.querySelector('#appContent').innerHTML=({inicio:renderHome,agenda:renderAgenda,alunos:renderStudents,veiculos:renderVehicles,financeiro:renderFinance,relatorios:renderReports})[view]?.() ?? renderHome();
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
  }
  function lessonRows(list,withActions=false){if(!list.length)return '<div class="empty">Nenhuma aula encontrada para este período.</div>';return `<div class="schedule-list">${list.map(l=>`<div class="lesson-row"><div class="lesson-time">${timeFmt(l.start)}<small>${timeFmt(l.end)}</small></div><div><div class="lesson-name">${esc(studentName(l.student))}</div><div class="lesson-meta">${esc(l.topic||'Aula prática')} · ${esc(vehicleName(l.vehicle))}</div></div><div>${l.status==='AGENDADA'&&withActions?actionBtn('Finalizar','finish:'+l.id,'small-action'):statusBadge(l.status)}</div></div>`).join('')}</div>`}
  function renderHome(){const lessons=own('lessons'),todayList=lessons.filter(l=>l.start.slice(0,10)===today).sort((a,b)=>a.start.localeCompare(b.start)),receivables=own('receivables'),open=receivables.reduce((a,r)=>a+openBalance(r),0),received=db.payments.filter(p=>p.org===db.activeOrg&&!p.void).reduce((a,p)=>a+p.value,0),monthLessons=lessons.filter(l=>l.start.slice(0,7)===today.slice(0,7)),done=monthLessons.filter(l=>l.status==='FINALIZADA_LOCALMENTE').length;
    return `${pageHead(dateFmt(today,{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).toLocaleUpperCase('pt-BR'),'Olá, Cássio 👋','Aqui está o resumo da sua operação.',btn('+ Agendar aula','new-lesson','btn primary'))}
      <div class="grid stats-grid"><div class="card stat-card"><div class="stat-top">Aulas hoje <span class="stat-icon">▦</span></div><div class="stat-value">${todayList.length.toString().padStart(2,'0')}</div><div class="stat-foot"><span class="positive">${todayList.filter(x=>x.status==='AGENDADA').length} agendadas</span> para hoje</div></div>
      <div class="card stat-card"><div class="stat-top">Alunos ativos <span class="stat-icon">◎</span></div><div class="stat-value">${own('students').length.toString().padStart(2,'0')}</div><div class="stat-foot">na organização</div></div>
      <div class="card stat-card"><div class="stat-top">A receber <span class="stat-icon">◉</span></div><div class="stat-value">${money(open)}</div><div class="stat-foot">${receivables.filter(r=>openBalance(r)>0).length} contas em aberto</div></div>
      <div class="card stat-card"><div class="stat-top">Aulas concluídas no mês <span class="stat-icon">✓</span></div><div class="stat-value">${done.toString().padStart(2,'0')}</div><div class="stat-foot">registro interno · não oficial</div></div></div>
      <div class="grid overview-grid"><div class="card"><div class="card-head"><div><h2>Agenda de hoje</h2><p>${dateFmt(today,{weekday:'long',day:'numeric',month:'long'})}</p></div><button class="text-action" data-view="agenda">Ver agenda completa →</button></div>${lessonRows(todayList,true)}</div>
      <div class="right-stack"><div class="card finance-card"><div class="card-head"><div><h2>Resumo financeiro</h2><p>Visão gerencial · este mês</p></div><button class="text-action" data-view="financeiro">Detalhes →</button></div><div class="finance-total">${money(received)}</div><div class="finance-sub">recebido registrado</div><div class="progress"><span style="width:${Math.min(received/(received+open||1)*100,100)}%"></span></div><div class="split-line"><span>Recebido <b>${money(received)}</b></span><span>Em aberto <b>${money(open)}</b></span></div></div>
      <div class="card"><div class="card-head"><div><h2>Próximos passos</h2><p>Mantenha sua operação em dia</p></div></div><div class="mini-list"><div class="mini-row"><span>Alunos cadastrados<small>Cadastre os próximos alunos</small></span>${actionBtn('+','new-student','btn soft')}</div><div class="mini-row"><span>Veículos disponíveis<small>Vincule veículo às aulas</small></span>${actionBtn('+','new-vehicle','btn soft')}</div></div></div></div></div>`;
  }
  function renderAgenda(){const monthDate=new Date(db.year,db.month,1),label=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(monthDate);let first=(monthDate.getDay()+6)%7,days=new Date(db.year,db.month+1,0).getDate(),prevDays=new Date(db.year,db.month,0).getDate(),cells=[];for(let i=0;i<42;i++){let num,dt,muted=false;if(i<first){num=prevDays-first+i+1;dt=new Date(db.year,db.month-1,num);muted=true}else if(i>=first+days){num=i-first-days+1;dt=new Date(db.year,db.month+1,num);muted=true}else{num=i-first+1;dt=new Date(db.year,db.month,num)}const k=dateKey(dt),count=own('lessons').filter(l=>l.start.slice(0,10)===k&&l.status!=='CANCELADA').length;cells.push(`<button class="day ${muted?'muted':''} ${k===today?'today':''} ${k===db.selectedDay?'selected':''}" data-action="select-day:${k}">${num}${count?`<span class="day-count">${count} aula${count>1?'s':''}</span>`:''}</button>`)}const onDay=own('lessons').filter(l=>l.start.slice(0,10)===db.selectedDay).sort((a,b)=>a.start.localeCompare(b.start));return `${pageHead('PLANEJAMENTO','Agenda de aulas','Organize horários e evite conflitos.',btn('+ Agendar aula','new-lesson','btn primary'))}<div class="grid two-col"><div class="card calendar-card"><div class="card-head"><div class="calendar-toolbar"><button class="icon-btn" data-action="month-prev">‹</button><b>${esc(label)}</b><button class="icon-btn" data-action="month-next">›</button></div><button class="text-action" data-action="month-today">Ir para hoje</button></div><div class="calendar">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(w=>`<div class="weekday">${w}</div>`).join('')}${cells.join('')}</div></div><div class="card side-agenda"><h3>${dateFmt(db.selectedDay,{weekday:'long',day:'numeric',month:'long'})}</h3><p>${onDay.length} aula(s) · status local</p>${onDay.length?onDay.map(l=>`<div class="side-lesson"><b>${timeFmt(l.start)}–${timeFmt(l.end)} · ${esc(studentName(l.student))}</b><small>${esc(l.topic||'Aula prática')} · ${esc(vehicleName(l.vehicle))}</small><div style="margin-top:7px">${l.status==='AGENDADA'?actionBtn('Finalizar localmente','finish:'+l.id):statusBadge(l.status)}</div></div>`).join(''):'<div class="empty">Sem aulas neste dia.</div>'}</div></div>`}
  function renderStudents(){const rows=own('students').filter(s=>s.name.toLowerCase().includes(query.toLowerCase())||s.category.toLowerCase().includes(query.toLowerCase()));return `${pageHead('CADASTROS','Alunos','Cadastro mínimo para organizar aulas.',btn('+ Novo aluno','new-student','btn primary'))}<div class="toolbar"><div class="search"><input id="searchInput" value="${esc(query)}" placeholder="⌕  Buscar aluno..."></div><span class="hint">${rows.length} aluno(s)</span></div><div class="card table-wrap"><table class="data-table"><thead><tr><th>Aluno</th><th>Telefone</th><th>Categoria</th><th>Status</th><th></th></tr></thead><tbody>${rows.length?rows.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.phone||'—')}</td><td>${esc(s.category)}</td><td><span class="badge done">${esc(s.status)}</span></td><td><div class="table-actions">${actionBtn('Agendar aula','new-lesson-for:'+s.id)}</div></td></tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhum aluno encontrado.</td></tr>`}</tbody></table></div>`}
  function renderVehicles(){const rows=own('vehicles');return `${pageHead('CADASTROS','Veículos','Controle interno de disponibilidade e categoria.',btn('+ Novo veículo','new-vehicle','btn primary'))}<div class="toolbar"><span class="hint">${rows.length} veículo(s) · validade informada não substitui consulta oficial</span></div><div class="card table-wrap"><table class="data-table"><thead><tr><th>Veículo</th><th>Placa</th><th>Categoria</th><th>Status</th><th>Uso na agenda</th></tr></thead><tbody>${rows.length?rows.map(v=>`<tr><td>${esc(v.model)}</td><td>${esc(v.plate)}</td><td>${esc(v.category)}</td><td><span class="badge done">${esc(v.status)}</span></td><td>${own('lessons').filter(l=>l.vehicle===v.id&&l.status==='AGENDADA').length} aula(s) agendada(s)</td></tr>`).join(''):`<tr><td colspan="5" class="empty">Cadastre o primeiro veículo desta organização.</td></tr>`}</tbody></table></div>`}
  function renderFinance(){const recv=own('receivables'),open=recv.reduce((a,r)=>a+openBalance(r),0),paid=db.payments.filter(p=>p.org===db.activeOrg&&!p.void).reduce((a,p)=>a+p.value,0),exp=own('expenses').reduce((a,e)=>a+e.value,0);return `${pageHead('GESTÃO FINANCEIRA','Financeiro','Contas, pacotes e recebimentos registrados manualmente.',btn('+ Registrar despesa','new-expense','btn')+btn('+ Novo pacote','new-package','btn primary'))}<div class="grid finance-overview"><div class="card finance-kpi"><small>Recebido</small><b>${money(paid)}</b></div><div class="card finance-kpi"><small>Em aberto</small><b>${money(open)}</b></div><div class="card finance-kpi"><small>Despesas registradas</small><b>${money(exp)}</b></div></div><div class="grid two-col section-spacer"><div class="card"><div class="card-head"><div><h2>Contas a receber</h2><p>Pagamentos parciais preservam o saldo e o histórico</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Descrição</th><th>Aluno</th><th>Valor</th><th>Saldo</th><th>Status</th><th></th></tr></thead><tbody>${recv.length?recv.map(r=>`<tr><td>${esc(r.description)}</td><td>${esc(studentName(r.student))}</td><td>${money(r.value)}</td><td>${money(openBalance(r))}</td><td><span class="badge ${openBalance(r)?'open':'done'}">${openBalance(r)?'Em aberto':'Quitada'}</span></td><td>${openBalance(r)?actionBtn('Receber','payment:'+r.id):''}</td></tr>`).join(''):`<tr><td colspan="6" class="empty">Nenhuma conta a receber.</td></tr>`}</tbody></table></div></div><div class="card"><div class="card-head"><div><h2>Pacotes ativos</h2><p>Consumo reduz saldo, sem nova cobrança</p></div></div><div class="mini-list">${own('packages').length?own('packages').map(p=>`<div class="mini-row"><span>${esc(p.name)} · ${esc(studentName(p.student))}<small>${p.balance} de ${p.quantity} aulas restantes · valor ${money(p.value)}</small></span><b class="amount">${actionBtn('Consumir aula','consume:'+p.id)}</b></div>`).join(''):'<div class="empty">Sem pacotes ativos.</div>'}</div></div></div><div class="card section-spacer"><div class="card-head"><div><h2>Pagamentos registrados</h2><p>Controle demonstrativo · sem cobrança PIX</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Aluno</th><th>Conta</th><th>Meio</th><th>Valor</th></tr></thead><tbody>${db.payments.filter(p=>p.org===db.activeOrg&&!p.void).length?db.payments.filter(p=>p.org===db.activeOrg&&!p.void).map(p=>{let r=recv.find(x=>x.id===p.receivable);return `<tr><td>${dateFmt(p.date)}</td><td>${esc(studentName(r?.student))}</td><td>${esc(r?.description||'—')}</td><td>${esc(p.method)}</td><td>${money(p.value)}</td></tr>`}).join(''):'<tr><td colspan="5" class="empty">Nenhum pagamento lançado.</td></tr>'}</tbody></table></div></div>`}
  function renderReports(){const ls=own('lessons'),months=[];for(let i=5;i>=0;i--){let d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,arr=ls.filter(l=>l.start.startsWith(k)),done=arr.filter(l=>l.status==='FINALIZADA_LOCALMENTE').length;months.push({label:new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(d).replace('.',''),total:arr.length,done})}const max=Math.max(1,...months.map(m=>m.total));return `${pageHead('ACOMPANHAMENTO','Relatórios','Indicadores gerenciais dos dados locais.',btn('Exportar CSV','export-csv','btn'))}<div class="grid report-grid"><div class="card"><div class="card-head"><div><h2>Aulas nos últimos 6 meses</h2><p>Agendadas e concluídas localmente</p></div><div class="legend"><span><i></i>Total</span></div></div><div class="bar-chart">${months.map(m=>`<div class="bar-group"><div class="bar-value">${m.total}</div><div class="bar ${m.label===months.at(-1).label?'current':''}" style="height:${Math.max(4,m.total/max*90)}%" title="${m.total} aulas; ${m.done} concluídas"></div><div class="bar-label">${esc(m.label)}</div></div>`).join('')}</div></div><div class="card"><div class="card-head"><div><h2>Resumo da organização</h2><p>${esc(org().name)}</p></div></div><div class="mini-list">${[['Alunos',own('students').length],['Veículos',own('vehicles').length],['Aulas concluídas',ls.filter(l=>l.status==='FINALIZADA_LOCALMENTE').length],['Aulas canceladas',ls.filter(l=>l.status==='CANCELADA').length],['A receber',money(own('receivables').reduce((a,r)=>a+openBalance(r),0))]].map(([a,b])=>`<div class="mini-row"><span>${a}</span><b class="amount">${b}</b></div>`).join('')}</div></div></div><p class="hint section-spacer">Os indicadores não representam escrituração contábil, documento fiscal nem confirmação oficial de aula.</p>`}
  function modal(title,body,submit='Salvar'){document.querySelector('#modalRoot').innerHTML=`<div class="modal-backdrop" data-action="close-modal"><form class="modal" id="activeForm"><div class="modal-head"><h2>${title}</h2><button type="button" data-action="close-modal" aria-label="Fechar">×</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">${submit}</button></div></form></div>`;document.querySelector('#activeForm').addEventListener('submit',submitModal);}
  const field=(label,name,type='text',value='',attrs='')=>`<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}" ${attrs} required></div>`;
  const selectField=(label,name,options)=>`<div class="field"><label>${label}</label><select name="${name}" required>${options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>`;
  function openForm(kind,forStudent){let body='',title='';
    if(kind==='new-student'){title='Cadastrar aluno';body=`<div class="form-grid">${field('Nome completo','name')}${field('Telefone (opcional)','phone','tel','','')}${selectField('Categoria','category',['A','B','A/B'].map(x=>({value:x,label:x})))}</div><p class="hint">Informe apenas dados mínimos. Use dados fictícios nesta demonstração.</p>`}
    if(kind==='new-vehicle'){title='Cadastrar veículo';body=`<div class="form-grid">${field('Modelo','model')}${field('Placa','plate')}${selectField('Categoria','category',['A','B'].map(x=>({value:x,label:x})))}</div><p class="hint">Disponibilidade e documentos são controles internos, não uma validação oficial.</p>`}
    if(kind==='new-lesson'){title='Agendar aula';const students=own('students'),instructors=own('instructors'),vehicles=own('vehicles');body=`<div class="form-grid">${selectField('Aluno','student',students.map(s=>({value:s.id,label:s.name}))) }${selectField('Instrutor','instructor',instructors.map(s=>({value:s.id,label:s.name}))) }${selectField('Veículo','vehicle',vehicles.map(s=>({value:s.id,label:s.model+' · '+s.plate}))) }${field('Data e hora','start','datetime-local',plus(1,'09:00'))}${field('Duração (minutos)','duration','number','60','min="15" step="15"')}${field('Tema da aula','topic')}</div><p class="hint">O sistema verifica conflito de aluno, instrutor e veículo. Horários são interpretados no fuso local do dispositivo.</p>`;if(forStudent){setTimeout(()=>{let s=document.querySelector('[name=student]');if(s)s.value=forStudent},0)}}
    if(kind==='new-package'){title='Criar pacote de aulas';body=`<div class="form-grid">${selectField('Aluno','student',own('students').map(s=>({value:s.id,label:s.name})))}${field('Nome do pacote','name','text','Pacote de aulas')}${field('Quantidade de aulas','quantity','number','5','min="1"')}${field('Valor total (R$)','value','number','','min="0.01" step="0.01"')}${field('Vencimento','due','date',today)}</div><p class="hint">Será criada uma única conta a receber pelo valor do pacote.</p>`}
    if(kind.startsWith('payment:')){const r=own('receivables').find(x=>x.id===kind.split(':')[1]);if(!r)return;title='Registrar recebimento';body=`<p class="hint">${esc(r.description)} · saldo em aberto <b>${money(openBalance(r))}</b></p><div class="form-grid">${field('Valor recebido (R$)','value','number',(openBalance(r)/100).toFixed(2),`min="0.01" max="${(openBalance(r)/100).toFixed(2)}" step="0.01"`)}${selectField('Meio','method',['PIX','Dinheiro','Cartão','Transferência','Outro'].map(x=>({value:x,label:x})))}</div>`}
    if(kind==='new-expense'){title='Registrar despesa';body=`<div class="form-grid">${field('Descrição','description')}${field('Valor (R$)','value','number','','min="0.01" step="0.01"')}${field('Vencimento','due','date',today)}${selectField('Status','status',[{value:'PAGA',label:'Paga'},{value:'ABERTA',label:'Em aberto'}])}</div>`}
    modal(title,body);
  }
  function submitModal(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const type=e.currentTarget.dataset.type||null;const modalTitle=document.querySelector('.modal-head h2').textContent;const cents=v=>Math.round(Number(v)*100);const close=()=>document.querySelector('#modalRoot').innerHTML='';
    if(modalTitle==='Cadastrar aluno'){db.students.push({id:id(),org:db.activeOrg,name:f.name.trim(),phone:f.phone.trim(),category:f.category,status:'Ativo'});toast('Aluno cadastrado.');}
    else if(modalTitle==='Cadastrar veículo'){db.vehicles.push({id:id(),org:db.activeOrg,model:f.model.trim(),plate:f.plate.trim().toUpperCase(),category:f.category,status:'Disponível'});toast('Veículo cadastrado.');}
    else if(modalTitle==='Agendar aula'){const start=new Date(f.start),end=new Date(start.getTime()+Number(f.duration)*60000),candidate={org:db.activeOrg,student:f.student,instructor:f.instructor,vehicle:f.vehicle,start:start.toISOString(),end:end.toISOString(),status:'AGENDADA'},overlap=AGD.hasConflict(db.lessons,candidate)?own('lessons').find(l=>l.status==='AGENDADA'&&new Date(l.start)<end&&new Date(l.end)>start&&(l.student===f.student||l.instructor===f.instructor||l.vehicle===f.vehicle)):null;if(overlap){toast(`Conflito com aula de ${studentName(overlap.student)} (${timeFmt(overlap.start)}).`,true);return}db.lessons.push({...candidate,id:id(),topic:f.topic.trim()});toast('Aula agendada.');}
    else if(modalTitle==='Criar pacote de aulas'){const p={id:id(),org:db.activeOrg,student:f.student,name:f.name.trim(),quantity:Number(f.quantity),balance:Number(f.quantity),value:cents(f.value),status:'Ativo'};db.packages.push(p);db.receivables.push({id:id(),org:db.activeOrg,student:p.student,package:p.id,description:p.name,value:p.value,due:f.due,status:'ABERTA',source:'PACOTE'});toast('Pacote criado e uma conta a receber lançada.');}
    else if(modalTitle==='Registrar recebimento'){const target=window.pendingReceivable;if(!target)return;const rec=own('receivables').find(x=>x.id===target);try{AGD.recordPayment(rec,db.payments,{id:id(),org:db.activeOrg,value:cents(f.value),date:new Date().toISOString(),method:f.method});toast('Recebimento registrado.');window.pendingReceivable=null;}catch(err){toast(err.message,true);return}}
    else if(modalTitle==='Registrar despesa'){db.expenses.push({id:id(),org:db.activeOrg,description:f.description.trim(),value:cents(f.value),due:f.due,status:f.status});toast('Despesa registrada.');}
    close();render();
  }
  function toast(text,error=false){const t=document.createElement('div');t.className='toast'+(error?' error':'');t.textContent=text;document.querySelector('#toastRoot').append(t);setTimeout(()=>t.remove(),3500)}
  function finishLesson(idv){const l=own('lessons').find(x=>x.id===idv);if(!l||l.status!=='AGENDADA')return;l.status='FINALIZADA_LOCALMENTE';l.finishedAt=new Date().toISOString();toast('Aula finalizada localmente. Nenhum registro oficial foi enviado.');render()}
  function consume(idv){const p=own('packages').find(x=>x.id===idv);if(!p){toast('Pacote não encontrado nesta organização.',true);return}try{AGD.consumePackage(p);toast(`Consumo registrado. Saldo: ${p.balance} aula(s). Sem nova cobrança.`);render()}catch(err){toast(err.message,true)}}
  function exportCSV(){const rows=[['Data','Aluno','Instrutor','Veículo','Status local','Tema'],...own('lessons').map(l=>[l.start,studentName(l.student),instructorName(l.instructor),vehicleName(l.vehicle),l.status,l.topic||''])];const csv=rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='auto-gestao-aulas.csv';a.click();URL.revokeObjectURL(a.href);toast('CSV exportado.');}
  document.addEventListener('click',e=>{const viewEl=e.target.closest('[data-view]');if(viewEl){view=viewEl.dataset.view;query='';render();document.querySelector('#sidebar').classList.remove('open');return}const a=e.target.closest('[data-action]');if(!a)return;const act=a.dataset.action;if(act==='close-modal'){if(e.target===a||a.tagName==='BUTTON')document.querySelector('#modalRoot').innerHTML='';return}if(act.startsWith('new-lesson-for:')){openForm('new-lesson',act.split(':')[1]);return}if(act==='new-lesson'||act==='new-student'||act==='new-vehicle'||act==='new-package'||act==='new-expense'){openForm(act);return}if(act.startsWith('finish:'))return finishLesson(act.split(':')[1]);if(act.startsWith('consume:'))return consume(act.split(':')[1]);if(act.startsWith('payment:')){window.pendingReceivable=act.split(':')[1];openForm(act);return}if(act.startsWith('select-day:')){db.selectedDay=act.split(':')[1];persist();render();return}if(act==='month-prev'){db.month--;if(db.month<0){db.month=11;db.year--}render();return}if(act==='month-next'){db.month++;if(db.month>11){db.month=0;db.year++}render();return}if(act==='month-today'){db.month=new Date().getMonth();db.year=new Date().getFullYear();db.selectedDay=today;render();return}if(act==='export-csv')return exportCSV()});
  document.querySelector('#orgSelect').addEventListener('change',e=>{db.activeOrg=e.target.value;query='';render()});
  document.querySelector('#appContent').addEventListener('input',e=>{if(e.target.id==='searchInput'){query=e.target.value;let pos=e.target.selectionStart;render();let n=document.querySelector('#searchInput');n.focus();n.setSelectionRange(pos,pos)}});
  document.querySelector('#dismissBanner').addEventListener('click',()=>{db.banner=false;render()});
  // ── CONTROLE DO MENU LATERAL (RECOLHER / EXPANDIR / RESPONSIVIDADE) ──
  const isMobile = () => window.innerWidth <= 900;
  const sidebarEl = document.querySelector('#sidebar');
  const backdropEl = document.querySelector('#sidebarBackdrop');
  const menuToggleEl = document.querySelector('#menuToggle');

  if (!isMobile() && localStorage.getItem('agd-sidebar-collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
    if (sidebarEl) sidebarEl.classList.add('collapsed');
  }

  function toggleSidebar() {
    if (isMobile()) {
      const isOpen = sidebarEl.classList.toggle('open');
      if (backdropEl) backdropEl.classList.toggle('active', isOpen);
    } else {
      const isCollapsed = sidebarEl.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
      localStorage.setItem('agd-sidebar-collapsed', isCollapsed ? 'true' : 'false');
      window.dispatchEvent(new Event('resize'));
    }
  }

  function closeMobileSidebar() {
    if (sidebarEl && sidebarEl.classList.contains('open')) {
      sidebarEl.classList.remove('open');
      if (backdropEl) backdropEl.classList.remove('active');
    }
  }

  if (menuToggleEl) menuToggleEl.addEventListener('click', toggleSidebar);
  if (backdropEl) backdropEl.addEventListener('click', closeMobileSidebar);

  document.addEventListener('click', e => {
    const collapseBtn = e.target.closest('.sidebar-collapse-btn');
    if (collapseBtn) { toggleSidebar(); return; }
    if (isMobile()) {
      const navTarget = e.target.closest('#sidebar button, #sidebar a');
      if (navTarget && !navTarget.classList.contains('sidebar-collapse-btn')) {
        closeMobileSidebar();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      if (backdropEl) backdropEl.classList.remove('active');
      if (sidebarEl) sidebarEl.classList.remove('open');
      if (localStorage.getItem('agd-sidebar-collapsed') === 'true') {
        document.body.classList.add('sidebar-collapsed');
        if (sidebarEl) sidebarEl.classList.add('collapsed');
      }
    }
  });
  document.querySelector('#todayBtn').addEventListener('click',()=>{view='agenda';db.selectedDay=today;db.month=new Date().getMonth();db.year=new Date().getFullYear();render()});
  window.AGDApp = {
    render,
    setView: (v) => { view = v; render(); },
    getDb: () => db,
    showInstructor: () => {
      view = 'inicio';
      const instSidebar = document.getElementById('instructorSidebar');
      const stdSidebar = document.getElementById('studentSidebar');
      const adminSidebar = document.getElementById('adminSidebar');
      if (adminSidebar) adminSidebar.hidden = true;
      if (stdSidebar) { stdSidebar.hidden = true; stdSidebar.innerHTML = ''; }
      if (instSidebar) instSidebar.hidden = false;
      const modeLabel = document.getElementById('modeLabel');
      if (modeLabel) modeLabel.textContent = 'Operação';
      const crumb = document.getElementById('crumb');
      if (crumb) crumb.textContent = 'Visão geral';
      render();
    }
  };

  render();
})();
