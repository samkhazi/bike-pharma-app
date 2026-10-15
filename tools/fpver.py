"""Find Part Year list like Mittal's (Sam 2026-10-15 11:26Z screenshot "2023 · BS VI / 2020 · BS VI / 2018 · BS IV / 2014 · DTS-i",
plan OK'd 11:40Z "haan"). update 8u.
The Year select lists the model's catalogue VERSIONS, newest first: the version's first year and its emission norm in Roman numerals
(from the catalogue rows, else from the version name), or the version's own name (DTS-i, Disc, Drum...) when it has no norm. Versions
without any year (old Royal Enfield, most TVS e-catalogue, Avenger 180, Eterno) show by name, so no model has an empty list. Two
versions with the same line merge into one. Kits, painted parts and price-list parts always come with the chosen version.
The chosen version (p.ed, its line) goes through Search parts -> sections -> one section -> Specific part lookup.
Patches public/app.html in place: python3 tools/fpver.py"""
import os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'app.html')
a = open(P, encoding='utf-8').read()
if 'function fpVers(' in a:
    raise SystemExit('fpver: already in')


def sub1(o, n):
    global a
    assert a.count(o) == 1, o[:90]
    a = a.replace(o, n)


JS = r"""
/* ---------- the Year list as the model's catalogue versions, like Mittal's "2023 · BS VI" (update 8u) ---------- */
const FP_HELP=/·\s*(kits|painted parts\b.*|colour parts\b.*|more parts \(price list\)|price list parts\b.*)$/i;
const FP_RN={BS3:'BS III',BS4:'BS IV',BS6:'BS VI',BS7:'BS VII'};
const fpNormOf=s=>{const m=String(s||'').toUpperCase().match(/\bBS\s*-?\s*(VII|VI|IV|III|7|6|4|3)(?![A-Z0-9])/);if(!m)return '';return 'BS'+({VII:7,VI:6,IV:4,III:3}[m[1]]||m[1]);};
const fpShort=(vm,v)=>{let s=String(v);const lo=s.toLowerCase(),m=String(vm).toLowerCase().replace(/\s*\(old\)$/,'');
 if(lo.startsWith(m))s=s.slice(m.length);
 s=s.replace(/\((?:[A-Za-z]{3,5}\.?,?\s*)?(?:19|20)\d\d(?:\s*[-–+]\s*(?:(?:19|20)?\d\d)?)?\)/g,' ').replace(/\b(?:19|20)\d\d\s*[-–]\s*(?:19|20)?\d\d\b|\b(?:19|20)\d\d\+/g,' ')
  .replace(/\(MY\d\d\)/gi,' ').replace(/\(\d\d?[.\s\/-]\d\d?[.\s\/-](?:19|20)?\d\d\)/g,' ').replace(/\b(?:rev\.?\s*\d+\s*)$/i,' ').replace(/(^|[\s·])(?:19|20)\d\d(?=[\s·]|$)/g,' ').replace(/\bBS\s*-?\s*(?:VII|VI|IV|III|7|6|4|3)(?![A-Z0-9])/gi,' ')
  .replace(/^[\s·\-–:,]+|[\s·\-–:,]+$/g,'').replace(/\s*[\-–]\s*$/,'').replace(/\s{2,}/g,' ').trim();return s;};
let FP_VER={rows:null,m:new Map()};
function fpVers(vb,vm){const e=CAT_ALL.find(e=>e.vb===vb);if(e&&e.st<2){catLoad(vb);return 'wait';}const rows=catRows();if(FP_VER.rows!==rows)FP_VER={rows,m:new Map()};
 const k=vb+'|'+vm;if(FP_VER.m.has(k))return FP_VER.m.get(k);
 const vs=catVariants(vb,vm),help=vs.filter(v=>FP_HELP.test(v)),main=vs.filter(v=>!FP_HELP.test(v));const base=main.length?main:vs;
 const rn=new Map();catRowsOf(vm).forEach(r=>{if(r.vb!==vb||!r.norms||!r.norms.length)return;r.vv.forEach(v=>{let s=rn.get(v);if(!s)rn.set(v,s=new Set());r.norms.forEach(n=>s.add(n));});});
 let it=base.map(v=>{const ys=catVyrs(v),s=rn.get(v),n=s&&s.size===1?[...s][0]:fpNormOf(v),sh=fpShort(vm,v);
  const nt=n?FP_RN[n]||n:'',tag=nt||sh,nm=String(vm).replace(/\s*\(old\)$/,'');
  return {v,y:ys.length?ys[0]:0,nt,sh,lab:ys.length?(/price list/i.test(sh)&&ys.length>1?ys[0]+'–'+ys[ys.length-1]:ys[0])+(tag?' · '+tag:''):(sh?(nt&&!sh.toLowerCase().startsWith(nm.split(' ')[0].toLowerCase())?nm+' '+sh:sh):nm)+(nt?' · '+nt:'')};});
 // two versions on the same line: name each by its own words when they differ, else they are one line
 const by=new Map();it.forEach(x=>{const a=by.get(x.lab);if(a)a.push(x);else by.set(x.lab,[x]);});
 by.forEach((xs,lab)=>{if(xs.length<2)return;const sh=new Set(xs.map(x=>x.sh));if(sh.size<2)return;xs.forEach(x=>{if(x.y&&x.sh&&x.sh!==x.nt&&!lab.includes(x.sh))x.lab=lab+' · '+x.sh;});});
 const o=new Map();it.forEach(x=>{let g=o.get(x.lab);if(!g)o.set(x.lab,g={lab:x.lab,y:x.y,vs:[]});g.vs.push(x.v);g.y=Math.max(g.y,x.y);});
 const out=[...o.values()].sort((a,b)=>(b.y-a.y)||(a.lab<b.lab?-1:a.lab>b.lab?1:0)).map(g=>({...g,vs:g.vs.concat(help)}));
 FP_VER.m.set(k,out);return out;}
/* the chosen line -> its versions (null: no line chosen) */
const fpEdSet=A=>{if(!A.ed||A.ed==='Any'||!A.vm||A.vm==='Any')return null;const V=fpVers(A.vb,A.vm);if(V==='wait')return null;const g=V.find(g=>g.lab===A.ed);return g?new Set(g.vs):null;};
"""
sub1("const fpYrs=f=>{", JS + "const fpYrs=f=>{")
# the scope: a chosen line keeps only its versions' rows (rows of every version stay)
sub1("const pend=A.vb==='Any'?catPend()", "const es=fpEdSet(A);\n const pend=A.vb==='Any'?catPend()")
sub1("&&(!yv||!r.vv.length||r.vv.some(v=>yv.has(v)));", "&&(!yv||!r.vv.length||r.vv.some(v=>yv.has(v)))&&(!es||!r.vv.length||r.vv.some(v=>es.has(v)));")
sub1("const ck=[A.vb,A.vm,A.vv||'Any',A.cc,A.bs,A.yr||'Any'].join('|');", "const ck=[A.vb,A.vm,A.vv||'Any',A.cc,A.bs,A.yr||'Any',A.ed||'Any'].join('|');")
sub1("const m2A=p=>({q:p.q||'',vb:p.vb||'Any',vm:p.vm||'Any',bs:p.bs||'Any',col:'Any',cc:p.cc||'Any',vv:'Any',yr:p.yr||'Any'});",
     "const m2A=p=>({q:p.q||'',vb:p.vb||'Any',vm:p.vm||'Any',bs:p.bs||'Any',col:'Any',cc:p.cc||'Any',vv:'Any',yr:p.ed&&p.ed!=='Any'?'Any':p.yr||'Any',ed:p.ed||'Any'});")
sub1("const FP0=()=>({q:'',vb:'Any',vm:'Any',bs:'Any',col:'Any',cc:'Any',vv:'Any',yr:'Any'});", "const FP0=()=>({q:'',vb:'Any',vm:'Any',bs:'Any',col:'Any',cc:'Any',vv:'Any',yr:'Any',ed:'Any'});")
sub1("const m2Bike=p=>`${p.vb} ${p.vm}${MODEL_CC[p.vm]?' '+MODEL_CC[p.vm]+'cc':''}${p.yr&&p.yr!=='Any'?' '+p.yr:''}`;",
     "const m2Bike=p=>`${p.vb} ${p.vm}${MODEL_CC[p.vm]?' '+MODEL_CC[p.vm]+'cc':''}${p.ed&&p.ed!=='Any'?' '+p.ed:p.yr&&p.yr!=='Any'?' '+p.yr:''}`;")
# the form's Year select: the version lines
sub1("let yo=`<option value=\"Any\">Any year</option>`;if(f.vb!=='Any'&&f.vm!=='Any'){const Y=fpYrs(f);if(Y==='wait')yo=`<option value=\"Any\">Loading years…</option>`;else{const one=Y.ys.length===1&&!Y.none;if(one&&f.yr==='Any')f.yr=String(Y.ys[0]);yo=(one?'':`<option value=\"Any\">${Y.ys.length?'Any year':'All books'}</option>`)+Y.ys.map(y=>`<option value=\"${y}\"${String(f.yr)===String(y)?' selected':''}>${y}</option>`).join('');}}",
     "let yo=`<option value=\"Any\">Select year</option>`;if(f.vb!=='Any'&&f.vm!=='Any'){const V=fpVers(f.vb,f.vm);if(V==='wait')yo=`<option value=\"Any\">Loading years…</option>`;else{const one=V.length===1;if(one&&(f.ed||'Any')==='Any'){f.ed=V[0].lab;f.yr='Any';}yo=(one?'':`<option value=\"Any\">All years</option>`)+V.map(g=>`<option value=\"${esc(g.lab)}\"${f.ed===g.lab?' selected':''}>${esc(g.lab)}</option>`).join('');}}")
sub1("${sel('yr','Year',", "${sel('ed','Year',")
sub1("function m2Set(k,v){const f=S.ui.fp;if(k==='vb'){f.yr='Any';f.ccU=0;fpSet('vb',v);return;}\n if(k==='vm'){f.vm=v;f.vv='Any';",
     "function m2Set(k,v){const f=S.ui.fp;if(k==='ed'){f.ed=v;f.yr='Any';refresh();return;}if(k==='vb'){f.yr='Any';f.ed='Any';f.ccU=0;fpSet('vb',v);return;}\n if(k==='vm'){f.vm=v;f.vv='Any';f.ed='Any';")
sub1("if(v!=='Any'&&f.vm!=='Any'&&String(MODEL_CC[f.vm]||'')!==String(v))f.vm='Any';f.yr='Any';refresh();return;}",
     "if(v!=='Any'&&f.vm!=='Any'&&String(MODEL_CC[f.vm]||'')!==String(v))f.vm='Any';f.yr='Any';f.ed='Any';refresh();return;}")
sub1("go('findpart',{v:f.yr!=='Any'?'secs':'year',vb:f.vb,vm:f.vm,yr:f.yr});}",
     "const ed=f.ed||'Any';go('findpart',{v:f.yr!=='Any'||ed!=='Any'?'secs':'year',vb:f.vb,vm:f.vm,yr:ed!=='Any'?'Any':f.yr,ed});}")
# the chosen line goes on: search box, sections, one section, categories
sub1("const A={q,vb:f.vb,vm:f.vm,cc:f.cc,bs:f.bs,yr:f.yr};\n if((c.v==='secs'||c.v==='sec')&&f.vb===c.vb){A.vm=c.vm;A.yr=c.yr||'Any';",
     "const A={q,vb:f.vb,vm:f.vm,cc:f.cc,bs:f.bs,yr:f.yr,ed:f.vm!=='Any'?f.ed||'Any':'Any'};\n if((c.v==='secs'||c.v==='sec')&&f.vb===c.vb){A.vm=c.vm;A.yr=c.yr||'Any';A.ed=c.ed||'Any';")
sub1("const c=cur().p||{};if(c.v==='secs'||c.v==='sec'){f.vb=c.vb;f.vm=c.vm;f.yr=c.yr||'Any';",
     "const c=cur().p||{};if(c.v==='secs'||c.v==='sec'){f.vb=c.vb;f.vm=c.vm;f.yr=c.yr||'Any';f.ed=c.ed||'Any';")
sub1("if(p.set.vb||p.set.vm)f.yr='Any';", "if(p.set.vb||p.set.vm){f.yr='Any';f.ed='Any';}")
sub1("function m2Sec(pg){const c=cur().p||{};go('findpart',{v:'sec',vb:c.vb,vm:c.vm,yr:c.yr||'Any',pg});}",
     "function m2Sec(pg){const c=cur().p||{};go('findpart',{v:'sec',vb:c.vb,vm:c.vm,yr:c.yr||'Any',ed:c.ed||'Any',pg});}")
sub1("go('findpart',{v:'res',q:'',vb:f.vb,vm:f.vm,cc:f.cc,bs:'Any',yr:f.yr,cat:c,sort:'name',n:30});}",
     "go('findpart',{v:'res',q:'',vb:f.vb,vm:f.vm,cc:f.cc,bs:'Any',yr:f.yr,ed:f.vm!=='Any'?f.ed||'Any':'Any',cat:c,sort:'name',n:30});}")
sub1("function m2SecsV(p){const {vb,vm}=p,yr=p.yr||'Any';const A=m2A({...p,yr});const sc=catScope(A);const ttl=m2Bike({vb,vm,yr});",
     "function m2SecsV(p){const {vb,vm}=p,yr=p.yr||'Any';const A=m2A({...p,yr});const sc=catScope(A);const ttl=m2Bike({vb,vm,yr,ed:p.ed});")
# the "choose model year" page: the same lines
sub1("const Y=fpYrs({vb,vm});const ys=Y==='wait'?[]:Y.ys||[];if(!ys.length)return m2SecsV({...p,v:'secs',yr:'Any'});\n const row=y=>{const sc=catScope(m2A({vb,vm,yr:y}));",
     "const V=fpVers(vb,vm);const ys=V==='wait'?[]:V.map(g=>g.lab);if(ys.length<2)return m2SecsV({...p,v:'secs',yr:'Any',ed:ys[0]||'Any'});\n const row=y=>{const sc=catScope(m2A({vb,vm,ed:y}));")
sub1("<button class=\"m2-row\" onclick=\"go('findpart',{v:'secs',vb:'${m2Q(vb)}',vm:'${m2Q(vm)}',yr:'${m2Q(y)}'})\">",
     "<button class=\"m2-row\" onclick=\"go('findpart',{v:'secs',vb:'${m2Q(vb)}',vm:'${m2Q(vm)}',yr:'Any',ed:'${m2Q(y)}'})\">")
sub1("ys.length+' model years from the parts books. Year not listed? Pick the nearest older one.')", "ys.length+' versions from the parts books, newest first. Year not listed? Pick the nearest older one.')")
open(P, 'w', encoding='utf-8').write(a)
print('fpver: ok')
