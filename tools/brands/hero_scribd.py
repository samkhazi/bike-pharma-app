"""Old Hero parts books from Sam's folder Downloads > Updated Hero Catalogue > Scribd Catalogues, update 9m (Sam 2026-10-19 "scribd ke naam se he").

Sam's comparison sheet Hero_Scribd_vs_eCatalogue.xlsx (sheet 'All Parts') has every line of the 68 PDFs: book, page, ref, part no., description,
qty and Hero's new number. On top of the Hero data of update 9l this adds:
  - each book of an edition the e-catalogue does not have as a new edition; its diagrams are the book's own PDF pages (the page of the line,
    the diagram sits above the table), drawn by the app like the Suzuki and TVS books; copies of the same book and books of editions the
    e-catalogue already has are left out
  - a line's new number as a 'New no. X' remark, and on the new number's lines in every edition 'Old no. X' (search finds both)
  - part numbers of the other books and lists that no edition has: 'Other parts (price list)' > 'Old Hero books and lists (Scribd)', no diagram
No prices from the old books (MRP only: a part keeps the MRP of Hero's Oct 2026 list when it has one).

usage: python3 -I hero_scribd.py <folder> <out dir>
<folder> holds Hero_Scribd_vs_eCatalogue.xlsx, _transfer/scribd_pages.json ({book.pdf: {size, ...}}) and _transfer/scribd_figs2.json
({book.pdf: [[fig code, title] per page]}, read from the PDFs' text on Sam's Mac)."""
import collections, json, os, re, sys, warnings
import openpyxl
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.environ.get('HERO_IN') or os.path.join(HERE, '..', '..', 'public', 'cat')   # HERO_IN: the update 9l hero.json + hero-dg.json
DIR = 'catalogues/hero'
PL_M = 'Other parts (price list)'
OB_V = 'Old Hero books and lists (Scribd)'

# book -> (model, edition, emission book: 0 BS3, 1 BS4)
NEW = {
    '101180352-Passion-Pro-parts-catalogue': ('Passion Pro', 'Passion PRO Special Edition (old book)', 0),
    '330091700-PASSION-PRO-Parts-Catalog': ('Passion Pro', 'Passion PRO (old book)', 0),
    '149903520-Admin-Uploads-Documentos-Splendor-NXG-1307552509': ('Splendor NXG', 'SPLENDOR NXG New (old book)', 0),
    '252819767-Splendor-NXG-ES-pdf': ('Splendor NXG', 'Splendor NXG ES (Sep, 2008)', 0),
    '287962557-Glamour-pdf': ('Glamour', 'Glamour (Nov, 2013)', 0),
    '402211436-glamour-aana-pdf-2012-pdf': ('Glamour', 'Glamour (May, 2012)', 0),
    '411451871-Glamour-Pgm-Fi-Ktrh-1': ('Glamour', 'Glamour PGM-FI (Nov, 2008)', 0),
    '627124701-Glamour-2016': ('Glamour', 'GLAMOUR (May, 2016)', 0),
    '834029479-Glamour-2005': ('Glamour', 'Glamour (Jun, 2005)', 0),
    '849318805-Glamour-2008-Ktrj': ('Glamour', 'Glamour (Nov, 2008)', 0),
    '849318807-Glamour-2007': ('Glamour', 'Glamour (Jan, 2007)', 0),
    '451567743-glamour-fi-pdf': ('Glamour', 'Glamour PGM-FI (old book)', 0),
    '287962727-MODELO-ECO-DELUX-HERO-pdf': ('CD Deluxe', 'ECO Deluxe Columbia (Aug, 2014)', 0),
    '338755306-CD-DELUXE-NEW-pdf': ('CD Deluxe', 'CD Deluxe New (old book)', 0),
    '39131892-ECO-DLX': ('CD Deluxe', 'CD DELUXE (2010)', 0),
    '338754520-CD-DAWN-AAJB-HERO-pdf': ('HF Dawn', 'HF DAWN (Aug, 2012)', 0),
    '460813711-CD-DAWN-STD': ('CD Dawn', 'CD DAWN New (old book)', 0),
    '480549651-Honda-ECO-100-Catalogo-de-Partes': ('CD Dawn', 'CD Dawn (Mar, 2005)', 0),
    '834027457-CD-DAWN-2006': ('CD Dawn', 'CD Dawn (Nov, 2006)', 0),
    '834027458-CD-DAWN-2003': ('CD Dawn', 'CD Dawn (Apr, 2003)', 0),
    '834028318-CD-DAWN-2010-KSTK': ('CD Dawn', 'CD Dawn (Mar, 2010)', 0),
    '410348144-Impulse-Parts-Catalogue': ('Impulse', 'Impulse (Oct, 2011)', 0),
    '402211539-super-splendor-aaga-pdf': ('Super Splendor', 'SUPER Splendor (May, 2012)', 0),
    '906339529-Aaga-Super-Splendor-Final-04-08-12-Bt': ('Super Splendor', 'Super Splendor AAGA (Aug, 2012)', 0),
    '434596307-karizma-r-manual-150205012619-conversion-gate01-pdf': ('Karizma', 'Karizma R (old book)', 0),
    '514443760-hero-honda-karizma-zmr': ('Karizma ZMR', 'Karizma ZMR (old book)', 0),
    '514443701-Cbz-Xtreme': ('CBZ Xtreme', 'CBZ Xtreme (2012)', 0),
    '487023491-Hunk-Parts-catalogue': ('Hunk', 'Hunk (old book)', 0),
    '500519174-Hero-Pleasure-Scooter-Part-Catalogue-Mar-2010-Edition': ('Pleasure', 'Pleasure (Mar, 2010)', 0),
    '521861686-xpulse200t-manual-de-partes': ('Xpulse 200T', 'Xpulse 200T FI (Jan, 2020)', 1),
    '671078636-CATALOGO-DE-PARTES-HERO-HUNK-200R': ('Xtreme 200R', 'Hunk 200R export (Aug, 2018)', 1),
    '599959413-DAWN-150': ('Dawn 150', 'Dawn 150 export (Oct, 2016)', 0),
    '834029192-DAWN-2016': ('Dawn 125', 'DAWN 125 export (Feb, 2016)', 0),
    '849318941-IGNITOR-2016': ('Ignitor', 'IGNITOR (Oct, 2016)', 0),
    '687634190-splendor-plus-aaea': ('Splendor Plus', 'Splendor+ (Mar, 2012)', 0),
}
CC = {'Splendor NXG': 100, 'CD Deluxe': 100, 'CD Dawn': 100, 'Impulse': 150, 'CBZ Xtreme': 150, 'Dawn 150': 150, 'Dawn 125': 125}
# not used at all: Honda's own CD100RN book (not Hero) and KDR's oil seal list (KDR's numbers)
SKIP = {'869454557-CB100', '290679854-Oil-Seal-Pricelist-1'}

clean = lambda s: re.sub(r'\s+', ' ', str(s if s is not None else '').replace('\xa0', ' ')).strip()
flat = lambda p: re.sub(r'[^A-Z0-9]', '', str(p).upper())
nat = lambda s: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', str(s))]
PN = re.compile(r'^[0-9A-Z][0-9A-Z-]{6,}$')


def okpn(p):
    return bool(PN.match(p)) and sum(c.isdigit() for c in p) >= 4


def figs(pages):
    """page -> (fig code, title); a page without a code continues the page before it"""
    code, out, names = '', {}, collections.defaultdict(collections.Counter)
    for i, (c, t) in enumerate(pages, 1):
        if c:
            code = c
            t = clean(t).upper().strip(' .:-')
            if sum(ch.isalpha() for ch in t) >= 4 and not re.search(r'\d{5}', t):
                names[c][t] += 1
        out[i] = code
    return out, {c: n.most_common(1)[0][0] for c, n in names.items()}


class Ix:
    """A name list that keeps its repeats: add() gives a name's first index, or appends it."""
    def __init__(self, l):
        self.l, self.i = list(l), {}
        for n, x in enumerate(self.l):
            self.i.setdefault(x, n)

    def add(self, x):
        if x not in self.i:
            self.i[x] = len(self.l)
            self.l.append(x)
        return self.i[x]


def main(folder, out):
    F = lambda n: os.path.join(folder, n)
    sizes = {k[:-4]: v['size'] for k, v in json.load(open(F('_transfer/scribd_pages.json'))).items()}
    fg = {k[:-4]: v for k, v in json.load(open(F('_transfer/scribd_figs2.json'))).items()}
    ws = openpyxl.load_workbook(F('Hero_Scribd_vs_eCatalogue.xlsx'), read_only=True)['All Parts']
    it = ws.iter_rows(values_only=True)
    h = next(it)
    rows = [dict(zip(h, r)) for r in it if r and r[0]]
    o = json.load(open(os.path.join(CAT, 'hero.json')))
    dg = json.load(open(os.path.join(CAT, 'hero-dg.json')))
    old_vars = list(o['vars'])
    assert not any(v in o['vmod'] for _, v, _ in NEW.values())
    # the new editions: after their model's editions (they are older); new models before the price-list 'model'
    vl = list(o['vars'])
    for b, (m, v, _) in NEW.items():
        at = [i for i, u in enumerate(vl) if o['vmod'].get(u) == m]
        if at:
            vl.insert(at[-1] + 1, v)
        else:
            vl.insert(next(i for i, u in enumerate(vl) if o['vmod'].get(u) == PL_M), v)
        o['vmod'][v] = m
        if m not in o['models']:
            o['models'].insert(o['models'].index(PL_M), m)
            o['cc'][m] = CC[m]
    vl.append(OB_V)
    o['vmod'][OB_V] = PL_M
    o['vmod'] = {v: o['vmod'][v] for v in vl}
    re_ix = {i: vl.index(v) for i, v in enumerate(old_vars)}
    o['vars'] = vl
    vi = {v: i for i, v in enumerate(vl)}
    for r in o['d']:
        r[11] = sorted(re_ix[k] for k in r[11])
    dg['p'] = {str(re_ix[int(k)]): x for k, x in dg['p'].items()}
    ob_nb = len(o['bk'])
    o['bk'].append([1, [], 'Part numbers from old Hero parts books and lists (Scribd) that no edition has: no diagram'])
    o['src'].append("Old Hero parts books and lists (Scribd), Sam's folder Updated Hero Catalogue > Scribd Catalogues")
    # update 9w fix: the lists have repeated names (asm 7, desc 47); a {name: index} dict of them lost those places, so every later name
    # moved up by one or more (Sam 2026-10-20: 11394-AAH-00099 showed PUMP ASSY., OIL, the name of the next line). Indexes stay as they are.
    asm, desc = Ix(o['asm']), Ix(o['desc'])
    fi = {u: i for i, u in enumerate(dg['f'])}
    have = {flat(r[5]) for r in o['d']}
    pairs, add, st = set(), [], collections.Counter()
    by = collections.defaultdict(list)
    for r in rows:
        by[clean(r['Catalogue'])].append(r)
    for b, L in by.items():
        if b in SKIP:
            continue
        for r in L:
            pn, nw = clean(r['Old Catalogue Part No']).upper(), clean(r['New Part No (Hero)']).upper()
            if okpn(pn) and okpn(nw) and flat(pn) != flat(nw):
                pairs.add((pn, nw))
        if b not in NEW:
            continue
        m, v, nb = NEW[b]
        page_fig, names = figs(fg[b])
        used = set()
        ref = ''
        for r in L:
            pn = clean(r['Old Catalogue Part No']).upper()
            if not okpn(pn):
                st['bad_pn'] += 1
                continue
            pg = int(r['Page']) if str(r['Page']).isdigit() else 0
            g = page_fig.get(pg) or 'P%d' % pg
            ref = clean(r['Ref']) or ref
            rem = ['No longer supplied (Hero)'] if 'NLS' in clean(r['Status']) else []
            a = names.get(g) or ('FIG ' + g if not g.startswith('P') else 'PAGE %d' % pg)
            add.append([nb, -1, g, asm.add(a), ref, pn, desc.add(clean(r['Description (catalogue)']).upper()),
                        clean(r['Qty']), '; '.join(rem), 0, 0, [vi[v]]])
            # the diagram of a fig: the first page that shows it
            if g not in used and pg:
                used.add(g)
                u = 'pdf:%s/%s.pdf:0:%d:%d:0,0,1,1' % (DIR, b, sizes[b], pg)
                if u not in fi:
                    fi[u] = len(dg['f'])
                    dg['f'].append(u)
                dg['p'].setdefault(str(vi[v]), {})[g] = fi[u]
        st['editions'] += 1
        if not any(f[0] == b + '.pdf' for f in dg['files']):
            dg['files'].append([b + '.pdf', sizes[b]])
    # one line per (edition, fig, ref, part): the books list a part again where a table runs over two pages
    seen = set()
    for x in add:
        k = (x[11][0], x[2], x[4], x[5])
        if k in seen:
            continue
        seen.add(k)
        o['d'].append(x)
        have.add(flat(x[5]))
        st['lines'] += 1
    # a price-list part (update 9l: no diagram had it) that an old book now shows in its diagram: the price-list line goes
    pl_nb = next(i for i, b in enumerate(o['bk']) if b[2].startswith('Parts from Hero'))
    shown = {flat(x[5]) for x in add}
    n0 = len(o['d'])
    o['d'] = [r for r in o['d'] if not (r[0] == pl_nb and r[2].startswith('PL') and flat(r[5]) in shown)]
    st['price_list_now_in_diagram'] = n0 - len(o['d'])
    # part numbers no edition has, from the other books and lists
    miss = {}
    for b, L in by.items():
        if b in SKIP or b in NEW:
            continue
        for r in L:
            pn = clean(r['Old Catalogue Part No']).upper()
            f = flat(pn)
            # Sam's sheet already found these in the e-catalogue; Hero's lists add an 'S' (service part) to the e-catalogue's number
            if clean(r['Status']).startswith('Same number') or (f.endswith('S') and f[:-1] in have):
                continue
            if okpn(pn) and f not in have and f not in miss:
                miss[f] = (pn, clean(r['Description (catalogue)']).upper(), 'NLS' in clean(r['Status']))
    for pn, d, nls in sorted(miss.values()):
        d = d or 'PART'
        k = d[:1] if d[:1].isalpha() else '#'
        o['d'].append([ob_nb, -1, 'OB' + k, asm.add('OLD BOOK PARTS: ' + k + ' (NO DIAGRAM)'), '', pn,
                       desc.add(d), '', 'No longer supplied (Hero)' if nls else '', 0, 0, [vi[OB_V]]])
    st['old_book_parts'] = len(miss)
    o['asm'], o['desc'] = asm.l, desc.l
    # old / new numbers: Hero's dashed spelling where the data has it
    dashed = {}
    for r in o['d']:
        if '-' in r[5]:
            dashed.setdefault(flat(r[5]), r[5])
    olds, news = collections.defaultdict(set), collections.defaultdict(set)
    for a, b in pairs:
        a, b = dashed.get(flat(a), a), dashed.get(flat(b), b)
        olds[flat(b)].add(a)
        news[flat(a)].add(b)
    # the 'S' (service part) spelling of a number already listed is the same number
    for D in (olds, news):
        for k, xs in D.items():
            fx = {flat(x) for x in xs}
            D[k] = {x for x in xs if not (flat(x).endswith('S') and flat(x)[:-1] in fx)}
    nrem = 0
    for r in o['d']:
        k = flat(r[5])
        ad = ['Old no. ' + a for a in sorted(olds.get(k, ())) if flat(a) != k and 'Old no. ' + a not in r[8]] + \
             ['New no. ' + b for b in sorted(news.get(k, ())) if flat(b) != k and 'New no. ' + b not in r[8]]
        if ad:
            r[8] = '; '.join([r[8]] + ad if r[8] else ad)
            nrem += 1
    dg['p'] = {k: dg['p'][k] for k in sorted(dg['p'], key=int)}
    for n, obj in (('hero.json', o), ('hero-dg.json', dg)):
        with open(os.path.join(out, n), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    st.update(pairs=len(pairs), lines_with_old_new=nrem, vars=len(vl), models=len(o['models']), pdfs=sum(1 for f in dg['files'] if f[0].endswith('.pdf')),
              pdf_mb=round(sum(f[1] for f in dg['files'] if f[0].endswith('.pdf')) / 1e6, 1), diagrams=sum(1 for u in dg['f'] if u.startswith('pdf:')))
    print(json.dumps(st, indent=1))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
