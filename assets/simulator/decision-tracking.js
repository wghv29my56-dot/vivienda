/* Decision telemetry. No player identity, pointer coordinates, keystrokes or screen recordings. */
(function(){
'use strict';
const C=window.SIM_SUPABASE,PREFIX='vivienda.tracking.queue.',OPT='vivienda.tracking.optout',LOG='vivienda.tracking.local-events';
const session=crypto.randomUUID(),queueKey=PREFIX+session;
let enabled=true,idleSeconds=90,optout=false,game=null,visit=null,last=performance.now(),activity=last,sending=false,lastBlocked='',lastSnapshot='',pendingChange=null;
let focusState=document.hasFocus(),visibleState=!document.hidden;
let queue=[],local=[];try{optout=localStorage.getItem(OPT)==='1';local=JSON.parse(localStorage.getItem(LOG)||'[]');}catch{}
const round=n=>Math.round(n*1000)/1000;
const permitted=()=>enabled&&!optout;
function persist(){try{localStorage.setItem(queueKey,JSON.stringify(queue));localStorage.setItem(LOG,JSON.stringify(local.slice(-3000)));}catch{}}
function tick(){const now=performance.now(),from=last;last=now;if(!game||!permitted()||!visibleState||!focusState)return;
 const visible=Math.max(0,now-from)/1000,active=Math.max(0,Math.min(now,activity+idleSeconds*1000)-from)/1000;
 game.visible+=visible;game.active+=active;if(visit){visit.visible+=visible;visit.active+=active;visit[visit.configured?'configuration':'consultation']+=active;}
}
function event(type,data={},measure=visit?.id){tick();if(!game||!permitted())return;
 if(visit&&measure===visit.id)data={...data,measure_consultation_seconds:round((game.measures[measure]?.consultation||0)+visit.consultation),measure_configuration_seconds:round((game.measures[measure]?.configuration||0)+visit.configuration)};
 const e={id:crypto.randomUUID(),occurred_at:new Date().toISOString(),game_id:game.id,session_id:session,model_version:game.version,turn:game.turn,event_type:type,measure_id:measure||null,active_seconds:round(game.active),visible_seconds:round(game.visible),measure_active_seconds:round(measure&&game.measures[measure]?.active||0),measure_visible_seconds:round(measure&&game.measures[measure]?.visible||0),data};
 if(visit&&measure===visit.id){e.measure_active_seconds=round((game.measures[measure]?.active||0)+visit.active);e.measure_visible_seconds=round((game.measures[measure]?.visible||0)+visit.visible);}
 queue.push(e);local.push(e);persist();
}
function close(reason='closed'){if(!visit)return;tick();commitChange();event('measure_closed',{reason,visit_active_seconds:round(visit.active),visit_visible_seconds:round(visit.visible),configured:visit.configured});
 const prior=game.measures[visit.id]||{active:0,visible:0,consultation:0,configuration:0};prior.consultation+=visit.consultation;prior.configuration+=visit.configuration;prior.active+=visit.active;prior.visible+=visit.visible;game.measures[visit.id]=prior;visit=null;pendingChange=null;lastSnapshot='';lastBlocked='';
}
function snapshot(a){if(!a)return {};const out={};for(const k of ['annual_permits','income_threshold','intensity','duration_turns','units','days_allowed','annual_licenses','inspectors','policy_enabled','tax_rates','tax_carrier','tax_support','return_bonus','management','enforcement','shares','funding'])if(a[k]!==undefined)out[k]=structuredClone(a[k]);return out;}
function commitChange(){if(!pendingChange||!visit)return;const a=pendingChange;pendingChange=null;const next=JSON.stringify(snapshot(a));if(next===lastSnapshot)return;
 const before=JSON.parse(lastSnapshot||'{}'),after=snapshot(a),funding=JSON.stringify(before.shares)!==JSON.stringify(after.shares);event(funding?'measure_funding_changed':'measure_config_changed',{configuration:after});visit.configured=true;lastSnapshot=next;
}
async function post(rows){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);try{const response=await fetch(C.url+'/rest/v1/sim_tracking_events',{method:'POST',headers:{apikey:C.publishableKey,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(rows),signal:abort.signal,keepalive:JSON.stringify(rows).length<50000});if(response.ok)return 'ok';const error=await response.json().catch(()=>({}));return response.status===409&&error.code==='23505'?'duplicate':'failed';}catch{return 'failed';}finally{clearTimeout(timer);}}
async function flush(){if(sending||!C||!permitted())return;sending=true;
 try{const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(PREFIX))keys.push(key);}
 for(const key of keys){let rows;try{rows=key===queueKey?queue:JSON.parse(localStorage.getItem(key)||'[]');}catch{continue;}if(!rows.length)continue;const batch=rows.slice(0,40),result=await post(batch);let done=[];
 if(result==='ok')done=batch.map(e=>e.id);else if(result==='duplicate'){for(const e of batch){const r=await post([e]);if(r==='failed')break;done.push(e.id);}}else break;
 // Re-read so another tab's appended events are never overwritten.
 const current=key===queueKey?queue:JSON.parse(localStorage.getItem(key)||'[]'),remaining=current.filter(e=>!done.includes(e.id));if(key===queueKey)queue=remaining;if(remaining.length)localStorage.setItem(key,JSON.stringify(remaining));else localStorage.removeItem(key);
 }
 }catch{}finally{sending=false;}
}
function end(reason){if(!game)return;close(reason);event('game_ended',{reason});game=null;flush();}
const API={
 start(version,years,turn=0){end('restarted');pendingChange=null;if(!permitted())return;last=activity=performance.now();game={id:crypto.randomUUID(),version,years,turn,active:0,visible:0,measures:{}};event('game_started',{years,idle_seconds:idleSeconds},null);},
 open(id,a,surface='design'){if(!game)return;close('another_measure');tick();visit={id,active:0,visible:0,consultation:0,configuration:0,configured:false};lastSnapshot=JSON.stringify(snapshot(a));lastBlocked='';event('measure_opened',{surface,...(a?{configuration:snapshot(a)}:{})});},
 draft(a,issues){if(!visit)return;pendingChange=structuredClone(a);const blocked=JSON.stringify(issues);if(blocked!==lastBlocked){lastBlocked=blocked;if(issues.length)event('measure_blocked',{issues});}},
 prepare(a,issues){commitChange();event('measure_prepare_attempted',{configuration:snapshot(a),issues});},
 prepared(a){event('measure_prepared',{configuration:snapshot(a)});close('prepared');flush();},
 remove(id){event('measure_removed',{},id);},
 commit(turn,actions,completed){commitChange();if(!game)return;game.turn=turn;for(const a of actions)event('measure_applied',{configuration:snapshot(a)},a.measure_id);event('turn_committed',{measures:actions.map(a=>a.measure_id)},null);if(completed){event('game_completed',{},null);game=null;}flush();},
 close,end,snapshot,get gameId(){return game?.id||null;},checkpoint(){commitChange();tick();if(game&&round(game.active)!==game.checkpointActive){event('game_checkpoint',{},visit?.id);game.checkpointActive=round(game.active);}flush();}
};
window.SIM_TRACKING=API;
for(const name of ['pointerdown','keydown','input','scroll'])document.addEventListener(name,()=>{tick();activity=performance.now();},{passive:true,capture:true});
// Changes are emitted after controls settle, not on every slider input.
document.addEventListener('change',()=>commitChange());
document.addEventListener('pointerup',()=>commitChange());
document.addEventListener('keyup',()=>commitChange());
document.addEventListener('click',e=>{if(!visit)return;const info=e.target.closest('[data-info]');if(info)event('measure_info_opened',{section:info.dataset.info});const link=e.target.closest('#policy-sources a');if(link)event('measure_source_clicked',{source_url:link.href});if(e.target.closest('#policy-workspace button'))queueMicrotask(commitChange);});
document.addEventListener('toggle',e=>{if(visit&&e.target.matches('#policy-workspace .methodology')&&e.target.open)event('measure_info_opened',{section:'methodology'});},true);
window.addEventListener('blur',()=>{tick();focusState=false;API.checkpoint();});window.addEventListener('focus',()=>{focusState=true;last=activity=performance.now();});
document.addEventListener('visibilitychange',()=>{tick();visibleState=!document.hidden;if(document.hidden)API.checkpoint();else last=activity=performance.now();});
window.addEventListener('pagehide',()=>{close('page_left');event('game_ended',{reason:'page_left'});flush();});
window.addEventListener('online',flush);
setInterval(()=>{tick();API.checkpoint();},30000);
async function settings(){if(!C)return;try{const response=await fetch(C.url+'/rest/v1/sim_tracking_settings?select=enabled,idle_seconds&id=eq.true',{headers:{apikey:C.publishableKey},cache:'no-store'});if(!response.ok)return;const [row]=await response.json();if(!row)return;tick();enabled=row.enabled;idleSeconds=row.idle_seconds;if(!enabled){game=null;visit=null;queue=[];for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key.startsWith(PREFIX))localStorage.removeItem(key);}}}catch{}}
settings().then(flush);setInterval(settings,60000);
const preference=document.createElement('label');preference.className='tracking-preference';preference.innerHTML='<input type="checkbox"> Compartir uso anónimo para mejorar el simulador <small>Medidas consultadas, decisiones y tiempo activo estimado.</small>';
const checkbox=preference.querySelector('input');checkbox.checked=!optout;checkbox.onchange=()=>{tick();optout=!checkbox.checked;try{localStorage.setItem(OPT,optout?'1':'0');if(optout){game=null;visit=null;queue=[];local=[];localStorage.removeItem(LOG);for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key.startsWith(PREFIX))localStorage.removeItem(key);}}}catch{}};
(document.querySelector('.game-notice')||document.getElementById('game')).append(preference);
})();
