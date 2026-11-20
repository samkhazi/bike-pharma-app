#!/usr/bin/env python3
"""24d: ASK (brake shoes, disc pads, clutch plates, control cables ...) for Find Part's aftermarket list (Sam 2026-11-20).
  python3 ask_parse.py PRICELIST.pdf OUT.json       (needs pymupdf)
ASK Automotive product price list w.e.f. 12.08.2026 (its pages carry their own dates). The tables differ page to page (some print a
"new list price" and packing next to the MRP), so the MRP is the number printed under the page's own MRP heading, never the list
price. No original (bike maker's) numbers in the list. The list shortens bike names (HR SPL, BJ PUL): the name stays as printed,
the search text spells the maker out. Data: never in git."""
import json, re, sys
from collections import Counter
import pymupdf

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
MK = {'HR': 'Hero', 'HH': 'Hero', 'BJ': 'Bajaj', 'TV': 'TVS', 'HN': 'Honda', 'Y': 'Yamaha', 'YM': 'Yamaha', 'SZ': 'Suzuki', 'RE': 'Royal Enfield', 'KTM': 'KTM', 'MH': 'Mahindra', 'PI': 'Piaggio', 'LML': 'LML', 'KN': 'Kinetic'}
W = {'SPL': 'SPLENDOR', 'SUP': 'SUPER', 'PUL': 'PULSAR', 'PLSR': 'PULSAR', 'GLAMR': 'GLAMOUR', 'AVNGR': 'AVENGER', 'UNCRN': 'UNICORN', 'SHNE': 'SHINE', 'STUNER': 'STUNNER', 'DAZLER': 'DAZZLER', 'APCHE': 'APACHE', 'RDEON': 'RADEON',
     'FAZR': 'FAZER', 'ACTVA': 'ACTIVA', 'PASS': 'PASSION', 'PSN': 'PASSION', 'DISC': 'DISCOVER', 'DSCVR': 'DISCOVER', 'PLTNA': 'PLATINA', 'JUPTR': 'JUPITER', 'ACESS': 'ACCESS', 'BOX': 'BOXER', 'CAL': 'CALIBER', 'VIC': 'VICTOR',
     'MSTRO': 'MAESTRO', 'PLSUR': 'PLEASURE', 'KRZMA': 'KARIZMA', 'XTRM': 'XTREME', 'GIXER': 'GIXXER', 'BULT': 'BULLET', 'CLSC': 'CLASSIC', 'DLX': 'DELUXE',
     'ACT': 'ACTIVA', 'PASSN': 'PASSION', 'PASION': 'PASSION', 'DIOO': 'DIO', 'SHNE': 'SHINE', 'ACES': 'ACCESS', 'PLATNA': 'PLATINA', 'PLTINA': 'PLATINA', 'PLTN': 'PLATINA', 'MASTRO': 'MAESTRO', 'JPTR': 'JUPITER', 'PLESURE': 'PLEASURE', 'PLESR': 'PLEASURE',
     'SCTY': 'SCOOTY', 'PEPY': 'PEP', 'CBBZ': 'CBZ', 'JOOY': 'JOY', 'DESTNI': 'DESTINI', 'VIGO': 'WEGO', 'NTRQ': 'NTORQ', 'LVO': 'LIVO', 'XCDD': 'XCD', 'YUGA': 'YUGA', 'BUGMAN': 'BURGMAN', 'DERO': 'DURO', 'TWSTER': 'TWISTER', 'AVATOR': 'AVIATOR', 'AVIATR': 'AVIATOR',
     'CENRTO': 'CENTURO', 'CNTRO': 'CENTURO', 'BUL': 'BULLET', 'CNTRA': 'CENTRA', 'FACNO': 'FASCINO', 'FSCNO': 'FASCINO', 'HNK': 'HUNK', 'UNICRN': 'UNICORN', 'NEOO': 'NEO', 'SWSH': 'SWISH', 'CRUXS': 'CRUX', 'HORNT': 'HORNET', 'EXTRM': 'XTREME', 'XTRME': 'XTREME',
     'STREK': 'STREAK', 'THNDER': 'THUNDER', 'CHTK': 'CHETAK', 'CHTAK': 'CHETAK', 'DISCOVR': 'DISCOVER', 'REVLT': 'REVOLT', 'OPTMA': 'OPTIMA', 'AMBITN': 'AMBITION', 'SHOGN': 'SHOGUN', 'SHOLIN': 'SHAOLIN', 'GRAZA': 'GRAZIA', 'VSPA': 'VESPA', 'AVNGER': 'AVENGER',
     'KARZMA': 'KARIZMA', 'ATHR': 'ATHER', 'ACHIVR': 'ACHIEVER', 'ACHVER': 'ACHIEVER', 'SUPR': 'SUPER', 'BXR': 'BOXER', 'DELUX': 'DELUXE', 'LBRO': 'LIBERO', 'BRVO': 'BRAVO', 'STNNER': 'STUNNER', 'DAZZLR': 'DAZZLER', 'DOMINR': 'DOMINAR', 'ENRG': 'ENERGY', 'APRLA': 'APRILIA',
     'OLAA': 'OLA', 'IQWBE': 'IQUBE', 'IQUB': 'IQUBE', 'RADON': 'RADEON', 'RADEEON': 'RADEON', 'BLAD': 'BLADE', 'GLDTR': 'GLADIATOR', 'GLADTOR': 'GLADIATOR', 'MACHSMO': 'MACHISMO', 'METOR': 'METEOR', 'HUNTR': 'HUNTER', 'LUUNA': 'LUNA', 'ELIMNTOR': 'ELIMINATOR',
     'NTICER': 'ENTICER', 'OKNAWA': 'OKINAWA', 'AROX': 'AEROX', 'STRET': 'STREET', 'VCTR': 'VICTOR', 'RYDER': 'RAIDER', 'PHOX': 'PHOENIX', 'PHONEX': 'PHOENIX', 'APACH': 'APACHE', 'CTY': 'CITY', 'YGA': 'YUGA', 'CYGNS': 'CYGNUS', 'GXXR': 'GIXXER', 'ELCTRA': 'ELECTRA',
     'XLN': 'XL', 'ZESTY': 'ZEST', 'ZES': 'ZEST', 'PLSE': 'PULSAR', 'STR': 'STAR', 'DON': 'DAWN', 'DRM': 'DREAM', 'EDG': 'EDGE', 'SAM': 'SAMURAI', 'ALP': 'ALPHA', 'ALPA': 'ALPHA', 'CRUSE': 'CRUISE', 'DUT': 'DUET', 'STOKE': 'STROKE', 'VERSN': 'VERSION', 'HEVY': 'HEAVY'}
def full(s):
    s = s.upper()
    t = re.sub(r'\bDISC(?=\s*(PAD|BRAKE|PLATE|ASSY|TYPE|\)|$))', '\x01', s)
    t = re.sub(r'[A-Z]+', lambda m: W.get(m.group(0), m.group(0)), t).replace('\x01', 'DISC')
    return sp(t)
ROW = re.compile(r'^(?P<pre>.*?)(?P<pn>ASK/\S+(?: ?\([A-Za-z]+\)| [A-Z]{1,2}(?= ))?)\s+(?P<rest>.*?)\s+(?P<mrp>[\d,]{2,7})\s*$')
MKH = {'HR': 'Hero', 'BJ': 'Bajaj', 'TV': 'TVS', 'HN': 'Honda', 'YM': 'Yamaha', 'SUZ': 'Suzuki', 'RE': 'Royal Enfield', 'KT': 'Kinetic', 'MM': 'Mahindra', 'LML': 'LML', 'PG': 'Piaggio', 'VSP': 'Vespa', 'KTM': 'KTM', 'YO': 'Yo', 'ATH': 'Ather', 'OLA': 'Ola'}
BOIL = re.compile(r'ASK AUTOMOTIVE|Sales & Marketing|Tel:|W\.E\.F|PART ?(NO|NUMBER)|PART\. ?NO|HSN|PACKING|MASTER|^STD$|^NEW$|^PCS/$|^SET$|^No\.$|^S\.$|In (Sets|Pcs)|LIST PRICE|^\d+$|^Page', re.I)


def main(src, out_f):
    import subprocess
    txt = subprocess.run(['pdftotext', '-layout', src, '-'], capture_output=True, text=True).stdout.replace('\f', '\n')
    rows, seen, odd, sec, mk, veh, cab = [], {}, [], '', '', '', False
    for l in txt.split('\n'):
        t = sp(l)
        if not t: continue
        m = ROW.match(l) if 'ASK/' in l else None
        if not m:
            if 'ASK/' in l:
                if not re.search(r'3 ?W\b', t): odd.append(t)
                continue
            if t.startswith('CONTROL CABLES'): cab = True; sec = 'Control cable'; continue
            if BOIL.search(t): continue
            if cab:                                             # cable pages: a maker line (HR), then the bike the cables below are for
                if t in MKH: mk = MKH[t]; veh = ''
                else: veh = t; mk = MKH.get(t.split(' ')[0], mk)
            elif re.match(r'^[0-9A-Z][A-Z0-9 &/().,-]{4,70}$', t): sec = t; mk = ''
            continue
        pn = re.sub(r' \(', '(', sp(m.group('pn'))); rest = re.sub(r'^\s*(\d{4} ?\d\d ?\d\d|\d\d ?\d\d ?\d{4}|\d{8})?\s*(\d+ ?%)?\s*', '', m.group('rest'))
        ch = re.split(r'\s{2,}', rest.strip()); desc = sp(ch[0])
        if any(re.search(r'[A-Za-z]', c) and not re.match(r'^\d+ Pcs$', c) for c in ch[1:]): odd.append('name cut? ' + t)
        if re.search(r'3[- ]?WHEELER', sec) or re.search(r'\b3 ?W\b|AUTO ?RICKSHAW', desc + ' ' + veh, re.I): continue      # three-wheeler parts are left out
        mrp = int(m.group('mrp').replace(',', ''))
        if not desc or re.match(r'^\d+ Pcs$', desc): odd.append('no name: ' + t); continue
        if pn in seen:
            if seen[pn] != mrp: odd.append(f'{pn} printed again with MRP {mrp} (kept {seen[pn]})')
            continue
        seen[pn] = mrp
        mm = re.search(r'(?:ASK/|- )\s*(HR|BJ|TV|HN|YM|Y|SUZ|SZ|RE|KT|MM)[ /-]', desc); mk1 = mk if cab else ({**MK, **MKH}.get(mm.group(1), '') if mm else '')
        if cab: rows.append({'pn': pn, 'nm': desc, 'mk': mk1, 'veh': veh, 'sec': 'Control cable', 'mrp': mrp, 'oem': [], 'fit': full(veh), 'hay': full(desc + ' ' + veh)})
        else: rows.append({'pn': pn, 'nm': desc, 'mk': mk1, 'veh': '', 'sec': sec.capitalize() or 'Part', 'mrp': mrp, 'oem': [], 'fit': '', 'hay': full(desc + ' ' + sec)})
    json.dump({'brand': 'ASK', 'src': 'ASK Automotive product price list w.e.f. 12.08.2026', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(rows), 'parts', dict(Counter(r['sec'] for r in rows)), dict(Counter(r['mk'] for r in rows)))
    print('not read:', len(odd)); [print('  ', o[:170]) for o in odd[:40]]
    return rows


if __name__ == '__main__': main(*sys.argv[1:3])
