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
// 11p (Sam 2026-10-23 'photo open nahi ho raha'): a tap on the photo opens it over the screen, Close shuts it
await Ad.click(SC + ' button[aria-label="Open photo"]'); await Ad.waitForTimeout(300);
const zd = await Ad.evaluate(() => { const d = document.querySelector('.fpz.ph'); return d ? d.querySelector('img').getAttribute('src') : null; }); ok(zd && /photos/.test(zd), 'scan to find: photo opens full screen ' + zd);
await Ad.click('.fpz.ph .fpz-x'); await Ad.waitForTimeout(200); ok(await Ad.evaluate(() => !document.querySelector('.fpz.ph')), 'photo closes');
// 11q (Sam: Products & stock rack box had no photo, bikes, MRP): the rack sheet shows them, read only; its photo opens too
await Ad.evaluate(id => rackEdit(id), pid); await Ad.waitForTimeout(200);
t = await ST(Ad); ok(/MRP/.test(t) && /245/.test(t) && /Save rack/i.test(t) && await Ad.evaluate(() => !!document.querySelector('.sheet button[aria-label="Open photo"]')), 'rack sheet: photo, MRP, rack only');
await Ad.click('.sheet button[aria-label="Open photo"]'); await Ad.waitForTimeout(250); ok(await Ad.evaluate(() => !!document.querySelector('.fpz.ph')), 'rack sheet photo opens full screen');
await Ad.click('.fpz.ph .fpz-x'); await Ad.evaluate(() => closeSheet()); await Ad.waitForTimeout(150);
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
// 11r (Sam 2026-10-23 "only admin can edit, staff give request for approval"): change a product's details
await fresh(Ad); await fresh(B);
// staff: the button sends a request; nothing changes until Admin approves
await B.evaluate(id => { S.ui.scanHit = id; S.ui.scanMiss = null; go('scanfind'); }, pid); await B.waitForTimeout(250);
ok(/Request a change/i.test(await T(B)), 'scan to find: staff see Request a change');
await B.evaluate(id => peOpen(id), pid); await B.waitForTimeout(250);
ok(await B.evaluate(() => cur().s === 'prodedit' && /Send to Admin/i.test(document.querySelector('#vp .screen:last-child').innerText)), 'change form opens for staff');
await B.fill('#pe-name', 'Horn assembly'); await B.evaluate(() => peSave()); await B.waitForTimeout(300);
const rq = await B.evaluate(id => { const a = DB.approvals.find(x => x.pedit && x.pedit.pid === id); return a && { st: a.st, ch: a.pedit.ch, name: P(id).name }; }, pid);
ok(rq && rq.st === 'pending' && rq.ch.name && rq.ch.name[1] === 'Horn assembly' && rq.name === 'Horn comp.', 'staff change is a pending request; the part is unchanged ' + JSON.stringify(rq));
await sync(B);
// staff writing the product straight is undone by the server
await B.evaluate(id => { const q = DB.newProducts.find(x => x.id === id); q.name = 'Hacked name'; q.fits = ['Hero Glamour']; save(); }, pid); await sync(B); await fresh(B);
ok(await B.evaluate(id => P(id).name === 'Horn comp.' && P(id).fits[0] === 'Universal', pid), 'server keeps the product as it was when staff change it directly');
ok(await B.evaluate(() => { const a = DB.approvals.find(x => x.pedit); return a && a.st === 'pending'; }), 'request reached the server');
// Admin approves: the change is applied
await fresh(Ad);
const aid = await Ad.evaluate(() => (DB.approvals.find(x => x.pedit && x.st === 'pending') || {}).id);
await Ad.evaluate(id => { go('approvals'); decide(id, 'approved'); }, aid); await Ad.waitForTimeout(300);
ok(await Ad.evaluate(id => P(id).name === 'Horn assembly' && DB.newProducts.find(x => x.id === id).name === 'Horn assembly', pid), 'Admin approves: name changed');
// Admin changes straight away (MRP + bike); prices follow the MRP
await Ad.evaluate(id => peOpen(id), pid); await Ad.waitForTimeout(250);
ok(/Save changes/i.test(await T(Ad)), 'Admin sees Save changes');
await Ad.fill('#pe-mrp', '300'); await Ad.evaluate(() => { S.ui.pe.universal = false; S.ui.pe.add = 'Hero Splendor Plus'; peFitAdd(); }); await Ad.evaluate(() => peSave()); await Ad.waitForTimeout(300);
const ad = await Ad.evaluate(id => ({ mrp: P(id).mrp, price: P(id).price, fits: P(id).fits, au: DB.audit.some(a => /Product changed/.test(JSON.stringify(a))) }), pid);
ok(ad.mrp === 300 && ad.price === 285 && JSON.stringify(ad.fits) === '["Hero Splendor Plus"]' && ad.au, 'Admin change saved with new prices and audit ' + JSON.stringify(ad));
await sync(Ad); await fresh(Ad);
ok(await Ad.evaluate(id => P(id).mrp === 300 && P(id).fits[0] === 'Hero Splendor Plus', pid), 'server kept the Admin change');
// 11t (Sam: Photos missing list): a part whose photo file is gone is listed; staff take a new photo and it saves without Admin
const GONE = '/photos/' + 'ab'.repeat(16) + '-c.jpg';
const gid = await Ad.evaluate(g => { const id = 'n' + Date.now(); const p = { id, name: 'Gone photo part', brand: 'HERO', type: '', cat: 'OEM Parts', pn: 'GONE' + Date.now().toString().slice(-5), pack: '', mrp: 100, price: 95, mp: 85, stock: 1, warDays: 0, reorder: 10, ic: 'package', fits: ['Universal'], bin: '', barcode: '', pending: false, photos: [g], unit: 'pcs' }; DB.newProducts.push(p); PRODUCTS.push(p); DB.stock[id] = 1; save(); return id; }, GONE);
await sync(Ad); await fresh(B);
const ml = await B.evaluate(() => api('GET', '/api/photos/missing'));
ok(ml.ids && ml.ids.includes(gid) && !ml.ids.includes(pid), 'server lists the part whose photo is gone (not the others) ' + JSON.stringify(ml).slice(0, 120));
await B.evaluate(() => { phMissLoad(); }); await B.waitForTimeout(800);
await B.evaluate(id => peOpen(id), gid); await B.waitForTimeout(250);
ok(/no approval/i.test(await T(B)), 'photo-only save needs no approval for a missing photo');
const nu = await B.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 20, 20); const bl = await new Promise(r => c.toBlob(r, 'image/jpeg')); const r = await fetch('/api/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: bl, credentials: 'same-origin' }); return (await r.json()).url; });
await B.evaluate(u => { S.ui.pe.photos = [u]; peSave(); }, nu); await B.waitForTimeout(300);
ok(await B.evaluate(id => P(id).photos[0] !== undefined && !DB.approvals.some(a => a.pedit && a.pedit.pid === id), gid), 'saved straight, no request');
await sync(B); await fresh(B);
ok(await B.evaluate(([id, u]) => P(id).photos[0] === u, [gid, nu]), 'server kept the new photo from staff');
const ml2 = await B.evaluate(() => api('GET', '/api/photos/missing'));
ok(!ml2.ids.includes(gid), 'part is off the Photos missing list');
// a part with a real photo: staff still cannot swap it straight
await B.evaluate(id => { const q = DB.newProducts.find(x => x.id === id); q.photos = ['/photos/' + 'cd'.repeat(16) + '-c.jpg']; save(); }, gid); await sync(B); await fresh(B);
ok(await B.evaluate(([id, u]) => P(id).photos[0] === u, [gid, nu]), 'a present photo cannot be replaced by staff without Admin');
// 11y (Sam: "items has only one photo ... ek ek aur photo add"): the Only 1 photo tab; staff add a 2nd photo without Admin, the first stays
await fresh(Ad); await Ad.evaluate(() => { S.ui.phTab = 'one'; phMissLoad(); go('phmiss'); }); await Ad.waitForTimeout(800);
const t1 = await T(Ad); ok(/Only 1 photo/.test(t1) && t1.includes('Gone photo part'), 'Only 1 photo tab lists the part with one photo ' + t1.slice(0, 300));
await B.evaluate(id => { S.ui.phAdd = id; peOpen(id); }, gid); await B.waitForTimeout(250);
ok(/no approval/i.test(await T(B)) && await B.evaluate(() => S.ui.pe.keep === 1 && document.querySelectorAll('[aria-label="Remove photo"]').length === 0), 'add mode: no approval, the old photo cannot be removed');
const nu2 = await B.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(5, 5, 20, 20); const bl = await new Promise(r => c.toBlob(r, 'image/jpeg')); const r = await fetch('/api/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: bl, credentials: 'same-origin' }); return (await r.json()).url; });
await B.evaluate(u => { S.ui.pe.photos.push(u); peSave(); }, nu2); await B.waitForTimeout(300);
await sync(B); await fresh(B);
ok(await B.evaluate(([id, u, u2]) => P(id).photos.length === 2 && P(id).photos[0] === u && P(id).photos[1] === u2 && !DB.approvals.some(a => a.pedit && a.pedit.pid === id), [gid, nu, nu2]), 'server kept the added photo, first photo unchanged, no request');
await B.evaluate(([id, u2]) => { const q = DB.newProducts.find(x => x.id === id); q.photos = [u2]; save(); }, [gid, nu2]); await sync(B); await fresh(B);
ok(await B.evaluate(id => P(id).photos.length === 2, gid), 'staff still cannot remove a photo without Admin');
ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
