/* Produces SQL from the canonical JSON; never connects, publishes or commits. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),M=require('../assets/simulator/model-config.js');
const output=process.argv[2];if(!output)throw new Error('Specify an output SQL file.');
const pack=M.fromCatalog(JSON.parse(fs.readFileSync(path.join(root,'data/simulator/catalog.json'),'utf8')));
pack.comments=[];delete pack.review_progress;
const errors=M.validate(pack);if(errors.length)throw new Error(JSON.stringify(errors));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const files=['housing-policy.js','model-config.js','advanced.js','national.js','fiscal.js','turn-report.js','public-debt.js'];
const manifest=Object.fromEntries(files.map(f=>['assets/simulator/'+f,sha(fs.readFileSync(path.join(root,'assets/simulator',f)))]));
const text=JSON.stringify(pack),q=s=>"'"+String(s).replace(/'/g,"''")+"'";
const sql='BEGIN;\nINSERT INTO public.sim_model_versions(id,label,status,engine_id,payload,engine_manifest,source_sha256) VALUES ('+
 [q(pack.metadata.version),q(pack.model.version_label),'\'published\'','\'js-national-v1\'',q(text)+'::jsonb',q(JSON.stringify(manifest))+'::jsonb',q(sha(text))].join(',')+');\n'+
 "INSERT INTO public.sim_model_active(channel,version_id) VALUES ('national',"+q(pack.metadata.version)+") ON CONFLICT(channel) DO UPDATE SET version_id=EXCLUDED.version_id;\n"+
 "UPDATE public.sim_versions SET status='retired' WHERE id IN ('alpha-1','alpha-2','alpha-3');\nCOMMIT;\n";
fs.writeFileSync(output,process.argv.includes('--snapshot-only')?sql.replace(/INSERT INTO public\.sim_model_active[^\n]+\n/,'').replace(/UPDATE public\.sim_versions[^\n]+\n/,''):sql);console.log(JSON.stringify({version:pack.metadata.version,measures:pack.model.measures.length,source_sha256:sha(text),output}));
