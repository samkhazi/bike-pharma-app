"""Bajaj + KTM (+ Husqvarna, same part numbers) MRP from Sam's folder Downloads > MY MITTAL DATA (Sam 2026-10-20: "Bajaj aur KTM ka
poora csv file se with MRP bas uss MRP se apne bajaj aur KTM ke catalogue me daalde"). Only the MRP goes in, for part numbers already in our
books; models and names stay from the books.   python3 mittal_mrp.py "<MY MITTAL DATA>/MRP_master_unique_partno.csv" ../../public/cat"""
import csv, json, re, sys
src, cat = sys.argv[1], sys.argv[2]
pk = lambda s: re.sub(r'[^A-Z0-9]', '', str(s).upper())
# The master file keeps each number under ONE brand (Dominar's JY511220 is under "ktm"), so the MRP is looked up by number only.
# Some rows of the combined file carry the quantity glued after the MRP (39199020: 50 in KTM, "501"/"502" in Avenger/Dominar):
# a value that is another value of the same number plus one digit is dropped.
num = lambda v: (lambda f: int(f) if f == int(f) else round(f, 2))(float(v))
vals, M = {}, {}
for f in (src, src.replace('MRP_master_unique_partno.csv', 'ALL_bajaj_ktm_combined.csv')):
    for r in csv.DictReader(open(f, encoding='utf-8-sig')):
        k, v = pk(r['part_no']), str(r['mrp']).strip()
        try:
            if not k or num(v) <= 0: continue
        except ValueError: continue
        vals.setdefault(k, set()).add(v)
        if f == src: M[k] = v
glued = 0
for k, vs in vals.items():
    ok = {v for v in vs if not any(v != o and len(v) == len(o) + 1 and v.startswith(o) for o in vs)}
    if k in M and M[k] not in ok: glued += 1; M[k] = min(ok, key=float)
    elif k not in M: M[k] = min(ok, key=float)
M = {k: num(v) for k, v in M.items()}
print('Mittal part no.', len(M), 'glued MRP fixed', glued)
SRC = 'MRP from Mittal Auto Spares list (Sam\'s folder MY MITTAL DATA, 20 Oct 2026)'
for slug in ('bajaj', 'ktm', 'husqvarna'):
    f = '%s/%s.json' % (cat, slug); d = json.load(open(f))
    pns = {r[5] for r in d['d'] if r[5]}
    mrp = {p: M[pk(p)] for p in sorted(pns) if pk(p) in M}
    d['mrp'] = mrp
    d['src'] = [s for s in d['src'] if 'Mittal' not in s] + [SRC]
    json.dump(d, open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(slug, 'part no.', len(pns), 'with MRP', len(mrp))
