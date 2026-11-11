// 20h: the app's aftermarket search against the list with Spark Minda in it. Needs a server on port 3033 with Suprajit's real list
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
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Spark Minda').length)>2300,'Spark Minda lines in the list');
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Suprajit').length)>1900,'Suprajit still in the list');
let t=strip(await p.evaluate(()=>amRes('KT-1957AZ'))); console.log(t.slice(0,300));
ok(/Spark Minda/.test(t)&&/465/.test(t)&&/35010198900S/.test(t),'Spark Minda number shows the lock kit, MRP 465 (2024 list higher than 2019), original number');
let L=await p.evaluate(()=>amByOem(catPk('22870KTC900S')).map(x=>x.b+' '+x.pn+' '+x.mrp)); console.log(L);
ok(L.some(x=>/^Spark Minda CC-104 116$/.test(x)),'original number 22870KTC900S leads to Spark Minda CC-104');
L=await p.evaluate(()=>amByOem(catPk('32100-KTR-A00S')).map(x=>x.pn)); ok(L.includes('WH-1098CB'),'wiring harness by original number');
L=await p.evaluate(()=>amName('spark minda lock kit pulsar 220','Any').map(x=>x.pn+' '+x.mrp)); console.log(L.slice(0,5)); ok(L.length>0&&L.every(x=>/^KT-/.test(x)),'found by words: lock kit pulsar 220');
L=await p.evaluate(()=>amName('wiring harness glamour','Any').map(x=>x.b+' '+x.pn)); console.log(L.slice(0,5)); ok(L.some(x=>/^Spark Minda WH-/.test(x)),'found by words: wiring harness glamour');
ok(!/PACK|STD|PKG/.test(JSON.stringify(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Spark Minda').map(x=>x[2]).slice(0,600)))),'no pack sizes in names');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
