// Update 8m (Sam 2026-10-12, thread "Manager profile"): purchase rates, bill amounts and gross margin are Admin only. A Manager gets
// Stock in / Add product without rates, no Gross margin or Expenses & profit, no margin target; a purchase order above the limit
// (Rs 1,00,000 per order) waits for Admin's approval; Admin enters the rates of a stock in made without them.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE3 || 'http://127.0.0.1:3017';
const ADMIN = 'sam@bikepharma.com', PW = 'Test@1234';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function mk(w, h) { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(w + ' console: ' + m.text()); }); return p; }
async function login(p, id, pw) {
  await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(400);
  await p.fill('#loginId', id); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', pw); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
}
const T = p => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
const SC = '#vp .screen:last-child';
const sync = p => p.waitForTimeout(2500);

// Admin makes a Manager login and a part in the list
const Ad = await mk(1440, 900); await login(Ad, ADMIN, PW);
ok(await Ad.evaluate(() => S.user && S.user.role === 'admin'), 'admin logged in');
await Ad.evaluate(() => { S.ui.ns = null; go('newstaff'); S.ui.ns.role = 'Manager'; refresh(); }); await Ad.waitForTimeout(300);
await Ad.fill('#ns1', 'Mona Manager'); await Ad.fill('#ns2', 'mona@test.in'); await Ad.fill('#ns3', 'mona1234'); await Ad.click(SC + ' .foot .btn'); await Ad.waitForTimeout(900); await Ad.evaluate(() => closeSheet());
ok(await Ad.evaluate(() => DB.accounts['mona@test.in'] && DB.accounts['mona@test.in'].role === 'manager'), 'admin made a Manager login');
const pid = await Ad.evaluate(() => { const p = PRODUCTS.find(x => +x.mp > 0) || PRODUCTS[0]; return p && p.id; });
ok(!!pid, 'the shop has a part to order ' + pid);
await Ad.evaluate(() => tab('ahome')); await Ad.waitForTimeout(300); let t = await T(Ad);
ok(/Purchases today/.test(t) && /limit ₹1,00,000 per order/.test(t), 'admin home: Purchases today with the ₹1,00,000 limit');
await sync(Ad);

// ===== Manager on a phone =====
const M = await mk(390, 844); await login(M, 'mona@test.in', 'mona1234');
ok(await M.evaluate(() => S.user && S.user.role === 'manager'), 'manager logged in');
await M.evaluate(() => tab('mghome')); await M.waitForTimeout(300); t = await T(M);
ok(!/Gross margin/i.test(t) && !/profit/i.test(t), 'manager home: no gross margin or profit');
ok(/Purchase orders/.test(t) && /Stock in/.test(t) && /Add product/.test(t) && /Waiting for photos/.test(t), 'manager home: Purchase orders, Stock in, Add product, Waiting for photos');
ok(await M.evaluate(() => !allowed('mgmargin') && !allowed('mgexp') && !allowed('invpaste') && allowed('grnedit') && allowed('addproduct')), 'manager: margin, expenses and Paste bill locked; Stock in and Add product open');
await M.evaluate(() => go('mgtarget')); await M.waitForTimeout(300); t = await T(M);
ok(/Sales/.test(t) && !/Gross margin/i.test(t), 'manager targets: sales target shown, no gross margin target');

// Stock in without rates
await M.evaluate(() => { S.ui.ge = null; go('grnedit', { id: 'new' }); }); await M.waitForTimeout(300); t = await T(M);
ok(!/Purchase rate|Bill amount|Paste bill|Items total/.test(t), 'manager stock in: no purchase rate, bill amount, totals or Paste bill');
await M.evaluate(pid => { S.ui.ge.supplier = 'Test Supplier'; S.ui.ge.inv = 'TS-1'; S.ui.ge.items.push({ pid, exp: null, q: 3, rate: '' }); refresh(); }, pid); await M.waitForTimeout(200);
t = await T(M); ok(!/Purchase rate/.test(t) && !/₹/.test(t.split('Items')[1] || ''), 'manager stock in line: qty only, no rupees');
const before = await M.evaluate(pid => +DB.stock[pid] || 0, pid);
await M.evaluate(() => geSave(true)); await M.waitForTimeout(400);
const g = await M.evaluate(pid => { const g = DB.grns.find(x => x.inv === 'TS-1'); return g && { id: g.id, st: g.status, due: grnRateDue(g), stock: +DB.stock[pid] }; }, pid);
ok(g && g.st === 'posted' && g.due && g.stock === before + 3, 'manager posted the stock in without rates; 3 pcs added ' + JSON.stringify(g));
await M.evaluate(id => go('grnview', { id }), g.id); await M.waitForTimeout(300); t = await T(M);
ok(/3 pcs/.test(t) && !/Bill amount|Balance|×/.test(t) && /entered by Admin/.test(t), 'manager sees the bill with quantities only');

// purchase orders: small one straight to the supplier, big one waits for Admin
await M.evaluate(pid => { S.ui.po = { items: { [pid]: 2 }, supplier: 'Test Supplier' }; go('mgpo'); }, pid); await M.waitForTimeout(300); t = await T(M);
ok(!/est\.|Est\. cost/.test(t) && /Within the ₹1,00,000 limit/.test(t) && /Send to supplier/i.test(t), 'small order: no cost shown, within the limit, Send to supplier');
await M.evaluate(() => poSave('Sent')); await M.waitForTimeout(300);
const big = await M.evaluate(pid => { const n = Math.ceil(110000 / poCost(P(pid))); S.ui.po = { items: { [pid]: n }, supplier: 'Test Supplier' }; go('mgpo'); return n; }, pid); await M.waitForTimeout(300); t = await T(M);
ok(/above the ₹1,00,000 limit/.test(t) && /Send for approval/i.test(t), `big order (${big} pcs): above the limit, Send for approval`);
await M.evaluate(() => { closeSheet(); poSave('Sent'); }); await M.waitForTimeout(300);
const pos = await M.evaluate(() => DB.pos.slice(0, 2).map(o => [o.status, o.est > 100000]));
ok(JSON.stringify(pos) === JSON.stringify([['Waiting for Admin', true], ['Sent', false]]), 'big order waits for Admin, small one sent ' + JSON.stringify(pos));
await M.evaluate(() => { closeSheet(); tab('approvals'); }); await M.waitForTimeout(300); t = await T(M);
ok(/Above the purchase order limit · Admin decides/.test(t), 'manager cannot approve the big order');
await sync(M);

// ===== Admin approves and enters the rates =====
await Ad.reload(); await Ad.waitForFunction(() => typeof S !== 'undefined' && S.user, null, { timeout: 15000 }); await Ad.waitForTimeout(800);
await Ad.evaluate(() => tab('ahome')); await Ad.waitForTimeout(300); t = await T(Ad);
ok(/1 order above the limit/i.test(t) && /1 stock in without rates/i.test(t), 'admin home: 1 order to approve, 1 stock in without rates');
await Ad.evaluate(() => { const a = DB.approvals.find(x => x.po && x.st === 'pending'); decide(a.id, 'approved'); }); await Ad.waitForTimeout(200);
ok(await Ad.evaluate(() => DB.pos[0].status === 'Sent' && /Approved by/.test(DB.pos[0].ok)), 'admin approved: the order is sent');
await Ad.evaluate(id => go('grnview', { id }), g.id); await Ad.waitForTimeout(300); t = await T(Ad);
ok(/Rates are not entered yet/.test(t), 'admin sees "Rates are not entered yet" on the bill');
await Ad.evaluate(id => grnRates(id), g.id); await Ad.waitForTimeout(200);
await Ad.fill('#gr-0', '120'); await Ad.fill('#gr-amt', '360'); await Ad.evaluate(id => grnRatesSave(id), g.id); await Ad.waitForTimeout(300);
ok(await Ad.evaluate(id => { const g = DB.grns.find(x => x.id === id); return !grnRateDue(g) && grnTotal(g) === 360; }, g.id), 'admin entered the rate: bill total ₹360');
await Ad.evaluate(() => go('mgmargin')); await Ad.waitForTimeout(200);
ok(/Gross margin/.test(await T(Ad)), 'admin still sees gross margin');

ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
