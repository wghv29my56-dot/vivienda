/* Supabase is authoritative. Freeze one validated model per page/partida. */
(function(){
'use strict';
const current=document.currentScript,control=current?.dataset.consumer==='control',M=window.SIM_MODEL,C=window.SIM_SUPABASE,CACHE='vivienda.simulator.remote-cache.v1'+(C.version?'.'+C.version:'');
const start=document.getElementById('start');if(start)start.disabled=true;
const notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='margin:12px 0;padding:12px 16px;border:1px solid #d7e2e9;background:#f3f7fa;color:#234e70;font:14px/1.5 system-ui;border-radius:6px';notice.textContent='Cargando configuración del juego…';
(start?.parentElement||document.querySelector('main')||document.body).prepend(notice);
function script(path){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=()=>reject(new Error('No se pudo cargar '+path));document.body.append(s);});}
function validate(row){
 if(!row||row.engine_id!==C.engineId||(C.version&&row.version_id!==C.version))throw new Error('Versión de motor no compatible.');
 const errors=M.validate(row.payload);if(errors.length)throw new Error('Modelo no válido: '+errors[0].message);
 if(row.version_id!==row.payload.metadata.version)throw new Error('La versión del modelo no coincide.');
 return row;
}
async function remote(){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),C.timeoutMs);
 try{
  // A version pin lets a local engine revision use its matching published
  // snapshot without changing the model used by an older deployed website.
  const url=C.version?C.url+'/rest/v1/sim_model_versions?id=eq.'+encodeURIComponent(C.version)+'&select=version_id:id,label,engine_id,payload,source_sha256,payload_checksum,updated_at:created_at,engine_manifest':C.url+'/rest/v1/sim_current_model?channel=eq.'+encodeURIComponent(C.channel)+'&select=version_id,label,engine_id,payload,source_sha256,payload_checksum,updated_at,engine_manifest';
  const response=await fetch(url,{headers:{apikey:C.publishableKey},cache:'no-store',signal:abort.signal});
  if(!response.ok)throw new Error('No se pudo consultar la configuración ('+response.status+').');
  const rows=await response.json();if(!Array.isArray(rows)||rows.length!==1)throw new Error('No hay una única configuración publicada.');
  return validate(rows[0]);
 }finally{clearTimeout(timer);}
}
async function load(){
 let row,source='supabase',problem='';
 try{row=await remote();try{localStorage.setItem(CACHE,JSON.stringify(row));}catch{}}
 catch(e){
  problem=e.message;source='cache';
  try{row=validate(JSON.parse(localStorage.getItem(CACHE)||'null'));}catch{
   source='bundled';await script('data/simulator/catalog.js?v=public-debt-2');const pack=M.fromCatalog(window.SIM_CATALOG);
   row=validate({engine_id:C.engineId,version_id:pack.metadata.version,payload:pack,label:pack.model.version_label});
  }
 }
 window.SIM_CATALOG=M.toCatalog(row.payload);
 window.SIM_MODEL_SOURCE=Object.freeze({source,version:row.version_id,checksum:row.payload_checksum||null,loadedAt:new Date().toISOString(),problem});
 if(source==='supabase')notice.remove();
 else{notice.style.background='#fff2e8';notice.style.borderColor='#dfb69b';notice.textContent='No se pudo conectar con la configuración publicada. Usas una copia de respaldo ('+row.payload.model.version_label+').';}
 if(control)await script('assets/simulator/control.js?v=control-lab-1');
 else{
  for(const file of ['model-bootstrap.js','national.js','turn-report.js','public-debt.js','fiscal.js','advanced.js'])await script('assets/simulator/'+file+'?v=public-debt-2');
  if(start&&!start.textContent.includes('no disponible'))start.disabled=false;
 }
 return window.SIM_MODEL_SOURCE;
}
window.SIM_MODEL_READY=load().catch(e=>{notice.style.background='#ffe5e5';notice.style.borderColor='#d96b6b';notice.textContent='No se pudo iniciar el juego. Recarga la página para volver a intentarlo.';if(start){start.disabled=true;start.textContent='Configuración no disponible';}console.error('Simulator initialization:',e);throw e;});
})();
