"""MK Auto (VB group) product range, 1 Jan 2026 (the list on mkautoindia.com/catalogue, printed WITHOUT MRP).
python3 mk_parse.py BBOX.html OUT.json     (BBOX.html = `pdftotext -bbox` of Product_Range_Whitout_MRP_compressed.pdf)
Two wheeler pages only (3 wheeler pages left out; the '2 & 3 wheeler' rubber pages are kept). No MRP in the list: mrp 0.
Pack sizes are not taken. The out file is data: never in git."""
import sys, re, json, html

MAKERS = ['ROYAL ENFIELD', 'HERO MAJESTIC', 'HERO', 'YAMAHA', 'HONDA', 'BAJAJ', 'TVS', 'SUZUKI', 'MAHINDRA', 'UM GLOBAL', 'LML', 'KINETIC', 'RAJDOOT', 'JAWA', 'PIAGGIO', 'VESPA',
          'SCOOTERS INDIA', 'SCOOTER INDIA', 'ATUL AUTO', 'ATUL', 'API', 'KTM', 'ESCORTS', 'IDEAL JAWA', 'ENFIELD']
NICE = {'TVS': 'TVS', 'LML': 'LML', 'KTM': 'KTM', 'API': 'API', 'UM GLOBAL': 'UM Global', 'SCOOTER INDIA': 'Scooters India', 'ENFIELD': 'Royal Enfield', 'HERO MAJESTIC': 'Hero'}
KIND = [(r'\bRUB\.', 'RUBBER'), (r'\bCLUT\.', 'CLUTCH'), (r'\bLEV\.', 'LEVER'), (r'\bPAP\.', 'PAPER'), (r'\bASSY\.?', 'ASSEMBLY'), (r'\bHOU\.', 'HOUSING'), (r'\bREP\.', 'REPAIR'),
        (r'\bBRK\.', 'BRAKE'), (r'\bCENT\.', 'CENTRE'), (r'\bPRES\.', 'PRESSURE'), (r'\bPLT\.', 'PLATE')]
SEC = {'CLUTCH PLATES': 'Clutch plate', 'PRESSURE PLATES': 'Pressure plate', 'CLUTCH COMBO': 'Clutch combo', 'BRAKE SHOES': 'Brake shoe', 'DISC PADS': 'Disc pad',
       'NON-ASBESTOS BRAKE SHOES WITH SPRING': 'Brake shoe', 'CLUTCH HOUSINGS': 'Clutch housing', 'CLUTCH HUB': 'Clutch hub', 'CLUTCH CENTRES': 'Clutch center',
       'HUB CENTRE COMBO': 'Hub centre combo', 'INNER ASSEMBLIES (RUBBER)': 'Clutch inner assembly (rubber)', 'INNER ASSEMBLIES (PAPER)': 'Clutch inner assembly (paper)',
       'CLUTCH SHOES': 'Clutch shoe', 'PREMIUM PAPER CLUTCH PLATES': 'Clutch plate (premium paper)', 'CENTRIFUGAL CLUTCH ASSEMBLIES': 'Centrifugal clutch assembly',
       'CLUTCH VARIATOR': 'Clutch variator', 'LEVER & YOKES': 'Lever & yoke', 'RUBBER COMPONENTS': 'Rubber part', 'BRAKE LINNINGS': 'Brake lining',
       'CLUTCH COMPONENT & ASSEMBLIES': 'Clutch part'}
sp = lambda s: re.sub(r'\s+', ' ', s).strip()
def nice(m): return NICE.get(m, m.title())
def maker(text, head):
    u = ' ' + text.upper() + ' '
    for m in MAKERS:
        if re.search(r'(?<![A-Z])' + re.escape(m) + r'(?![A-Z])', u[:len(m) + 3]): return nice(m)
    return nice(head) if head in MAKERS else ''
def kind(s):
    for a, b in KIND: s = re.sub(a, b, s)
    return sp(s.replace('- ', '')).title()

def lines(ws):
    out = []
    for w in sorted(ws, key=lambda w: (w[1], w[0])):
        if out and abs(out[-1][0] - w[1]) < 3: out[-1][1].append(w)
        else: out.append([w[1], [w]])
    return [(y, sorted(l)) for y, l in out]

def main(src, dst):
    pages = open(src, encoding='utf-8').read().split('<page ')[1:]
    rows, seen, skipped = [], {}, 0
    for pg in pages:
        ws = [(float(a), float(b), float(c), html.unescape(w)) for a, b, c, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)</word>', pg)]
        top = sp(' '.join(w[3] for w in sorted(ws, key=lambda w: (round(w[1]), w[0])) if w[1] < 60))
        if 'WHEELER' not in top: continue
        title = sp(' '.join(w[3] for y, l in lines([w for w in ws if 66 < w[1] < 86 and 80 < w[0] < 300]) for w in l))
        two = top.startswith('2 ')
        if not two: skipped += 1; continue
        veh_page = any(w[3] == 'DESC.' and w[1] < 106 for w in ws)
        body = [w for w in ws if w[1] > 106]
        nums = [w for w in body if w[0] < 62 and re.fullmatch(r'[A-Z]{0,3}-?\d{3,7}[A-Z]?', w[3])]
        hsn = {round(w[1]) for w in body if w[0] > 285 and re.fullmatch(r'\d{8}', w[3])}
        nums = [n for n in nums if any(abs(n[1] - h) < 4 for h in hsn)]
        xmax = 240 if veh_page else 288
        tl = lines([w for w in body if 62 <= w[0] < xmax])
        kl = [w for w in body if xmax <= w[0] < 288] if veh_page else []
        # clusters of description lines (rows) and centred headings
        items = []   # ('row', ys, text) / ('head', y, text)
        for y, l in tl:
            text = sp(' '.join(w[3] for w in l))
            if l[0][0] > 76:
                if re.fullmatch(r'\d{1,2}', text) or 'TERMS' in text: continue
                items.append(['head', [y], text]); continue
            if items and items[-1][0] == 'row' and y - items[-1][1][-1] < 11.6: items[-1][1].append(y); items[-1][2] += ' ' + text; items[-1][3].append(text)
            else: items.append(['row', [y], text, [text]])
        # two tight rows read as one: split the lines so each part sits in the middle of its own lines
        def split(ys, ns):
            if len(ns) == 1: return 0, [ys]
            best = None
            for i in range(1, len(ys) - len(ns) + 2):
                e, rest = split(ys[i:], ns[1:])
                e += abs(sum(ys[:i]) / i - ns[0])
                if best is None or e < best[0]: best = (e, [ys[:i]] + rest)
            return best
        out = []
        for it in items:
            ns = sorted(n[1] for n in nums if it[0] == 'row' and it[1][0] - 6 <= n[1] <= it[1][-1] + 6)
            if len(ns) < 2 or len(ns) > len(it[1]): out.append(it); continue
            texts = it[3]; i = 0
            for g in split(it[1], ns)[1]: out.append(['row', g, ' '.join(texts[i:i + len(g)]), texts[i:i + len(g)]]); i += len(g)
        items = out
        head = ''
        rowsp = [it for it in items if it[0] == 'row']
        for it in items:
            if it[0] == 'head': head = it[2].upper(); continue
            c = (it[1][0] + it[1][-1]) / 2
            cand = [n for n in nums if it[1][0] - 6 <= n[1] <= it[1][-1] + 6]
            if not cand: continue
            n = min(cand, key=lambda n: abs(n[1] - c))
            lo = max([r[1][-1] for r in rowsp if r[1][-1] < it[1][0]] + [0]); hi = min([r[1][0] for r in rowsp if r[1][0] > it[1][-1]] + [9999])
            kd = kind(' '.join(w[3] for w in sorted([w for w in kl if (lo + it[1][0]) / 2 < w[1] < (hi + it[1][-1]) / 2], key=lambda w: (round(w[1] / 4), w[0]))))
            sec = SEC.get(title, title.title())
            desc = sp(it[2])
            mk = maker(desc, head)
            sub = '' if head in MAKERS or not head else head.title()
            part = kd or sub
            nm = (part + ' · ' if part and part.lower() not in desc.lower() else '') + desc
            pn = n[3]
            if pn in seen: continue
            seen[pn] = 1
            rows.append({'pn': pn, 'nm': nm, 'mk': mk, 'veh': '', 'sec': sec, 'mrp': 0, 'oem': [], 'fit': '', 'hay': desc})
    json.dump({'brand': 'MK Auto', 'src': 'MK Auto (VB group) product range 1 Jan 2026, no MRP', 'rows': rows}, open(dst, 'w'), ensure_ascii=False)
    from collections import Counter
    print(len(rows), 'parts |', skipped, '3 wheeler pages left out')
    print(Counter(r['sec'] for r in rows).most_common())
    print('no maker', sum(1 for r in rows if not r['mk']))

if __name__ == '__main__': main(*sys.argv[1:3])
