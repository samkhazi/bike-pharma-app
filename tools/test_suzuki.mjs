// 2026-10-11 Suzuki: Suzuki's parts books are PDFs on their own (catalogues/suzuki/<book>); a figure's diagram is its whole book page
// ('pdf:' links at offset 0), drawn by pdf.js. The test uploads Sam's Suzuki folder the way Admin does it (Catalogue files > choose the
// folder): only the books the catalogue reads go up, the price list and the scanned books stay on the computer.
// Needs a server with an empty FILES_DIR:
// BASE4=http://127.0.0.1:3018 SRC=<Sam's Suzuki folder> FILES=<the server's FILES_DIR> OUT=<dir> node tools/test_suzuki.mjs
// Writes each drawn diagram to OUT/<n>.png (+ OUT/list.json) for tools/bajaj_cmp.py <FILES> <OUT>.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018', OUT = process.env.OUT || '/tmp/claude-0/bptest4/out';
const SRC = process.env.SRC || '/mnt/user-data/uploads/All Catalogues/Suzuki', FILES = process.env.FILES || '/tmp/claude-0/bptest4/pf';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
fs.mkdirSync(OUT, { recursive: true });
const DG = JSON.parse(fs.readFileSync(new URL('../public/cat/suzuki-dg.json', import.meta.url)));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
ok(await p.evaluate(() => S.user && S.user.role === 'admin'), 'admin logged in');

// ---- Admin > Catalogue files > Suzuki: choose the folder All Catalogues > Suzuki
await p.evaluate(() => go('catup'));
await p.waitForFunction(() => CUP.st === 2 && CUP.sets && CUP.sets['catalogues/suzuki'], null, { timeout: 20000 });
const card = await p.evaluate(() => document.querySelector('#vp .screen').innerText);
ok(/Suzuki\s+0 of 21 files on the server/.test(card) && card.includes('All Catalogues > Suzuki'), 'Catalogue files: the Suzuki card asks for All Catalogues > Suzuki (0 of 21 files)');
const inFolder = fs.readdirSync(SRC).filter(f => !f.startsWith('.'));
await p.setInputFiles('#cupcataloguessuzuki', SRC);
await p.waitForFunction(() => CUP.run && CUP.run.dir === 'catalogues/suzuki' && CUP.run.end, null, { timeout: 600000, polling: 1000 });
const run = await p.evaluate(() => { const r = CUP.run; return { todo: r.todo.length, done: r.done, other: r.other, dup: r.dup, missing: r.missing, err: r.err, s: Math.round((r.end - r.t0) / 1000) }; });
ok(run.todo === 21 && run.done === 21 && run.missing === 0 && !run.err && run.other === inFolder.length - 21,
  `folder of ${inFolder.length} files: the ${run.done} books the catalogue reads were sent (${run.s} s), ${run.other} other files left on the computer, error: ${run.err || 'none'}`);
const same = DG.files.filter(([f, z]) => { try { return fs.statSync(`${FILES}/catalogues/suzuki/${f}`).size === z && md5(`${FILES}/catalogues/suzuki/${f}`) === md5(`${SRC}/${f}`); } catch (e) { return false; } });
ok(same.length === 21, `the server's ${same.length} of 21 books are byte for byte the same as Sam's files`);
const extra = fs.readdirSync(`${FILES}/catalogues/suzuki`).filter(f => !DG.files.some(x => x[0] === f));
ok(extra.length === 0, 'nothing else went to the server (no price list, no scanned book, no copies): ' + extra.join(', '));
await p.evaluate(() => refresh()); await p.waitForTimeout(400);
ok(await p.evaluate(() => /Suzuki\s+21 of 21 files on the server[\s\S]*Ready/i.test(document.querySelector('#vp .screen').innerText)), 'Suzuki card: 21 of 21 files on the server, Ready');

// ---- every book draws: the first and the last diagram page of each, as PNG
const links = [];
for (const [f] of DG.files) { const l = DG.f.filter(u => u.split(':')[1] === 'catalogues/suzuki/' + f); if (l.length) links.push(...new Set([l[0], l[l.length - 1]])); }
ok(links.length >= 21, 'diagram pages to draw: ' + links.length + ' from ' + DG.files.length + ' books');
const res = [];
for (const [i, u] of links.entries()) {
  const r = await p.evaluate(async u => { const t = Date.now(); try { const bu = await catPf(u); const buf = new Uint8Array(await (await fetch(bu)).arrayBuffer());
    let s = ''; for (let k = 0; k < buf.length; k += 32768) s += String.fromCharCode.apply(null, buf.subarray(k, k + 32768)); URL.revokeObjectURL(bu); delete CAT_PFURL[u]; return { ms: Date.now() - t, b64: btoa(s) }; }
    catch (e) { return { ms: Date.now() - t, err: (e && (e.code || e.message)) || String(e) }; } }, u);
  if (r.err) { ok(false, 'draw ' + u + ': ' + r.err); continue; }
  const buf = Buffer.from(r.b64, 'base64'); fs.writeFileSync(`${OUT}/${i}.png`, buf);
  res.push({ i, u, ms: r.ms, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kb: Math.round(buf.length / 1024) });
}
fs.writeFileSync(OUT + '/list.json', JSON.stringify(res, null, 1));
ok(res.length === links.length, `all ${links.length} pages drawn as PNG (slowest ${Math.max(...res.map(r => r.ms))} ms, smallest ${Math.min(...res.map(r => Math.min(r.w, r.h)))} px side)`);

// ---- Find Part > Suzuki
ok(await p.evaluate(() => CAT_ALL.some(e => e.vb === 'Suzuki') && DG_SLUG.Suzuki === 'suzuki'), 'Find Part: Suzuki catalogue listed');
const ld = await p.evaluate(async () => { const e = CAT_ALL.find(e => e.vb === 'Suzuki'); catAsk(e); for (let k = 0; k < 120 && e.st !== 2; k++) await new Promise(r => setTimeout(r, 250));
  return e.d ? e.d.models.length + ' models: ' + e.d.models.slice(0, 4).join(', ') : 'not loaded'; });
ok(/^26 models: Access 125, Burgman Street 125/.test(ld), 'Suzuki catalogue loads (' + ld + ')');
// model years from the books: Access 125 from 2011 (UZ125L2) to now (the 2025+ book)
const yrs = await p.evaluate(async () => { for (let k = 0; k < 80; k++) { const Y = fpYrs({ vb: 'Suzuki', vm: 'Access 125' }); if (Y !== 'wait') return (Y.ys || []).map(String); await new Promise(r => setTimeout(r, 250)); } return []; });
ok(yrs.includes('2011') && yrs.includes('2026') && yrs.includes('2019') && !yrs.includes('2010'), 'Access 125 model years: ' + yrs.join(' '));
await p.evaluate(() => go('findpart', { v: 'year', vb: 'Suzuki', vm: 'Access 125', yr: 'Any' })); await p.waitForTimeout(600);
ok(await p.evaluate(() => /choose model year/.test(document.querySelector('#vp .screen').innerText) && /2025/.test(document.querySelector('#vp .screen').innerText)), 'Find Part > Suzuki > Access 125 shows its model years');
// as a person opens it: Find Part > Suzuki > Access 125 > 2025 > a section shows the 2025 book's page
const sec = await p.evaluate(async book => {
  const wait = async (f, n) => { for (let k = 0; k < n; k++) { const x = f(); if (x) return x; await new Promise(r => setTimeout(r, 250)); } return null; };
  const e = CAT_ALL.find(e => e.vb === 'Suzuki'); catAsk(e); const d = await wait(() => e.st === 2 && dgLoad('Suzuki'), 160); if (!d) return 'diagram index did not load';
  const p0 = { vb: 'Suzuki', vm: 'Access 125', yr: '2025' }; go('findpart', { v: 'secs', ...p0 });
  const sc = await wait(() => { const s = catScope(m2A(p0)); return s && !s.loading && s; }, 160); if (!sc) return 'sections did not load';
  for (const r of sc.rows.slice(0, 60)) {
    go('findpart', { v: 'sec', ...p0, pg: r.page }); const t = document.querySelector('#vp .screen .dg');
    if (!t || t.dataset.dg.split(':')[1] !== 'catalogues/suzuki/' + book) { back(); continue; }
    return (await wait(() => /blob:/.test(t.style.backgroundImage), 240)) ? 'ok: ' + r.page + ' ' + document.querySelector('#vp .screen h1, #vp .screen .h2')?.innerText : 'diagram did not show';
  }
  return 'no section showing the book';
}, '2025NEW ACCESS.pdf');
ok(/^ok/.test(sec), 'Find Part > Suzuki > Access 125 > 2025 > section: the book page shows (' + sec + ')');
await p.screenshot({ path: OUT + '/section.png' });
const secTxt = await p.evaluate(() => document.querySelector('#vp .screen').innerText);
ok(/₹\s?[\d,]+/.test(secTxt), 'the section lists MRP from Suzuki\'s price list');
// a model with no book (only in the price list): straight to its sections, which say there is no diagram
await p.evaluate(() => go('findpart', { v: 'year', vb: 'Suzuki', vm: 'Burgman Street 125', yr: 'Any' })); await p.waitForTimeout(800);
const bs = await p.evaluate(() => document.querySelector('#vp .screen').innerText);
ok(!/choose model year/.test(bs) && /Engine/.test(bs) && /Burgman Street 125/.test(bs), 'Burgman Street 125 (price list only): straight to its sections');
const pl = await p.evaluate(async () => { const p0 = { vb: 'Suzuki', vm: 'Burgman Street 125', yr: 'Any' }; const sc = catScope(m2A(p0)); if (!sc || sc.loading || !sc.rows.length) return 'no rows';
  go('findpart', { v: 'sec', ...p0, pg: sc.rows[0].page }); await new Promise(r => setTimeout(r, 400)); return document.querySelector('#vp .screen').innerText; });
ok(/No diagram in the app for this book/.test(pl) && /₹\s?[\d,]+/.test(pl), 'a price-list section: no diagram note, parts with MRP');
ok(await p.evaluate(() => catNice('CAP, UZ125NE FRONT') === 'Cap, UZ125NE Front' && catNice('GSX150FRLM6 COVER') === 'GSX150FRLM6 Cover'), 'model codes stay in capitals (UZ125NE, GSX150FRLM6)');

// bikepharma.com runs the app inside the website's frame: a Suzuki page draws there too
const w = await p.context().newPage(); w.on('pageerror', e => errs.push('site: ' + e.message));
await w.goto(BASE + '/', { waitUntil: 'load' }); let fr = null;
for (let k = 0; k < 60 && !fr; k++) { await w.waitForTimeout(250); fr = w.frames().find(f => f !== w.mainFrame()); }
if (fr) await fr.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && S.user, null, { timeout: 20000 }).catch(() => {});
const r = fr ? await fr.evaluate(async u => { if (!(typeof S !== 'undefined' && S.user)) return 'not logged in inside the frame';
  try { const b = await catPf(u); return /^blob:/.test(b) ? 'ok' : 'no picture: ' + b; } catch (e) { return 'error: ' + ((e && (e.code || e.message)) || e); } }, links[links.length - 1]) : 'no app frame';
ok(r === 'ok', 'website frame (bikepharma.com): a Suzuki book page draws (' + r + ')');
await w.close();
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
