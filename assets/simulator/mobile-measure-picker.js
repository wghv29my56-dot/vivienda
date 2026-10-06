(function(){
'use strict';
let host=null,catalog=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let active='all',query='',signature='',building=false,allExpanded=false;
let observedCatalog=null;
const observer=new MutationObserver(()=>requestAnimationFrame(build));
function elements(){
 catalog=document.getElementById('catalog');
 host=document.getElementById('mobile-measure-picker');
 if(!host&&catalog){host=document.createElement('section');host.id='mobile-measure-picker';host.className='mobile-measure-picker';host.setAttribute('aria-label','Buscar y seleccionar medidas');catalog.closest('.measure-layout')?.before(host);}
 if(catalog&&catalog!==observedCatalog){observer.disconnect();observer.observe(catalog,{childList:true,subtree:true,characterData:true});observedCatalog=catalog;}
 return !!(host&&catalog);
}
function remoteData(){
 const presentation=window.SIM_REMOTE?.presentation;
 if(!presentation?.cards?.length)return null;
 const categories={},categoryByIndex={};
 catalog.querySelectorAll('details[data-category]').forEach(group=>{
  const id=group.dataset.category,label=group.querySelector('summary')?.childNodes[0]?.textContent.trim()||id;
  categories[id]=label;
  group.querySelectorAll('[data-measure]').forEach(button=>categoryByIndex[Number(button.dataset.measure)]=id);
 });
 const measures=presentation.cards.map((item,index)=>{
  const template=document.createElement('template');template.innerHTML=item.html||'';
  const effects=template.content.querySelectorAll('.effects .effect strong');
  return {id:item.id,name:item.name,category:categoryByIndex[index]||'',selection_description:template.content.querySelector('.measure-description')?.textContent.trim()||'',pros:[effects[0]?.textContent.trim()||'Consulta los efectos previstos.'],cons:[effects[1]?.textContent.trim()||'Consulta los riesgos previstos.']};
 });
 return {categories,measures};
}
function data(){return window.SIM_CATALOG||remoteData();}
function select(index){const button=catalog.querySelector('[data-measure="'+index+'"]');if(!button)return false;button.click();return true;}
function appendHelpEffects(index){const source=host.querySelector('.mobile-policy-card[data-index="'+index+'"] .mobile-policy-effects'),dialog=document.getElementById('info-dialog'),links=document.getElementById('info-sources');if(!source||!dialog||!links)return;dialog.querySelector('.mobile-info-effects')?.remove();const effects=source.cloneNode(true);effects.className='mobile-info-effects effects';links.before(effects);}
function open(index,kind){if(!select(index))return;requestAnimationFrame(()=>{if(kind==='help'){document.querySelector('#detail [data-info^="measure:"]')?.click();requestAnimationFrame(()=>appendHelpEffects(index));}else document.getElementById('open-policy')?.click();});}
function categoryLabel(id){return data()?.categories?.[id]||id;}
function card(measure,index){const positive=measure.pros?.[0]||'Consulta los efectos previstos.';const negative=measure.cons?.[0]||'Consulta los riesgos previstos.';const description=measure.selection_description||measure.help_summary||measure.mechanism||measure.explanation||'';return `<article class="mobile-policy-card" data-index="${index}" data-category="${esc(measure.category)}" data-search="${esc((measure.name+' '+description).toLocaleLowerCase('es'))}"><div class="mobile-policy-title"><h3>${esc(measure.name)}</h3><button type="button" class="mobile-policy-help" data-help="${index}" aria-label="Descripción completa de ${esc(measure.name)}">?</button></div><p>${esc(description)}</p><div class="mobile-policy-effects"><section class="effect"><h4>+ Lo que mejoras</h4><strong>${esc(positive)}</strong></section><section class="effect con"><h4>− Lo que arriesgas</h4><strong>${esc(negative)}</strong></section></div><button type="button" class="primary mobile-policy-design" data-design="${index}">Diseñar medida</button></article>`;}
function filter(){const matches=[...host.querySelectorAll('.mobile-policy-card')].filter(card=>(active==='all'||card.dataset.category===active)&&(!query||card.dataset.search.includes(query)));host.querySelectorAll('.mobile-policy-card').forEach(card=>card.hidden=true);const shown=active==='all'&&!allExpanded?matches.slice(0,8):matches;shown.forEach(card=>card.hidden=false);const total=host.querySelector('.mobile-picker-total');if(total)total.textContent=matches.length+' '+(matches.length===1?'medida':'medidas');const empty=host.querySelector('.mobile-picker-empty');if(empty)empty.hidden=matches.length>0;const more=host.querySelector('.mobile-picker-more');if(more){const remaining=Math.max(0,matches.length-shown.length);more.hidden=active!=='all'||allExpanded||remaining===0;more.textContent='Mostrar '+remaining+' '+(remaining===1?'medida más':'medidas más');}}
function reveal(index){if(!elements()||!host.children.length)build();const chosen=host.querySelector('.mobile-policy-card[data-index="'+index+'"]');if(!chosen)return;active=chosen.dataset.category;query='';allExpanded=false;const search=host.querySelector('input[type="search"]');if(search)search.value='';host.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('is-active',button.dataset.filter===active));const heading=host.querySelector('.mobile-picker-meta strong');if(heading)heading.textContent=categoryLabel(active);filter();sync();}
function build(){if(!elements())return;const source=data();if(!source?.measures?.length||building)return;const next=source.measures.map(m=>m.id).join('|');if(next===signature&&host.children.length){sync();return;}building=true;signature=next;const categories=Object.keys(source.categories||{}).filter(id=>source.measures.some(m=>m.category===id));host.innerHTML=`<label class="mobile-picker-search"><span class="visually-hidden">Buscar una medida</span><input type="search" placeholder="Buscar una medida…" autocomplete="off"><span aria-hidden="true">⌕</span></label><div class="mobile-picker-filters" role="group" aria-label="Filtrar medidas"><button type="button" class="is-active" data-filter="all">Todas</button>${categories.map(id=>`<button type="button" data-filter="${esc(id)}">${esc(categoryLabel(id))}</button>`).join('')}</div><div class="mobile-picker-meta"><strong>Todas las medidas</strong><span class="mobile-picker-total"></span></div><div class="mobile-picker-grid">${source.measures.map(card).join('')}</div><button type="button" class="mobile-picker-more"></button><p class="mobile-picker-empty" hidden>No hay medidas que coincidan con la búsqueda.</p>`;building=false;filter();sync();}
function sync(){const count=document.getElementById('count');host.dataset.count=count?.textContent||'';host.querySelectorAll('.mobile-policy-card').forEach(card=>{const native=catalog.querySelector('[data-measure="'+card.dataset.index+'"]');card.classList.toggle('is-current',native?.classList.contains('current'));const mark=native?.querySelector('.check')?.textContent.trim();card.classList.toggle('is-prepared',mark==='✓');const design=card.querySelector('.mobile-policy-design');if(design)design.textContent=mark==='✓'?'Editar medida':'Diseñar medida';});}
document.addEventListener('input',event=>{if(!event.target.closest('#mobile-measure-picker')||!event.target.matches('input[type="search"]'))return;query=event.target.value.trim().toLocaleLowerCase('es');allExpanded=false;filter();});
document.addEventListener('click',event=>{if(!event.target.closest('#mobile-measure-picker'))return;const filterButton=event.target.closest('[data-filter]');if(filterButton){active=filterButton.dataset.filter;allExpanded=false;host.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('is-active',button===filterButton));host.querySelector('.mobile-picker-meta strong').textContent=active==='all'?'Todas las medidas':categoryLabel(active);filter();return;}if(event.target.closest('.mobile-picker-more')){allExpanded=true;filter();return;}const help=event.target.closest('[data-help]');if(help){open(+help.dataset.help,'help');return;}const design=event.target.closest('[data-design]');if(design)open(+design.dataset.design,'design');});
window.SIM_MODEL_READY?.then(build);document.addEventListener('simulator:started',build);document.addEventListener('simulator:render',build);
window.SIM_MOBILE_PICKER={reveal};
})();
