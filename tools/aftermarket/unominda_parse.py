#!/usr/bin/env python3
"""24c: Uno Minda (brake fluid, air / oil / petrol filters, engine oil, rear view mirrors) for Find Part's aftermarket list (Sam 2026-11-20).
  python3 unominda_parse.py CATALOGUE.txt OUT.json
CATALOGUE = `pdftotext -layout` of Uno Minda's "2WH Mechanical Catalogue April 2024". MRP only. The list has no original (bike maker's)
part numbers: its OEM column is only the bike maker (BAJA, HIRO ...). The picture pages repeat the same numbers and are skipped.
A mirror line prints several numbers (L, R, LD, RD) and one or two prices: with two prices the first is of L / R and the second of
LD / RD (every such line has both kinds). The list drops letters from bike names (PULSR, SPLNDR): the name stays as printed, the
search text spells them out. Data: never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
MK = {'BAJA': 'Bajaj', 'HIRO': 'Hero', 'HNDA': 'Honda', 'REML': 'Royal Enfield', 'SUZI': 'Suzuki', 'SUZU': 'Suzuki', 'MHDR': 'Mahindra', 'OKNW': 'Okinawa', 'KHND': 'Kinetic', 'TVSM': 'TVS', 'YAMA': 'Yamaha', 'UNIV': '', 'MAHI': 'Mahindra', 'KTM': 'KTM', 'PIAG': 'Piaggio', 'VESP': 'Vespa'}
ROW = re.compile(r'^\s*([A-Z]{2}-?\d{3,4}[A-Z]{0,3}(?:-P)?)\s+([A-Z&]{3,5})\s+(\S.*?)\s{2,}(\S.*?)\s+(\d{2,5})\s+(\d{1,3})\s*$')
MIR = re.compile(r'^\s*((?:RV-[\w-]+,?\s?)+)\s+([A-Z]{3,5})\s+REAR VIEW MIRROR\s+(\S.*?)\s+(\d{2,4}(?:/\d{2,4})?)\s+(\d{1,3})\s*$')
W = {'AVNGR': 'AVENGER', 'AVGR': 'AVENGER', 'DISCOVR': 'DISCOVER', 'DSVR': 'DISCOVER', 'BOXR': 'BOXER', 'BXR': 'BOXER', 'CALIBR': 'CALIBER', 'CLBR': 'CALIBER', 'PLTNA': 'PLATINA', 'PULSR': 'PULSAR', 'PLSR': 'PULSAR',
     'VIKRNT': 'VIKRANT', 'SUPR': 'SUPER', 'SPLNDR': 'SPLENDOR', 'XTREM': 'XTREME', 'XTRM': 'XTREME', 'ACHIVER': 'ACHIEVER', 'AMBITON': 'AMBITION', 'AMBN': 'AMBITION', 'DELUX': 'DELUXE', 'DSTINI': 'DESTINI',
     'IMPULS': 'IMPULSE', 'PASION': 'PASSION', 'PSN': 'PASSION', 'PLEASUR': 'PLEASURE', 'PLESUR': 'PLEASURE', 'GLAMOR': 'GLAMOUR', 'ACTVA': 'ACTIVA', 'SHIN': 'SHINE', 'BULET': 'BULLET', 'GLADIATR': 'GLADIATOR',
     'FASCNO': 'FASCINO', 'ALPH': 'ALPHA', 'SALUT': 'SALUTO', 'CHTK': 'CHETAK', 'STRT': 'STREET', 'DWN': 'DAWN', 'CBG': 'CBZ', 'PR': 'PRO'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))
SEC = {'AIR FILTER': 'Air filter', 'OIL FILTER': 'Oil filter', 'PETROL FILTER': 'Fuel filter', 'LUB': 'Engine oil', 'BRAKE AND CLUTCH FLUIDS': 'Brake fluid', 'REAR VIEW MIRROR': 'Mirror'}


def main(src, out_f):
    L = open(src, errors='replace').read().replace('\f', '\n').split('\n')
    rows, seen, sec, tab, last, odd, unk = [], set(), '', False, None, [], set()
    def add(pn, mk4, desc, app, mrp):
        if mk4 not in MK: unk.add(mk4)
        if pn in seen: return None
        seen.add(pn)
        r = {'pn': pn, 'nm': sp(desc), 'mk': MK.get(mk4, ''), 'veh': sp(app), 'sec': SEC.get(sec, 'Part'), 'mrp': mrp, 'oem': []}
        rows.append(r); return r
    for l in L:
        t = sp(l)
        if not t: continue
        if t.startswith('PART NO.'): tab = True; last = None; continue
        if "OEM'S First Choice" in t: tab = False; last = None; continue
        if not tab: continue
        if t in SEC: sec = t; last = None; continue
        m = MIR.match(l)
        if m:
            pns = [x for x in re.split(r'[,\s]+', m.group(1)) if x]; pr = [int(x) for x in m.group(4).split('/')]
            isd = lambda pn: bool(re.match(r'^RV-\d+[A-Z]?[LR]H?D(-|$)', pn))
            if len(pr) == 2 and not (any(isd(p) for p in pns) and any(not isd(p) for p in pns)): odd.append('2 prices? ' + t); continue
            last = [add(pn, m.group(2), 'Rear view mirror ' + ('left' if re.match(r'^RV-\d+[A-Z]?L', pn) else 'right' if re.match(r'^RV-\d+[A-Z]?R', pn) else ''), m.group(3), pr[1] if len(pr) == 2 and isd(pn) else pr[0]) for pn in pns]
            continue
        m = ROW.match(l)
        if m: last = [add(m.group(1), m.group(2), m.group(3), m.group(4), int(m.group(5)))]; continue
        if last and len(l) - len(l.lstrip()) > 25 and not re.search(r'\s\d+\s+\d+\s*$', l):
            for r in last:
                if r: r['veh'] = sp(r['veh'] + ' ' + t)
            continue
        odd.append(t)
    for r in rows:
        r['fit'] = '' if r['veh'].upper() == 'UNIVERSAL' else full(r['veh']); r['hay'] = full(r['nm'] + ' ' + r['veh'])
        if r['veh'].upper() == 'UNIVERSAL': r['veh'] = ''
    json.dump({'brand': 'Uno Minda', 'src': 'Uno Minda 2WH mechanical catalogue April 2024', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print(len(rows), 'parts', dict(Counter(r['sec'] for r in rows)), 'unknown makers', unk)
    print('not read:', len(odd)); [print('  ', o) for o in odd]


if __name__ == '__main__': main(*sys.argv[1:3])
