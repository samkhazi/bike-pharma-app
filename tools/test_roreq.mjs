// update 20q: a reorder request in Approvals is a short card + a list to tick, and Approve makes purchase orders.
//   BASE=http://127.0.0.1:3033 node tools/test_roreq.mjs [wide]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3033', wide = process.argv[2] === 'wide';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: wide ? { width: 1366, height: 860 } : { width: 390, height: 844 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
await p.evaluate(() => tab('ahome')); await p.waitForTimeout(300);
const st = await p.evaluate(() => {
  // test parts (not saved to the server: the page is closed without a sync of these)
  while (PRODUCTS.length < 8) { const n = PRODUCTS.length + 1; PRODUCTS.push({ id: 'ro-t' + n, name: 'Test part ' + n, pn: 'ROT-00' + n, brand: n % 2 ? 'Honda' : 'Bajaj', cat: 'Others', price: 100, mp: 100 + n, mrp: 100 + n, cost: 0, ic: 'package', type: '', fits: '', war: 0 }); }
  const L = PRODUCTS.slice(0, 8); L.forEach(x => { DB.stock[x.id] = 0; });
  DB.bills = (DB.bills || []).filter(x => x.id !== 'INV-ROT'); DB.bills.unshift({ id: 'INV-ROT', iso: isoToday(), items: [{ pid: L[0].id, q: 7 }, { pid: L[1].id, q: 2 }] }); RLK.ps = null;
  DB.approvals = DB.approvals.filter(a => a.t !== 'Reorder request');
  // an old request: only the numbers typed into its text (what is on the live server today)
  DB.approvals.unshift({ id: Date.now() - 5000, t: 'Reorder request', d: 'BP-RNR-INV-001 · 8 parts: ' + L.map(x => x.pn).join(', '), ic: 'package', st: 'pending' });
  DB.approvals.unshift({ id: Date.now() - 9000, t: 'Cycle count difference', d: 'Rack B-12 · Test · -2 pcs', ic: 'sliders', st: 'pending', move: { pid: L[2].id, q: 0 } });
  S.ui.mgk = 'out'; go('approvals'); return { pos: (DB.pos || []).length, pn: L.map(x => x.pn), id0: L[0].id, id2: L[2].id };
});
await p.waitForTimeout(300);
let t = await p.evaluate(() => document.querySelector('.ro-card').innerText);
ok(/Reorder request/.test(t) && /8 parts/.test(t) && !t.includes(st.pn[3]), 'the card is short: count, no part numbers typed out');
ok(/2\s*sold in last 90 days/.test(t) && /6\s*not sold in 90 days/.test(t), 'the card counts 2 that sell and 6 that do not');
ok(/BP-RNR-INV-001/.test(t), 'the card says who sent it');
ok(await p.evaluate(() => document.querySelectorAll('.chips .chip').length >= 3), 'kind chips shown (All, Reorder, Stock)');
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-1.png' });
await p.click('.ro-card .btn.dark'); await p.waitForTimeout(300);
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-2.png' });
if (process.env.DBG) console.log(await p.evaluate(() => cur().s + ' :: ' + (document.getElementById('ro-list') || { innerHTML: 'none' }).innerHTML.slice(0, 400) + ' :: ' + document.querySelector('#vp').innerText.slice(0, 300)));
ok(await p.evaluate(() => cur().s === 'aporeq' && document.querySelectorAll('.ro-row:not(.ro-hd)').length === 2), 'View list opens the Sells tab with 2 parts');
t = await p.evaluate(() => document.querySelector('.ro-row:not(.ro-hd)').innerText.replace(/\s+/g, ' '));
ok(t.includes(st.pn[0]) && /Test part 1/.test(t) && (wide ? /7/.test(t) : /sold 7 in 90 days/.test(t) && /stock 0 \//.test(t)), 'a row shows name, number, stock and sales: ' + t.slice(0, 90));
if (wide) ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ro-hd')).display === 'grid' && /Reorder level/.test(document.querySelector('.ro-hd').innerText)), 'website: a table with column heads');
ok(/2 parts ticked/.test(await p.innerText('#ro-sum')), 'the parts that sell start ticked');
await p.click('.ro-tabs button:nth-child(2)'); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.querySelectorAll('.ro-row:not(.ro-hd)').length === 6 && document.querySelectorAll('.ro-row .ro-ck.on').length === 0), 'Not sold tab: 6 parts, none ticked');
await p.fill('#ro-q', st.pn[2]); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.querySelectorAll('.ro-row:not(.ro-hd)').length === 1 && document.activeElement.id === 'ro-q'), 'search narrows to one part and the box keeps the cursor');
await p.click('.ro-row:not(.ro-hd) button'); await p.waitForTimeout(150);
await p.click('.ro-row:not(.ro-hd) .qty button:last-child'); await p.waitForTimeout(150);
ok(/3 parts ticked/.test(await p.innerText('#ro-sum')), 'ticking one more part: 3 ticked');
const q2 = await p.evaluate(id => S.ui.ro.sel[id], st.id2);
if (process.env.DBG) console.log('before', await p.evaluate(() => JSON.stringify({ st: S.stack.map(x => x.s), i: NAVH.i, on: NAVH.on, hs: history.state && history.state.bpnav && history.state.bpnav.i, len: history.length })));
await p.click('#ro-go'); await p.waitForTimeout(1500);
if (process.env.DBG) console.log('after', await p.evaluate(() => JSON.stringify({ st: S.stack.map(x => x.s), i: NAVH.i, hs: history.state && history.state.bpnav && history.state.bpnav.i, hst: history.state && history.state.bpnav && history.state.bpnav.st.map(x => x.s) })));
const r = await p.evaluate(a => { const ap = DB.approvals.find(x => x.t === 'Reorder request'); const made = (DB.pos || []).filter(o => o.ro === ap.id);
  return { scr: cur().s, st: ap.st, done: ap.ro && ap.ro.done, n: made.length, items: made.flatMap(o => o.items), status: made.map(o => o.status), sup: made.map(o => o.supplier), banner: (document.querySelector('.ro-ok') || {}).innerText || '', card: [...document.querySelectorAll('.card')].map(c => c.innerText).find(x => /parts ordered/.test(x)) || '' }; });
ok(r.scr === 'approvals' && r.st === 'approved', 'back on Approvals, the request is approved: ' + r.scr + ' ' + r.st + ' ' + JSON.stringify(r.done));
ok(r.n >= 1 && r.items.length === 3 && r.items.some(i => i.pid === st.id2 && i.q === q2), 'purchase order(s) made with the 3 ticked parts and their quantities: ' + r.n + ' order(s), ' + r.status.join('/'));
ok(/made/.test(r.banner) && /3 parts/.test(r.banner), 'green note says what was made');
ok(/3 of 8 parts ordered · 5 left out/.test(r.card) && /Decided by/.test(r.card), 'the card keeps: ordered, left out, who decided');
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-3.png' });
await p.evaluate(() => { const ap = DB.approvals.find(x => x.t === 'Reorder request'); roOpen(ap.id); }); await p.waitForTimeout(300);
ok(await p.evaluate(() => document.querySelectorAll('.ro-row:not(.ro-hd)').length === 5 && !document.getElementById('ro-go')), 'See left out parts lists the 5 others, nothing to tick');
// a new request made from the stock alert button carries its list
const n2 = await p.evaluate(() => { reorderReq(PRODUCTS.slice(0, 3).map(x => x.id), 'Out of stock'); const a = DB.approvals[0]; return { d: a.d, n: roIds(a).length }; });
ok(n2.n === 3 && /3 parts from the Out of stock list/.test(n2.d) && !/ROT-/.test(n2.d), 'a new request keeps a list, its text stays short: ' + n2.d);
await p.evaluate(() => { back(); const a = DB.approvals[0]; decide(a.id, 'rejected'); }); await p.waitForTimeout(300);
ok(await p.evaluate(() => DB.approvals[0].st === 'rejected'), 'Reject still works');
ok(!errs.length, 'no page errors ' + errs.join(';'));
await b.close(); process.exit(fails ? 1 : 0);
