const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const M=require('../assets/simulator/model-config'),H=require('../assets/simulator/housing-policy');
const pack=M.fromCatalog(JSON.parse(fs.readFileSync('data/simulator/catalog.json'))),D=M.toCatalog(pack);
const by=id=>D.measures.find(m=>m.id===id),action=id=>({index:D.measures.findIndex(m=>m.id===id),start:1,intensity:1,enforcement:1,reference_price:10,duration_turns:40,funding:[]});
assert.deepEqual(M.validate(pack),[]);
for(const m of D.measures.filter(m=>m.price_control?.indexation==='consumer_prices')){
 const a={...action(m.id),reference_price:m.price_control.mode==='sale'?2355:10};
 for(const elapsed of [0,4,20,39]){const ipc=H.consumerPriceIndex(D,elapsed),expected=a.reference_price*(1-m.price_control.max_reduction/100);assert.ok(Math.abs(H.target(m,a,a.reference_price*ipc,elapsed,ipc)/ipc-expected)<1e-9,m.id);}
 const legacy=structuredClone(m);delete legacy.price_control.indexation;assert.equal(H.target(legacy,a,20,20,H.consumerPriceIndex(D,20)),a.reference_price*(1-m.price_control.max_reduction/100));
}
assert.equal(H.target(by('a3_freeze'),action('a3_freeze'),20,20,H.consumerPriceIndex(D,20)),10);
for(const id of ['a3_tourist_days','a3_tourist_licenses','a3_seasonal_checks']){const a=action(id),fx=M.policyAt(D,by(id),a,8,[a]);assert.deepEqual(fx.price,{rent:0,sale:0,free_rent:0});assert.equal(fx.variables.rent_demand?.percent||0,0);assert.equal(fx.variables.buy_demand?.percent||0,0);assert.ok(H.tourismPipeline(D,8,[a]).converted>0);}
assert.deepEqual(by('a3_cooperative').fiscal_benefit_targets,['domestic_buyers']);assert.deepEqual(by('a3_transaction_tax_cut').fiscal_benefit_targets,['domestic_buyers']);
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{setProperty(){}},dataset:{},setAttribute(){},showModal(){},close(){},labels:[{}],querySelectorAll(){return []},insertAdjacentHTML(){}});return nodes.get(id)};
const ctx=vm.createContext({window:{SIM_CATALOG:D,SIM_MODEL:M},Intl,structuredClone,document:{getElementById:node,querySelector:node}});
for(const f of ['housing-policy','national','public-debt','fiscal','advanced','turn-report'])vm.runInContext(fs.readFileSync('assets/simulator/'+f+'.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
run('turn=20;history=Array.from({length:21},(_,t)=>outcome(t,[]))');
const gdpIndex=9+D.national.indicators.findIndex(i=>i.key==='gdp'),nominal=run(`history[20][${gdpIndex}]`),real=nominal/H.gdpPriceIndex(D,20);
assert.ok(Math.abs(run(`series(history[20],20)[${gdpIndex+1}]`)-real)<1);
assert.ok(Math.abs(run("reportMetrics(history[0],history[20],0,20).find(x=>x.id==='gdp').after")-real)<1);
run('renderNational()');assert.ok(node('national-grid').innerHTML.includes('PIB real'));assert.ok(node('national-grid').innerHTML.includes('€ de 2026'));
assert.ok(Math.abs(run('realFiscal(100*moneyIndex(21),21)')-100)<1e-10);
// Sum real quarterly flows, never deflate a nominal aggregate at the final date.
run("active=[{index:D.measures.findIndex(m=>m.id==='a3_tourist_days'),start:1,intensity:1,days_allowed:7,funding:[]}]");
const expected=run('Array.from({length:20},(_,i)=>fiscalCost(i+1,active)/H.consumerPriceIndex(D,i)).reduce((a,b)=>a+b,0)');
assert.ok(Math.abs(run('finalFiscalTotals().cost')-expected)<.001);
assert.notEqual(run('finalFiscalTotals().cost'),run('Array.from({length:20},(_,i)=>fiscalCost(i+1,active)).reduce((a,b)=>a+b,0)/H.consumerPriceIndex(D,20)'));
if(fs.existsSync('assets/simulator/control-lab-core.js')){
const L=require('../assets/simulator/control-lab-core');const api=run('({initialState,outcome,nationalAt,listingValues,aggregate,groupValue})');
assert.ok(Math.abs(L.baseline(D,api,20)[20].gdp-real)<1);
const r=L.evaluate(D,action('a3_tourist_days').index,1,api,20,{...action('a3_tourist_days'),days_allowed:7});
assert.ok(Math.abs(r.history[20].publicCost-expected)<1);
}
console.log('PASS: indexed real reductions, nominal freezes and legacy compatibility; single tourism channel; fiscal recipients; real GDP charts/reports/lab; dated fiscal conversion and accumulated costs.');
