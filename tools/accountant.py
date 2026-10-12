"""Accountant profile, update 8p (Sam 2026-10-12, thread "Accountant profile").

11:52Z "theek he eh sabhi add kardo": a new staff role, Accountant, with
 1. supplier payments: approved purchase orders (advance) and supplier bills, paid and marked with mode + UTR / cheque no.
 2. due alerts: supplier bills due in 3 days, today or late (bell + home card), as Admin has them
 3. mechanic udhaar: Billing's Mechanic outstanding + Receive payment screens, same data
 4. daily cash / UPI tally: Billing's Day closing and today's cash / UPI, same data
 5. expenses: rent, salary, electricity, tea... with paid by, date, note and a bill photo
 6. GST report: month's sales by HSN / rate (B2B, B2C), GST on purchase bills, CSV for the CA
 7. cash book: every rupee in and out for a day, Cash and Bank (UPI / bank / card / cheque) separately
The Accountant does not see margin or profit, cannot edit stock, make bills or set discounts. Approval stays with Admin.
"""

ACJS = r"""
/* ---------- Accountant profile (update 8p) ---------- */
const finRole=()=>!!S.user&&['admin','accountant'].includes(S.user.role);
const acIso=x=>x.iso||(/^\d{4}-\d\d-\d\d$/.test(String(x.d||''))?x.d:ddmmm2iso(x.d||''));
const acDd=iso=>new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
const acBank=m=>m==='Cash'?'Cash':'Bank';
const acMon=iso=>String(iso||'').slice(0,7);
const acMonName=m=>new Date(m+'-01T00:00:00').toLocaleDateString('en-IN',{month:'short',year:'numeric'});
const acMons=()=>{const d=new Date();return [0,1,2].map(k=>{const x=new Date(d.getFullYear(),d.getMonth()-k,1);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');});};
const acPayModes=['Cash','UPI','Bank','Cheque'];
function acModeChips(k,list=acPayModes){S.ui[k]=S.ui[k]||list[0];return `<div class="chips">${list.map(m=>`<button class="chip ${S.ui[k]===m?'on':''}" onclick="S.ui['${k}']='${m}';this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===this))">${m}</button>`).join('')}</div>`;}
const acNum=id=>r2(parseFloat(String((document.getElementById(id)||{}).value||'').replace(/[^\d.]/g,''))||0);
const acVal=id=>String((document.getElementById(id)||{}).value||'').trim();
/* advances paid on purchase orders count as paid to that supplier */
const supAdvAmt=n=>r2((DB.supAdv||[]).filter(a=>a.sup===n).reduce((s,a)=>s+(+a.amt||0),0));
const poAdv=id=>r2((DB.supAdv||[]).filter(a=>a.po===id).reduce((s,a)=>s+(+a.amt||0),0));
const acPOs=()=>(DB.pos||[]).filter(o=>['Sent','Received'].includes(o.status));

/* home */
SCREENS.achome=()=>{const sups0=sups(),owe=r2(sups0.reduce((a,s)=>a+supOut(s),0)),c=collected('Cash').total,u=collected('UPI').total,mo=acMon(isoToday()),ex=(DB.exp||[]).filter(x=>acMon(acIso(x))===mo).reduce((a,x)=>a+(+x.a||0),0),po=acPOs().filter(o=>!(poAdv(o.id)>0)&&o.d===today());
 return `<div class="scroll"><div class="pad">${staffHead()}${supDueCard()}
 <div class="grid2">${tileBtn(owe>0?'r':'g','We owe suppliers',inr(owe),sups0.filter(s=>supOut(s)>0).length+' supplier'+(sups0.filter(s=>supOut(s)>0).length===1?'':'s'),"go('asupp')")}${tileBtn('a','Mechanic credit',inr(allOut()),'to collect',"go('mechdues')")}
 ${tileBtn('g','Cash today',inr(c),'from bills & payments',"S.ui.cbd=null;go('accash')")}${tileBtn('b','UPI today',inr(u),'from bills & payments',"S.ui.cbd=null;go('accash')")}
 ${tileBtn('','Expenses',inr(ex),acMonName(mo),"go('acexp')")}${tileBtn('','Purchase orders',String(po.length),'approved today',"go('acpo')")}</div>
 <div class="card flush">${[['Supplier bills to pay','Pay and mark paid','rupee',"go('supdue')"],['Purchase orders','Pay an advance on an approved order','package',"go('acpo')"],['Receive credit payment','From a mechanic','wallet',"S.ui.rmech=null;S.ui.ramt=null;go('receive')"],['Day closing','Count cash, match with bills','lock',"go('dayclose')"],['Cash book','Every rupee in and out','receipt',"S.ui.cbd=null;go('accash')"],['Expenses','Rent, salary, bills','clip',"go('acexp')"],['GST report','Month summary · Excel for the CA','file',"go('acgst')"],['Suppliers','Khata of every supplier','truck',"go('asupp')"],['Credit reminders','WhatsApp to mechanics','chat',"go('acremind')"],['Salary & advance','Staff salary, advance cut','users',"go('acsal')"],['Refunds','Return money to give back','repeat',"go('acref')"],['Cheques','Received and given','file',"go('accheq')"],['Bank statement match','Upload the statement','upload',"go('acbank')"],['Export for CA','Tally · Zoho Books · Excel','download',"go('acexport')"],...(S.user.role==='admin'?[['Profit & loss','Month by month','chart',"go('acpl')"]]:[])].map(([t,s,i,o])=>li(t,s,'',i,o)).join('')}</div>
</div></div>`;};

/* 1. purchase orders: advance payment on an approved order */
SCREENS.acpo=()=>{const L=acPOs();return bar('Purchase orders')+`<div class="scroll"><div class="pad">
 <p class="cap">Orders sent to the supplier (Admin approved the big ones). If the supplier wants money first, pay an advance here; it is taken off that supplier's bills.</p>
 ${L.length?L.map(o=>{const adv=poAdv(o.id);return `<div class="card"><div class="row top"><div class="grow"><div class="h3">${esc(o.id)} · ${esc(o.supplier||'No supplier')}</div><div class="cap">${esc(o.d)} · by ${esc(o.by||'—')} · ${o.items.length} part${o.items.length>1?'s':''}</div>${o.ok?`<div class="cap">${esc(o.ok)}</div>`:''}</div><b class="num">${inr(o.est)}</b></div>
  <div class="row" style="justify-content:space-between;gap:8px"><span class="pill ${adv>0?'g':o.status==='Received'?'b':''}">${adv>0?'Advance '+inr(adv):o.status==='Received'?'Stock received':'Not paid'}</span><button class="btn sm ${adv>0?'line':''}" onclick="acAdvSheet('${esc(m2Q(o.id))}')">${ic('rupee','s16')} Pay advance</button></div></div>`;}).join(''):'<div class="empty">No approved purchase orders yet.</div>'}
</div></div>`;};
function acAdvSheet(id){const o=(DB.pos||[]).find(x=>x.id===id);if(!o)return;
 sheet(`<h3 class="h2">Advance · ${esc(o.id)}</h3><div class="cap">${esc(o.supplier||'')} · order ${inr(o.est)}${poAdv(id)?' · paid '+inr(poAdv(id)):''}</div>
 <div class="grid2"><div class="field"><label for="adv-a">Amount</label><div class="inp"><b>₹</b><input id="adv-a" inputmode="decimal" placeholder="0"></div></div>
 <div class="field"><label for="adv-d">Date</label><div class="inp"><input id="adv-d" type="date" value="${isoToday()}" max="${isoToday()}"></div></div></div>
 <div class="field"><label>Paid by</label>${acModeChips('advm')}</div>
 <div class="field"><label for="adv-r">Reference</label><div class="inp"><input id="adv-r" placeholder="UTR or cheque no. (optional)"></div></div>
 <div class="errmsg" id="adv-e"></div><button class="btn" onclick="acAdvSave('${esc(m2Q(id))}')">Save payment</button>`);}
function acAdvSave(id){const o=(DB.pos||[]).find(x=>x.id===id);if(!o)return;const a=acNum('adv-a'),d=/^\d{4}-\d\d-\d\d$/.test(acVal('adv-d'))?acVal('adv-d'):isoToday(),m=S.ui.advm||'Cash';
 if(!(a>0)){document.getElementById('adv-e').textContent='Enter the amount paid.';return;}
 (DB.supAdv=DB.supAdv||[]).unshift({id:'A'+Date.now().toString(36),po:id,sup:o.supplier||'',amt:a,d,mode:m,ref:acVal('adv-r').slice(0,40),by:S.user.sid||S.user.name});
 audit('Advance paid to supplier',(o.supplier||'')+' · '+id,'—',inr(a)+' · '+m);save();closeSheet();toast('Advance saved');refresh();}

/* 5. expenses */
SCREENS.acexp=()=>{const ms=acMons(),mo=S.ui.exm&&ms.includes(S.ui.exm)?S.ui.exm:ms[0],L=(DB.exp||[]).filter(x=>acMon(acIso(x))===mo),tot=L.reduce((a,x)=>a+(+x.a||0),0),by={};L.forEach(x=>by[x.c]=(by[x.c]||0)+(+x.a||0));
 return bar('Expenses',{action:`<button class="iconbtn" onclick="acExpAdd()" aria-label="Add expense">${ic('plus','s20')}</button>`})+`<div class="scroll"><div class="pad">
 <div class="chips">${ms.map(m=>`<button class="chip ${m===mo?'on':''}" onclick="S.ui.exm='${m}';refresh()">${acMonName(m)}</button>`).join('')}</div>
 <div class="card"><div class="kv big"><span>Spent in ${acMonName(mo)}</span><span>${inr(tot)}</span></div><div class="cap">${L.length} entr${L.length===1?'y':'ies'}</div>
 ${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([c,a])=>`<div class="stack" style="gap:4px"><div class="kv"><span>${esc(c)}</span><span>${inr(a)} · ${tot?Math.round(a/tot*100):0}%</span></div><div class="prog" style="height:6px"><i style="width:${tot?a/tot*100:0}%"></i></div></div>`).join('')}</div>
 <button class="btn" onclick="acExpAdd()">${ic('plus','s18')} Add expense</button>
 ${L.length?`<div class="card flush">${L.map(x=>{const i=DB.exp.indexOf(x);return `<div class="li"><div class="grow"><div class="t">${esc(x.c)} · ${inr(x.a)}</div><div class="s">${esc(acDd(acIso(x)))} · ${esc(x.pm||'Cash')}${x.n?' · '+esc(x.n):''}${x.by?' · '+esc(x.by):''}</div></div>${x.ph?`<a class="link" href="${esc(x.ph)}" target="_blank" rel="noopener">Bill photo</a>`:''}<button class="iconbtn" aria-label="Remove" onclick="acExpDel(${i})">${ic('trash','s18')}</button></div>`;}).join('')}</div>`:'<div class="empty">No expenses this month.</div>'}
</div></div>`;};
function acExpAdd(){S.ui.exPh=null;sheet(`<h3 class="h2">Add expense</h3><div class="grid2" id="ex-cats">${EXP_CATS.map(([c,i],k)=>`<button class="opt ${k===0?'on':''}" data-c="${c}" onclick="this.parentNode.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',o===this))">${ic(i,'s16')}${c}</button>`).join('')}<button class="opt" data-c="Other" onclick="this.parentNode.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',o===this))">${ic('plus','s16')}Other</button></div>
 <div class="grid2"><div class="field"><label for="ex-a">Amount</label><div class="inp"><b>₹</b><input id="ex-a" inputmode="decimal" placeholder="0"></div></div>
 <div class="field"><label for="ex-d">Date</label><div class="inp"><input id="ex-d" type="date" value="${isoToday()}" max="${isoToday()}"></div></div></div>
 <div class="field"><label>Paid by</label>${acModeChips('exmd')}</div>
 <div class="field"><label for="ex-n">Note</label><div class="inp"><input id="ex-n" placeholder="e.g. BESCOM bill, shop rent Oct"></div></div>
 <div class="field"><label for="ex-p">Bill photo (optional)</label><input id="ex-p" type="file" accept="image/*" onchange="acExpPhoto(this.files[0])"><div class="cap" id="ex-ps"></div></div>
 <div class="errmsg" id="ex-e"></div><button class="btn" id="ex-save" onclick="acExpSave()">Save expense</button>`);}
async function acExpPhoto(f){const s=document.getElementById('ex-ps'),b=document.getElementById('ex-save');if(!f)return;S.ui.exPh=null;
 if(f.size>25*1024*1024){s.textContent='This photo is too big (25 MB max)';return;}s.textContent='Uploading photo…';if(b)b.disabled=true;
 try{const r=await fetch('/api/photo?ai=off',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f,credentials:'same-origin'});if(r.status===401){srvExpired();return;}
  const j=await r.json().catch(()=>({}));if(!r.ok||!j.orig)throw new Error(j.error||'Photo not saved');S.ui.exPh=j.orig;s.textContent='Photo added ✓';}
 catch(e){s.textContent=String(e.message||e);}if(b)b.disabled=false;}
function acExpSave(){const a=acNum('ex-a'),iso=/^\d{4}-\d\d-\d\d$/.test(acVal('ex-d'))?acVal('ex-d'):isoToday(),o=document.querySelector('.sheet #ex-cats .opt.on');
 if(!(a>0)){document.getElementById('ex-e').textContent='Enter the amount.';return;}
 DB.exp=DB.exp||[];DB.exp.unshift({c:o?o.dataset.c:'Other',a,d:acDd(iso),iso,pm:S.ui.exmd||'Cash',n:acVal('ex-n').slice(0,80),ph:S.ui.exPh||'',by:S.user.name});
 audit('Expense added',o?o.dataset.c:'Other','—',inr(a));save();closeSheet();toast('Expense saved');refresh();}
function acExpDel(i){const x=(DB.exp||[])[i];if(!x)return;sheet(`<h3 class="h2">Remove this expense?</h3><div class="cap">${esc(x.c)} · ${inr(x.a)} · ${esc(acDd(acIso(x)))}</div><div class="grid2"><button class="btn line" onclick="closeSheet()">Keep</button><button class="btn" onclick="acExpDelOk(${i})">Remove</button></div>`);}
function acExpDelOk(i){const x=(DB.exp||[])[i];if(!x)return;DB.exp.splice(i,1);audit('Expense removed',x.c,inr(x.a),'—');save();closeSheet();toast('Removed');refresh();}

/* 7. cash book: one day, every rupee in and out */
function acBillIn(b){if(b.cancel)return [];const net=r2((+b.amt||0)-(+b.w||0));if(['Cash','UPI','Card','Bank','Cheque'].includes(b.pm))return [{m:b.pm,amt:net}];
 if(b.split&&typeof b.split==='object')return ['Cash','UPI','Card'].filter(k=>+b.split[k]>0).map(k=>({m:k,amt:+b.split[k]}));return [];}
function acBook(iso){const R=[];const add=(dir,m,amt,t,s)=>{if(+amt>0)R.push({dir,m,amt:r2(+amt),t,s:s||''});};
 (DB.bills||[]).filter(b=>acIso(b)===iso).forEach(b=>acBillIn(b).forEach(x=>add('in',x.m,x.amt,'Bill '+b.id,b.pname||b.p)));
 (DB.orec||[]).filter(x=>acIso(x)===iso).forEach(x=>add('in',x.pm,x.amt,'Credit payment received',(MECHS_R().find(m=>m.code===x.code)||{}).n||x.code));
 (DB.grns||[]).forEach(g=>(g.pays||[]).filter(p=>p.d===iso).forEach(p=>add('out',p.mode,p.amt,'Supplier bill '+(g.inv||g.id),g.supplier+(p.ref?' · '+p.ref:''))));
 (DB.supAdv||[]).filter(a=>a.d===iso).forEach(a=>add('out',a.mode,a.amt,'Advance '+a.po,a.sup+(a.ref?' · '+a.ref:'')));
 (DB.exp||[]).filter(x=>!x.nb&&acIso(x)===iso).forEach(x=>add('out',x.pm||'Cash',x.a,'Expense · '+x.c,x.n));
 (DB.salAdv||[]).filter(x=>x.d===iso).forEach(x=>add('out',x.mode,x.amt,'Salary advance',(ACC()[x.k]||{}).name||x.k));
 (DB.salPay||[]).filter(x=>x.d===iso).forEach(x=>add('out',x.mode,x.net,'Salary · '+acMonName(x.mo),((ACC()[x.k]||{}).name||x.k)+(x.adv?' · advance '+inr(x.adv)+' cut':'')));
 (DB.returns||[]).filter(x=>x.mode&&!['Wallet','Exchange'].includes(x.mode)&&(x.given?x.given.d:acIso(x))===iso).forEach(x=>add('out',x.given?x.given.mode:x.mode,x.amt,'Refund '+(x.id||''),'bill '+(x.bill||'')));
 (DB.cbook||[]).filter(x=>x.d===iso).forEach(x=>add(x.dir,x.m,x.amt,x.t,x.n));
 return R;}
SCREENS.accash=()=>{const iso=S.ui.cbd||isoToday(),R=acBook(iso),sum=(dir,b)=>r2(R.filter(x=>x.dir===dir&&acBank(x.m)===b).reduce((a,x)=>a+x.amt,0));
 const box=b=>{const i=sum('in',b),o=sum('out',b);return `<div class="card" style="gap:6px"><div class="h3">${b==='Cash'?'Cash':'Bank · UPI, card, cheque'}</div><div class="kv"><span>In</span><span style="color:var(--g)">+ ${inr(i)}</span></div><div class="kv"><span>Out</span><span style="color:var(--r)">− ${inr(o)}</span></div><div class="hr"></div><div class="kv big"><span>Net</span><span>${inr(r2(i-o))}</span></div></div>`;};
 return bar('Cash book',{action:`<button class="iconbtn" onclick="acCbAdd()" aria-label="Add entry">${ic('plus','s20')}</button>`})+`<div class="scroll"><div class="pad">
 <div class="row" style="justify-content:space-between"><button class="iconbtn line" aria-label="Previous day" onclick="S.ui.cbd=addDays('${iso}',-1);refresh()">${ic('chevL','s20')}</button><div class="h3">${esc(fmtD(iso))}</div><button class="iconbtn line" aria-label="Next day" ${iso>=isoToday()?'disabled':''} onclick="S.ui.cbd=addDays('${iso}',1);refresh()">${ic('chevR','s20')}</button></div>
 <div class="grid2">${box('Cash')}${box('Bank')}</div>
 <div class="grid2"><button class="btn line sm" onclick="acCbAdd()">${ic('plus','s16')} Add entry</button><button class="btn line sm" onclick="acCbCsv('${iso.slice(0,7)}')">${ic('download','s16')} Month in Excel</button></div>
 ${R.length?`<div class="card flush">${R.map(x=>`<div class="li"><div class="grow"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.m)}${x.s?' · '+esc(x.s):''}</div></div><b class="num" style="color:${x.dir==='in'?'var(--g)':'var(--r)'}">${x.dir==='in'?'+':'−'} ${inr(x.amt)}</b></div>`).join('')}</div>`:'<div class="empty">Nothing came in or went out on this day.</div>'}
 <p class="cap">Credit bills are not cash: they show here when the mechanic pays.</p>
</div></div>`;};
function acCbAdd(){S.ui.cbdir=null;S.ui.cbm=null;sheet(`<h3 class="h2">Add cash book entry</h3><p class="cap">For money that is not a bill, supplier payment or expense: owner's cash, bank deposit, loan, etc.</p>
 <div class="field"><label>Type</label>${acModeChips('cbdir',['In','Out','Cash to bank'])}</div>
 <div class="grid2"><div class="field"><label for="cb-a">Amount</label><div class="inp"><b>₹</b><input id="cb-a" inputmode="decimal" placeholder="0"></div></div>
 <div class="field"><label for="cb-d">Date</label><div class="inp"><input id="cb-d" type="date" value="${S.ui.cbd||isoToday()}" max="${isoToday()}"></div></div></div>
 <div class="field"><label>Mode</label>${acModeChips('cbm')}</div>
 <div class="field"><label for="cb-n">Note</label><div class="inp"><input id="cb-n" placeholder="e.g. cash deposited in bank"></div></div>
 <div class="errmsg" id="cb-e"></div><button class="btn" onclick="acCbSave()">Save</button>`);}
function acCbSave(){const a=acNum('cb-a'),d=/^\d{4}-\d\d-\d\d$/.test(acVal('cb-d'))?acVal('cb-d'):isoToday(),k=S.ui.cbdir||'In',n=acVal('cb-n').slice(0,80);
 if(!(a>0)){document.getElementById('cb-e').textContent='Enter the amount.';return;}DB.cbook=DB.cbook||[];
 if(k==='Cash to bank'){DB.cbook.unshift({d,dir:'out',m:'Cash',amt:a,t:'Cash to bank',n},{d,dir:'in',m:'Bank',amt:a,t:'Cash to bank',n});}
 else DB.cbook.unshift({d,dir:k==='In'?'in':'out',m:S.ui.cbm||'Cash',amt:a,t:k==='In'?'Money in':'Money out',n});
 audit('Cash book entry',k,'—',inr(a));save();closeSheet();toast('Saved');refresh();}
function acCbCsv(mo){const rows=[['Date','In/Out','Mode','Cash/Bank','Amount','Entry','Details']];const d=new Date(mo+'-01T00:00:00');
 while(acMon(isoToday())>=mo&&d.getMonth()===+mo.slice(5)-1){const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(iso>isoToday())break;
  acBook(iso).forEach(x=>rows.push([iso,x.dir==='in'?'In':'Out',x.m,acBank(x.m),x.amt,x.t,x.s]));d.setDate(d.getDate()+1);}
 acCsv('cash-book-'+mo,rows);}
function acCsv(k,rows){const q=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};const csv=rows.map(r=>r.map(q).join(',')).join('\n');const name='bike-pharma-'+k+'.csv';
 dlFile(name,'﻿'+csv);audit('Data exported',name,'—',rows.length-1+' rows');save();toast(rows.length-1+' rows · '+name);}

/* 6. GST report: sales from the month's bills (prices include GST), GST on purchase bills from Stock in */
const GST_DEF={'8714':18,'2710':18,'8512':18,'4011':18,'8708':18,'9987':18};
const gstRate=h=>{const v=(DB.gstRate||{})[h];return isFinite(+v)&&v!==''&&v!=null?+v:(GST_DEF[h]??18);};
function acGstLines(mo){const L=[];(DB.bills||[]).filter(b=>!b.cancel&&acMon(acIso(b))===mo&&(b.items||[]).length).forEach(b=>{const gross=b.items.reduce((a,i)=>a+(+i.r||0)*(+i.q||0),0)||1,f=(+b.amt||0)/gross,gst=mechGst(b),b2b=/^[0-9A-Z]{15}$/.test(String(gst).toUpperCase());
  b.items.forEach(i=>{const x=P(i.pid),h=x&&/^\d{4,8}$/.test(String(x.hsn||''))?String(x.hsn):HSN(x),rt=x&&+x.gst>0?+x.gst:gstRate(h),tot=r2((+i.r||0)*(+i.q||0)*f),tx=r2(tot-tot/(1+rt/100));L.push({b,iso:acIso(b),party:b.pname||b.p,gst:b2b?gst:'',h,rt,n:x?x.name:i.pid,q:i.q,tot,taxable:r2(tot-tx),tax:tx});});});return L;}
/* GST on a purchase bill: the bill's GST amount, else worked out from each item's own GST % (update 8c reads it from the bill) */
const acBuyTax=g=>+g.tax>0?+g.tax:r2((g.items||[]).reduce((a,it)=>a+(+it.gst>0&&+it.rate>0?(+it.q||0)*(+it.rate)*(1-(+it.disc>0?+it.disc:0)/100)*(+it.gst)/100:0),0));
function acGstBuy(mo){return (DB.grns||[]).filter(g=>g.status==='posted'&&acMon(g.bdate||g.iso||ddmmm2iso(g.date))===mo).map(g=>({g,amt:bpAmt(g),tax:acBuyTax(g)}));}
SCREENS.acgst=()=>{const ms=acMons(),mo=S.ui.agm&&ms.includes(S.ui.agm)?S.ui.agm:ms[0],L=acGstLines(mo),B=acGstBuy(mo),t=k=>r2(L.reduce((a,x)=>a+x[k],0));
 const b2b=L.filter(x=>x.gst),b2c=L.filter(x=>!x.gst),hs={};L.forEach(x=>{const k=x.h+'|'+x.rt;hs[k]=hs[k]||{h:x.h,rt:x.rt,v:0,tx:0};hs[k].v+=x.taxable;hs[k].tx+=x.tax;});
 const out=t('tax'),itc=r2(B.reduce((a,x)=>a+x.tax,0)),noTax=B.filter(x=>!(x.tax>0)).length,bills=new Set(L.map(x=>x.b.id)).size;
 return bar('GST report')+`<div class="scroll"><div class="pad">
 <div class="chips">${ms.map(m=>`<button class="chip ${m===mo?'on':''}" onclick="S.ui.agm='${m}';refresh()">${acMonName(m)}</button>`).join('')}</div>
 <div class="dark-card"><span class="micro" style="color:var(--ink3)">GST on sales · ${acMonName(mo)}</span><span class="amt" style="color:#fff">${inr(out)}</span><div class="cap" style="color:var(--ink3)">on ${inr(t('taxable'))} taxable · ${bills} bill${bills===1?'':'s'}</div></div>
 <div class="card"><div class="kv"><span>B2B · with GSTIN (${new Set(b2b.map(x=>x.b.id)).size})</span><span>${inr(r2(b2b.reduce((a,x)=>a+x.tot,0)))}</span></div><div class="kv"><span>B2C · others</span><span>${inr(r2(b2c.reduce((a,x)=>a+x.tot,0)))}</span></div><div class="hr"></div>
  <div class="kv"><span>CGST</span><span>${inr(r2(out/2))}</span></div><div class="kv"><span>SGST</span><span>${inr(r2(out/2))}</span></div></div>
 ${sec('By HSN')}<div class="card flush">${Object.values(hs).map(x=>li('HSN '+x.h+' · '+x.rt+'%','Taxable '+inr(r2(x.v)),`<b class="num">${inr(r2(x.tx))}</b>`,'tag','')).join('')||'<div class="empty">No bills this month.</div>'}</div>
 ${sec('Purchases (input GST)')}<div class="card"><div class="kv"><span>Supplier bills (${B.length})</span><span>${inr(r2(B.reduce((a,x)=>a+x.amt,0)))}</span></div><div class="kv"><span>GST on purchase bills</span><span>${inr(itc)}</span></div>${noTax?`<div class="cap">${noTax} bill${noTax>1?'s have':' has'} no GST amount entered.</div>`:''}<div class="hr"></div><div class="kv big"><span>GST to pay (approx.)</span><span>${inr(Math.max(0,r2(out-itc)))}</span></div></div>
 <div class="grid2"><button class="btn line sm" onclick="acGstCsv('${mo}','s')">${ic('download','s16')} Sales register</button><button class="btn line sm" onclick="acGstCsv('${mo}','p')">${ic('download','s16')} Purchase register</button></div>
 <button class="link" onclick="acGstRates()">GST % for parts without their own (change)</button>
 <p class="cap">Each part uses its own GST % (from its supplier bill); 18% only when it has none. Bill prices include GST. Check the final return with your CA.</p>
</div></div>`;};
function acGstCsv(mo,k){if(k==='s')acCsv('gst-sales-'+mo,[['Date','Bill','Party','GSTIN','HSN','Item','Qty','Rate %','Taxable','CGST','SGST','Total'],...acGstLines(mo).map(x=>[x.iso,x.b.id,x.party,x.gst,x.h,x.n,x.q,x.rt,x.taxable,r2(x.tax/2),r2(x.tax/2),x.tot])]);
 else acCsv('gst-purchases-'+mo,[['Bill date','Supplier','GSTIN','Bill no','Bill amount','GST'],...acGstBuy(mo).map(x=>[x.g.bdate||x.g.iso||'',x.g.supplier,x.g.gstin||((sups().find(s=>s.n===x.g.supplier)||{}).gst||''),x.g.inv||x.g.id,x.amt,x.tax])]);}
function acGstRates(){const H=[...new Set([...Object.keys(GST_DEF),...PRODUCTS.map(x=>HSN(x))])];
 sheet(`<h3 class="h2">GST rates</h3><p class="cap">Used only for a part that has no GST % of its own (a part gets its GST % from its supplier bill). Ask your CA if unsure.</p>${H.map(h=>`<div class="field"><label for="gr-${h}">HSN ${h}</label><div class="inp"><input id="gr-${h}" inputmode="decimal" value="${gstRate(h)}"><b>%</b></div></div>`).join('')}
 <button class="btn" onclick="acGstRatesSave()">Save</button>`);}
function acGstRatesSave(){const H=[...new Set([...Object.keys(GST_DEF),...PRODUCTS.map(x=>HSN(x))])];DB.gstRate=DB.gstRate||{};
 H.forEach(h=>{const v=parseFloat(acVal('gr-'+h));if(isFinite(v)&&v>=0&&v<=40)DB.gstRate[h]=v;});audit('GST rates changed','GST report','—',H.map(h=>h+' '+gstRate(h)+'%').join(', '));save();closeSheet();toast('Rates saved');refresh();}
/* ---------- update 8p, items 8-14 (Sam 11:57Z "8-14 sabhi implement kardo", "CA ke liye zoho aur tally dono") ---------- */
/* 8. supplier khata: every bill, payment, advance and debit note with the running balance */
function acLedger(n){const s=sups().find(x=>x.n===n)||{n,pay:0};const R=[];
 if(+s.pay>0)R.push({iso:'0000-00-00',t:'Old balance',cr:+s.pay,dr:0});
 supBills(n).forEach(g=>{const iso=g.bdate||g.iso||ddmmm2iso(g.date);R.push({iso,t:'Bill '+(g.inv||g.id),cr:bpAmt(g),dr:0});(g.pays||[]).forEach(p=>R.push({iso:p.d,t:'Paid · '+p.mode+(p.ref?' · '+p.ref:''),cr:0,dr:+p.amt||0}));});
 (DB.supAdv||[]).filter(a=>a.sup===n).forEach(a=>R.push({iso:a.d,t:'Advance · '+a.po+' · '+a.mode+(a.ref?' · '+a.ref:''),cr:0,dr:+a.amt||0}));
 (DB.sret||[]).filter(d=>d.sup===n).forEach(d=>R.push({iso:d.iso||ddmmm2iso(d.d||''),t:'Debit note '+(d.id||''),cr:0,dr:+d.amt||0}));
 R.sort((a,b)=>a.iso.localeCompare(b.iso));let bal=0;R.forEach(r=>{bal=r2(bal+r.cr-r.dr);r.bal=bal;});return R;}
SCREENS.acledger=p=>{const R=acLedger(p.n),bal=R.length?R[R.length-1].bal:0,qn=esc(m2Q(p.n));
 return bar('Khata · '+p.n)+`<div class="scroll"><div class="pad">
 <div class="card"><div class="kv big"><span>Balance (we owe)</span><span style="color:${bal>0?'var(--r)':'var(--g)'}">${inr(bal)}</span></div><div class="cap">Match this with the supplier's statement.</div></div>
 <button class="btn line sm" onclick="acCsv('khata-'+'${qn}'.replace(/\\W+/g,'-'),[['Date','Entry','Bill (we owe)','Paid','Balance'],...acLedger('${qn}').map(r=>[r.iso==='0000-00-00'?'':r.iso,r.t,r.cr||'',r.dr||'',r.bal])])">${ic('download','s16')} Khata in Excel</button>
 ${R.length?`<div class="card flush">${R.map(r=>`<div class="li"><div class="grow"><div class="t">${esc(r.t)}</div><div class="s">${r.iso==='0000-00-00'?'Before bills':esc(fmtD(r.iso))} · balance ${inr(r.bal)}</div></div><b class="num" style="color:${r.cr?'var(--r)':'var(--g)'}">${r.cr?'+ '+inr(r.cr):'− '+inr(r.dr)}</b></div>`).join('')}</div>`:'<div class="empty">No entries yet.</div>'}
</div></div>`;};

/* 9. staff salary and advance: an advance is cut from the next salary */
const acStaff=()=>Object.entries(ACC()).filter(([,a])=>a&&a.sid&&a.role!=='admin'&&a.role!=='mechanic'&&a.role!=='customer');
const salOf=k=>+((DB.sal||{})[k]||0);
const advDue=k=>(DB.salAdv||[]).filter(x=>x.k===k&&!x.cut);
const salPaid=(k,mo)=>(DB.salPay||[]).find(x=>x.k===k&&x.mo===mo);
SCREENS.acsal=()=>{const mo=acMon(isoToday()),L=acStaff();
 return bar('Salary & advance')+`<div class="scroll"><div class="pad">
 <div class="card"><div class="kv"><span>Salaries (${acMonName(mo)})</span><span>${inr(L.reduce((a,[k])=>a+salOf(k),0))}</span></div><div class="kv"><span>Advances not yet cut</span><span>${inr((DB.salAdv||[]).filter(x=>!x.cut).reduce((a,x)=>a+(+x.amt||0),0))}</span></div></div>
 ${L.length?L.map(([k,a])=>{const ad=advDue(k).reduce((s,x)=>s+(+x.amt||0),0),pd=salPaid(k,mo);return `<div class="card" style="gap:8px"><div class="row"><div class="tile k round">${esc(initials(a.name))}</div><div class="grow"><div class="h3">${esc(a.name)}</div><div class="cap">${esc(a.label||'')} · salary ${salOf(k)?inr(salOf(k)):'not set'} <button class="link" onclick="acSalSet('${esc(m2Q(k))}')">Change</button></div></div></div>
  ${ad?`<div class="cap">Advance taken: <b>${inr(ad)}</b> (cut from next salary)</div>`:''}${pd?`<div class="row cap" style="color:var(--g)">${ic('checkC','s16')} ${acMonName(mo)} paid ${inr(pd.net)}${pd.adv?' ('+inr(pd.adv)+' advance cut)':''} · ${esc(pd.mode)}</div>`:''}
  <div class="grid2"><button class="btn line sm" onclick="acAdvGive('${esc(m2Q(k))}')">Give advance</button><button class="btn sm" ${pd||!salOf(k)?'disabled':''} onclick="acSalPay('${esc(m2Q(k))}')">Pay ${acMonName(mo).split(' ')[0]} salary</button></div></div>`;}).join(''):'<div class="empty">No staff logins yet. Admin adds staff from Users › New staff login.</div>'}
</div></div>`;};
function acSalSet(k){const a=ACC()[k]||{};sheet(`<h3 class="h2">Salary · ${esc(a.name||k)}</h3><div class="field"><label for="sl-a">Monthly salary</label><div class="inp"><b>₹</b><input id="sl-a" inputmode="numeric" value="${salOf(k)||''}"></div></div><button class="btn" onclick="acSalSetOk('${esc(m2Q(k))}')">Save</button>`);}
function acSalSetOk(k){const v=acNum('sl-a');const o=salOf(k);DB.sal=DB.sal||{};DB.sal[k]=v;audit('Salary set',(ACC()[k]||{}).sid||k,o?inr(o):'—',inr(v));save();closeSheet();toast('Salary saved');refresh();}
function acAdvGive(k){const a=ACC()[k]||{};sheet(`<h3 class="h2">Advance · ${esc(a.name||k)}</h3>
 <div class="grid2"><div class="field"><label for="sa-a">Amount</label><div class="inp"><b>₹</b><input id="sa-a" inputmode="numeric" placeholder="0"></div></div><div class="field"><label for="sa-d">Date</label><div class="inp"><input id="sa-d" type="date" value="${isoToday()}" max="${isoToday()}"></div></div></div>
 <div class="field"><label>Paid by</label>${acModeChips('sam',['Cash','UPI','Bank'])}</div><div class="field"><label for="sa-n">Note</label><div class="inp"><input id="sa-n" placeholder="optional"></div></div>
 <div class="errmsg" id="sa-e"></div><button class="btn" onclick="acAdvGiveOk('${esc(m2Q(k))}')">Save advance</button>`);}
function acAdvGiveOk(k){const v=acNum('sa-a');if(!(v>0)){document.getElementById('sa-e').textContent='Enter the amount.';return;}const d=/^\d{4}-\d\d-\d\d$/.test(acVal('sa-d'))?acVal('sa-d'):isoToday();
 (DB.salAdv=DB.salAdv||[]).unshift({id:'SA'+Date.now().toString(36),k,amt:v,d,mode:S.ui.sam||'Cash',n:acVal('sa-n').slice(0,60),by:S.user.name});audit('Salary advance',(ACC()[k]||{}).sid||k,'—',inr(v));save();closeSheet();toast('Advance saved');refresh();}
function acSalPay(k){const a=ACC()[k]||{},mo=acMon(isoToday()),ad=advDue(k).reduce((s,x)=>s+(+x.amt||0),0),sal=salOf(k),cut=Math.min(ad,sal);
 sheet(`<h3 class="h2">${acMonName(mo)} salary · ${esc(a.name||k)}</h3><div class="card"><div class="kv"><span>Salary</span><span>${inr(sal)}</span></div><div class="kv"><span>Advance cut</span><span>− ${inr(cut)}</span></div><div class="hr"></div><div class="kv big"><span>To pay now</span><span>${inr(sal-cut)}</span></div></div>
 <div class="field"><label>Paid by</label>${acModeChips('spm',['Cash','UPI','Bank'])}</div><button class="btn" onclick="acSalPayOk('${esc(m2Q(k))}')">Mark paid</button>`);}
function acSalPayOk(k){const mo=acMon(isoToday());if(salPaid(k,mo))return closeSheet();const sal=salOf(k);let left=sal,cut=0;
 advDue(k).slice().reverse().forEach(x=>{if(left>=+x.amt){left-=+x.amt;cut+=+x.amt;x.cut=mo;}});const a=ACC()[k]||{},m=S.ui.spm||'Cash',iso=isoToday();
 (DB.salPay=DB.salPay||[]).unshift({k,mo,sal,adv:cut,net:sal-cut,d:iso,mode:m,by:S.user.name});
 DB.exp=DB.exp||[];DB.exp.unshift({c:'Salaries',a:sal,d:acDd(iso),iso,pm:m,n:(a.name||k)+' · '+acMonName(mo),by:S.user.name,nb:1});
 audit('Salary paid',a.sid||k,'—',inr(sal-cut)+(cut?' (advance '+inr(cut)+' cut)':''));save();closeSheet();toast('Salary paid');refresh();}

/* 10. refunds: a return is approved first (Manager / Admin, update 8n); the Accountant marks the money given back */
const acRefunds=()=>(DB.returns||[]).filter(r=>r.mode&&!['Wallet','Exchange'].includes(r.mode)&&+r.amt>0);
SCREENS.acref=()=>{const L=acRefunds(),w=(DB.approvals||[]).filter(a=>a.ret&&a.st==='pending'),due=L.filter(r=>!r.given);
 return bar('Refunds')+`<div class="scroll"><div class="pad">
 ${w.length?`${sec('Waiting for approval ('+w.length+')')}<div class="card flush">${w.map(a=>li(esc(a.t),esc(a.d),'<span class="pill a">Pending</span>','history','')).join('')}</div>`:''}
 ${sec('To give back ('+due.length+')')}${due.length?due.map(r=>`<div class="card"><div class="row"><div class="grow"><div class="h3">${esc(r.id)} · bill ${esc(r.bill)}</div><div class="cap">${esc(r.d)} · ${esc(r.why||'')} · by ${esc(r.mode)}</div></div><b class="num">${inr(r.amt)}</b></div><button class="btn sm" onclick="acRefGive('${esc(r.id)}')">Mark money given</button></div>`).join(''):'<div class="empty">Nothing to give back.</div>'}
 ${L.filter(r=>r.given).length?`${sec('Given')}<div class="card flush">${L.filter(r=>r.given).slice(0,20).map(r=>li(esc(r.id)+' · '+inr(r.amt),esc(fmtD(r.given.d))+' · '+esc(r.given.mode)+(r.given.ref?' · '+esc(r.given.ref):'')+' · '+esc(r.given.by),'','checkC','','g')).join('')}</div>`:''}
</div></div>`;};
function acRefGive(id){const r=(DB.returns||[]).find(x=>x.id===id);if(!r)return;S.ui.rfm=r.mode==='Cash'?'Cash':'UPI';
 sheet(`<h3 class="h2">Give back ${inr(r.amt)}</h3><div class="cap">${esc(r.id)} · bill ${esc(r.bill)}</div><div class="field"><label>Paid by</label>${acModeChips('rfm',['Cash','UPI','Bank'])}</div>
 <div class="field"><label for="rf-r">Reference</label><div class="inp"><input id="rf-r" placeholder="UTR (optional)"></div></div><button class="btn" onclick="acRefGiveOk('${esc(id)}')">Save</button>`);}
function acRefGiveOk(id){const r=(DB.returns||[]).find(x=>x.id===id);if(!r)return;r.given={d:isoToday(),mode:S.ui.rfm||'Cash',ref:acVal('rf-r').slice(0,40),by:S.user.name};
 audit('Refund given',r.id,'—',inr(r.amt)+' · '+r.given.mode);save();closeSheet();toast('Refund marked given');refresh();}

/* 11. cheques: received and given, cleared or bounced */
SCREENS.accheq=()=>{const L=DB.cheq||[],f=S.ui.chf||'Pending',V=L.filter(c=>f==='All'||c.st===f);
 return bar('Cheques',{action:`<button class="iconbtn" onclick="acChqAdd()" aria-label="Add cheque">${ic('plus','s20')}</button>`})+`<div class="scroll"><div class="pad">
 <div class="chips">${['Pending','Cleared','Bounced','All'].map(k=>`<button class="chip ${f===k?'on':''}" onclick="S.ui.chf='${k}';refresh()">${k} (${L.filter(c=>k==='All'||c.st===k).length})</button>`).join('')}</div>
 <button class="btn" onclick="acChqAdd()">${ic('plus','s18')} Add cheque</button>
 ${V.length?V.map(c=>{const i=L.indexOf(c),late=c.st==='Pending'&&c.d<isoToday();return `<div class="card" style="gap:8px"><div class="row"><div class="grow"><div class="h3">${c.dir==='in'?'From':'To'} ${esc(c.party)}</div><div class="cap">Cheque ${esc(c.no)}${c.bank?' · '+esc(c.bank):''} · dated ${esc(fmtD(c.d))}</div></div><b class="num" style="color:${c.dir==='in'?'var(--g)':'var(--r)'}">${inr(c.amt)}</b></div>
  <div class="row" style="justify-content:space-between;gap:8px"><span class="pill ${c.st==='Cleared'?'g':c.st==='Bounced'?'r':late?'a':''}">${c.st==='Pending'?(late?'Due · deposit / check':'Pending'):c.st+(c.sd?' · '+fmtD(c.sd):'')}</span>${c.st==='Pending'?`<span class="row" style="gap:6px"><button class="btn line sm" onclick="acChqSt(${i},'Bounced')">Bounced</button><button class="btn sm" onclick="acChqSt(${i},'Cleared')">Cleared</button></span>`:''}</div></div>`;}).join(''):'<div class="empty">No cheques here.</div>'}
</div></div>`;};
function acChqAdd(){S.ui.chd=null;sheet(`<h3 class="h2">Add cheque</h3><div class="field"><label>Type</label>${acModeChips('chd',['Received','Given'])}</div>
 <div class="field"><label for="cq-p">From / to</label><div class="inp"><input id="cq-p" placeholder="Mechanic, customer or supplier name"></div></div>
 <div class="grid2"><div class="field"><label for="cq-n">Cheque no.</label><div class="inp"><input id="cq-n" inputmode="numeric"></div></div><div class="field"><label for="cq-a">Amount</label><div class="inp"><b>₹</b><input id="cq-a" inputmode="decimal"></div></div></div>
 <div class="grid2"><div class="field"><label for="cq-b">Bank</label><div class="inp"><input id="cq-b" placeholder="optional"></div></div><div class="field"><label for="cq-d">Cheque date</label><div class="inp"><input id="cq-d" type="date" value="${isoToday()}"></div></div></div>
 <div class="errmsg" id="cq-e"></div><button class="btn" onclick="acChqSave()">Save</button>`);}
function acChqSave(){const a=acNum('cq-a'),p=acVal('cq-p'),no=acVal('cq-n'),e=document.getElementById('cq-e');if(!p||!no||!(a>0)){e.textContent='Enter name, cheque no. and amount.';return;}
 (DB.cheq=DB.cheq||[]).unshift({id:'CQ'+Date.now().toString(36),dir:S.ui.chd==='Given'?'out':'in',party:p.slice(0,60),no:no.slice(0,20),bank:acVal('cq-b').slice(0,40),amt:a,d:/^\d{4}-\d\d-\d\d$/.test(acVal('cq-d'))?acVal('cq-d'):isoToday(),st:'Pending'});
 audit('Cheque added',p+' · '+no,'—',inr(a));save();closeSheet();toast('Cheque saved');refresh();}
function acChqSt(i,st){const c=(DB.cheq||[])[i];if(!c)return;c.st=st;c.sd=isoToday();audit('Cheque '+st.toLowerCase(),c.party+' · '+c.no,'Pending',st);save();toast('Cheque '+st.toLowerCase());refresh();}

/* 12. cash handover: at the end of Day closing, Billing hands the cash to the Accountant, the Accountant confirms */
function acHandCard(){const L=(DB.handover||[]).filter(h=>h.d===isoToday());const r=S.user.role;
 return `${sec('Cash handover to Accountant')}<div class="card" style="gap:8px">${L.map((h,i)=>`<div class="row"><div class="grow"><div class="h3">${inr(h.amt)}</div><div class="cap">Given by ${esc(h.by)} at ${esc(h.at)}${h.rcv?' · received by '+esc(h.rcv)+' at '+esc(h.rcvAt):''}</div></div>${h.rcv?'<span class="pill g">Received</span>':['accountant','admin'].includes(r)?`<button class="btn sm" onclick="acHandOk('${esc(h.id)}')">Received</button>`:'<span class="pill a">Waiting</span>'}</div>`).join('')||'<div class="cap">No cash handed over today.</div>'}
 ${r!=='accountant'?`<div class="row" style="gap:8px"><div class="inp grow"><b>₹</b><input id="ho-a" inputmode="numeric" placeholder="Cash handed over"></div><button class="btn sm" onclick="acHand()">Hand over</button></div>`:''}</div>`;}
function acHand(){const v=acNum('ho-a');if(!(v>0)){toast('Enter the cash amount');return;}(DB.handover=DB.handover||[]).unshift({id:'HO'+Date.now().toString(36),d:isoToday(),amt:v,by:S.user.name,at:nowT()});
 audit('Cash handed over','Day closing','—',inr(v));save();toast('Handover saved · Accountant confirms');refresh();}
function acHandOk(id){const h=(DB.handover||[]).find(x=>x.id===id);if(!h)return;h.rcv=S.user.name;h.rcvAt=nowT();audit('Cash handover received',h.by,'—',inr(h.amt));save();toast('Received');refresh();}

/* 13. month P&L, Admin only */
SCREENS.acpl=()=>{const ms=acMons(),mo=S.ui.plm&&ms.includes(S.ui.plm)?S.ui.plm:ms[0],B=(DB.bills||[]).filter(b=>!b.cancel&&acMon(acIso(b))===mo),G=acGstLines(mo),P0=acGstBuy(mo),E=(DB.exp||[]).filter(x=>acMon(acIso(x))===mo);
 const sales=r2(B.reduce((a,b)=>a+(+b.amt||0),0)),stax=r2(G.reduce((a,x)=>a+x.tax,0)),pur=r2(P0.reduce((a,x)=>a+x.amt-x.tax,0)),ex=r2(E.reduce((a,x)=>a+(+x.a||0),0)),net=r2(sales-stax-pur-ex),by={};E.forEach(x=>by[x.c]=(by[x.c]||0)+(+x.a||0));
 return bar('Profit & loss')+`<div class="scroll"><div class="pad">
 <div class="chips">${ms.map(m=>`<button class="chip ${m===mo?'on':''}" onclick="S.ui.plm='${m}';refresh()">${acMonName(m)}</button>`).join('')}</div>
 <div class="dark-card"><span class="micro" style="color:var(--ink3)">Profit · ${acMonName(mo)}</span><span class="amt" style="color:${net>=0?'#7CD4A2':'#E8836F'}">${inr(net)}</span></div>
 <div class="card"><div class="kv"><span>Sales (${B.length} bills)</span><span>${inr(sales)}</span></div><div class="kv"><span>GST on sales</span><span>− ${inr(stax)}</span></div><div class="kv"><span>Purchases (${P0.length} supplier bills, without GST)</span><span>− ${inr(pur)}</span></div><div class="kv"><span>Expenses</span><span>− ${inr(ex)}</span></div><div class="hr"></div><div class="kv big"><span>Profit</span><span>${inr(net)}</span></div></div>
 ${Object.keys(by).length?`${sec('Expenses')}<div class="card">${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="kv"><span>${esc(c)}</span><span>${inr(v)}</span></div>`).join('')}</div>`:''}
 <p class="cap">Purchases are the supplier bills of this month, not the cost of the parts sold, so a month with big buying shows less profit.</p>
</div></div>`;};

/* 14. for the CA: Tally (XML import) and Zoho Books (CSV import) */
const xe=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const tDate=iso=>String(iso).replace(/-/g,'');
function acParty(b){return b.kind==='mech'?(b.pname||b.p):b.pm==='Credit'?(b.pname||b.p||'Sundry debtors'):'Cash';}
function acTally(mo){const V=[],le=(n,amt)=>`<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xe(n)}</LEDGERNAME><ISDEEMEDPOSITIVE>${amt<0?'Yes':'No'}</ISDEEMEDPOSITIVE><AMOUNT>${r2(amt).toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,bank=m=>m==='Cash'?'Cash':'Bank';
 const vch=(type,iso,no,party,ents,narr)=>V.push(`<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${type}" ACTION="Create"><DATE>${tDate(iso)}</DATE><VOUCHERTYPENAME>${type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xe(no)}</VOUCHERNUMBER><PARTYLEDGERNAME>${xe(party)}</PARTYLEDGERNAME><NARRATION>${xe(narr||'')}</NARRATION>${ents.join('')}</VOUCHER></TALLYMESSAGE>`);
 const G=acGstLines(mo),byB={};G.forEach(x=>{(byB[x.b.id]=byB[x.b.id]||[]).push(x);});
 Object.values(byB).forEach(L=>{const b=L[0].b,party=acParty(b),tot=r2(L.reduce((a,x)=>a+x.tot,0)),E=[le(party,-tot)],rt={};L.forEach(x=>{rt[x.rt]=rt[x.rt]||{v:0,t:0};rt[x.rt].v+=x.taxable;rt[x.rt].t+=x.tax;});
  Object.entries(rt).forEach(([r,o])=>{E.push(le('Sales @'+r+'%',r2(o.v)));E.push(le('Output CGST @'+(r/2)+'%',r2(o.t/2)));E.push(le('Output SGST @'+(r/2)+'%',r2(o.t-r2(o.t/2))));});
  const diff=r2(tot-Object.values(rt).reduce((a,o)=>a+r2(o.v)+r2(o.t/2)+r2(o.t-r2(o.t/2)),0));if(diff)E.push(le('Round off',diff));vch('Sales',L[0].iso,b.id,party,E,'Bike Pharma bill · '+b.pm);});
 acGstBuy(mo).forEach(({g,amt,tax})=>{const E=[le(g.supplier,amt),le('Purchase',-(r2(amt-tax)))];if(tax>0){E.push(le('Input CGST',-r2(tax/2)));E.push(le('Input SGST',-r2(tax-r2(tax/2))));}vch('Purchase',g.bdate||g.iso,g.inv||g.id,g.supplier,E,'Stock in '+g.id);});
 (DB.grns||[]).forEach(g=>(g.pays||[]).filter(p=>acMon(p.d)===mo).forEach(p=>vch('Payment',p.d,p.id,g.supplier,[le(g.supplier,-p.amt),le(bank(p.mode),p.amt)],'Bill '+(g.inv||g.id)+(p.ref?' · '+p.ref:''))));
 (DB.supAdv||[]).filter(a=>acMon(a.d)===mo).forEach(a=>vch('Payment',a.d,a.id,a.sup,[le(a.sup,-a.amt),le(bank(a.mode),a.amt)],'Advance '+a.po));
 (DB.exp||[]).filter(x=>acMon(acIso(x))===mo).forEach((x,i)=>vch('Payment',acIso(x),'EXP-'+mo+'-'+(i+1),x.c,[le(x.c,-x.a),le(bank(x.pm||'Cash'),+x.a)],x.n||''));
 (DB.orec||[]).filter(x=>acMon(acIso(x))===mo).forEach((x,i)=>{const n=(MECHS_R().find(m=>m.code===x.code)||{}).n||x.code;vch('Receipt',acIso(x),x.ref||('REC-'+mo+'-'+(i+1)),n,[le(n,+x.amt),le(bank(x.pm),-x.amt)],'Credit payment received');});
 return `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>\n${V.join('\n')}\n</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;}
function acZoho(mo,k){if(k==='inv')return [['Invoice Date','Invoice Number','Customer Name','GST Treatment','GSTIN','Place of Supply','Item Name','HSN/SAC','Quantity','Item Price','Item Tax %','Is Inclusive Tax','Payment Mode'],
  ...acGstLines(mo).map(x=>[x.iso,x.b.id,acParty(x.b)==='Cash'?'Walk-in customer':acParty(x.b),x.gst?'business_gst':'consumer',x.gst,'KA',x.n,x.h,x.q,r2(x.tot/(+x.q||1)),x.rt,'true',x.b.pm])];
 if(k==='bill')return [['Bill Date','Bill Number','Vendor Name','GSTIN','Account','Amount','Tax Amount','Total'],...acGstBuy(mo).map(({g,amt,tax})=>[g.bdate||g.iso,g.inv||g.id,g.supplier,g.gstin||((sups().find(s=>s.n===g.supplier)||{}).gst||''),'Cost of Goods Sold',r2(amt-tax),tax,amt])];
 if(k==='exp')return [['Expense Date','Expense Account','Amount','Paid Through','Notes'],...(DB.exp||[]).filter(x=>acMon(acIso(x))===mo).map(x=>[acIso(x),x.c,x.a,(x.pm||'Cash')==='Cash'?'Petty Cash':'Bank',x.n||''])];
 return [['Payment Date','Vendor Name','Bill Number','Amount','Paid Through','Reference'],...(DB.grns||[]).flatMap(g=>(g.pays||[]).filter(p=>acMon(p.d)===mo).map(p=>[p.d,g.supplier,g.inv||g.id,p.amt,p.mode==='Cash'?'Petty Cash':'Bank',p.ref||'']))];}
SCREENS.acexport=()=>{const ms=acMons(),mo=S.ui.xpm&&ms.includes(S.ui.xpm)?S.ui.xpm:ms[0];
 return bar('Export for CA')+`<div class="scroll"><div class="pad">
 <div class="chips">${ms.map(m=>`<button class="chip ${m===mo?'on':''}" onclick="S.ui.xpm='${m}';refresh()">${acMonName(m)}</button>`).join('')}</div>
 ${sec('Tally')}<div class="card flush">${li('Tally vouchers (XML)','Sales, purchase, payment and receipt vouchers · Gateway of Tally › Import › Vouchers','','download',`acTallyDl('${mo}')`,'n')}</div>
 <p class="cap">Ledgers used: Cash, Bank, Sales @18%, Output CGST @9%, Output SGST @9%, Purchase, Input CGST, Input SGST, Round off, each supplier, each mechanic and each expense head. The CA creates any that are missing in Tally first.</p>
 ${sec('Zoho Books')}<div class="card flush">${[['inv','Invoices (sales)'],['bill','Bills (purchases)'],['exp','Expenses'],['pay','Vendor payments']].map(([k,t])=>li(t,'CSV · Zoho Books › Import','','download',`acCsv('zoho-${k}-${mo}',acZoho('${mo}','${k}'))`,'n')).join('')}</div>
 ${sec('Excel')}<div class="card flush">${li('GST sales register','CSV','','download',`acGstCsv('${mo}','s')`,'n')}${li('GST purchase register','CSV','','download',`acGstCsv('${mo}','p')`,'n')}${li('Cash book','CSV','','download',`acCbCsv('${mo}')`,'n')}</div>
</div></div>`;};
function acTallyDl(mo){const x=acTally(mo);dlFile('bike-pharma-tally-'+mo+'.xml',x);audit('Data exported','Tally '+mo,'—',(x.match(/<VOUCHER /g)||[]).length+' vouchers');save();toast((x.match(/<VOUCHER /g)||[]).length+' vouchers · Tally file');}
/* ---------- 15. bank statement match (Sam 11:59Z): the bank's statement (CSV, or the .xls most banks give) against the cash book ---------- */
function acBkDate(s){s=String(s||'').trim();let m=/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/.exec(s);if(m){const y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');}
 m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);if(m)return m[0];m=/^(\d{1,2})[ \-]([A-Za-z]{3})[a-z]*[ \-,]*(\d{2,4})/.exec(s);if(m){const d=new Date(m[1]+' '+m[2]+' '+(m[3].length===2?'20'+m[3]:m[3]));if(!isNaN(d))return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}return '';}
function acCsvRows(t){const R=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
 else if(c==='"')q=true;else if(c===','||c==='\t'){row.push(f);f='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);R.push(row);row=[];f='';}else f+=c;}if(f||row.length){row.push(f);R.push(row);}return R;}
function acBkParse(text){let rows;if(/<table/i.test(text)){const d=new DOMParser().parseFromString(text,'text/html');rows=[...d.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));}else rows=acCsvRows(text);
 const hi=rows.findIndex(r=>r.some(c=>/date/i.test(c))&&r.some(c=>/withdraw|debit|deposit|credit|amount/i.test(c)));if(hi<0)return null;const H=rows[hi].map(c=>c.toLowerCase());
 const col=re=>H.findIndex(c=>re.test(c)),di=col(/date/),ni=col(/narration|description|particular|remark|details/),wi=col(/withdraw|debit|dr\b/),ci=col(/deposit|credit|cr\b/),ai=col(/^amount|amount\b/),ti=col(/dr\s*\/\s*cr|type/);
 const num=v=>parseFloat(String(v||'').replace(/[^\d.]/g,''))||0,out=[];
 rows.slice(hi+1).forEach(r=>{const d=acBkDate(r[di]);if(!d)return;let dr=wi>=0?num(r[wi]):0,cr=ci>=0?num(r[ci]):0;if(wi<0&&ci<0&&ai>=0){const v=num(r[ai]);if(/dr|debit/i.test(r[ti]||''))dr=v;else cr=v;}
  if(dr>0||cr>0)out.push({d,n:String(r[ni]||'').slice(0,80),dir:cr>0?'in':'out',amt:r2(cr>0?cr:dr)});});return out;}
function acBkMatch(L){if(!L.length)return null;const ds=L.map(x=>x.d).sort(),from=ds[0],to=ds[ds.length-1],O=[];
 for(let iso=from;iso<=to;iso=addDays(iso,1))acBook(iso).filter(x=>acBank(x.m)==='Bank').forEach(x=>O.push({...x,d:iso,used:0}));
 const dd=(a,b)=>Math.abs(bpDayN(a)-bpDayN(b));let mt=0;const unB=[];
 L.forEach(b=>{const o=O.filter(x=>!x.used&&x.dir===b.dir&&Math.abs(x.amt-b.amt)<0.5&&dd(x.d,b.d)<=2).sort((p,q)=>dd(p.d,b.d)-dd(q.d,b.d))[0];if(o){o.used=1;mt++;}else unB.push(b);});
 return {at:today()+' '+nowT(),by:S.user.name,from,to,lines:L.length,mt,unB:unB.slice(0,300),unO:O.filter(x=>!x.used).map(x=>({d:x.d,dir:x.dir,amt:x.amt,t:x.t,s:x.s})).slice(0,300)};}
async function acBkFile(f){if(!f)return;if(/\.xlsx$/i.test(f.name)){toast('Open it in Excel and "Save as" CSV, then upload the CSV');return;}
 const L=acBkParse(await f.text());if(!L||!L.length){toast('Could not read this statement. Save it as CSV and try again.');return;}
 DB.bankRec=acBkMatch(L);audit('Bank statement matched',f.name,'—',DB.bankRec.mt+' of '+L.length+' matched');save();refresh();}
SCREENS.acbank=()=>{const r=DB.bankRec;return bar('Bank statement match')+`<div class="scroll"><div class="pad">
 <p class="cap">Download the statement from net banking (CSV or Excel .xls) and upload it. Each bank line is matched with a UPI / bank / card entry of the same amount within 2 days.</p>
 <label class="btn" style="cursor:pointer">${ic('upload','s18')} Upload statement<input type="file" accept=".csv,.xls,.txt,text/csv" style="display:none" onchange="acBkFile(this.files[0])"></label>
 ${r?`<div class="card"><div class="kv big"><span>Matched</span><span style="color:var(--g)">${r.mt} of ${r.lines}</span></div><div class="cap">${esc(fmtD(r.from))} to ${esc(fmtD(r.to))} · checked ${esc(r.at)} by ${esc(r.by)}</div></div>
 ${sec('In the bank, not in our books ('+r.unB.length+')')}${r.unB.length?`<div class="card flush">${r.unB.map(x=>`<div class="li"><div class="grow"><div class="t">${esc(x.n||'—')}</div><div class="s">${esc(fmtD(x.d))}</div></div><b class="num" style="color:${x.dir==='in'?'var(--g)':'var(--r)'}">${x.dir==='in'?'+':'−'} ${inr(x.amt)}</b></div>`).join('')}</div>`:'<div class="empty">None 👍</div>'}
 ${sec('In our books, not in the bank ('+r.unO.length+')')}${r.unO.length?`<div class="card flush">${r.unO.map(x=>`<div class="li"><div class="grow"><div class="t">${esc(x.t)}</div><div class="s">${esc(fmtD(x.d))} · ${esc(x.s||'')}</div></div><b class="num" style="color:${x.dir==='in'?'var(--g)':'var(--r)'}">${x.dir==='in'?'+':'−'} ${inr(x.amt)}</b></div>`).join('')}</div>`:'<div class="empty">None 👍</div>'}`:''}
</div></div>`;};

/* ---------- 16. udhaar reminder on WhatsApp, one tap per mechanic ---------- */
function acRemText(m){const inv=mechInvs(m.code).filter(v=>v.amt>v.paid),od=inv.filter(isOverdue).length;
 return `Hello ${m.n}, ${inr(mechDue(m.code))} is due to Bike Pharma Automobiles (${inv.length} bill${inv.length===1?'':'s'}${od?', '+od+' overdue':''}). Please make the payment soon.${/^To be added/.test(SHOP.upi||'')?'':' UPI: '+SHOP.upi} Thank you.`;}
function acRemind(c){const m=MECHS_R().find(x=>x.code===c);if(!m)return;const d=String(m.mob||telOf(PARTY(c).ph)||'').replace(/\D/g,'');if(d.length<10)return toastWarn('No WhatsApp number on file for '+m.n);
 (DB.remind=DB.remind||{})[c]={d:isoToday(),by:S.user.name};audit('Credit reminder sent',c,'—',inr(mechDue(c)));save();
 extOpen('https://wa.me/'+(d.length===10?'91'+d:d)+'?text='+encodeURIComponent(acRemText(m)),'Opening WhatsApp…');refresh();}
SCREENS.acremind=()=>{const L=MECHS_R().filter(m=>mechDue(m.code)>0).sort((a,b)=>mechDue(b.code)-mechDue(a.code));
 return bar('Credit reminders')+`<div class="scroll"><div class="pad"><p class="cap">Tap Send: WhatsApp opens with the message ready; press send there.</p>
 ${L.length?`<div class="card flush">${L.map(m=>{const r=(DB.remind||{})[m.code],od=mechInvs(m.code).filter(v=>v.amt>v.paid&&isOverdue(v)).length;return `<div class="li"><div class="grow"><div class="t">${esc(m.n)} · ${inr(mechDue(m.code))}</div><div class="s">${od?od+' overdue · ':''}${r?'last reminder '+esc(fmtD(r.d)):'no reminder yet'}</div></div><button class="btn sm" onclick="acRemind('${esc(m.code)}')">${ic('chat','s16')} Send</button></div>`;}).join('')}</div>`:'<div class="empty">No mechanic has credit due.</div>'}
</div></div>`;};
"""

ACCESS_JS = r"""
LABEL.accountant='Accountant';HOME.accountant='achome';
NAVS.accountant=[['achome','Home','home'],['supdue','Pay','rupee'],['mechdues','Credit','wallet'],['accash','Cash book','receipt'],['saccount','Account','user']];
ACCESS.accountant=['achome','acpo','acexp','accash','acgst','acledger','acsal','acref','accheq','acexport','acbank','acremind','asupp','supbills','supdue','grnview','mechdues','pendpay','receive','dayclose','bills','billview','custview','usearch','saccount'];
ACCESS.admin.push('achome','acpo','acexp','accash','acgst','acledger','acsal','acref','accheq','acexport','acbank','acremind','acpl');
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, f'accountant.py: matched {c}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    sub("function allowed(s){", ACCESS_JS.strip() + "\nfunction allowed(s){")
    sub("const SCREENS={};\n", "const SCREENS={};\n" + ACJS.strip() + "\n")
    # the Accountant sees the supplier bill amounts and rates it pays
    sub("const seeRate=()=>!!S.user&&S.user.role==='admin';", "const seeRate=()=>!!S.user&&['admin','accountant'].includes(S.user.role);")
    # supplier bill alerts (bell + home card) for Admin and Accountant
    sub("S.user.role==='admin'&&supAlerts().length", "finRole()&&supAlerts().length")
    sub("if(!S.user||S.user.role!=='admin')return '';const n=supAlerts()", "if(!finRole())return '';const n=supAlerts()")
    # advances on purchase orders are paid to the supplier
    sub("const supOut=s=>r2(supBills(s.n).reduce((a,g)=>a+bpBal(g),0)+(+s.pay||0));",
        "const supOut=s=>r2(supBills(s.n).reduce((a,g)=>a+bpBal(g),0)+(+s.pay||0)-supAdvAmt(s.n));")
    sub("${dn.length?`<div class=\"cap\">${dn.length} debit note${dn.le",
        "${supAdvAmt(s.n)>0?`<div class=\"kv\"><span>Advance paid on orders</span><span>− ${inr(supAdvAmt(s.n))}</span></div>`:''}${dn.length?`<div class=\"cap\">${dn.length} debit note${dn.le")
    # new staff login / change role: Accountant
    sub("['Billing','Sales','Manager','Inventory']", "['Billing','Sales','Manager','Inventory','Accountant']", 2)
    sub("Billing:'BIL',Sales:'SAL',Manager:'MGR',Inventory:'INV'", "Billing:'BIL',Sales:'SAL',Manager:'MGR',Inventory:'INV',Accountant:'ACC'")
    sub("Inventory:'inventory'}", "Inventory:'inventory',Accountant:'accountant'}")
    sub("['billing','sales','manager','inventory','admin']", "['billing','sales','manager','inventory','accountant','admin']", 2)
    sub("inventory:['package','n'],", "inventory:['package','n'],accountant:['rupee','g'],")
    sub("inventory:'Stock in/out · GRN · Counts',", "inventory:'Stock in/out · GRN · Counts',accountant:'Supplier payments · Credit · Expenses · GST',")
    sub("inventory:[parts],", "inventory:[parts],accountant:[cust,mech,inv],")
    sub("inventory:'parts only',", "inventory:'parts only',accountant:'customers, mechanics, invoices',")
    # computer sidebar
    sub(" admin:[['findpart','Find Part','pin',\"go('findpart')\"],['ainv'",
        " accountant:[['acpo','Purchase orders','package',\"go('acpo')\"],['acremind','Credit reminders','chat',\"go('acremind')\"],['acsal','Salary & advance','users',\"go('acsal')\"],['acref','Refunds','repeat',\"go('acref')\"],['accheq','Cheques','file',\"go('accheq')\"],['acbank','Bank statement match','upload',\"go('acbank')\"],['acexport','Export for CA','download',\"go('acexport')\"],['acexp','Expenses','clip',\"go('acexp')\"],['acgst','GST report','file',\"go('acgst')\"],['asupp','Suppliers','truck',\"go('asupp')\"],['dayclose','Day closing','lock',\"go('dayclose')\"],['receive','Receive payment','wallet',\"S.ui.rmech=null;S.ui.ramt=null;go('receive')\"]],\n admin:[['findpart','Find Part','pin',\"go('findpart')\"],['achome','Accounts','rupee',\"go('achome')\"],['ainv'")
    # supplier page: khata (ledger)
    sub("${L.length?L.map(supBillCard).join('')", "<button class=\"btn line sm\" onclick=\"go('acledger',{n:'${qn}'})\">${ic('file','s16')} Khata / statement</button>\n ${L.length?L.map(supBillCard).join('')")
    # Day closing ends with the cash handover to the Accountant
    sub("\n</div></div><div class=\"foot\"><button class=\"btn\" onclick=\"dcSave(", "\n ${acHandCard()}\n</div></div><div class=\"foot\"><button class=\"btn\" onclick=\"dcSave(")
    return a, n
