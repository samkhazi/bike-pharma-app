// 2026-10-17 Royal Enfield (update 9h): RE's diagram books from Sam's folder Downloads > Royal-Enfield-Catalogue > Models replace the RE package.
// A diagram is its own book page ('pdf:' links at offset 0, like Suzuki), drawn by pdf.js; part photos stay in RE_Upload_Package_IMAGES_part2.zip.
// The test uploads a few books the way Admin does it (Catalogue files > Royal Enfield > choose the folder) and opens them in Find Part.
// Needs a server whose FILES_DIR holds only catalogues/royal-enfield/RE_Upload_Package_IMAGES_part2.zip (the size is what counts):
// BASE4=http://127.0.0.1:3019 SRC=<a Models folder with some of the books> FILES=<the server's FILES_DIR> OUT=<dir> node tools/test_re.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3019', OUT = process.env.OUT || '/tmp/claude-0/re9h/out2';
const SRC = process.env.SRC || '/mnt/user-data/uploads/Downloads/Royal-Enfield-Catalogue/Models', FILES = process.env.FILES || '/tmp/claude-0/re9h/pf';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
fs.mkdirSync(OUT, { recursive: true });
const DG = JSON.parse(fs.readFileSync(new URL('../public/cat/royal-enfield-dg.json', import.meta.url)));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.startsWith('.') ? [] : [path.join(d, e.name)]);
const inFolder = walk(SRC), BOOKS = inFolder.filter(f => DG.files.some(([n, z]) => n === path.basename(f) && z === fs.statSync(f).size));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
ok(await p.evaluate(() => S.user && S.user.role === 'admin'), 'admin logged in');

// ---- Admin > Catalogue files > Royal Enfield: the photo zip is already there, choose the folder Downloads > Royal-Enfield-Catalogue > Models
await p.evaluate(() => go('catup'));
await p.waitForFunction(() => CUP.st === 2 && CUP.sets && CUP.sets['catalogues/royal-enfield'], null, { timeout: 20000 });
const card = await p.evaluate(() => document.querySelector('#vp .screen').innerText);
ok(DG.files.length === 152 && new RegExp(`Royal Enfield\\s+1 of 152 files on the server`).test(card) && card.includes('Downloads > Royal-Enfield-Catalogue > Models'),
  'Catalogue files: the Royal Enfield card asks for Downloads > Royal-Enfield-Catalogue > Models (1 of 152 files)');
await p.setInputFiles('#cupcataloguesroyalenfield', SRC);
await p.waitForFunction(() => CUP.run && CUP.run.dir === 'catalogues/royal-enfield' && CUP.run.end, null, { timeout: 600000, polling: 1000 });
const run = await p.evaluate(() => { const r = CUP.run; return { todo: r.todo.length, done: r.done, other: r.other, missing: r.missing, err: r.err, s: Math.round((r.end - r.t0) / 1000) }; });
ok(run.todo === BOOKS.length && run.done === BOOKS.length && !run.err && run.other === inFolder.length - BOOKS.length && run.missing === 151 - BOOKS.length,
  `folder of ${inFolder.length} files: the ${run.done} diagram books were sent (${run.s} s), ${run.other} other file left on the computer, ${run.missing} books still to come, error: ${run.err || 'none'}`);
const same = BOOKS.filter(f => { const s = `${FILES}/catalogues/royal-enfield/${path.basename(f)}`; try { return md5(s) === md5(f); } catch (e) { return false; } });
ok(same.length === BOOKS.length, `the server's ${same.length} of ${BOOKS.length} books are byte for byte the same as Sam's files`);

// ---- every uploaded book draws: its first and last diagram page, as PNG
const links = [];
for (const f of BOOKS) { const l = DG.f.filter(u => u.split(':')[1] === 'catalogues/royal-enfield/' + path.basename(f)); ok(l.length > 0, `${path.basename(f)}: ${l.length} diagram pages`); if (l.length) links.push(...new Set([l[0], l[l.length - 1]])); }
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

// ---- Find Part > Royal Enfield: models, editions, a section with its page, MRP and photo
const ld = await p.evaluate(async () => { const e = CAT_ALL.find(e => e.vb === 'Royal Enfield'); catAsk(e); for (let k = 0; k < 200 && e.st !== 2; k++) await new Promise(r => setTimeout(r, 250));
  return e.d ? { m: e.d.models.join(', '), v: e.d.vars.length, rows: e.d.d.length, mrp: Object.keys(e.d.mrp || {}).length, ph: Object.keys(e.d.phf || {}).length } : null; });
ok(ld && /^Classic 350, Bullet 350, Hunter 350, Meteor 350,/.test(ld.m) && ld.m.includes('Flying Flea C6') && ld.v === 143,
  'Royal Enfield loads: 30 models with Flying Flea C6, 142 versions + the price list (' + (ld && ld.rows) + ' lines, MRP ' + (ld && ld.mrp) + ', photos ' + (ld && ld.ph) + ')');
const open = async (vm, book, ed) => p.evaluate(async ([vm, book, ed]) => {
  const wait = async (f, n) => { for (let k = 0; k < n; k++) { const x = f(); if (x) return x; await new Promise(r => setTimeout(r, 250)); } return null; };
  const e = CAT_ALL.find(e => e.vb === 'Royal Enfield'); catAsk(e); const d = await wait(() => e.st === 2 && dgLoad('Royal Enfield'), 200); if (!d) return 'diagram index did not load';
  let Y = 'wait'; for (let k = 0; k < 80 && Y === 'wait'; k++) { Y = fpYrs({ vb: 'Royal Enfield', vm }); if (Y === 'wait') await new Promise(r => setTimeout(r, 250)); }
  const yrs = Y && Y !== 'wait' && Y.ys && Y.ys.length ? Y.ys.map(String) : ['Any'];
  for (const yr of yrs) {
    const p0 = { vb: 'Royal Enfield', vm, yr }; go('findpart', { v: 'secs', ...p0 });
    const sc = await wait(() => { const s = catScope(m2A(p0)); return s && !s.loading && s; }, 200); if (!sc) continue;
    const pages = [...new Set(sc.rows.filter(r => !ed || r.vv.some(v => v.includes(ed))).map(r => r.page))];
    for (const pg of pages.slice(0, 40)) {
      go('findpart', { v: 'sec', ...p0, pg }); const t = document.querySelector('#vp .screen .dg');
      if (!t || t.dataset.dg.split(':')[1] !== 'catalogues/royal-enfield/' + book) continue;
      if (!(await wait(() => /blob:/.test(t.style.backgroundImage), 240))) return 'diagram did not show';
      return 'ok: ' + yr + ' / ' + pg + ' (' + pages.length + ' sections)';
    }
  }
  return 'no section showing ' + book + ' in years ' + yrs.join(' ');
}, [vm, book, ed]);
let s1 = await open('Hunter 350', 'HUNTER 350 CITY - Diagrams.pdf', 'City');
ok(/^ok/.test(s1), 'Find Part > Royal Enfield > Hunter 350 > City section shows its book page (' + s1 + ')');
await p.screenshot({ path: OUT + '/hunter.png' });
s1 = await open('Flying Flea C6', 'FF.C6 - Diagrams.pdf');
ok(/^ok/.test(s1), 'Find Part > Royal Enfield > Flying Flea C6 section shows its page (' + s1 + ')');
s1 = await open('Classic 500', 'CLASSIC 500 - BSIII - Diagrams.pdf', 'BSIII');
ok(/^ok/.test(s1), 'Find Part > Royal Enfield > Classic 500 BSIII section shows its page (' + s1 + ')');
await p.screenshot({ path: OUT + '/classic500.png' });
const q = await p.evaluate(() => { const e = CAT_ALL.find(e => e.vb === 'Royal Enfield'); return [e.d.mrp['1570250/B'], !!e.d.phf['RAJ00433/B'] || Object.keys(e.d.phf).length > 9000]; });
ok(q[0] === 163 && q[1], 'MRP of 1570250/B FILTER ELEMENT is Rs 163 (16 Oct), RE package photos kept');
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
