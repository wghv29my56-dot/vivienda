(function(){
'use strict';
const button=document.createElement('button');button.type='button';button.className='bug-report-link';button.textContent='Enviar comentario';
document.getElementById('game').append(button);
const dialog=document.createElement('dialog');dialog.className='bug-report-dialog';dialog.setAttribute('aria-labelledby','bug-report-title');
dialog.innerHTML='<form><h2 id="bug-report-title">Reportar error</h2><label for="bug-description">¿Qué ha fallado?</label><textarea id="bug-description" required minlength="10" maxlength="3000" rows="4" placeholder="Describe lo que ha pasado y lo que esperabas."></textarea><label for="bug-steps">¿Cómo podemos reproducirlo? (opcional)</label><textarea id="bug-steps" maxlength="1500" rows="3" placeholder="Por ejemplo, qué medida elegiste o qué botón pulsaste."></textarea><small>Se adjuntan la versión y el contexto de la partida. No incluyas datos personales.</small><p class="bug-report-status" role="status" aria-live="polite"></p><div class="bug-report-actions"><button type="button" class="quiet" id="bug-cancel">Cancelar</button><button type="submit" class="primary" id="bug-send">Enviar reporte</button></div></form>';
document.body.append(dialog);
dialog.querySelector('h2').textContent='Enviar comentario';
const categoryLabel=document.createElement('label');categoryLabel.htmlFor='feedback-category';categoryLabel.textContent='¿Qué quieres enviar?';
const category=document.createElement('select');category.id='feedback-category';
for(const [value,text] of [['error','Reportar un error'],['improvement','Sugerir una mejora'],['new_measure','Proponer una nueva medida']]){const option=document.createElement('option');option.value=value;option.textContent=text;category.append(option);}
dialog.querySelector('h2').after(categoryLabel,category);
const form=dialog.querySelector('form'),description=dialog.querySelector('#bug-description'),steps=dialog.querySelector('#bug-steps'),status=dialog.querySelector('.bug-report-status'),send=dialog.querySelector('#bug-send'),cancel=dialog.querySelector('#bug-cancel');
send.textContent='Enviar comentario';
function updateCategory(){
 const error=category.value==='error';
 dialog.querySelector('label[for="bug-description"]').textContent=error?'¿Qué ha fallado?':category.value==='improvement'?'¿Qué mejorarías?':'¿Qué medida propones?';
 description.placeholder=error?'Describe lo que ha pasado y lo que esperabas.':category.value==='improvement'?'Cuéntanos qué cambiarías y por qué.':'Explica la medida y qué problema ayudaría a resolver.';
 steps.hidden=!error;dialog.querySelector('label[for="bug-steps"]').hidden=!error;
}
category.onchange=updateCategory;
let sending=false,sent=false,pending=null;
function context(){
 const data={viewport:{width:innerWidth,height:innerHeight},language:navigator.language};
 try{data.turn=turn;data.years=years;data.prepared_measures=[...planned.values()].map(a=>({id:D.measures[a.index].id,intensity:a.intensity}));data.selected_measure=D.measures[current]?.id;data.screen=document.getElementById('setup').hidden?'game':'setup';}catch{}
 return data;
}
button.onclick=()=>{if(sent){form.reset();sent=false;pending=null;send.hidden=false;description.disabled=false;steps.disabled=false;}updateCategory();status.textContent='';cancel.textContent='Cancelar';dialog.showModal();};
cancel.onclick=()=>dialog.close();
dialog.oncancel=e=>{if(sending)e.preventDefault();};
form.onsubmit=async e=>{
 e.preventDefault();if(sending||sent)return;
 const text=description.value.trim(),reproduction=category.value==='error'?steps.value.trim():'';
 if(text.length<10){status.textContent='Escribe al menos 10 caracteres.';description.focus();return;}
 const config=window.SIM_SUPABASE;if(!config){status.textContent='No se pudo conectar. Inténtalo de nuevo.';return;}
 if(!pending||pending.category!==category.value||pending.description!==text||pending.reproduction_steps!==reproduction)pending={id:crypto.randomUUID(),category:category.value,description:text,reproduction_steps:reproduction,page_path:location.pathname.split('/').pop()||'vivienda_simulator.html',model_version:window.SIM_MODEL_SOURCE?.version||config.version,context:context()};
 sending=true;send.disabled=true;cancel.disabled=true;category.disabled=true;description.disabled=true;steps.disabled=true;status.textContent='Enviando…';
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch(config.url+'/rest/v1/sim_bug_reports',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(pending),signal:abort.signal});
  if(!response.ok){let error;try{error=await response.json();}catch{}if(!(response.status===409&&error?.code==='23505'))throw new Error('send failed');}
  sent=true;status.textContent='Gracias. Tu comentario se ha guardado.';send.hidden=true;cancel.textContent='Cerrar';
 }catch{status.textContent='No se pudo enviar. Tu texto sigue aquí; puedes volver a intentarlo.';description.disabled=false;steps.disabled=false;}
 finally{clearTimeout(timer);sending=false;send.disabled=false;cancel.disabled=false;category.disabled=false;}
};
})();
