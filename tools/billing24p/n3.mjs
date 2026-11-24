import {b,errs,mk,boot,login,T,shot} from './lib.mjs';
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++;};const W=(p,t)=>p.waitForTimeout(t),one=s=>s.replace(/\n+/g,' | ');
const L=async id=>{const p=await mk(390,844);await login(p,id,'Test@1234');await W(p,2000);return p;};
const B=await L('bina@test.test'),D=await L('bindu@test.test'),X=await L('suri@test.test');
const st=p=>p.evaluate(()=>Object.fromEntries(PRODUCTS.map(x=>[x.pn,DB.stock[x.id]])));
const start=async(p,mob,pns,nm)=>{await p.evaluate(()=>{closeSheet();S.ui.inv=null;tab('invoice');});await W(p,500);if(mob){await p.fill('#inv-mob',mob);await p.locator('#inv-mob').blur();await W(p,400);}if(nm){await p.fill('#inv-cname',nm);await p.locator('#inv-cname').blur();}for(const q of pns){await p.fill('#inv-bc',q);await p.press('#inv-bc','Enter');await W(p,500);}};
const gen=p=>p.locator('.foot button',{hasText:/generate invoice/i}).click();const sh=p=>p.evaluate(()=>((document.querySelector('.sheet')||{}).innerText||'').replace(/\n+/g,' | '));
// name, S number, name search, reg, cash
await start(B,'8951860707',['17910KST940S','11394aah00099s'],'Samkhazi');
ok(await B.evaluate(()=>Object.keys(S.ui.inv.items).length===2),'Hero S numbers add in the invoice');
await B.fill('#inv-bc','horn');await B.press('#inv-bc','Enter');await W(B,500);ok(/Horn COMP/.test(await T(B)),'name search lists the horn');await shot(B,'n-name');
await B.locator('#vp button',{hasText:/^add$/i}).last().click();await W(B,600);
await B.fill('#inv-reg','ka17 hj 8791');await B.locator('#inv-reg').blur();await B.fill('#inv-cash','500');await B.locator('#inv-cash').blur();await W(B,500);
let t=one(await T(B));ok(/408\.50|Give back ₹91/.test(t),'cash: give back amount shown: '+(t.match(/Give back [^|]*|[^|]*still to take/)||[''])[0]);ok(/Round off/.test(t),'round off line: '+(t.match(/MRP total.*?Payment mode/)||[''])[0]);await shot(B,'n-inv');
await gen(B);await W(B,2500);ok(/INV-.*created/.test(await sh(B)),'bill made, sheet: '+(await sh(B)).slice(0,70));
await B.evaluate(()=>{closeSheet();go('invdoc',{id:DB.bills[0].id});});await W(B,500);t=one(await T(B));ok(/Samkhazi/.test(t)&&/KA17HJ8791/.test(t)&&/Cash received/.test(t)&&/Round off/.test(t)&&!/Other charges/.test(t)&&/Ranebennur jurisdiction/.test(t),'invoice shows name, bike, cash, round off');await shot(B,'n-doc');console.log(t.slice(150,900));
await start(B,'8951860707',[]);ok(await B.evaluate(()=>document.getElementById('inv-cname').value)==='Samkhazi','name remembered next time');
// scanner
await B.locator('.scanbox').click();await W(B,1500);ok(/Scan barcode or QR/.test(await sh(B))&&await B.evaluate(()=>!Object.keys(S.ui.inv.items).length),'scan box opens the scanner and adds nothing by itself');
ok(await B.evaluate(()=>{if(!APS)apScanOpen(),APS.bill=1;return invScanUse(['17910KST940S'])&&Object.keys(S.ui.inv.items).length===1;}),'a scanned Hero number adds that part');
ok(await B.evaluate(()=>{apScanOpen();APS.bill=1;const r=invScanUse(['9999999999']);apScanClose();return r===false&&Object.keys(S.ui.inv.items).length===1;}),'an unknown code adds nothing');
// two counters, last 2 injectors
await W(B,3000);for(const p of [B,D])await start(p,'9000000001',['16450-ACK-000','16450-ACK-000'],'Two Counter');
await Promise.all([gen(B),gen(D)]);await W(B,5000);const r=[await sh(B),await sh(D)];ok(r.filter(x=>/created/.test(x)).length===1&&r.filter(x=>/Bill not made/.test(x)).length===1,'two counters, last pieces: one bill, one refused: '+r.map(x=>x.slice(0,110)).join(' || '));await W(B,5000);
ok((await B.evaluate(()=>DB.bills.filter(x=>(x.items||[]).some(i=>P(i.pid).pn==='16450-ACK-000')).length))===1&&(await st(B))['16450-ACK-000']===0,'2 pieces sold, stock 0');
// quick double click
await start(B,'9000000002',['17910-KST-940'],'Dbl');const n0=await B.evaluate(()=>DB.bills.length);await B.evaluate(()=>{genInvoice(invTot(S.ui.inv));genInvoice(invTot(S.ui.inv));});await W(B,2500);ok(await B.evaluate(n=>DB.bills.length===n+1,n0),'double tap makes one bill');
// sales
const sales=async(mob,pns,nm,reg)=>{await X.evaluate(()=>{closeSheet();S.ui.inv=null;tab('snew');});await W(X,400);await X.fill('#sn-mob',mob);await X.locator('#sn-mob').blur();await W(X,400);if(nm){await X.fill('#sn-cname',nm);await X.locator('#sn-cname').blur();}if(reg){await X.fill('#sn-reg',reg);await X.locator('#sn-reg').blur();}for(const q of pns){await X.fill('#inv-bc',q);await X.press('#inv-bc','Enter');await W(X,500);}};
const push=async()=>{await X.locator('.foot button',{hasText:/push to invoice/i}).click();await W(X,2500);return X.evaluate(()=>DB.pushed[0].id);};
await W(X,4000);await sales('9000011122',['11394AAH00099S','11394-AAH-00099'],'Naya Grahak','KA27AB1234');t=one(await T(X));ok(/71\.25/.test(t)&&/₹143/.test(t),'sales sees price and total');await shot(X,'n-sales');
const id=await push();ok(await X.evaluate(()=>DB.pushed[0].inv.reg==='KA27AB1234'&&DB.pushed[0].inv.cname==='Naya Grahak'),'bike number and name go with the push');
await W(B,6500);await start(B,'9000000003',['11394-AAH-00099','11394-AAH-00099','11394-AAH-00099'],'Hold');ok(await B.evaluate(()=>Object.values(S.ui.inv.items)[0]===2&&/already pushed/.test(S.ui.inv.bcErr)),'pushed pieces are kept: '+await B.evaluate(()=>S.ui.inv.bcErr));
await B.evaluate(()=>{S.ui.inv=null;tab('invoice');});await W(B,500);ok(/Pending invoices/i.test(await T(B)),'pushed bill shows on the Invoice tab');
for(const p of [B,D]){await p.evaluate(i=>{closeSheet();S.ui.inv=null;pushOpen(i);},id);await W(p,600);}
await Promise.all([gen(B),gen(D)]);await W(B,5000);const q=[await sh(B),await sh(D)];ok(q.filter(x=>/created/.test(x)).length===1&&q.filter(x=>/pushed bill/.test(x)).length===1,'one push, two counters: one bill: '+q.map(x=>x.slice(0,100)).join(' || '));await W(B,5000);
for(const p of [B,D])await p.evaluate(()=>{closeSheet();S.ui.inv=null;});
ok(await B.evaluate(i=>DB.bills.filter(x=>x.push===i).length===1,id),'server has one bill for the push');
await B.evaluate(i=>go('invdoc',{id:DB.bills.find(x=>x.push===i).id}),id);await W(B,400);t=one(await T(B));ok(/Suri/.test(t)&&/KA27AB1234/.test(t)&&/Naya Grahak/.test(t),'pushed bill prints sales name, bike, customer');
// late second attempt after sync
await D.evaluate(i=>{const p=DB.pushed.find(x=>x.id===i);delete p.bill;pushOpen(i);},id);await W(D,400);if(await D.evaluate(()=>!!S.ui.inv)){await D.evaluate(()=>{const k=PRODUCTS[0].id;S.ui.inv.items={[k]:1};refresh();genInvoice(invTot(S.ui.inv));});await W(D,2000);ok(/already made/.test(await sh(D)),'late second bill of the same push refused: '+(await sh(D)).slice(0,80));}
await D.evaluate(()=>{closeSheet();S.ui.inv=null;});
// offline
await start(B,'9000000004',['17910-KST-940'],'Off');await B.context().setOffline(true);const n1=await B.evaluate(()=>DB.bills.length);await gen(B);await W(B,2000);ok(/Stock not checked/.test(await sh(B))&&await B.evaluate(n=>DB.bills.length===n,n1),'offline: asks first');await B.locator('.sheet button',{hasText:/make bill anyway/i}).click();await W(B,800);ok(await B.evaluate(n=>DB.bills.length===n+1,n1),'offline: bill on staff decision');await B.context().setOffline(false);await W(B,14000);ok(await D.evaluate(()=>DB.bills.some(x=>x.mob==='9000000004')),'offline bill reaches the other counter');
// admin + manager
for(const w of ['owner@bikepharma.test','mona@test.test']){const A=await L(w);await start(A,'9000000005',['17910-KST-940'],'Mgr');const n=await A.evaluate(()=>DB.bills.length);await gen(A);await W(A,2500);ok(/created/.test(await sh(A)),w+' can make a bill');await A.locator('.sheet button',{hasText:/^done$/i}).click();await W(A,600);ok(!/Admin only/.test(await T(A)),w+' Done goes to own home');await A.evaluate(()=>tab('bills'));await W(A,500);ok(/New invoice/i.test(await T(A)),w+' New invoice on Bills');if(w[0]==='o'){await A.evaluate(()=>tab('ahome'));await W(A,600);console.log('home',one(await T(A)).slice(0,230));const pr=await A.evaluate(()=>{const id=PRODUCTS.find(x=>x.pn==='17910-KST-940').id;DB.grns=[{id:'G',status:'posted',items:[{pid:id,q:1,rate:60}]}];grnRateMap.m=null;return nhProfit([{items:[{pid:id,q:2,r:118}]}]);});ok(pr.p===80&&pr.est===0,'profit: 2 x ₹118 incl. GST = 200 net, cost 2 x 60 = 120, profit 80: '+JSON.stringify(pr));}await A.close();}
await W(X,3000);ok(await X.evaluate(()=>{tab('invoice');return /Admin only/.test(document.querySelector('#vp .screen:last-child').innerText);}),'sales still cannot make the invoice');
// customer registers later: old bill name
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));await b.close();console.log(f?f+' FAILED':'ALL OK');
