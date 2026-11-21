#!/usr/bin/env python3
"""24k: NTK (Niterra India) application charts for Find Part's aftermarket list (Sam 2026-11-21 "Eh NTK ka he").
  pdftotext -bbox PLATES.pdf PLATES.html; pdftotext -bbox ASSY.pdf ASSY.html; pdftotext -layout SOCKET.pdf SOCKET.txt
  python3 ntk_parse.py PLATES.html ASSY.html SOCKET.txt OUT.json [-v]
PLATES = "Clutch plates for motorcycles" (Company | Model Recommendation | Part No. CPRCL-... | Set of (pcs)), no MRP in it.
ASSY   = "Inner clutch assembly for motorcycles" (... | Part No. CPRCA-... | MRP w.e.f. 01 April 2025).
SOCKET = "2W Oxygen Sensor Socket Applications": two sockets (tools) OSST001 / OSSTL002 for the bikes listed.
The company name stands once beside a block of rows; the number series says the same and is used: 0xx Bajaj, 1xx Hero, 2xx Honda,
3xx TVS, 4xx Yamaha, 5xx LML, 6xx Mahindra, 7xx Suzuki (checked against both charts)."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
MK = {'0': 'Bajaj', '1': 'Hero', '2': 'Honda', '3': 'TVS', '4': 'Yamaha', '5': 'LML', '6': 'Mahindra', '7': 'Suzuki'}


def table(f, rx):
    pg = open(f, encoding='utf-8', errors='replace').read()
    Wd = [(float(a), float(b), t.replace('&amp;', '&').replace('&apos;', "'")) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
    out = []
    for x, y, t in sorted(Wd, key=lambda w: w[1]):
        if not re.match(rx, t): continue
        line = sorted(w for w in Wd if abs(w[1] - y) < 3)
        out.append((t, sp(' '.join(w[2] for w in line if 130 < w[0] < x - 5)), sp(' '.join(w[2] for w in line if w[0] > x + 5))))
    return out


def main(plates, assy, socket, out_f, v=False):
    rows = []
    def add(pn, nm, mk, veh, sec, mrp):
        rows.append({'pn': pn, 'nm': nm, 'mk': mk, 'veh': veh, 'sec': sec, 'mrp': mrp, 'oem': [], 'fit': veh.upper(), 'hay': sp((sec + ' ' + nm + ' ' + veh).upper())})
    for pn, veh, last in table(plates, r'^CPRCL-\d{3}$'):
        if not veh or not re.match(r'^\d$', last): print('  row not read:', pn, veh, last); continue
        add(pn, 'Clutch plate set (%s pcs)' % last, MK[pn[6]], veh, 'Clutch plate', 0)
    for pn, veh, last in table(assy, r'^CPRCA-\d{3}$'):
        if not veh or not re.match(r'^[\d,]+\.\d\d$', last): print('  row not read:', pn, veh, last); continue
        m = float(last.replace(',', '')); add(pn, 'Inner clutch assembly', MK[pn[6]], veh, 'Clutch inner assembly', int(m) if m == int(m) else m)
    t = open(socket, encoding='utf-8', errors='replace').read()
    if 'OSST001' in t and 'OSSTL002' in t:
        mk = [m for m in ('Honda', 'Bajaj', 'Hero', 'TVS') if m.upper() in t.upper()]
        for pn in ('OSST001', 'OSSTL002'): add(pn, 'Oxygen sensor socket (tool) for M12 oxygen sensors', '', 'BS-6 bikes of ' + ', '.join(mk), 'Oxygen sensor socket', 0)
    json.dump({'brand': 'NTK', 'src': 'Niterra India NTK application charts: clutch plates, inner clutch assembly (MRP 01-04-2025), oxygen sensor sockets', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts,', sum(1 for r in rows if r['mrp']), 'with MRP;', len({r['pn'] for r in rows}), 'different numbers')
    if v:
        for r in rows: print(r['pn'], '|', r['nm'], '|', r['mk'], '|', r['veh'], '|', r['mrp'])


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if x != '-v']; main(*a, v='-v' in sys.argv)
