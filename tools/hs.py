"""The numbers on a catalogue diagram are clickable (update 8r). Sam 2026-10-12 10:06Z "diagram pe jo numbers he 1,2,3,4,5,6,7, sabhi
number clickable he me koi bhi number pe click karta hun toh mujhe o number ka part pe focus jaata he", 10:39Z "mera AI 100% karna he kaam".

Where each number sits:
- Bajaj and Suzuki books: the PDF page's own text (exact), read while pdf.js draws the page. A table's numbers and other print sizes
  (page number, titles) are left out. A scanned page (no number text) goes to the AI like a picture.
- Every other diagram (Hero, Honda, Yamaha, RE, TVS, KTM, Husqvarna pictures): the server's AI reads it once, the first time staff open
  it (/api/dghot, ai/billread.mjs readNums), and keeps the numbers.
- Admin can place a number the AI missed with one tap, or take a wrong one away; that is kept on the server too.

On the part page (tools/fp3.py: M3[key] = the diagram's rows, m3Pick(i) selects one): hovering a number shows the part's name, number
and MRP; clicking it selects that part in the list. Hovering a row lights its number up. The full-screen diagram has the numbers too.
"""

HSJS = r"""
/* ---------- the diagram's numbers, clickable (update 8r) ---------- */
/* Bajaj / Suzuki book pages: the numbers printed in the page's own text -> [[text, x0, y0, x1, y1]] in fractions of the drawn part */
const PDF_TXT={},HS_RE=/^[A-Z]?\d{1,3}[A-Z]?(?:-\d{1,2})?$/;
async function pdfNums(pg,vp,W,H){const tc=await pg.getTextContent(),U=window.pdfjsLib.Util;const it=[];
 for(const o of tc.items){const s=String(o.str||'').trim();if(!s)continue;const t=U.transform(vp.transform,o.transform);
  const fh=Math.hypot(t[2],t[3]),fw=Math.hypot(t[0],t[1])||1;if(Math.abs(t[1])>Math.abs(t[0])*0.3)continue;
  const len=(o.width||0)*vp.scale*(t[0]<0?-1:1);it.push({s,x0:t[4],x1:t[4]+len,y0:t[5]-fh*0.8,y1:t[5]+fh*0.08,h:fh});}
 const nums=[],words=[];
 for(const o of it){const parts=o.s.split(/[\s\/]+/).filter(Boolean),L=o.s.length;let at=0,all=true;const got=[];
  for(const p of parts){const i=o.s.indexOf(p,at);at=i+p.length;const t=p.toUpperCase();if(!HS_RE.test(t)){all=false;continue;}
   got.push({t,x0:o.x0+(o.x1-o.x0)*i/L,x1:o.x0+(o.x1-o.x0)*(i+p.length)/L,y0:o.y0,y1:o.y1,h:o.h});}
  if(all&&got.length)nums.push(...got);else if(/[A-Za-z]{2}|\d{4}/.test(o.s))words.push(o);}
 /* only the drawn part, and not a table's numbers (a name or part number on the same line) */
 const c=nums.filter(n=>n.x0>=0&&n.y0>=0&&n.x1<=W&&n.y1<=H&&!words.some(w=>Math.abs((w.y0+w.y1)/2-(n.y0+n.y1)/2)<0.5*n.h&&w.x0-n.x1<7*n.h&&n.x0-w.x1<7*n.h));
 if(!c.length)return [];
 /* callouts share one print size: the page number and titles do not */
 const hc={};c.forEach(n=>{const k=Math.round(n.h);hc[k]=(hc[k]||0)+1;});const hm=+Object.keys(hc).sort((a,b)=>hc[b]-hc[a])[0];
 return c.filter(n=>Math.abs(n.h-hm)<=0.22*hm).map(n=>[n.t,n.x0/W,n.y0/H,n.x1/W,n.y1/H].map((v,i)=>i?Math.round(v*1e4)/1e4:v));}
/* the numbers of one diagram: the page's text, else what the server's AI read (asked once per diagram), with Admin's fixes */
const HSC={};
const hsApi=(u,q,o)=>fetch('/api/dghot?u='+encodeURIComponent(u)+q,Object.assign({credentials:'same-origin'},o||{})).then(r=>r.ok?r.json():r.status===404?{toks:null,ed:[],nf:1}:r.json().then(d=>Promise.reject(d),()=>Promise.reject({error:r.status})));
function hsGet(u,refs){if(HSC[u])return HSC[u];const p=(async()=>{
  if(u.startsWith('pdf:')){const tx=PDF_TXT[u]||[],have=new Set(tx.map(t=>t[0])),need=refs.filter(r=>/^\d/.test(r));
   if(tx.length&&need.filter(r=>have.has(r)).length>=Math.max(1,need.length*0.5)){const e=await hsApi(u,'&ocr=0');return {toks:tx,ed:e.ed||[],src:'pdf'};}
   let e=await hsApi(u,'&ocr=1');
   if(e.need==='img'){const b=await (await fetch(await catPf(u))).blob();e=await hsApi(u,'&ocr=1',{method:'POST',body:b,headers:{'Content-Type':b.type||'image/png'}});}
   return {toks:(e.toks||[]).concat(tx),lo:e.lo||[],ed:e.ed||[],src:'ai',off:e.off};}
  const e=await hsApi(u,'&ocr=1');return {toks:e.toks||[],lo:e.lo||[],ed:e.ed||[],src:'ai',off:e.off,nf:e.nf};})();
 HSC[u]=p;p.then(d=>{if(d.off==='busy')setTimeout(()=>{if(HSC[u]===p)delete HSC[u];},15000);},()=>{delete HSC[u];});return p;}
const hsNorm=r=>String(r||'').toUpperCase().replace(/\s+/g,'');
/* the AI's unsure readings: one is taken only for a number of this diagram's list that is not found yet (the surest of them) */
function hsLo(d,refs){if(!d||!(d.lo||[]).length)return d;const R=new Set(refs);refs.forEach(r=>{const m=/^(\d+)(?:[A-Z]|-\d+)$/.exec(r);if(m)R.add(m[1]);});
 const have=new Set((d.toks||[]).map(t=>hsNorm(t[0]))),add=[];
 for(const t of d.lo){const r=hsNorm(t[0]);if(R.has(r)&&!have.has(r)){have.add(r);add.push(t);}}
 return add.length?Object.assign({},d,{toks:(d.toks||[]).concat(add),lo:[]}):d;}
/* the numbers after Admin's fixes: a placed number is added, a taken-away one is dropped */
function hsList(d){let L=(d.toks||[]).map(t=>({t:hsNorm(t[0]),b:t.slice(1,5)}));
 for(const e of d.ed||[]){if(e.a==='add')L.push({t:hsNorm(e.t),b:e.b,a:1});else if(e.a==='del'){const [x,y]=e.p;L=L.filter(o=>!(x>=o.b[0]-0.004&&x<=o.b[2]+0.004&&y>=o.b[1]-0.004&&y<=o.b[3]+0.004));}}
 return L;}
/* which rows a number on the diagram means: its ref; a ref the diagram prints without its letter or sub-number (12A, 1-1) goes with 12 / 1 */
function hsMap(rows,L){const by=new Map(),add=(k,q)=>{if(!by.has(k))by.set(k,[]);if(!by.get(k).includes(q))by.get(k).push(q);};
 rows.forEach(q=>{const r=hsNorm(q.ref);if(r)add(r,q);});const on=new Set(L.map(o=>o.t));
 rows.forEach(q=>{const r=hsNorm(q.ref),m=/^(\d+)(?:[A-Z]|-\d+)$/.exec(r);if(m&&!on.has(r))add(m[1],q);});return by;}
function hsWire(el){const k=el.dataset.hk,c=M3[k];if(!c)return;const refs=[...new Set(c.rows.map(q=>hsNorm(q.ref)).filter(Boolean))];
 const u=el.dataset.dg;el.classList.add('hs-wait');hsBar(el,'wait');
 hsGet(u,refs).then(d=>{el.classList.remove('hs-wait');if(!el.isConnected)return;el._hs=hsLo(d,refs);hsPaint(el);if(d.off==='busy')setTimeout(()=>{if(el.isConnected)hsWire(el);},16000);},
  ()=>{el.classList.remove('hs-wait');hsBar(el,'fail');});}
function hsPaint(el){const k=el.dataset.hk,c=M3[k],d=el._hs;if(!c||!d)return;el.querySelectorAll('.hs').forEach(x=>x.remove());
 const L=hsList(d),by=hsMap(c.rows,L);const bx=el.dataset.box?el.dataset.box.split(',').map(v=>+v/100):[0,0,1,1],bw=bx[2]-bx[0],bh=bx[3]-bx[1];
 const found=new Set();let h='';
 L.forEach(o=>{const qs=by.get(o.t);const x0=(o.b[0]-bx[0])/bw,y0=(o.b[1]-bx[1])/bh,x1=(o.b[2]-bx[0])/bw,y1=(o.b[3]-bx[1])/bh;if(x1<0||y1<0||x0>1||y0>1)return;
  if(qs)qs.forEach(q=>found.add(q.i));
  h+=`<button type="button" class="hs${qs&&qs.some(q=>q.i===c.sel)?' on':''}${qs?'':' x'}${o.a?' a':''}" data-ref="${esc(o.t)}" style="left:${(x0*100).toFixed(2)}%;top:${(y0*100).toFixed(2)}%;width:${((x1-x0)*100).toFixed(2)}%;height:${((y1-y0)*100).toFixed(2)}%" onclick="hsTap(event,this)" aria-label="Ref ${esc(o.t)}${qs?': '+esc(catNice(qs[0].desc)):''}"></button>`;});
 el.insertAdjacentHTML('beforeend',h);c.found=found;hsRows(k);hsBar(el,'done',L);}
/* the line under the page's diagram: how many parts are on it, Admin's "Fix numbers" */
function hsBar(el,st,L){const w=el.closest('.m3-dgw');if(!w)return;const k=el.dataset.hk,c=M3[k];let b=w.querySelector('.hs-bar');if(!b){b=document.createElement('div');b.className='hs-bar';w.appendChild(b);}
 const adm=S.user&&S.user.role==='admin',ed=S.ui.hsEd===k,d=el._hs||{};
 const n=c?c.rows.filter(q=>q.ref&&c.found&&c.found.has(q.i)).length:0,t=c?c.rows.filter(q=>q.ref).length:0;
 const msg=st==='wait'?'Reading the numbers on this diagram…':st==='fail'?'Could not read the numbers right now.':d.nf?'This diagram’s file is not on the server yet.':d.off&&!(d.toks||[]).length&&!(d.ed||[]).length?(d.off==='busy'?'Reading other diagrams first, numbers in a moment…':'The numbers are not read on this server yet.'):`${n} of ${t} parts are on this diagram`;
 b.innerHTML=`<span class="grow">${esc(msg)}${ed?'. Tap a part in the list, then tap its number on the diagram. Tap a wrong box to take it away.':''}</span>${adm&&st!=='wait'&&!d.nf?`<button class="btn line sm" onclick="hsEdit('${k}')">${ed?'Done':'Fix numbers'}</button>`:''}`;
 const m=el.closest('.m3');if(m)m.classList.toggle('hs-edit',ed);}
/* list rows: a part whose number is not on the diagram says so while Admin fixes numbers */
function hsRows(k){const c=M3[k];if(!c)return;document.querySelectorAll(`.m3[data-k="${k}"] .m3-row`).forEach(r=>{const i=+r.dataset.i;r.classList.toggle('nohs',!!r.dataset.ref&&!!c.found&&!c.found.has(i));});}
/* the chosen part's number lights up (fp3 calls this after every choice) */
function hsSel(k){const c=M3[k];if(!c)return;const q=c.rows.find(x=>x.i===c.sel);const R=new Set();if(q){const r=hsNorm(q.ref);R.add(r);const m=/^(\d+)(?:[A-Z]|-\d+)$/.exec(r);if(m)R.add(m[1]);}
 document.querySelectorAll(`.dg[data-hk="${k}"]`).forEach(el=>{const L=el._hs?hsList(el._hs):[],by=el._hs?hsMap(c.rows,L):new Map();
  el.querySelectorAll('.hs').forEach(b=>{const qs=by.get(b.dataset.ref)||[];b.classList.toggle('on',qs.some(x=>x.i===c.sel));});});}
/* tap a number: its part is chosen (a ref with two lines, colours or editions: the next one each tap); Admin fixing: take it away */
function hsTap(e,b){e.stopPropagation();e.preventDefault();const el=b.closest('[data-hk]'),k=el.dataset.hk,c=M3[k];if(!c)return;
 if(S.ui.hsEd===k){hsAsk(el,b);return;}
 const qs=hsMap(c.rows,hsList(el._hs||{})).get(b.dataset.ref)||[];if(!qs.length)return;const j=qs.findIndex(q=>q.i===c.sel);const q=qs[(j+1)%qs.length];
 m3Pick(q.i,'dg');hsTip(b,1);}
function hsAsk(el,b){const w=el.closest('.m3-dgw')||el.parentElement,bar=w&&w.querySelector('.hs-bar');if(!bar)return;
 const r=el.getBoundingClientRect(),o=b.getBoundingClientRect(),x=(o.left+o.width/2-r.left)/r.width,y=(o.top+o.height/2-r.top)/r.height;
 bar.innerHTML=`<span class="grow">Take number ${esc(b.dataset.ref)} away from here?</span><button class="btn sm" onclick="hsDel('${el.dataset.hk}',${x.toFixed(4)},${y.toFixed(4)})">Take away</button><button class="btn line sm" onclick="hsRepaint('${el.dataset.hk}')">Keep</button>`;}
function hsEdit(k){S.ui.hsEd=S.ui.hsEd===k?null:k;hsRepaint(k);}
function hsRepaint(k){document.querySelectorAll(`.dg[data-hk="${k}"]`).forEach(el=>{if(el._hs)hsPaint(el);else hsBar(el,'wait');});}
const hsSave=(k,body)=>{const el=document.querySelector(`.m3 .dg[data-hk="${k}"]`);if(!el)return;const u=el.dataset.dg;
 return fetch('/api/dghot/edit',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({u},body))}).then(r=>r.json())
  .then(d=>{if(d.error)throw d;const old=el._hs||{};const nd=Object.assign({},old,{ed:d.ed||[]});HSC[u]=Promise.resolve(nd);document.querySelectorAll(`.dg[data-hk="${k}"]`).forEach(x=>{x._hs=nd;hsPaint(x);});})
  .catch(e=>toast((e&&e.error)||'Could not save. Check the connection.'));};
function hsDel(k,x,y){hsSave(k,{del:[x,y]});}
/* Admin fixing: a tap on the diagram puts the chosen part's number there (the size of the numbers already on it) */
document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('.m3 .dg[data-hk]');if(!el||e.target.closest('.hs'))return;const k=el.dataset.hk;if(S.ui.hsEd!==k)return;
 e.stopPropagation();e.preventDefault();const c=M3[k],q=c&&c.rows.find(x=>x.i===c.sel);if(!q||!q.ref){toast('Pick a part with a ref number in the list first');return;}
 const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;const L=el._hs?hsList(el._hs):[];
 const ws=L.map(o=>o.b[2]-o.b[0]).sort((a,b)=>a-b),hs=L.map(o=>o.b[3]-o.b[1]).sort((a,b)=>a-b);const bw=(ws[ws.length>>1]||0.025)*Math.max(1,hsNorm(q.ref).length/1.5),bh=hs[hs.length>>1]||0.03;
 hsSave(k,{add:[hsNorm(q.ref),Math.max(0,x-bw/2),Math.max(0,y-bh/2),Math.min(1,x+bw/2),Math.min(1,y+bh/2)].map((v,i)=>i?Math.round(v*1e4)/1e4:v)});},true);
/* hover: a number shows its part; a row lights its number up */
let HS_T=null;
function hsTip(b,tap){const el=b.closest('[data-hk]'),c=el&&M3[el.dataset.hk];if(!c)return;const qs=hsMap(c.rows,hsList(el._hs||{})).get(b.dataset.ref)||[];
 let t=document.getElementById('hs-tip');if(!t){t=document.createElement('div');t.id='hs-tip';t.setAttribute('role','tooltip');document.body.appendChild(t);}
 if(!qs.length){t.hidden=true;return;}
 t.innerHTML=qs.slice(0,3).map(q=>`<div><b>${esc(q.ref)}</b> ${esc(catNice(q.desc))}${q.qty>1?' ×'+esc(q.qty):''}<br><span class="num">${esc(q.part||'No part number')}</span>${q.mrp?' · '+inr(q.mrp):''}</div>`).join('')+(qs.length>3?`<div>+${qs.length-3} more</div>`:'');
 t.hidden=false;const o=b.getBoundingClientRect(),tw=t.offsetWidth,th=t.offsetHeight;let x=o.left+o.width/2-tw/2,y=o.top-th-8;if(y<6)y=o.bottom+8;
 t.style.left=Math.max(6,Math.min(innerWidth-tw-6,x))+'px';t.style.top=Math.max(6,y)+'px';clearTimeout(HS_T);if(tap)HS_T=setTimeout(()=>{t.hidden=true;},3500);}
const hsHide=()=>{const t=document.getElementById('hs-tip');if(t)t.hidden=true;};
document.addEventListener('mouseover',e=>{const b=e.target.closest&&e.target.closest('.hs');if(b){hsTip(b);return;}
 const r=e.target.closest&&e.target.closest('.m3-row');if(r&&r.dataset.ref){const m=r.closest('.m3');const R=hsNorm(r.dataset.ref),mm=/^(\d+)(?:[A-Z]|-\d+)$/.exec(R);
  document.querySelectorAll(`.dg[data-hk="${m.dataset.k}"] .hs`).forEach(h=>h.classList.toggle('hl',h.dataset.ref===R||!!mm&&h.dataset.ref===mm[1]));}});
document.addEventListener('mouseout',e=>{const b=e.target.closest&&e.target.closest('.hs');if(b)hsHide();const r=e.target.closest&&e.target.closest('.m3-row');if(r){const m=r.closest('.m3');if(m)document.querySelectorAll(`.dg[data-hk="${m.dataset.k}"] .hs.hl`).forEach(h=>h.classList.remove('hl'));}});
document.addEventListener('scroll',hsHide,true);
"""

HSCSS = r"""
/* ---- diagram numbers (update 8r): a soft yellow box on each number, the chosen part's number filled ---- */
.dg{position:relative}
.hs{position:absolute;padding:0;margin:0;border:0;background:rgba(255,204,0,.1);border-radius:4px;box-shadow:0 0 0 1.5px rgba(214,160,0,.7);cursor:pointer;z-index:1;min-width:6px;min-height:6px}
.hs::before{content:'';position:absolute;inset:-7px}
.hs:hover,.hs.hl{background:rgba(255,204,0,.5);box-shadow:0 0 0 2px #d4a000}
.hs.on{background:rgba(255,204,0,.55);box-shadow:0 0 0 2.5px #141413}
.hs.x{display:none}
.hs-edit .hs.x{display:block;background:rgba(120,120,120,.12);box-shadow:none;outline:1.5px dashed #777}
.hs-edit .hs.a{box-shadow:0 0 0 2px #1a7f37}
.dg.hs-wait::after{content:'';position:absolute;top:8px;left:8px;width:14px;height:14px;border-radius:50%;border:2px solid #d4a000;border-top-color:transparent;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.hs-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--ink5);margin-top:6px}
.hs-bar .grow{min-width:0;flex:1 1 160px}
#hs-tip{position:fixed;z-index:300;max-width:280px;background:#141413;color:#fff;font-size:12.5px;line-height:1.35;padding:7px 9px;border-radius:8px;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.25);display:grid;gap:5px}
#hs-tip[hidden]{display:none}
#hs-tip b{color:#ffcc00}
.m3-row.nohs::after{content:'Not on diagram';display:none;font-size:11px;font-weight:700;color:var(--r);white-space:nowrap}
.hs-edit .m3-row.nohs::after{display:block}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        c = a.count(old)
        assert c == count, f'hs.py: pattern matched {c}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    assert '123456' not in HSJS + HSCSS and '</script' not in HSJS
    sub("/* ---------- Waiting for photos ---------- */", HSJS.strip() + "\n/* ---------- Waiting for photos ---------- */")
    sub("/* ---- inventory (update 8): phone stacks, website two columns ---- */", HSCSS.strip() + "\n/* ---- inventory (update 8): phone stacks, website two columns ---- */")
    # pdf.js: the page's number text is read while the page is drawn
    sub("const job=pg.render({canvasContext:cx,viewport:vp});try{await race(job.promise);}catch(err){try{job.cancel();}catch(x){}throw err;}",
        "const job=pg.render({canvasContext:cx,viewport:vp});try{await race(job.promise);}catch(err){try{job.cancel();}catch(x){}throw err;}\n"
        "   try{PDF_TXT[u]=await race(pdfNums(pg,vp,cv.width,cv.height));}catch(x){PDF_TXT[u]=[];}")
    # a diagram with a data-hk (the part page's) gets its numbers once its picture is in
    sub("else{t.style.backgroundSize='100% 100%';t.style.aspectRatio=(w/h).toFixed(4);}t.classList.add('on');},",
        "else{t.style.backgroundSize='100% 100%';t.style.aspectRatio=(w/h).toFixed(4);}t.classList.add('on');if(t.dataset.hk&&typeof hsWire==='function')hsWire(t);},")
    # the full-screen diagram has them too
    sub("<div class=\"fpz-in\"><div class=\"fpz-fig dg\" data-dg=\"${esc(el.dataset.dg)}\"${el.dataset.view?` data-box=\"${el.dataset.view}\"`:''} style=\"aspect-ratio:4/3\"></div></div>",
        "<div class=\"fpz-in\"><div class=\"fpz-fig dg\" data-dg=\"${esc(el.dataset.dg)}\"${el.dataset.view?` data-box=\"${el.dataset.view}\"`:''}${el.dataset.hk?` data-hk=\"${esc(el.dataset.hk)}\"`:''} style=\"aspect-ratio:4/3\"></div></div>")
    return a, n
