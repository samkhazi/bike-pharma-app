"""Update 9f (Sam 2026-10-16 "sabhi parts pe check karo"): mechanics' names checked on every part group of the 8 big brands
(294 names, tools/mech9f_words.json = the names that found nothing or the wrong part: bore = cylinder block + piston kit,
dipstick = oil level gauge, shifter drum = gear shift cam, roller weight, variator, clutch bell, swing arm = Yamaha rear arm...).
Also the Admin "Catalogue files" card on Find Part is one short line (N ready · M waiting for files) instead of every brand.
usage: python3 tools/mech9f.py public/app.html tools/mech9f_words.json"""
import sys, json
P, J = sys.argv[1], sys.argv[2]
a = open(P, encoding='utf-8').read()
if 'mechanics\' names checked on every part (update 9f)' in a: raise SystemExit('already done')
X = json.load(open(J, encoding='utf-8'))
def sub(old, new, count=1):
    global a
    n = a.count(old)
    if n != count: raise SystemExit(f'expected {count} got {n}: {old[:90]}')
    a = a.replace(old, new)
sub("/* words people add that no part name has (\"throttle cable for XL\") */",
    "/* mechanics' names checked on every part (update 9f): tools/mech9f_words.json */\n(()=>{const W=CAT_WORDS,X=" + json.dumps(X, separators=(',', ':')) +
    ";for(const [k,v] of Object.entries(X))W[k]=[...new Set([...(W[k]||[]),...v])];})();\n/* words people add that no part name has (\"throttle cable for XL\") */")
sub("miss.length?miss.map(o=>{const t=cupStat(o);return `${esc(o.brands.join(' + '))}: ${t.n} of ${t.all} files on the server`;}).join(' · ')+'. Upload them to see the diagrams.'",
    "miss.length?`${Object.keys(s).length-miss.length} brands ready · ${miss.length} waiting for files. Tap to upload.`")
sub("const TRX={", "const TRX={\"{0} brands ready\":[\"{0} ಬ್ರ್ಯಾಂಡ್‌ಗಳು ಸಿದ್ಧ\",\"{0} ब्रांड तैयार\"],\"{0} waiting for files. Tap to upload.\":[\"{0} ಫೈಲ್‌ಗಳಿಗಾಗಿ ಕಾಯುತ್ತಿವೆ. ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ.\",\"{0} की फ़ाइलें बाकी हैं। अपलोड करने के लिए टैप करें।\"],")
open(P, 'w', encoding='utf-8').write(a)
print('ok', len(X))
