// Execute the actual local engine without a browser; UI behavior is checked separately.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const catalogue = JSON.parse(fs.readFileSync('data/simulator/catalog.json', 'utf8'));
const nodes = new Map();
const context = vm.createContext({
  window: { SIM_CATALOG: catalogue, SIM_MODEL: require('../assets/simulator/model-config.js') },
  document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } },
  localStorage: { getItem() { return null; }, removeItem() {} },
  Intl, structuredClone
});
vm.runInContext(fs.readFileSync('assets/simulator/housing-policy.js','utf8'),context);
vm.runInContext(fs.readFileSync('assets/simulator/national.js','utf8'),context);
vm.runInContext(fs.readFileSync('assets/simulator/fiscal.js','utf8'),context);
vm.runInContext(fs.readFileSync('assets/simulator/advanced.js', 'utf8'), context);
const call = (t, acts) => { context.t = t; context.acts = acts; return vm.runInContext('housingOutcome(t,acts)', context); };
const action = (id, intensity, source, start = 1) => {
  const index = catalogue.measures.findIndex(m => m.id === id);
  const m = catalogue.measures[index];
  return { index, intensity, start, funding: source ? [{source_id:source, initial_amount:Math.round(m.initial_cost*intensity), quarterly_amount:Math.round(m.quarterly_cost*intensity)}] : [] };
};
assert.ok(catalogue.measures.some(m=>m.category==='access'&&m.temporal_control),'Catalog contains the temporary protection programme');
assert.equal(catalogue.measures.filter(m=>m.category==='migration').length,8);
assert.ok(Math.abs(catalogue.display_groups.reduce((a,g)=>a+g.weight,0)-100)<1e-9);
for (const m of catalogue.measures) {
  assert.equal(m.happiness.length, 6);
  assert.equal(m.rationales.length, 6);
  for (const source of m.sources) assert.ok(catalogue.sources[source]);
  for (const intensity of [.25,.5,.75,1]) for (const t of [1,4,13,20,80]) {
    const values = call(t, [action(m.id,intensity)]);
    assert.ok(values.every(Number.isFinite), `${m.id} must remain finite`);
    assert.ok(values.slice(0,6).every(v=>v>=0&&v<=100), `${m.id} bounded groups`);
    assert.ok(values.slice(6).every(v=>v>0), `${m.id} positive prices`);
  }
}
const build = action('a3_public_build', .5, 'a3_cut_pensions');
// Physical supply is tested through the integrated national outcome below.
context.build = build;
assert.equal(vm.runInContext('amountFor(build,D.funding_sources[0],41)',context),500000000,'Maintenance reserved after last construction payment');
const freeze = action('a3_freeze', .5, 'a3_tax_irpf');
assert.ok(call(4,[freeze])[6] < call(4,[])[6]);
context.freeze=freeze;assert.ok(vm.runInContext('outcome(4,[freeze])[8] > outcome(4,[])[8]',context), 'Uncovered tenants face shortage through the integrated rental market');
assert.equal(call(9,[freeze])[6],call(9,[])[6], 'Temporary rent control expires');
assert.deepEqual(Array.from(call(9,[freeze]).slice(0,6)),Array.from(call(9,[]).slice(0,6)), 'Expired transfers stop financing incidence');
const relief = action('a3_mortgage_relief', .5);
context.relief=relief;assert.ok(vm.runInContext('outcome(4,[relief])[7] > outcome(4,[])[7]',context), 'Demand-side purchasing power affects prices through demand');
const purchaseTax = action('a3_freeze', .25, 'a3_tax_itp');
const income = action('a3_freeze', .25, 'a3_tax_irpf');
assert.ok(call(1,[purchaseTax])[3] > call(1,[income])[3], 'Different tax burdens affect groups differently');
assert.equal(vm.runInContext('quarterLabel(0)',context),'T1 · 2027');
assert.equal(vm.runInContext('quarterLabel(19)',context),'T4 · 2031');
assert.equal(vm.runInContext('quarterLabel(79)',context),'T4 · 2046');
assert.equal(vm.runInContext('series([42,39,75,64,46,52,18,3400,18])[2]',context),25,'Chart shows happiness rather than unrest');
vm.runInContext("draft={index:D.measures.findIndex(m=>m.id==='a3_public_build'),intensity:1,shares:{a3_tax_irpf:26.3,a3_cut_pensions:73.7},funding:[],start:1}; readFunding();", context);
assert.equal(vm.runInContext('draft.funding.reduce((n,f)=>n+f.initial_amount,0)',context),Math.round(catalogue.measures.find(m=>m.id==='a3_public_build').initial_cost));
assert.equal(vm.runInContext('draft.funding.reduce((n,f)=>n+f.quarterly_amount,0)',context),Math.round(catalogue.measures.find(m=>m.id==='a3_public_build').quarterly_cost));
assert.ok(vm.runInContext("sourceMaxShare(D.funding_sources.find(s=>s.id==='a3_tax_irpf'))",context)>26.3,'IRPF can cover its assigned share');
assert.ok(vm.runInContext("sourceMaxShare(D.funding_sources.find(s=>s.id==='a3_tax_irpf'))",context)<100,'The extreme construction programme cannot rely entirely on IRPF');
assert.deepEqual(Array.from(vm.runInContext('validateDraft()',context)),[],'Mixed graphical financing covers costs exactly');
vm.runInContext('draft.shares.a3_tax_irpf=0;readFunding()',context);
assert.ok(vm.runInContext('validateDraft().includes("Completa la financiación de la medida.")',context),'A policy cannot be prepared without complete funding');
console.log('PASS: visual funding shares, source limits, calendar and happiness display; all measures × 4 intensities × 5 horizons; construction delay, maintenance, persistence, expiry, market segmentation and tax incidence.');

const nationalCall=(t,acts)=>{context.t=t;context.acts=acts;return vm.runInContext('outcome(t,acts)',context)};
const baseNational=nationalCall(0,[]);
assert.equal(baseNational[9],1690012000000*1.05);
assert.equal(baseNational[10],catalogue.scenario.demography[2027].population);
assert.equal(baseNational[14],341001);
for(const m of catalogue.measures) for(const intensity of [.25,.5,1]) {
 const v=nationalCall(80,[action(m.id,intensity)]);
 assert.equal(v.length,9+catalogue.national.indicators.length);assert.ok(v.every(Number.isFinite));
 assert.ok(v.slice(0,6).every(n=>n>=0&&n<=100));assert.ok(v.slice(6,15).every(n=>n>0));
}
const tourist=nationalCall(8,[action('a3_tourist_days',1)]),passive=nationalCall(8,[]);
assert.ok(tourist[14]<passive[14]);assert.ok(tourist[13]<passive[13]);assert.ok(tourist[6]<passive[6]);
assert.equal(nationalCall(31,[build])[15],nationalCall(31,[])[15],'No public completions before eight years');
assert.ok(nationalCall(40,[build])[15]>nationalCall(40,[])[15],'Public completions reach the market in years eight to ten');
assert.ok(nationalCall(80,[build]).diagnostics.segmented.rentGap<nationalCall(80,[]).diagnostics.segmented.rentGap,'Completed rental stock reduces structural shortage permanently; cheaper rent can increase solvent demand');
assert.ok(nationalCall(4,[action('a3_mortgage_relief',1)])[12]>nationalCall(4,[])[12],'Mortgage aid expands solvent buyer demand');
assert.ok(nationalCall(1,[])[10]>baseNational[10],'Population changes without actions');
context.shock=Array.from(baseNational);context.shock[6]*=2;
assert.equal(vm.runInContext('outcome(1,[],shock)[10]',context),nationalCall(1,[])[10],'No invented housing-to-migration elasticity');
assert.notEqual(nationalCall(1,[action('a3_public_build',.1,'a3_tax_irpf')])[9],nationalCall(1,[action('a3_public_build',.1,'a3_cut_health')])[9],'Funding has opportunity cost in GDP');
console.log('PASS: national baseline, all policies × 3 intensities × 80 turns, tourism feedback, supply, demand, official demographic path and fiscal GDP effects.');
// Official paths, fiscal units, cohort completeness and audit coverage.
for (let year=2027;year<=2047;year++) {
 const t=(year-2027)*4;
 assert.ok(Math.abs(nationalCall(t,[])[10]-catalogue.scenario.demography[year].population)<.1, `INE annual population at ${year}`);
}
assert.ok(Math.abs(nationalCall(4,[])[9]/baseNational[9]-1.043)<1e-10,'2027 nominal GDP +4.3%, not real GDP or CPI');
assert.equal(nationalCall(80,[])[13],baseNational[13],'No invented automatic tourist growth');
assert.equal(nationalCall(80,[])[14],baseNational[14]+catalogue.scenario.tourism.annual_new_homes*20,'Explicit editable tourist-home entry scenario');
assert.equal(catalogue.prices.rent.value,8.2);assert.equal(catalogue.prices.sale.value,2355);
assert.equal(Object.values(catalogue.scenario.tenure_percent).reduce((a,b)=>a+b),100);
assert.deepEqual(catalogue.weights,[8.62,2.59,17.41,2.59,0,63.19],'Weighted social index includes all national agents and excludes nonresident investors');
const iva=catalogue.funding_sources.find(s=>s.id==='a3_tax_iva');
assert.equal(iva.baseline_rate,21);assert.equal(iva.max_rate,24);assert.equal(iva.annual_tax_base,394493985000);
context.iva=iva;
assert.equal(vm.runInContext('cap(iva,1)',context),iva.annual_reference*3/21*.7/4,'Simplified VAT treats all revenue as general-rate VAT');
assert.match(vm.runInContext('taxDescription(iva,0,1)',context),/21,00 % → 21,00 %/);
assert.match(vm.runInContext('taxDescription(iva,cap(iva,1),1)',context),/24,00 %/);
const codes=catalogue.funding_sources.flatMap(s=>s.cofog_codes||[]);
for(let i=0;i<codes.length;i++)for(let j=i+1;j<codes.length;j++)assert.ok(!codes[i].startsWith(codes[j])&&!codes[j].startsWith(codes[i]),'No overlapping COFOG portfolios');
for(const m of catalogue.measures){
 assert.ok(Math.abs(m.initial_cost-m.cost_audit.quantity*m.cost_audit.initial_unit)<=.5, m.id+' initial unit-cost consistency');
 assert.ok(Math.abs(m.quarterly_cost-m.cost_audit.quantity*m.cost_audit.quarter_unit)<=.5, m.id+' recurring unit-cost consistency');
 assert.ok(m.audit_note.length>100);assert.ok(m.cost_audit.sources.length);
 for(const source of m.sources)assert.ok(catalogue.sources[source]);
}
for(const s of catalogue.funding_sources){assert.ok(s.audit_note);assert.notEqual(s.reference_year,2023);}
assert.ok(Math.abs(vm.runInContext('window.SIM_NATIONAL.householdsAt(56)',context)-21943397)<1e-6,'Households meet official 2041 anchor');
assert.ok(vm.runInContext('window.SIM_NATIONAL.householdsAt(80)',context)>21943397,'Explicit extrapolation after 2041');
context.zeroBirths=0;
const savedFlows=catalogue.scenario.demography[2027];catalogue.scenario.demography[2027]={...savedFlows,births:0,deaths:1000000,immigration:0,emigration:0};
assert.ok(nationalCall(1,[])[10]<baseNational[10],'Demography can decrease when deaths exceed migration and births');
catalogue.scenario.demography[2027]=savedFlows;
const budget=catalogue.funding_sources.find(s=>s.id==='a3_cut_health');assert.equal(budget.annual_reference,102942000000);
console.log('PASS: INE annual projection path, GDP horizon, static tourism counterfactual, VAT 21–24 and official taxable base, disjoint budgets, complete household distribution, current unit-cost formulae.');
const initialListings=vm.runInContext('listingValues(initialState())',context);
assert.equal(initialListings.rent,Math.round(catalogue.scenario.households_at_start*.202*.04));
assert.equal(initialListings.sale,Math.round(catalogue.scenario.households_at_start*.733*.025));
context.touristListingAction=action('a3_tourist_days',1);
assert.ok(vm.runInContext("listingValues(outcome(8,[touristListingAction]))",context).rent>initialListings.rent,'Tourist-home conversion can add residential listings');
assert.deepEqual(Array.from(vm.runInContext("chartBounds([98,102])",context)),[85,115]);
vm.runInContext("chartScale='close'",context);assert.deepEqual(Array.from(vm.runInContext("chartBounds([70,140])",context)),[95,105]);
vm.runInContext("chartScale='wide'",context);assert.deepEqual(Array.from(vm.runInContext("chartBounds([98,102])",context)),[50,150]);
console.log('PASS: Lidealisto listing estimates react to the market and all three chart scales resolve correctly.');
