"""Checks the Bajaj diagrams drawn in the browser (tools/test_bajaj.mjs -> OUT/<n>.png + OUT/list.json) against MuPDF's own
drawing of the same PDF page, cropped by the same fractions: same size, and the pictures match (mean difference per pixel).
Writes OUT/sheet-<n>.png (browser left, MuPDF right, small, for a person to look at).
usage: python3 -I tools/bajaj_cmp.py <folder holding catalogues/bajaj/bajaj_spc_pdfs.zip> <OUT>"""
import json, os, re, sys
import pymupdf
from PIL import Image, ImageChops, ImageStat

root, out = sys.argv[1], sys.argv[2]
lst = json.load(open(os.path.join(out, 'list.json')))
bad, rows = 0, []
for r in lst:
    m = re.match(r'^pdf:(.+):(\d+):(\d+):(\d+):([\d.]+),([\d.]+),([\d.]+),([\d.]+)$', r['u'])
    path, off, ln, pg = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))
    x0, y0, x1, y1 = map(float, m.groups()[4:])
    with open(os.path.join(root, path), 'rb') as f:
        f.seek(off); data = f.read(ln)
    doc = pymupdf.open(stream=data, filetype='pdf'); page = doc[pg - 1]
    W, H = page.rect.width, page.rect.height                     # as shown (rotation applied)
    sc = r['w'] / ((x1 - x0) * W)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(sc, sc), alpha=False)
    full = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    ref = full.crop((round(x0 * pix.width), round(y0 * pix.height), round(x1 * pix.width), round(y1 * pix.height)))
    got = Image.open(os.path.join(out, '%d.png' % r['i'])).convert('RGB')
    size_ok = abs(ref.width - got.width) <= 2 and abs(ref.height - got.height) <= 2
    a = got.resize(ref.size) if got.size != ref.size else got
    diff = sum(ImageStat.Stat(ImageChops.difference(a, ref)).mean) / 3
    ok = size_ok and diff < 12
    bad += not ok
    rows.append((r['i'], got.size, ref.size, round(diff, 2), r['ms'], 'ok' if ok else 'BAD', path.split('/')[-1], off, pg))
    th = 420
    s = Image.new('RGB', (2 * th + 10, th), 'white')
    g1 = got.copy(); g1.thumbnail((th, th)); g2 = ref.copy(); g2.thumbnail((th, th))
    s.paste(g1, (0, 0)); s.paste(g2, (th + 10, 0)); s.save(os.path.join(out, 'sheet-%d.png' % r['i']))
for x in rows: print(*x)
print('BAD' if bad else 'ALL MATCH', bad, 'of', len(rows))
sys.exit(1 if bad else 0)
