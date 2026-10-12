"""Read Sam's KTM HD catalogue PDFs (All Catalogues/KTM/KTM_PDF_HD_All_Years, ReportLab, 'KTM Spare Parts Finder (India)', data 2026-09-30).
Per book: model + model year (cover), the assembly index (page 2), and per assembly: header ('ENGINE 1  CRANKCASE RH'), its one diagram
(the JPEG exactly as stored in the PDF: byte offset + length of the ASCII85 stream, checked against PyMuPDF and decoded to a valid JPEG)
and its table rows (Ref | Part No | Description | Qty | Remarks, continued on following pages).
usage: python3 -I ktm_parse.py <pdf dir> <out.json>"""
import base64, hashlib, json, os, re, sys
from multiprocessing import Pool
import pymupdf as fitz

D, OUT = sys.argv[1], sys.argv[2]


def xref_offsets(raw):
    sx = int(re.search(rb'startxref\s+(\d+)\s+%%EOF\s*$', raw[-200:]).group(1))
    assert raw[sx:sx + 4] == b'xref', 'not a classic xref table'
    m = re.match(rb'xref\s+(\d+)\s+(\d+)\s+', raw[sx:sx + 64])
    first, n, at = int(m.group(1)), int(m.group(2)), sx + m.end()
    offs = {}
    for k in range(n):
        e = raw[at + 20 * k: at + 20 * k + 20]
        if e[17:18] == b'n':
            offs[first + k] = int(e[:10])
    return offs


def stream_span(raw, off, num):
    m = re.match(rb'%d\s+0\s+obj\s*' % num, raw[off:off + 40])
    assert m, ('obj', num)
    i = raw.index(b'stream', off)
    head = raw[off:i]
    ln = int(re.search(rb'/Length\s+(\d+)', head).group(1))
    j = i + 6
    if raw[j:j + 2] == b'\r\n':
        j += 2
    elif raw[j:j + 1] in (b'\n', b'\r'):
        j += 1
    assert b'endstream' in raw[j + ln:j + ln + 20], ('endstream', num)
    flt = re.findall(rb'/(ASCII85Decode|DCTDecode|FlateDecode)', head)
    return j, ln, [f.decode() for f in flt]


def a85(data):
    d = data.strip()
    assert d.endswith(b'~>')
    return base64.a85decode(d[:-2].replace(b'z', b'!!!!!') if False else d[:-2], adobe=False)


def jpeg_size(b):
    i = 2
    while i < len(b):
        assert b[i] == 0xFF
        mk = b[i + 1]
        if mk in (0xC0, 0xC1, 0xC2):
            return (b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]
        i += 2 + ((b[i + 2] << 8) | b[i + 3])
    raise ValueError('no SOF')


HDR = re.compile(r'^(ENGINE|FRAME)\s+(\d+)\s+(.*)$')


def spans(pg):
    out = []
    for b in pg.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for l in b['lines']:
            t = ''.join(s['text'] for s in l['spans'])
            if t.strip():
                x0, y0, x1, y1 = l['bbox']
                out.append((y0, x0, y1, x1, t, l['spans'][0]['font'], l['spans'][0]['size']))
    return out


def one(name):
    p = os.path.join(D, name)
    raw = open(p, 'rb').read()
    offs = xref_offsets(raw)
    doc = fitz.open(p)
    cover = [x.strip() for x in doc[0].get_text().split('\n') if x.strip()]
    mm = re.match(r'^(.*?)\s*\|\s*Model Year MY-(\d+)$', cover[2])
    book = {'file': name, 'size': len(raw), 'md5': hashlib.md5(raw).hexdigest(), 'pages': doc.page_count, 'model': mm.group(1), 'my': int(mm.group(2)),
            'index': [], 'asm': [], 'warn': []}
    # assembly index (page 2, maybe more): code, name, parts
    pi = 1
    while pi < doc.page_count:
        sp = spans(doc[pi])
        if not any(s[4] == 'Assembly' for s in sp):
            break
        rows = {}
        for s in sp:
            rows.setdefault(round(s[0] / 2), []).append(s)
        for y in sorted(rows):
            cells = sorted(rows[y], key=lambda s: s[1])
            # two index columns side by side: code | name | parts
            txt = [c[4] for c in cells]
            for k in range(len(txt)):
                if re.fullmatch(r'[EF]\d+', txt[k]) and k + 1 < len(txt):
                    nm, cnt = txt[k + 1], (txt[k + 2] if k + 2 < len(txt) else '')
                    m2 = re.match(r'^(.*?)(\d+)$', nm) if not re.fullmatch(r'\d+', cnt or '') else None
                    if m2:  # name and count ran together ('...SHAFT)20')
                        nm, cnt = m2.group(1), m2.group(2)
                    if re.fullmatch(r'\d+', cnt or ''):
                        book['index'].append([txt[k], nm.strip(), int(cnt)])
        pi += 1
    cur = None
    for i in range(pi, doc.page_count):
        pg = doc[i]
        sp = spans(pg)
        h = [s for s in sp if HDR.match(s[4].strip()) and s[5].endswith('Bold') and s[6] > 10]
        if h:
            m = HDR.match(h[0][4].strip())
            cur = {'kind': m.group(1), 'n': int(m.group(2)), 'name': m.group(3).strip(), 'page': i + 1, 'img': None, 'rows': []}
            book['asm'].append(cur)
            ims = pg.get_images(full=True)
            if len(ims) != 1:
                book['warn'].append('page %d: %d images' % (i + 1, len(ims)))
            if ims:
                xr = ims[0][0]
                s0, ln, flt = stream_span(raw, offs[xr], xr)
                data = raw[s0:s0 + ln]
                assert data == doc.xref_stream_raw(xr), ('raw mismatch', name, xr)
                jpg = a85(data) if flt[:1] == ['ASCII85Decode'] else data
                assert 'DCTDecode' in flt, flt
                assert jpg[:2] == b'\xff\xd8' and jpg.rstrip(b'\x00\r\n')[-2:] == b'\xff\xd9', ('not a whole jpeg', name, xr)
                ex = doc.extract_image(xr)
                assert ex['image'] == jpg, ('decoded jpeg differs from PyMuPDF', name, xr)
                w, hh = jpeg_size(jpg)
                assert (w, hh) == (ims[0][2], ims[0][3])
                cur['img'] = {'off': s0, 'len': ln, 'enc': 'a85' if flt[0] == 'ASCII85Decode' else '', 'w': w, 'h': hh, 'jpg': len(jpg),
                              'md5': hashlib.md5(jpg).hexdigest()}
        if cur is None:
            continue
        hd = [s for s in sp if s[4].strip() == 'Part No' and s[5].endswith('Bold')]
        if not hd:
            continue
        y_hdr = hd[0][2]
        foot = min([s[0] for s in sp if s[4].startswith('Bike Pharma  |')] + [9999])
        body = [s for s in sp if s[0] > y_hdr - 1 and s[2] < foot - 1]
        # one row per drawn table band (rows are 16 pt; a long remark makes a row taller)
        bands = sorted({(round(d['rect'].y0, 1), round(d['rect'].y1, 1)) for d in pg.get_drawings()
                        if d.get('fill') is not None and d['rect'].x0 < 40 and d['rect'].x1 > 550 and d['rect'].height > 8 and d['rect'].y0 >= y_hdr - 1})
        merged = [[y0, [s for s in body if y0 <= (s[0] + s[2]) / 2 < y1]] for y0, y1 in bands]
        used = {id(s) for _, c in merged for s in c}
        if any(id(s) not in used for s in body):
            book['warn'].append('page %d: text outside table rows %s' % (i + 1, [s[4] for s in body if id(s) not in used][:3]))
        for _, cells in merged:
            c = {'ref': '', 'pn': '', 'desc': '', 'qty': '', 'rem': ''}
            for s in sorted(cells, key=lambda s: s[1]):
                x, t = s[1], s[4].strip()
                k = 'ref' if x < 62 else 'pn' if x < 136 else 'desc' if x < 425 else 'qty' if x < 455 else 'rem'
                c[k] = (c[k] + ' ' + t).strip()
            if not (c['ref'] or c['pn'] or c['desc']):
                continue
            cur['rows'].append([c['ref'], c['pn'], c['desc'], c['qty'], c['rem']])
    # checks against the index
    idx = {code: cnt for code, _, cnt in book['index']}
    for a in book['asm']:
        code = a['kind'][0] + str(a['n'])
        if code not in idx:
            book['warn'].append('%s not in index' % code)
        elif idx[code] != len(a['rows']):
            book['warn'].append('%s rows %d != index %d' % (code, len(a['rows']), idx[code]))
        if not a['img']:
            book['warn'].append('%s no diagram' % code)
    if len(book['asm']) != len(book['index']):
        book['warn'].append('asm %d != index %d' % (len(book['asm']), len(book['index'])))
    return book


if __name__ == '__main__':
    names = sorted(n for n in os.listdir(D) if n.endswith('.pdf'))
    with Pool(8) as pool:
        R = pool.map(one, names)
    json.dump(R, open(OUT, 'w'), separators=(',', ':'))
    for b in R:
        if b['warn']:
            print(b['file'], b['warn'][:6], '+%d' % (len(b['warn']) - 6) if len(b['warn']) > 6 else '')
    print('books', len(R), 'assemblies', sum(len(b['asm']) for b in R), 'rows', sum(len(a['rows']) for b in R for a in b['asm']),
          'diagrams', sum(1 for b in R for a in b['asm'] if a['img']), 'unique', len({a['img']['md5'] for b in R for a in b['asm'] if a['img']}))
