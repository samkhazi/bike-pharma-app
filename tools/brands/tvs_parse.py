"""Reads Sam's folder All Catalogues > TVS ALL (TVS's own parts catalogues as PDF, made from TVS's Excel masters, and TVS's colour /
painted part lists) and writes tvs-pages.json for brands_build.py (tvs_books()). Read only: the PDFs are opened, never written.
  books {file: {"size", "md5", "pages", "kind": "parts" | "colour" | "none", "cover": [text of the first pages], "text_pages",
                "lines": [[page 1-based, fig, title, ref, part no., description, [qty per column], remarks], ...],
                "cols": {page: [quantity column labels]}, "notes": {page: [footnotes under the table]},
                "colour": [[page, block title, model title, ref, part no., description], ...],
                "kits": [[page, kit no., kit ref, kit part no., kit description, model, ref, part no., description, qty], ...],
                "grades": [[page, s.no, part no., description, qty per engine, serial, grade, graded part no.], ...],
                "other": {page: what an unread page holds}, "errs": {page: why a page was not read}}}
A parts page has its figure's diagram on the left and its parts table on the right: REF NO. / PART NO. / DESCRIPTION / NO. OFF (one
quantity column for each version of the bike the book covers, e.g. DRUM | DISC) / REMARKS. The table's columns are found from the lines
TVS drew between them (the vertical rules of the table), the column labels from the header words inside each column, and every word is
put in its column by where it sits on the page, so the book's own text order does not matter. A figure that needs more lines goes on
over the next page with the same FIG.NO. Text TVS covered with a white box (an old number with the new one written over it) is not
read: only what the page shows. Colour books list each colour's painted parts (S.NO / PART NO / DESCRIPTION) under a title naming the
model and the colour, or as a matrix (one column of part numbers per colour).
usage: python3 -I tvs_parse.py <TVS ALL folder> <out json> [book file ...]"""
import collections, hashlib, json, os, re, sys
import pymupdf

# a TVS part number: N9081830, K1234567, KE2271200D, NR320490, 0330408, 420454700, 3100218002H, N42200707D, K61504003C
PN = re.compile(r'^(?:[A-Z]{1,2}\d{5,9}[A-Z0-9]{0,3}|\d{6,11}[A-Z]{0,3})$')
DASH = re.compile(r'^[-_.–—…]{2,}$')                    # '---' : no part number of its own
REF = re.compile(r'^\d{1,3}[A-Z]{0,2}(?:\.\d{1,2})?\*?$')
FIG = re.compile(r'FIG\s*\.?\s*N[O0]\s*\.?\s*:?\s*(\d{1,3}\s?[A-Z]?)\b', re.I)
# a remark TVS printed in two lines of one cell: its first line ends so, its second line is so
REM_HEAD = re.compile(r'\b(REF\.?\s*COLOU?R|Replaces|S\.\s?No\.?\s*-?)$', re.I)
REM_TAIL = re.compile(r'^(MATRIX|MATRIC|MAT\.?|PAGE(?:\s*NO\.?)?|[A-Z]{1,2}\d{6,}[A-Z0-9]*|\d[\d,]*)$')
# what a quantity cell holds: a number, AR (as required), NA, a ditto mark, a footnote mark
QTOK = re.compile(r'^(?:\d{1,3}(?:\.\d{1,2})?[*#$&@]{0,3}|A\.?R\.?|N\.?A\.?|["”“]|[*#$&@]{1,3}|[-–—]{1,3})$')


def pn_ok(t):
    return bool(PN.match(t)) and sum(c.isdigit() for c in t) >= 6


def hidden_chars(pg):
    """characters drawn over later by an opaque white fill (TVS covered an old number or label with a white box and wrote the new one
    over it), and invisible text: {(code, origin x, origin y)} in unrotated page points"""
    tr = pg.get_texttrace()
    out = set()
    if not tr:
        return out
    grid = collections.defaultdict(list)
    for d in pg.get_drawings():
        f = d.get('fill')
        if f is not None and min(f) >= 0.95 and (d.get('fill_opacity') or 1) >= 0.5:
            r = pymupdf.Rect(d['rect'])
            for k in range(int(r.y0 // 20), int(r.y1 // 20) + 1):
                grid[k].append((d['seqno'], r))
    for s in tr:
        inv = s.get('type') == 3 or s.get('opacity', 1) == 0
        for c in s['chars']:
            key = (c[0], round(c[2][0], 1), round(c[2][1], 1))
            if inv:
                out.add(key)
                continue
            b = c[3]
            x, y = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            for sq, r in grid.get(int(y // 20), ()):
                if sq > s['seqno'] and r.x0 <= x <= r.x1 and r.y0 <= y <= r.y1:
                    out.add(key)
                    break
    return out


def words(pg):
    """the page's visible words that run left to right on the page as it is shown (its /Rotate applied), as (x0, y0, x1, y1, text).
    A word ends at a space, or where the next letter jumps back or leaves a gap (a description and its quantity printed close)."""
    rm = pg.rotation_matrix
    hid = hidden_chars(pg)
    out = []
    for b in pg.get_textpage().extractRAWDICT()['blocks']:
        for ln in b.get('lines', []):
            dx, dy = ln['dir']
            sx, sy = rm.a * dx + rm.c * dy, rm.b * dx + rm.d * dy
            if not (abs(sy) < 0.01 and sx > 0):
                continue
            cur, last = [], None

            def flush():
                if cur:
                    r = pymupdf.Rect(cur[0][0])
                    for bb, _ in cur[1:]:
                        r |= pymupdf.Rect(bb)
                    r = r * rm
                    out.append((r.x0, r.y0, r.x1, r.y1, ''.join(c for _, c in cur)))
                cur.clear()
            for sp in ln['spans']:
                fs = sp['size']
                for ch in sp['chars']:
                    c, o, bb = ch['c'], ch['origin'], ch['bbox']
                    if c.isspace() or (ord(c), round(o[0], 1), round(o[1], 1)) in hid:
                        flush()
                        last = None
                        continue
                    p0 = min(bb[0] * dx, bb[2] * dx) + min(bb[1] * dy, bb[3] * dy)
                    p1 = max(bb[0] * dx, bb[2] * dx) + max(bb[1] * dy, bb[3] * dy)
                    if last is not None and (p0 < last - 0.3 * fs or p0 > last + 0.3 * fs):
                        flush()
                    cur.append((bb, c))
                    last = p1
            flush()
    return out


def rows_of(ws, tol=2.5):
    out = []
    for w in sorted(ws, key=lambda w: (w[3], w[0])):
        if out and w[3] - out[-1][0] <= tol:
            out[-1][1].append(w)
        else:
            out.append([w[3], [w]])
    return [(y, sorted(L, key=lambda w: w[0])) for y, L in out]


def vsegs(pg, x0, x1, y0, y1):
    """vertical rules drawn on the page inside x0..x1 that reach into y0..y1, as (x, top, bottom) in shown-page points"""
    rm = pg.rotation_matrix
    out = []

    def add(xa, ya, xb, yb):
        p, q = pymupdf.Point(xa, ya) * rm, pymupdf.Point(xb, yb) * rm
        if abs(p.x - q.x) < 1.2 and abs(p.y - q.y) > 5:
            x, t, b = (p.x + q.x) / 2, min(p.y, q.y), max(p.y, q.y)
            if x0 <= x <= x1 and t < y1 and b > y0:
                out.append((x, t, b))

    for d in pg.get_cdrawings():
        r = pymupdf.Rect(d['rect']) * rm
        if r.x1 < x0 - 2 or r.x0 > x1 + 2 or r.y1 < y0 or r.y0 > y1:
            continue
        for it in d['items']:
            if it[0] == 'l':
                add(*it[1], *it[2])
            elif it[0] == 're':
                a, b2, c, e = it[1]
                if c - a < 2.5:                 # a thin filled bar drawn as a rule
                    add((a + c) / 2, b2, (a + c) / 2, e)
                elif e - b2 < 2.5:
                    add(a, (b2 + e) / 2, c, (b2 + e) / 2)
                else:
                    add(a, b2, a, e)
                    add(c, b2, c, e)
            elif it[0] == 'qu':
                q = it[1]
                pts = [q[0], q[1], q[3], q[2]]
                for k in range(4):
                    add(*pts[k], *pts[(k + 1) % 4])
    return out


def boundaries(segs, y0, y1, need=0.45):
    """x of the table's column rules: x positions whose rules cover at least `need` of y0..y1"""
    segs = sorted(segs)
    groups = []
    for s in segs:
        if groups and s[0] - groups[-1][-1][0] <= 1.6:
            groups[-1].append(s)
        else:
            groups.append([s])
    out = []
    for g in groups:
        iv = sorted((max(t, y0), min(b, y1)) for _, t, b in g if min(b, y1) > max(t, y0))
        cov, cur = 0, None
        for a, b in iv:
            if cur and a <= cur[1] + 1:
                cur[1] = max(cur[1], b)
            else:
                if cur:
                    cov += cur[1] - cur[0]
                cur = [a, b]
        if cur:
            cov += cur[1] - cur[0]
        if cov >= need * (y1 - y0):
            out.append((sum(x for x, _, _ in g) / len(g), min(t for _, t, _ in g), max(b for _, _, b in g)))
    merged = []
    for b in out:                                   # double rules (two lines 1-8 pt apart): one boundary
        if merged and b[0] - merged[-1][0] < 3.5:
            merged[-1] = ((merged[-1][0] + b[0]) / 2, min(merged[-1][1], b[1]), max(merged[-1][2], b[2]))
        else:
            merged.append(b)
    return merged


def cx(w):
    return (w[0] + w[2]) / 2


def col_of(w, xs):
    c = cx(w)
    for k in range(len(xs) - 1):
        if xs[k] <= c < xs[k + 1]:
            return k
    return None


def parse_page(pg, ws, last):
    """the page's parts table -> {fig, here (the page prints its FIG.NO.), title, labels (one per column), rem_found, xs, lines
    [[y, [cell text per column]]], notes}; None when the page has no parts table; last = [fig, title] of the page before"""
    W, H = pg.rect.width, pg.rect.height
    pns = [w for w in ws if (pn_ok(w[4]) or DASH.match(w[4])) and cx(w) > W * 0.3]
    if not any(pn_ok(w[4]) for w in pns):
        # a figure whose every line is '---' (no part number of its own) still is a figure
        if sum(1 for w in pns if DASH.match(w[4])) < 3 or not FIG.search(' '.join(w[4] for w in ws)):
            return None
    # the part number column: the left-most bunch of part numbers (and '---') that holds a good share of them (a remarks column on
    # the right may list kit part numbers)
    cl = []
    for w in sorted(pns, key=lambda w: w[0]):
        if cl and w[0] - cl[-1][-1][0] < 25:
            cl[-1].append(w)
        else:
            cl.append([w])
    big = max(len(c) for c in cl)
    pick = next(c for c in cl if len(c) >= max(min(3, big), 0.3 * big))
    med = sorted(w[0] for w in pick)[len(pick) // 2]
    pns = pick
    ty0, ty1 = min(w[1] for w in pns) - 2, max(w[3] for w in pns) + 2
    if ty1 - ty0 < 20:
        ty0, ty1 = ty0 - 10, ty1 + 10
    segs = vsegs(pg, med - 120, W, ty0, ty1)
    bs = boundaries(segs, ty0, ty1)
    xs = [b[0] for b in bs]
    pc = None
    for k in range(len(xs) - 1):
        n = sum(1 for w in pns if xs[k] <= cx(w) < xs[k + 1])
        if n >= 0.6 * len(pns):
            pc = k
            break
    if pc is None or pc == 0 or pc + 2 >= len(xs):
        return {'err': 'columns not found', 'xs': [round(x) for x in xs], 'pn_x': round(med)}
    xs = xs[pc - 1:]                              # from the ref column's left rule on
    tb = max(b[2] for b in bs[pc - 1:])           # the table's bottom rule
    lines = rows_of([w for w in ws if xs[0] - 2 <= cx(w) < xs[-1] + 2])
    first = None
    for y, L in lines:
        if y < ty0 - 30:
            continue
        if any(col_of(w, xs) == 1 and (pn_ok(w[4]) or DASH.match(w[4])) for w in L):
            first = min(w[1] for w in L)
            break
    if first is None:
        return {'err': 'no first line'}
    # title + figure number: the line of the table's FIG.NO., or the page's
    allines = rows_of(ws)
    figw = [(y, L) for y, L in allines if y < first and FIG.search(' '.join(w[4] for w in L))]
    fig, title, ttop = None, '', None
    tl = [(y, L) for y, L in figw if any(w[0] >= xs[0] - 5 for w in L)] or figw
    if tl:
        y, L = tl[0]
        inside = [w for w in L if w[0] >= xs[0] - 5]
        m = FIG.search(' '.join(w[4] for w in inside))
        if not m:                                   # the figure number is printed over the diagram only (the title across the page)
            inside = None
            m = FIG.search(' '.join(w[4] for w in L))
        fig = m.group(1).replace(' ', '').upper()
        ttop = y
        near = [w for y2, L2 in allines if abs(y2 - y) <= 6 for w in L2
                if (w[0] >= xs[0] - 5 if inside is not None else not re.fullmatch(r'\d{1,3}[A-Z]?', w[4]))]
        tw = ' '.join(w[4] for w in sorted(near, key=lambda w: w[0]))
        tw = FIG.sub(' ', tw)
        tw = re.sub(r'FIG\s*\.?\s*N[O0]\s*\.?', ' ', tw, flags=re.I)
        title = re.sub(r'\s+', ' ', tw).strip(' -:')
    here = bool(fig)
    if not fig:
        fig, title = last[0], last[1]
    elif not title:
        title = last[1] if fig == last[0] else ''
    # header: the words between the title line and the first part line, by column
    hdr = [w for y, L in lines if y <= first + 1 and (ttop is None or y > ttop + 4) for w in L]
    hdr = [w for w in hdr if w[3] <= first + 1]
    labels = []
    for k in range(len(xs) - 1):
        cw = [w for w in hdr if col_of(w, xs) == k]
        if k >= 3:                                  # the 'NO. OFF' over the quantity columns is not a column's name
            cw = [w for w in cw if not re.match(r'^(NO\.?|OFF\.?|NO\.?OFF\.?|QTY\.?)$', w[4], re.I)] or cw
        labels.append(' '.join(w[4] for y, L in rows_of(cw, 4) for w in L))
    rem = None
    for k in range(3, len(labels)):
        if re.search(r'REMARK', labels[k], re.I):
            rem = k
            break
    cells = []
    for y, L in lines:
        if y < first or y > tb + 2:
            continue
        c = [[] for _ in range(len(xs) - 1)]
        for w in L:
            k = col_of(w, xs)
            if k is not None:
                c[k].append(w[4])
        cells.append([y, [' '.join(t) for t in c]])
    notes = [' '.join(w[4] for w in L) for y, L in allines if tb + 2 < y < H - 5 and any(w[0] >= xs[0] - 40 for w in L)]
    return {'fig': fig, 'here': here, 'title': title, 'labels': labels, 'rem': rem, 'xs': [round(x, 1) for x in xs], 'lines': cells,
            'notes': notes}


def assemble(lines, rem):
    """a page's table lines -> rows [ref, part no., description, [qty per column], remarks] (rem = the remarks column)"""
    # a part number printed a little above or below its line (its own line here, nothing else on it) joins the line next to it
    L = [[y, list(c)] for y, c in lines]
    i = 0
    while i < len(L):
        y, c = L[i]
        if (pn_ok(c[1].replace(' ', '')) or DASH.match(c[1].replace(' ', ''))) and not c[0] and not c[2]:
            best = None
            for j in (i - 1, i + 1):
                if 0 <= j < len(L) and abs(L[j][0] - y) <= 6.5 and not L[j][1][1] and (L[j][1][0] or L[j][1][2]) \
                        and not any(a and b for a, b in zip(c, L[j][1])):
                    if best is None or abs(L[j][0] - y) < abs(L[best][0] - y):
                        best = j
            if best is not None:
                L[best][1] = [a or b for a, b in zip(L[best][1], c)]
                del L[i]
                continue
        # a ref number (with its quantities or remark, maybe its part number) printed a little lower or higher than the rest of its line
        if REF.match(c[0]) and not c[2]:
            best = None
            for j in (i - 1, i + 1):
                if 0 <= j < len(L) and abs(L[j][0] - y) <= 4 and not L[j][1][0] and (L[j][1][1] or L[j][1][2]) \
                        and not any(a and b for a, b in zip(c, L[j][1])):
                    if best is None or abs(L[j][0] - y) < abs(L[best][0] - y):
                        best = j
            if best is not None:
                L[best][1] = [a or b for a, b in zip(L[best][1], c)]
                del L[i]
                continue
        # a ditto mark, a small remark or a description printed at the top of its cell (no ref, no part number), much nearer the line
        # below than the line above: it is the line below's (not the second line of a remark in two lines: 'REF.COLOUR' / 'MATRIX')
        if not c[0] and not c[1] and any(c) and i + 1 < len(L):
            yn, nx = L[i + 1]
            tail = i > 0 and not any(c[:rem]) and REM_HEAD.search(' '.join(L[i - 1][1][rem:]).strip()) \
                and REM_TAIL.match(' '.join(c[rem:]).strip())
            if REF.match(nx[0]) and 0 < yn - y <= 5.5 and (i == 0 or y - L[i - 1][0] >= yn - y + 3) and not tail \
                    and not any(a and b for a, b in zip(c, nx)):
                L[i + 1][1] = [a or b for a, b in zip(c, nx)]
                del L[i]
                continue
        i += 1
    out, cur, last_y = [], None, None
    for y, txt in L:
        ref, pn, desc = txt[0], txt[1], txt[2]
        qty, rm_ = [], [txt[k] for k in range(rem, len(txt)) if txt[k]]
        for k in range(3, rem):
            keep, spill = [], []
            for t in txt[k].split():
                (keep if QTOK.match(t) else spill).append(t)
            qty.append(' '.join(keep))
            if spill:                               # a long description runs on into the first quantity column
                if k == 3:
                    desc = (desc + ' ' + ' '.join(spill)).strip()
                else:
                    rm_.insert(0, ' '.join(spill))
        rm_ = ' '.join(rm_)
        pnt = pn.replace(' ', '')
        is_pn = pn_ok(pnt) or bool(DASH.match(pnt))
        if is_pn or (REF.match(ref) and desc):
            cur = [ref, pnt if pn_ok(pnt) else ('' if DASH.match(pnt) else pn), desc, qty, rm_]
            out.append(cur)
            last_y = y
        elif cur and (desc or any(qty) or rm_) and y - last_y < 16 and not ref:
            if desc:
                cur[2] = (cur[2] + ' ' + desc).strip()
            for i, q in enumerate(qty):
                if q and not cur[3][i]:
                    cur[3][i] = q
            if rm_:
                cur[4] = (cur[4] + ' ' + rm_).strip()
            last_y = y
    return out


def colour_page(pg, ws):
    """a colour list page -> [(block title, model title, ref, part no., description)]: each colour's painted parts are a small table
    (S.NO / PART NO / DESCRIPTION) under a title naming the colour (and the model); a matrix page (REF.NO / DESCRIPTION / one column of
    part numbers per colour) gives one block per colour column"""
    lines = rows_of(ws)
    out = []
    hdrs = [(y, L) for y, L in lines if any(w[4].upper().startswith('DESCRIPTION') for w in L) and any(w[4].upper().startswith('PART') or
                                                                                                         w[4].upper().startswith('REF') for w in L)]
    if not hdrs:
        return out
    tl = [L for y, L in lines if y < hdrs[0][0] - 1 and L[0][4] == 'TVS']
    mt = re.search(r'\bTVS\b.*?(?=\bRELEASE\b|$)', ' '.join(w[4] for w in tl[0])) if tl else None
    model = clean(mt.group(0)) if mt else ''
    for hi, (hy, hL) in enumerate(hdrs):
        nxt = hdrs[hi + 1][0] if hi + 1 < len(hdrs) else 1e9
        pnx = [w for w in hL if w[4].upper().startswith('PART')]
        dx = [w for w in hL if w[4].upper().startswith('DESCRIPTION')][0]
        colw = [w for w in hL if w[0] > dx[2] + 5]
        if colw and not any(w[4].upper().startswith('PART') for w in hL):      # a matrix: one part-number column per colour
            body = [(y, L) for y, L in lines if hy < y < nxt]
            xs = sorted({round(w[0]) for y, L in body for w in L if pn_ok(w[4]) and w[0] > dx[2]})
            cols = []
            for x in xs:
                if cols and x - cols[-1][-1] < 25:
                    cols[-1].append(x)
                else:
                    cols.append([x])
            names = []
            for c in cols:
                c0, c1 = min(c) - 15, max(c) + 50
                names.append(' '.join(w[4] for w in colw if c0 <= cx(w) <= c1))
            above = [(y, L) for y, L in lines if hy - 60 < y < hy - 2]
            ver = ' '.join(w[4] for y, L in above for w in L) if above else ''
            for y, L in body:
                ref = ' '.join(w[4] for w in L if w[2] < dx[0] - 10 and REF.match(w[4]))
                desc = ' '.join(w[4] for w in L if dx[0] - 30 <= w[0] < (min(cols[0]) - 5 if cols else 1e9) and not pn_ok(w[4]))
                for k, c in enumerate(cols):
                    pw = [w for w in L if min(c) - 15 <= w[0] <= max(c) + 15 and pn_ok(w[4])]
                    if pw:
                        out.append([(names[k] + ' · ' + ver).strip(' ·'), model, ref, pw[0][4], desc])
            continue
        # a small table: title just above its header
        above = [(y, [w for w in L if w[0] > hL[0][0] - 80]) for y, L in lines if hy - 30 < y < hy - 1]
        above = [(y, L) for y, L in above if L]          # (the picture's callout numbers left of the table are not the title)
        title = clean(re.sub(r"\S*\s*LINE INDICATES LH SIDE", ' ', ' '.join(w[4] for w in above[-1][1]))) if above else ''
        p0 = pnx[0][0] - 25 if pnx else 0
        for y, L in lines:
            if not hy < y < nxt:
                continue
            pw = [w for w in L if pn_ok(w[4]) and w[0] >= p0 - 30]
            if not pw:
                continue
            ref = ' '.join(w[4] for w in L if pw[0][0] - 60 < w[0] and w[2] <= pw[0][0] and REF.match(w[4]))
            desc = ' '.join(w[4] for w in L if w[0] > pw[0][2] + 2)
            out.append([title, model, ref, pw[0][4], clean(desc)])
    return out


def block_table(pg, ws, ncols, key):
    """a list page with merged cells (a kit list, a grading list): its table(s) of `ncols` columns, side by side -> per table, blocks of
    lines: [(left-column texts of the block, [line cells of the right part])]. A block starts where the right part's serial number
    (column `key`) goes back to 1; the merged cells on the left hold one value for the whole block, printed in its middle."""
    W, H = pg.rect.width, pg.rect.height
    lines = rows_of(ws)
    sw = [w for y, L in lines for w in L if re.match(r'^(S\.?\s?NO\.?|S\.)$', w[4], re.I)]
    if not sw:
        return []
    y0 = min(w[1] for w in sw) - 5
    hy = max(w[3] for w in sw) + 2
    segs = vsegs(pg, 0, W, y0, H)
    bot = max((b for _, _, b in segs), default=H)
    bs = boundaries(segs, hy + 10, bot - 2, need=0.6)
    xs = [b[0] for b in bs]
    tables = []
    for x in sorted(w[0] for w in sw):              # a table starts at an S.No. column that is not inside the table before
        if tables and x < tables[-1][-1]:
            continue
        ks = [i for i, b in enumerate(xs) if b <= x + 1]
        if ks and ks[-1] + ncols < len(xs):
            tables.append(xs[ks[-1]:ks[-1] + ncols + 1])
    out = []
    for xs in tables:
        body = []
        for y, L in lines:
            if y <= hy:
                continue
            c = [[] for _ in range(ncols)]
            for w in L:
                k = col_of(w, xs)
                if k is not None:
                    c[k].append(w)
            if any(c):
                body.append((y, c))
        blocks = []
        for y, c in body:
            ser = ' '.join(w[4] for w in c[key])
            if ser.isdigit() and (ser == '1' or not blocks):
                blocks.append([y, y, []])
            if blocks and c[key:] and any(c[key:]):
                if ser.isdigit():
                    blocks[-1][2].append([' '.join(w[4] for w in cc) for cc in c[key:]])
                    blocks[-1][1] = y
                elif blocks[-1][2]:                 # a description going on over two lines
                    for k, cc in enumerate(c[key:]):
                        if cc:
                            blocks[-1][2][-1][k] = (blocks[-1][2][-1][k] + ' ' + ' '.join(w[4] for w in cc)).strip()
        for i, (b0, b1, rows) in enumerate(blocks):
            top = (blocks[i - 1][1] + b0) / 2 if i else b0 - 8
            end = (b1 + blocks[i + 1][0]) / 2 if i + 1 < len(blocks) else min(b1 + 30, bot + 1)    # (not the page number under it)
            left = []
            for k in range(key):
                ww = [w for y, c in body if top < y <= end for w in c[k]]
                left.append(' '.join(w[4] for y, L in rows_of(ww, 3) for w in L))
            out.append((left, rows))
    return out


def clean(s):
    return re.sub(r'\s+', ' ', s.replace('\xad', '-').replace('\xa0', ' ')).strip(' -')


# books whose pages are colour lists (each colour's painted parts), not figures
COLOUR = {'APACHE COLOR PART MATRIX FIN.pdf', 'APCHE COLOUR 2V.pdf', 'APACHE 1604VCOLOUR.pdf', 'APACHE 200 4V COLOUR.pdf', 'JUPITER 125 COLOUR.pdf',
          'SPORT COLOUR.pdf', 'ZL 100 COLOUR.pdf', 'SPORT COLOUR PC.pdf'}


def book(path):
    """one book -> its record for tvs-pages.json (see the top of this file)"""
    raw = open(path, 'rb').read()
    doc = pymupdf.open(stream=raw, filetype='pdf')
    name = os.path.basename(path)
    res = {'size': len(raw), 'md5': hashlib.md5(raw).hexdigest(), 'pages': doc.page_count, 'kind': 'parts', 'lines': [], 'cols': {}, 'notes': {},
           'colour': [], 'kits': [], 'grades': [], 'other': {}, 'errs': {}, 'text_pages': 0}
    res['cover'] = [re.sub(r'\s+', ' ', doc[i].get_text()).strip()[:600] for i in range(min(2, doc.page_count))]
    res['text_pages'] = sum(1 for pg in doc if len(pg.get_text().strip()) > 30)
    if name in COLOUR:
        res['kind'] = 'colour'
        for i, pg in enumerate(doc):
            ws = words(pg)
            for t, m, ref, pn, desc in colour_page(pg, ws):
                res['colour'].append([i + 1, t, m, ref, pn, desc])
            rd = re.search(r'RELEASE\s*DATE\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})', ' '.join(w[4] for w in ws).upper())
            if rd:                                 # a colour matrix prints the release date on a version's first page
                res['notes'][i + 1] = ['RELEASE DATE : ' + rd.group(1)]
        if not res['colour']:
            res['kind'] = 'none'
        return res
    pages = []
    last = [None, '']
    for i, pg in enumerate(doc):
        ws = words(pg)
        text = ' '.join(w[4] for w in ws).upper()
        if 'KIT & KIT CONTENTS' in text and 'KIT PART NO' in text and not FIG.search(text):
            for left, rows in block_table(pg, ws, 8, 4):
                kit_ref, kit_pn, kit_desc, model = left
                for sno, pn, desc, qty in rows:
                    res['kits'].append([i + 1, kit_ref, kit_pn.replace(' ', ''), clean(kit_desc), clean(model), sno, pn.replace(' ', ''), clean(desc), qty])
            continue
        if 'GRADING PART NUMBER' in text and not FIG.search(text):
            for left, rows in block_table(pg, ws, 7, 4):
                sno, pn, desc, qty = left
                for ser, grade, gpn in rows:
                    res['grades'].append([i + 1, sno, pn.replace(' ', ''), clean(desc), qty, ser, grade, gpn.replace(' ', '')])
            continue
        r = parse_page(pg, ws, last)
        if r is None:
            continue
        if 'err' in r:
            res['errs'][i + 1] = r
            continue
        pages.append((i, pg, ws, r))
        if r['here']:
            last = [r['fig'], r['title']]
    # the number of quantity columns, from the pages that name their remarks column: a page that does not (its header drawn as
    # outlines) has the same table
    nq = collections.Counter(r['rem'] - 3 for i, pg, ws, r in pages if r['rem'])
    nq = nq.most_common(1)[0][0] if nq else None
    last_cols = None
    for i, pg, ws, r in pages:
        n = len(r['labels'])
        rem = r['rem'] or (3 + nq if nq is not None and 3 + nq < n else (n - 1 if n > 4 else n))
        cols = r['labels'][3:rem]
        if not r['here'] and not (last_cols is not None and len(cols) == len(last_cols) and
                                  (not r['labels'][1] or r['labels'][1].upper().startswith('PART'))):
            # no FIG.NO. on the page and another table shape: not a figure going on (a kit list, a colour list ...)
            c = colour_page(pg, ws)
            if c:
                for t, m, ref, pn, desc in c:
                    res['colour'].append([i + 1, t, m, ref, pn, desc])
            else:
                res['other'][i + 1] = {'labels': r['labels'], 'text': re.sub(r'\s+', ' ', pg.get_text())[:300]}
            continue
        last_cols = cols
        res['cols'][i + 1] = cols
        if r['notes']:
            res['notes'][i + 1] = r['notes']
        for ref, pn, desc, qty, rm_ in assemble(r['lines'], rem):
            res['lines'].append([i + 1, r['fig'], r['title'], ref, pn, clean(desc), qty, clean(rm_)])
    return res


def _one(a):
    src, f = a
    return f, book(os.path.join(src, f))


if __name__ == '__main__':
    import multiprocessing
    src, dst = sys.argv[1], sys.argv[2]
    only = sys.argv[3:]
    fs = [f for f in sorted(os.listdir(src)) if not f.startswith('.') and os.path.isfile(os.path.join(src, f)) and (not only or f in only)]
    res = {'books': {}}
    if only and os.path.exists(dst):
        res = json.load(open(dst))
    with multiprocessing.Pool(4) as pool:
        for f, b in pool.imap_unordered(_one, [(src, f) for f in sorted(fs, key=lambda f: -os.path.getsize(os.path.join(src, f)))]):
            res['books'][f] = b
            print('%-45s %-6s pages %3d lines %5d figs %3d colour %4d kits %3d grades %3d other %d errs %d' % (
                f[:45], b['kind'], b['pages'], len(b['lines']), len({l[1] for l in b['lines']}), len(b['colour']), len(b['kits']),
                len(b['grades']), len(b['other']), len(b['errs'])), flush=True)
    res['books'] = dict(sorted(res['books'].items()))
    tmp = dst + '.tmp'
    json.dump(res, open(tmp, 'w'), ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, dst)
