const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const D=JSON.parse(fs.readFileSync('data/simulator/catalog.json'));
const c=vm.createContext({D,num:(n,d=0)=>Number(n).toFixed(d),escapeHTML:s=>String(s).replace(/</g,'&lt;'),turn:1});
vm.runInContext(fs.readFileSync('assets/simulator/turn-report.js','utf8'),c);
assert.equal(D.turn_comments.length,120);
assert.equal(new Set(D.turn_comments.map(x=>x.id)).size,120);
for(const change of [-8,0,5]){
 c.metric={id:'rent',name:'Alquiler',before:10,after:10+change/10,delta:change/10,change,unit:'€/m²'};
 const text=vm.runInContext('reportNarrative(metric)',c);
 assert.ok(!/\{before\}|\{after\}|\{change\}/.test(text));
 assert.ok(text.includes(change<0?'bajada':change>0?'subida':'estable'));
}
assert.ok(!D.funding_sources.some(s=>s.id==='a3_tax_nonresident'));
assert.equal(D.funding_sources.find(s=>s.id==='a3_tax_itp').annual_reference,9615300000);
assert.equal(D.funding_sources.find(s=>s.id==='a3_tax_ajd').annual_reference,2897600000);
// Only public, tracked pages: local review reports have their own document footer.
const pages=require('node:child_process').execFileSync('git',['ls-files','--','*.html'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const footers=pages.map(p=>{const h=fs.readFileSync(p,'utf8');assert.ok(!/href="[^"]*\.md/.test(h),p);const matches=[...h.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/g)];assert.equal(matches.length,1,p);return matches[0][0];});
assert.equal(new Set(footers).size,1);
console.log('PASS: 120 templates, positive/negative/stable narratives, purchase taxes, identical footer on all '+pages.length+' pages, no public Markdown links.');
