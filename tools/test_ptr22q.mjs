// 22q: piston pull to refresh in every profile, phone (touch) and computer (wheel); the gear never stays out. Needs a server on 3033.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }; const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const login = async p => { await p.goto('http://127.0.0.1:3033/app.html'); await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1'); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); };
const hidden = p => p.evaluate(() => !document.querySelector('.bp-ptrk,.bp-ptr,.bp-dent') && !document.querySelector('#vp .scroll[style*="translate"]') && !document.querySelector('.bp-pull'));
const ROLES = [['admin', 'ahome'], ['manager', 'mghome'], ['billing', 'bhome'], ['sales', 'snew'], ['inventory', 'ihome'], ['accountant', 'achome'], ['mechanic', 'mhome'], ['customer', 'home']];
{ const cx = await b.newContext({ ...devices['Pixel 7'] }), p = await cx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await login(p);
  for (const [r, sc] of ROLES) { await p.evaluate(([r, sc]) => { S.user = { ...S.user, role: r }; reset(sc); window._rf = 0; const o = window.refresh; if (!o._w) { window.refresh = function () { window._rf++; return o.apply(this, arguments); }; window.refresh._w = 1; } }, [r, sc]); await p.waitForTimeout(350);
    const mid = await p.evaluate(async () => { const s = document.querySelector('#vp .scroll'), t = s.firstElementChild || s, R = s.getBoundingClientRect(), x = R.left + 30, y = R.top + 12;
      const ev = (type, yy) => t.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: t, clientX: x, clientY: yy })], changedTouches: [new Touch({ identifier: 1, target: t, clientX: x, clientY: yy })] }));
      ev('touchstart', y); for (let i = 1; i <= 8; i++) { ev('touchmove', y + 200 * i / 8); await new Promise(r => setTimeout(r, 12)); } const e = document.querySelector('.bp-ptrk .pi'), o = !!e && e.getBoundingClientRect().bottom > s.getBoundingClientRect().top + 20 && /translateY\(1\d\dpx\)/.test(s.style.transform); window._mid = 1; ev('touchend', y + 200); return o; });
    if (OUT && r === 'customer') { await p.waitForTimeout(700); await p.screenshot({ path: OUT + '/ptr-phone.png' }); } await p.waitForTimeout(3600);
    ok(mid && await hidden(p), 'phone ' + r + ': gear comes down on pull, is fully gone after the refresh'); }
  // a short pull that is let go must also leave nothing
  await p.evaluate(async () => { const s = document.querySelector('#vp .scroll'), t = s.firstElementChild || s, R = s.getBoundingClientRect(), x = R.left + 30, y = R.top + 12; const ev = (type, yy) => t.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: t, clientX: x, clientY: yy })], changedTouches: [new Touch({ identifier: 1, target: t, clientX: x, clientY: yy })] })); ev('touchstart', y); ev('touchmove', y + 50); t.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true, touches: [], changedTouches: [] })); }); await p.waitForTimeout(600);
  ok(await hidden(p), 'phone: a short pull or a cancelled touch leaves no gear'); ok(!errs.length, 'phone: no page errors ' + errs.join(' | ')); await cx.close(); }
{ const p = await b.newPage({ viewport: { width: 1366, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); await login(p);
  for (const [r, sc] of ROLES) { await p.evaluate(([r, sc]) => { S.user = { ...S.user, role: r }; reset(sc); }, [r, sc]); await p.waitForTimeout(500); await p.mouse.move(800, 400);
    for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(25); }
    await p.waitForTimeout(1300); const mid = await p.evaluate(() => { const e = document.querySelector('.bp-ptrk .pi'); return !!e && e.getBoundingClientRect().left > 500; }); if (OUT && r === 'admin') await p.screenshot({ path: OUT + '/ptr-desk.png' });
    await p.waitForTimeout(3200); ok(mid && await hidden(p), 'computer ' + r + ': scrolling up at the top brings the gear over the page, gone after the refresh'); }
  await p.evaluate(() => reset('more')); await p.waitForTimeout(300); await p.mouse.wheel(0, 300); await p.waitForTimeout(200); await p.mouse.wheel(0, -100); await p.waitForTimeout(500); ok(await hidden(p), 'computer: scrolling back up inside a long page does not start it');
  ok(!errs.length, 'computer: no page errors ' + errs.join(' | ')); }
await b.close(); console.log(fails ? fails + ' FAILED' : 'all pass'); process.exit(fails ? 1 : 0);
