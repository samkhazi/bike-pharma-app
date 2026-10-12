// Update 8n (Sam 2026-10-12, thread "Billing profile"): no bill discount, warranty claims, bill cancel / change through Manager,
// split cash + UPI + udhaar, udhaar above the limit through Manager, estimate to bill, WhatsApp on the bill-made sheet.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function mk(w, h) { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errs.push(w + ' console: ' + m.text()); }); return p; }
async function login(p, id, pw) {
  await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(400);
  await p.fill('#loginId', id); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', pw); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
}
const T = p => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
const ST = p => p.evaluate(() => (document.querySelector('.sheet') || {}).innerText || '');
const SC = '#vp .screen:last-child';
const sync = p => p.waitForTimeout(2500);
const fresh = async p => { await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.user && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(600); };

const Ad = await mk(1440, 900); await login(Ad, 'sam@bikepharma.com', 'Test@1234');
for (const [role, n, e, pw] of [['Billing', 'Bina Billing', 'bina@test.in', 'bina1234'], ['Manager', 'Mona Manager', 'mona8n@test.in', 'mona1234']]) {
  await Ad.evaluate(r => { S.ui.ns = null; go('newstaff'); S.ui.ns.role = r; refresh(); }, role); await Ad.waitForTimeout(300);
  await Ad.fill('#ns1', n); await Ad.fill('#ns2', e); await Ad.fill('#ns3', pw); await Ad.click(SC + ' .foot .btn'); await Ad.waitForTimeout(900); await Ad.evaluate(() => closeSheet());
}
ok(await Ad.evaluate(() => DB.accounts['bina@test.in'].role === 'billing' && DB.accounts['mona8n@test.in'].role === 'manager'), 'admin made Billing and Manager logins');
await sync(Ad);

const B = await mk(390, 844); await login(B, 'bina@test.in', 'bina1234');
ok(await B.evaluate(() => S.user.role === 'billing'), 'billing logged in');
const pid = await B.evaluate(() => (PRODUCTS.find(x => x.warDays > 0 && DB.stock[x.id] > 3) || {}).id);
ok(!!pid, 'a part with warranty in stock ' + pid);

// 1. no discount box
await B.evaluate(id => { S.ui.inv = null; tab('invoice'); S.ui.inv.mob = '9876543210'; S.ui.inv.items[id] = 2; refresh(); }, pid); await B.waitForTimeout(300);
let t = await T(B);
ok(!/Extra discount/i.test(t) && !/approve \d+%/i.test(t), 'invoice: no extra discount / discount request');
ok(await B.evaluate(() => invDisc({ disc: 12 }) === 0), 'invDisc is always 0');

// 2. split must add up; cash part counts in Cash collected
const tot = await B.evaluate(id => P(id).price * 2, pid);
await B.evaluate(() => { S.ui.inv.pm = 'Split'; S.ui.inv.sp = { cash: '100', upi: '50' }; refresh(); }); await B.waitForTimeout(200);
ok(/Split payment/i.test(await T(B)) && /still to split/i.test(await T(B)), 'split card shows what is left');
const n0 = await B.evaluate(() => DB.bills.length);
await B.evaluate(t => genInvoice(t), tot); await B.waitForTimeout(300);
ok(await B.evaluate(n => DB.bills.length === n, n0), 'split not adding up: no bill');
const c0 = await B.evaluate(() => collected('Cash').total);
await B.evaluate(t => { S.ui.inv.sp = { cash: String(t - 100), upi: '100' }; genInvoice(t); }, tot); await B.waitForTimeout(400);
const bill1 = await B.evaluate(() => DB.bills[0]);
ok(bill1.pm === 'Split' && bill1.split.Cash === tot - 100 && bill1.split.UPI === 100, 'split bill saved with its parts');
ok(await B.evaluate(c => collected('Cash').total, c0) === c0 + tot - 100, 'cash part counted in Cash collected');
t = await ST(B); ok(/WhatsApp bill/i.test(t), 'bill-made sheet has WhatsApp bill');
await B.evaluate(() => closeSheet());

// 3. estimate -> bill
await B.evaluate(id => { S.ui.inv = null; tab('invoice'); S.ui.inv.mob = '9876500000'; S.ui.inv.items[id] = 1; refresh(); estimate(P(id).price); closeSheet(); S.ui.inv = null; tab('bhome'); }, pid); await B.waitForTimeout(300);
t = await T(B); ok(/Estimates/i.test(t) && /Make bill/i.test(t), 'billing home lists the estimate');
await B.evaluate(() => estToBill(DB.ests[0].id)); await B.waitForTimeout(300);
ok(await B.evaluate(id => cur().s === 'invoice' && S.ui.inv.items[id] === 1 && S.ui.inv.mob === '9876500000', pid), 'estimate loaded into the invoice');
await B.evaluate(id => { S.ui.inv.pm = 'UPI'; genInvoice(P(id).price); closeSheet(); }, pid); await B.waitForTimeout(300);
ok(await B.evaluate(() => DB.ests[0].used === DB.bills[0].id), 'estimate marked as billed');

// 4. warranty claim in warranty: Billing gives the replacement itself
const st0 = await B.evaluate(id => DB.stock[id], pid);
await B.evaluate(b => { go('wclaim'); S.ui.wcq = b; refresh(); }, bill1.id); await B.waitForTimeout(300);
ok(/Active/i.test(await T(B)), 'claim search finds the warranty of the bill');
await B.evaluate(b => { wcStart(DB.warranties.find(w => w.inv === b).id); }, bill1.id); await B.waitForTimeout(200);
ok(/Give replacement now/i.test(await ST(B)), 'in warranty: Give replacement now');
await B.evaluate(() => wcMake('give')); await B.waitForTimeout(300);
const wb = await B.evaluate(() => DB.bills[0]);
ok(wb.pm === 'Warranty' && wb.amt === 0 && /^WAR-/i.test(wb.id), 'Rs 0 warranty bill made ' + wb.id);
ok(await B.evaluate(s => DB.stock[DB.wclaims[0].pid] === s - 1 && DB.wclaims[0].st === 'Replaced', st0), 'stock -1, claim Replaced');
await B.evaluate(() => closeSheet());
// warranty over: request to Manager
await B.evaluate(b => { const w = DB.warranties.find(x => x.inv === b); w.start = '2020-01-01'; wcStart(w.id); }, bill1.id); await B.waitForTimeout(200);
t = await ST(B); ok(!/Give replacement now/i.test(t) && /Warranty over/i.test(t), 'warranty over: only Send to Manager');
await B.evaluate(() => { document.getElementById('wc-why').value = 'noise after 2 months'; wcMake('ask'); }); await B.waitForTimeout(300);
ok(await B.evaluate(() => DB.wclaims[0].st === 'Waiting' && DB.approvals[0].wcl === DB.wclaims[0].id), 'claim request in approvals');

// 5. cancel request
await B.evaluate(b => go('billview', { id: b }), bill1.id); await B.waitForTimeout(300);
ok(/Cancel or change this bill/i.test(await T(B)), 'bill view: Cancel or change');
await B.evaluate(b => { brSheet(b); S.ui.br.type = 'Change'; document.getElementById('br-why').value = 'wrong part'; brSend(b); }, bill1.id); await B.waitForTimeout(300);
ok(/waiting for Manager/i.test(await T(B)), 'bill shows the change is waiting');
// udhaar for a mechanic above the limit needs Manager
const mc = await B.evaluate(() => MC0());
await sync(B);

// Manager approves
const M = await mk(1440, 900); await login(M, 'mona8n@test.in', 'mona1234');
await M.evaluate(() => go('approvals')); await M.waitForTimeout(300); t = await T(M);
ok(/Change bill/i.test(t) && /Warranty claim/i.test(t), 'manager sees the bill change and claim requests');
await M.evaluate(() => { for (const a of DB.approvals.filter(a => a.st === 'pending' && (a.br || a.wcl))) decide(a.id, 'approved'); }); await M.waitForTimeout(300);
ok(await M.evaluate(b => DB.bills.find(x => x.id === b).cancel && !billsToday().some(x => x.id === b), bill1.id), 'approved: bill cancelled, out of today\'s sales');
ok(await M.evaluate(b => !DB.warranties.some(w => w.inv === b), bill1.id), 'its warranties removed');
await M.evaluate(() => { S.ui.wcf = 'Open'; go('wclaim'); }); await M.waitForTimeout(300);
ok(/Old part sent to the company/i.test(await T(M)), 'manager can mark the old part sent');
await sync(M);

await fresh(B);
await B.evaluate(b => go('billview', { id: b }), bill1.id); await B.waitForTimeout(300);
ok(/Make the corrected bill/i.test(await T(B)), 'billing: Make the corrected bill');
await B.evaluate(b => blRebill(b), bill1.id); await B.waitForTimeout(300);
ok(await B.evaluate(id => cur().s === 'invoice' && S.ui.inv.items[id] === 2, pid), 'old bill loaded for correction');
await B.evaluate(() => { S.ui.inv = null; tab('bhome'); }); await B.waitForTimeout(300);
t = await T(B); ok(/My requests/i.test(t) && /Approved/i.test(t), 'billing home: My requests with Approved');

// udhaar over limit
if (mc && mc !== 'new') {
  await B.evaluate(c => { S.ui.inv = null; tab('invoice'); S.ui.inv.party = 'mech'; S.ui.inv.mc = c; S.ui.inv.pm = 'Credit'; refresh(); }, mc);
  const need = await B.evaluate(c => blCredNeed(c, 10000000), mc);
  ok(!!need, 'huge udhaar needs Manager: ' + need);
} else ok(true, 'no mechanic in the test shop: udhaar limit check skipped');

// ===== server checks (lib/billguard.mjs): a changed app cannot break the rules =====
const post = (p, changes) => p.evaluate(async c => { const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: SRV.rev, changes: c }), credentials: 'same-origin' }); return r.json(); }, changes);
const srv = (p, k) => p.evaluate(async k => { const r = await fetch('/api/sync?since=0', { credentials: 'same-origin' }); const j = await r.json(); return j.changed[k]; }, k);
await fresh(B);
let bills = await srv(B, 'bills');
const cheap = { id: 'INV-2026-09901', kind: 'cust', pname: 'X', mob: '9876543210', items: [{ pid, q: 1, r: 1, mrp: 549 }], p: 'X', t: '1 PM', iso: '2026-10-12', pm: 'Cash', amt: 1 };
let j = await post(B, { bills: [cheap, ...bills] });
ok(/below the set price/.test(j.why || '') && !(await srv(B, 'bills')).some(b => b.id === cheap.id), 'server refuses a bill below the set price: ' + j.why);
const ap = await srv(B, 'approvals'); const pend = ap.find(a => a.st === 'pending');
if (pend) { await post(B, { approvals: ap.map(a => a.id === pend.id ? { ...a, st: 'approved' } : a) }); ok((await srv(B, 'approvals')).find(a => a.id === pend.id).st === 'pending', 'server: Billing cannot approve a request'); }
else ok(true, 'no pending request to try');
bills = await srv(B, 'bills'); const one = bills.find(b => b.pm !== 'Warranty' && !b.cancel);
await post(B, { bills: bills.map(b => b.id === one.id ? { ...b, amt: 1, cancel: { why: 'x' } } : b) });
let after = (await srv(B, 'bills')).find(b => b.id === one.id);
ok(after.amt === one.amt && !after.cancel, 'server: Billing cannot change or cancel a made bill');
await post(B, { bills: bills.filter(b => b.id !== one.id) });
ok((await srv(B, 'bills')).some(b => b.id === one.id), 'server: Billing cannot delete a bill');
const pr = await srv(B, 'prices'); await post(B, { prices: { ...(pr || {}), [pid]: { price: 1, mp: 1, mrp: 1 } } });
ok(JSON.stringify(await srv(B, 'prices')) === JSON.stringify(pr), 'server: Billing cannot change prices');
const ws = await srv(B, 'warranties'); const wcl = await srv(B, 'wclaims') || [];
const exp = ws.find(w => w.start === '2020-01-01') || ws[0];
const wsOld = ws.map(w => w.id === exp.id ? { ...w, start: '2020-01-01' } : w);
await post(M, { warranties: wsOld }); await fresh(B);
const fake = { id: 'WC-9999', w: exp.id, inv: exp.inv, pid: exp.pid, name: exp.name, inW: true, st: 'Replaced', by: 'x', at: 'x' };
j = await post(B, { wclaims: [fake, ...wcl], bills: [{ id: 'WAR-9999', kind: 'cust', pname: 'X', items: [{ pid: exp.pid, q: 1, r: 0, mrp: 0 }], p: 'X', t: '1 PM', iso: '2026-10-12', pm: 'Warranty', amt: 0, war: 'WC-9999' }, ...(await srv(B, 'bills'))] });
ok(!(await srv(B, 'bills')).some(b => b.id === 'WAR-9999'), 'server refuses a Rs 0 bill when the warranty is over: ' + j.why);
const au = await srv(Ad, 'audit'); ok(au.some(a => a.a === 'Refused by server'), 'refusals are in the Admin audit list');
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
process.exit(fails ? 1 : 0);
