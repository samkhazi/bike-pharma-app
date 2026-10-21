#!/usr/bin/env python3
"""update 10j (Sam 2026-10-21 "sabhi duplicate ko hata do ek hi rhakho"): one line per part on a diagram.
Two lines of one book with the same diagram page, ref, part number and bikes are made one: the bigger qty, the note that is
filled in, the first name and group. Run after any tool that adds books: python3 tools/brands/dedupe_rows.py honda yamaha"""
import json, os, sys
CAT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'cat')
def qn(q):
    try: return float(q)
    except Exception: return -1
for b in sys.argv[1:] or ['honda', 'yamaha']:
    p = os.path.join(CAT, b + '.json'); d = json.load(open(p, encoding='utf-8'))
    seen, out = {}, []
    for r in d['d']:
        if not r[5]: out.append(r); continue
        k = (r[0], r[2], r[4], r[5], tuple(r[11]))
        if k not in seen: seen[k] = r; out.append(r); continue
        a = seen[k]
        if qn(r[7]) > qn(a[7]): a[7] = r[7]
        if not a[8] and r[8]: a[8] = r[8]
        if not a[10] and r[10]: a[10] = r[10]
    print(b, len(d['d']), '->', len(out), 'lines (', len(d['d']) - len(out), 'duplicates made one )')
    d['d'] = out
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
