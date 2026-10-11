"""Sam 2026-10-11 13:05Z: use the brand catalogues to add inventory. Plan OK'd 14:16Z ("haan"), photos 14:16Z/14:19Z ("photo 3-4 all
products pe lena zaroori he", "bagair photo ke koi bhi inventory add nhi hona he"), designs in Figma (Inventory (11 Oct), phone INV-1..8 and
website INV-W1..W6), "Code karde" 15:23Z, 16:39Z "coding pe kaam karde aur mobile view bhi check kar".

- A part number fills name, brand, category, MRP and the bikes it fits from every catalogue we have (the same files Find Part reads).
  When the same number is in two brands' catalogues (Hero and Honda), staff pick the brand.
- A part is never saved twice: a number already in the list only gets qty (Stock in); one waiting for photos is finished there.
- Every new part needs at least 1 photo, 4 at most (Sam 17:32Z "3-4 maximum photo lkn mandatory mat karna... 1 photos bhi daal sakte he"), taken by the shop. They go to the server exactly as taken (/api/photo) and show in the app.
- Selling prices of a new part come from the Admin's rule: customer MRP - 5 %, mechanic MRP - 15 % (Admin can change the rule or one
  part's prices). KTM, Husqvarna and Bajaj catalogues have no MRP: it is typed from the pack.
- Stock in takes catalogue parts that are not in the list yet as new-part lines. Lines without their photos and MRP wait in
  "Waiting for photos" with their qty and rate when the bill is posted, and go into stock when their photos are done.
- Paste supplier bill: lines copied from Excel or WhatsApp are checked against the list and the catalogues, then go on the Stock in bill.
- Find Part's part page has "Add to stock" for a part that is not in the list yet.
Desktop (html.wv) pages use two columns like the Figma website frames; on a phone the same pages stack."""

INVJS = r"""
/* ---------- Inventory from the brand catalogues (Sam 2026-10-11, update 8) ---------- */
const INV_IC=Object.fromEntries(CATS);
const r2=v=>Math.round((+v||0)*100)/100;
const invInr=n=>{n=r2(n);return '₹'+(Math.round(n*100)%100?n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):Math.round(n).toLocaleString('en-IN'));};
const isWv=()=>document.documentElement.classList.contains('wv');
/* redraw, keeping the typing cursor where it was */
function invRefresh(){const a=document.activeElement,id=a&&a.id,pos=a&&a.selectionStart;refresh();if(id){const e=document.getElementById(id);if(e&&e!==document.activeElement){e.focus();try{e.setSelectionRange(pos,pos);}catch(x){}}}}
/* the Admin's price rule for new parts */
const invRule=()=>{const r=DB.priceRule||{};return {c:isFinite(parseFloat(r.c))?+r.c:5,m:isFinite(parseFloat(r.m))?+r.m:15};};
const invPrices=mrp=>{const r=invRule();mrp=+mrp||0;return {price:r2(mrp*(1-r.c/100)),mp:r2(mrp*(1-r.m/100))};};
function invRuleSheet(){const r=invRule();sheet(`<h3 class="h2">Prices for new parts</h3><p class="cap">Every new part gets its selling prices from its MRP. Parts already in your list keep their prices.</p>
 <div class="grid2"><div class="field"><label for="pr-c">Customer price: MRP minus</label><div class="inp"><input id="pr-c" inputmode="decimal" value="${r.c}"><b>%</b></div></div><div class="field"><label for="pr-m">Mechanic price: MRP minus</label><div class="inp"><input id="pr-m" inputmode="decimal" value="${r.m}"><b>%</b></div></div></div>
 <div class="errmsg" id="pr-err" style="display:none"></div>
 <div class="grid2"><button class="btn line" onclick="closeSheet()">Cancel</button><button class="btn" onclick="invRuleSave()">Save rule</button></div>`);}
function invRuleSave(){const c=parseFloat(document.getElementById('pr-c').value),m=parseFloat(document.getElementById('pr-m').value),e=document.getElementById('pr-err');
 if(!(c>=0&&c<100&&m>=0&&m<100)){e.textContent='Enter a % from 0 to 99 for both.';e.style.display='';return;}
 const o=invRule();DB.priceRule={c,m};audit('Price rule changed','New parts','Customer MRP−'+o.c+'%, mechanic MRP−'+o.m+'%','Customer MRP−'+c+'%, mechanic MRP−'+m+'%');save();closeSheet();toast('Price rule saved');refresh();}
/* the shop's own list: a part number (any dashes or spaces) or barcode */
const invFind=c=>findByCode(c)||(catPk(c).length>=4?PRODUCTS.find(p=>catPk(p.pn)===catPk(c))||null:null);
const invWaitOf=pk=>(DB.waitParts||[]).find(w=>w.pk===pk)||null;
function invW(id){return (DB.waitParts||[]).find(w=>w.id===id)||{photos:[]};}
/* products added on another device (photos, prices) */
function invSyncP(){(DB.newProducts||[]).forEach(p=>{const i=PRODUCTS.findIndex(x=>x.id===p.id);if(i>-1)PRODUCTS[i]=p;else PRODUCTS.push(p);const v=(DB.prices||{})[p.id];if(v)Object.assign(p,v);});}
/* ---- part number -> what the catalogues say ---- */
const INV_CATS=[['Lubricants',/\b(ENGINE|GEAR|FORK|BRAKE|2T|4T) OIL\b|\bGREASE\b|\bCOOLANT\b|\bLUBRICANT/],['Filters',/\bFILTER|\bAIR ?CLEANER/],
 ['Brake Parts',/\bBRAKE|\bSHOE\b|\bCALIPER|\bPAD SET|\bDISC PLATE|\bROTOR\b|MASTER CYL/],['Clutch Parts',/\bCLUTCH/],['Chain & Sprocket',/\bSPROCKET|\bDRIVE CHAIN|\bCHAIN KIT|\bCHAIN,? DRIVE/],
 ['Cables',/\bCABLE\b/],['Bearings',/\bBEARING/],['Tyres',/\bTYRE|\bTIRE\b/],['Suspension',/\bSHOCK|\bFORK\b|\bSUSPENSION|\bCUSHION|\bDAMPER/],
 ['Electrical',/\bLAMP|\bBULB|\bSWITCH|\bHARNESS|\bBATTERY|\bCOIL\b|\bRELAY|\bFUSE|\bHORN|\bCDI\b|\bECU\b|\bSENSOR|\bREGULATOR|\bRECTIFIER|\bSTARTER|\bMAGNETO|\bSTATOR|\bFLASHER|\bSPARK PLUG|\bWINKER|\bTSL\b|\bINDICATOR|\bSPEEDOMETER|\bMETER\b/],
 ['Engine Parts',/\bPISTON|\bCYLINDER|\bVALVE|\bCRANK|\bCAMSHAFT|\bCAM CHAIN|\bGASKET|\bRING SET|\bCONNECTING ROD|\bOIL SEAL|\bTAPPET|\bROCKER|\bENGINE/]];
const invCatOf=r=>{const d=String(r.desc||'').toUpperCase();if(/^(BOLT|NUT|SCREW|WASHER|CLIP|PIN|RIVET|COLLAR|BUSH|SPRING|O RING|GROMMET|BAND)\b/.test(d))return 'OEM Parts';
 for(const s of [d,String(r.asm||'').toUpperCase()])for(const [c,re] of INV_CATS)if(re.test(s))return c;return 'OEM Parts';};
/* one hit per brand that has the number: name, section, qty per bike, MRP (0 when the catalogue has none), the bikes it fits */
function invHits(pk){const out=[];for(const e of CAT_ALL){if(e.st!==2)continue;const rs=catPkRows(e.vb,pk);if(!rs.length)continue;
  const r=rs.find(x=>x.ph)||rs[0],mrp=rs.reduce((m,x)=>Math.max(m,+x.mrp||0),0),qs=rs.map(x=>parseInt(x.qty)||0).filter(Boolean);
  out.push({vb:e.vb,pk,pn:r.part,name:catNice(r.desc)||r.part,sec:catNice(r.asm||''),qty:qs.length?Math.max(...qs):0,mrp,fits:m2FitL(r),cat:invCatOf(r)});}
 return out;}
const invRowOf=(vb,pk)=>{if(!vb||!pk||!CAT_ALL.some(e=>e.vb===vb&&e.st===2))return null;const rs=catPkRows(vb,pk);return rs.find(x=>x.ph)||rs[0]||null;};
const invPic=r=>r?(catPhoto(r)||m2Thumb(r)):'';
/* look a number up: the catalogue files its shape can be in load first (catRoute), then the files it could be part of a number in,
   then (when asked) every catalogue. defer: the caller asks for the files itself (several numbers at once) */
const INV_LK=new Map();
function invLook(pn,defer){const pk=catPk(pn);let o=INV_LK.get(pk);if(!o){o={pk,wide:0,every:0,hits:[],need:[]};INV_LK.set(pk,o);}
 if(pk.length<4){o.st='short';o.hits=[];return o;}
 const R=catRoute(pk),want=o.every?CAT_ALL.slice():R.l.concat(o.wide?R.p:[]),need=want.filter(e=>e.st<2);
 o.hits=invHits(pk);o.in=want.filter(e=>e.st===2).map(e=>e.vb);o.fail=want.filter(e=>e.st===3).map(e=>e.vb);
 if(need.length){o.st='wait';o.need=need;o.pend=need.map(e=>e.vb);if(!defer)catNeed(need);return o;}
 o.need=[];if(!o.hits.length&&!o.wide&&R.p.length){o.wide=1;return invLook(pn,defer);}
 o.st='done';o.more=CAT_ALL.filter(e=>e.st===0&&!want.includes(e)).length;return o;}
function invNeed(list){const u=[...new Set(list.flatMap(o=>o.need||[]))];if(u.length&&u.some(e=>!CAT_NEED.includes(e)||e.st===0))catNeed(u);}
function invEvery(pk){const o=INV_LK.get(pk);if(o){o.every=1;o.st='wait';}invRefresh();}
function invLookWait(pn,cb,t0){t0=t0||Date.now();const o=invLook(pn);if(o.st==='done'||o.st==='short'||Date.now()-t0>9e4){cb(o);return;}setTimeout(()=>invLookWait(pn,cb,t0),300);}
const invFitsTxt=f=>!f||!f.length?'Not set':f.slice(0,3).join(', ')+(f.length>3?' +'+(f.length-3)+' more':'');
/* ---- photo cleanup (Sam 16:59Z-17:25Z): the server keeps each photo exactly as taken and makes two copies with the faint logo
   behind the part: <hash>-c.jpg white background (used by default) and <hash>-w.jpg the photo as taken ("Original").
   A product keeps the copy's address, so every page and the shop show it; "Original" under a photo switches the copy. ---- */
const PH_ST={},PH_V={},PH_AI=2;let phT=0;   // PH_AI = AI_VER in lib/photoai.mjs: a newer cleanup gets a new address, so phones never keep the older copy
const phH=u=>(/^\/photos\/([a-f0-9]{32})/.exec(u||'')||[])[1]||'';
const phOrig=u=>/-w\.jpg$/.test(u||'');
const phSrc=u=>{const k=phH(u);return k?u+'?v='+(PH_V[k]||PH_AI):u;};
const phBusy=k=>PH_ST[k]==='queued'||PH_ST[k]==='working';
const phNoAi=k=>!k||['off','failed','waiting','missing'].includes(PH_ST[k]);
function phWatch(k,st){if(!k)return;if(st)PH_ST[k]=st;else if(!(k in PH_ST))PH_ST[k]='?';if(!phT&&Object.keys(PH_ST).some(x=>PH_ST[x]==='?'||phBusy(x)))phT=setTimeout(phPoll,st?2500:300);}
async function phPoll(){phT=0;const hs=Object.keys(PH_ST).filter(k=>PH_ST[k]==='?'||phBusy(k)).slice(0,40);if(!hs.length)return;
 try{const r=await fetch('/api/photo/status?h='+hs.join(','),{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(r.status);const j=await r.json();
  document.documentElement.classList.toggle('phai',!!j.ai&&['ready','working'].includes(j.ai.state));
  hs.forEach(k=>{const st=(j.st||{})[k]||'missing',was=PH_ST[k];if(st===was)return;if(st==='done'&&was!=='?')PH_V[k]=Date.now();PH_ST[k]=st;phPaint(k);});}
 catch(e){hs.forEach(k=>{if(PH_ST[k]==='?')PH_ST[k]='';});return;}
 if(hs.some(phBusy))phT=setTimeout(phPoll,2500);}
/* only the photo boxes change (a whole redraw would take the cursor out of the field being typed in) */
function phPaint(k){document.querySelectorAll('[data-ph="'+k+'"]').forEach(el=>{el.classList.toggle('pend',phBusy(k));el.classList.toggle('noai',phNoAi(k));
  if(PH_V[k])el.querySelectorAll('img').forEach(im=>{im.src=im.getAttribute('src').split('?')[0]+'?v='+PH_V[k];});});}
function invOrig(arr,i){const u=arr[i];if(!phH(u)||!/-[cw]\.jpg$/.test(u))return;arr[i]=u.replace(/-[cw]\.jpg$/,phOrig(u)?'-c.jpg':'-w.jpg');save();invRefresh();}
/* products saved before update 8 kept their photos inside the database (sent to every phone): moved to the server once, by Admin */
let phMig=false;
async function invPhMigrate(){if(phMig||!S.user||S.user.role!=='admin')return;phMig=true;
 for(const p of (DB.newProducts||[]).filter(x=>(x.photos||[]).some(u=>/^data:image\/[\w.+-]+;base64,/.test(u)))){const out=[];
  for(const u of p.photos){if(!/^data:image\/[\w.+-]+;base64,/.test(u)){out.push(u);continue;}
   try{const bin=atob(u.slice(u.indexOf(',')+1)),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);
    const r=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':u.slice(5,u.indexOf(';'))},body:new Blob([b]),credentials:'same-origin'});const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.url)throw new Error(j.error||r.status);if(!out.some(x=>phH(x)&&phH(x)===phH(j.url)))out.push(j.url);}
   catch(e){return;}}   /* tried again next time */
  const q=(DB.newProducts||[]).find(x=>x.id===p.id);if(q){q.photos=out;const pp=PRODUCTS.find(x=>x.id===p.id);if(pp)pp.photos=out;save();}}}

/* ---- photos: sent to the server exactly as taken (no resizing), 1 needed, 4 at most ---- */
async function invUp(files,arr,max=4){const list=[...(files||[])].slice(0,Math.max(0,max-arr.length));if(files&&files.length>list.length)toast('Only '+max+' photos per part');if(!list.length)return;
 S.ui.upN=(S.ui.upN||0)+list.length;invRefresh();
 for(const f of list){try{if(f.size>25*1024*1024)throw new Error('This photo is too big (25 MB max)');
   const r=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f,credentials:'same-origin'});
   if(r.status===401){srvExpired();return;}const j=await r.json().catch(()=>({}));if(!r.ok||!j.url)throw new Error(j.error||'Photo not saved');
   if(arr.some(u=>u===j.url||(phH(u)&&phH(u)===phH(j.url))))toast('This photo is already added');else if(arr.length<max){arr.push(j.url);phWatch(phH(j.url),j.ai||'?');}save();}
  catch(e){toast(e&&e.message&&!/fetch|network/i.test(e.message)?e.message:'Photo not saved. Check the internet and try again.');}
  S.ui.upN=Math.max(0,(S.ui.upN||1)-1);invRefresh();}}
function invSlots(arr,pick,rm,tg){const up=S.ui.upN||0;let h='';for(let i=0;i<4;i++){const lab=PHOTO_SLOTS[i];
  if(arr[i]){const k=phH(arr[i]),u=phSrc(arr[i]);if(k&&!(k in PH_ST))phWatch(k);
   h+=`<div class="inv-sw${phBusy(k)?' pend':''}${phNoAi(k)?' noai':''}"${k?` data-ph="${k}"`:''}><div class="inv-slot"><a href="${esc(u)}" target="_blank" rel="noopener" aria-label="Open the ${lab} photo"><img src="${esc(u)}" alt="${lab}" loading="lazy"></a><button class="x" onclick="${rm(i)}" aria-label="Remove ${lab} photo">${ic('x','s16')}</button><span class="inv-ai">Cleaning…</span><span class="lab">${lab}</span></div><label class="inv-orig" title="Keep this photo as taken (the logo stays behind the part)"><input type="checkbox"${phOrig(arr[i])?' checked':''} onchange="${tg(i)}">Original</label></div>`;}
  else if(i<arr.length+up)h+=`<div class="inv-slot busy"><span>Saving…</span></div>`;
  else h+=`<label class="inv-slot ${i===arr.length+up?'next':''}">${ic(i===0?'camera':'plus','s20')}<span>${lab}</span>${i<1?'':'<span class="micro">optional</span>'}<input type="file" accept="image/*" multiple style="display:none" onchange="${pick}"></label>`;}
 return `<div class="inv-ph">${h}</div>`;}
const invPhotoTip=()=>(isWv()?'Click a box to choose photos from this computer, or take them on the phone: they show here too.':'Tap a box to take a photo or pick from the gallery.')+'<span class="inv-aitip"> The background turns white by itself, with the Bike Pharma logo faint behind the part. Tick Original to keep a photo as taken.</span>';
const invTile=x=>x.photos&&x.photos[0]?`<div class="tile sm n inv-tile"><img src="${esc(phSrc(x.photos[0]))}" alt="" loading="lazy"></div>`:`<div class="tile sm n">${ic(x.ic,'s18')}</div>`;
const invTh=(u,i)=>`<div class="inv-th">${u?`<img src="${esc(phSrc(u))}" alt="" loading="lazy">`:ic(i||'camera','s20')}</div>`;
const invGallery=x=>x.photos&&x.photos.length?`<div class="inv-gal">${x.photos.map((u,i)=>`<a href="${esc(phSrc(u))}" target="_blank" rel="noopener"><img src="${esc(phSrc(u))}" alt="${esc(x.name)} photo ${i+1}" loading="lazy"></a>`).join('')}</div>`:'';
/* a new product from a part that has its photos (Stock in line, waiting part) */
function invMkProduct(n,stock){const pr=invPrices(n.mrp),id='n'+Date.now()+Math.floor(Math.random()*1000);
 const p={id,name:String(n.name).trim(),brand:String(n.brand).trim().toUpperCase(),type:n.hand?'OEM':'Genuine',cat:n.cat||'OEM Parts',pn:String(n.pn).trim().toUpperCase(),pack:'',mrp:r2(n.mrp),price:pr.price,mp:pr.mp,stock:stock||0,warDays:0,reorder:10,ic:INV_IC[n.cat]||'package',fits:n.fits||[],bin:String(n.bin||'').trim().toUpperCase(),barcode:'',pending:false,photos:n.photos.slice(0,4),unit:'pcs',gst:'18',hsn:'8714',src:n.vb&&!n.hand?{vb:n.vb}:null,at:isoToday(),by:S.user.sid};
 if(p.bin)DB.bins[id]=p.bin;DB.newProducts=DB.newProducts||[];DB.newProducts.push(p);PRODUCTS.push(p);DB.stock[id]=p.stock;
 audit('Product added',p.pn,'—','From '+(n.grn||'stock in')+' · '+p.photos.length+' photos');return p;}

/* ---------- Inventory page (Admin): Products & stock ---------- */
SCREENS.ainv=()=>{setTimeout(invPhMigrate,1500);const W=DB.waitParts||[],np=(DB.newProducts||[]).slice(-8).reverse(),r=invRule(),ex=invPrices(160);
 const acts=[['Products & stock','grid',"go('stocklist')"],['Stock count','clip',"S.ui.mv=null;go('stockmove',{type:'count'})"],['Adjustments','sliders',"S.ui.mv=null;go('stockmove',{type:'adjust'})"],['Damaged','alert',"S.ui.mv=null;go('stockmove',{type:'damaged'})"],['Returned','history',"S.ui.mv=null;go('stockmove',{type:'returned'})"],...(BRANCHES.length>1?[['Transfer','truck',"S.ui.mv=null;go('stockmove',{type:'transfer'})"]]:[]),['Expiry & batch','clock',"go('batches')"],['Cycle count','clipboard',"S.ui.cc={};go('ccount')"],['Supplier return','truck',"S.ui.sr=null;go('sreturn')"],['Print labels','tag',"go('labels')"],['Suppliers','users',"go('asupp')"],['Scan to find','scan',"S.ui.scanHit=null;S.ui.scanMiss=null;go('scanfind')"],['Stock in bills','down',"go('grn')"]];
 const how=[['scan','Add product','Type or scan the part number. Name, brand, MRP and bikes fill in from the catalogue.',"S.ui.ap=null;S.ui.apErr=null;go('addproduct')"],['truck','Stock in','Supplier bill: scan the parts and type qty. Parts already in your list only get qty.',"S.ui.ge=null;go('grnedit',{id:'new'})"],['clip','Paste supplier bill','Copy the bill from Excel or WhatsApp and paste it. Every line is checked at once.',"S.ui.ip=null;go('invpaste')"]];
 const pc=x=>{const n=(x.photos||[]).length;return `<span class="pill ${n?'g':'n'}">${n?n+' photo'+(n>1?'s':''):'No photos'}</span>`;};
 const rows=[...W.slice(-3).reverse().map(w=>`<button class="inv-tr" onclick="S.ui.iw='${w.id}';go('invwait')">${invTh(w.photos[0])}<span class="inv-tp"><b>${esc(w.name||w.pn)}</b><span class="cap num">${esc(w.pn)}${w.brand?' · '+esc(w.brand):''}</span></span><span class="inv-c num">${esc(w.bin||'—')}</span><span class="inv-c num">${w.q}</span><span class="inv-c num">—</span><span class="pill a">${w.photos.length?w.photos.length+' photo'+(w.photos.length>1?'s':''):'No photo'} · not in stock yet</span></button>`),
  ...np.map(x=>`<button class="inv-tr" onclick="S.ui.scanHit='${x.id}';S.ui.scanMiss=null;go('scanfind')">${invTh((x.photos||[])[0],x.ic)}<span class="inv-tp"><b>${esc(x.name)}</b><span class="cap num">${esc(x.pn)} · ${esc(x.brand)}</span></span><span class="inv-c num">${esc(binOf(x.id))}</span><span class="inv-c num">${DB.stock[x.id]||0}</span><span class="inv-c num">${invInr(x.price)}</span>${pc(x)}</button>`)];
 return bar('Inventory')+`<div class="scroll"><div class="pad">
 <p class="cap">Add parts fast with the catalogues. Every new part needs at least 1 photo (4 max) before it goes into stock.</p>
 <div class="inv-how">${how.map(([i,t,d,o])=>`<button class="card inv-hc" onclick="${o}"><span class="tile y">${ic(i,'s20')}</span><span class="grow"><b>${t}</b><span class="cap">${d}</span></span></button>`).join('')}</div>
 <div class="grid4 inv-stats">${tileBtn('','Products',String(PRODUCTS.length),PRODUCTS.length?'in the shop':'none added yet',"go('stocklist')")}${tileBtn('y','Waiting for photos',String(W.length),W.length?'not in stock yet':'none waiting',"go('invwait')")}${tileBtn('','Low stock',String(lowList().length),'below alert level',"go('invlist',{kind:'low'})")}${tileBtn('r','Out of stock',String(outList().length),'parts',"go('invlist',{kind:'out'})")}</div>
 <div class="inv-2c side"><div class="inv-col"><div class="card flush">
  <div class="sec inv-ch"><span class="h3">Recently added</span><button class="link" onclick="go('stocklist')">See all</button></div>
  ${rows.length?`<div class="inv-tr inv-thd"><span></span><span>Part</span><span class="inv-c">Rack</span><span class="inv-c">Qty</span><span class="inv-c">Customer</span><span>Photos</span></div>${rows.join('')}`:'<div class="empty" style="margin:0 16px 16px">No new parts yet. Add a product, or post a Stock in bill.</div>'}
 </div></div>
 <div class="inv-col">
  <div class="card"><div class="sec"><span class="h3">Prices for new parts</span><span class="pill k">Admin only</span></div>
   <div class="cap">Set once. Every new part gets its prices from its MRP. You can still change any part later.</div>
   <div class="kv"><span>Customer price</span><span><b>MRP − ${r.c}%</b></span></div><div class="kv"><span>Mechanic price</span><span><b>MRP − ${r.m}%</b></span></div>
   <div class="cap inv-ex">Example: MRP ₹160 → customer ${invInr(ex.price)}, mechanic ${invInr(ex.mp)}</div>
   <button class="btn line sm" onclick="invRuleSheet()">Change rule</button></div>
  <div class="card"><span class="h3">How a new part is added</span><ol class="inv-steps"><li>Scan or type the part number</li><li>Name, brand, MRP and bikes fill in from the catalogue</li><li class="k"><b>Take 1 to 4 photos. No photo, no save.</b></li><li>Type qty and rack</li><li>Save. The part shows in the app with its photos.</li></ol></div>
 </div></div>
 ${sec('More')}
 <div class="grid3">${acts.map(([l,i,o])=>`<button class="qa2" onclick="${o}"><span class="tile sm">${ic(i,'s20')}</span>${l}</button>`).join('')}</div>
</div></div>`;};

/* ---------- Add product: part number first ---------- */
function invApNew(){const a=apNew();a.warDays='0';a.cat='OEM Parts';a.type='Genuine';a.look='';a.hit=null;a.picked='';a.more=false;a.own=false;a.gx=false;a.mrpEd=false;return a;}
let AP_T=0;
function apClearHit(a){if(a.hit){a.name='';a.brand='';a.mrp='';a.fits=[];a.cat='OEM Parts';}a.hit=null;a.picked='';a.mrpEd=false;}
function apLookSoon(){clearTimeout(AP_T);AP_T=setTimeout(()=>{const a=S.ui.ap;if(!a||cur().s!=='addproduct')return;const pk=catPk(a.pn);if(pk!==a.look){apClearHit(a);a.look=pk;invRefresh();}},450);}
function apLookNow(){clearTimeout(AP_T);const a=S.ui.ap;const pk=catPk(a.pn);if(pk!==a.look){apClearHit(a);a.look=pk;}invRefresh();}
function apUse(a,h){a.hit=h;a.picked=h.vb;a.name=h.name;a.brand=h.vb;a.cat=h.cat;a.type='Genuine';a.fits=h.fits.slice();a.universal=false;a.pn=h.pn;a.mrp=h.mrp?String(h.mrp):'';a.mrpEd=false;a.unit='pcs';}
function apPick(vb){const a=S.ui.ap;const o=INV_LK.get(a.look);const h=o&&o.hits.find(x=>x.vb===vb);if(h)apUse(a,h);refresh();}
function invStockIn(pid){const g=S.ui.ge&&S.ui.ge.status!=='posted'?S.ui.ge:geState('new');S.ui.ge=g;const it=g.items.find(i=>i.pid===pid);if(it)it.q=(+it.q||0)+1;else g.items.push({pid,exp:null,q:1,rate:''});S.ui.ap=null;go('grnedit',{id:g.id});}
/* what the part number says: already in the list / waiting / looking / found / pick the brand / not found */
function apLookCard(a){if(!a.look||a.look.length<4)return {k:'',h:''};
 const x=invFind(a.pn);if(x)return {k:'dup',h:`<div class="card inv-dup"><div class="row"><span class="pill g">Already in your list</span></div><div class="row top">${invTh((x.photos||[])[0],x.ic)}<div class="grow"><div class="h3">${esc(x.name)}</div><div class="cap num">${esc(x.pn)} · ${esc(x.brand)}</div><div class="cap">${DB.stock[x.id]||0} ${esc(x.unit||'pcs')} in stock · Rack ${esc(binOf(x.id))}</div></div></div><p class="cap">The same part is never saved twice. To add the pieces you received, use Stock in: it only adds qty.</p><div class="grid2"><button class="btn" onclick="invStockIn('${x.id}')">${ic('down','s18')} Stock in</button><button class="btn line" onclick="S.ui.scanHit='${x.id}';S.ui.scanMiss=null;go('scanfind')">See this part</button></div></div>`};
 const w=invWaitOf(a.look);if(w)return {k:'dup',h:`<div class="card inv-dup"><div class="row"><span class="pill a">Waiting for photos</span></div><div class="h3">${esc(w.name||w.pn)}</div><div class="cap num">${esc(w.pn)} · came on bill ${esc(w.inv||w.grn||'')} · ${w.q} pcs</div><p class="cap">This part is already on a supplier bill. Take its photos in Waiting for photos and it goes into stock.</p><button class="btn" onclick="S.ui.iw='${w.id}';go('invwait')">${ic('camera','s18')} Take its photos</button></div>`};
 const o=invLook(a.pn);
 if(o.st==='wait')return {k:'wait',h:`<div class="card inv-look">${ic('search','s18')}<span class="grow">Looking for <b class="num">${esc(a.pn)}</b> in the ${esc(o.pend.join(', '))} catalogue${o.pend.length>1?'s':''}…</span></div>`};
 if(!o.hits.length){if(a.hit)apClearHit(a);return {k:'none',h:`<div class="card inv-none"><div class="row"><span class="pill r">Not in the catalogues</span></div><p class="cap"><b class="num">${esc(a.pn)}</b> is not in ${o.in.length?'the '+esc(o.in.join(', '))+' catalogue'+(o.in.length>1?'s':''):'the catalogues we have'}. Fill in name, brand and MRP by hand below.</p>${o.fail.length?`<p class="cap" style="color:var(--r)">Could not load the ${esc(o.fail.join(', '))} catalogue. <button class="link" onclick="catRetry();invRefresh()">Try again</button></p>`:''}${o.more?`<button class="btn line sm" onclick="invEvery('${a.look}')">${ic('search','s16')} Look in every catalogue</button>`:''}</div>`};}
 if(o.hits.length>1&&!a.picked)return {k:'pick',h:`<div class="card inv-pick"><div class="row"><span class="pill a">Pick the brand</span></div><p class="cap"><b class="num">${esc(a.pn)}</b> is in the ${esc(o.hits.map(h=>h.vb).join(' and '))} catalogues. Which one is on the box?</p><div class="inv-chips">${o.hits.map(h=>`<button class="chip" onclick="apPick('${m2Q(h.vb)}')">${esc(h.vb)} · ${esc(h.name)}${h.mrp?' · MRP '+invInr(h.mrp):''}</button>`).join('')}</div></div>`};
 const h=o.hits.find(x=>x.vb===a.picked)||o.hits[0];if(!a.hit||a.hit.vb!==h.vb)apUse(a,h);
 const r=invRowOf(h.vb,h.pk),pic=invPic(r),all=!!S.ui.apAll,nf=h.fits.length;
 return {k:'found',h:`<div class="card inv-found"><div class="inv-chips"><span class="pill g">Found in ${esc(h.vb)} catalogue</span><span class="pill n">Not in your list yet</span>${o.hits.length>1?`<button class="link" onclick="S.ui.ap.picked='';S.ui.ap.hit=null;refresh()">Other brand</button>`:''}</div>
  <div class="inv-fr">${pic?`<div class="inv-cpic">${pic}<div class="micro muted">Catalogue photo · only to recognise</div></div>`:''}<div class="grow stack g6"><h3 class="h2">${esc(a.name||h.name)}</h3><div class="cap">${esc([h.vb,h.sec,h.qty?h.qty+' per bike':''].filter(Boolean).join(' · '))}</div>
   <div class="kv"><span>MRP ${h.mrp?'(from catalogue)':''}</span><span>${h.mrp?`<b>${invInr(h.mrp)}</b>`:'<b class="amb">Not in this catalogue</b>'}</span></div><div class="kv"><span>Category</span><span>${esc(a.cat)}</span></div><div class="kv"><span>Type</span><span>Genuine (OEM)</span></div></div></div>
  ${nf?`<div class="micro muted">Fits ${nf===1?'this '+esc(h.vb)+' bike':nf+' '+esc(h.vb)+' bikes'}</div><div class="inv-chips">${h.fits.slice(0,all?nf:8).map(f=>`<span class="pill n">${esc(f)}</span>`).join('')}${nf>8?`<button class="link" onclick="S.ui.apAll=!S.ui.apAll;refresh()">${all?'Show less':'+'+(nf-8)+' more'}</button>`:''}</div>`:''}
  <div class="inv-note y">${ic('checkC','s18')}<span>Already in your list? You see its stock and only add qty. The same part is never saved twice.</span></div>
  <button class="link" onclick="S.ui.ap.more=!S.ui.ap.more;refresh()">${a.more?'Hide the details':'Change name, brand, category or bikes'}</button></div>`};}
/* an error goes away once the field is right (checked on every draw) */
function apRecheck(a,E){if(!E)return null;const n=v=>parseFloat(String(v).replace(/[^\d.]/g,''));
 const ok={photos:a.photos.length>=1,pn:!!String(a.pn).trim()&&!invFind(a.pn)&&!invWaitOf(catPk(a.pn)),name:!!String(a.name).trim(),brand:!!String(a.brand).trim(),pack:a.type!=='Aftermarket'||!!String(a.pack||'').trim(),mrp:n(a.mrp)>0,warDays:a.warDays!==''&&parseInt(a.warDays)>=0,open:a.open!==''&&n(a.open)>=0,fits:a.universal||a.fits.length>0,price:!a.own||n(a.price)>0,mp:!a.own||n(a.mp)>0};
 Object.keys(E).forEach(k=>{if(ok[k])delete E[k];});return Object.keys(E).length?E:null;}
document.addEventListener('input',e=>{const t=e.target;if(!t||!t.closest||!['addproduct','invwait'].includes(cur().s))return;const f=t.closest('.field');if(!f)return;
 f.querySelectorAll('.inp.err').forEach(x=>x.classList.remove('err'));f.querySelectorAll('.errmsg').forEach(x=>x.remove());
 if(!document.querySelector('#vp .screen:last-child .inp.err'))document.querySelectorAll('#vp .screen:last-child .inv-fixall').forEach(x=>x.remove());},true);
SCREENS.addproduct=()=>{const a=S.ui.ap||(S.ui.ap=invApNew());if(a.look===undefined)Object.assign(a,{look:catPk(a.pn),hit:null,picked:'',more:!!a.name,own:false,gx:false,mrpEd:false});
 S.ui.apErr=apRecheck(a,S.ui.apErr);const admin=S.user.role==='admin',E=S.ui.apErr||{},lk=apLookCard(a),n=a.photos.length,up=S.ui.upN||0,r=invRule(),pr=invPrices(a.mrp);
 const manual=a.more||lk.k==='none'||(!a.hit&&!!a.name);
 const details=`<div class="card"><div class="h3">Part details</div>${apField('name','Product name','e.g. Front Brake Pad Set – Sintered',{req:1})}
   <div class="grid2">${apField('brand','Brand','e.g. BOSCH',{req:1})}<div class="field"><label for="ap-cat">Category <span style="color:var(--r)">*</span></label><div class="inp"><select id="ap-cat" style="border:0;background:transparent;flex:1;font-weight:600" onchange="S.ui.ap.cat=this.value">${CATS.map(c=>`<option ${a.cat===c[0]?'selected':''}>${c[0]}</option>`).join('')}</select></div></div></div>
   <div class="field"><label>Part type</label><div class="grid4 inv-g4">${['Genuine','OEM','OES','Aftermarket'].map(t=>`<button class="chip ${a.type===t?'on':''}" style="justify-content:center;padding-inline:4px" onclick="S.ui.ap.type='${t}';refresh()">${t}</button>`).join('')}</div></div>
   ${a.type==='Aftermarket'?`<div class="card" style="background:var(--y-soft);border:0;padding:12px;gap:8px">${apField('pack','Packed under brand','e.g. Uno Minda, Endurance',{req:1})}<div class="cap">For aftermarket parts, enter the brand whose pack it comes in. This is what customers see on the product.</div></div>`:''}
   <div class="grid2"><div class="field"><label for="ap-unit">Unit</label><div class="inp"><select id="ap-unit" style="border:0;background:transparent;flex:1;font-weight:600" onchange="S.ui.ap.unit=this.value">${['pcs','set','pair','litre','kit'].map(u=>`<option ${a.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div><div class="field"><label for="ap-barcode">Barcode / QR</label><div class="inp"><input id="ap-barcode" value="${esc(a.barcode)}" placeholder="Scan or type" oninput="S.ui.ap.barcode=this.value"></div></div></div>
   <div class="field"><label>Fits these bikes</label>
   <button class="opt ${a.universal?'on':''}" onclick="S.ui.ap.universal=!S.ui.ap.universal;refresh()"><span class="radio"></span><span class="grow">Universal part (fits all bikes)</span></button></div>
   ${a.universal?'':`<div class="grid2"><div class="field"><label for="ap-vb">Bike brand</label><div class="inp"><select id="ap-vb" style="border:0;background:transparent;flex:1;font-weight:600" onchange="S.ui.ap.vb=this.value;S.ui.ap.vm=BRANDS_V[this.value][0];refresh()">${Object.keys(BRANDS_V).map(b=>`<option ${a.vb===b?'selected':''}>${b}</option>`).join('')}</select></div></div><div class="field"><label for="ap-vm">Model</label><div class="inp"><select id="ap-vm" style="border:0;background:transparent;flex:1;font-weight:600" onchange="S.ui.ap.vm=this.value">${(BRANDS_V[a.vb]||[]).map(m=>`<option ${a.vm===m?'selected':''}>${m}</option>`).join('')}</select></div></div></div>
   <button class="btn line sm" style="width:100%" onclick="addFit()">+ Add this bike</button>
   ${a.fits.length?`<div class="row wrap" style="gap:6px">${a.fits.map((f,i)=>`<span class="pill b">${esc(f)}<button onclick="S.ui.ap.fits.splice(${i},1);refresh()" aria-label="Remove">${ic('x','s16')}</button></span>`).join('')}</div>`:`<div class="${E.fits?'errmsg':'cap'}">${E.fits||'Add at least one bike, or mark it universal.'}</div>`}`}</div>`;
 const mrpIn=!a.hit||!a.hit.mrp||a.mrpEd;
 const right=lk.k==='dup'?'':`<div class="card"><div class="sec"><span class="h3">2 · Photos</span><span class="pill ${n?'g':'a'}">${n?n+' added':'1 needed'} · 4 max</span></div>
   ${invSlots(a.photos,'invUp(this.files,S.ui.ap.photos)',i=>`S.ui.ap.photos.splice(${i},1);refresh()`,i=>`invOrig(S.ui.ap.photos,${i})`)}
   ${E.photos?`<div class="errmsg">${E.photos}</div>`:`<div class="cap">Take the part, its other side and the box label: 1 photo is enough, 4 at most. Photos keep full quality. ${invPhotoTip()}</div>`}</div>
  <div class="card"><div class="h3">3 · Stock and price</div>
   ${mrpIn?`${a.hit&&!a.hit.mrp?`<div class="inv-note a">${ic('alert','s18')}<span>The ${esc(a.hit.vb)} catalogue has no MRP. Type the MRP printed on the pack.</span></div>`:''}<div class="field"><label for="ap-mrp">MRP (printed on pack) <span style="color:var(--r)">*</span></label><div class="inp ${E.mrp?'err':''}"><b>₹</b><input id="ap-mrp" inputmode="decimal" value="${esc(a.mrp)}" placeholder="MRP from the pack" oninput="S.ui.ap.mrp=this.value;apPrices()"></div>${E.mrp?`<div class="errmsg">${E.mrp}</div>`:''}</div>`:`<div class="kv"><span>MRP (from ${esc(a.hit.vb)} catalogue)</span><span><b>${invInr(a.mrp)}</b> <button class="link" onclick="S.ui.ap.mrpEd=true;refresh()">Change</button></span></div>`}
   <div class="grid2">${apField('open','Opening stock','0',{req:1,num:1})}${apField('bin','Rack / bin','e.g. B-2-07')}</div>
   <div class="grid2">${apField('reorder','Low stock alert at','10',{num:1})}<div></div></div>
   <div class="field"><label>Warranty</label><div class="inv-chips">${[['None',0],['3 m',90],['6 m',180],['1 yr',365],['2 yr',730]].map(([l,d])=>`<button class="chip ${String(a.warDays)===String(d)?'on':''}" onclick="S.ui.ap.warDays='${d}';refresh()">${l}</button>`).join('')}</div>${E.warDays?`<div class="errmsg">${E.warDays}</div>`:''}</div>
   <div class="inv-sp"><div class="sec"><b>Selling prices</b>${admin?`<button class="link" onclick="S.ui.ap.own=!S.ui.ap.own;refresh()">${a.own?'Use the rule':'Change'}</button>`:''}</div>
    ${a.own?`<div class="grid2">${apField('price','Customer price','0',{num:1,pre:'₹'})}${apField('mp','Mechanic price','0',{num:1,pre:'₹'})}</div><div class="cap">Your own prices for this part.</div>`:`<div class="kv"><span>Customer (MRP − ${r.c}%)</span><span><b id="ap-pc">${invInr(pr.price)}</b></span></div><div class="kv"><span>Mechanic (MRP − ${r.m}%)</span><span><b id="ap-pm">${invInr(pr.mp)}</b></span></div><div class="cap">From the Admin price rule.${admin?' You can change them for this part.':''}</div>`}</div>
   <button class="link" onclick="S.ui.ap.gx=!S.ui.ap.gx;refresh()">${a.gx?'Hide GST, HSN and notes':'GST, HSN and notes'}</button>
   ${a.gx?`<div class="grid2"><div class="field"><label for="ap-gst">GST</label><div class="inp"><select id="ap-gst" style="border:0;background:transparent;flex:1;font-weight:600" onchange="S.ui.ap.gst=this.value">${['5','12','18','28'].map(g=>`<option value="${g}" ${a.gst===g?'selected':''}>${g}%</option>`).join('')}</select></div></div>${apField('hsn','HSN code','8714')}</div><div class="field"><label for="ap-spec">Notes</label><textarea id="ap-spec" rows="3" style="border:1.5px solid var(--line);border-radius:14px;padding:12px;font:inherit;font-size:14px;resize:vertical" placeholder="Material, size, position (front/rear), pack contents…" oninput="S.ui.ap.spec=this.value">${esc(a.spec)}</textarea></div>`:''}</div>`;
 const sum=up?'Saving photos…':n?n+' photo'+(n>1?'s':'')+' added · ready to save':'Add at least 1 photo to save';
 return bar('Add product')+`<div class="scroll"><div class="pad">
 <p class="cap">Type the part number from the box, or scan its barcode. Name, brand, MRP and bikes fill in from the catalogue.</p>
 <div class="inv-2c"><div class="inv-col">
  <div class="card"><div class="h3">1 · Part number</div>
   <form class="row" style="gap:8px" onsubmit="event.preventDefault();apLookNow()"><label class="inp grow ${E.pn?'err':''}" for="ap-pn" style="border-width:2px;border-color:var(--ink)">${ic('scan','s18')}<input id="ap-pn" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(a.pn)}" placeholder="Part no. on the box" oninput="S.ui.ap.pn=this.value;apLookSoon()"></label><button class="btn line sm" type="submit">Find</button></form>
   ${E.pn?`<div class="errmsg">${E.pn}</div>`:'<div class="cap">Works with every catalogue: Hero, Honda, TVS, Yamaha, Suzuki, Bajaj, KTM, Husqvarna, Royal Enfield. A barcode gun works here too.</div>'}</div>
  ${lk.h}${manual&&lk.k!=='dup'?details:''}
 </div><div class="inv-col">${right}</div></div>
 ${Object.keys(E).length?'<div class="errmsg inv-fixall">Please fix the highlighted fields.</div>':''}
</div></div><div class="foot">${lk.k==='dup'?`<button class="btn line" onclick="S.ui.ap=null;S.ui.apErr=null;back()">Close</button>`:`<div class="sum">${sum}</div><div class="grid2"><button class="btn line" onclick="S.ui.ap=null;S.ui.apErr=null;back()">Cancel</button><button class="btn" onclick="saveProduct()">Save product</button></div>`}</div>`;};
function apPrices(){const p=invPrices(S.ui.ap&&S.ui.ap.mrp),c=document.getElementById('ap-pc'),m=document.getElementById('ap-pm');if(c)c.textContent=invInr(p.price);if(m)m.textContent=invInr(p.mp);}
function apPhotos(files){invUp(files,S.ui.ap.photos);}
function saveProduct(){const a=S.ui.ap;const e={};const n=v=>parseFloat(String(v).replace(/[^\d.]/g,''));const admin=S.user.role==='admin';
 if(S.ui.upN){toast('Wait, a photo is still saving');return;}
 if(a.photos.length<1)e.photos='Add at least 1 photo. Maximum is 4.';
 if(!a.pn.trim())e.pn='Enter the part number.';else if(invFind(a.pn))e.pn='This part is already in your list. Use Stock in to add qty.';else if(invWaitOf(catPk(a.pn)))e.pn='This part is waiting for photos from a supplier bill. Finish it in Waiting for photos.';
 if(!a.name.trim())e.name='Enter the product name.';if(!a.brand.trim())e.brand='Enter the brand.';if(a.type==='Aftermarket'&&!a.pack.trim())e.pack='Enter the brand on the pack.';
 if(!(n(a.mrp)>0))e.mrp='Enter the MRP.';if(a.warDays===''||isNaN(parseInt(a.warDays))||parseInt(a.warDays)<0)e.warDays='Pick the warranty (None if there is none).';if(a.open===''||!(n(a.open)>=0))e.open='Enter opening stock (0 if none).';
 if(!a.universal&&!a.fits.length)e.fits='Add at least one compatible bike, or mark it universal.';
 if(admin&&a.own)['price','mp'].forEach(k=>{if(!(n(a[k])>0))e[k]='Set this price.';});
 if(Object.keys(e).length){S.ui.apErr=e;if(e.name||e.brand||e.fits||e.pack)a.more=true;if(e.mrp)a.mrpEd=true;toast(Object.values(e)[0]);return refresh();}
 const id='n'+Date.now();const mrp=r2(n(a.mrp));const pr=admin&&a.own?{price:r2(n(a.price)),mp:r2(n(a.mp))}:invPrices(mrp);
 const p={id,name:a.name.trim(),brand:a.brand.trim().toUpperCase(),type:a.type,cat:a.cat,pn:a.pn.trim().toUpperCase(),pack:a.type==='Aftermarket'?a.pack.trim().toUpperCase():'',mrp,price:pr.price,mp:pr.mp,stock:n(a.open),warDays:parseInt(a.warDays)||0,reorder:parseInt(a.reorder)||10,ic:INV_IC[a.cat]||'package',fits:a.universal?['Universal']:a.fits,bin:a.bin.trim().toUpperCase(),barcode:a.barcode,pending:false,photos:a.photos.slice(0,4),unit:a.unit,gst:a.gst,hsn:a.hsn,spec:a.spec,src:a.hit?{vb:a.hit.vb}:null,at:isoToday(),by:S.user.sid};
 if(p.bin)DB.bins[id]=p.bin;DB.newProducts=DB.newProducts||[];DB.newProducts.push(p);PRODUCTS.push(p);DB.stock[id]=p.stock;logMove('in',id,p.stock,'NEW','Opening stock · new product');
 audit('Product added',p.pn,'—',p.stock+' '+a.unit+' · '+p.photos.length+' photos');save();S.ui.ap=null;S.ui.apErr=null;S.ui.apAll=false;
 sheet(`${okBadge(72)}<h3 class="h2">${esc(p.name)} added</h3>${invGallery(p)}<div class="card"><div class="kv"><span>Part no.</span><span>${esc(p.pn)}</span></div><div class="kv"><span>Opening stock</span><span>${p.stock} ${esc(a.unit)}${p.bin?' · Rack '+esc(p.bin):''}</span></div><div class="kv"><span>MRP</span><span>${invInr(p.mrp)}</span></div><div class="kv"><span>Customer price</span><span>${invInr(p.price)}</span></div><div class="kv"><span>Mechanic price</span><span>${invInr(p.mp)}</span></div><div class="kv"><span>Warranty</span><span>${warText(p.warDays)}</span></div><div class="kv"><span>Fits</span><span>${esc(invFitsTxt(p.fits))}</span></div></div><div class="grid2"><button class="btn line" onclick="closeSheet();S.ui.ap=null;refresh()">Add another</button><button class="btn" onclick="closeSheet();invTab('stocklist')">View stock list</button></div>`);}

/* ---------- Stock in: catalogue parts not in the list yet come as new-part lines ---------- */
function geNw(k){return (S.ui.ge&&S.ui.ge.nw||[]).find(n=>n.k===k)||{photos:[]};}
const invNwReady=n=>n.photos.length>=1&&+n.mrp>0&&!!String(n.name||'').trim()&&!!String(n.brand||'').trim();
function invNwLine(h,hand){const k='N'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 return hand?{k,pn:String(h.pn).trim().toUpperCase(),pk:catPk(h.pn),name:'',brand:'',vb:'',cat:'OEM Parts',sec:'',qty:0,mrp:'',fits:[],photos:[],bin:'',q:1,rate:'',hand:1}
  :{k,pn:h.pn,pk:h.pk,name:h.name,brand:h.vb,vb:h.vb,cat:h.cat,sec:h.sec,qty:h.qty,mrp:h.mrp?String(h.mrp):'',mrpCat:!!h.mrp,fits:h.fits,photos:[],bin:'',q:1,rate:''};}
function geNwAdd(h,hand){const g=S.ui.ge;g.nw=g.nw||[];const l=invNwLine(h,hand);g.nw.push(l);S.ui.gePick=null;S.ui.geOpen=l.k;if(S.ui.geErr)delete S.ui.geErr.items;refresh();}
function geNwDel(k){const g=S.ui.ge;g.nw=(g.nw||[]).filter(n=>n.k!==k);if(S.ui.geOpen===k)S.ui.geOpen=null;refresh();}
function geCode(c){c=String(c||'').trim();if(!c)return;const g=S.ui.ge;const foc=()=>{S.ui.after=()=>{const i=document.getElementById('ge-code');if(i)i.focus();};};
 const x=invFind(c);if(x){foc();geAdd(x.id);toast('Added '+x.pn+' · +1');return;}
 const pk=catPk(c);if(pk.length<4){toast('Type the whole part number');return;}
 const nl=(g.nw||[]).find(n=>n.pk===pk);if(nl){nl.q=(+nl.q||0)+1;foc();toast(nl.pn+' · +1');refresh();return;}
 S.ui.geLk=c;S.ui.gePick=null;refresh();
 invLookWait(c,o=>{if(S.ui.geLk===c)S.ui.geLk=null;if(cur().s!=='grnedit'||S.ui.ge!==g)return;
  if(o.hits.length===1)geNwAdd(o.hits[0]);else{S.ui.gePick={pn:c,hits:o.hits,more:o.more};refresh();}});}
function geLookEvery(){const pn=S.ui.gePick&&S.ui.gePick.pn;if(!pn)return;const o=INV_LK.get(catPk(pn));if(o){o.every=1;o.st='wait';}S.ui.gePick=null;geCode(pn);}
function geNwPanel(n){const r=n.vb&&!n.hand?invRowOf(n.vb,n.pk):null,pic=invPic(r),np=n.photos.length,rd=invNwReady(n);
 const left=[np<1?'a photo':'',+n.mrp>0?'':'MRP',n.name&&n.brand?'':'name and brand'].filter(Boolean);
 return `<div class="card inv-pan"><div class="row"><span class="pill a">New part</span>${n.hand?'<span class="pill r">Not in a catalogue</span>':`<span class="pill g">From ${esc(n.vb)} catalogue</span>`}<span class="grow"></span><button class="iconbtn" onclick="S.ui.geOpen=null;refresh()" aria-label="Close">${ic('x','s18')}</button></div>
  ${pic?`<div class="inv-cpic">${pic}<div class="micro muted">Catalogue photo · only to recognise</div></div>`:''}
  ${n.hand?`<div class="field"><label for="nw-name">Part name <span style="color:var(--r)">*</span></label><div class="inp"><input id="nw-name" value="${esc(n.name)}" placeholder="e.g. Clutch lever" oninput="geNw('${n.k}').name=this.value" onchange="invRefresh()"></div></div><div class="grid2"><div class="field"><label for="nw-brand">Brand <span style="color:var(--r)">*</span></label><div class="inp"><input id="nw-brand" value="${esc(n.brand)}" placeholder="e.g. Hero" oninput="geNw('${n.k}').brand=this.value" onchange="invRefresh()"></div></div><div class="field"><label for="nw-cat">Category</label><div class="inp"><select id="nw-cat" style="border:0;background:transparent;flex:1;font-weight:600" onchange="geNw('${n.k}').cat=this.value">${CATS.map(c=>`<option ${n.cat===c[0]?'selected':''}>${c[0]}</option>`).join('')}</select></div></div></div><div class="cap num">${esc(n.pn)}</div>`
   :`<h3 class="h2">${esc(n.name)}</h3><div class="cap num">${esc(n.pn)}</div><div class="cap">${esc([n.vb,n.sec,n.qty?n.qty+' per bike':''].filter(Boolean).join(' · '))}</div>`}
  ${n.fits&&n.fits.length?`<div class="micro muted">Fits ${n.fits.length} bike${n.fits.length>1?'s':''}</div><div class="inv-chips">${n.fits.slice(0,6).map(f=>`<span class="pill n">${esc(f)}</span>`).join('')}${n.fits.length>6?`<span class="pill n">+${n.fits.length-6} more</span>`:''}</div>`:''}
  ${n.vb&&!n.hand&&!n.mrpCat?`<div class="inv-note a">${ic('alert','s18')}<span>The ${esc(n.vb)} catalogue has no MRP. Type the MRP printed on the pack.</span></div>`:''}
  <div class="field"><label for="nw-mrp">MRP <span style="color:var(--r)">*</span>${n.mrpCat?' <span class="cap">from the '+esc(n.vb)+' catalogue</span>':''}</label><div class="inp"><b>₹</b><input id="nw-mrp" inputmode="decimal" value="${esc(n.mrp||'')}" placeholder="MRP from the pack" oninput="geNw('${n.k}').mrp=this.value" onchange="invRefresh()"></div></div>
  <div class="sec"><b>Photos</b><span class="pill ${np?'g':'a'}">${np?np+' added':'1 needed'} · 4 max</span></div>
  ${invSlots(n.photos,`invUp(this.files,geNw('${n.k}').photos)`,i=>`geNw('${n.k}').photos.splice(${i},1);refresh()`,i=>`invOrig(geNw('${n.k}').photos,${i})`)}
  <div class="cap">${invPhotoTip()}</div>
  <div class="field"><label for="nw-bin">Rack / bin</label><div class="inp"><input id="nw-bin" value="${esc(n.bin||'')}" placeholder="e.g. A-1-03" oninput="geNw('${n.k}').bin=this.value"></div></div>
  <button class="btn ${rd?'':'line'}" onclick="S.ui.geOpen=null;refresh()">Done</button>
  <div class="cap" style="color:${rd?'var(--g)':'var(--amber)'}">${rd?'Ready. It goes into stock when you post the bill.':'Still needed: '+left.join(', ')+'. Without them it waits in “Waiting for photos” when you post.'}</div></div>`;}
function geNwHTML(g,e){const nw=g.nw||[];let h='';
 if(S.ui.geLk)h+=`<div class="card inv-look">${ic('search','s18')}<span class="grow">Looking for <b class="num">${esc(S.ui.geLk)}</b> in the catalogues…</span></div>`;
 const pk=S.ui.gePick;
 if(pk)h+=pk.hits.length?`<div class="card inv-pick"><div class="row"><span class="pill a">Pick the brand</span></div><p class="cap"><b class="num">${esc(pk.pn)}</b> is in the ${esc(pk.hits.map(x=>x.vb).join(' and '))} catalogues. Which one is on the box?</p><div class="inv-chips">${pk.hits.map((x,i)=>`<button class="chip" onclick="geNwAdd(S.ui.gePick.hits[${i}])">${esc(x.vb)} · ${esc(x.name)}${x.mrp?' · MRP '+invInr(x.mrp):''}</button>`).join('')}</div><button class="link" onclick="S.ui.gePick=null;refresh()">Cancel</button></div>`
  :`<div class="card inv-pick"><div class="row"><span class="pill r">Not found</span></div><p class="cap"><b class="num">${esc(pk.pn)}</b> is not in your list or in the catalogues we looked in.</p><div class="row wrap" style="gap:8px"><button class="btn sm" onclick="geNwAdd({pn:S.ui.gePick.pn},1)">Add it by hand</button>${pk.more?`<button class="btn line sm" onclick="geLookEvery()">Look in every catalogue</button>`:''}<button class="btn line sm" onclick="S.ui.gePick=null;refresh()">Cancel</button></div></div>`;
 if(!nw.length)return h;
 const open=nw.find(n=>n.k===S.ui.geOpen),wait=nw.filter(n=>!invNwReady(n));
 const line=(n,i)=>{const rd=invNwReady(n),np=n.photos.length;return `<div class="card inv-nw ${n.k===S.ui.geOpen?'on':''}"><div class="row top">${invTh(n.photos[0])}<div class="grow"><div class="h3">${esc(n.name||n.pn)}</div><div class="cap num">${esc(n.pn)}${n.brand?' · '+esc(n.brand):''}</div>
   <div class="inv-chips">${rd?'<span class="pill g">Ready · '+np+' photo'+(np>1?'s':'')+'</span>':`<span class="pill a">New part</span>${np?'':'<span class="pill a">Needs a photo</span>'}${+n.mrp>0?'':'<span class="pill a">Needs MRP</span>'}${n.name&&n.brand?'':'<span class="pill r">Needs name and brand</span>'}`}</div></div>
   <button aria-label="Remove" style="color:var(--ink5)" onclick="geNwDel('${n.k}')">${ic('trash','s18')}</button></div>
   <div class="grid2"><div class="field"><label>Qty received</label><span class="qty" style="justify-content:space-between"><button onclick="geNw('${n.k}').q=Math.max(0,(+geNw('${n.k}').q)-1);refresh()" aria-label="Less">${ic('minus','s16')}</button><span class="num">${n.q}</span><button onclick="geNw('${n.k}').q=(+geNw('${n.k}').q)+1;refresh()" aria-label="More">${ic('plus','s16')}</button></span></div>
   <div class="field"><label for="nw-r${i}">Purchase rate</label><div class="inp ${e['n'+i]?'err':''}" style="height:40px"><b>₹</b><input id="nw-r${i}" inputmode="decimal" value="${esc(n.rate||'')}" placeholder="0" onchange="geNw('${n.k}').rate=this.value;refresh()"></div></div></div>
   <div class="row" style="justify-content:space-between"><button class="btn ${rd?'line':''} sm" onclick="S.ui.geOpen=S.ui.geOpen==='${n.k}'?null:'${n.k}';refresh()">${ic('camera','s16')} ${n.k===S.ui.geOpen?'Close':rd?'See photos':'Photos & MRP'}</button><b class="num">${invInr((+n.q||0)*(+n.rate||0))}</b></div></div>`;};
 return h+`<div class="inv-2c side"><div class="inv-col">${sec('New parts ('+nw.length+')')}${nw.map(line).join('')}
  ${wait.length?`<p class="cap">${wait.length===1?'1 new part has':wait.length+' new parts have'} no photos or MRP yet. When you post, ${wait.length===1?'it waits':'they wait'} in “Waiting for photos” with qty and rate, and ${wait.length===1?'goes':'go'} into stock once the photos are done.</p>`:''}</div>
  ${open?`<div class="inv-col inv-panel">${geNwPanel(open)}</div>`:''}</div>`;}
function geFoot(g,tot){const nw=g.nw||[],nr=nw.filter(n=>!invNwReady(n)).length,rl=g.items.length+nw.length-nr,units=grnUnits(g)+nw.filter(invNwReady).reduce((a,n)=>a+(+n.q||0),0);
 return `<div class="foot"><div class="sum">${units} unit${units===1?'':'s'} will be added to stock${nr?` · ${nr} part${nr>1?'s':''} wait${nr>1?'':'s'} for photos`:''}<b>${inr(tot)}</b></div><div class="grid2"><button class="btn line" onclick="geSave(false)">Save draft</button><button class="btn" onclick="geSave(true)">${nr&&rl?'Post '+rl+' ready line'+(rl>1?'s':''):nr?'Post bill':'Post to stock'}</button></div></div>`;}
/* posting: new parts with photos and MRP become products and go into stock with the bill; the rest wait for photos */
function geNwPost(g){const nw=g.nw||[];g.nw=[];let w=0;
 nw.forEach(n=>{const ex=PRODUCTS.find(p=>catPk(p.pn)===n.pk);
  if(ex){g.items.push({pid:ex.id,exp:null,q:+n.q,rate:n.rate});return;}
  if(invNwReady(n)){const p=invMkProduct({...n,grn:g.id},0);g.items.push({pid:p.id,exp:null,q:+n.q,rate:n.rate});return;}
  const id='W'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  (DB.waitParts=DB.waitParts||[]).push({id,pn:n.pn,pk:n.pk,name:n.name,brand:n.brand,vb:n.vb,cat:n.cat,sec:n.sec,qty:n.qty,mrp:n.mrp,mrpCat:!!n.mrpCat,fits:n.fits,photos:n.photos.slice(0,4),bin:n.bin,q:+n.q,rate:n.rate,grn:g.id,inv:g.inv,sup:g.supplier,at:today()+' · '+nowT(),by:S.user.sid,hand:n.hand||0});
  (g.wait=g.wait||[]).push({wid:id,pn:n.pn,name:n.name||n.pn,q:+n.q,rate:n.rate});w++;});
 S.ui.geW=w;}

/* ---------- Paste supplier bill ---------- */
function invParse(txt){const lines=[];let skip=0;String(txt||'').split(/\r?\n/).forEach(row=>{const s=row.replace(/(\d),(\d{3})(?!\d)/g,'$1$2').trim();if(!s)return;
 const t=s.split(/[\t,;|]+|\s+/).map(x=>x.trim()).filter(Boolean);let pi=-1;
 for(let i=0;i<t.length;i++){const k=catPk(t[i]);if(k.length>=5&&/\d/.test(k)&&!/^\d+(\.\d+)?$/.test(t[i])||/^\d{6,}$/.test(t[i])){pi=i;break;}}
 if(pi<0){if(/\d/.test(s))skip++;return;}
 const nums=t.slice(pi+1).map(x=>x.replace(/^(\d+)(pcs?|nos?|no\.|qty)$/i,'$1')).filter(x=>/^\d+(\.\d+)?$/.test(x));let q=0,rate='';
 if(nums.length&&/^\d+$/.test(nums[0])){q=parseInt(nums[0]);if(nums[1])rate=nums[1];}else if(nums.length)rate=nums[0];
 lines.push({pn:t[pi].toUpperCase(),pk:catPk(t[pi]),q:q||1,rate});});
 return {lines,skip};}
function invCheck(l){const x=invFind(l.pn);if(x)return {l,kind:'ready',x};const o=invLook(l.pn,true),w=invWaitOf(l.pk);
 if(o.st==='wait')return {l,kind:'look',o,w};if(!o.hits.length)return {l,kind:'none',o,w};return {l,kind:o.hits.length>1?'pick':'new',o,hits:o.hits,w};}
SCREENS.invpaste=()=>{const st=S.ui.ip||(S.ui.ip={txt:'',pick:{}});const P0=invParse(st.txt),rows=P0.lines.map(invCheck);invNeed(rows.map(r=>r.o).filter(Boolean));
 const ready=rows.filter(r=>r.kind==='ready'),need=rows.length-ready.length,look=rows.some(r=>r.kind==='look'),unpicked=rows.some(r=>r.kind==='pick'&&!st.pick[r.l.pk]);
 const b=(t,c)=>`<span class="pill ${c} inv-bd">${t}</span>`,qr=l=>`${l.q} × ${l.rate?invInr(l.rate):'rate not given'}`;
 const one=r=>{const l=r.l,wt=r.w?` · already waiting for photos from bill ${esc(r.w.inv||r.w.grn||'')}`:'';
  if(r.kind==='ready')return `<div class="inv-cl ok">${b('+'+l.q,'g')}<div class="grow"><b>${esc(r.x.name)}</b><div class="cap">${esc(r.x.brand)} · in your list · <span class="num">${esc(l.pn)}</span> · ${qr(l)}</div></div>${ic('checkC','s20')}</div>`;
  if(r.kind==='look')return `<div class="inv-cl">${b('…','n')}<div class="grow"><b class="num">${esc(l.pn)}</b><div class="cap">Checking the ${esc((r.o.pend||[]).join(', ')||'')} catalogues…</div></div></div>`;
  if(r.kind==='none')return `<div class="inv-cl no">${b('Not found','r')}<div class="grow"><b class="num">${esc(l.pn)}</b><div class="cap">Not in any catalogue we looked in. Fill name, brand and MRP by hand, then take its photo. ${qr(l)}${wt}</div></div></div>`;
  const h=r.hits.find(x=>x.vb===st.pick[l.pk])||r.hits[0];
  return `<div class="inv-cl nw">${b('New','a')}<div class="grow"><b>${esc(h.name)}${r.kind==='new'?' · '+esc(h.vb)+' catalogue':''}</b><div class="cap"><span class="num">${esc(l.pn)}</span> · ${qr(l)} · ${r.kind==='pick'?'this number is in the '+esc(r.hits.map(x=>x.vb).join(' and '))+' catalogues. Pick the brand:':'needs '+(h.mrp?'':'MRP + ')+'a photo'}${wt}</div>
   ${r.kind==='pick'?`<div class="inv-chips">${r.hits.map(x=>`<button class="chip ${st.pick[l.pk]===x.vb?'on':''}" onclick="S.ui.ip.pick['${l.pk}']='${m2Q(x.vb)}';refresh()">${esc(x.vb)}${x.mrp?' · MRP '+invInr(x.mrp):''}</button>`).join('')}</div>`:''}</div></div>`;};
 return bar('Paste supplier bill')+`<div class="scroll"><div class="pad">
 <p class="cap">Copy the lines from the supplier’s Excel sheet or WhatsApp message and paste them here. Each line is checked against your list and all catalogues.</p>
 <div class="inv-2c paste"><div class="inv-col"><div class="card"><div class="sec"><span class="h3">Pasted${P0.lines.length?' · '+P0.lines.length+' line'+(P0.lines.length>1?'s':''):''}</span>${st.txt?`<button class="link" onclick="S.ui.ip.txt='';S.ui.ip.pick={};refresh()">Clear</button>`:''}</div>
  <textarea id="ip-ta" class="inv-ta" spellcheck="false" placeholder="Paste here, one part per line:&#10;45125-AAH-F0099  10  118.00&#10;94050-06000, 50, 3.20" oninput="S.ui.ip.txt=this.value;clearTimeout(window._ipT);window._ipT=setTimeout(invRefresh,600)">${esc(st.txt)}</textarea>
  <div class="cap">Works with Excel columns or WhatsApp lines: part no., qty, rate. Spaces, tabs or commas are fine.</div></div></div>
 <div class="inv-col"><div class="card"><div class="sec"><span class="h3">Checked</span><div class="inv-chips">${ready.length?`<span class="pill g">${ready.length} ready</span>`:''}${need?`<span class="pill a">${need} need${need>1?'':'s'} you</span>`:''}</div></div>
  ${rows.length?rows.map(one).join(''):'<div class="empty">Paste the bill. Each line shows here: in your list, new from a catalogue, or not found.</div>'}
  ${P0.skip?`<div class="cap">${P0.skip} line${P0.skip>1?'s':''} skipped: no part number found.</div>`:''}
  ${rows.length?`<div class="grid2"><button class="btn" ${ready.length?'':'disabled'} onclick="invPasteAdd(0)">Add ${ready.length} ready line${ready.length===1?'':'s'} to bill</button><button class="btn line" ${need&&!look&&!unpicked?'':'disabled'} onclick="invPasteAdd(1)">Add all ${rows.length} lines</button></div>
  <div class="cap">${look?'Still checking some lines in the catalogues…':unpicked?'Pick the brand for the lines that need it.':'Ready lines go into stock when you post the bill. New parts wait until they have a photo.'}</div>`:''}
 </div></div></div></div></div>`;};
function invPasteAdd(all){const st=S.ui.ip;if(!st)return;const rows=invParse(st.txt).lines.map(invCheck);
 const g=S.ui.ge&&S.ui.ge.status!=='posted'?S.ui.ge:geState('new');S.ui.ge=g;g.nw=g.nw||[];let n=0;
 rows.forEach(r=>{const l=r.l;if(r.kind==='ready'){const it=g.items.find(i=>i.pid===r.x.id);if(it){it.q=(+it.q||0)+l.q;if(l.rate)it.rate=l.rate;}else g.items.push({pid:r.x.id,exp:null,q:l.q,rate:l.rate||''});n++;return;}
  if(!all||r.kind==='look')return;const ex=g.nw.find(x=>x.pk===l.pk);if(ex){ex.q=(+ex.q||0)+l.q;if(l.rate)ex.rate=l.rate;n++;return;}
  const h=r.kind==='new'?r.hits[0]:r.kind==='pick'?r.hits.find(x=>x.vb===st.pick[l.pk]):null;const line=invNwLine(h||{pn:l.pn},!h);line.q=l.q;line.rate=l.rate||'';g.nw.push(line);n++;});
 S.ui.ip=null;if(S.ui.geErr)delete S.ui.geErr.items;toast(n+' line'+(n===1?'':'s')+' added to Stock in');const prev=S.stack[S.stack.length-2];if(prev&&prev.s==='grnedit'&&String(prev.p&&prev.p.id)===String(g.id))back();else go('grnedit',{id:g.id});}

/* ---------- Waiting for photos ---------- */
SCREENS.invwait=()=>{const L=DB.waitParts||[];if(S.ui.iw&&!L.some(w=>w.id===S.ui.iw))S.ui.iw=null;if(!S.ui.iw&&L.length&&isWv())S.ui.iw=L[0].id;
 const sel=L.find(w=>w.id===S.ui.iw),units=L.reduce((a,w)=>a+(+w.q||0),0),bills=new Set(L.map(w=>w.inv||w.grn)).size;
 const row=w=>{const n=w.photos.length;return `<button class="inv-row ${w.id===S.ui.iw?'on':''}" onclick="S.ui.iw='${w.id}';S.ui.iwErr=null;refresh();invTop()">${invTh(w.photos[0])}
  <span class="grow"><b>${esc(w.name||w.pn)}</b><span class="cap num">${esc(w.pn)} · ${w.hand||!w.vb?'Not in any catalogue':esc(w.vb)+' catalogue'}</span>
  <span class="inv-chips"><span class="pill ${n?'g':'r'}">${n?n+' photo'+(n>1?'s':''):'Needs a photo'}</span>${+w.mrp>0?'':'<span class="pill a">Needs MRP</span>'}${w.name&&w.brand?'':'<span class="pill r">Fill name, brand</span>'}</span></span>
  <span class="inv-c cap num">${esc(w.inv||w.grn||'')}</span><b class="num">${w.q}</b></button>`;};
 return bar('Waiting for photos')+`<div class="scroll"><div class="pad">
 <p class="cap">New parts from Stock in and Paste supplier bill wait here with their qty and rate. A part goes into stock once it has at least 1 photo (4 max).</p>
 ${L.length?`<div class="inv-note a">${ic('clock','s18')}<b>${units} pcs from ${bills} bill${bills>1?'s':''} ${units===1?'is':'are'} not in stock yet. Each part goes in as soon as its photos are done.</b></div>`:''}
 <div class="inv-2c side"><div class="inv-col"><div class="card flush"><div class="sec inv-ch"><span class="h3">Waiting · ${L.length} part${L.length===1?'':'s'}</span></div>${L.length?L.map(row).join(''):'<div class="empty" style="margin:0 16px 16px">Nothing is waiting. New parts from a supplier bill show here until their photos are taken.</div>'}</div>
  ${L.length?'<p class="cap">Skip for now: a part stays here, not in stock. Its qty and rate stay saved with the bill.</p>':''}</div>
 ${sel?`<div class="inv-col inv-panel">${invWaitPanel(sel,L)}</div>`:''}</div>
</div></div>`;};
function invTop(){if(isWv())return;const s=document.querySelector('#vp .scroll');if(s)s.scrollTop=0;}
function invWaitRecheck(w){const E=S.ui.iwErr;if(!E)return;const ok={photos:w.photos.length>=1,mrp:+w.mrp>0,name:!!String(w.name||'').trim(),brand:!!String(w.brand||'').trim(),q:parseInt(w.q)>0};Object.keys(E).forEach(k=>{if(ok[k])delete E[k];});if(!Object.keys(E).length)S.ui.iwErr=null;}
function invWaitPanel(w,L){invWaitRecheck(w);const e=S.ui.iwErr||{},i=L.indexOf(w),r=w.vb&&!w.hand?invRowOf(w.vb,w.pk):null,pic=invPic(r),n=w.photos.length;const set=k=>`invW('${w.id}').${k}=this.value;save()`;
 const mrpIn=!(+w.mrp>0)||S.ui.iwMrp===w.id;
 return `<div class="card inv-pan"><div class="row"><span class="pill k">Part ${i+1} of ${L.length}</span>${w.vb&&!w.hand?`<span class="pill g">${esc(w.vb)} catalogue</span>`:'<span class="pill r">Not in any catalogue</span>'}<span class="grow"></span><button class="iconbtn" aria-label="Close" onclick="S.ui.iw=null;refresh()">${ic('x','s18')}</button></div>
  ${pic?`<div class="inv-cpic">${pic}<div class="micro muted">Catalogue photo · only to recognise</div></div>`:''}
  ${w.hand||!w.vb?`<div class="field"><label for="iw-name">Part name <span style="color:var(--r)">*</span></label><div class="inp ${e.name?'err':''}"><input id="iw-name" value="${esc(w.name||'')}" placeholder="e.g. Clutch lever" oninput="${set('name')}"></div></div><div class="grid2"><div class="field"><label for="iw-brand">Brand <span style="color:var(--r)">*</span></label><div class="inp ${e.brand?'err':''}"><input id="iw-brand" value="${esc(w.brand||'')}" placeholder="e.g. Hero" oninput="${set('brand')}"></div></div><div class="field"><label for="iw-cat">Category</label><div class="inp"><select id="iw-cat" style="border:0;background:transparent;flex:1;font-weight:600" onchange="${set('cat')}">${CATS.map(c=>`<option ${w.cat===c[0]?'selected':''}>${c[0]}</option>`).join('')}</select></div></div></div>`:`<h3 class="h2">${esc(w.name)}</h3>`}
  <div class="cap num">${esc(w.pn)}</div><div class="cap">${esc([w.brand,w.sec,w.qty?w.qty+' per bike':'',w.fits&&w.fits.length?'fits '+w.fits.length+' bike'+(w.fits.length>1?'s':''):''].filter(Boolean).join(' · '))}</div>
  ${mrpIn?`${w.vb&&!w.hand&&!w.mrpCat?`<div class="inv-note a">${ic('alert','s18')}<span>The ${esc(w.vb)} catalogue has no MRP. Type the MRP printed on the pack.</span></div>`:''}<div class="field"><label for="iw-mrp">MRP <span style="color:var(--r)">*</span></label><div class="inp ${e.mrp?'err':''}"><b>₹</b><input id="iw-mrp" inputmode="decimal" value="${esc(w.mrp||'')}" placeholder="MRP from the pack" oninput="${set('mrp')}"></div></div>`:`<div class="kv"><span>MRP${w.mrpCat?' (from catalogue)':''}</span><span><b>${invInr(w.mrp)}</b> <button class="link" onclick="S.ui.iwMrp='${w.id}';refresh()">Change</button></span></div>`}
  <div class="sec"><b>Photos</b><span class="pill ${n?'g':'a'}">${n?n+' added':'1 needed'} · 4 max</span></div>
  ${invSlots(w.photos,`invUp(this.files,invW('${w.id}').photos)`,j=>`invW('${w.id}').photos.splice(${j},1);save();refresh()`,j=>`invOrig(invW('${w.id}').photos,${j})`)}
  ${e.photos?`<div class="errmsg">${e.photos}</div>`:`<div class="cap">Take the part, its other side and the box label: 1 photo is enough, 4 at most. ${invPhotoTip()}</div>`}
  <div class="grid3 inv-g3"><div class="field"><label for="iw-q">Qty (from bill)</label><div class="inp ${e.q?'err':''}"><input id="iw-q" inputmode="numeric" value="${esc(w.q)}" oninput="${set('q')}"></div></div><div class="field"><label for="iw-r">Rate (bill)</label><div class="inp"><input id="iw-r" inputmode="decimal" value="${esc(w.rate||'')}" oninput="${set('rate')}"></div></div><div class="field"><label for="iw-bin">Rack / bin</label><div class="inp"><input id="iw-bin" value="${esc(w.bin||'')}" placeholder="C-4-12" oninput="${set('bin')}"></div></div></div>
  <button class="btn" onclick="invWaitSave('${w.id}')">Save &amp; next part ${ic('chevR','s18')}</button>
  <div class="cap">Saving puts ${esc(w.q)} pcs into stock${w.bin?' at rack '+esc(String(w.bin).toUpperCase()):''}, with customer and mechanic prices from the Admin rule.</div>
  <button class="link" style="color:var(--r);align-self:flex-start" onclick="invWaitDel('${w.id}')">Remove from this list</button></div>`;}
function invWaitSave(id){const L=DB.waitParts||[],w=L.find(x=>x.id===id);if(!w)return;const e={};
 if(S.ui.upN){toast('Wait, a photo is still saving');return;}
 if(w.photos.length<1)e.photos='Add at least 1 photo.';if(!(+w.mrp>0))e.mrp='Enter the MRP printed on the pack.';
 if(!String(w.name||'').trim())e.name='Enter the part name.';if(!String(w.brand||'').trim())e.brand='Enter the brand.';if(!(parseInt(w.q)>0))e.q='Qty must be at least 1.';
 if(Object.keys(e).length){S.ui.iwErr=e;if(e.mrp)S.ui.iwMrp=w.id;toast(Object.values(e)[0]);return refresh();}
 const q=parseInt(w.q);let p=PRODUCTS.find(x=>catPk(x.pn)===w.pk);if(!p)p=invMkProduct(w,0);else if(!(p.photos||[]).length){p.photos=w.photos.slice(0,4);}
 if(w.bin&&!DB.bins[p.id])DB.bins[p.id]=String(w.bin).trim().toUpperCase();
 DB.stock[p.id]=(+DB.stock[p.id]||0)+q;logMove('in',p.id,q,w.grn||'—','Stock in · photos done'+(w.sup?' · '+String(w.sup).split(' – ')[0]:''));
 const g=DB.grns.find(x=>x.id===w.grn);if(g){g.wait=(g.wait||[]).filter(x=>x.wid!==w.id);g.items.push({pid:p.id,exp:null,q,rate:w.rate});}
 DB.waitParts=L.filter(x=>x.id!==id);audit('Photos done · into stock',p.pn,'—',q+' pcs'+(w.grn?' · '+w.grn:''));save();
 S.ui.iwErr=null;S.ui.iwMrp=null;const nx=DB.waitParts[0];S.ui.iw=nx&&isWv()?nx.id:null;toast(p.name+' · '+q+' pcs in stock');refresh();}
function invWaitDel(id){const w=invW(id);sheet(`<h3 class="h2">Remove ${esc(w.name||w.pn)}?</h3><p class="cap">It will not go into stock. The bill ${esc(w.inv||w.grn||'')} keeps it as not received.</p><div class="grid2"><button class="btn line" onclick="closeSheet()">Cancel</button><button class="btn" style="background:var(--r);color:#fff" onclick="invWaitDel2('${id}')">Remove</button></div>`);}
function invWaitDel2(id){const L=DB.waitParts||[],w=L.find(x=>x.id===id);if(!w){closeSheet();return;}DB.waitParts=L.filter(x=>x.id!==id);
 const g=DB.grns.find(x=>x.id===w.grn);if(g){g.wait=(g.wait||[]).filter(x=>x.wid!==id);g.note=((g.note||'')+(g.note?' · ':'')+w.pn+' not received').slice(0,300);}
 audit('Waiting part removed',w.pn,w.q+' pcs','Not received');save();S.ui.iw=null;closeSheet();toast(w.pn+' removed');refresh();}

/* ---------- Find Part: a part not in the list yet ---------- */
function invFpAdd(r){if(!allowed('addproduct'))return `<div class="cap">Not in our stock list yet. Inventory can add it with this part number.</div>`;
 const w=invWaitOf(r.pk);if(w)return `<div class="inv-note a">${ic('clock','s18')}<div class="grow"><b>Waiting for photos</b><div class="cap">Came on bill ${esc(w.inv||w.grn||'')}. It goes into stock once its photo is taken.</div></div></div><button class="btn line" onclick="S.ui.iw='${w.id}';go('invwait')">${ic('camera','s18')} Take its photos</button>`;
 return `<div class="inv-note a">${ic('alert','s18')}<div class="grow"><b>Not in your stock list yet</b><div class="cap">Add to stock opens Add product with name, brand, MRP and the bikes filled from the ${esc(r.vb)} catalogue. You only take its photos (1 to 4) and type qty and rack.</div></div></div><button class="btn" onclick="invFromRow('${esc(m2Q(r.vb))}','${esc(m2Q(r.pk))}','${esc(m2Q(r.part))}')">${ic('plus','s18')} Add to stock</button>`;}
/* by brand + number, not the row index (the row list grows as more catalogue files load) */
function invFromRow(vb,pk,pn){const a=S.ui.ap=invApNew();a.pn=pn;a.look=pk;const h=invHits(pk).find(x=>x.vb===vb);if(h)apUse(a,h);S.ui.apErr=null;S.ui.apAll=false;go('addproduct');}
"""

INVCSS = r"""
/* ---- inventory (update 8): phone stacks, website two columns ---- */
.inv-2c{display:flex;flex-direction:column;gap:14px;min-width:0}
.inv-col{display:flex;flex-direction:column;gap:14px;min-width:0}
html.wv .inv-2c{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start}
html.wv .inv-2c.side{grid-template-columns:minmax(0,1fr) 400px}
html.wv .inv-2c.paste{grid-template-columns:400px minmax(0,1fr)}
.inv-2c.side>.inv-panel{order:-1}
html.wv .inv-2c.side>.inv-panel{order:0;position:sticky;top:12px}
.inv-ph{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.inv-slot{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--paper);min-width:0}
.inv-slot a{display:block;width:100%;height:100%}
.inv-slot img{width:100%;height:100%;object-fit:cover;display:block}
.inv-slot .x{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;display:grid;place-items:center}
.inv-slot .lab{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);color:#fff;text-align:center;font-size:10px;font-weight:700;padding:3px 0;pointer-events:none}
.inv-ph{align-items:start}
.inv-sw{display:flex;flex-direction:column;gap:4px;min-width:0}
.inv-ai{display:none;position:absolute;left:0;right:0;bottom:0;background:var(--y);color:#111;text-align:center;font-size:10px;font-weight:800;padding:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.inv-sw.pend .inv-ai{display:block}
.inv-sw.pend .lab{display:none}
.inv-pan>.row:first-child .pill{min-width:0;overflow:hidden;text-overflow:ellipsis}
.inv-sw.pend img{opacity:.55}
.inv-orig{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--ink5);cursor:pointer;min-height:24px;white-space:nowrap;overflow:hidden}
.inv-orig input{width:16px;height:16px;margin:0;accent-color:var(--ink);flex:none}
.inv-sw.pend .inv-orig{visibility:hidden}
.inv-sw.noai .inv-orig{display:none}
.inv-aitip{display:none}
html.phai .inv-aitip{display:inline}
label.inv-slot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:1.5px dashed var(--ink3);font-size:11px;font-weight:700;color:var(--ink5);cursor:pointer;text-align:center;padding:4px;line-height:1.2}
label.inv-slot.next{border-color:var(--ink);color:var(--ink)}
label.inv-slot:hover{border-color:var(--y-deep);background:var(--y-soft)}
.inv-slot.busy{display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--ink5);animation:invPulse 1.2s ease-in-out infinite}
@keyframes invPulse{50%{opacity:.55}}
.inv-note{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;background:var(--y-soft);font-size:13px;color:var(--ink)}
.inv-note.a{background:var(--amber-soft)}
.inv-note .i{flex:none;margin-top:1px}
.inv-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}
.inv-chips .pill{white-space:normal;max-width:100%;text-align:left;line-height:1.3}
.inv-fr{display:flex;gap:14px;align-items:flex-start}
.inv-cpic{width:140px;max-width:40%;flex:none;display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center}
.inv-cpic .fpc-photo,.inv-cpic .m2-th,.inv-cpic .fpc-crop{max-width:140px!important;width:100%}
.inv-pan .inv-cpic{width:100%;max-width:none}
.inv-pan .inv-cpic .fpc-photo,.inv-pan .inv-cpic .m2-th,.inv-pan .inv-cpic .fpc-crop{max-width:200px!important}
.inv-th{width:48px;height:48px;border-radius:10px;overflow:hidden;flex:none;background:var(--paper);display:grid;place-items:center;color:var(--ink5);border:1px solid var(--line)}
.inv-th img{width:100%;height:100%;object-fit:cover}
.inv-tile{padding:0;overflow:hidden}
.inv-tile img{width:100%;height:100%;object-fit:cover;display:block}
.inv-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--line);width:100%;text-align:left;background:transparent}
.inv-row .grow{display:flex;flex-direction:column;gap:4px;min-width:0}
.inv-row.on{background:var(--y-soft);box-shadow:inset 4px 0 0 var(--y)}
.inv-ch{padding:16px 16px 10px;margin:0}
.inv-tr{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--line);width:100%;text-align:left;background:transparent}
.inv-tr .inv-tp{display:flex;flex-direction:column;gap:2px;min-width:0}
.inv-thd{background:var(--paper);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink5);padding-block:8px}
.inv-c{display:none}
html.wv .inv-c{display:block}
html.wv .inv-tr{grid-template-columns:48px minmax(0,1fr) 72px 48px 84px 150px}
html.wv .inv-tr .inv-c{text-align:right}
html.wv .inv-row .inv-c{min-width:110px;text-align:right}
.inv-how{display:grid;gap:12px}
html.wv .inv-how{grid-template-columns:repeat(3,minmax(0,1fr))}
.inv-hc{flex-direction:row;align-items:flex-start;gap:12px;text-align:left}
.inv-hc .grow{display:flex;flex-direction:column;gap:4px}
.inv-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
html.wv .pad .inv-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
.inv-ex{background:var(--paper);border-radius:10px;padding:10px 12px}
.inv-steps{display:flex;flex-direction:column;gap:10px;counter-reset:s;margin:0;padding:0}
.inv-steps li{display:flex;gap:10px;align-items:flex-start;list-style:none;font-size:13px;color:var(--ink)}
.inv-steps li::before{counter-increment:s;content:counter(s);flex:none;width:24px;height:24px;border-radius:50%;background:var(--paper);display:grid;place-items:center;font-weight:800;font-size:12px}
.inv-steps li.k::before{background:var(--y);color:#121212}
.inv-sp{background:var(--paper);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.inv-sp .sec{margin:0}
.inv-g4{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important}
.inv-g3{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
.inv-nw{border-left:4px solid var(--y)}
.inv-nw.on{background:var(--y-soft)}
.inv-pan{border:2px solid var(--y)}
.inv-cl{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.inv-cl.nw{border-color:var(--amber)}
.inv-cl.no{border-color:var(--r)}
.inv-cl .grow{min-width:0;display:flex;flex-direction:column;gap:6px}
.inv-bd{flex:none;min-width:70px;justify-content:center}
textarea.inv-ta{width:100%;box-sizing:border-box;min-height:220px;border:2px solid var(--ink);border-radius:14px;padding:12px 14px;font:600 14px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--paper);color:var(--ink);resize:vertical}
.inv-gal{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:16px}
.inv-gal a{flex:0 0 100%;scroll-snap-align:start;height:260px;background:#fff;border:1px solid var(--line);border-radius:16px;display:grid;place-items:center;overflow:hidden}
.inv-gal img{max-width:100%;max-height:100%;object-fit:contain}
html.wv .inv-gal a{flex-basis:calc(50% - 4px)}
.pimg-ph{width:100%;height:100%;object-fit:contain;background:#fff;display:block}
@media (max-width:380px){.inv-fr{flex-direction:column}.inv-cpic{max-width:none;width:100%}}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'invcat.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    assert '123456' not in INVJS + INVCSS
    _v = __import__('re').search(r'export const AI_VER = (\d+);', open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'lib', 'photoai.mjs')).read())
    assert _v and f'PH_AI={_v.group(1)};' in INVJS, 'invcat.py: PH_AI must be AI_VER of lib/photoai.mjs'
    # who opens the new screens: Admin and the Inventory login
    sub(" admin:['ainv','grn','grnedit',", " admin:['ainv','invpaste','invwait','grn','grnedit',")
    sub(" inventory:['findpart','batches','ccount',", " inventory:['findpart','invpaste','invwait','batches','ccount',")
    # website menu: Inventory under Find Part (as in the Figma sidebar); Waiting for photos for the Inventory login
    sub("admin:[['findpart','Find Part','pin',\"go('findpart')\"],['masterprice'",
        "admin:[['findpart','Find Part','pin',\"go('findpart')\"],['ainv','Inventory','package',\"go('ainv')\"],['masterprice'")
    sub("inventory:[['findpart','Find Part','pin',\"go('findpart')\"],['batches'",
        "inventory:[['findpart','Find Part','pin',\"go('findpart')\"],['invwait','Waiting for photos','camera',\"go('invwait')\"],['batches'")
    # Admin overview and the Inventory login's home: the new pages
    sub("['Stock in','down',\"go('grn')\"],['All inventory','package',\"go('ainv')\"]",
        "['Stock in','down',\"go('grn')\"],['Paste supplier bill','clip',\"S.ui.ip=null;go('invpaste')\"],['Waiting for photos','camera',\"go('invwait')\"],['All inventory','package',\"go('ainv')\"]")
    sub("${[['Add product','plus',\"S.ui.ap=null;S.ui.apErr=null;go('addproduct')\"],['Transfer','truck'",
        "${[['Add product','plus',\"S.ui.ap=null;S.ui.apErr=null;go('addproduct')\"],['Paste supplier bill','clip',\"S.ui.ip=null;go('invpaste')\"],['Waiting for photos'+((DB.waitParts||[]).length?' ('+DB.waitParts.length+')':''),'camera',\"go('invwait')\"],['Transfer','truck'")
    # a catalogue that arrives redraws the inventory pages that wait for it, like Find Part
    sub("function catRefresh(){try{if(cur().s!=='findpart')return;}catch(x){return;}",
        "function catRefresh(){try{if(!['findpart','addproduct','grnedit','invpaste','invwait'].includes(cur().s))return;}catch(x){return;}")
    # products added or changed on another device
    sub("if(cur===j)continue;}DB[k]=v;SRV.snap[k]=j;n++;}", "if(cur===j)continue;}DB[k]=v;SRV.snap[k]=j;n++;if(k==='newProducts')invSyncP();}")
    # the shop's photos in the app: shop cards, product pages, stock list
    sub("aria-label=\"${esc(p.name)}\">${ic(p.ic,'s40')}<span class=\"pill g off\">",
        "aria-label=\"${esc(p.name)}\">${p.photos&&p.photos[0]?`<img class=\"pimg-ph\" src=\"${esc(phSrc(p.photos[0]))}\" alt=\"\" loading=\"lazy\">`:ic(p.ic,'s40')}<span class=\"pill g off\">")
    sub("<div class=\"card\" style=\"height:220px;align-items:center;justify-content:center;color:var(--ink3)\">${ic(x.ic,'s40')}<span class=\"cap\">Product photo</span></div>",
        "${invGallery(x)||`<div class=\"card\" style=\"height:220px;align-items:center;justify-content:center;color:var(--ink3)\">${ic(x.ic,'s40')}<span class=\"cap\">Product photo</span></div>`}")
    sub("<div class=\"card\" style=\"height:160px;align-items:center;justify-content:center;color:var(--ink3)\">${ic(x.ic,'s40')}</div>",
        "${invGallery(x)||`<div class=\"card\" style=\"height:160px;align-items:center;justify-content:center;color:var(--ink3)\">${ic(x.ic,'s40')}</div>`}")
    sub("S.ui.scanHit='${x.id}';S.ui.scanMiss=null;go('scanfind')`}\"><div class=\"tile sm n\">${ic(x.ic,'s18')}</div>",
        "S.ui.scanHit='${x.id}';S.ui.scanMiss=null;go('scanfind')`}\">${invTile(x)}")
    # Stock in: new-part lines, paste the whole bill, posting
    sub("const grnTotal=g=>g.items.reduce((a,it)=>a+(+it.q||0)*(+it.rate||0),0);",
        "const grnTotal=g=>[...g.items,...(g.nw||[]),...(g.wait||[])].reduce((a,it)=>a+(+it.q||0)*(+it.rate||0),0);")
    sub("<div class=\"sec\"><h3 class=\"h2\">Items (${g.items.length})</h3><button class=\"btn sm\" onclick=\"geAddSheet()\">+ Add</button></div>",
        "<div class=\"sec\"><h3 class=\"h2\">Items (${g.items.length+(g.nw||[]).length})</h3><div class=\"row\" style=\"gap:8px\"><button class=\"btn line sm\" onclick=\"S.ui.ip=null;go('invpaste')\">${ic('clip','s16')} Paste bill</button><button class=\"btn sm\" onclick=\"geAddSheet()\">+ Add</button></div></div>")
    sub(":`<div class=\"empty ${e.items?'errmsg':''}\">${e.items||'Scan or add the parts you received.'}</div>`}",
        ":(g.nw||[]).length||S.ui.geLk||S.ui.gePick?(e.items?`<div class=\"errmsg\">${e.items}</div>`:''):`<div class=\"empty ${e.items?'errmsg':''}\">${e.items||'Scan or type the part numbers you received, or paste the whole bill.'}</div>`}${geNwHTML(g,e)}")
    sub("<div class=\"foot\"><div class=\"sum\">${grnUnits(g)} units will be added to stock<b>${inr(tot)}</b></div><div class=\"grid2\"><button class=\"btn line\" onclick=\"geSave(false)\">Save draft</button><button class=\"btn\" onclick=\"geSave(true)\">Post to stock</button></div></div>",
        "${geFoot(g,tot)}")
    sub("if(!g.items.length)e.items='Add at least one part.';", "if(!g.items.length&&!(g.nw||[]).length)e.items='Add at least one part.';")
    sub("if(post){g.items.forEach((it,i)=>{if(!(+it.rate>0))e['r'+i]=1;});if(g.items.some(it=>!(+it.q>0)))",
        "if(post){g.items.forEach((it,i)=>{if(!(+it.rate>0))e['r'+i]=1;});(g.nw||[]).forEach((it,i)=>{if(!(+it.rate>0))e['n'+i]=1;});if(g.items.concat(g.nw||[]).some(it=>!(+it.q>0)))")
    sub("if(Object.keys(e).some(k=>k[0]==='r'))toast('Enter the purchase rate for every part');",
        "if(Object.keys(e).some(k=>k[0]==='r'||k[0]==='n'))toast('Enter the purchase rate for every part');")
    sub("if(post){g.items.forEach(it=>{DB.stock[it.pid]+=(+it.q);", "if(post){geNwPost(g);g.items.forEach(it=>{DB.stock[it.pid]=(+DB.stock[it.pid]||0)+(+it.q);")
    sub("toast(post?`${g.id} posted · ${grnUnits(g)} units added`:`${g.id} saved as draft`);",
        "toast(post?`${g.id} posted · ${grnUnits(g)} units added${S.ui.geW?' · '+S.ui.geW+' new part'+(S.ui.geW>1?'s wait':' waits')+' for photos':''}`:`${g.id} saved as draft`);S.ui.geW=0;S.ui.geOpen=null;S.ui.gePick=null;")
    sub(",x.ic,'','n');}).join('')}</div>\n <div class=\"card\"><div class=\"kv big\"><span>Total</span>",
        ",x.ic,'','n');}).join('')}${(g.wait||[]).map(w=>li(esc(w.name||w.pn),`${esc(w.pn)} · ${w.q} × ${inr(w.rate)}`,'<span class=\"pill a\">Waiting for photos</span>','camera',`S.ui.iw='${w.wid}';go('invwait')`,'y')).join('')}</div>\n <div class=\"card\"><div class=\"kv big\"><span>Total</span>")
    # Find Part's part page: Add to stock
    sub("<div class=\"row top\"><div class=\"tile n\" style=\"width:56px;height:56px\">${ic(x.ic,'s28')}</div>",
        "<div class=\"row top\"><div class=\"tile n inv-tile\" style=\"width:56px;height:56px\">${x.photos&&x.photos[0]?`<img src=\"${esc(phSrc(x.photos[0]))}\" alt=\"\" loading=\"lazy\">`:ic(x.ic,'s28')}</div>")
    sub(":r.part?`<div class=\"cap\">Not in our stock list yet. Inventory can add it with this part number.</div>`:''}", ":r.part?invFpAdd(r):''}", 2)  # m2PartV + old catCard (unused)
    # styles and code
    sub("@media (max-width:1480px){.wv-date{display:none}}", "@media (max-width:1480px){.wv-date{display:none}}\n" + INVCSS.strip())
    sub("/* ---------- boot ---------- */\nasync function start(){", INVJS + "/* ---------- boot ---------- */\nasync function start(){")
    return a, n
