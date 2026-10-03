/* Regras puras reutilizadas pelo protótipo e pelos testes Node. */
(() => {
  const overlap=(aStart,aEnd,bStart,bEnd)=>new Date(aStart)<new Date(bEnd)&&new Date(aEnd)>new Date(bStart);
  const hasConflict=(lessons,candidate)=>lessons.some(l=>l.org===candidate.org&&l.status==='AGENDADA'&&overlap(l.start,l.end,candidate.start,candidate.end)&&(l.student===candidate.student||l.instructor===candidate.instructor||l.vehicle===candidate.vehicle));
  const balance=(receivable,payments)=>Math.max(0,receivable.value-payments.filter(p=>p.org===receivable.org&&p.receivable===receivable.id&&!p.void).reduce((sum,p)=>sum+p.value,0));
  const recordPayment=(receivable,payments,payment)=>{
    if(payment.org!==receivable.org)throw new Error('Organização incompatível.');
    if(!Number.isSafeInteger(payment.value)||payment.value<=0||payment.value>balance(receivable,payments))throw new Error('Valor fora do saldo em aberto.');
    payments.push({...payment,receivable:receivable.id});return balance(receivable,payments);
  };
  const consumePackage=p=>{if(!Number.isInteger(p.balance)||p.balance<=0)throw new Error('Pacote sem aulas disponíveis.');p.balance-=1;p.consumptions=(p.consumptions||0)+1;return p.balance;};
  const byOrganization=(records,org)=>records.filter(r=>r.org===org);
  globalThis.AGD={hasConflict,balance,recordPayment,consumePackage,byOrganization};
})();
