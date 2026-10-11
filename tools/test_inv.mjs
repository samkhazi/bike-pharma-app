// 2026-10-11 Sam: "admin page pe inventory add karne ka option hi nhi he". A NEW shop (no products, no suppliers): Admin finds
// Inventory on Overview and More, every inventory screen opens, Add product works, Stock in takes a new supplier and a typed code,
// posts the stock, and all of it is on the server after a reload.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE2 || 'http://127.0.0.1:3016';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/screen \w+:/.test(m.text())) errs.push(m.text()); });
const boot = async () => { await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(500); };
const txt = () => p.evaluate(() => document.querySelector('#vp .screen').innerText);
await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await boot();
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
ok(await p.evaluate(() => S.user && S.user.role === 'admin' && PRODUCTS.length === 0 && sups().length === 0), 'admin logged in, new shop: no products, no suppliers');
await p.evaluate(() => tab('ahome')); await p.waitForTimeout(300);
let t = await txt();
ok(/Inventory/.test(t) && /Add product/.test(t) && /Stock in/.test(t) && /All inventory/.test(t), 'Overview: Inventory section with Add product, Stock in, All inventory');
await p.evaluate(() => tab('more')); await p.waitForTimeout(300);
ok(/Inventory\s*Add product, stock in, stock count/.test(await txt()), 'More: Inventory row');
await p.evaluate(() => go('ainv')); await p.waitForTimeout(300); t = await txt();
ok(/Inventory/.test(t) && /Add product/.test(t) && /Stock in/.test(t) && /none added yet/.test(t) && /Stock count/.test(t) && /Suppliers/.test(t), 'Inventory page: buttons, tiles and actions');
// every inventory screen opens for Admin on an empty shop (no "Nothing to show here yet", no access denied)
const scr = await p.evaluate(() => { const o = {}; for (const [s, prm] of [['grn', {}], ['grnedit', { id: 'new' }], ['stocklist', {}], ['addproduct', {}], ['stockmove', { type: 'count' }], ['stockmove', { type: 'adjust' }], ['stockmove', { type: 'damaged' }], ['stockmove', { type: 'returned' }], ['batches', {}], ['ccount', {}], ['sreturn', {}], ['labels', {}], ['invlist', { kind: 'low' }], ['scanfind', {}], ['asupp', {}]]) {
  S.ui.ge = null; go(s, prm); const h = document.querySelector('#vp .screen').innerText; o[s + (prm.type ? ':' + prm.type : '')] = /Nothing to show here yet|not allowed|No access|don.t have access/i.test(h) ? 'BAD ' + h.slice(0, 80) : 'ok'; back(); } return o; });
await p.waitForTimeout(300);
ok(Object.values(scr).every(v => v === 'ok'), 'all inventory screens open on an empty shop: ' + JSON.stringify(Object.entries(scr).filter(([, v]) => v !== 'ok')));
await p.evaluate(() => { S.stack = [{ s: 'ahome', p: {} }]; render(''); go('ainv'); go('stocklist'); }); await p.waitForTimeout(300); t = await txt();
ok(/No products yet/.test(t) && /Add product/i.test(t) && /Stock in/i.test(t), 'Products & stock (empty): "No products yet" + Add product / Stock in buttons');
// Add product (form filled as a person would, 3 photos)
await p.evaluate(() => go('addproduct')); await p.waitForTimeout(300);
const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
await p.evaluate(px => { Object.assign(S.ui.ap, { name: 'Clutch Plate Set', brand: 'Bajaj', pn: 'JF531003', barcode: '8901234567890', mrp: '640', price: '600', mp: '560', open: '4', warDays: '0', universal: true, photos: [px, px, px] }); saveProduct(); }, px);
await p.waitForTimeout(400);
ok(await p.evaluate(() => PRODUCTS.length === 1 && DB.stock[PRODUCTS[0].id] === 4 && /added/.test(document.querySelector('.sheet').innerText)), 'Add product: saved with opening stock 4');
await p.evaluate(() => [...document.querySelectorAll('.sheet button')].find(x => /View stock list/.test(x.textContent)).click()); await p.waitForTimeout(400);
ok(await p.evaluate(() => cur().s === 'stocklist' && S.stack.length >= 2 && /Clutch Plate Set/.test(document.querySelector('#vp .screen').innerText)), 'View stock list: opens Products & stock with the new part, back still works');
// Stock in: new supplier typed, part added by typed code, posted
await p.evaluate(() => go('grn')); await p.waitForTimeout(300);
ok(await p.evaluate(() => !!document.querySelector('#vp .bar [aria-label="Back"]') && /Stock in/.test(document.querySelector('#vp .bar').innerText)), 'Stock in opens as a page with a back button for Admin');
await p.evaluate(() => { S.ui.ge = null; go('grnedit', { id: 'new' }); }); await p.waitForTimeout(300);
ok(await p.evaluate(() => !!document.getElementById('ge-sup') && document.getElementById('ge-sup').tagName === 'INPUT'), 'Stock in: supplier is a field you can type in');
await p.evaluate(() => geSave(true)); await p.waitForTimeout(200);
ok(/Enter the supplier name/.test(await txt()), 'Stock in: asks for the supplier name');
await p.fill('#ge-sup', 'Sharma Auto Distributors'); await p.fill('#ge-inv', 'SAD-1001');
await p.fill('#ge-code', 'nope-123'); await p.press('#ge-code', 'Enter'); await p.waitForTimeout(200);
ok(await p.evaluate(() => S.ui.ge.items.length === 0), 'Stock in: an unknown code adds nothing');
await p.fill('#ge-code', 'jf531003'); await p.press('#ge-code', 'Enter'); await p.waitForTimeout(300);
await p.fill('#ge-code', '8901234567890'); await p.press('#ge-code', 'Enter'); await p.waitForTimeout(300);
ok(await p.evaluate(() => S.ui.ge.items.length === 1 && +S.ui.ge.items[0].q === 2 && document.activeElement && document.activeElement.id === 'ge-code'), 'Stock in: part no. and barcode each add 1 (qty 2), the code box stays ready for the next scan');
await p.evaluate(() => { S.ui.ge.items[0].rate = '480'; geSave(true); }); await p.waitForTimeout(600);
ok(await p.evaluate(() => DB.stock[PRODUCTS[0].id] === 6 && DB.grns.length === 1 && DB.grns[0].status === 'posted' && DB.grns[0].supplier === 'Sharma Auto Distributors'), 'Stock in posted: stock 4 + 2 = 6');
ok(await p.evaluate(() => sups().length === 1 && sups()[0].n === 'Sharma Auto Distributors'), 'the new supplier is in Admin > Suppliers');
ok(await p.evaluate(() => cur().s === 'grn' && S.stack.length > 1), 'after posting, back on the Stock in list (not stuck without navigation)');
// the next stock in offers the saved supplier
await p.evaluate(() => { S.ui.ge = null; go('grnedit', { id: 'new' }); }); await p.waitForTimeout(300);
ok(await p.evaluate(() => [...document.querySelectorAll('#ge-sups option')].map(o => o.value).join() === 'Sharma Auto Distributors'), 'next stock in: the supplier is in the list to pick');
await p.evaluate(() => back()); await p.waitForTimeout(300);
// supplier return / purchase order list the shop's suppliers
ok(await p.evaluate(() => { go('sreturn'); const o = [...document.querySelectorAll('#sr-s option')].map(x => x.textContent).join(); back(); return o === 'Sharma Auto Distributors'; }), 'supplier return lists the shop\'s supplier');
// saved on the server: reload
await p.waitForTimeout(2500);
await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await boot(); await p.waitForTimeout(800);
ok(await p.evaluate(() => S.user && PRODUCTS.length === 1 && DB.stock[PRODUCTS[0].id] === 6 && sups().length === 1 && DB.grns.length === 1), 'after reload: product, stock 6, supplier and stock in are on the server');
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
