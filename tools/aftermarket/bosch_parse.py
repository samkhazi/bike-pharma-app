#!/usr/bin/env python3
"""Bosch 2-Wheeler Spares & Accessories price list (July 2026) -> bosch.json for Find Part.
usage: pdftotext -bbox LIST.pdf B.html && bosch_parse.py B.html OUT.json [-v]
The application table (Brand | part number | Product Description | Additional Information | Model Description | MRP) prints one row
per bike maker, so a part number comes many times: its rows are put together (one part, all its makers and bikes).
Rows are found by the gap between them (lines of one row sit 4-9 apart, rows 11.7 apart); "On Request" = no MRP."""
import sys, json, re, collections

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
PN = re.compile(r'^[0-9F] [0-9A-Z]{3} [A-Z0-9]{3} [A-Z0-9]{3}$')
MKN = {'BAJAJ AUTO': 'Bajaj', 'HERO MOTOCORP': 'Hero', 'HERO HONDA': 'Hero', 'HERO': 'Hero', 'HONDA': 'Honda', 'HMSI': 'Honda', 'TVS': 'TVS', 'TVS MOTORS': 'TVS', 'YAMAHA': 'Yamaha', 'SUZUKI': 'Suzuki', 'ROYAL ENFIELD': 'Royal Enfield', 'KTM': 'KTM', 'JAWA': 'Jawa',
       'KAWASAKI': 'Kawasaki', 'KINETIC': 'Kinetic', 'MAHINDRA': 'Mahindra', 'LML': 'LML', 'PIAGGIO': 'Piaggio', 'VESPA': 'Vespa', 'APRILIA': 'Aprilia', 'HUSQVARNA': 'Husqvarna', 'BMW': 'BMW', 'TRIUMPH': 'Triumph', 'HARLEY DAVIDSON': 'Harley-Davidson', 'YEZDI': 'Yezdi', 'BENELLI': 'Benelli', 'DUCATI': 'Ducati'}


def main(src, out_f, v=False):
    html = open(src, encoding='utf-8', errors='replace').read()
    parts, order, odd = {}, [], []
    for pg in re.findall(r'<page[^>]*>(.*?)</page>', html, re.S):
        W = [(float(a), float(b), float(c), float(d), t.replace('&gt;', '>').replace('&lt;', '<').replace('&amp;', '&').replace('&quot;', '"')) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        if not any(t == 'MRP' for *_, t in W): continue
        hx = {t: x0 for x0, y0, x1, y1, t in W if y0 < 70 and t in ('Brand', 'Product', 'Additional', 'Model', 'MRP')}
        if len(hx) < 5: continue
        top = max(y1 for x0, y0, x1, y1, t in W if y0 < 70 and t in ('Description', 'Information', '(₹)')) + 2
        bot = min([y0 for x0, y0, x1, y1, t in W if t == 'Price' and x0 < 60 and y0 > 600] or [1e9]) - 2
        cPn, cDesc, cInfo, cMod, cMrp = 108, hx['Product'] - 12, hx['Additional'] - 6, hx['Model'] - 40, hx['MRP'] - 8
        W = sorted([w for w in W if top < w[1] < bot], key=lambda w: (w[1], w[0]))
        blocks, cur, py = [], [], None
        for w in W:
            if py is not None and w[1] - py > 10.4: blocks.append(cur); cur = []
            cur.append(w); py = max(py or 0, w[1]) if cur[:-1] else w[1]
        if cur: blocks.append(cur)
        for b in blocks:
            col = lambda lo, hi: sp(' '.join(t for x0, y0, x1, y1, t in b if lo <= x0 < hi))
            brand, pn, desc, info, model, mrp = col(0, cPn), col(cPn, cDesc), col(cDesc, cInfo), col(cInfo, cMod), col(cMod, cMrp), col(cMrp, 1e9)
            if not PN.match(pn): odd.append('row without a part number: ' + sp(' '.join(t for *_, t in b))[:90]); continue
            m = re.match(r'^([\d,]+\.\d\d)$', mrp); price = float(m.group(1).replace(',', '')) if m else 0
            if not m and mrp != 'On Request': odd.append('MRP not read: %s %r' % (pn, mrp))
            p = parts.get(pn)
            if not p: p = parts[pn] = {'desc': [], 'info': [], 'mrp': price, 'fits': collections.OrderedDict()}; order.append(pn)
            if desc and desc not in p['desc']: p['desc'].append(desc)
            p['info'].append(info)
            if price and p['mrp'] and price != p['mrp']: odd.append('two MRPs: %s %s %s' % (pn, p['mrp'], price)); p['mrp'] = max(p['mrp'], price)
            p['mrp'] = p['mrp'] or price
            p['fits'].setdefault(brand, [])
            if info and info not in p['fits'][brand]: p['fits'][brand].append('[' + info + ']')      # sorted out below
            for x in re.split(r',\s*(?![^()]*\))', model):
                x = sp(re.sub(r'\((?:P|D|P\+E|P\+GAS)\)\s*', '', re.sub(r'\b[\d.]+ ?Kw\b', '', x)))
                x = sp(x.replace('-->', ' on').replace('-0000.00', 'on').replace('( ', '(').replace(' )', ')'))
                if x and x not in p['fits'][brand]: p['fits'][brand].append(x)
    rows = []
    for pn in order:
        p = parts[pn]; mk = [MKN.get(b.upper(), b.title()) for b in p['fits']]
        same = len(set(p['info'])) == 1                       # the same note on every row: part of the name; else it stays with its maker
        for b in p['fits']: p['fits'][b] = [x for x in p['fits'][b] if not (x.startswith('[') and same)]
        # a number printed as Front for one bike and Rear for another: both are shown
        d0 = p['desc'][0] if p['desc'] else ''
        for d in p['desc'][1:]:
            a, c = d0.rsplit(' ', 1) if ' ' in d0 else (d0, ''), d.rsplit(' ', 1) if ' ' in d else (d, '')
            d0 = d0 + ' / ' + (c[1] if a[0] == c[0] else d)
        p['desc'], p['info'] = d0, (p['info'][0] if same else '')
        fit = '; '.join('%s: %s' % (MKN.get(b.upper(), b.title()), ', '.join(m)) if m else MKN.get(b.upper(), b.title()) for b, m in p['fits'].items())
        nm = sp(p['desc'] + (' ' + p['info'] if p['info'] else ''))
        if len(p['fits']) == 1: fit = ', '.join(list(p['fits'].values())[0]) or fit      # one maker: 'mk' already says it
        bare = re.sub(r'\s*\([^)]*\)', '', fit)
        rows.append({'pn': pn, 'nm': nm, 'mk': mk[0] if len(mk) == 1 else '', 'veh': fit, 'sec': re.split(r'[;,/]', p['desc'])[0].strip() or 'Part', 'mrp': int(p['mrp']) if p['mrp'] == int(p['mrp']) else p['mrp'], 'oem': [], 'fit': fit.upper(), 'hay': sp(nm + ' ' + bare).upper()})
    json.dump({'brand': 'Bosch', 'src': 'Bosch 2-Wheeler Spares & Accessories, prices effective 01-July-2026', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts,', sum(1 for r in rows if r['mrp']), 'with MRP'); print(dict(collections.Counter(r['sec'] for r in rows).most_common()))
    print(dict(collections.Counter(b for p in parts.values() for b in p['fits']).most_common()))
    for o in collections.Counter(odd).most_common(60): print('  ', o[1], o[0])
    if v:
        for r in rows: print(r['pn'], '|', r['nm'], '|', r['mk'], '|', r['mrp'], '|', r['veh'][:150])


if __name__ == '__main__': main(sys.argv[1], sys.argv[2], '-v' in sys.argv)
