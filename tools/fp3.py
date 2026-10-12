"""Find Part's part page like Mittal's (update 8r, the owner's plan of 2026-10-12): diagram | the parts of that diagram by ref | the chosen part.

The part page was one long card and a "Parts in this assembly" list with every edition's lines (122 on a Hero brake page). Now it is in
three parts, as mittalautospares.in shows a part: the diagram on the left, in the middle only that diagram's parts (its edition), each with
its ref number on the diagram, and on the right the chosen part (photo, number, MRP, our stock with Add to bill or Add to stock, facts, the
bikes it fits). The searched part is chosen when the page opens. Another part is chosen in place: no new page, and the diagram is not drawn
again. A phone shows the diagram, then the list, and the chosen part opens under its line. A part with no diagram keeps the old page
(m2PartV0). The numbers on the diagram are another patch: it finds the diagram by data-hk, its lines in M3[key] and picks with m3Pick().
"""

FP3JS = r"""
/* ---------- the part page like Mittal's (update 8r): the diagram | its parts by ref | the chosen part ---------- */
IC.zoom='<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>';
const M3={};let M3_R=null,M3_C=new Map(),M3_T=0;
const m3Cmp=new Intl.Collator('en',{numeric:true}).compare,m3K=q=>String(q.ref||'')+'|'+(q.pk||'')+'|'+q.desc;
/* by ref: 1, 2, 2A, 10, 10-1, then the lines with no ref (the book's order inside one ref) */
const m3By=(a,b)=>(a.ref?0:1)-(b.ref?0:1)||m3Cmp(String(a.ref||''),String(b.ref||''));
/* one diagram's lines: its page in its edition, once per ref + number + name (kept until another catalogue arrives) */
function m3Rows(vb,pg,v){const R=catRows();if(M3_R!==R){M3_R=R;M3_C=new Map();}const k=vb+'|'+pg+'|'+(v||'');let L=M3_C.get(k);if(L)return L;const seen=new Set();
 L=R.filter(q=>q.vb===vb&&q.page===pg&&(!v||(q.vv||[]).includes(v))&&!seen.has(m3K(q))&&seen.add(m3K(q))).sort(m3By);M3_C.set(k,L);return L;}
/* the edition dgFig takes, while the brand's diagram list is still coming */
const m3Vg=r=>{const f=(S.ui&&(S.ui.fpA||S.ui.fp))||{},c=cur().p||{},vm=c.vm&&c.vm!=='Any'?c.vm:f.vm,vv=r.vv||[];return vv.find(x=>x===f.vv)||vv.find(x=>CAT_VMOD[x]===vm)||vv[0];};
/* the chosen line: by its index, else by number + ref (another catalogue came and the rows were numbered again), else the searched part */
const m3Sel=(p,L,r)=>{if(p.si==null)return r;const x=catRows()[p.si],same=q=>q&&(q.pk||'')===(p.spk||'')&&String(q.ref||'')===String(p.sref||'');return same(x)&&L.includes(x)?x:L.find(same)||r;};
const m3Row=(q,on,sm)=>{const y=q.pk?sm.get(q.pk):null,n=y?DB.stock[y.id]||0:0,v=q.mrp||(y&&y.mrp)||0;
 return `<button class="m3-row${on?' on':''}" data-i="${q.i}" data-ref="${esc(q.ref||'')}" aria-current="${on}" onclick="m3Pick(${q.i})"><span class="m2-num">${esc(q.ref||'·')}</span><span class="m3-rt"><b>${esc(catNice(q.desc))}</b><span class="cap"><span class="num">${esc(q.part||'No part number')}</span>${v?' · '+inr(v):''}${q.qty>1?' · ×'+esc(q.qty):''}${q.ns?' · N.S.':''}${n>0?` · <span class="m3-in">${n} in stock</span>`:''}</span></span></button>`;};
/* the chosen part: photo, number, MRP, our stock (Add to bill / Add to stock), facts, the bikes it fits */
function m3Det(x,o){const sh=m2Shop(x),n=sh?DB.stock[sh.id]:0,php=catPhoto(x),L=m2FitL(x),li=v=>`<li>${esc(v)}</li>`;
 const facts=[['Brand',x.vb],['Model',o.vm||'—'],['Model year',o.yr||'All years'],['Category',m2CatOf(x)],['Qty per bike',x.qty||'—'],['Book',x.src||'—']];
 return `${php?`<div class="fpc-pic m3-ph">${php}</div>`:''}<div class="stack" style="gap:2px"><div class="h3">${esc(catNice(x.desc))}</div><div class="cap">${x.ref?'Ref '+esc(x.ref)+' on the diagram':'No ref number on the diagram'}</div></div>
 ${x.pnNear?`<div class="row cap" style="background:var(--blue-soft);border-radius:10px;padding:8px 10px">${ic('search','s16')}<span class="grow">Same base number, with another colour or revision ending. Check the ending before ordering.</span></div>`:''}
 <div class="stack" style="gap:2px"><div class="micro muted">${x.sia?'Part number of the assembly':'Part number'}</div>${x.part?`<div class="row m3-pnr"><b class="fpc-pn num grow" id="pn-${x.i}">${esc(x.part)}</b><button class="btn line sm" onclick="catCopy(${x.i})">Copy</button></div>`:`<div class="cap">No number in the catalogue (ordered by colour or as a kit)</div>`}</div>
 <div class="m2-pr" style="font-size:20px">${m2Price(x)}</div>
 ${x.sup?`<div class="row cap" style="background:var(--amber-soft);border-radius:10px;padding:8px 10px">${ic('alert','s16')}<span class="grow">Replaced by <b class="num">${esc(x.sup)}</b>. Order the new number.</span></div>`:''}
 ${x.ns?`<span class="pill a" style="align-self:flex-start">${x.xl?'Not sold separately':'N.S. in catalogue (not supplied)'}</span>`:''}${x.old&&!x.sia?`<div class="cap">Old part no. <span class="num">${esc(x.old)}</span></div>`:''}${x.note?`<div class="cap">${esc(x.note)}</div>`:''}${x.rem&&!/^BS(VI|IV)$/i.test(x.rem)?`<div class="cap">Catalogue note: ${esc(x.rem)}</div>`:''}
 ${sh?`<button class="row" style="gap:8px;background:var(--y-soft);border-radius:12px;padding:10px 12px;text-align:left;width:100%" onclick="S.ui.scanHit='${sh.id}';S.ui.scanMiss=null;go('scanfind')"><div class="grow"><div class="micro muted">${n>0?n+' '+(sh.unit||'pcs')+' in stock':'Out of stock'} · Rack</div><b style="font-size:18px">${ic('pin','s16')} ${esc(binOf(sh.id))}</b></div><div style="text-align:right"><div class="micro muted">Our MRP</div><b class="num" style="font-size:18px">${inr(sh.mrp)}</b></div></button>${n>0?`<button class="btn" onclick="S.ui.scanHit='${sh.id}';S.ui.scanMiss=null;go('scanfind')">${ic('cart','s18')} Add to bill</button>`:allowed('partorders')?`<button class="btn line" onclick="soNewSheet('${sh.id}')">Take order for customer</button>`:''}`:x.part?invFpAdd(x):''}
 <div class="grid2 fpc-facts">${facts.map(([a,b])=>`<div${a==='Book'?' class="m3-wide"':''}><div class="micro muted">${a}</div><b>${esc(b)}</b></div>`).join('')}</div>
 ${L.length?`<div class="fpc-fits"><div class="micro muted">Fits ${L.length===1?'this '+esc(x.vb)+' bike':'these '+L.length+' '+esc(x.vb)+' bikes'}</div><ul>${L.slice(0,6).map(li).join('')}</ul>${L.length>6?`<details class="m3-fm"><summary>${L.length-6} more</summary><ul>${L.slice(6).map(li).join('')}</ul></details>`:''}</div>`:''}`;}
/* under the columns: the same number in other brands, and the gaskets, seals, bolts... of this diagram */
function m3More(x,o){const seen=new Set(),need=o.rows.filter(q=>q.pk&&q.pk!==x.pk&&/\b(GASKET|SEAL|O RING|BOLT|NUT|WASHER|SPRING|BEARING|BUSH|CLIP|PACKING|SCREW)\b/.test(q.dhay)&&!seen.has(q.pk)&&seen.add(q.pk)).slice(0,4);
 return xrSection(x)+(need.length?`<div class="sec"><h3 class="h2">Commonly needed with this</h3></div><div class="stack g8">${need.map(q=>`<button class="m2-row" onclick="m3Pick(${q.i},'need')"><span class="m2-num">${esc(q.ref||'·')}</span><div class="grow"><div class="h3" style="font-size:14px">${esc(catNice(q.desc))}</div><div class="cap">${esc(q.part||'No part number')}${q.mrp?' · '+inr(q.mrp):''}</div></div>${ic('chevR','s18')}</button>`).join('')}</div>`:'');}
/* the page; no diagram for the part (and none coming): the old page */
function m2PartV(p){const r=m2Row(p);if(!r)return m2PartV0(p);const s=DG_SLUG[r.vb],g=s?dgFig(r):null;if(!g&&!(r.ext&&s&&DG[s]&&DG[s].st===1))return m2PartV0(p);
 const v=g?g.v:m3Vg(r),kr=m3K(r);let L=m3Rows(r.vb,r.page,v).map(q=>m3K(q)===kr?r:q);if(!L.includes(r))L=L.concat(r).sort(m3By);
 const x=m3Sel(p,L,r),k='m3'+r.i,vm=p.vm&&p.vm!=='Any'?p.vm:v&&CAT_VMOD[v]||(m2FitL(r)[0]||r.vm||'').replace(/ \(.*$/,''),ys=v?catVyrs(v):[],yr=p.yr&&p.yr!=='Any'?String(p.yr):ys.length?catYrsTxt(ys):'',cc=MODEL_CC[vm];
 if(p.si!=null){p.si=x.i;p.spk=x.pk||'';p.sref=x.ref||'';}const o=M3[k]={rows:L,sel:x.i,vb:r.vb,page:r.page,v,vm,yr},sm=new Map();PRODUCTS.forEach(y=>{const q=catPk(y.pn);if(q&&!sm.has(q))sm.set(q,y);});queueMicrotask(m3Mount);
 const dia=g?`<div class="m3-dgw dg-wrap">${dgEl(g,'fpc-fig m3-fig').replace('<div ',`<div data-hk="${k}" onclick="if(!event.target.closest('button'))dgZoom(this.closest('.m3-dgw'))" `)}<button class="m3-zb" onclick="dgZoom(this.closest('.m3-dgw'))" aria-label="Open the diagram bigger">${ic('zoom','s18')}</button><div class="dg-alt">${dgMiss()}</div></div><div class="cap m3-tip">Tap a number on the diagram or a part in the list.</div>`
  :`<div class="m3-dgw m3-ld"><span class="cap">Loading diagram…</span></div>`;
 return `<div class="m3" data-k="${k}">${m2Head(esc(catNice(r.asm||r.fig))+(r.asm&&r.fig?' – '+esc(r.fig):'')+' for '+esc([r.vb,vm,cc?cc+'cc':'',yr].filter(Boolean).join(' ')),[v,r.src,L.length+' part'+(L.length===1?'':'s')].filter(Boolean).map(esc).join(' · '))}
 <div class="m3-g"><div class="m3-c1">${dia}</div><div class="m3-c2"><div class="m3-lh"><b>Parts in this diagram</b><span class="cap">${L.length}</span></div><div class="m3-list">${L.map(q=>m3Row(q,q===x,sm)).join('')}</div></div><div class="m3-c3"><div class="card m3-det">${m3Det(x,o)}</div></div></div>
 <div class="m3-more">${m3More(x,o)}</div></div>`;}
/* CSS decides the columns (by the page's own width), JS follows: the right column hidden (a phone) = the details open under the chosen line */
const m3Nw=el=>getComputedStyle(el.querySelector('.m3-c3')).display==='none';
const m3Mid=(el,box)=>{const a=el.getBoundingClientRect(),b=box.getBoundingClientRect();if(a.top<b.top||a.bottom>b.bottom)box.scrollTop+=a.top-b.top-(b.height-a.height)/2;};
const m3Top=(el,box,lim,sm)=>{const a=el.getBoundingClientRect(),b=box.getBoundingClientRect();if(a.top<b.top||a.bottom>b.top+b.height*lim)box.scrollTo({top:box.scrollTop+a.top-b.top-8,behavior:sm?'smooth':'auto'});};
function m3Place(el){el=el||document.querySelector('#vp .m3');if(!el)return;const d=el.querySelector('.m3-det'),c3=el.querySelector('.m3-c3'),row=el.querySelector('.m3-row.on');if(!d||!c3)return;
 if(m3Nw(el)){if(row&&row.nextElementSibling!==d)row.after(d);}else if(d.parentNode!==c3)c3.append(d);}
/* once the page is drawn: the details in place, the list (a phone: the page) at the searched part the first time, where it was after that */
function m3Mount(){const el=document.querySelector('#vp .m3:not([data-m])');if(!el)return;el.dataset.m=1;m3Place(el);const p=cur().p||{},ls=el.querySelector('.m3-list'),row=el.querySelector('.m3-row.on'),sc=el.closest('.scroll');
 if(!p.m3o){p.m3o=1;if(row){m3Mid(row,ls);if(sc&&m3Nw(el))m3Top(row,sc,.85);}}else{if(p.m3y!=null)ls.scrollTop=p.m3y;if(sc&&p.m3t!=null)sc.scrollTop=p.m3t;}
 ls.addEventListener('scroll',()=>{p.m3y=ls.scrollTop;},{passive:true});if(sc)sc.addEventListener('scroll',()=>{p.m3t=sc.scrollTop;},{passive:true});}
/* another line chosen in place (from: 'dg' a number on the diagram, 'need' the list under the columns); refresh() and Back keep it */
function m3Pick(i,from){const el=document.querySelector('#vp .m3'),o=el&&M3[el.dataset.k],x=o&&o.rows.find(q=>q.i===i);if(!x)return;const p=cur().p||{},sc=el.closest('.scroll'),d=el.querySelector('.m3-det');let row=null;
 p.si=x.i;p.spk=x.pk||'';p.sref=x.ref||'';o.sel=x.i;
 el.querySelectorAll('.m3-row').forEach(b=>{const on=+b.dataset.i===x.i;b.classList.toggle('on',on);b.setAttribute('aria-current',on);if(on)row=b;});
 const nw=m3Nw(el),y0=row?row.getBoundingClientRect().top:0;d.innerHTML=m3Det(x,o);d.scrollTop=0;el.querySelector('.m3-more').innerHTML=m3More(x,o);m3Place(el);
 if(row&&sc&&nw){if(!from)sc.scrollTop+=row.getBoundingClientRect().top-y0;m3Top(row,sc,.5,1);}
 else if(row&&from){m3Mid(row,el.querySelector('.m3-list'));if(sc){const a=d.getBoundingClientRect(),b=sc.getBoundingClientRect();if(a.bottom<b.top+60||a.top>b.bottom-60)el.querySelector('.m3-g').scrollIntoView({block:'start',behavior:'smooth'});}}
 if(typeof hsSel==='function')hsSel(el.dataset.k);}
addEventListener('resize',()=>{clearTimeout(M3_T);M3_T=setTimeout(()=>m3Place(),120);});
"""

FP3CSS = r"""
/* ---- the part page like Mittal's (update 8r): one column on a phone, diagram | list+details from 680 px, three columns from 860 px ---- */
.m3{container-type:inline-size;display:flex;flex-direction:column;gap:14px;min-width:0;overflow-anchor:none}
.m3-g{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
.m3-c1,.m3-c2,.m3-c3{display:flex;flex-direction:column;gap:8px;min-width:0}
.m3-c3{display:none}
.m3-dgw{position:relative;flex:none;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px}
.m3-dgw .m3-fig{border:0;cursor:zoom-in}
.m3-zb{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;background:var(--k);color:var(--y);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.m3-dgw.dg-fail .m3-zb,.m3-dgw.dg-fail+.m3-tip{display:none}
.m3-dgw .dg-alt{padding:6px}
.m3-ld{aspect-ratio:4/3;display:grid;place-items:center}
.m3-tip{text-align:center}
.m3-lh{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 4px}
.m3-list{display:flex;flex-direction:column;min-width:0;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;scrollbar-width:thin}
.m3-row{display:flex;align-items:center;gap:10px;width:100%;min-width:0;text-align:left;padding:8px 10px 8px 7px;border-left:3px solid transparent;border-top:1px solid var(--line);font-size:14px;color:var(--ink);transition:background .15s}
.m3-row:first-child{border-top:0}
@media (hover:hover){.m3-row:hover{background:var(--paper)}}
.m3-row.on{background:var(--y-soft);border-left-color:var(--y)}
.m3-row:focus-visible{outline-offset:-2px}
.m3-row .m2-num{min-width:28px;height:28px;border-radius:8px;font-size:12px}
.m3-rt{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.m3-rt b{font-size:14px;line-height:1.3;overflow-wrap:anywhere}
.m3-rt .cap{overflow-wrap:anywhere}
.m3-in{color:var(--g);font-weight:700}
.m3-det{gap:10px;min-width:0;scrollbar-width:thin}
.m3-det>*{flex-shrink:0}
.m3-det .fpc-pn{font-size:18px}
.m3-det .pill{white-space:normal}
.m3-pnr{gap:6px 10px;flex-wrap:wrap}
.m3-pnr .fpc-pn{flex:1 1 auto}
.m3-pnr .btn{padding-inline:12px}
.m3-ph{padding:10px}
.m3-ph .fpc-photo{max-height:200px}
.m3-wide{grid-column:1/-1}
.m3-fm summary{cursor:pointer;color:var(--y-deep);font-size:13px;font-weight:700;margin-top:4px}
.m3 .m3-list>.m3-det{border:0;border-top:1px solid var(--line);border-left:3px solid var(--y);border-radius:0;padding:14px 12px 16px 13px}
.m3-more{display:flex;flex-direction:column;gap:12px;min-width:0}
.m3-more:empty{display:none}
@container (min-width:680px){.m3-g{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}.m3-c1{grid-row:span 2;position:sticky;top:0}.m3-c3{display:flex}.m3-list{max-height:45vh;overflow-y:auto;overflow-x:hidden}}
@container (min-width:860px){.m3-g{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.9fr);gap:16px}.m3-c1{grid-row:auto}.m3-c3{align-self:stretch}.m3-list{max-height:max(320px,calc(100vh - 260px))}.m3-det{position:sticky;top:0;max-height:calc(100vh - 230px);overflow-y:auto;padding:14px}.m3-det .fpc-pn{font-size:17px}.m3-more .stack.g8{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}}
"""


def apply(a):
    n = 0

    def sub(old, new, count=1):
        nonlocal a, n
        k = a.count(old)
        assert k == count, f'fp3.py: pattern matched {k}x (wanted {count}): {old[:90]!r}'
        a = a.replace(old, new)
        n += 1

    assert '123456' not in FP3JS + FP3CSS and '</script' not in FP3JS
    # the old page stays for a part with no diagram (renamed before the new m2PartV goes in)
    sub("function m2PartV(p){const r=m2Row(p);", "function m2PartV0(p){const r=m2Row(p);")
    sub("/* ---------- Waiting for photos ---------- */", FP3JS.strip() + "\n/* ---------- Waiting for photos ---------- */")
    sub("/* ---- inventory (update 8): phone stacks, website two columns ---- */", FP3CSS.strip() + "\n/* ---- inventory (update 8): phone stacks, website two columns ---- */")
    return a, n
