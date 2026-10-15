// update 9c: the server checks from the 10-pass review (customers, mechanics' prices, staff limits, audit, rates)
// usage: BASE=http://127.0.0.1:3015 node tools/test_9c.mjs   (after test.mjs: the shop has p1..p8 and staff logins)
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
function client() {
  let ck = '';
  const call = async (m, p, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = /bp_s=([^;]*)/.exec(sc); if (v) ck = v[1] ? 'bp_s=' + v[1] : ''; } return r.json().catch(() => ({})); };
  return { call, get rev() { return this._rev || 0; }, set rev(v) { this._rev = v; } };
}
async function login(c, id, pw) {
  if (pw) return c.call('POST', '/api/login', { id, password: pw });
  await c.call('POST', '/api/otp', { id }); return c.call('POST', '/api/login', { id, otp: '123456', signup: { name: 'Test ' + id.slice(-4) } });
}
const sync = async (c, changes) => { const st = await c.call('GET', '/api/sync?since=0'); return c.call('POST', '/api/sync', { base: st.rev, changes }); };
const view = async c => (await c.call('GET', '/api/sync?since=0')).changed;

const anon = client();
const boot = await anon.call('GET', '/api/boot');
const np = (boot.db.newProducts || []);
ok(np.length && np.every(p => p.mp === undefined), 'logged out: no mechanic price in the products');
ok(Object.values(boot.db.prices || {}).every(p => !p || p.mp === undefined), 'logged out: no mechanic price in prices');

const A = client(); await login(A, 'sam@bikepharma.com', 'Test@1234');
const S0 = await view(A); const st0 = S0.stock || {};
const C = client(); const L = await login(C, '9123400777');
ok(L.user && L.user.role === 'customer', 'customer login');
ok((L.db.newProducts || []).every(p => p.mp === undefined), 'customer: no mechanic price');

// stock and notifications are not the customer's to write
await sync(C, { stock: { p1: 0, p2: 99999 }, notifs: 777 });
const s1 = (await view(A)).stock;
ok(s1.p1 === st0.p1 && s1.p2 === st0.p2, 'customer cannot write the shop stock');

// wallet: no free money
await sync(C, { cwl: { '9123400777': [{ d: '15 Oct', t: 'Gift', cr: 50000 }] } });
ok(!((await view(A)).cwl || {})['9123400777']?.some(e => e.cr === 50000), 'customer cannot give themselves wallet money');

// a fake delivered order at Rs 1 is refused; a real one is Confirmed and takes stock
const cv = await view(C); const pr = (S0.prices || {}).p1?.price || (S0.newProducts || []).find(p => p.id === 'p1').price;
await sync(C, { orders: [{ id: 'BP-ORD-X1', mob: '9123400777', st: 'Delivered', amt: 1, list: [['p1', 1, 1]] }, ...(cv.orders || [])] });
ok(!((await view(A)).orders || []).some(o => o.id === 'BP-ORD-X1'), 'order below the shop price is refused');
const big = (st0.p1 || 0) + 5;
await sync(C, { orders: [{ id: 'BP-ORD-X2', mob: '9123400777', st: 'Confirmed', amt: pr * big, list: [['p1', big, pr]] }] });
ok(!((await view(A)).orders || []).some(o => o.id === 'BP-ORD-X2'), 'order above the stock is refused (no overselling)');
await sync(C, { orders: [{ id: 'BP-ORD-X3', mob: '9123400777', st: 'Delivered', amt: pr * 2, list: [['p1', 2, pr]], fee: 0, w: 0 }],
  cwl: { '9123400777': [{ d: '15 Oct', t: 'Cashback · BP-ORD-X3', cr: Math.round(pr * 2 * 0.02) }] },
  warranties: [{ id: 'W-X3', inv: 'BP-ORD-X3', pid: 'p1', party: '9123400777', qty: 2, days: 180, start: '2026-10-15' }, { id: 'W-FAKE', inv: 'BP-ORD-NONE', pid: 'p4', party: '9123400777', qty: 1, days: 365, start: '2026-10-15' }] });
const v3 = await view(A); const o3 = (v3.orders || []).find(o => o.id === 'BP-ORD-X3');
ok(o3 && o3.st === 'Confirmed', 'a real order is saved as Confirmed (not Delivered) ' + (o3 && o3.st));
ok(v3.stock.p1 === st0.p1 - 2, 'the server takes the 2 pcs out of stock ' + v3.stock.p1);
ok((v3.cwl['9123400777'] || []).some(e => e.t === 'Cashback · BP-ORD-X3'), 'cashback of that order is kept');
ok(v3.warranties.some(w => w.id === 'W-X3') && !v3.warranties.some(w => w.id === 'W-FAKE'), 'warranty only for the order\'s own part');
await sync(C, { orders: [{ ...o3, st: 'Delivered', amt: 1 }] });
ok(((await view(A)).orders || []).find(o => o.id === 'BP-ORD-X3').amt === o3.amt, 'customer cannot change an order already placed');

// part order: kept, no advance
await sync(C, { sorders: [{ id: 'SO-X1', pid: 'p7', q: 1, mob: '9123400777', name: 'T', adv: 5000, amt: 1, deliv: 'Pickup at store', src: 'App', log: [] }] });
const so = ((await view(A)).sorders || []).find(o => o.id === 'SO-X1');
ok(so && so.adv === 0 && so.amt > 1, 'customer part order is saved, no advance, shop price ' + JSON.stringify(so && [so.adv, so.amt]));

// papers are per customer
await sync(C, { docs: [{ t: 'Insurance', n: 'POL-1' }] });
const C2 = client(); await login(C2, '9123400778');
ok(!(await view(C2)).docs, 'another customer does not see the first one\'s papers');
ok(JSON.stringify((await view(C)).docs) === JSON.stringify([{ t: 'Insurance', n: 'POL-1' }]), 'the customer sees their own papers');

// log out from all devices
const C3 = client(); await login(C3, '9123400777');
await C3.call('POST', '/api/logout', { all: true });
ok((await C.call('GET', '/api/sync?since=0')).error, 'log out from all devices ends the other session too');

// staff: audit only grows, limits Admin only, Accountant no stock, rates hidden
const SID = process.env.STAFF_ID || 'priya@test.in'; await A.call('POST', '/api/users/password', { id: SID, password: 'Staff9c@pw' });
const M = client(); const ml = await login(M, SID, 'Staff9c@pw');
if (ml.user) {
  const n0 = ((await view(A)).audit || []).length;
  await sync(M, { audit: [], poLimit: 99999999, retLimit: 99999999 });
  const v = await view(A);
  ok((v.audit || []).length >= n0, 'staff cannot wipe the audit log');
  ok(!(+v.poLimit > 1e7) && !(+v.retLimit > 1e7), 'staff cannot raise the limits');
  const mv = await view(M);
  ok(!('sal' in mv) && (mv.grns || []).every(g => g.billAmt === undefined && (g.items || []).every(i => i.rate === undefined)), 'billing gets no salaries and no purchase rates');
} else console.log('SKIP staff checks (no staff login on this server)');

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
