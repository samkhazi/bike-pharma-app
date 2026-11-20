#!/usr/bin/env python3
"""24d: MK Auto's MRP list (w.e.f. 06-08-2026) puts the MRP on the MK Auto parts already in the aftermarket list (mkauto.json of 20o had none).
  python3 mk_mrp.py PRICELIST.txt mkauto.json OUT.json       (PRICELIST = pdftotext -layout)
A line ends "... SET OF  STD PKG  MRP"; a long name wraps, then the three numbers sit on the next line of the same part. Only a part
number already in the list gets its MRP; nothing else changes. MRP only."""
import json, re, sys
TAIL = re.compile(r'(?:^|\s)(\d{1,2})\s+(\d{1,4})\s+(\d{2,5})\s*$')
PN = re.compile(r'^\s{0,6}(\d{4,6}[A-Z]{0,2})\s+\S')


def main(src, base, out):
    L = [l.rstrip('\n') for l in open(src, errors='replace')]; pr, cur = {}, None
    for l in L:
        if not l.strip() or re.search(r'PART NO\.|PRICE LIST|w\.e\.f|MKLIDE|MK AUTO CLUTCH', l): cur = None if not l.strip() and cur in pr else cur; continue
        m = PN.match(l)
        if m: cur = m.group(1)
        t = TAIL.search(l)
        if cur and t and cur not in pr and ('8' in l or not m): pr[cur] = int(t.group(3))
    d = json.load(open(base)); n = 0
    for r in d['rows']:
        if r['pn'] in pr: r['mrp'] = pr[r['pn']]; n += 1
    d['src'] = 'MK Auto (VB group) product range 1 Jan 2026 · MRP list w.e.f. 06-08-2026'
    json.dump(d, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(pr), 'prices read;', n, 'of', len(d['rows']), 'parts got MRP; without:', [r['pn'] for r in d['rows'] if not r['mrp']][:40])
    return pr


if __name__ == '__main__': main(*sys.argv[1:4])
