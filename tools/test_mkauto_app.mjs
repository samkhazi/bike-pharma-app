// 20o: the app's aftermarket search with MK Auto in the list. Needs a server on port 3033 with mkauto.json (tools/aftermarket/mk_parse.py)
// in FILES_DIR/catalogues/aftermarket/ and admin sam@bikepharma.com / Test@1234.
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
console.log(await p.evaluate(()=>{const c={};AM.p.forEach(x=>c[AM.b[x[0]]]=(c[AM.b[x[0]]]||0)+1);return JSON.stringify(c)+' kinds '+JSON.stringify(Object.fromEntries(Object.entries(AM.p.filter(x=>AM.b[x[0]]==='MK Auto').reduce((a,x)=>(a[AM.ty[x[8]]?AM.ty[x[8]][0]:x[8]]=(a[AM.ty[x[8]]?AM.ty[x[8]][0]:x[8]]||0)+1,a),{}))));}));
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='MK Auto').length)>800,'MK Auto lines in the list');
let t=strip(await p.evaluate(()=>amRes('6002'))); console.log(t.slice(0,300)); ok(/MK Auto/.test(t)&&/PULSAR-220 NEW/i.test(t),'MK number 6002 shows the disc pad');
ok(!/₹\s*0\b/.test(t),'no "₹0" for a part without MRP');
let L=await p.evaluate(()=>amName('mk clutch plate pulsar 150','Any').map(x=>x.b+' '+x.pn)); console.log(L.length,L.slice(0,6)); ok(L.some(x=>/^MK Auto /.test(x)),'found by words: clutch plate pulsar 150');
L=await p.evaluate(()=>amName('disc pad splendor','Any').map(x=>x.b+' '+x.pn)); console.log(L.length,L.slice(0,6)); ok(L.some(x=>/^MK Auto 61/.test(x)),'found by words: disc pad splendor');
L=await p.evaluate(()=>amName('accelerator cable pulsar 135','Any').map(x=>x.b+' '+x.pn)); console.log('acc cable pulsar 135',L.length,L.slice(0,6));
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
