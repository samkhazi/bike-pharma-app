import {b,errs,mk,login,T,shot} from './lib.mjs';
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++;};const W=(p,t)=>p.waitForTimeout(t),one=s=>s.replace(/\n+/g,' | ');
const L=async(id,w)=>{const p=await mk(w,900);await login(p,id,'Test@1234');await W(p,2500);return p;};
const M=await L('mona@test.test',390);
// a real cancel through the sheet
const c=await M.evaluate(()=>DB.bills.find(x=>x.kind==="cxm").id);await M.evaluate(i=>go('billview',{id:i}),c);await W(M,400);

// a return of 1 cable from the first bill (as the return screen stores it)

const A=await L('owner@bikepharma.test',1440);
const t=await A.evaluate(()=>{const l=DB.bills.filter(x=>!x.cancel),sum=l.reduce((a,x)=>a+x.amt,0);let v=0,k=0;const ret={'INV-2026-00001':'17910-KST-940'};l.forEach(x=>x.items.forEach(i=>{const p=P(i.pid);let q=i.q;if(ret[x.id]===p.pn)q-=1;const c=DB.grns.some(g=>g.status==='posted'&&g.items.some(z=>z.pid===i.pid&&+z.rate>0))?60:Math.round(p.mp*.85)/1.18;v+=i.r/1.18*q;k+=c*q;}));return {n:l.length,sum,profit:v-k,cancel:DB.bills.filter(x=>x.cancel).length,suri:l.filter(x=>x.pushByN==='Suri').reduce((a,x)=>a+x.amt,0),inr:inr(sum),pi:inr(v-k)};});console.log(t);
ok(t.cancel===1,'cancel reached the server and the admin login');
const pg=async(p,s)=>{await p.evaluate(s=>{closeSheet();tab(s);},s);await W(p,600);return one(await T(p));};
let x=await pg(A,'ahome');ok(x.includes('Sales | '+t.inr+' | '+t.n+' bills · returns ₹105'),'admin home sales + returns: '+x.slice(60,200));ok(x.includes('Profit | '+t.pi),'admin home profit = hand sum '+t.pi+' / '+(x.match(/Profit \| [^|]*/)||[''])[0]);
x=await pg(A,'asales');ok(x.includes(t.inr)&&/returns ₹105/.test(x),'admin sales month');
for(const [n,p] of [['admin',A],['manager',M]]){if(n==='manager')await W(M,15000);x=await pg(p,'mgsales');const cat=[...x.split('By category')[1].split('By staff')[0].matchAll(/₹([\d,]+) \d+%/g)].reduce((a,m)=>a+ +m[1].replace(/,/g,''),0);ok(x.includes('TOTAL SALES | '+t.inr),n+' sales report total');ok(Math.abs(cat-t.sum)<=3,n+' categories add up: '+cat+' vs '+t.sum);ok(/By sales staff \|[^₹]*₹[\d,]+ \d+% \| Suri|By sales staff \| Suri/i.test(x)&&x.includes(await p.evaluate(v=>inr(v),t.suri)),n+' sales staff shown: ₹'+t.suri);
x=await pg(p,'mgstaff');ok(x.includes(t.n+' bills · ')&&new RegExp('Suri[^₹]*₹'+t.suri).test(x),n+' staff performance: '+x.slice(0,330));}
x=await pg(A,'mgmargin');ok(/without GST/i.test(x)&&/estimate/i.test(x),'margin page says without GST / estimate: '+x.slice(0,180));
x=await pg(A,'afinance');const pl=await A.evaluate(()=>{tab('acpl');const T=SCREENS.acpl();return T.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,160);});console.log('FIN',x.slice(0,330));console.log('ACPL',pl);const fin=(x.match(/Sales − purchases − expenses \| ([^|]+)/)||[])[1];ok(fin&&pl.replace(/\s/g,'').includes(fin.trim().replace(/\s/g,'')),'finance total = Accountant P&L: '+fin);
x=await pg(M,'dayclose');console.log('DAY',x.slice(0,330));ok(!/made-up/.test(x)&&await M.evaluate(()=>(S.ui.dcOpen??0)===0),'no made-up opening cash');
ok(errs.length===0,'no page errors '+errs.join(' | '));await b.close();console.log(f?f+' FAILED':'ALL OK');
