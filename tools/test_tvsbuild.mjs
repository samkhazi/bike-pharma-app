// update 12y: TVS made on the server from Sam's Downloads > TVS Catalogues folder: one edition per variant (qty per variant), TVS's
// where-used variants, price-list parts with no model, MRP only, diagrams read out of tvs_diagrams.zip (PNG, by byte range)
// usage: node tools/test_tvsbuild.mjs   (own server on 3031, fresh database, a small made-up TVS folder)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-tvs'; fs.rmSync(T, { recursive: true, force: true });
const D = T + '/pf/catalogues/tvs'; fs.mkdirSync(D, { recursive: true });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
fs.mkdirSync(T + '/z'); fs.writeFileSync(T + '/z/FIG01.png', PNG);
execFileSync('zip', ['-0', '-q', D + '/tvs_diagrams.zip', 'FIG01.png'], { cwd: T + '/z' });
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
  ok(d.models.join() === 'Wego 110,Jive,Other parts (price list)' && d.vars[2] === 'Jive · JIVE BASE BASE 2010 (where-used list)', 'models in the app order; where-used variants named so; price list last');
  const by = pn => d.d.filter(r => r[5] === pn);
  ok(by('K6020030').length === 1 && by('K6020030')[0][11].join() === '0,1' && by('S1200270')[0][11].join() === '0' && by('S1200270')[0][8] === 'BSIV', 'one line lists every variant with the part; remarks kept');
  ok(d.mrp.K6020030 === 4675 && !/ndp/i.test(JSON.stringify(d)), 'MRP only');
  ok(by('G4011180').length === 1 && by('G4011180')[0][8] === 'Kit / consumable', 'price-list part with no model kept');
  const ref = g.f[g.p['0']['1']], m = /^pf:catalogues\/tvs\/tvs_diagrams\.zip:(\d+):(\d+)$/.exec(ref || '');
  ok(m && fs.readFileSync(D + '/tvs_diagrams.zip').subarray(+m[1], +m[1] + +m[2]).equals(PNG), 'diagram = its PNG in the zip, by byte range');
  ok(g.p['2']['Black + Gold'] == null, 'a colour list has no diagram');
  const hd = await (await get('/cat/tvs.json')).json();
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length, 'cat/tvs.json sends the head only');
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/tvs');
  ok(mf && mf.pick === 'Downloads > TVS Catalogues' && mf.files.map(f => f[0]).join() === 'tvs_build.json,tvs_diagrams.zip', 'upload card: tvs_build.json + tvs_diagrams.zip');
} catch (e) { ok(false, 'error ' + e.stack); }
finally { srv.kill(); }
if (fails) console.log(log.slice(-3000));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
