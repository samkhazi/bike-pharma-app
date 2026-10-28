// update 12y: TVS made on the server from Sam's Downloads > TVS Catalogues folder: one edition per variant (qty per variant), TVS's
// where-used variants, price-list parts with no model, MRP only, diagrams read out of tvs_diagrams.zip (PNG, by byte range)
// usage: node tools/test_tvsbuild.mjs   (own server on 3031, fresh database, a small made-up TVS folder)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-tvs'; fs.rmSync(T, { recursive: true, force: true });
const D = T + '/pf/catalogues/tvs'; fs.mkdirSync(D, { recursive: true });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000002000000018008060000001f', 'hex');
fs.mkdirSync(T + '/z'); fs.writeFileSync(T + '/z/FIG01.png', PNG);
execFileSync('zip', ['-0', '-q', D + '/tvs_diagrams.zip', 'FIG01.png'], { cwd: T + '/z' });
// 13b: TVS Catalogue2 extras: part photos, a colour picture with its painted parts, a kit with its photo and contents, new/old numbers
fs.writeFileSync(T + '/z/K6020030.png', PNG); execFileSync('zip', ['-0', '-q', D + '/TVS_Part_Photos_01.zip', 'K6020030.png'], { cwd: T + '/z' });
fs.mkdirSync(T + '/z/MOPED/XL100/1', { recursive: true }); fs.writeFileSync(T + '/z/MOPED/XL100/1/RED (1AP).png', PNG);
execFileSync('zip', ['-0', '-q', D + '/TVS_Painted_Parts_MOPED.zip', 'MOPED/XL100/1/RED (1AP).png'], { cwd: T + '/z' });
fs.mkdirSync(T + '/z/photos'); fs.writeFileSync(T + '/z/photos/P320980.png', PNG); execFileSync('zip', ['-0', '-q', D + '/TVS_Kit_Parts.zip', 'photos/P320980.png'], { cwd: T + '/z' });
fs.writeFileSync(D + '/tvs_extra.json', JSON.stringify({ sup: { S1200270: 'S1200280' }, alt: { K6020030: ['K6020031'] }, blocked: ['N81406704D'], parts: [['N9999990', 'NEW PART FROM FULL LIST']], mrp: { P1003501A: 735, K6020030: 1 },
  painted: [['MOPED', 'XL100', '1', 'RED', '1AP', 'TVS_Painted_Parts_MOPED.zip', 'MOPED/XL100/1/RED (1AP).png', [['1', 'P1003501A', 'Fender Front Red', '1']]]],
  kits: [['MOPED', 'XL Super', 'P320980', 'PISTON KIT STD', 'XL/ SUPER', 'photos/P320980.png', [['420950000', 'SPRING RING12X1', '2', '']]]] }));
fs.writeFileSync(D + '/tvs_build.json', JSON.stringify({ src: 'test',
  eds: [{ m: 'Wego 110', v: 'DRUM', kind: 'cat', figs: [['1', 'ENGINE ASSY', 'FIG01', [['1', 'K6020030', 'CRANKSHAFT ASSY WEGO', '1', ''], ['2', 'S1200270', 'TUBULAR DOWEL', '4', 'BSIV']]]] },
    { m: 'Wego 110', v: 'DISC', kind: 'cat', figs: [['1', 'ENGINE ASSY', 'FIG01', [['1', 'K6020030', 'CRANKSHAFT ASSY WEGO', '1', '']]]] },
    { m: 'Jive', v: 'JIVE BASE BASE 2010', kind: 'apps', figs: [['Black + Gold', 'BLACK + GOLD', null, [['', 'N81406704D', 'FUEL TANK COMP BLACK JIVE', '1', '']]]] }],
  mrp: { K6020030: 4675, N81406704D: 6020, G4011180: 175 }, other: [['G4011180', 'SPARK PLUG']], kits: [['G4011180', 'SPARK PLUG']] }));
await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3031', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3031'; let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  for (let i = 0; i < 120 && !/tvs build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/tvs build \(start\) ended 0/.test(log), 'the TVS folder found at start: TVS made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const d = JSON.parse(fs.readFileSync(T + '/data/cat/tvs.json', 'utf8')), g = await (await get('/cat/tvs-dg.json')).json();
  ok(d.models.join() === 'XL100,Wego 110,Jive,Kits (TVS),Other parts (price list)' && d.vars.includes('Jive · JIVE BASE BASE 2010 (where-used list)'), 'models in the app order; where-used variants named so; kits and price list last: ' + d.models.join());
  const by = pn => d.d.filter(r => r[5] === pn);
  ok(by('K6020030').length === 1 && by('K6020030')[0][11].map(i => d.vars[i]).join() === 'Wego 110 · DRUM,Wego 110 · DISC' && by('S1200270')[0][11].map(i => d.vars[i]).join() === 'Wego 110 · DRUM' && by('S1200270')[0][8] === 'New no. S1200280; BSIV', 'one line lists every variant with the part; remarks kept');
  ok(d.mrp.K6020030 === 4675 && !/ndp/i.test(JSON.stringify(d)), 'MRP only');
  ok(by('G4011180').length === 1 && by('G4011180')[0][8] === 'Kit / consumable', 'price-list part with no model kept');
  ok(by('K6020030')[0][8] === 'Alternate no. K6020031' && by('N81406704D')[0][8] === 'Blocked by TVS' && by('N9999990').length === 1, '13b: alternate / blocked noted, parts only in the full list added');
  const pv = d.vars.indexOf('XL100 · RED · painted parts'), pr = by('P1003501A')[0], kv = d.vars.indexOf('Kits (TVS) · XL Super kits');
  ok(pv >= 0 && pr && pr[11].join() === String(pv) && pr[4] === '1' && d.mrp.P1003501A === 735 && d.mrp.K6020030 === 4675, '13b: painted parts per colour, MRP added only where none');
  const pref = g.f[g.p[String(pv)]['Painted parts · RED']], km = by('420950000')[0];
  ok(/TVS_Painted_Parts_MOPED\.zip:\d+:\d+$/.test(pref || '') && kv >= 0 && km && km[8] === 'In kit P320980' && by('P320980')[0][4] === 'Kit', '13b: colour picture as the diagram; kit with its contents');
  const ph = d.phf.K6020030; ok(ph && d.phz[ph[0]] === 'catalogues/tvs/TVS_Part_Photos_01.zip' && ph[3] === 512 && ph[4] === 384 && d.phf.P320980, '13b: each part\'s own photo from the photo zips, with its size');
  const ref = g.f[g.p[String(d.vars.indexOf('Wego 110 · DRUM'))]['1']], m = /^pf:catalogues\/tvs\/tvs_diagrams\.zip:(\d+):(\d+)$/.exec(ref || '');
  ok(m && fs.readFileSync(D + '/tvs_diagrams.zip').subarray(+m[1], +m[1] + +m[2]).equals(PNG), 'diagram = its PNG in the zip, by byte range');
  ok(g.p[String(d.vars.indexOf('Jive · JIVE BASE BASE 2010 (where-used list)'))]['Black + Gold'] == null, 'a colour list has no diagram');
  const hd = await (await get('/cat/tvs.json')).json();
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length, 'cat/tvs.json sends the head only');
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/tvs');
  ok(mf && mf.pick === 'All Catalogues > TVS Catalogue2' && mf.files.length === 13 && mf.files[0][0] === 'tvs_build.json', 'upload card: the old 2 files + the 11 new ones');
  // 15d: the weekly TVS sync's data (brand_sync on this server): dealer MRP list (MRP only), parts added to a diagram, new diagrams, kits
  const SY = T + '/pf/catalogues/hero-sync', ST = SY + '/tvs'; fs.mkdirSync(ST + '/asm', { recursive: true }); fs.mkdirSync(ST + '/img', { recursive: true });
  const crypto = await import('node:crypto'), url = 'https://tvs.example/img/NEW01.png', hf = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.png';
  fs.writeFileSync(ST + '/img/' + hf, PNG);
  fs.writeFileSync(ST + '/state.json', JSON.stringify({ last_run: '2026-11-01',
    mrp: { K6020030: { desc: 'CRANKSHAFT', ndp: 3999, mrp: 4800, eff: '2026-11-01' }, Z9000001: { desc: 'ONLY IN LIST', ndp: 1, mrp: 20, eff: '' } },
    kits: { K9000009: { desc: 'NEW KIT', model: 'WEGO', appl: 'WEGO 110', ndp: 5, mrp: 300, parts: [['Z9000002', 'RING', 2]] } },
    series: { S1: { name: 'WEGO 110', cat: 'SCOOTER', asms: { A1: { name: 'ENGINE ASSY', fig: 'FIG01', img: '' }, A2: { name: 'NEW COVER ASSY', fig: '000040000100000999C09', img: url } } } } }));
  fs.writeFileSync(ST + '/asm/S1_A1.json', JSON.stringify({ rows: [{ sn: '1', pn: 'K6020030', desc: 'CRANKSHAFT ASSY WEGO', qty: '1', remarks: '' }, { sn: '3', pn: 'Z9000003', desc: 'NEW WASHER', qty: '2', remarks: '' }] }));
  fs.writeFileSync(ST + '/asm/S1_A2.json', JSON.stringify({ rows: [{ sn: '1', pn: 'Z9000004', desc: 'COVER', qty: '1', remarks: '' }] }));
  const { buildTvs } = await import('../lib/tvsbuild.mjs');
  const Y = buildTvs(D, 'catalogues/tvs', { sync: SY, syncRel: 'catalogues/hero-sync' }), yd = Y.cat, yg = Y.dg, yb = pn => yd.d.filter(r => r[5] === pn), vn = r => r[11].map(i => yd.vars[i]).join();
  ok(yd.mrp.K6020030 === 4800 && !/3999|ndp/i.test(JSON.stringify(yd)), "sync: the dealer list's MRP wins, its dealer price never in the catalogue");
  ok(vn(yb('Z9000003')[0]) === 'Wego 110 · DRUM,Wego 110 · DISC' && yb('K6020030').length === 1, 'sync: a part TVS added to a diagram joins every variant with that diagram, no doubles');
  const nr = yb('Z9000004')[0], nf = yg.p[String(nr[11][0])][nr[2]];
  ok(vn(nr) === 'Wego 110 · New in e-catalogue (weekly sync)' && yg.f[nf] === 'pf:catalogues/hero-sync/tvs/img/' + hf + ':0:' + PNG.length, "sync: a new diagram with the sync's own picture, under its bike");
  ok(yd.vmod[yd.vars[yb('K9000009')[0][11][0]]] === 'Kits (TVS)' && /In kit K9000009/.test(yb('Z9000002')[0][8]) && yd.mrp.K9000009 === 300, 'sync: a new kit with what is inside');
  ok(yd.vmod[yd.vars[yb('Z9000001')[0][11][0]]] === 'Other parts (price list)' && yd.mrp.Z9000001 === 20, 'sync: a part only in the MRP list is findable');
  ok(!buildTvs(D).info.sync, 'no sync data: nothing changes');
} catch (e) { ok(false, 'error ' + e.stack); }
finally { srv.kill(); }
if (fails) console.log(log.slice(-3000));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
