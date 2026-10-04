const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const M=require('../assets/simulator/model-config'),H=require('../assets/simulator/housing-policy');
const pack=M.fromCatalog(JSON.parse(fs.readFileSync('data/simulator/catalog.json'))),D=M.toCatalog(pack),admin=D.measures.filter(m=>m.admin_program);
assert.equal(admin.length,5);assert.ok(admin.every(m=>!m.name.includes('Nivel')));assert.deepEqual(M.validate(pack),[]);
const action=(m,intensity=1,start=1)=>({index:D.measures.indexOf(m),intensity,start,funding:[]});
for(const m of admin){
 const full=action(m),half=action(m,.5),zero=action(m,0),first=1+m.admin_program.setup_turns+m.admin_program.build_turns;
 assert.equal(H.adminPipeline(D,first-1,[full]).completed,0,'No homes before construction completes');
 assert.equal(H.adminPipeline(D,80,[zero]).completed,0,'No budget, no extra housing');
 const big=H.adminPipeline(D,20,[full]),small=H.adminPipeline(D,20,[half]);assert.ok(big.completed>small.completed,m.id+' grows with budget');
 assert.ok(big.rentHomes>0&&big.saleHomes>0);assert.ok(big.rentListings>0&&big.saleListings>0);
 assert.ok(Math.abs(big.completed-big.rentHomes-big.saleHomes)<1e-6);
 assert.ok(H.adminPipeline(D,80,[full]).completed>=big.completed,'Completed homes persist after staffing ends');
 assert.equal(H.adminPipeline(D,80,[full]).rentListings,0,'Initial listings are absorbed, not a permanent extra ad stock');
 assert.equal(H.costs(m,half).quarter,H.costs(m,full).quarter/2);
}
const all=admin.map(m=>action(m));let previous=0;
for(let t=0;t<=80;t++){const n=H.adminPipeline(D,t,all);assert.ok(n.completed>=previous);assert.ok(n.permits<=D.rules.administration.backlog_homes+1e-6);assert.ok(n.permits<=D.rules.administration.max_extra_permits_per_year*t/4+1e-6);previous=n.completed;}
const nodes=new Map(),ctx=vm.createContext({window:{SIM_CATALOG:D,SIM_MODEL:M},Intl,structuredClone,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}}});for(const f of ['housing-policy','national','fiscal','advanced'])vm.runInContext(fs.readFileSync('assets/simulator/'+f+'.js','utf8'),ctx);
ctx.a=action(admin[0]);const run=s=>vm.runInContext(s,ctx);assert.ok(run('outcome(20,[a])[15]')>0);assert.ok(run('listingValues(outcome(20,[a])).rent')>run('listingValues(outcome(20,[])).rent'));assert.ok(run('listingValues(outcome(20,[a])).sale')>run('listingValues(outcome(20,[])).sale'));
assert.ok(run('outcome(20,[a])[6]')<run('outcome(20,[])[6]'));assert.ok(run('outcome(20,[a])[7]')<run('outcome(20,[])[7]'));
const bad=M.clone(pack);bad.model.measures.find(m=>m.admin_program).admin_program.completion_rate=2;assert.ok(M.validate(bad).length);
console.log('PASS: 5 budget-driven programmes, construction lag, zero-budget neutrality, rent/sale supply, permanent completed homes, transient listings, shared backlog/throughput caps and lower market prices.');
