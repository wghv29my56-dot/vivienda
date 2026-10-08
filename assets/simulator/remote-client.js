/* Public client: sends controls and renders results; contains no model or simulation engine. */
(function(){
'use strict';
const C=window.SIM_SUPABASE,endpoint=C.url+'/functions/v1/simulator-play',KEY='vivienda.remote.session.v1',PRESENTATION_CACHE='vivienda.remote.presentation.v2';
let session=null,busy=false,lastView=null,pending=null,started=false,presentation=null,selected=null,policyWanted=null,helpKey=null,reportDismissed=-1,chartVisible=null,chartScale='auto',presentationStamp=null,mobileWarningAccepted=false,startAnnouncementPending=false;
try{session=JSON.parse(sessionStorage.getItem(KEY)||'null');const cached=JSON.parse(sessionStorage.getItem(PRESENTATION_CACHE)||'null');if(cached?.stamp&&cached.presentation?.cards?.length){presentation=cached.presentation;presentationStamp=cached.stamp;}}catch{}
const status=document.createElement('div');status.className='remote-status';status.setAttribute('role','status');status.hidden=true;document.body.append(status);
const retry=document.createElement('button');retry.className='quiet';retry.textContent='Reintentar';retry.hidden=true;status.append(retry);
function message(text,failed=false){status.hidden=!text;status.replaceChildren(document.createTextNode(text),retry);retry.hidden=!failed;}
function remember(){try{sessionStorage.setItem(KEY,JSON.stringify(session));}catch{}}
const $=id=>document.getElementById(id);
function announceStarted(){startAnnouncementPending=false;window.scrollTo(0,0);document.dispatchEvent(new Event('simulator:started'));}
function finishStarting(){
 const warning=$('mobile-warning');
 if(matchMedia('(max-width:620px)').matches&&!mobileWarningAccepted&&warning){startAnnouncementPending=true;if(!warning.open)warning.showModal();return;}
 announceStarted();
}
document.addEventListener('click',e=>{
 if(!e.target.closest?.('#accept-mobile-warning'))return;
 e.preventDefault();e.stopImmediatePropagation();
 mobileWarningAccepted=true;const warning=$('mobile-warning');if(warning?.open)warning.close();if(startAnnouncementPending)announceStarted();
},true);
const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});
function localDialogClose(id){const el=$(id);if(el?.open)el.close();if(id==='policy-workspace')policyWanted=false;if(id==='info-dialog')helpKey=null;if(id==='turn-report')reportDismissed=lastView.turn;}
function selectMeasure(index){if(!presentation?.cards[index])return false;selected=index;renderSelection();const card=presentation.cards[index];window.SIM_TRACKING?.open(card.id,null,'catalog');return true;}
function renderSelection(){if(selected===null||!presentation?.cards[selected])return;const detail=$('detail');detail.innerHTML=presentation.cards[selected].html;const state=lastView?.card_states?.[selected];if(state){const button=detail.querySelector('#open-policy');button.disabled=state.disabled;button.textContent=state.label;if(state.cancel){const cancel=document.createElement('button');cancel.id='cancel-active-policy';cancel.className='quiet';cancel.textContent='Cancelar desde el próximo trimestre';detail.append(cancel);}const foot=detail.querySelector('.detail-foot span:last-child'),money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);foot.textContent=money(state.initial)+' iniciales + '+money(state.quarter)+'/trimestre '+presentation.cards[selected].footerSuffix;}detail.querySelectorAll('button').forEach(e=>e.setAttribute('data-remote-key','local'));document.querySelectorAll('[data-measure]').forEach(e=>{const chosen=Number(e.dataset.measure)===selected;e.classList.toggle('current',chosen);e.setAttribute('aria-pressed',chosen);});if(lastView)lastView.context={...lastView.context,selected_index:selected,selected_measure:presentation.cards[selected].id};}
function showHelp(key){const help=presentation?.helps[key];if(!help)return false;if(help.url){const url=new URL(help.url,location.href);if(url.origin===location.origin)window.open(url.href,'_blank','noopener');return true;}helpKey=key;$('info-title').textContent=help.title;$('info-body').textContent=help.body;$('info-sources').innerHTML=help.sources;if(!$('info-dialog').open)$('info-dialog').showModal();return true;}
function control(el){if(el.id)return {id:el.id};for(const attribute of ['data-source','data-budget-pick','data-budget-bar','data-part','data-edit','data-remove','data-amount','data-tax-component','data-tax-carrier','data-policy-enabled','data-cancel','data-save','data-close'])if(el.hasAttribute(attribute))return {attribute,value:el.getAttribute(attribute)};return null;}
function uiState(){return {local:true,selected:selected??lastView.context.selected_index,policyOpen:policyWanted??!!$('policy-workspace').open,reportOpen:!!$('turn-report').open,debtOpen:!!document.querySelector('.debt-dialog[open]')};}
function openEditorShell(){policyWanted=true;const el=$('policy-workspace');el.dataset.loading='true';$('policy-title').textContent=presentation.cards[selected].name;$('policy-help').dataset.info='measure:'+presentation.cards[selected].id;let text=el.querySelector('.local-editor-loading');if(!text){text=document.createElement('p');text.className='local-editor-loading';text.setAttribute('role','status');text.textContent='Calculando la previsualización…';el.querySelector('.workspace-head').after(text);}if(!el.open)el.showModal();}
function patch(view){
 if(view.presentation){presentation=view.presentation;presentationStamp=view.presentation_stamp;try{sessionStorage.setItem(PRESENTATION_CACHE,JSON.stringify({stamp:presentationStamp,presentation}));}catch{}}
 if(selected===null||!presentation?.cards[selected])selected=view.context.selected_index;
 if(policyWanted===null)policyWanted=/\sopen(?:[\s=>])/.test(view.fragments['policy-workspace']);
 if(!/\sopen(?:[\s=>])/.test(view.fragments['policy-workspace']))policyWanted=false;
 const scroll=window.scrollY,focus=document.activeElement?.id;
 const openDetails=[...document.querySelectorAll('details[open]')].map(e=>e.id||e.dataset.category||e.className);
 const dialogScroll=new Map([...document.querySelectorAll('dialog[open]')].map(e=>[e.id,e.scrollTop]));
 const keep=[...document.querySelectorAll('.tracking-preference,.bug-report-link')];keep.forEach(el=>el.remove());
 for(const [id,html] of Object.entries(view.fragments)){
  const old=document.getElementById(id),t=document.createElement('template');t.innerHTML=html;const next=t.content.firstElementChild;if(!next)continue;
  const isDialog=next.tagName==='DIALOG',open=isDialog&&next.hasAttribute('open');if(isDialog)next.removeAttribute('open');
  if(old?.open&&isDialog)old.close();if(old)old.replaceWith(next);else document.body.append(next);
  if(open&&!(id==='policy-workspace'&&!policyWanted)&&!(id==='turn-report'&&reportDismissed===view.turn)){next.showModal();next.scrollTop=dialogScroll.get(id)||0;}
 }
 document.querySelectorAll('.debt-dialog').forEach(el=>{if(el.open)el.close();el.remove();});
 for(const html of view.dialogs||[]){const t=document.createElement('template');t.innerHTML=html;const el=t.content.firstElementChild;const open=el.hasAttribute('open');el.removeAttribute('open');document.body.append(el);if(open)el.showModal();}
 keep.forEach(el=>document.getElementById('game').append(el));
 document.querySelectorAll('details').forEach(el=>{if(openDetails.includes(el.id||el.dataset.category||el.className))el.open=true;});
 lastView=view;window.SIM_MODEL_SOURCE={source:'server',version:view.version};
 for(const item of view.telemetry||[]){const fn=window.SIM_TRACKING?.[item.method];if(typeof fn==='function')fn(...item.args);}
 renderSelection();drawLocalChart();if(helpKey)showHelp(helpKey);
 document.dispatchEvent(new CustomEvent('simulator:render',{detail:view}));
 if(focus){document.getElementById(focus)?.focus({preventScroll:true});}window.scrollTo(0,scroll);
 if(view.openUrl){try{const url=new URL(view.openUrl,location.href);if(url.origin===location.origin)window.open(url.href,'_blank','noopener');}catch{}}
}
async function request(payload,retryRequest=false){
 if(busy)return false;busy=true;message('Calculando…');document.documentElement.classList.add('remote-busy');
 if(!retryRequest){payload.presentation_stamp=presentation?presentationStamp:undefined;payload.presentation_protocol=2;pending=payload;}
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),25000);
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:C.publishableKey,'Content-Type':'application/json',...(session?.token?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(payload),signal:abort.signal});
  const result=await response.json();
  if(response.status===401||response.status===410){session=null;try{sessionStorage.removeItem(KEY);}catch{}pending=null;throw Error('La sesión ha caducado. Recarga para iniciar una nueva partida.');}
  if(response.status===409){if(result.fragments){session.revision=result.revision;remember();patch(result);pending=null;}else{pending={op:'action',id:session.id,revision:session.revision,request_id:crypto.randomUUID(),action:{type:'sync'}};}throw Error(result.error);}
  if(!response.ok){if(response.status===400)pending=null;throw Error(result.error||'No se pudo completar la petición.');}
  if(result.token)session={id:result.id,token:result.token,revision:result.revision};else session.revision=result.revision;
  remember();patch(result);pending=null;message('');return true;
 }catch(e){message(e.message||'No se pudo conectar. Tu partida guardada se conserva.',!!pending);return false;}
 finally{clearTimeout(timer);busy=false;document.documentElement.classList.remove('remote-busy');}
}
async function action(data){
 const closing={'close-policy':'policy-workspace','close-info':'info-dialog','close-report':'turn-report'};
 if(closing[data.type]){localDialogClose(closing[data.type]);return true;}
 if(data.type==='close-debt'){document.querySelectorAll('.debt-dialog').forEach(e=>e.remove());return true;}
 if(!session||busy||pending)return false;data.ui=uiState();return request({op:'action',id:session.id,revision:session.revision,request_id:crypto.randomUUID(),action:data});
}
async function activate(el){
 if(el.dataset.measure!==undefined)return selectMeasure(Number(el.dataset.measure));
 if(el.dataset.info&&showHelp(el.dataset.info))return true;
 if(el.dataset.series!==undefined){const i=Number(el.dataset.series);chartVisible.has(i)?chartVisible.delete(i):chartVisible.add(i);drawLocalChart();return true;}
 if(el.dataset.scale){chartScale=el.dataset.scale;drawLocalChart();return true;}
 const closing={'close-policy':'policy-workspace','close-info':'info-dialog','turn-report-close':'turn-report'};
 if(closing[el.id]){localDialogClose(closing[el.id]);return true;}
 if(busy||pending||el.disabled)return false;
 if(el.id==='configure'&&!confirm('¿Empezar una nueva partida? Se sustituirá el progreso actual.'))return false;
 const target=control(el),initial=el.id==='start';
 if(el.id==='open-policy'||el.hasAttribute('data-edit')){if(el.hasAttribute('data-edit'))selectMeasure(Number(el.dataset.edit));openEditorShell();}
 const ok=await action({type:'click',...(target?{control:target}:{key:el.dataset.remoteKey})});
 if(ok&&initial)finishStarting();
 return ok;
}
async function click(selector){const el=document.querySelector(selector);if(!el||el.disabled)return false;return activate(el);}
window.SIM_REMOTE={action,click,get view(){return lastView;},get presentation(){return presentation;},get busy(){return busy;}};
retry.onclick=()=>{if(pending)request(pending,true);};
document.addEventListener('click',e=>{const el=e.target.closest('[data-remote-key],[data-series],[data-scale],[data-info],[data-measure]');if(!el||el.tagName==='INPUT'||el.tagName==='SELECT')return;e.preventDefault();e.stopImmediatePropagation();activate(el);},true);
document.addEventListener('input',e=>{const el=e.target;if(el.tagName!=='INPUT'||el.type!=='range')return;el.setAttribute('aria-valuetext',el.value);if(el.id==='intensity')$('intensity-value').textContent=new Intl.NumberFormat('es-ES',{maximumFractionDigits:3}).format(Number(el.value));},true);
document.addEventListener('change',e=>{const el=e.target.closest('input[data-remote-key]');if(!el)return;e.preventDefault();const target=control(el);action({type:'input',...(target?{control:target}:{key:el.dataset.remoteKey}),value:el.value});},true);
document.addEventListener('cancel',e=>{if(!e.target.matches('#mobile-warning,#policy-workspace,#turn-report,#info-dialog,.debt-dialog'))return;e.preventDefault();if(e.target.id==='mobile-warning')return;if(e.target.classList.contains('debt-dialog'))e.target.remove();else localDialogClose(e.target.id);},true);
function drawLocalChart(){
 const data=lastView?.chart;if(!data?.values.length)return;
 if(!chartVisible)chartVisible=new Set([...document.querySelectorAll('#chart-selected [data-series]')].map(e=>Number(e.dataset.series)));
 chartVisible=new Set([...chartVisible].filter(i=>data.available[i]));
 document.querySelectorAll('#legend [data-series]').forEach(e=>e.setAttribute('aria-pressed',chartVisible.has(Number(e.dataset.series))));
 const chosen=$('chart-selected');chosen.replaceChildren();for(const i of chartVisible){const source=document.querySelector('#legend [data-series="'+i+'"]');if(source){const e=source.cloneNode(true);e.setAttribute('aria-label','Quitar '+data.names[i]+' de la gráfica');chosen.append(e);}}
 if(!chosen.children.length)chosen.textContent='Selecciona las variables que quieras comparar.';$('chart-variable-count').textContent=chartVisible.size+' seleccionadas';
 document.querySelectorAll('[data-scale]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.scale===chartScale));
 const values=data.values,ys=values.flatMap(v=>[...chartVisible].map(i=>v[i]));
 const [lo,hi]=chartScale==='close'?[95,105]:chartScale==='wide'?[50,150]:ys.length?[Math.min(85,Math.floor(Math.min(...ys,100)/5)*5-5),Math.max(115,Math.ceil(Math.max(...ys,100)/5)*5+5)]:[85,115];
 const width=Math.max(300,$('chart').clientWidth||1100),left=40,right=width-15,plot=right-left,maxT=Math.max(4,lastView.turn),y=n=>170-(n-lo)/(hi-lo)*145,clamp=n=>Math.max(lo,Math.min(hi,n)),num=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n);let svg='';
 for(let i=0;i<4;i++){const n=lo+(hi-lo)*i/3;svg+=`<line x1="${left}" y1="${y(n)}" x2="${right}" y2="${y(n)}" stroke="#e7ecf1" stroke-dasharray="4 5"/><text x="12" y="${y(n)+4}" fill="#8491a1" font-size="11">${num(n)}</text>`;}
 for(let i=0;i<5;i++)svg+=`<text x="${left+plot*i/4}" y="198" fill="#8491a1" text-anchor="middle" font-size="11">T${Math.round(maxT*i/4)}</text>`;
 for(const i of chartVisible){const color=data.colors[i%data.colors.length];svg+=`<polyline points="${values.map((v,t)=>`${left+t/maxT*plot},${y(clamp(v[i]))}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.6"/><circle cx="${left+lastView.turn/maxT*plot}" cy="${y(clamp(values[lastView.turn][i]))}" r="3.5" fill="${color}"/>`;}
 if(!lastView.turn||!chartVisible.size)svg+=`<text x="${width/2}" y="90" text-anchor="middle" fill="#8491a1" font-size="13">${chartVisible.size?'Avanza para ver la evolución':'Selecciona una variable'}</text>`;
 $('chart').setAttribute('viewBox',`0 0 ${width} 210`);$('chart').innerHTML=svg;
}
window.addEventListener('resize',drawLocalChart);
window.SIM_MODEL_READY=(async()=>{
 const ok=await request(session?{op:'action',id:session.id,revision:session.revision,request_id:crypto.randomUUID(),action:{type:'sync'}}:{op:'create'});
 if(!ok)throw Error('No se pudo abrir la sesión.');
 for(const file of ['decision-layout.js','tutorial.js','bug-report.js'])await loadScript('assets/simulator/'+file+'?v='+(file==='tutorial.js'?'tutorial-mobile-1':'remote-1'));
 started=true;return window.SIM_MODEL_SOURCE;
})();
window.SIM_MODEL_READY.catch(()=>{});
})();
