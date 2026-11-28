#!/usr/bin/env python3
"""24c: Gabriel (shock absorbers, front fork parts, steering cone sets, scooter CVT parts, rims, spokes, fork oil) for Find Part's aftermarket
list (Sam 2026-11-20 "eh sabhi brands add karde").
  python3 gabriel_parse.py PRICELIST.txt OUT.json
PRICELIST = `pdftotext -layout` of Gabriel's "Product Price List 2 & 3 Wheeler". MRP only (the STD PACK column is not kept).
Only two-wheeler parts: the 3W shock absorber, 3 wheeler OC spring, 3W wheel rim and 3W cone set blocks are left out, as in the other lists.
The list writes bikes short (BJ PLSR, HN ACTVA): the name stays as printed, the search text spells them out. The out file is data: never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
ROW = re.compile(r'^\s*(AM-\S+)\s+(\S.*?)\s+(\d+)\s+([\d,]+\.\d+)\s*$')
HALF = re.compile(r'^\s*(AM-\S+)\s+(\S.*\S)\s*$')                      # a name that runs on to the next line
TAIL = re.compile(r'^\s*(\S.*?)\s+(\d+)\s+([\d,]+\.\d+)\s*$')
MAKERS = {'BAJAJ': 'Bajaj', 'BAJAJ AUTO': 'Bajaj', 'HERO MOTOCORP': 'Hero', 'HONDA': 'Honda', 'HMSI': 'Honda', 'KINETIC': 'Kinetic', 'LML': 'LML', 'MAHINDRA - 2 WHEELER': 'Mahindra',
          'ROYAL ENFIELD': 'Royal Enfield', 'SUZUKI SCOOTER': 'Suzuki', 'SUZUKI': 'Suzuki', 'TVS MOTOR': 'TVS', 'YAMAHA MOTOR': 'Yamaha', 'YAMAHA': 'Yamaha', 'PIAGGIO SCOOTERS': 'Piaggio',
          'ATHER MOTOR': 'Ather', 'ATUL AUTO': 'Atul', 'FORCE MOTORS': 'Force', 'MAHINDRA & MAHINDRA': 'Mahindra', 'PIAGGIO': 'Piaggio', 'SCOOTER INDIA': 'Scooters India'}
PRE = {'BJ': 'Bajaj', 'HR': 'Hero', 'HN': 'Honda', 'TV': 'TVS', 'YM': 'Yamaha', 'SZ': 'Suzuki', 'RE': 'Royal Enfield', 'PI': 'Piaggio', 'MM': 'Mahindra', 'KIN': 'Kinetic', 'LM': 'LML'}
W = {'BJ': 'BAJAJ', 'HR': 'HERO', 'HN': 'HONDA', 'HNDA': 'HONDA', 'TV': 'TVS', 'YM': 'YAMAHA', 'SZ': 'SUZUKI', 'PI': 'PIAGGIO', 'PJ': 'PIAGGIO', 'KIN': 'KINETIC', 'SA': 'SHOCK ABSORBER',
     'RR': 'REAR', 'FR': 'FRONT', 'FF': 'FRONT FORK', 'PLSR': 'PULSAR', 'PULSR': 'PULSAR', 'DISVR': 'DISCOVER', 'DSVR': 'DISCOVER', 'DSCVR': 'DISCOVER', 'DISCOVR': 'DISCOVER', 'DISCR': 'DISCOVER',
     'BOXR': 'BOXER', 'CLBR': 'CALIBER', 'CALLIBER': 'CALIBER', 'PLATNA': 'PLATINA', 'PLTNA': 'PLATINA', 'PLAT': 'PLATINA', 'COMFOTEC': 'COMFORTEC', 'COMFRTC': 'COMFORTEC', 'BLK': 'BLACK', 'BK': 'BLACK',
     'GRY': 'GREY', 'GRN': 'GREEN', 'YLW': 'YELLOW', 'SLVR': 'SILVER', 'SLVER': 'SILVER', 'ACCS': 'ACCESS', 'ACCSS': 'ACCESS', 'ACT': 'ACTIVA', 'ACTV': 'ACTIVA', 'ACTVA': 'ACTIVA', 'ALPH': 'ALPHA',
     'APCH': 'APACHE', 'APCHE': 'APACHE', 'APRLA': 'APRILIA', 'VSPA': 'VESPA', 'AVATOR': 'AVIATOR', 'AVITOR': 'AVIATOR', 'AVTOR': 'AVIATOR', 'BRG': 'BEARING', 'BRNG': 'BEARING', 'BNG': 'BEARING',
     'BRGMAN': 'BURGMAN', 'BULLT': 'BULLET', 'BULT': 'BULLET', 'BUULT': 'BULLET', 'CLASIC': 'CLASSIC', 'CLSC': 'CLASSIC', 'CLSIC': 'CLASSIC', 'CLM': 'COLUMN', 'STRG': 'STEERING', 'STRNG': 'STEERING',
     'CNTRA': 'CENTRA', 'CRX': 'CRUX', 'CTY': 'CITY', 'DELX': 'DELUXE', 'DLX': 'DELUXE', 'DEO': 'DIO', 'DRM': 'DREAM', 'DWN': 'DAWN', 'DUR': 'DURO', 'EDG': 'EDGE', 'ELTRA': 'ELECTRA', 'ETRN': 'ETERNO',
     'ETRNO': 'ETERNO', 'EXTRM': 'EXTREME', 'FASCNO': 'FASCINO', 'FSCNO': 'FASCINO', 'FAZR': 'FAZER', 'FIER': 'FIERO', 'FIRO': 'FIERO', 'FLYT': 'FLYTE', 'GIXR': 'GIXXER', 'GLMR': 'GLAMOUR',
     'GMINI': 'GEMINI', 'GRACA': 'GRAZIA', 'GRZA': 'GRAZIA', 'GRZIA': 'GRAZIA', 'HIMALYN': 'HIMALAYAN', 'HIMLYAN': 'HIMALAYAN', 'HNK': 'HUNK', 'JIV': 'JIVE', 'JUPTR': 'JUPITER', 'JWA': 'JAWA',
     'KNG': 'KING', 'LBRO': 'LIBERO', 'LIBRO': 'LIBERO', 'LGND': 'LEGEND', 'LIV': 'LIVO', 'MESTRO': 'MAESTRO', 'MOPD': 'MOPED', 'NTRQ': 'NTORQ', 'NW': 'NEW', 'PASSN': 'PASSION', 'PHNEIX': 'PHOENIX',
     'PHNIX': 'PHOENIX', 'PLASURE': 'PLEASURE', 'PLESUR': 'PLEASURE', 'RDEON': 'RADEON', 'RFRSH': 'REFRESH', 'RY': 'RAY', 'RAYZ': 'RAY Z', 'SCOOTR': 'SCOOTER', 'SCOTY': 'SCOOTY', 'SCTY': 'SCOOTY',
     'SHAKT': 'SHAKTI', 'SHIN': 'SHINE', 'SLV': 'SLEEVE', 'SMRT': 'SMART', 'SPER': 'SUPER', 'SPR': 'SUPER', 'SUP': 'SUPER', 'SUPR': 'SUPER', 'SPLNDR': 'SPLENDOR', 'SPRT': 'SPORT', 'SPRTS': 'SPORTS',
     'STR': 'STAR', 'STREK': 'STREAK', 'STRK': 'STREAK', 'STUNR': 'STUNNER', 'SWSS': 'SWISS', 'THUNDR': 'THUNDER', 'UNCRN': 'UNICORN', 'UNICRN': 'UNICORN', 'VICTR': 'VICTOR', 'VKRM': 'VIKRAM',
     'WEG': 'WEGO', 'WGO': 'WEGO', 'WT': 'WITH', 'WO': 'WITHOUT', 'YUG': 'YUGA', 'ZST': 'ZEST', 'BOTM': 'BOTTOM', 'CMPCT': 'COMPACT', 'COMPCT': 'COMPACT', 'MAXMA': 'MAXIMA', 'OPTMA': 'OPTIMA',
     'CRGO': 'CARGO', 'PSNGR': 'PASSENGER', 'CONTINENTL': 'CONTINENTAL', 'GRM': 'GRAM'}
full = lambda s: sp(re.sub(r'[A-Z&]+', lambda m: W.get(m.group(0), m.group(0)), s.upper()))
SKIP3 = re.compile(r'^3 ?W|^3 WHEELER')
JUNK = re.compile(r'^(STD|PACK|ITEM CODE.*|GABRIEL.*|\d+)$')


def main(src, out_f):
    rows, seen, title, sec, mk, skip, half, odd, tl = [], set(), [], '', '', False, None, [], -9
    L = open(src, errors='replace').read().replace('\f', '\n').split('\n')
    for i, l in enumerate(L):
        t = sp(l)
        if not t or JUNK.match(t): continue
        m = ROW.match(l)
        if not m and half:
            m2 = TAIL.match(l)
            if m2 and not t.startswith('AM-'): m = ROW.match(half[0] + '   ' + half[1] + ' ' + m2.group(1) + '   ' + m2.group(2) + '   ' + m2.group(3))
            half = None
        if m:
            half = None
            if skip: continue
            pn, nm, mrp = m.group(1), sp(m.group(2)), int(round(float(m.group(4).replace(',', ''))))
            if pn in seen or mrp <= 0: odd.append(t); continue
            seen.add(pn); pre = nm.split(' ')[0].upper().split('/')[0].rstrip('-')
            rows.append({'pn': pn, 'nm': nm, 'mk': PRE.get(pre) or mk, 'veh': '', 'sec': sec or 'Part', 'mrp': mrp, 'oem': [], 'fit': '', 'hay': full(nm)})
            continue
        h = HALF.match(l)
        if h: half = (h.group(1), h.group(2)); continue
        if t in MAKERS: mk = MAKERS[t]; continue
        if t != t.upper(): odd.append(t); continue
        # a heading: lines that follow each other are one title ("2W SHOCK" + "ABSORBERS")
        title = (title + [t]) if i - tl <= 1 else [t]; tl = i
        sec = sp(' '.join(title)).replace(' AND OIL SEAL', '').capitalize().replace('2w ', '2W ').replace('3w ', '3W '); mk = ''
        skip = bool(SKIP3.match(sp(' '.join(title))))
    json.dump({'brand': 'Gabriel', 'src': 'Gabriel product price list 2 & 3 wheeler (two-wheeler parts)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('parts', len(rows), '| with maker', sum(1 for r in rows if r['mk']), '| lines not read', len(odd), odd[:8])


if __name__ == '__main__': main(*sys.argv[1:3])
