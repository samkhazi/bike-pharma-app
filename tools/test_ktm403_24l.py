#!/usr/bin/env python3
"""24l: KTM weekly sync and the portal's 403 on a plate page. Fake browser (no network):
  B: one plate always 403 -> that model year is left for the next run (old data kept, 'tried' set, report line), the others are read
  C: one plate 403 once -> read after the wait
  second run with two model years refused -> the run stops reading, still ends cleanly.
  python3 tools/test_ktm403_24l.py"""
import os, sys, types, tempfile, json
tmp = tempfile.mkdtemp(); os.environ.update(DATA_DIR=tmp, KTM_403_WAIT='0', KTM_DELAY='0', KTM_RECHECK='8')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'brand_sync'))
BAD, ONCE, waits, calls = set(), {}, [], []
class Page:
    url = 'https://ktmspcatalog.bajajauto.com/index'
    def goto(self, u, **k): return types.SimpleNamespace(status=200)
    def set_default_timeout(self, t): pass
    def wait_for_timeout(self, ms): waits.append(ms)
    def screenshot(self, **k): pass
    def evaluate(self, expr, arg=None):
        if 'kMenu' in expr: return {'menu': [{'m': 1, 'y': y, 'my': 'MY-%d' % y, 'model': 'DUKE'} for y in (1, 2, 3, 4)], 'links': []}
        if 'kLinks' in expr: return []
        if 'kPlates' in expr: return [{'href': 'https://ktmspcatalog.bajajauto.com/result/%d/%d' % (arg[1], n), 'text': '%d PLATE' % n, 'row': '', 'kind': 'Engine', 'flag': 1} for n in (1, 2, 3)]
        if 'kPlate' in expr:
            calls.append(arg); k = arg.split('/result/')[1]
            if k in BAD or ONCE.get(k, 0) > 0:
                ONCE[k] = ONCE.get(k, 0) - 1; raise Exception('Page.evaluate: HTTP 403')
            return {'head': ['Ref', 'Part No', 'Description', 'Qty', 'Remarks'], 'rows': [['1', '90111111000', 'BOLT ' + k, '1', '']], 'imgs': [], 'title': ['ENGINE']}
        return None
class Ctx:
    pages = [Page()]
    def close(self): pass
pw = types.ModuleType('playwright'); sa = types.ModuleType('playwright.sync_api')
class SP:
    def __enter__(self): return types.SimpleNamespace(chromium=types.SimpleNamespace(launch_persistent_context=lambda *a, **k: Ctx()))
    def __exit__(self, *a): pass
sa.sync_playwright = lambda: SP(); sys.modules.update({'playwright': pw, 'playwright.sync_api': sa})
from brands import ktm
ok = fail = 0
def chk(name, c):
    global ok, fail
    print('ok  ' if c else 'FAIL', name); ok, fail = ok + bool(c), fail + (not c)
cls = next(v for v in vars(ktm).values() if isinstance(v, type) and hasattr(v, 'read_edition'))
def run():
    b = cls(); rep, _ = b.run(); return b, rep
b, rep = run()                                                       # first run: everything read
chk('first run reads 4 model years', len(b.state['editions']) == 4 and all(v.get('plates') == 3 for v in b.state['editions'].values()))
for v in b.state['editions'].values(): v['read'] = '2026-01-0' + str(v['y'])
json.dump(b.state, open(b.state_path, 'w')); b._lock.close()
BAD.add('2/2'); ONCE['3/1'] = 1; calls.clear(); waits.clear()
b, rep = run(); E = b.state['editions']; md = rep.markdown()
chk('refused model year keeps old data and gets tried', E['1_2']['read'] == '2026-01-02' and E['1_2'].get('tried') and E['1_2']['plates'] == 3)
chk('others read today', all(E[k]['read'] > '2026-01-09' for k in ('1_1', '1_3', '1_4')))
chk('403 once is read after one wait', calls.count('https://ktmspcatalog.bajajauto.com/result/3/1') == 2)
chk('refused page asked twice only', calls.count('https://ktmspcatalog.bajajauto.com/result/2/2') == 2)
chk('report says it', 'Agli baar' in md and 'MY-2' in md and '403' in md)
chk('run ended (last_run)', bool(b.state.get('last_run')))
b._lock.close(); BAD.update({'1/1', '3/3'}); calls.clear()
for v in E.values(): v['read'] = '2026-01-0' + str(v['y'])
E['1_2'].pop('tried', None); BAD.discard('2/2'); json.dump(b.state, open(b.state_path, 'w'))
b, rep = run(); E = b.state['editions']
chk('two refused: stops, 4th not asked', not any('/result/4/' in c for c in calls) and E['1_4']['read'] == '2026-01-04')
chk('2nd was read before the stop', E['1_2']['read'] > '2026-01-09')
chk('still ends cleanly', bool(b.state.get('last_run')) and 'do model-year' in rep.markdown())
print(ok, 'pass,', fail, 'fail'); sys.exit(1 if fail else 0)
