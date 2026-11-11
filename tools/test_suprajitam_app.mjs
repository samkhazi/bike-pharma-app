// 20g: the app's aftermarket search against the list with Suprajit in it. Needs a server on port 3033 with Suprajit's real list
// (suprajit.json from tools/aftermarket/suprajit_parse.py) in FILES_DIR/catalogues/aftermarket/ and admin sam@bikepharma.com / Test@1234.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:3033'; let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900); await p.evaluate(()=>{if(cur().s==='roleok')reset(HOME[S.user.role]);}); await p.waitForTimeout(500);
await p.evaluate(()=>{amLoad()}); await p.waitForFunction(()=>AM_ST===2,null,{timeout:20000});
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Suprajit').length)>1900,'Suprajit lines in the list');
let t=strip(await p.evaluate(()=>amRes('SHH0105'))); console.log(t.slice(0,300));
ok(/Suprajit/.test(t)&&/SHH0105/.test(t)&&/121/.test(t),'Suprajit number shows the cable with MRP 121');
let L=await p.evaluate(()=>amByOem(catPk('22870AAF400S')).map(x=>x.b+' '+x.pn+' '+x.mrp)); console.log(L);
ok(L.includes('Suprajit SHH0105 121'),'the original number 22870AAF400S leads to the Suprajit cable');
L=await p.evaluate(()=>amByOem(catPk('574337/F')).map(x=>x.pn)); ok(L.includes('SRE0114'),'RE number 574337/F leads to SRE0114');
t=strip(await p.evaluate(()=>amRes('DD191075'))); console.log(t.slice(0,300)); ok(/SKB0530/.test(t)&&/Suprajit/.test(t),'typing a Bajaj original number shows the Suprajit cable');
L=await p.evaluate(()=>amName('suprajit clutch cable himalayan','Any').map(x=>x.pn+' '+x.mrp)); console.log(L); ok(L.some(x=>/^SRE0114 168/.test(x)),'found by words: clutch cable himalayan');
L=await p.evaluate(()=>amName('splendor pro tank unit','Any').map(x=>x.pn)); console.log(L.slice(0,6)); ok(L.includes('SHTU0123'),'tank unit found by bike words');
L=await p.evaluate(()=>amHits(catPk('SHH0105')).map(x=>[x.vb,x.name,x.mrp].join(' ; '))); console.log(L); ok(L.length===1&&/Suprajit/.test(L[0])&&/121/.test(L[0]),'Add product / scan finds it by number');
ok(!/MOQ|NDP|dealer/i.test(JSON.stringify(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Suprajit').slice(0,400)))),'only MRP in the list');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
