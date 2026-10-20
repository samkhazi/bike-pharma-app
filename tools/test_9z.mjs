// update 9z (Sam 2026-10-20): who added a product (the server writes the login's name), 'All <brand> models' in the bike list,
// part numbers typed without dashes / with Hero's S ending in the shop's own lists.   BASE=... node tools/test_9z.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
// All Hero models: one chip, fits any Hero bike, not a Honda
await p.evaluate(() => { S.ui.ap = null; go('addproduct'); S.ui.ap.pn = 'ZZTEST9Z01'; apLookNow(); }); await p.waitForTimeout(1500);
const opt = await p.evaluate(() => { const s = document.getElementById('ap-vm'); return s ? s.options[0].textContent : ''; });
ok(/^All .* models$/.test(opt), 'the Model list starts with ' + opt);
const fits = await p.evaluate(() => { const a = S.ui.ap; a.vb = 'Hero'; a.vm = '*'; addFit(); a.vm = 'Splendor Plus'; return a.fits.slice(); });
ok(fits.length === 1 && fits[0] === 'Hero All models', 'one chip: ' + fits.join(' | '));
const fv = await p.evaluate(() => { const x = { fits: ['Hero All models'] }; return [fitVeh(x, { b: 'Hero', m: 'Glamour', bs: 'BS6', c: 'Red' }), fitVeh(x, { b: 'Honda', m: 'Shine', bs: 'BS6', c: 'Red' })]; });
ok(fv[0] === 'fit' && fv[1] === '', 'fits every Hero bike, not Honda: ' + fv.join(','));
// save a product: the server writes who added it
const id = await p.evaluate(async () => { const a = S.ui.ap; Object.assign(a, { name: 'Test part 9z', brand: 'Hero', cat: 'Cables', mrp: '100', open: '2', warDays: '0', photos: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='], fits: ['Hero All models'] });
  const n = (DB.newProducts || []).length; try { saveProduct(); } catch (e) { console.log(e.message); } return (DB.newProducts || []).length > n ? DB.newProducts[DB.newProducts.length - 1].id : null; });
if (!id) { // the save function's name differs: find the Save button and click it
  await p.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(b => /save product/i.test(b.textContent)); btn && btn.click(); }); await p.waitForTimeout(1500); }
await p.evaluate(async () => { await srvSync?.(); }).catch(() => {}); await p.waitForTimeout(3000);
const np = await p.evaluate(() => (DB.newProducts || []).find(x => x.pn === 'ZZTEST9Z01'));
ok(np && np.byN && np.byT, 'the new product has Added by ' + JSON.stringify(np && { byN: np.byN, byT: np.byT, by: np.by }));
await p.evaluate(() => { S.ui.rq = 'zztest9z01'; go('stocklist'); }); await p.waitForTimeout(500);
const t = await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
ok(/Added by /.test(t) && !!(await p.$('#rby')), 'Products & stock shows Added by and the Added by filter');
// own list search: no dashes and Hero's S
const f = await p.evaluate(() => { const x = { pn: '16450-ACK-000' }; return [pnQ(x, '16450ack000s'), pnQ(x, '16450ACK000'), pnQ(x, '9999')]; });
ok(f[0] && f[1] && !f[2], 'own list: 16450ack000s and 16450ACK000 match 16450-ACK-000 ' + f.join(','));
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
