#!/usr/bin/env python3
"""24j: Lumax "2W Lighting NPD - Feb'26" (new products with MRP, 5 pages) added to the Lumax list (Sam 2026-11-21).
  pdftotext -bbox NPD.pdf NPD.html && python3 lumax_npd.py NPD.html OUT.json OLD_lumax.json [-v]
Columns: Sr No | Launched Month | SAP Code | Part No. | Description | picture | MRP | Std Pkg/MOQ. One row can hold two part numbers
(LH + RH: each gets the MRP; a lens + an assembly on one MRP: left without MRP, it is not sure whose it is). Two MRPs in one box =
the old one struck out, the lower printed one is the new MRP. RE Compact (3-wheeler) rows are left out. A part already in OLD keeps
its name and bike and gets the MRP (higher stays)."""
import json, re, sys
from collections import Counter

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
W = {'SHIN': 'SHINE', 'SHNE': 'SHINE', 'MSTRO': 'MAESTRO', 'JUPTR': 'JUPITER', 'CTY': 'CITY', 'SPL': 'SPLENDOR', 'SPLDR': 'SPLENDOR', 'SPRT': 'SPORT', 'PLSR': 'PULSAR', 'PULSR': 'PULSAR', 'SZ': 'SUZUKI', 'SUZKI': 'SUZUKI', 'ACCS': 'ACCESS',
     'PSN': 'PASSION', 'DREM': 'DREAM', 'SPR': 'SUPER', 'AP': 'APACHE', 'PLITNA': 'PLATINA', 'PLTNA': 'PLATINA', 'PLTN': 'PLATINA', 'ACTVA': 'ACTIVA', 'GLMR': 'GLAMOUR', 'DSCVR': 'DISCOVER', 'AVGR': 'AVENGER', 'BJJ': 'BAJAJ',
     'UNIVRSL': 'UNIVERSAL', 'CLR': 'CLEAR', 'CLER': 'CLEAR', 'AMB': 'AMBER', 'AMBR': 'AMBER', 'FRNT': 'FRONT', 'ASSY': 'ASSEMBLY', 'CROME': 'CHROME', 'SOKER': 'SOAKER', 'HOLDR': 'HOLDER', 'WT': 'WITH', 'BLK': 'BLINKER', 'ISMRT': 'ISMART'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))
MK = [('Honda', r'SHIN|SHNE|ACTIVA|ACTVA|DREM|HONDA'), ('Hero', r'MSTRO|SPL|SPLDR|GLMR|CD 100|NXG|PSN|DESTINI|ISMRT'), ('TVS', r'JUPTR|APACHE|STAR|XL|RADON|AP'), ('Bajaj', r'PLSR|PULSR|PLTNA?|PLITNA|CTY 110 X|DSCVR|AVGR|BJJ'),
      ('Suzuki', r'ACCESS|ACCS|SZ|SUZKI'), ('Yamaha', r'FZ'), ('Royal Enfield', r'HUNTER')]
TYPE = re.compile(r"^(LED )?(H/L|HL|T/L|TAIL LIGHT|B/L|BL|LICENCE LAMP|FRONT BLK)( LED)?( DRL)?( (ASSY|UNIT|LENS|GLASS))?( LED| DRL| WT HOLDR)*\s*")


def kind(pn, d):
    c = (re.search(r'-(HL[AUG]|DRL|TL[AUL]|BL[AL]|LLA)\b', pn) or [0, ''])[1]
    if 'BULB' in d.upper() and not c: return 'Bulb'
    return {'H': 'Head lamp', 'D': 'Head lamp', 'T': 'Tail lamp', 'B': 'Blinker lens' if c == 'BLL' else 'Blinker', 'L': 'Number plate lamp'}.get(c[:1], 'Lighting')


def main(src, out_f, old_f, v=False):
    old = json.load(open(old_f)); have = {r['pn']: r for r in old['rows']}
    pre = {}
    for p, c in Counter((r['pn'][:3], r['mk']) for r in old['rows']).most_common(): pre.setdefault(p[0], p[1])
    rows, odd, n3, cP, cDs = [], [], 0, [205], [320]
    for pg in re.findall(r'<page[^>]*>(.*?)</page>', open(src, encoding='utf-8', errors='replace').read(), re.S):
        Wd = [(float(a), float(b), float(c), t.replace('&amp;', '&').replace('&apos;', "'")) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        srs = sorted((y, t) for x, y, x1, t in Wd if x < 50 and re.match(r'^\d{1,2}$', t))
        if not srs: continue
        h = min([b[0] - a[0] for a, b in zip(srs, srs[1:])] or [56])          # the rows of a page are equally high, the Sr No sits in the middle
        for y0, sr in srs:
            ws = sorted([w for w in Wd if abs(w[1] - y0) < h / 2 - 2 and w[0] >= 50], key=lambda w: (round(w[1] / 3), w[0]))
            lines = []
            for w in sorted(ws, key=lambda w: w[1]):
                if lines and w[1] - lines[-1][0] <= 2.5: lines[-1][1].append(w)
                else: lines.append([w[1], [w]])
            prices = [int(t.replace(',', '')) for x, y, x1, t in ws if 465 <= x < 512 and re.match(r'^[\d,]+$', t)]
            items, cont = [], []                           # [part no., description, x-middle of the part no., of the description]
            for y, lw in lines:
                cells = []
                for w in sorted(w for w in lw if w[0] < 465 and not re.match(r"^[A-Z][a-z]{2}.\d\d$", w[3])):
                    if cells and w[0] - cells[-1][1] <= 14: cells[-1][1] = w[2]; cells[-1][2] += ' ' + w[3]
                    else: cells.append([w[0], w[2], w[3]])
                if cells and re.match(r'^6\d{6,7}(/\d+)*$', cells[0][2]) and len(cells) == 1: items.append(['', '', 0, 0])      # its number and name stand on the lines above and under it
                elif cells and re.match(r'^6\d{6,7}(/\d+)*$', cells[0][2]):
                    cP.append((cells[1][0] + cells[1][1]) / 2); cDs += [(cells[2][0] + cells[2][1]) / 2] if len(cells) > 2 else []
                    items.append([cells[1][2], cells[2][2] if len(cells) > 2 else '', (cells[1][0] + cells[1][1]) / 2, (cells[2][0] + cells[2][1]) / 2 if len(cells) > 2 else 0])
                else: cont += [c for c in cells if not re.match(r'^6\d{6,7}(/\d+)*$', c[2])]
            if not items or not prices: odd.append('row %s not read: %s' % (sr, sp(' '.join(w[3] for w in ws))[:90])); continue
            for c in sorted(cont, key=lambda c: c[0]) if not items[-1][0] else cont:                                 # a second line of a box: it belongs to the column it stands under
                m = (c[0] + c[1]) / 2; it = items[-1]
                if abs(m - (it[2] or sorted(cP)[len(cP) // 2])) < abs(m - (it[3] or sorted(cDs)[len(cDs) // 2])): it[0] += ('' if not it[0] or it[0].endswith('-') else ' ') + c[2]
                else: it[1] = sp(it[1] + ' ' + c[2])
            mrp = min(prices)                              # two prices in the box: the old one is struck out, the lower one stands
            if len(prices) > 1: odd.append('row %s: two MRPs %s in the box, the struck-out higher one dropped' % (sr, prices))
            names = [d for p, d, a, b in items if d]
            pair = len(items) > 1 and (len(set(names)) <= 1 or all(re.search(r'\b[LR]H\b', d) for d in names) or re.search(r'LH/ ?RH', ' '.join(names)))
            for p, d, a, b in items:
                d = d or names[0]
                if len(items) > 1 and len(names) > 1 and re.search(r'LH/ ?RH', names[-1]) and not re.search(r'\b[LR]H\b', names[0]): d = sp(names[0] + ' ' + names[-1])
                if re.search(r'RE COMPA?C?T?\b', d): n3 += 1; continue
                m = mrp if len(items) == 1 or pair else 0
                if not m: odd.append('row %s: %s shares one MRP box with another kind of part, left without MRP' % (sr, p))
                rows.append((sp(p), sp(d), m))
    out = list(old['rows']); n_new = n_mrp = 0
    for pn, d, mrp in rows:
        if pn in have:
            if mrp > (have[pn].get('mrp') or 0): have[pn]['mrp'] = mrp; n_mrp += 1
            continue
        mk = pre.get(pn[:3]) if re.match(r'^\d{3}-', pn) else None
        if 'UNIV' in d.upper() and pn[:3] not in pre: mk = ''
        if mk is None: mk = next((k for k, rx in MK if re.search(r'\b(%s)\b' % rx, d.upper())), '')
        veh = sp(TYPE.sub('', d.upper())) or d
        k = kind(pn, d)
        r = {'pn': pn, 'nm': d, 'mk': mk, 'veh': veh, 'sec': k, 'mrp': mrp, 'oem': [], 'fit': full(veh), 'hay': sp(k.upper() + ' ' + full(d))}
        have[pn] = r; out.append(r); n_new += 1
    old['rows'] = out; old['src'] = sp(old.get('src', '').replace('(no MRP in it)', '')) + " + 2W Lighting NPD Feb'26 (MRP)"
    json.dump(old, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts in the new products list:', n_new, 'new,', n_mrp, 'already there got their MRP;', n3, '3-wheeler parts left out;', len(out), 'in all,', sum(1 for r in out if r.get('mrp')), 'with MRP')
    for o in odd: print('  ', o)
    if v:
        for pn, d, mrp in rows: r = have[pn]; print(pn, '|', r['nm'], '|', r['mk'], '|', r['veh'], '|', r['sec'], '|', r['mrp'])


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if x != '-v']; main(a[0], a[1], a[2], '-v' in sys.argv)
