"""Aftermarket price lists and catalogues -> parts (update 10b, Sam 2026-10-20 "after markets ke jitne bhi catalogues ka data he
sabhi read hone hein"). am_build.py first reads the *_Master_Catalogue files; this reads every brand's own price list / catalogue
PDF in All Catalogues > After Market Brands (text PDFs, read with `pdftotext -layout`), so numbers the master files missed and the
brands that had no master file (AR, FCC, Goetze, King Quality, MK, Makino, Rolon, Zodix, Uno Minda mechanical) are found too.
A part already read from a master file keeps its data; the list only adds its MRP when the master had none.
lists(SRC, add) calls add(brand, part no., name, group, mrp, fitment text, oem numbers)."""
import os, re, glob, subprocess

def lines(f):
    t = subprocess.run(['pdftotext', '-layout', f, '-'], capture_output=True, text=True).stdout
    return [l.replace(' ', ' ').rstrip() for l in t.split('\n')]

def one(src, *pat):
    for p in pat:
        g = sorted(glob.glob(os.path.join(src, p)))
        if g: return g[0]
    return None

sp = lambda s: ' '.join(str(s or '').split())
num = lambda s: re.sub(r'[^\d.]', '', str(s or '').replace(':', '.'))
HEAD = re.compile(r'^[A-Z][A-Z &/().,\'-]{2,45}$')

def heads(L):
    """the heading above each line (a short all-capital line without digits: a part group or a bike maker)"""
    h, out = '', []
    for l in L:
        s = sp(l)
        if HEAD.match(s) and not re.search(r'PRICE|LIST|PAGE|MRP|W\.E\.F|LTD|LIMITED|INDIA|DESCRIPTION|PART NO|MODEL|AUTO PARTS|SCOOTER|MOPEDS|FOR MOTORCYCLE|S\.NO|COMPANY', s): h = s
        out.append(h)
    return out

def around(L, i, rec):
    """the text on the lines next to a record that belongs to it (a model name printed over two or three lines)"""
    t = []
    for j in (i - 1, i + 1, i - 2, i + 2):
        if 0 <= j < len(L) and not rec(L[j]):
            s = sp(re.sub(r'(Bosch|Varroc|Steelbird|Spark MINDA|Uno Minda):\s*\S+', '', L[j]))
            if s and not re.search(r'PRICE|PAGE|\d+/\d+$|PART NO|MRP', s, re.I) and len(s) < 70: t.append(s)
    return ' '.join(t)

def run(f, rx, fn):
    L = lines(f); H = heads(L); rec = lambda l: bool(rx.search(l)); n = 0
    for i, l in enumerate(L):
        for m in rx.finditer(l):
            fn(m, H[i], L, i, rec); n += 1
    return n

def lists(SRC, add):
    got = {}
    def go(b, pat, rx, fn):
        f = one(SRC, *pat)
        if f: got[b + ' · ' + os.path.basename(f)] = run(f, re.compile(rx), fn)

    # AR: alloy wheels (code, bike, colour, F/R, size, MRP, box qty) and fuel pumps etc. (two columns a line, OEM no. in [ ])
    def ar(m, h, L, i, rec):
        d = m.group('d'); oem = re.findall(r'\[([^\]]+)\]', d)
        add('AR', m.group('pn'), sp(re.sub(r'\[[^\]]*\]', '', d)) + (' · ' + h.title() if h else ''), h, m.group('mrp'), d, oem)
    go('AR', ['AR/*.pdf'], r'(?P<pn>\bARW-\d{4}[A-Z]?(?: (?:RS|FR|RR))?|\bAR-\d{4}[A-Z]?)\s+(?P<d>(?:(?!AR-\d).)+?)\s+(?P<mrp>\d{3,5}(?:\.\d\d)?)(?:\s+\d{1,2})?(?=\s{2,}AR|\s*$)', ar)

    # FCC clutch: maker, model, FCC part code, MRP
    go('FCC', ['FCC/*.pdf'], r'^\s*\d+\s+(?P<mk>[A-Z]+(?: [A-Z]+)?)\s{2,}(?P<md>.+?)\s{2,}(?P<pn>FCC-\S+)\s+(?P<mrp>[\d,]+)\s*$',
       lambda m, h, *_: add('FCC', m.group('pn'), sp((h or 'Clutch').title() + ' · ' + m.group('md')), h or 'Clutch', m.group('mrp'), m.group('mk') + ': ' + m.group('md')))

    # Goetze block kits and pistons
    for b, pat, g in (('Goetze', ['Goetze Cylinder Kit/*.pdf'], 'Cylinder kit'), ('Goetze', ['Goetze Pistons/*.pdf'], 'Piston')):
        go(b, pat, r'^\s*(?P<mk>[A-Z]+)?\s*(?P<pn>\d{5}[A-Z]{3}(?:-[A-Za-z]+)?)\s+(?P<d>.+?)\s+(?P<mrp>\d+\.\d\d)\s*$',
           lambda m, h, *_, g=g: add('Goetze', m.group('pn'), g + ' · ' + sp(m.group('d')), g, m.group('mrp'), sp((m.group('mk') or '') + ' ' + m.group('d'))))

    # King Quality: item code, bike, colour, MRP, unit
    go('King Quality', ['King Quanlity/*.pdf', 'King Quality/*.pdf'], r'^\s*(?P<pn>KQ-\d+[A-Z]?)\s+(?P<d>.+?)\s+(?P<mrp>\d+\.\d\d)\s+(?:\d+\s+)?(?:Set|Pcs?|Nos?|Pair)\b',
       lambda m, h, *_: add('King Quality', m.group('pn'), sp(m.group('d')) + (' · ' + h.title() if h else ''), h, m.group('mrp'), sp(h + ' ' + m.group('d'))))

    # MK clutch plates: part no., bikes (often two lines), HSN, plates a set, box; no MRP printed
    def mk(m, h, L, i, rec):
        d = sp(m.group('d')) or around(L, i, rec)
        add('MK', m.group('pn'), 'Clutch plate · ' + d, 'Clutch plate', 0, d)
    go('MK', ['MK*/*.pdf'], r'^(?P<pn>\d{4}[A-Z]?)\s+(?P<d>.*?)\s*87\d{6}\s+\d+\s+\d+\s*$', mk)

    # Makino: sub category, application, SAP code, box, MRP, list price
    go('Makino', ['Makino/*.pdf'], r'^\s*(?P<g>.+?)\s{2,}(?P<d>.+?)\s{2,}(?P<pn>\d{3}-[0-9A-Z]{6,})\s+\d+\s+(?P<mrp>\d+)\s+\d+\s*$',
       lambda m, h, *_: add('Makino', m.group('pn'), sp(m.group('g') + ' · ' + m.group('d')), sp(m.group('g')), m.group('mrp'), m.group('d')))

    # Rolon chain kits: material code, description, family (maker), MRP
    go('Rolon', ['Rolon*/*.pdf'], r'^\s*\d+\s+(?P<pn>KIT[0-9A-Z]{10,})\s+(?P<d>.+?)\s{2,}(?P<mk>[A-Z][A-Z ]+?)\s+(?P<mrp>\d{3,5})\s*$',
       lambda m, h, *_: add('Rolon', m.group('pn'), 'Chain sprocket kit · ' + sp(m.group('d')), 'Chain sprocket kit', m.group('mrp'), sp(m.group('mk') + ': ' + m.group('d'))))

    # Zodix: a picture catalogue, each part = code, price, box qty under its bike name, the part's name as the page heading
    def zx(m, h, L, i, rec):
        x = m.start('pn'); md = ''
        for j in range(i - 1, max(-1, i - 3), -1):
            seg = L[j][max(0, x - 12):x + 30]
            s = sp(re.sub(r'\S*\d+[.:]\d\d\S*|\b\d+\b', '', seg))
            if s and not rec(L[j]) and not re.search(r'ZODIX|PAGE', s): md = s; break
        add('Zodix', m.group('pn'), sp((h.title() if h else 'Part') + (' · ' + md if md else '')), h, m.group('mrp'), md)
    go('Zodix', ['Zodix/*.pdf'], r'(?<![\w.:])(?P<pn>[A-Z]{1,4}\d{2,5}[A-Z]?|\d{3,5}[A-Z]?)\s+(?P<mrp>\d{1,5}[.:]\d\d)\s+\d{1,4}(?=\s|$)', zx)

    # Uno Minda mechanical catalogue: part no., maker, part, bikes, MRP, box
    MK = {'HIRO': 'Hero', 'HERO': 'Hero', 'HOND': 'Honda', 'HONDA': 'Honda', 'BAJ': 'Bajaj', 'BAJAJ': 'Bajaj', 'TVS': 'TVS', 'YAM': 'Yamaha',
          'YAMAHA': 'Yamaha', 'SUZ': 'Suzuki', 'SUZUKI': 'Suzuki', 'RE': 'Royal Enfield', 'ROYAL': 'Royal Enfield', 'KTM': 'KTM'}
    def um(m, h, L, i, rec):
        d = sp(m.group('d')); d = d if len(d) > 2 else around(L, i, rec)
        mk = MK.get(m.group('mk').upper(), m.group('mk').title())
        add('Uno Minda', m.group('pn'), sp(m.group('t').title() + ' · ' + d), m.group('t'), m.group('mrp'), mk + ': ' + d)
    go('Uno Minda', ['UNO Minda/*/*.pdf', 'UNO Minda/*.pdf'], r'^\s*(?P<pn>[A-Z]{2,3}\d{3,5}[A-Z]{0,3})\s+(?P<mk>[A-Z]{2,7})\s{2,}(?P<t>[A-Z][A-Z /.-]+?)\s{2,}(?P<d>.*?)\s+(?P<mrp>\d{2,5})\s+\d+\s*$', um)

    # ---- brands that also have a master file: their full lists
    def bando(m, h, L, i, rec):
        d = sp(m.group('d')) or around(L, i, rec)
        add('Bando', m.group('pn'), 'Drive belt · ' + d, 'Drive belt', m.group('mrp'), sp(h + ' ' + d))
    go('Bando', ['Bando/BANDO*.pdf'], r'^\s*\d+\s+(?:[A-Z]{2,6}\s{2,})?(?P<d>.*?)\s{2,}(?P<pn>(?=[A-Z ]*\d)[A-Z]{1,4}[A-Z0-9]{2,}(?: [A-Z]{0,2}\d{3}[A-Z0-9]*)?)\s+(?P<mrp>\d{2,5})\s*$', bando)

    go('Endurance', ['Endurance/ETL*.pdf'], r'^\s*(?P<pn>[0-9A-Z]{9,11}M?)\s+(?P<d>.+?)\s+(?P<mrp>[\d,]+)\s+\d{1,3}\s*$',
       lambda m, h, *_: add('Endurance', m.group('pn'), sp(m.group('d')), h, m.group('mrp'), m.group('d')))

    go('ASK', ['ASK*/*/ASK*.pdf', 'ASK*/ASK*.pdf', 'Fag/ASK*.pdf'], r'^\s*(?P<pn>ASK/[A-Z/]*\d+[A-Z]?)\s+8\d{3} ?\d{2} ?\d{2}\s+\d+%\s+(?P<d>.+?)\s+\d+\s+\d+\s+(?P<mrp>\d+)\s*$',
       lambda m, h, *_: add('ASK', m.group('pn'), sp(m.group('d')), h, m.group('mrp'), m.group('d')))

    go('Gabriel', ['Gabriel/Product*.pdf'], r'^\s*(?P<pn>AM-[A-Z0-9-]+)\s+(?P<d>.+?)\s+\d+\s+(?P<mrp>\d+\.\d\d)\s*$',
       lambda m, h, *_: add('Gabriel', m.group('pn'), sp(m.group('d')), h, m.group('mrp'), sp(h + ' ' + m.group('d'))))

    for pat, rx in ((['Lumax/2W-price-list*.pdf'], r'(?P<sap>\d{8})\s+(?P<pn>\d{3}-[A-Z0-9][A-Za-z0-9-]*)\s+(?P<d>.+?)\s+\d{8}\s+(?P<mrp>\d+)\s+\d+\s+\d+'),
                    (['Lumax/lumax-2w-price-list*.pdf'], r'(?P<sap>\d{8})\s+(?P<pn>\d{3}-[A-Z0-9][A-Za-z0-9 -]*?)\s{2,}(?P<d>.+?)\s+(?P<mrp>\d+)/-'),
                    (['Lumax/lumax-coil*.pdf'], r'(?P<sap>\d{8})\s+(?P<pn>\d{3}-[A-Z0-9][A-Za-z0-9-]*)\s+(?P<d>.+?)\s+(?P<mrp>\d+)\s+\d+\s+\d+\s*$')):
        go('Lumax', pat, rx, lambda m, h, *_: add('Lumax', re.sub(r'[\s-]+$', '', m.group('pn')), sp(m.group('d')), h, m.group('mrp'), m.group('d')))

    go('MotherSon', ['MotherSon/2WH*.pdf'], r'^\s*\d+\s+(?P<pn>WH-[A-Z0-9]+)\s+(?P<oem>\S+)\s+(?P<d>.+?)\s{2,}(?:\S+\s+){0,2}(?P<mrp>\d{3,5})\s+\d+\s*$',
       lambda m, h, *_: add('MotherSon', m.group('pn'), 'Wire Harness · ' + sp(m.group('d')), 'Wiring harness', m.group('mrp'), sp(h + ' ' + m.group('d')),
                            [m.group('oem')] if re.search(r'\d', m.group('oem')) else []))

    go('Pricol', ['Pricol/PRICOL*.pdf'], r'^\s*(?P<d>.+?)\s{2,}(?P<pn>\d{4,5})\s+(?P<oem>[A-Za-z0-9-]{6,})\s+(?P<mrp>[\d,]+\.\d\d)\s+\d{8}',
       lambda m, h, *_: add('Pricol', m.group('pn'), sp((h.title() + ' · ' if h else '') + m.group('d')), h, m.group('mrp'), sp(h + ' ' + m.group('d')), [m.group('oem').upper()]))

    def smd(m, h, L, i, rec):
        d = sp(m.group('d')) or around(L, i, rec)
        add('Spark Minda', m.group('pn'), 'Starter Motor · ' + d, 'Starter motor', m.group('mrp'), d)
    go('Spark Minda', ['Spark*/starter*.pdf'], r'^\s*\d{3} ?\d{3} ?\d{4}\s+(?P<pn>SM[A-Z0-9-]+)\s+(?P<d>.*?)\s+(?P<mrp>\d{3,6})\s+\d+\s*$', smd)

    go('Suprajit', ['Suprajit/2w*.pdf'], r'^\s*(?P<pn>S[A-Z]{2}\d{4}[A-Z0-9]*(?: [A-Z]{2,5}){0,2})\s{2,}(?P<d>.+?)\s{2,}(?P<md>.+?)\s+\d+\s+(?P<mrp>[\d,]+\.\d\d)\s*$',
       lambda m, h, *_: add('Suprajit', m.group('pn'), sp(m.group('d') + ' · ' + m.group('md')), m.group('d'), m.group('mrp'), sp(h + ': ' + m.group('md'))))

    def umf(m, h, L, i, rec):
        d = sp(m.group('d')) or around(L, i, rec)
        add('Uno Minda', m.group('pn'), sp(m.group('t').title() + ' · ' + d), m.group('t'), m.group('mrp'), d)
    go('Uno Minda', ['Uno Minda Filters/2WH*.pdf'], r'^\s*(?P<pn>[A-Z]{2}\d{4}[A-Z]{2})\s+(?P<d>.*?)\s*(?P<t>AIR FILTER|OIL FILTER|FUEL FILTER|[A-Z]+ FILTER)\s+(?P<mrp>\d{2,5})\s+\d+', umf)

    # Varroc's picture catalogue: part code over "SAP No.", "Description :" and "Model :" in the same column; no MRP
    f = one(SRC, 'Verroc/TWO*.pdf', 'Varroc/TWO*.pdf')
    if f:
        L = lines(f); n = 0; CODE = re.compile(r'\b[A-Z]{2,5}-[A-Z0-9]{2,6}-[A-Z0-9]{2,7}\b')
        for i, l in enumerate(L):
            for m in CODE.finditer(l):
                d = md = ''
                for j in range(i + 1, min(len(L), i + 8)):
                    for k, key in (('d', 'Description'), ('md', 'Model')):
                        q = L[j].find(key, max(0, m.start() - 14), m.end() + 20)
                        if q > -1 and not (d if k == 'd' else md):
                            v = sp(L[j][q:q + 40].split(':', 1)[-1])
                            if k == 'd': d = v
                            else: md = v
                    if CODE.search(L[j]) and j > i + 1: break
                if d:
                    add('Varroc', m.group(0), d, '', 0, md or d); n += 1
        got['Varroc · ' + os.path.basename(f)] = n
    return got
