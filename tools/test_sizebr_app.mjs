// 21j: the "Other brands · check before fitting" chips under a part (made-up xref data put into the running app). Needs a server on 3033.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900);
await p.evaluate(()=>{XR={b:['Hero','Honda'],m:[['Splendor'],['Shine']],x:{'45131GZ0006L':{0:[0],1:[0]}},n:{'45131GZ0006L':{1:'45131GZ0006'}},r:{'45131GZ0006L':{1:'x'}},
  g:[['Honda design 12209-GB4 (other supplier or revision)',1,{0:[['12209-GB4-680',[0]],['12209-GB4-681',[0]]],1:[['12209-GB4-682',[0]]]}],['Honda design 45131-GZ0',1,{0:[['45131-GZ0-006L',[0]]],1:[['45131-GZ0-006',[0]]]}]],
  gk:{'12209GB4680':[0],'12209GB4682':[0],'45131GZ0006L':[1]}};XR_ST=2;});
let h=await p.evaluate(()=>catOtherBr({vb:'Hero',part:'12209-GB4-680',pk:'12209GB4680'}));
ok(/check before fitting/.test(h)&&/<b>Honda<\/b> <span class="num">12209-GB4-682/.test(h),'Hero 12209-GB4-680 shows Honda 12209-GB4-682, marked check before fitting');
ok(!/12209-GB4-681/.test(h),"the part's own brand numbers are not repeated");
h=await p.evaluate(()=>catOtherBr({vb:'Honda',part:'12209-GB4-682',pk:'12209GB4682'})); ok(/<b>Hero<\/b> <span class="num">12209-GB4-680/.test(h)&&/12209-GB4-681/.test(h),'from the Honda side both Hero numbers show');
h=await p.evaluate(()=>catOtherBr({vb:'Hero',part:'45131-GZ0-006L',pk:'45131GZ0006L'})); ok((h.match(/45131-?GZ0-?006</g)||[]).length===1&&!/check before fitting/.test(h),'a number already shown as the same part is not shown again');
ok(await p.evaluate(()=>catSizeBr({vb:'Hero',part:'99999-AAA-000',pk:'99999AAA000'}))==='','a part with no group shows nothing');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
