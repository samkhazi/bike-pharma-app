"""Data clean-ups on the built brand files (public/cat/<slug>.json), found in the 15 Oct 2026 review (update 8z).
Safe to run again: each fix only touches rows that still have the problem.
- TVS: '---', '-', '"' etc. are not part numbers. A row whose remark starts with the real number ('NB020050 (YELLOW)') takes it;
  a ditto row ('"') takes the number of the same book, figure and ref; the rest get no number ("No number in the catalogue").
- Yamaha (old CRUX / YD110 / YBR125DX books): the description carries the real number at its end and junk at its start
  ('1 4S-E3329-00 GASKET PUMP COVER 4LS-E3329-00-00'): the row takes that number and the clean name.
- Royal Enfield: '570030_ND VERSION' -> part no. 570030, remark ND VERSION.
- Every brand: a row with no description takes the description the same number has elsewhere in the brand's books;
  an MRP of 0 is dropped (no MRP, not Rs 0); MRPs from Sam's own price lists that the build missed are added (MRP_ADD).
usage: python3 catfix.py <public/cat dir>"""
import sys, os, re, json, collections
CAT = sys.argv[1]
PH = re.compile(r'^[-"\s]*$')
YPN = re.compile(r'^(?:\d+\s+)?(?:[0-9A-Z]{1,3}-?[0-9A-Z]{2,5}-[0-9A-Z]{2}\s+)?(.*?)\s+([0-9A-Z]{3}-[0-9A-Z]{5}-[0-9A-Z]{2}-[0-9A-Z]{2})\s*$')
# Sam's lists (Royal Enfield/RE_MRP_PriceList_2026-10.xlsx, Yamaha/*/03_Parts_List_Excel/*.xlsx), checked 15 Oct 2026
MRP_ADD = {'royal-enfield': {'ST31526B': 4382},
           'yamaha': {'36L-F2110-10': 1441, '36L-F2210-00': 924, '1PM-XF17B-40': 433, '5YY-XF471-20-33': 445, '5YY-F471K-E0-10': 404,
                      '5YY-F472K-E0-10': 404, '5TS-F1720-30-00': 360, '5YY-F4100-F0-00': 3589, '5YY-F8100-20-10': 130}}
def run(slug):
    f = os.path.join(CAT, slug + '.json')
    if not os.path.exists(f): return
    d = json.load(open(f, encoding='utf-8')); D = d['d']; n = collections.Counter()
    desc = d['desc']
    def dtext(r): return desc[r[6]] if isinstance(r[6], int) else (r[6] or '')
    def setdesc(r, t):
        if t not in IDX: IDX[t] = len(desc); desc.append(t)
        r[6] = IDX[t]
    IDX = {t: i for i, t in enumerate(desc)}
    if slug == 'tvs':
        real = collections.defaultdict(set)
        for r in D:
            if r[5] and not PH.match(r[5]): real[(r[0], r[2], r[4])].add(r[5])
        for r in D:
            if not r[5] or not PH.match(r[5]): continue
            m = re.match(r'^([A-Z]{1,2}\d{6,8}[A-Z0-9]{0,3})\b\s*(.*)$', r[8] or '')
            if m: r[5], r[8] = m.group(1), m.group(2).strip(' -()') ; n['tvs number from remark'] += 1; continue
            s = real.get((r[0], r[2], r[4]))
            if r[5].startswith('"') and s and len(s) == 1: r[5] = next(iter(s)); n['tvs ditto'] += 1; continue
            r[5] = ''; n['tvs placeholder cleared'] += 1
    if slug == 'yamaha':
        for r in D:
            t = dtext(r); m = YPN.match(t)
            if m and (m.group(2) != r[5] or re.match(r'^\d+ ', t)):
                r[5] = m.group(2); setdesc(r, re.sub(r'^(?:\S*\d\S*[-.]\S+\s+)+', '', m.group(1)).strip() or m.group(1).strip()); n['yamaha number from name'] += 1
    if slug == 'royal-enfield':
        for r in D:
            m = re.match(r'^(\d{5,7})_(.+)$', r[5] or '')
            if m: r[5], r[8] = m.group(1), (m.group(2) + (' ' + r[8] if r[8] else '')).strip(); n['re number fixed'] += 1
    best = {}
    for r in D:
        t = dtext(r).strip()
        if r[5] and t: best.setdefault(r[5], t)
    for r in D:
        if r[5] and not dtext(r).strip() and r[5] in best: setdesc(r, best[r[5]]); n['name from same number'] += 1
    if 'mrp' in d:
        z = [k for k, v in d['mrp'].items() if not v]
        for k in z: del d['mrp'][k]
        n['mrp 0 dropped'] += len(z)
        for k, v in MRP_ADD.get(slug, {}).items():
            if not d['mrp'].get(k): d['mrp'][k] = v; n['mrp added'] += 1
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(slug, dict(n))
for s in ('bajaj', 'hero', 'honda', 'husqvarna', 'ktm', 'royal-enfield', 'suzuki', 'tvs', 'yamaha'): run(s)
