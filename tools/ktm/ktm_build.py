"""KTM + Husqvarna for Find Part, from Sam's KTM HD catalogue PDFs (11 Oct 2026; parsed by ktm_parse.py).
Writes <out>/ktm.json, husqvarna.json (the app's catalogue format: one row per line, merged across model years) and
<out>/ktm-dg.json, husqvarna-dg.json: per model year and diagram ('Engine 7'), where its picture is: 'pa:<path>:<offset>:<length>' =
the ASCII85 stream of the JPEG inside the PDF on the server (catalogues/ktm/<file>), decoded to the exact original JPEG bytes
(Sam: "diagram aur image ki quality thoda bhi kam nhi hona he"). A drawing used by several model years is read from one place.
usage: python3 -I ktm_build.py parsed.json <out dir>"""
import collections, json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
DIR = 'catalogues/ktm'
SRC_NAME = 'KTM spare parts catalogue (KTM Spare Parts Finder, India; data as of 30 Sep 2026)'
KTM_ORDER = ['125 Duke', '160 Duke', '200 Duke', '200 Duke UG', '200 Duke UG 2', '200 Duke UG OBD2B', '250 Adventure', '250 Duke', '250 Duke GEN3',
             '390 Adventure', '390 Adventure R', '390 Adventure S', '390 Adventure X (350)', '390 Adventure X', '390 Adventure X Plus', '390 Duke',
             '390 Duke (350)', '390 Duke GEN3', '390 Duke R', '790 Duke', 'Adventure Rally 390', 'Enduro 390 R', 'RC 125', 'Adventure X 390',
             'RC 125 GEN2', 'RC 160', 'RC 200', 'RC 200 GEN2', 'RC 200 UG OBD2B', 'RC 390', 'RC 390 GEN2', 'RC 390 UG OBD2B']
HUSQ = ['Vitpilen 250', 'Svartpilen 250', 'Svartpilen 401']
CC = {'125 Duke': 125, '160 Duke': 160, '200 Duke': 200, '200 Duke UG': 200, '200 Duke UG 2': 200, '200 Duke UG OBD2B': 200, '250 Adventure': 249,
      '250 Duke': 249, '250 Duke GEN3': 249, '390 Adventure': 373, '390 Adventure R': 373, '390 Adventure S': 373, '390 Adventure X (350)': 373,
      '390 Adventure X': 373, '390 Adventure X Plus': 373, '390 Duke': 373, '390 Duke (350)': 373, '390 Duke GEN3': 373, '390 Duke R': 373,
      '790 Duke': 799, 'Adventure Rally 390': 373, 'Enduro 390 R': 399, 'RC 125': 125, 'Adventure X 390': 399, 'RC 125 GEN2': 125, 'RC 160': 164,
      'RC 200': 200, 'RC 200 GEN2': 200, 'RC 200 UG OBD2B': 200, 'RC 390': 373, 'RC 390 GEN2': 373, 'RC 390 UG OBD2B': 373,
      'Vitpilen 250': 249, 'Svartpilen 250': 249, 'Svartpilen 401': 399}
WORDS = {'DUKE': 'Duke', 'ADVENTURE': 'Adventure', 'RALLY': 'Rally', 'ENDURO': 'Enduro', 'PLUS': 'Plus', 'SVARTPILEN': 'Svartpilen', 'VITPILEN': 'Vitpilen'}
pretty = lambda raw: ' '.join(WORDS.get(w, w) for w in re.split(r'[- ]+', raw.strip()))
PN = re.compile(r'\b(?=[0-9A-Z]*\d)[0-9A-Z]{7,9}\b')
PLACEHOLDER = re.compile(r'^-?$|\*|XXXX')


def one_pn(t):
    t = t.strip().upper()
    if PLACEHOLDER.search(t):
        return ''
    t = re.sub(r'(?<=\d)V+$', '', t).rstrip('.')
    if ' ' in t and re.fullmatch(r'[0-9A-Z ]{7,12}', t):
        t = t.replace(' ', '')
    return t if re.fullmatch(r'[0-9A-Z]{6,10}', t) else t


def split_cell(pn, desc):
    """'JP131861 (OLD 300mm) / JP131860 (NEW 320mm)' -> two lines with their notes; '36JY0310 - BLK 36JY0311 - ORG' with a description
    that repeats the numbers -> each number with its own text. Otherwise one line."""
    u = pn.strip().upper()
    if PLACEHOLDER.search(u):
        return [('', desc.strip())]
    toks = [m for m in PN.finditer(u) if not u[max(0, m.start() - 6):m.start()].endswith('FROM ')]
    toks = [m for m in toks if not re.fullmatch(r'MD2[0-9A-Z]+', m.group(0))]
    if len(toks) < 2:
        return [(one_pn(pn), desc.strip())]
    out = []
    for k, m in enumerate(toks):
        seg = pn[m.end():toks[k + 1].start() if k + 1 < len(toks) else len(pn)]
        note = re.sub(r'^[\s\-,/]+|[\s\-,/]+$', '', seg).strip()
        note = note[1:-1].strip() if note.startswith('(') and note.endswith(')') and note.count('(') == 1 else note
        d = desc.strip()
        du = d.upper()
        if m.group(0) in du and all(t.group(0) in du for t in toks):  # the description repeats the numbers: take this number's part
            a = du.index(m.group(0)) + len(m.group(0))
            nxt = [du.index(t.group(0)) for t in toks if du.index(t.group(0)) > a - len(m.group(0))]
            b = min([x for x in nxt if x >= a] or [len(d)])
            own = re.sub(r'^[\s\-,/]+|[\s\-,/]+$', '', d[a:b]).strip()
            d = own if own and own.upper() != note.upper() else ''
        elif ' / ' in d and d.count(' / ') == len(toks) - 1:
            d = d.split(' / ')[k].strip()
            note = ''
        if not d:
            d = ASM_NOW
        out.append((m.group(0), d + (' (' + note + ')' if note and note.upper() not in d.upper() else '')))
    return out


R = json.load(open(SRC))
# each drawing is read from one PDF: the fewest megabytes of PDFs that hold every drawing (greedy set cover), so Sam uploads only those
where = collections.defaultdict(dict)  # md5 -> file -> (off, len)
for b in R:
    for a in b['asm']:
        if a['img']:
            where[a['img']['md5']].setdefault(b['file'], (a['img']['off'], a['img']['len']))
size = {b['file']: b['size'] for b in R}
left, chosen = set(where), []
while left:
    best = max(size, key=lambda f: (sum(1 for h in left if f in where[h]) / size[f], f))
    got = {h for h in left if best in where[h]}
    assert got
    chosen.append(best)
    left -= got
rank = {f: i for i, f in enumerate(chosen)}
first = {}
for h, fs in where.items():
    f = min((f for f in fs if f in rank), key=rank.get)
    first[h] = 'pa:%s/%s:%d:%d' % (DIR, f, fs[f][0], fs[f][1])
print('PDFs needed for the drawings', len(chosen), 'of', len(R), round(sum(size[f] for f in chosen) / 1e6), 'MB of', round(sum(size.values()) / 1e6))
lines = []  # (model, year, group, asm, ref, pn, desc, qty, rem)
pics = {}   # (model, year, group) -> md5
for b in sorted(R, key=lambda b: b['file']):
    model, year = pretty(b['model']), 2000 + b['my']
    assert model in CC, model
    for a in b['asm']:
        grp = '%s %d' % (a['kind'].title(), a['n'])
        ASM_NOW = a['name']
        if a['img']:
            im = a['img']
            pics[(model, year, grp)] = im['md5']
        for ref, pn, desc, qty, rem in a['rows']:
            for p, d in split_cell(pn, desc):
                lines.append((model, year, grp, a['name'], ref, p, d, qty, rem))
print('lines', len(lines), 'split extra', len(lines) - sum(len(a['rows']) for b in R for a in b['asm']))
weird = sorted({x[5] for x in lines if x[5] and not re.fullmatch(r'[0-9A-Z]{7,9}', x[5])})
print('odd part numbers left', weird[:20])


def pack(brand, slug, order):
    my = [x for x in lines if x[0] in order]
    years = collections.defaultdict(set)
    for x in my:
        years[x[0]].add(x[1])
    vl = [(m, y) for m in order for y in sorted(years[m], reverse=True)]
    vi = {v: i for i, v in enumerate(vl)}
    labels = ['%s %d (MY%02d)' % (m, y, y % 100) for m, y in vl]
    gk = lambda g: (g.split()[0] != 'Engine', int(g.split()[1]))
    rk = lambda r: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', r)]
    rows, asm, desc = collections.OrderedDict(), {}, {}
    for x in sorted(my, key=lambda x: (order.index(x[0]), -x[1], gk(x[2]), rk(x[4]))):
        k = (x[2], x[3], x[4], x[5], x[6], x[7], x[8])
        rows.setdefault(k, set()).add(vi[(x[0], x[1])])
    d = []
    for (g, a, ref, pn, name, qty, rem), vs in rows.items():
        d.append([0, -1, g, asm.setdefault(a, len(asm)), ref, pn, desc.setdefault(name, len(desc)), qty, rem, 0, 0, sorted(vs)])
    inv = lambda m: [k for k, _ in sorted(m.items(), key=lambda t: t[1])]
    ms = [m for m in order if m in years]
    cat = {'brand': brand, 'src': [SRC_NAME], 'bk': [[0, [], '']], 'models': ms, 'cur': len(ms), 'cc': {m: CC[m] for m in ms}, 'sheets': [], 'figs': [],
           'vars': labels, 'vmod': {l: m for l, (m, _) in zip(labels, vl)}, 'asm': inv(asm), 'desc': inv(desc), 'd': d, 'fw': 'Diagram'}
    # pictures: per model year, group -> index into f
    f, fi, p = [], {}, []
    for (m, y) in vl:
        e = {}
        for (mm, yy, g), h in pics.items():
            if mm == m and yy == y:
                if h not in fi:
                    fi[h] = len(f)
                    f.append(first[h])
                e[g] = fi[h]
        p.append(dict(sorted(e.items(), key=lambda t: gk(t[0]))))
    need = sorted({u.split(':')[1].split('/')[-1] for u in f})
    files = [[b['file'], b['size'], b['md5']] for b in sorted(R, key=lambda b: b['file']) if b['file'] in need]
    spare = [[b['file'], b['size']] for b in sorted(R, key=lambda b: b['file']) if b['file'] not in rank]  # same drawings are in the needed PDFs
    dg = {'f': f, 'p': p, 'dir': DIR, 'files': files, 'spare': spare}
    for name, o in ((slug + '.json', cat), (slug + '-dg.json', dg)):
        path = os.path.join(OUT, name)
        tmp = path + '.tmp'
        with open(tmp, 'w') as fh:
            json.dump(o, fh, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, path)
        print('ok', name, os.path.getsize(path))
    print('  ', brand, len(ms), 'models', len(labels), 'model years', len(d), 'rows', len({r[5] for r in d if r[5]}), 'part no.', len(f), 'drawings',
          'from', len(files), 'PDFs')
    return cat, dg


os.makedirs(OUT, exist_ok=True)
pack('KTM', 'ktm', KTM_ORDER)
pack('Husqvarna', 'husqvarna', HUSQ)
