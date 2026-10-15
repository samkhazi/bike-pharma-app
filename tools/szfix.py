"""Suzuki Intruder 150 in Find Part (Sam 2026-10-15, catalogue thread): "model introdue 150 select karta hun aur year me kuch bhi option
nhi aata", wants an Intruder bearing. Sam's Suzuki folder has no Intruder 150 book, only price-list parts (brands_build.py now gives them
the years of the price list's model codes, 2018-2021, and keeps GL150 parts that only the Gixxer books list). The Intruder 150 has the
Gixxer 155 engine, so its part page and its search results also offer the same search in the Gixxer (check the number).
Patches public/app.html in place: python3 tools/szfix.py"""
import os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'app.html')
a = open(P, encoding='utf-8').read()


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
open(P, 'w', encoding='utf-8').write(a)
print('szfix: ok')
