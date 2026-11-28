#!/usr/bin/env python3
"""24j: Lumax "2W Blinker Catalogue CTC" (blinkers, stays, lenses with MRP, 16 pages) added to the Lumax list (Sam 2026-11-21).
  python3 lumax_blinker.py OCR300.json OUT.json OLD_lumax.json OCR240.json OCR380.json [-v]
A picture book like the lighting catalogue (letters are drawings): OCR*.json = its pages read by OCR (rapidocr) at three sizes, boxes
[x0,y0,x1,y1,text,conf] per page. A card = bike name, "216-BLA-GFI-UNI" or "BLINKER - no." + "STAY - no.", the picture, a description and
"MRP Rs.141" (or "BLINKER : Rs.142 / STAY : Rs.42"). A part number and an MRP are taken only when two of the three readings agree;
an MRP they do not agree on is left empty. The book prints \\ for / in numbers (FL\\FR = FL/FR as in the lighting list).
3-wheeler cards (auto rickshaw, RE Compact, King, Ape, Alfa) are left out. A part already in OLD keeps its name and gets the MRP."""
import json, re, sys
from collections import Counter

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
CODE = re.compile(r'^(?:(?:BLINKER|STAY|LENS)\s*[-:]\s*)?[\dO]{3,4}\s*-\s*B[LI1][ASL]\b')
MAKERS = {'HRO': 'Hero', 'BJJ': 'Bajaj', 'HNDA': 'Honda', 'TVS': 'TVS', 'YMH': 'Yamaha', 'YMHA': 'Yamaha', 'ENFLD': 'Royal Enfield', 'PIAGO': 'Piaggio', 'MHNDR': 'Mahindra', 'UNVRSL': '', 'UNVRSL LED': ''}
SKIP = re.compile(r'^(LUMAX|BLINKERS?|DK JAIN|GROUP|NEW|IMG|COMING SOON|HOT SELLING|MRP|\d{1,2}|[<>◄►]+)$')
PRICE = re.compile(r'^(?:(BLINKER|STAY|LENS)\s*[:\-]\s*)?[^\dA-Z]{0,2}[A-Z]?\.\s*([\d,]{2,6})$')
W = {'GLMR': 'GLAMOUR', 'HNK': 'HUNK', 'ISMRT': 'ISMART', 'MSTRO': 'MAESTRO', 'PSN': 'PASSION', 'PSSN': 'PASSION', 'PLS': 'PLUS', 'SPLNDR': 'SPLENDOR', 'SPLDR': 'SPLENDOR', 'XPRO': 'X PRO', 'DSTNI': 'DESTINI', 'DUT': 'DUET', 'DLX': 'DELUXE',
     'AVNGR': 'AVENGER', 'CLBR': 'CALIBER', 'DSCVR': 'DISCOVER', 'PLTN': 'PLATINA', 'PLSR': 'PULSAR', 'VKRNT': 'VIKRANT', 'ACTV': 'ACTIVA', 'STNR': 'STUNNER', 'AVTR': 'AVIATOR', 'DRM': 'DREAM', 'TWSTR': 'TWISTER', 'APCH': 'APACHE',
     'JPTR': 'JUPITER', 'RDEON': 'RADEON', 'STR': 'STAR', 'CTY': 'CITY', 'SPR': 'SUPER', 'BLLT': 'BULLET', 'UNVRSL': 'UNIVERSAL', 'CLR': 'CLEAR', 'AMBR': 'AMBER', 'WT': 'WITH', 'ASSY': 'ASSEMBLY', 'CFR': 'CARBON FIBRE'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))
TW = re.compile(r'RKSHW|RICKSHAW|RE CMPCT|COMPACT|\bKN?I?NG\b|\bAPE\b|ALPHA|\bALFA\b|3 ?W\b|3 WHEELER')
SIDE = r'(?:FLB|FRB|RLB|RRB|FL|FR|RL|RR|LH|RH|L|R)'


def fixpn(c):                                              # as printed: only the \\ (read as I) between two sides becomes /, nothing is added
    c = re.sub(r'\s*([-/])\s*', r'\1', sp(c).replace('\\', '/')).rstrip('.,-')
    c = re.sub(r'^[\dO]{3}', lambda m: m.group(0).replace('O', '0'), c)
    return re.sub(r'(%s)[I|](?=%s)' % (SIDE, SIDE), r'\1/', c)


def txt(t):                                                # names: O for 0 beside a digit, I for the \\ the book prints between sides
    t = sp(t).replace('\\', '/'); t = re.sub(r'\bCDOO\b', 'CD100', t)
    t = re.sub(r'(?<=\d)O+|O(?=\d)', lambda m: '0' * len(m.group(0)), t)
    D = r'(?:FRONT|FRNT|REAR|LEFT|RIGHT|LH|RH|FL|FR|RL|RR)'
    return re.sub(r'(%s)I(?=%s)' % (D, D), r'\1/', t)


def cards(pages, scale):
    """one reading -> [(page, x-middle, y of the number, maker, bike, [(label, part no.)], description, {label: mrp})]"""
    out = []; mk = None
    for pi, boxes in enumerate(pages):
        bx = [[b[0] * scale, b[1] * scale, b[2] * scale, b[3] * scale, sp(b[4])] for b in boxes]
        if not any(CODE.search(b[4]) for b in bx): continue
        heads = sorted((b[1], MAKERS[b[4]]) for b in bx if b[4] in MAKERS and 900 < (b[0] + b[2]) / 2 < 1600 and not any(abs(o[1] - b[1]) < 20 and o is not b for o in bx))
        for c in range(3):
            cur = None
            col = sorted([b for b in bx if min(2, int(((b[0] + b[2]) / 2) / 827)) == c and not SKIP.match(b[4]) and not (b[4] in MAKERS and any(h[0] == b[1] for h in heads))], key=lambda b: b[1])
            for b in col:
                t = b[4]; pm = PRICE.match(t)
                if cur and cur['py'] is not None and (not pm or b[1] - cur['py'] > 90): out.append(cur); cur = None
                if cur is None: cur = {'pg': pi, 'x': 0, 'y': None, 'top': b[1], 'title': [], 'pn': [], 'desc': [], 'mrp': {}, 'py': None}
                if pm and cur['pn']:
                    cur['mrp'][pm.group(1) or ''] = int(pm.group(2).replace(',', ''))
                    if cur['py'] is None: cur['py'] = b[1]
                elif CODE.search(t) and not cur['desc']:
                    m = re.match(r'^(BLINKER|STAY|LENS)\s*[-:]\s*(.+)$', t)
                    cur['pn'].append([m.group(1) if m else '', m.group(2) if m else t, b[1]]); cur['y'] = cur['y'] or b[1]; cur['x'] = (b[0] + b[2]) / 2
                elif cur['pn'] and not cur['desc'] and b[1] - cur['pn'][-1][2] < 75 and re.match(r'^[-/\\]?%s([-/I\\]%s)*$' % (SIDE, SIDE), t): cur['pn'][-1][1] += ('' if cur['pn'][-1][1].endswith('-') else '-') + t
                elif cur['pn']: cur['desc'].append(t)
                else: cur['title'].append(t)
            if cur and cur['pn']: out.append(cur)
        for cd in out:
            if cd['pg'] == pi and 'mk' not in cd:
                h = [m for y, m in heads if y < cd['top']]
                if h: mk = h[-1]
                cd['mk'] = mk
        mk = heads[-1][1] if heads else mk
    return [c for c in out if c['pn']]


def main(src, out_f, old_f, *others, v=False):
    old = json.load(open(old_f)); have = {r['pn']: r for r in old['rows']}
    reads = []
    main_w = max(b[2] for p in json.load(open(src)) for b in p)
    for f in (src,) + others:
        pages = json.load(open(f)); reads.append(cards(pages, main_w / max(b[2] for p in pages for b in p)))
    rows, odd, n3 = [], [], 0
    for cd in reads[0]:
        same = [cd] + [min((o for o in r if o['pg'] == cd['pg'] and abs(o['x'] - cd['x']) < 300), key=lambda o: abs(o['y'] - cd['y']), default=None) for r in reads[1:]]
        same = [o for o in same if o and abs(o['y'] - cd['y']) < 80]
        bike = Counter(txt(' '.join(o['title'])) for o in same).most_common(1)[0][0]; desc = Counter(txt(' '.join(o['desc'])) for o in same).most_common(1)[0][0]
        if TW.search((bike + ' ' + desc).upper()): n3 += len(cd['pn']); continue
        for i, (lab, pn, y) in enumerate(cd['pn']):
            votes = Counter(fixpn(o['pn'][i][1]) for o in same if len(o['pn']) > i)
            p, n = votes.most_common(1)[0]
            if n < 2 and len(reads) > 1: odd.append('page %d: the readings differ on a part number, left out: %s' % (cd['pg'] + 1, dict(votes))); continue
            pv = Counter(o['mrp'].get(lab, o['mrp'].get('') if len(cd['pn']) == 1 or not any(l for l, _, _ in cd['pn']) else None) for o in same)
            mrp, n = pv.most_common(1)[0]
            if mrp is None or (n < 2 and len(reads) > 1): odd.append('page %d: %s MRP not sure %s, left without MRP' % (cd['pg'] + 1, p, dict(pv))); mrp = 0
            rows.append((p, lab, cd['mk'] or '', bike, desc, mrp or 0))
    out = list(old['rows']); n_new = n_mrp = 0; seen = set()
    for pn, lab, mk, bike, desc, mrp in rows:
        if pn in seen: odd.append('twice in the book: ' + pn)
        seen.add(pn)
        if pn in have:
            if mrp > (have[pn].get('mrp') or 0): have[pn]['mrp'] = mrp; n_mrp += 1
            continue
        k = {'STAY': 'Blinker stay', 'LENS': 'Blinker lens'}.get(lab, 'Blinker stay' if '-BLS-' in pn else 'Blinker lens' if '-BLL-' in pn else 'Blinker')   # the names the Uno Minda list uses: found by blinker and by indicator
        r = {'pn': pn, 'nm': desc or 'Blinker', 'mk': mk, 'veh': bike, 'sec': k, 'mrp': mrp, 'oem': [], 'fit': full(bike), 'hay': sp(('BLINKER ' + k).upper() + ' ' + full(bike + ' ' + desc))}
        have[pn] = r; out.append(r); n_new += 1
    old['rows'] = out; old['src'] = sp(old.get('src', '')) + ' + 2W Blinker Catalogue (MRP)'
    json.dump(old, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts in the blinker catalogue:', n_new, 'new,', n_mrp, 'already there got their MRP;', sum(1 for r in rows if r[5]), 'with MRP;', n3, '3-wheeler parts left out;', len(out), 'in all,', sum(1 for r in out if r.get('mrp')), 'with MRP')
    for o in odd: print('  ', o)
    if v:
        for r in rows: print(' | '.join(str(x) for x in r))


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if x != '-v']; main(*a, v='-v' in sys.argv)
