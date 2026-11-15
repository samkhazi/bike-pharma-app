"""23g: a brand list's MRP that falls over 80% is held (old MRP stays) until accepted. Run: python3 tools/test_mrpguard23g.py"""
import os, sys, json, csv, tempfile, subprocess
BS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'brand_sync')
D = tempfile.mkdtemp(prefix='mrpguard'); os.environ['DATA_DIR'] = D
sys.path.insert(0, BS)
from common import mrp_guard, Report, save_json, load_json
ok = bad = 0
def t(name, cond):
    global ok, bad
    if cond: ok += 1
    else: bad += 1
    print(('ok   ' if cond else 'FAIL ') + name)

st, r = {}, Report('x')
t('1675 -> 35.64 is held', mrp_guard(st, r, 'A', 1675, 35.64, 'COVER') == 1675 and st['mrp_hold']['A']['new'] == 35.64)
t('report has the doubtful line', r.lines and r.lines[0][0] == 'Shak wala MRP (purana rakha)' and 'Rs 1675 -> Rs 35.64' in r.lines[0][1])
t('617 -> 710 passes', mrp_guard(st, r, 'B', 617, 710) == 710 and 'B' not in st['mrp_hold'])
t('1000 -> 300 (70% fall) passes', mrp_guard(st, r, 'C', 1000, 300) == 300)
t('1000 -> 199 (over 80%) held', mrp_guard(st, r, 'D', 1000, 199) == 1000)
t('1000 -> 0 held', mrp_guard(st, r, 'E', 1000, 0) == 1000)
t('0 -> 1775 passes', mrp_guard(st, r, 'F', 0, 1775) == 1775)
t('small price 15 -> 1 passes (under Rs 20)', mrp_guard(st, r, 'G', 15, 1) == 1)
t('no old price passes', mrp_guard(st, r, 'H', None, 5) == 5)
t('no new price passes as it is', mrp_guard(st, r, 'I', 500, None) is None)
t('text prices (Hero) held', mrp_guard(st, r, 'J', '1200', '30') == '1200')
st['mrp_ok'] = {'A': 35.64}
t('accepted value passes and leaves the list', mrp_guard(st, r, 'A', 1675, 35.64) == 35.64 and 'A' not in st['mrp_hold'])
t('accepted part, another low value is held again', mrp_guard(st, r, 'A', 1675, 20) == 1675)
t('back to normal clears the hold', mrp_guard(st, r, 'D', 1000, 990) == 990 and 'D' not in st['mrp_hold'])

# Yamaha merge: the three real lines of 14 Nov
from brands.yamaha import Yamaha
y = Yamaha()
y.state.update({'mrp': {'B4GXF41350P0': {'name': 'TANK SIDE COVER 2', 'mrp': 1675.0}, 'B62XF83H00P4': {'name': 'PANEL COMP 1', 'mrp': 617.0},
                        'BTAF588F0000': {'name': 'HOLDER, BRAKE HOSE 5', 'mrp': 70.0}}, 'sup': [], 'kits': {}, 'models': {}})
rep = Report('Yamaha')
try:
    y.merge_parts(rep, [], [['B4GXF41350P0', 'TANK SIDE COVER 2', 35.64], ['B62XF83H00P4', 'PANEL COMP 1', 710], ['BTAF588F0000', 'HOLDER, BRAKE HOSE 5', 1.49]], [], {})
except Exception as e:
    print('merge_parts stopped after the MRP part:', type(e).__name__, e)
m = y.state['mrp']
t('Yamaha: tank cover keeps Rs 1675', m['B4GXF41350P0']['mrp'] == 1675.0)
t('Yamaha: brake hose holder keeps Rs 70', m['BTAF588F0000']['mrp'] == 70.0)
t('Yamaha: panel goes to Rs 710', m['B62XF83H00P4']['mrp'] == 710)
t('Yamaha: only the real change is in MRP badla', [c['part_no'] for c in y.changes] == ['B62XF83H00P4'])
t('Yamaha: two doubtful lines in the report', rep.counts.get('Shak wala MRP (purana rakha)') == 2)

# a run that already applied the wrong price (server, 14 Nov): --mrp-recheck puts it back, --mrp-ok accepts
y.state['mrp'] = {'B4GXF41350P0': {'name': 'TANK SIDE COVER 2', 'mrp': 35.64}, 'B62XF83H00P4': {'name': 'PANEL COMP 1', 'mrp': 710.0},
                  'BTAF588F0000': {'name': 'HOLDER, BRAKE HOSE 5', 'mrp': 1.49}, 'BTAF151100P0': {'name': 'FENDER', 'mrp': 1800.0}}
y.state.pop('mrp_hold', None); save_json(y.state_path, y.state)
f = os.path.join(D, 'mrp_changes.csv')
with open(f, 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['part_no', 'old_mrp', 'new_mrp', 'name'])
    w.writerows([['B4GXF41350P0', 1675.0, 35.64, 'TANK SIDE COVER 2'], ['B62XF83H00P4', 617.0, 710.0, 'PANEL COMP 1'],
                 ['BTAF588F0000', 70.0, 1.49, 'HOLDER, BRAKE HOSE 5'], ['BTAF151100P0', 9000.0, 1775.0, 'FENDER']])
run = lambda *a: subprocess.run([sys.executable, 'sync.py', 'yamaha', *a], cwd=BS, env={**os.environ, 'DATA_DIR': D}, capture_output=True, text=True)
o = run('--mrp-recheck', f); print(o.stdout.strip(), o.stderr.strip()[-600:])
s = load_json(y.state_path, {})
t('recheck: tank cover back to Rs 1675', s['mrp']['B4GXF41350P0']['mrp'] == 1675.0)
t('recheck: brake hose holder back to Rs 70', s['mrp']['BTAF588F0000']['mrp'] == 70.0)
t('recheck: normal change untouched', s['mrp']['B62XF83H00P4']['mrp'] == 710.0)
t('recheck: a part whose price moved on since is untouched', s['mrp']['BTAF151100P0']['mrp'] == 1800.0)
t('recheck: both are in the held list', sorted(s.get('mrp_hold', {})) == ['B4GXF41350P0', 'BTAF588F0000'])
o = run('--mrp-ok', 'BTAF588F0000'); print(o.stdout.strip(), o.stderr.strip()[-600:])
s = load_json(y.state_path, {})
t('ok: accepted part takes the new MRP', s['mrp']['BTAF588F0000']['mrp'] == 1.49 and 'BTAF588F0000' not in s['mrp_hold'])
t('ok: the other stays held at the old MRP', s['mrp']['B4GXF41350P0']['mrp'] == 1675.0 and 'B4GXF41350P0' in s['mrp_hold'])
print(f'{ok} passed, {bad} failed'); sys.exit(1 if bad else 0)
