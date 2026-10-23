// update 11z: Honda made on the server from Sam's whole Downloads > Honda Catalogue folder (catalogues/honda): every model code an
// edition, diagrams read straight out of the .bin files (one per assembly), ref numbers from the model PDFs, compatible models
// (one line for all the models with the part), old numbers, colours, accessories and service kits; Hero and Honda lines both in the app
// usage: node tools/test_hondabuild.mjs   (own server on 3026, fresh database, a small made-up Honda folder)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import zlib from 'node:zlib';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-honda'; fs.rmSync(T, { recursive: true, force: true });
const H = T + '/pf/catalogues/honda'; fs.mkdirSync(H, { recursive: true });
const webp = n => Buffer.concat([Buffer.from('RIFF'), Buffer.from([20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.from(n)]);
const bin = (f, ims) => { const h = Buffer.from(JSON.stringify(ims.map(([k, b]) => [k, b.length]))); fs.writeFileSync(H + '/' + f, Buffer.concat([Buffer.from(String(h.length).padStart(10, '0')), h, ...ims.map(x => x[1])])); };
const { HONDA_BINS } = await import('../lib/hondabuild.mjs');
bin(HONDA_BINS[0], [['8_65', webp('cylhead-activa')], ['9_70', webp('crankcase')]]);
for (const f of HONDA_BINS.slice(1, -1)) bin(f, []);
bin('honda_hq_fix3.bin', [['SCV110T_CRANK_9_70', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9])]]);
const F = ['CATEGORY', 'VEHICLE', 'MODEL', 'MODELID', 'AGGREGATE', 'ASSEMBLYNAME', 'ASSEMBLYID', 'GROUPNO', 'REFNO', 'PARTNO', 'DESCRIPTION', 'QTY', 'PRICE1', 'PRICE2', 'NS', 'STARTDATE', 'PARTID', 'ASSPARTID'];
const row = (veh, code, mid, asm, aid, fig, pn, desc, qty, mrp, ns = 'S') => ['Scooters', veh, code, mid, 'ENGINE', asm, aid, fig, '', pn, desc, qty, mrp, 0, ns, '0', 1, 1];
const rows = [
  row('Activa', 'SCV110P/SR', 8, 'CYLINDER HEAD', 65, 'E-3', '12200-K0P-D00', 'HEAD COMP., CYLINDER', 1, 4500),
  row('Activa', 'SCV110P/SR', 8, 'CYLINDER HEAD', 65, 'E-3', '90001-GGZ-000', 'BOLT, FLANGE', 2, 12),
  row('Activa', 'SCV110P/SR', 8, 'CYLINDER HEAD', 65, 'E-3', '90001-GGZ-000', 'BOLT, FLANGE', 2, 12),
  row('Activa', 'SCV110P/SR', 8, 'GASKET KIT', 66, 'E-3', '06111-K0P-D00', 'GASKET KIT A', 1, 166),
  row('Activa', 'SCV110T', 9, 'CYLINDER HEAD', 65, 'E-3', '12200-K0P-D00', 'HEAD COMP., CYLINDER', 1, 4500),
  row('Activa', 'SCV110T', 9, 'CRANKCASE', 70, 'E-10', '11100-K0P-D00', 'CRANKCASE SET', 1, 0.01, 'NS'),
  row('Activa', 'SCV110T', 9, 'NO PICTURE', 99, 'E-20', '99999-K0P-000', 'TEST PART', 1, 10),
  row('Activa125', 'SCV125T', 10, 'CYLINDER HEAD', 65, 'E-3', '12200-K0P-D00', 'HEAD COMP., CYLINDER', 1, 4500),
  row('HNESS', 'CB350DSS', 11, 'CYLINDER HEAD', 65, 'E-3', '90001-GGZ-000', 'BOLT, FLANGE', 2, 12),
];
fs.writeFileSync(H + '/honda_search_all.json.gz', zlib.gzipSync(JSON.stringify({ fields: F, rows })));
fs.writeFileSync(H + '/honda_extras.json', JSON.stringify({ v: 2,
  xl: { '12200-K0P-D00': ['12200-K0N-D00', '', 0, 'Engine Parts'], '90001-GGZ-000': ['', 'BLACK', 0, 'Engine Parts'] },
  acc: [['Accessories', '08P70-K0P-D00', 'GUARD, LEG', 950, 'ACTIVA; DIO'], ['Consumable', 'CAP ACTIVA 3G', '', 0, '']],
  kit: {}, gasket: [['SCV110P/SR', 'GASKET KIT A', [['12251-K0P-D00', 'GASKET, CYLINDER HEAD', 1, 113]]]],
  svc: [['01210-K0L-D00', 'KIT, PISTON CYLINDER', 2854, 'ACTIVA 125', '12191-KWK-900 · GASKET, CYLINDER · 1']],
  site: [['06430-KRF-B80', 'SHOE SET, BRAKE', 2083, ''], ['12200-K0P-D00', 'SAME AS A MODEL', 1, '']],
  other: [['00P10-KNP-700', 'KIT NUMBER PLATE', 118, 'Not serviceable (NS)'], ['ATTACHMENT 24 X 26 MM', '', 0, '']],
  refs: { 'SCV110P-SR': { 'E-3': [['1', '12200-K0P-D00'], ['4', '90001-GGZ-000'], ['5', '90001-GGZ-000'], ['9', '06111-K0P-D00']] } } }));

await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3026', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3026';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  for (let i = 0; i < 120 && !/honda build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/honda build \(start\) ended 0/.test(log), 'the Honda folder found at start: Honda made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const d = JSON.parse(fs.readFileSync(T + '/data/cat/honda.json', 'utf8')), g = await (await get('/cat/honda-dg.json')).json();
  const cfg = await (await get('/api/me')).json().catch(() => ({}));
  ok(!cfg.cfg || (cfg.cfg.cat || []).includes('honda.json') && !(cfg.cfg.cat || []).some(f => /-(app|build)\.json$/.test(f)), 'honda.json in the app\'s catalogue list (not the build files)');
  ok(d.models.slice(0, 2).join() === 'Activa,Activa 125' && d.models.includes("H'ness CB350"), "Honda's names: Activa125 is Activa 125, HNESS is H'ness CB350");
  ok(d.vars[0] === 'Activa · 2026 · SCV110T' && d.vars[1] === 'Activa · 2023-2024 · SCV110P/SR', 'editions newest first, year from the code letter');
  const V = n => d.vars.findIndex(v => v.endsWith(' · ' + n)), byPn = pn => d.d.filter(r => r[5] === pn);
  const head = byPn('12200-K0P-D00').filter(r => r[0] === 0);
  ok(head.length === 2 && head.some(r => r[11].join() === [V('SCV110T'), V('SCV125T')].sort((a, b) => a - b).join()), 'compatible: one line lists every model with the same part (Activa 2026 + Activa 125)');
  ok(head.some(r => r[4] === '1' && r[11].includes(V('SCV110P/SR'))) && /Old no\. 12200-K0N-D00/.test(head[0][8]), 'ref no. from the model PDF; old no. from the Excel');
  const bolts = byPn('90001-GGZ-000').filter(r => r[11].includes(V('SCV110P/SR'))).map(r => r[4]).sort();
  ok(bolts.join() === '4,5' && /Colour: BLACK/.test(byPn('90001-GGZ-000')[0][8]), 'the same part twice in one diagram gets both its ref numbers; colour noted');
  const kit = byPn('06111-K0P-D00')[0];
  ok(kit[2] === 'E-3 (2)' && /Kit has: 12251-K0P-D00 GASKET, CYLINDER HEAD/.test(kit[8]), 'a second assembly under one fig no. is E-3 (2); the gasket kit says what is inside');
  const cr = byPn('11100-K0P-D00')[0];
  ok(cr[9] === 1 && d.mrp['11100-K0P-D00'] == null && d.mrp['12200-K0P-D00'] === 4500, 'N.S. marked; MRP from the raw data (0.01 = none)');
  ok(byPn('99999-K0P-000')[0][1] === -2 && byPn('12200-K0P-D00')[0][1] === -1, 'an assembly with no picture: no diagram');
  const pg = g.p[String(V('SCV110P/SR'))], pt = g.p[String(V('SCV110T'))];
  ok(g.f[pg['E-3']] === g.f[pt['E-3']] && /honda_hq_0000_0840\.bin:/.test(g.f[pg['E-3']]) && /honda_hq_fix3\.bin:/.test(g.f[pt['E-10']]), 'diagram by assembly, shared across models; the fix3 file wins for its model');
  ok(g.dir === 'catalogues/honda' && g.files.length === 9 && g.pick === 'Downloads > Honda Catalogue', 'diagram file names the folder to pick');
  const m = /^pf:(.+):(\d+):(\d+)$/.exec(g.f[pg['E-3']]);
  const pic = Buffer.from(await (await get(`/api/files/read?path=${encodeURIComponent(m[1])}&offset=${m[2]}&length=${m[3]}`)).arrayBuffer());
  ok(pic.equals(webp('cylhead-activa')), 'the diagram read out of the .bin is the WebP picture');
  const xv = n => d.vmod[d.vars[byPn(n)[0][11][0]]];
  ok(xv('08P70-K0P-D00') === 'Accessories & merchandise' && /Fits: ACTIVA, DIO/.test(byPn('08P70-K0P-D00')[0][8]) && d.mrp['08P70-K0P-D00'] === 950, 'accessories from the Excel, with what they fit and MRP');
  ok(xv('01210-K0L-D00') === 'Service kits' && /Kit has: 12191-KWK-900/.test(byPn('01210-K0L-D00')[0][8]), 'service kits with what is inside');
  ok(xv('06430-KRF-B80') === 'Other parts (site search)' && byPn('00P10-KNP-700')[0][9] === 1 && byPn('12200-K0P-D00').length === 2, 'site-only parts added once (a model part not twice), N.S. marked');
  ok(!d.d.some(r => / .* .* /.test(r[5]) || r[5] === 'CAP ACTIVA 3G'), 'a name in the part number column is no part');
  const hd = await (await get('/cat/honda.json')).json();
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length, 'cat/honda.json sends the head only (fast, like Hero)');
  const sp = await fetch(BASE + '/api/cat/rows', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ b: 'honda', m: ['Activa'] }) }).then(r => r.json());
  ok(sp.g.length === d.d.filter(r => r[11].some(k => d.vmod[d.vars[k]] === 'Activa')).length && sp.mrp['12200-K0P-D00'] === 4500, "a bike's Honda lines come with their MRPs");
  const app = await (await get('/app.html')).text(), pa = fs.readFileSync('public/app.html', 'utf8');
  const hl = s => (/'Honda':\['[^']*','[^']*'\]/.exec(s) || [''])[0], ml = s => (/Object\.assign\(BRANDS_V,\{[\s\S]*?("Honda":\[[^\]]*\])/.exec(s) || [])[1];
  ok(hl(app) && hl(app) !== hl(pa) && ml(app).startsWith('"Honda":["Activa","Activa 125"') && !ml(app).includes('Service kits') && /"Honda":\{"m":3,"pn":/.test(app), 'app sent with its Honda part number line + model list made again (no kits or accessories as bikes)');
  ok((await get('/api/catup?path=' + encodeURIComponent('catalogues/honda/honda_hq_0000_0840.bin') + '&size=10')).status === 200 && (await get('/api/catup?path=' + encodeURIComponent('catalogues/honda/honda_search_all.json.gz') + '&size=10')).status === 200, '.bin and .gz files can be uploaded');
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/honda');
  ok(mf && mf.pick === 'Downloads > Honda Catalogue' && ['honda_search_all.json.gz', 'honda_extras.json', ...HONDA_BINS].every(n => mf.files.some(f => f[0] === n)) && new Set(mf.files.map(f => f[0])).size === mf.files.length, 'upload card: the whole Honda Catalogue folder, every file once');
  // Hero and Honda both made here: the app gets both brands' lines
  const { patchApp, writeApp } = await import('../lib/herobuild.mjs');
  fs.mkdirSync(T + '/two', { recursive: true }); fs.copyFileSync(T + '/data/cat/honda-app.json', T + '/two/honda-app.json');
  fs.writeFileSync(T + '/two/hero-app.json', JSON.stringify({ brand: 'Hero', pnr: ['d5:1:99', 'AAAA'], models: ['Splendor Plus'], cnt: { m: 1, pn: 1 } }));
  ok(writeApp('public', T + '/two') === 2, 'both brand files used');
  const two = fs.readFileSync(T + '/two/app.html', 'utf8');
  ok(two.includes("'Hero':['d5:1:99','AAAA']") && hl(two) === hl(app) && patchApp(pa, ['x', 'y'], null, null, 'Nobrand') === null, "Hero's and Honda's lines both in the app; an unknown brand changes nothing");
} catch (e) { ok(false, 'error ' + e.stack); }
finally { srv.kill(); }
if (fails) console.log(log.slice(-3000));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
