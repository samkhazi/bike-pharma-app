"""Update 8x: aftermarket catalogues in Find Part and Add product (Sam 2026-10-15 16:2xZ-16:44Z).
cat/am.json (tools/aftermarket/am_build.py): 12 aftermarket brands' parts with their MRP, the OEM numbers the catalogue prints,
the bikes they fit (our model names) and the kind of part.
- Original part page: "Aftermarket parts": exact (OEM number printed in the aftermarket catalogue) and "same bike, same kind" (check).
- Search a number: an aftermarket number shows its part and its original numbers; an original number shows its aftermarket parts.
- Add product / Stock in / Paste bill: an aftermarket number fills name, brand, MRP, bikes (type Aftermarket, packed by its brand).
usage: python3 amfix.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function amLoad' in a: raise SystemExit('already done')

def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)

AMJS = r"""/* ----- aftermarket catalogues (cat/am.json, update 8x): exact = the original number is printed in the aftermarket catalogue ----- */
let AM=null,AM_ST=0,AM_PK=null,AM_OE=null,AM_TY=null;
function amLoad(){if(AM_ST===0){AM_ST=1;fetch('cat/am.json').then(r=>r.ok?r.json():Promise.reject(r.status)).then(d=>{AM=d;AM_PK=new Map();AM_OE=new Map();
  d.p.forEach((p,i)=>{const k=catPk(p[1]);(AM_PK.get(k)||AM_PK.set(k,[]).get(k)).push(i);p[6].forEach(o=>{const q=catPk(o);if(q)(AM_OE.get(q)||AM_OE.set(q,[]).get(q)).push(i);});});
  AM_TY=d.ty.map(([n,x])=>[n,new RegExp(x)]);AM_ST=2;refresh();},()=>{AM_ST=3;});}return AM;}
const amP=i=>{const p=AM.p[i];return {i,b:AM.b[p[0]],pn:p[1],nm:p[2],g:p[3],mrp:p[4],fit:p[5],oem:p[6],same:p[7],ty:p[8],fm:p[9].map(([b,m])=>[AM.ob[b],m])};};
function amType(...ss){if(!AM_TY)return '';for(const s of ss){const u=String(s||'').toUpperCase();for(const [n,x] of AM_TY)if(x.test(u))return n;}return '';}
const amByPn=pk=>AM_PK&&pk?(AM_PK.get(pk)||[]).map(amP):[];
const amByOem=pk=>AM_OE&&pk?(AM_OE.get(pk)||[]).map(amP):[];
/* same bike + same kind of part (no number printed): only a suggestion */
function amBike(r){if(!AM||!r)return [];const ty=amType(r.desc)||amType(r.asm);if(!ty)return [];const ms=new Set(m2FitL(r).map(m=>m.replace(/ \(.*$/,'')).concat(r.vms||[]));
 const ex=new Set(amByOem(r.pk).map(p=>p.i)),out=[];AM.p.forEach((p,i)=>{if(p[8]!==ty||ex.has(i))return;if(p[9].some(([b,m])=>AM.ob[b]===r.vb&&ms.has(m)))out.push(amP(i));});return out;}
const amFits=p=>p.fm.length?p.fm.map(([b,m])=>b+' '+m).join(', '):p.fit;
function amRow(p,ok){return `<button class="m2-row" onclick="amGo('${m2Q(p.pn)}')"><div class="tile sm ${ok?'y':'n'}">${ic(ok?'check':'package','s18')}</div><div class="grow"><div class="h3">${esc(p.b)} · <span class="num">${esc(p.pn)}</span></div><div class="cap">${esc(catNice(p.nm))}${p.mrp?' · MRP '+inr(p.mrp):''}</div><div class="micro muted">${esc(amFits(p).slice(0,90))}</div></div>${ic('chevR','s18')}</button>`;}
function amSection(r){const X=amLoad();if(!X)return AM_ST===1?`<div class="cap">Looking up aftermarket parts…</div>`:'';
 const ex=amByOem(r.pk),bk=amBike(r),all=!!S.ui.amAll;if(!ex.length&&!bk.length)return '';
 const a=ex.length?`<div class="sec"><h3 class="h2">Aftermarket part for this number</h3><span class="cap">${ex.length}</span></div><div class="stack g8">${ex.map(p=>amRow(p,1)).join('')}</div><div class="cap"><span class="pill g">Exact match</span> The aftermarket catalogue prints this original number (${esc(r.part)}) for its part.</div>`:'';
 const b=bk.length?`<div class="sec"><h3 class="h2">Aftermarket for the same bike (check)</h3><span class="cap">${bk.length}</span></div><div class="stack g8">${bk.slice(0,all?bk.length:6).map(p=>amRow(p,0)).join('')}</div>${bk.length>6?`<button class="link" onclick="S.ui.amAll=!S.ui.amAll;refresh()">${all?'Show less':'Show all '+bk.length}</button>`:''}<div class="cap">Same kind of part for the same bike in the aftermarket catalogue. It prints no original number, so check it before fitting.</div>`:'';
 return a+b;}
function amGo(pn){const f=S.ui.fp||(S.ui.fp=FP0());f.vb='Any';f.vm='Any';f.yr='Any';f.cc='Any';go('findpart',{v:'res',q:pn,vb:'Any',vm:'Any',yr:'Any',bs:'Any',sort:'best',n:30});}
/* a number searched: its aftermarket part (and the original numbers it replaces), or the aftermarket parts of an original number */
function amRes(q){if(!q||catPk(q).length<4)return '';const X=amLoad();if(!X)return '';const k=catPk(q),own=amByPn(k),ex=amByOem(k);if(!own.length&&!ex.length)return '';
 const A=own.map(p=>`<div class="card" style="gap:8px"><div class="row wrap" style="gap:6px"><span class="pill n">Aftermarket</span><span class="pill g">${esc(p.b)} catalogue</span></div><div class="h3">${esc(catNice(p.nm))}</div><div class="cap"><span class="num">${esc(p.pn)}</span>${p.mrp?' · MRP <b>'+inr(p.mrp)+'</b>':''}${p.ty?' · '+esc(p.ty):''}</div><div class="cap">Fits ${esc(amFits(p))}</div>
   ${p.oem.length?`<div class="micro muted">Original part number${p.oem.length>1?'s':''} (printed in the ${esc(p.b)} catalogue)</div><div class="row wrap" style="gap:6px">${p.oem.map(o=>`<button class="chip" onclick="amGo('${m2Q(o)}')">${esc(o)}</button>`).join('')}</div>`:`<div class="cap muted">The ${esc(p.b)} catalogue prints no original number for it.</div>`}
   ${p.same.length?`<div class="cap">Same as ${p.same.map(([b,n])=>esc(b)+' '+esc(n)).join(' · ')}</div>`:''}${allowed('addproduct')?`<button class="btn line sm" style="align-self:flex-start" onclick="amAdd('${m2Q(p.pn)}')">${ic('plus','s16')} Add to stock</button>`:''}</div>`).join('');
 const B=ex.length?`<div class="sec"><h3 class="h2">Aftermarket part for ${esc(q)}</h3><span class="cap">${ex.length}</span></div><div class="stack g8">${ex.map(p=>amRow(p,1)).join('')}</div><div class="cap"><span class="pill g">Exact match</span> The aftermarket catalogue prints this original number for its part.</div>`:'';
 return A+B;}
function amAdd(pn){const a=S.ui.ap=invApNew();a.pn=pn;a.look=catPk(pn);S.ui.apErr=null;S.ui.apAll=false;go('addproduct');}
/* Add product, Stock in, Paste bill: an aftermarket number is a hit like a brand catalogue's */
const amHits=pk=>amByPn(pk).map(p=>({vb:p.b,pk,pn:p.pn,name:catNice(p.nm)||p.pn,sec:p.ty||catNice(p.g),qty:0,mrp:p.mrp,fits:p.fm.length?p.fm.map(([b,m])=>b+' '+m):p.fit?[p.fit]:[],cat:invCatOf({desc:p.nm+' '+p.g}),am:1}));
"""
sub("/* ----- the part's own page ----- */", AMJS + "/* ----- the part's own page ----- */")
# part pages (diagram page and the old page)
sub("return xrSection(x)+(need.length?", "return xrSection(x)+amSection(x)+(need.length?")
sub(" ${xrSection(r)}${need.length?", " ${xrSection(r)}${amSection(r)}${need.length?")
# search results
sub("function m2ResView(p){xrLoad();altLoad();", "function m2ResView(p){xrLoad();altLoad();amLoad();")
sub("${m2Head(count,scope+(c&&c.hits.some(r=>r.img)?", "${p.cat?'':amRes(p.q)}${m2Head(count,scope+(c&&c.hits.some(r=>r.img)?")
# inventory lookups
sub(" return out;}\nconst INV_RK=new Map();", " if(AM)out.push(...amHits(pk));return out;}\nconst INV_RK=new Map();")
sub(" o.hits=invHits(pk);o.in=want.filter(e=>e.st===2).map(e=>e.vb);o.fail=want.filter(e=>e.st===3).map(e=>e.vb);\n if(need.length){",
    " amLoad();o.hits=invHits(pk);o.in=want.filter(e=>e.st===2).map(e=>e.vb);o.fail=want.filter(e=>e.st===3).map(e=>e.vb);\n if(AM_ST===1&&!o.hits.length){o.st='wait';o.need=need;o.pend=need.map(e=>e.vb).concat('aftermarket');if(need.length&&!defer)catNeed(need);return o;}\n if(need.length){")
sub("function apUse(a,h){a.hit=h;a.picked=h.vb;a.name=h.name;a.brand=h.vb;a.cat=h.cat;a.type='Genuine';",
    "function apUse(a,h){a.hit=h;a.picked=h.vb;a.name=h.name;a.brand=h.vb;a.cat=h.cat;a.type=h.am?'Aftermarket':'Genuine';if(h.am)a.pack=h.vb;")
sub("<span class=\"pill g\">Found in ${esc(h.vb)} catalogue</span>", "<span class=\"pill g\">Found in ${esc(h.vb)} ${h.am?'aftermarket ':''}catalogue</span>")
sub("<div class=\"kv\"><span>Type</span><span>Genuine (OEM)</span></div>", "<div class=\"kv\"><span>Type</span><span>${h.am?'Aftermarket · '+esc(h.vb):'Genuine (OEM)'}</span></div>")
sub(" if(R.loading)return m2Head(p.cat?esc(p.cat):'“'+esc(p.q)+'”','')+catSection(R.loading,A);",
    " if(R.loading)return (p.cat?'':amRes(p.q))+m2Head(p.cat?esc(p.cat):'“'+esc(p.q)+'”','')+catSection(R.loading,A);")
sub("Works with every catalogue: Hero, Honda, TVS, Yamaha, Suzuki, Bajaj, KTM, Husqvarna, Royal Enfield.",
    "Works with every catalogue: Hero, Honda, TVS, Yamaha, Suzuki, Bajaj, KTM, Husqvarna, Royal Enfield, and the aftermarket ones (Endurance, Suprajit, Lumax…).")
sub("Fits ${nf===1?'this '+esc(h.vb)+' bike':nf+' '+esc(h.vb)+' bikes'}", "Fits ${h.am?'':nf===1?'this '+esc(h.vb)+' bike':nf+' '+esc(h.vb)+' bikes'}")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
