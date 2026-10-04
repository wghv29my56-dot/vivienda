/* Deterministic loader regression tests; no network, browser or database writes. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const M=require('../assets/simulator/model-config.js'),catalog=JSON.parse(fs.readFileSync('data/simulator/catalog.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),payload=M.fromCatalog(catalog);
const row={version_id:payload.metadata.version,engine_id:'js-national-v1',payload};
const loader=fs.readFileSync('assets/simulator/model-loader.js','utf8');
async function run(fetcher,cached,settings={}){
 const values=new Map(cached?[['vivienda.simulator.remote-cache.v1',JSON.stringify(cached)]]:[]);
 const loaded=[],notices=[],start={disabled:false,textContent:'Empezar partida',parentElement:{prepend:n=>notices.push(n)}};
 const body={prepend:n=>notices.push(n),append(s){loaded.push(s.src);if(s.src.startsWith('data/simulator/catalog.js'))context.SIM_CATALOG=clone(catalog);queueMicrotask(()=>s.onload());}};
 const context={SIM_MODEL:M,SIM_SUPABASE:{url:'https://example.invalid',publishableKey:'public-test',channel:'national',engineId:'js-national-v1',timeoutMs:50,...settings},AbortController,setTimeout,clearTimeout,console,Date,JSON,localStorage:{setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null},
 document:{currentScript:{dataset:{}},body,querySelector:()=>body,getElementById:()=>start,createElement:()=>({style:{},setAttribute(){},remove(){this.removed=true;}})}};
 context.window=context;context.fetch=fetcher;vm.runInNewContext(loader,context);await context.SIM_MODEL_READY;
 return {context,loaded,notices,start,values};
}
(async()=>{
 const changed=clone(row);changed.payload.model.variables.find(v=>v.id==='gdp').initial*=.8;
 let requests=0;const fresh=await run(async(url,options)=>{requests++;assert.ok(url.includes('sim_current_model'));assert.equal(options.cache,'no-store');assert.equal(options.headers.apikey,'public-test');return {ok:true,json:async()=>[changed]};});
 assert.equal(requests,1);assert.equal(fresh.context.SIM_MODEL_SOURCE.source,'supabase');
 assert.equal(fresh.context.SIM_CATALOG.national.baseline.gdp,changed.payload.model.variables.find(v=>v.id==='gdp').initial);
 assert.ok(!fresh.loaded.some(f=>f.startsWith('data/simulator/catalog.js')));assert.equal(fresh.start.disabled,false);
 changed.payload.model.variables.find(v=>v.id==='gdp').initial=1;
 assert.notEqual(fresh.context.SIM_CATALOG.national.baseline.gdp,1,'The catalog must be a frozen copy of received data');
 const pinned=await run(async url=>{assert.ok(url.includes('sim_model_versions?id=eq.'+payload.metadata.version));return {ok:true,json:async()=>[row]};},undefined,{version:payload.metadata.version});assert.equal(pinned.context.SIM_MODEL_SOURCE.source,'supabase');
 const offline=async()=>{throw new Error('Network unavailable');};
 const cache=await run(offline,row);assert.equal(cache.context.SIM_MODEL_SOURCE.source,'cache');
 assert.ok(cache.notices[0].textContent.includes('copia de respaldo'));assert.ok(!cache.loaded.some(f=>f.startsWith('data/simulator/catalog.js')));
 const bundled=await run(offline);assert.equal(bundled.context.SIM_MODEL_SOURCE.source,'bundled');assert.equal(bundled.context.SIM_CATALOG.measures.length,catalog.measures.length);
 const invalid=clone(row);invalid.payload.model.measures[0].effects[0].target_id='orphan';
 const protectedLoad=await run(async()=>({ok:true,json:async()=>[invalid]}),row);
 assert.equal(protectedLoad.context.SIM_MODEL_SOURCE.source,'cache');assert.ok(protectedLoad.context.SIM_MODEL_SOURCE.problem.includes('Modelo no válido'));
 console.log('PASS: authoritative remote configuration, no-store reads, server-data changes, snapshot isolation, cache/bundled fallback and invalid-model rejection.');
})().catch(e=>{console.error(e);process.exit(1)});
