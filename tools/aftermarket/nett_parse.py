#!/usr/bin/env python3
"""A dealer price list with NETT and M.R.P. columns ("MRP NETT.pdf", Feb 2026) -> <brand>.json for Find Part.
usage: nett_parse.py LIST.txt(pdftotext -layout) OUT.json BRAND
Only the M.R.P. column is kept; NETT is the dealer rate and is never stored.
A part whose MRP the list leaves empty goes in without a price."""
import sys, json, re, collections

sp = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
ROW = re.compile(r'^\s*([O\d]\d{0,2})\s+(A[A-Z]{1,6} ?[\dl]{2,4}[A-Z]?)\*?\s+(.*?)\s*$')
DEC = re.compile(r'^\d[\d,]*\.\d\d\.?$')
NUM = re.compile(r'^\d[\d,]*(\.\d\d)?\.?$')
HEAD = re.compile(r'^[A-Z][A-Z0-9 .&/\[\]()-]{2,40}$')
FIX = {'WHEEL CYINDER KITS': 'WHEEL CYLINDER KITS', 'FULE PUMP MOTOR': 'FUEL PUMP MOTOR', 'AIR NIPPEL': 'AIR NIPPLE', 'CARBON BRUSH OEM': 'CARBON BRUSH SET OEM', 'W. C KIT MAJOR': 'WHEEL CYLINDER KIT MAJOR',
       'S.M WARM ASSEMBLY [ANALOG]': 'SELF MOTOR WORM ASSEMBLY (ANALOG)', 'S.M WARM ASSEMBLY [DIGITAL]': 'SELF MOTOR WORM ASSEMBLY (DIGITAL)', 'S.M. CABLE': 'SELF MOTOR CABLE', 'M.C. RUBBER KIT': 'MASTER CYLINDER RUBBER KIT', 'MIX ITEM': 'OTHER PARTS'}
OWN = ('Activa', 'Patti', 'Button', 'Electrical', 'Other parts', 'Plugs', 'Nut bolt', '')
W = {'PULASR': 'PULSAR', 'PILSAR': 'PULSAR', 'GIXER': 'GIXXER', 'MASTRO': 'MAESTRO', 'APRILLA': 'APRILIA', 'ACTIVE': 'ACTIVA', 'HIMALYAN': 'HIMALAYAN', 'HIGHNESS': "H'NESS"}
MK = [('Hero', r'HERO|SPLENDOR|PASSION|GLAMOUR|KARIZMA|CBZ|HUNK|MAESTRO|MASTRO|PLEASURE|XPULSE|IMPULSE|DESTINI|VIDA'), ('Honda', r'HONDA|ACTIVA|ACTIVE|SHINE|UNICORN|DIO|AVIATOR|HORNET|CBR|STUNNER|TWISTER|GRAZIA|LIVO|DAZZLER'),
      ('Bajaj', r'BAJAJ|PULSAR|PULASR|PILSAR|DISCOVER|AVENGER|PLATINA|DOMINAR|CT ?100|VIKRANT'), ('TVS', r'TVS|APACHE|RTR|JUPITER|NTORQ|PEP|WEGO|STAR CITY|RAIDER'), ('Yamaha', r'YAMAHA|FZ|F-Z|R-?15|RAY|FASCINO|SALUTO|AEROX|CRUX|YBX|GLADIATOR|MT-?15'),
      ('Suzuki', r'SUZUKI|ACCESS|GIXX?ER|BURGMAN|ZEUS'), ('Royal Enfield', r'BULLET|ENFIELD|CLASSIC 350|HIMALA?YAN|THUNDER'), ('KTM', r'KTM|DUKE')]


def main(src, out_f, brand):
    L = open(src, encoding='utf-8', errors='replace').read().replace('\f', '\n').split('\n')
    rows, odd, seen, sec, start = [], [], {}, '', False
    for i, l in enumerate(L):
        t = sp(l)
        if not t: continue
        if re.match(r'^SR\.?\s*NO', t): start = start or 'PART NO' in t; continue
        if 'TERMS & CONDITIONS' in t: break
        m = ROW.match(l)
        if not m:
            if HEAD.match(t) and not NUM.match(t): sec = FIX.get(t, t)
            elif start and not NUM.match(t): odd.append(t)
            continue
        if not start: continue
        pn, rest = m.group(2).replace(' ', '').replace('l', '1'), m.group(3).split()   # the list prints a small L for 1 in two codes
        nums = []
        while rest and (NUM.match(rest[-1]) or rest[-1] in ('.', 'P.')): nums.insert(0, rest.pop())
        while len([x for x in nums if NUM.match(x)]) > 2 or (nums and not DEC.match(nums[0]) and NUM.match(nums[0]) and len(nums) > 1 and any(DEC.match(x) for x in nums[1:])):
            rest.append(nums.pop(0))                 # a name that ends in a number (PULSAR 125) keeps it
        nm = veh = sp(' '.join(rest))
        if not nm: odd.append('no name: ' + t); continue
        vals = [x for x in nums if NUM.match(x)]
        if len(vals) == 1 and len(nums) == 2:        # the M.R.P. slipped to the next line
            nx = next((sp(x) for x in L[i + 1:i + 3] if sp(x)), '')
            if NUM.match(nx): vals.append(nx)
        f = lambda x: float(x.rstrip('.').replace(',', ''))
        mrp = 0
        if len(vals) == 2:
            nett, mrp = f(vals[0]), f(vals[1])
            if mrp < nett: odd.append('MRP below NETT, left without price: ' + t); mrp = 0
        elif nums: odd.append('one price only, left without price: ' + t)
        kind = sp(re.sub(r'\bOEM\b', '', sec)).capitalize().replace('[hd]', '(HD)').replace('Abs ', 'ABS ')
        kind = {'Master cylinder kits': 'Master cylinder kit', 'Wheel cylinder kits': 'Wheel cylinder kit', 'Bearings': 'Bearing'}.get(kind, kind)
        if kind not in OWN: nm = kind + ' ' + nm     # these sections print only the bike; the heading is the part's name
        if pn in seen:                               # the list uses a code again in another section: both stay
            if seen[pn] == (kind, nm, mrp): continue
            odd.append('part no. twice: ' + t); pn = '%s (%s)' % (pn, kind)
            if pn in seen: continue
        seen[pn] = (kind, nm, mrp)
        up = nm.upper(); full = sp(re.sub(r'[A-Z]+', lambda x: W.get(x.group(0), x.group(0)), up))
        mk = [n for n, rx in MK if re.search(r'\b(' + rx + r')\b', full)]
        rows.append({'pn': pn, 'nm': nm, 'mk': mk[0] if len(mk) == 1 else '', 'veh': veh, 'sec': kind or 'Part', 'mrp': int(mrp) if mrp == int(mrp) else mrp, 'oem': [], 'fit': full, 'hay': sp(sec + ' ' + full)})
    json.dump({'brand': brand, 'src': brand + ' price list 21-02-2026 (M.R.P. column only)', 'rows': rows}, open(out_f, 'w'), ensure_ascii=False)
    print(len(rows), 'parts,', sum(1 for r in rows if r['mrp']), 'with MRP'); print(dict(collections.Counter(r['sec'] for r in rows)))
    for o in odd: print('  ', o)


if __name__ == '__main__': main(*sys.argv[1:4])
