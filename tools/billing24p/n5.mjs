import {b,errs,mk,login,T,shot} from './lib.mjs';
const W=(p,t)=>p.waitForTimeout(t),one=s=>s.replace(/\n+/g,' | ');
const L=async(id,w)=>{const p=await mk(w,900);await login(p,id,'Test@1234');await W(p,2500);return p;};
const A=await L('owner@bikepharma.test',1440),M=await L('mona@test.test',390);
console.log('TRUTH',JSON.stringify(await A.evaluate(()=>{const l=DB.bills.filter(x=>!x.cancel),s=f=>l.filter(f).reduce((a,x)=>a+x.amt,0);return {all:DB.bills.length,live:l.length,sum:s(()=>1),cash:s(x=>x.pm==='Cash'),cust:s(x=>x.kind==='cust'),cxm:s(x=>x.kind==='cxm'),mech:s(x=>x.kind==='mech'),by:Object.fromEntries([...new Set(l.map(x=>x.byN))].map(n=>[n,s(x=>x.byN===n)])),sales:s(x=>x.pushByN==='Suri'),cancelled:DB.bills.filter(x=>x.cancel).map(x=>x.amt),items:l.flatMap(x=>x.items).reduce((o,i)=>{const n=P(i.pid).pn;o[n]=(o[n]||0)+i.q;return o;},{})};})));
for(const [n,p,L2] of [['ADMIN',A,['ahome','asales','mgsales','mgmargin','mgsummary','afinance','mfin','bills','mgstaff','mgtarget','atargets','agst','aopts','mgstock','aorders']],['MANAGER',M,['mghome','mgsales','mgsummary','bills','mgstaff','mgtarget','dayclose','mgopts','team']]])for(const s of L2){await p.evaluate(s=>{closeSheet();tab(s);},s);await W(p,700);console.log('['+n+' '+s+']',one(await T(p)).slice(0,1000));}
await A.evaluate(()=>{S.ui.mgp='month';go('mgsales');});await W(A,500);console.log('[ADMIN mgsales month]',one(await T(A)).slice(0,700));
console.log(errs);await b.close();
