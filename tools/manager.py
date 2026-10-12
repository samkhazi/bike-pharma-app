"""Manager profile, update 8m (Sam 2026-10-12, thread "Manager profile").

10:56Z "manager ko gross margin dikhana zaroori he kya", 11:03Z purchase requests: "approval me hi karunga but purchase request mere
through se hi jaana he toh mera headach jyada hoga", 11:07Z "liit 100000 tak rhakhdo manager ko", "sales target dikhna he usko",
11:08Z "inventory add karna bhi dikhna he usko ... gross margin ... manager ko invoice ke through pata chalta he usko kaise tackle karein",
11:13Z "inventory staff ke profile me se bhi paste bill ko hatana hoga", "done".

- Purchase rates, bill amounts, gross margin and profit are Admin only (seeRate). Manager and Inventory add stock with part, qty and
  photos; the rates of such a stock in are entered later by Admin from the supplier bill ("Enter rates" on the bill).
- Manager: no Gross margin tile / screen, no Expenses & profit, no Gross margin target; gets Stock in, Add product, Waiting for photos.
- Inventory: no Paste supplier bill (it shows the supplier's rates).
- Purchase orders: an order up to the limit (Rs 1,00,000 per order, Admin can change it) goes to the supplier straight away; a bigger
  one waits for Admin's Approve / Reject. Admin home shows today's purchase orders, orders waiting and stock ins without rates.
"""

MGJS = r"""
/* ---------- Manager profile (update 8m): purchase rates and margin are Admin only; purchase order limit ---------- */
const seeRate=()=>!!S.user&&S.user.role==='admin';
const tgtKeys=()=>TGT_DEF.map(x=>x[0]).filter(k=>k!=='margin'||seeRate());
const poLim=()=>+DB.poLimit>0?+DB.poLimit:100000;
const poNeedsOk=v=>!!S.user&&S.user.role!=='admin'&&(+v||0)>poLim();
function poLimNote(tot){if(seeRate())return 'Final rates come from the supplier bill at stock in.';
 return poNeedsOk(tot)?`This order is above the ${inr(poLim())} limit: Admin approves it first, then it goes to the supplier.`:`Within the ${inr(poLim())} limit: it goes to the supplier straight away.`;}
function poRoute(o){if(o.status!=='Sent'||!poNeedsOk(o.est))return;o.status='Waiting for Admin';
 DB.approvals.unshift({id:Date.now(),t:'Purchase order '+o.id,d:esc(o.by)+' · '+esc(o.supplier||'No supplier')+' · '+o.items.length+' part'+(o.items.length>1?'s':'')+' · '+inr(o.est),ic:'package',st:'pending',po:o.id});}
function poLimSheet(){sheet(`<h3 class="h2">Purchase order limit</h3><p class="cap">Manager and staff send an order up to this amount to the supplier straight away. A bigger order waits for your approval.</p>
 <div class="field"><label for="po-lim">Limit per order</label><div class="inp"><b>₹</b><input id="po-lim" inputmode="numeric" value="${poLim()}"></div></div>
 <button class="btn" onclick="poLimSave()">Save</button>`);}
function poLimSave(){const v=parseInt(String((document.getElementById('po-lim')||{}).value||'').replace(/\D/g,''))||0;if(v<1000){toast('Enter a limit of at least ₹1,000');return;}
 const old=poLim();DB.poLimit=v;audit('Purchase order limit changed','Manager',inr(old),inr(v));save();closeSheet();toast('Limit set to '+inr(v));refresh();}
function poDayCard(){const td=(DB.pos||[]).filter(o=>o.d===today()&&o.status!=='Draft'),wait=(DB.approvals||[]).filter(a=>a.po&&a.st==='pending').length,rd=(DB.grns||[]).filter(grnRateDue);
 return `<div class="card" style="gap:10px"><div class="row"><div class="tile b">${ic('package','s20')}</div><div class="grow"><div class="h3">Purchases today</div><div class="cap">${td.length} order${td.length===1?'':'s'} · ${inr(td.reduce((s,o)=>s+(+o.est||0),0))} est. · limit ${inr(poLim())} per order</div></div><button class="link" onclick="poLimSheet()">Change</button></div>
 ${wait?`<button class="btn sm" style="width:100%" onclick="go('approvals')">${wait} order${wait>1?'s':''} above the limit: approve or reject</button>`:''}
 ${rd.length?`<button class="btn line sm" style="width:100%" onclick="go('grnview',{id:'${esc(rd[0].id)}'})">${rd.length} stock in${rd.length>1?'s':''} without rates: enter them</button>`:''}
 ${td.length?`<button class="link" onclick="S.ui.mgot='Orders';go('mgorders')">See today's orders</button>`:''}</div>`;}
/* a stock in posted by Manager / Inventory has no rates: Admin enters them from the supplier bill */
const grnRateDue=g=>g.status==='posted'&&[...(g.items||[]),...(g.wait||[])].some(it=>!(+it.rate>0));
function grnRateBanner(g){if(!grnRateDue(g))return '';
 return seeRate()?`<div class="card" style="border:1.5px solid var(--amber);gap:10px"><div class="row cap">${ic('alert','s16')}<span class="grow">Rates are not entered yet. Stock was added${g.postedAt?' '+esc(g.postedAt):''}.</span></div><button class="btn sm" style="width:100%" onclick="grnRates('${esc(g.id)}')">Enter rates from the bill</button></div>`
  :`<div class="row cap">${ic('lock','s16')}<span class="grow">Rates are entered by Admin from the supplier bill.</span></div>`;}
function grnRates(id){const g=DB.grns.find(x=>x.id===id);if(!g)return;const L=[...g.items.map(it=>{const x=P(it.pid)||{};return [it,x.name||it.pid,x.pn||''];}),...(g.wait||[]).map(w=>[w,w.name||w.pn,w.pn])];
 sheet(`<h3 class="h2">Rates · ${esc(g.inv||g.id)}</h3><p class="cap">${esc(g.supplier)}. Enter the purchase rate per piece from the supplier bill.</p>
 <div class="field"><label for="gr-amt">Bill amount</label><div class="inp"><b>₹</b><input id="gr-amt" inputmode="decimal" value="${esc(g.billAmt||'')}" placeholder="0"></div></div>
 ${L.map(([it,n,pn],i)=>`<div class="field"><label for="gr-${i}">${esc(n)}${pn?' · '+esc(pn):''} · ${bpQ(it.q)} pcs</label><div class="inp"><b>₹</b><input id="gr-${i}" inputmode="decimal" value="${esc(it.rate||'')}" placeholder="Rate per piece"></div></div>`).join('')}
 <button class="btn" onclick="grnRatesSave('${esc(g.id)}')">Save rates</button>`);}
function grnRatesSave(id){const g=DB.grns.find(x=>x.id===id);if(!g)return;const L=[...g.items,...(g.wait||[])];const v=i=>String((document.getElementById('gr-'+i)||{}).value||'').replace(/[^\d.]/g,'');
 L.forEach((it,i)=>{const r=v(i);if(r!=='')it.rate=r;});const b=String((document.getElementById('gr-amt')||{}).value||'').replace(/[^\d.]/g,'');if(b!=='')g.billAmt=b;
 audit('Stock in rates entered',g.id,'—',inr(grnTotal(g)));save();closeSheet();toast(grnRateDue(g)?'Saved · some rates are still empty':'Rates saved');refresh();}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, f'manager.py: matched {c}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    sub("function allowed(s){", MGJS.strip() + "\nfunction allowed(s){")
    # who opens what: Manager adds stock but sees no margin; Inventory has no Paste supplier bill
    sub("const DENY={};", "const DENY={};\nACCESS.manager=ACCESS.manager.filter(s=>!['mgmargin','mgexp'].includes(s)).concat(['grn','grnedit','grnview','addproduct','invwait']);\nACCESS.inventory=ACCESS.inventory.filter(s=>s!=='invpaste');")
    # Manager home: purchase orders instead of gross margin; Stock in + Add product instead of Expenses & profit
    sub("tileBtn('g','Gross margin',m.pct+'%',inrS(m.profit)+' profit',\"go('mgmargin')\")",
        "tileBtn('g','Purchase orders',String((DB.pos||[]).filter(o=>o.d===today()&&o.status!=='Draft').length),'today · limit '+inrS(poLim())+' each',\"S.ui.mgot='Orders';go('mgorders')\")")
    sub("['Expenses & profit','rupee',\"go('mgexp')\",'g'],",
        "['Stock in','down',\"go('grn')\",'g'],['Add product','plus',\"S.ui.ap=null;S.ui.apErr=null;go('addproduct')\",''],['Waiting for photos','camera',\"go('invwait')\",''],")
    sub("TGT_DEF.map(([k])=>tgtRow(k))", "tgtKeys().map(k=>tgtRow(k))", 3)
    sub("['Paste supplier bill','clip',\"S.ui.ip=null;go('invpaste')\"],['Waiting f",
        "...(seeRate()?[['Paste supplier bill','clip',\"S.ui.ip=null;go('invpaste')\"]]:[]),['Waiting f", 2)
    # Admin home: today's purchase orders, orders waiting, stock ins without rates
    sub("return `<div class=\"scroll\"><div class=\"pad\">${staffHead()}${supDueCard()}",
        "return `<div class=\"scroll\"><div class=\"pad\">${staffHead()}${supDueCard()}${poDayCard()}")

    # Stock in (new / edit): no rates, bill amount, totals or Paste bill for Manager and Inventory
    sub("<button class=\"btn line sm\" onclick=\"S.ui.ip=null;go('invpaste')\">${ic('clip','s16')} Paste bill</button>",
        "${seeRate()?`<button class=\"btn line sm\" onclick=\"S.ui.ip=null;go('invpaste')\">${ic('clip','s16')} Paste bill</button>`:''}")
    sub("<div class=\"field\"><label for=\"ge-amt\">Bill amount</label>", "${seeRate()?`<div class=\"field\"><label for=\"ge-amt\">Bill amount</label>")
    sub("onchange=\"S.ui.ge.billAmt=this.value;refresh()\"></div></div>", "onchange=\"S.ui.ge.billAmt=this.value;refresh()\"></div></div>`:''}")
    rate_it = "<div class=\"field\"><label for=\"ge-r${i}\">Purchase rate</label><div class=\"inp ${e['r'+i]?'err':''}\" style=\"height:40px\"><b>₹</b><input id=\"ge-r${i}\" inputmode=\"decimal\" value=\"${esc(it.rate||'')}\" placeholder=\"0\" onchange=\"S.ui.ge.items[${i}].rate=this.value;refresh()\"></div></div>"
    sub(rate_it, "${seeRate()?`" + rate_it + "`:''}")
    sub("<b class=\"num\">${inr((+it.q||0)*(+it.rate||0))}</b>", "${seeRate()?`<b class=\"num\">${inr((+it.q||0)*(+it.rate||0))}</b>`:''}")
    rate_nw = "<div class=\"field\"><label for=\"nw-r${i}\">Purchase rate</label><div class=\"inp ${e['n'+i]?'err':''}\" style=\"height:40px\"><b>₹</b><input id=\"nw-r${i}\" inputmode=\"decimal\" value=\"${esc(n.rate||'')}\" placeholder=\"0\" onchange=\"geNw('${n.k}').rate=this.value;refresh()\"></div></div>"
    sub(rate_nw, "${seeRate()?`" + rate_nw + "`:''}")
    sub("<b class=\"num\">${invInr((+n.q||0)*(+n.rate||0))}</b>", "${seeRate()?`<b class=\"num\">${invInr((+n.q||0)*(+n.rate||0))}</b>`:''}")
    sub("function geTotCard(g,tot,bill){", "function geTotCard(g,tot,bill){if(!seeRate())return '';")
    sub("<b>${inr(tot)}</b></div><div class=\"grid2\"><button class=\"btn line\" onclick=\"geSave(false)\">",
        "${seeRate()?'<b>'+inr(tot)+'</b>':''}</div><div class=\"grid2\"><button class=\"btn line\" onclick=\"geSave(false)\">")
    chk = "g.items.forEach((it,i)=>{if(!(+it.rate>0))e['r'+i]=1;});(g.nw||[]).forEach((it,i)=>{if(!(+it.rate>0))e['n'+i]=1;});"
    sub(chk, "if(seeRate()){" + chk + "}")
    sub(" if(+it.disc>0)a.push('Disc '+bpQ(it.disc)+'% of '+invInr(it.lr||it.rate));", " if(!seeRate()){}else if(+it.disc>0)a.push('Disc '+bpQ(it.disc)+'% of '+invInr(it.lr||it.rate));")
    sub(" const o=bpLastMap(g.id).get(it.pid),net=+it.rate||0;let w='';", " const o=seeRate()?bpLastMap(g.id).get(it.pid):null,net=+it.rate||0;let w='';")
    sub(" if(+it.bmrp>0&&net>+it.bmrp)w+=", " if(seeRate()&&+it.bmrp>0&&net>+it.bmrp)w+=")
    rate_iw = "<div class=\"field\"><label for=\"iw-r\">Rate (bill)</label><div class=\"inp\"><input id=\"iw-r\" inputmode=\"decimal\" value=\"${esc(w.rate||'')}\" oninput=\"${set('rate')}\"></div></div>"
    sub(rate_iw, "${seeRate()?`" + rate_iw + "`:''}")
    sub("· ${inr(grnTotal(g))}</div></div><span class=\"pill ${g.status==='pen", "${seeRate()?' · '+inr(grnTotal(g)):''}</div></div><span class=\"pill ${g.status==='pen")

    # the bill of a stock in: quantities only for Manager / Inventory; Admin gets "Enter rates" when they are missing
    sub("<div class=\"s\">${esc(x?x.pn:'')} · ${bpQ(it.q)} × ${invInr(net)}${disc?' (rate '+invInr(it.lr||net)+' less '+bpQ(disc)+'%)':''}",
        "<div class=\"s\">${esc(x?x.pn:'')} · ${bpQ(it.q)}${seeRate()?' × '+invInr(net)+(disc?' (rate '+invInr(it.lr||net)+' less '+bpQ(disc)+'%)':''):' pcs'}")
    sub("disc?'Disc '+bpQ(disc)+'%':cd>0?'Disc '+cd+'% (calculated from MRP)':''", "!seeRate()?'':disc?'Disc '+bpQ(disc)+'%':cd>0?'Disc '+cd+'% (calculated from MRP)':''")
    sub("</div><b class=\"num\">${invInr(r2((+it.q||0)*net))}</b></div>`;};", "</div>${seeRate()?`<b class=\"num\">${invInr(r2((+it.q||0)*net))}</b>`:''}</div>`;};")
    sub("${bpQ(w.q)} × ${invInr(w.rate)}", "${bpQ(w.q)}${seeRate()?' × '+invInr(w.rate):' pcs'}")
    sub("${bpQ(n.q)} × ${invInr(n.rate)}", "${bpQ(n.q)}${seeRate()?' × '+invInr(n.rate):' pcs'}")
    sub("<div class=\"card\">${kv('Items',invInr(tot))}",
        "${!seeRate()?(g.note?`<div class=\"card\"><div class=\"cap\">Remarks: ${esc(g.note)}</div></div>`:''):`<div class=\"card\">${kv('Items',invInr(tot))}")
    sub("${g.note?`<div class=\"cap\">Remarks: ${esc(g.note)}</div>`:''}</div>\n ${posted&&(g.pays||[]).length?",
        "${g.note?`<div class=\"cap\">Remarks: ${esc(g.note)}</div>`:''}</div>`}\n ${seeRate()&&posted&&(g.pays||[]).length?")
    sub("${posted?kv('Pay by',", "${posted&&seeRate()?kv('Pay by',")
    sub(" ${sec('Parts ('+((g.items||[]).length+(g.wait||[]).length)+')')}", " ${grnRateBanner(g)}\n ${sec('Parts ('+((g.items||[]).length+(g.wait||[]).length)+')')}")

    # purchase orders: no cost for Manager / Inventory; above the limit Admin approves first
    sub("<div class=\"s\">${x.pn} · stock ${DB.stock[id]} · sold ${sold30(x)}/30d · est. ${inr(poCost(x))}/pc</div>",
        "<div class=\"s\">${x.pn} · stock ${DB.stock[id]} · sold ${sold30(x)}/30d${seeRate()?' · est. '+inr(poCost(x))+'/pc':''}</div>")
    sub("<div class=\"hr\"></div><div class=\"kv big\"><span>Est. cost</span><span>${inr(tot)}</span></div><div class=\"cap\">Final rates come from the supplier bill at GRN.</div></div>",
        "${seeRate()?`<div class=\"hr\"></div><div class=\"kv big\"><span>Est. cost</span><span>${inr(tot)}</span></div>`:''}<div class=\"cap\">${poLimNote(tot)}</div></div>")
    sub("<button class=\"btn\" onclick=\"poSave('Sent')\" ${lines.length?'':'disabled'}>Send to supplier</button>",
        "<button class=\"btn\" onclick=\"poSave('Sent')\" ${lines.length?'':'disabled'}>${poNeedsOk(tot)?'Send for approval':'Send to supplier'}</button>")
    sub(" DB.pos.unshift({id,d:today(),supplier:po.supplier,items,status:st,by:S.user.name,est:items.reduce((a,i)=>a+poCost(P(i.pid))*i.q,0)});",
        " DB.pos.unshift({id,d:today(),supplier:po.supplier,items,status:st,by:S.user.name,est:items.reduce((a,i)=>a+poCost(P(i.pid))*i.q,0)});poRoute(DB.pos[0]);")
    sub("sheet(`${okBadge(72)}<h3 class=\"h2\">${id} ${st==='Sent'?'sent':'saved as draft'}</h3>",
        "sheet(`${okBadge(72)}<h3 class=\"h2\">${id} ${DB.pos[0].status==='Waiting for Admin'?'sent to Admin for approval':st==='Sent'?'sent':'saved as draft'}</h3>")
    sub("${st==='Sent'?'. Share it on WhatsApp or email with the supplier.':''}", "${DB.pos[0].status==='Sent'?'. Share it on WhatsApp or email with the supplier.':DB.pos[0].status==='Waiting for Admin'?'. It goes to the supplier once Admin approves it.':''}")
    sub("function poSend(id){const o=DB.pos.find(x=>x.id===id);o.status='Sent';",
        "function poSend(id){const o=DB.pos.find(x=>x.id===id);o.status='Sent';poRoute(o);if(o.status!=='Sent'){audit('Purchase order sent for approval',id,'Draft',o.status);save();toast(id+' sent to Admin for approval');return refresh();}")
    sub("<span class=\"pill ${o.status==='Sent'?'b':o.status==='Received'?'g':'a'}\">${o.status}</span></div><div class=\"cap\">${o.items.map(i=>esc(P(i.pid).name)+' × '+i.q).join(' · ')}</div><div class=\"kv\"><span>Est. cost</span><span>${inr(o.est)}</span></div>",
        "<span class=\"pill ${o.status==='Sent'?'b':o.status==='Received'?'g':o.status==='Rejected'?'r':'a'}\">${o.status}</span></div><div class=\"cap\">${o.items.map(i=>esc(P(i.pid).name)+' × '+i.q).join(' · ')}</div>${seeRate()?`<div class=\"kv\"><span>Est. cost</span><span>${inr(o.est)}</span></div>`:''}${o.ok?`<div class=\"cap\">${esc(o.ok)}</div>`:''}")
    sub("function decide(id,st){const a=DB.approvals.find(x=>x.id===id);a.st=st;",
        "function decide(id,st){const a=DB.approvals.find(x=>x.id===id);a.st=st;if(a.po){const o=(DB.pos||[]).find(x=>x.id===a.po);if(o&&o.status==='Waiting for Admin'){o.status=st==='approved'?'Sent':'Rejected';o.ok=(st==='approved'?'Approved by ':'Rejected by ')+S.user.name+' · '+today();}}")
    sub("a.st==='pending'&&a.pct>DISC_LIM.manager&&S.user.role!=='admin'?`<div class=\"row cap\" style=\"background:var(--amber-soft);border-radius:10px;padding:8px 10px;color:var(--amber)\">${ic('lock','s16')}Above your ${DISC_LIM.manager}% limit · Admin decides</div>`",
        "a.st==='pending'&&(a.po||a.pct>DISC_LIM.manager)&&S.user.role!=='admin'?`<div class=\"row cap\" style=\"background:var(--amber-soft);border-radius:10px;padding:8px 10px;color:var(--amber)\">${ic('lock','s16')}${a.po?'Above the purchase order limit':'Above your '+DISC_LIM.manager+'% limit'} · Admin decides</div>`")
    return a, n
