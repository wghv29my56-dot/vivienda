const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const M=require('../assets/simulator/model-config'),H=require('../assets/simulator/housing-policy'),L=fs.existsSync(require('node:path').join(__dirname,'../assets/simulator/control-lab-core.js'))?require('../assets/simulator/control-lab-core'):null;
const pack=M.fromCatalog(JSON.parse(fs.readFileSync('data/simulator/catalog.json'))),d=M.toCatalog(pack);
assert.deepEqual(M.validate(pack),[]);
for(const [index,m]of d.measures.entries())if(m.price_control||m.id==='a3_voluntary_cap'){
 const a={index,start:1,intensity:.8,enforcement:1,reference_price:d.prices[m.price_control?.mode==='sale'?'sale':'rent'].value,duration_turns:4,funding:[]},b={...a,duration_turns:40};
 assert.equal(H.actionEnd(m,a),5);assert.equal(H.actionEnd(m,b),41);assert.equal(H.durationHappiness(m,a),.6);assert.equal(H.durationHappiness(m,b),1.4);
 assert.deepEqual(M.policyAt(d,m,a,5,[a]).groups,{});assert.ok(Object.keys(M.policyAt(d,m,b,25,[b]).groups).length,'long effects survive original duration');
 if(L){const descriptor=L.controls(d,index,b,{sale:10000}).find(c=>c.key==='duration_turns');assert.equal(descriptor.unit,'años');assert.equal(L.adjust(d,index,b,descriptor,10).duration_turns,40);}
 if(m.price_control){assert.equal(H.controlExposure(d,41,[b]).rentalWithdrawal,0);assert.equal(H.controlExposure(d,41,[b]).saleWithdrawal,0);}
}
const freeze=d.measures.find(m=>m.id==='a3_freeze'),a={start:1,intensity:1,enforcement:1,reference_price:10,duration_turns:40};assert.equal(H.target(freeze,a,20,40),10);assert.ok(Math.abs(H.target(freeze,a,20,40)/H.consumerPriceIndex(d,40)-10/1.02**10)<1e-9);
const index=d.measures.find(m=>m.id==='a3_index_cap');assert.equal(H.controlRestriction(index,{...a,intensity:0},10*1.02**5,20),0);assert.ok(H.controlRestriction(index,{...a,intensity:1},10*1.02**5,20)>0);
const broken=M.clone(pack);broken.model.scenario.consumer_inflation.annual_rate=-1;assert.ok(M.validate(broken).length);
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{setProperty(){}},dataset:{},setAttribute(){},showModal(){},close(){}});return nodes.get(id)};
const ctx=vm.createContext({window:{SIM_CATALOG:d,SIM_MODEL:M},Intl,structuredClone,document:{getElementById:node,querySelector:node}});for(const f of ['housing-policy','national','public-debt','fiscal','advanced','turn-report'])vm.runInContext(fs.readFileSync('assets/simulator/'+f+'.js','utf8'),ctx);
assert.ok(vm.runInContext('series(outcome(40,[]),40)[7] < outcome(40,[])[6]',ctx));assert.ok(vm.runInContext('reportMetrics(outcome(0,[]),outcome(40,[]),0,40)[0].after < outcome(40,[])[6]',ctx));
console.log('PASS: 16 durations, signed social amplification, expiry and longer effects, panel years conversion, nominal freeze/real erosion, nonbinding cap scarcity, inflation validation, real chart/report values.');
