/* ---- update 8c (Sam 2026-10-11 19:53Z-20:30Z): a supplier bill read by "Apna AI" on our own server (free; each page is read in memory and
   never kept), PDF bills, many pages, the bill's header and totals checked, MRP / discount / HSN / GST per line, tap a line to fix its
   part no. (remembered for that supplier), the bill's MRP and HSN into the list on posting, supplier bills to pay with due alerts ---- */
const BP_MAXP=40,bpQ=q=>String(r2(q)),bpErr=e=>String(e&&e.message||e||'').slice(0,160),bpNk=s=>catPk(s).slice(0,30);
const bpDef=o=>{const r={};for(const k in o)if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')r[k]=o[k];return r;};
function bpInit(st){['pages','np','npSkip','fixed'].forEach(k=>{if(!Array.isArray(st[k]))st[k]=[];});
 ['names','fixes','nfixes','seen'].forEach(k=>{if(!st[k]||typeof st[k]!=='object')st[k]={};});
 if(!st.bill)st.bill={tot:{nums:[]}};return st;}
/* -- reading: Apna AI on the server first, this device's reader when the server cannot; a PDF with text is read exactly -- */
async function bpAi(c){const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',.92));if(!blob)throw new Error('could not get the page ready');
 let r;try{r=await fetch('/api/billread',{method:'POST',body:blob,headers:{'Content-Type':'image/jpeg'},credentials:'same-origin'});}catch(e){throw new Error('no internet');}
 let j=null;try{j=await r.json();}catch(e){}
 if(!r.ok||!j||!j.ok)throw new Error(j&&j.error||'server '+r.status);
 return String(j.text||'');}
async function bpReadC(c,rd){
 try{
  if(!rd.aiOff){try{const t=await bpAi(c);rd.how.ai=(rd.how.ai||0)+1;return t;}catch(e){rd.aiOff=1;rd.aiErr=bpErr(e);}}
  rd.msg=rd.N>1?`Reading page ${rd.k+1} of ${rd.N} on this device…`:'Reading the bill on this device…';rd.show();
  if(!rd.w)rd.w=ocrWorker(m=>{if(m&&m.status==='recognizing text'){const v=Math.round((rd.k+(m.progress||0))/rd.N*100);if(v!==rd.pct){rd.pct=v;rd.show();}}});
  const w=await rd.w,r=await w.recognize(c);rd.how.phone=(rd.how.phone||0)+1;return r.data&&r.data.text||'';
 }finally{c.width=c.height=0;}}
async function bpPdfDoc(f){const L=await pdfLib();if(!PDF_W)PDF_W=new L.PDFWorker();
 try{return await L.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false,worker:PDF_W,standardFontDataUrl:new URL('vendor/pdfjs/standard_fonts/',document.baseURI).href}).promise;}
 catch(e){throw new Error(e&&e.name==='PasswordException'?f.name+' has a password. Save it without the password and try again.':f.name+' could not be opened as a PDF.');}}
/* the words of a PDF page in rows, left to right; a wide gap between words is a new column (two spaces) */
async function bpPdfText(pg){const tc=await pg.getTextContent(),R=[];
 for(const x of tc.items){if(!x.str||!x.str.trim())continue;const t=x.transform,y=t[5],h=Math.abs(t[3])||x.height||8,w=x.width||0;
  let r=null;for(const q of R)if(Math.abs(q.y-y)<=Math.max(2,Math.min(q.h,h)*.5)){r=q;break;}
  if(!r){r={y,h,it:[]};R.push(r);}r.it.push({x:t[4],w,s:x.str,cw:x.str.length?w/x.str.length:h*.5});}
 R.sort((a,b)=>b.y-a.y);
 return R.map(r=>{r.it.sort((a,b)=>a.x-b.x);let s='',end=null;
  for(const t of r.it){const cw=Math.max(1.5,t.cw);if(end!=null){const gap=t.x-end;s+=gap>cw*1.6?'  ':gap>cw*.3?' ':'';}s+=t.s;end=t.x+t.w;}
  return s.trim();}).filter(Boolean).join('\n');}
const bpTextOk=t=>{const a=(String(t).match(/[A-Za-z0-9]/g)||[]).length;return a>=40&&a>=String(t).replace(/\s/g,'').length*.5;};
/* a scanned PDF page: drawn as a picture, then cut out and straightened like a photo */
async function bpPdfPage(pg){const v0=pg.getViewport({scale:1}),k=Math.min(4,2600/Math.max(v0.width,v0.height)),v=pg.getViewport({scale:k}),c=document.createElement('canvas');
 c.width=Math.round(v.width);c.height=Math.round(v.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
 await pg.render({canvasContext:x,viewport:v}).promise;
 const b=await new Promise(ok=>c.toBlob(ok,'image/png'));c.width=c.height=0;if(!b)throw new Error('could not get the page ready');
 const u=URL.createObjectURL(b);try{return await ocrPrep(u);}finally{URL.revokeObjectURL(u);}}
/* photos (one per page) or PDFs: every page read in turn, its lines added once, the bill's header and totals kept */
async function invBillRead(inp){const files=[...(inp.files||[])];inp.value='';if(!files.length)return;
 const st=bpInit(S.ui.ip||(S.ui.ip={txt:'',pick:{}}));if(st.rd&&st.rd.st==='busy')return;
 const rd=st.rd={st:'busy',pct:0,msg:'Getting the bill ready…',errs:[],how:{},k:0,N:1};
 rd.show=()=>{if(S.ui.ip===st&&cur().s==='invpaste')invRefresh();};rd.show();
 const docs=[],jobs=[];let cut=0;
 try{
  for(const f of files){
   if(/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name)){let d;try{d=await bpPdfDoc(f);}catch(e){rd.errs.push(bpErr(e));continue;}docs.push(d);
    for(let i=1;i<=d.numPages;i++){if(jobs.length<BP_MAXP)jobs.push({d,i});else cut++;}}
   else if(/^image\//i.test(f.type)||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)){if(jobs.length<BP_MAXP)jobs.push({f});else cut++;}
   else rd.errs.push(f.name+' is not a photo or a PDF.');}
  if(cut)rd.errs.push(cut+' more page'+(cut>1?'s were':' was')+' not read: '+BP_MAXP+' pages at a time.');
  rd.N=Math.max(1,jobs.length);
  for(let k=0;k<jobs.length;k++){if(S.ui.ip!==st)return;const j=jobs[k],lab=jobs.length>1?'Page '+(k+1)+': ':'';
   rd.k=k;rd.pct=Math.round(k/rd.N*100);rd.msg=jobs.length>1?`Reading page ${k+1} of ${jobs.length}…`:'Reading the bill…';rd.show();
   try{let text='';
    if(j.d){const pg=await j.d.getPage(j.i);try{text=await bpPdfText(pg);if(bpTextOk(text))rd.how.pdf=(rd.how.pdf||0)+1;else text=await bpReadC(await bpPdfPage(pg),rd);}finally{pg.cleanup();}}
    else{const u=URL.createObjectURL(j.f);let c;try{c=await ocrPrep(u);}catch(e){throw new Error((j.f.name||'This photo')+' could not be opened. Take it again as a normal photo.');}finally{URL.revokeObjectURL(u);}
     text=await bpReadC(c,rd);}
    if(S.ui.ip!==st)return;
    bpAddPage(st,text,lab);
   }catch(e){rd.errs.push(lab+bpErr(e));}}
  bpAfter(st);rd.st='done';rd.pct=100;
 }catch(e){rd.st='err';rd.msg=bpErr(e);}
 finally{docs.forEach(d=>{try{d.destroy();}catch(e){}});if(rd.w){const w=rd.w;rd.w=null;w.then(x=>x.terminate()).catch(()=>{});}}
 rd.show();if(rd.st==='done')bpFixRun(st);}
/* -- what one page says, added to the bill -- */
function bpOwn(g){if(!g)return false;const o=(DB.billFmt||{})['~own'];return Array.isArray(o)&&o.includes(g)||catPk(SHOP&&SHOP.gst||'')===g;}
function bpKnownG(){const s=new Set();sups().forEach(x=>{if(/^[0-9A-Z]{15}$/.test(x.gst||''))s.add(x.gst);});Object.keys(DB.billFmt||{}).forEach(k=>{if(/^[0-9A-Z]{15}$/.test(k))s.add(k);});return [...s];}
function bpFmt(B){const F=DB.billFmt||{},n=B.sup||B.name;return B.gstin&&F[B.gstin]||n&&F['N:'+catPk(n).slice(0,40)]||null;}
function bpAddPage(st,text,lab){const B=st.bill,pi=st.pages.length,known=bpKnownG();let P=bpParse(text,{known});const hd=P.hdr||{gsts:[]};
 const gs=(hd.gsts||[]).filter(x=>!bpOwn(x.g)),val=gs.filter(x=>!x.bad),nb=val.filter(x=>!x.buy),sel=nb[0]||(val.length>=2?val[0]:null);
 val.forEach(x=>{if(x.buy&&(!sel||x.g!==sel.g))B.ourG=x.g;});
 let warn='';
 if(pi&&hd.inv&&B.inv&&catPk(hd.inv)!==catPk(B.inv))warn=`${lab}it shows bill no. ${hd.inv}, the first page ${B.inv}. Check it is the same bill.`;
 else if(pi&&sel&&B.gstin&&sel.g!==B.gstin)warn=`${lab}it shows GSTIN ${sel.g}, the first page ${B.gstin}. Check it is the same bill.`;
 if(sel&&!B.gstin){B.gstin=sel.g;B.gstBad='';}
 if(!B.gstin&&!B.gstBad){const b=gs.find(x=>x.bad&&!x.buy);if(b)B.gstBad=b.g;}
 if(hd.inv&&!B.inv)B.inv=hd.inv;if(hd.date&&!B.date)B.date=hd.date;if(hd.name&&!B.name)B.name=hd.name;
 // no column titles on this page: read it again with the layout this supplier's bills had before
 const F=bpFmt(B);
 if(!P.cols&&F&&F.cols){const P2=bpParse(text,{known,cols:F.cols,order:F.order});if(P2.lines.length+P2.np.length>=P.lines.length+P.np.length)P=Object.assign(P2,{hdr:hd});}
 if(P.cols&&!B.cols){B.cols=P.cols;B.order=P.order;}
 // totals: a later page wins (the last page has the bill's totals)
 const T=P.tot||{},BT=B.tot;Object.keys(T).forEach(k=>{if(k==='nums')(T.nums||[]).forEach(v=>{if(!BT.nums.includes(v))BT.nums.push(v);});else if(T[k])BT[k]=T[k];});
 // the lines: misreads this supplier's bills had before are put right; a line on two pages (the same page read twice) counts once
 const pg={n:0,dup:0,err:warn},fx=Object.assign({},F&&F.fix||{},st.fixes),nfx=Object.assign({},F&&F.nfix||{},st.nfixes),add=[];
 const seen=key=>{const p=st.seen[key];if(p!=null&&p!==pi){pg.dup++;return true;}st.seen[key]=pi;return false;};
 P.lines.forEach(o=>{let pk=catPk(o.pn);if(fx[pk]&&catPk(fx[pk])!==pk){st.fixed.push([String(o.pn).toUpperCase(),fx[pk]]);o.pn=fx[pk];pk=catPk(o.pn);}
  if(seen(pk+'|'+r2(o.q)+'|'+r2(o.r)))return;if(o.name)st.names[pk]=o.name;add.push(bpLineTxt(o));pg.n++;});
 P.np.forEach(o=>{const nk=bpNk(o.name),pn=nfx[nk];
  if(pn){o.pn=pn;const pk=catPk(pn);if(seen(pk+'|'+r2(o.q)+'|'+r2(o.r)))return;st.names[pk]=o.name;add.push(bpLineTxt(o));pg.n++;return;}
  if(!seen('~'+nk+'|'+r2(o.q)+'|'+r2(o.r)))st.np.push(o);});
 if(add.length)st.txt=(String(st.txt||'').trim()?st.txt.replace(/\s*$/,'\n'):'')+add.join('\n');
 st.pages.push(pg);}
/* the supplier: the one with this GSTIN, else the name this supplier's bills had before, else the name on the bill */
function bpAfter(st){const B=st.bill;if(B.sup)return;const L=sups();let s=B.gstin&&L.find(x=>x.gst===B.gstin);
 const F=bpFmt(B);if(!s&&F&&F.n)s=L.find(x=>x.n===F.n)||{n:F.n};
 if(!s&&B.name){const k=catPk(B.name);s=L.find(x=>{const y=catPk(x.n);return y&&(y===k||Math.min(y.length,k.length)>=6&&(y.includes(k)||k.includes(y)));});}
 B.sup=s?s.n:B.name||'';}
/* when the catalogues for the lines have loaded: numbers found nowhere are matched to the nearest one they could be misread from */
async function bpFixRun(st){const rd=st.rd,t0=Date.now(),L=()=>invParse(st.txt).lines;
 while(Date.now()-t0<90000&&L().some(l=>!invFind(l.pn)&&invLook(l.pn,true).st==='wait')){if(S.ui.ip!==st)return;invNeed(L().map(l=>invLook(l.pn,true)));await new Promise(r=>setTimeout(r,400));}
 if(S.ui.ip!==st)return;const rows=String(st.txt||'').split('\n');let ch=0;
 L().forEach(l=>{if(invFind(l.pn)||invLook(l.pn,true).hits.length)return;const m=ocrNear(l.pk);if(!m||catPk(m.pn)===l.pk||rows[l.ln]==null)return;
  rows[l.ln]=bpSwapPn(rows[l.ln],l.tok,m.pn);st.fixed.push([l.pn,m.pn]);if(st.names[l.pk])st.names[catPk(m.pn)]=st.names[l.pk];ch++;});
 if(ch)st.txt=rows.join('\n');if(rd)rd.chk=1;if(cur().s==='invpaste')invRefresh();}
const bpSwapPn=(row,tok,pn)=>{const i=row.indexOf(tok);return i<0?pn+'  '+row:row.slice(0,i)+pn+row.slice(i+tok.length);};
/* -- a line of the box: part no., qty, rate, and what else the bill says (MRP, HSN, GST, DISC %, AMT) -- */
function invParse(txt){const lines=[];let skip=0;
 String(txt||'').split(/\r?\n/).forEach((row,ln)=>{const x={};
  let s=row.replace(/(^|\s)(MRP|HSN|GST|DISC|AMT)(?:\s*[:=]\s*|\s+)(?:₹\s*)?(\d[\d.,]*)\s*%?(?=\s|$)/gi,(m,a,k,v)=>{x[k.toLowerCase()]=v.replace(/,/g,'');return a+' ';});
  s=s.replace(/(\d),(\d{3})(?!\d)/g,'$1$2').trim();if(!s)return;
  const t=s.split(/[\t,;|]+|\s+/).map(y=>y.trim()).filter(Boolean);let pi=-1;
  for(let i=0;i<t.length;i++){const k=catPk(t[i]);if(k.length>=5&&/\d/.test(k)&&!/^\d+(\.\d+)?$/.test(t[i])||/^\d{6,}$/.test(t[i])){pi=i;break;}}
  if(pi<0){if(/\d/.test(s))skip++;return;}
  const nums=t.slice(pi+1).map(y=>y.replace(/^(\d+)(pcs?|nos?|no\.|qty)$/i,'$1')).filter(y=>/^\d+(\.\d+)?$/.test(y));let q=0,rate='';
  if(nums.length>=2&&/\./.test(nums[1])&&+nums[0]>0){q=+nums[0];rate=nums[1];}
  else if(nums.length&&/^\d+$/.test(nums[0])){q=parseInt(nums[0]);if(nums[1])rate=nums[1];}else if(nums.length)rate=nums[0];
  const g=x.gst!=null&&x.gst!==''&&isFinite(+x.gst)?+x.gst:null;
  lines.push({pn:t[pi].toUpperCase(),pk:catPk(t[pi]),tok:t[pi],q:q||1,rate,ln,mrp:+x.mrp||0,hsn:/^\d{4,8}$/.test(x.hsn||'')?x.hsn:'',gst:g,disc:Math.min(99,+x.disc||0),amt:+x.amt||0});});
 return {lines,skip};}
const bpNet=l=>r2((+l.rate||0)*(1-(+l.disc||0)/100));
const bpCalcDisc=(rate,mrp,g)=>mrp>0?Math.round((mrp-rate*(1+(+g||0)/100))/mrp*1000)/10:0;
const bpLx=l=>bpDef({lr:l.disc>0?String(l.rate):undefined,disc:l.disc>0?l.disc:undefined,bmrp:l.mrp>0?l.mrp:undefined,hsn:l.hsn||undefined,gst:l.gst!=null?l.gst:BP_BG!=null?BP_BG:undefined});
/* a bill with one GST rate for all its lines (CGST 9% + SGST 9% at the bottom): that rate for the lines that show none */
let BP_BG=null;const bpBillG=st=>{const r=+(st&&st.bill&&st.bill.tot&&st.bill.tot.rate);return r>0&&BP_GST.includes(r)?r:null;};
const bpEx=n=>bpDef({lr:n.lr,disc:n.disc,bmrp:n.bmrp,hsn:n.hsn,gst:n.gst});
/* the rate each part had on its last posted bill */
function bpLastMap(ex){const m=new Map();for(const g of DB.grns||[]){if(g.status!=='posted'||g.id===ex)continue;const d=g.bdate||g.iso||ddmmm2iso(g.date);
 for(const it of g.items||[]){if(!(+it.rate>0))continue;const o=m.get(it.pid);if(!o||d>=o.d)m.set(it.pid,{r:+it.rate,d,inv:g.inv||g.id});}}return m;}
/* the same bill again: same bill no. from the same supplier (GSTIN or name) */
function bpDup(sup,gstin,inv,ex){const k=catPk(inv||'');if(k.length<2)return null;const sk=catPk(sup||'');
 return (DB.grns||[]).find(g=>g.id!==ex&&catPk(g.inv||'')===k&&(gstin&&g.gstin===gstin||sk&&catPk(g.supplier||'')===sk||!gstin&&!sk&&k.length>=6))||null;}
/* what the bill says about a line, and what to look at: MRP not the list's, rate above MRP, rate changed since the last bill, qty x rate */
function bpNote(l,r,last){const out=[],w=[],x=r.x||null,h=r.hits?r.hits.find(y=>y.vb===((S.ui.ip||{}).pick||{})[l.pk])||r.hits[0]:null;
 const net=bpNet(l),mrp=+l.mrp||0,g=l.gst!=null?l.gst:BP_BG;
 if(mrp>0){out.push('MRP '+invInr(mrp));const cm=x?+x.mrp||0:h?+h.mrp||0:0;
  if(cm>0&&r2(cm)!==r2(mrp))w.push(['a',`MRP on the bill ${invInr(mrp)}, ${x?'your list':'the catalogue'} ${invInr(cm)}. The bill’s MRP goes into your list${x?' and catalogue':''} when you post.`]);}
 if(l.hsn){out.push('HSN '+esc(l.hsn));if(x&&x.hsn&&String(x.hsn)!==String(l.hsn))w.push(['i',`HSN ${esc(x.hsn)} in your list becomes ${esc(l.hsn)} when you post.`]);}
 if(g!=null)out.push('GST '+bpQ(g)+'%');
 if(l.disc>0)out.push('Disc '+bpQ(l.disc)+'% · net '+invInr(net));
 else if(mrp>0&&g!=null&&net>0){const d=bpCalcDisc(net,mrp,g);if(d>0)out.push('Disc '+d+'% (calculated from MRP)');}
 if(mrp>0&&net>mrp)w.push(['r',`Rate ${invInr(net)} is above the MRP ${invInr(mrp)}.`]);
 else if(mrp>0&&g!=null&&net*(1+g/100)>mrp+.5)w.push(['a',`Rate + GST ${invInr(r2(net*(1+g/100)))} is above the MRP ${invInr(mrp)}.`]);
 if(x&&net>0){const o=last.get(x.id);if(o&&Math.abs(o.r-net)>Math.max(.5,o.r*.005))w.push([net>o.r?'a':'g',`Rate ${net>o.r?'up':'down'} ${invInr(Math.abs(r2(net-o.r)))} from ${invInr(o.r)} on the last bill (${esc(o.inv)}${o.d?', '+fmtD(o.d):''}).`]);}
 if(l.amt>0&&net>0){const a=r2(l.q*net);if(Math.abs(a-l.amt)>Math.max(1,l.amt*.01))w.push(['a',`${bpQ(l.q)} × ${invInr(net)} = ${invInr(a)}, the bill says ${invInr(l.amt)}. Check qty and rate.`]);}
 return (out.length?`<div class="cap bp-i">${out.join(' · ')}</div>`:'')+w.map(([t,s])=>`<div class="bp-w ${t}">${s}</div>`).join('');}
/* -- the bill's totals against the lines read -- */
function bpTot(st){const L=invParse(st.txt).lines,T=st.bill&&st.bill.tot||{};let it=0,itG=0,allG=L.length>0;
 L.forEach(l=>{const a=l.amt>0?l.amt:r2(l.q*bpNet(l));it+=a;if(l.gst!=null)itG+=a*(1+l.gst/100);else allG=false;});
 (st.np||[]).concat(st.npSkip||[]).forEach(o=>{const n=o.q*o.r*(1-(o.dp>0?o.dp:0)/100),a=o.tx>0?o.tx:o.incl?n:o.amt>0?o.amt:n;it+=a;if(o.gst>0)itG+=a*(1+o.gst/100);else allG=false;});
 it=r2(it);itG=r2(itG);const bd=+T.disc||0,tol=v=>Math.max(1,v*.004),C=[];
 if(T.taxable>0)C.push(['taxable value',T.taxable]);if(T.sub>0)C.push(['total',T.sub]);
 if(T.grand>0&&T.tax>0)C.push(['total before GST',r2(T.grand-T.tax-(T.round||0))]);
 (T.nums||[]).forEach(v=>C.push(['total',v]));
 let m=C.find(([,v])=>Math.abs(v-it)<=tol(v)),ud=0;
 if(!m&&bd>0){m=C.find(([,v])=>Math.abs(v-(it-bd))<=tol(v));if(m)ud=1;}
 if(!m&&allG&&T.grand>0&&Math.abs(T.grand-(itG+(T.round||0)))<=tol(T.grand))m=['total',T.grand];
 const ref=m?m[1]:T.taxable>0?T.taxable:T.sub>0?T.sub:T.grand>0&&T.tax>0?r2(T.grand-T.tax-(T.round||0)):0;
 return {it,ok:!!m,lab:m?m[0]:T.taxable>0?'taxable value':T.sub>0?'total':'total before GST',ref,ud,T};}
function bpTotHTML(st){const r=bpTot(st),T=r.T,kv=(k,v)=>`<div class="kv"><span>${k}</span><span>${v}</span></div>`;
 let h=kv('Lines read come to',invInr(r.it));
 if(T.taxable>0)h+=kv('Taxable value',invInr(T.taxable));
 if(T.disc>0)h+=kv('Discount on the bill',invInr(T.disc));
 if(T.tax>0)h+=kv('GST'+(T.rate?' '+bpQ(T.rate)+'%':''),invInr(T.tax));
 if(T.round)h+=kv('Round off',(T.round>0?'+':'−')+invInr(Math.abs(T.round)));
 if(T.grand>0)h+=kv('Bill total',`<b>${invInr(T.grand)}</b>`);
 if(r.ok)h+=`<div class="bp-w g">${ic('checkC','s16')}<span>The lines add up to the bill’s ${r.lab}${r.ud?' after its discount':''}.</span></div>`;
 else if(r.ref>0)h+=`<div class="bp-w">${ic('alert','s16')}<span>The lines come to ${invInr(r.it)}, the bill’s ${r.lab} is ${invInr(r.ref)} (${invInr(Math.abs(r2(r.ref-r.it)))} ${r.it<r.ref?'less':'more'}). A line may be missing or misread: check the lines against the bill.</span></div>`;
 else h+=`<div class="cap">The bill’s total was not found, so the lines could not be checked against it.</div>`;
 if(T.words>0&&T.grand>0&&Math.abs(T.words-T.grand)>1)h+=`<div class="bp-w">${ic('alert','s16')}<span>The amount in words (${invInr(T.words)}) is not the bill total (${invInr(T.grand)}). Check the total.</span></div>`;
 return h;}
/* -- the paste screen: what was read, the bill's header, the lines, each line checked -- */
function bpReadNote(st){const rd=st.rd;if(!rd)return '';
 if(rd.st==='busy')return `<div class="inv-ocr"><div class="inv-ocr-bar"><i style="width:${Math.max(4,rd.pct||0)}%"></i></div><div class="cap">${esc(rd.msg)}</div></div>`;
 if(rd.st==='err')return `<div class="inv-ocr no"><b>Could not read the bill</b><div class="cap">${esc(rd.msg||'Please try again.')}</div></div>`;
 const pg=st.pages,n=pg.reduce((a,p)=>a+p.n,0),dup=pg.reduce((a,p)=>a+p.dup,0),how=rd.how||{},np=st.np.length;
 const by=[how.pdf?'from the PDF':'',how.ai?'by Apna AI':'',how.phone?'on this device':''].filter(Boolean).join(' and ');
 const errs=(rd.errs||[]).concat(pg.filter(p=>p.err).map(p=>p.err));
 return `<div class="inv-ocr ${n||np?'ok':'no'}"><b>${n?`Read ${n} line${n>1?'s':''} with a part no.${pg.length>1?' from '+pg.length+' pages':''}`:np?'No part numbers read':'Nothing read from the bill'}</b>
  <div class="cap">${n||np?(by?'Read '+by+'. ':'')+'Check the lines against the bill. Tap “Type the right part no.” on a line that was misread.':'Take it again: the whole page, flat, close, in good light.'} The photo or PDF is not saved.</div>
  ${dup?`<div class="cap">${dup} line${dup>1?'s':''} read on two pages counted once.</div>`:''}
  ${rd.aiErr&&how.phone?`<div class="cap">Apna AI could not read it (${esc(rd.aiErr)}), so this device read it.</div>`:''}
  ${errs.map(e=>`<div class="bp-w">${esc(e)}</div>`).join('')}
  ${st.fixed.length?`<div class="cap"><b>Corrected:</b></div><pre>${st.fixed.map(([a,b])=>esc(a)+' → '+esc(b)).join('\n')}</pre>`:''}
  ${n&&!rd.chk?'<div class="cap">Checking the part numbers in the catalogues…</div>':''}</div>`;}
function bpBillCard(st){if(!st.pages.length)return '';const B=st.bill,d=bpDup(B.sup||B.name,B.gstin,B.inv,null),known=!!B.sup&&sups().some(s=>s.n===B.sup);
 return `<div class="bp-bill">
  <div class="field"><label for="bp-sup">Supplier</label><div class="inp"><input id="bp-sup" list="bp-sups" autocomplete="off" value="${esc(B.sup||'')}" placeholder="Supplier name" onchange="S.ui.ip.bill.sup=this.value.trim();refresh()"><datalist id="bp-sups">${supN().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></div>
   ${B.sup&&!known?'<div class="cap">New supplier: added when you post the bill.</div>':''}</div>
  <div class="grid2"><div class="field"><label for="bp-inv">Bill no.</label><div class="inp ${d?'err':''}"><input id="bp-inv" value="${esc(B.inv||'')}" autocomplete="off" onchange="S.ui.ip.bill.inv=this.value.trim();refresh()"></div></div>
  <div class="field"><label for="bp-dt">Bill date</label><div class="inp"><input id="bp-dt" type="date" value="${esc(B.date||'')}" max="${isoToday()}" onchange="S.ui.ip.bill.date=this.value"></div></div></div>
  <div class="kv"><span>GSTIN</span><span>${B.gstin?`<span class="num">${esc(B.gstin)}</span><span class="bp-ok" title="Check digit is right">${ic('checkC','s16')}</span>`:B.gstBad?`<span class="num">${esc(B.gstBad)}</span>`:'Not found'}</span></div>
  ${B.gstBad&&!B.gstin?`<div class="bp-w">${ic('alert','s16')}<span>This GSTIN’s last letter does not match its check digit: it may be misread. Check it on the bill.</span></div>`:''}
  ${d?`<div class="bp-w r">${ic('alert','s16')}<span>Bill ${esc(B.inv)} from ${esc(d.supplier)} is already in Stock in (${esc(d.id)}, ${esc(d.date)}). Is this the same bill again?</span></div>`:''}
  ${bpTotHTML(st)}</div>`;}
const bpFixForm=l=>`<form class="bp-fix" onsubmit="event.preventDefault();bpFixSave(${l.ln},this.elements[0].value)"><input id="bp-fx" value="${esc(l.pn)}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="The right part no."><button class="btn sm" type="submit">Check</button><button class="link" type="button" onclick="S.ui.bpFix=null;refresh()">Cancel</button></form>`;
function bpFixOpen(ln){S.ui.bpFix=ln;S.ui.after=()=>{const i=document.getElementById('bp-fx');if(i){i.focus();try{i.select();}catch(e){}}};refresh();}
/* the right part no. typed on a line: the line changes, is checked again at once, and this supplier's bills get the same fix next time */
function bpFixSave(ln,v){const st=S.ui.ip;if(!st)return;v=String(v||'').trim().toUpperCase().replace(/\s+/g,'');
 if(catPk(v).length<4){toast('Type the part no. as on the bill');return;}
 const rows=String(st.txt||'').split('\n'),row=rows[ln],l=row!=null&&invParse(row).lines[0];S.ui.bpFix=null;if(!l)return refresh();
 const k=catPk(v);if(k!==l.pk){rows[ln]=bpSwapPn(row,l.tok,v);st.txt=rows.join('\n');st.fixes[l.pk]=v;if(st.names[l.pk]&&!st.names[k])st.names[k]=st.names[l.pk];invLook(v);toast('Checking '+v+'…');}
 refresh();}
function bpNpSave(i,v){const st=S.ui.ip;if(!st)return;const o=st.np[i];if(!o)return;v=String(v||'').trim().toUpperCase().replace(/\s+/g,'');
 if(catPk(v).length<4){toast('Type the part no. as on the bill or the box');return;}
 st.names[catPk(v)]=o.name;st.nfixes[bpNk(o.name)]=v;st.np.splice(i,1);
 st.txt=(String(st.txt||'').trim()?st.txt.replace(/\s*$/,'\n'):'')+bpLineTxt({...o,pn:v});invLook(v);refresh();}
function bpNpSkip(i){const st=S.ui.ip;if(!st)return;const o=st.np.splice(i,1)[0];if(o)st.npSkip.push(o);refresh();}
SCREENS.invpaste=()=>{const st=bpInit(S.ui.ip||(S.ui.ip={txt:'',pick:{}}));BP_BG=bpBillG(st);const P0=invParse(st.txt),rows=P0.lines.map(invCheck);invNeed(rows.map(r=>r.o).filter(Boolean));
 const ready=rows.filter(r=>r.kind==='ready'),need=rows.length-ready.length,look=rows.some(r=>r.kind==='look'),unpicked=rows.some(r=>r.kind==='pick'&&!st.pick[r.l.pk]);
 const busy=!!(st.rd&&st.rd.st==='busy'),last=bpLastMap(),dis=busy?' dis':'',off=busy?' disabled':'';
 const b=(t,c)=>`<span class="pill ${c} inv-bd">${t}</span>`,qr=l=>`${bpQ(l.q)} × ${l.rate?invInr(l.rate):'rate not given'}`;
 const fx=(l,t)=>S.ui.bpFix===l.ln?bpFixForm(l):`<button class="link bp-fl" onclick="bpFixOpen(${l.ln})">${ic('edit','s16')} ${t}</button>`;
 const nm=l=>st.names[l.pk]?`<div class="cap">On the bill: ${esc(st.names[l.pk])}</div>`:'';
 const one=r=>{const l=r.l,wt=r.w?` · already waiting for photos from bill ${esc(r.w.inv||r.w.grn||'')}`:'',note=r.kind==='look'?'':bpNote(l,r,last);
  if(r.kind==='ready')return `<div class="inv-cl ok">${b('+'+bpQ(l.q),'g')}<div class="grow"><b>${esc(r.x.name)}</b><div class="cap">${esc(r.x.brand)} · in your list · <span class="num">${esc(l.pn)}</span> · ${qr(l)}</div>${note}${fx(l,'Change part no.')}</div>${ic('checkC','s20')}</div>`;
  if(r.kind==='look')return `<div class="inv-cl">${b('…','n')}<div class="grow"><b class="num">${esc(l.pn)}</b><div class="cap">Checking the ${esc((r.o.pend||[]).join(', ')||'')} catalogues…</div></div></div>`;
  if(r.kind==='none')return `<div class="inv-cl no">${b('Not found','r')}<div class="grow"><b class="num">${esc(l.pn)}</b>${nm(l)}<div class="cap">Not in any catalogue we looked in. Misread? Type the right part no. If it is right, fill name, brand and MRP by hand, then take its photo. ${qr(l)}${wt}</div>${note}${fx(l,'Type the right part no.')}</div></div>`;
  const h=r.hits.find(x=>x.vb===st.pick[l.pk])||r.hits[0];
  return `<div class="inv-cl nw">${b('New','a')}<div class="grow"><b>${esc(h.name)}${r.kind==='new'?' · '+esc(h.vb)+' catalogue':''}</b><div class="cap"><span class="num">${esc(l.pn)}</span> · ${qr(l)} · ${r.kind==='pick'?'this number is in the '+esc(r.hits.map(x=>x.vb).join(' and '))+' catalogues. Pick the brand:':'needs '+(h.mrp||l.mrp?'':'MRP + ')+'a photo'}${wt}</div>
   ${r.kind==='pick'?`<div class="inv-chips">${r.hits.map(x=>`<button class="chip ${st.pick[l.pk]===x.vb?'on':''}" onclick="S.ui.ip.pick['${l.pk}']='${m2Q(x.vb)}';refresh()">${esc(x.vb)}${x.mrp?' · MRP '+invInr(x.mrp):''}</button>`).join('')}</div>`:''}${note}${fx(l,'Change part no.')}</div></div>`;};
 const np=(o,i)=>`<div class="inv-cl bp-np">${b('No part no.','a')}<div class="grow"><b>${esc(o.name||'Item')}</b><div class="cap">${bpQ(o.q)} × ${invInr(o.r)}${o.mrp>0?' · MRP '+invInr(o.mrp):''}</div>
   <form class="bp-fix" onsubmit="event.preventDefault();bpNpSave(${i},this.elements[0].value)"><input placeholder="Type its part no." autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Part no. for ${esc(o.name||'this item')}"><button class="btn sm" type="submit">Add</button></form>
   <button class="link bp-fl" onclick="bpNpSkip(${i})">Not a part (skip it)</button></div></div>`;
 const up=isWv()?`<label class="btn line inv-ocr-b${dis}">${ic('file','s18')} Upload a photo or PDF of the bill<input type="file" accept="image/*,application/pdf,.pdf" multiple aria-label="Photo or PDF of the bill" onchange="invBillRead(this)"${off}></label>`
  :`<div class="grid2"><label class="btn line inv-ocr-b${dis}">${ic('camera','s18')} Take a photo<input type="file" accept="image/*" capture="environment" aria-label="Take a photo of the bill" onchange="invBillRead(this)"${off}></label><label class="btn line inv-ocr-b${dis}">${ic('file','s18')} Photos or PDF<input type="file" accept="image/*,application/pdf,.pdf" multiple aria-label="Photos or PDF of the bill" onchange="invBillRead(this)"${off}></label></div>`;
 return bar('Paste supplier bill')+`<div class="scroll"><div class="pad">
 <p class="cap">Take a photo of each page of the printed bill, upload its PDF, or paste the lines from the supplier’s Excel sheet or WhatsApp message. Each line is checked against your list and all catalogues.</p>
 <div class="inv-2c paste"><div class="inv-col"><div class="card"><div class="sec"><span class="h3">Read the bill</span>${st.pages.length?`<span class="cap">${st.pages.length} page${st.pages.length>1?'s':''}</span>`:''}</div>
  ${up}
  ${bpReadNote(st)}
  ${bpBillCard(st)}</div>
  <div class="card"><div class="sec"><span class="h3">Lines${P0.lines.length?' · '+P0.lines.length:''}</span>${st.txt||st.pages.length?`<button class="link" onclick="S.ui.ip={txt:'',pick:{}};S.ui.bpFix=null;refresh()">Clear</button>`:''}</div>
  <textarea id="ip-ta" class="inv-ta" spellcheck="false" placeholder="Paste here, one part per line:&#10;45125-AAH-F0099  10  118.00&#10;94050-06000, 50, 3.20" oninput="S.ui.ip.txt=this.value;clearTimeout(window._ipT);window._ipT=setTimeout(invRefresh,600)">${esc(st.txt)}</textarea>
  <div class="cap">Works with Excel columns or WhatsApp lines: part no., qty, rate. Spaces, tabs or commas are fine. Lines read from a bill also carry its MRP, HSN, GST, discount and amount.</div></div></div>
 <div class="inv-col"><div class="card"><div class="sec"><span class="h3">Checked</span><div class="inv-chips">${ready.length?`<span class="pill g">${ready.length} ready</span>`:''}${need?`<span class="pill a">${need} need${need>1?'':'s'} you</span>`:''}</div></div>
  ${rows.length?rows.map(one).join(''):st.np.length?'':'<div class="empty">Read or paste the bill. Each line shows here: in your list, new from a catalogue, or not found.</div>'}
  ${st.np.length?`<div class="cap"><b>${st.np.length} item line${st.np.length>1?'s':''} without a part no.</b> Type the part no. to add it, or skip it.</div>${st.np.map(np).join('')}`:''}
  ${P0.skip?`<div class="cap">${P0.skip} line${P0.skip>1?'s':''} skipped: no part number found.</div>`:''}
  ${rows.length?`<div class="grid2"><button class="btn" ${ready.length&&!busy?'':'disabled'} onclick="invPasteAdd(0)">Add ${ready.length} ready line${ready.length===1?'':'s'} to bill</button><button class="btn line" ${need&&!look&&!unpicked&&!busy?'':'disabled'} onclick="invPasteAdd(1)">Add all ${rows.length} lines</button></div>
  <div class="cap">${busy?'Still reading the bill…':look?'Still checking some lines in the catalogues…':unpicked?'Pick the brand for the lines that need it.':'Ready lines go into stock when you post the bill. New parts wait until they have a photo.'}</div>`:''}
 </div></div></div></div></div>`;};
/* -- the lines into Stock in, with the bill's header, totals, MRP, HSN, GST and discount; this supplier's bill layout and fixes kept -- */
function invPasteAdd(all){const st=S.ui.ip;if(!st)return;bpInit(st);BP_BG=bpBillG(st);const rows=invParse(st.txt).lines.map(invCheck);
 const g=S.ui.ge&&S.ui.ge.status!=='posted'?S.ui.ge:geState('new');S.ui.ge=g;g.nw=g.nw||[];let n=0;
 if(st.pages.length){const B=st.bill,T=B.tot||{},tc=bpTot(st);
  if(g.id==='new'&&!String(g.supplier||'').trim()&&(B.sup||B.name))g.supplier=B.sup||B.name;
  if(!String(g.inv||'').trim()&&B.inv)g.inv=B.inv;
  if(B.gstin&&!g.gstin)g.gstin=B.gstin;
  if(B.date&&!g.bdate)g.bdate=B.date;
  if(!(parseFloat(String(g.billAmt||'').replace(/[^\d.]/g,''))>0)&&T.grand>0)g.billAmt=String(T.grand);
  if(T.tax>0&&g.tax==null)g.tax=T.tax;if(T.round&&g.round==null)g.round=T.round;if(T.taxable>0&&g.taxable==null)g.taxable=T.taxable;
  if(tc.ud&&T.disc>0&&g.bdisc==null)g.bdisc=T.disc;
  bpLearn(st);}
 rows.forEach(r=>{const l=r.l,ex=bpLx(l),rate=l.rate?(l.disc>0?String(bpNet(l)):l.rate):'';
  if(r.kind==='ready'){const it=g.items.find(i=>i.pid===r.x.id);if(it){it.q=(+it.q||0)+l.q;if(rate){it.rate=rate;Object.assign(it,ex);}}else g.items.push({pid:r.x.id,exp:null,q:l.q,rate,...ex});n++;return;}
  if(!all||r.kind==='look')return;const e0=g.nw.find(x=>x.pk===l.pk);if(e0){e0.q=(+e0.q||0)+l.q;if(rate){e0.rate=rate;Object.assign(e0,ex);}n++;return;}
  const h=r.kind==='new'?r.hits[0]:r.kind==='pick'?r.hits.find(x=>x.vb===st.pick[l.pk]):null;const line=invNwLine(h||{pn:l.pn},!h);line.q=l.q;line.rate=rate;Object.assign(line,ex);
  if(l.mrp>0){line.mrp=String(r2(l.mrp));line.mrpCat=false;}
  if(!h&&st.names[l.pk])line.name=String(st.names[l.pk]).slice(0,80);
  g.nw.push(line);n++;});
 S.ui.ip=null;S.ui.bpFix=null;if(S.ui.geErr)delete S.ui.geErr.items;toast(n+' line'+(n===1?'':'s')+' added to Stock in');const prev=S.stack[S.stack.length-2];if(prev&&prev.s==='grnedit'&&String(prev.p&&prev.p.id)===String(g.id))back();else go('grnedit',{id:g.id});}
/* each supplier's bills: the column layout (for pages without column titles), part no. fixes, and our own GSTIN */
function bpLearn(st){const B=st.bill;if(!B)return;const nm=B.sup||B.name||'',key=B.gstin||(nm?'N:'+catPk(nm).slice(0,40):'');if(!key)return;
 const F=DB.billFmt=DB.billFmt||{},f=F[key]&&typeof F[key]==='object'&&!Array.isArray(F[key])?F[key]:{};
 if(nm)f.n=nm;if(B.gstin)f.gst=B.gstin;if(B.cols){f.cols=B.cols;f.order=B.order;}
 f.fix=Object.assign({},f.fix||{},st.fixes);f.nfix=Object.assign({},f.nfix||{},st.nfixes);
 ['fix','nfix'].forEach(k=>{const e=Object.keys(f[k]);if(e.length>400)e.slice(0,e.length-400).forEach(x=>delete f[k][x]);});
 f.c=(+f.c||0)+1;f.at=isoToday();F[key]=f;
 if(B.ourG){const o=Array.isArray(F['~own'])?F['~own'].slice():[];if(!o.includes(B.ourG)){o.push(B.ourG);F['~own']=o.slice(-5);}}}
/* -- Stock in: bill date, GSTIN, the same bill twice; each line's MRP / discount / HSN / GST; the bill's GST and discount in the totals -- */
function geBillMore(g,e){const k=catPk(g.gstin||''),ok=k?gstOk(k):null,d=bpDup(g.supplier,g.gstin,g.inv,g.id);
 return `<div class="grid2"><div class="field"><label for="ge-bd">Bill date</label><div class="inp"><input id="ge-bd" type="date" value="${esc(g.bdate||'')}" max="${isoToday()}" onchange="S.ui.ge.bdate=this.value"></div></div>
  <div class="field"><label for="ge-gst">Supplier GSTIN</label><div class="inp ${ok===false?'err':''}"><input id="ge-gst" value="${esc(g.gstin||'')}" placeholder="Optional" autocapitalize="characters" spellcheck="false" onchange="S.ui.ge.gstin=catPk(this.value);refresh()">${ok?`<span class="bp-ok">${ic('checkC','s18')}</span>`:''}</div></div></div>
  ${ok===false?'<div class="errmsg">This GSTIN does not check out (15 letters, last one a check digit). Check it against the bill.</div>':''}
  ${d?`<div class="bp-w r">${ic('alert','s16')}<span>Bill ${esc(g.inv)} from this supplier is already in ${esc(d.id)} (${esc(d.date)}). Same bill again?</span></div>`:''}`;}
function geItemNote(it,x,g){const a=[];if(+it.bmrp>0)a.push('MRP '+invInr(it.bmrp)+(x&&+x.mrp>0&&r2(x.mrp)!==r2(it.bmrp)?' (list '+invInr(x.mrp)+', changes when posted)':''));
 if(+it.disc>0)a.push('Disc '+bpQ(it.disc)+'% of '+invInr(it.lr||it.rate));
 else if(+it.bmrp>0&&it.gst!=null&&+it.rate>0){const d=bpCalcDisc(+it.rate,+it.bmrp,+it.gst);if(d>0)a.push('Disc '+d+'% (calculated from MRP)');}
 if(it.hsn)a.push('HSN '+esc(it.hsn));if(it.gst!=null&&it.gst!=='')a.push('GST '+bpQ(it.gst)+'%');
 const o=bpLastMap(g.id).get(it.pid),net=+it.rate||0;let w='';
 if(o&&net>0&&Math.abs(o.r-net)>Math.max(.5,o.r*.005))w+=`<div class="bp-w ${net>o.r?'a':'g'}">Rate ${net>o.r?'up':'down'} from ${invInr(o.r)} on the last bill (${esc(o.inv)})</div>`;
 if(+it.bmrp>0&&net>+it.bmrp)w+=`<div class="bp-w r">Rate is above the MRP ${invInr(it.bmrp)}</div>`;
 return (a.length?`<div class="s bp-i">${a.join(' · ')}</div>`:'')+w;}
function geTotCard(g,tot,bill){const bd=+g.bdisc||0,tx=+g.tax||0,ro=+g.round||0,due=r2(tot-bd+tx+ro),more=bd||tx||ro;
 return `<div class="card"><div class="kv"><span>Items total</span><span>${inr(tot)}</span></div>${bd?`<div class="kv"><span>Bill discount</span><span>−${invInr(bd)}</span></div>`:''}${tx?`<div class="kv"><span>GST</span><span>${invInr(tx)}</span></div>`:''}${ro?`<div class="kv"><span>Round off</span><span>${ro>0?'+':'−'}${invInr(Math.abs(ro))}</span></div>`:''}${more?`<div class="kv"><span>Comes to</span><span>${invInr(due)}</span></div>`:''}
 ${bill?`<div class="kv"><span>Supplier bill</span><span>${inr(bill)}</span></div><div class="kv"><span>Difference</span><span style="color:${Math.abs(bill-due)<1?'var(--g)':'var(--r)'}">${Math.abs(bill-due)<1?'Matches bill':(due>bill?'+':'−')+inr(Math.abs(bill-due))}</span></div>`:'<div class="cap">Enter the bill amount to check it against the items.</div>'}</div>`;}
/* posting: the bill's MRP (prices follow the Admin % rule), HSN and GST go into the list; the catalogue shows the bill's MRP too */
function bpSetP(p,ch){Object.assign(p,ch);const n=(DB.newProducts||[]).find(x=>x.id===p.id);if(n&&n!==p)Object.assign(n,ch);
 if(!String(p.id).startsWith('n')||(DB.prices||{})[p.id]){DB.prices=DB.prices||{};DB.prices[p.id]=Object.assign({},DB.prices[p.id]||{},ch);}}
function bpApplyItem(it,g){const p=P(it.pid);if(!p)return;const ch={},m=r2(+it.bmrp||0),inv=g.inv||g.id;
 if(m>0&&m!==r2(p.mrp)){const pr=invPrices(m);audit('MRP changed from supplier bill',p.pn,invInr(p.mrp||0),invInr(m)+' · bill '+inv);Object.assign(ch,{mrp:m,price:pr.price,mp:pr.mp});}
 if(/^\d{4,8}$/.test(it.hsn||'')&&String(p.hsn||'')!==String(it.hsn)){audit('HSN changed from supplier bill',p.pn,p.hsn||'—',String(it.hsn));ch.hsn=String(it.hsn);}
 if(it.gst!=null&&it.gst!==''&&BP_GST.includes(+it.gst)&&String(p.gst||'')!==String(+it.gst)){audit('GST changed from supplier bill',p.pn,(p.gst||'—')+'%',+it.gst+'%');ch.gst=String(+it.gst);}
 if(Object.keys(ch).length)bpSetP(p,ch);
 if(m>0){const pk=catPk(p.pn),f=(DB.mrpFix||{})[pk];if(invHits(pk).some(h=>+h.mrp>0&&r2(h.mrp)!==m)||f&&r2(f.m)!==m){(DB.mrpFix=DB.mrpFix||{})[pk]={m,d:isoToday(),b:inv};catMrpLive(pk,m);}}}
function bpPostFx(g){(g.items||[]).forEach(it=>bpApplyItem(it,g));
 const s=sups().find(x=>x.n===g.supplier);if(s&&g.gstin&&!/^[0-9A-Z]{15}$/.test(s.gst||''))s.gst=g.gstin;
 if(!g.bdate)g.bdate=ddmmm2iso(g.date);g.iso=isoToday();g.pays=g.pays||[];}
function catMrpFix(pn,m){const F=typeof DB!=='undefined'&&DB&&DB.mrpFix;if(!F)return m;const f=F[catPk(pn)];return f&&+f.m>0?+f.m:m;}
function catMrpLive(pk,m){try{CAT_ALL.forEach(e=>{if(e.st===2)catPkRows(e.vb,pk).forEach(r=>{r.mrp=m;});});INV_LK.delete(pk);}catch(e){}}
/* -- supplier bills to pay (Sam 20:16Z-20:22Z): each posted bill is in its supplier's list, paid in parts or at once; Admin is told
   3 days before the due date, on the day, and every day it is late -- */
const bpAmt=g=>{const b=parseFloat(String(g.billAmt||'').replace(/[^\d.]/g,''));return b>0?r2(b):r2(grnTotal(g)-(+g.bdisc||0)+(+g.tax||0)+(+g.round||0));};
const bpPaid=g=>r2((g.pays||[]).reduce((a,p)=>a+(+p.amt||0),0));
const bpBal=g=>Math.max(0,r2(bpAmt(g)-bpPaid(g)));
const bpDayN=iso=>Math.round(new Date(iso+'T00:00:00').getTime()/864e5);
function bpDueOf(g){const s=sups().find(x=>x.n===g.supplier),days=s&&isFinite(+s.days)?+s.days:30,base=g.bdate||g.iso||ddmmm2iso(g.date),d=new Date(base+'T00:00:00');
 d.setDate(d.getDate()+days);const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return {iso,left:bpDayN(iso)-bpDayN(isoToday()),days};}
function bpStat(g){const bal=bpBal(g);if(bal<=0)return ['Paid','g'];const d=bpDueOf(g),pp=bpPaid(g)>0?'Part paid · ':'';
 if(d.left<0)return [pp+(-d.left)+' day'+(d.left===-1?'':'s')+' late','r'];if(d.left===0)return [pp+'Due today','r'];
 if(d.left<=3)return [pp+'Due in '+d.left+' day'+(d.left===1?'':'s'),'a'];return [pp+'Due '+fmtD(d.iso),''];}
const supBills=n=>(DB.grns||[]).filter(g=>g.status==='posted'&&g.supplier===n);
const supOut=s=>r2(supBills(s.n).reduce((a,g)=>a+bpBal(g),0)+(+s.pay||0));
function supAlerts(){const out=[];(DB.grns||[]).forEach(g=>{if(g.status!=='posted')return;const bal=bpBal(g);if(!(bal>0))return;const d=bpDueOf(g);if(d.left<=3)out.push({g,bal,left:d.left,iso:d.iso});});return out.sort((a,b)=>a.left-b.left);}
function supBellOn(){if(S.user&&S.user.role==='admin'&&supAlerts().length){go('supdue');return;}toast('No new notifications');}
const supBellDot=c=>{if(!S.user||S.user.role!=='admin')return '';const n=supAlerts().length;return n?`<span class="${c}">${n}</span>`:'';};
function supDueCard(){const al=supAlerts();if(!al.length)return '';const late=al.filter(a=>a.left<0).length,tod=al.filter(a=>a.left===0).length,soon=al.length-late-tod,amt=al.reduce((s,a)=>s+a.bal,0);
 return `<button class="card sup-due ${late||tod?'r':''}" style="text-align:left" onclick="go('supdue')"><div class="row"><div class="tile ${late||tod?'r':'a'}">${ic('bell','s20')}</div><div class="grow"><div class="h3">Supplier bills to pay · ${inr(amt)}</div><div class="cap">${[late?late+' late':'',tod?tod+' due today':'',soon?soon+' due in 3 days':''].filter(Boolean).join(' · ')}</div></div>${ic('chevR','s18')}</div></button>`;}
const supBillCard=g=>{const a=bpAmt(g),bal=bpBal(g),pd=bpPaid(g),st=bpStat(g),bd=g.bdate||g.iso||ddmmm2iso(g.date);
 return `<div class="card sup-b"><div class="row top"><div class="grow"><div class="h3">Bill ${esc(g.inv||g.id)} <button class="link" onclick="go('grnview',{id:'${esc(m2Q(g.id))}'})">View</button></div>
  <div class="cap">${esc(fmtD(bd))} · ${esc(g.id)} · ${(g.items||[]).length+(g.wait||[]).length} item${(g.items||[]).length+(g.wait||[]).length===1?'':'s'}</div></div><b class="num">${invInr(a)}</b></div>
  <div class="row" style="justify-content:space-between;gap:8px"><span class="pill ${st[1]}">${esc(st[0])}</span>${bal>0?`<button class="btn sm" onclick="supPaySheet('${esc(m2Q(g.id))}')">${ic('rupee','s16')} Pay</button>`:''}</div>
  ${pd>0&&bal>0?`<div class="cap">Paid ${invInr(pd)} · balance ${invInr(bal)}</div>`:''}</div>`;};
SCREENS.asupp=()=>{const l=sups(),q=(S.ui.spq||'').toLowerCase(),f=l.filter(s=>(s.n+s.cat+(s.gst||'')).toLowerCase().includes(q)),out=r2(l.reduce((a,s)=>a+supOut(s),0)),al=supAlerts(),late=al.filter(a=>a.left<=0).length;
 return bar('Suppliers',{action:`<button class="iconbtn" onclick="supAdd()" aria-label="Add supplier">${ic('plus','s20')}</button>`})+`<div class="scroll"><div class="pad">
 <div class="grid2">${tileBtn('r','We owe suppliers',inr(out),l.filter(s=>supOut(s)>0).length+' supplier'+(l.filter(s=>supOut(s)>0).length===1?'':'s'),"go('supdue')")}${tileBtn(late?'r':al.length?'a':'g','To pay in 3 days',String(al.length)+' bill'+(al.length===1?'':'s'),late?late+' due or late':al.length?'pay soon':'nothing due',"go('supdue')")}</div>
 <label class="search" for="spq">${ic('search','s20')}<input id="spq" placeholder="Supplier, category or GSTIN" value="${esc(S.ui.spq||'')}" onchange="S.ui.spq=this.value;refresh()"></label>
 <div class="stack" style="gap:10px">${f.length?f.map(s=>{const o=supOut(s),bl=supBills(s.n),un=bl.filter(g=>bpBal(g)>0),nx=un.map(bpDueOf).sort((a,b)=>a.left-b.left)[0];
  return `<button class="card" style="text-align:left;gap:8px" onclick="supView('${esc(m2Q(s.n))}')"><div class="row"><div class="tile ${nx&&nx.left<0?'r':o>0?'a':'g'}">${ic('truck','s20')}</div><div class="grow"><div class="h3">${esc(s.n)}</div><div class="cap">${esc(s.cat||'General')} · pays in ${s.days} days${/^[0-9A-Z]{15}$/.test(s.gst||'')?' · '+esc(s.gst):''}</div></div>${ic('chevR','s18')}</div>
  <div class="grid3" style="gap:6px">${[['Outstanding',o>0?inr(o):'Nil'],['Unpaid bills',String(un.length)],['Next due',nx?(nx.left<0?(-nx.left)+'d late':nx.left===0?'Today':'in '+nx.left+'d'):'—']].map(([k,v])=>`<div style="background:var(--paper);border-radius:10px;padding:7px;text-align:center"><div style="font-weight:800;font-size:13px">${v}</div><div class="cap" style="font-size:10px">${k}</div></div>`).join('')}</div></button>`;}).join(''):`<div class="empty">${l.length?'No supplier matches.':'No suppliers yet. A supplier is added when you post its first bill in Stock in, or with +.'}</div>`}</div>
</div></div>`;};
function supView(n){go('supbills',{n});}
SCREENS.supbills=p=>{const s=sups().find(x=>x.n===p.n);if(!s)return bar('Supplier')+'<div class="scroll"><div class="pad"><div class="empty">This supplier is not in the list any more.</div></div></div>';
 const all=supBills(s.n).sort((a,b)=>String(b.bdate||b.iso||'').localeCompare(String(a.bdate||a.iso||''))),fl=S.ui.sbf||'all',L=all.filter(g=>fl==='all'||(fl==='due'?bpBal(g)>0:bpBal(g)<=0)),out=supOut(s),dn=(DB.sret||[]).filter(d=>d.sup===s.n),qn=esc(m2Q(s.n));
 return bar(s.n)+`<div class="scroll"><div class="pad">
 <div class="card"><div class="kv big"><span>Outstanding</span><span style="color:${out>0?'var(--r)':'var(--g)'}">${inr(out)}</span></div>
  <div class="kv"><span>Pays in</span><span>${s.days} days after the bill date <button class="link" onclick="supDaysSheet('${qn}')">Change</button></span></div>
  <div class="kv"><span>GSTIN</span><span class="num">${esc(s.gst||'—')}</span></div><div class="kv"><span>Contact</span><span>${esc(s.c||'—')}</span></div>
  ${+s.pay>0?`<div class="kv"><span>Old balance (before bills)</span><span>${inr(s.pay)} <button class="link" onclick="supPay('${qn}')">Mark paid</button></span></div>`:''}
  ${dn.length?`<div class="cap">${dn.length} debit note${dn.length>1?'s':''} · ${inr(dn.reduce((a,d)=>a+(+d.amt||0),0))}</div>`:''}</div>
 <div class="chips">${[['all','All ('+all.length+')'],['due','Unpaid ('+all.filter(g=>bpBal(g)>0).length+')'],['paid','Paid']].map(([k,t])=>`<button class="chip ${fl===k?'on':''}" onclick="S.ui.sbf='${k}';refresh()">${t}</button>`).join('')}</div>
 ${L.length?L.map(supBillCard).join(''):`<div class="empty">${all.length?'No bills here.':'No bills yet. A bill comes here when its Stock in is posted.'}</div>`}
</div></div>`;};
SCREENS.supdue=()=>{const L=(DB.grns||[]).filter(g=>g.status==='posted'&&bpBal(g)>0).map(g=>({g,d:bpDueOf(g)})).sort((a,b)=>a.d.left-b.d.left),grp=[['Late',x=>x.d.left<0],['Due today',x=>x.d.left===0],['Due in 3 days',x=>x.d.left>0&&x.d.left<=3],['Later',x=>x.d.left>3]],tot=r2(L.reduce((a,x)=>a+bpBal(x.g),0));
 return bar('Supplier bills to pay')+`<div class="scroll"><div class="pad">
 <div class="card"><div class="kv big"><span>We owe suppliers</span><span style="color:${tot>0?'var(--r)':'var(--g)'}">${inr(tot)}</span></div><div class="cap">${L.length} unpaid bill${L.length===1?'':'s'}. Payment days are set per supplier (Suppliers › a supplier › Change).</div></div>
 ${L.length?grp.map(([t,f])=>{const x=L.filter(f);return x.length?sec(t+' ('+x.length+')')+x.map(y=>`<div class="stack" style="gap:4px"><div class="cap"><b>${esc(y.g.supplier)}</b></div>${supBillCard(y.g)}</div>`).join(''):'';}).join(''):'<div class="empty">No supplier bills to pay.</div>'}
</div></div>`;};
function supPaySheet(id){const g=(DB.grns||[]).find(x=>x.id===id);if(!g)return;const bal=bpBal(g);S.ui.spm=S.ui.spm||'UPI';
 sheet(`<h3 class="h2">Pay bill ${esc(g.inv||g.id)}</h3><div class="cap">${esc(g.supplier)} · bill ${invInr(bpAmt(g))} · balance ${invInr(bal)}</div>
 <div class="grid2"><div class="field"><label for="spy-a">Amount paid</label><div class="inp"><b>₹</b><input id="spy-a" inputmode="decimal" value="${bal}"></div></div>
 <div class="field"><label for="spy-d">Date</label><div class="inp"><input id="spy-d" type="date" value="${isoToday()}" max="${isoToday()}"></div></div></div>
 <div class="field"><label>Paid by</label><div class="chips">${['Cash','UPI','Bank','Cheque'].map(m=>`<button class="chip ${S.ui.spm===m?'on':''}" onclick="S.ui.spm='${m}';this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===this))">${m}</button>`).join('')}</div></div>
 <div class="field"><label for="spy-r">Reference</label><div class="inp"><input id="spy-r" placeholder="UTR or cheque no. (optional)"></div></div>
 <div class="errmsg" id="spy-e"></div>
 <button class="btn" onclick="supPaySave('${esc(m2Q(id))}')">Save payment</button>`);}
function supPaySave(id){const g=(DB.grns||[]).find(x=>x.id===id);if(!g)return;const bal=bpBal(g),v=k=>(document.getElementById(k)||{}).value||'',e=document.getElementById('spy-e');
 const a=r2(parseFloat(v('spy-a').replace(/[^\d.]/g,''))||0),d=/^\d{4}-\d{2}-\d{2}$/.test(v('spy-d'))?v('spy-d'):isoToday(),mode=S.ui.spm||'UPI';
 if(!(a>0)){e.textContent='Enter the amount paid.';return;}if(a>bal+.5){e.textContent='That is more than the balance ('+invInr(bal)+').';return;}
 (g.pays=g.pays||[]).push({id:'P'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),amt:a,d,mode,ref:v('spy-r').trim().slice(0,40),by:S.user.sid,at:isoToday()});
 audit('Supplier bill paid',g.supplier+' · bill '+(g.inv||g.id),invInr(bal),invInr(Math.max(0,r2(bal-a)))+' left · '+mode);save();closeSheet();toast(bpBal(g)>0?'Part payment saved':'Bill paid');refresh();}
function supDaysSheet(n){const s=sups().find(x=>x.n===n);if(!s)return;sheet(`<h3 class="h2">Payment days</h3><p class="cap">${esc(s.n)} is paid this many days after the bill date. Admin is told 3 days before, on the day, and every day it is late.</p>
 <div class="field"><label for="sdy">Days</label><div class="inp"><input id="sdy" inputmode="numeric" value="${esc(s.days)}"></div></div><div class="errmsg" id="sdy-e"></div><button class="btn" onclick="supDaysSave('${esc(m2Q(n))}')">Save</button>`);}
function supDaysSave(n){const s=sups().find(x=>x.n===n);if(!s)return;const v=parseInt((document.getElementById('sdy')||{}).value,10);if(!(v>=0&&v<=365)){document.getElementById('sdy-e').textContent='Enter 0 to 365 days.';return;}
 if(v!==+s.days)audit('Supplier payment days',s.n,s.days+' days',v+' days');s.days=v;save();closeSheet();toast('Payment days saved');refresh();}
/* View: what the bill brought, at what rate and discount, and what is paid */
SCREENS.grnview=p=>{const g=(DB.grns||[]).find(x=>x.id===p.id);if(!g)return bar('Bill')+'<div class="scroll"><div class="pad"><div class="empty">This bill is not here any more.</div></div></div>';
 const adm=allowed('supbills'),posted=g.status==='posted',amt=bpAmt(g),pd=bpPaid(g),bal=bpBal(g),st=posted?bpStat(g):null,due=posted?bpDueOf(g):null,tot=grnTotal(g);
 const kv=(k,v)=>`<div class="kv"><span>${k}</span><span>${v}</span></div>`;
 const line=it=>{const x=P(it.pid),net=+it.rate||0,disc=+it.disc>0?+it.disc:0,cd=!disc&&+it.bmrp>0&&it.gst!=null&&net>0?bpCalcDisc(net,+it.bmrp,+it.gst):0;
  const info=[+it.bmrp>0?'MRP '+invInr(it.bmrp):'',disc?'Disc '+bpQ(disc)+'%':cd>0?'Disc '+cd+'% (calculated from MRP)':'',it.hsn?'HSN '+esc(it.hsn):'',it.gst!=null&&it.gst!==''?'GST '+bpQ(it.gst)+'%':''].filter(Boolean).join(' · ');
  return `<div class="li bp-vl"><div class="tile sm n">${ic(x?x.ic:'package','s18')}</div><div class="grow"><div class="t">${esc(x?x.name:it.pid)}</div><div class="s">${esc(x?x.pn:'')} · ${bpQ(it.q)} × ${invInr(net)}${disc?' (rate '+invInr(it.lr||net)+' less '+bpQ(disc)+'%)':''}${it.exp!=null&&+it.q!==+it.exp?' · ordered '+it.exp:''}</div>${info?`<div class="s bp-i">${info}</div>`:''}</div><b class="num">${invInr(r2((+it.q||0)*net))}</b></div>`;};
 return bar('Bill '+(g.inv||g.id))+`<div class="scroll"><div class="pad">
 <div class="card">${kv('Supplier',adm&&sups().some(s=>s.n===g.supplier)?`<button class="link" onclick="go('supbills',{n:'${esc(m2Q(g.supplier))}'})">${esc(g.supplier)}</button>`:esc(g.supplier))}${g.gstin?kv('GSTIN',`<span class="num">${esc(g.gstin)}</span>`):''}${kv('Bill no.',esc(g.inv||'—'))}${g.bdate?kv('Bill date',esc(fmtD(g.bdate))):''}${kv('Received',esc(g.date||''))}${kv('Stock in',esc(g.id)+(posted?' · posted '+esc(g.postedAt||''):' · not posted yet'))}
  ${posted?kv('Pay by',esc(fmtD(due.iso))+` <span class="pill ${st[1]}">${esc(st[0])}</span>`):''}</div>
 ${sec('Parts ('+((g.items||[]).length+(g.wait||[]).length)+')')}
 <div class="card flush">${(g.items||[]).map(line).join('')}${(g.wait||[]).map(w=>li(esc(w.name||w.pn),`${esc(w.pn)} · ${bpQ(w.q)} × ${invInr(w.rate)}`,'<span class="pill a">Waiting for photos</span>','camera',`S.ui.iw='${w.wid}';go('invwait')`,'y')).join('')}${(g.nw||[]).map(n=>li(esc(n.name||n.pn),`${esc(n.pn)} · ${bpQ(n.q)} × ${invInr(n.rate)}`,'<span class="pill a">New part</span>','package','','n')).join('')}</div>
 <div class="card">${kv('Items',invInr(tot))}${+g.bdisc>0?kv('Bill discount','−'+invInr(g.bdisc)):''}${+g.tax>0?kv('GST',invInr(g.tax)):''}${+g.round?kv('Round off',(+g.round>0?'+':'−')+invInr(Math.abs(+g.round))):''}
  <div class="kv big"><span>Bill amount</span><span>${invInr(amt)}</span></div>
  ${posted?kv('Paid',invInr(pd))+`<div class="kv big"><span>Balance</span><span style="color:${bal>0?'var(--r)':'var(--g)'}">${invInr(bal)}</span></div>`:''}
  ${g.note?`<div class="cap">Remarks: ${esc(g.note)}</div>`:''}</div>
 ${posted&&(g.pays||[]).length?sec('Payments')+`<div class="card flush">${g.pays.map(y=>li(invInr(y.amt),`${esc(fmtD(y.d))} · ${esc(y.mode||'')}${y.ref?' · '+esc(y.ref):''}`,'','rupee','','g')).join('')}</div>`:''}
 ${posted&&adm&&bal>0?`<button class="btn" onclick="supPaySheet('${esc(m2Q(g.id))}')">${ic('rupee','s18')} Record a payment</button>`:''}
</div></div>`;};
/* -- the phone's bottom menu stays on every page (not where the page has its own buttons at the bottom), and moves with a little bounce -- */
const NAV_HIDE=['invdoc','photofind','chat','qr'];
function navIdx(navs,s,html){const i=navs.findIndex(n=>n[0]===s);if(i>-1)return i;
 if(NAV_PRE.includes(s)||NAV_HIDE.includes(s)||/class="foot"|darkscr/.test(html))return -1;
 for(const e of S.stack){const j=navs.findIndex(n=>n[0]===e.s);if(j>-1)return j;}return 0;}
function navHTML(navs,idx,from){const mv=from!=null&&from>-1&&from!==idx;
 return `<nav class="nav${from==null||from<0?' rise':''}" style="--i:${mv?from:idx}" data-to="${idx}" aria-label="Main">
 <div class="bubble" aria-hidden="true">${ic(navs[idx][2],'s')}</div>
 ${navs.map((n,i)=>`<button class="${i===idx?'on':''}" onclick="tab('${n[0]}')" aria-label="${n[1]}"${i===idx?' aria-current="page"':''}>${ic(n[2],'s20')}<span>${n[1]}</span></button>`).join('')}</nav>`;}
function navMove(){const n=document.querySelector('#vp .nav[data-to]');if(!n)return;const to=n.dataset.to;if(n.style.getPropertyValue('--i').trim()===to)return;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{n.style.setProperty('--i',to);n.classList.add('go');}));}
