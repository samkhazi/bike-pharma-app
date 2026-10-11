// 2026-10-11 Bajaj: its diagrams are pages of Bajaj's own PDF books inside bajaj_spc_pdfs.zip ('pdf:' links), drawn by pdf.js.
// Needs a server whose FILES_DIR has catalogues/bajaj/bajaj_spc_pdfs.zip (a sparse copy with some real books at their true offsets is enough):
// BASE3=http://127.0.0.1:3017 OUT=<dir> BOOKS=<offsets,comma separated> node tools/test_bajaj.mjs
// Writes each drawn diagram to OUT/<n>.png (+ OUT/list.json) for tools/bajaj_cmp.py, and checks Find Part shows a Bajaj diagram.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const BASE = process.env.BASE3 || 'http://127.0.0.1:3017', OUT = process.env.OUT || '/tmp/claude-0/bptest3/out';
const OFFS = (process.env.BOOKS || '').split(',').filter(Boolean).map(Number);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
ok(await p.evaluate(() => S.user && S.user.role === 'admin'), 'admin logged in');
// the diagrams of the books in the test zip: first, middle and last plate of each
const links = await p.evaluate(async offs => { const d = await (await fetch('cat/bajaj-dg.json')).json(); const out = [];
  for (const o of offs) { const l = d.f.filter(u => u.split(':')[2] === String(o)); if (l.length) out.push(...new Set([l[0], l[l.length >> 1], l[l.length - 1]])); }
  return out; }, OFFS);
ok(links.length >= OFFS.length * 2, 'diagram links for the test books: ' + links.length);
const res = [];
for (const [i, u] of links.entries()) {
  const r = await p.evaluate(async u => { const t = Date.now(); try { const bu = await catPf(u); const buf = new Uint8Array(await (await fetch(bu)).arrayBuffer());
    let s = ''; for (let k = 0; k < buf.length; k += 32768) s += String.fromCharCode.apply(null, buf.subarray(k, k + 32768)); return { ms: Date.now() - t, b64: btoa(s) }; }
    catch (e) { return { ms: Date.now() - t, err: (e && (e.code || e.message)) || String(e) }; } }, u);
  if (r.err) { ok(false, 'draw ' + u + ': ' + r.err); continue; }
  const buf = Buffer.from(r.b64, 'base64'); fs.writeFileSync(`${OUT}/${i}.png`, buf);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  res.push({ i, u, ms: r.ms, w, h, kb: Math.round(buf.length / 1024) });
}
fs.writeFileSync(OUT + '/list.json', JSON.stringify(res, null, 1));
ok(res.length === links.length, `all ${links.length} diagrams drawn as PNG (${res.map(r => r.w + 'x' + r.h + ' ' + r.ms + 'ms').join(', ')})`);
// Find Part: Bajaj is in, a section of a test book shows its diagram
ok(await p.evaluate(() => CAT_ALL.some(e => e.vb === 'Bajaj') && DG_SLUG.Bajaj === 'bajaj'), 'Find Part: Bajaj catalogue listed');
const shown = await p.evaluate(async () => {
  const e = CAT_ALL.find(e => e.vb === 'Bajaj'); if (!e) return false;
  catAsk(e); for (let k = 0; k < 120 && e.st !== 2; k++) await new Promise(r => setTimeout(r, 250));
  return !!(e.d && e.d.models.includes('Pulsar 150'));
});
ok(shown, 'Bajaj catalogue loads (Pulsar 150 in its models)');
// as a person opens it: Find Part > Bajaj > the test book's model > its year > a section shows the book's diagram
const sec = OFFS.length && await p.evaluate(async off => {
  const wait = async (f, n) => { for (let k = 0; k < n; k++) { const x = f(); if (x) return x; await new Promise(r => setTimeout(r, 250)); } return null; };
  const e = CAT_ALL.find(e => e.vb === 'Bajaj'); catAsk(e); const d = await wait(() => e.st === 2 && dgLoad('Bajaj'), 160); if (!d) return 'diagram index did not load';
  const vi = e.d.vars.findIndex((v, i) => d.p[i] && Object.values(d.p[i]).some(fi => d.f[fi].split(':')[2] === String(off))); if (vi < 0) return 'no edition of the test book';
  const v = e.d.vars[vi], vm = CAT_VMOD[v];
  for (const y of catVyrs(v)) {
    const p0 = { vb: 'Bajaj', vm, yr: String(y) }; go('findpart', { v: 'secs', ...p0 });
    const sc = await wait(() => { const s = catScope(m2A(p0)); return s && !s.loading && s; }, 160); if (!sc) return 'sections did not load';
    for (const r of sc.rows.filter(r => (r.vv || []).includes(v)).slice(0, 40)) {
      go('findpart', { v: 'sec', ...p0, pg: r.page }); const t = document.querySelector('#vp .screen .dg');
      if (!t || t.dataset.dg.split(':')[2] !== String(off)) { back(); continue; }
      return (await wait(() => /blob:/.test(t.style.backgroundImage), 160)) ? 'ok: ' + vm + ' ' + y + ' ' + r.page : 'diagram did not show: ' + document.querySelector('#vp .screen').innerText.slice(0, 120);
    }
  }
  return 'no section showing the test book';
}, OFFS[0]);
ok(/^ok/.test(sec), 'Find Part > Bajaj > model > year > section: the diagram shows (' + sec + ')');
await p.screenshot({ path: OUT + '/section.png' });
// bikepharma.com runs the app inside the website's frame: the PDF diagram draws there too
if (links.length) {
  const w = await p.context().newPage(); w.on('pageerror', e => errs.push('site: ' + e.message));
  await w.goto(BASE + '/', { waitUntil: 'load' }); let fr = null;
  for (let k = 0; k < 60 && !fr; k++) { await w.waitForTimeout(250); fr = w.frames().find(f => f !== w.mainFrame()); }
  if (fr) await fr.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && S.user, null, { timeout: 20000 }).catch(() => {});
  const r = fr ? await fr.evaluate(async u => { if (!(typeof S !== 'undefined' && S.user)) return 'not logged in inside the frame';
    try { const b = await catPf(u); return /^blob:/.test(b) ? 'ok' : 'no picture: ' + b; } catch (e) { return 'error: ' + ((e && (e.code || e.message)) || e); } }, links[links.length - 1]) : 'no app frame';
  ok(r === 'ok', 'website frame (bikepharma.com): a Bajaj PDF diagram draws (' + r + ')');
  await w.close();
}
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
