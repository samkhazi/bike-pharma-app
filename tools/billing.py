"""Billing profile, update 8o (Sam 2026-10-12, thread "Billing profile").

11:36Z "discount ... eh nhi chahiye q ki jo discount me set kiya hua rehta hun ohi final he usme kuch bargain nhi rahega q ki eh
automobile ka business he", 11:37Z "warrenty claim ke liye request bhejne ka ek option dedo jo manager ya admin attend karenge ya phir
under warrenty rha toh o khud usko claim karke degi", 11:40Z "haan sabhi implement kardo" (the list: bill cancel / change only through
Manager, hold, split cash + UPI + udhaar, mechanic credit limit check, estimate to bill, WhatsApp bill).

- No bargaining: the bill has no extra discount box and no discount request; the price Admin set (customer price, mechanic price) is final.
- Warranty claim (Billing, Manager, Admin): find the bill by mobile, bill or part number. In warranty: Billing gives the replacement
  itself (a Rs 0 "Warranty" bill, the old part waits to go to the company). Warranty over or not sure: a request with a note and photos
  goes to Manager and Admin; once approved Billing gives the replacement.
- Bill cancel / change: Billing asks with a reason, Manager or Admin approves; then stock comes back, udhaar and wallet are undone,
  warranties are removed, and for a change Billing makes the corrected bill from the old one.
- Split: cash, UPI and (mechanic) udhaar amounts that must add up to the bill; the cash and UPI parts count in Cash / UPI collected.
- Udhaar above the mechanic's credit limit, or with an overdue bill, needs Manager's OK for that amount.
- Estimate keeps its parts; "Make bill" turns it into the invoice. The bill-made sheet has a WhatsApp button.
"""

BLJS = r"""
/* ---------- Billing profile (update 8o): fixed prices, warranty claims, bill cancel / change requests, split, udhaar limit ---------- */
const blMgr=()=>!!S.user&&['manager','admin'].includes(S.user.role);
const blNum=v=>Math.max(0,Math.round(+String(v??'').replace(/[^\d.]/g,'')||0));
/* split: cash + UPI + udhaar (mechanic only), must add up to the amount to pay */
const blSplit=inv=>{const s=inv.sp||{};return {Cash:blNum(s.cash),UPI:blNum(s.upi),Credit:inv.party==='mech'?blNum(s.cr):0};};
function blCredAmt(inv,tot){const due=tot-invWallet(inv,tot).use;if(inv.pm==='Credit')return due;
 if(inv.pm==='Split'){const s=blSplit(inv);if(s.Cash+s.UPI+s.Credit!==due){toast('Split amounts must add up to '+inr(due));return null;}return s.Credit;}return 0;}
/* udhaar above the credit limit or with an overdue bill: Manager allows that amount first */
function blCredNeed(code,amt){if(!code||code==='new'||!(amt>0))return '';const od=overdueOf(code).length;if(od)return od+' overdue bill'+(od>1?'s':'')+' not cleared';
 const v=vInfo(code);if(v&&mechDue(code)+amt>v.limit)return 'Outstanding '+inr(mechDue(code))+' + this '+inr(amt)+' is above the '+inr(v.limit)+' limit';return '';}
const blCredOk=(inv,code,amt)=>{if(!blCredNeed(code,amt))return true;const q=(DB.crReq||{})[inv.crReq];return !!q&&q.st==='approved'&&q.mc===code&&amt<=q.amt;};
function blCredAsk(amt){const inv=S.ui.inv;const code=inv.mc||MC0();const m=MECHS_R().find(x=>x.code===code)||{n:code};DB.crReq=DB.crReq||{};const id='CR-'+(101+Object.keys(DB.crReq).length);
 DB.crReq[id]={mc:code,amt,st:'pending',by:S.user.name};inv.crReq=id;
 DB.approvals.unshift({id:Date.now(),t:'Udhaar above limit · '+esc(m.n),d:esc(S.user.name)+' · '+code+' · '+inr(amt)+' udhaar · '+blCredNeed(code,amt),ic:'alert',st:'pending',cr:id,by:S.user.name});
 save();toast('Sent to Manager for approval');refresh();}
function blPayCards(inv,tot,mech){const due=tot-invWallet(inv,tot).use;let h='';
 if(inv.pm==='Split'){const s=blSplit(inv),left=due-s.Cash-s.UPI-s.Credit;const f=(k,l,id)=>`<div class="field"><label for="${id}">${l}</label><div class="inp"><b>₹</b><input id="${id}" inputmode="numeric" value="${(inv.sp||{})[k]||''}" placeholder="0" onchange="(S.ui.inv.sp=S.ui.inv.sp||{}).${k}=this.value;refresh()"></div></div>`;
  h+=`<div class="card" style="gap:8px"><div class="sec"><span class="h3">Split payment</span><span class="cap">To pay ${inr(due)}</span></div><div class="grid${mech?3:2}">${f('cash','Cash','sp-c')}${f('upi','UPI','sp-u')}${mech?f('cr','Udhaar','sp-r'):''}</div>
  <div class="cap" style="color:${left?'var(--r)':'var(--g)'}">${left>0?inr(left)+' still to split':left<0?inr(-left)+' more than the bill':'Adds up ✓'}</div></div>`;}
 const cr=mech&&(inv.pm==='Credit'?due:inv.pm==='Split'?blSplit(inv).Credit:0);const code=inv.mc||MC0();const why=cr?blCredNeed(code,cr):'';
 if(why){const q=(DB.crReq||{})[inv.crReq];const okq=q&&q.mc===code&&cr<=q.amt;
  h+=`<div class="card" style="border:1.5px solid var(--amber);gap:8px"><div class="row cap" style="color:var(--amber)">${ic('alert','s16')}<span class="grow">${why}. Manager has to allow this udhaar.</span></div>
  ${okq?`<div class="row" style="border-radius:12px;padding:10px 12px;background:${q.st==='approved'?'var(--g-soft)':q.st==='rejected'?'var(--r-soft)':'var(--amber-soft)'}"><span class="cap grow"><b>${inv.crReq} · ${q.st==='approved'?'Allowed · you can make the bill':q.st==='rejected'?'Not allowed · take Cash / UPI':'Waiting for Manager'}</b></span></div>`
   :`<button class="btn line sm" style="width:100%" onclick="blCredAsk(${cr})">${ic('lock','s16')}Ask Manager to allow ${inr(cr)} udhaar</button>`}</div>`;}
 return h;}
/* estimate -> bill */
function estCard(){const L=(DB.ests||[]).filter(e=>e.inv&&!e.used).slice(0,5);if(!L.length)return '';
 return `${sec('Estimates')}<div class="card flush">${L.map(e=>li(e.id+' · '+(e.inv.party==='mech'?'Mechanic':e.inv.mob?'+91 '+esc(e.inv.mob):KIND_L[e.inv.party]||'Customer'),e.d+' · '+e.n+' part'+(e.n===1?'':'s')+' · '+inr(e.tot),'<span class="pill b">Make bill</span>','file',`estToBill('${e.id}')`)).join('')}</div>`;}
function estToBill(id){const e=(DB.ests||[]).find(x=>x.id===id);if(!e||!e.inv)return;if(S.ui.inv&&Object.values(S.ui.inv.items||{}).some(q=>q>0)){toast('Hold or finish the current bill first');return;}
 const inv=JSON.parse(JSON.stringify(e.inv));delete inv.disc;delete inv.discReq;delete inv.crReq;let cut=0;const it={};
 Object.entries(inv.items||{}).forEach(([k,q])=>{const n=Math.min(q,DB.stock[k]||0);if(n<q)cut++;if(n>0)it[k]=n;});inv.items=it;inv.est=e.id;inv.bc='';inv.bcErr='';S.ui.inv=inv;
 tab('invoice');toast(cut?id+' loaded · '+cut+' part'+(cut>1?'s':'')+' short in stock':id+' loaded · check and make the bill');}
/* bill cancel / change: Billing asks, Manager or Admin approves */
function brSheet(bid){const b=DB.bills.find(x=>x.id===bid);if(!b)return;S.ui.br={type:'Cancel',why:''};brDraw(b);}
function brDraw(b){const r=S.ui.br;sheet(`<h3 class="h2">Cancel or change ${esc(b.id)}</h3><p class="cap">${esc(b.pname||b.p)} · ${inr(b.amt)} · ${b.pm}</p>
 <div class="grid2">${[['Cancel','Cancel the bill'],['Change','Change the bill']].map(([k,l])=>`<button class="opt ${r.type===k?'on':''}" onclick="S.ui.br.type='${k}';brDraw(DB.bills.find(x=>x.id==='${esc(b.id)}'))"><span class="radio"></span>${l}</button>`).join('')}</div>
 <div class="field"><label for="br-why">Reason</label><div class="inp"><input id="br-why" value="${esc(r.why)}" placeholder="${r.type==='Change'?'e.g. wrong part, wrong quantity':'e.g. customer returned everything'}" oninput="S.ui.br.why=this.value"></div></div>
 <p class="cap">${r.type==='Change'?'Once approved, the old bill is cancelled and you make the corrected bill from it.':'Once approved, the stock comes back and the udhaar / wallet of this bill is undone.'}${blMgr()?'':' Manager or Admin approves it.'}</p>
 <button class="btn" onclick="brSend('${esc(b.id)}')">${blMgr()?(r.type==='Change'?'Cancel and change now':'Cancel the bill now'):'Send to Manager'}</button>`);}
function brSend(bid){const b=DB.bills.find(x=>x.id===bid);const r=S.ui.br;const why=String((document.getElementById('br-why')||{}).value||r.why||'').trim().slice(0,200);if(!why){toast('Write the reason');return;}
 DB.billReq=DB.billReq||{};const rid='BR-'+(101+Object.keys(DB.billReq).length);const q={bill:bid,type:r.type,why,by:S.user.name,st:'pending',at:today()};DB.billReq[rid]=q;b.req=rid;
 if(blMgr()){q.st='approved';q.ok='By '+S.user.name+' · '+today();billCancel(bid,q);save();closeSheet();toast(bid+' cancelled');return refresh();}
 DB.approvals.unshift({id:Date.now(),t:(r.type==='Change'?'Change bill ':'Cancel bill ')+bid,d:esc(S.user.name)+' · '+esc(b.pname||b.p)+' · '+inr(b.amt)+' · '+esc(why),ic:'x',st:'pending',br:rid,by:S.user.name});
 audit('Bill '+(r.type==='Change'?'change':'cancel')+' asked',bid,'—',why);save();closeSheet();toast('Sent to Manager for approval');refresh();}
function billCancel(bid,r){const b=DB.bills.find(x=>x.id===bid);if(!b||b.cancel)return;b.cancel={type:r.type,why:r.why,by:r.by,ok:S.user.name,at:today()};
 (b.items||[]).forEach(i=>{if(!i.q)return;DB.stock[i.pid]=(DB.stock[i.pid]||0)+i.q;logMove('in',i.pid,i.q,b.id,'Bill cancelled');});
 Object.values(DB.omech||{}).forEach(L=>(L||[]).forEach(v=>{if(v.id===b.id)v.amt=v.paid||0;}));
 if(b.w){if(b.kind==='mech')DB.wl.push({d:today(),t:'Refund · '+b.id,cr:b.w});else if(b.mob)cwAdd(b.mob,{t:'Refund · '+b.id,cr:b.w});}
 if(b.mob&&b.kind!=='mech'){const e=cwList(b.mob).find(x=>x.t==='Cashback · '+b.id);if(e&&e.cr)cwAdd(b.mob,{t:'Cashback taken back · '+b.id,dr:e.cr});}
 DB.warranties=DB.warranties.filter(w=>w.inv!==b.id);audit('Bill cancelled',b.id,inr(b.amt),(r.type==='Change'?'For a corrected bill · ':'')+r.why);}
function blRebill(bid){const b=DB.bills.find(x=>x.id===bid);if(!b)return;if(S.ui.inv&&Object.values(S.ui.inv.items||{}).some(q=>q>0)){toast('Hold or finish the current bill first');return;}
 const it={};(b.items||[]).forEach(i=>{const n=Math.min(i.q,DB.stock[i.pid]||0);if(n>0)it[i.pid]=(it[i.pid]||0)+n;});const via=(/via (\S+)$/.exec(b.p||'')||[])[1];
 S.ui.inv={party:b.kind||'cust',mob:b.kind==='mech'?'':(b.mob||''),items:it,pm:b.pm==='Split'||b.pm==='Warranty'?'UPI':b.pm,bc:'',bcErr:'',rebillOf:b.id,...(b.kind==='mech'?{mc:b.p}:{}),...(via?{via}:{})};
 tab('invoice');toast('Old bill loaded · correct it and make the new bill');}
function blBillExtra(b){let h='';const r=b.req&&(DB.billReq||{})[b.req];
 if(b.cancel)h+=`<div class="card" style="border:1.5px solid var(--r);gap:6px"><div class="h3" style="color:var(--r)">Cancelled${b.cancel.type==='Change'?' for a corrected bill':''}</div><div class="cap">${esc(b.cancel.why)} · asked by ${esc(b.cancel.by)} · approved by ${esc(b.cancel.ok)} · ${esc(b.cancel.at)}</div>
  ${b.rebilled?`<button class="link" onclick="go('billview',{id:'${esc(b.rebilled)}'})">Corrected bill ${esc(b.rebilled)}</button>`:b.cancel.type==='Change'&&allowed('invoice')?`<button class="btn sm" style="width:100%" onclick="blRebill('${esc(b.id)}')">Make the corrected bill</button>`:''}</div>`;
 else if(r&&r.st!=='approved')h+=`<div class="row" style="border-radius:12px;padding:10px 12px;background:${r.st==='rejected'?'var(--r-soft)':'var(--amber-soft)'}"><span class="cap grow"><b>${r.type==='Change'?'Change':'Cancel'} asked · ${r.st==='rejected'?'not approved':'waiting for Manager'}</b> · ${esc(r.why)}</span></div>`;
 if(b.rebillOf)h+=`<button class="link" onclick="go('billview',{id:'${esc(b.rebillOf)}'})">Corrects bill ${esc(b.rebillOf)}</button>`;
 if(b.war)h+=`<div class="cap" style="color:var(--g)">Warranty replacement · claim ${esc(b.war)}</div>`;
 if(b.split)h+=`<div class="card">${Object.entries(b.split).filter(([,v])=>v>0).map(([k,v])=>`<div class="kv"><span>${k==='Credit'?'Udhaar':k}</span><span>${inr(v)}</span></div>`).join('')}</div>`;
 if(!b.cancel&&b.pm!=='Warranty'&&!(r&&r.st==='pending'))h+=`<button class="btn line sm" style="width:100%" onclick="brSheet('${esc(b.id)}')">${ic('x','s16')}Cancel or change this bill</button>`;
 return h;}
/* warranty claims */
const wcOpen=c=>c.st==='Waiting'||c.st==='Approved'||(c.st==='Replaced'&&c.old!=='Sent to company');
const wcPill=c=>c.st==='Waiting'?'<span class="pill a">Waiting</span>':c.st==='Approved'?'<span class="pill b">Approved</span>':c.st==='Rejected'?'<span class="pill r">Rejected</span>':'<span class="pill g">Replaced</span>';
SCREENS.wclaim=()=>{const q=(S.ui.wcq||'').trim().toLowerCase();const f=S.ui.wcf||'Open';const hits=q.length>=3?DB.warranties.filter(w=>(w.party+' '+w.pname+' '+w.inv+' '+w.pn+' '+w.name).toLowerCase().includes(q)).slice(0,20):[];
 const L=(DB.wclaims||[]).filter(c=>f==='All'||wcOpen(c));
 return bar('Warranty claims')+`<div class="scroll"><div class="pad">
 <p class="cap">Find the part the customer brought back. In warranty: give the replacement yourself. Warranty over or not sure: send it to Manager / Admin.</p>
 <label class="search" for="wcq">${ic('search','s20')}<input id="wcq" placeholder="Mobile, bill no. or part no." value="${esc(S.ui.wcq||'')}" oninput="S.ui.wcq=this.value;clearTimeout(window._wcq);window._wcq=setTimeout(()=>{refresh();const i=document.getElementById('wcq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)"></label>
 ${q.length>=3?(hits.length?`<div class="card flush">${hits.map(w=>{const [st,t]=warState(w);return li(esc(w.name)+(w.qty>1?' × '+w.qty:''),esc(w.inv)+' · '+esc(w.pname)+' · till '+fmtD(addDays(w.start,w.days)),`<span class="pill ${t}">${st}</span>`,'shield',`wcStart('${esc(w.id)}')`,t);}).join('')}</div>`:'<div class="empty">No bill with a warranty matches. Check the number.</div>'):''}
 ${sec('Claims')}<div class="chips">${['Open','All'].map(c=>`<button class="chip ${c===f?'on':''}" onclick="S.ui.wcf='${c}';refresh()">${c}</button>`).join('')}</div>
 ${L.map(c=>`<div class="card" style="gap:8px"><div class="row top"><div class="tile sm">${ic('shield','s18')}</div><div class="grow"><div class="h3">${esc(c.id)} · ${esc(c.name)}</div><div class="cap">${esc(c.inv)} · ${esc(c.pname)} · ${c.inW?'in warranty':'warranty over'} · by ${esc(c.by)} · ${esc(c.at)}</div>${c.why?`<div class="cap">${esc(c.why)}</div>`:''}${c.ok?`<div class="cap">${esc(c.ok)}</div>`:''}${c.rep?`<div class="cap" style="color:var(--g)">Replaced on ${esc(c.rep.bill)} by ${esc(c.rep.by)} · old part: ${esc(c.old||'At shop')}</div>`:''}</div>${wcPill(c)}</div>
  ${(c.ph||[]).length?`<div class="row" style="gap:6px">${c.ph.map(u=>`<img src="${esc(u)}" alt="Claim photo" style="width:56px;height:56px;object-fit:cover;border-radius:8px" onclick="window.open('${esc(u)}')">`).join('')}</div>`:''}
  ${c.st==='Approved'?`<button class="btn sm" style="width:100%" onclick="wcGive('${esc(c.id)}')">Give replacement</button>`:''}
  ${c.st==='Replaced'&&c.old!=='Sent to company'&&blMgr()?`<button class="btn line sm" style="width:100%" onclick="wcSent('${esc(c.id)}')">Old part sent to the company</button>`:''}
  ${c.st==='Waiting'&&blMgr()?`<button class="btn line sm" style="width:100%" onclick="go('approvals')">Approve or reject</button>`:''}</div>`).join('')||`<div class="empty">${f==='Open'?'No open claims.':'No claims yet.'}</div>`}
</div></div>`;};
function wcStart(wid,inv){const w=DB.warranties.find(x=>wid?x.id===wid:x.inv===inv);if(!w){toast('Warranty not found');return;}S.ui.wc={w:w.id,why:'',ph:[]};if(cur().s!=='wclaim')go('wclaim');wcSheet();}
function wcSheet(){const c=S.ui.wc;const w=c&&DB.warranties.find(x=>x.id===c.w);if(!w)return;const [st,t,l]=warState(w);const inW=l>=0;const stk=DB.stock[w.pid]||0;const open=(DB.wclaims||[]).find(x=>x.w===w.id&&(x.st==='Waiting'||x.st==='Approved'));
 sheet(`<h3 class="h2">Warranty claim</h3><div class="card" style="gap:4px"><div class="h3">${esc(w.name)}${w.pn?' · '+esc(w.pn):''}</div><div class="cap">${esc(w.inv)} · ${esc(w.pname)} · ${fmtD(w.start)} → ${fmtD(addDays(w.start,w.days))}</div><span class="pill ${t}" style="align-self:flex-start">${inW?st:'Warranty over'}</span></div>
 ${open?`<div class="row cap" style="background:var(--amber-soft);border-radius:10px;padding:10px">${ic('clock','s16')}<span class="grow">${esc(open.id)} is already open for this part (${open.st}).</span></div>`:`
 <div class="field"><label for="wc-why">What is wrong</label><div class="inp"><input id="wc-why" value="${esc(c.why)}" placeholder="e.g. pad worn in 2 months, noise" oninput="S.ui.wc.why=this.value"></div></div>
 <div class="field"><label>Photos (up to 3)</label><div class="row" style="gap:6px">${c.ph.map(u=>`<img src="${esc(u)}" alt="Claim photo" style="width:56px;height:56px;object-fit:cover;border-radius:8px">`).join('')}${c.ph.length<3?`<label class="btn line sm" style="cursor:pointer">${ic('camera','s16')}${S.ui.wcUp?'Saving…':'Add photo'}<input type="file" accept="image/*" capture="environment" style="display:none" onchange="wcPhoto(this.files)"></label>`:''}</div></div>
 ${inW?(stk>0?`<button class="btn" onclick="wcMake('give')">Give replacement now</button>`:`<div class="cap" style="color:var(--r)">Not in stock right now: send it to Manager or order the part.</div>`):`<div class="cap" style="color:var(--amber)">The warranty is over: Manager or Admin decides.</div>`}
 <button class="btn ${inW&&stk>0?'line':''}" onclick="wcMake('ask')">Send to Manager / Admin</button>`}`);}
async function wcPhoto(files){const f=files&&files[0];if(!f||!S.ui.wc)return;S.ui.wcUp=1;wcSheet();
 try{if(f.size>25*1024*1024)throw new Error('This photo is too big (25 MB max)');const r=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f,credentials:'same-origin'});
  if(r.status===401){srvExpired();return;}const j=await r.json().catch(()=>({}));if(!r.ok||!(j.orig||j.url))throw new Error(j.error||'Photo not saved');S.ui.wc.ph.push(j.orig||j.url);}
 catch(e){toast(e&&e.message&&!/fetch|network/i.test(e.message)?e.message:'Photo not saved. Check the internet and try again.');}
 S.ui.wcUp=0;wcSheet();}
function wcMake(mode){const c=S.ui.wc;const w=c&&DB.warranties.find(x=>x.id===c.w);if(!w)return;const why=String((document.getElementById('wc-why')||{}).value||c.why||'').trim().slice(0,200);
 if(mode==='ask'&&!why){toast('Write what is wrong');return;}if(S.ui.wcUp){toast('Wait, the photo is saving');return;}
 DB.wclaims=DB.wclaims||[];const id='WC-'+(1001+DB.wclaims.length);const inW=warState(w)[2]>=0;
 const cl={id,w:w.id,inv:w.inv,pid:w.pid,name:w.name,pn:w.pn||'',party:w.party,pname:w.pname,inW,why,ph:c.ph.slice(0,3),st:mode==='give'?'Approved':'Waiting',by:S.user.name,at:today()};DB.wclaims.unshift(cl);
 if(mode==='give'){cl.ok='In warranty · given at the counter';return wcGive(id);}
 DB.approvals.unshift({id:Date.now(),t:'Warranty claim '+id,d:esc(S.user.name)+' · '+esc(w.name)+' · '+esc(w.inv)+' · '+(inW?'in warranty':'warranty over')+' · '+esc(why),ic:'shield',st:'pending',wcl:id,ph:cl.ph,by:S.user.name});
 audit('Warranty claim sent',id,'—',w.inv);save();closeSheet();S.ui.wcq='';toast(id+' sent to Manager / Admin');refresh();}
function wcGive(cid){const c=(DB.wclaims||[]).find(x=>x.id===cid);if(!c||c.st!=='Approved')return;if(!(DB.stock[c.pid]>0)){toast('Not in stock · order the part first');return refresh();}
 const ob=DB.bills.find(b=>b.id===c.inv)||{};const n=1+DB.bills.reduce((m,b)=>/^WAR-\d+$/.test(b.id||'')?Math.max(m,+b.id.slice(4)):m,1000);const id='WAR-'+n;const x=P(c.pid)||{};
 DB.stock[c.pid]--;logMove('out',c.pid,1,id,'Warranty replacement · '+c.id);
 DB.bills.unshift({id,by:S.user.sid||S.uid,byN:S.user.name,kind:ob.kind||'cust',pname:c.pname,mob:ob.mob||'',items:[{pid:c.pid,q:1,r:0,mrp:x.mrp||0}],p:ob.p||c.pname,t:new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}),iso:isoToday(),pm:'Warranty',amt:0,war:c.id});
 c.st='Replaced';c.rep={bill:id,by:S.user.name,at:today()};c.old='At shop';audit('Warranty replacement',c.id,c.inv,id);save();closeSheet();S.ui.wcq='';
 sheet(`${okBadge(72)}<h3 class="h2">Replacement given</h3><p class="cap">${esc(c.name)} · ${id} (₹0). Keep the old part: it goes back to the company.</p><div class="grid2"><button class="btn line" onclick="closeSheet();go('billview',{id:'${id}'})">View bill</button><button class="btn" onclick="closeSheet();refresh()">Done</button></div>`);refresh();}
function wcSent(cid){const c=(DB.wclaims||[]).find(x=>x.id===cid);if(!c)return;c.old='Sent to company';audit('Warranty part sent to company',c.id,'At shop','Sent');save();toast('Marked as sent');refresh();}
/* what Billing asked for: cancel / change, warranty, udhaar */
function myReqCard(){const L=DB.approvals.filter(a=>(a.br||a.wcl||a.cr)&&a.by===S.user.name).slice(0,5);if(!L.length)return '';
 return `${sec('My requests')}<div class="card flush">${L.map(a=>li(a.t,a.st==='pending'?'Waiting for Manager':(a.st==='approved'?'Approved':'Rejected')+(a.dec?' by '+esc(a.dec):''),`<span class="pill ${a.st==='pending'?'a':a.st==='approved'?'g':'r'}">${a.st==='pending'?'Waiting':a.st}</span>`,a.ic,a.br?`go('billview',{id:'${esc(((DB.billReq||{})[a.br]||{}).bill||'')}'})`:a.wcl?`S.ui.wcf='All';go('wclaim')`:`tab('invoice')`,a.st==='pending'?'a':a.st==='approved'?'g':'r')).join('')}</div>`;}
function blDecide(a,st){a.dec=S.user.name;const ok=(st==='approved'?'Approved by ':'Rejected by ')+S.user.name+' · '+today();
 if(a.cr&&DB.crReq&&DB.crReq[a.cr])DB.crReq[a.cr].st=st;
 if(a.wcl){const c=(DB.wclaims||[]).find(x=>x.id===a.wcl);if(c&&c.st==='Waiting'){c.st=st==='approved'?'Approved':'Rejected';c.ok=ok;}}
 if(a.br){const r=(DB.billReq||{})[a.br];if(r&&r.st==='pending'){r.st=st;r.ok=ok;if(st==='approved')billCancel(r.bill,r);}}}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, f'billing.py: matched {c}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    sub("/* ---------- scan to find ---------- */", BLJS.strip() + "\n\n/* ---------- scan to find ---------- */")
    sub("ACCESS.inventory=ACCESS.inventory.filter(s=>s!=='invpaste');",
        "ACCESS.inventory=ACCESS.inventory.filter(s=>s!=='invpaste');\n['billing','manager','admin'].forEach(r=>ACCESS[r].push('wclaim'));")
    # no bargaining: the price Admin set is final (no extra discount, no discount request)
    sub("const invDisc=inv=>{if(!inv.disc)return 0;if(inv.disc<=DISC_LIM.billing)return inv.disc;const q=(DB.discReq||{})[inv.discReq];return q&&q.st==='approved'?inv.disc:0;};",
        "const invDisc=inv=>0;  /* update 8o: no bargaining, the price Admin set is final */")
    sub("${tot0?discCard(inv,tot0):''}", "${tot?blPayCards(inv,tot,mech):''}")
    sub("Billing role: no access to salary, admin settings, master pricing or role management.",
        "Billing role: prices are fixed (no extra discount). No access to salary, admin settings, master pricing or role management.")
    # udhaar: not locked, Manager allows it when it is above the limit or overdue is pending
    sub("const lock=m==='Credit'&&creditBlocked(inv.mc||MC0());", "const lock=false;")
    sub(" if(mech&&inv.pm==='Credit'&&creditBlocked(mc)){toast('Credit blocked for '+mmo.n+' · overdue not cleared');return;}",
        " const _cr=blCredAmt(inv,tot);if(_cr===null)return;if(mech&&_cr>0&&!blCredOk(inv,mc,_cr)){toast('Udhaar above the limit or overdue pending: ask Manager first');return;}")
    sub(" Object.entries(inv.items).forEach(([k,q])=>{if(q>0){DB.stock[k]=Math.max(0,DB.stock[k]-q);logMove('out',k,q,id,'Billed · '+pname);}});",
        " if(inv.pm==='Split')DB.bills[0].split=blSplit(inv);if(inv.crReq)DB.bills[0].crReq=inv.crReq;"
        "if(inv.est){const e=(DB.ests||[]).find(x=>x.id===inv.est);if(e)e.used=id;}"
        "if(inv.rebillOf){const ob=DB.bills.find(x=>x.id===inv.rebillOf);if(ob)ob.rebilled=id;DB.bills[0].rebillOf=inv.rebillOf;}\n"
        " Object.entries(inv.items).forEach(([k,q])=>{if(q>0){DB.stock[k]=Math.max(0,DB.stock[k]-q);logMove('out',k,q,id,'Billed · '+pname);}});")
    sub(" if(mech&&inv.pm==='Credit'){if(false){",
        " if(mech&&inv.pm==='Split'&&_cr>0)(DB.omech[mc]=DB.omech[mc]||[]).push({id,d:today(),amt:_cr,paid:0,due:dueIn(CREDIT_DAYS)});\n if(mech&&inv.pm==='Credit'){if(false){")
    # WhatsApp the bill straight from the bill-made sheet
    sub("<div class=\"grid2\"><button class=\"btn line\" onclick=\"closeSheet();go('invdoc',{id:'${id}'})\">View invoice</button><button class=\"btn\" onclick=\"closeSheet();tab('bhome')\">Done</button></div>`);}",
        "<button class=\"btn line\" style=\"width:100%\" onclick=\"invShare('${id}')\">${ic('wa','s18')} WhatsApp bill</button><div class=\"grid2\"><button class=\"btn line\" onclick=\"closeSheet();go('invdoc',{id:'${id}'})\">View invoice</button><button class=\"btn\" onclick=\"closeSheet();tab('bhome')\">Done</button></div>`);}")
    # split: the cash and UPI parts count in Cash / UPI collected
    sub("const rows=[...billsToday().filter(b=>b.pm===pm).map(b=>({b,t:b.t,amt:b.amt-(b.w||0)})),",
        "const rows=[...billsToday().filter(b=>b.pm===pm).map(b=>({b,t:b.t,amt:b.amt-(b.w||0)})),...billsToday().filter(b=>b.pm==='Split'&&b.split&&+b.split[pm]>0).map(b=>({b,t:b.t,amt:+b.split[pm]})),")
    sub("Split bills are paid partly by cash and partly by UPI, so they are not added to the Cash or UPI totals.",
        "Split bills: their cash part is counted in Cash collected and their UPI part in UPI collected.")
    # cancelled bills: out of today's sales, marked in the lists
    sub("const billsToday=()=>DB.bills.filter(b=>(b.iso||isoToday())===isoToday());", "const billsToday=()=>DB.bills.filter(b=>(b.iso||isoToday())===isoToday()&&!b.cancel);")
    sub("b.t+' · '+b.pm+(b.kind?' · '+KIND_L[b.kind]:'')", "b.t+' · '+(b.cancel?'CANCELLED':b.pm)+(b.kind?' · '+KIND_L[b.kind]:'')")
    sub(" ${ws.length?`${sec('Warranty')}<div class=\"card flush\">${ws.map(w=>li(esc(w.name)",
        " ${blBillExtra(b)}\n ${ws.length?`${sec('Warranty')}<div class=\"card flush\">${ws.map(w=>li(esc(w.name)")
    # estimate keeps its parts and becomes a bill later
    sub("DB.ests=[{id,tot,d:today(),n:lines.length},...(DB.ests||[])];",
        "DB.ests=[{id,tot,d:today(),n:lines.length,inv:JSON.parse(JSON.stringify({...inv,disc:0,discReq:null,crReq:null,est:null,rebillOf:null}))},...(DB.ests||[])];")
    # Billing home: warranty claim, estimates, my requests
    sub("['Warranty Check','shield',\"S.ui.wf='All';S.ui.wq='';go('warreg')\"],",
        "['Warranty Check','shield',\"S.ui.wf='All';S.ui.wq='';go('warreg')\"],['Warranty claim','repeat',\"S.ui.wcq='';S.ui.wcf='Open';go('wclaim')\"],")
    sub("${heldCard()}", "${heldCard()}${estCard()}${myReqCard()}")
    # Manager home: warranty claims
    sub("['Waiting for photos','camera',\"go('invwait')\",''],", "['Waiting for photos','camera',\"go('invwait')\",''],['Warranty claims','repeat',\"S.ui.wcq='';S.ui.wcf='Open';go('wclaim')\",''],")
    # Warranty Check (staff): Claim opens the claim
    sub("${staff?'':`<button class=\"link\" onclick=\"warClaim('${esc(w.id||'')}','${esc(w.inv)}')\"",
        "${staff?(allowed('wclaim')?`<button class=\"link\" onclick=\"wcStart('${esc(w.id||'')}','${esc(w.inv)}')\">Claim</button>`:''):`<button class=\"link\" onclick=\"warClaim('${esc(w.id||'')}','${esc(w.inv)}')\"")
    # approvals: claim photos, and the decision reaches the claim / bill / udhaar request
    sub("<div class=\"grow\"><div class=\"h3\">${a.t}</div><div class=\"cap\">${a.d}</div></div>",
        "<div class=\"grow\"><div class=\"h3\">${a.t}</div><div class=\"cap\">${a.d}</div>${(a.ph||[]).length?`<div class=\"row\" style=\"gap:6px;margin-top:6px\">${a.ph.map(u=>`<img src=\"${esc(u)}\" alt=\"Claim photo\" style=\"width:56px;height:56px;object-fit:cover;border-radius:8px\" onclick=\"window.open('${esc(u)}')\">`).join('')}</div>`:''}</div>")
    # Manager's "Money today": the udhaar part of split bills counts as udhaar
    sub("cr=billsToday().filter(b=>b.pm==='Credit').reduce((a,b)=>a+(+b.amt||0),0);",
        "cr=billsToday().filter(b=>b.pm==='Credit').reduce((a,b)=>a+(+b.amt||0),0)+billsToday().reduce((a,b)=>a+(b.pm==='Split'&&b.split?+b.split.Credit||0:0),0);")
    # the server refuses what breaks the Billing rules (lib/billguard.mjs): say why
    sub("srvApply(j.changed,ch);if(SRV.fail>=3)", "srvApply(j.changed,ch);if(j.why){closeSheet();sheet(`<h3 class=\"h2\">Not saved</h3><p class=\"cap\">The server refused this: ${esc(j.why)}. Ask Manager if it is needed.</p><button class=\"btn\" onclick=\"closeSheet();refresh()\">OK</button>`);}if(SRV.fail>=3)")
    sub("function decide(id,st){const a=DB.approvals.find(x=>x.id===id);a.st=st;", "function decide(id,st){const a=DB.approvals.find(x=>x.id===id);a.st=st;blDecide(a,st);")
    return a, n
