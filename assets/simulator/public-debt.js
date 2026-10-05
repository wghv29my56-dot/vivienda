/* Public borrowing: each draw has fixed principal repayments and declining interest. */
(function(root){
'use strict';
function at(action,turn,drawAt,terms){
 const rate=terms.annual_rate/4,n=terms.repayment_turns;
 if(!Number.isFinite(rate)||rate<0||!Number.isInteger(n)||n<1||terms.reduction_delay_turns!==1)throw new Error('Condiciones de deuda no válidas.');
 const result={balance:0,draw:0,interest:0,principal:0,reduction:0};
 for(let q=action.start;q<=turn;q++){
  const amount=Math.max(0,drawAt(q));if(!Number.isFinite(amount))throw new Error('Emisión no válida.');
  const elapsed=turn-q,paid=Math.min(n,elapsed);
  result.balance+=amount*(1-paid/n);
  if(!elapsed)result.draw+=amount;
  else if(elapsed<=n){result.principal+=amount/n;result.interest+=amount*(1-(elapsed-1)/n)*rate;}
 }
 result.reduction=result.principal+result.interest;return result;
}
function allocate(amount,sourceIds,sources,weights){
 const selected=[...new Set(sourceIds)].map(id=>sources.find(s=>s.id===id));
 if(!selected.length||selected.some(s=>!s||s.kind!=='spending_cut'||s.debt_service))throw new Error('Selecciona otra partida de gasto para devolver la deuda.');
 if(weights){const total=selected.reduce((n,s)=>n+(weights[s.id]||0),0);if(!Number.isFinite(total)||total<=0||selected.some(s=>!Number.isFinite(weights[s.id])||weights[s.id]<0))throw new Error('Reparto de la cuota no válido.');return Object.fromEntries(selected.map(s=>[s.id,amount*weights[s.id]/total]));}
 const total=selected.reduce((n,s)=>n+s.annual_reference,0);
 return Object.fromEntries(selected.map(s=>[s.id,amount*s.annual_reference/total]));
}
const api={at,allocate};if(typeof module!=='undefined')module.exports=api;else root.SIM_PUBLIC_DEBT=api;
})(typeof window==='undefined'?globalThis:window);
