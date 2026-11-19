// update 23u: a Yamaha book read from its PDF's own text comes in as its own small file yamaha_extra_<name>.json (same shape as yamaha_build.json);
// a scan book with no part list gives way to it for the model codes it lists; the checked places of the diagram numbers go to /api/dghot
// usage: node tools/test_yextra.mjs   (own server on 3035, fresh database, a small made-up Yamaha folder)
import { spawn } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-yextra'; fs.rmSync(T, { recursive: true, force: true });
const D = T + '/pf/catalogues/yamaha'; fs.mkdirSync(D, { recursive: true });
const SCAN = 'KEY1 RX 135 (2014-02-12).pdf', TXT = 'yamaha rx135.pdf';
for (const f of [SCAN, TXT]) fs.writeFileSync(D + '/' + f, '%PDF-1.4 test');
fs.writeFileSync(D + '/yamaha_build.json', JSON.stringify({ v: 1, names: { KEY1: 'RX135', KEY5: 'RX135' }, mrp: { KEYE11110000: 1234 },
  books: [{ file: SCAN, size: 13, date: '2014-02-12', title: 'RX 135', codes: ['KEY1', 'KEY5'], figs: [{ fig: '1', name: 'CYLINDER', page: 3, crop: '0,0,0.5,1', codes: ['KEY1', 'KEY5'], rows: [] }] }] }));
const X = { v: 1, names: { KEY1: 'Wrong name', KEY2: 'RX135' }, books: [{ file: TXT, size: 13, date: '2009-04', title: 'RX 135 PARTS CATALOGUE', codes: ['KEY1', 'KEY2'], all: 1, figs: [
  { fig: '1', name: 'CYLINDER', page: 5, crop: '0.09,0.14,0.4,0.8', codes: ['KEY1', 'KEY2'], hot: [['1', 0.1, 0.1, 0.15, 0.14], ['2', 0.5, 0.5, 0.55, 0.54], ['bad']],
    rows: [['1', 'KEY-E1111-00', 'CYLINDER HEAD', { KEY1: '1', KEY2: '1' }, 'Not serviceable (book note #)'], ['2', '1L1560002X00', 'GASKET', null, '9 digit no. 1L1560002']] }] }] };
const { buildYamaha, isYamahaExtra } = await import('../lib/yamahabuild.mjs');
ok(isYamahaExtra('yamaha_extra_rx135.json') && !isYamahaExtra('yamaha_build.json') && !isYamahaExtra('yamaha_extra/../x.json'), 'only yamaha_extra_<name>.json counts as an extra book file');
const y0 = buildYamaha(D);
ok(y0.cat.d.length === 0 && y0.cat.vars.length === 2, 'before: the scan book alone gives its codes no part');
fs.writeFileSync(D + '/yamaha_extra_rx135.json', JSON.stringify(X));
const y = buildYamaha(D), d = y.cat, V = c => d.vars.findIndex(v => v.includes(' · ' + c + ' '));
ok(d.vars[V('KEY1')] === 'RX135 · KEY1 RX 135 PARTS CATALOGUE (2009-04)' && V('KEY2') >= 0 && d.vars[V('KEY5')] === 'RX135 · KEY5 RX 135 (2014-02-12)', "the text book is the book of its codes (the app's own model name stays); the scan book keeps only the code no text book has");
const r1 = d.d.find(r => r[5] === 'KEY-E1111-00'), r2 = d.d.find(r => r[5] === '1L1560002X00');
ok(r1 && r1[2] === '1' && r1[4] === '1' && r1[7] === '1' && r1[11].join() === [V('KEY1'), V('KEY2')].sort((a, b) => a - b).join() && /Not serviceable/.test(r1[8]) && d.mrp['KEY-E1111-00'] === 1234, 'its parts: fig, ref no., qty, remark, MRP from the MRP list, for both codes');
ok(r2 && r2[7] === '' && r2[11].length === 2 && !d.d.some(r => / \(2009-04\)$/.test(r[2])), 'a part with no qty printed is still listed; nothing is filed as an older book');
const u = `pdf:catalogues/yamaha/${TXT}:0:13:5:0.09,0.14,0.4,0.8`;
ok(y.dg.f[y.dg.p[String(V('KEY1'))]['1']] === u && y.hot[u] && y.hot[u].length === 3 && y.info.hot === 1 && y.info.extra.join() === 'yamaha_extra_rx135.json (1)', 'diagram = the PDF page; its number places kept by diagram');
await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3035', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', x => log += x); srv.stderr.on('data', x => log += x);
const BASE = 'http://127.0.0.1:3035';
try {
  for (let i = 0; i < 120 && !/yamaha build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/yamaha build \(start\) ended 0/.test(log) && fs.existsSync(T + '/data/cat/yamaha-hot.json'), 'server: Yamaha made at start with the extra book, places file written');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const h = await (await fetch(BASE + '/api/dghot?u=' + encodeURIComponent(u) + '&ocr=1', { headers: { cookie } })).json();
  ok(h.site === 1 && !h.need && h.toks.length === 2 && h.toks[0].join() === '1,0.1,0.1,0.15,0.14,1' && h.toks[1][0] === '2', 'the diagram answers with the checked places (no reader, no guess); a broken entry is left out');
  const h2 = await (await fetch(BASE + '/api/dghot?u=' + encodeURIComponent(`pdf:catalogues/yamaha/${SCAN}:0:13:3:0,0,0.5,1`) + '&ocr=1', { headers: { cookie } })).json();
  ok(h2.need === 'img' && !h2.site, 'another Yamaha PDF diagram is read as before');
  const up = await fetch(BASE + '/api/catup?path=' + encodeURIComponent('catalogues/yamaha/yamaha_extra_rx135.json') + '&size=10', { headers: { cookie } });
  ok(up.status === 200, 'the extra file can be uploaded from Admin > Catalogue files');
  // the redrawn diagrams: one zip next to the book; with it here the diagram is the drawing inside it, and the same places answer for it
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><path d="M0 0h5v5z"/></svg>', pad = 'PK-test-head-';
  X.books[0].dg = { file: 'yamaha_extra_rx135_dg.zip', size: pad.length + svg.length }; X.books[0].figs[0].svg = [pad.length, svg.length];
  fs.writeFileSync(D + '/yamaha_extra_rx135.json', JSON.stringify(X));
  const ya = buildYamaha(D); ok(ya.dg.f.includes(u) && !ya.info.vector, 'zip not uploaded yet: the PDF page stays the diagram');
  fs.writeFileSync(D + '/yamaha_extra_rx135_dg.zip', pad + svg); log = '';
  const uz = await fetch(BASE + '/api/catup?path=' + encodeURIComponent('catalogues/yamaha/yamaha_extra_rx135_dg.zip') + '&size=10', { headers: { cookie } }); ok(uz.status === 200, 'the diagrams zip can be uploaded too');
  const yb = buildYamaha(D), v = `pf:catalogues/yamaha/yamaha_extra_rx135_dg.zip:${pad.length}:${svg.length}`;
  ok(yb.info.vector >= 1 && yb.dg.f.includes(v) && !yb.dg.f.includes(u) && yb.hot[v] && yb.hot[v].length === 3, 'zip here: the diagram is the drawing inside it, with the same number places');
  X.books[0].dg.size++; fs.writeFileSync(D + '/yamaha_extra_rx135.json', JSON.stringify(X)); ok(!buildYamaha(D).info.vector, 'a zip of another size is not used');
  X.books[0].dg.size--; fs.writeFileSync(D + '/yamaha_extra_rx135.json', JSON.stringify(X));
  fs.writeFileSync(T + '/data/cat/yamaha-hot.json', JSON.stringify(buildYamaha(D).hot));
  const h3 = await (await fetch(BASE + '/api/dghot?u=' + encodeURIComponent(v) + '&ocr=1', { headers: { cookie } })).json();
  ok(h3.site === 1 && !h3.need && h3.toks.length === 2 && h3.toks[0].join() === '1,0.1,0.1,0.15,0.14,1', 'the drawing answers with the checked places');
  const pfr = await fetch(BASE + '/api/files/read?path=' + encodeURIComponent('catalogues/yamaha/yamaha_extra_rx135_dg.zip') + '&offset=' + pad.length + '&length=' + svg.length, { headers: { cookie } });
  ok(pfr.status === 200 && (await pfr.text()) === svg, 'the app reads the drawing out of the zip');
  // 23v: another book (its PDF in the YPEC folder) shares that zip; a fig with only the drawing (no page of its own) still shows it
  fs.writeFileSync(D + '/yamaha_extra_rx135_456.json', JSON.stringify({ v: 1, names: { KEY7: 'RX135' }, books: [{ file: 'K7.PDF', rel: 'catalogues/hero-sync/yamaha/ypec/pdf', size: 5, date: '2001', title: 'RX 135 PARTS CATALOGUE', codes: ['KEY7'], all: 1, dg: X.books[0].dg, figs: [
    { fig: '1', name: 'CYLINDER', codes: ['KEY7'], svg: [pad.length, svg.length], hot: [['1', 0.1, 0.1, 0.15, 0.14]], rows: [['1', 'KEY-E1111-20', 'CYLINDER HEAD', { KEY7: '1' }, '']] },
    { fig: '2', name: 'EXHAUST', codes: ['KEY7'], rows: [['1', 'KEY-E4711-00', 'MUFFLER', { KEY7: '1' }, '']] },
    { fig: '3', name: 'CLUTCH', codes: ['KEY7'], page: 4, crop: '0,0,0.5,1', rows: [['1', 'KEY-E6111-00', 'GEAR', { KEY7: '1' }, '']] }] }] }));
  const yc = buildYamaha(D), v7 = String(yc.cat.vars.findIndex(x => x.includes(' · KEY7 ')));
  ok(yc.dg.f[yc.dg.p[v7]['1']] === v && yc.dg.p[v7]['2'] == null && yc.dg.f[yc.dg.p[v7]['3']] === 'pdf:catalogues/hero-sync/yamaha/ypec/pdf/K7.PDF:0:5:4:0,0,0.5,1' && yc.cat.d.some(r => r[5] === 'KEY-E4711-00' && r[1] === -2),
    'a second book shares the zip: drawing-only fig shows it, a fig with no diagram is a list, a page-only fig shows its page in the YPEC folder');
  fs.rmSync(D + '/yamaha_extra_rx135_456.json');
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/yamaha');
  ok(mf.files.some(f => f[0] === 'yamaha_extra_rx135.json' && f[1] === 113707) && mf.files.some(f => f[0] === 'yamaha_extra_rx135_dg.zip' && f[1] === 18625200) && mf.files.some(f => f[0] === 'yamaha_extra_rx135_456.json' && f[1] === 292133) && mf.files.some(f => f[0] === 'yamaha rx135.pdf' && f[1] === 1744328), 'upload card lists the RX135 book and its file');
} finally { srv.kill(); }
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
