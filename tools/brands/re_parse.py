"""Royal Enfield's diagram books (Sam's folder Downloads > Royal-Enfield-Catalogue > Models, 16 Oct 2026; one '<edition> - Diagrams[ - Part n of 2].pdf'
per edition, made from spares.royalenfield.com) -> re-pages.json.
Reads `pdftotext -layout` of each book (the text of a book is put next to it as '<folder>@<file>.txt', with _sizes.tsv = size, path):
a diagram page starts ' <n>. <assembly> – <diagram>', then 'Used in all variants' or 'Used in variants: BS6 - VZMK81ED, ...' (may wrap),
then the drawing's labels and the table Item | Part No | Part Name | MRP (Rs.) | UOM | MOQ | Note, which can go on over the next pages.
usage: python3 -I re_parse.py <txt folder> re-pages.json"""
import collections, json, os, re, sys

ROW = re.compile(r'^\s*(\S{1,6})\s{2,}([A-Z0-9][A-Z0-9/.\-]{3,})\s{2,}(.*?)\s{2,}([\d,]+\.\d\d|-)(?:\s+([A-Za-z]{2,4})\d?)?(?:\s+(\d+))?(?:\s{2,}(\S.*?))?\s*$')
HEAD = re.compile(r'^\s*Item\s+Part No\s+Part Name\s+MRP')
VLINE = re.compile(r'^\s*[-A-Z0-9/ ,()&.]+$')
IDX = re.compile(r'^\s+(\d+)\s{2,}\S.*?\s{2,}(All|\d+ of \d+)\s*$')
TITLE = re.compile(r'^ (\d+)\. (.+?)\s*$')


def book(path, cur=None, idx=None):
    """cur: the last diagram of the book's part before (a table going on in the next part)"""
    pages = open(path, encoding='utf-8').read().split('\f')
    out, name, nvar = [], None, 0
    idx = {} if idx is None else idx
    for pi, pg in enumerate(pages, 1):
        L = pg.split('\n')
        if pi == 1 and 'Exploded Diagrams' in L[0]:
            name = re.sub(r'^\s*Royal Enfield\s+|\s+–\s+Exploded Diagrams.*$', '', L[0]).strip()
            nv = re.search(r'· (\d+) variants?', L[1] if len(L) > 1 else '')
            nvar = int(nv.group(1)) if nv else 0
        for ln in L if not out and cur is None else ():
            x = IDX.match(ln)
            if x:
                idx[int(x.group(1))] = 0 if x.group(2) == 'All' else int(x.group(2).split()[0])
        i = 0
        while i < len(L) and not L[i].strip():
            i += 1
        m = TITLE.match(L[i]) if i < len(L) else None
        if m and i + 1 < len(L) and L[i + 1].strip().startswith('Used in'):
            used = L[i + 1].strip()
            j = i + 2
            while used != 'Used in all variants' and j < len(L) and L[j].strip() and VLINE.match(L[j]) \
                    and (re.search(r'(,|-|BS\s?\w+)$', used) or L[j].strip().startswith('-')):
                used += ' ' + L[j].strip()                        # the variant list going on in the next lines
                j += 1
            asm, _, dgm = m.group(2).partition(' – ')
            norms = sorted(set(re.sub(r'\s', '', x) for x in re.findall(r'\bBS\s?(?:\d|VI|IV|III)\b', used)))
            cur = dict(n=int(m.group(1)), norms=norms, nv=idx.get(int(m.group(1))), asm=asm.strip(), dgm=dgm.strip(), page=pi,
                       vars=[] if used == 'Used in all variants' else [c for c in (re.sub(r'^BS[A-Z0-9]*-', '', v).split('/')[0] for v in re.sub(r'\s+', '', used.split(':', 1)[1]).split(','))
                                                      if re.fullmatch(r'[A-Z]{4}\d\d[A-Z0-9]{2}|\d{6,7}', c)],
                       rows=[])
            out.append(cur)
        intab, last = False, None
        for ln in L:
            if HEAD.match(ln):
                intab, col = True, ln.index('Part Name')
                continue
            if not intab or cur is None:
                continue
            if ln.lstrip().startswith('Source: spares.royalenfield.com'):
                break
            r = ROW.match(ln)
            if r:
                item, pn, desc, mrp, uom, moq, note = r.groups()
                last = [item, pn, desc.strip(), None if mrp == '-' else float(mrp.replace(',', '')), (uom or '').upper(), int(moq or 0), (note or '').strip()]
                cur['rows'].append(last)
            elif ln.strip() and last is not None and abs(len(ln) - len(ln.lstrip()) - col) <= 3:
                last[2] += ' ' + ln.strip()                       # a long part name going on in the next line
            elif ln.strip():
                cur.setdefault('odd', []).append(ln.strip())
    return name, nvar, len(pages) - (1 if not pages[-1].strip() else 0), out, cur, idx


if __name__ == '__main__':
    src, dst = sys.argv[1:3]
    sizes = {}
    for ln in open(os.path.join(src, '_sizes.tsv')):
        s, p = ln.rstrip('\n').split('\t')
        sizes[p[2:].replace('/', '@') + '.txt'] = (p[2:], int(s))
    books, st = {}, collections.Counter()
    part = lambda f: [int(x) for x in re.findall(r' - Part (\d+) of \d+\.pdf\.txt$', f)] or [0]
    ed = lambda f: re.sub(r' - Diagrams( - Part \d+ of \d+)?\.pdf\.txt$', '', f.split('@', 1)[1])
    cur, last = None, None
    for f in sorted(sizes, key=lambda f: (ed(f), part(f))):
        rel, size = sizes[f]
        if ed(f) != last:
            cur, idx, last, nv0 = None, None, ed(f), 0
        name, nvar, npg, dg, cur, idx = book(os.path.join(src, f), cur, idx)
        nvar = nv0 = nvar or nv0
        books[os.path.basename(rel)] = dict(folder=rel.split('/')[0], edition=ed(f), part=part(f)[0], nvar=nvar, size=size, pages=npg, dgs=dg)
        st['books'] += 1
        st['diagrams'] += len(dg)
        st['rows'] += sum(len(d['rows']) for d in dg)
        st['odd lines'] += sum(len(d.get('odd', [])) for d in dg)
        st['diagrams without rows'] += sum(not d['rows'] for d in dg)
    json.dump(books, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(dict(st))
