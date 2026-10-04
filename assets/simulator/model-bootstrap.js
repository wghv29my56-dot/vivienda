/* Freeze a model snapshot on page load. Publishing elsewhere never mutates a game. */
(function(){
 const M=window.SIM_MODEL,base=M.fromCatalog(window.SIM_CATALOG);
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.protocol==='file:';
 let selected=base,mode='base',problem='';
 try{
  const state=local?M.readStore(localStorage):{},token=local?new URLSearchParams(location.search).get('model-preview'):null;
  if(token){if(!state.preview||state.preview.token!==token)throw new Error('Esta previsualización local ha caducado. Vuelve a abrirla desde la herramienta interna.');selected=state.preview.pack;mode='preview';}
  else if(state.active&&new URLSearchParams(location.search).get('model-local')==='1'){selected=state.active;mode='active';}
  for(const measure of selected.model.measures){if(!measure.intensity_description){const reference=base.model.measures.find(m=>m.id===measure.id);if(reference?.intensity_description)measure.intensity_description=reference.intensity_description;}}
  window.SIM_CATALOG=M.toCatalog(selected);
 }catch(e){problem=e.message;window.SIM_CATALOG=M.toCatalog(base);}
 const version=document.getElementById('sim-version');if(version)version.textContent=window.SIM_CATALOG.version_label||window.SIM_CATALOG.version;
 const log=document.getElementById('release-history');if(log){const history=window.SIM_CATALOG.release_history;for(const r of history?.releases||[]){const heading=document.createElement('h3');heading.textContent=r.label+' · '+r.date;log.append(heading);const list=document.createElement('ul');for(const change of r.changes){const li=document.createElement('li');li.textContent=change;list.append(li);}log.append(list);}}
 if(mode!=='base'||problem){const notice=document.createElement('div');notice.style.cssText='padding:12px 24px;background:#edf2f6;color:#244e79;font:14px/1.5 system-ui;border-bottom:1px solid #c8d5df';notice.textContent=problem||`${mode==='preview'?'PREVISUALIZACIÓN DEL BORRADOR':'MODELO INTERNO LOCAL'} · ${selected.metadata.version} · Las partidas ya abiertas conservan su configuración.`;document.body.prepend(notice);}
 if(problem){document.getElementById('start').disabled=true;document.getElementById('start').textContent='Modelo local no disponible';}
})();
