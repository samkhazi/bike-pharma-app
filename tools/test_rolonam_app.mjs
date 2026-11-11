// 19s: the app's own aftermarket search against the list with Rolon in it. Needs a server on port 3033 started with ROLON_DIR pointing at a folder
// holding _state.json + _kits.json shaped as in tools/test_rolonam.mjs (codes KIT3657HT01083914, KIT3657DE01041439, L01BCC00736) and admin sam@bikepharma.com / Test@1234.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:3033'; let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/app.html',{waitUntil:'load'});
await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:15000});
await p.fill('#loginId','sam@bikepharma.com'); await p.evaluate(()=>sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1','Test@1234'); await p.evaluate(()=>pwGo()); await p.waitForTimeout(900); await p.evaluate(()=>{if(cur().s==='roleok')reset(HOME[S.user.role]);}); await p.waitForTimeout(500);
await p.evaluate(()=>{amLoad()}); await p.waitForFunction(()=>AM_ST===2,null,{timeout:20000});
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
let t=strip(await p.evaluate(()=>amRes('KIT3657HT01083914'))); console.log(t.slice(0,400));
ok(/Rolon/.test(t)&&/KIT3657HT01083914/.test(t)&&/1,565/.test(t),'material code shows the Rolon kit with MRP 1,565');
ok(/PULSAR 200CC NS/.test(t)&&/PULSAR AS 200CC/i.test(t),'both bikes of the code shown once');
let L=await p.evaluate(()=>amName('pulsar 180 chain kit','Any').map(x=>x.b+' '+x.pn+' '+x.mrp)); console.log(L);
ok(L.length===1&&/KIT3657DE01041439 1640/.test(L[0]),'search by bike words finds only the Pulsar 180 kit');
L=await p.evaluate(()=>amName('rolon belt vikram','Any').map(x=>x.pn)); ok(L.join()==='L01BCC00736','belt found by name');
L=await p.evaluate(()=>amName('BSOR 183','Any').map(x=>x.pn)); ok(L.join()==='KIT3657HT01083914','old code finds the kit');
L=await p.evaluate(()=>amHits(catPk('KIT3657HT01083914')).map(x=>[x.vb,x.name,x.mrp,x.sec,x.fits.join('|')].join(' ; '))); console.log(L);
ok(L.length===1&&/Rolon/.test(L[0])&&/1565/.test(L[0]),'Add product / scan finds it by code');
ok(await p.evaluate(()=>AM.p.filter(x=>AM.b[x[0]]==='Rolon').length)===3,'3 Rolon lines, one per code');
ok(!errs.length,'no page errors '+errs.join(';'));
await b.close(); process.exit(fails?1:0);
