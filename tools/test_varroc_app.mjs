// 20j: the app's aftermarket search with Varroc in the list. Needs a server on port 3033 with varroc.json (tools/aftermarket/varroc_parse.py)
// in FILES_DIR/catalogues/aftermarket/ and admin sam@bikepharma.com / Test@1234.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:3033'; let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900); await p.evaluate(()=>{if(cur().s==='roleok')reset(HOME[S.user.role]);}); await p.waitForTimeout(500);
const t0=Date.now(); await p.evaluate(()=>{amLoad()}); await p.waitForFunction(()=>AM_ST===2,null,{timeout:30000}); console.log('list loaded in',Date.now()-t0,'ms');
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Varroc').length)>7000,'Varroc lines in the list');
let t=strip(await p.evaluate(()=>amRes('ABSP-PPRO-SC24S'))); console.log(t.slice(0,260)); ok(/Varroc/.test(t)&&/727/.test(t),'Varroc code shows the part with its MRP');
let L=await p.evaluate(()=>amName('varroc visor shine','Any').map(x=>x.pn)); console.log(L.length,L.slice(0,4)); ok(L.length>0,'found by words: visor shine (the list writes Shain)');
L=await p.evaluate(()=>amName('cdi dio','Any').map(x=>x.b+' '+x.pn)); console.log(L.slice(0,4)); ok(L.some(x=>/^Varroc CDEI-/.test(x)),'found by words: cdi dio');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
