#!/usr/bin/env python3
"""21e: Sandhar (SLD / SDA: cables, locks, harness, mirrors, rubber parts, switches, coils...) for Find Part's aftermarket list
(Sam 2026-11-12 "eh sandhar ka catalogues he").
  pdftotext -bbox "MRP PRICE NOV26 SASPL.pdf" S.html && python3 sandhar_parse.py S.html OUT.json
The list is a table (part no, category, description, HSN, MRP); a description runs over 1-5 lines, so the rows are read by word
positions: the HSN number is the last line of a row, the columns come from the page's own header. MRP only (HSN not kept).
Sandhar prints bike names with letters left out (HNDA, PLSR, SPLNDR): the name is spelt out, the printed words stay searchable.
The out file is data: never in git."""
import collections, html, json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
WORD = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')
PNTOK = re.compile(r'^(?=.*\d)[A-Z0-9][A-Z0-9./+()-]*$|^(SLD|SDA)[A-Z0-9./+-]*$')
SPELL = {}
for good, bads in {
    'HONDA': 'HNDA', 'BAJAJ': 'BAJJAJ BAJJ BJAJ BAJJA BAJA', 'HERO': 'HRO', 'TVS': 'TVSSS TVSSSS TTVS TVX', 'SUZUKI': 'SUZKI SUZAKI', 'YAMAHA': 'YAMHA YMAHA',
    'PULSAR': 'PLSR PULSR PLUSAR', 'SPLENDOR': 'SPLENDER SPLNDR SLPNDR SLPENDR SPLDR SPLEND', 'ACTIVA': 'ACTVA', 'DISCOVER': 'DESCOVER DSCVR DISCVER DSVR DISCVR',
    'PASSION': 'PASSON PASION PASISON PASSN PSSN', 'GLAMOUR': 'GLMR GLAMOR GLAMR', 'SHINE': 'SHNE SHIN SHN', 'APACHE': 'APCHE', 'PLATINA': 'PLTINA PLTNA PLTN PLATNA',
    'UNICORN': 'UNICRN UNICON', 'JUPITER': 'JUPITOR JUPIER', 'STAR': 'STARR STARRR', 'DREAM': 'DREM', 'YUGA': 'YUGGA YGA', 'ACCESS': 'ACESS XCESS AXCESS',
    'AVIATOR': 'AVAITOR AVIATER', 'MAESTRO': 'MEASTRO MASTRO', 'VICTOR': 'VCTOR VCTR', 'CITY': 'CTY CITI', 'TWISTER': 'TWSTER', 'BURGMAN': 'BURGAMAN', 'BULLET': 'BULET',
    'CLASSIC': 'CLASIC CALSSIC', 'ENFIELD': 'ENFLD', 'GIXXER': 'GIXXR', 'DAZZLER': 'DAZZLR', 'AMBITION': 'AMBTION', 'PLEASURE': 'PLESURE PLEASUR',
    'STUNNER': 'STUNNR STUNER STNNER', 'XTREME': 'XTRME', 'RADEON': 'RADION REDEON', 'FIERO': 'FIERRO', 'BOXER': 'BOXR', 'CALIBER': 'CLBER', 'HUNK': 'HNK',
    'SPORTS': 'SPRTS', 'DELUXE': 'DELUX DELEX', 'BRAKE': 'BRKE', 'REFLECTOR': 'REFLACTER', 'GAUGE': 'GUAGE', 'REPAIRING': 'REPARING', 'SCOOTY': 'SCOTY', 'PEP': 'PEPP',
    'CENTURO': 'CANTURO', 'MAHINDRA': 'MAHINDR', 'DAWN': 'DWN', 'KING': 'KNIG', 'SAMURAI': 'SAMURI', 'STEERING': 'STERING', 'ROLLER': 'ROLLAR', 'PINION': 'PENION',
    'CARTRIDGE': 'CARTIGE', 'PULLEY': 'PULLY'}.items():
    for b in bads.split(): SPELL[b] = good
full = lambda s: re.sub(r'\bSTR CITY\b', 'STAR CITY', re.sub(r'[A-Z]+', lambda m: SPELL.get(m.group(0), m.group(0)), s.upper()))
MAKER = [('ROYAL ENFIELD', 'Royal Enfield'), ('BULLET', 'Royal Enfield'), ('HERO', 'Hero'), ('HONDA', 'Honda'), ('BAJAJ', 'Bajaj'), ('TVS', 'TVS'), ('YAMAHA', 'Yamaha'), ('SUZUKI', 'Suzuki'),
         ('KTM', 'KTM'), ('MAHINDRA', 'Mahindra'), ('PIAGGIO', 'Piaggio'), ('VESPA', 'Piaggio'), ('LML', 'LML'), ('ATHER', 'Ather')]
SEC = {'CONTROL CABLE': 'Control cable', 'LOCKING ASSEMBLY': 'Lock', 'WIRING HARNESS': 'Wiring harness', 'MIRROR ASSEMBLY': 'Mirror', 'FILTERS': 'Filter', 'REGULATOR': 'Regulator rectifier',
       'PICK UP COIL': 'Pickup coil', 'CDI': 'CDI', 'BLINKERS': 'Indicator', 'RELAYS': 'Relay', 'BULB LAMP': 'Bulb', 'LAMP & LED BULBS': 'Bulb', 'SWING ARM ASSY.': 'Swing arm',
       'CARBON BRUSH KITS': 'Carbon brush', 'CENTER CLUTCH ASSY': 'Clutch center', 'WEIGHT ROLLER (CLUTCH ROLLER)': 'Weight roller', 'CLUTCH PULLY': 'Clutch pulley', 'IGNITOR': 'Ignitor',
       'FAN BELT': 'Drive belt', 'HUB & CENTER': 'Hub centre combo'}


def maker(t):
    u = ' ' + re.sub(r'[^A-Z]+', ' ', t.upper()) + ' '
    got = []
    for k, v in MAKER:
        if ' ' + k + ' ' in u and v not in got: got.append(v)
    return ' / '.join(got[:4])


def read(src):
    pages = re.findall(r'<page width="[\d.]+" height="[\d.]+">(.*?)</page>', open(src, errors='replace').read(), re.S)
    rows, cols, bad = [], None, collections.Counter()
    for pi, p in enumerate(pages):
        W = [(float(a), float(b), float(c), float(d), html.unescape(w)) for a, b, c, d, w in WORD.findall(p)]
        hl = [w for w in W if w[4] == 'HSN'][:1]
        hd = {w[4]: w for w in reversed(W) if hl and abs(w[1] - hl[0][1]) < 6 and w[4] in ('NO', 'CATEGORY', 'DESCRIPTION', 'HSN', 'NEW')}
        hy = 0
        if len(hd) == 5:
            cols = ((hd['NO'][2] + hd['CATEGORY'][0]) / 2 - 2, hd['DESCRIPTION'][0] - 4, hd['HSN'][0] - 8, hd['NEW'][0] - 4); hy = hd['HSN'][1] + 4
        else: bad['page without the header'] += 1
        if not cols: continue
        a, b, c, d = cols
        col = lambda w: 0 if w[0] < a else 1 if w[0] < b else 2 if w[0] < c else 3 if w[0] < d else 4
        H = sorted([w for w in W if col(w) == 3 and re.fullmatch(r'\d{6,8}', w[4]) and w[1] > hy], key=lambda w: w[1])
        prev, used = hy, set()
        # A name that wraps is printed upwards from its row's line (lines 10.1 apart), over the rows above. So: the words on a row's
        # own line are its last line; a line between two rows, or a second line lying on a row's line, belongs to a row below.
        own, D = {}, [w for w in W if col(w) == 2 and w[1] > hy and w[4] != 'DESCRIPTION']
        base = {}                                                            # row -> {y: words} on the row's own line
        for w in D:
            hh = [h for h in H if -2.2 <= w[1] - h[1] <= 0.6]
            if hh: base.setdefault(id(min(hh, key=lambda h: abs(h[1] - 0.6 - w[1]))), {}).setdefault(round(w[1], 2), []).append(w)
        offs = sorted(y - h[1] for h in H for y in (base.get(id(h)) or {}) if len(base[id(h)]) == 1)
        off = offs[len(offs) // 2] if offs else -0.6
        liney = lambda h: min(base.get(id(h)) or {h[1] + off: 0}, key=lambda y: abs(y - h[1] - off))    # y of the row's own last line
        def below(y, i):                                                     # the row under row i whose k-th line up sits at y
            for k in (1, 2, 3, 4):
                if i + k < len(H) and abs(liney(H[i + k]) - 10.1 * k - y) < 0.3 and H[i + k][1] - H[i][1] < 10.1 * k + 4: return H[i + k]
        for i, h in enumerate(H):
            g = base.get(id(h)) or {}
            mine = liney(h) if g else None
            for y, ws in g.items():
                t = h if y == mine else (below(y, i) or (H[i + 1] if i + 1 < len(H) else h))
                for w in ws: own[id(w)] = id(t)
            if len(g) > 1:                                                   # two lines printed on each other: equal words were kept once
                ys = sorted(g, key=lambda y: min(w[0] for w in g[y]))
                for y in ys[1:]:
                    x0 = min(w[0] for w in g[y])
                    for w in g[ys[0]]:
                        if w[0] < x0 - 1: dup = w[:4] + (w[4],); W.append(dup); D.append(dup); own[id(dup)] = own[id(g[y][0])]
        for w in D:
            if id(w) in own: continue
            i = max([k for k, h in enumerate(H) if h[1] < w[1]], default=-1)
            t = below(w[1], i) if i >= 0 else None
            if t is None and i < 0:
                t = next((H[k - 1] for k in (1, 2, 3, 4) if k <= len(H) and abs(liney(H[k - 1]) - 10.1 * (k - 1) - w[1]) < 0.6), None)
            if t: own[id(w)] = id(t)
        for h in H:
            lo, hi = prev + 3, h[1] + 3
            cell = lambda k: sorted([w for w in W if col(w) == k and lo < w[1] <= hi and w[1] > hy and w[4] not in ('CATEGORY', 'DESCRIPTION') or 0], key=lambda w: (round(w[1] / 3), w[0]))
            m = sorted([w for w in W if col(w) == 4 and abs(w[1] - h[1]) < 9 and re.fullmatch(r'[\d,]+(\.\d+)?', w[4])], key=lambda w: abs(w[1] - (h[1] - 2.7)))
            pn, cat = cell(0), cell(1)
            desc = sorted([w for w in W if col(w) == 2 and (own[id(w)] == id(h) if id(w) in own else lo < w[1] <= hi and w[1] > hy and w[4] != 'DESCRIPTION')], key=lambda w: (round(w[1] / 3), w[0]))
            for w in pn + cat + desc: used.add(id(w))
            # a wide category starts inside the part-number column: only the leading number-like words are the part number
            j = 0
            while j < len(pn) and not PNTOK.match(pn[j][4].upper()): j += 1
            k = j
            while k < len(pn) and PNTOK.match(pn[k][4].upper()) and (k == j or pn[k][4] in ('A', 'B') or re.fullmatch(r'[\d/-]+', pn[k][4])): k += 1
            r = {'pg': pi + 1, 'pn': ' '.join(w[4].upper() for w in pn[j:k]), 'cat': sp(' '.join(w[4] for w in pn[:j] + pn[k:] + cat)), 'desc': sp(' '.join(w[4] for w in desc)), 'mrp': m[0][4] if m else ''}
            if not r['pn']: bad['row without a part number'] += 1
            elif not r['desc']: bad['row without a name'] += 1
            elif not m: bad['row without MRP'] += 1
            else: rows.append(r)
            prev = h[1]
        n = sum(1 for w in W if col(w) < 3 and w[1] > hy and id(w) not in used and w[4] not in ('SLD', 'PART', 'NO', 'CATEGORY', 'DESCRIPTION'))
        if n: bad['words under no row'] += n
    return rows, bad


def main(src, out_f):
    rows, bad = read(src); out, seen = [], set()
    for r in rows:
        pn = r['pn'].replace(' ', '')
        mrp = int(round(float(r['mrp'].replace(',', ''))))
        if pn in seen or mrp <= 0: bad['same number twice or MRP 0'] += 1; continue
        seen.add(pn)
        cat = r['cat'].upper(); sec = SEC.get(cat) or cat.capitalize() or 'Part'
        own = r'\s*'.join(re.escape(ch) for ch in pn)                                               # some names end with their own number
        d0 = sp(re.sub(r'[-( ]*' + own + r'\s*\)?\s*$', '', r['desc'], flags=re.I))
        if d0.upper().startswith(cat + ' ' + cat): d0 = d0[len(cat) + 1:]
        nm = full(d0)
        # a name that is only the bike ("EV-1", "UG3 180CC") gets its kind in front, so a search by the part's name finds it
        kw = [w for w in re.findall(r'[A-Z]{4,}', (cat + ' ' + sec).upper()) if w not in ('ASSEMBLY', 'ASSY', 'KITS', 'PARTS')]
        if sec not in ('Rubber parts', 'Sheet metal', 'Part') and not any(w[:5] in nm for w in kw): nm = sp(sec.upper() + ' ' + nm)
        out.append({'pn': pn, 'nm': nm, 'mk': maker(nm), 'veh': '', 'sec': sec, 'mrp': mrp, 'oem': [], 'fit': '', 'hay': sp(nm + ' ' + ' '.join(w for w in d0.upper().split() if w not in nm.split()))})
    json.dump({'brand': 'Sandhar', 'src': "Sandhar MRP list Nov 2026", 'rows': out}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(out), '| with maker', sum(1 for r in out if r['mk']), '| not read:', dict(bad) or 'nothing')
    return out


if __name__ == '__main__':
    main(*sys.argv[1:3])
