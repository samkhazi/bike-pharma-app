// 2026-10-20 update 10d, Sam: the bike number alone shows the RC details and opens the bike.
// Starts a mock RC service on 3029; the server under test runs with RC_API_KEY=test RC_API_URL=http://127.0.0.1:3029/rc
//   BASE4=http://127.0.0.1:3018 node tools/test_10d.mjs
import http from 'node:http';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// Surepass-like answers: one with the chassis hidden (model from the RC's maker + model), one with an odd model name
const RC = {
  KA17HC3942: { rc_number: 'KA17HC3942', owner_name: 'R KUMAR', maker_description: 'HERO MOTOCORP LTD', maker_model: 'SPLENDOR PLUS', manufacturing_date_formatted: '2018-06', fuel_type: 'PETROL', color: 'BLACK', vehicle_chasi_number: 'MBLHAR08XJ9XXXXX', vehicle_engine_number: 'HA10EXXXXXX', insurance_company: 'ICICI LOMBARD', insurance_upto: '2026-12-01', rc_status: 'ACTIVE' },
  MH12AB1234: { rc_number: 'MH12AB1234', owner_name: 'S PATIL', maker_description: 'ZZZ MOTORS', maker_model: 'QWERTY 9', manufacturing_date_formatted: '2015-01' },
};
const asked = [];
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
  const j = JSON.parse(b || '{}'); asked.push(q.headers.authorization + ':' + j.id_number); r.setHeader('Content-Type', 'application/json');
  const d = RC[j.id_number]; if (!d) { r.statusCode = 422; return r.end(JSON.stringify({ success: false })); }
  r.end(JSON.stringify({ data: d, status_code: 200, success: true })); }); });
await new Promise(f => mock.listen(3029, '127.0.0.1', f));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
  const txt = () => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
  const until = async (re, ms = 30000) => { const t0 = Date.now(); let t = ''; while (Date.now() - t0 < ms) { t = await txt(); if (re.test(t)) return t; await p.waitForTimeout(500); } return t; };
  const look = async q => { await p.evaluate(() => { S.ui.vin = { q: '' }; go('findpart', { v: 'vin' }); }); await p.fill('#vin-q', q); await p.press('#vin-q', 'Enter'); };
  // 1. the bike number with spaces: RC details, then the Splendor Plus opens by itself
  await look('ka 17 hc 3942');
  let t = await until(/BIKE FOUND FROM THE BIKE NUMBER/);
  ok(/BIKE FOUND FROM THE BIKE NUMBER KA17HC3942/.test(t) && /Splendor Plus/i.test(t), `${tag}: KA 17 HC 3942 opens the Hero Splendor Plus`);
  ok(/R KUMAR/.test(t) && /ICICI LOMBARD/.test(t) && /2018-06/.test(t), `${tag}: the RC details show on the bike's page`);
  ok(asked.includes('Bearer test:KA17HC3942'), `${tag}: the server asked the RC service with its own key`);
  // 2. a model the catalogue does not know: RC details stay, staff pick the bike
  await look('MH12AB1234');
  t = await until(/Which bike is this/);
  ok(/S PATIL/.test(t) && /Which bike is this/.test(t) && /ZZZ MOTORS QWERTY 9/.test(t), `${tag}: unknown RC model shows the RC and asks for the bike`);
  // 3. a number the RC service does not have
  await look('DL3CAB0001');
  t = await until(/no record of this number/);
  ok(/no record of this number/.test(t), `${tag}: unknown number says so`);
  // 4. a chassis number still goes the chassis way
  await look('MBLHAW26XRHK0129');
  t = await until(/17-letter chassis number/);
  ok(/You typed 16 letters/.test(t), `${tag}: a 16-letter chassis is still a chassis mistake, not a bike number`);
  ok(!errs.length, `${tag}: no page errors ${errs.join(' | ')}`);
}
await b.close(); mock.close();
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
