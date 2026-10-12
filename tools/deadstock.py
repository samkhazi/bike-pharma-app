"""Dead stock page, update 8q (Sam 2026-10-12 12:01Z "dead stock ka number with all details eh admin ke liye bhi chahiye taaki
dead stock clear ho sake"; Figma page "Dead stock (12 Oct)" OK'd 12:14Z "done ready karde ehi UI").

- One page for Admin and Manager: the money stuck in parts not sold for 60+ / 90+ / 180+ days, sorted by money, age or brand.
  Admin sees it at the purchase rate (last stock in rate), the Manager at MRP (rates stay Admin only, update 8m).
- Every part: qty, rack, days not sold, when it came in, supplier, the bikes it fits, and four ways to clear it: Return to the
  supplier, Offer price (Admin only), Task for staff, Mechanics who can use it (they bought it or parts for the same bike).
- Offer price: Admin sets one price till a date; the shop, app and bills use it (customer and mechanic) till that date or till
  the stock is 0, then the old prices come back.
"""

DSJS = r"""
/* ---------- update 8o: dead stock ---------- */
const DS_DAYS=[60,90,180];
function dsIn(pid){let r=null;(DB.grns||[]).forEach(g=>{if(g.status!=='posted')return;[...(g.items||[]),...(g.nw||[])].forEach(it=>{if(it.pid===pid)r={date:g.date||'',sup:g.supplier||'',rate:+it.rate||0};});});return r;}
function dsAge(d){if(!d)return null;const y=new Date().getFullYear();let t=new Date(d+' '+y);if(isNaN(t))return null;if(t>new Date())t=new Date(d+' '+(y-1));return Math.max(0,Math.floor((new Date()-t)/864e5));}
function dsRows(){const out=[];PRODUCTS.forEach(x=>{const q=+DB.stock[x.id]||0;if(q<=0||x.gone)return;const g=dsIn(x.id);let d=lastSold(x);if(d===null)d=g?dsAge(g.date):null;if(d===null||d<DS_DAYS[0])return;
 const rate=g&&g.rate?g.rate:poCost(x);out.push({x,q,d,g,rate,val:q*rate,mrpv:q*(+x.mrp||0)});});return out;}
const dsOff=pid=>{const o=(DB.offers||{})[pid];return o&&o.till>=isoToday()&&(+DB.stock[pid]||0)>0?o:null;};
function offApply(){PRODUCTS.forEach(x=>{if(x._base&&!dsOff(x.id)){Object.assign(x,x._base);delete x._base;}});
 Object.keys(DB.offers||{}).forEach(pid=>{const o=dsOff(pid),x=PX(pid);if(!o||!x)return;if(!x._base)x._base={price:x.price,mp:x.mp};x.price=Math.min(x._base.price,+o.price);x.mp=Math.min(x._base.mp,+o.price);});}
const dsDate=s=>{try{return new Date(s+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'});}catch(e){return s;}};
function dsMechs(x){const out=[];MECH_ALL().forEach(m=>{let it=[];try{it=mechItems(m.code);}catch(e){}const same=it.filter(r=>r.x.id===x.id).reduce((a,r)=>a+(+r.r[1]||1),0);
 const bike=!same&&x.fits&&it.some(r=>r.x.fits&&r.x.fits===x.fits);if(same||bike)out.push({m,why:same?'Bought this part '+same+' time'+(same>1?'s':''):'Buys parts for '+x.fits});});return out.slice(0,6);}
function dsReturn(pid){const r=dsRows().find(o=>o.x.id===pid);closeSheet();S.ui.sr={sup:(r&&r.g&&r.g.sup)||supN()[0]||'',items:{[pid]:r?r.q:1},why:'Excess'};go('sreturn');}
function dsTask(pid){closeSheet();S.ui.mgSel=[pid];mgTask('slow');}
function dsSheet(pid,focus){offApply();const r=dsRows().find(o=>o.x.id===pid);if(!r)return;const x=r.x,adm=seeRate(),o=dsOff(pid),b=x._base||{price:x.price,mp:x.mp},ms=dsMechs(x);
 const nd=new Date();nd.setDate(nd.getDate()+30);const till=(o&&o.till)||nd.toISOString().slice(0,10);
 sheet(`<div class="row" style="gap:12px">${invTile(x)}<div class="grow"><h3 class="h2" style="margin:0">${esc(x.name)}</h3><div class="cap">${esc(x.pn)} · ${esc(x.brand||'')} · ${r.q} pcs · not sold ${r.d} days</div></div></div>
 ${adm?`<div class="card" style="gap:10px;background:var(--paper)"><div class="h3">Offer price</div>
  <div class="grid3" style="gap:8px"><div><div class="micro muted">MRP</div><b class="num">${inr(x.mrp)}</b></div><div><div class="micro muted">Your rate</div><b class="num">${inr(r.rate)}</b></div><div><div class="micro muted">Offer</div><b class="num" style="color:var(--y2,#b07d00)">${o?inr(o.price):'—'}</b></div></div>
  <div class="grid2" style="gap:8px"><div class="field"><label for="dsOp">Offer price ₹</label><input id="dsOp" type="number" inputmode="numeric" value="${o?o.price:Math.round(b.mp)}"></div><div class="field"><label for="dsOt">Ends on</label><input id="dsOt" type="date" value="${till}"></div></div>
  <div class="cap">Ends on the date or when stock is 0. Only Admin can set or change it. Shop, app and bills use it for customers and mechanics.</div>
  <div class="grid2">${o?`<button class="btn line" onclick="dsOffEnd('${esc(pid)}')">End offer</button>`:'<span></span>'}<button class="btn" onclick="dsOffSave('${esc(pid)}')">${o?'Change offer':'Start offer'}</button></div></div>`
 :`<div class="cap">${ic('lock','s16')} ${o?'On offer at '+inr(o.price)+' till '+dsDate(o.till)+'. ':''}Only Admin sets the offer price.</div>`}
 <div class="h3" id="dsMech">Mechanics who can use it</div>
 <div class="card flush">${ms.map(({m,why})=>`<div class="li"><div class="tile sm">${ic('wrench','s18')}</div><div class="grow"><div class="t">${esc(m.n)}</div><div class="s">${esc(why)}</div></div>${m.ph?`<button class="btn sm line" onclick="extOpen('tel:'+telOf('${esc(m.ph)}'),'Calling ${esc(m.n)}…')">Call</button>`:''}</div>`).join('')||'<div class="empty">No mechanic has bought this part or parts for the same bike yet.</div>'}</div>
 <div class="grid2"><button class="btn line" onclick="dsReturn('${esc(pid)}')">Return to supplier</button><button class="btn k" style="background:var(--k);color:#fff" onclick="dsTask('${esc(pid)}')">Give task to staff</button></div>`);
 setTimeout(()=>{const e=document.getElementById(focus==='mech'?'dsMech':'dsOp');if(e){e.scrollIntoView({block:'center'});if(focus==='offer'&&e.focus)e.focus();}},80);}
function dsOffSave(pid){if(!seeRate())return;const x=PX(pid),pr=Math.round(+document.getElementById('dsOp').value||0),till=document.getElementById('dsOt').value;
 if(!x||pr<=0){toast('Type the offer price');return;}if(!till||till<isoToday()){toast('Pick an end date from today');return;}
 const b=x._base||{price:x.price,mp:x.mp};if(pr>=b.price&&pr>=b.mp){toast('The offer must be below today’s price '+inr(b.mp));return;}
 DB.offers=DB.offers||{};const was=DB.offers[pid];DB.offers[pid]={price:pr,till,by:S.user.name,at:today()};offApply();
 audit(was?'Offer price changed':'Offer price set',x.pn||pid,was?inr(was.price):inr(b.price),inr(pr)+' till '+dsDate(till));save();closeSheet();toast('Offer '+inr(pr)+' on '+x.name);refresh();}
function dsOffEnd(pid){if(!seeRate())return;const o=(DB.offers||{})[pid];if(!o)return;delete DB.offers[pid];offApply();audit('Offer price ended',(PX(pid)||{}).pn||pid,inr(o.price),'—');save();closeSheet();toast('Offer ended');refresh();}
function dsCard(){const L=dsRows().filter(r=>r.d>=90),adm=seeRate();
 return `<button class="row card" style="flex-direction:row;text-align:left" onclick="go('deadstock')"><div class="tile ${L.length?'a':'g'}">${ic('clock','s20')}</div><div class="grow"><div class="h3">Dead stock</div><div class="cap">${L.length?L.length+' part'+(L.length>1?'s':'')+' not sold for 90+ days · '+inr(L.reduce((a,r)=>a+(adm?r.val:r.mrpv),0))+(adm?'':' at MRP'):'Nothing stuck for 90+ days'}</div></div><span class="chev">${ic('chevR','s18')}</span></button>`;}
"""

DSSCR = r"""
SCREENS.deadstock=()=>{offApply();const adm=seeRate(),dd=S.ui.dsd||90,so=S.ui.dss||'money',all=dsRows(),wv=document.documentElement.classList.contains('wv');
 const brands=[...new Set(all.filter(r=>r.d>=dd).map(r=>r.x.brand||'Other'))].sort(),br=brands.includes(S.ui.dsb)?S.ui.dsb:'All';
 const L=all.filter(r=>r.d>=dd&&(br==='All'||(r.x.brand||'Other')===br)).sort((a,b)=>so==='old'?b.d-a.d:so==='brand'?String(a.x.brand).localeCompare(String(b.x.brand))||b.val-a.val:(adm?b.val-a.val:b.mrpv-a.mrpv));
 const V=r=>adm?r.val:r.mrpv,tot=L.reduce((a,r)=>a+V(r),0),pcs=L.reduce((a,r)=>a+r.q,0),sups=new Set(L.map(r=>r.g&&r.g.sup).filter(Boolean)).size,old=L.reduce((a,r)=>Math.max(a,r.d),0),onOff=L.filter(r=>dsOff(r.x.id)).length;
 const pill=r=>`<span class="pill ${r.d>=180?'r':'a'}">${r.d} days</span>`,rack=r=>`<span class="pill n">Rack ${esc(binOf(r.x.id))}</span>`,offP=r=>dsOff(r.x.id)?`<span class="pill y">Offer ${inr(dsOff(r.x.id).price)}</span>`:'';
 const acts=(r,sm)=>{const id=esc(r.x.id);return `<button class="btn line ${sm}" onclick="dsReturn('${id}')">Return</button>${adm?`<button class="btn ${sm}" onclick="dsSheet('${id}','offer')">Offer price</button>`:''}<button class="btn line ${sm}" onclick="dsTask('${id}')">Task</button><button class="btn ${sm}" style="background:var(--k);color:#fff" onclick="dsSheet('${id}','mech')">Mechanics</button>`;};
 const chips=`<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="cap">Not sold for</span>${DS_DAYS.map(d=>`<button class="chip ${dd===d?'on':''}" onclick="S.ui.dsd=${d};refresh()">${d}+ days</button>`).join('')}</div>
 <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="cap">Sort</span>${[['money',adm?'Most money':'Most value'],['old','Oldest'],['brand','Brand']].map(([k,l])=>`<button class="chip ${so===k?'on':''}" onclick="S.ui.dss='${k}';refresh()">${l}</button>`).join('')}</div>`;
 if(wv){const tile=(l,v,s)=>`<div class="card" style="gap:4px"><div class="micro muted">${l}</div><b class="num" style="font-size:26px">${v}</b><div class="cap">${s}</div></div>`;
  return bar('Dead stock')+`<div class="scroll"><div class="pad">
  <div class="row" style="align-items:center"><div class="cap grow">Inventory › Dead stock</div><button class="btn line sm" onclick="dsExport()">${ic('down','s16')} Export list</button></div>
  <div class="grid4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${tile(adm?'Money stuck (purchase rate)':'Stock stuck (MRP)',inr(tot),adm?'At MRP '+inr(L.reduce((a,r)=>a+r.mrpv,0)):'Rates are seen by Admin only')}${tile('Parts',L.length,pcs+' pieces · '+sups+' supplier'+(sups===1?'':'s'))}${tile('Oldest',old+' days','Not sold')}${tile('On offer now',onOff,adm?'Set by you':'Set by Admin')}</div>
  ${chips}<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="cap">Brand</span>${['All',...brands].map(k=>`<button class="chip ${br===k?'on':''}" onclick="S.ui.dsb='${esc(k)}';refresh()">${esc(k)}</button>`).join('')}</div>
  <div class="card flush" style="overflow-x:auto"><table class="ds-t" style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${['Part','Part no.','Qty','Rack','Not sold','Came in','Supplier',adm?'Stuck (rate)':'Stuck (MRP)','Clear it'].map(h=>`<th style="text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);white-space:nowrap" class="micro muted">${h}</th>`).join('')}</tr></thead><tbody>
  ${L.map(r=>`<tr style="border-bottom:1px solid var(--line)"><td style="padding:10px"><div class="row" style="gap:10px;align-items:center">${invTile(r.x)}<div><b>${esc(r.x.name)}</b><div class="cap">${esc(r.x.brand||'')}${r.x.fits?' · '+esc(r.x.fits):''}</div>${offP(r)}</div></div></td><td class="num" style="padding:10px;white-space:nowrap">${esc(r.x.pn)}</td><td class="num" style="padding:10px">${r.q}</td><td style="padding:10px">${esc(binOf(r.x.id))}</td><td style="padding:10px">${pill(r)}</td><td style="padding:10px;white-space:nowrap">${esc(r.g?r.g.date:'—')}</td><td style="padding:10px;max-width:170px">${esc(r.g?r.g.sup:'—')}</td><td class="num" style="padding:10px"><b>${inr(V(r))}</b></td><td style="padding:10px"><div class="row" style="gap:6px;flex-wrap:nowrap">${acts(r,'sm')}</div></td></tr>`).join('')}
  </tbody></table>${L.length?'':'<div class="empty">No part is stuck for '+dd+'+ days.</div>'}</div>
  <div class="cap">${adm?'The Manager sees this list at MRP, without your rates and without Offer price.':'Values are at MRP. Admin sets the offer price.'}</div>
  </div></div>`;}
 return bar('Dead stock')+`<div class="scroll"><div class="pad">
 <div class="dark-card"><div class="micro" style="letter-spacing:.08em;opacity:.8">${adm?'MONEY STUCK · AT PURCHASE RATE':'STOCK STUCK · AT MRP'}</div><b class="num" style="font-size:34px;color:var(--y)">${inr(tot)}</b>
  <div class="row" style="gap:18px">${[[L.length,'parts'],[pcs,'pieces'],[sups,sups===1?'supplier':'suppliers']].map(([v,l])=>`<div><b class="num" style="font-size:18px">${v}</b><div class="micro" style="opacity:.7">${l}</div></div>`).join('')}</div>
  <div class="cap" style="color:#ddd">Not sold for ${dd}+ days.${L.length?' Oldest: '+old+' days.':''}</div></div>
 ${adm?'':`<div class="cap">${ic('lock','s16')} Admin sets the offer price.</div>`}
 ${chips}
 ${L.map(r=>`<div class="card" style="gap:10px"><button class="row" style="gap:12px;text-align:left;background:none;border:0;padding:0;align-items:center" onclick="dsSheet('${esc(r.x.id)}')">${invTile(r.x)}<div class="grow"><div class="h3">${esc(r.x.name)}</div><div class="cap">${esc(r.x.pn)} · ${esc(r.x.brand||'')}</div><div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap">${pill(r)}${rack(r)}${offP(r)}</div></div></button>
  <div class="grid3" style="gap:8px"><div><div class="micro muted">Qty</div><b class="num">${r.q} pcs</b></div><div><div class="micro muted">${adm?'Stuck (rate)':'Stuck (MRP)'}</div><b class="num">${inr(V(r))}</b></div><div><div class="micro muted">Came in</div><b>${esc(r.g?r.g.date:'—')}</b></div></div>
  <div class="cap">Supplier: ${esc(r.g?r.g.sup:'—')}${r.x.fits?' · Fits: '+esc(r.x.fits):''}</div>
  <div style="display:grid;grid-template-columns:repeat(${adm?4:3},1fr);gap:6px">${acts(r,'sm')}</div></div>`).join('')||`<div class="empty">No part is stuck for ${dd}+ days.</div>`}
 </div></div>`;};
function dsExport(){const adm=seeRate(),rows=dsRows().filter(r=>r.d>=(S.ui.dsd||90));const h=['Part','Part no','Brand','Qty','Rack','Days not sold','Came in','Supplier',adm?'Stuck at rate':'Stuck at MRP'];
 const csv=[h,...rows.map(r=>[r.x.name,r.x.pn,r.x.brand||'',r.q,binOf(r.x.id),r.d,r.g?r.g.date:'',r.g?r.g.sup:'',adm?r.val:r.mrpv])].map(l=>l.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
 try{const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const e=document.createElement('a');e.href=u;e.download='dead-stock-'+isoToday()+'.csv';document.body.append(e);e.click();e.remove();toast('Dead stock list saved');}catch(e){toast('Could not save the list');}}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, f'deadstock.py: matched {c}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    sub("function allowed(s){", DSJS.strip() + "\nfunction allowed(s){")
    sub("SCREENS.aorders=()=>", DSSCR.strip() + "\nSCREENS.aorders=()=>")
    sub("ACCESS.manager.push('oorders');ACCESS.admin.push('oorders');",
        "ACCESS.manager.push('oorders');ACCESS.admin.push('oorders');\nACCESS.manager.push('deadstock','sreturn');ACCESS.admin.push('deadstock');")
    # offer prices on load and when the server sends new offers / prices
    sub("Object.entries(DB.prices||{}).forEach(([id,v])=>{const x=PX(id);if(x)Object.assign(x,v);});}",
        "PRODUCTS.forEach(x=>{if(x._base){Object.assign(x,x._base);delete x._base;}});Object.entries(DB.prices||{}).forEach(([id,v])=>{const x=PX(id);if(x)Object.assign(x,v);});try{offApply();}catch(e){}}")
    sub("if(k==='newProducts')invSyncP();}", "if(k==='newProducts')invSyncP();if(k==='offers'||k==='newProducts'||k==='stock')try{offApply();}catch(e){}}")
    # ways in: Manager and Admin homes (under money today / online orders), the Stock alerts page, Admin Stock value, Inventory, side menu
    sub("${supDueCard()}${poDayCard()}", "${supDueCard()}${poDayCard()}${dsCard()}")
    sub("${moneyToday()}${ooCard()}", "${moneyToday()}${ooCard()}${dsCard()}")
    sub("<div class=\"cap\">${MG_KINDS[k][3]}.${k==='slow'?",
        "${k==='slow'?dsCard():''}<div class=\"cap\">${MG_KINDS[k][3]}.${k==='slow'?")
    sub("${sec('Dead stock (no sale 60+ days)')}", "${dsCard()}${sec('Dead stock (no sale 60+ days)')}")
    sub("const acts=[['Products & stock','grid',\"go('stocklist')\"],['Stock count'",
        "const acts=[['Dead stock','clock',\"go('deadstock')\"],['Products & stock','grid',\"go('stocklist')\"],['Stock count'", 2)
    sub("['partorders','Part orders','package',\"S.ui.sof='Open';go('partorders')\"],['bills','Bills','receipt',\"S.ui.bf=null;go('bills',{f:'All'})\"]],",
        "['partorders','Part orders','package',\"S.ui.sof='Open';go('partorders')\"],['bills','Bills','receipt',\"S.ui.bf=null;go('bills',{f:'All'})\"],['deadstock','Dead stock','clock',\"go('deadstock')\"]],")
    sub("['ainv','Inventory','package',\"go('ainv')\"],", "['ainv','Inventory','package',\"go('ainv')\"],['deadstock','Dead stock','clock',\"go('deadstock')\"],")
    return a, n
