// 20a: on a phone the part page's diagram stays on top but never hides the parts list, even a tall (portrait) Yamaha diagram.
// Needs a server on port 3033 (any data) with admin sam@bikepharma.com / Test@1234.   node tools/test_m3phone.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 700 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900); await p.evaluate(() => { if (cur().s === 'roleok') reset(HOME[S.user.role]); }); await p.waitForTimeout(500);
await p.evaluate(() => go('findpart', {})); await p.waitForTimeout(600);
for (const [ar, name] of [[661 / 935, 'tall Yamaha diagram'], [4 / 3, 'wide diagram']]) {
  const m = await p.evaluate(async ar => {
    const sc = document.querySelector('#vp .screen:last-child .scroll') || document.querySelector('#vp .screen:last-child');
    sc.innerHTML = `<div class="m3 m3a m3b"><div class="m3-g"><div class="m3-c0"></div><div class="m3-c1"><div class="m3-dh"><div class="m3-dt"><b>Steering Handle &amp; Cable – Fig 24</b><span class="cap">Diagram 26 of 35 · 54 parts</span></div></div>
      <div class="m3-dgw dg-wrap"><div class="hs-clip"><div class="fpc-fig m3-fig dg on" style="aspect-ratio:${ar.toFixed(4)};--ar:${ar.toFixed(4)}"></div></div></div></div>
      <div class="m3-c3"></div><div class="m3-c2"><div class="m3-lh"><b>Parts in this diagram</b></div><div class="m3-list">${Array.from({ length: 54 }, (_, i) => `<div class="m3-row" id="r${i}" style="height:52px">row ${i + 1}</div>`).join('')}</div></div></div><div class="m3-more"><h3>Commonly needed with this</h3></div></div>`;
    await new Promise(r => setTimeout(r, 300));
    const box = sc.getBoundingClientRect(), c1 = sc.querySelector('.m3-c1'), dg = sc.querySelector('.dg'), R = e => e.getBoundingClientRect();
    const seen = () => [...sc.querySelectorAll('.m3-row')].filter(r => { const a = R(r); return a.top >= R(c1).bottom - 1 && a.bottom <= box.bottom + 1; }).length;
    const o = { boxH: box.height, c1H: R(c1).height, dgW: R(dg).width, dgH: R(dg).height, sticky: getComputedStyle(c1).position, seen0: seen() };
    sc.scrollTop = 900; await new Promise(r => setTimeout(r, 200)); o.c1Top = R(c1).top - box.top; o.seen900 = seen(); return o; }, ar);
  console.log(name, JSON.stringify(m));
  ok(m.sticky === 'sticky' && Math.abs(m.c1Top) < 2, name + ': stays on top while the list scrolls');
  ok(Math.abs(m.dgW / m.dgH - ar) < 0.02, name + ': keeps its shape');
  ok(m.c1H <= m.boxH * 0.72, name + ': leaves room under it (' + Math.round(m.c1H) + ' of ' + Math.round(m.boxH) + ' px)');
  ok(m.seen900 >= 2, name + ': part rows can be seen under it (' + m.seen900 + ')');
}
ok(!errs.length, 'no page errors ' + errs.join(';'));
await b.close(); process.exit(fails ? 1 : 0);
