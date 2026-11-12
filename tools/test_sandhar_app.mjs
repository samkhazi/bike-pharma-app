// 21e: the app's aftermarket search with Sandhar in the list. Needs a server on port 3033 with sandhar.json (tools/aftermarket/sandhar_parse.py)
// in DATA_DIR or FILES_DIR/catalogues/aftermarket/ and admin sam@bikepharma.com / Test@1234.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:3033'; let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900); await p.evaluate(()=>{if(cur().s==='roleok')reset(HOME[S.user.role]);}); await p.waitForTimeout(500);
await p.evaluate(()=>{amLoad()}); await p.waitForFunction(()=>AM_ST===2,null,{timeout:30000});
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log(await p.evaluate(()=>{const c={},k={};AM.p.forEach(x=>{c[AM.b[x[0]]]=(c[AM.b[x[0]]]||0)+1;if(AM.b[x[0]]==='Sandhar'){const n=AM.ty[x[8]]?AM.ty[x[8]][0]:x[8];k[n]=(k[n]||0)+1}});return JSON.stringify(c)+' kinds '+JSON.stringify(k)}));
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Sandhar').length)>4300,'Sandhar lines in the list');
let t=strip(await p.evaluate(()=>amRes('SLD-CH-139'))); console.log(t.slice(0,300)); ok(/Sandhar/.test(t)&&/CHOKE CABLE PLEASURE/i.test(t)&&/246/.test(t),'number SLD-CH-139 shows the choke cable with MRP 246');
t=strip(await p.evaluate(()=>amRes('sldwh941004'))); ok(/PLATINA 100 KS/i.test(t)&&/1,?398/.test(t),'number typed without dashes finds the wiring harness, MRP 1398');
let L=await p.evaluate(()=>amName('sandhar choke cable pleasure','Any').map(x=>x.b+' '+x.pn)); console.log(L.length,L.slice(0,6)); ok(L.some(x=>/^Sandhar SLD-CH-1/.test(x)),'found by words: choke cable pleasure');
L=await p.evaluate(()=>amName('wiring harness platina','Any').map(x=>x.b+' '+x.pn)); console.log(L.length,L.slice(0,6)); ok(L.some(x=>/^Sandhar SLD-WH/.test(x)),'found by words: wiring harness platina');
L=await p.evaluate(()=>amName('mirror passion pro','Any').map(x=>x.b+' '+x.pn)); console.log(L.length,L.slice(0,6)); ok(L.some(x=>/^Sandhar /.test(x)),'found by words: mirror passion pro');
L=await p.evaluate(()=>amName('brake switch pleasure','Any').map(x=>x.b+' '+x.pn)); console.log(L.length,L.slice(0,6)); ok(L.some(x=>/^Sandhar SLD-BSW/.test(x)),'found by words: brake switch pleasure');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
