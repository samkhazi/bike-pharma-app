#!/usr/bin/env python3
"""UCAL aftermarket product catalogue 2024 (carburettors with OE part numbers, horns, shock absorbers) -> ucal.json for Find Part.
usage: ucal_parse.py CAT.txt(pdftotext -layout) OUT.json [-v]
Kept: 2-wheeler carburettors (OE Part No, Ucal Part No, MRP), horns, 2-wheeler shock absorbers.
Left out: 3-wheelers, car gas springs, and the fork inner tubes (the catalogue prints no part number for them)."""
import sys, json, re, collections

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
UPN = r'(?:T\d?-)?(?:UVD|UCD|VM|BS) ?\d+-[0-9X/]+'
CARB = re.compile(r'^\s*(\d+)\s+(.*?)\s*\b(' + UPN + r')\s+(.*?)\s+(2W|3W)\s+(BS ?[IV]+|Euro [IV]+)\s+(\d{3,5})\s*$')
CARB0 = re.compile(r'^\s*(\d+)\s+(.*?)\s*\b(' + UPN + r')\s+(2W|3W)\s+(BS ?[IV]+|Euro [IV]+)\s+(\d{3,5})\s*$')      # the bike is printed on the lines above and below
SA = re.compile(r'^\s*(\d+)\s+(UC[A-Z0-9]{9})\s+(.*?)\s+(2W|3W)\s+(\d{3,5})\s+(\d+)\s*$')
HORN = re.compile(r'^\s*(\d+)\s+(UCKHON\d+|UDH-\d+[A-Z]?)\s+(.*?)\s*(8512\d+)\s+(\d{3,5})(?:\s+\d+)?\s*$')
BR = {'ENFIELD': 'Royal Enfield', 'RE': 'Royal Enfield', 'YAHAMA': 'Yamaha', 'TVS': 'TVS', 'LM': 'LML', 'HER0': 'Hero'}
W3 = re.compile(r'\bRE[ -]?(MAX|205|COMPACT|145)|\bCOMPACT (LPG|CNG)|MAXIMA|AUTO ?RICKSHAW|\b3 ?W(HEELER)?\b', re.I)
SAW = [(r'\bSA\b', 'SHOCK ABSORBER'), (r'\bFR\b', 'FRONT'), (r'\bRR\b', 'REAR'), (r'\bHER0\b', 'HERO'), (r'\bBAJJA\b', 'BAJAJ'), (r'\bHONDAN\b', 'HONDA'), (r'^ROYAL ENFIELD\b', 'RE'), (r'\bSPLENDER\b', 'SPLENDOR'), (r'\bPHONIX\b', 'PHOENIX'), (r'\bRDEON\b', 'RADEON'), (r'\bVASPA\b', 'VESPA'), (r'\bDELUX\b', 'DELUXE')]
CW = [(r'\bPLANTINA\b', 'PLATINA'), (r'\bPULSER\b', 'PULSAR'), (r'\bZIXXER\b', 'GIXXER'), (r'\bZUES\b', 'ZEUS'), (r'\bBAJA\b', 'BAJAJ'), (r'\bDISCO\b', 'DISCOVER')]


def oem(s):
    """the OE number as printed, plus the way the brand's own catalogue writes it"""
    s = sp(s); o = [s] if s else []
    m = re.match(r'^(\d[A-Z0-9]{2})-?([A-Z]\d{4})-?(\d\d)', s)                     # Yamaha 5REE4101000080 = 5RE-E4101-00
    if m: o.append('-'.join(m.groups()))
    m = re.match(r'^(\d{5}-\d{2}[A-Z]\d{2})-000$', s)                             # Suzuki 13200-34J00-000 = 13200-34J00
    if m: o.append(m.group(1))
    return list(dict.fromkeys(o))


def main(src, out_f, v=False):
    L = open(src, encoding='utf-8', errors='replace').read().replace('\f', '\n').split('\n')
    rows, out, seen = [], collections.Counter(), {}
    def add(pn, nm, mk, sec, mrp, oe, fit):
        pn = sp(pn).replace('T-UVD 16', 'T-UVD16')
        if pn in seen: out['part no. twice: ' + pn] += 1; return
        seen[pn] = 1
        rows.append({'pn': pn, 'nm': nm, 'mk': mk, 'veh': fit, 'sec': sec, 'mrp': int(mrp), 'oem': oe, 'fit': fit.upper(), 'hay': sp(sec + ' ' + fit).upper()})
    for i, l in enumerate(L):
        m = CARB.match(l); app = None
        if m: sl, left, pn, app, seg, cat, mrp = m.groups()
        else:
            m = CARB0.match(l)
            if m:
                sl, left, pn, seg, cat, mrp = m.groups()
                app = sp(' '.join(sp(L[j]) for j in (i - 1, i + 1) if 0 <= j < len(L) and sp(L[j]) and not re.match(r'^\s*\d+\s', L[j])))
        if m and app:
            w = left.split(); brand = w[0] if w else ''; oe = ' '.join(w[1:])
            if seg == '3W' or W3.search(app): out['3-wheeler left out'] += 1; continue
            mk = BR.get(brand.upper(), brand.capitalize())
            fit = app
            for a, b in CW: fit = re.sub(a, b, fit, flags=re.I)
            cat = cat.replace('BS ', 'BS'); app = sp(re.sub(r'\s*\bCarburett?or\b', '', app, flags=re.I))
            has = re.search(r'BS ?[IV]+|EURO', app, re.I)                 # the bike's name already says it
            fit = sp(re.sub(r'\s*\bCarburett?or\b', '', fit, flags=re.I) + ('' if has else ' ' + cat))
            add(pn, 'Carburettor ' + app + ('' if has else ' ' + cat), mk, 'Carburettor', mrp, oem(oe), fit)
            if not oe: out['no OE number printed: ' + pn] += 1
            continue
        m = SA.match(l)
        if m:
            sl, pn, d, seg, mrp, moq = m.groups()
            if seg == '3W' or W3.search(d): out['3-wheeler left out'] += 1; continue
            fit = d.upper()
            for a, b in SAW: fit = re.sub(a, b, fit)
            w = fit.split()[0]; mk = BR.get(w, w.capitalize())
            if mk not in ('Bajaj', 'TVS', 'Hero', 'Honda', 'Yamaha', 'Suzuki', 'Mahindra', 'LML', 'Piaggio', 'Royal Enfield', 'Kinetic', 'Ather'): mk = ''
            add(pn, sp(d), mk, 'Shock absorber', mrp, [], sp(re.sub(r'^RE\b', 'ROYAL ENFIELD', fit)))
            continue
        m = HORN.match(l)
        if m:
            sl, pn, d, hsn, mrp = m.groups()
            if not d: d = sp(' '.join(sp(L[j]) for j in (i - 1, i + 1) if 0 <= j < len(L)))
            add(pn, sp(d), '', 'Horn', mrp, [], sp(d))
    json.dump({'brand': 'UCAL', 'src': 'UCAL aftermarket product catalogue 2024', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts,', sum(1 for r in rows if r['mrp']), 'with MRP,', sum(1 for r in rows if r['oem']), 'with OE number'); print(dict(collections.Counter(r['sec'] for r in rows))); print(dict(collections.Counter(r['mk'] for r in rows)))
    for k, n in out.items(): print('  ', n, k)
    if v:
        for r in rows: print(r['pn'], '|', r['nm'], '|', r['mk'], '|', r['mrp'], '|', r['oem'])


if __name__ == '__main__': main(sys.argv[1], sys.argv[2], '-v' in sys.argv)
