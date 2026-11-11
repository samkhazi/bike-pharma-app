// 20b: the phone part page = the whole diagram on the full screen, the tapped number's part in a card at the bottom (swipe left / right:
// next / previous number, up: the parts list), list and full details as sheets; the computer page stays as it was.
// Needs test_bajajbuild.mjs's data (run it first), copied with a fresh admin, and a server on 3033 with CAT_SPLIT=off:
//   T=/tmp/claude-0/bp20b; rm -rf $T; mkdir -p $T/data; cp -r /tmp/claude-0/bptest-bajaj/data/cat $T/data/; cp -r /tmp/claude-0/bptest-bajaj/pf $T/pf
//   DATA_DIR=$T/data node admin.mjs add-admin sam@bikepharma.com Sam --password Test@1234
//   PORT=3033 DATA_DIR=$T/data FILES_DIR=$T/pf PHOTO_AI=off CAT_SPLIT=off node server.mjs &     then: node tools/test_m3phone.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function open(W, H, AR) {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto('http://127.0.0.1:3033/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(1200); await p.evaluate(() => { if (cur().s === 'roleok') reset(HOME[S.user.role]); }); await p.waitForTimeout(400);
  await p.evaluate(() => catNeed(CAT_ALL)); await p.waitForFunction(() => CAT_ALL.every(e => e.st === 2), null, { timeout: 30000 });
  // any part opens the page once so the diagram list loads; then the edition with the most lines, with a drawn picture and its number places
  await p.evaluate(() => { const r = catRows().find(r => r.ref); go('findpart', { v: 'part', i: r.i, vb: r.vb, pg: r.page, pk: r.pk || '', ref: r.ref || '', vm: 'Any', yr: 'Any' }); });
  await p.waitForFunction(() => catRows().some(r => r.ref && dgFig(r)), null, { timeout: 20000 }); await p.waitForTimeout(1500);   // the first page's own try for the (fake) picture file is over
  await p.evaluate(AR => { const n = r => m3Rows(r.vb, r.page, (dgFig(r) || {}).v).length, r = catRows().filter(r => r.ref && dgFig(r)).sort((a, b) => n(b) - n(a))[0]; S.stack.pop();
    const W = 661, H = Math.round(W / AR), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#333'; x.lineWidth = 3;
    for (let k = 0; k < 14; k++) { x.beginPath(); x.arc(80 + (k * 137) % 500, 80 + (k * 211) % (H - 160), 30 + k * 3, 0, 7); x.stroke(); }
    const P = { 1: [.2, .15], 2: [.7, .3], 7: [.35, .6], 9: [.8, .85] }, toks = []; x.font = 'bold 26px sans-serif'; x.fillStyle = '#000';
    Object.entries(P).forEach(([t, [fx, fy]]) => { x.fillText(t, fx * W, fy * H); toks.push([t, fx - .01, fy - 30 / H, fx + .04, fy + 6 / H]); });
    const u = dgFig(r).u; CAT_PFURL[u] = Promise.resolve(c.toDataURL('image/png')); HSC[u] = Promise.resolve({ toks });
    go('findpart', { v: 'part', i: r.i, vb: r.vb, pg: r.page, pk: r.pk || '', ref: r.ref || '', vm: 'Any', yr: 'Any' }); }, AR);
  await p.waitForFunction(() => document.querySelectorAll('#vp .m3 .hs').length >= 2, null, { timeout: 15000 }); await p.waitForTimeout(500);
  return p;
}
const st = p => p.evaluate(() => { const el = document.querySelector('#vp .m3'), R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, sc = el.closest('.scroll'), nav = document.querySelector('#vp nav.nav .bubble');
  const vis = e => !!e && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && R(e).h > 0, on = el.querySelector('.hs.on');
  return { p: el.classList.contains('m3p'), ph: el.dataset.ph, dg: R(el.querySelector('.dg')), dgw: R(el.querySelector('.m3-dgw')), bc: R(el.querySelector('.m3-bc')), bcVis: vis(el.querySelector('.m3-bc')), cardOpen: vis(el.querySelector('.m3-bcc')),
    name: (el.querySelector('.m3-bcn') || {}).textContent, onRef: on ? on.dataset.ref : '', zoom: !!el.querySelector('.hs-clip.z'), scroll: sc.scrollHeight - sc.clientHeight, navTop: nav ? R(nav).t : 9999,
    list: vis(el.querySelector('.m3-c2')) && R(el.querySelector('.m3-c2')).t < R(el).b - 50, det: vis(el.querySelector('.m3-c3')) && R(el.querySelector('.m3-c3')).t < R(el).b - 50, selRow: (el.querySelector('.m3-row.on b') || {}).textContent,
    moreIn: !!el.querySelector('.m3-c3 .m3-more'), detPn: (el.querySelector('.m3-det .fpc-pn') || {}).textContent }; });
const swipe = async (p, dx, dy) => { const c = await p.evaluate(() => { const r = document.querySelector('#vp .m3-bc').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 30]; });
  await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + dx, c[1] + dy, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(800); };
for (const [ar, name] of [[661 / 935, 'tall Yamaha diagram'], [4 / 3, 'wide diagram']]) {
  const p = await open(390, 760, ar); let s = await st(p); console.log(name, JSON.stringify(s));
  ok(s.p && s.scroll <= 1, name + ': the page is one screen, nothing to scroll');
  ok(Math.abs(s.dg.w / s.dg.h - ar) < 0.02 && s.dg.h > 150, name + ': whole picture, shape kept (' + Math.round(s.dg.w) + ' x ' + Math.round(s.dg.h) + ')');
  ok(s.dg.t >= s.dgw.t - 1 && s.dg.b <= s.dgw.b + 1 && s.dg.l >= s.dgw.l - 1 && s.dg.r <= s.dgw.r + 1, name + ': the picture is inside its box');
  ok(s.bcVis && s.cardOpen && s.bc.b <= s.navTop + 1, name + ': the opened part is in the card, clear of the bottom menu');
  ok(s.onRef && !s.zoom, name + ': its number is lit on the whole diagram (' + s.onRef + ')');
  // 20c: two fingers on the diagram zoom the diagram in its box, not the page
  { const cdp = await p.context().newCDPSession(p), c = [s.dg.l + s.dg.w / 2, s.dg.t + s.dg.h / 2], T = (type, g) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: g == null ? [] : [{ x: c[0] - g, y: c[1], id: 1 }, { x: c[0] + g, y: c[1], id: 2 }] });
    await T('touchStart', 20); for (const g of [30, 45, 60]) await T('touchMove', g); await T('touchEnd'); await p.waitForTimeout(600);
    const z = await p.evaluate(() => { const el = document.querySelector('#vp .m3 .dg'), w = el.parentElement.getBoundingClientRect(), g = document.querySelector('#vp .m3-dgw').getBoundingClientRect(); const e = el.getBoundingClientRect(); return { fill: e.left <= w.left + 1 && e.right >= w.right - 1 && e.top <= w.top + 1 && e.bottom >= w.bottom - 1, cw: w.width / g.width, s: hsPos(el).s, vv: visualViewport.scale, inBox: w.top >= g.top - 1 && w.bottom <= g.bottom + 1 && w.left >= g.left - 1 && w.right <= g.right + 1, z: el.parentElement.classList.contains('z'), bc: document.querySelector('#vp .m3-bc').getBoundingClientRect().top }; });
    ok(Math.abs(z.s - 3) < 0.05 && z.z && z.vv === 1 && z.inBox && Math.abs(z.bc - s.bc.t) < 1, name + ': two fingers zoom only the diagram (' + z.s + 'x), in its box, page and card stay');
    ok(z.fill && z.cw > 0.9, name + ': the close-up fills the whole box, not only the picture\'s own shape');
    await p.click('#vp .m3 .hs-all'); await p.waitForTimeout(700); ok((await st(p)).zoom === false, name + ': "Whole diagram" goes back'); }
  await p.evaluate(() => m3Ph('')); await p.waitForTimeout(500); const s0 = await st(p);
  ok(!s0.cardOpen && s0.dgw.h > s.dgw.h && s0.dg.h >= s.dg.h - 12, name + ': card closed = more room for the diagram (' + Math.round(s.dgw.h) + ' > ' + Math.round(s0.dgw.h) + ' px)');
  await p.click('#vp .m3 .hs[data-ref="1"]'); await p.waitForTimeout(600); s = await st(p);
  ok(s.cardOpen && /Cover Assembly/i.test(s.name || '') && s.onRef === '1' && !s.zoom, 'tap number 1: its part in the card, lit, diagram still whole: ' + s.name);
  await swipe(p, -120, 5); s = await st(p);
  ok(/Washer/i.test(s.name || '') && s.onRef === '2' && s.zoom, 'swipe left: next number (2 Washer), the diagram goes to it: ' + s.name);
  await swipe(p, 120, -5); s = await st(p);
  ok(/Cover Assembly/i.test(s.name || '') && s.onRef === '1', 'swipe right: back to number 1');
  await swipe(p, 4, -90); s = await st(p);
  ok(s.ph === 'l' && s.list, 'swipe up: the parts list opens');
  await p.click('#vp .m3 .m3-row >> nth=1'); await p.waitForTimeout(700); s = await st(p);
  ok(s.ph === 'c' && !s.list && /Washer/i.test(s.name || ''), 'a part tapped in the list: list closes, the card shows it');
  await p.click('#vp .m3-bcc .m3-bd'); await p.waitForTimeout(600); s = await st(p);
  ok(s.ph === 'd' && s.det && s.moreIn && /JG511021/.test(s.detPn || ''), 'Full details: the sheet with the number (' + s.detPn + ')');
  await p.click('#vp .m3-c3 .m3-sx'); await p.waitForTimeout(500); await p.click('#vp .m3-bcc .m3-sx'); await p.waitForTimeout(700); s = await st(p);
  ok(s.ph === '' && !s.cardOpen && !s.zoom, 'close: only the whole diagram again');
  ok(!p.errs.length, name + ': no page errors ' + p.errs.join(';')); await p.context().close();
}
{ const p = await open(1280, 900, 4 / 3), s = await st(p);
  ok(!s.p && !s.bcVis && !s.moreIn && s.det, 'computer: the page as before (three columns, no card)');
  ok(!p.errs.length, 'computer: no page errors ' + p.errs.join(';')); }
await b.close(); process.exit(fails ? 1 : 0);
