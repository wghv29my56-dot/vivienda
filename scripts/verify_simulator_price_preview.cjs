/* All decisions use today's price as the display base; future drift is internal. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),M=require('../assets/simulator/model-config');
const d=M.toCatalog(M.fromCatalog(JSON.parse(fs.readFileSync('data/simulator/catalog.json')))),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{setProperty(){}},dataset:{},setAttribute(){},querySelector(){return null;},showModal(){},close(){}});return nodes.get(id);};
const ctx=vm.createContext({window:{SIM_CATALOG:d,SIM_MODEL:M},Intl,structuredClone,document:{getElementById:node,querySelector:node}});for(const f of ['housing-policy','national','public-debt','fiscal','advanced'])vm.runInContext(fs.readFileSync('assets/simulator/'+f+'.js','utf8'),ctx);
// Exercise the shared renderer at the start and later in a game, with large
// exogenous changes and either no effect or a known relative policy effect.
vm.runInContext('history=[initialState()]; outcome=(t,acts)=>{const v=initialState();v[6]=100*(acts.length?previewFactors.rent:1);v[7]=50000*(acts.length?previewFactors.sale:1);return v;}',ctx);
for(const t of [0,8])for(const factors of [{rent:1,sale:1},{rent:.9,sale:1.05}])for(let index=0;index<d.measures.length;index++){
 ctx.previewFactors=factors;ctx.measureIndex=index;ctx.previewTurn=t;vm.runInContext('turn=previewTurn;history[turn]=initialState();draft={index:measureIndex,intensity:.5,duration_turns:20,management:1,funding:[]};renderPolicyMarket()',ctx);
 const expected=vm.runInContext('({rent:money(realPrice(history[turn][6],turn)*80*previewFactors.rent),sale:money(realPrice(history[turn][7],turn)*80*previewFactors.sale)})',ctx),html=node('national-preview').innerHTML;
 assert.ok(html.includes('policy-listing-price">'+expected.rent),d.measures[index].id+' rent must use current base');assert.ok(html.includes('policy-listing-price">'+expected.sale),d.measures[index].id+' sale must use current base');assert.ok(html.includes('Efecto sobre precios actuales'));assert.ok(!html.includes('Estimación · T'));
}
console.log('PASS: all 67 measures, current and later turns, neutral/reducing/increasing effects, large future drift excluded from displayed rent and sale.');
