// Update 9i (Sam 2026-10-18 "perfect"): the same part with two MRPs is kept as lots. Add product with two MRPs,
// a bill takes the oldest lot first and splits the line, Change lot, the server takes the lot's price, stock in with a new MRP, labels per lot.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3021';
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
const fresh = async p => { await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.user && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(800); };
const PN = 'LOT' + Date.now().toString().slice(-6);

const Ad = await mk(1440, 900); await login(Ad, 'sam@bikepharma.com', 'Test@1234');
ok(await Ad.evaluate(() => S.user.role === 'admin'), 'admin logged in');
// 1. Add product: ₹210 × 3 and another MRP ₹245 × 5
await Ad.evaluate(pn => { S.ui.ap = null; S.ui.apErr = null; go('addproduct'); const a = S.ui.ap; Object.assign(a, { pn, look: pn, name: 'Horn comp.', brand: 'HERO', more: true, universal: true, mrp: '210', open: '3', warDays: '0', photos: ['/photos/test.jpg'] }); refresh(); }, PN);
await Ad.waitForTimeout(300);
await Ad.click(SC + ' button:has-text("+ Add another MRP")'); await Ad.waitForTimeout(200);
await Ad.fill('#ap-xm0', '245'); await Ad.fill('#ap-xq0', '5');
let t = await T(Ad); ok(/Qty at this MRP/.test(t) && /Another MRP/.test(t), 'add product shows the second MRP row');
await Ad.evaluate(() => saveProduct()); await Ad.waitForTimeout(400);
t = await ST(Ad); ok(/Stock by MRP/.test(t) && /245/.test(t), 'saved sheet lists stock by MRP');
await Ad.evaluate(() => closeSheet());
const pid = await Ad.evaluate(pn => (PRODUCTS.find(p => p.pn === pn) || {}).id, PN);
const st = await Ad.evaluate(id => ({ s: DB.stock[id], p: P(id), L: DB.lots[id] }), pid);
ok(st.s === 8 && st.p.mrp === 245 && st.p.price === 232.75 && st.p.mp === 208.25, 'product: 8 pcs, MRP 245, prices by the rule ' + JSON.stringify([st.s, st.p.mrp, st.p.price, st.p.mp]));
ok(JSON.stringify(st.L.map(l => [l.m, l.q])) === '[[210,3],[245,5]]', 'lots 210 × 3 then 245 × 5 ' + JSON.stringify(st.L));
// part stock in Scan to find
await Ad.evaluate(id => { S.ui.scanHit = id; S.ui.scanMiss = null; go('scanfind'); }, pid); await Ad.waitForTimeout(300);
t = await T(Ad); ok(/Stock by MRP/i.test(t) && /Sells first/i.test(t) && /₹200/.test(t) && /Count \/ fix lot qty/i.test(t), 'scan to find shows the lots with prices and the fix button');
await sync(Ad);

// make a Billing login
await Ad.evaluate(() => { S.ui.ns = null; go('newstaff'); S.ui.ns.role = 'Billing'; refresh(); }); await Ad.waitForTimeout(300);
const bmail = 'lotbill' + Date.now().toString().slice(-5) + '@test.in';
await Ad.fill('#ns1', 'Lot Billing'); await Ad.fill('#ns2', bmail); await Ad.fill('#ns3', 'lots1234'); await Ad.click(SC + ' .foot .btn'); await Ad.waitForTimeout(900); await Ad.evaluate(() => closeSheet());
await sync(Ad);

const B = await mk(390, 844); await login(B, bmail, 'lots1234');
ok(await B.evaluate(() => S.user.role === 'billing'), 'billing logged in');
// 2. bill of 4: 3 from the ₹210 lot, 1 from ₹245
await B.evaluate(id => { S.ui.inv = null; tab('invoice'); S.ui.inv.mob = '9876543210'; S.ui.inv.items[id] = 4; S.ui.inv.pm = 'UPI'; refresh(); }, pid); await B.waitForTimeout(300);
t = await T(B); ok(/MRP ₹210 × 3/.test(t) && /MRP ₹245 × 1/.test(t) && /Change lot/.test(t), 'invoice line split into the two lots');
const tot = await B.evaluate(id => Math.round(lotAmt(id, 4, false)), pid);
ok(tot === Math.round(199.5 * 3 + 232.75), 'total from lot prices ' + tot);
// Change lot: the box in hand is ₹245
await B.evaluate(id => lotPick(id), pid); await B.waitForTimeout(200);
ok(/Change lot/.test(await ST(B)), 'change lot sheet opens');
await B.evaluate(id => { (S.ui.inv.lot = S.ui.inv.lot || {})[id] = 245; closeSheet(); S.ui.inv.items[id] = 1; refresh(); }, pid); await B.waitForTimeout(200);
ok(await B.evaluate(id => JSON.stringify(lotLines(id, 1, false, S.ui.inv.lot[id])) === JSON.stringify([{ m: 245, q: 1, r: 232.75 }]), pid), 'picked lot is used');
await B.evaluate(id => { S.ui.inv.lot = {}; S.ui.inv.items[id] = 4; refresh(); genInvoice(Math.round(lotAmt(id, 4, false))); closeSheet(); }, pid); await B.waitForTimeout(300);
const bill = await B.evaluate(() => DB.bills[0]);
ok(JSON.stringify(bill.items.map(i => [i.q, i.r, i.mrp])) === '[[3,199.5,210],[1,232.75,245]]', 'bill has two lines by lot ' + JSON.stringify(bill.items));
await sync(B);
const bid = bill.id;
await fresh(B);
ok(await B.evaluate(id => DB.bills.some(b => b.id === id), bid), 'server kept the bill (lot price accepted)');
ok(await B.evaluate(id => DB.stock[id] === 4 && JSON.stringify(lotsOf(id).map(l => [l.m, l.q])) === '[[245,4]]', pid), 'after the bill: 4 pcs, only the ₹245 lot left');
// 3. server refuses a made-up lot price
const r = await B.evaluate(async id => {
  const bills = [{ id: 'INV-LOTFAKE', by: S.user.sid, kind: 'cust', pname: 'x', mob: '9876543210', items: [{ pid: id, q: 1, r: 100, mrp: 120 }], p: 'x', iso: isoToday(), pm: 'UPI', amt: 100 }, ...DB.bills];
  const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: 0, changes: { bills } }), credentials: 'same-origin' }); return res.json();
}, pid);
ok(/below the set price/.test(r.why || ''), 'server refuses a price from an MRP lot that is not in stock: ' + r.why);

// 4. stock in with a new bill MRP ₹260 makes a new lot
await Ad.evaluate(() => fresh && 0).catch(() => {}); await fresh(Ad);
await Ad.evaluate(id => { S.ui.ge = { id: 'new', supplier: 'Lot Supplier', gstin: '', inv: 'LB-' + Date.now(), date: today(), items: [{ pid: id, exp: null, q: 2, rate: 150, bmrp: 260 }], nw: [], note: '' }; geSave(true); }, pid); await Ad.waitForTimeout(400);
const s2 = await Ad.evaluate(id => ({ s: DB.stock[id], m: P(id).mrp, L: lotsOf(id).map(l => [l.m, l.q]) }), pid);
ok(s2.s === 6 && s2.m === 260 && JSON.stringify(s2.L) === '[[245,4],[260,2]]', 'stock in at ₹260: new lot, part MRP now 260 ' + JSON.stringify(s2));
// Manager / Admin moves a box between lots
await Ad.evaluate(id => { lotMoveSheet(id); document.getElementById('lm-q').value = '1'; lotMove(id); }, pid); await Ad.waitForTimeout(200);
ok(await Ad.evaluate(id => JSON.stringify(lotsOf(id).map(l => [l.m, l.q])) === '[[245,3],[260,3]]' && DB.stock[id] === 6, pid), 'count / fix lot qty moves 1 pc');
// stock list line
await Ad.evaluate(pn => { S.ui.rq = pn; go('racks'); }, PN); await Ad.waitForTimeout(300);
t = await T(Ad); ok(/MRP ₹245 × 3, MRP ₹260 × 3/.test(t), 'stock list shows the lots');
// 5. labels per lot
await Ad.evaluate(id => { S.ui.lb = { [id + '@245']: 3, [id + '@260']: 3 }; S.ui.lbs = 'Product 50×25'; S.ui.lbq = P(id).pn; go('labels'); }, pid); await Ad.waitForTimeout(300);
t = await T(Ad); ok(/MRP ₹245 lot · 3 in stock · sells first/.test(t) && /MRP ₹260 lot/.test(t) && /Print 6 labels/i.test(t), 'labels: one row per lot, 6 labels');
const prev = await Ad.evaluate(() => document.querySelector('#vp .screen:last-child .invdoc').innerText);
ok(/MRP ₹245/.test(prev) && /MRP ₹260/.test(prev), 'label preview prints each lot MRP');
// scanning a lot label picks that lot on the bill
await B.evaluate(() => fresh && 0).catch(() => {}); await fresh(B);
await B.evaluate(pn => { S.ui.inv = null; tab('invoice'); invAddCode(pn + '@260'); }, PN); await B.waitForTimeout(300);
ok(await B.evaluate(id => S.ui.inv.items[id] === 1 && S.ui.inv.lot[id] === 260, pid), 'label code PN@260 adds the part with the ₹260 lot');
// one-MRP parts are unchanged
const one = await B.evaluate(() => { const x = PRODUCTS.find(p => DB.stock[p.id] > 0 && !(DB.lots || {})[p.id]); return x ? JSON.stringify(lotLines(x.id, 2, false)) === JSON.stringify([{ m: r2(x.mrp), q: 2, r: x.price }]) : 'none'; });
ok(one === true || one === 'none', 'a part with one MRP bills as before');
ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
