#!/usr/bin/env python3
"""Consolidated Engineers engine parts catalogue & price list (rates 1 April 2025, compiled from Aroma Engineering lists) -> ce.json.
usage: ce_parse.py CAT.txt(pdftotext -layout of the table version) OUT.json BRAND [--mrp] [-v]
Ranges: connecting rod kits, crank pins, camshaft assemblies, engine valves (SPL / CML grade), valve guides, rocker arms, steering
cone sets, cylinder block kits. 3-wheeler and marine engine parts are left out.
The list prints "Rate ... ex-factory"; it is stored as MRP only with --mrp (when Sam says the rate is the MRP): the per piece / per set
rate, never the box rate."""
import sys, json, re, collections

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
RANGE = {'Connecting Rod Kits': 'Connecting rod kit', 'Crank Pins': 'Crank pin', 'Camshaft Assemblies': 'Camshaft assembly', 'Engine Valves - Grade SPL': 'Engine valve set (SPL grade)', 'Engine Valves - Grade CML': 'Engine valve set (CML grade)',
         'Valve Guides': 'Valve guide', 'Rocker Arms': 'Rocker arm', 'Steering Cone Sets': 'Steering cone set', 'Cylinder Block Kits': 'Cylinder block kit'}
ROW = re.compile(r'^ ?([0-9][0-9A-Z]{5,11})\s{3,}(.*?)\s{2,}((?:(?:[\d,]+\.\d\d|-|N\.A\.|\d{1,3})\s*)+)$')
MAKE = re.compile(r'^ ?([A-Z][A-Za-z0-9 -]+?) \((\d+)\)$')


def main(src, out_f, brand, mrp_ok=False, v=False):
    rows, kind, mk, skip, seen, odd, n = [], '', '', False, {}, [], collections.Counter()
    for l in open(src, encoding='utf-8', errors='replace').read().replace('\f', '\n').split('\n'):
        t = sp(l)
        if t in RANGE and 'Page' not in l: kind = RANGE[t]; continue
        m = MAKE.match(l.rstrip())
        if m and kind: mk = m.group(1); skip = bool(re.search(r'3-Wheeler|Marine', mk)); continue
        m = ROW.match(l.rstrip())
        if not m or not kind: continue
        pn, model, nums = m.group(1), sp(m.group(2)), m.group(3).split()
        if skip or re.search(r'DIESEL|\b3/W\b', model): n['3-wheeler / marine left out'] += 1; continue
        price = [float(x.replace(',', '')) for x in nums if re.match(r'^[\d,]+\.\d\d$', x)]
        extra = ''
        if kind == 'Cylinder block kit':                  # Model | Bore (mm) | Finish | Material | Rate
            c = re.split(r'\s{2,}', l.strip())
            if len(c) != 6: odd.append('cylinder block columns: ' + t); continue
            model, price = c[1], [float(c[5].replace(',', ''))]
            extra = ', bore %s mm%s, %s' % (c[2], '' if c[3] == '-' else ', ' + c[3], c[4])
        if not price: odd.append('no rate: ' + t)
        if pn in seen: odd.append('part code twice: ' + t); continue
        seen[pn] = 1
        r = price[0] if price and mrp_ok else 0
        rows.append({'pn': pn, 'nm': kind + ' ' + model + extra, 'mk': mk, 'veh': model, 'sec': re.sub(r' \(.*', '', kind), 'mrp': int(r) if r == int(r) else r, 'oem': [], 'fit': (mk + ' ' + model).upper(), 'hay': sp(kind + ' ' + mk + ' ' + model).upper()})
    json.dump({'brand': brand, 'src': 'Consolidated Engineers engine parts catalogue, rates 1 April 2025', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts,', sum(1 for r in rows if r['mrp']), 'with MRP'); print(dict(collections.Counter(r['sec'] for r in rows))); print(dict(collections.Counter(r['mk'] for r in rows))); print(dict(n))
    for o in odd: print('  ', o)
    if v:
        for r in rows: print(r['pn'], '|', r['nm'], '|', r['mk'], '|', r['mrp'])


if __name__ == '__main__': main(sys.argv[1], sys.argv[2], sys.argv[3], '--mrp' in sys.argv, '-v' in sys.argv)
