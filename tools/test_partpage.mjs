// 2026-10-12 update 8m (the owner's plan): Find Part's part page like mittalautospares.in: the diagram | only that diagram's parts, by ref |
// the chosen part. The searched part is chosen and marked when the page opens; another line is chosen in place (no new page); a phone shows
// the details under the chosen line. Computer 1280 x 900 and phone 390 x 844.
// BASE=http://127.0.0.1:3015 node tools/test_partpage.mjs   (run_tests.sh's server, admin sam@bikepharma.com / Test@1234)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015', OUT = process.env.OUT || '/tmp/claude-0/nr';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const A = '06455AACJ10', B = '45125AAHF0099';   // Hero: BRAKE PAD KIT (a 6-line caliper diagram), SHOE COMP BRAKE (front brake panel, ~20 lines)
for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user && cur().s !== 'pw', null, { timeout: 15000 }); await p.waitForTimeout(400);
  await p.evaluate(() => tab(HOME[S.user.role])); await p.waitForTimeout(300);
  const until = async (fn, arg, n = 160) => { for (let k = 0; k < n; k++) { const v = await p.evaluate(fn, arg); if (v) return v; await p.waitForTimeout(250); } return null; };
  // open the part page the way test_inv8 does, and wait for the diagram's list (cat/hero-dg.json) to be in
  const open = async pk => { await p.evaluate(() => catNeed([CAT_ALL.find(e => e.vb === 'Hero')])); await p.waitForFunction(() => CAT_ALL.find(e => e.vb === 'Hero').st === 2, null, { timeout: 90000 });
    const i = await p.evaluate(pk => { const rows = catRows(); const i = rows.findIndex(r => r.pk === pk && r.vb === 'Hero' && !r.xl); if (i < 0) return -1; const r = rows[i]; go('findpart', { v: 'part', i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any' }); return i; }, pk);
    await until(() => !!document.querySelector('#vp .m3[data-m] .dg[data-hk]')); await p.waitForTimeout(300); return i; };
  // the page as the test sees it: its key, rows, the chosen line, where the details are
  const st = () => p.evaluate(() => { const el = document.querySelector('#vp .m3'); if (!el) return null; const o = M3[el.dataset.k], d = el.querySelector('.m3-det'), on = el.querySelectorAll('.m3-row.on');
    const box = s => { const e = el.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }; };
    return { k: el.dataset.k, n: o.rows.length, rows: el.querySelectorAll('.m3-row').length, pages: [...new Set(o.rows.map(q => q.page))], ed: !!o.v && o.rows.every(q => (q.vv || []).includes(o.v)), sel: o.sel, on: on.length === 1 ? +on[0].dataset.i : -1, si: cur().p.si,
      pn: (d.querySelector('.fpc-pn') || {}).textContent || '', inList: d.parentNode.classList.contains('m3-list'), afterOn: on.length === 1 && on[0].nextElementSibling === d,
      s: cur().s, len: S.stack.length, c0: box('.m3-c0'), c1: box('.m3-c1'), c2: box('.m3-c2'), c3: box('.m3-c3'), det: box('.m3-det'), hk: !!el.querySelector('.dg[data-hk="' + el.dataset.k + '"]') }; });
  // nothing wider than the window: the page, the screen's boxes, and every element of the part page
  const wide = () => p.evaluate(() => { const vw = innerWidth, s = document.querySelector('#vp .screen:last-child'), o = []; if (document.documentElement.scrollWidth > vw + 1) o.push('page ' + document.documentElement.scrollWidth);
    s.querySelectorAll('.scroll,.pad,.card,.m3,.m3-g,.m3-list').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) o.push(String(e.className).slice(0, 24) + ' ' + e.scrollWidth + '>' + e.clientWidth); });
    s.querySelectorAll('.m3 *').forEach(e => { if (e.closest('.m3-dgs')) return; const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) o.push(e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 20) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }); return o.slice(0, 5); });
  const shot = async (name, tall) => { const vs = p.viewportSize();
    if (tall) { const h = await p.evaluate(() => { const s = document.querySelector('#vp .screen:last-child .scroll'); return s ? s.scrollHeight + 160 : 0; }); if (h > vs.height) { await p.setViewportSize({ width: vs.width, height: Math.min(h, 5000) }); await p.waitForTimeout(400); } }
    await p.screenshot({ path: `${OUT}/partpage-${name}.png` }); if (tall) { await p.setViewportSize(vs); await p.waitForTimeout(300); } };

  // ---- the brake pad kit: a 6-line diagram ----
  const iA = await open(A); let s = await st();
  const pnA = await p.evaluate(i => catRows()[i].part, iA);
  ok(s && s.hk && s.n >= 3 && s.n <= 12 && s.rows === s.n && s.pages.length === 1 && s.ed, `${tag} ${A}: the list has only that diagram's lines (${s && s.n} lines, page ${s && s.pages.join(',')}, one edition ${s && s.ed}), the diagram has data-hk`);
  ok(s.on === iA && s.sel === iA && s.pn === pnA, `${tag} ${A}: the searched part is chosen and marked (row ${s.on}, details ${s.pn})`);
  const t = await p.evaluate(() => document.querySelector('#vp .m3').innerText), tip = await p.evaluate(() => document.querySelector('#vp .m3 .m3-tip').textContent);
  ok(!/Parts in this assembly/.test(t) && /Parts in this diagram/.test(t) && /Tap a number on the diagram or a part in the list/.test(tip), `${tag}: no old "Parts in this assembly" list, the new list and the hint under the diagram are there`);
  ok(/Not in your stock list yet/.test(t) && /Add to stock/.test(t), `${tag}: the chosen part not in stock has "Add to stock" (admin)`);
  if (tag === 'computer') {
    // layout A (update 10z): the bike's diagrams | the diagram with the chosen part under it | the diagram's parts
    ok(s.c0.r <= s.c1.l && s.c1.r <= s.c2.l && Math.abs(s.c0.t - s.c1.t) < 40 && Math.abs(s.c1.t - s.c2.t) < 40 && s.c1.w > s.c2.w && s.c3.w > 200 && s.c3.t > s.c1.t + 60 && s.c3.l >= s.c1.l && s.c3.r <= s.c1.r && !s.inList,
      `computer: diagrams | diagram with the chosen part under it | parts list ${JSON.stringify([s.c0, s.c1, s.c3, s.c2])}`);
  } else {
    ok(!s.c3.w && s.inList && s.afterOn, `phone: the details sit right under the chosen line (in the list ${s.inList}, after it ${s.afterOn})`);
    ok(s.c1.b <= s.c2.t + 1, `phone: the diagram on top, the list under it ${JSON.stringify([s.c1, s.c2])}`);
  }
  let w = await wide(); ok(!w.length, `${tag}: the part page fits ${W} px ` + w.join(' | '));
  await shot(tag);
  if (tag === 'phone') await shot(tag + '-tall', 1);
  // another line, in place
  const other = await p.evaluate(() => { const el = document.querySelector('#vp .m3'), o = M3[el.dataset.k]; const q = o.rows.find(q => q.i !== o.sel && q.part); return { i: q.i, pn: q.part }; });
  const stack0 = await p.evaluate(() => ({ s: cur().s, len: S.stack.length, dg: document.querySelector('#vp .m3 .dg') }));
  await p.click(`#vp .m3-row[data-i="${other.i}"]`); await p.waitForTimeout(700);
  s = await st();
  const same = await p.evaluate(() => { const d = document.querySelector('#vp .m3 .dg'); return !!d && d.isConnected && d.dataset.io === '1'; });
  ok(s.pn === other.pn && s.on === other.i && s.si === other.i && s.s === 'findpart' && s.len === stack0.len && same,
    `${tag}: a click on another line shows it in place (${s.pn}; screen ${s.s}, stack ${stack0.len} -> ${s.len}, the same diagram element ${same})`);
  if (tag === 'phone') {
    ok(s.inList && s.afterOn, 'phone: the details moved under the tapped line');
    const vis = await p.evaluate(i => { const r = document.querySelector(`#vp .m3-row[data-i="${i}"]`).getBoundingClientRect(), sc = document.querySelector('#vp .screen:last-child .scroll').getBoundingClientRect(); return r.top >= sc.top - 1 && r.bottom <= sc.bottom + 1; }, other.i);
    ok(vis, 'phone: the tapped line stays in view');
  }
  await shot(tag + '-picked');
  // refresh() and Back keep the choice
  await p.evaluate(() => refresh()); await p.waitForTimeout(400); s = await st();
  ok(s.on === other.i && s.pn === other.pn && (tag === 'computer' ? !s.inList : s.afterOn), `${tag}: refresh() keeps the chosen line (${s.pn})`);
  if (tag === 'computer') {   // another catalogue comes in (Bajaj is before Hero): every row is numbered again, the choice stays the same part
    await p.evaluate(() => catNeed([CAT_ALL.find(e => e.vb === 'Bajaj')])); await p.waitForFunction(() => CAT_ALL.find(e => e.vb === 'Bajaj').st === 2, null, { timeout: 90000 }); await p.waitForTimeout(800);
    s = await st(); const ix = await p.evaluate(pn => { const o = M3[document.querySelector('#vp .m3').dataset.k], q = o.rows.find(q => q.part === pn); return q ? q.i : -1; }, other.pn);
    ok(s.on === ix && s.pn === other.pn && s.si === ix && ix !== other.i, `computer: Bajaj's catalogue came (rows numbered again, ${other.i} -> ${ix}): the chosen line is still ${s.pn}`);
    other.i = ix;
  }
  await p.evaluate(() => go('findpart', { v: 'home' })); await p.waitForTimeout(500); await p.evaluate(() => back()); await p.waitForTimeout(900);
  s = await st(); ok(s && s.on === other.i && s.pn === other.pn, `${tag}: Back keeps the chosen line (${s && s.pn})`);

  // ---- the brake shoe: a bigger diagram; a number on the diagram picks a line far down the list ----
  const iB = await open(B); s = await st(); const lenB = s.len;
  ok(s.n >= 10 && s.n <= 40 && s.pages.length === 1 && s.ed && s.on === iB, `${tag} ${B}: ${s.n} lines of one diagram, the searched part marked`);
  const refs = await p.evaluate(() => [...document.querySelectorAll('#vp .m3-row')].map(b => b.dataset.ref));
  const cmp = new Intl.Collator('en', { numeric: true }).compare, cut = refs.includes('') ? refs.indexOf('') : refs.length;
  ok(refs.slice(0, cut).every((r, k, a) => !k || cmp(a[k - 1], r) <= 0) && refs.slice(cut).every(r => !r), `${tag} ${B}: lines by ref (1, 2, 2A, 10, ..., no ref last): ${refs.join(' ')}`);
  if (tag === 'phone') {   // the details open above: a tap on a line further down keeps that line where the finger is, the details go under it
    const mid = await p.evaluate(() => { const o = M3[document.querySelector('#vp .m3').dataset.k], q = o.rows[Math.floor(o.rows.length / 2)], b = document.querySelector(`#vp .m3-row[data-i="${q.i}"]`);
      b.scrollIntoView({ block: 'center' }); return { i: q.i, pn: q.part, y: Math.round(b.getBoundingClientRect().top) }; });
    await p.waitForTimeout(200); await p.click(`#vp .m3-row[data-i="${mid.i}"]`); await p.waitForTimeout(900); s = await st();
    const y = await p.evaluate(i => { const r = document.querySelector(`#vp .m3-row[data-i="${i}"]`).getBoundingClientRect(), sc = document.querySelector('#vp .screen:last-child .scroll').getBoundingClientRect(); return r.top >= sc.top - 1 && r.bottom <= sc.bottom ? Math.round(r.top) : -1; }, mid.i);
    ok(s.on === mid.i && s.afterOn && s.pn === (mid.pn || '') && y >= 0, `phone: a tap on a line below the open details: that line stays in view, the page brings it up (${mid.y} -> ${y}), its details under it`);
  }
  const last = await p.evaluate(() => { const o = M3[document.querySelector('#vp .m3').dataset.k]; const q = o.rows[o.rows.length - 1]; return { i: q.i, pn: q.part }; });
  let hs = 0; await p.evaluate(() => { window.hsSel = k => { window.__hs = k; }; });
  await p.evaluate(i => m3Pick(i, 'dg'), last.i); await p.waitForTimeout(900);
  s = await st(); hs = await p.evaluate(() => window.__hs);
  const inView = await p.evaluate(i => { const r = document.querySelector(`#vp .m3-row[data-i="${i}"]`).getBoundingClientRect(), l = document.querySelector('#vp .m3-list').getBoundingClientRect(), sc = document.querySelector('#vp .screen:last-child .scroll').getBoundingClientRect();
    return r.top >= Math.max(l.top, sc.top) - 1 && r.bottom <= Math.min(l.bottom, sc.bottom) + 1; }, last.i);
  ok(s.on === last.i && s.pn === (last.pn || '') && inView && hs === s.k && s.len === lenB, `${tag}: a diagram number (m3Pick 'dg') picks the last line, it scrolls into view, hsSel(${hs}) is told ${JSON.stringify({ on: s.on, i: last.i, inView, len: s.len, lenB })}`);
  if (tag === 'phone') ok(s.afterOn, 'phone: the diagram number opens the details under its line');
  w = await wide(); ok(!w.length, `${tag}: the bigger diagram's page fits ${W} px ` + w.join(' | '));
  await shot(tag + '-big');
  // layout A: the bike's diagrams listed (this one marked); Next opens the next diagram of the same bike and edition in place; a section opens the same page
  const dg = await p.evaluate(async () => { const el = document.querySelector('#vp .m3'), o = M3[el.dataset.k], L = [...el.querySelectorAll('.m3-dg')], on = L.filter(b => b.classList.contains('on')), j = L.indexOf(on[0]), len = S.stack.length;
    const nb = [...el.querySelectorAll('.m3-nb')].find(b => /Next/.test(b.getAttribute('aria-label'))); if (!nb) return { n: L.length, on: on.length, nb: 0 };
    nb.click(); await new Promise(r => setTimeout(r, 300)); const e2 = document.querySelector('#vp .m3'), o2 = M3[e2.dataset.k], L2 = [...e2.querySelectorAll('.m3-dg')];
    return { n: L.length, on: on.length, len, len2: S.stack.length, vb: o2.vb === o.vb, v: o2.v === o.v, pg: o2.page !== o.page, one: o2.rows.every(q => q.page === o2.page), j, j2: L2.findIndex(b => b.classList.contains('on')) }; });
  ok(dg.n > 1 && dg.on === 1 && dg.len2 === dg.len && dg.vb && dg.v && dg.pg && dg.one && dg.j2 === dg.j + 1, `${tag}: the bike's diagrams listed, this one marked; Next opens the next one of the same bike and edition in place ${JSON.stringify(dg)}`);
  const sv = await p.evaluate(() => { const el = document.querySelector('#vp .m3'), o = M3[el.dataset.k]; go('findpart', { v: 'sec', vb: o.vb, vm: o.vm || 'Any', yr: 'Any', pg: o.page }); const e2 = document.querySelector('#vp .m3'); return !!e2 && M3[e2.dataset.k].page === o.page && e2.querySelectorAll('.m3-row.on').length === 1 && !!e2.querySelector('.m3-dg.on'); });
  ok(sv, `${tag}: a section from the bike's section list opens the same page (its diagram with the numbers, its parts)`);
  // the brand's diagram list still coming: the new page with "Loading diagram…", then the diagram once it is in
  const ld = await p.evaluate(i => { delete DG.hero; const r = catRows()[i]; go('findpart', { v: 'part', i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any' });
    const el = document.querySelector('#vp .m3'); return !!el && /Loading diagram/.test(el.textContent) && !!el.querySelector('.m3-row.on'); }, iA);
  ok(ld && await until(() => !!document.querySelector('#vp .m3 .dg[data-hk]')), `${tag}: while the diagram list loads the page says "Loading diagram…", then draws the diagram`);
  // a part with no diagram (the TVS XL100 book in the page): the old page
  const xl = await p.evaluate(() => { const rows = catRows(), i = rows.findIndex(r => r.xl && r.part); if (i < 0) return 'no XL100 row'; const r = rows[i];
    go('findpart', { v: 'part', i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any' }); return !document.querySelector('#vp .m3') && !!document.querySelector('#vp .fpc') && document.querySelector('#vp .fpc-pn').textContent === r.part; });
  ok(xl === true, `${tag}: a part with no diagram keeps the old page (${xl})`);
  ok(errs.length === 0, `${tag}: no page errors ` + errs.slice(0, 2).join(' | '));
  await p.context().close();
}
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
