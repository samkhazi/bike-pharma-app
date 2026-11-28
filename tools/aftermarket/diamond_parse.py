#!/usr/bin/env python3
"""24c: Diamond chains (TIDC India "Auto Chain - Price list 2026", w.e.f. 01-05-2026: chain & sprocket kits, drive / cam / silent chains,
gear box sprockets, connecting links) for Find Part's aftermarket list (Sam 2026-11-20).
  python3 diamond_parse.py PRICELIST.pdf OUT.json        (needs pymupdf)
Read by the table's own ruled lines: a row is the band between two horizontal lines, a cell the space between two vertical lines, so a
description printed on two or three lines stays with its own row. MRP only. The list has no original (bike maker's) part numbers.
The connecting link codes (S1, S2 ...) are printed twice: once with the bikes, once with the MRP; both are joined. Codes are short
(K135, A1, G3), so the part number is kept as printed and the search finds it with the word Diamond or the bike. Data: never in git."""
import json, re, sys
import pymupdf

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
hol = lambda h: '' if h in ('-', '') else ' ' + h + (' hole' if h == '1' else ' holes')
MAKERS = {'BAJAJ': 'Bajaj', 'HERO': 'Hero', 'HERO MOTOCORP': 'Hero', 'HONDA': 'Honda', 'TVS': 'TVS', 'YAMAHA': 'Yamaha', 'SUZUKI': 'Suzuki', 'KTM': 'KTM', 'ROYAL ENFIELD': 'Royal Enfield', 'PREMIUM': '',
          'MAHINDRA': 'Mahindra', 'OTHERS': '', 'LML': 'LML', 'KINETIC': 'Kinetic'}


def cells(pg):
    hs, vs = set(), []
    for g in pg.get_drawings():
        for it in g['items']:
            if it[0] == 'l':
                a, b = it[1], it[2]
                if abs(a.y - b.y) < .5 and abs(a.x - b.x) > 100: hs.add(round(a.y, 1))
                if abs(a.x - b.x) < .5 and abs(a.y - b.y) > 5: vs.append((round(a.x, 1), min(a.y, b.y), max(a.y, b.y)))
            elif it[0] == 're':
                r = it[1]
                if r.width > pg.rect.width * .97: continue
                if r.width > 100: hs.add(round(r.y0, 1)); hs.add(round(r.y1, 1))
                if r.height > 5: vs.append((round(r.x0, 1), r.y0, r.y1)); vs.append((round(r.x1, 1), r.y0, r.y1))
    hs = sorted(hs); out = []
    ws = pg.get_text('words')
    for y0, y1 in zip(hs, hs[1:]):
        if y1 - y0 < 4: continue
        w = sorted([x for x in ws if y0 <= (x[1] + x[3]) / 2 < y1], key=lambda x: (round((x[1] + x[3]) / 2 / 3), x[0]))
        hb = max([x[3] for x in w if x[4] in ('Sr.', '(Rs.)')] or [0])       # the heading row has no line under it
        if hb: w = [x for x in w if (x[1] + x[3]) / 2 > hb]
        if not w: continue
        xs = sorted({x for x, a, b in vs if min(b, y1) - max(a, y0) > (y1 - y0) / 2})
        xs = [x for i, x in enumerate(xs) if i == 0 or x - xs[i - 1] > 3]
        cs = [sp(' '.join(t[4] for t in w if xa <= (t[0] + t[2]) / 2 < xb)) for xa, xb in zip(xs, xs[1:])] if len(xs) > 2 else []
        out.append((y0, sp(' '.join(t[4] for t in w)), cs))
    return out


def main(src, out_f):
    doc = pymupdf.open(src); rows, cl, sec, mk, odd, secs, srn = [], {}, '', '', [], [], 0
    for pg in doc:
        for y, txt, cs in cells(pg):
            if re.match(r'^\d+$', txt) or txt.startswith(('PRICE LIST', 'W.E.F', 'NOTES', 'TIDC')): continue
            if cs and re.match(r'^\d+$', cs[0]):
                n = int(cs[0])
                if n != srn + 1 and n != 1: odd.append(f'serial jumps {srn} > {n}: ' + txt)
                srn = n
            if not cs or not re.match(r'^\d+$', cs[0]):
                if txt.startswith('Sr.'): continue
                for part in re.split(r'\s{2,}', txt):
                    part = sp(part)
                    if part.upper() in MAKERS: mk = MAKERS[part.upper()]
                    elif re.match(r'^[A-Za-z &-]{4,40}$', part) and part.upper() == part or part == 'Chain & Sprocket Kit':
                        m2 = next((k for k in MAKERS if part.upper().endswith(' ' + k)), None)      # 'Chain & Sprocket Kit BAJAJ' in one band
                        if m2: mk = MAKERS[m2]; part = sp(part[:-len(m2)])
                        if part != sec: sec = part; secs.append(sec)
                        if 'Sprocket Kit' not in sec: mk = ''
                    else: odd.append('heading? ' + txt)
                continue
            if len(cs) == 10:
                sr, br, code, desc, chain, gt, gh, rt, rh, mrp = cs
                if not re.match(r'^\d+$', mrp): odd.append(txt); continue
                if not gt and not rt:                                        # a cam kit printed in the kit table: no sprocket teeth
                    rows.append({'pn': code, 'nm': sp(f"{desc} · Diamond {br.title()} · chain {chain}"), 'mk': mk, 'veh': desc, 'sec': 'Cam chain kit', 'mrp': int(mrp), 'oem': [], 'fit': desc, 'hay': desc + ' CAM CHAIN KIT TIMING CHAIN KIT'}); continue
                rows.append({'pn': code, 'nm': sp(f"{desc} · Diamond {br.title()} · chain {chain} · gear box sprocket {gt}T{hol(gh)} · rear sprocket {rt}T{hol(rh)}"),
                             'mk': mk, 'veh': desc, 'sec': 'Chain sprocket kit', 'mrp': int(mrp), 'oem': [], 'fit': desc, 'hay': desc + ' CHAIN SPROCKET KIT ' + br})
            elif len(cs) == 6 and re.match(r'^\d+$', cs[5]):                 # cam sets: what is in the set is printed in its own cell
                sr, br, code, desc, has, mrp = cs
                rows.append({'pn': code, 'nm': sp(f"{desc} · Diamond {br.title()} · {has}"), 'mk': mk, 'veh': desc, 'sec': 'Cam chain kit', 'mrp': int(mrp), 'oem': [], 'fit': desc, 'hay': desc + ' CAM CHAIN KIT TIMING CHAIN KIT ' + has})
            elif len(cs) in (4, 5):
                code, mrp = cs[1], cs[-1]; br = cs[2] if len(cs) == 5 else ''
                if len(cs) == 5 and mrp == '-': mrp = '0'                    # no price printed
                desc = cs[-2] if re.match(r'^\d+$', mrp) else cs[-1]
                if not re.match(r'^\d+$', mrp):
                    if 'CONNECTING' in sec.upper(): cl[code] = (cs[3], cs[2]) if len(cs) == 5 else (desc, cs[2]); continue
                    odd.append(txt); continue
                S = sec.upper(); kind = 'Connecting link' if 'CONNECTING' in S or desc.startswith('CRD') else 'Cam chain' if 'CAM' in S else 'Silent chain' if 'SILENT' in S else 'Gear box sprocket' if 'SPROCKET' in S else 'Drive chain'
                rows.append({'pn': code, 'nm': desc + (' · ' + br.title() if br and br not in ('-', 'DIAMOND') else ''), 'mk': '', 'veh': '', 'sec': kind, 'mrp': int(mrp), 'oem': [], 'fit': '', 'hay': desc + ' ' + kind.upper()})
            else: odd.append(f'{len(cs)} cells: ' + txt)
    for r in rows:                                                   # the connecting link's bikes, from its other table
        k = re.sub(r'\(.*', '', r['pn'])
        if r['sec'] == 'Connecting link' and k in cl:
            r['fit'] = r['veh'] = cl[k][0]; r['hay'] += ' ' + cl[k][0]
            if cl[k][1] not in ('-', '', 'DIAMOND'): r['nm'] += ' · ' + cl[k][1].title()
    seen = {}
    for r in rows:                                                   # a code printed for two things keeps both: the second says what it is
        if r['pn'] in seen: r['pn'] = f"{r['pn']} ({r['sec']})"
        seen[r['pn']] = 1
    json.dump({'brand': 'Diamond', 'src': 'TIDC India Diamond Auto Chain price list 2026 (w.e.f. 01-05-2026)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print(len(rows), 'parts', dict(Counter(r['sec'] for r in rows)), dict(Counter(r['mk'] for r in rows)), 'sections', secs, 'cl bikes', len(cl))
    print('not read:', len(odd)); [print('  ', o) for o in odd[:60]]


if __name__ == '__main__': main(*sys.argv[1:3])
