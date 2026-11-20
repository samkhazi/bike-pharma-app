#!/usr/bin/env python3
"""Spaco product catalogue (a picture PDF) -> spaco.json for Find Part.
usage: spaco_parse.py OCR1.json OCR2.json OUT.json [-v]
OCR1 = every page, OCR2 = a second reading of pages 8..39 (rapidocr on pdftoppm PNGs, two sizes).
A part goes in only when BOTH readings give the same number; the catalogue prints no MRP.
Carburettors (REG.NO. 'P 9900' + bike), spark plugs, injectors, TPS / O2 / temperature sensors.
3-wheeler, agro and 'coming soon' pages are left out."""
import sys, json, re

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
MAKER = [('TVSM', 'TVS'), ('HIRO', 'Hero'), ('HOND', 'Honda'), ('BAJ', 'Bajaj'), ('YMHA', 'Yamaha'), ('SUZKI', 'Suzuki'), ('RYALENFLD', 'Royal Enfield'), ('KINETIC', 'Kinetic'), ('LML', 'LML')]
SKIPPG = re.compile(r'THREE ?WHEELER|AGRO|ATUL|GREAVES|3 ?WHEELER')
CARB = re.compile(r'^P ?(\d{4})$')
PART = re.compile(r'^(0[679]\d{4})\.(\d{2})\.(\d{2})$')
SECS = [('SPARKPLUG', 'Spark plug'), ('INJECTOR', 'Fuel injector'), ('TPSSENSOR', 'TPS sensor'), ('[O0]2SENS[O0]R', 'O2 sensor'), ('ENGINE&THERMAL', 'Engine temperature sensor'), ('COOLANT', 'Coolant temperature sensor'),
        ('T-?MAP', ''), ('RAILPRESSURE', ''), ('BRAKESWITCH', 'Brake switch'), ('WIRINGHARNESS', 'Wiring harness'), ('^FLASHER', 'Flasher'), ('FUELPUMP', 'Fuel pump motor'), ('STRAINER', 'Fuel pump strainer'), ('CONTROLCABLE', 'Control cable')]
# the catalogue misspells the bike names on purpose; these go into the search text only
W = [('SPLENDR', 'SPLENDOR'), ('SPLNDER', 'SPLENDOR'), ('SPLNDR', 'SPLENDOR'), ('PASION', 'PASSION'), ('PASSON', 'PASSION'), ('PASN', 'PASSION'), ('PSN', 'PASSION'), ('DELXE', 'DELUXE'), ('DELX', 'DELUXE'), ('DLUXE', 'DELUXE'), ('DLX', 'DELUXE'),
     ('ACTVAA', 'ACTIVA'), ('ACTVA', 'ACTIVA'), ('SHNE', 'SHINE'), ('PULSR', 'PULSAR'), ('PULSER', 'PULSAR'), ('PLUSR', 'PULSAR'), ('PLSUR', 'PULSAR'), ('PLSR', 'PULSAR'), ('AVIATR', 'AVIATOR'), ('AVITAR', 'AVIATOR'), ('DISCVER', 'DISCOVER'), ('DICOVER', 'DISCOVER'),
     ('JUPTER', 'JUPITER'), ('JUPTR', 'JUPITER'), ('ZAST', 'ZEST'), ('ZST', 'ZEST'), ('WIGO', 'WEGO'), ('STRCTY', 'STAR CITY'), ('STR CTY', 'STAR CITY'), ('STARCTY', 'STAR CITY'), ('STRCITY', 'STAR CITY'), ('SR CTY', 'STAR CITY'), ('ACHIAVER', 'ACHIEVER'), ('ACHIVER', 'ACHIEVER'),
     ('XPALSE', 'XPULSE'), ('XTREM', 'XTREME'), ('EXTRME', 'XTREME'), ('UNCON', 'UNICORN'), ('UNICON', 'UNICORN'), ('UNICRAN', 'UNICORN'), ('UCON', 'UNICORN'), ('HARNNET', 'HORNET'), ('HARNET', 'HORNET'), ('HORNEET', 'HORNET'), ('PLESUR', 'PLEASURE'),
     ('SUZIKI', 'SUZUKI'), ('SUZKI', 'SUZUKI'), ('ACCES', 'ACCESS'), ('ACESS', 'ACCESS'), ('SWSH', 'SWISH'), ('YAMHA', 'YAMAHA'), ('YMHA', 'YAMAHA'), ('YAMA-', 'YAMAHA '), ('FACNO', 'FASCINO'), ('FASINO', 'FASCINO'), ('ALFA', 'ALPHA'), ('ALPA', 'ALPHA'), ('REY', 'RAY'),
     ('HIRO', 'HERO'), ('HOND', 'HONDA'), ('BAJ', 'BAJAJ'), ('RYALENFLD', 'ROYAL ENFIELD'), ('SCUTY', 'SCOOTY'), ('NTARK', 'NTORQ'), ('PHINIX', 'PHOENIX'), ('REDION', 'RADEON'), ('RADON', 'RADEON'), ('MASTRO', 'MAESTRO'), ('MEASTRO', 'MAESTRO'),
     ('KARZAMA', 'KARIZMA'), ('APACHI', 'APACHE'), ('APCHE', 'APACHE'), ('PLATNA', 'PLATINA'), ('BOXR', 'BOXER'), ('MAHNDRA', 'MAHINDRA')]


W2 = [('PLESR', 'PLEASURE'), ('PLTNA', 'PLATINA'), ('DISCVR', 'DISCOVER'), ('CALIBR', 'CALIBER'), ('HRNET', 'HORNET'), ('DRM', 'DREAM'), ('YUG', 'YUGA'), ('ENFLD', 'ENFIELD'), ('RYAL', 'ROYAL'), ('RYL', 'ROYAL'), ('WESPA', 'VESPA'), ('SCOTY', 'SCOOTY'), ('PEPT', 'PEP'),
      ('JUPTER', 'JUPITER'), ('STRT', 'START'), ('UNICRAN', 'UNICORN'), ('HARNNET', 'HORNET'), ('ACHIAVER', 'ACHIEVER'), ('PULSER', 'PULSAR'), ('STR', 'STAR'), ('CTY', 'CITY'), ('DELUX', 'DELUXE'), ('YAMA', 'YAMAHA'), ('APACHI', 'APACHE'), ('CPLR', 'COUPLER')]
ROM = {'II', 'III', 'IV', 'VI'}
# rows where the two readings disagree and the page was looked at by eye
EYE = {
    'P 9903': 'TVS WEGO BS III', 'P 9905': 'TVS JUPITER BS IV / WEGO IV', 'P 9064': 'HOND DIO 110cc BS III', 'P 9550': 'BAJ DISCVR 100 BS III MANUAL CHOKE', 'P 9536': 'BAJ DISCVR 100 BS IV MANUAL CHOKE',
    'P 9535': 'BAJ DISCVR 100 BS III AUTO CHOKE', 'P 9551': 'BAJ DISCVR 100 BS IV AUTO CHOKE', 'P 1809': 'LML STAR DELUX EURO III', 'P 9579': 'TVS SUZKI FIERO 150cc BS III D-FI LOGIC', 'P 8500': 'KEL KINETIC SAFARI V2-80',
    'P 9062': 'HIRO HF DELX i3S - BS IV', 'P 9501': 'BAJ BOXR / 4S CHAMPION', 'P 9054': 'ACTVA HET 125 BS IV WITHOUT TPS', 'P 9569': 'HOND HRNET 160R BS III / BS IV', 'P 9561': 'YMHA ALPHA III / FASINO / RAY',
    'P 8503': 'BAJ M80', 'P 9043': 'HIRO PLESR BS II', 'P 9508': 'BAJ PLTNA BS II', 'P 9038': 'RYAL ENFLD 350cc OLD & BS II',
    '060078.00.47': 'TVS, BAJ, HIRO, HOND, SUZIKI, RYL ENFLD 2 WHEELERS ALL MODELS FLASER WITHOUT BUZZER', '060100.00.47': 'TVS, BAJ, HIRO, HOND, SUZIKI, RYL ENFLD 2 WHEELERS ALL MODELS FLASER WITH BUZZER',
    '060089.00.24': 'TVS XL SUP HD UPG II WITH RED CPLR',
    '060178.00.27': 'SPLENDR, PASION, CD, HF-DELXE, PULSR, ACTVAA (UP TO 2009) DIO (UP TO 2012) AVIATR, DISCVER (100/125/150), PULSR 135, CT100, REY, ALPA, SUZIKI AccESS125, TVS STR CTY, SPORT',
    '060179.00.27': 'JUPTER, ZAST110, WIGO, STR CTY+, YAMHA FZ-FI, FZ-S FI BSIV, FZ 16, ACHIVER 150, XPALSE HUNK, XTREM, UCON, HARNET 160 R, SP-125, HET',
    '060197.00.27': 'PASION, CD, HF-DELXE, DISCVER (100/125/150), PULSR 135, CT100', '060198.00.27': 'PLESUR, ACTVA (UP TO 2009) DIO (UP TO 2012) AVITAR',
    '060199.00.27': 'STR CTY+, YAMHA FZ-FI, FZ-S FI BSIV, FZ ACHIVER 150, XPALSE HANK, XTREM, UNCON, HARNET 160 R', '060200.00.27': 'TVS JUPTER, ZAST110, WIGO', '060202.00.27': 'TVS STR, SPORT, PASION, SHNE',
    '060203.00.27': 'STR CTY+, YAMHA FZ-FI, FZ-S FI BSIV, FZ 16, ACHIAVER 150, XPALSE HUNK, XTREM, UNCON, HARNET 160 R, SP-125, HET',
    '060204.00.27': 'PLESUR, ACTVA (UP TO 2009) DIO (UP TO 2012) AVIATOR, RAY, ALFA, SUZIKI ACESS125', '060205.00.27': 'PASION, CD, HF-DLUXE, SPLENDR, DICOVER (100/125/150), PLUSR 135, CT100, TVS STR CTY, SPORT',
    '060185.00.49': 'HOND SHNE/UNCON/HORNEET - 4 HOLES', '060186.00.49': 'PULSER125/RTR/STAR CTY PLUS/NTARK/PHINIX - 6 HOLES', '060187.00.49': 'PASSON PRO - 6 HOLES',
    '060206.00.49': 'ACTVA 6G/CBR 150/SPLENDR PRO PLUS/REDION/STAR CITY/MASTRO - 6 HOLES', '060207.00.49': 'CD DELUX/JUPTER 125/HF DLX - 4 HOLES',
    '060208.00.49': 'ACTVA 6G/CBR 150/SPLENDR PRO PLUS/RADEON/STAR CITY/MEASTRO - 6 HOLES', '060209.00.49': 'YAMA-FZ V1/2 - 6 BIG HOLES', '060210.00.49': 'YAMA-FZ V1/2 - 4 HOLES',
    '060211.00.49': 'YAMA-FZ V1/2 - 6 SMALL HOLES', '060212.00.49': 'YAMA-FZ V1/2 - 6 NORMAL HOLES', '060213.00.49': 'HIRO H/F DLX - 4 HOLES', '060216.00.49': '175cc/Unicran/Harnnet - 8 HOLES',
    '060217.00.49': '125cc YAMA-FZ V1/2 - 6 HOLES', '060218.00.49': 'YAMA-FZ W.S02 V/3 - 6 HOLES',
    '060117.00.48': 'AW20 P 9538/39 - SHNE 125', '060127.00.48': 'P 9535 - AW17T - DISCOVER', '060136.00.48': 'P 9545 / 44 UNICON', '060167.00.48': 'AW22 P 9564 YMHA FZ 160', '060169.00.48': 'AW22 P 9561 YMHA ALFA - CYGNUS',
    '060170.00.48': 'AW18 B P 9560 CT100 BSVI', '060174.00.48': 'AW17T P 9570 - HIRO DUET 125 BSIV',
    '060220.00.51': 'TVS XL100', '060221.00.51': 'BAJ CT100', '060222.00.51': 'TVS STR CITY+',
    '070227.00.48': 'TWO WHEELER: ALL BS VI 100 TO 200 cc (JUPTR, XL, SR CTY, APACHI, RADEON)', '060124.00.48': 'YMHA FZ R15 FACNO / ACTVA / UNCON / SPLNDER / CD DLX / KARZAMA / EXTRME / PSN / X+',
    '060125.00.48': 'TVS APCHE / NTORQ / JUPTR / XL SUP 100 / RADON / KING 3.W.', '060126.00.48': 'PLSUR 125 / 150 / 220 / 250 / CT100 / PLATNA',
    '060190.00.50': 'JUPTER / SCOTY PEPT+', '060219.00.50': 'PULSR 150', '060229.00.29': 'for fuel pump motor 060190.00.50 (JUPTER / SCOTY PEPT+)', '060230.00.29': 'for fuel pump motor 060219.00.50 (PULSR 150)',
    '091612.00.95': 'AW20 E 903 - ACC CABLE', '091613.00.95': 'AW20 E 903 - CHOKE CABLE', '091744.00.95': 'AV18 P 9039 BULLET BSIV - ACC CABLE', '091769.00.95': 'AW20 P 9538 SHNE, TTM - ACC CABLE',
    '091784.00.95': 'AW20 P 9542 PULSR 150 BSIII - ACC CABLE', '091803.00.95': 'AW22 P 9558 APACHI - ACC CABLE', '091805.00.95': 'AW20 P 9560 CT100 - BSVI - ACC CABLE', '091807.00.95': 'AW22 P 9564 YMHA FZ 160 - ACC CABLE',
    '091808.00.95': 'AW22 P 9561 YMHA ALFA CYGNUS - ACC CABLE', '091819.00.95': 'AW22 P 9566 AVENGER - ACC CABLE', '091842.00.95': 'AW22 P 9558, P9542 APACHI, PULSR - CHOKE CABLE', '091843.00.95': 'AW22 P 9567 FZ',
    '091849.00.95': 'AW22 P 9569 CB HORNET BSIII, IV - ACC CABLE', '091872.00.95': 'AW22 P 9572 BULLET THUNDER BIRD - ACC CABLE', '091876.00.95': 'AW22 P 9574 BULLET CLASSIC - ACC CABLE',
}


def fix(t):
    """OCR slips that both readings share: zero inside a word is the letter O, the letter O inside a number is a zero."""
    t = re.sub(r'(?<=[A-Za-z])0+(?=[A-Z])', lambda m: 'O' * len(m.group(0)), t)
    t = t.replace('1000LD', '100 OLD')
    t = re.sub(r'(?<=\d)O+(?=cc|CC|cC|BS|[^A-Za-z]|$)', lambda m: '0' * len(m.group(0)), t)
    t = re.sub(r'(?<=\d)[cC]{2}', 'cc', t)
    return t


def bs_merge(ta, tb):
    """the bold 'III' is often read as 'II': of two readings the longer valid one is right (looked at 11 by eye)."""
    rx = re.compile(r'BS ?([IVl1|m川]+)')
    norm = lambda r: re.sub(r'I{4,}', 'III', r.replace('l', 'I').replace('1', 'I').replace('|', 'I').replace('m', 'II').replace('川', 'II'))
    A, B = [norm(x) for x in rx.findall(ta)], [norm(x) for x in rx.findall(tb)]
    if len(A) != len(B): return None, None, False
    R = []
    for x, y in zip(A, B):
        c = [z for z in (x, y) if z in ROM]
        if not c: return None, None, False
        R.append(max(c, key=len) if set(c) <= {'II', 'III'} else (c[0] if len(set(c)) == 1 else None))
        if R[-1] is None: return None, None, False
    it = iter(R); fa = rx.sub(lambda m: 'BS ' + next(it), ta)
    it = iter(R); fb = rx.sub(lambda m: 'BS ' + next(it), tb)
    return fa, fb, True


VOC = set('BS OLD NEW WITH WITHOUT TPS AUTO MANUAL CHOKE KS ES HET PLUS PRO STAR CITY SPORTS DELUX DELUXE DAWN SUPER SCOOTER KIT CARB FLANGE SWITCH ASSY STOP SHORT LONG LENGTH ROUND LIGHT MODELS ALL FLASER FLASHER BUZZER WHEELERS FUEL PUMP MOTOR HOLES BIG SMALL NORMAL '
          'DOUBLE SINGLE CABLE ACC TVS HIRO HOND BAJ YMHA YAMA YAMHA SUZKI SUZIKI KEL KMCL KINETIC LML RYAL ENFLD XL MAX SAMURAI VICTOR GL APACHE WEGO JUPITER SCUTY PEP PUCH PLESR DUET CD SS SPLNDR SPLENDR PASN PASION HF DELX DLX ACTVA AVIATOR DIO DRM YUG SHNE UNCON HRNET '
          'CHETAK PRIYA BRAVO CUB BOXR CHAMPION CALIBR PLTNA PLATNA CT DISCVR PULSR AVENGER STREET RX ALPHA FASINO RAY FZ ACCES SWSH LUNA MAGNUM KING SAFARI BREEZE ZING VESPA WESPA SELECT NV FREEDOM EURO FIERO LOGIC PREMIER EDITION VALVE AFTER APRIL UPGRADE STRT SELF SUP HD UPG RED CPLR STR CTY PLU '
          'FR RR CYGNUS ALFA DUT TFR MALVIP PACER PANTHER LEGEND TECH ENG PORT'.split())


def seg(tok):
    """break a word the reading squashed together ('TVSSTARSPORTSBSIV') into the catalogue's words; unknown words stay whole."""
    U = tok.upper()
    if len(U) < 5 or not U.isalpha() or U in VOC: return tok
    best = {0: []}
    for i in range(1, len(U) + 1):
        for j in range(max(0, i - 9), i):
            if j in best and U[j:i] in VOC and (i - j > 1):
                c = best[j] + [tok[j:i]]
                if i not in best or len(c) < len(best[i]): best[i] = c
    return ' '.join(best[len(U)]) if len(U) in best else tok


def nice(t):
    t = re.sub(r'(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Z])', ' ', t)
    t = re.sub(r'(\d) ?cc', r'\1cc', t)
    t = re.sub(r'[A-Za-z]+', lambda m: seg(m.group(0)), t)
    t = re.sub(r'\bBS ?(VI|IV|III|II)\b', r'BS \1', t)
    t = re.sub(r'\s*/\s*', ' / ', t); t = re.sub(r'\s*,\s*', ', ', t); t = re.sub(r'\(\s+', '(', t); t = re.sub(r'\s+\)', ')', t)
    t = re.sub(r'\b(\d) G\b', r'\1G', t); t = re.sub(r'\bY 2 K\b', 'Y2K', t); t = re.sub(r'\bi 3 S\b', 'i3S', t); t = re.sub(r'\b160 R\b', '160R', t); t = re.sub(r'\bV (\d)\b', r'V\1', t); t = re.sub(r'\bM 80\b', 'M80', t)
    return sp(t)


def hay(t):
    t = t.upper()
    for a, b in W + W2: t = re.sub(r'(?<![A-Z])' + re.escape(a) + r'(?![A-Z])', b, t) if a.isalpha() else t.replace(a, b)
    return sp(t)


def page_rows(words):
    """-> (head, [(sec, pn, text)]) of one page."""
    ws = sorted(words, key=lambda w: (w[1], w[0]))
    if not ws: return '', []
    k = max(w[2] for w in ws) / 1300.0
    head = ' '.join(w[4] for w in ws if w[1] < 130 * k and 'SPACO' not in w[4].upper())
    sr = [w[0] for w in ws if re.match(r'^SR\.?,?NO', w[4].upper().replace(' ', ''))]
    left = (min(sr) if sr else 0) + 60 * k
    codes = [w for w in ws if w[0] > left and (CARB.match(w[4].strip()) or PART.match(w[4].replace(' ', '')))]
    heads = []
    for w in ws:
        if w[0] > left or w[1] < 112 * k: continue
        U = w[4].upper().replace(' ', '')
        for rx, nm in SECS:
            if re.search(rx, U): heads.append((w[1], nm)); break
    sec_of = lambda y: max([h for h in heads if h[0] <= y + 5], default=(0, 'Part'))
    out = {id(c): [] for c in codes}
    for w in ws:
        if w in codes or w[1] < 112 * k or w[0] < left: continue
        U = w[4].upper().replace(' ', '')
        if re.match(r'^(REG\.?NO\.?|APPLICATION|PART\.?NO\.?|VEHICLEMODEL.*|SPACO|\d{1,2})$', U): continue
        near = [c for c in codes if sec_of(c[1]) == sec_of(w[1])]
        if not near: continue
        c = min(near, key=lambda c: abs(c[1] - w[1]))
        if abs(c[1] - w[1]) < 75 * k: out[id(c)].append(w)
    rows = []
    for c in codes:
        m = CARB.match(c[4].strip())
        pn = 'P ' + m.group(1) if m else c[4].replace(' ', '')
        rows.append(('Carburettor' if m else sec_of(c[1])[1], pn, sp(' '.join(w[4] for w in sorted(out[id(c)], key=lambda w: (w[1], w[0]))))))
    return head, rows


def main(f1, f2, out_f, verbose=False):
    A, B = json.load(open(f1)), json.load(open(f2))
    rows, seen, odd = [], set(), []
    for j, wb in enumerate(B):
        pg = j + 8; wa = A[pg - 1]
        ha, ra = page_rows(wa); hb, rb = page_rows(wb)
        H = ha.upper().replace(' ', '')
        if SKIPPG.search(ha.upper()) or 'COMINGSOON' in H: continue
        mk = next((n for k, n in MAKER if H.startswith(k)), '')
        da = {pn: (s, t) for s, pn, t in ra}; db = {pn: (s, t) for s, pn, t in rb}
        for pn in sorted(set(da) | set(db)):
            if pn not in da or pn not in db: odd.append(f'p{pg} {pn}: only one reading has it'); continue
            sec, ta = da[pn]; tb = db[pn][1]
            if not sec or sec != db[pn][0]:
                if sec: odd.append(f'p{pg} {pn}: section differs')
                continue
            U = (ta + ' ' + tb).upper().replace(' ', '')
            if not ta or not tb: odd.append(f'p{pg} {pn}: no bike text'); continue
            if re.search(r'3W|KINGDLX|ATULAUTO', U) and not re.search(r'JUPTR|APCHE|ACTVA', U): continue
            ta, tb = fix(ta), fix(tb)
            fa, fb, ok = bs_merge(ta, tb)
            if ok: ta, tb = fa, fb
            na, nb = nice(ta), nice(tb)
            if pn in EYE: na = nb = EYE[pn]
            elif re.sub(r'[\s.,()（）]', '', na.upper()) != re.sub(r'[\s.,()（）]', '', nb.upper()): odd.append(f'p{pg} {pn}: name differs | {na} | {nb}'); continue
            if pn in seen: odd.append(f'p{pg} {pn}: twice'); continue
            seen.add(pn)
            nm = max((na, nb), key=lambda x: (x.count(' '), x.count(')')))
            mk1 = mk or (lambda L: L[0] if len(L) == 1 else '')(sorted({n for k_, n in [('TVS', 'TVS'), ('HIRO', 'Hero'), ('HOND', 'Honda'), ('BAJ', 'Bajaj'), ('YMHA', 'Yamaha'), ('YAMA', 'Yamaha'), ('YAMHA', 'Yamaha'), ('SUZIKI', 'Suzuki')] if re.match(k_ + r'\b', nm.upper())}))
            rows.append({'pn': pn, 'nm': (sec + ' - ' + nm)[:200], 'mk': mk1, 'veh': nm, 'sec': sec, 'mrp': 0, 'oem': [], 'fit': hay(nm), 'hay': hay(sec + ' ' + nm)})
    json.dump({'brand': 'Spaco', 'src': 'Spaco product catalogue 2026 (no MRP printed)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    import collections
    print(len(rows), dict(collections.Counter(r['sec'] for r in rows)))
    if verbose:
        for o in odd: print('  ', o)
    else: print(len(odd), 'notes (-v)')


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if x != '-v']
    main(a[0], a[1], a[2], '-v' in sys.argv)
