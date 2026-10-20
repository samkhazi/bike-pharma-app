"""Update 10c: Find Part searches the aftermarket catalogues by name too, and reads a misread part number (Sam 2026-10-20 11:24Z-11:27Z).
- A name search ("starter motor pulsar") also lists the aftermarket parts (Varroc, Endurance, Lumax...) whose name, kind of part or bikes have
  every word. Their short forms count: PLSR = Pulsar, PSPR = Passion Pro, RR = regulator rectifier...
- A part number that is in no catalogue is tried again with the letter O read as zero and I as one: the Honda box prints 31220-K0L-D01 in a
  font where 0 looks like O, so "31220KOLD01" now finds 31220-K0L-D01 and says how it was read.
usage: python3 am10c.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function amNameRes' in a: raise SystemExit('already done')

def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)

AMJS = r"""/* ----- aftermarket parts by name (update 10c): every word of the search in the part's name, kind or bikes; the catalogues' short forms count ----- */
const AM_ABBR={PLSR:'PULSAR',PSPR:'PASSION PRO',PASION:'PASSION',SPLNDR:'SPLENDOR',SPLDR:'SPLENDOR',PLTN:'PLATINA',DSVR:'DISCOVER',BOXR:'BOXER',CLBR:'CALIBER',
 NTRQ:'NTORQ',APCH:'APACHE',STRTER:'STARTER',ASSY:'ASSEMBLY',ASSLY:'ASSEMBLY',ACTV:'ACTIVA',SHN:'SHINE',UNCRN:'UNICORN',GLMR:'GLAMOUR'};
const AM_STOP=new Set(['FOR','OF','THE','KA','KI','KE','AND','WITH','PART','PARTS']);
let AM_HAY=null;
const amToks=s=>{const t=new Set();String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').split(' ').forEach(w=>{if(!w)return;t.add(w);if(AM_ABBR[w])AM_ABBR[w].split(' ').forEach(x=>t.add(x));});return [...t];};
/* per part: [all its words, the words of its name] */
function amHay(){if(AM_HAY||!AM)return AM_HAY;AM_HAY=AM.p.map(p=>[amToks([AM.b[p[0]],p[2],p[3],p[5],p[8],...p[9].map(([b,m])=>AM.ob[b]+' '+m)].join(' ')),amToks(p[2])]);return AM_HAY;}
const amWordIn=(w,T)=>T.some(t=>t===w||(w.length>=3&&t.startsWith(w))||(w.length>=4&&w.endsWith('S')&&t===w.slice(0,-1)));
function amName(q,vb){if(!q||fpIsPn(q)||!amLoad())return [];const W=catNorm(q).split(' ').filter(w=>w&&!AM_STOP.has(w));if(!W.length||W.every(w=>w.length<3))return [];
 /* the parts whose name has more of the words first */
 const H=amHay(),out=[];H.forEach(([T,N],i)=>{if(!W.every(w=>amWordIn(w,T)))return;const p=amP(i);if(vb&&vb!=='Any'&&p.fm.length&&!p.fm.some(([b])=>b===vb))return;p.sc=W.filter(w=>amWordIn(w,N)).length;out.push(p);});return out.sort((x,y)=>y.sc-x.sc);}
function amNameRes(q,A){const L=amName(q,A.vb);if(!L.length)return '';const all=!!S.ui.amNAll,n=all?L.length:6;
 return `<div class="sec"><h3 class="h2">Aftermarket parts</h3><span class="cap">${L.length}</span></div><div class="stack g8">${L.slice(0,n).map(p=>amRow(p)).join('')}</div>${L.length>6?`<button class="link" onclick="S.ui.amNAll=!S.ui.amNAll;refresh()">${all?'Show less':'Show all '+L.length+' aftermarket parts'}</button>`:''}<div class="cap">From the aftermarket catalogues (${esc([...new Set(L.map(p=>p.b))].join(', '))}).</div>`;}
/* a part number in no catalogue, read again: O as zero and I as one (Honda boxes print 0 like O) */
function pnMisreads(q){const u=String(q||'').trim().toUpperCase(),o=new Set();[[/O/g,'0'],[/I/g,'1']].forEach(([x,y])=>{if(x.test(u))o.add(u.replace(x,y));});if(/O/.test(u)&&/I/.test(u))o.add(u.replace(/O/g,'0').replace(/I/g,'1'));o.delete(u);return [...o];}
function ocrVia(q,to){return `<div class="row cap fp-via">${ic('search','s16')}<span class="grow" style="overflow-wrap:anywhere">No part number <b class="num">${esc(String(q).trim().toUpperCase())}</b>. Showing <b class="num">${esc(to)}</b> (the letter O read as zero${/1/.test(to)&&/I/i.test(q)?', I as one':''}).</span></div>`;}
"""

sub("/* ----- the part's own page ----- */\nfunction m2PartV0(", AMJS + "/* ----- the part's own page ----- */\nfunction m2PartV0(")
# a misread number: tried after the alternate numbers
sub("if(c2&&c2.hits.length)return {list:c2.hits,c:c2,label:c2.label,alt:al};}}\n",
    "if(c2&&c2.hits.length)return {list:c2.hits,c:c2,label:c2.label,alt:al};}\n  for(const q2 of pnMisreads(A.q)){const c2=catSearch({...A,q:q2,lim:1e6});if(c2&&c2.loading)return {loading:c2};if(c2&&c2.hits.length)return {list:c2.hits,c:c2,label:c2.label,ocr:q2};}}\n")
sub("${R.alt?altVia(p.q,R.alt):", "${R.ocr?ocrVia(p.q,R.ocr):R.alt?altVia(p.q,R.alt):")
# aftermarket parts for a name search
sub("let body;const amH=p.cat?'':amRes(p.q),", "let body;const amH=p.cat?'':(amRes(p.q)||amNameRes(p.q,A)),")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
