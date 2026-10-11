"""Sam 2026-10-11: "sample data jo kuch bhi he sabhi delete karde" (part 2, after nosample.py emptied the demo records).
Every number, name and list a screen shows comes from this shop's own bills, purchases, stock and logins:
dashboards, staff, users, targets, GST and finance are worked out from real records; a made-up row, rating,
attendance, follow-up or "demo" fallback is gone; a screen opened without what it needs shows an empty state."""
import re
from jslit import const_span

# ---------- real numbers (one block, next to the old dashboard constants) ----------
REAL_JS = r"""/* ===== real numbers: worked out from this shop's own bills, purchases, stock and logins (no sample data) ===== */
const moIso=(o=0)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+o);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
const moName=(o=0,short)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+o);return d.toLocaleDateString('en-IN',{month:short?'short':'long'});};
const moSuf=()=>new Date().toLocaleDateString('en-IN',{month:'short',year:'numeric'});
const inMonth=d=>String(d||'').endsWith(moSuf());
const perBills=per=>{const td=isoToday(),yd=addDays(td,-1),m0=moIso(),m1=moIso(-1);return (DB.bills||[]).filter(b=>{const i=String(b.iso||'');return per==='today'?i===td:per==='yday'?i===yd:per==='month'?i.startsWith(m0):per==='prevmonth'?i.startsWith(m1):i.startsWith(per);});};
const sumAmt=l=>l.reduce((a,b)=>a+(+b.amt||0),0);
const chgTxt=(c,p,vs)=>p?(c>=p?'▲ ':'▼ ')+Math.abs(Math.round((c-p)/p*100))+'% vs '+vs:(c?'first sales':'no sales yet');
const billHr=b=>{const m=/(\d{1,2}):(\d{2})\s*([ap])?/i.exec(String(b.t||''));if(!m)return 12;return m[3]?(+m[1]%12)+(/p/i.test(m[3])?12:0):+m[1];};
const itemCost=i=>{const x=P(i.pid);return x?(+x.cost||poCost(x)):0;};
function realCat(per){const o={};perBills(per).forEach(b=>(b.items||[]).forEach(i=>{const x=P(i.pid);const c=(x&&x.cat)||'Others';const q=+i.q||0,v=(+i.r||0)*q;const r=o[c]||(o[c]=[c,0,0]);r[1]+=v;r[2]+=itemCost(i)*q;}));return Object.values(o).map(([c,v,k])=>[c,v,v?+((v-k)/v*100).toFixed(1):0]).sort((a,b)=>b[1]-a[1]);}
function realMg(per){const L=perBills(per),td=per==='today',sales=sumAmt(L),m=mgMargin(per);let chart;
 if(td){const H=[9,10,11,12,13,14,15,16,17,18,19,20],v=H.map(()=>0);L.forEach(b=>{v[Math.min(11,Math.max(0,billHr(b)-9))]+=+b.amt||0;});chart={t:'Today by hour (₹ thousand)',l:H.map(h=>String(h>12?h-12:h)),v:v.map(x=>+(x/1000).toFixed(1))};}
 else{const v=[0,0,0,0,0];L.forEach(b=>{const d=+String(b.iso).slice(8,10)||1;v[Math.min(4,Math.floor((d-1)/7))]+=+b.amt||0;});chart={t:moName()+' by week (₹ thousand)',l:['W1','W2','W3','W4','W5'],v:v.map(x=>+(x/1000).toFixed(1))};}
 const mc={};L.forEach(b=>{if(b.kind==='mech')mc[b.p]=(mc[b.p]||0)+(+b.amt||0);});
 return {sales,bills:L.length,chg:td?chgTxt(sales,sumAmt(perBills('yday')),'yesterday'):chgTxt(sales,sumAmt(perBills('prevmonth')),moName(-1,1)),gm:m.pct+'%',gmv:m.profit,target:+((DB.targets||tgtSeed()).v.sales)||0,chart,mech:Object.entries(mc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,v])=>[PARTY(c).n,c,v,(vInfo(c)||{}).tier||'',''])};}
function realSplit(per){const L=perBills(per);const g=f=>{const o={};L.forEach(b=>{const k=f(b);o[k]=(o[k]||0)+(+b.amt||0);});return Object.entries(o).sort((a,b)=>b[1]-a[1]);};return {mode:g(b=>b.pm||'Cash'),type:g(b=>KIND_L[b.kind]||'Customer'),staff:g(b=>b.byN||'Not recorded')};}
const HSN_D={'8714':'Parts & accessories of motorcycles','2710':'Lubricating oils','8512':'Lighting & signalling','4011':'Tyres','8708':'Brake parts','9987':'Service (repair labour)'};
/* the invoice works out tax at 18% (GST on two-wheeler parts since 22 Sep 2025): the report uses the same */
function realHsn(mo){const o={};perBills(mo).forEach(b=>(b.items||[]).forEach(i=>{const h=HSN(P(i.pid));o[h]=(o[h]||0)+(+i.r||0)*(+i.q||0);}));return Object.entries(o).map(([h,v])=>{const t=Math.round(v*100/118);return {h,d:HSN_D[h]||'Goods',r:18,t,tax:Math.round(v)-t};}).sort((a,b)=>b.t-a.t);}
const staffAccs=()=>Object.entries(ACC()).filter(([,a])=>a&&a.sid);
const staffFor=r=>{const l=staffAccs().filter(([,a])=>a.role!=='admin');const x=l.find(([,a])=>a.role===r)||l[0];return x?x[1].sid:'';};
const grnMonth=g=>{const s=String(g.date||'');const d=new Date(s+(/\d{4}/.test(s)?'':' '+new Date().getFullYear()));return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
const grnsMonth=()=>(DB.grns||[]).filter(g=>g.status==='posted'&&grnMonth(g)===moIso());
const purchMonth=()=>grnsMonth().reduce((a,g)=>a+(+g.billAmt||0),0);
const stockVal=()=>PRODUCTS.reduce((a,x)=>a+(+DB.stock[x.id]||0)*poCost(x),0);
const custOut=()=>soList().reduce((a,o)=>a+Math.max(0,(+o.amt||0)-(+o.paid||+o.adv||0)),0);
function realBranch(){const m=mgMargin('month');const A=Object.values(ACC());return {n:'Main store',sales:sumAmt(perBills('month')),purch:purchMonth(),gp:m.profit,out:allOut(),stock:stockVal(),cust:A.filter(a=>a&&a.role==='customer').length,mech:realMechs().length,staff:staffAccs().length,orders:(DB.orders||[]).length+soList().length,ret:(DB.returns||[]).length,claims:0};}
/* per-mechanic business and per-part sales, worked out once per change of the bills */
const RLK={k:'',mb:new Map(),codes:null,ps:null};
function rlFresh(){const B=DB.bills||[];const A=Object.values(ACC());const k=B.length+'|'+sumAmt(B)+'|'+((B[0]||{}).id||'')+'|'+A.length+'|'+A.filter(a=>a&&a.role==='mechanic'&&a.status!=='pending').length+'|'+isoToday();if(RLK.k!==k){RLK.k=k;RLK.mb=new Map();RLK.codes=null;RLK.ps=null;}}
const mbCodes=()=>{rlFresh();return RLK.codes||(RLK.codes=realMechs().map(m=>m.code));};
const mbGet=c=>{rlFresh();if(!RLK.mb.has(c))RLK.mb.set(c,mbReal(c));return RLK.mb.get(c);};
function pSales(){rlFresh();if(!RLK.ps){const m={},td=new Date(isoToday()+'T00:00:00');(DB.bills||[]).forEach(b=>{if(!b.iso)return;const age=Math.round((td-new Date(b.iso+'T00:00:00'))/864e5);(b.items||[]).forEach(i=>{const r=m[i.pid]||(m[i.pid]={q:0,last:null});if(age<30)r.q+=+i.q||0;if(r.last===null||age<r.last)r.last=age;});});RLK.ps=m;}return RLK.ps;}
function arrView(f){return new Proxy([],{get:(t,k)=>{const r=f();const v=r[k];return typeof v==='function'?v.bind(r):v;}});}
function scrSafe(fn,p,s){try{return fn(p);}catch(e){console.warn('screen '+s+': '+e.message);return bar('Bike Pharma')+'<div class="scroll"><div class="pad"><div class="empty">Nothing to show here yet.</div></div></div>';}}
"""

CONSTS = {
    'MG_DATA': "{get today(){return realMg('today');},get month(){return realMg('month');}}",
    'MG_CAT': "{get today(){return realCat('today');},get month(){return realCat('month');}}",
    'MG_SPLIT': "{get today(){return realSplit('today');},get month(){return realSplit('month');}}",
    'GST_HSN': "[]",
    'MB': "new Proxy({},{ownKeys:()=>mbCodes(),getOwnPropertyDescriptor:(t,k)=>mbCodes().includes(k)?{value:mbGet(k),enumerable:true,configurable:true,writable:true}:undefined,get:(t,k)=>typeof k==='string'&&mbCodes().includes(k)?mbGet(k):undefined,has:(t,k)=>mbCodes().includes(k)})",
    'BRANCHES': "arrView(()=>[realBranch()])",
    'STAFF_T': "arrView(()=>staffAccs().filter(([,a])=>a.role!=='admin').map(([,a])=>[a.sid,a.name,a.label]))",
    'MB_CATS': "[]",
    'SEGMENTS': "[['all_c','All customers',()=>Object.values(ACC()).filter(a=>a&&a.role==='customer').length,'customer'],['warranty','Customers with a warranty ending in 30 days',()=>new Set((DB.warranties||[]).filter(w=>w.start&&w.days&&daysLeft(w)>=0&&daysLeft(w)<=30).map(w=>w.party)).size,'customer'],['lapsed_c','Customers with no purchase in 90 days',()=>{const td=new Date(isoToday()+'T00:00:00');const last={};(DB.bills||[]).forEach(b=>{if(b.mob&&b.iso){const d=Math.round((td-new Date(b.iso+'T00:00:00'))/864e5);if(last[b.mob]===undefined||d<last[b.mob])last[b.mob]=d;}});return Object.entries(ACC()).filter(([k,a])=>a&&a.role==='customer'&&last[k]!==undefined&&last[k]>=90).length;},'customer'],['all_m','All mechanics',()=>realMechs().length,'mechanic'],['gold','Gold & Silver mechanics',()=>realMechs().filter(m=>['Gold','Silver'].includes((vInfo(m.code)||{}).tier)).length,'mechanic'],['inactive_m','Mechanics not buying (30+ days)',()=>inactiveM().length,'mechanic']]",
    'TEMPLATES': "[['Offer','New at Bike Pharma: write your offer here.'],['Service kit reminder','Time for engine oil and filters? Order the service kit for your bike in the Bike Pharma app.'],['Warranty reminder','A part warranty on your bike ends soon. Check it in the Bike Pharma app under Warranty.']]",
    'tgtSeed': "()=>({month:moName()+' '+new Date().getFullYear(),setBy:'',setOn:'',v:Object.fromEntries(TGT_DEF.map(([k])=>[k,0]))})",
    'SUM_ITEMS': "[['sales','Sales & bills'],['coll','Collections by mode'],['dues','Overdue mechanics'],['stock','Out of stock / low stock'],['appr','Pending approvals'],['close','Day closing status']]",
}


# a line that starts a new top-level statement (template lines start with a space or '<')
TOP = re.compile(r'\n(?=SCREENS\.|SCREENS\[|function |async function |const |let |var |/\*|//|window\.|document\.|if\(|for\(|\(|[A-Za-z_$][\w$]*(?:\.[\w$]+)*=)')


def screen_span(a, name):
    """a screen written on its own lines: from 'SCREENS.name=' to the line before the next top-level statement"""
    i = a.index('\nSCREENS.' + name + '=') + 1
    j = TOP.search(a, i + 5).start()
    assert a[j - 1] == ';', f'nosample2: screen {name} does not end with ";"'
    return i, j


# whole screens rewritten from real records
SCREENS = {
 'afinance': r"""SCREENS.afinance=()=>{const L0=perBills('month');const sales=sumAmt(L0),pur=purchMonth(),ex=(DB.exp||[]).filter(x=>inMonth(x.d)).reduce((a,x)=>a+(+x.a||0),0),net=sales-pur-ex;const pay=sups().reduce((a,s)=>a+(+s.pay||0),0);const mo=allOut(),od=allDues().filter(isOverdue),co=custOut();const cash=sumAmt(L0.filter(b=>b.pm==='Cash')),upi=sumAmt(L0.filter(b=>b.pm==='UPI')),col=cash+upi;
 return `<div class="scroll"><div class="pad"><h1 class="h1">Finance</h1>
 <div class="card"><div class="h3">Profit & loss · ${moName()}</div><div class="kv"><span>Sales</span><span>${L(sales)}</span></div><div class="kv"><span>Purchases (posted GRNs)</span><span>− ${L(pur)}</span></div><div class="kv"><span>Expenses</span><span>− ${L(ex)}</span></div><div class="hr"></div><div class="kv big"><span>Net profit</span><span style="color:${net>=0?'var(--g)':'var(--r)'}">${net<0?'− ':''}${L(Math.abs(net))}</span></div></div>
 <div class="grid2">${statTile('b','Receivables',L(mo+co),'due to Bike Pharma')}${statTile('y','Payables',L(pay),sups().filter(s=>s.pay).length+' supplier'+(sups().filter(s=>s.pay).length===1?'':'s'))}${statTile('r','Mechanic outstanding',L(mo),od.length+' overdue')}${statTile('','Customer outstanding',L(co),'part orders not paid')}</div>
 <div class="card"><div class="sec"><span class="h3">Collections · ${moName()}</span><b class="num">${L(col)}</b></div><div class="prog" style="height:10px;background:var(--blue)"><i style="width:${col?Math.round(cash/col*100):0}%;background:var(--g)"></i></div><div class="row cap" style="gap:16px"><span style="color:var(--g)">● Cash ${L(cash)}</span><span style="color:var(--blue)">● UPI ${L(upi)}</span></div></div>
 ${sec('Reports')}
 <div class="card flush">${[['Payment report','payment'],['Mechanic ageing report','ageing'],['GST sales register','sreg'],['Expense register','expense']].map(([t,k])=>li(t,'Excel (CSV) · tap to download','','download',`exportCsv('${k}')`,'n')).join('')}</div></div></div>`;};""",
 'agst': r"""SCREENS.agst=()=>{const ms=[0,-1,-2].map(o=>[moIso(o),moName(o,1)+' '+moIso(o).slice(0,4),moName(o+1,1)]);const m=ms.find(x=>x[0]===S.ui.gm)||ms[0];const mo=m[0];const rows=realHsn(mo);const tt=rows.reduce((a,x)=>a+x.t,0),tx=rows.reduce((a,x)=>a+x.tax,0);const LB=perBills(mo);const mb=LB.filter(b=>b.kind==='mech');const all=sumAmt(LB);const b2b=all?Math.round(tt*sumAmt(mb)/all):0;
 return bar('GST reports')+`<div class="scroll"><div class="pad">
 <div class="chips">${ms.map(([k,l])=>`<button class="chip ${mo===k?'on':''}" onclick="S.ui.gm='${k}';refresh()">${l}</button>`).join('')}</div>
 <div class="dark-card"><span class="micro" style="color:var(--ink3)">GSTR-1 · ${m[1]} · GSTIN ${esc(SHOP.gst)}</span><div class="row" style="gap:8px;align-items:baseline"><span class="amt" style="color:#fff">${L(tx)}</span><span class="cap" style="color:var(--ink3)">tax on ${L(tt)} sales</span></div><div class="cap" style="color:var(--y)">GSTR-1 due 11 ${m[2]}</div></div>
 ${sec('GSTR-1 summary')}<div class="card"><div class="kv"><span>B2B · mechanics (${mb.length} bill${mb.length===1?'':'s'})</span><span>${L(b2b)}</span></div><div class="kv"><span>B2C · customers & walk-ins</span><span>${L(tt-b2b)}</span></div><div class="hr"></div><div class="kv"><span>CGST</span><span>${inr(Math.round(tx/2))}</span></div><div class="kv"><span>SGST</span><span>${inr(tx-Math.round(tx/2))}</span></div><div class="kv"><span>IGST (inter-state)</span><span>${inr(0)}</span></div><div class="kv big"><span>Total tax</span><span>${inr(tx)}</span></div></div>
 ${sec('HSN summary')}${rows.length?`<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--paper)"><th style="text-align:left;padding:10px 12px">HSN</th><th style="text-align:right;padding:10px 6px">Rate</th><th style="text-align:right;padding:10px 6px">Taxable</th><th style="text-align:right;padding:10px 12px">Tax</th></tr></thead><tbody>${rows.map(x=>`<tr style="border-top:1px solid var(--line2)"><td style="padding:9px 12px"><b>${x.h}</b><div class="cap" style="font-size:10px">${x.d}</div></td><td style="text-align:right;padding:9px 6px">${x.r}%</td><td style="text-align:right;padding:9px 6px" class="num">${inrS(x.t)}</td><td style="text-align:right;padding:9px 12px;font-weight:700" class="num">${inrS(x.tax)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No bills in this month yet.</div>'}
 <div class="grid2"><button class="btn line sm" style="width:100%" onclick="exportCsv('gstr1')">${ic('download','s16')}GSTR-1 CSV</button><button class="btn line sm" style="width:100%" onclick="exportCsv('hsn')">${ic('download','s16')}HSN CSV</button></div>
 <div class="cap">Upload the file on the GST portal or share it with your CA. Purchase data (GSTR-2B match) comes from GRNs.</div>
</div></div>`;};""",
 'team': r"""SCREENS.team=()=>{const l=staffAccs().filter(([,a])=>a.role!=='admin');const bt=perBills('today');return `${S.stack.length>1?bar('Team'):''}<div class="scroll"><div class="pad">${S.stack.length>1?'':'<h1 class="h1">Team</h1>'}<div class="sec"><span class="h3">Staff logins</span><span class="cap">${l.length} staff</span></div>
 ${l.length?`<div class="card flush">${l.map(([k,a])=>{const n=bt.filter(b=>b.by===a.sid).length;return li(esc(a.name),esc(a.label+' · '+a.sid)+(n?' · '+n+' bill'+(n===1?'':'s')+' today':''),staffOff(k)?'<span class="pill r">Login off</span>':'<span class="pill g">Active</span>','user','','n');}).join('')}</div>`:'<div class="card"><div class="cap">No staff logins yet. Admin makes them: Users › Staff › Create staff login.</div></div>'}
 </div></div>`;};""",
 'mgstaff': r"""SCREENS.mgstaff=()=>{const L0=perBills('month');const l=staffAccs().filter(([,a])=>a.role!=='admin').map(([k,a])=>{const b=L0.filter(x=>x.by===a.sid);return {k,a,n:b.length,s:sumAmt(b)};}).sort((x,y)=>y.s-x.s||y.n-x.n);return bar('Staff performance')+`<div class="scroll"><div class="pad">
 <div class="dark-card"><span class="micro" style="color:var(--ink3)">${moName()} · bills made by each staff login</span><div class="h2" style="color:#fff">${l.reduce((a,x)=>a+x.n,0)} bills · ${L(l.reduce((a,x)=>a+x.s,0))}</div></div>
 ${l.length?`<div class="card flush">${l.map(x=>li(esc(x.a.name),esc(x.a.label+' · '+x.a.sid),`<div style="text-align:right"><b class="num">${inr(x.s)}</b><div class="cap">${x.n} bill${x.n===1?'':'s'}</div></div>`,'user','','n')).join('')}</div>`:'<div class="empty">No staff logins yet.</div>'}
 <div class="cap">Counted from the bills each login makes this month.</div>
</div></div>`;};""",
 'shome': r"""SCREENS.shome=()=>{const fc=(DB.fcol||[]).filter(x=>x.d===today());const ky=(DB.kyc||[]);const nm=Object.values(ACC()).filter(a=>a&&a.role==='mechanic'&&inMonth(a.joined)).length;return `<div class="scroll"><div class="pad">${staffHead()}${taskCards()}
 <div class="grid2">${statTile('g','Collected today',inr(fc.reduce((a,x)=>a+(+x.amt||0),0)),fc.length+' receipt'+(fc.length===1?'':'s'))}${tileBtn('b','Visits today',Object.keys(DB.visits||{}).length+' / '+BEAT.length,BEAT.length?(BEAT.length-Object.keys(DB.visits||{}).length)+' remaining':'no visits planned',"go('beat')")}${statTile('y','KYC sent',String(ky.length),ky.filter(x=>x.st==='Approved').length+' approved')}${statTile('','New mechanics',String(nm),'this month')}</div>
 ${fpEntry()}${tbEntry()}
 ${sec('Quick actions')}
 <div class="grid3">${[['Beat plan','pin',"go('beat')"],['Mechanic KYC','wrench',"S.ui.kyc=null;go('kyc')"],['Collect payment','rupee',"S.ui.fc=null;go('scollect')"],['My incentive','award',"go('sincent')"],['Product search','search',"tab('usearch')"],['Check stock','package',"tab('stocklist')"]].map(([l,i,o])=>`<button class="qa2" onclick="${o}"><span class="tile sm">${ic(i,'s20')}</span>${l}</button>`).join('')}</div>
</div></div>`;};""",
 'sincent': r"""SCREENS.sincent=()=>bar('My target & incentive')+`<div class="scroll"><div class="pad">
 <div class="empty">No target or incentive set for you yet. Admin sets them; they show here with your progress.</div>
</div></div>`;""",
 'sorder': r"""SCREENS.sorder=()=>`<div class="scroll"><div class="pad"><h1 class="h1">Order / quotation</h1>
 <div class="empty">Orders and quotations from the field are not set up yet. For a part the customer needs, the billing counter makes a part order.</div>
</div></div>`;""",
 'approvals': r"""SCREENS.approvals=()=>`${S.stack.length>1?bar('Approvals'):''}<div class="scroll"><div class="pad">${S.stack.length>1?'':'<h1 class="h1">Approvals</h1>'}
 ${DB.approvals.map(a=>`<div class="card"><div class="row top"><div class="tile sm">${ic(a.ic,'s18')}</div><div class="grow"><div class="h3">${a.t}</div><div class="cap">${a.d}</div></div>${a.st!=='pending'?`<span class="pill ${a.st==='approved'?'g':'r'}">${a.st}</span>`:''}</div>${a.st==='pending'&&a.pct>DISC_LIM.manager&&S.user.role!=='admin'?`<div class="row cap" style="background:var(--amber-soft);border-radius:10px;padding:8px 10px;color:var(--amber)">${ic('lock','s16')}Above your ${DISC_LIM.manager}% limit · Admin decides</div>`:a.st==='pending'?`<div class="grid2"><button class="btn line sm" style="width:100%" onclick="decide(${a.id},'rejected')">Reject</button><button class="btn sm" style="width:100%" onclick="decide(${a.id},'approved')">Approve</button></div>`:''}</div>`).join('')||'<div class="empty">Nothing is waiting for approval.</div>'}
</div></div>`;""",
 'apurch': r"""SCREENS.apurch=()=>{const pos=DB.pos||[];const gm=grnsMonth();const o={};gm.forEach(g=>{o[g.supplier]=(o[g.supplier]||0)+(+g.billAmt||0);});const sup=Object.entries(o).sort((a,b)=>b[1]-a[1]);const tot=sup.reduce((a,x)=>a+x[1],0);const pay=sups().reduce((a,s)=>a+(+s.pay||0),0);
 return bar('Purchases · '+moName())+`<div class="scroll"><div class="pad">
 <div class="card" style="background:var(--blue-soft);border:0"><div class="micro muted">Total purchases · posted GRNs</div><div class="amt num">${L(tot)}</div><div class="cap">${gm.length} GRN${gm.length===1?'':'s'} this month · payables ${L(pay)}</div></div>
 ${sec('By supplier')}${sup.length?`<div class="card">${mgBars(sup,tot,'var(--blue)')}</div>`:'<div class="empty">No goods received this month yet.</div>'}
 ${sec('Recent purchase orders')}<div class="card flush">${pos.slice(0,6).map(o=>li(o.id+' · '+esc(o.supplier),o.d+' · '+o.items.length+' parts · by '+esc(o.by),`<span class="pill ${o.status==='Sent'?'b':o.status==='Received'?'g':'a'}">${o.status}</span>`,'truck')).join('')||'<div class="empty">No purchase orders</div>'}</div>
 ${sec('Recent GRNs')}<div class="card flush">${(DB.grns||[]).map(g=>li(g.id+' · '+esc(g.supplier),g.date+' · bill '+g.inv+' · '+inr(+g.billAmt||0),`<span class="pill ${g.status==='posted'?'g':'a'}">${g.status==='posted'?'Posted':'Pending'}</span>`,'file')).join('')||'<div class="empty">No GRNs yet</div>'}</div>
</div></div>`;}""",
 'asales': r"""SCREENS.asales=()=>{const tot=sumAmt(perBills('month')),prev=sumAmt(perBills('prevmonth'));const tg=+((DB.targets||tgtSeed()).v.sales)||0;const sp=realSplit('month');const top=PRODUCTS.filter(x=>sold30(x)>0).sort((a,b)=>sold30(b)*b.price-sold30(a)*a.price).slice(0,5);return bar('Sales · '+moName())+`<div class="scroll"><div class="pad">
 <div class="card" style="background:var(--y-soft);border:0"><div class="micro muted">All bills · ${moName()}</div><div class="amt num">${L(tot)}</div><div class="cap">${chgTxt(tot,prev,moName(-1))}${tg?' · target '+L(tg)+' · '+Math.round(tot/tg*100)+'%':''}</div></div>
 ${sec('By party type')}${sp.type.length?`<div class="card">${mgBars(sp.type,tot)}</div>`:'<div class="empty">No bills this month yet.</div>'}
 ${sec('By payment mode')}${sp.mode.length?`<div class="card">${mgBars(sp.mode,tot,'var(--blue)')}</div>`:'<div class="empty">No bills this month yet.</div>'}
 ${sec('Top products · last 30 days')}<div class="card flush">${top.map(x=>li(esc(x.name),x.pn+' · '+sold30(x)+' sold',`<b class="num">${inrS(sold30(x)*x.price)}</b>`,x.ic)).join('')||'<div class="empty">No parts sold yet.</div>'}</div>
 <div class="card flush">${[['Sales register (GST)','sreg'],['Product-wise sales report','product']].map(([t,k])=>li(t,'Excel (CSV)','','download',`exportCsv('${k}')`,'n')).join('')}</div>
</div></div>`;}""",
 'aorders': r"""SCREENS.aorders=()=>{const pend=(DB.orders||[]).filter(o=>!/Delivered|Cancel/i.test(o.st||''));return bar('Orders')+`<div class="scroll"><div class="pad">
 <div class="grid2">${statTile('','Online orders',String((DB.orders||[]).length),'all time')}${statTile('a','Pending dispatch',String(pend.length),pend.length?'not delivered yet':'none')}</div>
 ${sec('Latest app orders')}<div class="card flush">${DB.orders.map(o=>li(o.id,o.d+' · '+o.items+' item'+(o.items>1?'s':'')+' · '+o.pm,`<div style="text-align:right"><b class="num">${inr(o.amt)}</b><div><span class="pill ${o.st==='Delivered'?'g':o.st==='Processing'?'a':'b'}">${o.st}</span></div></div>`,'package')).join('')||'<div class="empty">No app orders yet.</div>'}</div>
 ${sec('Part orders')}<div class="card flush">${soList().map(o=>li(o.id+' · '+esc((P(o.pid)||{name:o.pid}).name),'+91 '+o.mob+' · '+SO_STEPS[soStage(o)][0],`<b class="num">${inr(o.amt)}</b>`,'truck','',soStage(o)>=4?'g':'a')).join('')||'<div class="empty">No part orders yet.</div>'}</div>
</div></div>`;};""",
 'qr': r"""SCREENS.qr=()=>`<div class="screen darkscr" style="position:static;flex:1;background:var(--k);color:#fff"><div class="bar" style="background:var(--k);border:0;color:#fff"><button class="iconbtn" style="background:#2a2a2a;color:#fff" onclick="back()" aria-label="Close">${ic('x')}</button><h2 style="text-align:center">Scan QR</h2><span style="width:40px"></span></div><div class="scroll"><div class="pad">
 <div class="scanbox"><div class="frame"><span class="line"></span></div></div>
 <p class="cap" style="text-align:center;color:var(--ink3)">QR scanning is not switched on yet. Search the part, invoice or mechanic instead.</p></div></div></div>`;""",
}

# exact edits: (old, new, count)
EDITS = [
 # the screen router: a screen opened without what it needs shows an empty state, never a broken page
 ("html=fn?fn(p):'<div class=\"empty\">Screen not found</div>'", "html=fn?scrSafe(fn,p,s):'<div class=\"empty\">Screen not found</div>'", 1),
 # no "demo mechanic" (Ravi Kumar, BP-MECH-1025): a mechanic is always a real login with its own code
 ("/* the logged-in mechanic (the demo login has no code: it is Ravi Kumar, BP-MECH-1025) */", "/* the logged-in mechanic */", 1),
 ("const myCode=()=>(S.user&&S.user.code)||'BP-MECH-1025';", "const myCode=()=>(S.user&&S.user.code)||'';", 1),
 ("||'Ravi Kumar Auto Works';\nconst ownLedger=code=>code==='BP-MECH-1025'||!!(", "||'';\nconst ownLedger=code=>!!(", 1),
 ("const mechGst=b=>(b.md&&b.md.gst)||(mechOfBill(b)||{}).gst||(MECHS.some(m=>m.code===b.p)?'29AHCPK7712R1ZQ':'');", "const mechGst=b=>(b.md&&b.md.gst)||(mechOfBill(b)||{}).gst||'';", 1),
 ("mob:b.mob||(b.kind==='mech'&&b.p==='BP-MECH-1025'?'9008948080':'')", "mob:b.mob||''", 1),
 ("if(code==='BP-MECH-1025'||(S.user&&S.user.role==='mechanic')){", "if(S.user&&S.user.role==='mechanic'){", 1),
 (":PARTY('BP-MECH-1025');", ":PARTY(code);", 1),
 ("mob:me?S.uid:'9008948080',code:me?S.user.code:'BP-MECH-1025',via:'',gst:me?(S.user.gst||''):'29AHCPK7712R1ZQ'", "mob:me?S.uid:'',code:me?S.user.code:code,via:'',gst:me?(S.user.gst||''):''", 1),
 ("const mc=inv.mc||'BP-MECH-1025';const mob=normId(inv.mob||'');", "const mc=inv.mc||MC0();const mob=normId(inv.mob||'');", 1),
 ("mech?(mc==='BP-MECH-1025'?walletBal():0):", "mech?0:", 1),
 ("PARTY(inv.mc||'BP-MECH-1025').ph", "PARTY(inv.mc||MC0()).ph", 1),
 ("if(f.code==='BP-MECH-1025'){DB.cl.push({d:today(),ref:'Field '+f.pm+' · '+id,pay:amt});", "if(false){DB.cl.push({d:today(),ref:'Field '+f.pm+' · '+id,pay:amt});", 1),
 ("if(f.code!=='BP-MECH-1025')(DB.orec=DB.orec||[]).push(", "(DB.orec=DB.orec||[]).push(", 1),
 ("audit('Outstanding payment recorded',by?'BP-MECH-1025':myCode(),", "audit('Outstanding payment recorded',myCode(),", 1),
 ("S.ui.inv={party:'cust',mob:'8951860708',items:{}", "S.ui.inv={party:'cust',mob:'',items:{}", 1),
 ("if(creditBlocked(S.ui.inv.mc||'BP-MECH-1025'))S.ui.inv.pm='UPI';", "if(creditBlocked(S.ui.inv.mc||MC0()))S.ui.inv.pm='UPI';", 1),
 ("S.ui.inv.via=S.ui.inv.via||'BP-MECH-1025';", "S.ui.inv.via=S.ui.inv.via||'';", 1),
 ("const mc=inv.mc||'BP-MECH-1025';const isNew=mc==='new';", "const mc=inv.mc||MC0();const isNew=mc==='new';", 1),
 ("mm.code==='BP-MECH-1025'?' · +91 90089 48080':''", "''", 1),
 ("${mm.code==='BP-MECH-1025'?`<div class=\"stat g\" style=\"padding:10px\"><span class=\"micro\">Wallet</span><span class=\"v\">${inr(walletBal())}</span></div>`:`", "${false?``:`", 1),
 ("creditBlocked(inv.mc||'BP-MECH-1025')", "creditBlocked(inv.mc||MC0())", 1),
 ("let mc=inv.mc||'BP-MECH-1025',nm=null;", "let mc=inv.mc||MC0(),nm=null;", 1),
 ("if(mech&&inv.pm==='Credit'){if(mc==='BP-MECH-1025'){", "if(mech&&inv.pm==='Credit'){if(false){", 1),
 ("${code==='BP-MECH-1025'?`payOut(${amt},'${pm}',1)`:`payOther('${code}',${amt},'${pm}')`}", "payOther('${code}',${amt},'${pm}')", 1),
 ("last:m.code==='BP-MECH-1025'&&DB.bills.some(b=>b.kind==='mech')?0:MECH_LAST[m.code][0]", "last:MECH_LAST[m.code][0]", 1),
 ("${code==='BP-MECH-1025'?`<div class=\"kv\"><span>Wallet balance</span><span style=\"color:var(--g)\">${inr(walletBal())}</span></div>`:''}", "", 1),
 ("const mechReviews=code=>[...(DB.reviews||[]).filter(r=>r.m===code),...(code==='BP-MECH-1025'?[{stars:5,tags:['On time','Fair price'],t:'Quick brake job, explained everything.',who:'Suresh R',d:'21 Sep'},{stars:4,tags:['Genuine parts'],t:'Good work, bit of a wait.',who:'Kiran M',d:'12 Sep'}]:[])];", "const mechReviews=code=>(DB.reviews||[]).filter(r=>r.m===code);", 1),
 ("const ravi=!p.n||p.n==='Ravi Kumar Auto Works';", "const ravi=false;", 1),
 ("rc:{...x,n:'Ravi Kumar Auto Works'}", "rc:{...x,n:myShop()||'Mechanic'}", 1),
 ("[x.d,'Ravi Kumar Auto Works',String(x.ref||'')", "[x.d,myShop()||'Mechanic',String(x.ref||'')", 1),
 ("b.kind==='mech'?'29AHCPK7712R1ZQ':''", "b.kind==='mech'?mechGst(b):''", 1),
 # every bill remembers which staff login made it (staff performance, sales by staff)
 ("DB.bills.unshift({id,kind:inv.party,pname,", "DB.bills.unshift({id,by:S.user.sid||S.uid,byN:S.user.name,kind:inv.party,pname,", 1),
 # sold in the last 30 days / days since the last sale: from the bills
 ("const sold30=x=>(x.id in SOLD30)?SOLD30[x.id]:soldToday(x);", "const sold30=x=>(pSales()[x.id]||{q:0}).q;", 1),
 ("const lastSold=x=>soldToday(x)?0:(x.id in LAST_SOLD?LAST_SOLD[x.id]:null);", "const lastSold=x=>{const r=pSales()[x.id];return r?r.last:null;};", 1),
 # mechanics: the real ones only (MB lists them)
 ("const omAll=()=>[...Object.keys(MB),...realMechs().map(m=>m.code)];", "const omAll=()=>Object.keys(MB);", 1),
 ("const mech=[...(full?Object.keys(MB):MECHS.map(m=>m.code)),...realMechs().map(m=>m.code)].map(", "const mech=realMechs().map(m=>m.code).map(", 1),
 ("const trend6=code=>{if(!MB[code]){const r=mbReal(code);return [5,4,3,2,1,0].map(n=>r.mon(n));}", "const trend6=code=>{if(true){const r=mbReal(code);return [5,4,3,2,1,0].map(n=>r.mon(n));}", 1),
 ("const missedAll=()=>Object.keys(MB_ITEMS).filter(", "const missedAll=()=>Object.keys(MB).filter(", 1),
 ("const it=(MB_ITEMS[code]||[]).find(r=>r[0]===pid);", "const it=(MB_ITEMS[code]||mbFromBills(code,'')).find(r=>r[0]===pid);", 1),
 ("<div class=\"cap\">Avg score ${Math.round(l.reduce((a,x)=>a+x.score,0)/l.length)}/100", "<div class=\"cap\">${l.length?'Avg score '+Math.round(l.reduce((a,x)=>a+x.score,0)/l.length)+'/100':'No report cards yet'}", 1),
 ("const avg=Math.round(gr.reduce((a,x)=>a+x.score,0)/gr.length);", "const avg=gr.length?Math.round(gr.reduce((a,x)=>a+x.score,0)/gr.length):0;", 1),
 ("per==='w'?' · same days (Mon–today)':per==='m'?' · same days (1st–27th)':''", "per==='w'?' · the 7 days before':per==='m'?' · whole month':''", 1),
 ("<div class=\"kv\"><span>Handled by</span><span>Arjun Nayak · Sales</span></div>", "", 1),
 ("else groups=[['Rajajinagar','pin'],['Malleshwaram','pin'],['Basaveshwaranagar','pin'],['Vijayanagar','pin'],['Yeshwanthpur','pin'],['Mahalakshmi Layout','pin']].map(([k,i])=>({k,i,t:'',d:'Area',list:codes.filter(c=>((mInfo(c)).area||'').startsWith(k))}));",
  "else groups=[...new Set(codes.map(c=>(mInfo(c)).area||'Area not set'))].sort().map(k=>({k,i:'pin',t:'',d:'Area',list:codes.filter(c=>((mInfo(c)).area||'Area not set')===k)}));", 1),
 # tasks go to real staff logins
 ("S.ui.tk={to:mech?'BP-RNR-SAL-004':'BP-RNR-INV-002',", "S.ui.tk={to:staffFor(mech?'sales':'inventory'),", 1),
 ("const st=STAFF_T.find(x=>x[0]===t.to);", "const st=STAFF_T.find(x=>x[0]===t.to);if(!st){toast('Make a staff login first: Admin › Users › Staff');return;}", 1),
 # dashboards: no made-up branch, month, growth or ratios
 ("const L=v=>v>=1e7?'₹'+(v/1e7).toFixed(2)+' Cr':'₹'+(v/1e5).toFixed(1)+' L';", "const L=v=>v>=1e7?'₹'+(v/1e7).toFixed(2)+' Cr':v>=1e5?'₹'+(v/1e5).toFixed(1)+' L':inr(v);", 1),
 ("pct:(profit/sales*100).toFixed(1)};", "pct:sales?(profit/sales*100).toFixed(1):'0.0'};", 1),
 ("function mgBars(rows,tot,tone){return rows.map(", "function mgBars(rows,tot,tone){tot=tot||1;return rows.map(", 1),
 ("Total sales · September · ${br}</span>", "Total sales · ${moName()} · ${br}</span>", 1),
 ("<span class=\"cap\" style=\"color:#7CD4A2\">▲ 14% vs Aug</span>", "<span class=\"cap\" style=\"color:#7CD4A2\">${chgTxt(d.sales,sumAmt(perBills('prevmonth')),moName(-1,1))}</span>", 1),
 ("<div class=\"h3\">Targets · Rajajinagar</div>", "<div class=\"h3\">Targets</div>", 1),
 ("L(d.purch),'18 suppliers',", "L(d.purch),sups().length+' supplier'+(sups().length===1?'':'s'),", 1),
 ("(d.gp/d.sales*100).toFixed(1)+'% margin'", "(d.sales?(d.gp/d.sales*100).toFixed(1):'0.0')+'% margin'", 1),
 ("Math.round(d.orders*.03)+' pending'", "(DB.orders||[]).filter(o=>!/Delivered|Cancel/i.test(o.st||'')).length+' pending'", 1),
 ("Math.ceil(d.ret*.3)+' open'", "'all time'", 1),
 ("tileBtn('b','Warranty claims',String(d.claims),Math.ceil(d.claims*.4)+' in review',", "tileBtn('b','Warranties',String((DB.warranties||[]).length),'issued',", 1),
 ("<div class=\"card\"><div class=\"sec\"><span class=\"h3\">Daily sales (₹ L)</span><span class=\"cap\">21–27 Sep</span></div><div class=\"cbars\">${[2.4,2.9,2.6,3.1,3.4,3.8,3.2].map((v,i)=>{const x=+(v*d.sales/8420000).toFixed(1);return `<div><span class=\"num\">${x}</span><i style=\"height:${v/3.8*80}%\"></i>${21+i}</div>`;}).join('')}</div></div>",
  "${(()=>{const ds=[6,5,4,3,2,1,0].map(o=>addDays(isoToday(),-o));const v=ds.map(x=>sumAmt(perBills(x))/1000);const mx=Math.max(...v)||1;return `<div class=\"card\"><div class=\"sec\"><span class=\"h3\">Daily sales (₹ thousand)</span><span class=\"cap\">last 7 days</span></div><div class=\"cbars\">${v.map((x,i)=>`<div><span class=\"num\">${+x.toFixed(1)}</span><i style=\"height:${x/mx*80}%\"></i>${+ds[i].slice(8)}</div>`).join('')}</div></div>`;})()}", 1),
 ("const dues=allDues();const od=dues.filter(isOverdue);const mx=Math.max(...d.chart.v);", "const dues=allDues();const od=dues.filter(isOverdue);const mx=Math.max(...d.chart.v)||1;", 1),
 ("<button class=\"chip\" onclick=\"mgBranch()\">${ic('store','s16')}Rajajinagar ${ic('chevD','s16')}</button>", "", 1),
 ("<div class=\"micro muted\">Total sales · Rajajinagar</div>", "<div class=\"micro muted\">Total sales</div>", 1),
 ("avg ${inr(d.sales/d.bills)} per bill", "avg ${inr(d.bills?d.sales/d.bills:0)} per bill", 1),
 ("<div class=\"row cap\" style=\"background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px\">${ic('alert','s16')}<span class=\"grow\">Lubricants have the lowest margin (${m.rows.find(x=>x.c==='Lubricants').m}%). Mechanic price on oils is close to cost.</span></div>",
  "${(()=>{const lo=m.rows.slice().sort((a,b)=>a.m-b.m)[0];return lo&&m.rows.length>1?`<div class=\"row cap\" style=\"background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px\">${ic('alert','s16')}<span class=\"grow\">${esc(lo.c)} has the lowest margin (${lo.m}%).</span></div>`:'';})()}", 1),
 ("const L=[`*Bike Pharma · Rajajinagar · ${today()}*`];", "const L=[`*Bike Pharma · ${today()}*`];", 1),
 ("if(on.staff)L.push('👥 Staff present 3 / 4');", "", 1),
 ("onclick=\"toast('Summary sent on WhatsApp to ${p.to.join(', ')||'nobody'}')\" ${p.to.length?'':'disabled'}>Send now on WhatsApp</button>", "onclick=\"extOpen('https://wa.me/?text='+encodeURIComponent(sumText(DB.sumPref.on)))\">Send now on WhatsApp</button>", 1),
 ("<span class=\"micro\" style=\"color:var(--ink3)\">September · Rajajinagar</span><div class=\"row\" style=\"gap:8px;align-items:baseline\"><span class=\"amt\" style=\"color:${net>=0?'#7CD4A2':'#E8836F'}\">", "<span class=\"micro\" style=\"color:var(--ink3)\">${moName()}</span><div class=\"row\" style=\"gap:8px;align-items:baseline\"><span class=\"amt\" style=\"color:${net>=0?'#7CD4A2':'#E8836F'}\">", 1),
 ("${(net/MG_DATA.month.sales*100).toFixed(1)}% of sales", "${MG_DATA.month.sales?(net/MG_DATA.month.sales*100).toFixed(1):'0.0'}% of sales", 1),
 ("audit('Expense added','Rajajinagar','—',inr(a));", "audit('Expense added','Main store','—',inr(a));", 1),
 # branch comparison: one store, no invented insight
 ("mg:['Margin %',b=>b.gp/b.sales*100,v=>v.toFixed(1)+'%']", "mg:['Margin %',b=>b.sales?b.gp/b.sales*100:0,v=>v.toFixed(1)+'%']", 1),
 ("per:['Sales per staff',b=>b.sales/b.staff,v=>'₹'+(v/1e5).toFixed(2)+' L']", "per:['Sales per staff',b=>b.staff?b.sales/b.staff:0,v=>L(v)]", 1),
 ("const mx=Math.max(...BRANCHES.map(fn));", "const mx=Math.max(...BRANCHES.map(fn))||1;", 1),
 ("<span class=\"h3\">${lab} · September</span>", "<span class=\"h3\">${lab} · ${moName()}</span>", 1),
 ("\n <div class=\"row cap\" style=\"background:var(--y-soft);border-radius:12px;padding:10px 12px\">${ic('trend','s16')}<span class=\"grow\"><b>Insight:</b> Malleshwaram has the best margin; Yeshwanthpur sells ${Math.round((1-BRANCHES[2].sales/BRANCHES[1].sales)*100)}% less — fewer mechanics (${BRANCHES[2].mech}).</span></div>", "", 1),
 ("(b.gp/b.sales*100).toFixed(1),b.out,b.stock", "(b.sales?b.gp/b.sales*100:0).toFixed(1),b.out,b.stock", 1),
 ("${sec('By category · Rajajinagar')}", "${sec('By category')}", 1),
 ("'avg fill rate '+Math.round(l.reduce((a,s)=>a+s.fill,0)/l.length)+'%'", "l.length?'avg fill rate '+Math.round(l.reduce((a,s)=>a+s.fill,0)/l.length)+'%':'none added yet'", 1),
 ("...GST_HSN.map(([h,d,r,v])=>[h,d,r,v,Math.round(v*r/200),Math.round(v*r/200)])", "...realHsn(moIso()).map(({h,d,r,t:v,tax})=>[h,d,r,v,Math.round(tax/2),tax-Math.round(tax/2)])", 1),
 # targets: set by Admin, nothing made up
 ("if(k==='collect')return 275000+DB.cl.filter(x=>x.pay&&x.d===tdy&&x.ref&&!x.ref.startsWith('UPI · TXN-8812')).reduce((a,x)=>a+x.pay,0)+(DB.orec||[]).filter(x=>x.d===tdy).reduce((a,x)=>a+x.amt,0);",
  "if(k==='collect')return DB.cl.filter(x=>x.pay&&inMonth(x.d)).reduce((a,x)=>a+x.pay,0)+(DB.orec||[]).filter(x=>inMonth(x.d)).reduce((a,x)=>a+(+x.amt||0),0);", 1),
 ("if(k==='newmech')return 6+newToday().filter(x=>!x.cust).length+Object.values(DB.accounts||{}).filter(a=>a.role==='mechanic'&&a.status==='active').length;",
  "if(k==='newmech')return Object.values(ACC()).filter(a=>a&&a.role==='mechanic'&&inMonth(a.joined)).length;", 1),
 ("if(k==='verify')return 3+Object.values(DB.accounts||{}).filter(a=>a.role==='mechanic'&&a.status==='active').length;",
  "if(k==='verify')return realMechs().filter(m=>vInfo(m.code)).length;", 1),
 ("if(k==='newcust')return 134+newToday().filter(x=>x.cust).length;", "if(k==='newcust')return Object.values(ACC()).filter(a=>a&&a.role==='customer'&&inMonth(a.joined)).length;", 1),
 ("const [day,days]=monthDays();const left=Math.max(0,days-day);\n const pct=t?Math.round(a/t*100):0;", "const [day,days]=monthDays();const left=Math.max(0,days-day);\n const pct=t?Math.round(a/t*100):0;const unset=!t;", 1),
 ("const st=pct>=100?['Achieved','g']:", "const st=unset?['Not set','']:pct>=100?['Achieved','g']:", 1),
 ("const need=unit==='%'||pct>=100?'':", "const need=unset||unit==='%'||pct>=100?'':", 1),
 ("<span class=\"micro\" style=\"color:var(--ink3)\">${T.month} · Rajajinagar</span>", "<span class=\"micro\" style=\"color:var(--ink3)\">${T.month}</span>", 1),
 ("<div class=\"cap\" style=\"color:var(--ink3)\">Set by ${esc(T.setBy)} on ${T.setOn} · day ${day}", "<div class=\"cap\" style=\"color:var(--ink3)\">${T.setBy?'Set by '+esc(T.setBy)+' on '+T.setOn:'Not set yet'} · day ${day}", 1),
 ("<div class=\"h3\">Rajajinagar</div><div class=\"cap\">Manager: Kavya Hegde · ${T.month}</div>", "<div class=\"h3\">Main store</div><div class=\"cap\">Manager: ${esc((staffAccs().find(([,a])=>a.role==='manager')||[0,{name:'not set'}])[1].name)} · ${T.month}</div>", 1),
 ("audit('Target changed','Rajajinagar · '+l,", "audit('Target changed',l,", 1),
 ("${sec('Past months · sales target')}\n <div class=\"card flush\">${TGT_HIST.map(", "${TGT_HIST.length?sec('Past months · sales target'):''}\n <div class=\"card flush\">${TGT_HIST.map(", 1),
 # users: real counts and real logins only
 ("${[['Customers','18,420'],['Mechanics','642'],['Staff','37']].map(", "${[['Customers',Object.values(ACC()).filter(a=>a&&a.role==='customer').length],['Mechanics',realMechs().length],['Staff',staffAccs().length]].map(", 1),
 ("\n ${[['Ravi Kumar Auto Works','BP-MECH-1025 · Silver',walletBal(),outstanding(),'Verified','g'],['Sri Sai Motors','BP-MECH-0872 · Silver',2150,mechDue('BP-MECH-0872'),mechInvs('BP-MECH-0872').some(v=>v.amt>v.paid&&isOverdue(v))?'Overdue':'Verified',mechInvs('BP-MECH-0872').some(v=>v.amt>v.paid&&isOverdue(v))?'r':'g'],['Bullet Point Garage','BP-MECH-0640 · Gold',11800,mechDue('BP-MECH-0640'),'Verified','g']].map(([n,d,w,o,s,tn])=>`<button class=\"card\" style=\"text-align:left\" onclick=\"go('mfin',{n:'${n}'})\"><div class=\"row\"><div class=\"grow\"><div class=\"h3\">${n}</div><div class=\"cap\">${d}</div></div><span class=\"pill ${tn}\">${s}</span></div><div class=\"grid2\"><div class=\"stat g\" style=\"padding:8px 10px\"><span class=\"micro\">Wallet</span><b class=\"num\">${inr(w)}</b></div><div class=\"stat r\" style=\"padding:8px 10px\"><span class=\"micro\">Outstanding</span><b class=\"num\">${inr(o)}</b></div></div></button>`).join('')}`:", "`:", 1),
 ("`<div class=\"card flush\">${[['Anjali Rao','+91 89518 60708 · 6 orders','Verified','g'],['Suresh Rao','+91 98450 14521 · 2 orders','Verified','g'],['Unknown user','+91 90080 44321 · KYC pending','Suspended','']].map(([n,d,s,tn])=>li(n,d,`<span class=\"pill ${tn}\">${s}</span>`,'user',`toast('View · Edit · Suspend · Block · Verify')`,'n')).join('')}</div>`}",
  "`${(()=>{const l=Object.entries(ACC()).filter(([,a])=>a&&a.role==='customer');return l.length?`<div class=\"card flush\">${l.map(([k,a])=>li(esc(a.name||'+91 '+k),'+91 '+k.slice(0,5)+' '+k.slice(5)+(a.joined?' · joined '+esc(a.joined):''),staffOff(k)?'<span class=\"pill r\">Login off</span>':'<span class=\"pill g\">Active</span>','user',`go('custview',{mob:'${k}'})`,'n')).join('')}</div>`:'<div class=\"card\"><div class=\"cap\">No customer has registered yet. Customers sign up themselves with their mobile number.</div></div>';})()}`}", 1),
 # search: real customers only, no demo shortcuts
 ("const cust=[['Anjali Rao','Customer · +91 89518 60708 · 8951860708'+kb('8951860708'),'user',cv?\"go('custview',{mob:'8951860708',n:'Anjali Rao'})\":''],['Suresh Rao','Customer · +91 98450 14521 · 9845014521','user',cv?\"go('custview',{mob:'9845014521',n:'Suresh Rao'})\":''],\n  ...Object.entries(ACC()).filter(([k,a])=>a.role==='customer'&&!['8951860708','9845014521'].includes(k)).map(",
  "const cust=[\n  ...Object.entries(ACC()).filter(([k,a])=>a.role==='customer').map(", 1),
 ("${['4521','Ravi','BP-','INV','BP-BRK'].map(", "${['BP-MECH','INV'].map(", 1),
 # customer app: no festival banner, no made-up location, reviews, notifications or order
 ("${ic('pin','s16')}Rajajinagar, Bengaluru <button class=\"pill g\"", "<button class=\"pill g\"", 1),
 ("\n <button class=\"card\" style=\"background:var(--y-soft);border:0;flex-direction:row;align-items:center;text-align:left\" onclick=\"go('offers')\"><div class=\"grow stack g6\"><span class=\"pill k\" style=\"align-self:flex-start\">Festival offer</span><span class=\"h3\">Up to 25% off brake parts</span><span class=\"cap\">Use code DASARA25 · till 12 Oct</span></div><div class=\"tile y round\" style=\"width:56px;height:56px\">${ic('gift','s28')}</div></button>", "", 1),
 ("<span>${DB.stock[x.id]} units · Rajajinagar</span>", "<span>${DB.stock[x.id]} units</span>", 1),
 ("\n <div class=\"card\"><div class=\"sec\"><span class=\"h3\">Reviews</span><span class=\"row\" style=\"gap:4px;font-weight:700;font-size:13px\"><span style=\"color:var(--amber)\">${ic('star','s16')}</span>4.6 · 128</span></div><p class=\"body muted\" style=\"margin:0\">“Perfect fit on my 2021 Pulsar, braking feels much sharper.” — Kiran M.</p></div>", "", 1),
 ("const l=S.ui.last||{id:'BP-ORD-2026-10482',amt:1376,n:3,war:1};return `", "const l=S.ui.last;if(!l)return bar('Order')+'<div class=\"scroll\"><div class=\"pad\"><div class=\"empty\">No order placed just now. Your orders are under My Orders.</div></div></div>';return `", 1),
 ("'Home · Rajajinagar'", "'your address'", 1),
 ("<div class=\"cap\">Bike Pharma, No. 14, 5th Block, Rajajinagar · 9 AM – 8:30 PM</div></div></div>${mapThumb({lat:12.9894,lng:77.5536},90)}</div>", "<div class=\"cap\">Bike Pharma store · ${esc(SHOP.a)}</div></div></div></div>", 1),
 ("No verified mechanic within ${km} km of Rajajinagar yet.", "No verified mechanic within ${km} km yet.", 1),
 ("${(S.user.role==='mechanic'?[['wallet','g','Reward credited','₹1,500 added to wallet for INV-015'],['receipt','r','Payment due 15 Oct','INV-015 · ₹40,000 outstanding'],['tag','','Bulk offer','Buy 20+ brake pads → extra 8% off']]:[['truck','b','Out for delivery','Your order arrives today by 7 PM'],['file','','Invoice ready','Bill for BP-ORD-2026-09877 is in your invoices'],['rupee','g','Payment successful','₹1,376 paid via UPI'],['shield','y','Warranty expiring soon','Exide battery warranty ends 15 Oct'],['tag','','Dasara offer is live','Up to 25% off brake parts']].filter(n=>S.uid===DEMO_CUST||n[2]==='Dasara offer is live'))",
  "${[]", 1),
 ("'<div class=\"empty\">No notifications for the types you chose.</div>'", "'<div class=\"empty\">No notifications yet.</div>'", 1),
 ("'Invoice ready':\"go('invdoc',{id:'BP-ORD-2026-09877'})\",", "'Invoice ready':\"go('cinvs')\",", 1),
 ("'Dasara offer is live':\"go('offers')\",", "'Offer is live':\"go('offers')\",", 1),
 ("'Dasara offer is live':'offers'", "'Offer is live':'offers'", 1),
 ("at:'Bike Pharma Rajajinagar'+(b.via?' · via '+b.via:'')", "at:'Bike Pharma'+(b.via?' · via '+b.via:'')", 1),
 ("at:'Bike Pharma Rajajinagar',so:1", "at:'Bike Pharma',so:1", 1),
 ("const fallback=why=>{const a={label:'Current location',addr:'Near 5th Block, Rajajinagar, Bengaluru 560010 (approx.)',lat:12.9897+Math.random()*0.002,lng:77.5541+Math.random()*0.002};if(st)st.innerHTML=`<span style=\"color:var(--amber)\">${why}. Demo location used.</span>`;setTimeout(()=>setLoc(kind,a,'GPS (demo)'),700);};",
  "const fallback=why=>{if(st)st.innerHTML=`<span style=\"color:var(--amber)\">${why}. Type the address instead.</span>`;};", 1),
 ("const fb=why=>set({label:'Current location',addr:'Near Rajajinagar Metro (approx.)',lat:12.9923,lng:77.5580},why+' · demo location used');", "const fb=why=>{S.ui.hereMsg=why+' · type the address instead';refresh();};", 1),
 ("placeholder=\"560010\"", "placeholder=\"6-digit PIN\"", 2),
 ("https://maps.google.com/?q=PUC+centre+near+Rajajinagar+Bengaluru", "https://maps.google.com/?q=PUC+centre+near+me", 1),
 ("Your location: near Rajajinagar Metro (GPS)", "Your location (GPS)", 1),
 ("${SURGEON.r}★ · ", "", 1),
 ("r:4.9,sp:'Our own workshop · all brands'", "r:0,sp:'Our own workshop · all brands'", 1),
 ("const qrResult=", "const qrResultOld=", 0),
 # the shop: no made-up branch, address, timings or GSTIN
 ("b:'Rajajinagar branch'", "b:'Main store'", 1),
 ("'Bike Pharma Automobiles, Rajajinagar, Bengaluru, sells two-wheeler spare parts in its store and in this app.'", "'Bike Pharma Automobiles sells two-wheeler spare parts in its store and in this app.'", 1),
 ("['Bring the part and the bill (or show the invoice in the app) to Bike Pharma Rajajinagar, 9 AM – 8:30 PM.'", "['Bring the part and the bill (or show the invoice in the app) to the Bike Pharma store.'", 1),
 ("'Connecting you to our Rajajinagar store team. Someone will reply here in a few minutes (9 AM – 8:30 PM).'", "'Connecting you to our store team. Someone will reply here soon.'", 1),
 ("<div class=\"cap\">Bike Pharma Automobiles · Rajajinagar, Bengaluru</div>", "<div class=\"cap\">Bike Pharma Automobiles</div>", 1),
 ("['Cash at branch','Pay at Rajajinagar counter','wallet']", "['Cash at branch','Pay at the Bike Pharma counter','wallet']", 1),
 ("<div class=\"inp\" style=\"background:var(--paper)\"><b>Rajajinagar</b></div>", "<div class=\"inp\" style=\"background:var(--paper)\"><b>Main store</b></div>", 1),
 ("apField('pn','Part number','BP-BRK-0457',{req:1})", "apField('pn','Part number','Part no. on the box',{req:1})", 1),
 ("placeholder=\"e.g. Rajajinagar\"", "placeholder=\"e.g. Main Road\"", 1),
 ("placeholder=\"e.g. #42, 8th Cross, Rajajinagar\"", "placeholder=\"e.g. #42, 8th Cross, Main Road\"", 1),
 ("${f('shop','Shop name','e.g. Sri Sai Motors')}", "${f('shop','Shop name','Garage / shop name')}", 1),
 ("placeholder=\"e.g. Deepa Kulkarni\"", "placeholder=\"Staff member's full name\"", 1),
 ("S.ui.sr={sup:'${x.brand==='MOTUL'?'Motul India – Karnataka':SUPPLIERS[0]}',", "S.ui.sr={sup:'${esc((sups()[0]||{n:''}).n)}',", 1),
 # stock moves: no demo part, no made-up branches
 ("S.ui.mv={pid:'p1',q:1,to:'Vijayanagar',counted:'',reason:'',ref:''}", "S.ui.mv={pid:(PRODUCTS[0]||{}).id,q:1,to:'',counted:'',reason:'',ref:''}", 1),
 ("${['Vijayanagar','Basavanagudi','Hebbal'].map(b=>`<button class=\"chip ${f.to===b?'on':''}\" style=\"justify-content:center\" onclick=\"S.ui.mv.to='${b}';refresh()\">${b}</button>`).join('')}", "<span class=\"cap\">Only one branch is set up.</span>", 1),
 # beat plan, collections: empty is fine
 ("const done=BEAT.filter(b=>v[b.n]).length;const pct=Math.round(done/BEAT.length*100);", "const done=BEAT.filter(b=>v[b.n]).length;const pct=BEAT.length?Math.round(done/BEAT.length*100):0;", 1),
 ("<div class=\"micro\" style=\"color:var(--ink3)\">West Bengaluru beat · ${today()}</div>", "<div class=\"micro\" style=\"color:var(--ink3)\">Beat plan · ${today()}</div>", 1),
 ("\n ${mapThumb({lat:12.99,lng:77.55,label:'Beat route'},120)}", "", 1),
 ("<div class=\"stack\" style=\"gap:10px\">${BEAT.map((b,i)=>", "${BEAT.length?'':'<div class=\"empty\">No visits planned for today.</div>'}<div class=\"stack\" style=\"gap:10px\">${BEAT.map((b,i)=>", 1),
 ("SCREENS.scollect=()=>{const all=MECHS_R();", "SCREENS.scollect=()=>{const all=MECHS_R();if(!all.length)return bar('Collect payment')+'<div class=\"scroll\"><div class=\"pad\"><div class=\"empty\">No mechanic has an outstanding payment.</div></div></div>';", 1),
 # backup: the data lives on the Bike Pharma server; no made-up cloud backup
 ("<div class=\"card\" style=\"flex-direction:row;align-items:center\"><div class=\"tile g\">${ic('checkC','s20')}</div><div class=\"grow\"><div class=\"h3\">Last backup ${b.last}</div><div class=\"cap\">Encrypted cloud backup · kept 90 days</div></div></div>\n <div class=\"card flush\"><button class=\"li\" onclick=\"DB.backup.auto=DB.backup.auto?0:1;save();refresh()\"><div class=\"grow\"><div class=\"t\">Automatic nightly backup</div><div class=\"s\">Every day at 2:00 AM</div></div><span style=\"width:42px;height:24px;border-radius:12px;background:${b.auto?'var(--g)':'var(--ink3)'};position:relative;flex:none\"><i style=\"position:absolute;top:3px;left:${b.auto?21:3}px;width:18px;height:18px;border-radius:50%;background:#fff\"></i></span></button>${li('Back up now','Takes about a minute','','upload',\"DB.backup.last=today()+' · '+new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});audit('Manual backup','All data','—','Done');save();toast('Backup complete');refresh()\")}</div>",
  "<div class=\"card\" style=\"flex-direction:row;align-items:center\"><div class=\"tile g\">${ic('checkC','s20')}</div><div class=\"grow\"><div class=\"h3\">Shop data is on the Bike Pharma server</div><div class=\"cap\">Every bill, stock entry and login is saved there. Download any list below.</div></div></div>", 1),
 ("k==='bills'?DB.bills.length+' rows today'", "k==='bills'?DB.bills.length+' rows'", 1),
 # finance screen for one mechanic: their own ledger, no demo numbers
 ("const w=ravi?[walletEarned(),walletUsed(),walletBal(),DB.wl.length]:[6650,4500,2150,14];const o=ravi?[creditBuys(),creditPays(),outstanding(),0]:[450000,325000,125000,25000];\n return bar(p.n||'Ravi Kumar Auto Works')",
  "const ms=mechInvs(p.code||'');const w=[0,0,0,0];const o=[ms.reduce((a,v)=>a+v.amt,0),ms.reduce((a,v)=>a+v.paid,0),mechDue(p.code||''),ms.filter(v=>v.amt>v.paid&&isOverdue(v)).reduce((a,v)=>a+v.amt-v.paid,0)];\n return bar(p.n||PARTY(p.code||'').n||'Mechanic')", 1),
 ("<button class=\"link\" style=\"color:var(--g)\" onclick=\"adjWallet()\">Adjust</button>", "", 1),
 ("<h3 class=\"h2\">Adjust wallet · BP-MECH-1025</h3>", "<h3 class=\"h2\">Adjust wallet</h3>", 1),
 ("audit('Wallet adjusted','BP-MECH-1025',", "audit('Wallet adjusted',myCode(),", 1),
]

# invoice numbers: this year's next number (no demo offset), real bills dated by their own day
EDITS += [
 ("const id='INV-2026-00'+(252+DB.bills.length);", "const ipre='INV-'+new Date().getFullYear()+'-';const id=ipre+String(1+DB.bills.reduce((m,b)=>{const s=String(b.id||'');return s.startsWith(ipre)?Math.max(m,parseInt(s.slice(ipre.length),10)||0):m;},0)).padStart(5,'0');", 1),
 ("x.inv.replace('INV-2026-','#')", "String(x.inv||'').replace(/^INV-\\d{4}-/,'#')", 1),
 ("j.labour=j.labour??400;", "j.labour=j.labour??0;", 1),
 ("esc(x.brand)+' · '+x.type", "esc(x.brand)+(x.type?' · '+x.type:'')", 1),
 ("p.brand+' · '+p.type", "p.brand+(p.type?' · '+p.type:'')", 1),
 ("x.brand+' · '+x.type", "x.brand+(x.type?' · '+x.type:'')", 1),
]
# a bill or record that still names a demo product (they are gone) shows it as "Removed part" instead of breaking the screen
EDITS += [
 ("const P=id=>PRODUCTS.find(p=>p.id===id);", "const PX=id=>PRODUCTS.find(p=>p.id===id);const PG={};const P=id=>PX(id)||(id?PG[id]||(PG[id]={id,name:'Removed part',pn:String(id),brand:'',cat:'Others',price:0,mp:0,mrp:0,cost:0,ic:'package',type:'',fits:'',war:0,gone:1}):undefined);", 1),
 ("(DB.newProducts||[]).forEach(p=>{if(!P(p.id))PRODUCTS.push(p);});Object.entries(DB.prices||{}).forEach(([id,v])=>{const x=P(id);if(x)Object.assign(x,v);});", "(DB.newProducts||[]).forEach(p=>{if(!PX(p.id))PRODUCTS.push(p);});Object.entries(DB.prices||{}).forEach(([id,v])=>{const x=PX(id);if(x)Object.assign(x,v);});", 1),
 ("if(!P(i.pid))return;", "if(!PX(i.pid))return;", 1),
]
RX_EDITS = [
 (r"function purchases\(code\)\{.*?return \[\.\.\.real,\.\.\.gen\]\.sort\(\(a,b\)=>a\.ago-b\.ago\);\}",
  "function purchases(code){const td=new Date(isoToday()+'T00:00:00');return DB.bills.filter(b=>b.kind==='mech'&&b.p===code).map(b=>({id:b.id,ago:b.iso?Math.max(0,Math.round((td-new Date(b.iso+'T00:00:00'))/864e5)):0,items:(b.items||[]).map(i=>({pid:i.pid,q:i.q,r:i.r})),pm:b.pm,amt:b.amt,real:1})).sort((a,b)=>a.ago-b.ago);}", 1),
]

# translations whose English text changed above: drop them (they fall back to English)
TR_DROP = ['Rajajinagar']


def apply(a):
    n = 0
    for name, val in CONSTS.items():
        s, e = const_span(a, name); a = a[:s] + val + a[e:]; n += 1
    i = a.index('const MG_BRANCHES=')
    a = a[:i] + REAL_JS + 'const MC0=()=>((realMechs()[0]||{}).code||\'new\');\n' + a[i:]; n += 1
    for name, src in SCREENS.items():
        s, e = screen_span(a, name); a = a[:s] + src + a[e:]; n += 1
    for old, new, cnt in EDITS:
        c = a.count(old)
        assert c == cnt, f'nosample2: matched {c}x (wanted {cnt}): {old[:90]!r}'
        if cnt: a = a.replace(old, new); n += 1
    for rx, new, cnt in RX_EDITS:
        a, c = re.subn(rx, lambda m: new, a, flags=re.S)
        assert c == cnt, f'nosample2: regex matched {c}x (wanted {cnt}): {rx[:90]!r}'
        n += 1
    # translation entries keyed by the old shop-location sentences
    for w in TR_DROP:
        a, c = re.subn(r'"[^"\n]*' + w + r'[^"\n]*":\["[^"\n]*",\s*"[^"\n]*"\],?', '', a)
        n += 1
    return a, n
