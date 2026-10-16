"""Update 9c part 2: Manager / Accountant / Admin / customer / mechanic fixes from the 10-pass review (Sam 2026-10-15).
- Sales, GST and P&L leave out cancelled bills (perBills).
- Dates written "15 Oct" (expenses, payments) count in this month's totals (inMonth): Admin P&L expenses, target "collected".
- Salary & advance opens (initials was not in its scope); Receive payment opens with no mechanics.
- Cancelling a bill after a return puts back only the pieces not returned, and the request sheet says what was returned.
- Purchases today leaves out rejected / waiting orders; Payables = what Suppliers shows; supplier credit notes reduce it;
  an advance is at most the order's amount still unpaid.
- Day closing subtracts only cash refunds given today; a closing is matched by its full date.
- Amounts: "-700" or "1e5" are refused, not read as 700 / 15; salary must be above 0; shop name / phone / UPI checked;
  staff login needs a real mobile (6-9, 10 digits) or email; mechanic price rule cannot be above the customer price.
- "1 bill" not "1 bills"; minus amounts as "−₹500".
- Customer: unique order / part-order / warranty numbers; cart and checkout keep to the shop's stock.
- Mechanic: one-part order shows the bulk price total; job card labour cannot be minus and the mobile must be 10 digits.
- After logging in, the shop's prices replace what the public page had.
- "Log out from all devices" really logs out every device.
usage: python3 qafix2.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function acIni' in a: raise SystemExit('already done')
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:90]}')
    a = a.replace(old, new)
# cancelled bills
sub("return (DB.bills||[]).filter(b=>{const i=String(b.iso||'');return per==='today'",
    "return (DB.bills||[]).filter(b=>{if(b.cancel)return false;const i=String(b.iso||'');return per==='today'")
# this month's dates written without a year
sub("const inMonth=d=>String(d||'').endsWith(moSuf());",
    "const inMonth=d=>{const s=String(d||'').trim();if(s.endsWith(moSuf()))return true;if(/^\\d{4}-\\d\\d/.test(s))return s.startsWith(moIso());return new RegExp('^\\\\d{1,2} '+moName(0,1)+'$').test(s);};")
# salary screen
sub("SCREENS.acsal=()=>{", "function acIni(n){return String(n||'').split(' ').filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();}\nSCREENS.acsal=()=>{")
sub("<div class=\"tile k round\">${esc(initials(a.name))}</div>", "<div class=\"tile k round\">${esc(acIni(a.name))}</div>")
# receive with no mechanics
sub("SCREENS.receive=()=>{const all=MECHS_R();", "SCREENS.receive=()=>{const all=MECHS_R();if(!all.length)return bar('Receive payment')+'<div class=\"scroll\"><div class=\"pad\"><div class=\"empty\">No mechanic has a credit account yet.</div></div></div>';")
# cancel after a return
sub(" (b.items||[]).forEach(i=>{if(!i.q)return;DB.stock[i.pid]=(DB.stock[i.pid]||0)+i.q;logMove('in',i.pid,i.q,b.id,'Bill cancelled');});",
    " const rq=billRetQ(b.id);(b.items||[]).forEach(i=>{const back=Math.max(0,(+i.q||0)-(rq[i.pid]||0));if(rq[i.pid])rq[i.pid]=Math.max(0,rq[i.pid]-(+i.q||0));if(!back)return;DB.stock[i.pid]=(DB.stock[i.pid]||0)+back;logMove('in',i.pid,back,b.id,'Bill cancelled');});")
sub("function billCancel(bid,r){",
    "/* pieces of a bill already returned (any return of it) */\nfunction billRetQ(bid){const o={};(DB.returns||[]).filter(x=>x.bill===bid).forEach(x=>Object.entries(x.items||{}).forEach(([p,q])=>{o[p]=(o[p]||0)+(+q||0);}));return o;}\nfunction billCancel(bid,r){")
sub("<p class=\"cap\">${esc(b.pname||b.p)} · ${inr(b.amt)} · ${b.pm}</p>",
    "<p class=\"cap\">${esc(b.pname||b.p)} · ${inr(b.amt)} · ${b.pm}</p>${(R=>R.length?`<div class=\"row cap\" style=\"background:var(--amber-soft,#FFF4DC);border-radius:12px;padding:10px;gap:8px\">${ic('alert','s16')}<span class=\"grow\">Already returned: ${R.map(x=>esc(x.id)+' '+inr(x.amt)).join(', ')}. Those pieces are not added to stock again; give back only the rest.</span></div>`:'')((DB.returns||[]).filter(x=>x.bill===b.id))}")
# purchases today
sub("const td=(DB.pos||[]).filter(o=>o.d===today()&&o.status!=='Draft')", "const td=(DB.pos||[]).filter(o=>o.d===today()&&['Sent','Received'].includes(o.status))")
# supplier outstanding: credit notes received reduce it
sub("const supOut=s=>r2(supBills(s.n).reduce((a,g)=>a+bpBal(g),0)+(+s.pay||0)-supAdvAmt(s.n));",
    "const supOut=s=>r2(supBills(s.n).reduce((a,g)=>a+bpBal(g),0)+(+s.pay||0)-supAdvAmt(s.n)-(DB.sret||[]).filter(d=>d.sup===s.n&&d.st==='Credit received').reduce((a,d)=>a+(+d.amt||0),0));")
sub("const pay=sups().reduce((a,s)=>a+(+s.pay||0),0);const mo=allOut()", "const pay=sups().reduce((a,s)=>a+Math.max(0,supOut(s)),0);const mo=allOut()")
sub("statTile('y','Payables',L(pay),sups().filter(s=>s.pay).length+' supplier'+(sups().filter(s=>s.pay).length===1?'':'s'))",
    "statTile('y','Payables',L(pay),(n=>n+' supplier'+(n===1?'':'s'))(sups().filter(s=>supOut(s)>0).length))")
sub(" if(!(a>0)){document.getElementById('adv-e').textContent='Enter the amount paid.';return;}\n (DB.supAdv=DB.supAdv||[])",
    " if(!(a>0)){document.getElementById('adv-e').textContent='Enter the amount paid.';return;}\n const room=r2((+o.est||0)-poAdv(id));if(a>room){document.getElementById('adv-e').textContent=room>0?'Advance can be at most '+inr(room)+' (order '+inr(+o.est||0)+', already paid '+inr(poAdv(id))+').':'This order is already fully paid in advance.';return;}\n (DB.supAdv=DB.supAdv||[])")
# day closing
sub("const refunds=(DB.returns||[]).filter(x=>x.d===today()&&x.mode==='Cash').reduce((a,x)=>a+x.amt,0);",
    "const refunds=(DB.returns||[]).filter(x=>x.given&&x.given.d===isoToday()&&x.given.mode==='Cash').reduce((a,x)=>a+x.amt,0);")
sub("const done=(DB.closings||[]).find(x=>x.d===today());", "const done=(DB.closings||[]).find(x=>x.iso?x.iso===isoToday():x.d===today());")
sub("DB.closings=[{d:today(),t,exp,counted,diff,by:S.user.name}", "DB.closings=[{d:today(),iso:isoToday(),t,exp,counted,diff,by:S.user.name}")
# amounts
sub("const acNum=id=>r2(parseFloat(String((document.getElementById(id)||{}).value||'').replace(/[^\\d.]/g,''))||0);",
    "const acNum=id=>{const s=String((document.getElementById(id)||{}).value||'').replace(/[\\s,₹]/g,'');return /^(\\d+\\.?\\d*|\\.\\d+)$/.test(s)?r2(parseFloat(s)):0;};")
sub("function acSalSetOk(k){const v=acNum('sl-a');", "function acSalSetOk(k){const v=acNum('sl-a');if(!(v>0)){toastWarn('Enter the monthly salary (numbers only).');return;}")
sub(" const old=JSON.stringify(DB.settings||{});DB.settings={cw:",
    " if(!String(f.sn||'').trim()){e.textContent='Enter the shop name.';return;}if(String(f.ph||'').trim()&&!/^(\\+?91[\\s-]?)?[6-9]\\d{9}$/.test(String(f.ph).replace(/[\\s-]/g,''))){e.textContent='Shop phone must be a 10-digit mobile number.';return;}if(String(f.upi||'').trim()&&!/^[\\w.\\-]{2,}@[a-zA-Z]{2,}$/.test(String(f.upi).trim())){e.textContent='UPI ID looks wrong (e.g. bikepharma@okhdfc).';return;}\n const old=JSON.stringify(DB.settings||{});DB.settings={cw:")
sub("if(!id||(!id.includes('@')&&id.length!==10)){S.ui.nsErr=",
    "if(!id||(!id.includes('@')&&!/^[6-9]\\d{9}$/.test(id))||(id.includes('@')&&!/^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$/i.test(id))){S.ui.nsErr=")
sub("if(!(c>=0&&c<100&&m>=0&&m<100)){e.textContent='Enter a % from 0 to 99 for both.';e.style.display='';return;}",
    "if(!(c>=0&&c<100&&m>=0&&m<100)){e.textContent='Enter a % from 0 to 99 for both.';e.style.display='';return;}\n if(m<c){e.textContent='The mechanic % must be the same or more than the customer %, so the mechanic price is never above the customer price.';e.style.display='';return;}")
sub("new Date(a.d+' 2026')-new Date(b.d+' 2026')", "new Date(a.d+' '+new Date().getFullYear())-new Date(b.d+' '+new Date().getFullYear())", 2)
# words and minus amounts
sub("<span>Sales (${B.length} bills)</span>", "<span>Sales (${B.length} bill${B.length===1?'':'s'})</span>")
sub("Sales ${inr(d.sales)} · ${d.bills} bills (", "Sales ${inr(d.sales)} · ${d.bills} bill${d.bills===1?'':'s'} (")
sub("${d.bills.toLocaleString('en-IN')} bills · avg", "${d.bills.toLocaleString('en-IN')} bill${d.bills===1?'':'s'} · avg")
sub("const inr=n=>'₹'+Math.round(n).toLocaleString('en-IN');", "const inr=n=>{const v=Math.round(+n||0);return (v<0?'−₹':'₹')+Math.abs(v).toLocaleString('en-IN');};")
# customer: unique numbers, stock
sub("const id='BP-ORD-2026-'+(10482+DB.orders.length);", "const id='BP-ORD-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-7);")
sub("const id='SO-'+(1001+soList().length);", "const id='SO-'+String(Date.now()).slice(-7);")
sub("const w={id:'W-'+(1001+DB.warranties.length),", "const w={id:'W-'+String(Date.now()).slice(-8)+'-'+out.length,")
sub("function addCart(id,q=1){const p=P(id);if(p.stock===0){toast('Out of stock');return;}const e=DB.cart.find(x=>x.id===id);if(e)e.q+=q;else",
    "const cStk=id=>{const s=DB.stock||{};return id in s?Math.max(0,+s[id]||0):Math.max(0,+(P(id)||{}).stock||0);};\nfunction addCart(id,q=1){const p=P(id);const have=cStk(id),e=DB.cart.find(x=>x.id===id);if(!have){toast('Out of stock');return;}if((e?e.q:0)+q>have){toastWarn('Only '+have+' in stock');return;}if(e)e.q+=q;else")
sub("function setQty(id,d){const e=DB.cart.find(x=>x.id===id);if(!e)return;e.q+=d;",
    "function setQty(id,d){const e=DB.cart.find(x=>x.id===id);if(!e)return;if(d>0&&e.q+d>cStk(id)){toastWarn('Only '+cStk(id)+' in stock');return;}e.q+=d;")
sub("function placeOrder(){const t=cartTotals();",
    "function placeOrder(){const over=DB.cart.find(c=>c.q>cStk(c.id));if(over){toastWarn(cStk(over.id)?'Only '+cStk(over.id)+' of '+P(over.id).name+' in stock. Change the quantity.':P(over.id).name+' is out of stock. Remove it from the cart.');return;}const t=cartTotals();")
# mechanic
sub("<span>${esc(x.name)} × ${q}</span><span>${inr(x.mp*q)}</span>", "<span>${esc(x.name)} × ${q}</span><span>${inr(lines.length===1?tot:x.mp*q)}</span>")
sub("onchange=\"S.ui.jc.labour=parseInt(this.value)||0;refresh()\"", "onchange=\"S.ui.jc.labour=Math.max(0,parseInt(this.value)||0);refresh()\"")
sub("function jcSave(){const j=S.ui.jc;if(!j.cust||!String(j.cust).trim()){toast('Enter the customer name');return;}",
    "function jcSave(){const j=S.ui.jc;if(!j.cust||!String(j.cust).trim()){toast('Enter the customer name');return;}if(j.ph&&!/^[6-9]\\d{9}$/.test(String(j.ph).replace(/\\D/g,'').slice(-10))){toastWarn('Enter a 10-digit mobile number');return;}j.labour=Math.max(0,+j.labour||0);")
sub("x.pn+' · your price '+inr(x.mp)+' · stock '+DB.stock[x.id]", "x.pn+' · your price '+inr(x.mp)+' · stock '+(+DB.stock[x.id]||0)")
# log out everywhere, language
sub("function logout(all){srvLogout();", "function logout(all){srvLogout(all);")
sub("function srvLogout(){clearTimeout(SRV.t);const ch=srvDiff();const done=()=>api('POST','/api/logout')",
    "function srvLogout(all){clearTimeout(SRV.t);const ch=srvDiff();const done=()=>api('POST','/api/logout',all?{all:true}:undefined)")
# (the language is NOT kept after reload: Sam's rule, English on every open)
# a login after the public page: the staff / mechanic prices replace the public ones (the public view has no mechanic price)
sub("function srvSetDb(db,rev){window.BOOT_DB=db;load();", "function srvSetDb(db,rev){window.BOOT_DB=db;load();try{invSyncP();offApply();}catch(e){}")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
