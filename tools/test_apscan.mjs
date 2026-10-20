// update 9y (Sam 2026-10-20): Add product > Scan reads a barcode / QR with the camera and fills the part number.
// The camera is Chromium's fake one fed a Y4M of a QR code with other text around the part number, like Hero's; ZXing reads it (headless Chromium has no BarcodeDetector).   BASE=... node tools/test_apscan.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const dir = fs.mkdtempSync('/tmp/apscan-');
// a barcode picture drawn by the app's own ZXing in a page, saved as PNG, then turned into a camera feed
const b0 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p0 = await b0.newPage(); await p0.goto(BASE + '/app.html', { waitUntil: 'load' });
const png = await p0.evaluate(async t => { await new Promise(r => { const s = document.createElement('script'); s.src = 'vendor/zxing.min.js'; s.onload = r; document.head.appendChild(s); });
  const Z = window.ZXing, m = new Z.QRCodeWriter().encode(t, Z.BarcodeFormat.QR_CODE, 300, 300, null);
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1280, 720); x.fillStyle = '#000';
  const W = m.getWidth(), k = Math.floor(560 / W); for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) if (m.get(i, j)) x.fillRect(360 + i * k, 80 + j * k, k, k);
  return c.toDataURL('image/png').split(',')[1]; }, 'D/FJBG0000218367/JCFMVZNMS4JY/16450ACK000S      /000001/0001200.00/AAE/1/G/000/00');   // Sam's Hero box QR (2026-10-20)
await b0.close();
fs.writeFileSync(dir + '/b.png', Buffer.from(png, 'base64'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', dir + '/b.png', '-t', '3', '-r', '10', '-pix_fmt', 'yuv420p', dir + '/b.y4m']);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + dir + '/b.y4m'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
await p.evaluate(() => { S.ui.ap = null; go('addproduct'); }); await p.waitForTimeout(300);
ok(await p.isVisible('#ap-scan'), 'Add product has a Scan button');
await p.click('#ap-scan');
await p.waitForFunction(() => !document.getElementById('aps-v') && S.ui.ap && S.ui.ap.pn, null, { timeout: 30000 }).catch(() => {});
const a = await p.evaluate(() => ({ pn: S.ui.ap.pn, live: !!(APS && APS.st) }));
ok(/^16450-?ACK-?000S?$/.test(a.pn) && !a.live, 'the camera read Sam’s Hero QR (catalogue not loaded yet): part no. ' + a.pn + ', camera off');
await p.waitForFunction(() => /FOUND IN HERO/i.test(document.querySelector('#vp .screen:last-child').innerText), null, { timeout: 90000 }).catch(() => {});
const t = await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
const pn2 = await p.evaluate(() => S.ui.ap.pn);
ok(/FOUND IN HERO CATALOGUE/i.test(t) && /Injector/i.test(t) && pn2 === '16450-ACK-000', 'the Hero part is found: ' + pn2 + ' ' + (t.match(/Injector[^\n]*/i) || [''])[0]);
await p.evaluate(async () => { catLoad('Hero'); for (let i = 0; i < 400 && CAT_ALL.some(e => e.vb === 'Hero' && e.st !== 2); i++) await new Promise(r => setTimeout(r, 500)); });
// typed in small letters with Hero's S ending (Sam 2026-10-20)
await p.evaluate(() => { S.ui.ap = null; go('addproduct'); }); await p.waitForTimeout(200); await p.type('#ap-pn', '11394aah00099s', { delay: 40 }); await p.waitForTimeout(3000);
const t2 = await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
ok(/FOUND IN HERO CATALOGUE/i.test(t2) && /Gasket R Crank Case Cover/i.test(t2), '11394aah00099s (small letters, S ending) finds the Hero gasket ' + (t2.match(/FOUND IN[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*/) || t2.slice(300, 500)));
// the same QR typed by a barcode gun into the box, and the sticker photo matcher (Sam 2026-10-20: 'FJBG0000218367 aa raha he')
const Q = 'D/FJBG0000218367/JCFMVZNMS4JY/16450ACK000S      /000001/0001200.00/AAE/1/G/000/00';
await p.evaluate(() => { S.ui.ap = null; go('addproduct'); }); await p.waitForTimeout(200); await p.fill('#ap-pn', Q); await p.waitForTimeout(3000);
const g = await p.evaluate(Q => ({ pn: S.ui.ap.pn, sc: scMatch([Q]).exact.map(h => h.pn) }), Q);
ok(g.pn === '16450-ACK-000' && g.sc.join() === '16450-ACK-000', 'Hero QR from a barcode gun and in the sticker scan gives 16450-ACK-000, not the serial FJBG… ' + JSON.stringify(g));
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
await b.close(); fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
