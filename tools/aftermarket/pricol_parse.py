#!/usr/bin/env python3
"""24c: Pricol (instrument clusters / speedometers, tank units, speed sensors, oil pumps, fuel cocks, chain tensioners ...) for Find Part's
aftermarket list (Sam 2026-11-20).
  python3 pricol_parse.py PRICELIST.txt OUT.json
PRICELIST = `pdftotext -layout` of Pricol's "Price List Two & Three Wheeler Products June 2021". MRP only (HSN not kept). The
MANUFACTURER'S PART NO. column is the bike maker's own number: kept as the original number. The Bajaj 3 wheeler block is left out.
The list drops letters from bike names (Scoty, Apach, SPLNDR): the name stays as printed, the search text spells them out. Data: never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
ROW = re.compile(r'^\s*(\S.*?)\s{2,}(\d{4,6})\s+(?:(\S(?:.*?\S)?)\s+)?([\d,]+\.\d\d)\s+(\d{6,8})\s*$')
MAKERS = {'TVS MOTR': 'TVS', 'SUZUKI MOTR CYCLE': 'Suzuki', 'HERO MOTR CORP': 'Hero', 'BJ AUTO': 'Bajaj', 'BJ AUTO - 3 WH': '3W', 'YAMHA MOTR': 'Yamaha', 'KINETIC HNDA': 'Kinetic',
          'M&M - TWO WHEELERS LTD': 'Mahindra', 'HONDA MOTRCYCLE & SCOOTRS': 'Honda', 'ROYAL ENFELD': 'Royal Enfield', 'SPECIAL CATEGORY PRODUCTS': ''}
CATS = {'INSTRUMENT CLUSTER / SPEEDOMETER': 'Speedometer', 'SPEED SENSOR': 'Speed sensor', 'TANK UNIT / FUEL LEVEL SENSORS': 'Tank unit', 'SUB ASSEMBLY INSTRUMENTS': 'Speedometer sub assembly',
        'CRYSTAL': 'Speedometer crystal', 'OIL PUMP': 'Oil pump', 'AUTO FUEL COCK': 'Fuel cock', 'CHAIN TENSIONER': 'Chain tensioner', 'GEARS / PINION / PRESSURE SWITCH': 'Gear / pinion / pressure switch',
        'AUTO DE COMPRESSION UNIT': 'Auto decompression unit', 'AUTO DECOMPRESSOR UNIT': 'Auto decompression unit', 'GEAR COMPONENTS': 'Gear components', 'FUEL PUMP MODUEL': 'Fuel pump module',
        'PINION': 'Pinion', 'FUEL PUMP': 'Fuel pump', 'NYLON GEAR': 'Nylon gear', 'WATER PUMP / AUTO FUEL COCK': 'Water pump / fuel cock', 'HUB DRIVE': 'Hub drive', 'AMMETER': 'Ammeter',
        'WARNING INDICATOR': 'Warning indicator'}
W = {'SCOTY': 'SCOOTY', 'STREK': 'STREAK', 'STR': 'STAR', 'CTY': 'CITY', 'APACH': 'APACHE', 'JIV': 'JIVE', 'WGO': 'WEGO', 'JUPTR': 'JUPITER', 'CLSSIC': 'CLASSIC', 'CLSSC': 'CLASSIC', 'ZST': 'ZEST',
     'PHONIX': 'PHOENIX', 'RAYDEON': 'RADEON', 'VCTOR': 'VICTOR', 'ENTAR': 'NTORQ', 'ACESS': 'ACCESS', 'CDE': 'CD', 'HFF': 'HF', 'SPLNDR': 'SPLENDOR', 'SPINDR': 'SPLENDOR', 'SUPR': 'SUPER',
     'PASSON': 'PASSION', 'GLAMOR': 'GLAMOUR', 'DUEET': 'DUET', 'MASTRO': 'MAESTRO', 'EXTRM': 'XTREME', 'PULSR': 'PULSAR', 'DSCVR': 'DISCOVER', 'PLTNA': 'PLATINA', 'AVNGR': 'AVENGER', 'CTE': 'CT',
     'BRR': 'BOXER', 'CALIBR': 'CALIBER', 'ASPIR': 'ASPIRE', 'ACTVA': 'ACTIVA', 'SINE': 'SHINE', 'HIMALAYN': 'HIMALAYAN', 'CRUXS': 'CRUX', 'DLX': 'DELUXE', 'MAX': 'MAX', 'KARZMA': 'KARIZMA',
     'ACHIVR': 'ACHIEVER', 'ALBAA': 'ALBA', 'ALFAA': 'ALPHA', 'AVATOR': 'AVIATOR', 'BXER': 'BOXER', 'CANTINENTL': 'CONTINENTAL', 'CBZZ': 'CBZ', 'CNTRA': 'CENTRA', 'CRX': 'CRUX', 'DASSH': 'DASH',
     'DESTNI': 'DESTINI', 'DREM': 'DREAM', 'ELMNATOR': 'ELIMINATOR', 'ENTICR': 'ENTICER', 'EXTRME': 'XTREME', 'FAZR': 'FAZER', 'FSZ': 'FZS', 'FZZ': 'FZ', 'GIXER': 'GIXXER', 'GLADITOR': 'GLADIATOR',
     'GLMAR': 'GLAMOUR', 'GLMUR': 'GLAMOUR', 'HNDA': 'HONDA', 'HNK': 'HUNK', 'HYATE': 'HAYATE', 'IMPULES': 'IMPULSE', 'INGNTOR': 'IGNITOR', 'KNG': 'KING', 'KTEM': 'KTM', 'LGEND': 'LEGEND',
     'LIBRO': 'LIBERO', 'PLSR': 'PULSAR', 'RXX': 'RX', 'SLEK': 'SLEEK', 'SPL': 'SPLENDOR', 'SPRNT': 'SPRINT', 'SPRTS': 'SPORTS', 'STYEL': 'STYLE', 'THNDER': 'THUNDER', 'TWSTER': 'TWISTER',
     'UGA': 'YUGA', 'UNICRN': 'UNICORN', 'XPUSE': 'XPULSE', 'XTRM': 'XTREME', 'GUST': 'GUSTO'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))


def main(src, out_f):
    L = open(src, errors='replace').read().replace('\f', '\n').split('\n')
    i0 = next(i for i, l in enumerate(L) if 'PRODUCT DESCRIPTION' in l)
    rows, seen, mk, cat, sub, pre, odd = [], set(), '', '', '', '', []
    for i, l in enumerate(L[i0:], i0):
        t = sp(l)
        if not t: pre = ''; continue
        if re.match(r'^(page ?-? ?\d+|price list|PRICOL( |$)|PRODUCT DESCRIPTION|PART NO\.|TWO WHEELERS)', t): continue
        if t.startswith('TERMS & CONDITIONS'): break
        m = ROW.match(l)
        if m:
            nm, pn, oem, mrp = sp((pre + ' ' if pre else '') + m.group(1)), m.group(2), sp(m.group(3) or ''), int(round(float(m.group(4).replace(',', '')))); pre = ''
            if mk == '3W': continue
            oem = '' if oem in ('-', '') else re.sub(r'^([A-Z]{1,2}) (?=\d)', r'\1', oem)      # 'K 3150020' is K3150020
            if pn in seen and mrp > 0:                                              # a number printed twice: its other original number is added
                o = next(r for r in rows if r['pn'] == pn)
                if re.search(r'\d{3}', oem) and oem not in o['oem']: o['oem'].append(oem)
                continue
            if mrp <= 0: odd.append(t); continue
            seen.add(pn)
            rows.append({'pn': pn, 'nm': nm, 'mk': mk, 'veh': sub, 'sec': CATS.get(cat, cat.capitalize()) or 'Part', 'mrp': mrp, 'oem': [oem] if re.search(r'\d{3}', oem) else [],
                         'fit': full(sub) if sub else '', 'hay': full(nm + ' ' + re.sub(r'\([\d ,/&]+\)', '', sub))})
            continue
        if t in MAKERS: mk = MAKERS[t]; cat = ''; sub = ''; pre = ''; continue
        if t in CATS: cat = t; sub = ''; pre = ''; continue
        nxt = next((x for x in L[i + 1:i + 2]), '')
        if cat == 'SUB ASSEMBLY INSTRUMENTS' and not re.search(r'[,&-]\s*$', t): sub = t; pre = ''; continue     # the cluster these pieces belong to
        if ROW.match(nxt) or re.search(r'[,&-]\s*$', t) or pre: pre = sp(pre + ' ' + t); continue                 # a name that runs on to the next line
        odd.append(t)
    json.dump({'brand': 'Pricol', 'src': 'Pricol price list two & three wheeler products June 2021', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(rows), '| with OEM no.', sum(1 for r in rows if r['oem']), '| lines not read', len(odd), odd[:10])


if __name__ == '__main__': main(*sys.argv[1:3])
