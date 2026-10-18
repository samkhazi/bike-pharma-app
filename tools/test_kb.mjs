// Update 9j (Sam 2026-10-18 "mobile me keyboard me kuch glitches"): on a phone, typing in a search box keeps the same box,
// so the keyboard stays open while the list under it updates.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html'); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot');
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
for (const [scr, id] of [['racks', 'rq'], ['masterprice', 'mpq']]) {
  await p.evaluate(s => go(s), scr); await p.waitForTimeout(400);
  await p.tap('#' + id); await p.evaluate(id => { document.getElementById(id)._mark = 1; }, id);
  await p.keyboard.type('ho', { delay: 400 }); await p.waitForTimeout(500); await p.keyboard.type('rn', { delay: 400 }); await p.waitForTimeout(500);
  const r = await p.evaluate(id => { const e = document.getElementById(id); return { same: e._mark === 1 && document.activeElement === e, v: e.value, list: document.querySelector('#vp .screen').innerText.includes('Horn') }; }, id);
  ok(r.same && r.v === 'horn', scr + ': typing stays in the same box ' + JSON.stringify(r));
  ok(r.list, scr + ': results updated while typing');
}
// a screen change still renders fresh
await p.evaluate(() => { document.activeElement.blur(); go('labels'); }); await p.waitForTimeout(300);
ok(/Print labels/.test(await p.evaluate(() => document.querySelector('#vp .screen').innerText)), 'other screens still open');
ok(!errs.length, 'no page errors ' + errs.join(' | '));
await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
