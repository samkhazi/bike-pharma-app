// 2026-10-12 update 8m (Sam 10:06Z "diagram pe jo numbers he 1,2,3,4,5,6,7, sabhi number clickable"): the numbers on the part page's
// diagram are clickable. KTM picture (the server's AI reads it once, then keeps it), a Bajaj book page with number text (read from
// the page itself) and a scanned Bajaj book page (the picture goes to the AI). Hover shows the part, a click chooses it, a hovered row
// lights its number, Admin places / takes away a number, the full-screen diagram has them too; computer 1280 x 900 and phone 390 x 844.
// Needs a server with the real catalogue files and the AI models, e.g. (port 3021):
//   T=/tmp/claude-0/bptest8m  (pf/catalogues/ktm -> the KTM HD PDFs, pf/catalogues/bajaj -> bajaj_spc_pdfs.zip, data/models/ppocr)
//   DATA_DIR=$T/data node admin.mjs add-admin sam@bikepharma.com "Sam" --password Test@1234
//   BILL_AI=on PHOTO_AI=off DATA_DIR=$T/data FILES_DIR=$T/pf PORT=3021 node server.mjs &
//   BASE=http://127.0.0.1:3021 node tools/test_hs.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3021', OUT = process.env.OUT || '/tmp/claude-0/nr';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const KTM = 'pa:catalogues/ktm/KTM_200-DUKE_MY-23.pdf:3965823:199520';   // 200 Duke 2023 frame: 73 lines, about 60 numbers drawn
const BJ_TXT = ':1256163117:', BJ_SCAN = ':568422756:';                   // Pulsar 150 BS VI (number text), Pulsar 125 LED headlamp (scanned)
const r0 = await fetch(BASE + '/api/dghot?u=' + encodeURIComponent(KTM));
ok(r0.status === 401, `not logged in: /api/dghot answers ${r0.status}`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: tag === 'phone' })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user && cur().s !== 'pw', null, { timeout: 15000 }); await p.waitForTimeout(400);
  const until = async (fn, arg, n = 160, ms = 250) => { for (let k = 0; k < n; k++) { const v = await p.evaluate(fn, arg); if (v) return v; await p.waitForTimeout(ms); } return null; };
  // the part page of the first line whose diagram is u (or has `has` in its link)
  const open = async (vb, has) => {
    await p.evaluate(vb => catNeed([CAT_ALL.find(e => e.vb === vb)]), vb);
    await p.waitForFunction(vb => CAT_ALL.find(e => e.vb === vb).st === 2, vb, { timeout: 120000 });
    await until(vb => { dgLoad(vb); return DG[DG_SLUG[vb]] && DG[DG_SLUG[vb]].st === 2; }, vb);
    const i = await p.evaluate(([vb, has]) => { const rows = catRows(); for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r.vb !== vb || r.xl || !r.ref) continue; const f = dgFig(r); if (f && f.u && f.u.includes(has)) { go('findpart', { v: 'part', i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any' }); return i; } } return -1; }, [vb, has]);
    if (i < 0) return -1;
    await until(() => !!document.querySelector('#vp .m3 .dg[data-hk]'));
    return i;
  };
  // the numbers on the page's diagram once read (or what the line under it says)
  const nums = (n = 600) => until(() => { const el = document.querySelector('#vp .m3 .dg[data-hk]'), bar = document.querySelector('#vp .m3 .hs-bar');
    if (!el || !bar || /Reading/.test(bar.textContent) || el.classList.contains('hs-wait')) return null;
    const hs = [...el.querySelectorAll('.hs')]; return { all: hs.length, on: hs.filter(h => !h.classList.contains('x')).length, bar: bar.textContent.trim(), src: el._hs && el._hs.src, u: el.dataset.dg }; }, null, n);
  const shot = name => p.screenshot({ path: `${OUT}/hs-${tag}-${name}.png` });
  // hover a number: its part shows; click it: that part is chosen; hover a row: its number lights up
  const play = async (name) => {
    const r = await p.evaluate(() => { const el = document.querySelector('#vp .m3 .dg[data-hk]'), c = M3[el.dataset.hk];
      const cur = c.rows.find(q => q.i === c.sel), hs = [...el.querySelectorAll('.hs:not(.x)')];
      const h = hs.find(h => h.dataset.ref !== hsNorm(cur && cur.ref)) || hs[0]; if (!h) return null;
      h.scrollIntoView({ block: 'center' }); h.dataset.t = '1'; return { ref: h.dataset.ref, k: el.dataset.hk }; });
    if (r) { await p.waitForTimeout(500); Object.assign(r, await p.evaluate(() => { const h = document.querySelector('#vp .m3 .hs[data-t]'); delete h.dataset.t; const o = h.getBoundingClientRect(); return { x: o.left + o.width / 2, y: o.top + o.height / 2 }; })); }
    if (!r) { ok(false, `${tag} ${name}: no number to click`); return; }
    if (tag === 'computer') {
      await p.mouse.move(r.x, r.y); await p.waitForTimeout(250);
      const tip = await p.evaluate(() => { const t = document.getElementById('hs-tip'); return t && !t.hidden ? t.innerText : ''; });
      ok(tip.includes(r.ref) && tip.length > r.ref.length + 3, `${tag} ${name}: hovering number ${r.ref} shows its part: ${tip.replace(/\s+/g, ' ').slice(0, 90)}`);
      await p.mouse.click(r.x, r.y);
    } else await p.touchscreen.tap(r.x, r.y);
    await p.waitForTimeout(400);
    const s = await p.evaluate(k => { const c = M3[k], q = c.rows.find(x => x.i === c.sel), on = document.querySelector('#vp .m3 .m3-row.on'), d = document.querySelector('#vp .m3 .m3-det');
      return { ref: q && hsNorm(q.ref), on: on ? hsNorm(on.dataset.ref) : '', ring: [...document.querySelectorAll('#vp .m3 .dg[data-hk] .hs.on')].map(h => h.dataset.ref), pn: d ? (d.querySelector('.fpc-pn') || {}).textContent || '' : '', part: q && q.part, len: S.stack.length }; }, r.k);
    const base = x => (/^(\d+)(?:[A-Z]|-\d+)$/.exec(x || '') || [])[1];
    ok((s.ref === r.ref || base(s.ref) === r.ref) && s.on === s.ref && s.ring.includes(r.ref) && s.pn === s.part, `${tag} ${name}: clicking number ${r.ref} chose ${s.ref} (${s.part}), the row is marked, its number ringed, details show it`);
    if (tag === 'computer') {
      const rr = await p.evaluate(() => { const rows = [...document.querySelectorAll('#vp .m3 .m3-row[data-ref]')], hs = new Set([...document.querySelectorAll('#vp .m3 .dg[data-hk] .hs:not(.x)')].map(h => h.dataset.ref));
        const row = rows.find(x => hs.has(hsNorm(x.dataset.ref)) && !x.classList.contains('on')); if (!row) return null; row.scrollIntoView({ block: 'center' }); row.dataset.t = '1'; return { ref: hsNorm(row.dataset.ref) }; });
      if (rr) { await p.waitForTimeout(500); Object.assign(rr, await p.evaluate(() => { const r = document.querySelector('#vp .m3 .m3-row[data-t]'); delete r.dataset.t; const o = r.getBoundingClientRect(); return { x: o.left + 30, y: o.top + o.height / 2 }; }));
        await p.mouse.move(rr.x, rr.y); await p.waitForTimeout(200);
        const hl = await p.evaluate(() => [...document.querySelectorAll('#vp .m3 .dg[data-hk] .hs.hl')].map(h => h.dataset.ref));
        ok(hl.length >= 1 && hl.every(x => x === rr.ref), `${tag} ${name}: hovering row ${rr.ref} lights its number (${hl.join(',')})`); }
    }
    await shot(name);
  };

  // ---- KTM picture: the server's AI reads it (the first time), the numbers come back on the picture ----
  let t0 = Date.now(), i = await open('KTM', KTM), n = i >= 0 ? await nums() : null;
  ok(i >= 0 && n && n.on >= 40 && /of \d+ parts are on this diagram/.test(n.bar) && n.src === 'ai', `${tag} KTM 200 Duke frame: ${n && n.on} numbers on the diagram (${n && n.all} read), "${n && n.bar}", ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (n) await play('ktm');
  // the full-screen diagram has the numbers too
  if (n) {
    await p.evaluate(() => dgZoom(document.querySelector('#vp .m3 .m3-dgw')));
    const z = await until(() => { const f = document.querySelector('.fpz-fig[data-hk]'); return f && f.querySelectorAll('.hs:not(.x)').length; }, null, 120);
    ok(z >= 40, `${tag} KTM full-screen diagram has ${z} numbers`);
    await shot('ktm-zoom');
    await p.evaluate(() => { const c = document.querySelector('.fpz .fpz-x, .fpz [aria-label="Close"]'); if (c) c.click(); else history.back(); }); await p.waitForTimeout(500);
  }
  // ---- Bajaj book page with number text: read from the page itself (no AI) ----
  t0 = Date.now(); i = await open('Bajaj', BJ_TXT); n = i >= 0 ? await nums() : null;
  ok(i >= 0 && n && n.on >= 5 && n.src === 'pdf', `${tag} Bajaj Pulsar 150 BS VI page: ${n && n.on} numbers from the page text (src ${n && n.src}), "${n && n.bar}", ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (n) await play('bajaj-text');
  // ---- scanned Bajaj book page: the drawn picture goes to the AI ----
  t0 = Date.now(); i = await open('Bajaj', BJ_SCAN); n = i >= 0 ? await nums() : null;
  ok(i >= 0 && n && n.on >= 3 && n.src === 'ai', `${tag} Bajaj Pulsar 125 (scanned) page: ${n && n.on} numbers by the AI, "${n && n.bar}", ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (n) await play('bajaj-scan');

  // ---- Admin: place a missed number with one tap, take a wrong one away ----
  if (tag === 'computer') {
    i = await open('KTM', KTM); n = await nums(40);
    ok(n && n.on >= 40, `${tag} KTM again: ${n && n.on} numbers straight from the server's copy`);
    await p.evaluate(() => [...document.querySelectorAll('#vp .m3 .hs-bar button')].find(x => /Fix numbers/.test(x.textContent)).click()); await p.waitForTimeout(300);
    const e1 = await p.evaluate(() => ({ ed: document.querySelector('#vp .m3').classList.contains('hs-edit'), bar: document.querySelector('#vp .m3 .hs-bar').textContent, nohs: document.querySelectorAll('#vp .m3 .m3-row.nohs').length }));
    ok(e1.ed && /Tap a part in the list/.test(e1.bar), `${tag} Fix numbers: edit mode on, ${e1.nohs} lines marked "Not on diagram"`);
    const pick = await p.evaluate(() => { const k = document.querySelector('#vp .m3').dataset.k, c = M3[k]; const r = document.querySelector('#vp .m3 .m3-row.nohs') || document.querySelector('#vp .m3 .m3-row[data-ref]:not(.on)'); m3Pick(+r.dataset.i, 'list'); return hsNorm(r.dataset.ref); });
    const spot = await p.evaluate(() => { const el = document.querySelector('#vp .m3 .dg[data-hk]'); el.scrollIntoView({ block: 'center' }); const o = el.getBoundingClientRect(); return { x: o.left + o.width * 0.06, y: o.top + o.height * 0.55, n: el.querySelectorAll('.hs.a').length }; });
    await p.mouse.click(spot.x, spot.y);
    const added = await until(() => document.querySelectorAll('#vp .m3 .dg[data-hk] .hs.a').length);
    const sv = await p.evaluate(u => fetch('/api/dghot?u=' + encodeURIComponent(u)).then(r => r.json()), KTM);
    ok(added === spot.n + 1 && sv.ed.some(e => e.a === 'add' && e.t === pick), `${tag} Admin tapped the diagram: number ${pick} placed and kept on the server (${sv.ed.length} fixes)`);
    await shot('admin-placed');
    const a = await p.evaluate(() => { const h = document.querySelector('#vp .m3 .dg[data-hk] .hs.a'); const o = h.getBoundingClientRect(); return { x: o.left + o.width / 2, y: o.top + o.height / 2 }; });
    await p.mouse.click(a.x, a.y); await p.waitForTimeout(200);
    const ask = await p.evaluate(() => document.querySelector('#vp .m3 .hs-bar').textContent);
    await p.evaluate(() => [...document.querySelectorAll('#vp .m3 .hs-bar button')].find(x => /Take away/.test(x.textContent)).click());
    const gone = await until(() => document.querySelectorAll('#vp .m3 .dg[data-hk] .hs.a').length === 0 ? 'yes' : null);
    const sv2 = await p.evaluate(u => fetch('/api/dghot?u=' + encodeURIComponent(u)).then(r => r.json()), KTM);
    ok(/Take number .* away/.test(ask) && gone && sv2.ed.some(e => e.a === 'del'), `${tag} Admin took it away again ("${ask.trim().slice(0, 40)}"), kept on the server`);
    await p.evaluate(() => [...document.querySelectorAll('#vp .m3 .hs-bar button')].find(x => /Done/.test(x.textContent)).click()); await p.waitForTimeout(200);
    ok(await p.evaluate(() => !document.querySelector('#vp .m3').classList.contains('hs-edit')), `${tag} Done: edit mode off`);
  }
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(wide <= 1, `${tag} nothing wider than the window (${wide})`);
  ok(errs.length === 0, `${tag} no page errors ` + errs.slice(0, 2).join(' | '));
  await p.context().close();
}
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
