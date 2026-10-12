"""OCR every page of a scanned Suzuki book (no text layer) -> json {pages: [[[x0, y0, x1, y1, text, score], ...] per page]}
in shown-page points (the page's /Rotate applied). usage: python3 -I ocr_book.py <book.pdf> <out.json>"""
import json, sys, time
import numpy as np, pymupdf
from rapidocr_onnxruntime import RapidOCR
src, dst = sys.argv[1], sys.argv[2]
eng = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1, use_cls=False)
doc = pymupdf.open(src); out = []; t0 = time.time(); DPI = 300
for i, pg in enumerate(doc):
    pix = pg.get_pixmap(dpi=DPI, colorspace=pymupdf.csRGB, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    res, _ = eng(img)
    k = 72 / DPI
    out.append([[round(min(p[0] for p in b) * k, 1), round(min(p[1] for p in b) * k, 1), round(max(p[0] for p in b) * k, 1), round(max(p[1] for p in b) * k, 1), t, round(float(s), 3)] for b, t, s in (res or [])])
    if i % 10 == 9: print(src.split('/')[-1], i + 1, '/', doc.page_count, '%.0fs' % (time.time() - t0), flush=True)
json.dump({'pages': out, 'dpi': DPI}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print('done', src.split('/')[-1], doc.page_count, 'pages %.0fs' % (time.time() - t0), flush=True)
