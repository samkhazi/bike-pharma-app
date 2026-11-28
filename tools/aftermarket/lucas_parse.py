#!/usr/bin/env python3
"""Lucas TVS two wheeler starter motor catalogue (w.e.f. November 2025) -> lucastvs.json for Find Part.
usage: lucas_parse.py CAT.txt(pdftotext -layout) OUT.json [-v]
Each box: the bikes, Part No, Type, Customer Part No (= the bike maker's own number). The catalogue prints no MRP."""
import sys, json, re, collections

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
HEAD = re.compile(r'^(BAJAJ AUTO LIMITED|HERO MOTOR CORP|HONDA|ROYAL ENFIELD|KAWASAKI|SUZUKI|TVS MOTOR|TVS|YAMAHA)(/(HONDA|ROYAL ENFIELD|KAWASAKI|SUZUKI|TVS MOTOR|TVS|YAMAHA))?$')
MK = [('Hero', r'SMART|SPLENDOR|PASSION|GLAMOUR|PLEASURE|HF DELUXE|CD DELUXE|DESTINI|DUET|MAESTRO|XOOM|XTREME|KARIZMA|MAVRICK|CBZ|AMBITION|HUNK|IMPULSE|XPULSE|ACHIEVER|IGNITOR'),
      ('Honda', r'ACTIVA|AVIATOR|DIO|CLIQ|NAVI|CD-110|DREAM|TWISTER|STUNNER'), ('Bajaj', r'DISCOVER|PULSAR'), ('Royal Enfield', r'HIMALAYAN|CLASSIC|THUNDERBIRD|ELECTRA'), ('Kawasaki', r'KAWASAKI'),
      ('Suzuki', r'ACCESS|SWISH|BURGMAN|LETS'), ('TVS', r'APACHE|FLAME|JIVE|PHOENIX|VICTOR|JUPITER|TORQ|NTORQ|PEP|RADEON|STAR ?SPORT|STAR ?CITY|WEGO|ZEST|TVS'), ('BMW', r'BMW'), ('Yamaha', r'RAY|ALPHA|FASCINO|FZ|FAZER')]
FIX = [(r'\bMavrick\b', 'Mavrick Maverick'), (r'N -Torq', 'Ntorq'), (r'starsport', 'Star Sport'), (r'Starcity', 'Star City'), (r'Dream yuga', 'Dream Yuga')]


def oem(s):
    s = sp(s); return [s] if s else []


def main(src, out_f, v=False):
    L = open(src, encoding='utf-8', errors='replace').read().replace('\f', '\n').split('\n')
    rows, name, odd, seen = [], [], [], {}
    start = False
    for i, l in enumerate(L):
        t = sp(l)
        if HEAD.match(t): start = True; name = []; continue
        if not start or not t or re.match(r'^\d{1,2}$', t) or t.startswith('LTVS/'): continue
        m = re.match(r'^Part No\s*:\s*(\d{8}[A-Z]?)\s*(?:\((.*?)\))?\s*$', t)
        if m:
            pn, note = m.group(1), sp(m.group(2) or '')
            typ = cust = ''
            for x in L[i + 1:i + 6]:
                x = sp(x)
                a = re.match(r'^Type\s*:\s*(.*)$', x); b = re.match(r'^Customer Part No\s*:\s*(.*)$', x)
                if a: typ = a.group(1)
                if b: cust = b.group(1); break
            bikes = sp(' '.join(name)).replace('/ ', '/').replace(' /', '/').replace('/', ' / '); name = []
            if not bikes: odd.append('no bike name: ' + pn); continue
            note = {'w/o wiring harness': 'without wiring harness', 'w/o wiring': 'without wiring harness', 'with wiring': 'with wiring harness'}.get(note, note)
            fit = bikes
            for a, b in FIX: fit = re.sub(a, b, fit)
            U = fit.upper(); mk = [n for n, rx in MK if re.search(r'\b(' + rx + r')', U)]
            if pn in seen: odd.append('part no. twice: ' + pn); continue
            seen[pn] = 1
            nm = sp('Starter motor ' + bikes + (' (' + note + ')' if note else '') + (' ' + typ if typ else ''))
            rows.append({'pn': pn, 'nm': nm, 'mk': mk[0] if len(mk) == 1 else '', 'veh': bikes, 'sec': 'Starter motor', 'mrp': 0, 'oem': oem(cust), 'fit': sp(U + (' ' + note.upper() if note else '')), 'hay': sp('STARTER MOTOR SELF MOTOR ' + U + ' ' + typ.upper())})
            continue
        if re.match(r'^(Type|Customer Part No)\s*:', t): continue
        name.append(t)
    json.dump({'brand': 'Lucas TVS', 'src': 'Lucas TVS two wheeler starter motor catalogue, November 2025', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts,', sum(1 for r in rows if r['oem']), 'with the maker\'s number'); print(dict(collections.Counter(r['mk'] for r in rows)))
    for o in odd: print('  ', o)
    if v:
        for r in rows: print(r['pn'], '|', r['nm'], '|', r['mk'], '|', r['oem'])


if __name__ == '__main__': main(sys.argv[1], sys.argv[2], '-v' in sys.argv)
