// 22h: pull to refresh. Needs a server on 3033 (admin sam@bikepharma.com / Test@1234).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }), cx = await b.newContext({ ...devices['Pixel 7'] }), p = await cx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html'); await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1');
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.evaluate(() => reset(HOME[S.user.role])); await p.waitForTimeout(500);
const pull = async (dy, shot) => { await p.evaluate(async ([dy]) => { const sc = document.querySelector('#vp .scroll'), t = sc.querySelector('h1,.h1,.card') || sc, r = t.getBoundingClientRect(), x = r.left + 20, y = r.top + 10;
  const ev = (type, yy) => t.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: t, clientX: x, clientY: yy })], changedTouches: [new Touch({ identifier: 1, target: t, clientX: x, clientY: yy })] }));
  ev('touchstart', y); for (let i = 1; i <= 8; i++) { ev('touchmove', y + dy * i / 8); await new Promise(r => setTimeout(r, 15)); } window._ptrMid = document.getElementById('ptr') && document.getElementById('ptr').style.opacity; }, [dy]);
  if (shot && process.argv[2]) await p.screenshot({ path: process.argv[2] + '/ptr.png' });
  await p.evaluate(() => { const t = document.querySelector('#vp .scroll'); t.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [] })); }); };
let polls = 0; p.on('request', r => { if (/\/api\/(sync|state|poll|rev)/.test(r.url())) polls++; });
await pull(60); ok(await p.evaluate(() => window._ptrMid === '1'), 'the piston shows while pulling'); await p.waitForTimeout(500); ok(await p.evaluate(() => document.getElementById('ptr').style.opacity === '0'), 'a short pull lets go without refreshing');
const p0 = polls; await p.evaluate(() => { window._rf = 0; const r = refresh; window.refresh = function () { window._rf++; return r.apply(this, arguments); }; });
await pull(220, 1); await p.waitForTimeout(1300); ok(polls > p0, 'a full pull asks the server for new data (' + (polls - p0) + ' call)'); ok(await p.evaluate(() => window._rf >= 1 && document.getElementById('ptr').style.opacity === '0'), 'then the page is drawn again and the piston goes back');
ok(!errs.length, 'no page errors ' + errs.join(' | ')); await b.close(); process.exit(fails ? 1 : 0);
