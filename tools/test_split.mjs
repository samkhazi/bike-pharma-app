// update 11v: Hero split (head + lines from /api/cat/rows): brand page from the head, a bike's lines, Hero-wide search, misspelling, part number, category, part page from a link
// usage: BASE=http://127.0.0.1:3015 node tools/test_split.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE=process.env.BASE||'http://127.0.0.1:3015';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));const net=[];p.on('response',r=>{const u=r.url();if(/cat\/hero|api\/cat\/rows/.test(u))net.push(u.replace(BASE,'')+' '+r.status());});
await p.goto(BASE+'/app.html',{waitUntil:'load'});await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});await p.waitForTimeout(400);
await p.fill('#loginId','sam@bikepharma.com');await p.evaluate(()=>sendOtp());await p.waitForTimeout(500);await p.fill('#pw1','Test@1234');await p.evaluate(()=>pwGo());await p.waitForTimeout(900);
const txt=()=>p.evaluate(()=>document.querySelector('#vp .screen:last-child').innerText);
const until=async(f,ms=20000)=>{for(let t=0;t<ms;t+=300){if(await p.evaluate(f))return true;await p.waitForTimeout(300);}return false;};
await p.evaluate(()=>go('findpart',{v:'brand',vb:'Hero'}));await until(()=>CAT_ALL.find(e=>e.vb==='Hero').st===2);await p.waitForTimeout(500);
let t=await txt();ok(/Hero — choose a model/i.test(t)&&/\d[\d,]* parts/.test(t)&&!/counting/i.test(t),'brand page with counts from the head: '+t.slice(0,200).replace(/\n/g,' | '));
ok(await p.evaluate(()=>{const e=CAT_ALL.find(e=>e.vb==='Hero');return e.split===1&&e.have.size===0;}),'no Hero lines loaded on the brand page');
await p.evaluate(()=>go('findpart',{v:'year',vb:'Hero',vm:'Splendor Plus',yr:'Any'}));await p.waitForTimeout(300);t=await txt();console.log('  year view now:',t.slice(0,120).replace(/\n/g,' | '));
await until(()=>CAT_ALL.find(e=>e.vb==='Hero').sq.get('m:Splendor Plus')===2);await p.waitForTimeout(400);t=await txt();
ok(/choose model year|Sections|section/i.test(t),'model opens after its lines come: '+t.slice(0,200).replace(/\n/g,' | '));
const n1=await p.evaluate(()=>CAT_ALL.find(e=>e.vb==='Hero').have.size);console.log('  lines in:',n1);
// search across Hero
await p.evaluate(()=>go('findpart',{v:'res',q:'brake shoe',vb:'Hero',vm:'Any',cc:'Any',bs:'Any',yr:'Any',ed:'Any',sort:'best',n:30}));await p.waitForTimeout(300);
await until(async()=>!/Searching the/.test(document.querySelector('#vp .screen:last-child').innerText));await p.waitForTimeout(400);t=await txt();
ok(/parts? for “brake shoe”/i.test(t)&&/SHOE/i.test(t),'Hero-wide name search: '+(t.match(/\d[\d,]* parts? for[^\n]*/)||[''])[0]);
await p.evaluate(()=>go('findpart',{v:'res',q:'clucth cabel',vb:'Hero',vm:'Any',cc:'Any',bs:'Any',yr:'Any',ed:'Any',sort:'best',n:30}));
await until(async()=>!/Searching the/.test(document.querySelector('#vp .screen:last-child').innerText));await p.waitForTimeout(600);t=await txt();
ok(/CABLE/i.test(t)&&/CLUTCH/i.test(t),'misspelt words still find it: '+(t.match(/Understood[^\n]*/)||[''])[0]+' '+(t.match(/\d[\d,]* parts? for[^\n]*/)||[''])[0]);
// part number with Any brand
await p.evaluate(()=>go('findpart',{v:'res',q:'45125-AAH-F0099',vb:'Any',vm:'Any',cc:'Any',bs:'Any',yr:'Any',ed:'Any',sort:'best',n:30}));
await until(async()=>!/Searching|Loading/.test(document.querySelector('#vp .screen:last-child').innerText),30000);await p.waitForTimeout(600);t=await txt();
ok(/45125-AAH-F0099/.test(t)&&/SHOE/i.test(t),'part number, Any brand: '+t.slice(0,250).replace(/\n/g,' | '));
// category
await p.evaluate(()=>go('findpart',{v:'res',q:'',vb:'Hero',vm:'Any',cc:'Any',bs:'Any',yr:'Any',ed:'Any',cat:'Brakes',sort:'name',n:30}));
await until(async()=>!/Searching the/.test(document.querySelector('#vp .screen:last-child').innerText));await p.waitForTimeout(500);t=await txt();
ok(/result.* where Category contains “Brakes”/i.test(t),'category Brakes over Hero: '+(t.match(/\d[\d,]* results?[^\n]*/)||[''])[0]);
// part page fresh (reload)
const pp=await p.evaluate(()=>{const r=catRows().find(r=>r.vb==='Hero'&&r.pk==='45125AAHF0099');return {v:'part',i:0,vb:'Hero',pg:r.page,pk:r.pk,ref:r.ref||'',vm:'Any',yr:'Any'};});
const p2=await b.newPage({viewport:{width:390,height:800}});p2.on('pageerror',e=>errs.push(String(e)));await p2.goto(BASE+'/app.html',{waitUntil:'load'});await p2.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});await p2.waitForTimeout(800);
const lg=await p2.evaluate(()=>S.user&&S.user.role);if(!lg){await p2.fill('#loginId','sam@bikepharma.com');await p2.evaluate(()=>sendOtp());await p2.waitForTimeout(500);await p2.fill('#pw1','Test@1234');await p2.evaluate(()=>pwGo());await p2.waitForTimeout(900);}
await p2.evaluate(pp=>go('findpart',pp),pp);const P1=p;
for(let i=0;i<60&&/Opening the/.test(await p2.evaluate(()=>document.querySelector('#vp .screen:last-child').innerText));i++)await p2.waitForTimeout(300);await p2.waitForTimeout(800);t=await p2.evaluate(()=>document.querySelector('#vp .screen:last-child').innerText);
ok(/45125-AAH-F0099/.test(t)&&!/not in the loaded/i.test(t),'part page after a reload: '+t.slice(0,200).replace(/\n/g,' | '));
ok(!errs.length,'no page errors '+errs.join(' ; '));
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');
process.exit(fails?1:0);
