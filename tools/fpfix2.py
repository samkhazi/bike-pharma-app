"""Update 9a: Find Part fixes from the 5-round review (Sam 2026-10-15 "aur find part ko bhi 5 baar reivew kar").
- Spelling: a word the catalogue itself misspells ("CLUCTH DOG" in Yamaha) is still corrected when a far more common close word exists.
- A diagram's table is sorted by ref and lists each ref + number once (not again for "Holder LH" vs "Holder Left Hand").
- A part number typed with spaces ("91005 K0L D00") is searched as a number when every word has a digit.
- An aftermarket number shows its aftermarket part without "0 parts / not found" under it.
- Fits text: "iQube (Base, ...)" not "iQube (· Base, ...)"; the bracket is the year only when it is a year.
- Year list: no "· ·" when a year was taken out of the middle of a version name.
- MRP: found when the price list writes the number another way (22100K0NDU2 = 22100-K0N-DU2).
- Lines with no number are listed once per name in the results.
usage: python3 fpfix2.py public/app.html"""
import sys
P = sys.argv[1]
a = open(P, encoding='utf-8').read()
if 'function catSpLow' in a: raise SystemExit('already done')
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:80]}')
    a = a.replace(old, new)
# spelling
sub("function catSpWord(w,D){const max=catSpMax(w);if(!max||D.f.has(w)||",
    """/* a word the catalogue has only a few times while a close word is 30x more common: the catalogue's own typo (Yamaha "CLUCTH DOG") */
function catSpLow(w,D){const n=D.f.get(w);if(!n||n>3)return false;const max=catSpMax(w);if(!max)return false;
 for(let L=w.length-max;L<=w.length+max;L++)for(const v of (D.by.get(L)||[]))if(v!==w&&D.f.get(v)>=30*n&&dlev(w,v,max)<=max)return true;return false;}
function catSpWord(w,D){const max=catSpMax(w),low=D.f.has(w)&&catSpLow(w,D);if(!max||D.f.has(w)&&!low||""")
sub("(D.by.get(L)||[]).forEach(v=>{const d=dlev(w,v,max);if(d<=max)c.push(",
    "(D.by.get(L)||[]).forEach(v=>{if(low&&(v===w||D.f.get(v)<30*D.f.get(w)))return;const d=dlev(w,v,max);if(d<=max)c.push(")
sub("if((!c.hits.length||c.fuzzy)&&A.q){const sp=catSpell(A.q,A.vb);",
    "if(A.q&&(!c.hits.length||c.fuzzy||catSpTypo(A.q,A.vb))){const sp=catSpell(A.q,A.vb);")
sub("const R={list:c2.hits,c:c2,label:c2.label,spell:{q:q2,fix}};",
    "const R={list:c.hits.length&&!c.fuzzy?c2.hits.concat(c.hits.filter(r=>!c2.hits.includes(r))):c2.hits,c:c2,label:c2.label,spell:{q:q2,fix}};")
sub("function catSpell(q,vb){",
    "function catSpTypo(q,vb){const D=catSpDict(vb);return String(q||'').trim().split(/\\s+/).some(t=>{const n=catNorm(t);return n&&!n.includes(' ')&&!/\\d/.test(n)&&catSpLow(n,D);});}\nfunction catSpell(q,vb){")
# diagram table: by ref, one line per ref + number
sub("const seen=new Set();const tr=rows.filter(r=>{const k=String(r.ref||'')+'|'+(r.pk||'')+'|'+r.desc;if(seen.has(k))return false;seen.add(k);return true;});",
    "const seen=new Set();const tr=rows.filter(r=>{const k=String(r.ref||'')+'|'+(r.pk||r.desc);if(seen.has(k))return false;seen.add(k);return true;}).sort(m3By);")
sub("m3K=q=>String(q.ref||'')+'|'+(q.pk||'')+'|'+q.desc;", "m3K=q=>String(q.ref||'')+'|'+(q.pk||q.desc);")
# numbers typed with spaces
sub("(qw.length<=2||!/\\s/.test(q))", "(qw.length<=2||!/\\s/.test(q)||qw.every(w=>/\\d/.test(w)))", 2)
# aftermarket number: no "not found" under its card
sub(" let body;\n if(!list.length){",
    " let body;const amH=p.cat?'':amRes(p.q),amOwn=!!amH&&AM_PK&&AM_PK.has(catPk(p.q));\n if(amOwn&&(!list.length||c&&c.fuzzy))body=`<div class=\"cap\">No original catalogue line has this number. The aftermarket part is above.</div>`;\n else if(!list.length){")
sub("${p.cat?'':amRes(p.q)}${m2Head(count,", "${amH}${amOwn&&(!list.length||c&&c.fuzzy)?'':m2Head(count,")
sub("pictures are cut from the catalogue diagrams':''))}${list.length?sort:''}",
    "pictures are cut from the catalogue diagrams':''))}${list.length&&!(amOwn&&c&&c.fuzzy)?sort:''}")
# amRes: a confirmed part that is also exact only once
sub(".concat(amNear(k).filter(p=>!no.has(amKey(p))&&!ok.has(amKey(p))));\n if(!own.length&&!ex.length)return '';",
    ".concat(amNear(k).filter(p=>!no.has(amKey(p))&&!ok.has(amKey(p)))).filter((p,i,L)=>L.findIndex(q=>amKey(q)===amKey(p))===i);\n if(!own.length&&!ex.length)return '';")
# fits text
sub("return m+' ('+vs.map(v=>v.replace(m+' ','').replace(",
    "return m+' ('+vs.map(v=>(v.startsWith(m)?v.slice(m.length):v).replace(/^[\\s·]+/,'').replace(")
sub("hit.includes('(')?hit.slice(hit.indexOf('(')+1,-1):'';",
    "hit.includes('(')&&/^\\d/.test(hit.slice(hit.indexOf('(')+1))?hit.slice(hit.indexOf('(')+1,-1):'';", 2)
# year list
sub(".replace(/^[\\s·\\-–:,]+|[\\s·\\-–:,]+$/g,'')", ".replace(/·(?:\\s*·)+/g,'·').replace(/^[\\s·\\-–:,]+|[\\s·\\-–:,]+$/g,'')")
# MRP written another way
sub("mrp:catMrpFix(r[5],d.mrp&&d.mrp[r[5]]||0)", "mrp:catMrpFix(r[5],catMrpOf(d,r[5]))")
sub("function catMrpFix(pn,m){",
    "function catMrpOf(d,pn){if(!d.mrp||!pn)return 0;const v=d.mrp[pn];if(v)return v;if(!d._mk){d._mk=new Map();for(const k in d.mrp)if(d.mrp[k]&&!d._mk.has(catPk(k)))d._mk.set(catPk(k),d.mrp[k]);}return d._mk.get(catPk(pn))||0;}\nfunction catMrpFix(pn,m){")
# results: lines with no number once per name
sub("const m2Uniq=list=>{const seen=new Set();return list.filter(r=>{if(!r.pk)return true;if(seen.has(r.vb+'|'+r.pk))return false;seen.add(r.vb+'|'+r.pk);return true;});};",
    "const m2Uniq=list=>{const seen=new Set();return list.filter(r=>{const k=r.vb+'|'+(r.pk||'~'+catNorm(r.desc||''));if(seen.has(k))return false;seen.add(k);return true;});};")
open(P, 'w', encoding='utf-8').write(a)
print('ok')
