// 21o: Back inside the website page (bikepharma.com/#login, the app in a frame). Needs a server on 3033 (admin sam@bikepharma.com / Test@1234).
// The Back steps are kept by the website page, so a reload leaves no empty steps behind:  node tools/test_back21o.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
const fr=()=>p.frames().find(f=>f!==p.mainFrame());
const st=async()=>{await p.waitForTimeout(900);const f=fr();const s=await f.evaluate(()=>({url:location.href,scr:S.stack.map(x=>x.s).join('>'),i:HIST.state&&HIST.state.bpnav?HIST.state.bpnav.i:null}));s.hl=await p.evaluate(()=>history.length);s.hash=await p.evaluate(()=>location.hash);return s;};
const back=async()=>{await p.evaluate(()=>history.back());return st();};
await p.goto('http://127.0.0.1:3033/',{waitUntil:'load'});
await p.evaluate(()=>{history.pushState(null,'','#login');dispatchEvent(new HashChangeEvent('hashchange'));});
await p.waitForTimeout(1500);
await fr().waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await fr().fill('#loginId','sam@bikepharma.com');await fr().evaluate(()=>sendOtp());await p.waitForTimeout(500);
await fr().fill('#pw1','Test@1234');await fr().evaluate(()=>pwGo());await p.waitForTimeout(900);await fr().evaluate(()=>reset(HOME[S.user.role]));
let s=await st(); ok(/app\.html$/.test(s.url)&&!/^about:/.test(s.url),'the frame shows the real app.html, not about:srcdoc');
ok(s.scr==='ahome'&&s.i===0,'after log in the home screen is the first Back step (no dead press)');
await fr().evaluate(()=>go('staff'));await fr().evaluate(()=>spOpen());s=await st();const hl=s.hl;
await p.reload({waitUntil:'load'});await p.waitForTimeout(1500);await p.reload({waitUntil:'load'});await p.waitForTimeout(1500);s=await st();
ok(s.scr==='ahome>staff>sameparts'&&s.hl===hl,'two reloads keep the page and add no Back steps');
s=await back();ok(s.scr==='ahome>staff','Back after a reload: one screen back');
s=await back();ok(s.scr==='ahome','Back again: home');
s=await back();ok(s.scr==='ahome'&&s.hash==='#login'&&/app\.html$/.test(s.url),'Back on home: the app stays (logged in), no blank page');
await fr().evaluate(()=>go('staff'));s=await back();ok(s.scr==='ahome','after that, a screen opened from home still goes Back');
await fr().evaluate(()=>go('staff'));await fr().evaluate(()=>back());s=await st();ok(s.scr==='ahome','the app\'s own back arrow works too');
await fr().evaluate(()=>go('staff'));await fr().evaluate(()=>logout());s=await back();ok(s.scr==='login','after log out Back does not show the staff screens');
await b.close(); console.log(fails?fails+' FAILED':'all pass'); process.exit(fails?1:0);
