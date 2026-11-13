import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP=process.argv[2]||'/tmp';const b=await chromium.launch();let fail=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++;};
for(const [nm,vw] of [['ph',{width:390,height:800}],['dk',{width:1366,height:768}]]){
 const p=await b.newPage({viewport:vw});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://127.0.0.1:3033/app.html');await p.evaluate(()=>endSplash());await p.waitForSelector('#loginId');await p.waitForTimeout(900);
 await p.screenshot({path:`${SP}/s22r-${nm}-login.png`});
 ok(await p.evaluate(()=>document.getElementById('lg-btn').disabled),nm+' arrow off when empty');
 await p.fill('#loginId','9845012345');ok(!await p.evaluate(()=>document.getElementById('lg-btn').disabled),nm+' arrow on with 10 digits');
 const ov=await p.evaluate(()=>{const d=document.documentElement;return d.scrollWidth>innerWidth+1;});ok(!ov,nm+' no sideways scroll');
 await p.fill('#loginId','98'+String(Date.now()).slice(-8));await p.click('#lg-btn');await p.waitForTimeout(900);
 const s1=await p.evaluate(()=>cur().s);ok(s1==='signup'||s1==='otp',nm+' new number goes on: '+s1);
 await p.screenshot({path:`${SP}/s22r-${nm}-${s1}.png`});
 if(s1==='signup'){await p.fill('#su-name','Ravi Test');await p.click('.lgn-cta');await p.waitForTimeout(600);ok(await p.evaluate(()=>cur().s)==='otp',nm+' name then OTP');}
 await p.evaluate(()=>{otpPut&&0;});await p.fill('#otp0','1');await p.fill('#otp1','2');await p.waitForTimeout(300);
 await p.screenshot({path:`${SP}/s22r-${nm}-otp.png`});
 ok(await p.evaluate(()=>!!document.getElementById('otp-rs').textContent.trim()),nm+' resend line shown');
 await p.click('.lgn-head .iconbtn');await p.waitForTimeout(400);
 await p.evaluate(()=>reset('login'));await p.waitForSelector('#loginId');
 await p.click('#lg-mode');await p.fill('#loginId','sam@bikepharma.com');await p.waitForTimeout(200);await p.screenshot({path:`${SP}/s22r-${nm}-mail.png`});
 await p.click('#lg-btn');await p.waitForSelector('#pw1');await p.waitForTimeout(400);await p.screenshot({path:`${SP}/s22r-${nm}-pw.png`});
 await p.fill('#pw1','wrong');await p.click('.lgn-cta');await p.waitForTimeout(700);ok(await p.evaluate(()=>!!document.querySelector('.errmsg')),nm+' wrong password shows error');
 await p.fill('#pw1','Test@1234');await p.click('.lgn-cta');await p.waitForTimeout(1500);ok(await p.evaluate(()=>S.user&&S.user.role)==='admin',nm+' admin logs in with password');
 ok(!errs.length,nm+' no page errors '+errs.join('|'));await p.close();}
await b.close();console.log(fail?fail+' FAIL':'all pass');
