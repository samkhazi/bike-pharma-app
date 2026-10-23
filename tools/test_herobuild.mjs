// update 11k: Hero made on the server from Sam's Raw Data upload (catalogues/hero-raw): new editions added to the app's Hero list,
// diagrams + part photos read straight out of the zips, the app's Hero part number line made again
// usage: node tools/test_herobuild.mjs   (own server on 3018, fresh database, a small made-up Raw Data set)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-hero'; fs.rmSync(T, { recursive: true, force: true });
const R = T + '/pf/catalogues/hero-raw', W = T + '/w'; fs.mkdirSync(R, { recursive: true }); fs.mkdirSync(W, { recursive: true });
// a JPEG header that says 64 x 32
const jpg = n => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 32, 0, 64, 3]), Buffer.alloc(9), Buffer.from(n), Buffer.from([0xff, 0xd9])]);
fs.writeFileSync(W + '/E-1_SPLENDOR_TST1.jpg', jpg('fig1')); fs.writeFileSync(W + '/E-2_DASH_TST2.jpg', jpg('fig2')); fs.writeFileSync(W + '/99999-TST-001.jpg', jpg('photo'));
execFileSync('zip', ['-0', '-q', '-j', R + '/hero_hidden_diagrams_1.zip', W + '/E-1_SPLENDOR_TST1.jpg']);
for (const n of [2, 3]) execFileSync('zip', ['-0', '-q', '-j', R + '/hero_hidden_diagrams_' + n + '.zip', W + '/E-2_DASH_TST2.jpg']);
execFileSync('zip', ['-0', '-q', '-j', R + '/hero_hidden_diagrams_4.zip', W + '/E-2_DASH_TST2.jpg']);
execFileSync('zip', ['-0', '-q', '-j', R + '/hero_hidden_photos_1.zip', W + '/99999-TST-001.jpg']);
execFileSync('zip', ['-0', '-q', '-j', R + '/hero_hidden_photos_2.zip', W + '/E-2_DASH_TST2.jpg']);
fs.writeFileSync(R + '/Hero_Discontinuation_Parts_List.xlsx', 'x');
const bom = (ref, pn, desc, price, x = {}) => ({ refno: ref, component: pn, partDesc: desc, qty: 1, serviceability: 'Y', price: String(price), priceListCode: 'DP', altPartFlag: 'N', ...x });
fs.writeFileSync(R + '/hero_hidden_models.json', JSON.stringify({
  ACHIEVER_AAMC: { model: 'ACHIEVER_AAMC', modelDesc: 'Achiever (Nov, 2014)', meta: { 'MODEL TYPE': 'DOMESTIC', 'BASE MODEL': 'ACHIEVER' }, modelDetails: { year: 2014, modelCC: '150CC' }, groups: [] },
  SPLENDOR_TST1: { model: 'SPLENDOR_TST1', modelDesc: 'Splendor+ (Sep, 2003)', modelCode: 'TST1', meta: { 'MODEL TYPE': 'DOMESTIC', 'BASE MODEL': 'SPLENDOR+' }, modelDetails: { year: 2003, modelCC: '100CC' },
    groups: [{ groupNo: 'E-1_SPLENDOR_TST1', mapName: 'E-1', groupDesc: 'CYLINDER HEAD COVER', boms: [bom('1', '99999-TST-001', 'COVER TEST', 123), bom('2', '99999-TST-002', 'GASKET TEST', 45, { alternateComponent: '99999-TST-ALT' })] },
      { groupNo: 'E-9_SPLENDOR_TST1', mapName: 'E-9', groupDesc: 'NO PICTURE', boms: [bom('1', '99999-TST-003', 'BOLT TEST', 0, { serviceability: 'N' })] }] },
  DASH_TST2: { model: 'DASH_TST2', modelDesc: 'Dash (July, 2017)', modelCode: 'TST2', meta: { 'MODEL TYPE': 'EXPORT', 'BASE MODEL': 'DASH' }, modelDetails: { year: 2017, modelCC: '110CC' },
    groups: [{ groupNo: 'E-2_DASH_TST2', mapName: 'E-2', groupDesc: 'CRANK', boms: [bom('1', '99999-TST-001', 'COVER TEST', 123)] }] },
}));
fs.writeFileSync(R + '/hero_oldnew_harvest.json', JSON.stringify({ supercedence: [['88888-OLD-001', '99999-TST-001', 'a', 'b', ''], ['99999-TST-003', 'NLS', 'c', '', '']], searchParts: [['77777-TST-009', 'SEARCH ONLY', 66, '', null, 'PART', '77777-TST-009', '']] }));

await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3018', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3018';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  for (let i = 0; i < 120 && !/hero build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/hero build \(start\) ended 0/.test(log), 'Raw Data found at start: Hero made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const pub = JSON.parse(fs.readFileSync('public/cat/hero.json', 'utf8'));
  const d = await (await get('/cat/hero.json')).json(), g = await (await get('/cat/hero-dg.json')).json();
  ok(d.vars.length === pub.vars.length + 3, 'two new editions (+ the search list) added, the one the app already has (Achiever Nov 2014) not twice');
  ok(d.d.some(r => r[5] === '77777-TST-009' && d.vmod[d.vars[r[11][0]]] === 'Other parts (price list)'), 'a search-list number no edition has is under Other parts');
  ok(d.vmod['Splendor+ (Sep, 2003)'] === 'Splendor Plus' && d.vmod['Dash export (July, 2017)'] === 'Dash' && d.models.includes('Dash'), 'editions put under their bike (Splendor Plus; Dash, new, named export)');
  ok(d.models[d.models.length - 1] === pub.models[pub.models.length - 1], "'Other parts' stays last");
  const vi = d.vars.indexOf('Splendor+ (Sep, 2003)'), rows = d.d.filter(r => r[11].includes(vi));
  const r1 = rows.find(r => r[5] === '99999-TST-001'), r2 = rows.find(r => r[5] === '99999-TST-002'), r3 = rows.find(r => r[5] === '99999-TST-003');
  ok(rows.length === 3 && r1[2] === 'E-1' && d.asm[r1[3]] === 'CYLINDER HEAD COVER' && d.desc[r1[6]] === 'COVER TEST', 'part rows with diagram, group and name');
  ok(/Old no\. 88888-OLD-001/.test(r1[8]) && /Alternate no\. 99999-TST-ALT/.test(r2[8]) && /No longer supplied/.test(r3[8]) && /New no\. NLS/.test(r3[8]), 'old, alternate, no longer supplied numbers noted');
  ok(r1[11].length === 1 && d.d.filter(r => r[5] === '99999-TST-001').length === 2, 'same part in another bike and diagram is its own row');
  ok(r1[1] === -1 && r3[1] === -2, 'group without a picture marked no diagram');
  ok(d.mrp['99999-TST-001'] === 123 && d.mrp['77777-TST-009'] === 66 && d.mrp['99999-TST-003'] == null, 'MRP from the raw data and its search list (0 = none)');
  const ref = g.f[g.p[vi]['E-1']], m = /^pf:(.+):(\d+):(\d+)$/.exec(ref);
  ok(m && m[1] === 'catalogues/hero-raw/hero_hidden_diagrams_1.zip', 'diagram points into the uploaded zip: ' + ref);
  const pic = Buffer.from(await (await get(`/api/files/read?path=${encodeURIComponent(m[1])}&offset=${m[2]}&length=${m[3]}`)).arrayBuffer());
  ok(pic.equals(jpg('fig1')), 'diagram bytes read out of the zip are the picture');
  const ph = d.phf['99999-TST-001'];
  ok(ph && d.phz[ph[0]] === 'catalogues/hero-raw/hero_hidden_photos_1.zip' && ph[3] === 64 && ph[4] === 32, 'part photo with its size');
  ok(Object.keys(d.phf).length === Object.keys(pub.phf).length + 1, 'only part numbers of the catalogue get a photo');
  const app = await (await get('/app.html')).text(), pa = fs.readFileSync('public/app.html', 'utf8');
  const hl = s => (/'Hero':\['[^']*','[^']*'\]/.exec(s) || [''])[0];
  ok(app.length > 1000 && hl(app) && hl(app) !== hl(pa) && app.replace(hl(app), '') === pa.replace(hl(pa), ''), 'app sent with only its Hero part number line made again');
  ok(fs.existsSync(T + '/data/cat/hero-build.json'), 'build report saved');
  // a newer Raw Data file: made again at the next start
  fs.utimesSync(R + '/hero_hidden_models.json', new Date(), new Date(Date.now() + 5000));
  // Hero from the Raw Data alone (no Hero file in the app)
  const { writeHero } = await import('../lib/herobuild.mjs');
  fs.mkdirSync(T + '/pub', { recursive: true }); fs.copyFileSync('public/app.html', T + '/pub/app.html');
  const inf = writeHero(T + '/pub', R, T + '/only');
  const o = JSON.parse(fs.readFileSync(T + '/only/hero.json', 'utf8'));
  ok(inf.editions === 3 && o.vars.length === 4 && o.models.join() === 'Achiever 150,Splendor Plus,Dash,Other parts (price list)', 'Raw Data alone: its 3 editions, Other parts last: ' + o.models.join());
} catch (e) { ok(false, 'error ' + e.stack); }
srv.kill(); if (fails) console.log(log.slice(-2000)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
