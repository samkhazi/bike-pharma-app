// 2026-10-12 TVS ALL: 17 of the 49 PDF books in Sam's folder All Catalogues > TVS ALL add parts the TVS e-catalogue does not have; a figure's
// diagram is its own book page ('pdf:' links at offset 0, like Suzuki), drawn by pdf.js. The other 32 books are already in the catalogue.
// The test uploads the folder the way Admin does it (Catalogue files > TVS > choose the folder): only the 17 books go up.
// Needs a server whose FILES_DIR holds only catalogues/tvs/tvs_images.zip (the size is what counts, as on bikepharma.com):
// BASE4=http://127.0.0.1:3018 SRC=<Sam's TVS ALL folder> FILES=<the server's FILES_DIR> OUT=<dir> node tools/test_tvs.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018', OUT = process.env.OUT || '/tmp/claude-0/bptest4/out';
const SRC = process.env.SRC || '/mnt/user-data/uploads/All Catalogues/TVS ALL', FILES = process.env.FILES || '/tmp/claude-0/bptest4/pf';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
fs.mkdirSync(OUT, { recursive: true });
const DG = JSON.parse(fs.readFileSync(new URL('../public/cat/tvs-dg.json', import.meta.url)));
const BOOKS = DG.files.filter(([f]) => f.endsWith('.pdf'));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
ok(await p.evaluate(() => S.user && S.user.role === 'admin'), 'admin logged in');

// ---- Admin > Catalogue files > TVS: the photo zip is already there, choose the folder All Catalogues > TVS ALL
await p.evaluate(() => go('catup'));
await p.waitForFunction(() => CUP.st === 2 && CUP.sets && CUP.sets['catalogues/tvs'], null, { timeout: 20000 });
const card = await p.evaluate(() => document.querySelector('#vp .screen').innerText);
ok(BOOKS.length === 17 && new RegExp(`TVS\\s+1 of ${DG.files.length} files on the server`).test(card) && card.includes('All Catalogues > TVS ALL'),
  `Catalogue files: the TVS card asks for All Catalogues > TVS ALL (1 of ${DG.files.length} files)`);
const inFolder = fs.readdirSync(SRC).filter(f => !f.startsWith('.'));
await p.setInputFiles('#cupcataloguestvs', SRC);
await p.waitForFunction(() => CUP.run && CUP.run.dir === 'catalogues/tvs' && CUP.run.end, null, { timeout: 600000, polling: 1000 });
const run = await p.evaluate(() => { const r = CUP.run; return { todo: r.todo.length, done: r.done, other: r.other, spare: r.spare, dup: r.dup, missing: r.missing, err: r.err, s: Math.round((r.end - r.t0) / 1000) }; });
ok(run.todo === 17 && run.done === 17 && !run.err && run.spare === 32 && run.other === inFolder.length - 17 - 32,
  `folder of ${inFolder.length} files: the ${run.done} books with new parts were sent (${run.s} s), ${run.spare} books already in the catalogue left on the computer, error: ${run.err || 'none'}`);
const same = BOOKS.filter(([f, z]) => { try { return fs.statSync(`${FILES}/catalogues/tvs/${f}`).size === z && md5(`${FILES}/catalogues/tvs/${f}`) === md5(`${SRC}/${f}`); } catch (e) { return false; } });
ok(same.length === 17, `the server's ${same.length} of 17 books are byte for byte the same as Sam's files`);
const extra = fs.readdirSync(`${FILES}/catalogues/tvs`).filter(f => !DG.files.some(x => x[0] === f));
ok(extra.length === 0, 'nothing else went to the server (no books already in the catalogue, no copies): ' + extra.join(', '));
await p.evaluate(() => refresh()); await p.waitForTimeout(400);
ok(await p.evaluate(n => new RegExp(`TVS\\s+${n} of ${n} files on the server[\\s\\S]*Ready`, 'i').test(document.querySelector('#vp .screen').innerText), DG.files.length),
  `TVS card: ${DG.files.length} of ${DG.files.length} files on the server, Ready`);

// ---- every book draws: the first and the last diagram page of each, as PNG (names with spaces, '&', ',' and '..' included)
const links = [];
for (const [f] of BOOKS) { const l = DG.f.filter(u => u.split(':')[1] === 'catalogues/tvs/' + f); ok(l.length > 0, `${f}: ${l.length} diagram pages`); if (l.length) links.push(...new Set([l[0], l[l.length - 1]])); }
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

// ---- Find Part > TVS: the two new models and a new book's section with its page
const ld = await p.evaluate(async () => { const e = CAT_ALL.find(e => e.vb === 'TVS'); catAsk(e); for (let k = 0; k < 160 && e.st !== 2; k++) await new Promise(r => setTimeout(r, 250));
  return e.d ? e.d.models.length + ' models: ' + e.d.models.join(', ') : 'not loaded'; });
ok(/^36 models: Jupiter 110 \(2024\), Jupiter 110,/.test(ld) && /Scooty Streak, Scooty, Scooty Teenz/.test(ld), 'TVS catalogue loads with Scooty and Scooty Teenz (' + ld.slice(0, 60) + '…)');
const open = async (vm, book, ed) => p.evaluate(async ([vm, book, ed]) => {
  const wait = async (f, n) => { for (let k = 0; k < n; k++) { const x = f(); if (x) return x; await new Promise(r => setTimeout(r, 250)); } return null; };
  const e = CAT_ALL.find(e => e.vb === 'TVS'); catAsk(e); const d = await wait(() => e.st === 2 && dgLoad('TVS'), 160); if (!d) return 'diagram index did not load';
  let Y = 'wait'; for (let k = 0; k < 80 && Y === 'wait'; k++) { Y = fpYrs({ vb: 'TVS', vm }); if (Y === 'wait') await new Promise(r => setTimeout(r, 250)); }
  const yrs = Y && Y !== 'wait' && Y.ys && Y.ys.length ? Y.ys.map(String) : ['Any'];
  for (const yr of yrs) {
    const p0 = { vb: 'TVS', vm, yr }; go('findpart', { v: 'secs', ...p0 });
    const sc = await wait(() => { const s = catScope(m2A(p0)); return s && !s.loading && s; }, 160); if (!sc) continue;
    const pages = [...new Set(sc.rows.filter(r => !ed || r.vv.some(v => v.includes(ed))).map(r => r.page))];
    for (const pg of pages.slice(0, 40)) {
      go('findpart', { v: 'sec', ...p0, pg }); const t = document.querySelector('#vp .screen .dg');
      if (!t || t.dataset.dg.split(':')[1] !== 'catalogues/tvs/' + book) continue;
      if (!(await wait(() => /blob:/.test(t.style.backgroundImage), 240))) return 'diagram did not show';
      return 'ok: ' + yr + ' / ' + pg + ' (' + pages.length + ' sections from this book)';
    }
  }
  return 'no section showing ' + book + ' in years ' + yrs.join(' ');
}, [vm, book, ed]);
let s1 = await open('Scooty', 'SCOOTY 2S & TEENZ 2S.pdf');
ok(/^ok/.test(s1), 'Find Part > TVS > Scooty > section: the book page shows (' + s1 + ')');
await p.screenshot({ path: OUT + '/scooty.png' });
s1 = await open('Apache RTR 160 4V', 'APACHE 160 4V PC ,..pdf', 'Ride Mode parts catalogue');
ok(/^ok/.test(s1), 'Find Part > TVS > Apache RTR 160 4V > a Ride Mode book section shows its page (' + s1 + ')');
s1 = await open('Apache RR 310', 'APACHE RR 310.pdf', 'BSVI parts catalogue (02 10 20)');
ok(/^ok/.test(s1), 'Find Part > TVS > Apache RR 310 > a BSVI book section shows its page (' + s1 + ')');
await p.screenshot({ path: OUT + '/rr310.png' });
const pn = await p.evaluate(() => { const e = CAT_ALL.find(e => e.vb === 'TVS'); return e.d && e.d.d ? e.d.d.length : 0; });
ok(pn === 54428, 'TVS rows in the app: ' + pn + ' (40,027 from the e-catalogue + 14,401 from the books)');

// bikepharma.com runs the app inside the website's frame: a TVS book page draws there too
const w = await p.context().newPage(); w.on('pageerror', e => errs.push('site: ' + e.message));
await w.goto(BASE + '/', { waitUntil: 'load' }); let fr = null;
for (let k = 0; k < 60 && !fr; k++) { await w.waitForTimeout(250); fr = w.frames().find(f => f !== w.mainFrame()); }
if (fr) await fr.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && S.user, null, { timeout: 20000 }).catch(() => {});
const r = fr ? await fr.evaluate(async u => { if (!(typeof S !== 'undefined' && S.user)) return 'not logged in inside the frame';
  try { const b = await catPf(u); return /^blob:/.test(b) ? 'ok' : 'no picture: ' + b; } catch (e) { return 'error: ' + ((e && (e.code || e.message)) || e); } }, links[links.length - 1]) : 'no app frame';
ok(r === 'ok', 'website frame (bikepharma.com): a TVS book page draws (' + r + ')');
await w.close();
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
