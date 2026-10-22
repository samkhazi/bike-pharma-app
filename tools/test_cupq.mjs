// update 10u: Catalogue files: a brand folder picked while another uploads waits in line and starts by itself. Needs the test server of tools/run_tests.sh on :3015
// and fake folders (right names + sizes) in /tmp/claude-0/q10u/{suzuki,more,spaco}.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:3015', D='/tmp/claude-0/q10u';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com');await p.evaluate(()=>sendOtp());await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234');await p.evaluate(()=>pwGo());await p.waitForTimeout(900);
await p.evaluate(()=>go('catup'));
await p.waitForFunction(()=>CUP.st===2&&CUP.sets&&CUP.sets['catalogues/suzuki'],null,{timeout:20000});
const id=d=>'#cup'+d.replace(/\W/g,'');
await p.setInputFiles(id('catalogues/suzuki'),D+'/suzuki');
await p.waitForTimeout(300);
ok(await p.evaluate(()=>!!cupLive()&&CUP.run.dir==='catalogues/suzuki'),'Suzuki uploading');
await p.setInputFiles(id('catalogues/more-books'),D+'/more');
await p.setInputFiles(id('catalogues/aftermarket/spaco'),D+'/spaco');
await p.waitForTimeout(300);
ok(await p.evaluate(()=>CUP.q.length===2&&CUP.run.dir==='catalogues/suzuki'),'2 more folders in line while Suzuki uploads');
const txt=await p.evaluate(()=>document.querySelector('#vp .screen').innerText);
ok(/In line · 1/i.test(txt)&&/In line · 2/i.test(txt)&&/Remove from line/i.test(txt),'cards show In line 1, 2 and Remove from line');
await p.waitForFunction(()=>!CUP.q.length&&CUP.run&&CUP.run.end&&CUP.run.dir==='catalogues/aftermarket/spaco',null,{timeout:600000,polling:1000});
const st=await p.evaluate(()=>['catalogues/suzuki','catalogues/more-books','catalogues/aftermarket/spaco'].map(d=>{const t=cupStat(CUP.sets[d]);return d+' '+t.n+'/'+t.all;}));
ok(st.every(s=>{const [a,b]=s.split(' ')[1].split('/');return a===b;}),'all three sets fully on the server: '+st.join(', '));
// remove from line works
ok(errs.length===0,'no page errors '+errs.join(' | '));
await b.close();process.exit(fails?1:0);
