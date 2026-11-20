#!/usr/bin/env python3
"""24c: Motherson (wire harness, plug cap, brake pads / shoes, relays, flashers, mirrors ...) for Find Part's aftermarket list (Sam 2026-11-20).
  python3 motherson_parse.py PRICELIST.pdf OUT.json        (needs pymupdf)
PRICELIST = Motherson's "2WH Price list 6th Mar'26" PDF (an Excel sheet printed to PDF: the columns sit at fixed places, so the words are
read by their place on the page). MRP only (MOQ not kept). The OEM column gives the original part number; Ref 2 / Ref 3 are other makers'
numbers for the same part: they go into the name so that a search by them finds the part. The out file is data: never in git."""
import json, re, sys
import pymupdf

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
MK = {'BAJA': 'Bajaj', 'HRO': 'Hero', 'HNDA': 'Honda', 'REML': 'Royal Enfield', 'RNLD': 'Royal Enfield', 'SZKI': 'Suzuki', 'TVSM': 'TVS', 'YMHA': 'Yamaha', 'OLA': 'Ola', 'ATHER ENERGY': 'Ather', 'UNI': '',
      'KTM': 'KTM', 'MAHI': 'Mahindra', 'E-RIKSHAW': '', 'ERIKSHAW/UNI': ''}
KIND = {'WH': 'Wire harness', 'RV': 'Rear view mirror', 'RLY': 'Relay', 'CN': 'Plug cap', 'BP': 'Brake pad', 'BS': 'Brake shoe', 'FLR': 'Flasher'}   # by the part number's first letters
PNRE = re.compile(r'^[A-Z]{2,4}-[A-Z0-9][A-Z0-9/-]{2,}$')
W = {'HRO': 'HERO', 'HND': 'HONDA', 'HNDA': 'HONDA', 'SZK': 'SUZUKI', 'YMH': 'YAMAHA', 'TV': 'TVS', 'BJ': 'BAJAJ', 'REML': 'ROYAL ENFIELD', 'RVM': 'REAR VIEW MIRROR', 'PLTN': 'PLATINA', 'PLSR': 'PULSAR',
     'DSCVR': 'DISCOVER', 'ACTV': 'ACTIVA', 'ACTVA': 'ACTIVA', 'ACES': 'ACCESS', 'ACESS': 'ACCESS', 'JUPTR': 'JUPITER', 'JUPTIER': 'JUPITER', 'WGO': 'WEGO', 'SPL': 'SPLENDOR', 'SPR': 'SUPER',
     'GLMR': 'GLAMOUR', 'PSSN': 'PASSION', 'UNCRN': 'UNICORN', 'SHNE': 'SHINE', 'TWSTR': 'TWISTER', 'TRGR': 'TRIGGER', 'ETRN': 'ETERNO', 'KINTIC': 'KINETIC', 'AVNGR': 'AVENGER', 'APCHE': 'APACHE',
     'STR': 'STAR', 'CTY': 'CITY', 'SCTY': 'SCOOTY', 'VCTR': 'VICTOR', 'CNTRA': 'CENTRA', 'FLM': 'FLAME', 'FIRO': 'FIERO', 'CYGNS': 'CYGNUS', 'REY': 'RAY', 'DLX': 'DELUXE', 'XTRM': 'XTREME',
     'AMBN': 'AMBITION', 'THBIRD': 'THUNDERBIRD', 'DREM': 'DREAM', 'RR': 'REAR', 'FR': 'FRONT', 'LH': 'LEFT', 'RH': 'RIGHT'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))


# Yamaha's number is printed with its pack ending (5TS-H2590-50-00-80): the catalogue writes the same number as 5TS-H2590-50
yam = lambda o: [o] + ([o[:12]] if re.match(r'^[0-9A-Z]{3}-[0-9A-Z]{5}-[0-9A-Z]{2}(-\d\d){1,2}$', o) else [])

def main(src, out_f):
    rows, seen, sec, mk, model, odd = [], set(), 'Wire Harness', '', '', []
    for pg in pymupdf.open(src):
        ws = [(w[0], (w[1] + w[3]) / 2, w[2], w[4]) for w in pg.get_text('words')]
        hy = min((y for x, y, x1, t in ws if t == 'Sr.No.'), default=0)
        ws = sorted((w for w in ws if w[1] > hy + 3), key=lambda w: (w[1], w[0]))
        lines = []
        for w in ws:                                           # words of one printed line
            if lines and abs(lines[-1][0] - w[1]) < 2.2: lines[-1][1].append(w)
            else: lines.append([w[1], [w]])
        anchors = []                                           # ('pn', y, pn) | ('head', y)
        for y, L in lines:
            L.sort(); x0, x1 = L[0][0], max(w[2] for w in L); txt = sp(' '.join(w[3] for w in L))
            pn = next((w[3] for w in L if 66 < w[0] < 98 and PNRE.match(w[3])), None)
            if pn: anchors.append(['pn', y, pn, []]); continue
            if x0 > 235 and abs((x0 + x1) / 2 - 281) < 6 and not re.search(r'\d{3}', txt):           # a centred heading: maker or product group
                anchors.append(['head', y, txt, 'c']); continue
            if x0 < 58 and x1 < 220 and not re.fullmatch(r'\d+', txt): anchors.append(['head', y, txt, 'm']); continue
        prow = [a for a in anchors if a[0] == 'pn']
        for y, L in lines:                                     # every other word goes to the part row nearest to it
            for w in L:
                if any(a[1] == y and a[0] == 'head' for a in anchors): continue
                a = min(prow, key=lambda a: abs(a[1] - y), default=None)
                if a and abs(a[1] - y) < 9: a[3].append(w)
        for a in anchors:
            if a[0] == 'head':
                if a[3] == 'm': model = a[2]
                elif a[2].upper() in MK: mk = MK[a[2].upper()]; model = ''
                elif a[2].upper().startswith('UNI /'): mk = ''; model = ''
                else: sec = a[2]; mk = ''; model = ''
                continue
            col = lambda lo, hi: sp(' '.join(w[3] for w in sorted(a[3], key=lambda w: (round(w[1]), w[0])) if lo <= w[0] < hi and w[3] != a[2]))
            oem, desc, r2, r3, mrp = col(98, 220), col(220, 400), col(400, 438), col(438, 478), col(478, 496)
            if not re.fullmatch(r'\d{2,6}', mrp) or not desc: odd.append((a[2], oem, desc, mrp)); continue
            if a[2] in seen: odd.append((a[2], 'twice')); continue
            seen.add(a[2]); refs = [r for r in (r2, r3) if r]
            rows.append({'pn': a[2], 'nm': desc + (' · Ref ' + ', '.join(refs) if refs else ''), 'mk': mk, 'veh': model, 'sec': KIND.get(a[2].split('-')[0]) or sec, 'mrp': int(mrp), 'oem': yam(oem) if re.search(r'\d', oem) else [],
                         'fit': full(model) if model else '', 'hay': full(desc + ' ' + model)})
    json.dump({'brand': 'Motherson', 'src': "Motherson 2WH price list 6 Mar 2026", 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(rows), '| with OEM no.', sum(1 for r in rows if r['oem']), '| with maker', sum(1 for r in rows if r['mk']), '| lines not read', len(odd), odd[:10])


if __name__ == '__main__': main(*sys.argv[1:3])
