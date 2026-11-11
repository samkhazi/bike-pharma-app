#!/usr/bin/env python3
"""Suprajit two-wheeler price lists -> one small list for Find Part's aftermarket parts (update 20g, Sam 2026-11-11 "dono catalogue ko use karke").

  python3 suprajit_parse.py OLD.txt NEW.txt OUT.json

OLD.txt = `pdftotext -layout` of the list that has the REF. PART NO. column (the original maker's number), e.g. Two-Wheeler-Price-list-Jan-24.pdf
NEW.txt = the text of the newest list (MRP, new parts; it has no REF. PART NO.), e.g. 2w Cable BC Price list July-26.pdf
Each part is kept once: name, bike and original numbers from OLD, MRP from NEW when NEW has the part (else OLD's MRP, marked old).
Only MRP is taken; MOQ is dropped. The list is a data file for the server (never in GitHub).
The price lists write bike names short (PLSR, SPLNDR, ACTV): WORDS spells them out so they match our catalogues' model names.
"""
import json, re, sys

PN = r'(?:S[A-Z]{1,3}\d{3,5}[A-Z]{0,3}|SM\d{2,3}[A-Z]{0,3}|Hm\d{4})'
ROW_OLD = re.compile(r'^\s*(' + PN + r')\s+(.*?)\s+([\d,]+\.\d\d)\s*$')
MAKERS = [('BAJJ AUTO', 'Bajaj'), ('BAJAJ AUTO', 'Bajaj'), ('BAJAJ', 'Bajaj'), ('TVS MTR', 'TVS'), ('T.V.S MOTOR', 'TVS'), ('T.V.S.MTR', 'TVS'), ('TVS', 'TVS'), ('SUZKI MOTOR', 'Suzuki'), ('SUZKI MTR', 'Suzuki'),
          ('SUZKI', 'Suzuki'), ('SUZUKI', 'Suzuki'), ('HERO MOTOR', 'Hero'), ('HERO MOTO', 'Hero'), ('HRO MTO', 'Hero'), ('HERO', 'Hero'), ('YAMHA MOTOR', 'Yamaha'), ('YMHA MTR', 'Yamaha'), ('YAMHA', 'Yamaha'),
          ('YAMAHA', 'Yamaha'), ('HONDA', 'Honda'), ('ROYAL ENFELD MOTOR', 'Royal Enfield'), ('RYAL ENFELD', 'Royal Enfield'), ('RYL ENFLD', 'Royal Enfield'), ('REML', 'Royal Enfield'),
          ('KNTC HNDA', 'Kinetic'), ('AMPERE MOTORS', 'Ampere'), ('LEGENDS(JAWA)', 'Jawa'), ('VSPA', 'Vespa'), ('APRLA', 'Aprilia'),
          ('KAWASAKI', 'Kawasaki'), ('MAHINDRA', 'Mahindra')]
MAKER = {re.sub(r'[^A-Z]', '', a): b for a, b in MAKERS}
# short spellings -> the word our catalogues use (my reading of the lists; a wrong one only means no bike match, the text still searches)
WORDS = {'PLSR': 'PULSAR', 'DISC': 'DISCOVER', 'CLBR': 'CALIBER', 'CALBR': 'CALIBER', 'CRMA': 'CROMA', 'BXR': 'BOXER', 'BXCR': 'BOXER', 'PLTN': 'PLATINA', 'AVNGR': 'AVENGER', 'CHTAK': 'CHETAK', 'VAVE': 'WAVE', 'WND': 'WIND',
         'SPLNDR': 'SPLENDOR', 'SPLDR': 'SPLENDOR', 'PASSON': 'PASSION', 'PSSN': 'PASSION', 'GLMOR': 'GLAMOUR', 'SUPR': 'SUPER', 'KRZMA': 'KARIZMA', 'PLSURE': 'PLEASURE', 'ACHVER': 'ACHIEVER', 'XTREM': 'XTREME', 'HNK': 'HUNK',
         'IMPLS': 'IMPULSE', 'MSTRO': 'MAESTRO', 'IGNTR': 'IGNITOR', 'JY': 'JOY', 'DWN': 'DAWN', 'SLEK': 'SLEEK', 'HRO': 'HERO', 'HRMO': 'HERO', 'SAMUR': 'SAMURAI', 'SHOG': 'SHOGUN', 'SHAO': 'SHAOLIN', 'FERO': 'FIERO',
         'CNTRA': 'CENTRA', 'FLME': 'FLAME', 'WGO': 'WEGO', 'ZST': 'ZEST', 'JUPTR': 'JUPITER', 'RADEEON': 'RADEON', 'EXL': 'XL', 'CHMP': 'CHAMP', 'SCOTY': 'SCOOTY', 'PP': 'PEP', 'STRK': 'STREAK', 'APACH': 'APACHE',
         'STR': 'STAR', 'CTY': 'CITY', 'SPRTZ': 'SPORT', 'SPRT': 'SPORT', 'IQB': 'IQUBE', 'VCTR': 'VICTOR', 'PHNX': 'PHOENIX', 'HTE': 'HEAT', 'ZUS': 'ZEUS', 'HYTES': 'HAYATE', 'LTS': 'LETS', 'GXXR': 'GIXXER',
         'ENTCR': 'ENTICER', 'LBRO': 'LIBERO', 'FAZR': 'FAZER', 'GLDTR': 'GLADIATOR', 'CRX': 'CRUX', 'RY': 'RAY', 'ALPA': 'ALPHA', 'FSCNO': 'FASCINO', 'CYGNS': 'CYGNUS', 'SALTO': 'SALUTO', 'ACTV': 'ACTIVA', 'DIIO': 'DIO',
         'UNIC': 'UNICORN', 'AVTR': 'AVIATOR', 'SHNE': 'SHINE', 'TWTR': 'TWISTER', 'STNR': 'STUNNER', 'TRGR': 'TRIGGER', 'DRM': 'DREAM', 'YGA': 'YUGA', 'HRNT': 'HORNET', 'GRZA': 'GRAZIA', 'BULLT': 'BULLET',
         'MACHSMO': 'MACHISMO', 'THUNDERBRD': 'THUNDERBIRD', 'THNDRBRD': 'THUNDERBIRD', 'ELCTRA': 'ELECTRA', 'INTERCEPTR': 'INTERCEPTOR', 'YMHA': 'YAMAHA', 'YAMHA': 'YAMAHA', 'SUZKI': 'SUZUKI', 'BAJJ': 'BAJAJ',
         'CNTURO': 'CENTURO', 'GSTO': 'GUSTO', 'MJO': 'MOJO', 'DRO': 'DURO', 'RODO': 'RODEO', 'FLTE': 'FLYTE', 'MRVL': 'MARVEL', 'KNTC': 'KINETIC', 'VSPA': 'VESPA', 'APRLA': 'APRILIA', 'SREET': 'STREET', 'BEEYK': 'BYK'}
# KTM, Husqvarna, Triumph stand inside Bajaj's pages and BMW inside TVS's as bike headings (their rows are followed by more Bajaj / TVS bikes)
DOTS = {'K.T.M': 'KTM', 'C.B.Z': 'CBZ', 'B.M.W': 'BMW', 'T.V.S': 'TVS', 'TRIUMP': 'TRIUMPH'}
REF = re.compile(r'^[A-Z0-9][A-Z0-9-]{5,15}$')
is_ref = lambda x: bool(REF.match(x)) and bool(re.search(r'\d', x)) and not x.endswith('CC') and len(re.sub(r'\D', '', x)) >= 3


def sec_pn(pn):
    p = re.match(r'[A-Za-z]+', pn).group(0)
    if re.match(r'SM\d', pn): return 'Mirror'
    if p.endswith('TU'): return 'Tank unit'
    if p[-2:] in ('AF', 'OF', 'FF', 'OS') and len(p) == 4: return 'Filter'
    if p.endswith('SP') or p in ('SAMP', 'SREM', 'SDGT', 'STRP'): return 'Speedometer'
    return {'SBS': 'Brake shoe', 'SCP': 'Clutch plate', 'SDP': 'Disc pad', 'SCS': 'Clutch shoe'}.get(p, 'Control cable')


sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
def full(s):
    s = s.upper()
    for a, b in DOTS.items(): s = s.replace(a, b)
    return re.sub(r'[A-Z]+', lambda m: WORDS.get(m.group(0), m.group(0)), s)

num = lambda s: round(float(s.replace(',', '')))


def parse_old(t):
    """pdftotext -layout text: PART NO | REF. PART NO | DESCRIPTION | MOQ | MRP, the bike as a heading line over its rows"""
    out, mk, model = {}, '', ''
    for pg in t.split('\f'):
        for ln in pg.split('\n'):
            m = ROW_OLD.match(ln)
            if not m:
                h = sp(ln).strip('. ')
                if not h or re.search(r'[a-z]', h) or 'PART NO' in h or re.fullmatch(r'[\d ]+', h) or len(h) > 60: continue
                k = re.sub(r'[^A-Z]', '', h)
                if k in MAKER: mk, model = MAKER[k], ''
                elif k not in ('CONTROLSPEEDOCABLES', 'SPEEDOINNERS', 'COMMONAPPLICATIONCHARTFORCABLES', 'MODEL'): model = h
                continue
            pn, body, mrp = m.group(1), m.group(2), num(m.group(3))
            if pn in out: continue
            sec = sec_pn(pn); cable = sec == 'Control cable'
            body = re.sub(r'\s+\d{1,3}\s*$', '', body)                       # MOQ
            cols = [c for c in re.split(r'\s{2,}', body.strip()) if c]
            refs = []
            if len(cols) >= 2:
                c0 = [x for x in re.split(r'\s*[/,]\s*|\s+', cols[0].upper()) if x]
                if c0 and all(is_ref(x) for x in c0): refs, cols = sorted(set(c0), key=c0.index), cols[1:]
                elif re.fullmatch(r'[0-9-]{1,3}', cols[0]): cols = cols[1:]
            out[pn] = {'pn': pn, 'nm': sp(' '.join(cols)), 'mk': mk if cable else '', 'veh': model if cable else '', 'sec': sec, 'mrp': mrp, 'oem': refs}
    return out


def parse_new(t):
    """plain text: a row starts with the part no. and ends with MOQ MRP (it may run over two lines); lone numbers are page numbers"""
    out, cur = {}, None
    for ln in t.split('\n'):
        s = sp(ln)
        if re.fullmatch(r'\d{1,3}', s): cur = None; continue
        m = re.match(r'^(' + PN + r')\s+(.*)$', s)
        if m: cur = [m.group(1), m.group(2)]
        elif cur and s and 'PART NO' not in s and len(s) < 110: cur[1] += ' ' + s
        else: cur = None
        if not cur: continue
        e = re.search(r'^(.*?)(?:\s+\d{1,3})?\s+([\d,]+\.\d\d)$', cur[1])
        if not e: continue
        pn, body = cur[0], sp(e.group(1)); cur = None
        if pn in out: continue
        sec, toks, refs = sec_pn(pn), body.split(' '), []
        if sec != 'Control cable':
            if len(toks) > 1 and is_ref(toks[0].upper()) and not re.search(r'[a-z]', toks[0]): refs, toks = [toks[0].upper()], toks[1:]
            out[pn] = {'pn': pn, 'nm': sp(' '.join(toks)), 'veh': '', 'sec': sec, 'mrp': num(e.group(2)), 'oem': refs}; continue
        i = len(toks)
        while i > 1 and not re.search(r'[a-z]', toks[i - 1]): i -= 1          # the bike = the capital-letter tail of the line
        if not re.search(r'[a-z]', body): i = len(toks)                       # a line all in capitals: no telling where the bike starts
        out[pn] = {'pn': pn, 'nm': sp(' '.join(toks[:i])).rstrip(' -'), 'veh': sp(' '.join(toks[i:])).lstrip('- '), 'sec': sec, 'mrp': num(e.group(2)), 'oem': []}
    return out


# the bike maker of a cable, from its number's first letters (the headings of the lists agree; a heading that ran on is put right)
CABLE_MK = {'SEY': 'Yamaha', 'SHH': 'Hero', 'SHM': 'Honda', 'SKB': 'Bajaj', 'SBA': 'Bajaj', 'SRE': 'Royal Enfield', 'SREK': 'Royal Enfield', 'SREM': 'Royal Enfield',
            'SSZ': 'Suzuki', 'STM': 'TVS', 'STS': 'TVS', 'SBMW': 'TVS', 'SAM': 'Ampere', 'SAMP': 'Ampere', 'SHE': 'Hero', 'SKH': 'Kinetic'}
OE_LEAD = re.compile(r'^((?=[0-9A-Z/&\- ]*\d)(?=[0-9A-Z/&\- ]*[A-Z-])[0-9A-Z][0-9A-Z-]{5,}(?:/[0-9A-Z]{1,6})?(?: ?& ?[0-9A-Z]{5,}(?:/[0-9A-Z]{1,6})?)*) +(?=[A-Z][a-z])')


def tidy(r):
    pre = re.match(r'[A-Z]+', r['pn']); pre = pre.group(0) if pre else ''
    if r['sec'] == 'Control cable':
        if pre in CABLE_MK: r['mk'] = CABLE_MK[pre]
        m = OE_LEAD.match(r['nm'])                                           # the newest list prints the original number before some names
        if m and (len(m.group(1).split('/')[0]) >= 8 or '/' in m.group(1)):
            r['nm'] = r['nm'][m.end():]
            for x in re.split(r' ?& ?', m.group(1)):
                x = x.split('/')[0] if re.search(r'/[0-9A-Z]{3,}$', x) else x     # 17920K0VB01/B00 = two numbers, the first whole; 571156/B = one RE number
                if x not in r['oem']: r['oem'].append(x)
        for x in re.findall(r'\[([0-9A-Z-]{8,})\]', r['nm']):
            if x not in r['oem']: r['oem'].append(x)
    o2 = []
    for x in r['oem']:
        if x == r['pn'] or re.match(r'^[A-Z]{2,}-?\d{2,3}$', x): continue     # its own number, or a bike's name (XL-100)
        if o2 and len(x) <= 7 and re.match(r'^\d{5}[A-Z]', o2[0]) and re.match(r'^[A-Z]', x): x = o2[0][:5] + x   # 22870KCC900/KWA910S = the same first five
        if x not in o2: o2.append(x)
    r['oem'] = o2
    n = r['nm']
    for k in range(len(n) // 2, 5, -1):                                      # a name printed twice in a row
        if n[k:].startswith(n[:k]): r['nm'] = n[k:]; break


def main(old_f, new_f, out_f):
    old = parse_old(open(old_f, errors='replace').read()); new = parse_new(open(new_f, errors='replace').read())
    rows = []
    for pn in sorted(set(old) | set(new)):
        o, n = old.get(pn), new.get(pn)
        r = dict(o) if o else {'pn': pn, 'nm': n['nm'], 'mk': '', 'veh': n['veh'], 'sec': n['sec'], 'oem': n['oem'], 'mrp': 0}
        if n and n['mrp'] > 0: r['mrp'] = n['mrp']
        elif o and o['mrp'] > 0: r['oldmrp'] = 1                            # not priced in the newest list: the older MRP
        if o and n and r['sec'] != 'Control cable':                          # these lines read cleaner in the newest list
            if len(n['nm']) >= 8: r['nm'] = n['nm']
            r['oem'] = sorted(set(o['oem'] + n['oem']), key=(o['oem'] + n['oem']).index)
        tidy(r)
        r['fit'] = full(r['veh']) if r['veh'] else ''
        r['hay'] = full(r['nm']) if r['sec'] != 'Control cable' else ''      # the name with its short bike words spelt out, for search and bike match
        rows.append(r)
    json.dump({'brand': 'Suprajit', 'src': 'Suprajit price lists: Jan 2024 (original part numbers) + July 2026 (MRP)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    c = lambda f: sum(1 for r in rows if f(r))
    print('parts', len(rows), '| in both', c(lambda r: r['pn'] in old and r['pn'] in new), '| only new', c(lambda r: r['pn'] not in old), '| only old', c(lambda r: 'oldmrp' in r),
          '| with original number', c(lambda r: r['oem']), '| with bike', c(lambda r: r['veh']), '| no name', c(lambda r: not r['nm']))


if __name__ == '__main__':
    main(*sys.argv[1:4])
