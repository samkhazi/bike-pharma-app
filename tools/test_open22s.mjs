import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP=process.argv[2]||'/tmp';const b=await chromium.launch();let fail=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++;};
for(const [nm,vw] of [['ph',{width:390,height:800}],['dk',{width:1366,height:768}]]){
 const p=await b.newPage({viewport:vw});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let seen=0;const probe=()=>p.evaluate(()=>{const h=document.querySelector('header,main,.hero');if(!h)return 0;const v=getComputedStyle(h).visibility!=='hidden';const a=document.getElementById('appv');return v&&(!a||a.hidden)?1:0;}).catch(()=>0);
 await p.goto('http://127.0.0.1:3033/',{waitUntil:'commit'});
 for(let i=0;i<10;i++){seen+=await probe();await p.waitForTimeout(50);}
 ok(!seen,nm+' old dark landing page never shows while opening');
 const f=p.frameLocator('#appf');await f.locator('#bpOpen').waitFor();
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#appv .abar')).display)==='none',nm+' no second logo bar above the app');
 ok(await f.locator('#splash').count()===0,nm+' no old splash');
 const t0=Date.now();const shot=async(ms,x)=>{await p.waitForTimeout(Math.max(0,ms-(Date.now()-t0)));await p.screenshot({path:`${SP}/s22t-${nm}-${x}.png`});};
 await shot(450,'a');
 const cy=await f.locator('#bpOpen .fly').evaluate(e=>{const r=e.getBoundingClientRect();return [(r.left+r.right)/2/innerWidth,(r.top+r.bottom)/2/innerHeight];});ok(Math.abs(cy[0]-.5)<.05&&Math.abs(cy[1]-.5)<.08,nm+' logo builds in the centre '+cy.map(x=>x.toFixed(2)));
 ok(await f.locator('.sheet-card.lgn').evaluate(e=>!e.classList.contains('in')),nm+' login sheet waits while the engine runs');
 await shot(1150,'b');await shot(1900,'c');await shot(2750,'d');
 await f.locator('#bpOpen').waitFor({state:'detached',timeout:6000});ok(Date.now()-t0<4500,nm+' opening ends by itself in '+(Date.now()-t0)+' ms');
 await p.waitForTimeout(700);await p.screenshot({path:`${SP}/s22t-${nm}-e.png`});
 ok(await f.locator('#lgnLogo .icw').evaluate(e=>getComputedStyle(e).opacity==='1'||+getComputedStyle(e).opacity>.9),nm+' logo sits in its place on the login page');
 const ov=await f.locator('#lgnLogo').evaluate(e=>{const r=e.getBoundingClientRect(),h=document.querySelector('.lgn-h').getBoundingClientRect();return r.bottom<=h.top&&r.top>=0;});ok(ov,nm+' logo is above the form, not on it');
 ok(await f.locator('#loginId').isVisible(),nm+' login page shows');
 await p.evaluate(()=>{location.hash='';});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!document.getElementById('appv').hidden),nm+' leaving #login still keeps the app, not the old page');
 await f.locator('#lg-mode').click();await f.locator('#loginId').fill('sam@bikepharma.com');await f.locator('#lg-btn').click();await f.locator('#pw1').fill('Test@1234');await f.locator('.lgn-cta').click();await p.waitForTimeout(1500);
 await p.reload();const g=p.frameLocator('#appf');await g.locator('#bpOpen').waitFor();await p.waitForTimeout(2700);await p.screenshot({path:`${SP}/s22t-${nm}-f.png`});
 await g.locator('#bpOpen').waitFor({state:'detached',timeout:6000});await p.waitForTimeout(300);await p.screenshot({path:`${SP}/s22t-${nm}-g.png`});
 ok(await g.locator('.nh').first().isVisible(),nm+' logged in: animation, then home');
 ok(!errs.length,nm+' no page errors '+errs.join('|'));await p.evaluate(()=>localStorage.clear());await p.close();}
await b.close();console.log(fail?fail+' FAIL':'all pass');
