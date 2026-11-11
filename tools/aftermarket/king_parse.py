#!/usr/bin/env python3
"""20n: King Quality (KQ levers, yokes, clutch parts) for Find Part's aftermarket list (Sam 2026-11-11 "eh king lever ka he catalogues he").
  python3 king_parse.py PRICELIST.txt OUT.json
PRICELIST = `pdftotext -layout` of King's MRP price list (w.e.f. 01-08-2026). MRP only (the packing column is not kept).
A number printed under several makers is one part: makers joined. The out file is data: never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
PN = re.compile(r'^\s*(KQ[- ]?\d[0-9A-Z/-]*)\s+(.*)$')
PRICE = re.compile(r'\s{2,}([\d,]+\.\d\d)\s+(?:\d+ )?(Pcs\.?|Sets?|Pairs?|Pc\.?|Nos\.?)?\b.*$')
MK = [('ROYAL ENFIELD', 'Royal Enfield'), ('HERO', 'Hero'), ('YAMAHA', 'Yamaha'), ('ATHER', 'Ather'), ('HONDA', 'Honda'), ('BAJAJ', 'Bajaj'), ('T.V.S', 'TVS'), ('TVS', 'TVS'), ('LML', 'LML'),
      ('SUZUKI', 'Suzuki'), ('OLA', 'Ola'), ('KTM', 'KTM')]
KIND = [('LEVER', 'Lever'), ('YOKE', 'Handle yoke'), ('CLUTCH CENTER', 'Clutch center'), ('CLUTCH HUB', 'Clutch hub'), ('CLUTCH HOUSING', 'Clutch housing'), ('INNER CLUTCH', 'Clutch assembly'),
        ('COUPLING HUB', 'Coupling hub'), ('DRUM PLATE', 'Drum plate'), ('MASTER CYLINDER', 'Master cylinder'), ('SWITCH', 'Handle bar switch'), ('TAPET', 'Tappet nut'),
        ('TWIST GRIP', 'Twist grip'), ('FOOTREST', 'Footrest'), ('GEAR MUTHA', 'Gear support'), ('CLUTCH COVER', 'Clutch cover')]


def mk_of(t):
    u = t.upper()
    return next((v for k, v in MK if k in u), '')


def main(src, out_f):
    rows, by, cur, sec, title, mk, lost = [], {}, None, 'Part', '', '', 0
    def done(c, mrp):
        nonlocal lost
        nm = sp(' '.join(c['t']))
        if not nm or mrp <= 0: lost += 1; return
        o = by.get(c['pn'])
        if o:
            if c['mk'] and c['mk'] not in o['mk'].split(' / '): o['mk'] = (o['mk'] + ' / ' + c['mk']).strip(' /')
            if len(nm) > len(o['nm0']): o['nm0'] = nm
            o['mrp'] = max(o['mrp'], mrp); return
        o = {'pn': c['pn'], 'nm0': nm, 'mk': c['mk'], 'sec': c['sec'], 'title': c['title'], 'mrp': mrp}; by[c['pn']] = o; rows.append(o)
    for l in open(src, errors='replace').read().split('\n'):
        t = sp(l)
        if not t or re.match(r'^(\d{1,2}|®|Always go for Quality|Mode of|Part NO\..*)$', t): continue
        if t.startswith('Disclaimer'): break
        pm = PRICE.search(l); m = PN.match(l)
        if m:
            cur = {'pn': m.group(1).replace(' ', '-').replace('KQ9', 'KQ-9') if not m.group(1).startswith('KQ-') else m.group(1), 't': [], 'mk': mk, 'sec': sec, 'title': title}
            body = m.group(2)
            if pm: cur['t'].append(PRICE.sub('', body) if PRICE.search(body) else body); done(cur, float(pm.group(1).replace(',', ''))); cur = None
            else: cur['t'].append(body)
            continue
        if pm and cur: cur['t'].append(PRICE.sub('', l)); done(cur, float(pm.group(1).replace(',', ''))); cur = None; continue
        if pm: lost += 1; continue
        if cur: cur['t'].append(t); continue
        t2 = re.sub(r'^Always go for Quality\s*', '', t)
        if re.match(r'^For\b', t2, re.I): mk = mk_of(t2) or ('' if 'ELECTRIC' in t2.upper() else mk); continue
        if t2 == t2.upper() and len(t2) > 5 and 'PRICE' not in t2 and 'NAMAH' not in t2 and 'KINGQUALITY' not in t2 and 'ADDITIONAL' not in t2:
            mk = ''; title = t2.title(); sec = next((v for k, v in KIND if k in t2), title)
    out = []
    for o in rows:
        nm = o['nm0']; lead = o['title'] if o['title'] and o['sec'].lower() not in nm.lower() else ''
        out.append({'pn': o['pn'], 'nm': sp((lead + ' · ' if lead else '') + nm), 'mk': o['mk'] if ' / ' in o['mk'] else (mk_of(nm) or o['mk']), 'veh': '', 'sec': o['sec'], 'mrp': int(round(o['mrp'])), 'oem': [], 'fit': '', 'hay': nm})
    json.dump({'brand': 'King', 'src': 'King Quality MRP price list 1 Aug 2026', 'rows': out}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(out), '| price lines not read', lost)


if __name__ == '__main__':
    main(*sys.argv[1:3])
