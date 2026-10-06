/* Macroeconomic invariants: actual beneficiaries scale a channel once. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),M=require('../assets/simulator/model-config'),H=require('../assets/simulator/housing-policy');
const pack=M.fromCatalog(JSON.parse(fs.readFileSync('data/simulator/catalog.json'))),D=M.toCatalog(pack);
function engine(d=D){const node=()=>({querySelector(){return null;},style:{setProperty(){}},dataset:{},setAttribute(){},showModal(){},close(){}}),ctx=vm.createContext({window:{SIM_CATALOG:d,SIM_MODEL:M},Intl,structuredClone,document:{getElementById:node,querySelector:node}});for(const f of ['housing-policy','national','public-debt','fiscal','advanced'])vm.runInContext(fs.readFileSync('assets/simulator/'+f+'.js','utf8'),ctx);return {at(t,acts){ctx.macroActs=acts;ctx.macroTurn=t;return vm.runInContext('outcome(macroTurn,macroActs)',ctx)}};}
const action=(id,intensity=1)=>({index:D.measures.findIndex(m=>m.id===id),start:1,intensity,funding:[]});
for(const id of ['a3_migration_regularise','a3_migration_interior','a3_transit','a3_strategic_urban_agency','a3_remote_work']){
 const full=action(id),half=action(id,.5),m=D.measures[full.index],effect=m.effects.find(e=>e.target_id==='gdp'&&e.amount!==0),t=80;
 const d={...D,measures:D.measures.map((x,i)=>i===full.index?{...x,effects:[effect]}:x)};
 const realized=a=>effect.on_beneficiaries?H.beneficiaryForce(d,m,a,t,[a]):H.territoryAt(m,a,t).progress;
 const value=a=>M.policyAt(d,d.measures[a.index],a,t,[a]).variables.gdp.percent;
 assert.ok(Math.abs(value(half)/value(full)-realized(half)/realized(full))<1e-9,id+' GDP must follow realized output once');
}
const E=engine();for(const id of ['a3_migration_regularise','a3_migration_interior','a3_migration_seasonal_housing'])for(const t of [4,12,40,80]){const v=E.at(t,[action(id)]),b=E.at(t,[]);assert.equal(v[10],b[10],id+' cannot invent new residents');}
for(const id of ['a3_migration_removals','a3_migration_return','a3_migration_permits_limit','a3_migration_remote_workers','a3_migration_construction']){const a=action(id),v=E.at(40,[a]),b=E.at(40,[]),pipe=H.migrationPipeline(D,40,[a]),change=v[10]-b[10],expected=id.endsWith('construction')?pipe.workers:id.endsWith('remote_workers')?-pipe.remote_workers:id.endsWith('permits_limit')?-[...pipe.byAction.values()].reduce((n,v)=>n+v,0):-pipe.departures;assert.ok(Math.abs(change-expected)<1e-5,id+' population must equal executed net flows');}
// Never attribute GDP losses to denied entries that the scenario did not contain.
const low=M.clone(pack);for(const year of Object.values(low.model.scenario.demography))year.immigration=0;const lowD=M.toCatalog(low),limits=[action('a3_migration_permits_limit'),action('a3_migration_remote_workers')];const lowPipe=H.migrationPipeline(lowD,40,limits);assert.equal(lowPipe.immigration_per_year,0);assert.equal(lowPipe.gdp,0);assert.equal(lowPipe.remote_workers,0);
for(const year of Object.values(low.model.scenario.demography))year.immigration=1000;const smallD=M.toCatalog(low),smallPipe=H.migrationPipeline(smallD,40,limits);assert.ok([...smallPipe.byAction.values()].reduce((n,v)=>n+v,0)<=10000);const smallE=engine(smallD),smallV=smallE.at(40,limits),smallB=smallE.at(40,[]);assert.ok(Math.abs((smallV[10]-smallB[10])+[...smallPipe.byAction.values()].reduce((n,v)=>n+v,0))<1e-5,'GDP and population must use the same executable denied-entry cohorts');
// The actual broadened policy sustains zero entries after its deployment,
// including worker programmes; cancellation restores flows, not lost residents.
const general=action('a3_migration_permits_limit'),construction=action('a3_migration_construction');
assert.equal(D.measures[general.index].migration_program.entry_reduction,1);
for(const t of [8,12,20,40,80]){const v=E.at(t,[general]),prior=E.at(t-4,[general]),b=E.at(t,[]);assert.equal(v.diagnostics.flows.immigration,0);assert.ok(v[10]<prior[10]);assert.ok(v[9]<b[9]);const combined=H.migrationPipeline(D,t,[general,construction]);assert.ok(Math.abs(combined.immigration_per_year+D.scenario.demography[D.scenario.start_year+Math.floor((t-1)/4)].immigration)<1e-6);assert.equal(combined.currentByAction.get(construction)||0,0);}
const partial=action('a3_migration_permits_limit',.5),p12=H.migrationPipeline(D,12,[partial]);assert.ok(Math.abs(p12.immigration_per_year+D.scenario.demography[D.scenario.start_year+2].immigration*.5)<1e-6);
const cancelled={...general,cancelled_turn:20};assert.equal(H.migrationPipeline(D,24,[cancelled]).immigration_per_year,0);assert.ok(E.at(24,[cancelled])[10]<E.at(24,[])[10]);
// A sustained zero-entry restriction must reverse the baseline population trend
// and reduce GDP relative to the same scenario without the restriction.
const closed=M.toCatalog(M.clone(pack)),ci=closed.measures.findIndex(m=>m.id==='a3_migration_permits_limit');
closed.measures[ci]={...closed.measures[ci],delay_turns:0,duration_turns:80,migration_flows:{...closed.measures[ci].migration_flows,maturation_turns:0},migration_program:{...closed.measures[ci].migration_program,annual_capacity:1e7,eligible_pool:1e9}};
const closedAction={index:ci,start:1,intensity:1,funding:[]},closedE=engine(closed);let previous=closed.national.baseline.population;
for(const t of [4,8,12,16,20,24,28,32,36,40]){const v=closedE.at(t,[closedAction]),b=closedE.at(t,[]),pipe=H.migrationPipeline(closed,t,[closedAction]);assert.ok(v[10]<previous,'zero entries must produce annual population decline');assert.ok(v[9]<b[9],'lost residents must reduce GDP relative to baseline');assert.ok(Math.abs(pipe.immigration_per_year+closed.scenario.demography[closed.scenario.start_year+Math.floor((t-1)/4)].immigration)<1e-6,'all baseline entries must be prevented');previous=v[10];}
console.log('PASS: GDP scales realized output once; resident programmes conserve population; cumulative demographic changes match executed migration cohorts.');
