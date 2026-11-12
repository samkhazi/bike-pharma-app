// 21k: the search number card shows the other brands' numbers too (real local catalogue row, made-up xref data). Needs a server on 3033.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900);
await p.evaluate(()=>catLoad('Bajaj')); await p.waitForTimeout(3000);
const row=await p.evaluate(()=>{const L=catRows().filter(r=>r.part&&r.vb==='Bajaj'&&(r.pk||catPk(r.part)).length>=8);const r=L[0];return r?{part:r.part,pk:r.pk||catPk(r.part),vb:r.vb}:null});
console.log('row',row); if(!row){console.log('FAIL no local catalogue row');process.exit(1);}
await p.evaluate(r=>{XR={b:[r.vb,'Honda'],m:[['X'],['Shine']],x:{},n:{},r:{},g:[['Honda design test',1,{0:[[r.part,[0]]],1:[['12209-GB4-682',[0]]]}]],gk:{[r.pk]:[0]}};XR_ST=2;xrGo(r.vb,r.part);},row);
await p.waitForTimeout(2500);
const t=await p.evaluate(()=>document.body.innerText);
ok(/check before fitting/i.test(t)&&/12209-GB4-682/.test(t),'the search card of '+row.part+' shows "Other brands · check before fitting" with the Honda number');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
