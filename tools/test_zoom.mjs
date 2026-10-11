// Sam 2026-10-11 18:19Z (phone video): "zoom nhi hona he sirf diagram/photos utna hi zoom hona he poora page zoom nhi hona he".
// On a phone: the page never zooms (pinch, or tapping a box); a full-screen diagram / photo zooms with two fingers and with a tap.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE3 || 'http://127.0.0.1:3017';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
const cdp = await c.newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
async function pinch(x, y, from, to) {   // two fingers round (x, y), from `from` px apart to `to` px apart
  await touch('touchStart', [[x - from / 2, y], [x + from / 2, y]]);
  for (let k = 1; k <= 8; k++) { const g = from + (to - from) * k / 8; await touch('touchMove', [[x - g / 2, y], [x + g / 2, y]]); }
  await touch('touchEnd', []); await p.waitForTimeout(150);
}
const scale = () => p.evaluate(() => visualViewport.scale);
const vp = () => p.evaluate(() => document.querySelector('meta[name=viewport]').content);

await p.goto(BASE + '/', { waitUntil: 'load' });
ok(/maximum-scale=1/.test(await vp()) && /user-scalable=no/.test(await vp()), 'landing page: the page cannot be zoomed (viewport)');
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && document.querySelector('#vp .screen'), null, { timeout: 15000 });
ok(/maximum-scale=1/.test(await vp()) && /user-scalable=no/.test(await vp()), 'app: the page cannot be zoomed (viewport)');
ok(await p.evaluate(() => getComputedStyle(document.documentElement).touchAction) === 'pan-x pan-y', 'app: one finger scrolls, no page pinch or double-tap zoom');
await pinch(195, 420, 80, 260);
ok(await scale() === 1, 'pinch on the page: the page stays as it is');
await p.locator('input').first().tap().catch(() => {}); await p.waitForTimeout(300);
ok(await scale() === 1, 'tapping a box: the page does not zoom');

// a full-screen diagram (as catZoom / dgZoom open it): 1200 x 900 picture
await p.evaluate(() => new Promise(res => {
  const sc = document.querySelector('#vp .screen'), d = document.createElement('div'); d.className = 'fpz';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#fff"/><circle cx="600" cy="450" r="300" fill="#ffc20e"/></svg>';
  d.innerHTML = '<button class="fpz-x">x</button><div class="fpz-in"><img alt="" src="data:image/svg+xml,' + encodeURIComponent(svg) + '"></div><div class="fpz-tip">Tap or pinch to zoom</div>';
  sc.appendChild(d); fpzWire(d); const im = d.querySelector('img'); if (im.complete) res(); else im.onload = res;
}));
const W = () => p.evaluate(() => document.querySelector('.fpz-in img').getBoundingClientRect().width);
const fit = await p.evaluate(() => document.querySelector('.fpz-in').clientWidth);
ok(Math.abs(await W() - fit) < 2, 'diagram opens fitted to the screen (' + Math.round(await W()) + ' px)');
await pinch(195, 380, 90, 270);
const w3 = await W();
ok(w3 > fit * 2.6 && w3 < fit * 3.4, 'two fingers apart: the diagram zooms in about 3x (' + Math.round(w3) + ' px)');
ok(await scale() === 1, 'while the diagram zooms, the page itself stays');
await pinch(195, 380, 270, 60);
ok(Math.abs(await W() - fit) < 2, 'two fingers together: back to the screen width, never smaller');
await p.waitForTimeout(600);
await p.locator('.fpz-in img').tap(); await p.waitForTimeout(200);
ok(await W() >= 1429, 'tap: zooms in (' + Math.round(await W()) + ' px)');
ok(await p.evaluate(() => { const b = document.querySelector('.fpz-in'); return b.scrollLeft > 0 && b.scrollTop >= 0; }), 'tap: the tapped spot stays in view');
await p.locator('.fpz-in img').tap({ position: { x: 20, y: 20 } }); await p.waitForTimeout(200);
ok(Math.abs(await W() - fit) < 2, 'tap again: back to fitted');
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fails ? fails + ' FAILED' : 'zoom: all passed');
process.exit(fails ? 1 : 0);
