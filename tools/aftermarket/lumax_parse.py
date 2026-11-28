#!/usr/bin/env python3
"""24d: Lumax lighting (head lamps, tail lamps, blinkers ...) for Find Part's aftermarket list (Sam 2026-11-20).
  python3 lumax_parse.py OCR.json OUT.json [OCR2.json OCR3.json] [-v]
The catalogue ("2W Lighting Catalogue CTC", 2026) is a picture book: its letters are drawings, so there is no text to copy. OCR.json is
its pages read by OCR (rapidocr; boxes [x0,y0,x1,y1,text,conf] per page). Three readings (300 dpi as the eye sees it = OCR.json, plus two more
given after OUT.json): a number must be the same in two of them. Checked by eye: a lone 0 in a letter ending is the letter O (-OM, -OR, -OD,
-O/C, MSTR-O). The "new products" boxes of the last pages are laid out another way and are left out.
A picture has: bike (short name), one or more "what - NUMBER" lines, Description. No MRP and no original numbers in the catalogue.
The list drops letters from bike names (SPLDR, PSN, PLESR): the name stays as printed, the search text spells them out. Data: never in git."""
import json, re, sys
from collections import Counter

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
CODE = re.compile(r'\d{3}-[A-Z0-9][A-Za-z0-9/ -]*[A-Za-z0-9]')
MAKERS = {'HRO': 'Hero', 'BJJ': 'Bajaj', 'BJ': 'Bajaj', 'HNDA': 'Honda', 'TVS': 'TVS', 'YMHA': 'Yamaha', 'SZKI': 'Suzuki', 'RYL ENFLD': 'Royal Enfield', 'UNIVERSAL': '', 'MHNDRA': 'Mahindra', 'KTM': 'KTM', 'LML': 'LML', 'PIAGGIO': 'Piaggio', 'VSPA': 'Vespa'}
SKIP = re.compile(r'^(LUMAX|LIGHTING|DK JAIN|GROUP|NEW|\d{1,2}|GLOBAL STANDARDS.*)$')
HEADS = re.compile(r'^(HEAD ?LAMPS?( SPARES| LENS| GLASS)?|TAIL ?LAMPS?( SPARES| LENS)?|BLINKER LENS|BLINKERS?|AUXILIARY LAMPS?|FOG LAMPS?|INDICATORS?|REFLECTORS?|SIDE VIEW MIRRORS?|MIRRORS?|AIR FILTER COVERS?|NUMBER PLATE LAMPS?|LICENSE LAMPS?|POSITION LAMPS?)$')
SECT = re.compile(r'^(HEAD ?LAMPS?|TAIL ?LAMPS?|BLINKERS?|AUXILIARY LAMPS?|FOG LAMPS?|INDICATORS?|REFLECTORS?|LENS(ES)?|VISORS?|MIRRORS?|AIR FILTERS?( COVER)?|SIDE VIEW MIRRORS?|BULBS?|ACCESSORIES|PLASTIC PARTS?|[A-Z /&]{6,40})$')
W = {'HNK': 'HUNK', 'KRZMA': 'KARIZMA', 'MSTRO': 'MAESTRO', 'PSN': 'PASSION', 'PLESR': 'PLEASURE', 'SPLDR': 'SPLENDOR', 'ISMRT': 'ISMART', 'SPR': 'SUPER', 'GLMR': 'GLAMOUR', 'XTRM': 'XTREME', 'CBJ': 'CBZ', 'DLX': 'DELUXE',
     'DWN': 'DAWN', 'DESTN': 'DESTINI', 'AVNGR': 'AVENGER', 'PLSR': 'PULSAR', 'DSVR': 'DISCOVER', 'PLTN': 'PLATINA', 'BXR': 'BOXER', 'CHTK': 'CHETAK', 'ACTV': 'ACTIVA', 'AVTR': 'AVIATOR', 'DRM': 'DREAM', 'NIO': 'NEO',
     'SHN': 'SHINE', 'TRGGR': 'TRIGGER', 'TWSTR': 'TWISTER', 'UNCRN': 'UNICORN', 'UNCN': 'UNICORN', 'STNR': 'STUNNER', 'ETRNO': 'ETERNO', 'GRZA': 'GRAZIA', 'XBLD': 'XBLADE', 'JPTR': 'JUPITER', 'APCH': 'APACHE', 'STR': 'STAR',
     'CTY': 'CITY', 'SMRI': 'SAMURAI', 'BLT': 'BULLET', 'ELCTRA': 'ELECTRA', 'HNTR': 'HUNTER', 'ENTCR': 'ENTICER', 'SZKI': 'SUZUKI', 'ACCS': 'ACCESS', 'FRNT': 'FRONT', 'ASSY': 'ASSEMBLY', 'XPR': 'XPRO'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))
KIND = {'HL': 'Head lamp', 'TL': 'Tail lamp', 'BL': 'Indicator', 'SV': 'Mirror', 'AF': 'Air filter cover'}


def fixpn(c):
    c = re.sub(r'\s*/\s*', '/', sp(c)).replace(' ', '')
    c = re.sub(r'-0(M|R|D|/C)\b', r'-O\1', c)               # checked by eye: the letter O
    return re.sub(r'(MSTR)-0$', r'\1-O', c)


def main(src, out_f, *others):
    pages = json.load(open(src)); rows, odd, seen = [], [], set()
    # 2 of 3: a number the main reading gives alone is replaced by the one both other readings give for it (0/O, 1/I, a doubled letter)
    key = lambda c: re.sub(r'(.)\1+', r'\1', c.replace('O', '0').replace('I', '1'))
    oth = [{fixpn(m.group(0)) for p in json.load(open(f)) for b in p for m in CODE.finditer(b[4])} for f in others]
    def vote(pn):
        if not oth or any(pn in o for o in oth): return pn
        c = [x for x in oth[0] if key(x) == key(pn) and all(x in o for o in oth)]
        if len(c) == 1: return c[0]
        odd.append('only one reading has ' + pn); return pn
    st = {'mk': None, 'sec': ''}
    for pi, boxes in enumerate(pages):
        if not any(CODE.search(b[4]) for b in boxes): continue
        Wd = max(b[2] for b in boxes); col = lambda b: min(2, int(((b[0] + b[2]) / 2) / (Wd * 1.02 / 3)))
        labels = [b if b[4].strip() == 'Description' else b[:2] + [b[0] + 190] + b[3:] for b in boxes if b[4].strip().startswith('Description')]
        def kind(b):
            t = sp(b[4])
            if SKIP.match(t) or t == 'Description': return 'skip'
            if t.startswith('Description'): return 'desc'
            if HEADS.match(t): return 'sec'
            if CODE.search(t): return 'code'
            if t.startswith(':') or any(abs(b[1] - l[1]) < 90 and b[0] > l[2] - 10 and b[0] - l[2] < 260 and b[1] >= l[1] - 15 for l in labels): return 'desc'
            if t in MAKERS: return 'maker'
            return 'title'
        items, ev = [], []
        for c in range(3):
            cur = None
            for b in sorted([b for b in boxes if col(b) == c], key=lambda b: b[1]):
                k = kind(b); t = sp(b[4])
                if k == 'skip': continue
                if k == 'maker': ev.append((b[1], c, 'mk', MAKERS[t])); cur = None; continue
                if k == 'sec': ev.append((b[1], c, 'sec', t)); cur = None; continue
                if k == 'title':
                    if cur is None or cur['codes']: cur = {'y': b[1], 'c': c, 'title': t, 'codes': [], 'desc': ''}; items.append(cur)
                    else: cur['title'] = sp(cur['title'] + ' ' + t)
                    continue
                if cur is None: odd.append(f'p{pi + 1}: {k} without a bike: {t}'); continue
                if k == 'code': cur['codes'].append(t)
                else: cur['desc'] = sp(cur['desc'] + ' ' + re.sub(r'^Description\s*', '', t).lstrip(': '))
        heads = [it for it in items if not it['codes']]                       # a heading (HEAD LAMPS, BLINKER) has no number under it
        for h in heads: ev.append((h['y'], h['c'], 'sec', h['title']))
        items = [it for it in items if it['codes']]
        ys = sorted({it['y'] for it in items}); rowi = lambda y: sum(1 for i, v in enumerate(ys) if i and v - ys[i - 1] > 120 and v <= y + 60)
        seq = sorted([((rowi(e[0] + 200), e[1], 0), e) for e in ev] + [((rowi(it['y']), it['c'], 1), it) for it in items], key=lambda x: x[0])
        for _, x in seq:
            if isinstance(x, tuple): st[x[2]] = x[3]; continue
            for line in x['codes']:
                m = CODE.search(line); pre = sp(line[:m.start()].rstrip(' -')); post = sp(line[m.end():].strip(' -'))
                for pn in [vote(fixpn(m.group(0)))]:
                    d = sp(x['desc']) or (KIND.get(pn.split('-')[1][:2], 'Part') if '-' in pn else 'Part')
                    r = {'pn': pn, 'nm': sp(d + (' · ' + pre if pre else '') + (' · ' + post if post else '')), 'mk': st['mk'] or '', 'veh': x['title'], 'sec': KIND.get(pn.split('-')[1][:2], 'Lighting'), 'mrp': 0, 'oem': [],
                         'fit': full(x['title']), 'hay': full(d + ' ' + x['title'] + ' ' + pre), 'pg': pi + 1}
                    r['veh'] = sp(re.sub(r'^((HEAD|TAIL) ?LAMPS?( SPARES| LENS| GLASS)?|BLINKERS?( LENS)?)\s+', '', r['veh'])); r['fit'] = full(r['veh'])
                    if re.search(r'\d{7}', r['veh'] + ' ' + r['nm']) or len(r['veh'].split()) > 6 or not x['desc']:      # the "new products" boxes of the last pages are laid out another way: not read
                        odd.append(f"p{pi + 1}: left out {pn} ({r['veh'][:50]})"); continue
                    if st['mk'] is None: odd.append(f'p{pi + 1}: no maker for {pn}')
                    if pn in seen:
                        o = next(q for q in rows if q['pn'] == pn)
                        if x['title'] not in o['veh']: o['veh'] += ' / ' + x['title']; o['fit'] = full(o['veh']); o['hay'] += ' ' + full(x['title'])
                        continue
                    seen.add(pn); rows.append(r)
    json.dump({'brand': 'Lumax', 'src': 'Lumax 2W lighting catalogue 2026 (no MRP in it)', 'rows': [{k: v for k, v in r.items() if k != 'pg'} for r in rows]}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(rows), 'parts', dict(Counter(r['sec'] for r in rows)), dict(Counter(r['mk'] for r in rows)))
    print('not read:', len(odd)); [print('  ', o) for o in odd[:40]]
    return rows


if __name__ == '__main__':
    R = main(*[a for a in sys.argv[1:] if a != '-v'])
    if '-v' in sys.argv:
        for r in R: print(r['pg'], '|', r['mk'], '|', r['veh'], '|', r['pn'], '|', r['nm'])
