// 21r (Sam 13 Nov): a counter return or exchange only within 7 days of the bill date, for every login;
// an older bill shows why, with a way to Warranty claim, and crSave refuses it. Day 7 still works.
// usage: node tools/test_ret21r.mjs   (own server on 3038 with a fresh database)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn, spawnSync } from 'node:child_process'; import fs from 'node:fs';
import { openStore } from '../lib/store.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// a server left on 3038 by an earlier run would answer with its old database: stop it first (by its PORT, never pkill -f)
spawnSync('bash', ['-c', 'for pid in $(pgrep -x node); do if tr "\\0" "\\n" < /proc/$pid/environ 2>/dev/null | grep -qx "PORT=3038"; then kill $pid; fi; done; sleep 0.5']);
const T = '/tmp/claude-0/bptest-ret21r'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/pf', { recursive: true }); fs.mkdirSync(T + '/data', { recursive: true });
const MGR = 'mgr21r@test.in';
await new Promise(r => spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', MGR, 'Mona Manager', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }).on('exit', r));
{ // the counter-return screen is a Billing / Manager screen: the login is made as Admin, then turned into a Manager
  const st = openStore(T + '/data'); const acc = JSON.parse(st.stateGet('accounts').json);
  acc[MGR] = { ...acc[MGR], role: 'manager', label: 'Manager' }; st.write({ accounts: JSON.stringify(acc), staffRole: JSON.stringify({ [MGR]: 'Manager' }) }); st.close();
}
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3038', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', PUBLIC_DIR: 'public' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const BASE = 'http://127.0.0.1:3038';
let b;
try {
  b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.evaluate(async a => { await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a, password: 'Test@1234' }) }); }, MGR);
  await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.user && S.stack && S.stack.length, null, { timeout: 15000 });
  ok(await p.evaluate(() => S.user.role === 'manager'), 'logged in as Manager');
  await p.evaluate(() => { const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const pid = 'T21R-P1'; if (!PX(pid)) PRODUCTS.push({ id: pid, name: 'Test brake shoe', pn: pid, brand: 'Test', cat: 'Brakes', price: 100, mp: 100, mrp: 100, cost: 60, ic: 'package', type: '', fits: '', war: 0 }); DB.stock[pid] = 5;
    [['T21R-OLD', 8], ['T21R-7D', 7], ['T21R-NEW', 0]].forEach(([id, n]) => DB.bills.unshift({ id, items: [{ pid, q: 2, r: 100 }], amt: 200, pm: 'Cash', kind: 'walk', iso: ago(n), t: '10:00' })); save(); });
  const open = async id => { await p.evaluate(id => { closeSheet(); S.ui.crq = id; S.ui.crSel = {}; go('creturn'); }, id); await p.waitForTimeout(900); return p.evaluate(() => { const e = [...document.querySelectorAll('#vp .screen')].pop(); return e ? e.innerText : ''; }); };
  let t = await open('T21R-OLD');
  ok(/Returns and exchanges are only within 7 days of the bill/.test(t) && /8 days ago/.test(t), 'a bill from 8 days ago: says returns are only within 7 days');
  ok(!/Pick items to return/i.test(t) && !/Confirm return/i.test(t), '...no item picker and no Confirm return');
  ok(await p.locator('button', { hasText: 'Warranty claim' }).count() >= 1, '...a Warranty claim button for a fault under warranty');
  const r0 = await p.evaluate(() => (DB.returns || []).length);
  await p.evaluate(() => { S.ui.crSel = { ['T21R-P1']: 1 }; S.ui.crMode = 'Cash'; crSave('T21R-OLD', 100); }); await p.waitForTimeout(200);
  ok(await p.evaluate(r0 => (DB.returns || []).length === r0 && !(DB.approvals || []).some(a => a.ret && a.ret.bid === 'T21R-OLD'), r0), 'crSave refuses the old bill (no return, no approval)');
  t = await open('T21R-7D');
  ok(/Pick items to return/i.test(t) && /Confirm return/i.test(t), 'a bill from 7 days ago can still be returned');
  await p.evaluate(() => { S.ui.crSel = { ['T21R-P1']: 1 }; S.ui.crMode = 'Cash'; crSave('T21R-7D', 100); closeSheet(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(r0 => DB.returns.length === r0 + 1 && DB.returns[0].bill === 'T21R-7D', r0), '...and the return goes through');
  t = await open('T21R-NEW');
  ok(/Pick items to return/i.test(t), "today's bill can be returned");
  await p.evaluate(() => go('wclaim')); await p.waitForTimeout(300);
  ok(await p.evaluate(() => cur().s === 'wclaim'), 'Warranty claim opens');
} finally { if (b) await b.close(); await new Promise(r => { srv.on('exit', r); srv.kill(); setTimeout(r, 3000); }); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
