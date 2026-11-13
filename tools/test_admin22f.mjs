// 22f: Risk watch, Notice to staff, Rate card, Other brand not added (Excel). Needs a server on 3033 (admin sam@bikepharma.com / Test@1234).
//   node tools/test_admin22f.mjs [dir for the exported xlsx + screenshots]
import fs from 'node:fs'; import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }; const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }), p = await b.newPage({ viewport: { width: 420, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html'); await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1');
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.evaluate(() => reset(HOME[S.user.role]));
const as = r => p.evaluate(r => { S.user = { ...S.user, role: r }; }, r);
await p.evaluate(() => { let x = PX('TP22B'); if (!x) { x = { id: 'TP22B', name: 'Test brake shoe', pn: 'TP-22B-001', brand: 'Hero', mrp: 100, price: 95, mp: 80, stock: 5, gst: 18, cat: 'Brakes', fits: ['Hero Splendor Plus · BS6'] }; DB.newProducts = DB.newProducts || []; DB.newProducts.push(x); PRODUCTS.push(x); } x.fits = ['Hero Splendor Plus · BS6']; DB.stock.TP22B = 5; x.pending = false; x.mp = 80; });
// risk watch
await p.evaluate(() => { DB.closings = [{ d: today(), iso: isoToday(), t: '8 pm', exp: 1000, counted: 580, diff: -420, by: 'Umesh' }, ...(DB.closings || []).filter(c => c.by !== 'Umesh')]; reset('arisk'); });
ok(/Cash short at day closing/i.test(await p.innerText('#vp')) && /₹420 short · Umesh/i.test(await p.innerText('#vp')), 'Risk watch: cash short row'); if (OUT) await p.screenshot({ path: OUT + '/risk.png' });
// notice
await p.evaluate(() => { reset('anotice'); }); await p.fill('#nt-msg', 'Shop opens 8:30 am on Sunday'); await p.evaluate(() => noticeSend());
const nid = await p.evaluate(() => DB.notices[0].id); ok(await p.evaluate(() => DB.notices[0].to === 'all' && DB.notices[0].msg.startsWith('Shop opens')), 'Notice saved');
await as('billing'); await p.evaluate(() => reset('bhome')); ok(/Shop opens 8:30 am on Sunday/.test(await p.innerText('#vp')), 'Billing home shows the notice'); if (OUT) await p.screenshot({ path: OUT + '/notice.png' });
await p.evaluate(id => noticeOk(id), nid); ok(!/Shop opens 8:30 am on Sunday/.test(await p.innerText('#vp')), 'gone after Okay');
await as('sales'); await p.evaluate(() => { S.ui.inv = null; reset('snew'); }); ok(/Shop opens 8:30 am on Sunday/.test(await p.innerText('#vp')) === false, 'same login already read it (one staff id in the test)');
await as('admin'); await p.evaluate(() => reset('anotice')); ok(/read by 1 of/i.test(await p.innerText('#vp')), 'Admin sees who read it'); await p.evaluate(id => noticeOff(id), nid);
// rate card
await p.evaluate(() => { S.ui.rc = null; reset('aratecard'); }); ok(/Test brake shoe/.test(await p.innerText('#vp')) && /₹80/.test(await p.innerText('#vp')), 'Rate card lists the mechanic price of parts in stock'); if (OUT) await p.screenshot({ path: OUT + '/ratecard.png' });
// other brand not added
await p.evaluate(() => { S.ui.xm = null; S.ui.xmMsg = ''; reset('axmiss'); }); await p.waitForTimeout(800); await p.evaluate(() => refresh());
ok(/TP-22B-001/.test(await p.innerText('#vp')), 'Other brand not added lists the part'); if (OUT) await p.screenshot({ path: OUT + '/xmiss.png' });
const b64 = await p.evaluate(async () => { const blob = xlsxMake(XM_HEAD, xmList().map(r => [r.b, r.m, r.pn, r.n, r.c, r.mrp, '', '']), [14, 22, 18, 34, 16, 10, 16, 22], [5]); const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; u.forEach(c => { s += String.fromCharCode(c); }); return btoa(s); });
if (OUT) fs.writeFileSync(OUT + '/other-brand.xlsx', Buffer.from(b64, 'base64'));
const rt = await p.evaluate(async () => { const rows = [['HERO', 'Hero Splendor Plus', '0012345', 'A & B <shoe>', 'Brakes', 99.5, '', '']]; const back = await xlsxRead(new File([xlsxMake(XM_HEAD, rows, [], [5])], 'x.xlsx')); return back; });
ok(rt.length === 2 && rt[0].join() === 'Brand,Model,Part no.,Part name,Category,MRP,Other brand,Other brand part no.' && rt[1][2] === '0012345' && rt[1][3] === 'A & B <shoe>' && rt[1][5] === '99.5', 'Excel round trip keeps part no. as text (0012345) and MRP as number');
const nSame = await p.evaluate(() => sameOf('TP-22B-001').length);
await p.evaluate(async () => { const rows = xmList().filter(r => r.pn === 'TP-22B-001').map(r => [r.b, r.m, r.pn, r.n, r.c, r.mrp, 'Honda', '06430-TEST-001']); await xmUpload(new File([xlsxMake(XM_HEAD, rows, [], [5])], 'filled.xlsx')); }); await p.waitForTimeout(1500);
ok(/1 match added/.test(await p.evaluate(() => S.ui.xmMsg || '')), 'filled Excel adds the match (' + await p.evaluate(() => S.ui.xmMsg) + ')');
ok(await p.evaluate(() => sameOf('TP-22B-001').some(e => /06430TEST001/.test(catPk(e.pn)))) && !(await p.evaluate(() => xmList().some(r => r.pn === 'TP-22B-001'))), 'the part now has its other-brand match and leaves the list');
await p.evaluate(async () => { await api('POST', '/api/same', { a: { pn: 'TP-22B-001' }, b: { pn: '06430-TEST-001' }, del: 1 }); });
await as('manager'); ok(await p.evaluate(() => roleAllows('manager', 'axmiss') && !roleAllows('manager', 'arisk') && !roleAllows('billing', 'axmiss')), 'Manager has Other brand not added only; Billing none');
await p.waitForTimeout(800); ok(!errs.length, 'no page errors ' + errs.join(' | ')); await b.close(); process.exit(fails ? 1 : 0);
