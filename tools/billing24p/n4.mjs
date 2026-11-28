import {b,errs,mk,login,boot,T,shot} from './lib.mjs';
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++;};const W=(p,t)=>p.waitForTimeout(t),one=s=>s.replace(/\n+/g,' | ');
const L=async(id,w=390)=>{const p=await mk(w,844);await login(p,id,'Test@1234');await W(p,2000);return p;};const sh=p=>p.evaluate(()=>((document.querySelector('.sheet')||{}).innerText||'').replace(/\n+/g,' | '));
const gen=async p=>{await p.locator('.foot button',{hasText:/generate invoice/i}).click();await W(p,2500);return sh(p);};
const B=await L('bina@test.test'),X=await L('suri@test.test');
// new mechanic via sales push, then billing
await X.evaluate(()=>{S.ui.inv=null;tab('snew');snParty('mech');});await W(X,500);await X.fill('#sn-mmob','9111122222');await X.locator('#sn-mmob').blur();await W(X,400);await X.fill('#inv-bc','17910KST940S');await X.press('#inv-bc','Enter');await W(X,600);
ok(/93\.50/.test(await T(X)),'sales + mechanic: mechanic price shown');await X.locator('.foot button',{hasText:/push to invoice/i}).click();await W(X,2500);const id=await X.evaluate(()=>DB.pushed[0].id);await W(B,7000);
await B.evaluate(i=>{S.ui.inv=null;pushOpen(i);},id);await W(B,600);await B.evaluate(()=>{Object.assign(S.ui.inv.nm,{name:'Raju',shop:'Raju Garage',area:'RNR'});refresh();});await W(B,300);const s1=await gen(B);ok(/created/.test(s1)&&/Raju Garage/.test(s1),'new mechanic bill from a push: '+s1.slice(0,120));
// customer + mechanic via sales
await W(X,8000);await X.evaluate(()=>{closeSheet();S.ui.inv=null;tab('snew');snParty('cxm');});await W(X,500);await X.fill('#sn-mob','8951860707');await X.locator('#sn-mob').blur();await W(X,300);await X.fill('#sn-mmob','9111122222');await X.locator('#sn-mmob').blur();await W(X,400);await X.fill('#inv-bc','17910-KST-940');await X.press('#inv-bc','Enter');await W(X,600);await X.locator('.foot button',{hasText:/push to invoice/i}).click();await W(X,2500);const id2=await X.evaluate(()=>DB.pushed[0].id);await W(B,7000);
await B.evaluate(i=>{closeSheet();S.ui.inv=null;pushOpen(i);},id2);await W(B,600);const s2=await gen(B);ok(/₹11 commission/.test(s2),'customer + mechanic: 104.50 - 93.50 = ₹11 commission: '+s2.slice(0,150));
// cancel and return put stock back
await W(B,6000);const A=await L('mona@test.test');const bid=await A.evaluate(()=>DB.bills[0].id),s0=await A.evaluate(()=>DB.stock[DB.bills[0].items[0].pid]);
console.log('cancel fn',await A.evaluate(()=>typeof billCancel));await A.evaluate(i=>{closeSheet();go('billview',{id:i});},bid);await W(A,500);console.log(one(await T(A)).slice(-260));
await A.evaluate(i=>billCancel(i,{why:'test',by:S.user.name}),bid);await W(A,2500);ok(await A.evaluate(([i,n])=>{const x=DB.bills.find(y=>y.id===i);return !!x.cancel&&DB.stock[x.items[0].pid]===n+1;},[bid,s0]),'cancelled bill: piece back in stock');
ok(errs.length===0,'no page errors '+errs.join(' | '));await b.close();console.log(f?f+' FAILED':'ALL OK');
