/* Arithmetic shared by the per-policy funding controls and the final report. */
let fiscalEvents=[],fiscalPending={};
function fiscalSpec(s){return s.fiscal_control||(s.kind==='spending_cut'?{base:s.annual_reference/1e6,min:s.annual_reference/1e6*.8,max:s.annual_reference/1e6*1.2,step:1,unit:'M€ / año',label:'Dotación anual',note:'Euros de referencia, indexados por el deflactor.'}:{base:100,min:80,max:120,step:.1,unit:'índice',label:'Índice de cuotas',note:'No existe un tipo porcentual único para este impuesto.'});}
function fiscalLevels(t){let out={};for(const e of fiscalEvents)if(e.turn<=t)out={...out,...e.levels};return out;}
function fiscalValue(s,levels){return levels[s.id]??fiscalSpec(s).base;}
function fiscalAmount(s,levels,t){const spec=fiscalSpec(s),change=fiscalValue(s,levels)-spec.base;if(s.kind==='spending_cut')return -change*1e6/4*moneyIndex(t);return change*s.annual_reference/spec.base*s.response/4*moneyIndex(t);}
// Los cambios pertenecen a cada medida: sumamos sus aportaciones a cualquier
// ajuste histórico que pueda existir en partidas antiguas guardadas.
function protectedTaxLoss(s,t,acts){return acts.reduce((sum,a)=>{const m=D.measures[a.index];return sum+(t>=a.start&&t<H.actionEnd(m,a)?(m.fiscal_links||[]).filter(f=>f.source_id===s.id&&f.protected_scope).reduce((n,f)=>n+Math.round(f.quarterly_loss*H.fiscalScale(m,a,f)*moneyIndex(a.start)),0):0);},0);}
function fiscalScope(s,t,acts=[...active,...planned.values()]){return s.kind==='tax_increase'?H.fundingScopeFraction(D,s.id,t,acts):1;}
function fiscalUsed(s,t,acts){return fiscalAmount(s,fiscalLevels(t),t)*fiscalScope(s,t,acts)+acts.reduce((n,a)=>n+amountFor(a,s,t,acts),0);}
function fiscalCost(t,acts){return acts.reduce((n,a)=>{if(t<a.start)return n;const m=D.measures[a.index],c=costs(m,a.intensity,a.start,a);return n+(t>=H.actionEnd(m,a)?c.maintenance:(c.grossQuarter??(c.quarter-c.fiscalQuarter))+c.fiscalQuarter-(m.fiscal_links||[]).filter(f=>f.source_id).reduce((sum,f)=>sum+Math.round(f.quarterly_loss*H.fiscalScale(m,a,f)*moneyIndex(a.start)),0)+(t===a.start?(c.grossInitial??c.initial):0));},0);}
function fiscalUnmapped(t,acts){return acts.reduce((sum,a)=>{const m=D.measures[a.index];return sum+(t>=a.start&&t<H.actionEnd(m,a)?H.taxReceipts(m,a,moneyIndex(a.start)).filter(r=>!r.source_id).reduce((n,r)=>n+r.quarterly_amount,0):0);},0);}
function fiscalBalance(levels,t,acts){return fiscalUnmapped(t,acts)+ D.funding_sources.reduce((n,s)=>n+fiscalAmount(s,levels,t)*fiscalScope(s,t,acts)+acts.reduce((sum,a)=>sum+amountFor(a,s,t,acts),0),0)-fiscalCost(t,acts);}
function fiscalCheck(levels,acts){for(let t=turn+1;t<=years*4;t++)if(fiscalBalance(levels,t,acts)<-.02)return `Faltan ${money(-fiscalBalance(levels,t,acts))} en ${quarterLabel(t-1)}. Compensa las rebajas y ampliaciones de gasto antes de avanzar.`;return '';}
