"""Hero catalogue update from Sam's folder Downloads > Updated Hero Catalogue (Hero MotoCorp e-catalogue, 18 Oct 2026), update 9l.

The app's Hero data (update 7, Sam's Hero package) already has 236 of the folder's 238 editions, so this adds what is new on top of it and
keeps everything else as it is (the diagrams stay the package's original pictures):
  - 2 new editions (Destini 110 Special Edition, HF Deluxe Xtech (HMCM) OBD2, Oct 2026) with their parts; their diagrams are the folder's
    SVGs (Hero has no original picture of them in the folder), drawn by the app
  - MRP from Hero_All_Parts.xlsx (MRP list, 18 Oct 2026) for every part it lists
  - parts with an MRP that no diagram has: model 'Other parts (price list)', a section per first letter, no diagram
  - kits (Hero_Kits.xlsx: kit no., name, MRP, the editions it fits) as a 'KITS' section in each edition; Hero does not show a kit's contents
  - old -> new numbers (Hero_Old_New_Part_Numbers.xlsx + Hero_All_Parts.xlsx) as 'Old no. X' / 'New no. X' remarks; an old number finds the new one
  - part photos the package did not have, from the folder's Photos
New pictures (SVGs + photos) go in one stored zip made on Sam's Mac with the files' own bytes: Hero_Update_19Oct.zip.
MRP only: the BOM prices in the folder's JSON (price list code DP) are never used.

usage: python3 -I hero_update.py need <folder> <out need.json>          the files the update zip must hold
       python3 -I hero_update.py build <folder> <zip index.json> <out dir>  -> <out>/hero.json + hero-dg.json
<folder> holds _raw/hero_data_243.json, Hero_All_Parts.xlsx, Hero_Old_New_Part_Numbers.xlsx, Hero_Kits.xlsx, Photos.txt (the Photos folder's names).
zip index.json: {size, entries: {name: [data offset, length, w, h]}} (made on the Mac)."""
import collections, json, os, re, sys, warnings
import openpyxl
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, '..', '..', 'public', 'cat')
ZIP = 'Hero_Update_19Oct.zip'
DIR = 'catalogues/hero'
PL_M, PL_V = 'Other parts (price list)', 'Hero MRP price list (Oct, 2026)'
NEW_ED = {'DESTINI_110_A1CM': 'Destini 110', 'HF_DELUXE_A1AF': 'HF Deluxe'}


def nat(s):
    return [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', str(s))]


def clean(s):
    return re.sub(r'\s+', ' ', str(s or '').replace('\xa0', ' ')).strip()


def label(n):   # hr_pkg_build.hero_label
    n = clean(n).replace('((', '(')
    n = re.sub(r'\s*\(\s*', ' (', n)
    n = re.sub(r'\s*,\s*', ', ', n)
    n = re.sub(r'\.\s*,', ',', n)
    return re.sub(r'\s+', ' ', n).strip()


key = lambda s: re.sub(r'[^a-z0-9]', '', re.sub(r'\s*\[\w+\]$', '', s).lower().replace('sept', 'sep'))
flat = lambda p: re.sub(r'[^A-Z0-9]', '', str(p).upper())


def xl(path, sheet):
    ws = openpyxl.load_workbook(path, read_only=True)[sheet]
    it = ws.iter_rows(values_only=True)
    h = next(it)
    return [dict(zip(h, r)) for r in it if r and r[0] is not None]


def money(v):
    try:
        f = float(str(v).replace(',', ''))
    except (TypeError, ValueError):
        return 0
    return int(f) if f == int(f) else f


def load(folder):
    F = lambda n: os.path.join(folder, n)
    raw = json.load(open(F('_raw/hero_data_243.json')))
    old = json.load(open(os.path.join(CAT, 'hero.json')))
    allp = xl(F('Hero_All_Parts.xlsx'), 'All Parts')
    kits = xl(F('Hero_Kits.xlsx'), 'Kits')
    o2n = xl(F('Hero_Old_New_Part_Numbers.xlsx'), 'Old to New')
    photos = {l.strip().rsplit('.', 1)[0]: l.strip() for l in open(F('Photos.txt')) if l.strip().lower().endswith('.jpg')}
    recs = {r['model']['name']: r for r in raw['records'] if r['model'].get('desc')}
    return old, recs, allp, kits, o2n, photos


def plan(folder):
    """everything the update adds, without the zip: (old data, new rows, MRP, remarks, needed svgs {groupNo: file}, photos {pn: file})"""
    old, recs, allp, kits, o2n, photos = load(folder)
    have = {key(v) for v in old['vars']}
    new = []
    for name, m in NEW_ED.items():
        r = recs[name]
        assert key(r['model']['desc']) not in have, name
        v = label(r['model']['desc'])
        assert old['vmod'].get(v) is None
        for g in r['groups']:
            for b in g.get('boms') or []:
                new.append(dict(m=m, v=v, y=int(r['model']['year']), g=clean(g['mapName']), gn=g['groupNo'], asm=clean(g['groupDesc']),
                                ref=clean(b['refno']), pn=clean(b['component']), desc=clean(b['partDesc']), qty=clean(b['qty']),
                                ns=1 if b.get('serviceability') == 'N' else 0))
    # editions the app has: only the lines of part numbers the package did not have (Hero added them since)
    opn, vk0 = {x[5] for x in old['d']}, {key(v): v for v in old['vars']}
    for name, r in recs.items():
        v = vk0.get(key(r['model']['desc']))
        if name in NEW_ED or not v:
            continue
        for g in r['groups']:
            for b in g.get('boms') or []:
                if clean(b['component']) not in opn:
                    new.append(dict(m=old['vmod'][v], v=v, y=int(r['model']['year']), g=clean(g['mapName']), gn=None, asm=clean(g['groupDesc']),
                                    ref=clean(b['refno']), pn=clean(b['component']), desc=clean(b['partDesc']), qty=clean(b['qty']),
                                    ns=1 if b.get('serviceability') == 'N' else 0, old=1))
    dpn = opn | {x['pn'] for x in new}
    dflat = {flat(p) for p in dpn}
    mrp = {clean(r['Part No']): money(r['MRP']) for r in allp if money(r['MRP']) > 0}
    # price-list parts no diagram has
    pl, kitn = [], {clean(k['Kit No']) for k in kits}
    for r in allp:
        pn = clean(r['Part No'])
        if pn in mrp and pn not in dpn and pn not in kitn and flat(pn) not in dflat:
            d = clean(r['Part Name']).upper()
            k = d[:1] if d[:1].isalpha() else '#'
            rem = 'Non current (Hero)' if clean(r['Status']) == 'NON CURRENT' else ''
            pl.append(dict(m=PL_M, v=PL_V, y=0, g='PL' + k, asm='PRICE LIST PARTS: ' + k + ' (NO DIAGRAM)', ref='', pn=pn, desc=d, qty='', rem=rem, ns=0))
            dflat.add(flat(pn))
    # kits: a KITS section in every edition the kit fits (the list names editions as Hero writes them)
    vk = {key(v): v for v in old['vars']}
    vk.update({key(label(recs[n]['model']['desc'])): label(recs[n]['model']['desc']) for n in NEW_ED})
    vmod = dict(old['vmod'], **{label(recs[n]['model']['desc']): m for n, m in NEW_ED.items()})
    kit_rows, kit_lost = [], 0
    for k in kits:
        pn, p = clean(k['Kit No']), money(k['MRP'])
        if p > 0:
            mrp.setdefault(pn, p)
        rem = ['Kit'] + (['Old kit no. ' + clean(k['Old Kit No'])] if clean(k['Old Kit No']) else []) + \
              (['Non current (Hero)'] if clean(k['Category']) == 'NON CURRENT' else []) + (['In diagram ' + clean(k['Diagrams'])] if clean(k['Diagrams']) else [])
        eds = [vk.get(key(label(e))) for e in clean(k['Models']).split(' | ') if e]
        kit_lost += eds.count(None)
        for v in sorted({e for e in eds if e}):
            kit_rows.append(dict(m=vmod[v], v=v, y=0, g='KITS', asm='KITS (NO DIAGRAM)', ref='', pn=pn, desc=clean(k['Kit Name']).upper(), qty='1', rem='; '.join(rem), ns=0))
        if not any(eds):
            kit_rows.append(dict(m=PL_M, v=PL_V, y=0, g='KITS', asm='KITS (NO DIAGRAM)', ref='', pn=pn, desc=clean(k['Kit Name']).upper(), qty='1', rem='; '.join(rem), ns=0))
    # old -> new numbers
    pairs = set()
    for r in o2n:
        a, b = clean(r['Old Part No']), clean(r['New Part No'])
        if a and b and flat(a) != flat(b):
            pairs.add((a, b))
    for r in allp:
        b = clean(r['Part No'])
        for a in re.split(r'[,;|/ ]+', clean(r['Old Part Nos'])):
            if a and flat(a) != flat(b):
                pairs.add((a, b))
        n = clean(r['New Part No'])
        if n and flat(n) != flat(b):
            pairs.add((b, n))
    # one spelling of each number: Hero's dashed one where both are listed (12391-AAH-002 and 12391AAH002)
    dashed = {flat(p): p for p in list(dpn) + [clean(r['Part No']) for r in allp] + [x for pr in pairs for x in pr] if '-' in p}
    pairs = {(dashed.get(flat(a), a), dashed.get(flat(b), b)) for a, b in pairs}
    olds, news = collections.defaultdict(set), collections.defaultdict(set)
    for a, b in pairs:
        olds[b].add(a)
        news[a].add(b)
    svgs = {x['gn']: x['gn'] + '.svg' for x in new if x['gn']}
    allpn = dpn | {x['pn'] for x in pl} | {x['pn'] for x in kit_rows}
    ph = {pn: f for pn, f in photos.items() if pn in allpn and pn not in old['phf']}
    st = dict(new_rows=len(new), new_rows_old_editions=sum(1 for x in new if not x['gn']), new_pn=len({x['pn'] for x in new} - {x[5] for x in old['d']}), price_list=len(pl), kits=len(kits), kit_rows=len(kit_rows),
              kit_editions_not_found=kit_lost, pairs=len(pairs), svgs=len(svgs), photos=len(ph))
    return old, new, pl, kit_rows, mrp, olds, news, svgs, ph, st


def build(folder, zix, out):
    old, new, pl, kit_rows, mrp, olds, news, svgs, ph, st = plan(folder)
    Z = json.load(open(zix))
    o = json.loads(json.dumps(old))
    # editions: the new ones first in their model's list (they are the newest), then the price-list 'edition'
    vl = list(o['vars'])
    for v, m in sorted({(x['v'], x['m']) for x in new if x['gn']}):
        i = next(i for i, u in enumerate(vl) if o['vmod'][u] == m)
        vl.insert(i, v)
        o['vmod'][v] = m
    vl.append(PL_V)
    o['vmod'][PL_V] = PL_M
    o['vmod'] = {v: o['vmod'][v] for v in vl}
    re_ix = {i: vl.index(v) for i, v in enumerate(old['vars'])}
    o['vars'] = vl
    vi = {v: i for i, v in enumerate(vl)}
    for r in o['d']:
        r[11] = sorted(re_ix[k] for k in r[11])
    if PL_M not in o['models']:
        o['models'].append(PL_M)
    pl_nb = len(o['bk'])
    o['bk'].append([1, [], 'Parts from Hero’s MRP price list (Oct 2026) that no diagram has: no diagram'])
    o['src'] = [o['src'][0], "Hero MotoCorp e-catalogue (MRP list, kits, old and new numbers, 18 Oct 2026), Sam's folder Updated Hero Catalogue"]
    asm, desc = {a: i for i, a in enumerate(o['asm'])}, {d: i for i, d in enumerate(o['desc'])}
    at = {}
    for i, r in enumerate(o['d']):
        at.setdefault((r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]), i)
    # each edition's emission book (its lines' most common); both new editions are OBD2 (Hero's own names say so)
    ed_nb = collections.defaultdict(collections.Counter)
    for r in o['d']:
        for k in r[11]:
            ed_nb[vl[k]][r[0]] += 1
    ED_NB = {v: c.most_common(1)[0][0] for v, c in ed_nb.items()}
    ED_NB.update({x['v']: 3 for x in new if x['gn']})
    added = 0
    for x in sorted(new, key=lambda x: (x['v'], nat(x['g']), nat(x['ref']))) + pl + kit_rows:
        nb = pl_nb if x['m'] == PL_M else ED_NB.get(x['v'], 2)
        k =(nb, x['g'], asm.setdefault(x['asm'], len(asm)), x['ref'], x['pn'], desc.setdefault(x['desc'], len(desc)), x['qty'], x.get('rem', ''), x['ns'])
        j = at.get(k)
        if j is None:
            at[k] = len(o['d'])
            o['d'].append([k[0], -1, k[1], k[2], k[3], k[4], k[5], k[6], k[7], k[8], 0, [vi[x['v']]]])
            added += 1
        elif vi[x['v']] not in o['d'][j][11]:
            o['d'][j][11] = sorted(o['d'][j][11] + [vi[x['v']]])
    o['asm'] = [a for a, _ in sorted(asm.items(), key=lambda t: t[1])]
    o['desc'] = [d for d, _ in sorted(desc.items(), key=lambda t: t[1])]
    # old / new numbers on the lines (an 'Old no.' remark is searched: the old number finds the line of the new one)
    nrem = 0
    for r in o['d']:
        add = ['Old no. ' + a for a in sorted(olds.get(r[5], ())) if 'Old no. ' + a not in r[8]] + \
              ['New no. ' + b for b in sorted(news.get(r[5], ())) if 'New no. ' + b not in r[8]]
        if add:
            r[8] = '; '.join([r[8]] + add if r[8] else add)
            nrem += 1
    # MRP: Hero's list wins; a part it does not list keeps the package's
    pns = {r[5] for r in o['d']}
    changed = sum(1 for pn, p in mrp.items() if pn in old['mrp'] and old['mrp'][pn] != p)
    o['mrp'] = dict({pn: p for pn, p in old['mrp'].items() if pn in pns}, **{pn: p for pn, p in mrp.items() if pn in pns})
    # photos the package did not have
    zp = DIR + '/' + ZIP
    if ph:
        if zp not in o['phz']:
            o['phz'].append(zp)
        zi = o['phz'].index(zp)
        for pn, f in ph.items():
            e = Z['entries'].get('Photos/' + f)
            if e:
                o['phf'][pn] = [zi, e[0], e[1], e[2] or 250, e[3] or 250]
    # diagrams of the new editions: the folder's SVGs
    dg = json.load(open(os.path.join(CAT, 'hero-dg.json')))
    dg['p'] = {str(re_ix[int(k)]): v for k, v in dg['p'].items()}
    fi = {u: i for i, u in enumerate(dg['f'])}
    for x in new:
        if not x['gn']:
            continue
        e = Z['entries'].get('Diagrams/' + svgs[x['gn']])
        if not e:
            continue
        u = 'pf:%s:%d:%d' % (zp, e[0], e[1])
        if u not in fi:
            fi[u] = len(dg['f'])
            dg['f'].append(u)
        dg['p'].setdefault(str(vi[x['v']]), {})[x['g']] = fi[u]
    dg['p'] = {k: dg['p'][k] for k in sorted(dg['p'], key=int)}
    if not any(f[0] == ZIP for f in dg['files']):
        dg['files'].append([ZIP, Z['size']])
    dg['pick'] = 'Downloads > Updated Hero Catalogue'
    for n, obj in (('hero.json', o), ('hero-dg.json', dg)):
        with open(os.path.join(out, n), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    st.update(lines_added=added, lines_with_old_new=nrem, mrp_changed=changed, mrp=len(o['mrp']), photos_total=len(o['phf']),
              editions=len(vl), models=len(o['models']), diagrams_new=sum(1 for u in dg['f'] if ZIP in u))
    print(json.dumps(st, indent=1))


if __name__ == '__main__':
    if sys.argv[1] == 'need':
        old, new, pl, kit_rows, mrp, olds, news, svgs, ph, st = plan(sys.argv[2])
        print(json.dumps(st, indent=1))
        json.dump({'svgs': sorted(set(svgs.values())), 'photos': sorted(ph.values())}, open(sys.argv[3], 'w'))
    else:
        build(sys.argv[2], sys.argv[3], sys.argv[4])
