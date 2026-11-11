#!/usr/bin/env python3
"""20m: Endurance's own MRP list for Find Part's aftermarket list (Sam 2026-11-11 "eh le MRP": ETL Price List - 16.06.2026.pdf).
  python3 endurance_parse.py PRICELIST.txt OUT.json
PRICELIST = `pdftotext -layout` of the PDF. Only its 2 WHEELERS half is read (the 4 wheeler shock absorber block and everything from
"3 WHEELER" on are left out). MRP only (the MOQ column is not kept). The list writes makers and bikes short (BJ PLSR, HRO SPL):
spelt out in `hay`/`fit` for the bike match and the search (my reading). The out file is data: never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
ROW = re.compile(r'^\s*([0-9A-Z]{6,14})\s{2,}(.*?)\s{2,}([\d,]+(?:\.\d+)?)\s+[\d.]+(?: ?SETS)?\s*$')
ROW1 = re.compile(r'^\s*([0-9A-Z]{6,14})\s{2,}(.*\S)\s+([\d,]{3,6})\s+\d{1,3}\s*$')
MAKER = [('BJ', 'Bajaj'), ('BAJAJ', 'Bajaj'), ('HRO', 'Hero'), ('HR', 'Hero'), ('HERO', 'Hero'), ('HND', 'Honda'), ('HONDA', 'Honda'), ('TV', 'TVS'), ('TVS', 'TVS'), ('YMH', 'Yamaha'), ('YAMAHA', 'Yamaha'),
         ('SZK', 'Suzuki'), ('SUZUKI', 'Suzuki'), ('RE', 'Royal Enfield'), ('KTM', 'KTM'), ('ATHER', 'Ather'), ('LML', 'LML'), ('M&M', 'Mahindra'), ('MHN', 'Mahindra'), ('KNTC', 'Kinetic'), ('OLA', 'Ola')]
WORDS = {'BJ': 'BAJAJ', 'HRO': 'HERO', 'HR': 'HERO', 'HND': 'HONDA', 'TV': 'TVS', 'YMH': 'YAMAHA', 'SZK': 'SUZUKI', 'PLSR': 'PULSAR', 'DSVR': 'DISCOVER', 'PLTN': 'PLATINA', 'BXR': 'BOXER',
         'CHTK': 'CHETAK', 'AVNGR': 'AVENGER', 'AVGR': 'AVENGER', 'SPL': 'SPLENDOR', 'SPR': 'SUPER', 'SUP': 'SUPER', 'GLMR': 'GLAMOUR', 'GLAMR': 'GLAMOUR', 'PASSN': 'PASSION', 'PSN': 'PASSION',
         'ACHVR': 'ACHIEVER', 'ACHIVR': 'ACHIEVER', 'KRZM': 'KARIZMA', 'PLSUR': 'PLEASURE', 'HNK': 'HUNK', 'MSTRO': 'MAESTRO', 'IMPLS': 'IMPULSE', 'IGNTR': 'IGNITOR', 'AMBTN': 'AMBITION',
         'ACT': 'ACTIVA', 'UNCRN': 'UNICORN', 'SHN': 'SHINE', 'STNR': 'STUNNER', 'TWTR': 'TWISTER', 'TWSTR': 'TWISTER', 'AVTR': 'AVIATOR', 'ETRN': 'ETERNO', 'TRGGR': 'TRIGGER', 'HRNT': 'HORNET',
         'DREM': 'DREAM', 'VCTR': 'VICTOR', 'CNTRA': 'CENTRA', 'STR': 'STAR', 'CTY': 'CITY', 'SPRT': 'SPORT', 'APCH': 'APACHE', 'JPTR': 'JUPITER', 'SCTY': 'SCOOTY', 'NTQR': 'NTORQ', 'NTRQ': 'NTORQ',
         'PHONX': 'PHOENIX', 'FSCINO': 'FASCINO', 'UPG': 'UG', 'XD': 'XCD', 'S/A': 'SHOCK ABSORBER', 'F/C': 'FRICTION CLUTCH PLATE', 'FT/CP': 'FUEL TANK CAP', 'FR': 'FRONT', 'RR': 'REAR',
         'BRK': 'BRAKE', 'BR': 'BRAKE', 'ACC': 'ACCELERATOR', 'WHL': 'WHEEL'}
full = lambda s: re.sub(r'[A-Z&/]+', lambda m: WORDS.get(m.group(0), m.group(0)), s.upper().replace('‐', '-'))


def maker(*texts):
    for t in texts:
        u = ' ' + re.sub(r'[^A-Z&]+', ' ', t.upper()) + ' '
        for k, v in MAKER:
            if ' ' + k + ' ' in u: return v
    return ''


def main(src, out_f):
    L = open(src, errors='replace').read().split('\n')
    end = next((i for i, l in enumerate(L) if re.match(r'^\s{6,}3 WHEELER\s*$', l)), len(L))
    rows, seen, sec, sub, skip, odd = [], set(), '', '', False, 0
    for l in L[:end]:
        t = sp(l)
        if not t or t.startswith('Part Number') or 'AFTERMARKET PRODUCT MRP LIST' in t: continue
        m = ROW.match(l) or ROW1.match(l)
        if m and re.search(r'\d', m.group(1)):
            if skip: continue
            pn, nm, mrp = m.group(1), sp(m.group(2)), int(round(float(m.group(3).replace(',', ''))))
            if pn in seen or mrp <= 0: continue
            seen.add(pn)
            rows.append({'pn': pn, 'nm': full(nm), 'mk': maker(nm, sub), 'veh': sub if sub and sub != sec else '', 'sec': sec or 'Part', 'mrp': mrp, 'oem': [],
                         'fit': full(sub) if sub and sub != sec else '', 'hay': full(nm)})
            continue
        if re.match(r'^\s{4,}\S', l) and not re.search(r'\d{3,}\s+\d+\s*$', l):          # a heading
            big = t == t.upper() and not maker(t) and len(t) > 3
            if re.match(r'^4 WHEELER', t) or t == 'AIR SUSPENSION': skip = t.startswith('4 WHEELER'); sec = t.title(); sub = ''; continue
            skip = False
            if sec == 'Control Cables': sub = t.replace('‐', '-')                       # the cables come last: every heading under them is a bike
            elif big: sec = re.sub(r'^2 Wheelers?\s*-?\s*', '', t.title()).strip() or sec; sub = ''
            else: sub = t.replace('‐', '-')
        else: odd += 1
    json.dump({'brand': 'Endurance', 'src': 'Endurance MRP list 16 Jun 2026', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(rows), '| with maker', sum(1 for r in rows if r['mk']), '| with bike heading', sum(1 for r in rows if r['veh']), '| lines not read', odd)


if __name__ == '__main__':
    main(*sys.argv[1:3])
