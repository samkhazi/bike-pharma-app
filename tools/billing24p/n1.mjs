import {b,errs,mk,login,T,shot} from './lib.mjs';
const A=await mk(1440,900);await login(A,'owner@bikepharma.test','Test@1234');
for(const [r,n,e] of [['Billing','Bina','bina@test.test'],['Manager','Mona','mona@test.test'],['Inventory','Indu','indu@test.test'],['Sales','Suri','suri@test.test'],['Billing','Bindu','bindu@test.test']]){
 await A.evaluate(r=>{S.ui.ns=null;go('newstaff');S.ui.ns.role=r;refresh();},r);await A.waitForTimeout(300);
 await A.fill('#ns1',n);await A.fill('#ns2',e);await A.fill('#ns3','Test@1234');await A.click('#vp .screen:last-child .foot .btn');await A.waitForTimeout(900);await A.evaluate(()=>closeSheet());}
console.log('accounts',await A.evaluate(()=>Object.entries(DB.accounts).map(([k,a])=>k+':'+a.role)));await A.waitForTimeout(2500);
await b.close();