"""Sam 2026-10-11 18:56Z (screenshot of Paste supplier bill): "yahan pe ek camera ka option ho jisse invoice ka photo nikal sakein aur
usse system read karle aur jis jis ka details nhi mila aur jo kuch details mila sabhi bataye aur o jo invoice ka photo tha usko sytem me
save nhi karni he". Decision 18:59Z: "Phone, free" (the phone reads the bill itself; not a paid AI).

- "Photo of the bill" on Paste supplier bill: the camera or a photo from the gallery.
- The phone reads it (Tesseract OCR in the browser, files from our own site: public/vendor/ocr). The photo never leaves the phone and is
  never kept: it is read from memory and dropped (no upload, nothing saved, nothing in the database).
- The bill is cut out of the photo, evened out (shadows), turned straight and its ruled lines taken out, then read as rows.
- Each row with a part number becomes a line "PART-NO qty rate" in the Pasted box (qty x rate = amount picks qty and rate; HSN codes,
  GSTIN, dates, phone numbers and totals are never taken for parts). The existing check then shows every line: in your list / new from a
  catalogue / not found. A number the catalogues do not have is matched to the nearest catalogue or list number the photo could have
  been misread from (O/0, I/1, S/5, B/8, Z/2 ...); each correction is listed. Item rows without a part number are listed too.
- Printed bills read well; handwritten bills do not (told Sam on the decision card).
"""

OCRJS = r"""
/* ---- bill photo reader (Sam 18:56Z; "Phone, free" 18:59Z): the phone reads the bill, the photo is never sent or kept ---- */
let OCR_LIB=null,OCR_READY=0;
const ocrAbs=p=>new URL(p,document.baseURI).href;
function ocrLib(){return OCR_LIB||(OCR_LIB=new Promise((ok,no)=>{if(window.Tesseract)return ok(window.Tesseract);const s=document.createElement('script');s.src=ocrAbs('vendor/ocr/tesseract.min.js');
 s.onload=()=>ok(window.Tesseract);s.onerror=()=>{OCR_LIB=null;s.remove();no(new Error('The reader could not load. Check the internet and try again.'));};document.head.appendChild(s);}));}
async function ocrWorker(logger){const T=await ocrLib();
 const w=await T.createWorker('eng',1,{workerPath:ocrAbs('vendor/ocr/worker.min.js'),corePath:ocrAbs('vendor/ocr/'),langPath:ocrAbs('vendor/ocr'),gzip:true,logger});
 await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});OCR_READY=1;return w;}
/* the photo for the reader: the bill cut out of it (bigger letters), grey, shadows evened out, turned straight, ruled lines taken out */
async function ocrPrep(src){
 const im=new Image();im.src=src;await im.decode();
 const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},IW=im.naturalWidth,IH=im.naturalHeight;
 // 0. where the writing is (a small copy)
 const f0=Math.min(1,800/Math.max(IW,IH)),w0=Math.max(1,Math.round(IW*f0)),h0=Math.max(1,Math.round(IH*f0)),c0=cv(w0,h0),x0=c0.getContext('2d',{willReadFrequently:true});x0.drawImage(im,0,0,w0,h0);
 const t0=cv(Math.max(4,w0>>4),Math.max(4,h0>>4)),tx=t0.getContext('2d');tx.drawImage(c0,0,0,t0.width,t0.height);const u0=cv(w0,h0),ux=u0.getContext('2d',{willReadFrequently:true});ux.drawImage(t0,0,0,w0,h0);
 const p0=x0.getImageData(0,0,w0,h0).data,b0=ux.getImageData(0,0,w0,h0).data,xs=[],ys=[];
 for(let y=0,i=0;y<h0;y++)for(let X=0;X<w0;X++,i+=4){const v=.299*p0[i]+.587*p0[i+1]+.114*p0[i+2],B=.299*b0[i]+.587*b0[i+1]+.114*b0[i+2];if(v<B*.7&&B>60){xs.push(X);ys.push(y);}}
 let cx0=0,cy0=0,cx1=IW,cy1=IH;
 if(xs.length>200){xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);const q=(a,t)=>a[Math.min(a.length-1,Math.max(0,Math.round(t*(a.length-1))))],m=.03*Math.max(w0,h0);
  cx0=Math.max(0,(q(xs,.005)-m)/f0);cy0=Math.max(0,(q(ys,.005)-m)/f0);cx1=Math.min(IW,(q(xs,.995)+m)/f0);cy1=Math.min(IH,(q(ys,.995)+m)/f0);}
 c0.width=c0.height=t0.width=t0.height=u0.width=u0.height=0;
 const k=Math.min(2,2600/Math.max(cx1-cx0,cy1-cy0)),W=Math.max(1,Math.round((cx1-cx0)*k)),H=Math.max(1,Math.round((cy1-cy0)*k));
 const c=cv(W,H),x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(im,cx0,cy0,cx1-cx0,cy1-cy0,0,0,W,H);im.src='';
 // 1. the paper's own brightness round each spot (a tiny copy drawn back up): light falling across the bill, a shadow
 const sw=Math.max(8,Math.round(W/48)),sh=Math.max(8,Math.round(H/48)),s=cv(sw,sh),sx=s.getContext('2d');sx.imageSmoothingQuality='high';sx.drawImage(c,0,0,sw,sh);
 const g=cv(W,H),gx=g.getContext('2d',{willReadFrequently:true});gx.imageSmoothingQuality='high';gx.drawImage(s,0,0,W,H);
 const d=x.getImageData(0,0,W,H),p=d.data,bg=gx.getImageData(0,0,W,H).data,L=new Uint8ClampedArray(W*H);
 for(let i=0,j=0;i<p.length;i+=4,j++){const v=.299*p[i]+.587*p[i+1]+.114*p[i+2],B=.299*bg[i]+.587*bg[i+1]+.114*bg[i+2];L[j]=v/Math.max(24,B)*230;}
 s.width=s.height=g.width=g.height=0;
 // 2. how much the bill is turned: the angle where the ink lines up best in rows (-8 to 8 degrees)
 const f=Math.min(1,900/W),w2=Math.round(W*f),h2=Math.round(H*f),ink=[];
 for(let y=0;y<h2;y++)for(let X=0;X<w2;X++){if(L[Math.floor(y/f)*W+Math.floor(X/f)]<150)ink.push(X,y);}
 const score=a=>{const r=a*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r),n=h2+w2,hst=new Float64Array(2*n+2);for(let i=0;i<ink.length;i+=2)hst[Math.round(ink[i+1]*cs-ink[i]*sn)+n]++;let t=0;for(const v of hst)t+=v*v;return t;};
 let best=0,bs=-1;for(let a=-8;a<=8.001;a+=.25){const v=score(a);if(v>bs){bs=v;best=a;}}
 for(let a=best-.25;a<=best+.25;a+=.05){const v=score(a);if(v>bs){bs=v;best=a;}}
 // 3. straight (white where the turn shows nothing)
 const gr=x.createImageData(W,H);for(let j=0,i=0;j<L.length;j++,i+=4){gr.data[i]=gr.data[i+1]=gr.data[i+2]=L[j];gr.data[i+3]=255;}x.putImageData(gr,0,0);
 const o=cv(W,H),ox=o.getContext('2d',{willReadFrequently:true});ox.fillStyle='#fff';ox.fillRect(0,0,W,H);ox.translate(W/2,H/2);ox.rotate(-best*Math.PI/180);ox.drawImage(c,-W/2,-H/2);ox.setTransform(1,0,0,1,0,0);
 c.width=c.height=0;
 // 4. the table's ruled lines go (long straight runs of ink); letters are much shorter
 const od=ox.getImageData(0,0,W,H),q=od.data,dark=i=>q[i*4]<185,run=Math.max(60,Math.round(W/28)),vrun=Math.max(70,Math.round(H/30)),wipe=new Uint8Array(W*H);
 for(let y=0;y<H;y++){let a=0;for(let X=0;X<=W;X++){if(X<W&&dark(y*W+X))continue;if(X-a>=run)for(let t=a;t<X;t++)wipe[y*W+t]=1;a=X+1;}}
 for(let X=0;X<W;X++){let a=0;for(let y=0;y<=H;y++){if(y<H&&dark(y*W+X))continue;if(y-a>=vrun)for(let t=a;t<y;t++)wipe[t*W+X]=1;a=y+1;}}
 for(let j=0;j<W*H;j++)if(wipe[j]){q[j*4]=q[j*4+1]=q[j*4+2]=255;}
 ox.putImageData(od,0,0);return o;}
/* the rows read -> lines "PART-NO qty rate" for the Pasted box, and the item rows that have no part number */
const OCR_SKIP=/\b(sub ?total|grand ?total|total|round(ed)? ?off|cgst|sgst|igst|utgst|cess|gstin|gst no|taxable|invoice|bill no|bill to|ship to|date|phone|mobile|email|bank|ifsc|a\/c|account|amount in words|rupees|signature|authori[sz]ed|terms|declaration|e\.? ?& ?o\.? ?e)\b/i;
const OCR_HSN=/^(2710|3403|3819|3820|3824|3917|3926|4009|4010|4011|4013|4016|6813|7009|7315|7318|7320|7326|8301|8302|8409|8413|8414|8421|8481|8482|8483|8484|8505|8507|8511|8512|8531|8536|8539|8544|8708|8714|9026|9029|9032)(\d{2}|\d{4})?$/;
function ocrPnLike(t){
 if(/\//.test(t)||/%$/.test(t)||/^\d+\.\d{1,2}$/.test(t))return false;   // sizes, dates, percent, money
 if(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(t))return false;     // GSTIN
 const k=catPk(t);if(k.length<5||!/\d/.test(k))return false;
 if(/^\d+$/.test(k)&&(k.length<6||OCR_HSN.test(k)||!/-/.test(t)&&/^[6-9]\d{9}$/.test(k)))return false;   // HSN code, phone number
 return true;}
function ocrParse(text){
 const rows=[],out=[],raw=[];let order='qr',dec=0;
 for(const line0 of String(text||'').split(/\r?\n/)){
  const s=line0.replace(/[|¦\[\]{}()”“"'`~»«_]/g,' ').replace(/[–—]/g,'-').replace(/₹|\bRs\.?(?=\s|\d)/gi,' ').replace(/(\d),(?=\d)/g,'$1').replace(/\s+/g,' ').trim();
  if(!s)continue;
  if(/\b(qty|quantity)\b/i.test(s)&&/\b(rate|price)\b/i.test(s)){order=s.search(/\b(rate|price)\b/i)<s.search(/\b(qty|quantity)\b/i)?'rq':'qr';continue;}
  dec+=(s.match(/\b\d+\.\d{2}\b/g)||[]).length;
  if(OCR_SKIP.test(s))continue;
  const t=s.split(' ').map(w=>w.replace(/^[^\w]+|[^\w.]+$/g,'').replace(/\.$/,'')).filter(Boolean);
  let pi=-1;for(let i=0;i<t.length;i++)if(ocrPnLike(t[i])){pi=i;break;}
  const nums=[];(pi<0?t:t.slice(pi+1)).forEach(w=>{const m=/^(\d+(?:\.\d+)?)(?:pcs?|nos?|no|set|sets|pc|kit|ltrs?|l|mtrs?)?$/i.exec(w);if(m)nums.push(m[1]);});
  if(pi<0||nums.length<2){if(nums.some(n=>/\.\d{2}$/.test(n))&&t.length>=3&&nums.length>=2)raw.push(s);continue;}
  rows.push({pn:t[pi].toUpperCase(),nums});}
 // money written with paise on this bill: a number read without its point (11800) is more likely 118.00
 const pts=dec>=2;
 for(const {pn,nums} of rows){
  const alt=n=>{const v=parseFloat(n),a=[[v,0]];if(!/\./.test(n)){if(n.length>=3)a.push([v/100,pts?-.2:1]);if(n.length>=2)a.push([Math.floor(v/10),1.5]);}return a;};
  let best=null;
  for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)for(let k=j+1;k<nums.length;k++)
   for(const [a,pa] of alt(nums[i]))for(const [b,pb] of alt(nums[j]))for(const [c,pc] of alt(nums[k])){
    const q=order==='qr'?a:b,r=order==='qr'?b:a;
    if(!(q>=1&&q<=9999&&Number.isInteger(q)&&r>0)||Math.abs(q*r-c)>Math.max(.6,c*.012))continue;
    const sc=pa+pb+pc+(k-j-1)*.3+(j-i-1)*.3;if(!best||sc<best.sc)best={q,r,sc};}
  let q=0,rate='';
  if(best){q=best.q;rate=best.r.toFixed(2);}
  else{const qi=nums.findIndex(n=>/^\d{1,4}$/.test(n)&&+n>=1);if(qi>-1){q=+nums[qi];const r=nums.slice(qi+1).find(n=>/\./.test(n))||nums[qi+1];if(r)rate=(+r).toFixed(2);}}
  out.push(pn+' '+(q||1)+(rate?' '+rate:''));}
 return {lines:out,raw};}
/* a number no catalogue has: the nearest number in the list or the loaded catalogues it could have been misread from */
const OCR_EQ=['O0','D0','Q0','I1','L1','T1','B8','S5','Z2','Z7','G6','A4','E8'];
const ocrCost=(a,b)=>a===b?0:OCR_EQ.includes(a+b)||OCR_EQ.includes(b+a)?.3:1;
function ocrDist(a,b,max){const n=a.length,m=b.length;if(Math.abs(n-m)>1)return 99;let p=[],c=[];for(let j=0;j<=m;j++)p[j]=j;
 for(let i=1;i<=n;i++){c=[i];let lo=i;for(let j=1;j<=m;j++){c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+ocrCost(a[i-1],b[j-1]));if(c[j]<lo)lo=c[j];}if(lo>max)return 99;p=c;}return p[m];}
function ocrNear(pk){if(pk.length<6)return null;let best=null,second=99;
 const tryK=(k,pn)=>{if(Math.abs(k.length-pk.length)>1)return;const n=Math.min(k.length,pk.length);let same=0;for(let i=0;i<n;i++)if(k[i]===pk[i])same++;
  if(same<n-3&&k.slice(0,3)!==pk.slice(0,3)&&k.slice(-3)!==pk.slice(-3))return;
  const d=ocrDist(pk,k,1.2);if(d>1.2)return;if(!best||d<best.d){if(best&&best.k!==k)second=Math.min(second,best.d);best={d,k,pn};}else if(k!==best.k)second=Math.min(second,d);};
 PRODUCTS.forEach(p=>{const k=catPk(p.pn);if(k)tryK(k,p.pn);});
 CAT_ALL.forEach(e=>{if(e.st!==2)return;catPkRows(e.vb,'');const m=CAT_PKB&&CAT_PKB.get(e.vb);if(m)m.forEach((rs,k)=>tryK(k,rs[0].part||k));});
 return best&&best.d<=1&&second>best.d+.25?{pn:String(best.pn).toUpperCase(),d:best.d}:null;}
async function invOcr(inp){const f=inp.files&&inp.files[0];inp.value='';if(!f)return;
 const st=S.ui.ip||(S.ui.ip={txt:'',pick:{}}),o=st.ocr={st:'busy',pct:0,msg:'Getting the photo ready…'},show=()=>{if(S.ui.ip===st&&cur().s==='invpaste')invRefresh();};
 show();let url='',w=null;
 try{url=URL.createObjectURL(f);const c=await ocrPrep(url);URL.revokeObjectURL(url);url='';
  o.msg=OCR_READY?'Getting the reader ready…':'Getting the reader ready (first time on this phone, a few MB)…';show();
  w=await ocrWorker(m=>{if(m&&m.status==='recognizing text'){const v=Math.round((m.progress||0)*100);if(v!==o.pct){o.pct=v;o.msg='Reading the bill… '+v+'%';show();}}});
  const r=await w.recognize(c);c.width=c.height=0;
  const P=ocrParse(r.data&&r.data.text);
  if(P.lines.length)st.txt=(st.txt.trim()?st.txt.replace(/\s*$/,'\n'):'')+P.lines.join('\n');
  Object.assign(o,{st:'done',n:P.lines.length,raw:P.raw,fixed:[],lines:P.lines.slice(),chk:0});show();invOcrFix(st,o);
 }catch(e){o.st='err';o.msg=String(e&&e.message||e||'').slice(0,160);show();}
 finally{if(url)URL.revokeObjectURL(url);if(w)Promise.resolve(w.terminate()).catch(()=>{});}}
/* when the catalogues for the lines have loaded: numbers found nowhere are matched to the nearest one they could be misread from */
async function invOcrFix(st,o){const t0=Date.now(),pnOf=l=>l.split(' ')[0];
 while(Date.now()-t0<90000&&o.lines.some(l=>!invFind(pnOf(l))&&invLook(pnOf(l),true).st==='wait')){if(S.ui.ip!==st)return;await new Promise(r=>setTimeout(r,400));}
 if(S.ui.ip!==st)return;let txt=st.txt,ch=0;
 for(const l of o.lines){const pn=pnOf(l);if(invFind(pn)||invLook(pn,true).hits.length)continue;const m=ocrNear(catPk(pn));if(!m||catPk(m.pn)===catPk(pn))continue;
  const re=new RegExp('^'+l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','m');if(!re.test(txt))continue;txt=txt.replace(re,m.pn+l.slice(pn.length));o.fixed.push([pn,m.pn]);ch++;}
 if(ch)st.txt=txt;o.chk=1;if(cur().s==='invpaste')invRefresh();}
function invOcrNote(o){if(!o)return '';
 if(o.st==='busy')return `<div class="inv-ocr"><div class="inv-ocr-bar"><i style="width:${Math.max(4,o.pct||0)}%"></i></div><div class="cap">${esc(o.msg)}</div></div>`;
 if(o.st==='err')return `<div class="inv-ocr no"><b>Could not read the photo</b><div class="cap">${esc(o.msg||'Please try again.')}</div></div>`;
 return `<div class="inv-ocr ${o.n?'ok':'no'}"><b>${o.n?`Read from the photo: ${o.n} line${o.n>1?'s':''} with a part number`:'No part number found in the photo'}</b>
  <div class="cap">${o.n?'Check each line against the bill and fix any mistake in the box below.':'Take it again: the whole bill, flat, close, in good light.'} The photo is not saved.</div>
  ${o.fixed.length?`<div class="cap"><b>Corrected from the catalogues:</b></div><pre>${o.fixed.map(([a,b])=>esc(a)+' → '+esc(b)).join('\n')}</pre>`:''}
  ${o.raw.length?`<div class="cap"><b>${o.raw.length} item line${o.raw.length>1?'s':''} without a part number</b> (add by hand):</div><pre>${o.raw.map(esc).join('\n')}</pre>`:''}
  ${o.n&&!o.chk?'<div class="cap">Checking the part numbers in the catalogues…</div>':''}</div>`;}
"""

OCRCSS = r"""
/* ---- bill photo reader ---- */
.inv-ocr-b{position:relative;width:100%;justify-content:center;gap:8px;overflow:hidden}
.inv-ocr-b input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.inv-ocr-b.dis{opacity:.5;pointer-events:none}
.inv-ocr{border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;min-width:0}
.inv-ocr.ok{border-color:var(--g)}
.inv-ocr.no{border-color:var(--r)}
.inv-ocr-bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden}
.inv-ocr-bar i{display:block;height:100%;background:var(--y);transition:width .2s}
.inv-ocr pre{margin:0;white-space:pre-wrap;word-break:break-word;font:500 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink7)}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'billocr.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    assert '123456' not in OCRJS + OCRCSS
    # the reader's code next to the paste screen, its look next to the inventory look
    sub("function invPasteAdd(all){", OCRJS.strip() + "\nfunction invPasteAdd(all){")
    sub("/* ---- inventory (update 8): phone stacks, website two columns ---- */", OCRCSS.strip() + "\n/* ---- inventory (update 8): phone stacks, website two columns ---- */")
    # Paste supplier bill: "Photo of the bill" above the box, what was read under it
    sub(" <p class=\"cap\">Copy the lines from the supplier’s Excel sheet or WhatsApp message and paste them here. Each line is checked against your list and all catalogues.</p>",
        " <p class=\"cap\">Take a photo of the printed bill, or copy the lines from the supplier’s Excel sheet or WhatsApp message and paste them here. Each line is checked against your list and all catalogues.</p>")
    sub("<button class=\"link\" onclick=\"S.ui.ip.txt='';S.ui.ip.pick={};refresh()\">Clear</button>`:''}</div>\n  <textarea id=\"ip-ta\"",
        "<button class=\"link\" onclick=\"S.ui.ip.txt='';S.ui.ip.pick={};S.ui.ip.ocr=null;refresh()\">Clear</button>`:''}</div>\n"
        "  <label class=\"btn line inv-ocr-b${st.ocr&&st.ocr.st==='busy'?' dis':''}\">${ic('camera','s18')} Photo of the bill<input type=\"file\" accept=\"image/*\" aria-label=\"Photo of the bill\" onchange=\"invOcr(this)\"${st.ocr&&st.ocr.st==='busy'?' disabled':''}></label>\n"
        "  ${invOcrNote(st.ocr)}\n  <textarea id=\"ip-ta\"")
    return a, n
