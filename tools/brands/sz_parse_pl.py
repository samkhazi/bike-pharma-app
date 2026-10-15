"""sz_parse.py book reader without pymupdf (pdfplumber; slanted watermark chars left out by their text matrix). Used 2026-10-15 for
Sam's Intruder 150 book GL150GLAL9_P74_14.pdf (pymupdf could not be installed); on PARTS_CATALOGUE_GSX150RLZM2_P74.pdf it gives 983 of
sz_parse's 989 lines, all 983 the same.  usage: python3 -I sz_parse_pl.py <book.pdf> <out.json>  (then put it in suzuki-pages.json books)"""
import sys, types, json, hashlib
sys.modules['pymupdf'] = types.ModuleType('pymupdf')
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import sz_parse as S, pdfplumber
def words_pl(pg):
    st = lambda o: o.get('object_type') != 'char' or (abs(o['matrix'][1]) < 0.01 and abs(o['matrix'][2]) < 0.01 and o['matrix'][0] > 0)
    return [(w['x0'], w['top'], w['x1'], w['bottom'], w['text']) for w in pg.filter(st).extract_words(keep_blank_chars=False, use_text_flow=False)]
def book(path):
    raw = open(path, 'rb').read(); doc = pdfplumber.open(path); lines, last = [], [None]
    for i, pg in enumerate(doc.pages):
        for r in S.page_rows(pg, S.rows_of(words_pl(pg)), last):
            lines.append([i + 1] + r)
    return {'size': len(raw), 'md5': hashlib.md5(raw).hexdigest(), 'pages': len(doc.pages), 'lines': lines}
b = book(sys.argv[1]); json.dump(b, open(sys.argv[2], 'w'))
print(b['pages'], len(b['lines']), len({l[1] for l in b['lines']}))
