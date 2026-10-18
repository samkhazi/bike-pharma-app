// Update 9k (Sam 2026-10-18): Find Part > Check parts with chassis number. Maker from the first 3 letters, year from the 10th,
// the model asked once per chassis code and remembered; then a search bar for this bike's parts and the part details.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function mk(w, h) { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message)); return p; }
async function login(p, id, pw) {
  await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(400);
  await p.fill('#loginId', id); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', pw); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
}
const T = p => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
const SC = '#vp .screen:last-child';
const AL = 'ABCDEFGHJKLMNPRSTUVWXYZ'; const VDS = Array.from({ length: 5 }, () => AL[Math.floor(Math.random() * AL.length)]).join(''); const K = 'MBL' + VDS;
const A = await mk(390, 844); await login(A, 'sam@bikepharma.com', 'Test@1234');
await A.evaluate(() => { S.ui.fp = null; go('findpart'); }); await A.waitForTimeout(400);
let t = await T(A); ok(/Check parts with chassis number/.test(t) && /Shop by brand/i.test(t), 'Find Part home: chassis button and the old brand / model search both there');
await A.click(SC + ' button:has-text("Check parts with chassis number")'); await A.waitForTimeout(300);
ok(await A.evaluate(() => cur().p.v === 'vin') && /17-letter/.test(await T(A)), 'chassis screen opens');
await A.fill('#vin-q', 'MBLHAW123'); await A.press('#vin-q', 'Enter'); await A.waitForTimeout(200);
ok(/17 letters and numbers\. You typed 9/.test(await T(A)), 'short number: says 17 letters');
await A.fill('#vin-q', (K + '3S9F12345').toLowerCase()); await A.press('#vin-q', 'Enter'); await A.waitForTimeout(300);
t = await T(A); ok(/MBL = Hero/i.test(t) && /= 2025/.test(t) && new RegExp(VDS + ': new', 'i').test(t) && /Which Hero model/.test(t), 'new code: Hero, 2025, asks the model once');
await A.fill('#vin-mf', 'splendor'); await A.waitForTimeout(300);
ok(await A.evaluate(() => document.activeElement && document.activeElement.id === 'vin-mf'), 'model filter keeps the typing box');
await A.click(SC + ' button.chip:has-text("Splendor Plus")'); 
await A.waitForFunction(() => cur().p && cur().p.v === 'secs', null, { timeout: 60000 }).catch(() => {}); await A.waitForTimeout(800);
const p1 = await A.evaluate(() => cur().p);
ok(p1.v === 'secs' && p1.vb === 'Hero' && p1.vm === 'Splendor Plus' && p1.ed && p1.ed !== 'Any', 'bike opens with a 2025-or-older book: ' + p1.ed);
t = await T(A); ok(/BIKE FOUND FROM THE CHASSIS NUMBER/i.test(t) && /Search parts in this bike/.test(t) && /Change bike/i.test(t), 'banner + this-bike search bar');
ok(await A.evaluate(k => DB.vinMap && DB.vinMap[k] && DB.vinMap[k].vm === 'Splendor Plus', K), 'code remembered');
await A.fill('#fp-q', 'clutch plate'); await A.press('#fp-q', 'Enter'); await A.waitForTimeout(1200);
const r = await A.evaluate(() => ({ v: cur().p.v, f: { vb: S.ui.fp.vb, vm: S.ui.fp.vm }, t: document.querySelector('#vp .screen:last-child').innerText }));
ok(r.v === 'res' && r.f.vb === 'Hero' && r.f.vm === 'Splendor Plus' && /clutch/i.test(r.t), 'search finds clutch parts of this bike only');
await A.evaluate(() => { const b = [...document.querySelectorAll('#vp .screen:last-child button, #vp .screen:last-child [onclick]')].find(x => /m2Part|fpPart|go\('findpart',\{v:'part'/.test(x.getAttribute('onclick') || '')); if (b) b.click(); }); await A.waitForTimeout(800);
t = await T(A); ok(await A.evaluate(() => cur().p.v === 'part') && /MRP/i.test(t), 'a result opens the part details with MRP');
// the same code again opens straight away
await A.evaluate(() => { S.ui.vin = { q: '' }; go('findpart', { v: 'vin' }); }); await A.waitForTimeout(200);
await A.fill('#vin-q', K + '3S9X99999'); await A.press('#vin-q', 'Enter');
await A.waitForFunction(() => cur().p && cur().p.v === 'secs', null, { timeout: 30000 }).catch(() => {});
ok(await A.evaluate(() => cur().p.v === 'secs' && cur().p.vm === 'Splendor Plus'), 'next chassis with the same code opens the bike by itself');
await A.waitForTimeout(2500);
// Billing cannot change a saved code
const B = await mk(390, 844);
const bm = 'vinbill' + Date.now().toString().slice(-5) + '@test.in';
await A.evaluate(() => { S.ui.ns = null; go('newstaff'); S.ui.ns.role = 'Billing'; refresh(); }); await A.waitForTimeout(300);
await A.fill('#ns1', 'Vin Billing'); await A.fill('#ns2', bm); await A.fill('#ns3', 'vin12345'); await A.click(SC + ' .foot .btn'); await A.waitForTimeout(900); await A.waitForTimeout(2500);
await login(B, bm, 'vin12345');
await B.evaluate(k => { S.ui.vin = { q: k + '3S9F12345', c: k + '3S9F12345', pick: true, vb: 'Hero' }; go('findpart', { v: 'vin' }); }, K); await B.waitForTimeout(300);
t = await T(B); ok(/Only Manager or Admin can change it/.test(t), 'billing sees the saved model, cannot change it');
await B.evaluate(() => vinSet('Hero', 'Glamour')); await B.waitForTimeout(200);
ok(await B.evaluate(k => DB.vinMap[k].vm === 'Splendor Plus', K), 'billing change refused');
ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
