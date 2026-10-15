"""Suzuki Intruder 150 in Find Part (Sam 2026-10-15, catalogue thread): "model introdue 150 select karta hun aur year me kuch bhi option
nhi aata", wants an Intruder bearing. Sam's Suzuki folder has no Intruder 150 book, only price-list parts (brands_build.py now gives them
the years of the price list's model codes, 2018-2021, and keeps GL150 parts that only the Gixxer books list). The Intruder 150 has the
Gixxer 155 engine, so its part page and its search results also offer the same search in the Gixxer (check the number).
Patches public/app.html in place: python3 tools/szfix.py"""
import os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'app.html')
a = open(P, encoding='utf-8').read()
if 'function m2AllLoad' in a:
    raise SystemExit('szfix: already in')


def sub1(o, n):
    global a
    assert a.count(o) == 1 or n in a, o[:80]
    a = a.replace(o, n) if n not in a else a


sub1("const XR_PLAT=[\n", "const XR_PLAT=[\n ['Suzuki',/^Intruder 150/,'Suzuki',['Gixxer','Gixxer SF'],'Same 155 engine as the Gixxer: engine and wheel parts often match (check the number)'],\n")
# results inside one model: a sister bike with the same engine -> the same words searched there
sub1("function m2ResView(p){", "function m2SisLine(A,p){if(p.cat||!p.q||A.vm==='Any')return '';const o=xrSis({vb:A.vb,vms:[A.vm]})[0];if(!o||!o.ms.length)return '';\n"
     " return `<div class=\"card\" style=\"gap:6px\"><div class=\"cap\">${esc(A.vm)}: ${esc(o.why)}</div><div class=\"row wrap\" style=\"gap:6px\">${o.ms.slice(0,3).map(m=>`<button class=\"chip\" onclick=\"xrGoSis('${m2Q(o.sb)}','${m2Q(m)}','${m2Q(p.q)}')\">${esc(p.q)} in ${esc(o.sb)} ${esc(m)}</button>`).join('')}</div></div>`;}\n"
     "function m2ResView(p){")
sub1("return `${fpVia()}${spellH}${R.alt", "return `${fpVia()}${spellH}${m2SisLine(A,p)}${R.alt")
# Sam 2026-10-15 11:12Z "bearing search karta hun toh jitne bhi bearing hote hein sabhi show hona he ... sabhi brands ke sabhi catalogues ke
# liye": with Any brand a part-name search used only the catalogues loaded so far ("pick the brand first"); now it starts loading every
# brand's file and the results grow as each arrives (the "Searching N more catalogues" line shows while they come).
sub1("function m2ResView(p){xrLoad();altLoad();const A=m2A(p);",
     "function m2AllLoad(A,p){if(A.vb!=='Any'||!(p.q||p.cat)||(p.q&&fpIsPn(p.q)))return;const u=CAT_ALL.filter(e=>M2_CNT[e.vb]&&e.st===0&&!CAT_EXT.includes(e));\n"
     " if(u.length){u.forEach(e=>CAT_EXT.push(e));setTimeout(()=>catLoad(),0);}}\n"
     "function m2ResView(p){xrLoad();altLoad();const A=m2A(p);m2AllLoad(A,p);")
sub1("return `${fpVia()}${spellH}${m2SisLine(A,p)}", "return `${fpVia()}${spellH}${m2SisLine(A,p)}${A.vb==='Any'&&list.length&&catPend().length?`<div class=\"cap\">${catPendTxt(catPend())}</div>`:''}")
# every match, not the first 600 (Sam: "jitne bhi bearing hote hein sabhi"); the list still shows 30 at a time with Show more
a = a.replace("catSearch({...A,lim:600})", "catSearch({...A,lim:1e6})").replace("q:al.alt,lim:600})", "q:al.alt,lim:1e6})").replace("q:q2,lim:600})", "q:q2,lim:1e6})")
open(P, 'w', encoding='utf-8').write(a)
print('szfix: ok')
