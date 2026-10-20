// 2026-10-20 update 10c, Sam: aftermarket parts show in a name search too, and a Honda number read off the box with the letter O
// (31220KOLD01) finds 31220-K0L-D01.  BASE4=http://127.0.0.1:3018 node tools/test_10c.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
  const txt = () => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
  const until = async (re, ms = 40000) => { const t0 = Date.now(); let t = ''; while (Date.now() - t0 < ms) { t = await txt(); if (re.test(t)) return t; await p.waitForTimeout(700); } return t; };
  // 1. a name search lists the aftermarket parts (Varroc writes Pulsar as PLSR)
  await p.evaluate(() => amGo('coil plate pulsar'));
  let t = await until(/Aftermarket parts/);
  ok(/Aftermarket parts/.test(t) && /Varroc · MGCP-PLSR-/.test(t), `${tag}: "coil plate pulsar" shows Varroc MGCP-PLSR coil plates`);
  // 2. the number with the letter O for zero finds the Honda stator
  await p.evaluate(() => amGo('31220KOLD01'));
  t = await until(/31220-K0L-D01/);
  ok(/31220-K0L-D01/.test(t) && /letter O read as zero/.test(t), `${tag}: 31220KOLD01 finds 31220-K0L-D01 and says how it was read`);
  // 3. the right number still works as before, with no misread note
  await p.evaluate(() => amGo('31220-K0L-D01'));
  t = await until(/31220-K0L-D01/);
  ok(/31220-K0L-D01/.test(t) && !/letter O read as zero/.test(t), `${tag}: 31220-K0L-D01 found, no misread note`);
  ok(!errs.length, `${tag}: no page errors ${errs.join(' | ')}`);
}
await b.close();
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
