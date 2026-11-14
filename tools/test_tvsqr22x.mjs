// 22x: a TVS genuine box QR (a link with iRcode = "serial - 8 digits + part number - MRP") gives the part number and the box MRP.
//   node tools/test_tvsqr22x.mjs [QR.png]   (optional picture of the QR, for the Take photo path)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3033', [png] = process.argv.slice(2);
const URL1 = 'https://www.advantagetvs.com/Client/SP/frmValidtPart.aspx?iRcode=250936530569%20-%2000017934P7320170%20-%205877.00';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], ext = []; p.on('pageerror', e => errs.push(e.message));
p.on('request', r => { if (/advantagetvs/i.test(r.url())) ext.push(r.url()); });
await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForSelector('#bpOpen', { state: 'detached', timeout: 9000 }).catch(() => {});
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1');
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.waitForTimeout(600);
const open = async () => { await p.evaluate(() => { S.ui.ap = null; reset('addproduct'); }); await p.waitForSelector('#ap-scan'); };
let r = await p.evaluate(u => [tvsQR(u), tvsQR(u.replace(/%20/g, '+')), tvsQR(decodeURIComponent(u)), tvsQR('https://www.advantagetvs.com/x.aspx?iRcode=2509 - 00017934 - 10'), tvsQR('https://hondagenuineparts.in/?uid=250936530569'), tvsQR('250936530569 - 00017934P7320170 - 5877.00'), tvsQR('http://advantagetvs.com/a?x=1&iRcode=251036530569%20-%2000012345N9010050')], URL1);
console.log(JSON.stringify(r));
ok(r[0] && r[0].pn === 'P7320170' && r[0].mrp === 5877 && r[0].sn === '250936530569', 'Sam\'s QR: part P7320170, MRP 5877');
ok(r[1] && r[1].pn === 'P7320170' && r[2] && r[2].pn === 'P7320170', 'the same with + or plain spaces in the link');
ok(!r[3] && !r[4] && !r[5], 'no part number in the link, a Honda link, or the bare text: not taken as a TVS QR');
ok(r[6] && r[6].pn === 'N9010050' && r[6].mrp === 0, 'a link without the MRP piece: number only');
await open(); r = await p.evaluate(u => { const d = apScanUse([u]); return [d, S.ui.ap.pn, S.ui.ap.mrp, !!S.ui.ap.hit]; }, URL1); console.log(r);
ok(r[0] === true && r[1] === 'P7320170', 'scanner: the part number is filled: ' + r[1]);
ok(r[3] || r[2] === '5877', 'no list has it here: the box MRP 5877 is in the MRP box: ' + r[2]);
ok((await p.inputValue('#ap-pn')) === 'P7320170', 'Add product shows P7320170');
r = await p.evaluate(() => { S.ui.ap.pn = 'ZZ99887'; apLookNow(); return S.ui.ap.mrp; }); ok(r === '', 'another number typed after it: the box MRP is gone');
await open(); r = await p.evaluate(u => { const d = apScanUse([u, '8901234567890']); return [d, S.ui.ap.pn]; }, URL1); ok(r[1] === 'P7320170', 'a barcode in the same picture does not win over the QR\'s number');
if (png) { await open(); await p.click('#ap-scan'); await p.waitForSelector('#aps-file', { state: 'attached' }); await p.setInputFiles('#aps-file', png);
  await p.waitForFunction(() => !document.getElementById('aps-v') && S.ui.ap && S.ui.ap.pn, null, { timeout: 60000 }).catch(() => {});
  r = await p.evaluate(() => [S.ui.ap.pn, S.ui.ap.mrp]); ok(r[0] === 'P7320170', 'Take photo of the QR: ' + r); }
ok(!ext.length, 'nothing was opened on the TVS site ' + ext.join(' '));
ok(!errs.length, 'no page errors ' + errs.join(';'));
await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
