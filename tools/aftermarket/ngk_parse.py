#!/usr/bin/env python3
"""24k: NGK (Niterra India) "2-Wheeler Application Chart" of spark plugs, October 2024, for Find Part's aftermarket list (Sam 2026-11-21).
  pdftotext -bbox CHART.pdf CHART.html; python3 ngk_parse.py CHART.pdf OCR400.json CHART.html OUT.json OCR520.json OCR320.json [-v]   (needs pymupdf, numpy)
One page: Company | Model Recommendation List | Conventional (Good) | G-Power (Better) | Iridium IX (Best). Most letters are drawings,
so the page is read by OCR (rapidocr, three sizes; boxes [x0,y0,x1,y1,text,conf]) and the few lines the PDF does hold as text are added (and four lines by eye, see EYE).
A plug number is taken only when two readings agree on it. The rows and the company blocks are taken from the drawing (the thin
line under every row, the orange band between companies), so a line of bikes can only land in its own row. The 3-wheeler table at the foot is left out. No MRP in the chart.
One part per plug number: all bikes it is recommended for, company by company."""
import json, re, sys
from collections import Counter

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
PLUG = re.compile(r'^[A-Z]{2,6}\d[A-Z0-9]*(-\d[A-Z0-9]*)?$')
MAKER = [('HERO MOTO', 'Hero'), ('HONDA MOTORCYCLE', 'Honda'), ('BAJAJ AUTO', 'Bajaj'), ('TVS MOTOR', 'TVS'), ('INDIA YAMAHA', 'Yamaha'), ('SUZUKI MOTORCYCLE', 'Suzuki'), ('ROYAL ENFIELD', 'Royal Enfield'), ('PIAGGIO', 'Piaggio'),
         ('BENELLI', 'Benelli'), ('KAWASAKI', 'Kawasaki'), ('KINETIC', 'Kinetic'), ('MAHINDRA', 'Mahindra'), ('LML', 'LML')]
TIER = ['Conventional', 'G-Power', 'Iridium IX']
# four lines of bikes no reading catches (the OCR skips them at every size): read by eye from the picture, each goes in front of
# the line that follows it in its row
EYE = [('HF-Deluxe Eco, HF Deluxe', 'Splendor (All models), Passion (All models), Passion Pro FI BS-6, CD (All models), Street, Street Smart, Joy,'),
       ('6), FZ-X & FZ-S V4.0', "FZ-FI, SZ- RR 2.0, SZ-S, FZ-S, FZ-S FI 150cc (model from Aug'18), FZ 16 (150cc), FZ-FI V3.0 (BS-6), FZS-FI V3.0 (BS-"),
       ('Fazar-F', "Ray (model upto Feb'2015), Ray-Z (model upto Feb'2015), Alpha (model upto Feb'2015), Enticer, Gladiator, YBX,"),
       ('(ABS Single Channel) & 350KS/ES', 'Classic 350 (ABS Single Channel) (BS-6), Classic 350 Signals (BS-6), Classic 350 (ABS Dual Channel) (BS-6), Bullet 350')]


def fixtxt(t):                                             # names: O for 0 beside a digit, l for I in FI
    t = re.sub(r'(?<=\d)O+(?=[\dOcM ,/)]|$)|(?<=\d)O(?=O)', lambda m: '0' * len(m.group(0)), sp(t))
    return re.sub(r'\bFl\b', 'FI', t).replace('Machism0', 'Machismo').replace('Le0ncin0', 'Leoncino').replace('Le0ncino', 'Leoncino')


def main(pdf_f, src, text_f, out_f, *others, v=False):
    reads = []
    for f in (src,) + others:
        b = json.load(open(f))[0]; k = 4000 / max(max(x[2] for x in b), 1) * (max(x[2] for x in json.load(open(src))[0]) / 4000)
        reads.append([[x[0] * k, x[1] * k, x[2] * k, x[3] * k, sp(x[4]), x[5]] for x in b])
    W = max(x[2] for x in reads[0]); s = W / 3719.0          # the places below were measured on the 400 dpi reading (3719 wide)
    end = min([x[1] for x in reads[0] if '3 Wheeler Spark Plugs' in x[4]] or [1e9]) - 60 * s
    top = min([x[1] for x in reads[0] if 'Model Recommendation List' in x[4] and x[1] < end] or [0])
    col = lambda x: 0 if x < 2940 * s else 1 if x < 3300 * s else 2
    # plug numbers: place -> the three readings
    plugs = []
    for ri, r in enumerate(reads):
        for x in r:
            if x[0] > 2560 * s and top < x[1] < end and PLUG.match(x[4].replace(' ', '')):
                c, y = col((x[0] + x[2]) / 2), (x[1] + x[3]) / 2
                p = next((p for p in plugs if p['c'] == c and abs(p['y'] - y) < 16 * s), None)
                if not p: p = {'c': c, 'y': y, 'v': []}; plugs.append(p)
                p['v'].append(re.sub(r'(?<=[A-Z]{2}\d[A-Z])1(?=-)|(?<=[A-Z]{2}\d[A-Z]{2})1(?=-)', 'I', x[4].replace(' ', '')))      # LKAR8AI-9: a 1 there is the letter I
    odd = []
    for p in plugs:
        t, n = Counter(p['v']).most_common(1)[0]
        p['t'] = t if n >= 2 or len(reads) == 1 else ''
        if not p['t']: odd.append('plug number not sure, left out: %s' % dict(Counter(p['v'])))
    # model lines: the best reading of each line, plus the lines the PDF holds as text
    lines = []
    def put(x0, y, t, conf):
        l = next((l for l in lines if abs(l[1] - y) < 13 * s), None)
        if not re.search(r'[A-Za-z]{2}', t) or re.match(r'^-+$', t): return
        if l is None: lines.append([x0, y, t, conf])
        elif conf > l[3] or (conf == l[3] and len(t) > len(l[2])): l[0], l[2], l[3] = x0, t, conf
    for r in reads:
        for x in r:
            if 840 * s < x[0] < 2500 * s and top + 30 * s < x[1] < end and not PLUG.match(x[4]): put(x[0], (x[1] + x[3]) / 2, x[4], x[5])
    pg = open(text_f, encoding='utf-8', errors='replace').read(); k = 400 / 72.0 * s      # points -> the 400 dpi reading
    tl = {}
    for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg):
        if 150 < float(a) < 460: tl.setdefault(round((float(b) + float(d)) / 2), []).append((float(a), t.replace('&amp;', '&').replace('&apos;', "'").replace('’', "'")))
    for y, ws in tl.items():
        if top < y * k < end: put(min(w[0] for w in ws) * k, y * k, ' '.join(t for x, t in sorted(ws)), 2)      # real text beats a reading
    for nxt, t in EYE:
        l = next((l for l in lines if l[2].startswith(nxt)), None)
        if l: lines.append([l[0], l[1] - 40 * s, t, 3])
        else: odd.append('the line read by eye has lost its place: ' + nxt)
    lines.sort(key=lambda l: l[1])
    # rows and blocks from the drawing itself: beside the plug numbers a thin black line closes every row, an orange band every
    # company block (pale yellow = inside a row)
    import pymupdf, numpy as np
    pm = pymupdf.open(pdf_f)[0].get_pixmap(dpi=400); a = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3].astype(int)
    x = int(2592 / 4000 * pm.width); strip = a[:, x - 3:x + 3, :].mean(axis=1)
    ky = (W / 3719.0)                                      # the readings are scaled to the 400 dpi one, the picture is 400 dpi
    kind = ['row' if (c[0] > 200 and c[1] > 200) else 'line' if c.max() < 110 else 'gap' if (c[0] > 200 and c[1] < 190) else 'other' for c in strip]
    spans, y0 = [], None                                   # (top, bottom, block no.)
    blk = 0; last = None
    for y in range(int(top / ky), int(min(end / ky, pm.height - 1))):
        kd = kind[y]
        if kd == 'row' and y0 is None: y0 = y
        if kd != 'row' and y0 is not None:
            if y - y0 > 25: spans.append((y0 * ky, y * ky, blk))
            y0 = None
        if kd == 'gap' and last != 'gap': blk += 1
        if kd in ('gap', 'row', 'line'): last = kd
    rows = [{'y0': a0, 'y1': b0, 'b': bl, 'p': {}, 'l': []} for a0, b0, bl in spans]
    def row_at(y): return next((r for r in rows if r['y0'] <= y < r['y1']), None)
    for p in plugs:
        if not p['t']: continue
        r = row_at(p['y'])
        if r is None: odd.append('plug number outside the rows: ' + p['t']); continue
        r['p'].setdefault(p['c'], []).append((p['y'], p['t']))          # a twin spark row holds two plug numbers in a box
    for l in lines:
        r = row_at(l[1])
        if r is None: odd.append('line outside the rows: ' + l[2][:50]); continue
        r['l'].append(l)
    for r in rows:
        if r['l'] and not r['p']: odd.append('row without a plug number: ' + r['l'][0][2][:50])
        if r['p'] and not r['l']: odd.append('row without bikes: %s' % r['p'])
        if r['l'] and (r['l'][0][1] - r['y0'] > 52 * s or r['y1'] - r['l'][-1][1] > 52 * s or any(b[1] - a0[1] > 60 * s for a0, b in zip(r['l'], r['l'][1:]))): odd.append('a line may be missing in the row of: ' + r['l'][0][2][:50])
    rows = [r for r in rows if r['l'] and r['p']]
    # companies: the company boxes are pale yellow runs in the first column, the name stands inside its box
    x = int(335 / 4000 * pm.width); cstrip = a[:, x - 2:x + 2, :].mean(axis=1); cells = []; y0 = None
    for y in range(int(top / ky), int(min(end / ky, pm.height - 1))):
        yel = cstrip[y][0] > 200 and cstrip[y][1] > 200 and cstrip[y][2] < 200
        if yel and y0 is None: y0 = y
        if not yel and y0 is not None:
            if y - y0 > 30: cells.append([y0 * ky, y * ky, None])
            y0 = None
    for x0 in reads[0]:
        for key, m in MAKER:
            if x0[0] < 800 * s and top < x0[1] < end and x0[4].upper().startswith(key):
                c = next((c for c in cells if c[0] <= (x0[1] + x0[3]) / 2 < c[1]), None)
                if c is None or (c[2] or m) != m: odd.append('company name not placed: ' + x0[4])
                else: c[2] = m
    for c in cells:
        if not c[2]: odd.append('company box without a name at %d' % c[0])
    parts = {}; shown = []
    for r in rows:
        mk = next((c[2] for c in cells if c[0] <= (r['y0'] + r['y1']) / 2 < c[1]), None)
        if mk is None: odd.append('row without a company: ' + r['l'][0][2][:40]); continue
        r['p'] = {c: [t for y, t in sorted(v)] for c, v in r['p'].items()}
        models = fixtxt(' '.join(l[2] for l in r['l'])); shown.append((mk, r['p'], models))
        for c, ts in r['p'].items():
            for t in ts:
                p = parts.setdefault(t, {'tier': c, 'fit': []}); p['fit'].append((mk, models))
                if p['tier'] != c: odd.append('%s stands in two columns' % t)
    out = []
    for t, p in parts.items():
        by = {}
        for mk, m in p['fit']: by.setdefault(mk, []).append(m)
        veh = ', '.join(list(by.values())[0]) if len(by) == 1 else '; '.join('%s: %s' % (mk, ', '.join(ms)) for mk, ms in by.items()); nm = 'Spark plug, ' + TIER[p['tier']]
        out.append({'pn': t, 'nm': nm, 'mk': list(by)[0] if len(by) == 1 else '', 'veh': veh, 'sec': 'Spark plug', 'mrp': 0, 'oem': [], 'fit': veh.upper(), 'hay': sp(('SPARK PLUG ' + nm + ' ' + veh).upper())})
    json.dump({'brand': 'NGK', 'src': 'NGK 2-Wheeler Application Chart, October 2024 (no MRP in it)', 'rows': out}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'rows,', len(lines), 'lines of bikes,', len(out), 'plug numbers;', dict(Counter(TIER[p['tier']] for p in parts.values())))
    for o in odd: print('  ', o)
    if v:
        for mk, p, m in shown: print(mk, '|', ' / '.join('+'.join(p.get(c, ['-'])) for c in range(3)), '|', m)


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if x != '-v']; main(*a, v='-v' in sys.argv)
