/* Public client: sends controls and renders results; contains no model or simulation engine. */
(function(){
'use strict';
const C=window.SIM_SUPABASE,endpoint=C.url+'/functions/v1/simulator-play',KEY='vivienda.remote.session.v1';
let session=null,busy=false,lastView=null,pending=null,started=false;
try{session=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
const status=document.createElement('div');status.className='remote-status';status.setAttribute('role','status');status.hidden=true;document.body.append(status);
const retry=document.createElement('button');retry.className='quiet';retry.textContent='Reintentar';retry.hidden=true;status.append(retry);
function message(text,failed=false){status.hidden=!text;status.replaceChildren(document.createTextNode(text),retry);retry.hidden=!failed;}
function remember(){try{sessionStorage.setItem(KEY,JSON.stringify(session));}catch{}}
const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});
function patch(view){
 const scroll=window.scrollY,focus=document.activeElement?.id;
 const openDetails=[...document.querySelectorAll('details[open]')].map(e=>e.id||e.className);
 const dialogScroll=new Map([...document.querySelectorAll('dialog[open]')].map(e=>[e.id,e.scrollTop]));
 const keep=[...document.querySelectorAll('.tracking-preference,.bug-report-link')];keep.forEach(el=>el.remove());
 for(const [id,html] of Object.entries(view.fragments)){
  const old=document.getElementById(id),t=document.createElement('template');t.innerHTML=html;const next=t.content.firstElementChild;if(!next)continue;
  const isDialog=next.tagName==='DIALOG',open=isDialog&&next.hasAttribute('open');if(isDialog)next.removeAttribute('open');
  if(old?.open&&isDialog)old.close();if(old)old.replaceWith(next);else document.body.append(next);
  if(open){next.showModal();next.scrollTop=dialogScroll.get(id)||0;}
 }
 document.querySelectorAll('.debt-dialog').forEach(el=>{if(el.open)el.close();el.remove();});
 for(const html of view.dialogs||[]){const t=document.createElement('template');t.innerHTML=html;const el=t.content.firstElementChild;const open=el.hasAttribute('open');el.removeAttribute('open');document.body.append(el);if(open)el.showModal();}
 keep.forEach(el=>document.getElementById('game').append(el));
 document.querySelectorAll('details').forEach(el=>{if(openDetails.includes(el.id||el.className))el.open=true;});
 lastView=view;window.SIM_MODEL_SOURCE={source:'server',version:view.version};
 for(const item of view.telemetry||[]){const fn=window.SIM_TRACKING?.[item.method];if(typeof fn==='function')fn(...item.args);}
 document.dispatchEvent(new CustomEvent('simulator:render',{detail:view}));
 if(focus){document.getElementById(focus)?.focus({preventScroll:true});}window.scrollTo(0,scroll);
 if(view.openUrl){try{const url=new URL(view.openUrl,location.href);if(url.origin===location.origin)window.open(url.href,'_blank','noopener');}catch{}}
}
async function request(payload,retryRequest=false){
 if(busy)return false;busy=true;message('Calculando…');document.documentElement.classList.add('remote-busy');
 if(!retryRequest)pending=payload;
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
async function action(data){if(!session||busy||pending)return false;return request({op:'action',id:session.id,revision:session.revision,request_id:crypto.randomUUID(),action:data});}
async function click(selector){const el=document.querySelector(selector);if(!el||el.disabled)return false;return action({type:'click',key:el.dataset.remoteKey});}
window.SIM_REMOTE={action,click,get view(){return lastView;},get busy(){return busy;}};
retry.onclick=()=>{if(pending)request(pending,true);};
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-remote-key]');if(!el||el.tagName==='INPUT'||el.tagName==='SELECT')return;
 e.preventDefault();e.stopImmediatePropagation();if(busy||el.disabled||pending)return;
 if(el.id==='configure'&&!confirm('¿Empezar una nueva partida? Se sustituirá el progreso actual.'))return;
 const initial=el.id==='start',ok=await action({type:'click',key:el.dataset.remoteKey});
 if(ok&&initial){window.scrollTo(0,0);document.dispatchEvent(new Event('simulator:started'));}
},true);
// Commit sliders on release/change; no request for each pixel moved.
document.addEventListener('change',e=>{const el=e.target.closest('input[data-remote-key]');if(!el)return;e.preventDefault();action({type:'input',key:el.dataset.remoteKey,value:el.value});},true);
document.addEventListener('cancel',e=>{if(!e.target.matches('#policy-workspace,#turn-report,#info-dialog,.debt-dialog'))return;e.preventDefault();action({type:e.target.id==='policy-workspace'?'close-policy':e.target.id==='turn-report'?'close-report':e.target.id==='info-dialog'?'close-info':'close-debt'});},true);
window.SIM_MODEL_READY=(async()=>{
 const ok=await request(session?{op:'action',id:session.id,revision:session.revision,request_id:crypto.randomUUID(),action:{type:'sync'}}:{op:'create'});
 if(!ok)throw Error('No se pudo abrir la sesión.');
 for(const file of ['decision-layout.js','tutorial.js','bug-report.js'])await loadScript('assets/simulator/'+file+'?v=remote-1');
 started=true;return window.SIM_MODEL_SOURCE;
})();
window.SIM_MODEL_READY.catch(()=>{});
})();
