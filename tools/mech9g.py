"""Update 9g (Sam 2026-10-16 "aur bhi ... jitna kiye hein utna chhodke"): 82 more mechanics' names that were not in Find Part yet
(big end, valve shim, allen bolt, banjo washer, selector fork, cush drive, starter solenoid, head light bowl...), from the catalogue
part names that had none; each checked on Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, RE and KTM. List: tools/mech9g_words.json.
usage: python3 tools/mech9g.py public/app.html tools/mech9g_words.json"""
import sys, json
P, J = sys.argv[1], sys.argv[2]
a = open(P, encoding='utf-8').read()
if 'more mechanics\' names (update 9g)' in a: raise SystemExit('already done')
X = json.load(open(J, encoding='utf-8'))
old = "/* words people add that no part name has (\"throttle cable for XL\") */"
if a.count(old) != 1: raise SystemExit('anchor not found')
a = a.replace(old, "/* more mechanics' names (update 9g): tools/mech9g_words.json */\n(()=>{const W=CAT_WORDS,X=" + json.dumps(X, separators=(',', ':')) +
    ";for(const [k,v] of Object.entries(X))W[k]=[...new Set([...(W[k]||[]),...v])];})();\n" + old)
open(P, 'w', encoding='utf-8').write(a)
print('ok', len(X))
