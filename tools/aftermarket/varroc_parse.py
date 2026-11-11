#!/usr/bin/env python3
"""20j: Varroc's two-wheeler parts for Find Part's aftermarket list (Sam 2026-11-11 "isse verroc ka lele sirf two wheeler ka").
  python3 varroc_parse.py DIR OUT.json
DIR = the pages of varrocaftermarket.com's public two-wheeler list (collections/2-wheeler/products.json?limit=250&page=N saved as p1.json, p2.json ...;
robots.txt allows the public pages; one page a second). Kept: Varroc's part code, its K number, name, bike maker, kind, MRP (the "compare at" price;
the shop's own selling price is not kept). No photos, no descriptions. Three-wheeler lines are left out. The out file is data: never in git."""
import glob, json, re, sys, os

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
MK = {'Hero Honda': 'Hero', 'Bajaj Kawasaki': 'Bajaj', 'All 2W': '', 'All 2W & 3W & 4W': ''}
GENERIC = {'2W', '3W', '4W', 'Body Parts', 'Electrical & Electronics Parts', 'Engine & Transmission', 'Metallic Parts', 'Rubber Parts', 'Miscellaneous', 'Misc', 'Electrical Wiring',
           'Lighting Parts', 'Filters', 'TPFC', 'Rubber Others', 'Hiker Add'}
MK2 = {'SZK': 'Suzuki', 'HIRO': 'Hero', 'BAJA KTM': 'KTM', 'APRILLIA': 'Aprilia'}
NOT_MK = re.compile(r'^(All |Hiker|Escorts)', re.I)
# the shop writes bike names its own way: spelt out for the bike match and the search (my reading)
WORDS = {'SHAIN': 'SHINE', 'ACTVA': 'ACTIVA', 'PASION': 'PASSION', 'SPLENDER': 'SPLENDOR', 'PLSR': 'PULSAR', 'DSVR': 'DISCOVER', 'PLTN': 'PLATINA', 'GLAMER': 'GLAMOUR', 'DEO': 'DIO',
         'CBZEE': 'CBZ', 'STR': 'STAR', 'VCTR': 'VICTOR', 'TWISTR': 'TWISTER', 'DYUGA': 'DREAM YUGA', 'DNEO': 'DREAM NEO', 'BAJJ': 'BAJAJ', 'HIRO': 'HERO', 'HOONDA': 'HONDA', 'UNICRON': 'UNICORN'}
full = lambda s: re.sub(r'[A-Za-z]+', lambda m: WORDS.get(m.group(0).upper(), m.group(0)), s)


def maker(t):
    t = sp(t)
    if not t or NOT_MK.match(t): return ''
    u = t.upper()
    if u in MK2: return MK2[u]
    return MK.get(t, {'HERO': 'Hero', 'HONDA': 'Honda', 'BAJAJ': 'Bajaj', 'SUZUKI': 'Suzuki', 'YAMAHA': 'Yamaha', 'TVS': 'TVS'}.get(u, t))


CODE = re.compile(r'[\s|-]+([A-Z0-9]{2,6}-[A-Z0-9]{2,8}(?:-[A-Z0-9./]{1,12}){1,2})\s*$')


def main(d, out_f):
    P = {}
    for f in sorted(glob.glob(os.path.join(d, 'p*.json'))):
        for p in json.load(open(f)).get('products', []): P[p['id']] = p
    rows, seen, nocode, three = [], set(), 0, 0
    for p in P.values():
        tags = p.get('tags') or []
        if '3W' in tags or '4W' in tags: three += 1; continue
        v = (p.get('variants') or [{}])[0]; sku = sp(v.get('sku'))
        t = sp(re.sub(r'^Varroc\s+', '', sp(p.get('title')), flags=re.I))
        m = CODE.search(t.upper())
        if m: pn = m.group(1); nm = sp(t[:m.start()]).rstrip(' -|')
        else: pn = sku; nm = t; nocode += 1
        if not pn or pn in seen: continue
        seen.add(pn)
        try: mrp = max(float(v.get('compare_at_price') or 0), 0) or float(v.get('price') or 0)
        except ValueError: mrp = 0
        if mrp <= 0: continue
        kinds = [x for x in tags if x not in GENERIC and not re.search(r'BAJAJ$', x)]
        sec = kinds[-1] if kinds else next((x for x in tags if x not in ('2W',)), 'Part')
        mk = maker(p.get('product_type'))
        rows.append({'pn': pn, 'nm': nm + (' · ' + sku if sku and sku != pn else ''), 'mk': mk, 'veh': '', 'sec': sec, 'mrp': int(round(mrp)), 'oem': [], 'fit': '', 'hay': full(nm)})
    rows.sort(key=lambda r: r['pn'])
    json.dump({'brand': 'Varroc', 'src': 'Varroc aftermarket two-wheeler list (MRP)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('products read', len(P), '| parts kept', len(rows), '| without a part code (K number used)', nocode, '| 3/4 wheeler left out', three)


if __name__ == '__main__':
    main(*sys.argv[1:3])
