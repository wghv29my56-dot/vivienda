/* Same regression suite locally and in GitHub Pages; no internal panel needed. */
const fs=require('node:fs'),{spawn}=require('node:child_process');
const files=fs.readdirSync('scripts').filter(f=>/^verify_simulator.*\.cjs$/.test(f)&&f!=='verify_simulator_control_lab.cjs');
let next=0,failed=0;
async function worker(){while(next<files.length){const file=files[next++];await new Promise(resolve=>{const child=spawn(process.execPath,['scripts/'+file],{stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);child.on('close',code=>{console.log((code===0?'PASS ':'FAIL ')+file);if(code!==0){failed++;console.error(out);}resolve();});child.on('error',e=>{failed++;console.error(file,e.message);resolve();});});}}
Promise.all(Array.from({length:4},worker)).then(()=>{console.log(files.length+' suites; '+failed+' failures.');process.exitCode=failed?1:0;});
