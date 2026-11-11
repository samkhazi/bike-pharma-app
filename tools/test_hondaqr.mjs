// update 20p: the live scanner on a Honda box label. Honda's QR holds only a link (no part number), so the number printed beside it is read.
// The camera is Chromium's fake one fed a Y4M made from a label photo (not in the repo: Sam's photos):
//   BASE=http://127.0.0.1:3033 node tools/test_hondaqr.mjs LABEL.y4m EXPECTED_PART_NO
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3033', [y4m, want] = process.argv.slice(2);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
const p = await ctx.newPage(); const errs = [], net = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/apHonda/.test(m.text())) console.log('console:', m.text()); }); p.on('request', r => { if (/honda/i.test(new URL(r.url()).hostname)) net.push(r.url()); });
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
await p.evaluate(() => { S.ui.ap = null; go('addproduct'); }); await p.waitForTimeout(300);
// KNOWN=1: the number is in the shop's list (as a catalogue number is on the server); without it no list knows the number and nothing may be filled
if (process.env.KNOWN) await p.evaluate(pn => { PRODUCTS.push(Object.assign({}, PRODUCTS[0], { id: 'p-hqtest', pn, name: 'Honda QR test part', barcode: '' })); }, want);
await p.evaluate(() => { window.__m = []; const f = apScanMsg; apScanMsg = t => { if (__m[__m.length - 1] !== t) __m.push(t); return f(t); }; });
const t0 = Date.now(); await p.click('#ap-scan');
await p.waitForFunction(() => (!document.getElementById('aps-v') && S.ui.ap && S.ui.ap.pn) || /no list has|not clear/.test((document.getElementById('aps-msg') || {}).textContent || ''), null, { timeout: +(process.env.WAIT || 40000) }).catch(() => {});
const msgs = await p.evaluate(() => __m);
if (process.env.DBG) { console.log(await p.evaluate(() => { const v = document.getElementById('aps-v'); return JSON.stringify({ hn: APS && APS.hn, n: APS && APS.n, t: APS && APS.t, vw: v && v.videoWidth, paused: v && v.paused, rs: v && v.readyState }); })); await p.waitForTimeout(3000); console.log(await p.evaluate(() => JSON.stringify({ n: APS && APS.n, hn: APS && APS.hn }))); }
const a = await p.evaluate(() => ({ pn: S.ui.ap && S.ui.ap.pn, open: !!document.getElementById('aps-v') }));
console.log('messages:', msgs, '| seconds:', ((Date.now() - t0) / 1000).toFixed(1));
ok(msgs.some(m => /Honda QR seen/.test(m)), 'the live scanner noticed the Honda QR');
if (process.env.KNOWN) ok(String(a.pn || '').replace(/-/g, '') === want.replace(/-/g, '') && !a.open, 'the printed number was read and filled: ' + a.pn + ' (wanted ' + want + ')');
else ok(!a.pn && a.open && msgs.some(m => /no list has this number|not clear/.test(m)), 'a number no list knows is not filled in, only shown: ' + (a.pn || 'nothing filled'));
ok(!net.length, 'nothing was sent to Honda ' + net.join(' '));
ok(!errs.length, 'no page errors ' + errs.join(';'));
await b.close(); process.exit(fails ? 1 : 0);
