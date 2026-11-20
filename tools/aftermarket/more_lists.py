#!/usr/bin/env python3
"""24d: Makino, FCC, Goetze, AR for Find Part's aftermarket list as files of their own (Sam 2026-11-20 "eh sabhi bhi add karna").
  python3 more_lists.py DIR OUTDIR     DIR holds `pdftotext -layout` texts: makino.txt (Makino price list Aug 2026), newpl.txt (FCC Clutch
  India price list), biwpiston.txt + cylkit.txt (Goetze pistons / block kits), arlist.txt (AR alloy wheels, fuel pumps ... w.e.f. 15.08.2026)
MRP only: Makino prints MRP and LIST PRICE (the MRP column is taken), FCC prints MRP. Goetze ("New List") and AR ("LIST PRICE"): Sam said on 2026-11-20 these are the MRP. Before that note: they print a
list price, not an MRP: those parts are added WITHOUT a price until Sam says the list price is the MRP. Three-wheeler lines are left out.
AR prints the bike maker's own number in [ ] for some parts: kept as the original number. Data: never in git."""
import json, os, re, sys
from collections import Counter

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
lines = lambda f: [l.rstrip() for l in open(f, errors='replace').read().replace('\f', '\n').split('\n') if l.strip()]
MKW = {'HRO': 'Hero', 'HERO': 'Hero', 'BAJ': 'Bajaj', 'BAJAJ': 'Bajaj', 'HNDA': 'Honda', 'HONDA': 'Honda', 'TV': 'TVS', 'TVS': 'TVS', 'SZKI': 'Suzuki', 'SUZUKI': 'Suzuki', 'YMH': 'Yamaha', 'YAMAHA': 'Yamaha', 'YAM': 'Yamaha',
       'RE': 'Royal Enfield', 'ROYAL': 'Royal Enfield', 'KTM': 'KTM', 'MAHINDRA': 'Mahindra', 'LML': 'LML', 'KINETIC': 'Kinetic', 'PIAGGIO': 'Piaggio', 'VESPA': 'Vespa', 'JAWA': 'Jawa'}
W = {'PLEASRE': 'PLEASURE', 'MSTERO': 'MAESTRO', 'ACTIV': 'ACTIVA', 'AVITR': 'AVIATOR', 'JUPTR': 'JUPITER', 'WGO': 'WEGO', 'SCOTY': 'SCOOTY', 'ACESS': 'ACCESS', 'PLSR': 'PULSAR', 'DSCVR': 'DISCOVER', 'PLTN': 'PLATINA', 'PLTNA': 'PLATINA',
     'PLATIN': 'PLATINA', 'CLBR': 'CALIBER', 'SPLDR': 'SPLENDOR', 'GLMR': 'GLAMOUR', 'PASION': 'PASSION', 'ACHEVER': 'ACHIEVER', 'HNK': 'HUNK', 'IMPLSE': 'IMPULSE', 'AVE': 'AVENGER', 'AVANGER': 'AVENGER', 'DUK': 'DUKE', 'SP': 'SUPER'}
full = lambda s: sp(re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))
W3 = re.compile(r'\b3 ?W\b|3 ?WHEELER|\bKING\b|\bAPE\b|AUTO ?RICKSHAW|\bRE ?(2S|4S|COMPACT|205|145)\b|COMPACT', re.I)
mk_of = lambda s: next((MKW[w] for w in re.findall(r'[A-Z]+', s.upper())[:2] if w in MKW), '')


def makino(f):
    R = re.compile(r'^\s*(.*?)\s*(\d{3}-[0-9A-Z]{8,})\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s*$'); rows, odd, seen, sec = [], [], set(), ''
    L = lines(f); subs = sorted({re.split(r'\s{2,}', R.match(l).group(1).strip())[0] for l in L if R.match(l) and len(re.split(r'\s{2,}', R.match(l).group(1).strip())) > 1}, key=len, reverse=True)
    for l in L:
        m = R.match(l)
        if not m:
            if re.match(r'^\s*[A-Z][A-Z &()]+$', l): sec = sp(l)
            elif not re.search(r'PRICE LIST|Sub Category', l): odd.append(sp(l))
            continue
        pre = m.group(1).strip(); p = re.split(r'\s{2,}', pre, maxsplit=1)
        if len(p) < 2: s = next((x for x in subs if pre.startswith(x + ' ')), ''); p = [s, pre[len(s):].strip()] if s else ['', pre]
        mrp, lp = int(m.group(4).replace(',', '')), int(m.group(5).replace(',', ''))
        if mrp < lp: odd.append('MRP below list price: ' + sp(l)); continue
        if W3.search(p[1]) or m.group(2) in seen: continue
        seen.add(m.group(2)); kind = sp(re.sub(r'\b(Cca|Ica)\b', '', p[0])) or sec.capitalize()
        rows.append({'pn': m.group(2), 'nm': sp(p[0] + ' · ' + p[1]) if p[0] else p[1], 'mk': mk_of(p[1]), 'veh': p[1], 'sec': kind, 'mrp': mrp, 'oem': [], 'fit': '', 'hay': full(p[0] + ' ' + p[1])})
    return 'Makino', 'Makino price list Aug 2026', rows, odd


def fcc(f):
    R = re.compile(r'^\s*(?:(\d+)\s+)?([A-Z]+(?: [A-Z]+)?)\s+(\S.*?)\s+(FCC-\S+(?: \S+)?-ORG\S*|FCC-\S+)\s+([\d,]+)\s*$'); rows, odd, seen, sec = [], [], set(), ''
    for l in lines(f):
        m = R.match(l)
        if not m:
            if re.match(r'^\s*[A-Z][A-Z .&()]+$', l) and not re.search(r'PRICE|FCC|LTD', l): sec = sp(l).rstrip('.')
            elif not re.search(r'PRICE LIST|FCC CLUTCH|Plot No|S\.No', l): odd.append(sp(l))
            continue
        mk, md, pn, mrp = sp(m.group(2)), sp(m.group(3)), sp(m.group(4)), int(m.group(5).replace(',', ''))
        if W3.search(md + ' ' + pn) or pn in seen: continue
        seen.add(pn)
        rows.append({'pn': pn, 'nm': sp(sec.capitalize() + ' · ' + md), 'mk': MKW.get(mk.split(' ')[0], ''), 'veh': md, 'sec': sec.capitalize() or 'Clutch', 'mrp': mrp, 'oem': [], 'fit': md, 'hay': full(sec + ' ' + mk + ' ' + md)})
    return 'FCC', 'FCC Clutch India price list', rows, odd


def goetze(fs):
    R = re.compile(r'^\s*(?:([A-Z][A-Z .&-]*?)\s+)?(\d{5}[A-Z0-9+]{2,}\S*)\s+(\S.*?)\s*?([\d,]+\.\d\d)\s*$'); rows, odd, seen = [], [], set()
    for f, kind in fs:
        mk = ''
        for l in lines(f):
            m = R.match(l)
            if not m:
                if not re.search(r'Goetze Price List|Row Labels|Grand Total', l): odd.append(sp(l))
                continue
            if m.group(1): mk = sp(m.group(1))
            d = sp(m.group(3))
            if W3.search(d) or re.search(r'3W|3 WH', mk) or m.group(2) in seen: continue
            seen.add(m.group(2))
            rows.append({'pn': m.group(2), 'nm': sp(kind + ' · ' + d), 'mk': MKW.get(mk.split(' ')[0], '') or mk_of(d), 'veh': d, 'sec': kind, 'mrp': int(round(float(m.group(4).replace(',', '')))), 'oem': [], 'fit': '', 'hay': full(kind + ' ' + mk + ' ' + d + (' CYLINDER KIT BLOCK KIT BORE KIT' if kind != 'Piston' else ' PISTON KIT'))})
    return 'Goetze', 'Goetze price lists pistons + block kits (the New List price is the MRP: Sam 2026-11-20)', rows, odd


def ar(f):
    """alloy wheels from the text (one table); the other pages are two tables side by side, read from the PDF by word positions:
    a part = its code, the words of its own column down to the next code or heading, and the price printed in that band"""
    import pymupdf
    L = lines(f); rows, odd, seen, sec, cont = [], [], set(), '', None
    RW = re.compile(r'^\s*(ARW-\d{4}[A-Z]?(?: [A-Z]{1,3})?)\s+(\S.*?)\s{2,}(\S.*?)\s+(\d{3,5})\s+(\d{1,2})\s*$')
    for l in L:
        m = RW.match(l); t = sp(l)
        if m:
            d, spec = sp(m.group(2)), sp(m.group(3)); cont = None
            if m.group(1) not in seen and not W3.search(d):
                seen.add(m.group(1)); cont = {'pn': m.group(1), 'nm': sp('Alloy wheel · ' + d + ' · ' + spec), 'mk': mk_of(d), 'veh': d, 'sec': 'Alloy wheel', 'mrp': int(m.group(4)), 'oem': [], 'fit': d, 'hay': full('ALLOY WHEEL MAG WHEEL ' + d + ' ' + spec)}
                rows.append(cont)
        elif t.startswith('ARW-'): odd.append(t)
        elif 'ALLOY WHEEL FOR' in t: sec = t; cont = None
        elif cont and len(l) - len(l.lstrip()) > 8 and not re.search(r'\d{4}|AR-|PRICE|LIST', t) and len(t) < 60:
            cont['nm'] = cont['nm'].replace(cont['veh'], cont['veh'] + ' ' + t, 1); cont['veh'] += ' ' + t; cont['fit'] = cont['veh']; cont['hay'] += ' ' + full(t); cont = None
        else: cont = None
    CODE = re.compile(r'^AR-\d{3,4}[A-Z]?$'); PRICE = re.compile(r'^\d{2,5}\.\d\d$')
    for pg in pymupdf.open(os.path.splitext(f)[0] + '.pdf'):
        ws = pg.get_text('words')
        if not any(CODE.match(w[4]) for w in ws): continue
        hc = sorted(w[0] for w in ws if w[4] == 'Code'); split = (hc[1] - 12) if len(hc) > 1 else 1e9
        hy = min([w[1] for w in ws if w[4] == 'Code'] or [0]); top = sorted([w for w in ws if w[3] < hy and re.match(r'^[A-Z]+$', w[4])], key=lambda w: (w[1], w[0]))
        psec = sp(' '.join(w[4] for w in top if abs(w[1] - top[0][1]) < 4)) if top else ''                     # the page's own title (FUEL PUMP, PETROL TAP)
        if re.search(r'AUTO|PRICE|LIST', psec): psec = ''
        carry = psec
        for col in (0, 1):
            cw = sorted([w for w in ws if (w[0] >= split) == bool(col)], key=lambda w: ((w[1] + w[3]) / 2, w[0])); ln = []
            for w in cw:
                if ln and abs((w[1] + w[3]) / 2 - (ln[-1][0][1] + ln[-1][0][3]) / 2) < 3.5: ln[-1].append(w)
                else: ln.append([w])
            sec, cur = carry, None
            def close(c):
                if not c: return
                pr = [x for x in c['w'] if PRICE.match(x)]; d = sp(' '.join(x for x in c['w'] if not PRICE.match(x)))
                if len(pr) != 1 or not d: odd.append(f"{c['pn']} {' '.join(c['w'])}"); return
                oem = [sp(o) for o in re.findall(r'\[([^\]]+)\]', d) if re.search(r'\d{3}', o)]; nm = sp(re.sub(r'\[[^\]]*\]', '', d))
                if c['pn'] in seen or W3.search(nm): return
                seen.add(c['pn']); kind = c['sec'].capitalize()
                rows.append({'pn': c['pn'], 'nm': nm if not kind or kind.lower()[:8] in nm.lower() else kind + ' · ' + nm, 'mk': mk_of(nm), 'veh': nm, 'sec': kind or 'Part', 'mrp': int(round(float(pr[0]))), 'oem': oem, 'fit': '', 'hay': full(c['sec'] + ' ' + nm)})
            for l in ln:
                l.sort(key=lambda w: w[0]); t = sp(' '.join(w[4] for w in l))
                t = sp(re.sub(r'\(HSN[^)]*\)?', '', t)) or t
                if CODE.match(l[0][4]): close(cur); cur = {'pn': l[0][4], 'sec': sec, 'w': [w[4] for w in l[1:]]}; continue
                if l[0][3] < hy + 14 or re.search(r'PRICE|AUTO PARTS|SCOOTER &|^Code|^No\.|W\.E\.F|HSN NO|^LIST$|Manufactured|A\.R\. Spares|New Delhi|Rohtak|^\d+$', t): close(cur); cur = None; continue
                if re.match(r'^[A-Z0-9][A-Z0-9 .&/()-]{3,60}$', t) and not PRICE.search(t) and not (cur and not any(PRICE.match(x) for x in cur['w'])):
                    close(cur); cur = None
                    if not re.search(r'MOTOR ?CYCLE|MOTER CYCLE|MOPED|SCOOT[EO]R|WHEELER', t): sec = sp(re.sub(r'\(HSN.*', '', t))        # MOPED / SCOOTER lines only say the kind of vehicle
                    continue
                if cur: cur['w'] += [w[4] for w in l]
            close(cur); carry = sec
    return 'AR', 'AR Auto Parts price list w.e.f. 15.08.2026 (its LIST price is the MRP: Sam 2026-11-20)', rows, odd


if __name__ == '__main__':
    D, O = sys.argv[1:3]
    for name, fn in (('makino', lambda: makino(D + '/makino.txt')), ('fcc', lambda: fcc(D + '/newpl.txt')), ('goetze', lambda: goetze([(D + '/biwpiston.txt', 'Piston'), (D + '/cylkit.txt', 'Cylinder block kit')])), ('ar', lambda: ar(D + '/arlist.txt'))):
        b, src, rows, odd = fn()
        json.dump({'brand': b, 'src': src, 'rows': rows}, open(os.path.join(O, name + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
        print('==', b, len(rows), 'parts', dict(Counter(r['sec'] for r in rows).most_common(14)), '| makers', dict(Counter(r['mk'] for r in rows)), '| with OEM', sum(1 for r in rows if r['oem']))
        print('   not read:', len(odd), odd[:14])
