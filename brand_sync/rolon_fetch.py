#!/usr/bin/env python3
"""update 19r (11 Nov 2026): fresh Rolon data before the weekly PDF.
Sam's rolon_full_dump.py (beside this file, unchanged) skips everything already in ~/rolon_dump/_state.json, so a
second run brings nothing new. This puts the old file aside, lets his script read the whole list again, and keeps
the new file only when it is complete; otherwise the old one comes back and the PDF step is not run.
Kit contents (_kits.json) are not fetched by any saved script: they stay as they are."""
import json, os, shutil, subprocess, sys
O = os.path.expanduser('~/rolon_dump'); S = os.path.join(O, '_state.json'); P = os.path.join(O, '_state.prev.json')
DUMP = os.environ.get('ROLON_DUMP') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rolon_full_dump.py')

def info(p):
    try:
        st = json.load(open(p, encoding='utf-8'))
        want = len({f"{k}|{b.get('type')}" for k, v in (st.get('brands') or {}).items() for b in (v or [])})   # same group name twice = one group
        m = st.get('master') or {}
        return sum(len(v or []) for v in m.values()), len(m), want
    except Exception:
        return 0, 0, 0

old = info(S)[0]
if os.path.exists(S):
    shutil.copy2(S, P); os.remove(S)
rc = subprocess.run([sys.executable, '-u', DUMP]).returncode
rows, got, want = info(S)
ok = rc == 0 and rows > 0 and want > 0 and got == want and rows >= 0.8 * old
if not ok:
    print(f'ROLON FETCH NOT COMPLETE: rc={rc} parts={rows} (before {old}) groups={got}/{want}', flush=True)
    if os.path.exists(P):
        shutil.copy2(P, S); print('old data put back', flush=True)
    sys.exit(1)
print(f'ROLON FETCH OK: parts {old} -> {rows}, groups {got}', flush=True)
