/* Balance movable summaries without changing the published simulation engine. */
(function(){
'use strict';
const workspace=document.getElementById('policy-workspace');
const columns=[workspace.querySelector('.decision-config'),workspace.querySelector('.decision-results')];
const macro=document.getElementById('policy-macro-preview'),effects=document.getElementById('modal-effects');
const hosts=columns.map(column=>{const host=document.createElement('div');host.className='decision-flow';column.append(host);return host;});
let cards=[null,null,null],frame;
function balance(){
 frame=null;
 const collective=macro.querySelector('.collective-policy-card');
 if(collective){cards[0]?.remove();cards[0]=collective;hosts[0].append(collective);}
 const fresh=[...effects.children];
 if(fresh.length){cards.slice(1).forEach(card=>card?.remove());cards[1]=fresh[0];cards[2]=fresh[1];fresh.forEach(card=>hosts[0].append(card));}
 if(!workspace.open)return;
 const items=cards.filter(Boolean);
 if(matchMedia('(max-width:720px)').matches){items.forEach(card=>hosts[0].append(card));return;}
 // Try each placement: minimize overall height, then the difference between columns.
 let best=0,bestHeight=Infinity,bestGap=Infinity;
 for(let mask=0;mask<(1<<items.length);mask++){
  items.forEach((card,i)=>hosts[(mask>>i)&1].append(card));
  const heights=columns.map(column=>column.getBoundingClientRect().height);
  const height=Math.max(...heights),gap=Math.abs(heights[0]-heights[1]);
  if(height<bestHeight-.5||(Math.abs(height-bestHeight)<.5&&gap<bestGap)){best=mask;bestHeight=height;bestGap=gap;}
 }
 items.forEach((card,i)=>hosts[(best>>i)&1].append(card));
}
function schedule(){if(!frame)frame=requestAnimationFrame(balance);}
const observer=new MutationObserver(schedule);
observer.observe(macro,{childList:true});observer.observe(effects,{childList:true});
new MutationObserver(schedule).observe(workspace,{attributes:true,attributeFilter:['open']});
window.addEventListener('resize',schedule);
document.fonts?.ready.then(schedule);
})();
