"""Update 9b: the model books on Sam's Mac that the app did not have yet (Sam 2026-10-15 "haan add karde", "jo kuch cataluge missing
he server pe usko add karde"). Checked every brand folder of All Catalogues against the app: Hero, Honda, RE, KTM, Husqvarna, Bajaj
and Suzuki have every book already (Hero's Splendor Sport, Centennial, Thumbsup, Achiever 2014, Xtreme 2014-17 are editions of
Splendor Plus, Karizma XMR, Mavrick 440, Achiever 150, Xtreme 150). New here:
- TVS NTorq 125 XT and NTorq 125 Race XP (All Catalogues > TVS > <model>): their own models now. Every line of these two books is
  a line of the NTorq 125 e-catalogue (same figure, ref and number), so those lines also fit the new model and its diagrams are
  NTorq 125's (tvs_images.zip, already on the server). 2 Race XP numbers the e-catalogue lacks are added. MRP the books print
  is added where the MRP list has none.
- Yamaha RX135, 5 books 1996-2004 (All Catalogues > Yamaha > Yamaha RX135 > 01_Original_Catalogue_PDF): read from the PDFs'
  text; 12-digit numbers written the Yamaha way (4TLE31002000 -> 4TL-E3100-20-00); the superseding number and the book's
  # (not serviceable) / delta (till stock) marks go in the remark. The 1990s MRPs printed in them are NOT used (old prices);
  MRP only from Sam's Yamaha price list. Diagram = the book's own page, uploaded from Catalogue files (cat/more-files.json).
Not added (said to Sam): Yamaha Aerox E and YD110R (picture-only books, need OCR), SR400 and MTM890 (Japanese books, Japan models).
usage: python3 more_books.py <public/cat dir> <All Catalogues dir with the staged books> [app.html]"""
import sys, os, re, json, collections
import pdfplumber
CAT, SRC = sys.argv[1], sys.argv[2]
APP = sys.argv[3] if len(sys.argv) > 3 else None
MORE_DIR = 'catalogues/more-books'
def jl(n): return json.load(open(os.path.join(CAT, n), encoding='utf-8'))
def jd(n, o): json.dump(o, open(os.path.join(CAT, n), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
def ix(tab, s):
    try: return tab.index(s)
    except ValueError: tab.append(s); return len(tab) - 1
sets = []
added_models = {}

# ---------------- TVS NTorq 125 XT / Race XP ----------------
TVS_NEW = [('Ntorq 125 XT', 'TVS NTorq 125 XT/TVS_NTorq_125_XT.pdf'), ('Ntorq 125 Race XP', 'TVS NTorq 125 Race XP/TVS_NTorq_125_Race_XP.pdf')]
def tvs_lines(f):
    d = pdfplumber.open(f); fig = None; out = []
    for p in d.pages:
        for l in (p.extract_text() or '').split('\n'):
            m = re.match(r'^Fig (\S+) - (.+?)( \(parts with MRP\))?$', l)
            if m: fig = m.group(1)
            m = re.match(r'^(\d+[A-Z]?)\s+([A-Z0-9]{5,})\s+(.+?)\s+(\d+)\s+([\d,]+\.\d\d|-)\s+(.*)$', l)
            if m and fig: out.append((fig, m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)))
    return out
def tvs():
    o, dg = jl('tvs.json'), jl('tvs-dg.json')
    if 'Ntorq 125 XT' in o['models']: print('tvs: already done'); return
    base = [i for i, v in enumerate(o['vars']) if o['vmod'][v] == 'Ntorq 125' and not re.search(r'kits|painted', v)]
    rows = [r for r in o['d'] if set(r[11]) & set(base)]
    by = collections.defaultdict(list)
    for r in rows: by[(r[5], str(r[4]))].append(r)
    byp = collections.defaultdict(list)
    for r in rows: byp[r[5]].append(r)
    n = collections.Counter(); last = rows[0]
    for k, (model, f) in enumerate(TVS_NEW):
        v = model + ' · DRUM/DISC'
        vi = len(o['vars']); o['vars'].append(v); o['vmod'][v] = model
        L = tvs_lines(os.path.join(SRC, 'TVS', f)); figs = {}
        for fig, ref, pn, nm, qty, mrp in L:
            hit = by.get((pn, ref)) or byp.get(pn)
            if mrp != '-' and not o['mrp'].get(pn): o['mrp'][pn] = float(mrp.replace(',', '')); n['mrp added'] += 1
            if hit:
                for r in hit:
                    if vi not in r[11]: r[11].append(vi)
                    src_v = next((x for x in r[11] if x in base), None)
                    if src_v is not None: figs.setdefault(r[2], src_v)
                n['lines'] += 1; last = hit[0]
                continue
            # not in the e-catalogue: a line of its own in the figure of its neighbour
            g = last[2]
            o['d'].append([last[0], -1, g, last[3], ref, pn, ix(o['desc'], nm), qty, '', 0, 0, [vi]]); n['new lines'] += 1
        for g, sv in figs.items():
            f_ = dg['p'].get(str(sv), {}).get(g)
            if f_ is not None: dg['p'].setdefault(str(vi), {})[g] = f_
        added_models[model] = 'TVS'
    i = o['models'].index('Ntorq 125') + 1
    o['models'][i:i] = [m for m, _ in TVS_NEW]
    if i <= o['cur']: o['cur'] += len(TVS_NEW)
    for m, _ in TVS_NEW: o['cc'][m] = o['cc'].get('Ntorq 125', 125)
    jd('tvs.json', o); jd('tvs-dg.json', dg); print('tvs', dict(n))

# ---------------- Yamaha RX135 ----------------
RX = [('YAMAHA_RX135_1996_4TL1_164TL470E1.pdf', '1996', '4TL1'), ('YAMAHA_RX135_1998_4TL2_184TL470E1.pdf', '1998', '4TL2'),
      ('YAMAHA_RX135_2000_4TL4_104TL470E1.pdf', '2000', '4TL4'), ('YAMAHA_RX135_2001_4TL5_114TL470E1.pdf', '2001', '4TL5'),
      ('YAMAHA_RX135_2004_4TL6_1C4TL470E1.pdf', '2004', '4TL6')]
RX_DIR = 'Yamaha/Yamaha RX135/01_Original_Catalogue_PDF'
def y12(s): return '%s-%s-%s-%s' % (s[:3], s[3:8], s[8:10], s[10:12]) if re.fullmatch(r'[0-9A-Z]{12}', s) else s
def rx_page(p):
    """one table page by word position: REF | EXISTING PART NO. | PART NAME | qty | 9 DIGIT | ESCORT | SUPERSEDED | REMARKS
    (the drawing's callout numbers on the left half are left out)"""
    W = p.extract_words(keep_blank_chars=False, use_text_flow=False)
    hd = {w['text']: w for w in W if w['top'] < 140}
    if 'EXISTING' not in hd or 'REMARKS' not in hd: return []
    x_ref = min(w['x0'] for w in W if w['text'].startswith('REF') and w['top'] < 140) - 10
    x_name = next(w['x0'] for w in W if w['text'] == 'PART' and w['top'] < 140 and w['x0'] > hd['EXISTING']['x1']) - 4
    x_nine = next(w['x0'] for w in W if w['text'] == '9' and w['top'] < 140 and w['x0'] > x_name) - 10
    x_esc, x_sup, x_rem = hd['ESCORT']['x0'] - 6, hd['SUPERSEDED']['x0'] - 6, hd['REMARKS']['x0'] - 6
    x_pn = hd['EXISTING']['x0'] - 12; y0 = hd['EXISTING']['bottom'] + 8
    body = [w for w in W if w['x0'] >= x_ref and w['top'] > y0]
    dg = collections.Counter(round(w['x0']) for w in body if x_name < w['x0'] < x_nine and re.fullmatch(r'\d{1,2}', w['text']))
    x_qty = (max(dg.items(), key=lambda kv: kv[1])[0] - 3) if dg else x_nine - 20
    lines = collections.OrderedDict()
    for w in sorted(body, key=lambda w: (w['top'], w['x0'])):
        k = next((k for k in lines if abs(k - w['top']) < 3), w['top']); lines.setdefault(k, []).append(w)
    out = []
    for ws in lines.values():
        col = lambda a, b: ' '.join(w['text'] for w in ws if a <= w['x0'] < b)
        pn = col(x_pn, x_name).replace(' ', '')
        if not re.fullmatch(r'[0-9A-Z]{12}', pn): continue
        out.append((col(x_ref, x_pn).split(' ')[-1], pn, col(x_name, x_qty), col(x_qty, x_nine), col(x_sup, x_rem).replace(' ', ''), col(x_rem, 9999)))
    return out
def rx_book(f):
    d = pdfplumber.open(f); out = []; fig = None
    for i, p in enumerate(d.pages):
        t = p.extract_text() or ''
        m = re.search(r'FIG\.?\s*(\d+)\s*([A-Z][^\n]*)', t)
        if m: fig = (m.group(1), m.group(2).strip()); dpage = i + 1
        if not fig: continue
        ref = ''
        for r, pn, nm, qty, sup, rest in rx_page(p):
            if re.fullmatch(r'\d{1,3}', r): ref = r
            rem = []
            if re.fullmatch(r'[0-9A-Z]{12}', sup) and sup != pn: rem.append('New no. ' + y12(sup))
            if '#' in rest: rem.append('Not serviceable')
            elif '\u2206' in rest or '\u0394' in rest: rem.append('Till stock')
            nm = re.sub(r'\s+', ' ', nm).strip()
            g = re.fullmatch(r'(.*[A-Z)])(\d)', nm)
            if not qty and g: nm, qty = g.group(1), g.group(2)     # 'W/WASHER1': the qty printed against the name
            out.append((fig, dpage, ref, y12(pn), nm, qty if re.fullmatch(r'\d{1,2}', qty) else '', '; '.join(rem)))
    return out, len(d.pages)
def yamaha():
    o, dg = jl('yamaha.json'), jl('yamaha-dg.json')
    if 'RX135' in o['models']: print('yamaha: already done'); return
    src = len(o['src']); o['src'].append("Yamaha RX135 parts catalogues (India, 1996-2004), Sam's Yamaha folder")
    bk = len(o['bk']); o['bk'].append([src, [], ''])
    have_asm = {}; n = collections.Counter(); files = []
    for f, yr, code in RX:
        path = os.path.join(SRC, RX_DIR, f); size = os.path.getsize(path)
        L, pages = rx_book(path); files.append([f, size])
        v = 'RX135 · %s · %s' % (yr, code); vi = len(o['vars']); o['vars'].append(v); o['vmod'][v] = 'RX135'
        for (fno, ftitle), dpage, ref, pn, nm, qty, rem in L:
            u = 'pdf:%s/%s:0:%d:%d:0,0,1,1' % (MORE_DIR, f, size, dpage)
            fi = ix(dg['f'], u); dg['p'].setdefault(str(vi), {})[fno] = fi
            o['d'].append([bk, -1, fno, ix(o['asm'], ftitle.title()), ref, pn, ix(o['desc'], nm), qty, rem, 0, 0, [vi]]); n['lines'] += 1
        n['books'] += 1
    i = o['models'].index('RX100') + 1; o['models'].insert(i, 'RX135')
    if i <= o['cur']: o['cur'] += 1
    o['cc']['RX135'] = 132
    added_models['RX135'] = 'Yamaha'
    sets.append({'dir': MORE_DIR, 'name': 'Yamaha RX135', 'pick': 'All Catalogues > Yamaha > Yamaha RX135', 'files': files})
    mrp = sum(1 for r in o['d'][-n['lines']:] if o['mrp'].get(r[5])); n['lines with MRP'] = mrp
    jd('yamaha.json', o); jd('yamaha-dg.json', dg); print('yamaha', dict(n))

tvs(); yamaha()
if sets: jd('more-files.json', {'sets': sets})
if APP and added_models:
    a = open(APP, encoding='utf-8').read()
    m = re.search(r'Object\.assign\(BRANDS_V,(\{.*?\})\);', a)
    bv = json.loads(m.group(1))
    after = {'Ntorq 125 XT': 'Ntorq 125', 'Ntorq 125 Race XP': 'Ntorq 125 XT', 'RX135': 'RX100'}
    for mod, b in added_models.items():
        if mod in bv[b]: continue
        bv[b].insert(bv[b].index(after[mod]) + 1, mod)
    a = a[:m.start(1)] + json.dumps(bv, ensure_ascii=False, separators=(',', ':')) + a[m.end(1):]
    m = re.search(r'\{const cc=(\{.*?\});for\(const m in cc\)', a); cc = json.loads(m.group(1))
    cc.update({'Ntorq 125 XT': 125, 'Ntorq 125 Race XP': 125, 'RX135': 132})
    a = a[:m.start(1)] + json.dumps(cc, ensure_ascii=False, separators=(',', ':')) + a[m.end(1):]
    open(APP, 'w', encoding='utf-8').write(a); print('app models added', list(added_models))
