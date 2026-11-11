#!/usr/bin/env python3
"""20h: Spark Minda's parts for Find Part's aftermarket list (Sam 2026-11-11 "eh spark minda ka he", "jo MRP jyada he usko hi rhakh").
  python3 sparkminda_parse.py PRICELIST.txt LOCKSET.txt OUT.json
PRICELIST = the text copy of "All product Spark minda.pdf" (price list w.e.f. 01/10/2024; only its 2 & 3 wheeler half is read),
LOCKSET   = `pdftotext -layout` of lockset-catalogue-2019.pdf (only its two and three wheeler lock sets; its Ref Part No. column
            is clean, its bike names are printed with letters missing, so a name comes from the price list when the part is there).
A part in both: the higher MRP stays. MRP only (no pack sizes). The out file is data: it lives on the server, never in git."""
import json, re, sys

sp = lambda s: re.sub(r'\s+', ' ', s or '').strip()
num = lambda s: int(round(float(s.replace(',', '')))) if s else 0
PN = re.compile(r'^(?=[0-9A-Z-]*\d)[0-9A-Z]{1,6}(?:-[0-9A-Z]+){1,3}$')
PRICE = re.compile(r'₹ ?([\d,]+(?:\.\d+)?)(?: +[\d,]+(?: ?PCS)?){0,2} *$')
MAKERS = [('HERO', 'Hero'), ('BAJAJ', 'Bajaj'), ('TVS', 'TVS'), ('YAMAHA', 'Yamaha'), ('HONDA', 'Honda'), ('SUZUKI', 'Suzuki'), ('KTM', 'KTM'), ('ROYAL', 'Royal Enfield'),
          ('KINETIC', 'Kinetic'), ('LML', 'LML'), ('PIAGGIO', 'Piaggio'), ('JAWA', 'Jawa'), ('MAHINDRA', 'Mahindra'), ('M&M', 'Mahindra'), ('M & M', 'Mahindra')]
# the kind of part: the page's heading; inside LOCKS the first letters of Spark Minda's own number tell which lock
LOCK = {'KT': 'Lock kit', 'SW': 'Ignition switch', 'IGN': 'Ignition switch', 'IG': 'Ignition switch', 'LK': 'Lock', 'FC': 'Fuel tank cap'}
TITLES = [('LOCKS', 'Lock'), ('WIRING HARNESS', 'Wiring harness'), ('HARNESSES', 'Wiring harness'), ('CONTROL & SPEEDOMETER CABLES', 'Control cable'), ('INSTRUMENT CLUSTER', 'Instrument cluster'),
          ('SIDE STAND POSITION SENSOR', 'Side stand sensor'), ('FUEL LEVEL SENSOR', 'Tank unit'), ('CAPACITOR DISCHARGE', 'CDI'), ('IGNITION COIL', 'Ignition coil'), ('IGNITER', 'Ignitor'),
          ('REGULATOR RECTIFIER', 'Regulator rectifier'), ('RELAYS', 'Relay'), ('FLASHERS', 'Flasher'), ('STATOR COIL', 'Stator coil'), ('PICKUP COIL', 'Pickup coil'), ('CHARGING COIL', 'Charging coil'),
          ('BEEPER', 'Beeper'), ('AIR & OIL FILTERS', 'Filter'), ('BEARING', 'Bearing'), ('BRAKESHOES', 'Brake shoe'), ('BRAKE SHOE', 'Brake shoe'), ('BRAKE PADS', 'Brake pad'),
          ('CLUTCH SHOE', 'Clutch shoe'), ('CLUTCH PLATE', 'Clutch plate'), ('CLUTCH ASS', 'Clutch assembly'), ('STARTER MOTOR', 'Starter motor'), ('ALTERNATOR', 'Alternator'),
          ('LUBRICANTS', 'Lubricant'), ('WIPERS', 'Wiper blade')]


# numbers whose first letters always mean one kind (a page heading can be missing above them)
PRE = {'FW': 'Fuse wire', 'DI': 'Instrument cluster', 'SFL': 'Flasher', 'SRL': 'Relay', 'SRR': 'Regulator rectifier', 'SCD': 'CDI', 'SIC': 'Ignition coil', 'SSPS': 'Side stand sensor',
       'MF': 'Filter', 'BP': 'Brake pad', 'BS': 'Brake shoe', 'CP': 'Clutch plate', 'CS': 'Clutch shoe', 'WH': 'Wiring harness', 'CC': 'Control cable', 'TC': 'Control cable',
       'FB': 'Control cable', 'RB': 'Control cable', 'SC': 'Control cable', 'SI': 'Control cable', 'SL': 'Control cable', 'CH': 'Control cable'}
NO_MAKER_HEADINGS = {'Relay', 'Flasher', 'Starter motor', 'Stator coil', 'Pickup coil', 'Charging coil', 'Beeper', 'Bearing', 'Alternator'}


def title_of(l):
    if '₹' in l or len(l) > 45 or l != l.upper(): return ''
    for k, v in TITLES:
        if l.startswith(k): return v
    return ''


JUNK = re.compile(r'^(PART( NO\.?.*)?|NO\. REF.*|REF\. ?NO\.?|DESCRIPTION|M\.R\.P\..*|/ ?Pcs\.?|Pcs\.|STD\.?|PKG\.?|PACK SIZE.*|VEHICLE APPLICATION|CONNECTIONS|SEGMENT|OE PART.*|NUMBER|\d{1,3}( \d{1,3})?)$', re.I)


def is_ref(t):
    return bool(re.match(r'^(?=.*\d)[0-9A-Z][0-9A-Z/-]{5,16}[0-9A-Z]$', t)) and not re.match(r'^\d{1,4}(CC|V|W|A|MM)$', t)


def maker_of(line):
    u = line.upper()
    for k, v in MAKERS:
        if k in u: return v
    return ''


def sec_of(pn, title):
    pre = pn.split('-')[0]
    if title in ('Lock', '') and pre in LOCK: return LOCK[pre]
    if pre in PRE: return PRE[pre]
    return title or 'Part'


def mk_fix(mk, text):
    u = ' ' + re.sub(r'[^A-Z0-9]+', ' ', text.upper()) + ' '
    named = [v for k, v in (('HERO', 'Hero'), ('HONDA', 'Honda'), ('BAJAJ', 'Bajaj'), ('TVS', 'TVS'), ('YAMAHA', 'Yamaha'), ('SUZUKI', 'Suzuki'), ('KTM', 'KTM'), ('ENFIELD', 'Royal Enfield'), ('BULLET', 'Royal Enfield')) if ' ' + k + ' ' in u]
    named = sorted(set(named))
    return named[0] if len(named) == 1 and named[0] not in mk.split(' / ') and not (named[0] == 'Honda' and 'Hero' in mk) else mk


def parse_list(txt):
    L = txt.split('\n'); end = next((i for i, l in enumerate(L) if '4 WHEELERS AND TRACTORS' in l), len(L)); L = L[:end]
    out, buf, mk, model, title, skipped = {}, [], '', '', '', 0
    for raw in L:
        l = sp(raw)
        if not l: continue
        l = l.replace('\x02', '')
        if title_of(l): title = title_of(l); buf = []; continue
        if JUNK.match(l): continue
        if re.match(r'^for\b', l, re.I) and '₹' not in l and maker_of(l): mk = maker_of(l); model = ''; buf = []; continue
        buf.append(l)
        m = PRICE.search(l)
        if not m: continue
        i = next((k for k, x in enumerate(buf) if PN.match(x.split(' ')[0]) and (len(x.split(' ')) > 1 or k < len(buf) - 1) and not (k == 0 and len(buf) > 1 and len(x.split(' ')) == 1 and PN.match(buf[1].split(' ')[0]) and '₹' not in x)), None)
        if i is None: skipped += 1; buf = []; continue
        if i > 0 and len(buf[i - 1]) < 60: model = buf[i - 1]
        body = sp(' '.join(buf[i:])); buf = []
        body = PRICE.sub('', body).strip()
        toks = body.split(' '); pn = toks[0]; rest = toks[1:]; oem = []
        if rest and is_ref(rest[0]): oem = [rest[0]]; rest = rest[1:]
        while rest and (rest[0] == '-' or re.match(r'^\d{4}[A-Z]{1,2}$', rest[0]) or (oem and is_ref(rest[0]) and '-' in rest[0])): rest = rest[1:]   # the maker's own old code / a second print of the number
        nm = sp(' '.join(rest))
        r = {'pn': pn, 'nm': nm, 'mk': mk, 'veh': model, 'sec': sec_of(pn, title), 'mrp': num(m.group(1)), 'oem': oem}
        o = out.get(pn)
        if not o: out[pn] = r
        else:                                                                                # the same part under another bike: bikes joined, higher MRP
            if model and model.upper() not in o['veh'].upper(): o['veh'] = sp(o['veh'] + ' / ' + model)
            if mk and mk not in o['mk'].split(' / '): o['mk'] = (o['mk'] + ' / ' + mk).strip(' /')
            o['mrp'] = max(o['mrp'], r['mrp']); o['oem'] += [x for x in oem if x not in o['oem']]
            if len(nm) > len(o['nm']) and len(o['nm']) < 12: o['nm'] = nm
    return out, skipped


# the lockset catalogue prints bike names with letters missing: the commonest put right (only used when the price list has no name)
FIX = [('HRO HNDA', 'HERO HONDA'), ('HRO', 'HERO'), ('HNDA', 'HONDA'), ('BAJ', 'BAJAJ'), ("TV'S", 'TVS'), ('YAMA', 'YAMAHA'), ('SPLENDR', 'SPLENDOR'), ('PASION', 'PASSION'), ('CHTK', 'CHETAK'),
       ('DWN', 'DAWN'), ('DLX', 'DELUXE'), ('STR', 'STAR'), ('PIAGIO', 'PIAGGIO'), ('KINETC', 'KINETIC'), ('ENFELD', 'ENFIELD'), ('BRVO', 'BRAVO')]


def fix(s):
    for a, b in FIX: s = re.sub(r'(?<![A-Z])' + re.escape(a) + r'(?![A-Z])', b, s)
    return s


def parse_lock(txt):
    L = txt.split('\n'); end = next((i for i, l in enumerate(L) if 'FOUR WHEELER LOCK SETS' in l), len(L)); L = L[:end]
    out, cur, mk, model = {}, None, '', ''
    row = re.compile(r'^(\S+) +(.*?) {2,}([\d,]+\.\d\d) +\d+ *$')
    for raw in L:
        if not raw.strip(): cur = None; continue
        if raw.startswith(' '):
            t = sp(raw)
            if re.search(r'LOCK SETS|Part No\.|Incl\. of all|^\d{1,3}$', t): cur = None; continue
            if cur is not None and len(raw) - len(raw.lstrip()) < 40 and not re.search(r'LTD|LIMITED|WHEELER', t) and not out[cur].get('_done'): out[cur]['nm'] = sp(out[cur]['nm'] + ' ' + t); continue
            if re.search(r'LTD\.?$|LIMITED$|^BAJ AUTO$|WHEELER', t): mk = maker_of(fix(t)) or mk; model = fix(t) if 'WHEELER' in t else ''; cur = None; continue
            model = fix(t); cur = None; continue
        m = row.match(raw)
        if not m or not PN.match(m.group(1)): cur = None; continue
        pn, mid = m.group(1), m.group(2).strip(); a = re.split(r' +', mid, maxsplit=1); oem = []
        if is_ref(a[0]) and len(a) > 1: oem, mid = [a[0]], a[1]
        r = {'pn': pn, 'nm': sp(mid), 'mk': mk, 'veh': model, 'sec': sec_of(pn, 'Lock'), 'mrp': num(m.group(3)), 'oem': oem}
        o = out.get(pn)
        if not o: out[pn] = r; cur = pn
        else:
            if model and model.upper() not in o['veh'].upper(): o['veh'] = sp(o['veh'] + ' / ' + model)
            o['mrp'] = max(o['mrp'], r['mrp']); o['oem'] += [x for x in oem if x not in o['oem']]; o['_done'] = 1; cur = None
    for o in out.values(): o.pop('_done', None); o['nm'] = fix(o['nm'])
    return out


def main(list_f, lock_f, out_f):
    new, skipped = parse_list(open(list_f, errors='replace').read()); old = parse_lock(open(lock_f, errors='replace').read())
    rows, hi_old = [], 0
    for pn in sorted(set(new) | set(old)):
        n, o = new.get(pn), old.get(pn)
        r = dict(n or o)
        if n and o:
            if o['mrp'] > n['mrp']: r['mrp'] = o['mrp']; hi_old += 1                       # Sam: two lists, two MRPs = the higher one
            r['oem'] = n['oem'] + [x for x in o['oem'] if x not in n['oem']]
            if len(n['nm']) < 8: r['nm'] = o['nm']
            if not n['veh']: r['veh'] = o['veh']
        r['oem'] = [x for x in r['oem'] if x != pn]
        if r['sec'] == 'Lubricant': continue                                                # oils: not a bike's part
        if re.match(r'^Instrument Cluster', r['nm'], re.I): r['sec'] = 'Instrument cluster'
        if r['sec'] in NO_MAKER_HEADINGS: r['mk'] = ''                                      # these pages have no maker headings: the maker only when the line names it
        r['mk'] = mk_fix(r['mk'], r['veh'] + ' ' + r['nm'])
        r['fit'] = r['veh']; r['hay'] = r['nm'] if r['sec'] != 'Control cable' else ''
        if r['mrp'] <= 0: continue                                                          # a line with no MRP printed
        rows.append(r)
    json.dump({'brand': 'Spark Minda', 'src': 'Spark Minda price list 1 Oct 2024 + lockset catalogue 2019 (the higher MRP)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False, separators=(',', ':'))
    c = lambda f: sum(1 for r in rows if f(r))
    print('parts', len(rows), '| price list', len(new), '| lockset', len(old), '| in both', c(lambda r: r['pn'] in new and r['pn'] in old), '| lockset MRP higher', hi_old,
          '| with original number', c(lambda r: r['oem']), '| no MRP', c(lambda r: r['mrp'] <= 0), '| price lines not read', skipped)


if __name__ == '__main__':
    main(*sys.argv[1:4])
