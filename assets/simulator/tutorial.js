(function(){
'use strict';
const invite=document.createElement('dialog');
invite.className='tutorial-invite';invite.setAttribute('aria-labelledby','tutorial-invite-title');
invite.innerHTML='<h2 id="tutorial-invite-title">¿Necesitas un tutorial?</h2><div class="tutorial-actions"><button class="quiet" id="tutorial-decline">No, empezar a jugar</button><button class="primary" id="tutorial-accept">Sí, enséñame</button></div>';
const tour=document.createElement('dialog');tour.className='tutorial-tour';tour.setAttribute('aria-labelledby','tutorial-title');
tour.innerHTML='<div class="tutorial-spotlight" aria-hidden="true"></div><section class="tutorial-panel" tabindex="-1"><span class="tutorial-progress"></span><h2 id="tutorial-title"></h2><div id="tutorial-copy"></div><div class="tutorial-actions"><button class="quiet" id="tutorial-back" aria-label="Anterior">← Anterior</button><button class="primary" id="tutorial-next">Siguiente →</button></div><button class="tutorial-exit" id="tutorial-exit">Salir del tutorial</button></section>';
document.body.append(invite,tour);
const steps=[
 [0,'El tiempo de tu partida','.timeline-panel',['Empiezas en **enero de 2027** y juegas los años elegidos.','Cada turno dura **3 meses**. El cronograma marca tu progreso.','Tus decisiones se aplican **al avanzar** y sus efectos pueden durar años.']],
 [1,'La felicidad de cada colectivo','.status',['La felicidad va **de 0 a 100**. Cuanto más alta la barra, mejor.','**Cada colectivo reacciona distinto**. Beneficiar a unos puede perjudicar a otros.']],
 [1,'La felicidad colectiva','.collective-column',['Cada colectivo residente pesa **según su población** en este resumen.','Influyen los **precios, impuestos, servicios públicos y economía**.']],
 [2,'Las viviendas en Lidealisto','.listings-card',['Este portal ficticio muestra **anuncios de alquiler y venta**.','Cuenta las viviendas **anunciadas**, no todas las existentes.','Los precios también dependen de **cuántas personas buscan vivienda**.']],
 [2,'Precios y cambios trimestrales','.prices',['El alquiler aparece en **€/m² al mes** y la venta en **€/m²**. Debajo, el equivalente para 80 m².','La **flecha y el porcentaje** muestran el cambio desde el trimestre anterior.','La **pequeña curva** muestra la evolución del precio.']],
 [3,'Las cifras del país','.national-panel',['Sigue la **economía, población y otras variables** que afectan a la vivienda.','Son **estimaciones del juego**, no predicciones del futuro.']],
 [3,'Compara la evolución','.chart-card',['Elige en la **leyenda** qué variables comparar.','Todas empiezan en **100**. Llegar a 110 significa +10 %; bajar a 90, −10 %.','Son **cambios relativos**, no euros ni cantidades de viviendas.']],
 [4,'Hasta 5 medidas por trimestre','.measures-heading',['Puedes preparar **hasta 5 medidas**. El contador muestra cuántas llevas.','Puedes combinarlas, revisarlas o retirarlas **antes de avanzar**.','También puedes aprobar menos o ninguna. **Cada trimestre** permite nuevas decisiones.']],
 [4,'Elige una medida','#detail',['Vamos a construir **vivienda pública para alquiler** como ejemplo.','Elige en el **catálogo** y consulta sus ventajas y costes en la ficha.']],
 [4,'Decide cuánto construir','.decision-config .modulation',['Ajusta **cuántas viviendas** quieres construir.','La cantidad cambia los **costes y los efectos**.','**Construir lleva tiempo**. Las viviendas no se entregan al pagar.']],
 [4,'Revisa los costes','.cost-grid',['El coste **inicial** corresponde al arranque.','El gasto de **cada trimestre** es recurrente.','El **compromiso total** cubre el programa completo.']],
 [5,'Elige cómo pagarla','.finance-section',['Puedes combinar **subidas de impuestos y recortes de gasto**.','Debes alcanzar la **cobertura del coste completo**.','La financiación también afecta a la **felicidad y la economía**.']],
 [5,'Prepara tu decisión','#confirm-policy',['Pulsa **Preparar medida** para añadirla al resumen de decisiones.','Puedes editarla o retirarla **antes de avanzar**.','Este tutorial es un ejemplo y **no guarda la medida**.']],
 [5,'Avanza y comprueba','#advance',['Al **avanzar** se aplican tus medidas y pasan 3 meses.','Revisa el **informe** para ver qué ha cambiado.','Algunos efectos tardan **varios turnos** en aparecer.']]
];
let hooks,index=0,exampleOpen=false,frame;
const panel=tour.querySelector('.tutorial-panel'),spot=tour.querySelector('.tutorial-spotlight');
function finish(){cancelAnimationFrame(frame);if(tour.open)tour.close();if(exampleOpen){hooks.closeExample();exampleOpen=false;}hooks.restore();window.scrollTo(0,0);document.getElementById('advance').focus({preventScroll:true});}
function place(){
 if(!tour.open)return;
 const target=document.querySelector(steps[index][2]);if(!target)return;
 const r=target.getBoundingClientRect(),w=innerWidth,h=innerHeight,pad=6,ph=panel.offsetHeight,pw=panel.offsetWidth;
 const top=Math.max(8,r.top-pad),left=Math.max(8,r.left-pad),right=Math.min(w-8,r.right+pad);
 let bottom=Math.min(h-8,r.bottom+pad);
 // Reserve room for the explanation when a section exceeds the viewport.
 if(h-bottom<ph+24&&top<ph+24)bottom=Math.max(top+20,h-ph-32);
 Object.assign(spot.style,{top:top+'px',left:left+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
 const below=h-bottom>=ph+24,above=top>=ph+24;
 const y=below?bottom+16:above?top-ph-16:h-ph-12;
 const x=Math.max(12,Math.min(w-pw-12,(left+right-pw)/2));
 Object.assign(panel.style,{left:x+'px',top:Math.max(12,y)+'px'});panel.dataset.side=below?'below':'above';panel.style.setProperty('--arrow-x',Math.max(18,Math.min(pw-18,(left+right)/2-x))+'px');
}
function show(){
 const [,title,selector,copy]=steps[index];
 const needsExample=['.decision-config .modulation','.cost-grid','.finance-section','#confirm-policy'].includes(selector);
 if(exampleOpen&&!needsExample){hooks.closeExample();exampleOpen=false;}
 if(selector==='#detail')hooks.selectExample();
 if(needsExample&&!exampleOpen){tour.close();hooks.openExample();exampleOpen=true;tour.showModal();}
 tour.querySelector('.tutorial-progress').textContent='Paso '+(index+1)+' de '+steps.length;
 document.getElementById('tutorial-title').textContent=title;
 const list=document.createElement('ul');
 for(const text of copy){
  const item=document.createElement('li');
  text.split('**').forEach((part,i)=>{if(i%2){const strong=document.createElement('strong');strong.textContent=part;item.append(strong);}else item.append(document.createTextNode(part));});
  list.append(item);
 }
 document.getElementById('tutorial-copy').replaceChildren(list);
 document.getElementById('tutorial-back').disabled=index===0;
 document.getElementById('tutorial-next').textContent=index===steps.length-1?'Empezar a jugar':'Siguiente →';
 const target=document.querySelector(selector);
 if(target)target.scrollIntoView({block:target.getBoundingClientRect().height>innerHeight-panel.offsetHeight-48?'start':'center',behavior:'instant'});
 place();cancelAnimationFrame(frame);frame=requestAnimationFrame(place);panel.focus({preventScroll:true});
}
invite.querySelector('#tutorial-decline').onclick=()=>invite.close();
invite.querySelector('#tutorial-accept').onclick=()=>{invite.close();index=0;tour.showModal();show();};
tour.querySelector('#tutorial-next').onclick=()=>{if(index===steps.length-1)finish();else{index++;show();}};
tour.querySelector('#tutorial-back').onclick=()=>{if(index){index--;show();}};
tour.querySelector('#tutorial-exit').onclick=finish;
tour.oncancel=e=>{e.preventDefault();finish();};
window.addEventListener('resize',place);document.addEventListener('scroll',place,true);
window.SIM_TUTORIAL={offer(callbacks){hooks=callbacks;invite.showModal();}};
window.SIM_MODEL_READY.then(()=>{
 function offer(){
  const previous=current,example=D.measures.findIndex(m=>m.id==='a3_public_build');
  if(example<0)return;
  window.SIM_TUTORIAL.offer({
   selectExample(){current=example;catalog();renderMeasure();},
   openExample(){openPolicy(example);},
   closeExample(){cancelPolicy();},
   restore(){current=previous;catalog();renderMeasure();}
  });
 }
 document.getElementById('start').addEventListener('click',()=>{if(!document.getElementById('mobile-warning').open)offer();});
 document.getElementById('accept-mobile-warning').addEventListener('click',offer);
}).catch(()=>{});
})();
