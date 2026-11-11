// 19t: name search with spelling slips, brand/model scope and the original part's page, with Rolon lines as Rolon prints them. Server on 3033 with
// ROLON_DIR holding the _state.json written in the commit message's test note (kits of BAJAJ, HERO MOTO, BPR KITS + one DRIVE CHAIN); admin sam@bikepharma.com.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:3033'; let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900); await p.evaluate(()=>{if(cur().s==='roleok')reset(HOME[S.user.role]);}); await p.waitForTimeout(500);
await p.evaluate(()=>{amLoad()}); await p.waitForFunction(()=>AM_ST===2,null,{timeout:20000});
const nm=(q,vb,vm)=>p.evaluate(([q,vb,vm])=>amName(q,vb,vm).map(x=>x.pn+(x.mf===1?'?':'')).sort().join(','),[q,vb||'Any',vm||'Any']);
let r=await nm('splendour chain sprocket'); console.log(r);
ok(r==='KIT3001EL00840000,KIT3001J400842500,KIT372CTK00863511','"splendour chain sprocket": the 3 Splendor kits (typed SPLENDOUR, list prints SPLENDER / SPLENDOR), no Pulsar, no Glamour');
r=await nm('splendor chain sproket'); ok(r==='KIT3001EL00840000,KIT3001J400842500,KIT372CTK00863511','"sproket" misspelt still finds them');
r=await nm('chain sprocket','Hero','Splendor Plus'); console.log(r); ok(r==='KIT3001EL00840000,KIT3001J400842500','Hero Splendor Plus picked + "chain sprocket": only the Splendor Plus kits');
r=await nm('chain sprocket','Hero','Super Splendor'); ok(r==='KIT372CTK00863511','Super Splendor picked: only its kit');
r=await nm('chain sprocket','Hero','Splendor iSmart'); console.log(r); ok(/\?/.test(r)&&!/KIT3657/.test(r),'a model no line names: family lines, marked check');
r=await nm('chain sprocket','Bajaj'); ok(r==='KIT3657DE01041439,KIT3657HT01083914,KITBPR0001','Bajaj picked: Bajaj kits, no Hero kit (maker first on the line); a kit-range line that names no maker and no known model stays');
r=await nm('chain sprocket','Hero'); ok(!/KIT3657/.test(r)&&/KITBPR0001/.test(r),'Hero picked: no Bajaj kit; a kit range line (BPR KITS) stays');
r=await nm('pulsar 180 chain kit'); ok(r==='KIT3657DE01041439','exact words still exact');
const html=await p.evaluate(()=>amNameRes('chain sprocket',{vb:'Hero',vm:'Splendor iSmart'})); ok(/same family/.test(html),'family note shown');
// the original part's page: Rolon for the same bike
const bk=(desc,vb,vms)=>p.evaluate(([desc,vb,vms])=>{try{return amBike({desc,asm:'',vb,vms,pk:'X1',part:'X1',kind:'d'}).map(x=>x.pn).sort().join(',');}catch(e){return 'ERR '+e.message;}},[desc,vb,vms]);
r=await bk('SPROCKET, FINAL DRIVEN (44T)','Hero',['Splendor Plus']); console.log(r); ok(r==='KIT3001EL00840000,KIT3001J400842500','Hero Splendor Plus sprocket page shows the Rolon Splendor Plus kits');
r=await bk('CHAIN, DRIVE (428-110L)','Hero',['Splendor Plus']); console.log(r); ok(r==='L01DRV428','drive chain page shows the Rolon drive chain');
r=await bk('SPROCKET, FINAL DRIVEN','Bajaj',['Pulsar 180']); ok(r==='KIT3657DE01041439','Bajaj Pulsar 180 sprocket page shows its Rolon kit only');
r=await bk('BRAKE SHOE','Hero',['Splendor Plus']); ok(r==='','another kind of part: nothing');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
