// 22v: a Rolon (LGB) kit box has no barcode or QR: the label's "Part No" is read and looked up in the Rolon list.
//   node tools/test_rolonlbl22v.mjs LABEL.y4m LABEL.jpg   (Sam's box photo, not in the repo; the local Rolon list needs KIT HPXR 206, KTM DUKE 200CC, MRP 2584)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3033', [y4m, jpg] = process.argv.slice(2);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
const p = await ctx.newPage(); const errs = [], up = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/apRolon/.test(m.text())) console.log('console:', m.text()); });
p.on('request', r => { if (r.method() !== 'GET' && /photo|upload|ocr|scan/i.test(r.url())) up.push(r.url()); });
await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForSelector('#bpOpen', { state: 'detached', timeout: 9000 }).catch(() => {});
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1');
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.waitForTimeout(600);
const open = async () => { await p.evaluate(() => { S.ui.ap = null; reset('addproduct'); }); await p.waitForSelector('#ap-scan'); await p.evaluate(() => { window.__m = []; if (!window.__f) { window.__f = apScanMsg; apScanMsg = t => { if (__m[__m.length - 1] !== t) __m.push(t); return __f(t); }; } }); };
// 1. live camera
await open(); let t0 = Date.now(); await p.click('#ap-scan');
await p.waitForFunction(() => !document.getElementById('aps-v') && S.ui.ap && S.ui.ap.pn, null, { timeout: 60000 }).catch(() => {});
let a = await p.evaluate(() => ({ pn: S.ui.ap && S.ui.ap.pn, open: !!document.getElementById('aps-v'), m: __m }));
console.log('camera:', a.m, '| seconds', ((Date.now() - t0) / 1000).toFixed(1));
ok(a.pn === 'KIT3657HP01063842' && !a.open, 'live camera: the label\'s Part No KIT HPXR 206 was read and the kit filled: ' + a.pn);
ok(/KIT HPXR 206|Rolon/i.test(await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText)), 'Add product shows the Rolon kit');
// 2. photo
await open(); await p.click('#ap-scan'); await p.waitForSelector('#aps-file', { state: 'attached' }); t0 = Date.now(); await p.setInputFiles('#aps-file', jpg);
await p.waitForFunction(() => !document.getElementById('aps-v') && S.ui.ap && S.ui.ap.pn, null, { timeout: 60000 }).catch(() => {});
a = await p.evaluate(() => ({ pn: S.ui.ap && S.ui.ap.pn, m: __m })); console.log('photo:', a.m, '| seconds', ((Date.now() - t0) / 1000).toFixed(1));
ok(a.pn === 'KIT3657HP01063842', 'Take photo: the kit filled: ' + a.pn);
// 3. checks, on made-up label text
await open(); await p.evaluate(() => { APS = { job: 0 }; apScanSheet(); amLoad(); }); await p.waitForFunction(() => AM_ST === 2);
const run = L => p.evaluate(L => { S.ui.ap.pn = ''; const r = apRolonUse(L); return [r, S.ui.ap.pn, (document.getElementById('aps-msg') || {}).textContent || '']; }, L);
let r = await run(['Model : KTM DUKE 200CC', 'Part No : KIT HPXR 206', 'Commodity : Chain Sprocket Kit', 'MRP : X 2999.00 (Incl. of all taxes)']); console.log(r);
ok(r[0] === 2 && !r[1] && /MRP/.test(r[2]), 'another MRP on the box: shown, not filled');
r = await run(['Model : HERO SPLENDOR', 'Part No : KIT HPXR 206', 'Commodity : Chain Sprocket Kit', 'MRP : 2584.00']); console.log(r);
ok(r[0] === 2 && !r[1] && /model/.test(r[2]), 'another model on the box: shown, not filled');
r = await run(['Model : KTM DUKE 200CC', 'Part No : KIT HPXR 777', 'Commodity : Chain Sprocket Kit', 'MRP : 2584.00']); console.log(r);
ok(r[0] === 2 && !r[1] && /no such kit/.test(r[2]), 'a kit the list does not have: shown, not filled');
r = await run(['Model : KTM DUKE 200CC', 'Part No : KIT HPXR 2O6', 'Commodity : Chain Sprocket Kit']); console.log(r);
ok(r[0] === 1 && r[1] === 'KIT3657HP01063842', 'O read for 0: still the right kit');
await open(); await p.evaluate(() => { APS = { job: 0 }; apScanSheet(); });
r = await run(['HONDA PARTS & ACCESSORIES', 'Part No : 32100K14600', 'Product : HARNESS WIRE', 'MRP 728.00']); ok(r[0] === 0, 'a Honda label is not taken as a Rolon label');
ok(!up.length, 'the picture was not sent anywhere ' + up.join(' '));
ok(!errs.length, 'no page errors ' + errs.join(';'));
await b.close(); process.exit(fails ? 1 : 0);
