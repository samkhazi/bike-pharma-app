// 21n: Admin > Same parts (three tabs). Needs a server on 3033 (admin sam@bikepharma.com / Test@1234) and writes a made-up
// DATA_DIR/xref-pairs.json first:  node tools/test_sameparts_app.mjs <DATA_DIR> [screenshot dir]
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [DATA, SHOT] = process.argv.slice(2); let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
fs.writeFileSync(path.join(DATA,'xref-pairs.json'),JSON.stringify({at:new Date().toISOString(),pairs:[
 ['c','Same number','Hero','06410-KWS-901','DAMPER SET, WHEEL','Honda','06410-KWS-901','DAMPER SET, WHEEL'],
 ['c','Hero no. with S = Honda no.','Hero','22109-KWP-900S','RATCHET STARTER','Honda','22109-KWP-900','RATCHET, STARTER'],
 ['c','Same number','Bajaj','JG561204','BRAKE SHOE KIT','KTM','JG561204','BRAKE SHOE SET'],
 ['k','Honda design 12209-GB4 (other supplier or revision)','Hero','12209-GB4-680','SEAL, VALVE STEM OR','Honda','12209-GB4-682','SEAL, VALVE STEM(ARAI)'],
 ['k','Hero / Honda number, only the last letter or number differs','Hero','95701-06012-0F','BOLT FLANGE 6X12','Honda','95701-06012-08','BOLT, FLANGE, 6X12'],
 ['k','Bulb 12V 21W','Hero','34904-KTP-900','BULB, WINKER LIGHT','Honda','34904-KTP-901','BULB, WINKER LIGHT(12V 21W)(AMBER)']]}));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:SHOT?2:1,acceptDownloads:true})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900);
// start clean, then two staff pairs
await p.evaluate(async()=>{const j=await (await fetch('/api/same',{credentials:'same-origin'})).json();for(const e of j.list||[])await api('POST','/api/same',{a:e.a,b:e.b,del:1});for(const k of j.wrong||[]){const [x,y]=k.split('|');await api('POST','/api/same',{a:{pn:x},b:{pn:y},wrong:0});}
 await api('POST','/api/same',{a:{pn:'585643/A',vb:'Royal Enfield',name:'OIL SEAL 20X32X6'},b:{pn:'93315-317Y4',vb:'Yamaha',name:'OIL SEAL'}});
 await api('POST','/api/same',{a:{pn:'91201-KRM-841',vb:'Hero',name:'OIL SEAL 31X43X7'},b:{pn:'91201-KRM-840',vb:'Honda',name:'OIL SEAL, 31X43X7'}});});
await p.evaluate(()=>spOpen()); await p.waitForTimeout(1200);
const txt=()=>p.evaluate(()=>document.querySelector('.scroll').innerText.replace(/\s+/g,' '));
let t=await txt(); console.log(t.slice(0,420));
ok(/Today · target 5 a brand/.test(t)&&/4 of 40/.test(t)&&/Hero 1\/5/i.test(t)&&/RE 1\/5/i.test(t)&&/Suzuki 0\/5/i.test(t),'tab 1: today\'s target counts each brand of a pair');
ok(/WHO ADDED TODAY WEEK TOTAL/.test(t)&&/2 2 2/.test(t),'tab 1: who added how many (today, week, total)');
ok(/585643\/A/.test(t)&&/93315-317Y4/.test(t)&&/Remove/i.test(t)&&/2 pairs/.test(t),'tab 1: the pairs with Remove');
if(SHOT)await p.screenshot({path:path.join(SHOT,'sp1.png')});
await p.fill('#spq','91201'); await p.waitForTimeout(900); t=await txt(); ok(/1 pair /.test(t)&&!/585643/.test(t),'tab 1: search by number'); await p.fill('#spq',''); await p.waitForTimeout(700);
await p.evaluate(()=>spTab(1)); await p.waitForTimeout(1200); t=await txt(); console.log(t.slice(0,300));
ok(/3 pairs/.test(t)&&/Hero \+ Honda 2/.test(t)&&/Bajaj \+ KTM 1/.test(t)&&/22109-KWP-900S/.test(t)&&/Hero no\. with S/.test(t),'tab 2: catalogue pairs with the reason and brand chips');
if(SHOT)await p.screenshot({path:path.join(SHOT,'sp2.png')});
await p.evaluate(()=>{S.ui.spbp='Bajaj|KTM';SPR.k='';refresh()}); await p.waitForTimeout(900); t=await txt(); ok(/1 pair /.test(t)&&/JG561204/.test(t)&&!/22109/.test(t),'tab 2: brand chip filters');
await p.evaluate(()=>spTab(2)); await p.waitForTimeout(1200); t=await txt(); console.log(t.slice(0,300));
ok(/3 pairs/.test(t)&&/12209-GB4-680/.test(t)&&/Wrong/i.test(t)&&/Same part/i.test(t),'tab 3: to check pairs with Wrong / Same part');
if(SHOT)await p.screenshot({path:path.join(SHOT,'sp3.png')});
await p.evaluate(()=>spMark(0,0)); await p.waitForTimeout(900); await p.evaluate(()=>spMark(1,1)); await p.waitForTimeout(900); t=await txt();
ok(/1 pair /.test(t)&&/95701-06012-0F/.test(t)&&!/12209-GB4-680/.test(t)&&!/34904/.test(t),'tab 3: marked pairs leave the list');
const j=await p.evaluate(async()=>await (await fetch('/api/same',{credentials:'same-origin'})).json());
ok(j.list.length===3&&j.list.some(e=>e.a.pn==='12209-GB4-680'&&e.b.pn==='12209-GB4-682')&&j.wrong.length===1&&/34904KTP900/.test(j.wrong[0]),'server: "Same part" became a same-part pair, "Wrong" is kept');
await p.evaluate(()=>spTab(2)); await p.waitForTimeout(1000); t=await txt(); ok(/1 pair /.test(t),'tab 3: still gone after a reload of the list');
ok(await p.evaluate(()=>spOff('34904-KTP-900','34904-KTP-901')&&spOff('12209-GB4-680','12209-GB4-682')&&!spOff('95701-06012-0F','95701-06012-08')),'the part card leaves out the wrong pair and the one now marked the same');
const csv=await p.evaluate(async()=>[await (await fetch('/api/samereport?csv=1&tab=s',{credentials:'same-origin'})).text(),await (await fetch('/api/samereport?csv=1&tab=c',{credentials:'same-origin'})).text(),await (await fetch('/api/samereport?csv=1&tab=k',{credentials:'same-origin'})).text()]);
ok(/Added by/.test(csv[0])&&csv[0].trim().split('\n').length===4&&csv[1].trim().split('\n').length===4&&csv[2].trim().split('\n').length===2&&/Why to check/.test(csv[2]),'Excel lists: staff 3 lines, catalogue 3, to check 1');
const [dl]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),p.evaluate(()=>spExcel())]); ok(dl&&/same-parts-to-check/.test(dl.suggestedFilename()),'Excel button saves a file');
await p.evaluate(()=>spTab(0)); await p.waitForTimeout(700); await p.evaluate(()=>sameDelGo('12209-GB4-680','12209-GB4-682')); await p.waitForTimeout(1000); t=await txt(); ok(/2 pairs/.test(t),'tab 1: Remove takes a pair off');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
