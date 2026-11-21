#!/usr/bin/env python3
"""Uno Minda 2W Electrical Catalogue (January 2025, 188 pages) -> rows for unominda.json.
usage: pdftotext -bbox CAT.pdf U.html && unominda_elec.py U.html OUT.json [OLD_unominda.json] [-v]
Reads the price tables (PART NO. | OEM | DESCRIPTION | APPLICATION | MRP | MOQ): a row starts on the line that carries the part number
and the MRP, the lines under it (wrapped description / application) belong to it. OLD = the list already in the app: its parts stay,
a part in both keeps the higher MRP (Sam's rule)."""
import sys, json, re, collections

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
OEM = {'BAJJ': 'Bajaj', 'HIRO': 'Hero', 'HNDA': 'Honda', 'TVSM': 'TVS', 'YMHA': 'Yamaha', 'SZKI': 'Suzuki', 'REML': 'Royal Enfield', 'KNTC': 'Kinetic', 'MHDR': 'Mahindra', 'PIAG': 'Piaggio', 'LMLL': 'LML', 'LMLS': 'LML', 'KTMM': 'KTM', 'UNIV': '', 'EV': '', 'HIR': 'Hero'}
CODES = set(OEM) | {'LMLS', 'KTMS', 'JAWA', 'MAHI', 'VESP', 'APRL', 'ATHR', 'OLAE', 'BMWM', 'KWSK'}
W = {'PLSR': 'PULSAR', 'DSCVR': 'DISCOVER', 'PLTNA': 'PLATINA', 'BXR': 'BOXER', 'CLBR': 'CALIBER', 'CHTK': 'CHETAK', 'AVNGR': 'AVENGER', 'SPLDR': 'SPLENDOR', 'PSN': 'PASSION', 'GLMR': 'GLAMOUR', 'MSTRO': 'MAESTRO', 'PLSURE': 'PLEASURE', 'DSTNY': 'DESTINI', 'DUT': 'DUET',
     'ACT': 'ACTIVA', 'AVTR': 'AVIATOR', 'GRZA': 'GRAZIA', 'GRZIA': 'GRAZIA', 'UNCRN': 'UNICORN', 'SHN': 'SHINE', 'ETRN': 'ETERNO', 'JPTR': 'JUPITER', 'APCH': 'APACHE', 'WGO': 'WEGO', 'ACCS': 'ACCESS', 'SWSH': 'SWISH', 'GSTO': 'GUSTO', 'VSPA': 'VESPA', 'NVA': 'NOVA',
     'BLLT': 'BULLET', 'CLSC': 'CLASSIC', 'FSCNO': 'FASCINO', 'HBS': 'HANDLE BAR SWITCH', 'SWT': 'SWITCH', 'SWITH': 'SWITCH', 'UNIV': 'UNIVERSAL', 'STR': 'STAR', 'SPRT': 'SPORT', 'CTY': 'CITY', 'KARZMA': 'KARIZMA', 'XTRM': 'XTREME', 'HNK': 'HUNK'}


def oe_numbers(html, known):
    """The picture pages: a card per part (part number on top, name, bikes, and on its last line the maker's own number, e.g.
    SW-0630F -> DK201034 DK201071). Taken only when that last line stands apart from the bike names and is nothing but one or two numbers."""
    res = collections.defaultdict(list)
    for pg in re.findall(r'<page[^>]*>(.*?)</page>', html, re.S):
        if '>APPLICATION<' in pg and '>MOQ<' in pg: continue
        Wd = [(float(a), float(b), float(c), t.replace('&amp;', '&')) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        ys = []
        for w in sorted((w for w in Wd if w[3] in known), key=lambda w: w[1]):
            if ys and w[1] - ys[-1][0] <= 3: ys[-1][1].append(w)
            else: ys.append([w[1], [w]])
        for bi, (y0, ps) in enumerate(ys):
            y1 = ys[bi + 1][0] - 2 if bi + 1 < len(ys) else 800
            ps.sort(); cx = [(p[0] + p[2]) / 2 for p in ps]
            for i, p in enumerate(ps):
                lo = (cx[i - 1] + cx[i]) / 2 if i else 0; hi = (cx[i] + cx[i + 1]) / 2 if i + 1 < len(ps) else 600
                ws = sorted([w for w in Wd if y0 + 4 < w[1] < y1 and lo <= (w[0] + w[2]) / 2 < hi and w[3] not in known], key=lambda w: w[1])
                if not ws: continue
                last = [w for w in ws if ws[-1][1] - w[1] <= 2]; prev = [w for w in ws if ws[-1][1] - w[1] > 2]
                if not prev or last[0][1] - prev[-1][1] < 9: continue
                tk = [w[3] for w in sorted(last) if w[3] not in CODES and w[3] != 'YHMA']
                if not tk or len(tk) > 2 or any(not re.match(r'^[A-Z0-9][A-Z0-9-]{6,}$', x) or len(re.findall(r'\d', x)) < 4 or re.match(r'^\d{4}-\d{2,4}$', x) for x in tk): continue
                for x in tk:
                    if x not in res[p[3]]: res[p[3]].append(x)
    return res


def main(src, out_f, old_f=None, v=False):
    html = open(src, encoding='utf-8', errors='replace').read()
    rows, odd, seen = [], collections.Counter(), {}
    for pi, pg in enumerate(re.findall(r'<page[^>]*>(.*?)</page>', html, re.S)):
        if '>APPLICATION<' not in pg or '>MOQ<' not in pg: continue
        Wd = [(float(a), float(b), float(c), t.replace('&amp;', '&').replace('&gt;', '>').replace('&lt;', '<').replace('&quot;', '"').replace('&apos;', "'")) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        hy = [y for x, y, x1, t in Wd if t == 'APPLICATION'][0]
        hx = {t: x for x, y, x1, t in Wd if abs(y - hy) < 3}
        title = sp(' '.join(t for x, y, x1, t in sorted(Wd) if hy - 60 < y < hy - 8 and re.match(r'^[A-Z&/]+$', t)))
        cM, cQ = hx['MRP'] - 8, hx['MOQ'] - 2
        lines = collections.defaultdict(list)
        for x, y, x1, t in Wd:
            if hy + 6 < y < 800: lines[round(y)].append((x, x1, t))
        merged = []                                        # lines 1-2 apart are one line (the part number sits a hair under its text)
        for y in sorted(lines):
            if merged and y - merged[-1][0] <= 2: merged[-1][1].extend(lines[y])
            else: merged.append([y, list(lines[y])])
        # the columns sit at other places on other pages and even in the tables of one page: the description starts right after the
        # maker code, the application at the x where most lines start a new piece of text after a gap. One table = the lines under a
        # category row (STARTER RELAY, FLASHER ...).
        def cols(ls):
            cD = collections.Counter(); cA = collections.Counter()
            for y, ws in ls:
                for i, (x, x1, t) in enumerate(ws):
                    if i and t in CODES and x < 160 and i + 1 < len(ws) and ws[i + 1][0] < 200: cD[round(ws[i + 1][0])] += 1
                    if 240 < x < cM - 20 and (i == 0 or x - ws[i - 1][1] > 9): cA[round(x)] += 1
            return (cD.most_common(1)[0][0] - 3, cA.most_common(1)[0][0] - 3) if cD and cA else None
        for y, ws in merged: ws.sort()
        pcol = cols(merged)
        if not pcol: continue                              # a picture page
        is_cat = lambda ws: ws[0][0] < 60 and len(ws) < 6 and all(re.match(r'^[A-Z&/()-]+$', t) and t not in CODES for x, x1, t in ws)
        segcol = {}; k = 0; seg = []
        for i, (y, ws) in enumerate(merged + [(0, [(0, 0, 'END')])]):
            if is_cat(ws):
                c = cols(seg) or pcol
                for j in range(k, i): segcol[j] = c
                k = i; seg = []
            else: seg.append((y, ws))
        cat = ''; cur = None
        for li, (y, ws) in enumerate(merged):
            cD, cA = segcol.get(li, pcol)
            first = ws[0][0]
            has_mrp = any(cM <= x and re.match(r'^[\d,]+(\.\d+)?$', t) for x, x1, t in ws)
            col = lambda lo, hi: sp(' '.join(t for x, x1, t in ws if lo <= x < hi))
            left = [t for x, x1, t in ws if x < cD]; code = left[-1] if left and left[-1] in CODES else ''
            if first < cD - 20 and not code and not has_mrp and cur and not cur['pn'] and len(left) == 1 and re.search(r'\d', left[0]) and y - cur['y'] < 13:
                cur['pn'] = left[0]; cur['d'].append(col(cD, cA)); cur['a'].append(col(cA, cM))      # the part number printed one line under its row
            elif first < cD - 20 and (has_mrp or code):
                if not has_mrp: odd['no MRP on its own line, left without MRP p%d: %s' % (pi + 1, ' '.join(left))] += 1
                cur = {'y': y, 'pn': ' '.join(left[:-1] if code else left), 'oem': code, 'd': [col(cD, cA)], 'a': [col(cA, cM)], 'mrp': col(cM, cQ) if has_mrp else '', 'cat': cat, 'title': title, 'pg': pi + 1}; rows.append(cur)
                if not code and v: odd['no maker code p%d: %s' % (pi + 1, cur['pn'])] += 1
            elif first < cD - 20:
                t = sp(' '.join(t for x, x1, t in ws))
                if re.match(r'^[A-Z][A-Z &/()-]+$', t) and len(t) < 45: cat = t; cur = None
                elif re.search(r'First Choice|Easy Fitment', t): cur = None
                else: odd['line not placed p%d: %s' % (pi + 1, t[:60])] += 1
            elif cur and first >= cD - 3:
                cur['d'].append(col(cD, cA)); cur['a'].append(col(cA, cM))
            elif re.match(r'^\d{1,3}$', sp(' '.join(t for x, x1, t in ws))): pass      # page number
            else: odd['line not placed p%d: %s' % (pi + 1, sp(' '.join(t for x, x1, t in ws))[:60])] += 1
    out = []; exp = lambda t: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), t.upper()))
    for r in rows:
        pn = re.sub(r'^(SW-\d{4}) ([A-Z])$', r'\1\2', r['pn'])
        if not re.match(r'^[A-Z0-9][A-Z0-9/.-]{4,}( \(?[A-Z0-9]{1,4}\)?)?$', pn): odd['odd part no. p%d: %s' % (r['pg'], pn)] += 1; continue
        desc, app = sp(' '.join(x for x in r['d'] if x)), sp(' '.join(x for x in r['a'] if x))
        mrp = float(r['mrp'].replace(',', '')) if re.match(r'^[\d,]+(\.\d+)?$', r['mrp']) else 0
        if pn in seen:                                     # printed again in a second table (new products): the higher MRP stays, a new bike name is added
            o = seen[pn]
            if mrp > o['mrp']: o['mrp'] = int(mrp) if mrp == int(mrp) else mrp; odd['part no. twice with two MRPs, higher kept: %s' % pn] += 1
            if app and app.upper() not in o['veh'].upper() and not all(w in o['veh'].upper() for w in app.upper().replace('/', ' ').split()):
                o['veh'] = sp(o['veh'] + ' / ' + app); o['fit'] = sp(o['fit'] + ' / ' + exp(app)); o['hay'] = sp(o['hay'] + ' ' + exp(app))
            continue
        mk = OEM.get(r['oem'], r['oem'].title())
        full = exp(desc + ' ' + app)
        kind = (r['cat'] or r['title']).capitalize()
        seen[pn] = r0 = {'pn': pn, 'nm': desc, 'mk': mk, 'veh': app, 'sec': kind, 'mrp': int(mrp) if mrp == int(mrp) else mrp, 'oem': [], 'fit': exp(app), 'hay': sp(kind.upper() + ' ' + full)}; out.append(r0)
    oe = oe_numbers(html, set(seen))
    for r in out: r['oem'] = oe.get(r['pn'], [])
    # 3-wheeler only parts are left out of every aftermarket list
    tw = lambda r: all(re.search(r'3W|\bAPE\b|\bKNG\b', x) for x in r['veh'].upper().split('/') if x.strip() and x.strip() not in ('LPG', 'CNG', 'DIESEL', 'PETROL')) and bool(r['veh'])
    n3 = sum(1 for r in out if tw(r)); out = [r for r in out if not tw(r)]
    print(n3, '3-wheeler parts left out;', sum(1 for r in out if r['oem']), 'parts with the maker\'s own number (OE)')
    n_new = len(out); src_s = 'Uno Minda 2W Electrical Catalogue, January 2025'
    if old_f:
        old = json.load(open(old_f)); have = {r['pn']: r for r in out}; kept = hi = 0
        for r in old['rows']:
            if r['pn'] not in have: out.append(r); kept += 1
            elif (r.get('mrp') or 0) > (have[r['pn']]['mrp'] or 0): have[r['pn']]['mrp'] = r['mrp']; hi += 1
        print('old list:', len(old['rows']), 'parts,', kept, 'only there (kept),', hi, 'had a higher MRP (kept the higher)'); src_s = old.get('src', '') + ' + ' + src_s
    json.dump({'brand': 'Uno Minda', 'src': src_s, 'rows': out}, open(out_f, 'w'), ensure_ascii=False)
    print(n_new, 'parts from the electrical catalogue,', sum(1 for r in out[:n_new] if r['mrp']), 'with MRP;', len(out), 'in all'); print(dict(collections.Counter(r['sec'] for r in out[:n_new]).most_common())); print(dict(collections.Counter(r['mk'] for r in out[:n_new]).most_common()))
    for k, n in odd.most_common(50): print('  ', n, k)
    if v:
        for r in out[:n_new]: print(r['pn'], '|', r['nm'], '|', r['mk'], '|', r['veh'], '|', r['sec'], '|', r['mrp'], '|', ' '.join(r['oem']))


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if x != '-v']; main(a[0], a[1], a[2] if len(a) > 2 else None, '-v' in sys.argv)
