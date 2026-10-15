"""Aftermarket catalogues -> public/cat/am.json (update 8x).
Reads Sam's folder All Catalogues > After Market Brands (read only): the *_Master_Catalogue.pdf tables and the
Endurance / Suprajit / Lumax xlsx files. Each part keeps the OEM (original) numbers its catalogue prints, so Find Part
can show an exact original -> aftermarket match; parts with no OEM number only carry the bikes they fit.
usage: python3 am_build.py <After Market Brands folder> <out am.json>"""
import sys, os, re, json, glob
import pdfplumber, openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]
pk = lambda s: re.sub(r'[^A-Z0-9]', '', str(s or '').upper())
num = lambda s: (lambda v: int(round(float(v))) if v else 0)(re.sub(r'[^\d.]', '', str(s or '')) or None)
parts = []   # {b, pn, nm, g, mrp, fit, oem[], same[]}

def add(b, pn, nm, g, mrp, fit, oem=(), same=(), img=''):
    pn = str(pn or '').strip()
    if not pn or pn.lower() in ('part number', 'part no'): return
    parts.append({'b': b, 'pn': pn, 'nm': ' '.join(str(nm or '').split()), 'g': ' '.join(str(g or '').split()),
                  'mrp': num(mrp), 'fit': ' '.join(str(fit or '').split()), 'oem': [o for o in oem if len(pk(o)) >= 6],
                  'same': list(same), 'img': img})

def pdf_rows(f):
    with pdfplumber.open(f) as p:
        for pg in p.pages:
            for t in pg.extract_tables():
                for r in t:
                    if r and len(r) >= 7 and r[1] and r[1] != 'Part Number':
                        yield [(c or '').replace('\n', ' ') for c in r]

OEM_RE = re.compile(r'(?:OEM No\.|OEM P/N:)\s*([^|]+)')
COMP_RE = re.compile(r'Competitor P/N - (.*?)(?:\| OEM brand|\| Section|$)')
for f in sorted(glob.glob(os.path.join(SRC, '*', '*_Master_Catalogue.pdf'))):
    b = os.path.basename(f).replace('_Master_Catalogue.pdf', '').replace('_', ' ')
    b = {'Fag': 'ASK', 'Verroc': 'Varroc', 'Spark MInda Starter Motor': 'Spark Minda', 'Uno Minda Filters': 'Uno Minda'}.get(b, b)
    if b in ('Endurance', 'Suprajit', 'Lumax'): continue          # read from their xlsx below
    for r in pdf_rows(f):
        _, pn, nm, hsn, desc, fit, mrp = r[:7]
        oem = [re.sub(r'\s+', '', x) for m in OEM_RE.findall(desc) for x in re.split(r'[/,]', m) if x.strip()]
        same = []
        m = COMP_RE.search(desc)
        if m:   # "Bosch: F002H235188F8; Varroc: FAIR-...; Steelbird: RX63"
            for x in m.group(1).split(';'):
                if ':' in x:
                    sb, sn = x.split(':', 1); sn = sn.strip().strip('|').strip()
                    if sn: same.append([sb.strip(), sn])
        g = nm
        add(b, pn, nm, g, mrp, fit, oem, same)

def sheet(f, name):
    ws = openpyxl.load_workbook(f, read_only=True)[name]
    it = ws.iter_rows(values_only=True); h = [str(x or '') for x in next(it)]
    for r in it: yield dict(zip(h, r))

for r in sheet(os.path.join(SRC, 'Endurance', 'Endurance_Catalog.xlsx'), 'Parts'):
    add('Endurance', r['Part No'], r['Part Name'], r['Product group'], r['MRP (Rs)'],
        ((r['Brand'] or '') + ': ' + (r['Compatible models'] or '')).strip(': '),
        img=r['Image file'] if str(r.get('Image file') or '').startswith('images/') else '')
for r in sheet(os.path.join(SRC, 'Suprajit', 'Suprajit_Compatibility.xlsx'), 'Parts'):
    oem = re.findall(r'\b([A-Z]{1,3}\d{6,9}[A-Z0-9]*)\b', str(r['Ref / OEM part no'] or ''))
    add('Suprajit', r['Part No'], (r['Product'] or '') + (' · ' + r['Description'] if r['Description'] and r['Description'] != r['Product'] else ''),
        r['Product'], r['MRP (Rs)'], ((r['Brand'] or '') + ': ' + (r['Compatible models'] or r['Model (as printed)'] or '')).strip(': '), oem)
for r in sheet(os.path.join(SRC, 'Lumax', 'Lumax_Master_Catalogue.xlsx'), 'Parts'):
    add('Lumax', r['Part Number'], r['Part Name'], r['Part Name'], r['MRP (Rs.)'], r['Compatibility'],
        img=r['Photo'] if str(r.get('Photo') or '').startswith('images/') else '')

# one part per brand + number (a number printed twice keeps the longest fitment text, all OEM numbers)
seen = {}
for p in parts:
    k = (p['b'], pk(p['pn']))
    q = seen.get(k)
    if not q: seen[k] = p; continue
    for o in p['oem']:
        if o not in q['oem']: q['oem'].append(o)
    if p['fit'] and p['fit'] not in q['fit']: q['fit'] = (q['fit'] + ' ; ' + p['fit']).strip(' ;')
    q['mrp'] = q['mrp'] or p['mrp']
L = list(seen.values())

# ---- what kind of part (same list in the app: am.json 'ty'); first match wins, cables before the rest
TY = [['Clutch cable', r'CLUTCH.*CABLE|CABLE.*CLUTCH'], ['Throttle cable', r'(THROTTLE|ACCELERATOR|ACCEL)\b.*CABLE|CABLE.*(THROTTLE|ACCEL)'],
      ['Choke cable', r'CHOKE.*CABLE|CABLE.*CHOKE'], ['Gear cable', r'GEAR.*CABLE|CABLE.*GEAR'], ['Seat lock cable', r'SEAT.*CABLE|CABLE.*SEAT'],
      ['Speedo cable', r'(SPEEDO|METER|TACHO)\w*.*CABLE|CABLE.*(SPEEDO|METER|TACHO)'], ['Brake cable', r'BRAKE.*CABLE|CABLE.*BRAKE|\bHBS\b'],
      ['Brake shoe', r'\bSHOE'], ['Brake pad', r'\bPAD'], ['Clutch plate', r'CLUTCH.*PLATE|PLATE.*CLUTCH|FRICTION'],
      ['Shock absorber', r'SHOCK|ABSORBER|CUSHION|\bS/A\b'], ['Front fork', r'\bFORK'], ['Head lamp', r'HEAD ?LAMP|HEADLIGHT|\bH/L\b'],
      ['Tail lamp', r'TAIL ?LAMP|TAIL ?LIGHT|\bT/L\b'], ['Indicator', r'WINKER|BLINKER|INDICATOR|TURN SIGNAL'], ['Mirror', r'MIRROR'],
      ['Air filter', r'AIR ?FILTER|AIR CLEANER|ELEMENT.*AIR|AIR.*ELEMENT'], ['Oil filter', r'OIL ?FILTER|FILTER.*OIL'],
      ['Drive belt', r'\bBELT'], ['Starter motor', r'STARTER MOTOR|STARTING MOTOR|MOTOR.*START'], ['Wiring harness', r'HARNESS'],
      ['Fuel gauge sensor', r'FUEL.*(UNIT|GAUGE|SENSOR|LEVEL)|TANK UNIT'], ['Fuel pump', r'FUEL PUMP'], ['Oil pump', r'OIL PUMP'],
      ['Speedometer', r'SPEEDOMETER|METER ASSY|METER COMP|INSTRUMENT|METER ASSEMBLY'], ['Relay', r'RELAY'], ['Horn', r'\bHORN'],
      ['Bulb', r'\bBULB'], ['Regulator rectifier', r'REGULATOR|RECTIFIER'], ['CDI', r'\bCDI\b'], ['Ignition coil', r'IGNITION COIL|COIL.*IGN'],
      ['Carburettor', r'CARBUR|CARB\.? ASSY'], ['Piston', r'\bPISTON'], ['Cylinder kit', r'CYLINDER KIT|BLOCK PISTON'], ['Chain sprocket kit', r'SPROCKET|CHAIN KIT'],
      ['Clutch switch', r'CLUTCH SWITCH'], ['Switch', r'\bSWITCH']]
TYC = [(n, re.compile(x)) for n, x in TY]
def ty_of(*ss):
    for s in ss:
        s = str(s or '').upper()
        for n, x in TYC:
            if x.search(s): return n
    return ''

# ---- the bikes it fits, as model names of our own catalogues (only when every word of the model is in the text)
CAT = os.path.join(os.path.dirname(OUT))
MODELS = {}
for f in glob.glob(os.path.join(CAT, '*.json')):
    if f.endswith('-dg.json') or os.path.basename(f) in ('xref.json', 'am.json'): continue
    d = json.load(open(f)); MODELS[d['brand']] = d['models']
BRAND_RE = {'Bajaj': r'\bBAJAJ|\bBJ\b|\bBAJ\b', 'Hero': r'\bHERO|\bHR\b|\bHM\b', 'Honda': r'\bHONDA|\bHMSI\b|\bHD\b', 'TVS': r'\bTVS|\bTV\b',
            'Yamaha': r'\bYAMAHA|\bYAMA|\bYM\b|\bYMH', 'Suzuki': r'\bSUZUKI|\bSUZ|\bSZ\b', 'Royal Enfield': r'ROYAL ENFIELD|\bRE\b|\bENFIELD',
            'KTM': r'\bKTM\b', 'Husqvarna': r'HUSQVARNA'}
AL = [(r'PL?S[AE]?R|PULSER|PLSAR', 'PULSAR'), (r'SPLE?N?DE?R|SPLNDR|SPL', 'SPLENDOR'), (r'PASION|PASSN', 'PASSION'), (r'JUPTR|JUPTER', 'JUPITER'),
      (r'APA?CHE?|APCHE|APACH', 'APACHE'), (r'ACTV|ACTVA|ACTIV', 'ACTIVA'), (r'DISCVR|DISC0VER|DISCOVR', 'DISCOVER'), (r'GLMR|GLAMOR', 'GLAMOUR'),
      (r'XTRE?ME|EXTRE?ME|XTERME|X-TREME', 'XTREME'), (r'HIMALAYN', 'HIMALAYAN'), (r'CLS+IC|CLASIC', 'CLASSIC'), (r'RADON', 'RADEON'),
      (r'MESTRO|MAESTO', 'MAESTRO'), (r'DESTINY', 'DESTINI'), (r'STR CTY|STARCITY|STR CITY', 'STAR CITY'), (r'AVNGR|AVENGR', 'AVENGER'),
      (r'PLATINA|PLATNA', 'PLATINA'), (r'UNICRN|UNICON', 'UNICORN'), (r'SCOOTY|SCOTY', 'SCOOTY'), (r'NTORQ|N TORQ', 'NTORQ'), (r'ACCES', 'ACCESS'),
      (r'GIXER|GIXXR', 'GIXXER'), (r'SHINE', 'SHINE'), (r'DOMINAR|DOMNR', 'DOMINAR'), (r'METEOR', 'METEOR'), (r'BULLT', 'BULLET')]
ALC = [(re.compile(r'\b(?:' + a + r')\b'), b) for a, b in AL]
def norm(s):
    s = re.sub(r'(\d)\s*CC\b', r'\1', str(s or '').upper())
    s = re.sub(r'([A-Z])(\d)', r'\1 \2', re.sub(r'(\d)([A-Z])', r'\1 \2', s))
    s = re.sub(r'[^A-Z0-9]+', ' ', s)
    for x, b in ALC: s = x.sub(b, s)
    return ' ' + ' '.join(s.split()) + ' '
MW = {b: [(m, norm(re.sub(r'\(.*?\)', '', m)).split()) for m in ms] for b, ms in MODELS.items()}
def fits_of(fit, nm):
    t = norm(fit + ' ' + nm); w = set(t.split()); out = []
    bs = [b for b, x in BRAND_RE.items() if re.search(x, str(fit).upper() + ' ' + str(nm).upper())]
    for b in (bs or MW):
        for m, ws in MW.get(b, []):
            if ws and (bs or len(ws) > 1 or len(ws[0]) > 5) and (' ' + ' '.join(ws) + ' ') in t:
                out.append([b, m])
    return out

B = sorted({p['b'] for p in L})
OB = sorted(MODELS)
out = {'src': "Sam's aftermarket catalogues (All Catalogues > After Market Brands), MRP as printed, Oct 2026",
       'b': B, 'ob': OB, 'ty': TY,
       'p': [[B.index(p['b']), p['pn'], p['nm'], p['g'], p['mrp'], p['fit'], p['oem'], p['same'], ty_of(p['g'], p['nm']),
              [[OB.index(b), m] for b, m in fits_of(p['fit'], p['nm'] if p['b'] in ('Varroc', 'Endurance') else '')]] for p in L]}
json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print('typed', sum(1 for p in out['p'] if p[8]), 'with our bikes', sum(1 for p in out['p'] if p[9]))
print(len(L), 'parts', dict(Counter(p['b'] for p in L)), 'with OEM no.:', sum(1 for p in L if p['oem']), 'same-as:', sum(1 for p in L if p['same']))
