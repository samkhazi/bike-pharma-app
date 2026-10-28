"""Yamaha model parts catalogues (PDF) the weekly sync downloads -> their parts tables, so a new model is in the app's search.

Same reading as the Mac tool that made yamaha_build.json from Downloads > Yamaha Catalogue > PDF > Models (pdftotext word
positions, poppler-utils): every "FIG. n NAME" page gives its ref no., part no., name, qty per model code and remarks; the
diagram is the left part of that page. Books are kept in state['books'] (file, size, date, title, codes, figs) and
lib/yamahabuild.mjs adds them to the Yamaha catalogue. A PDF with no text layer (scan) gives no rows and is reported.
"""
import os, re, html, shutil, subprocess

PN = re.compile(r'^[0-9A-Z]{3,5}[-–][0-9A-Z]{4,5}[-–][0-9A-Z]{2}([-–][0-9A-Z]{2})?$|^9\d{4}[-–][0-9A-Z]{5}([-–][0-9A-Z]{2})?$')
CODE = re.compile(r'^[0-9A-Z]{4}$')
BOOK = re.compile(r'^(\S+)\s+(.*?)\s*\((\d{4}-\d\d-\d\d)\)')


def have_tool():
    return bool(shutil.which('pdftotext'))


def words(path):
    x = subprocess.run(['pdftotext', '-bbox', path, '-'], capture_output=True, text=True, timeout=600).stdout
    for n, pg in enumerate(re.finditer(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', x, re.S)):
        W, H = float(pg.group(1)), float(pg.group(2))
        ws = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in
              re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<', pg.group(3))]
        yield n + 1, W, H, ws


def lines(ws):
    L = []
    for w in sorted(ws, key=lambda w: (round(w[1]), w[0])):
        if L and abs(L[-1][0] - w[1]) < 3: L[-1][1].append(w)
        else: L.append([w[1], [w]])
    return [(y, sorted(l, key=lambda w: w[0])) for y, l in L]


def parse(path):
    figs, cur = [], None
    for pno, W, H, ws in words(path):
        if not ws: continue
        L = lines(ws); txt = [' '.join(w[4] for w in l) for y, l in L]
        fl = next((i for i, t in enumerate(txt) if re.match(r'^FIG\.\s*\d', t)), None)
        if fl is None: cur = None; continue
        m = re.match(r'^FIG\.\s*(\d+[A-Z]?)\s*(\([^)]*\))?\s*(.*)$', txt[fl]); fno, name = m.group(1), m.group(3).strip()
        # model code columns: 4-char codes above the first part row, right of DESCRIPTION
        dx = min([w[0] for y, l in L for w in l if w[4] in ('DESCRIPTION', 'NAME')] or [0])
        first = next((y for y, l in L if any(PN.match(w[4]) for w in l)), H)
        cols = sorted({(round((w[0] + w[2]) / 2), w[4]) for y, l in L if y < first for w in l if CODE.match(w[4]) and w[0] > dx and not w[4].isdigit()})
        tx = min(w[0] for w in ws)
        if not cur or cur['fig'] != fno:
            cur = {'fig': fno, 'name': name, 'page': pno, 'crop': '0,0,%.4f,1' % max(0.2, min(0.6, (tx - 4) / W)), 'codes': [c for x, c in cols], 'rows': []}
            figs.append(cur)
        ref = None
        for y, l in L:
            i = next((k for k, w in enumerate(l) if PN.match(w[4])), None)
            if i is None: continue
            pre = [w[4] for w in l[:i]]
            if pre and re.match(r'^\*?\d+[A-Z]?$', pre[-1]): ref = pre[-1].lstrip('*')
            pn = l[i][4].replace('–', '-')
            rest = l[i + 1:]
            if cols:
                x0 = min(x for x, c in cols) - 12; x1 = max(x for x, c in cols) + 12
                desc = ' '.join(w[4] for w in rest if w[2] < x0)
                q = {}
                for w in rest:
                    cx = (w[0] + w[2]) / 2
                    if x0 <= cx <= x1:
                        c = min(cols, key=lambda c: abs(c[0] - cx)); q[c[1]] = w[4]
                rem = ' '.join(w[4] for w in rest if w[0] > x1)
            else:
                toks = [w[4] for w in rest]; k = next((j for j in range(len(toks) - 1, -1, -1) if re.match(r'^(\d+|UN)$', toks[j])), None)
                desc = ' '.join(toks[:k]) if k is not None else ' '.join(toks); q = {'*': toks[k]} if k is not None else {}
                rem = ' '.join(toks[k + 1:]) if k is not None else ''
            cur['rows'].append([ref or '', pn, desc.strip(), q, rem.strip()])
    return figs


def book(path, name=''):
    """one downloaded catalogue PDF -> a book like yamaha_build.json's (or None when its name is not '<code> <title> (<date>)')"""
    f = os.path.basename(path)
    m = BOOK.match(f)
    if not m: return None
    c0, title, date = m.groups()
    figs = parse(path)
    for x in figs: x['codes'] = [c for c in x['codes'] if CODE.match(c) and re.search(r'\d', c)]
    codes = sorted({c for x in figs for c in x['codes']} or ({c0} if CODE.match(c0) and re.search(r'\d', c0) else set()))
    return {'file': f, 'size': os.path.getsize(path), 'date': date, 'title': title, 'codes': codes, 'name': name,
            'figs': figs, 'rows': sum(len(x['rows']) for x in figs)}
