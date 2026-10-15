"""Update 9c: fixes from the 10-round review of every portal (Sam 2026-10-15 "tu khud ek aur 10 baar sabhi portal ko review kar").
Billing / Sales Exec / Inventory:
- warranty replacement only up to the billed quantity; its "Replacement given" sheet stays on screen
- a bill's items can't be returned twice (returns waiting for approval count), no return on a cancelled bill,
  a mechanic's unpaid credit bill is returned against what he owes ("Less from dues"), not as cash
- a new mechanic's first credit bill above the default Rs 25,000 limit needs Manager approval
- day closing: field cash still with the sales team is not expected in the drawer; no negative note counts; opening float can be typed
- the first tap after typing in a field is no longer lost (a field's change redraws the page a moment later)
- KYC: the ID proof no longer overwrites the KYC number; shop photo and ID are uploaded; shop location is the phone's real GPS
- amounts with paise ("12.75") are read right in Collect payment and Receive payment
- stock count can't be negative; stock adjustment can add or reduce; opening stock can't be negative or half a piece
- Stock in: the quantity can be typed; Supplier return and Print labels list every product (search), supplier return capped at stock
- invoice GST from each part's own GST % (was always 18%); bills on hold get unique numbers; Cancel/change sheet no longer stacks
- Scan "Try:" and invoice lines show the part number when a part has no barcode; Rs 0 warranty bills not counted as sales
usage: python3 qafix.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function wcUsed' in a: raise SystemExit('already done')
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:90]}')
    a = a.replace(old, new)

# ---- warranty: at most the billed quantity ----
sub("function wcSheet(){const c=S.ui.wc;const w=c&&DB.warranties.find(x=>x.id===c.w);if(!w)return;",
    """/* replacements already given for a warranty, and how many pieces the bill had (update 9c) */
function wcUsed(w){const used=(DB.wclaims||[]).filter(x=>x.w===w.id&&x.st==='Replaced').length;const b=DB.bills.find(x=>x.id===w.inv);const it=b&&(b.items||[]).find(i=>i.pid===w.pid);return {used,max:Math.max(1,+(it&&it.q)||1)};}
function wcSheet(){document.querySelectorAll('#vp .scrim').forEach(s=>s.remove());const c=S.ui.wc;const w=c&&DB.warranties.find(x=>x.id===c.w);if(!w)return;const wu=wcUsed(w);""")
sub(" ${open?`<div class=\"row cap\" style=\"background:var(--amber-soft);border-radius:10px;padding:10px\">${ic('clock','s16')}<span class=\"grow\">${esc(open.id)} is already open for this part (${open.st}).</span></div>`:`",
    " ${wu.used>=wu.max?`<div class=\"row cap\" style=\"background:var(--amber-soft);border-radius:10px;padding:10px\">${ic('checkC','s16')}<span class=\"grow\">Replacement already given for ${wu.used===1?'this part':'all '+wu.used+' pieces'} on ${esc(w.inv)}. The warranty is used.</span></div>`:open?`<div class=\"row cap\" style=\"background:var(--amber-soft);border-radius:10px;padding:10px\">${ic('clock','s16')}<span class=\"grow\">${esc(open.id)} is already open for this part (${open.st}).</span></div>`:`")
sub(" if(mode==='ask'&&!why){toast('Write what is wrong');return;}if(S.ui.wcUp){toast('Wait, the photo is saving');return;}",
    " if(mode==='ask'&&!why){toast('Write what is wrong');return;}if(S.ui.wcUp){toast('Wait, the photo is saving');return;}{const wu=wcUsed(w);if(wu.used>=wu.max){toast('Replacement already given: the warranty is used');return;}}")
sub("function wcGive(cid){const c=(DB.wclaims||[]).find(x=>x.id===cid);if(!c||c.st!=='Approved')return;",
    "function wcGive(cid){const c=(DB.wclaims||[]).find(x=>x.id===cid);if(!c||c.st!=='Approved')return;{const w=DB.warranties.find(x=>x.id===c.w);if(w){const wu=wcUsed(w);if(wu.used>=wu.max){toast('Replacement already given: the warranty is used');return;}}}")
sub("c.st='Replaced';c.rep={bill:id,by:S.user.name,at:today()};c.old='At shop';audit('Warranty replacement',c.id,c.inv,id);save();closeSheet();S.ui.wcq='';\n sheet(",
    "c.st='Replaced';c.rep={bill:id,by:S.user.name,at:today()};c.old='At shop';audit('Warranty replacement',c.id,c.inv,id);save();closeSheet();S.ui.wcq='';refresh();\n sheet(")
sub("<button class=\"btn\" onclick=\"closeSheet();refresh()\">Done</button></div>`);refresh();}",
    "<button class=\"btn\" onclick=\"closeSheet();refresh()\">Done</button></div>`);}")

# ---- returns ----
sub("SCREENS.creturn=()=>{const q=(S.ui.crq||'').trim().toUpperCase();const b=q?DB.bills.find(x=>x.id.toUpperCase()===q||x.id.toUpperCase().endsWith(q)):null;const sel=S.ui.crSel||(S.ui.crSel={});const mode=S.ui.crMode||'Wallet';",
    """/* pieces of a bill's part already returned, or waiting for approval (update 9c) */
const crBack=(bid,pid)=>(DB.returns||[]).filter(r=>r.bill===bid).reduce((a,r)=>a+(+r.items[pid]||0),0)+(DB.approvals||[]).filter(x=>x.ret&&x.ret.bid===bid&&x.st==='pending').reduce((a,x)=>a+(+x.ret.sel[pid]||0),0);
/* a mechanic's credit bill not paid in full: a return lowers what he owes */
const crDueInv=b=>b&&b.kind==='mech'?Object.values(DB.omech||{}).flat().find(v=>v.id===b.id&&v.amt>v.paid)||null:null;
SCREENS.creturn=()=>{const q=(S.ui.crq||'').trim().toUpperCase();const b=q?DB.bills.find(x=>x.id.toUpperCase()===q||x.id.toUpperCase().endsWith(q)):null;const sel=S.ui.crSel||(S.ui.crSel={});const dv=crDueInv(b);const mode=dv?(['Dues','Exchange'].includes(S.ui.crMode)?S.ui.crMode:'Dues'):S.ui.crMode==='Dues'?'Wallet':(S.ui.crMode||'Wallet');""")
sub("`:!b?`<div class=\"empty\">No bill ${esc(q)}. Items can only be returned against a bill.</div>`:`",
    "`:!b?`<div class=\"empty\">No bill ${esc(q)}. Items can only be returned against a bill.</div>`:b.cancel?`<div class=\"empty\">${esc(b.id)} is cancelled: its items are already back in stock. Nothing to return.</div>`:b.war?`<div class=\"empty\">${esc(b.id)} is a warranty replacement (₹0). Nothing to return.</div>`:`")
sub("const back=(DB.returns||[]).filter(r=>r.bill===b.id).reduce((a,r)=>a+(r.items[it.pid]||0),0);const max=it.q-back;",
    "const back=crBack(b.id,it.pid);const max=Math.max(0,it.q-back);")
sub("${back?' · '+back+' already returned':''}", "${back?' · '+back+' already returned or waiting':''}")
sub("${sec('Give back as')}<div class=\"grid2\">${[['Wallet','wallet','Instant, no cash out'],['Cash','rupee','From the drawer'],['UPI','phone','To original UPI'],['Exchange','repeat','Swap for another part']]",
    "${sec('Give back as')}<div class=\"grid2\">${(dv?[['Dues','minus','Less from what '+(b.pname||'the mechanic')+' owes ('+inr(dv.amt-dv.paid)+')'],['Exchange','repeat','Swap for another part']]:[['Wallet','wallet','Instant, no cash out'],['Cash','rupee','From the drawer'],['UPI','phone','To original UPI'],['Exchange','repeat','Swap for another part']])")
sub("</div></div>${b?`<div class=\"foot\"><div class=\"sum\">${Object.values(sel).reduce((a,v)=>a+(+v||0),0)} item(s) · ${mode}<b>${inr(amt)}</b></div>",
    "</div></div>${b&&!b.cancel&&!b.war?`<div class=\"foot\"><div class=\"sum\">${Object.values(sel).reduce((a,v)=>a+(+v||0),0)} item(s) · ${mode==='Dues'?'less from dues':mode}<b>${inr(amt)}</b></div>")
sub("function crSave(bid,amt){const sel={...(S.ui.crSel||{})},mode=S.ui.crMode||'Wallet',why=S.ui.crWhy||'Wrong part',need=retNeed(amt);",
    """function crSave(bid,amt){const b0=DB.bills.find(x=>x.id===bid);if(!b0||b0.cancel){toast('This bill is cancelled');return;}const dv0=crDueInv(b0);
 const sel={...(S.ui.crSel||{})},mode=dv0?(['Dues','Exchange'].includes(S.ui.crMode)?S.ui.crMode:'Dues'):S.ui.crMode==='Dues'?'Wallet':(S.ui.crMode||'Wallet'),why=S.ui.crWhy||'Wrong part',need=retNeed(amt);
 if(Object.entries(sel).some(([pid,q])=>q>0&&q>((b0.items.find(i=>i.pid===pid)||{}).q||0)-crBack(bid,pid))){toast('Some of these pieces are already returned or waiting for approval');return;}""")
sub(" if(mode==='Wallet'){if(b.mob)cwAdd(b.mob,{t:'Refund · '+id,cr:amt});else if(b.kind==='mech')DB.wl.push({d:today(),t:'Refund · '+id,cr:amt});}",
    " if(mode==='Dues'){const v=crDueInv(b);const less=v?Math.min(amt,v.amt-v.paid):0;if(v)v.amt=r2(v.amt-less);const rest=r2(amt-less);if(rest>0)DB.wl.push({d:today(),t:'Refund · '+id,cr:rest});}\n if(mode==='Wallet'){if(b.mob)cwAdd(b.mob,{t:'Refund · '+id,cr:amt});else if(b.kind==='mech')DB.wl.push({d:today(),t:'Refund · '+id,cr:amt});}")
sub("${inr(amt)} ${mode==='Wallet'?'added to '+esc(b.pname||b.p||'customer')+'’s wallet':",
    "${inr(amt)} ${mode==='Dues'?'taken off what '+esc(b.pname||b.p||'the mechanic')+' owes':mode==='Wallet'?'added to '+esc(b.pname||b.p||'customer')+'’s wallet':")

# ---- a new mechanic's first credit bill ----
sub("function blCredNeed(code,amt){if(!code||code==='new'||!(amt>0))return '';",
    "function blCredNeed(code,amt){if(!code||!(amt>0))return '';if(code==='new')return amt>25000?'A new mechanic’s first credit of '+inr(amt)+' is above the '+inr(25000)+' limit':'';")

# ---- day closing ----
sub("const fc=(DB.fcol||[]).filter(x=>x.st==='To deposit');const fcT=fc.filter(x=>x.pm==='Cash').reduce((a,x)=>a+x.amt,0);",
    "const fc=(DB.fcol||[]).filter(x=>x.st==='To deposit');const fcT=fc.filter(x=>x.pm==='Cash'&&x.d===today()).reduce((a,x)=>a+x.amt,0);")
sub("const open=S.ui.dcOpen??2000;const exp=open+c.total+fcT-refunds;", "const open=S.ui.dcOpen??2000;const exp=open+c.total-fcT-refunds;")
sub("${fcT?`<div class=\"kv\"><span>Field cash from sales team</span><span>+ ${inr(fcT)}</span></div>`:''}",
    "${fcT?`<div class=\"kv\"><span>Field cash still with the sales team</span><span style=\"color:var(--r)\">− ${inr(fcT)}</span></div>`:''}")
sub("<div class=\"kv\"><span>Opening cash (float)</span><span>${inr(open)}</span></div>",
    "<div class=\"kv\"><span>Opening cash (float)</span><span class=\"inp\" style=\"height:34px;width:110px;flex:none;padding:0 8px\"><b>₹</b><input inputmode=\"numeric\" aria-label=\"Opening cash\" value=\"${open}\" onchange=\"S.ui.dcOpen=Math.max(0,parseInt(this.value)||0);refresh()\"></span></div>")
sub("S.ui.dcN[${d}]=parseInt(this.value)||0;refresh()", "S.ui.dcN[${d}]=Math.max(0,parseInt(this.value)||0);refresh()")
sub("DB.fcol=[{id,n:m.n,code:f.code,amt,pm:f.pm,by:S.user.name,st:", "DB.fcol=[{id,d:today(),n:m.n,code:f.code,amt,pm:f.pm,by:S.user.name,st:")
sub("const billsToday=()=>DB.bills.filter(b=>(b.iso||isoToday())===isoToday()&&!b.cancel);",
    "const billsToday=()=>DB.bills.filter(b=>(b.iso||isoToday())===isoToday()&&!b.cancel&&!b.war);")

# ---- the first tap after typing: a field's change redraws a moment later, so the tap lands on what the user saw ----
sub("function refresh(){const vp=document.getElementById('vp');",
    "function refresh(){const ev=window.event;if(ev&&ev.type==='change'&&ev.isTrusted){clearTimeout(refresh._t);refresh._t=setTimeout(refresh,250);return;}clearTimeout(refresh._t);const vp=document.getElementById('vp');")

# ---- KYC ----
sub("const ok=k.n&&k.shop&&/^[6-9]\\d{9}$/.test(k.mob||'')&&k.area&&k.photo&&k.id&&k.gps;",
    "const ok=k.n&&k.shop&&/^[6-9]\\d{9}$/.test(k.mob||'')&&k.area&&k.photo&&k.idp&&k.gps&&!S.ui.kyUp;")
sub("${[['photo','camera','Shop photo'],['id','file','Aadhaar / ID'],['gps','pin','Shop location']].map(([key,i,l])=>`<button class=\"qa2\" style=\"${k[key]?'border-color:var(--g);background:var(--g-soft)':''}\" onclick=\"${key==='gps'?`toast('Location captured');S.ui.kyc.gps='12.9756, 77.5360';refresh()`:`document.getElementById('kyf-${key}').click()`}\"><span class=\"tile sm ${k[key]?'g':''}\">${ic(k[key]?'checkC':i,'s20')}</span>${k[key]?(key==='gps'?'Located':'Added'):l}</button>`).join('')}</div>",
    "${[['photo','camera','Shop photo'],['idp','file','Aadhaar / ID'],['gps','pin','Shop location']].map(([key,i,l])=>`<button class=\"qa2\" style=\"${k[key]?'border-color:var(--g);background:var(--g-soft)':''}\" onclick=\"${key==='gps'?'kyGps()':`document.getElementById('kyf-${key}').click()`}\"><span class=\"tile sm ${k[key]?'g':''}\">${ic(k[key]?'checkC':i,'s20')}</span>${S.ui.kyUp===key?'Saving…':k[key]?(key==='gps'?'Located':'Added'):l}</button>`).join('')}</div>")
sub("<input type=\"file\" id=\"kyf-photo\" accept=\"image/*\" capture=\"environment\" hidden onchange=\"if(this.files[0]){S.ui.kyc.photo=this.files[0].name;refresh()}\"><input type=\"file\" id=\"kyf-id\" accept=\"image/*,application/pdf\" hidden onchange=\"if(this.files[0]){S.ui.kyc.id=this.files[0].name;refresh()}\">",
    "<input type=\"file\" id=\"kyf-photo\" accept=\"image/*\" capture=\"environment\" hidden onchange=\"kyFile('photo',this.files)\"><input type=\"file\" id=\"kyf-idp\" accept=\"image/*\" hidden onchange=\"kyFile('idp',this.files)\">")
sub("function kycSave(){const k=S.ui.kyc;const id='KYC-'+(41+(DB.kyc||[]).length);DB.kyc=[{id,...k,",
    """/* KYC proofs go up to the server like any photo; the location is the phone's own GPS (update 9c) */
async function kyFile(key,files){const f=files&&files[0];if(!f||!S.ui.kyc)return;S.ui.kyUp=key;refresh();
 try{if(f.size>25*1024*1024)throw new Error('This photo is too big (25 MB max)');const r=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f,credentials:'same-origin'});
  if(r.status===401){srvExpired();return;}const j=await r.json().catch(()=>({}));if(!r.ok||!(j.orig||j.url))throw new Error(j.error||'Photo not saved');S.ui.kyc[key]=j.orig||j.url;}
 catch(e){toast(e&&e.message&&!/fetch|network/i.test(e.message)?e.message:'Photo not saved. Check the internet and try again.');}
 S.ui.kyUp=0;refresh();}
function kyGps(){if(!navigator.geolocation){toast('This phone cannot share its location');return;}toast('Finding the location…');
 navigator.geolocation.getCurrentPosition(p=>{if(!S.ui.kyc)return;S.ui.kyc.gps=p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5);toast('Location captured');refresh();},
  ()=>toast('Location not allowed. Allow location for this site and try again.'),{enableHighAccuracy:true,timeout:15000});}
function kycSave(){const k=S.ui.kyc;const id='KYC-'+(41+(DB.kyc||[]).length);DB.kyc=[{...k,id,""")

# ---- amounts with paise ----
sub("parseInt(this.value.replace(/\\\\D/g,''))||0", "Math.round((parseFloat(this.value.replace(/[^\\\\d.]/g,''))||0)*100)/100", 3)

# ---- stock moves ----
sub("if(t==='count'&&(f.counted===''||isNaN(+f.counted))){S.ui.mvErr='Enter the counted quantity.';return refresh();}",
    "if(t==='count'&&(f.counted===''||isNaN(+f.counted)||+f.counted<0||!Number.isInteger(+f.counted))){S.ui.mvErr='Enter the counted quantity (0 or more, whole pieces).';return refresh();}")
sub("${t==='damaged'?'−':'±'}${f.q}${f.reason?' · '+f.reason:''}`,ic:m[1],st:'pending',move:{pid:f.pid,q:t==='damaged'?-f.q:-f.q}});",
    "${t==='damaged'||f.dir!=='add'?'−':'+'}${f.q}${f.reason?' · '+f.reason:''}`,ic:m[1],st:'pending',move:{pid:f.pid,q:t==='adjust'&&f.dir==='add'?f.q:-f.q}});")
sub(" ${t==='transfer'?`<div class=\"field\"><label>To branch</label>",
    " ${t==='adjust'?`<div class=\"grid2\">${[['less','Reduce stock'],['add','Add to stock']].map(([k,l])=>`<button class=\"opt ${(f.dir||'less')===k?'on':''}\" onclick=\"S.ui.mv.dir='${k}';refresh()\"><span class=\"radio\"></span>${l}</button>`).join('')}</div>`:''}\n ${t==='transfer'?`<div class=\"field\"><label>To branch</label>")
sub("if(a.open===''||!(n(a.open)>=0))e.open='Enter opening stock (0 if none).';",
    "if(a.open===''||!(n(a.open)>=0)||String(a.open).includes('-'))e.open='Enter opening stock (0 if none).';else if(/^(pcs|piece|pieces|nos|set|sets|pair|pairs|box)$/i.test(String(a.unit||'pcs').trim())&&!Number.isInteger(n(a.open)))e.open='Opening stock is in whole '+(a.unit||'pcs')+'.';", 2)

# ---- Stock in: type the quantity ----
sub("aria-label=\"Less\">${ic('minus','s16')}</button><span class=\"num\">${it.q}</span><button onclick=\"S.ui.ge.items[${i}].q=(+S.ui.ge.items[${i}].q)+1;refresh()\"",
    "aria-label=\"Less\">${ic('minus','s16')}</button><input class=\"num\" inputmode=\"numeric\" aria-label=\"Qty received\" value=\"${it.q}\" style=\"width:64px;text-align:center;border:0;background:transparent;font-weight:700;font-size:15px;color:inherit\" onchange=\"S.ui.ge.items[${i}].q=Math.max(0,parseInt(this.value)||0);refresh()\"><button onclick=\"S.ui.ge.items[${i}].q=(+S.ui.ge.items[${i}].q)+1;refresh()\"")

# ---- Supplier return and Print labels: every product, with a search ----
sub("function barcodeSvg(code,h=38){",
    """/* a product list with a search box (Supplier return, Print labels): picked ones first, then the matches (update 9c) */
const pkList=(q,sel,ok)=>{q=String(q||'').trim().toLowerCase();const L=PRODUCTS.filter(x=>(!ok||ok(x))&&(!q||(x.name+' '+x.pn+' '+(x.brand||'')).toLowerCase().includes(q)));return [...PRODUCTS.filter(x=>sel[x.id]>0&&!L.includes(x)),...L].slice(0,40);};
const pkSearch=(id,key,n)=>`<div class="search" style="margin-bottom:8px">${ic('search','s18')}<input id="${id}" placeholder="Search ${n} products by name or part no." value="${esc(S.ui[key]||'')}" oninput="S.ui.${key}=this.value;clearTimeout(window._pkT);window._pkT=setTimeout(()=>{refresh();const e=document.getElementById('${id}');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},350)"></div>`;
function barcodeSvg(code,h=38){""")
sub("${sec('Items')}<div class=\"card flush\">${PRODUCTS.slice(0,8).map(x=>{const q=r.items[x.id]||0;",
    "${sec('Items')}${pkSearch('sr-q','srq',PRODUCTS.length)}<div class=\"card flush\">${pkList(S.ui.srq,r.items,x=>(DB.stock[x.id]||0)+((DB.damaged||{})[x.id]||0)>0).map(x=>{const q=r.items[x.id]||0,cap=(DB.stock[x.id]||0)+((DB.damaged||{})[x.id]||0);")
sub("<button onclick=\"S.ui.sr.items['${x.id}']=${q}+1;refresh()\" aria-label=\"More\">",
    "<button onclick=\"S.ui.sr.items['${x.id}']=Math.min(${cap},${q}+1);refresh()\" aria-label=\"More\">")
sub("}).join('')}</div>\n ${list.length?`${sec('Debit notes')}",
    "}).join('')||'<div class=\"empty\">No product in stock matches</div>'}</div>\n ${list.length?`${sec('Debit notes')}")
sub("pcs at purchase rate<b>${inr(tot)}</b>", "pcs at mechanic price<b>${inr(tot)}</b>")
sub("${sec('Products')}<div class=\"card flush\">${PRODUCTS.slice(0,10).map(x=>{const q=sel[x.id]||0;",
    "${sec('Products')}${pkSearch('lb-q','lbq',PRODUCTS.length)}<div class=\"card flush\">${pkList(S.ui.lbq,sel).map(x=>{const q=sel[x.id]||0;")
sub("${binOf(x.id)==='Not set'?'A-1-01':binOf(x.id)}", "${binOf(x.id)==='Not set'?'NO RACK':binOf(x.id)}")

# ---- GST from each part's own rate ----
sub("const ex=d.ex||[],sub=d.items.reduce((a,i)=>a+i.q*i.r,0),tot=sub+ex.reduce((a,x)=>a+x[1],0),mrpT=d.items.reduce((a,i)=>a+i.q*i.mrp,0),T100=Math.round(tot*100),tx100=Math.round(T100/1.18),",
    "const ex=d.ex||[],sub=d.items.reduce((a,i)=>a+i.q*i.r,0),tot=sub+ex.reduce((a,x)=>a+x[1],0),mrpT=d.items.reduce((a,i)=>a+i.q*i.mrp,0),T100=Math.round(tot*100),tx100=Math.round(gstTaxable(d.items,tot)*100),gRt=gstRates(d.items),")
sub("['CGST 9%',inr2(cg)],['SGST 9%',inr2(sg)]", "['CGST'+(gRt.length===1?' '+gRt[0]/2+'%':''),inr2(cg)],['SGST'+(gRt.length===1?' '+gRt[0]/2+'%':''),inr2(sg)]")
sub("<span>GST (incl.)</span><span>${inr(tot*18/118)}</span>",
    "<span>GST (incl.)</span><span>${inr(tot-gstTaxable(Object.entries(inv.items).filter(([,q])=>q>0).map(([pid,q])=>({pid,q,r:(P(pid)||{}).price||0})),tot))}</span>")
sub("<span>GST (incl.)</span><span>${inr(b.amt*18/118)}</span>", "<span>GST (incl.)</span><span>${inr(b.amt-gstTaxable(b.items||[],b.amt))}</span>")
sub("[['Bill','Time','Party','GSTIN','Taxable','CGST 9%','SGST 9%','Total','Mode'],...DB.bills.map(b=>{const t=b.amt/1.18;return [b.id,b.t,b.pname||b.p,b.kind==='mech'?mechGst(b):'',t.toFixed(2),(t*.09).toFixed(2),(t*.09).toFixed(2),b.amt,b.pm];})]",
    "[['Bill','Time','Party','GSTIN','Taxable','CGST','SGST','Total','Mode'],...DB.bills.filter(b=>!b.cancel).map(b=>{const t=gstTaxable(b.items||[],b.amt);return [b.id,b.t,b.pname||b.p,b.kind==='mech'?mechGst(b):'',t.toFixed(2),((b.amt-t)/2).toFixed(2),((b.amt-t)/2).toFixed(2),b.amt,b.pm];})]")
sub("const gstRate=h=>{", """/* a bill line's GST %: the part's own, else its HSN's rate; the taxable value of a GST-inclusive total (update 9c) */
const gstOfPid=pid=>{const x=P(pid);if(!x||!x.id)return 18;const h=/^\\d{4,8}$/.test(String(x.hsn||''))?String(x.hsn):HSN(x);return +x.gst>0?+x.gst:gstRate(h);};
const gstRates=items=>[...new Set((items||[]).map(i=>gstOfPid(i.pid)))];
function gstTaxable(items,tot){items=(items||[]).filter(i=>+i.q>0);const gross=items.reduce((a,i)=>a+(+i.r||0)*(+i.q||0),0);if(!gross)return (+tot||0)/1.18;const f=(+tot||0)/gross;return items.reduce((a,i)=>a+(+i.r||0)*(+i.q||0)*f/(1+gstOfPid(i.pid)/100),0);}
const gstRate=h=>{""")

# ---- bills on hold: unique numbers ----
sub("const id='HOLD-'+(11+(DB.held||[]).length);", "const id='HOLD-'+Math.max(11,1+(DB.held||[]).reduce((m,h)=>Math.max(m,+String(h.id).slice(5)||0),10),+(DB.holdN||10)+1);DB.holdN=+id.slice(5);")
sub("function resumeHeld(id){const h=DB.held.find(x=>x.id===id);", "function resumeHeld(id){const h=DB.held.find(x=>x.id===id);if(!h)return;")

# ---- Cancel/change sheet: one sheet ----
sub("function brDraw(b){const r=S.ui.br;sheet(", "function brDraw(b){const r=S.ui.br;document.querySelectorAll('#vp .scrim').forEach(s=>s.remove());sheet(")

# ---- parts with no barcode ----
sub("Try: ${PRODUCTS.slice(0,3).map(y=>`<button class=\"link\" onclick=\"doScan('${barcodeOf(y)}')\">${barcodeOf(y)}</button>`).join(' · ')}",
    "Try: ${PRODUCTS.slice(0,3).map(y=>{const c=barcodeOf(y)!=='—'?barcodeOf(y):y.pn;return `<button class=\"link\" onclick=\"doScan('${esc(c)}')\">${esc(c)}</button>`;}).join(' · ')}")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
