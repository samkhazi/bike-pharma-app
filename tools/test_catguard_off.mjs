// 21f: without CAT_LIMIT=on no login is stopped (downloads are still counted); with it the daily stop works as before.
import { catGuard } from '../lib/catguard.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const mk = env => { const kv = new Map(); const store = { kvGet: (n, k) => kv.get(n + '/' + k), kvSet: (n, k, v) => kv.set(n + '/' + k, v), kvDel: (n, k) => kv.delete(n + '/' + k), kvAll: n => [...kv].filter(([k]) => k.startsWith(n + '/')).map(([k, v]) => [k.slice(n.length + 1), v]) };
  return { kv, g: catGuard(store, fs.mkdtempSync(path.join(os.tmpdir(), 'cg')), env) }; };
const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), a = { id: 'A', role: 'admin', name: 'SK' }, m = { id: 'M', role: 'manager', name: 'Mg' };
let { kv, g } = mk({ CAT_DAY_MB: 1 });
kv.set('catblock/A|' + day, { at: 'x', kind: 'cat' });   // stopped before the update
ok(g.check(a) === null, 'a login stopped earlier today is open again');
g.count(m, 'cat', 5e6, 'cat/x.json', 'ip'); g.stop(m, 'lines', 'ip');
ok(g.check(m) === null, 'staff far over the old limit is not stopped');
const r = g.report(); ok(r.on === false && !r.stopped.length && r.use.some(u => u.id === 'M' && u.catMB > 4), 'the download is still counted for Admin');
({ kv, g } = mk({ CAT_DAY_MB: 1, CAT_LIMIT: 'on' }));
g.count(m, 'cat', 5e6, 'cat/x.json', 'ip'); ok(!!g.check(m) && g.report().stopped.length === 1, 'CAT_LIMIT=on: the daily stop works as before');
process.exit(fails ? 1 : 0);
