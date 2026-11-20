#!/usr/bin/env python3
"""24a: Rex Industries (Mumbai: plug adapters, relays, fuses, handle bar buttons, brake / clutch switches, holders, oil gauges ...) for
Find Part's aftermarket list (Sam 2026-11-20 "ek aur catalogue add karde").
  python3 rex_parse.py RATE.txt PIC.txt OUT.json
RATE = `pdftotext -layout` of Rex's price list w.e.f. 01/03/2024, PIC = `pdftotext` of Rex's picture catalogue (only its RSS-.. sensor
socket codes are read: the other pictures carry no code).
The list's RATE column is the WHOLESALE rate (its own last page says so), not an MRP: it is NOT kept, every part goes in with no price.
The list prints the same code under two headings (RPA 1-28 under Plug adapter and again under Starter relay, RCR 1-3 under Condenser and
Clutch repair kit; RCD21 for two bikes): the first keeps the code, the second gets its heading (or bike) added so that no part is lost. The out file is data: never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
ROW = re.compile(r'^\s*(R[A-Z]{1,3}) ?-? ?(\d+[A-Z]?)\s+(\S.*?)\s+(?:[\d,]+\.\d\d\s+)?(Piece|Set|Pair|Pkt|Nos|Dozen|Box)\b', re.I)
SEC = {'FRONT BREAK SWITCH': 'Front brake switch', 'CARBORATOR DISTANCE PLATE WITH "O" RING': 'Carburettor distance plate with O ring', 'CLUTCH REPAIR “U” BUSH (KAJU)': 'Clutch repair U bush (kaju)',
       'UPPER - DIPPER BUTTON': 'Upper dipper button', 'BAJAJ RE-3 WHEELER ACCESSORIES': 'Bajaj RE 3 wheeler accessories', 'HANDLE GRIP SET OF 3 MOULDED': 'Handle grip set of 3 moulded'}
MK = [('ROYAL ENFIELD', 'Royal Enfield'), ('BULLET', 'Royal Enfield'), ('YAMAHA', 'Yamaha'), ('SUZUKI', 'Suzuki'), ('BAJAJ', 'Bajaj'), ('PULSAR', 'Bajaj'), ('TVS', 'TVS'), ('HONDA ACTIVA', 'Honda'), ('HERO', 'Hero')]


def main(rate_f, pic_f, out_f):
    rows, seen, sec, lost = [], {}, '', []
    for l in open(rate_f, errors='replace').read().replace('\f', '\n').split('\n'):
        t = sp(l)
        if not t or 'REX INDUSTRIES' in t or t.startswith('CODE NO'): continue
        if t.startswith('TERMS AND CONDITION'): break
        m = ROW.match(l)
        if not m:
            if re.match(r'^R[A-Z]{1,3} ?\d', t): lost.append(t)
            else: sec = SEC.get(t, t[0] + t[1:].lower())
            continue
        pn, nm = m.group(1).upper() + ' ' + m.group(2).upper(), sp(m.group(3))
        if pn in seen and seen[pn] != sec: pn = pn + ' (' + sec + ')'
        if pn in seen: pn = pn.split(' (')[0] + ' (' + nm.title() + ')'   # RCD21 is printed for two bikes
        if pn in seen: lost.append(t); continue
        seen[pn] = sec; u = nm.upper(); mks = []
        for k, v in MK:
            if k in u and v not in mks: mks.append(v)
        rows.append({'pn': pn, 'nm': nm, 'mk': mks[0] if len(mks) == 1 else '', 'veh': '', 'sec': sec, 'mrp': 0, 'oem': [], 'fit': '', 'hay': nm})
    n0 = len(rows); codes = []
    for c in re.findall(r'\bRSS-(\d+A?)\b', open(pic_f, errors='replace').read()):
        if c not in codes: codes.append(c)
    for c in sorted(codes, key=lambda x: (int(re.match(r'\d+', x).group()), x)):
        rows.append({'pn': 'RSS-' + c, 'nm': 'Sensor socket (BS6)', 'mk': '', 'veh': '', 'sec': 'Sensor socket', 'mrp': 0, 'oem': [], 'fit': '', 'hay': 'SENSOR SOCKET BS6'})
    json.dump({'brand': 'Rex', 'src': 'Rex Industries Mumbai price list 1 Mar 2024 (wholesale rates not kept, no MRP) + picture catalogue', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(rows), '| from the list', n0, '| sensor sockets', len(rows) - n0, '| lines not read', len(lost), lost[:5])


if __name__ == '__main__': main(*sys.argv[1:4])
