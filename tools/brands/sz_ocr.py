"""The 5 scanned Suzuki books (pictures of pages, no text layer): ocr_book.py reads each page with OCR (RapidOCR, PP-OCR models,
300 dpi) into boxes of text; this turns the boxes into the same lines sz_parse.py reads from the text books and writes them into
suzuki-pages.json (books[<file>].lines, books[<file>].ocr = 'rapidocr'). Each box is cut into words placed along it by character
count, the words are put in rows by their height on the page, and the parts tables are read by sz_parse's own header / column
rules. A part number the OCR read wrong is put right when exactly one look-alike reading (0/O/D, 1/I/L, 8/B, 5/S, 2/Z, 6/G) is a
part number Suzuki has (its price list or a text book).
A REF or QTY the OCR missed (a lone thin "1" or "7" is easy to miss) is read from its printed marks: a scanned book prints each digit
the same way every time, so the cells the OCR did read give the book's own pictures of each character (class Glyphs). A REF still
missing is read again by the OCR from that cell alone, and a run of them between two numbers that leave exactly that many out
(5, _, _, 8) is those numbers, when each cell has as many marks as its number has characters.
usage: python3 -I sz_ocr.py <suzuki-pages.json> <Suzuki folder> <book file>=<ocr json> [...]"""
import collections, itertools, json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, pymupdf
import sz_parse as P
from rapidocr_onnxruntime import RapidOCR

LOOK = {'0': 'OD', 'O': '0D', 'D': '0O', 'Q': '0O', '1': 'IL', 'I': '1L', 'L': '1I', '8': 'B', 'B': '8', '5': 'S', 'S': '5', '2': 'Z', 'Z': '2',
        '6': 'G', 'G': '6'}


def words(boxes):
    """OCR boxes [x0, y0, x1, y1, text, score] -> words (x0, y0, x1, y1, text); the chapter tab's big digit at the page edge left out"""
    out = []
    for x0, y0, x1, y1, t, sc in boxes:
        t = unicodedata.normalize('NFKC', t).strip()            # full-width （D-4) as (D-4)
        if not t or (y1 - y0 > 13 and len(t) <= 2) or (x0 > 740 and re.fullmatch(r'\d', t)):
            continue
        n = len(t)
        for m in re.finditer(r'\S+', t):
            out.append((x0 + (x1 - x0) * m.start() / n, y0, x0 + (x1 - x0) * m.end() / n, y1, m.group(0)))
    return out


def rows_of(ws, tol=4.0):
    """words -> rows by the middle of their height (the OCR's boxes of one printed row sit a point or two apart)"""
    out = []
    for w in sorted(ws, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        c = (w[1] + w[3]) / 2
        if out and c - out[-1][2] <= tol:
            out[-1][1].append(w)
        else:
            out.append([w[3], [w], c])
    return [(y, sorted(L, key=lambda w: w[0])) for y, L, _ in out]


def fix_pn(pn, known):
    if pn in known or not P.PN.match(pn):
        return pn, 0
    pos = [i for i, c in enumerate(pn) if c in LOOK and i not in (5, 11)]
    for k in (1, 2):
        hits = set()
        for at in itertools.combinations(pos, k):
            for subs in itertools.product(*(LOOK[pn[i]] for i in at)):
                s = list(pn)
                for i, c in zip(at, subs):
                    s[i] = c
                s = ''.join(s)
                if s in known:
                    hits.add(s)
        if len(hits) == 1:
            return hits.pop(), 1
        if hits:
            return pn, 0
    return pn, 0


def page_rows(lines, last_fig):
    """sz_parse.page_rows, keeping where each line sits: [fig, address, title, ref, pn, desc, qty, rem, (y0, y1, ref x, pn x, qty x)]"""
    out = []
    for hy, c, bx0, bx1 in P.headers(lines):
        part_x, desc_x = c['part'], c['desc']
        qty_x = c.get('qty', bx1)
        zone = [w for y, L in lines if y < hy - 1 for w in L if w[0] >= bx0 - 20 and w[0] < bx1 and not re.match(r"(Q\W?\s*TY|REMARKS?)$", w[4].upper())]
        ztxt = ' '.join(w[4] for w in sorted(zone, key=lambda w: (round(w[3] / 6), w[0])))
        ztxt = re.sub(r'\(\s*([A-H])\s*(\d{1,2})\s*\)', r'(\1-\2)', ztxt)     # 496A(E13): the OCR lost the address's dash
        fig = None
        m = re.search(r'FIG\.?\s*(\d{1,3}[A-Z]?)\b', ztxt) or re.search(r'\b(\d{3}[A-Z]?)\s*' + P.ADDR.pattern, ztxt)
        if m:
            fig = m.group(1)
        am = P.ADDR.search(ztxt)
        addr = re.sub(r'\s+', '', am.group(0)) if am else ''
        tt = P.ADDR.sub(' ', ztxt)
        tt = re.sub(r'FIG\.?\s*\d{1,3}[A-Z]?\b', ' ', tt)
        if fig:
            tt = re.sub(r'\b' + re.escape(fig) + r'\b', ' ', tt)
        tt = re.sub(r'\b[A-Z0-9-]+_P74\S*', ' ', tt)
        tt = re.sub(r'\s+', ' ', tt).strip(' -|')
        fig = fig or last_fig[0]
        last_fig[0] = fig
        cur, last_y, d0 = None, None, desc_x - 12
        for y, L in lines:
            if y <= hy + 1:
                continue
            ws = [w for w in L if bx0 <= w[0] < bx1]
            if not ws:
                continue
            pw, k = None, None
            for i in [i for i, w in enumerate(ws) if part_x - 20 <= w[0] < desc_x]:
                for j in range(i, min(i + 4, len(ws))):
                    t = P.fix_pn(''.join(w[4] for w in ws[i:j + 1]))
                    if P.PN.match(t):
                        pw, k = (ws[i], ws[j], t), j
                        break
                    if len(t) > 15:
                        break
                if pw:
                    break
            if pw:
                d0 = pw[1][2] + 1
                ref = ' '.join(w[4] for w in ws if w[0] < pw[0][0] - 1)
                desc, qty, rem = P.split3(ws[k + 1:], qty_x)
                m = re.fullmatch(r'(.*[A-Z)\]])(\d{1,2})', desc)
                if not qty and m and max(w[2] for w in ws[k + 1:]) >= qty_x - 8:   # the OCR ran the quantity into the description box
                    desc, qty = m.group(1), m.group(2)
                cur = [fig, addr, tt, ref, pw[2], desc, qty, rem, (min(w[1] for w in ws), max(w[3] for w in ws), bx0, pw[0][0], qty_x)]
                out.append(cur)
                last_y = y
                continue
            if not cur or not last_y or y - last_y >= 16 or any(w[0] < d0 - 4 for w in ws):
                continue
            desc, qty, rem = P.split3(ws, qty_x)
            if desc:
                cur[5] = cur[5] + ('' if cur[5].count('(') > cur[5].count(')') else ' ') + desc
            if rem:
                cur[7] = (cur[7] + ' ' + rem).strip()
            if qty and not cur[6]:
                cur[6] = qty
            last_y = y
    return out


K = 300 / 72


def page_img(pg):
    pix = pg.get_pixmap(dpi=300, colorspace=pymupdf.csRGB, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)


def cell_marks(img, y0, y1, x0, x1):
    """the printed marks in one cell of a row, left to right, each as black and white cut to its ink (a mark = ink with white either side)"""
    c = img[max(0, int((y0 - 1.5) * K)):int((y1 + 1.5) * K) + 1, max(0, int(x0 * K)):int(x1 * K) + 1].mean(axis=2) < 128
    cols = np.where(c.any(axis=0))[0]
    out = []
    for run in (np.split(cols, np.where(np.diff(cols) > 1)[0] + 1) if len(cols) else []):
        sub = c[:, run[0]:run[-1] + 1]
        ys = np.where(sub.any(axis=1))[0]
        out.append(sub[ys[0]:ys[-1] + 1])
    return out


def ref_crop(img, r):
    c = img[max(0, int((r[8][0] - 1.5) * K)):int((r[8][1] + 1.5) * K) + 1, max(0, int((r[8][2] - 2) * K)):int((r[8][3] - 1) * K) + 1]
    return np.pad(c, ((6, 6), (24, 24), (0, 0)), constant_values=255)       # white round it, as the cell sits on the page


class Glyphs:
    """A scanned book prints each digit (and the dash of 10-1) the same way every time. The REF and QTY cells the OCR read give the
    book's own pictures of each character; a mark the OCR missed is the character whose pictures it matches best (the share of ink
    both have, moved up to 1 px), when that match is at least 0.85 and clearly (0.1) better than any other character's."""
    H, W = 34, 26

    def __init__(self):
        self.seen = collections.defaultdict(dict)

    def add(self, text, marks):
        if text and re.fullmatch(r'[0-9-]+', text) and len(text) == len(marks):
            for ch, m in zip(text, marks):
                if m.shape[0] <= self.H - 4 and m.shape[1] <= self.W - 4 and len(self.seen[ch]) < 150:
                    self.seen[ch].setdefault(m.tobytes() + bytes(m.shape), m)

    def build(self):
        T, self.labels, self.shapes = [], [], []
        for ch, d in self.seen.items():
            for m in d.values():
                for dy in range(3):
                    for dx in range(3):
                        B = np.zeros((self.H, self.W), np.float32)
                        B[dy:dy + m.shape[0], dx:dx + m.shape[1]] = m
                        T.append(B.reshape(-1))
                self.labels.append(ch)
                self.shapes.append(m.shape)
        self.T = np.array(T, np.float32).reshape(-1, self.H * self.W)
        self.n = self.T.sum(axis=1)
        self.labels, self.shapes = np.array(self.labels), np.array(self.shapes)

    def read(self, m):
        if not len(self.labels) or m.shape[0] > self.H - 4 or m.shape[1] > self.W - 4:
            return None
        A = np.zeros((self.H, self.W), np.float32)
        A[1:1 + m.shape[0], 1:1 + m.shape[1]] = m
        A = A.reshape(-1)
        inter = self.T @ A
        s = (inter / np.maximum(self.n + A.sum() - inter, 1)).reshape(-1, 9).max(axis=1)
        s[(np.abs(self.shapes - np.array(m.shape)) > 2).any(axis=1)] = 0
        top = sorted(((s[self.labels == ch].max(), ch) for ch in set(self.labels)), reverse=True)
        if top[0][0] >= 0.85 and (len(top) == 1 or top[0][0] - top[1][0] >= 0.1):
            return top[0][1]
        return None

    def text(self, marks):
        out = [self.read(m) for m in marks]
        return ''.join(out) if marks and None not in out else None


REF = re.compile(r'\d{1,3}(?:-\d{1,2})?')


def by_marks(rows, G, st):
    """empty REF / QTY cells (and ones whose reading has fewer or more characters than the cell has marks) read from their marks"""
    for r in rows:
        rm, qm = r[10], r[11]
        if rm and (not r[3] or len(r[3]) != len(rm)):
            t = G.text(rm)
            if t and REF.fullmatch(t):
                st['REF read from its printed marks' if not r[3] else 'REF put right from its printed marks'] += 1
                r[3] = t
        if qm and len(qm) <= 2 and (not r[6] or r[6].isdigit() and len(r[6]) != len(qm)):
            t = G.text(qm)
            if t and re.fullmatch(r'[1-9]\d?', t):
                st['QTY read from its printed marks' if not r[6] else 'QTY put right from its printed marks'] += 1
                r[6] = t


def reread_refs(eng, need, st):
    """REF cells still empty, read again one by one by the OCR from the page at 300 dpi"""
    if not need:
        return
    res, _ = eng.text_rec([c for _, c in need])
    for (r, _), (t, sc) in zip(need, res):
        t = re.sub(r'[^0-9A-Za-z/|-]', '', t).replace('O', '0').replace('o', '0')
        t = re.sub(r'^[Il|]$', '1', t)
        if sc >= 0.5 and REF.fullmatch(t) and len(t) == len(r[10]):
            r[3] = t
            st['REF read again'] += 1


def infer_refs(lines, nm, st):
    """a run of rows with no REF between two numbers that leave exactly that many numbers out (5, _, _, 8) is those numbers, when each
    cell has as many marks as its number has characters"""
    base = lambda x: int(re.match(r'\d+', x).group(0)) if re.match(r'\d+', x or '') else None
    i = 0
    while i < len(lines):
        if lines[i][4]:
            i += 1
            continue
        j = i
        while j < len(lines) and not lines[j][4] and lines[j][1] == lines[i][1]:
            j += 1
        p = base(lines[i - 1][4]) if i and lines[i - 1][1] == lines[i][1] else 0
        q = base(lines[j][4]) if j < len(lines) and lines[j][1] == lines[i][1] else None
        if p is not None and q is not None and q - p - 1 == j - i:
            vals = [str(p + 1 + k) for k in range(j - i)]
            if all(nm[i + k] == len(v) for k, v in enumerate(vals)):
                for k, v in enumerate(vals):
                    lines[i + k][4] = v
                st['REF from the numbers around it'] += j - i
        i = max(j, i + 1)


def fig_letters(lines, st):
    """a book whose figures are all 102A, 103A ... prints one header as 417 (its big label says 417A)"""
    figs = {l[1] for l in lines}
    lettered = [g for g in figs if re.fullmatch(r'\d{3}[A-Z]', g)]
    if len(lettered) >= 0.8 * len(figs):
        for l in lines:
            if re.fullmatch(r'\d{3}', l[1]) and l[1] + 'A' not in figs:
                l[1] = l[1] + 'A'
                st['figure letter put back'] += 1


if __name__ == '__main__':
    dst, folder = sys.argv[1], sys.argv[2]
    SZ = json.load(open(dst, encoding='utf-8'))
    eng = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1, use_cls=False)
    known = set(SZ['price']) | {l[5] for f, b in SZ['books'].items() if not b.get('ocr') for l in b['lines']}
    for arg in sys.argv[3:]:
        f, src = arg.split('=', 1)
        b = SZ['books'][f]
        pages = json.load(open(src, encoding='utf-8'))['pages']
        assert len(pages) == b['pages'], (f, len(pages), b['pages'])
        doc = pymupdf.open(os.path.join(folder, f))
        rows, last, st, G, need = [], [None], collections.Counter(), Glyphs(), []
        for i, boxes in enumerate(pages):
            pr = page_rows(rows_of(words(boxes)), last)
            if not pr:
                continue
            img = page_img(doc[i])
            for r in pr:
                y0, y1, rx, px, qx = r[8]
                r += [i + 1, cell_marks(img, y0, y1, rx - 2, px - 1), cell_marks(img, y0, y1, qx - 3, qx + 17)]
                G.add(r[3], r[10])
                G.add(r[6], r[11])
                if not r[3] or len(r[3]) != len(r[10]):
                    need.append((r, ref_crop(img, r)))
            rows += pr
        G.build()
        st['digit pictures from the book'] = len(G.labels)
        by_marks(rows, G, st)
        reread_refs(eng, [(r, c) for r, c in need if not r[3]], st)
        lines = []
        for r in rows:
            pn, fixed = fix_pn(r[4], known)
            st['part no. put right'] += fixed
            st['part no. Suzuki has'] += pn in known
            lines.append([r[9], r[0], r[1], r[2], r[3], pn, r[5], r[6], r[7]])
        infer_refs(lines, [len(r[10]) for r in rows], st)
        fig_letters(lines, st)
        st['REF empty'] = sum(not l[4] for l in lines)
        st['QTY empty'] = sum(not l[7] for l in lines)
        b['lines'], b['ocr'] = lines, 'rapidocr'
        print('%-48s pages %3d lines %5d figs %3d | %s' % (f[:48], len(pages), len(lines), len({l[1] for l in lines}), dict(st)))
    json.dump(SZ, open(dst + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    os.replace(dst + '.tmp', dst)
