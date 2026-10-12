"""Bajaj: where each plate's diagram is in Sam's Bajaj PDFs (bajaj_spc_pdfs.zip), and fixes for the plate numbers of bajaj_parts.csv.

Reads the 90 PDFs (the same files as inside the zip, CRC checked) and bajaj_parts.csv, writes bajaj-pages.json:
  plates  {"<pdf_file>|<plate>": [page, x0, y0, x1, y1]}   page 1-based, the crop as fractions of the page as it is shown (its /Rotate applied)
  relabel {"<csv row>": [plate, section]}   the 12 oldest books print two plates on one page (left and right half); the CSV gives every
                                           line of such a page the first plate. The line's part number found on the page says its half.
  drop    [csv row, ...]                   lines read off pages that are no plate at all (a book's revision table)
  fmt     {"<pdf_file>": 'modern' | 'old' | 'code' | 'scan'}
Layouts: modern = one plate per landscape page, its diagram in the left half, its table in the right half -> crop the left half.
old = two plates per page, each half a diagram over its table -> crop the plate's half. code (old Avenger 180) = one plate per portrait
page -> whole page. scan = the 4 scanned books (no text in the PDF, the CSV was read by OCR) -> whole page, so its own table shows too.

usage: python3 -I bj_pages.py <folder with the PDFs as pdfs/...> <bajaj_parts.csv> <out json>"""
import collections, csv, hashlib, json, re, sys
import pymupdf
csv.field_size_limit(1 << 30)
PDFS, CSV, OUT = sys.argv[1:4]
PAT = [('modern', re.compile(r'^Plate\s*No\.?\s*:\s*([0-9]{1,3}[A-Z]?)\b')),
       ('old', re.compile(r'^Plate\s*No\.?\s*([0-9]{1,3}[A-Z]?(?:\s*&\s*[0-9]{1,3}[A-Z]?)*)\s*:\s*(.*)$')),
       ('code', re.compile(r'^Plate\s*Code\s*:\s*"([0-9]{1,3}[A-Z]?)"'))]
N = lambda s: re.sub(r'\s+', '', s or '').upper().lstrip('0') or '0'
PN = lambda s: re.sub(r'[^A-Z0-9]', '', (s or '').upper())
raw = open(CSV, 'rb').read()
rows = list(csv.DictReader(open(CSV, encoding='utf-8-sig', newline='')))
by_book = collections.defaultdict(list)
for i, r in enumerate(rows):
    by_book[r['pdf_file']].append(i)
out = {'csv_md5': hashlib.md5(raw).hexdigest(), 'plates': {}, 'relabel': {}, 'drop': [], 'fmt': {}, 'pages': {}}
stats = collections.Counter()


def page_info(pg):
    """header lines [(plates, fmt, side, title)] and lines [(normalised text, side)] of a page, in its shown orientation"""
    W, H, M = pg.rect.width, pg.rect.height, pg.rotation_matrix
    lines = collections.defaultdict(list)
    for w in pg.get_text('words'):
        lines[(w[5], w[6])].append(w)
    heads, L = [], []
    for l in lines.values():
        t = ' '.join(w[4] for w in l)
        r = pymupdf.Rect(min(w[0] for w in l), min(w[1] for w in l), max(w[2] for w in l), max(w[3] for w in l)) * M
        side = 'L' if (r.x0 + r.x1) / 2 < W / 2 else 'R'
        L.append((PN(t), side))
        for name, p in PAT:
            m = p.match(t)
            if m:
                ps = [N(x) for x in re.split(r'\s*&\s*', m.group(1))]
                title = m.group(2).strip() if name == 'old' else ''
                heads.append((ps, name, side, title))
                break
    return heads, L


for book, idxs in sorted(by_book.items()):
    doc = pymupdf.open(PDFS + '/' + book)
    out['pages'][book] = doc.page_count
    info = [page_info(pg) for pg in doc]
    fmts = collections.Counter(h[1] for hs, _ in info for h in hs)
    fmt = fmts.most_common(1)[0][0] if fmts else 'scan'
    out['fmt'][book] = fmt
    hp = collections.defaultdict(list)          # plate -> [(page, side)] where its header is
    for p, (hs, _) in enumerate(info, 1):
        for ps, name, side, title in hs:
            for x in ps:
                hp[x].append((p, side))
    plate_of = {}                               # csv row -> (plate, page, side)
    on_page = collections.defaultdict(list)
    for i in idxs:
        on_page[int(rows[i]['Catalogue Page'])].append(i)
    for p, ids in sorted(on_page.items()):
        hs, L = info[p - 1] if 0 < p <= len(info) else ([], [])
        if fmt != 'scan' and not hs:            # a page with no plate on it (revision table, index)
            out['drop'] += ids
            stats['dropped'] += len(ids)
            continue
        if fmt != 'old':
            for i in ids:
                plate_of[i] = (N(rows[i]['Plate No.']), p, None)
            continue
        # two plates a page: each line's half from where its part number is printed; the CSV lists the left table, then the right
        known = []
        for i in ids:
            pn = PN(rows[i]['Part No.'])
            sides = {s for t, s in L if len(pn) >= 5 and pn in t}
            known.append(next(iter(sides)) if len(sides) == 1 else None)
        best = min(range(len(ids) + 1), key=lambda k: (sum(1 for j, s in enumerate(known) if s and s != ('L' if j < k else 'R')), -k))
        head = {}
        for ps, name, side, title in hs:
            head.setdefault(side, (ps[0], title))
        for j, i in enumerate(ids):
            side = 'L' if j < best else 'R'
            if side in head:
                pl, title = head[side]
                if pl != N(rows[i]['Plate No.']):
                    out['relabel'][str(i)] = [pl, title or rows[i]['Section']]
                    stats['relabelled'] += 1
                plate_of[i] = (pl, p, side)
            else:
                plate_of[i] = (N(rows[i]['Plate No.']), p, side)
    # each plate: its page and crop
    rows_of = collections.defaultdict(list)
    for i, (pl, p, side) in plate_of.items():
        rows_of[pl].append((p, side))
    for pl, ps in rows_of.items():
        pages = collections.Counter(p for p, _ in ps)
        lo, hi = min(pages), max(pages)
        page = side = None
        hh = sorted(hp.get(pl, []))
        near = [x for x in hh if lo - 1 <= x[0] <= hi + 1]
        if near:
            page, side = near[0]
            stats['by header'] += 1
        else:
            srt = sorted(pages)                 # the run of pages with most of its lines
            runs, cur = [], [srt[0]]
            for q in srt[1:]:
                if q - cur[-1] <= 1:
                    cur.append(q)
                else:
                    runs.append(cur); cur = [q]
            runs.append(cur)
            run = max(runs, key=lambda r: sum(pages[q] for q in r))
            page = run[0]
            side = collections.Counter(s for p, s in ps if p == page).most_common(1)[0][0]
            stats['by csv page'] += 1
        if fmt == 'modern':
            crop = [0, 0, 0.5, 1]
        elif fmt == 'old' and side in ('L', 'R'):
            crop = [0, 0, 0.5, 1] if side == 'L' else [0.5, 0, 1, 1]
        else:
            crop = [0, 0, 1, 1]
        out['plates'][book + '|' + pl] = [page] + crop
    stats['books'] += 1
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print(dict(stats), 'plates', len(out['plates']), 'fmt', collections.Counter(out['fmt'].values()))
