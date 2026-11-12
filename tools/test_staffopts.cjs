const {chromium}=require('playwright');const out=[];const ok=(n,c,x)=>{out.push((c?'PASS ':'FAIL ')+n+(c?'':' '+JSON.stringify(x||'')));};
(async()=>{const b=await chromium.launch();
const login=async(p,id,pw)=>{await p.goto('http://127.0.0.1:3033/app.html');await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot');
 await p.fill('#loginId',id);await p.evaluate(()=>sendOtp());await p.waitForTimeout(600);await p.fill('#pw1',pw);await p.evaluate(()=>pwGo());await p.waitForTimeout(1500);};
const K='9000000002';
// 1 admin sets options
{const p=await b.newPage({viewport:{width:390,height:844}});const e=[];p.on('pageerror',x=>e.push(String(x)));await login(p,'sam@bikepharma.com','Test@1234');
 await p.evaluate(k=>{tab('ahome');go('staff');staffSheet(k);},K);await p.waitForTimeout(300);
 await p.locator('.sheet button',{hasText:'What this staff can see'}).click();await p.waitForTimeout(400);
 ok('admin opens options page',await p.evaluate(()=>cur().s)==='staffopts');
 await p.locator('button.sw[aria-label="Inventory list"]').click();await p.waitForTimeout(300);
 await p.locator('button.sw[aria-label="Make invoice"]').click();await p.waitForTimeout(300);
 await p.locator('button.sw[aria-label="Approvals"]').click();await p.waitForTimeout(300);
 const r=await p.evaluate(k=>({o:DB.staffOpts[k],pills:document.querySelectorAll('.pill.y').length,au:DB.audit.slice(0,3).map(x=>x.a+'|'+x.o+'>'+x.n),txt:document.body.innerText}),K);
 ok('saved inv off, bill on, appr off',r.o&&r.o.inv===false&&r.o.bill===true&&r.o.appr===false,r.o);ok('3 Changed pills',r.pills===3,r.pills);ok('audit rows',r.au.length===3&&/Staff option changed/.test(r.au[0]),r.au);ok('3 options changed text',/3 options changed/.test(r.txt));
 await p.screenshot({path:process.argv[2]+'/so-admin.png',fullPage:false});
 await p.waitForTimeout(2500);ok('admin no errors',!e.length,e);await p.close();}
// 2 manager real login
for(const w of [390,1400]){const p=await b.newPage({viewport:{width:w,height:844}});const e=[];p.on('pageerror',x=>e.push(String(x)));await login(p,K,'Mgr@1234');
 await p.evaluate(()=>tab('mghome'));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{const vis=t=>[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()===t&&x.offsetParent&&getComputedStyle(x).display!=='none').length;
  return {role:S.user.role,opts:(DB.staffOpts||{})[S.uid],inv:vis('Inventory'),stockin:vis('Stock in'),aInv:allowed('stocklist'),aBill:allowed('invoice'),aAppr:allowed('approvals'),aGrn:allowed('grn')};});
 ok(w+' manager got options from server',r.opts&&r.opts.inv===false,r);ok(w+' Inventory button hidden',r.inv===0,r.inv);ok(w+' Stock in still shown',r.stockin>=1,r.stockin);ok(w+' allowed flags',!r.aInv&&r.aBill&&!r.aAppr&&r.aGrn,r);
 await p.evaluate(()=>go('stocklist'));await p.waitForTimeout(300);ok(w+' stocklist says switched off',/switched off for your login/i.test(await p.evaluate(()=>document.body.innerText)));
 await p.evaluate(()=>back());await p.waitForTimeout(500);await p.evaluate(()=>tab('saccount'));await p.waitForTimeout(500);
 const acc=await p.evaluate(()=>document.body.innerText);ok(w+' Account shows extra Make invoice',/More options from Admin/i.test(acc)&&/Make invoice/i.test(acc),[await p.evaluate(()=>cur().s),acc.slice(0,200)]);
 if(w===1400)ok('side menu has Make invoice, no Inventory',await p.evaluate(()=>{const t=[...document.querySelectorAll('.wv-side button')].map(x=>x.textContent.trim());return t.includes('Make invoice')&&!t.includes('Inventory');}));
 await p.evaluate(()=>go('invoice'));await p.waitForTimeout(500);ok(w+' invoice opens for manager',await p.evaluate(()=>cur().s==='invoice'&&!/switched off|Admin only|Nothing to show/i.test(document.body.innerText)));
 if(w===390)await p.screenshot({path:process.argv[2]+'/so-mgr.png'});
 // staff tries to change own options: server must refuse
 if(w===390){await p.evaluate(()=>{DB.staffOpts[S.uid]={inv:true,appr:true};save();});await p.waitForTimeout(3000);}
 ok(w+' manager no errors',!e.length,e);await p.close();}
// 3 admin re-check server value + cross-role render
{const p=await b.newPage({viewport:{width:390,height:844}});const e=[];p.on('pageerror',x=>e.push(String(x)));await login(p,'sam@bikepharma.com','Test@1234');
 const o=await p.evaluate(k=>DB.staffOpts[k],K);ok('server kept Admin values (staff change refused)',o&&o.inv===false&&o.appr===false,o);
 const bad=await p.evaluate(()=>{const bad=[];const uid0=S.uid,u0=S.user;for(const r of ['billing','sales','manager','inventory','accountant']){S.user={...u0,role:r};S.uid='x-test';DB.staffOpts['x-test']={};OPT_ALL.forEach(o=>DB.staffOpts['x-test'][o[0]]=true);
   for(const o of OPT_ALL){const s=o[3][0];if(!SCREENS[s]){bad.push(r+':'+s+':noscreen');continue;}try{const h=SCREENS[s](s==='stockmove'?{type:'count'}:{});if(/Nothing to show here yet/.test(h))bad.push(r+':'+s+':empty');}catch(x){bad.push(r+':'+s+':'+x.message.slice(0,60));}}}
   delete DB.staffOpts['x-test'];S.user=u0;S.uid=uid0;return bad;});
 ok('every option screen renders for every role',!bad.length,bad);
 await p.evaluate(k=>{go('staffopts',{k});},K);await p.waitForTimeout(300);await p.locator('button',{hasText:'Reset to Manager options'}).click();await p.waitForTimeout(400);
 ok('reset clears changes',await p.evaluate(k=>optChanged(k,'manager').length===0,K));await p.waitForTimeout(2500);await p.close();}
console.log(out.join('\n'));await b.close()})()
