/* Confirm restarting an ongoing game using the simulator's own dialog. */
(function(){
'use strict';
const dialog=document.createElement('dialog');
dialog.className='new-game-confirm';
dialog.setAttribute('aria-labelledby','new-game-confirm-title');
dialog.setAttribute('aria-describedby','new-game-confirm-copy');
dialog.innerHTML='<h2 id="new-game-confirm-title">¿Seguro que quieres empezar otra partida?</h2><p id="new-game-confirm-copy">Si empiezas otra partida, perderás el progreso de la actual.</p><div class="new-game-confirm-actions"><button class="quiet" id="keep-playing" autofocus>Seguir jugando</button><button class="primary" id="confirm-new-game">Sí, empezar otra partida</button></div>';
document.body.append(dialog);
dialog.querySelector('#keep-playing').onclick=()=>dialog.close();
dialog.querySelector('#confirm-new-game').onclick=()=>{
 dialog.close();
 window.SIM_TRACKING?.end('reconfigured');
 document.getElementById('game').hidden=true;
 document.getElementById('setup').hidden=false;
 setupChoices();
 window.scrollTo(0,0);
};
window.SIM_MODEL_READY.then(()=>{
 const button=document.getElementById('configure'),original=button.onclick;
 button.onclick=function(event){
  if(turn===0)return original.call(this,event);
  dialog.showModal();
 };
}).catch(()=>{});
})();
