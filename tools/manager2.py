"""Manager profile, update 8n (Sam 2026-10-12 11:46Z "Online orders: eh admin me bhi nhi he", 11:47Z "haan sab chahiye").

- Online orders: one page for Admin and Manager (oorders). Website / app orders go New > Packed > Out for delivery > Delivered, or
  Cancelled (stock comes back, wallet money used comes back, the cashback given is taken back). The customer sees the same status.
- Money today on the Manager home: Cash, UPI (+ card) and Udhaar of today's bills (the same totals as Day closing).
- Returns: a return up to the limit (Rs 5,000, Admin can change it) is done by the Manager at once; a Billing staff return waits for
  the Manager (or Admin); a return above the limit waits for Admin. The money is given back once it is approved.
"""

OOSCR = r"""
SCREENS.oorders=()=>{const f=S.ui.oof||'New',all=DB.orders||[],cnt=k=>all.filter(o=>k==='All'||ooSt(o)===k).length;const L=all.filter(o=>f==='All'||ooSt(o)===f);
 return bar('Online orders')+`<div class="scroll"><div class="pad">
 <div class="row" style="gap:8px;overflow-x:auto;padding-bottom:2px">${[...OO_STEPS,'Cancelled','All'].map(k=>`<button class="chip ${f===k?'on':''}" style="flex:none" onclick="S.ui.oof='${k}';refresh()">${k} (${cnt(k)})</button>`).join('')}</div>
 ${L.map(o=>{const s=ooSt(o),i=OO_STEPS.indexOf(s),a=ACC()[o.mob]||{},cod=o.pm==='Cash on delivery';
  return `<div class="card" style="gap:10px"><div class="row"><div class="grow"><div class="h3 num">${esc(o.id)}</div><div class="cap">${esc(a.name||'Customer')} · +91 ${esc(o.mob||'')} · ${esc(o.d||'')}</div></div><span class="pill ${s==='Delivered'?'g':s==='Cancelled'?'r':s==='New'?'y':'b'}">${esc(s)}</span></div>
  <div class="card flush" style="background:var(--paper)">${(o.list||[]).map(([pid,q,pr])=>{const x=P(pid)||{name:pid,pn:''};return li(esc(x.name),esc(x.pn||'')+' · '+q+' × '+inr(pr),'','package');}).join('')||`<div class="li"><span class="cap">${o.items} item${o.items>1?'s':''}</span></div>`}</div>
  <div class="kv"><span>${cod?'Collect on delivery':'Paid by '+esc(o.pm||'')}</span><b class="num">${inr((+o.amt||0)-(cod?ordW(o):0))}</b></div>
  ${o.addr?`<div class="cap">${ic('pin','s16')} ${esc((o.addr||[]).filter(Boolean).join(', '))}</div>`:''}
  ${(o.hist||[]).length?`<div class="cap">${o.hist.map(h=>esc(h[0])+' '+esc(h[1])+' by '+esc(h[2])).join(' · ')}</div>`:''}
  ${s!=='Delivered'&&s!=='Cancelled'?`<div class="grid2"><button class="btn line sm" style="width:100%" onclick="ooCancel('${esc(o.id)}')">Cancel</button><button class="btn sm" style="width:100%" onclick="ooStep('${esc(o.id)}')">${OO_STEPS[i+1]==='Delivered'?'Mark delivered':'Mark '+OO_STEPS[i+1].toLowerCase()}</button></div>`:''}</div>`;}).join('')||`<div class="empty">No ${f==='All'?'':f.toLowerCase()+' '}online orders.</div>`}
</div></div>`;};
"""

M2JS = r"""
/* ---------- update 8n: online orders, money today, return approval ---------- */
const retLim=()=>+DB.retLimit>0?+DB.retLimit:5000;
const retNeed=amt=>{const r=S.user&&S.user.role;if(r==='admin')return '';if((+amt||0)>retLim())return 'admin';return r==='manager'?'':'manager';};
function crSave(bid,amt){const sel={...(S.ui.crSel||{})},mode=S.ui.crMode||'Wallet',why=S.ui.crWhy||'Wrong part',need=retNeed(amt);
 if(!need)return crApply(bid,amt,sel,mode,why);
 DB.approvals.unshift({id:Date.now(),t:'Return · bill '+bid,d:esc(S.user.name)+' · '+esc(why)+' · '+esc(mode)+' · '+inr(amt),ic:'history',st:'pending',ret:{bid,amt,sel,mode,why,need}});
 audit('Return sent for approval',bid,'—',inr(amt)+' · to '+(need==='admin'?'Admin':'Manager'));save();S.ui.crSel={};
 sheet(`${okBadge(72)}<h3 class="h2">Sent for approval</h3><p class="cap">The return of ${inr(amt)} on bill ${esc(bid)} goes to ${need==='admin'?'Admin (above the '+inr(retLim())+' limit)':'the Manager'}. Give the money back once it is approved.</p><button class="btn" onclick="closeSheet();refresh()">OK</button>`);}
function moneyToday(){const c=collected('Cash').total,u=collected('UPI').total,k=collected('Card').total,cr=billsToday().filter(b=>b.pm==='Credit').reduce((a,b)=>a+(+b.amt||0),0);
 return `<button class="card" style="text-align:left;width:100%;gap:10px" onclick="go('dayclose')"><div class="row"><div class="tile g">${ic('rupee','s20')}</div><div class="grow"><div class="h3">Money today</div><div class="cap">Tap for day closing</div></div><span class="chev">${ic('chevR','s18')}</span></div>
 <div class="grid3" style="gap:8px">${[['Cash',c],['UPI'+(k?' + card':''),u+k],['Credit',cr]].map(([l,v])=>`<div><div class="micro muted">${l}</div><b class="num">${inr(v)}</b></div>`).join('')}</div></button>`;}
/* online orders from the website / app */
const OO_STEPS=['New','Packed','Out for delivery','Delivered'];
const ooSt=o=>/^(Confirmed|Processing|New)$/.test(o.st||'')?'New':o.st;
const ooNew=()=>(DB.orders||[]).filter(o=>ooSt(o)==='New').length;
function ooCard(){const n=ooNew(),open=(DB.orders||[]).filter(o=>!/Delivered|Cancel/.test(o.st||'')).length;
 return `<button class="row card" style="flex-direction:row;text-align:left${n?';border:1.5px solid var(--y)':''}" onclick="S.ui.oof='${n?'New':'All'}';go('oorders')"><div class="tile ${n?'y':'b'}">${ic('package','s20')}</div><div class="grow"><div class="h3">Online orders</div><div class="cap">${n?'<b>'+n+' new order'+(n>1?'s':'')+'</b> · ':''}${open} to deliver</div></div><span class="chev">${ic('chevR','s18')}</span></button>`;}
function ooSet(o,st){const was=ooSt(o);o.st=st;(o.hist=o.hist||[]).push([st,today()+' '+nowT(),S.user.name]);audit('Online order '+st.toLowerCase(),o.id,was,st);}
function ooStep(id){const o=(DB.orders||[]).find(x=>x.id===id);if(!o)return;const i=OO_STEPS.indexOf(ooSt(o));if(i<0||i>=OO_STEPS.length-1)return;
 ooSet(o,OO_STEPS[i+1]);if(o.st==='Delivered')CWL();save();toast(o.id+' · '+o.st);refresh();}
function ooCancel(id){const o=(DB.orders||[]).find(x=>x.id===id);if(!o)return;
 sheet(`<h3 class="h2">Cancel ${esc(o.id)}?</h3><p class="cap">The parts go back to stock and the wallet money used comes back to the customer.${o.pm!=='Cash on delivery'?' The customer paid '+inr((+o.amt||0)-ordW(o))+' by '+esc(o.pm)+': give it back to them.':''}</p>
 <div class="grid2"><button class="btn line" onclick="closeSheet()">Keep order</button><button class="btn" style="background:var(--r);color:#fff" onclick="ooCancelGo('${esc(o.id)}')">Cancel order</button></div>`);}
function ooCancelGo(id){const o=(DB.orders||[]).find(x=>x.id===id);if(!o||o.st==='Cancelled')return closeSheet();const m=ordOwner(o);
 (o.list||[]).forEach(([pid,q])=>{if(P(pid)){DB.stock[pid]=(+DB.stock[pid]||0)+(+q||0);logMove('in',pid,+q||0,o.id,'Online order cancelled');}});
 if(+o.w>0)cwAdd(m,{t:'Refund · '+o.id+' cancelled',cr:+o.w});
 if(!+o.fee){const cb=Math.round(((+o.amt||0)-(+o.fee||0)-(+o.w||0))*CW_RULES.online);if(cb>0)cwAdd(m,{t:'Cashback taken back · '+o.id,dr:cb});}else o.cbDue=0;
 ooSet(o,'Cancelled');save();closeSheet();toast(o.id+' cancelled');refresh();}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, f'manager2.py: matched {c}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    sub("function allowed(s){", M2JS.strip() + "\nfunction allowed(s){")
    sub("SCREENS.aorders=()=>", OOSCR.strip() + "\nSCREENS.aorders=()=>")
    sub("ACCESS.inventory=ACCESS.inventory.filter(s=>s!=='invpaste');",
        "ACCESS.inventory=ACCESS.inventory.filter(s=>s!=='invpaste');\nACCESS.manager.push('oorders');ACCESS.admin.push('oorders');")
    # Manager home: money today + online orders, under the four tiles
    sub("\"tab('approvals')\")}</div>\n ${(()=>{const c=omAll();", "\"tab('approvals')\")}</div>\n ${moneyToday()}${ooCard()}\n ${(()=>{const c=omAll();")
    # Admin: the Orders tile opens the new page; the home card shows both limits
    sub("go('aorders')", "S.ui.oof=ooNew()?'New':'All';go('oorders')")
    sub("const tone={Confirmed:'b','Out for delivery':'b',Delivered:'g',Processing:'a',Cancelled:'r'};",
        "const tone={Confirmed:'b',New:'b',Packed:'a','Out for delivery':'b',Delivered:'g',Processing:'a',Cancelled:'r'};")
    # returns: the old save becomes crApply (done at once or when approved)
    sub("function crSave(bid,amt){const b=DB.bills.find(x=>x.id===bid);const sel=S.ui.crSel;const mode=S.ui.crMode||'Wallet';const why=S.ui.crWhy||'Wrong part';",
        "function crApply(bid,amt,sel,mode,why,fromAp){const b=DB.bills.find(x=>x.id===bid);")
    sub("audit('Counter return',id,bid,inr(amt)+' · '+mode);save();S.ui.crSel={};\n sheet(",
        "audit('Counter return',id,bid,inr(amt)+' · '+mode);save();S.ui.crSel={};if(fromAp)return id;\n sheet(")
    sub("if(a.po){const o=(DB.pos||[]).find(x=>x.id===a.po);",
        "if(a.ret&&st==='approved'){const r=a.ret;crApply(r.bid,r.amt,r.sel,r.mode,r.why,1);}if(a.po){const o=(DB.pos||[]).find(x=>x.id===a.po);")
    sub("a.st==='pending'&&(a.po||a.pct>DISC_LIM.manager)&&S.user.role!=='admin'?",
        "a.st==='pending'&&(a.po||(a.ret&&a.ret.need==='admin')||a.pct>DISC_LIM.manager)&&S.user.role!=='admin'?")
    sub("${a.po?'Above the purchase order limit':'Above your '+DISC_LIM.manager+'% limit'}",
        "${a.po?'Above the purchase order limit':a.ret?'Above the '+inr(retLim())+' return limit':'Above your '+DISC_LIM.manager+'% limit'}")
    # one sheet for both limits
    sub("function poLimSheet(){sheet(`<h3 class=\"h2\">Purchase order limit</h3><p class=\"cap\">Manager and staff send an order up to this amount to the supplier straight away. A bigger order waits for your approval.</p>\n <div class=\"field\"><label for=\"po-lim\">Limit per order</label><div class=\"inp\"><b>₹</b><input id=\"po-lim\" inputmode=\"numeric\" value=\"${poLim()}\"></div></div>",
        "function poLimSheet(){sheet(`<h3 class=\"h2\">Limits</h3><p class=\"cap\">Up to these amounts the Manager goes ahead without you. Anything bigger waits for your approval.</p>\n <div class=\"field\"><label for=\"po-lim\">Purchase order, per order</label><div class=\"inp\"><b>₹</b><input id=\"po-lim\" inputmode=\"numeric\" value=\"${poLim()}\"></div></div>\n <div class=\"field\"><label for=\"ret-lim\">Customer return, per return</label><div class=\"inp\"><b>₹</b><input id=\"ret-lim\" inputmode=\"numeric\" value=\"${retLim()}\"></div></div>")
    sub("const old=poLim();DB.poLimit=v;audit('Purchase order limit changed','Manager',inr(old),inr(v));save();closeSheet();toast('Limit set to '+inr(v));refresh();}",
        "const r=parseInt(String((document.getElementById('ret-lim')||{}).value||'').replace(/\\D/g,''))||0;if(r<100){toast('Enter a return limit of at least ₹100');return;}\n const old=poLim(),ro=retLim();DB.poLimit=v;DB.retLimit=r;if(old!==v)audit('Purchase order limit changed','Manager',inr(old),inr(v));if(ro!==r)audit('Return limit changed','Manager',inr(ro),inr(r));save();closeSheet();toast('Limits saved');refresh();}")
    sub("· limit ${inr(poLim())} per order</div></div><button class=\"link\" onclick=\"poLimSheet()\">Change</button>",
        "· limits: order ${inr(poLim())}, return ${inr(retLim())}</div></div><button class=\"link\" onclick=\"poLimSheet()\">Change</button>")
    return a, n
