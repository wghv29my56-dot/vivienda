/* Behavioral checks for independent enforcement, shared rent arithmetic and tax benefits. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const M=require('../assets/simulator/model-config'),H=require('../assets/simulator/housing-policy');
const pack=M.fromCatalog(JSON.parse(fs.readFileSync('data/simulator/catalog.json'))),D=M.toCatalog(pack);
const measure=id=>D.measures.find(m=>m.id===id),index=id=>D.measures.findIndex(m=>m.id===id);
const action=(id,overrides={})=>({index:index(id),start:1,intensity:.75,enforcement:1,funding:[],...overrides});
assert.deepEqual(M.validate(pack),[]);assert.deepEqual(M.fromCatalog(M.toCatalog(pack)),pack);
for(const m of D.measures.filter(m=>m.price_control)){
 const a=action(m.id),none=H.costs(m,{...a,enforcement:0});assert.equal(none.initial+none.quarter,0);
 assert.deepEqual(H.costs(m,{...a,intensity:.1}),H.costs(m,{...a,intensity:1}),'Enforcement budget is independent of legal strictness');
 const t=a.start+m.delay_turns+4,full=M.policyAt(D,m,a,t,[a]),low=M.policyAt(D,m,{...a,enforcement:0},t,[a]),key=m.price_control.mode==='sale'?'sale':'rent';
 assert.ok(Math.abs(full.price[key])>=Math.abs(low.price[key]),m.id+': enforcement strengthens compliance');
 assert.equal(M.policyAt(D,m,a,a.start+m.duration_turns,[a]).price[key],0,'Temporary law expires');
}
const assets=[{type:'Vivienda',amount:200000,start:2000,life:50},{type:'Reforma o mejora',amount:10000,start:2018,life:10}];
assert.equal(H.amortization(assets[0],2027,1.5),5100);assert.equal(H.amortization(assets[1],2027,1.5),1000);assert.equal(H.amortization(assets[1],2028,1.5),0);
assert.equal(H.annualRent(6100,8)/12,549);assert.equal(H.amortization(assets[0],2050,2),0);
const amort=measure('a3_cost_return'),ac=amort.price_control.amortization;
const expected=H.annualRent(ac.assets.reduce((s,v)=>s+H.amortization(v,ac.year,ac.inflation_factor,ac.residual_rate),0),ac.return_rate)/12/ac.area;
assert.equal(H.target(amort,{intensity:1},20),Math.min(20,expected),'Policy uses calculator arithmetic');
const voluntary=action('a3_voluntary_cap'),funded=action('a3_admin_digital',{funding:[{source_id:'a3_tax_irpf',initial_amount:10,quarterly_amount:10}]});
assert.ok(H.fiscalConflicts(D.measures,[voluntary,funded]).length);
assert.ok(H.fiscalConflicts(D.measures,[funded,voluntary]).length,'Conflict independent of order');
assert.ok(H.fiscalConflicts(D.measures,[voluntary,{...funded,start:8}]).length,'Cross-turn conflict');
assert.equal(H.fiscalConflicts(D.measures,[voluntary,{...funded,start:1+measure('a3_voluntary_cap').duration_turns}]).length,0,'Tax available after benefit expires');
for(const id of ['a3_mortgage_relief','a3_rural_tax_zones','a3_transaction_tax_cut'])assert.ok(measure(id).fiscal_links.length);
const nodes=new Map(),ctx=vm.createContext({window:{SIM_CATALOG:D,SIM_MODEL:M},Intl,structuredClone,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}}});
for(const f of ['housing-policy','national','fiscal','advanced'])vm.runInContext(fs.readFileSync('assets/simulator/'+f+'.js','utf8'),ctx);
ctx.action=voluntary;const run=s=>vm.runInContext(s,ctx);
run("draft={...action,shares:{a3_tax_iva:100}};readFunding()");
assert.ok(run("draft.funding.some(f=>f.locked&&f.quarterly_amount<0)"));
for(let t=1;t<=25;t++)assert.ok(Math.abs(run(`fiscalBalance({},${t},[draft])`))<.1,'Balanced benefit budget at turn '+t);
const bad=M.clone(pack);bad.model.measures[0].price_control.compliance_floor=2;assert.ok(M.validate(bad).length);
const badTax=M.clone(pack);badTax.model.measures.find(m=>m.fiscal_links).fiscal_links[0].source_id='missing';assert.ok(M.validate(badTax).length);
console.log('PASS: enforcement independent of strictness; expiry; amortization equivalence; same-tax and cross-turn locks; tax budget reconciliation; validation and lossless model roundtrip.');
