import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP=process.argv[2]||'/tmp';const b=await chromium.launch();let fail=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++;};
for(const [nm,vw] of [['ph',{width:390,height:800}],['dk',{width:1366,height:768}]]){
 const p=await b.newPage({viewport:vw});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // old landing must never be seen: sample while loading
 let seen=0;const probe=()=>p.evaluate(()=>{const h=document.querySelector('header,main,.hero');if(!h)return 0;const v=getComputedStyle(h).visibility!=='hidden';const a=document.getElementById('appv');return v&&(!a||a.hidden)?1:0;}).catch(()=>0);
 const nav=p.goto('http://127.0.0.1:3033/',{waitUntil:'commit'});await nav;
 for(let i=0;i<25;i++){seen+=await probe();await p.waitForTimeout(60);}
 ok(!seen,nm+' old dark landing page never shows while opening');
 await p.screenshot({path:`${SP}/s22s-${nm}-1.png`});
 const f=p.frameLocator('#appf');
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#appv .abar')).display)==='none',nm+' no second logo bar above the app');
 ok(await f.locator('#splash.wsp').count()===1,nm+' white logo screen first');
 await p.waitForTimeout(4300);ok(await f.locator('#splash').count()===0,nm+' logo screen goes by itself');
 ok(await f.locator('#loginId').isVisible(),nm+' login page shows');
 await p.screenshot({path:`${SP}/s22s-${nm}-2.png`});
 await p.evaluate(()=>{location.hash='';});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!document.getElementById('appv').hidden),nm+' leaving #login still keeps the app, not the old page');
 // logged in: no logo wait
 await f.locator('#lg-mode').click();await f.locator('#loginId').fill('sam@bikepharma.com');await f.locator('#lg-btn').click();await f.locator('#pw1').fill('Test@1234');await f.locator('.lgn-cta').click();await p.waitForTimeout(1500);
 await p.reload();await p.waitForTimeout(2500);await p.screenshot({path:`${SP}/s22s-${nm}-3.png`});
 ok(await p.frameLocator('#appf').locator('#splash').count()===0,nm+' logged in: opens straight, no logo wait');
 ok(await p.frameLocator('#appf').locator('.nh').first().isVisible(),nm+' logged in: home shows');
 ok(!errs.length,nm+' no page errors '+errs.join('|'));await p.context().clearCookies();await p.evaluate(()=>localStorage.clear());await p.close();}
await b.close();console.log(fail?fail+' FAIL':'all pass');
