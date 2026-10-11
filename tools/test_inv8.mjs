// Update 8 (Sam 2026-10-11 "Code karde", 16:39Z "mobile view bhi check kar"): inventory from the brand catalogues, tested on a
// phone (390 px) and on a computer (1440 px, website layout) against a fresh shop with the real catalogue files.
// A part number fills the details, 1 photo is a must and 4 the most (Sam 17:32Z; saved byte for byte), Admin's % price rule, Stock in
// new-part lines, Waiting for photos, Paste supplier bill, Find Part "Add to stock", photos shown in the shop, and the photo AI
// (Sam 16:59Z-17:25Z): background white with the faint logo behind the part, "Original" to keep a photo as taken.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const BASE = process.env.BASE3 || 'http://127.0.0.1:3017';
const PH = process.env.PH;            // folder with the test photos (tools/run_tests.sh makes them)
const SHOTS = process.env.SHOTS || ''; // screenshots, when set
const ADMIN = 'sam@bikepharma.com', PW = 'Test@1234';
const AI = await fetch(BASE + '/api/health').then(r => r.json()).then(j => j.photoAi && j.photoAi.state).catch(() => '');   // 'ready' when the test server has the AI model
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
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
// nothing wider than the window: no sideways scroll on the page or inside the screen
const wide = p => p.evaluate(() => { const vw = innerWidth, s = document.querySelector('#vp .screen:last-child'), o = []; if (document.documentElement.scrollWidth > vw + 1) o.push('page ' + document.documentElement.scrollWidth);
  s.querySelectorAll('.scroll,.pad,.foot,.card,.inv-2c,.inv-col').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) o.push(String(e.className).slice(0, 24) + ' ' + e.scrollWidth + '>' + e.clientWidth); }); return o.slice(0, 5); });
async function shot(p, name, tall) { if (!SHOTS) return; const vs = p.viewportSize();
  if (tall) { const h = await p.evaluate(() => { const s = document.querySelector('#vp .screen:last-child .scroll'); return s ? s.scrollHeight + 160 : 0; }); if (h > vs.height) { await p.setViewportSize({ width: vs.width, height: Math.min(h, 7000) }); await p.waitForTimeout(400); } }
  await p.screenshot({ path: path.join(SHOTS, name + '.png') }); if (tall) { await p.setViewportSize(vs); await p.waitForTimeout(200); } }
async function photos(p, files, scope = SC) { await p.locator(scope + ' label.inv-slot input[type=file]').first().setInputFiles(files.map(f => path.join(PH, f))); }
// type a part number in Add product and wait for its card (found / pick the brand / not found / already in the list)
async function lookFor(p, pn) { const k = await p.evaluate(pn => catPk(pn), pn); await p.fill('#ap-pn', pn);
  await p.waitForFunction(k => S.ui.ap && S.ui.ap.look === k && document.querySelector('#vp .screen:last-child :is(.inv-found,.inv-pick,.inv-none,.inv-dup)'), k, { timeout: 90000 }); await p.waitForTimeout(150); }
// corner colours of a photo, read in the page (r,g,b of the 4 corners)
const corners = (p, u) => p.evaluate(async u => { const im = new Image(); im.src = u + '?t=' + Date.now(); await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  return [[8, 8], [c.width - 9, 8], [8, c.height - 9], [c.width - 9, c.height - 9]].map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3))); }, u);
const aiDone = (p, expr) => p.waitForFunction(e => eval(e).every(u => PH_ST[phH(u)] === 'done'), expr, { timeout: 120000 });
async function openPart(p, vb, pk) { await p.evaluate(vb => catNeed([CAT_ALL.find(e => e.vb === vb)]), vb); await p.waitForFunction(vb => CAT_ALL.find(e => e.vb === vb).st === 2, vb, { timeout: 90000 });
  const ok1 = await p.evaluate(([vb, pk]) => { const rows = catRows(); const i = rows.findIndex(r => r.pk === pk && r.vb === vb && !r.xl); if (i < 0) return false; const r = rows[i]; go('findpart', { v: 'part', i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any' }); return true; }, [vb, pk]);
  await p.waitForTimeout(500); return ok1; }
const A = '45125-AAH-F0099';   // Hero only: SHOE COMP BRAKE, MRP 160, 33 bikes
const A2 = '06455-AAC-J10';    // Hero only: BRAKE PAD KIT, MRP 235
const B = '14771-GB4-680';     // in Hero and Honda
const C = '36JP0057', C2 = 'JP351010', C3 = '36JP0058';  // KTM (no MRP in the catalogue)
const D = 'ZX9988776';         // in no catalogue
const NF = 'KX7731942';        // in no catalogue and never added (the bill photo test)
const Y = '90340-12813';       // Yamaha only, MRP 55

// ===== phone, Admin, nothing loaded yet =====
const M = await mk(390, 844); await login(M, ADMIN, PW);
ok(await M.evaluate(() => S.user && S.user.role === 'admin' && !document.documentElement.classList.contains('wv')), 'phone: admin logged in (phone layout)');
const oldPh = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(PH, 'w0.jpg')).toString('base64');
await M.evaluate(d => { const p = { id: 'nold1', name: 'Old Mirror', brand: 'OLD', type: 'OEM', cat: 'OEM Parts', pn: 'OLD-1', pack: '', mrp: 100, price: 95, mp: 85, stock: 0, warDays: 0, reorder: 10, ic: 'package', fits: [], bin: '', barcode: '', pending: false, photos: [d], unit: 'pcs', gst: '18', hsn: '8714', at: isoToday(), by: S.user.sid };
  DB.newProducts = DB.newProducts || []; DB.newProducts.push(p); PRODUCTS.push(p); DB.stock[p.id] = 0; save(); }, oldPh);
await M.evaluate(() => go('ainv')); await M.waitForTimeout(300);
let t = await T(M);
ok(/Add product/.test(t) && /Stock in/.test(t) && /Paste supplier bill/.test(t) && /Waiting for photos/.test(t) && /MRP − 5%/.test(t) && /MRP − 15%/.test(t) && /customer ₹152, mechanic ₹136/.test(t), 'Inventory page: Add product, Stock in, Paste supplier bill, Waiting for photos, price rule MRP − 5% / − 15% with an example');
let w = await wide(M); ok(!w.length, 'phone: Inventory page fits 390 px ' + w.join(' | '));
await shot(M, 'p1-inventory', 1);
await M.waitForFunction(() => /^\/photos\/[a-f0-9]{32}-c\.jpg$/.test(PRODUCTS.find(p => p.id === 'nold1').photos[0]), null, { timeout: 20000 }).catch(() => {});
let oldOnSrv = null;   // saved to the server a moment after the page changes it
for (let i = 0; i < 30; i++) { oldOnSrv = await M.request.get(BASE + '/api/sync?since=0').then(r => r.json()).then(j => (j.changed.newProducts || []).find(p => p.id === 'nold1')); if (oldOnSrv && !/^data:/.test(oldOnSrv.photos[0])) break; await M.waitForTimeout(500); }
ok(oldOnSrv && oldOnSrv.photos.length === 1 && /^\/photos\/[a-f0-9]{32}-c\.jpg$/.test(oldOnSrv.photos[0]), 'a product saved before update 8 (photo inside the database) gets its photo moved to the server once ' + JSON.stringify(oldOnSrv && oldOnSrv.photos.map(u => u.slice(0, 40))));

await M.evaluate(() => { S.ui.ap = null; S.ui.apErr = null; go('addproduct'); }); await M.waitForTimeout(300);
let t0 = Date.now(); await lookFor(M, A); const coldMs = Date.now() - t0;
t = await T(M);
ok(/Found in Hero catalogue/i.test(t) && /Not in your list yet/i.test(t) && /₹160/.test(t), `Add product: the Hero number is found with MRP ₹160 (${coldMs} ms, catalogue not loaded before)`);
const ap = await M.evaluate(() => ({ name: S.ui.ap.name, brand: S.ui.ap.brand, mrp: S.ui.ap.mrp, fits: S.ui.ap.fits.length, cat: S.ui.ap.cat }));
ok(/shoe/i.test(ap.name) && ap.brand === 'Hero' && ap.mrp === '160' && ap.fits === 33 && ap.cat === 'Brake Parts', 'Add product: name, brand, MRP, 33 bikes and category Brake Parts filled ' + JSON.stringify(ap));
ok((await M.textContent('#ap-pc')).trim() === '₹152' && (await M.textContent('#ap-pm')).trim() === '₹136', 'Add product: customer ₹152 (MRP − 5%) and mechanic ₹136 (MRP − 15%) from the price rule');
const saveBtn = SC + ' .foot button.btn:not(.line)';
await M.click(saveBtn); await M.waitForTimeout(250);
ok(await M.evaluate(pn => /at least 1 photo/.test((S.ui.apErr || {}).photos || '') && !PRODUCTS.some(p => p.pn === pn), A), 'Add product: no save without a photo');
await photos(M, ['front.jpg']); await M.waitForFunction(() => S.ui.ap.photos.length === 1 && !S.ui.upN, null, { timeout: 30000 }); await M.waitForTimeout(150);
ok(/1 photo added · ready to save/.test(await T(M)) && await M.evaluate(() => !(S.ui.apErr || {}).photos && !/at least 1 photo/.test(document.querySelector('#vp .screen:last-child').innerText)), 'Add product: 1 photo is enough ("1 photo added · ready to save", the photo error goes)');
if (AI === 'ready') ok(await M.evaluate(() => { const e = document.querySelector('#vp .screen:last-child .inv-sw'); return !!e && (e.classList.contains('pend') || PH_ST[e.dataset.ph] === 'done') && /Cleaning/.test(e.querySelector('.inv-ai').textContent); }), 'photo AI: the new photo shows "Cleaning…" until its clean copy is made');
await shot(M, 'p2a-cleaning');
await photos(M, ['back.jpg', 'label.jpg']); await M.waitForFunction(() => S.ui.ap.photos.length === 3 && !S.ui.upN, null, { timeout: 30000 });
ok(/3 photos added · ready to save/.test(await T(M)), 'Add product: "3 photos added · ready to save"');
const urls = await M.evaluate(() => S.ui.ap.photos.slice()); let same = urls.length === 3 && urls.every(u => /^\/photos\/[a-f0-9]{32}-c\.jpg$/.test(u));
for (const [i, u] of urls.entries()) { const r = await M.request.get(BASE + u.replace('-c.jpg', '.jpg')); same = same && r.ok() && sha(await r.body()) === sha(fs.readFileSync(path.join(PH, ['front.jpg', 'back.jpg', 'label.jpg'][i]))); }
ok(same, 'the app shows the clean copies; the photos as taken stay on the server byte for byte (full size, no re-compression)');
if (AI === 'ready') {
  await aiDone(M, 'S.ui.ap.photos');
  ok(await M.evaluate(() => [...document.querySelectorAll('#vp .screen:last-child .inv-sw')].every(e => !e.classList.contains('pend') && /\?v=/.test(e.querySelector('img').getAttribute('src')))), 'photo AI: "Cleaning…" goes and the photos show their clean copies (no page redraw)');
  const cc = await corners(M, urls[0]), cw = await corners(M, urls[0].replace('-c.jpg', '-w.jpg')), co = await corners(M, urls[0].replace('-c.jpg', '.jpg'));
  ok(cc.every(c => c.every(v => v >= 245)), 'photo AI: the clean copy has a white background ' + JSON.stringify(cc));
  ok(cw.every((c, i) => c.every((v, j) => Math.abs(v - co[i][j]) <= 12)), 'photo AI: the "Original" copy keeps the background as taken ' + JSON.stringify([cw[0], co[0]]));
  const lg = await M.evaluate(async u => { const im = new Image(); im.src = u + '?t=' + Date.now(); await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let tint = 0; for (let y = 0; y < c.height; y += 6) for (let k = 0; k < c.width; k += 6) { const i = (y * c.width + k) * 4; if (d[i] > 225 && d[i + 2] < d[i] - 12) tint++; } return tint; }, urls[0]);
  ok(lg > 50, 'photo AI: the faint yellow logo is in the background of the clean copy (' + lg + ' tinted points)');
  await M.click(SC + ' .inv-ph > :nth-child(2) .inv-orig input'); await M.waitForTimeout(250);
  ok(await M.evaluate(() => /-w\.jpg$/.test(S.ui.ap.photos[1]) && /-c\.jpg$/.test(S.ui.ap.photos[0]) && /-c\.jpg$/.test(S.ui.ap.photos[2])), 'ticking "Original" under a photo keeps that one as taken (its -w copy), the others stay clean');
  w = await wide(M); ok(!w.length, 'phone: photo boxes with "Original" fit 390 px ' + w.join(' | '));
} else console.log('SKIP photo AI checks (test server photo AI: ' + AI + ')');
await photos(M, ['front.jpg']); await M.waitForFunction(() => !S.ui.upN, null, { timeout: 30000 }); await M.waitForTimeout(200);
ok(await M.evaluate(() => S.ui.ap.photos.length === 3), 'the same photo is not added twice');
await photos(M, ['extra.png', 'w0.jpg']); await M.waitForFunction(() => !S.ui.upN && S.ui.ap.photos.length === 4, null, { timeout: 30000 }); await M.waitForTimeout(200);
const u4 = await M.evaluate(() => S.ui.ap.photos[3]);
ok((await M.request.get(BASE + u4.replace('-c.jpg', '.png'))).ok(), '4 photos at most (a PNG works too)');
await M.click(SC + ' .inv-ph > :nth-child(4) button.x'); await M.waitForTimeout(200);
ok(await M.evaluate(() => S.ui.ap.photos.length === 3), 'a photo can be removed');
await M.fill('#ap-open', '5'); await M.fill('#ap-bin', 'b-2-07');
w = await wide(M); ok(!w.length, 'phone: Add product fits 390 px ' + w.join(' | '));
await shot(M, 'p2-addproduct', 1);
await M.click(saveBtn); await M.waitForTimeout(500);
const pr = await M.evaluate(pn => { const x = PRODUCTS.find(p => p.pn === pn); return x && { brand: x.brand, mrp: x.mrp, price: x.price, mp: x.mp, ph: x.photos.length, st: DB.stock[x.id], bin: DB.bins[x.id], cat: x.cat, fits: x.fits.length, src: x.src && x.src.vb }; }, A);
ok(pr && pr.brand === 'HERO' && pr.mrp === 160 && pr.price === 152 && pr.mp === 136 && pr.ph === 3 && pr.st === 5 && pr.bin === 'B-2-07' && pr.fits === 33 && pr.src === 'Hero', 'saved: HERO, MRP 160, customer 152, mechanic 136, 3 photos, stock 5, rack B-2-07 ' + JSON.stringify(pr));
if (AI === 'ready') ok(await M.evaluate(pn => { const x = PRODUCTS.find(p => p.pn === pn); return /-c\.jpg$/.test(x.photos[0]) && /-w\.jpg$/.test(x.photos[1]); }, A), 'the saved product keeps the "Original" choice per photo');
ok(await M.evaluate(() => document.querySelectorAll('.sheet .inv-gal img').length === 3 && /added/.test(document.querySelector('.sheet').innerText)), 'the saved sheet shows the 3 photos');
await shot(M, 'p3-saved');
await M.evaluate(() => { closeSheet(); S.ui.ap = null; refresh(); }); await M.waitForTimeout(300);
await lookFor(M, '45125aahf0099'); t = await T(M);
ok(/Already in your list/i.test(t) && /5 pcs in stock/i.test(t) && !/Save product/.test(t), 'the same part typed again (small letters, no dashes): "Already in your list", no second save');
await lookFor(M, B); t = await T(M);
ok(/Pick the brand/i.test(t) && /Hero/.test(t) && /Honda/.test(t), 'a number in both the Hero and Honda catalogues asks which brand is on the box');
await M.click(SC + ' .inv-pick button.chip:has-text("Honda")'); await M.waitForTimeout(300);
ok(/Found in Honda catalogue/i.test(await T(M)) && await M.evaluate(() => S.ui.ap.brand === 'Honda'), 'picking Honda fills the Honda details');
await lookFor(M, C); t = await T(M);
ok(/Found in KTM catalogue/i.test(t) && /no MRP/i.test(t) && await M.evaluate(() => !!document.getElementById('ap-mrp')), 'KTM part: found, "no MRP" note and an MRP box for the price on the pack');
await M.fill('#ap-mrp', '4500'); await M.waitForTimeout(100);
ok((await M.textContent('#ap-pc')).trim() === '₹4,275' && (await M.textContent('#ap-pm')).trim() === '₹3,825', 'typing MRP ₹4,500 shows customer ₹4,275 and mechanic ₹3,825 at once');
await lookFor(M, D); t = await T(M);
ok(/Not in the catalogues/i.test(t) && await M.evaluate(() => !!document.getElementById('ap-name') && !!document.getElementById('ap-brand')), 'unknown number: "Not in the catalogues" and name / brand to fill by hand');
w = await wide(M); ok(!w.length, 'phone: Add product (hand form) fits 390 px ' + w.join(' | '));
await M.evaluate(() => { S.ui.ap = null; S.ui.apErr = null; back(); }); await M.waitForTimeout(200);
// photos in the shop
ok(await M.evaluate(pn => /<img class="pimg-ph" src="\/photos\/[a-f0-9]{32}-c\.jpg[^"]*"/.test(pcard(PRODUCTS.find(p => p.pn === pn))), A), 'shop card shows the first photo (the clean copy)');
ok(await M.evaluate(pn => { const h = SCREENS.product({ id: PRODUCTS.find(p => p.pn === pn).id }), g = /<div class="inv-gal">([\s\S]*?)<\/div>/.exec(h); return !!g && (g[1].match(/<img /g) || []).length === 3; }, A), 'the product page (customer shop) shows all 3 photos');
const anon = await b.newContext(); const u0 = urls[0];
ok((await anon.request.get(BASE + u0)).status() === 200 && (await anon.request.get(BASE + u0.replace('-c.jpg', '-w.jpg'))).status() === 200, 'the copies with the logo open without a login (customers see them)');
ok((await anon.request.get(BASE + u0.replace('-c.jpg', '.jpg'))).status() === 401 && (await anon.request.get(BASE + '/api/photo/status?h=' + u0.slice(8, 40))).status() === 401, 'the photo as taken and the AI status are for staff only');
ok((await anon.request.post(BASE + '/api/photo', { data: fs.readFileSync(path.join(PH, 'w1.jpg')), headers: { 'Content-Type': 'image/jpeg' } })).status() === 401, 'only logged-in staff can upload photos');
// Stock in on the phone: a new KTM line with its panel
await M.evaluate(() => { S.ui.ge = null; go('grnedit', { id: 'new' }); }); await M.waitForTimeout(300);
await M.fill('#ge-code', C3); await M.press('#ge-code', 'Enter'); await M.waitForFunction(() => (S.ui.ge.nw || []).length === 1, null, { timeout: 90000 }); await M.waitForTimeout(200);
t = await T(M); ok(/New part/i.test(t) && /From KTM catalogue/i.test(t) && /Photos & MRP|Close/i.test(t), 'phone Stock in: a KTM number not in the list comes as a new-part line');
w = await wide(M); ok(!w.length, 'phone: Stock in with the new-part panel fits 390 px ' + w.join(' | '));
await shot(M, 'p5-stockin', 1);
await M.evaluate(() => { S.ui.ge = null; S.ui.geOpen = null; back(); }); await M.waitForTimeout(200);
await M.evaluate(() => { S.ui.ip = null; go('invpaste'); }); await M.waitForTimeout(300);
await M.fill('#ip-ta', `${A} 4 118\n${C2}, 2, 2150\nZQ55 1 9`);
await M.waitForFunction(() => { const t = document.querySelector('#vp .screen:last-child').innerText; return /1 ready/i.test(t) && !/Checking the/i.test(t); }, null, { timeout: 90000 }); await M.waitForTimeout(300);
w = await wide(M); ok(!w.length, 'phone: Paste supplier bill fits 390 px ' + w.join(' | '));
await shot(M, 'p6-paste', 1);
await M.evaluate(() => { S.ui.ip = null; back(); });

// ===== computer (website layout), Admin =====
const Dk = await mk(1440, 900); await login(Dk, ADMIN, PW);
ok(await Dk.evaluate(() => document.documentElement.classList.contains('wv')), 'computer: website layout');
await Dk.evaluate(() => go('ainv')); await Dk.waitForTimeout(400);
ok(await Dk.evaluate(() => getComputedStyle(document.querySelector('#vp .screen:last-child .inv-2c.side')).gridTemplateColumns.split(' ').length === 2), 'computer: Inventory page in two columns');
t = await T(Dk); ok(/Recently added/i.test(t) && /shoe/i.test(t) && /3 photos/i.test(t), 'Recently added shows the new part with 3 photos');
await shot(Dk, 'd1-inventory', 1);
await Dk.evaluate(() => invRuleSheet()); await Dk.waitForTimeout(200);
await Dk.fill('#pr-c', '120'); await Dk.evaluate(() => invRuleSave()); await Dk.waitForTimeout(200);
ok(await Dk.evaluate(() => /0 to 99/.test(document.getElementById('pr-err').textContent) && !DB.priceRule), 'price rule: 120 % is refused');
await Dk.fill('#pr-c', '10'); await Dk.fill('#pr-m', '20'); await Dk.evaluate(() => invRuleSave()); await Dk.waitForTimeout(300);
ok(await Dk.evaluate(() => DB.priceRule.c === 10 && DB.priceRule.m === 20 && /MRP − 10%/.test(document.querySelector('#vp .screen:last-child').innerText)), 'price rule changed to MRP − 10 % / − 20 %');
await Dk.evaluate(() => { S.ui.ap = null; go('addproduct'); }); await Dk.waitForTimeout(300);
await lookFor(Dk, A2);
ok((await Dk.textContent('#ap-pc')).trim() === '₹211.50' && (await Dk.textContent('#ap-pm')).trim() === '₹188', 'new rule: MRP ₹235 gives customer ₹211.50 and mechanic ₹188');
ok(await Dk.evaluate(() => getComputedStyle(document.querySelector('#vp .screen:last-child .inv-2c')).gridTemplateColumns.split(' ').length === 2), 'computer: Add product in two columns');
await shot(Dk, 'd2-addproduct', 1);
await Dk.evaluate(() => { S.ui.ap = null; back(); });
// Stock in: an old part, a new KTM part with photos, a number in no catalogue
await Dk.evaluate(() => { S.ui.ge = null; go('grnedit', { id: 'new' }); }); await Dk.waitForTimeout(300);
await Dk.fill('#ge-sup', 'Ganesh Auto Spares'); await Dk.fill('#ge-inv', 'GAS-2207');
await Dk.fill('#ge-code', A); await Dk.press('#ge-code', 'Enter'); await Dk.waitForTimeout(300);
ok(await Dk.evaluate(() => S.ui.ge.items.length === 1 && +S.ui.ge.items[0].q === 1 && !(S.ui.ge.nw || []).length), 'Stock in: a part already in the list only gets qty');
await Dk.fill('#ge-code', C); await Dk.press('#ge-code', 'Enter'); await Dk.waitForFunction(() => (S.ui.ge.nw || []).length === 1, null, { timeout: 90000 }); await Dk.waitForTimeout(200);
t = await T(Dk); ok(/From KTM catalogue/i.test(t) && /no MRP/i.test(t) && /Needs a photo/i.test(t) && /1 needed · 4 max/i.test(t), 'Stock in: KTM number comes as a new-part line, its panel asks for MRP and a photo (4 max)');
await Dk.fill('#ge-code', D); await Dk.press('#ge-code', 'Enter'); await Dk.waitForFunction(pn => S.ui.gePick && S.ui.gePick.pn === pn, D, { timeout: 90000 }); await Dk.waitForTimeout(200);
ok(/Not found/i.test(await T(Dk)), 'Stock in: a number in no catalogue says Not found');
await Dk.click(SC + ' button:has-text("Add it by hand")'); await Dk.waitForTimeout(300);
ok(await Dk.evaluate(() => S.ui.ge.nw.length === 2 && S.ui.ge.nw[1].hand === 1), 'Add it by hand adds a line to fill later');
await Dk.evaluate(() => { S.ui.geOpen = S.ui.ge.nw[0].k; refresh(); }); await Dk.waitForTimeout(200);
await Dk.fill('#nw-mrp', '5200'); await Dk.press('#nw-mrp', 'Tab'); await Dk.waitForTimeout(150);
await photos(Dk, ['w1.jpg'], SC + ' .inv-pan'); await Dk.waitForFunction(() => S.ui.ge.nw[0].photos.length === 1 && !S.ui.upN, null, { timeout: 30000 }); await Dk.waitForTimeout(200);
t = await T(Dk); ok(/Ready · 1 photo\b/i.test(t) && /Ready\. It goes into stock when you post the bill/.test(t), 'the KTM line with MRP and 1 photo is Ready');
ok(await Dk.evaluate(() => getComputedStyle(document.querySelector('#vp .screen:last-child .inv-2c.side')).gridTemplateColumns.split(' ').length === 2), 'computer: new-part lines and the photo panel side by side');
await Dk.evaluate(() => { S.ui.ge.items[0].rate = '118'; });
await Dk.fill('#nw-r0', '3900'); await Dk.press('#nw-r0', 'Tab'); await Dk.waitForTimeout(150);
await Dk.evaluate(() => geSave(true)); await Dk.waitForTimeout(200);
ok(await Dk.evaluate(() => S.ui.geErr && S.ui.geErr.n1 === 1 && DB.grns.length === 0), 'posting needs the rate of every new line too');
await Dk.fill('#nw-r1', '250'); await Dk.press('#nw-r1', 'Tab'); await Dk.waitForTimeout(150);
t = await T(Dk); ok(/Post 2 ready lines/i.test(t) && /1 part waits for photos/i.test(t), 'foot: "Post 2 ready lines", 1 part waits for photos');
await shot(Dk, 'd3-stockin', 1);
const stA0 = await Dk.evaluate(pn => DB.stock[PRODUCTS.find(p => p.pn === pn).id], A);
await Dk.evaluate(() => geSave(true)); await Dk.waitForTimeout(600);
const g1 = await Dk.evaluate(([a, c]) => { const g = DB.grns[DB.grns.length - 1]; const k = PRODUCTS.find(p => p.pn === c); return { id: g.id, st: g.status, items: g.items.length, wait: (g.wait || []).length, wp: (DB.waitParts || []).length, kst: k && DB.stock[k.id], kpr: k && [k.mrp, k.price, k.mp, k.photos.length, k.brand], a: DB.stock[PRODUCTS.find(p => p.pn === a).id] }; }, [A, C]);
ok(g1.st === 'posted' && g1.items === 2 && g1.wait === 1 && g1.wp === 1 && g1.kst === 1 && g1.a === stA0 + 1, 'posted: old part +1, the KTM part made with stock 1, the hand part waits for photos ' + JSON.stringify(g1));
ok(JSON.stringify(g1.kpr) === JSON.stringify([5200, 4680, 4160, 1, 'KTM']), 'the new KTM part: MRP 5200, prices from the new rule (4680 / 4160), 1 photo ' + JSON.stringify(g1.kpr));
await Dk.evaluate(id => go('grnview', { id }), g1.id); await Dk.waitForTimeout(300);
ok(/Waiting for photos/i.test(await T(Dk)) && new RegExp(D).test(await T(Dk)), 'the posted bill shows the part that waits for photos');
await Dk.evaluate(() => { S.ui.iw = null; go('invwait'); }); await Dk.waitForTimeout(400);
ok(await Dk.evaluate(() => !!document.querySelector('#vp .screen:last-child .inv-pan') && /Part 1 of 1/i.test(document.querySelector('#vp .screen:last-child').innerText)), 'computer: Waiting for photos opens the first part next to the list');
await shot(Dk, 'd4-waiting', 1); await Dk.evaluate(() => back());
// Paste supplier bill
await Dk.evaluate(() => { S.ui.ip = null; go('invpaste'); }); await Dk.waitForTimeout(300);
await Dk.fill('#ip-ta', ['Part No\tQty\tRate', `${A}\t10\t118.00`, `${B}, 4, 31.50`, `${Y} 6pcs 44`, `${C2} 2 2,150`, 'ZQ1122334 1 99', 'Total 1,234.00'].join('\n'));
await Dk.waitForFunction(() => { const t = document.querySelector('#vp .screen:last-child').innerText; return /1 ready/i.test(t) && !/Checking the/i.test(t); }, null, { timeout: 90000 }); await Dk.waitForTimeout(300);
t = await T(Dk);
ok(/Pasted · 5 lines/i.test(t) && /1 ready/i.test(t) && /4 need you/i.test(t) && /1 line skipped/i.test(t), 'paste: 5 part lines (1 in the list, 4 need you), the header and Total lines are not parts');
ok(/Hero and Honda catalogues/i.test(t) && /Yamaha catalogue/i.test(t) && /Not found/i.test(t), 'paste: the Hero/Honda number asks for the brand, the Yamaha one is new, the unknown one is Not found');
const addAll = SC + ' button:has-text("Add all")';
ok(await Dk.isDisabled(addAll), 'paste: "Add all" waits until the brand is picked');
await Dk.click(SC + ' .inv-cl .chip:has-text("Hero")'); await Dk.waitForTimeout(300);
ok(!(await Dk.isDisabled(addAll)), 'paste: after picking Hero, "Add all" works');
await shot(Dk, 'd5-paste', 1);
await Dk.click(addAll); await Dk.waitForTimeout(500);
const g2 = await Dk.evaluate(() => ({ s: cur().s, items: S.ui.ge.items.map(i => [P(i.pid).pn, +i.q, String(i.rate)]), nw: S.ui.ge.nw.map(n => [n.pn, n.brand || '', +n.q, String(n.rate), n.hand ? 1 : 0, String(n.mrp)]) }));
ok(g2.s === 'grnedit' && JSON.stringify(g2.items) === JSON.stringify([[A, 10, '118.00']]), 'paste: the line in the list goes on a Stock in bill with qty 10 and rate 118 ' + JSON.stringify(g2.items));
ok(JSON.stringify(g2.nw) === JSON.stringify([[B, 'Hero', 4, '31.50', 0, '35'], [Y, 'Yamaha', 6, '44', 0, '55'], [C2, 'KTM', 2, '2150', 0, ''], ['ZQ1122334', '', 1, '99', 1, '']]), 'paste: the 4 new parts come as new-part lines with brand, qty, rate and MRP ' + JSON.stringify(g2.nw));
await Dk.evaluate(() => { S.ui.ge = null; back(); }); await Dk.waitForTimeout(200);
// staff logins for the next checks
for (const [nm, id, pw, role] of [['Ravi Store', 'ravi@test.in', 'ravi1234', 'Inventory'], ['Bina Bill', 'bina@test.in', 'bina1234', 'Billing']]) {
  await Dk.evaluate(r => { S.ui.ns = null; go('newstaff'); S.ui.ns.role = r; refresh(); }, role); await Dk.waitForTimeout(300);
  await Dk.fill('#ns1', nm); await Dk.fill('#ns2', id); await Dk.fill('#ns3', pw); await Dk.click(SC + ' .foot .btn'); await Dk.waitForTimeout(900); await Dk.evaluate(() => closeSheet());
}
ok(await Dk.evaluate(() => DB.accounts['ravi@test.in'].role === 'inventory' && DB.accounts['bina@test.in'].role === 'billing'), 'admin made an Inventory and a Billing staff login');
await Dk.waitForTimeout(2500);

// ===== phone, Inventory staff: finish the waiting part, Find Part "Add to stock" =====
const I = await mk(390, 844); await login(I, 'ravi@test.in', 'ravi1234');
ok(await I.evaluate(() => S.user && S.user.role === 'inventory'), 'inventory staff logged in on a phone');
await I.evaluate(() => tab('ihome')); await I.waitForTimeout(300); t = await T(I);
ok(/Paste supplier bill/.test(t) && /Waiting for photos/.test(t), 'inventory home: Paste supplier bill and Waiting for photos');
await I.evaluate(() => go('invwait')); await I.waitForTimeout(300); t = await T(I);
ok(/Waiting · 1 part/i.test(t) && new RegExp(D).test(t) && /Not in any catalogue/i.test(t) && /1 pcs from 1 bill/i.test(t), 'Waiting for photos lists the part from the bill');
await I.click(SC + ' .inv-row'); await I.waitForTimeout(300);
await I.click(SC + ' button:has-text("Save & next part")'); await I.waitForTimeout(250);
ok(await I.evaluate(() => { const e = S.ui.iwErr || {}; return !!(e.photos && e.mrp && e.name && e.brand) && PRODUCTS.every(p => p.pn !== 'ZX9988776'); }), 'a waiting part cannot go into stock without name, brand, MRP and a photo');
await I.fill('#iw-name', 'Clutch Lever Assembly'); await I.fill('#iw-brand', 'Minda'); await I.fill('#iw-mrp', '310');
await photos(I, ['w3.jpg', 'w4.jpg'], SC + ' .inv-pan'); await I.waitForFunction(() => DB.waitParts[0] && DB.waitParts[0].photos.length === 2 && !S.ui.upN, null, { timeout: 30000 }); await I.waitForTimeout(200);
await I.fill('#iw-bin', 'c-4-12');
w = await wide(I); ok(!w.length, 'phone: Waiting for photos fits 390 px ' + w.join(' | '));
await shot(I, 'p7-waiting', 1);
await I.click(SC + ' button:has-text("Save & next part")'); await I.waitForTimeout(500);
const w1 = await I.evaluate(pn => { const x = PRODUCTS.find(p => p.pn === pn); const g = x && DB.grns.find(g => g.items.some(i => i.pid === x.id)); return x && { name: x.name, brand: x.brand, st: DB.stock[x.id], mrp: x.mrp, price: x.price, mp: x.mp, ph: x.photos.length, bin: DB.bins[x.id], wp: (DB.waitParts || []).length, gw: g && (g.wait || []).length, gi: g && g.items.length }; }, D);
ok(w1 && w1.name === 'Clutch Lever Assembly' && w1.brand === 'MINDA' && w1.st === 1 && w1.mrp === 310 && w1.price === 279 && w1.mp === 248 && w1.ph === 2 && w1.bin === 'C-4-12' && w1.wp === 0 && w1.gw === 0 && w1.gi === 3, 'photos done: the part is made (rule −10/−20: 279 / 248), 1 pc goes into stock at C-4-12, the bill line moves from waiting to received ' + JSON.stringify(w1));
ok(await openPart(I, 'Hero', '06455AACJ10'), 'Find Part opens the Hero part page');
t = await T(I); ok(/Not in your stock list yet/i.test(t) && /Add to stock/.test(t), 'Find Part: a catalogue part not in stock has "Add to stock" for inventory staff');
w = await wide(I); ok(!w.length, 'phone: Find Part part page fits 390 px ' + w.join(' | '));
await shot(I, 'p8-findpart', 1);
await I.click(SC + ' button:has-text("Add to stock")'); await I.waitForTimeout(500);
await I.waitForFunction(() => !!document.querySelector('#vp .screen:last-child .inv-found'), null, { timeout: 90000 }).catch(() => {});   // the other brands' files are checked for the same number
ok(await I.evaluate(pn => cur().s === 'addproduct' && S.ui.ap.pn === pn && S.ui.ap.brand === 'Hero' && S.ui.ap.mrp === '235' && /Found in Hero catalogue/i.test(document.querySelector('#vp .screen:last-child').innerText), A2), 'Add to stock opens Add product with the part filled (Hero, MRP 235)');
await I.evaluate(() => { S.ui.ap = null; back(); });
await I.evaluate(() => { DB.priceRule = { c: 50, m: 50 }; save(); }); await I.waitForTimeout(2500);
const ruleOnServer = await Dk.request.get(BASE + '/api/sync?since=0').then(r => r.json()).then(j => j.changed.priceRule);
ok(ruleOnServer && ruleOnServer.c === 10 && ruleOnServer.m === 20, 'only Admin can change the price rule (staff change ignored by the server) ' + JSON.stringify(ruleOnServer));
// Billing staff: Find Part shows the part, but no "Add to stock"
const Bl = await mk(390, 844); await login(Bl, 'bina@test.in', 'bina1234');
ok(await openPart(Bl, 'Hero', '06455AACJ10'), 'billing staff: Find Part opens the part page');
t = await T(Bl); ok(/Inventory can add it/.test(t) && !/Add to stock/.test(t), 'billing staff: no "Add to stock" button (only Inventory and Admin add parts)');
// on the server after a reload
await Dk.reload({ waitUntil: 'load' }); await Dk.waitForFunction(() => typeof S !== 'undefined' && S.user && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await Dk.waitForTimeout(1200);
ok(await Dk.evaluate(pns => pns.every(([pn, n]) => { const x = PRODUCTS.find(p => p.pn === pn); return x && x.photos.length === n && DB.stock[x.id] > 0; }) && !(DB.waitParts || []).length && DB.priceRule.c === 10, [[A, 3], [C, 1], [D, 2]]), 'after a reload: the 3 new parts with their photos and stock, nothing waiting, the price rule kept');
if (AI === 'ready') { await aiDone(Dk, 'PRODUCTS.flatMap(p => p.photos || [])').catch(() => {}); const hs = await Dk.evaluate(() => PRODUCTS.flatMap(p => p.photos || []).map(phH));
  const st = await Dk.request.get(BASE + '/api/photo/status?h=' + hs.join(',')).then(r => r.json());
  ok(hs.length >= 7 && hs.every(h => st.st[h] === 'done'), 'photo AI: every product photo got its copies (' + Object.values(st.st).join(',') + ')'); }
// ===== Sam 18:56Z: "Photo of the bill" on Paste supplier bill. The phone reads it (a printed bill, photographed on a table, turned a
// little, light falling across it); nothing is sent to the server, nothing is kept. Every row with a part number becomes a line, the
// row without one is listed, a misread number is matched to the catalogue one.
{
  const BILL = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;width:1240px;margin:0;padding:40px;background:#fff;color:#111;font-size:19px}
  h1{font-size:30px;margin:0 0 4px}.s{font-size:16px;color:#333}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #444;padding:7px 8px;text-align:left}th{background:#eee;font-size:17px}td.n{text-align:right}</style></head><body>
  <h1>SHREE GANESH AUTO DISTRIBUTORS</h1><div class="s">12, Station Road, Pune 411001 · Ph: 9822012345 · GSTIN: 27ABCDE1234F1Z5</div>
  <div class="s" style="margin-top:10px">TAX INVOICE &nbsp; Invoice No: SGA/2425/0817 &nbsp; Date: 11/10/2026 &nbsp; Bill To: BIKE PHARMA AUTOMOBILES</div>
  <table><tr><th>S.No</th><th>Part No.</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr>
  ${[[A, 'SHOE COMP BRAKE', '87141090', 10, 'NOS', '118.00', '1,180.00'], [B, 'VALVE EX', '84099990', 4, 'NOS', '31.50', '126.00'], [Y, 'PLUG, DRAIN', '87141090', 6, 'NOS', '44.00', '264.00'],
     [C2, 'CLUTCH COVER GASKET', '84099990', 2, 'NOS', '2,150.00', '4,300.00'], [A2, 'BRAKE PAD KIT', '87141090', 5, 'SET', '188.00', '940.00'], [D, 'SIDE STAND SPRING', '73202000', 1, 'NOS', '99.00', '99.00'],
     [NF, 'HORN RELAY', '85365090', 2, 'NOS', '57.00', '114.00'], ['', 'GREASE 100G', '34039900', 3, 'NOS', '65.00', '195.00']].map((r, i) => `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="n">${r[3]}</td><td>${r[4]}</td><td class="n">${r[5]}</td><td class="n">${r[6]}</td></tr>`).join('')}
  <tr><td></td><td></td><td>Taxable Value</td><td></td><td></td><td></td><td></td><td class="n">7,218.00</td></tr><tr><td></td><td></td><td>CGST 9%</td><td></td><td></td><td></td><td></td><td class="n">649.62</td></tr>
  <tr><td></td><td></td><td>SGST 9%</td><td></td><td></td><td></td><td></td><td class="n">649.62</td></tr><tr><td></td><td></td><td>Grand Total</td><td></td><td></td><td></td><td></td><td class="n">8,517.24</td></tr></table>
  <div class="s" style="margin-top:14px">Amount in words: Rupees Eight Thousand Five Hundred Seventeen Only. E.&amp; O.E.</div></body></html>`;
  const bc = await b.newContext({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 2 }), bp = await bc.newPage();
  await bp.setContent(BILL); const png = await bp.screenshot({ fullPage: true });
  // the phone photo: 3024 x 4032, the bill on a dark table, turned 2.2 degrees, darker on the left
  const jpg = Buffer.from(await bp.evaluate(async src => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = 3024; c.height = 4032; const x = c.getContext('2d');
    x.fillStyle = '#5c402c'; x.fillRect(0, 0, 3024, 4032); x.save(); x.translate(1512, 1300); x.rotate(2.2 * Math.PI / 180); x.drawImage(im, -im.width * 0.55, -im.height * 0.55, im.width * 1.1, im.height * 1.1); x.restore();
    const g = x.createLinearGradient(0, 0, 3024, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 3024, 4032);
    return c.toDataURL('image/jpeg', .85).split(',')[1]; }, 'data:image/png;base64,' + png.toString('base64')), 'base64');
  await bc.close();
  await M.evaluate(() => { S.ui.ip = null; go('invpaste'); }); await M.waitForTimeout(300);
  t = await T(M); ok(/Photo of the bill/i.test(t) && /Take a photo of the printed bill/.test(t), 'Paste supplier bill: "Photo of the bill" button');
  const sent = []; const watch = r => { if (r.method() !== 'GET') sent.push([r.url(), (r.postDataBuffer() || Buffer.alloc(0)).length]); else if (/\/photos\/|\/api\/photo/.test(r.url())) sent.push([r.url(), 0]); };
  M.on('request', watch); const tOcr = Date.now();
  await M.locator(SC + ' input[type=file][aria-label="Photo of the bill"]').setInputFiles({ name: 'bill.jpg', mimeType: 'image/jpeg', buffer: jpg });
  await M.waitForFunction(() => S.ui.ip && S.ui.ip.ocr && (S.ui.ip.ocr.st === 'err' || S.ui.ip.ocr.st === 'done' && S.ui.ip.ocr.chk), null, { timeout: 180000 }).catch(() => {});
  const ocrMs = Date.now() - tOcr; M.off('request', watch);
  const o = await M.evaluate(() => ({ ...S.ui.ip.ocr, txt: S.ui.ip.txt }));
  const want = [`${A} 10 118.00`, `${B} 4 31.50`, `${Y} 6 44.00`, `${C2} 2 2150.00`, `${A2} 5 188.00`, `${D} 1 99.00`, `${NF} 2 57.00`];
  ok(o.st === 'done' && o.n === 7 && want.every(l => o.txt.split('\n').includes(l)), `bill photo read: 7 lines with part no., qty and rate (${ocrMs} ms) ` + JSON.stringify(o.txt.split('\n')) + (o.st === 'err' ? ' ' + o.msg : ''));
  ok(o.raw && o.raw.length === 1 && /GREASE 100G/.test(o.raw[0]), 'the item row without a part number is listed (not lost) ' + JSON.stringify(o.raw));
  ok(!/27ABCDE|9822012345|87141090|85365090|SGA|8517/.test(o.txt), 'GSTIN, phone, HSN, invoice no. and totals are never taken for parts');
  t = await T(M); ok(/Read from the photo: 7 lines/.test(t) && /The photo is not saved/.test(t) && /in your list/i.test(t) && /Not found/i.test(t) && new RegExp(NF).test(t), 'the check shows every line: found ones and the one not found ' + t.replace(/\s+/g, ' ').slice(0, 160));
  ok(!sent.some(([u, n]) => n > 100000 || /\/photos\/|\/api\/photo/.test(u)), 'the bill photo never leaves the phone (no upload, nothing saved) ' + JSON.stringify(sent.filter(([u, n]) => n > 2000).slice(0, 3)));
  w = await wide(M); ok(!w.length, 'phone: Paste supplier bill with the photo result fits 390 px ' + w.join(' | '));
  await shot(M, 'p9-billphoto', 1);
  ok(await M.evaluate(([bad, good]) => { const m = ocrNear(catPk(bad)); return !!m && catPk(m.pn) === catPk(good); }, ['45I25-AAH-F0O99', A]), 'a misread number (45I25-AAH-F0O99) is matched to the catalogue number');
  ok(await M.evaluate(() => !ocrNear(catPk('QQ7777777'))), 'a number like no catalogue number is left as read');
}
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 4).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
