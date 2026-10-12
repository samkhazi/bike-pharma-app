"""Reads Sam's Suzuki folder (All Catalogues/Suzuki: Suzuki's own parts catalogues as PDF, and Suzuki's price list 03-Oct'26.pdf) and writes
suzuki-pages.json for brands_build.py:
  books  {file: {"size", "md5", "pages", "lines": [[page 1-based, fig, address, title, ref, part no., description, qty, remarks], ...]}}
  price  {part no.: [name, model, MRP]}
A book's figure page has its diagram and its parts table (REF NO. / PART NO. / DESCRIPTION / QTY / REMARKS) on the same page; a figure
that needs more lines goes on over the next page(s) with the same figure number. Words are read by their place on the page (the columns of
the table's header), so the book's own reading order does not matter; the dealer's slanted watermark text is left out.
usage: python3 -I sz_parse.py <Suzuki folder> <out json> [book file ...]"""
import hashlib, json, os, re, sys
import pymupdf

PN = re.compile(r'^[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{3}$')
ADDR = re.compile(r'\(\s*(?:\d\s*-\s*)?[A-Z]\s*-\s*\d+\s*\)')


def words(pg):
    """the page's words that run left to right on the page as it is shown (its /Rotate applied; the slanted watermark left out),
    as (x0, y0, x1, y1, text) in shown-page points"""
    tp = pg.get_textpage()
    rm = pg.rotation_matrix
    straight = set()
    for b in tp.extractDICT()['blocks']:
        for li, ln in enumerate(b.get('lines', [])):
            dx, dy = ln['dir']
            sx, sy = rm.a * dx + rm.c * dy, rm.b * dx + rm.d * dy
            if abs(sy) < 0.01 and sx > 0:
                straight.add((b['number'], li))
    out = []
    for w in tp.extractWORDS():
        if (w[5], w[6]) in straight:
            r = pymupdf.Rect(w[:4]) * rm
            out.append((r.x0, r.y0, r.x1, r.y1, w[4]))
    return out


def rows_of(ws, tol=2.5):
    out = []
    for w in sorted(ws, key=lambda w: (w[3], w[0])):
        if out and w[3] - out[-1][0] <= tol:
            out[-1][1].append(w)
        else:
            out.append([w[3], [w]])
    return [(y, sorted(L, key=lambda w: w[0])) for y, L in out]


def headers(lines):
    """table headers on the page: [(y, {ref, part, desc, qty, rem: x}, x0, x1)] (two tables side by side split at REF)"""
    out = []
    for y, L in lines:
        T = [w[4].upper() for w in L]
        if not (any(t.startswith('DESCRIPTION') for t in T) and any(t.startswith('PART') for t in T) and any(t.startswith('REF') for t in T)):
            continue
        starts = [w[0] for w in L if w[4].upper().startswith('REF')]
        near = [w for y2, L2 in lines if 0 < abs(y2 - y) <= 9 for w in L2 if re.match(r"(Q\W?\s*TY|REMARK)", w[4].upper())]
        L = sorted(L + near, key=lambda w: w[0])
        for k, sx in enumerate(starts):
            ex = starts[k + 1] - 10 if k + 1 < len(starts) else 1e9
            c = {}
            for w in L:
                if not (sx - 1 <= w[0] < ex):
                    continue
                t = w[4].upper()
                if t.startswith('REF'):
                    c.setdefault('ref', w[0])
                elif t.startswith('PART'):
                    c.setdefault('part', w[0])
                elif t.startswith('DESCRIPTION'):
                    c.setdefault('desc', w[0])
                elif re.match(r"Q\W?\s*TY", t):
                    c.setdefault('qty', w[0])
                elif t.startswith('REMARK'):
                    c.setdefault('rem', w[0])
            if {'ref', 'part', 'desc'} <= set(c):
                out.append((y, c, sx - 12, ex))
    return out


OCR_D = str.maketrans({'O': '0', 'I': '1', 'B': '8', 'S': '5', 'Z': '2', 'G': '6', 'D': '0', 'Q': '0'})


def fix_pn(s):
    s = s.replace(' ', '').replace('l', '1').upper().replace('—', '-').replace('–', '-').replace('ー', '-').replace('O', '0').replace('I', '1')
    if PN.match(s) and not s[:5].isdigit() and not s.startswith('990'):
        s = s[:5].translate(OCR_D) + s[5:]
    return s


def split3(ws, qty_x):
    """a line's words right of the part number -> description, quantity, remarks. The quantity (a small number or AR) sits under or a
    little left of QTY; remarks start right after it, often left of the REMARKS label"""
    d, q, r = [], [], []
    for w in ws:
        if qty_x - 25 <= w[0] < qty_x + 15 and re.fullmatch(r'\d{1,3}|AR|A/R', w[4]):
            q.append(w[4])
        elif w[0] < qty_x + 15:
            (d if not q else r).append(w[4])
        elif w[0] < qty_x + 195:
            r.append(w[4])
    return ' '.join(d), ' '.join(q), ' '.join(r)


def page_rows(pg, lines, last_fig):
    """[(fig, address, title, ref, pn, desc, qty, rem)] of the page's table(s)"""
    out = []
    hs = headers(lines)
    for hy, c, bx0, bx1 in hs:
        part_x, desc_x = c['part'], c['desc']
        qty_x = c.get('qty', bx1)
        rem_x = c.get('rem', bx1)
        # title zone: the lines above the header, over the table
        zone = [w for y, L in lines if y < hy - 1 for w in L if w[0] >= bx0 - 20 and w[0] < bx1 and not re.match(r"(Q\W?\s*TY|REMARKS?)$", w[4].upper())]
        ztxt = ' '.join(w[4] for w in sorted(zone, key=lambda w: (round(w[3] / 6), w[0])))
        fig = None
        m = re.search(r'FIG\.?\s*(\d{1,3}[A-Z]?)\b', ztxt)
        if m:
            fig = m.group(1)
        else:
            m = re.search(r'\b(\d{3}[A-Z]?)\s*' + ADDR.pattern, ztxt)
            if m:
                fig = m.group(1)
        am = ADDR.search(ztxt)
        addr = re.sub(r'\s+', '', am.group(0)) if am else ''
        tt = ztxt
        tt = ADDR.sub(' ', tt)
        tt = re.sub(r'FIG\.?\s*\d{1,3}[A-Z]?\b', ' ', tt)
        if fig:
            tt = re.sub(r'\b' + re.escape(fig) + r'\b', ' ', tt)
        tt = re.sub(r'\b[A-Z0-9-]+_P74\S*', ' ', tt)
        tt = re.sub(r'\s+', ' ', tt).strip(' -|')
        if not fig:
            fig = last_fig[0]
        last_fig[0] = fig
        cur = None
        last_y = None
        d0 = desc_x - 12                       # where descriptions start (the part number column ends): from the lines read
        for y, L in lines:
            if y <= hy + 1:
                continue
            ws = [w for w in L if bx0 <= w[0] < bx1]
            if not ws:
                continue
            pw, k = None, None
            cand = [i for i, w in enumerate(ws) if part_x - 20 <= w[0] < desc_x]
            for i in cand:                     # the part number: one word, or a few the scan split ("11173-33G 1 0-000")
                for j in range(i, min(i + 4, len(ws))):
                    t = fix_pn(''.join(w[4] for w in ws[i:j + 1]))
                    if PN.match(t):
                        pw, k = (ws[i], ws[j], t), j
                        break
                    if len(t) > 15:
                        break
                if pw:
                    break
            if pw:
                d0 = pw[1][2] + 1
                ref = ' '.join(w[4] for w in ws if w[0] < pw[0][0] - 1)
                desc, qty, rem = split3(ws[k + 1:], qty_x)
                cur = [fig, addr, tt, ref, pw[2], desc, qty, rem]
                out.append(cur)
                last_y = y
                continue
            if not cur or not last_y or y - last_y >= 16 or any(w[0] < d0 - 4 for w in ws):
                continue
            desc, qty, rem = split3(ws, qty_x)
            if desc:
                p = cur[5]
                glue = p.count('(') > p.count(')')
                cur[5] = p + ('' if glue else ' ') + desc
            if rem:
                cur[7] = (cur[7] + ' ' + rem).strip()
            if qty and not cur[6]:
                cur[6] = qty
            last_y = y
    return out


def book(path):
    raw = open(path, 'rb').read()
    doc = pymupdf.open(stream=raw, filetype='pdf')
    lines, last = [], [None]
    for i, pg in enumerate(doc):
        L = rows_of(words(pg))
        for r in page_rows(pg, L, last):
            lines.append([i + 1] + r)
    return {'size': len(raw), 'md5': hashlib.md5(raw).hexdigest(), 'pages': doc.page_count, 'lines': lines}


def price_list(path):
    doc = pymupdf.open(path)
    out, dup = {}, 0
    for pg in doc:
        L = rows_of(words(pg))
        hdr = next(((y, Lw) for y, Lw in L if any(w[4] == 'MRP' for w in Lw) and any(w[4] == 'HS-CODE' for w in Lw)), None)
        if not hdr:
            continue
        hx = {w[4]: w[0] for w in hdr[1]}
        name_x, hs_x, model_x, unit_x, mrp_x = 160, hx['HS-CODE'], hx['MODEL'] - 25, hx['SALES'] - 10, hx['MRP'] - 15
        for y, Lw in L:
            if y <= hdr[0] + 1:
                continue
            pnw = [w for w in Lw if 90 <= w[0] < name_x and PN.match(w[4])]
            if not pnw:
                pnw = [w for w in Lw if w[0] < name_x and PN.match(w[4])]
            if not pnw:
                continue
            pn = pnw[0][4]
            name = ' '.join(w[4] for w in Lw if name_x - 2 <= w[0] < hs_x - 5)
            model = ' '.join(w[4] for w in Lw if model_x <= w[0] < unit_x)
            mrp = [w[4] for w in Lw if w[0] >= mrp_x]
            try:
                v = float(mrp[-1].replace(',', '')) if mrp else 0
            except ValueError:
                v = 0
            if pn in out and out[pn][2] != v:
                dup += 1
            out[pn] = [name, model, v]
    return out, dup


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    only = sys.argv[3:]
    res = {'books': {}, 'price': {}}
    seen = {}
    for f in sorted(os.listdir(src)):
        p = os.path.join(src, f)
        if f.startswith('.') or not os.path.isfile(p):
            continue
        if f.startswith("03-Oct"):
            res['price'], dup = price_list(p)
            print('price list:', len(res['price']), 'part no.', dup, 'listed twice with two prices')
            continue
        if only and f not in only:
            continue
        b = book(p)
        if b['md5'] in seen:
            print('same file as', seen[b['md5']], ':', f)
            continue
        seen[b['md5']] = f
        res['books'][f] = b
        print('%-50s pages %3d lines %5d figs %3d' % (f[:50], b['pages'], len(b['lines']), len({l[1] for l in b['lines']})))
    json.dump(res, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
