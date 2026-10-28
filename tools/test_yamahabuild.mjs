// update 12e: Yamaha made on the server from Sam's Downloads > Yamaha Catalogue folder: one edition per model code from its newest parts
// book (diagram from the PDF page), older books of the code add only the parts it lacks, qty per code, official MRP, old and new numbers,
// colour names, kit contents, compatible models
// usage: node tools/test_yamahabuild.mjs   (own server on 3028, fresh database, a small made-up Yamaha folder)
import { spawn } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-yamaha'; fs.rmSync(T, { recursive: true, force: true });
const D = T + '/pf/catalogues/yamaha'; fs.mkdirSync(D, { recursive: true });
const NEW = "DM49 YZF155D-A,IND,NPL,BGD,LKA,'27 (2026-09-12).pdf", OLD = 'BB71 BB71–YZF R15 (2016-03-04).pdf', OLD2 = 'DM49 YZF155D-A (2024-01-10).pdf';
for (const f of [NEW, OLD]) fs.writeFileSync(D + '/' + f, '%PDF-1.4 test');   // OLD2 not uploaded yet
const fig = (n, name, page, codes, rows) => ({ fig: n, name, page, crop: '0,0,0.48,1', codes, rows });
fs.writeFileSync(D + '/yamaha_build.json', JSON.stringify({ v: 1,
  books: [
    { file: NEW, size: 13, date: '2026-09-12', title: "YZF155D-A,IND,NPL,BGD,LKA,'27", codes: ['DM49', 'DM4A'], figs: [
      fig('1', 'CYLINDER HEAD', 7, ['DM49', 'DM4A'], [['1', 'B0T-E1102-10', 'CYLINDER HEAD ASSY', { DM49: '1', DM4A: '1' }, ''], ['2', '90340-12813', '.PLUG, STRAIGHT SCREW', { DM49: '2', DM4A: '-' }, '']]),
      fig('25', 'FRONT WHEEL', 40, ['DM49', 'DM4A'], [['1', 'B9E-F5168-01-33', 'CAST WHEEL, FRONT', { DM49: '1', DM4A: '1' }, 'UR FOR MYWP1']])] },
    { file: OLD2, size: 13, date: '2024-01-10', title: 'YZF155D-A', codes: ['DM49'], figs: [
      fig('1', 'CYLINDER HEAD', 6, ['DM49'], [['1', 'B0T-E1102-10', 'CYLINDER HEAD ASSY', { DM49: '1' }, ''], ['5', 'B0T-E1199-00', 'OLD GASKET', { DM49: '1' }, '']])] },
    { file: OLD, size: 13, date: '2016-03-04', title: 'BB71–YZF R15', codes: ['BB71'], figs: [
      fig('1', 'CYLINDER HEAD', 5, [], [['1', 'B0T-E1102-10', 'CYLINDER HEAD ASSY', { BB71: '1' }, '']])] }],
  names: { DM49: 'R15 V4', DM4A: 'R15 V4', BB71: 'R15 V3' },
  mrp: { B0TE11021000: 5290.4, '903401281300': 31 },
  sup: [['B9EF51680033', 'B9EF51680133'], ['B0TE11020000', 'B0TE11021000']],
  kits: [['R15 V4 PARTS KIT', 'B0TE11021000', 'CYLINDER HEAD ASSY', 1]],
  colours: { MYWP1: 'Matte White Pearl' } }));

await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3028', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3028';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  for (let i = 0; i < 120 && !/yamaha build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/yamaha build \(start\) ended 0/.test(log), 'the Yamaha folder found at start: Yamaha made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const d = JSON.parse(fs.readFileSync(T + '/data/cat/yamaha.json', 'utf8')), g = await (await get('/cat/yamaha-dg.json')).json();
  ok(d.models.join() === 'R15 V4,R15 V3' && d.cc['R15 V4'] === 155, 'models from the code list, on sale now first');
  ok(d.vars.length === 3 && d.vars[0] === "R15 V4 · DM49 YZF155D-A,IND,NPL,BGD,LKA,'27 (2026-09-12)" && d.vars.some(v => v.startsWith('R15 V3 · BB71 ')), 'one edition per model code, named by its newest book');
  const V = c => d.vars.findIndex(v => v.includes(' · ' + c + ' ')), byPn = pn => d.d.filter(r => r[5] === pn);
  const head = byPn('B0T-E1102-10').filter(r => r[2] === '1');
  ok(head.length === 1 && head[0][11].join() === [V('DM49'), V('DM4A'), V('BB71')].sort((a, b) => a - b).join() && d.asm[head[0][3]] === 'CYLINDER HEAD', 'compatible: one line lists every code with the same part');
  const plug = byPn('90340-12813');
  ok(plug.length === 1 && plug[0][7] === '2' && plug[0][11].join() === String(V('DM49')), "qty per code; a code with '-' does not get the part");
  ok(d.mrp['B0T-E1102-10'] === 5290 && d.mrp['90340-12813'] === 31, 'official MRP by part number');
  const wh = byPn('B9E-F5168-01-33')[0];
  ok(/UR FOR MYWP1 \(Matte White Pearl\)/.test(wh[8]) && /Old no\. B9EF51680033/.test(wh[8]) && /Old no\. B0T-E1102-00|Old no\. B0TE11020000/.test(head[0][8]) && /In kit: R15 V4 PARTS KIT/.test(head[0][8]), 'remarks with colour names, old numbers, kit');
  const old = byPn('B0T-E1199-00')[0];
  ok(old && old[2] === '1 (2024-01-10)' && old[11].join() === String(V('DM49')) && /From the 2024-01-10 book/.test(old[8]) && byPn('B0T-E1102-10').length === 1, "an older book of the code adds only the part the newest one lacks, under its date");
  const p = g.p[String(V('DM49'))];
  ok(g.f[p['1']] === `pdf:catalogues/yamaha/${NEW}:0:13:7:0,0,0.48,1` && g.f[p['25']].endsWith(':40:0,0,0.48,1') && g.f[p['1 (2024-01-10)']].includes(OLD2), 'diagram from the PDF page, clickable numbers by ref');
  const b = JSON.parse(fs.readFileSync(T + '/data/cat/yamaha-build.json', 'utf8'));
  ok(b.missing === 1 && b.missingFiles[0] === OLD2, 'a book PDF not uploaded yet is counted (its lines still come)');
  const hd = await (await get('/cat/yamaha.json')).json();
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length, 'cat/yamaha.json sends the head only (fast, like Bajaj)');
  const app = await (await get('/app.html')).text(), pa = fs.readFileSync('public/app.html', 'utf8');
  const yl = s => (/'Yamaha':\['[^']*','[^']*'\]/.exec(s) || [''])[0];
  ok(yl(app) && yl(app) !== yl(pa) && /"Yamaha":\{"m":2,"pn":/.test(app), 'app sent with its Yamaha part number line + counts made again');
  ok((await get('/api/catup?path=' + encodeURIComponent('catalogues/yamaha/' + OLD) + '&size=10')).status === 200 && (await get('/api/catup?path=' + encodeURIComponent('catalogues/yamaha/' + NEW) + '&size=10')).status === 200,
    "book names with – and ' in them can be uploaded (Sam's Yamaha books)");
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/yamaha');
  ok(mf && mf.pick === 'Downloads > Yamaha Catalogue' && mf.files[0][0] === 'yamaha_build.json' && mf.files.slice(1).every(f => /\.pdf$/i.test(f[0])) && mf.files.length > 400 && new Set(mf.files.map(f => f[0])).size === mf.files.length, 'upload card: yamaha_build.json + the parts books, every file once');
  // 16h: the weekly pymidol sync (brand_sync on this server): its MRP wins, new old/new pairs and kits join, parts only in its list are findable
  const SY = T + '/pf/catalogues/hero-sync'; fs.mkdirSync(SY + '/yamaha', { recursive: true });
  fs.writeFileSync(SY + '/yamaha/state.json', JSON.stringify({ last_run: '2026-11-01',
    mrp: { B0TE11021000: { name: 'CYLINDER HEAD', mrp: 5400 }, BX9F00010000: { name: 'NEW MIRROR', mrp: 450 } },
    sup: [['BX9F00000000', 'BX9F00010000']], kits: { 'NEW KIT 1': { name: 'NEW KIT', parts: [['BX9F00010000', 'MIRROR', 1]] } } }));
  const { buildYamaha } = await import('../lib/yamahabuild.mjs');
  const Y = buildYamaha(D, 'catalogues/yamaha', { sync: SY }), yd = Y.cat, nr = yd.d.find(r => r[5] === 'BX9F00010000');
  ok(yd.mrp['B0T-E1102-10'] === 5400 && nr && yd.mrp.BX9F00010000 === 450 && /Old no\. BX9F00000000/.test(nr[8]) && /In kit: NEW KIT 1/.test(nr[8])
    && yd.vars[nr[11][0]] === 'Other Yamaha (no model name) · Yamaha MRP list (weekly sync)', "sync: pymidol's MRP wins; a part only in its list is findable with old no. and kit");
  ok(!buildYamaha(D).info.sync, 'no sync data: nothing changes');
  // 16i: a model catalogue the sync downloaded and read: a new model code becomes an edition, its diagram is the downloaded PDF's page
  const st = JSON.parse(fs.readFileSync(SY + '/yamaha/state.json', 'utf8')), NB = 'DM4C YZF155D-B (2026-10-25).pdf';
  st.books = { [NB]: { file: NB, size: 9, date: '2026-10-25', title: 'YZF155D-B', codes: ['DM4C'], name: 'YZF155D-B', rows: 1,
    figs: [fig('1', 'CYLINDER HEAD', 4, ['DM4C'], [['1', 'B0T-E1102-10', 'CYLINDER HEAD ASSY', { DM4C: '1' }, ''], ['2', 'BX9-E1199-00', 'NEW GASKET', { DM4C: '1' }, '']])] },
    'XXXX scan (2026-10-25).pdf': { file: 'XXXX scan (2026-10-25).pdf', size: 5, codes: ['XX11'], rows: 0, figs: [] } };
  fs.writeFileSync(SY + '/yamaha/state.json', JSON.stringify(st));
  const Z = buildYamaha(D, 'catalogues/yamaha', { sync: SY }), zd = Z.cat, zg = Z.dg, zv = zd.vars.findIndex(v => v.includes(' · DM4C ')), gk = zd.d.find(r => r[5] === 'BX9-E1199-00');
  ok(zv >= 0 && zd.vars[zv] === 'R15 V4 · DM4C YZF155D-B (2026-10-25)' && gk && gk[11].join() === String(zv) && zd.d.find(r => r[5] === 'B0T-E1102-10' && r[2] === '1')[11].includes(zv)
    && zg.f[zg.p[String(zv)]['1']] === `pdf:catalogues/hero-sync/output/Yamaha/PDF/Models/${NB}:0:9:4:0,0,0.48,1` && Z.info.sync.books === 1 && Z.info.sync.newModels[0] === 'DM4C R15 V4'
    && !zd.vars.some(v => v.includes('XX11')), 'sync: a downloaded new model book is an edition (name from its code family), parts searchable, diagram from the PDF; a scan with no rows is left out');
} catch (e) { ok(false, 'error ' + e.stack); }
finally { srv.kill(); }
if (fails) console.log(log.slice(-3000));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
