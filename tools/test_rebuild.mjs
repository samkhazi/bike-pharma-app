// update 12g: Royal Enfield made on the server from Sam's Downloads > Royal Enfield Catalogue folder: one edition per RE variant named
// as the chassis search names it, diagram = its page in the model PDF, parts merged across variants, MRP, loose part photos
// usage: node tools/test_rebuild.mjs   (own server on 3030, fresh database, a small made-up RE folder)
import { spawn } from 'node:child_process'; import fs from 'node:fs';
import { reModel, reVar, buildRE } from '../lib/rebuild.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-re'; fs.rmSync(T, { recursive: true, force: true });
const D = T + '/pf/catalogues/royal-enfield'; fs.mkdirSync(D, { recursive: true });
const NEW = 'ALL NEW CLASSIC 350 - CHROME RED.pdf', OLD = 'CLASSIC 350 ABS - BSIV.pdf';
fs.writeFileSync(D + '/' + NEW, '%PDF-1.4 test');   // OLD not uploaded yet
fs.writeFileSync(D + '/KAB00044_A.jpg', 'jpgdata');
fs.writeFileSync(D + '/re_build.json', JSON.stringify({
  models: { 'ALL NEW CLASSIC 350 - CHROME RED': { file: NEW, size: 13, lists: [['k1', 'ENGINE — CYLINDER HEAD', 3], ['k2', 'BRAKES — REAR BRAKE', 5], ['k3', 'ENGINE — CYLINDER HEAD', 7]] },
    'CLASSIC 350 ABS - BSIV': { file: OLD, size: 13, lists: [['k4', 'BRAKES — REAR BRAKE', 2]] } },
  vars: [['ALL NEW CLASSIC 350 - CHROME RED', 'DUAL CHANNEL', '1800001', [0, 1, 2]], ['ALL NEW CLASSIC 350 - CHROME RED', 'SINGLE CHANNEL', '1800002', [0]],
    ['CLASSIC 350 ABS - BSIV', 'REAR DISC', '1800286', [0]], ['GONE MODEL', 'X', '1', [0]]],
  pl: { k1: [['1', '888456/A', 'CYLINDER HEAD ASSY', '1']], k2: [['4', 'KAB00044/A', 'REAR BRAKE HOSE', '1']], k3: [['2', '570123', 'GASKET', '2']], k4: [['4', 'KAB00044/A', 'REAR BRAKE HOSE', '1']] },
  mrp: { '888456/A': 4210, 'KAB00044/A': 655 },
  ph: { 'KAB00044/A': ['KAB00044_A.jpg', 7, 288, 192], 'NOTUSED': ['NOTUSED.jpg', 5, 1, 1] }, nocat: [] }));

ok(reModel('ALL NEW CLASSIC 350 - CHROME BRONZE') === 'Classic 350' && reModel('CLASSIC 350 ABS - BSIV') === 'Classic 350 (old)' && reModel('BULLET 350') === 'Bullet 350'
  && reModel('BULLET X 350') === 'Bullet 350 (old)' && reModel('BULLET TRAILS 500') === 'Bullet Trials 500' && reModel('INTERCEPTOR BEAR 650') === 'Bear 650'
  && reModel('HIMALAYAN SCRAM 411') === 'Scram 411' && reModel('THUNDERBIRD X 350') === 'Thunderbird 350X' && reModel('FF.C6') === 'Flying Flea C6', 'EPC model names go to the app models');
await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3030', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3030';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  for (let i = 0; i < 120 && !/royal-enfield build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/royal-enfield build \(start\) ended 0/.test(log), 'the RE folder found at start: Royal Enfield made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const d = JSON.parse(fs.readFileSync(T + '/data/cat/royal-enfield.json', 'utf8')), g = await (await get('/cat/royal-enfield-dg.json')).json();
  const V1 = reVar('ALL NEW CLASSIC 350 - CHROME RED', 'DUAL CHANNEL'), V2 = reVar('ALL NEW CLASSIC 350 - CHROME RED', 'SINGLE CHANNEL'), V3 = reVar('CLASSIC 350 ABS - BSIV', 'REAR DISC');
  ok(d.models.join() === 'Classic 350,Classic 350 (old)' && d.cur === 1 && d.vars.join('|') === [V1, V2, V3].join('|') && d.vmod[V3] === 'Classic 350 (old)', 'one edition per variant, named like the chassis search, under its app model; a variant without its model is left out');
  const by = pn => d.d.filter(r => r[5] === pn), head = by('888456/A');
  ok(head.length === 1 && head[0][11].join() === '0,1' && head[0][2] === 'ENGINE — CYLINDER HEAD' && d.asm[head[0][3]] === 'ENGINE', 'one line lists every variant with the same part');
  const gk = by('570123');
  ok(gk.length === 1 && gk[0][2] === 'ENGINE — CYLINDER HEAD (2)' && gk[0][7] === '2' && gk[0][11].join() === '0', 'a section twice in a model gets (2); qty kept');
  ok(by('KAB00044/A').length === 1 && by('KAB00044/A')[0][11].join() === '0,2' && d.mrp['KAB00044/A'] === 655 && d.mrp['888456/A'] === 4210, 'MRP by part number; same list in two models = one line');
  ok(g.f[g.p['0']['ENGINE — CYLINDER HEAD']] === `pdf:catalogues/royal-enfield/${NEW}:0:13:3:0,0,1,1` && g.f[g.p['2']['BRAKES — REAR BRAKE']].includes(OLD + ':0:13:2:'), 'diagram = its page in the model PDF');
  ok(d.phz[d.phf['KAB00044/A'][0]] === 'catalogues/royal-enfield/KAB00044_A.jpg' && d.phf['KAB00044/A'][2] === 7 && !d.phf.NOTUSED, 'part photo = its own loose jpg');
  const b = JSON.parse(fs.readFileSync(T + '/data/cat/royal-enfield-build.json', 'utf8'));
  ok(b.missing === 1 && b.missingFiles[0] === OLD, 'a model PDF not uploaded yet is counted');
  const hd = await (await get('/cat/royal-enfield.json')).json();
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length, 'cat/royal-enfield.json sends the head only');
  const app = await (await get('/app.html')).text();
  ok(/"Royal Enfield":\{"m":2,"pn":3\}/.test(app), 'app sent with its RE counts made again');
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/royal-enfield');
  ok(mf && mf.pick === 'Downloads > Royal Enfield Catalogue' && mf.files[0][0] === 're_build.json' && mf.files[1][0] === 're_vin_index.json' && mf.files.filter(f => /\.pdf$/.test(f[0])).length === 140
    && mf.files.filter(f => /\.jpg$/.test(f[0])).length > 13000 && new Set(mf.files.map(f => f[0])).size === mf.files.length, 'upload card: re_build.json, chassis index, 140 model PDFs, the part photos, every file once');
  // 16j: the weekly RE EPC sync: a changed list replaces the upload's, a new list, variant and model join (diagram = the EPC's SVG), its MRP wins
  const SY = T + '/pf/catalogues/hero-sync'; fs.mkdirSync(SY + '/royal_enfield/svg', { recursive: true });
  fs.writeFileSync(SY + '/royal_enfield/svg/COL_PARTSLIST_IL9_x.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(SY + '/royal_enfield/state.json', JSON.stringify({ last_run: '2026-11-01', mrp: { '888456/A': { name: 'HEAD', mrp: 4300 }, 'NEW1/A': { name: 'BOLT', mrp: 12 } },
    models: { 'ALL NEW CLASSIC 350 - CHROME RED': { variants: { 'DUAL CHANNEL': [], 'SINGLE CHANNEL': [], 'NEW VARIANT': [] }, tree: [['ENGINE', 'k1', 'CYLINDER HEAD', ''], ['FRAME', 'k9', 'STAND', 'COL_PARTSLIST_IL9_x.svg']] },
      'SCRAM 440 - TRAIL': { variants: { 'BS6 - X1': [] }, tree: [['FRAME', 'k9', 'STAND', 'COL_PARTSLIST_IL9_x.svg']] } },
    pl: { k1: { n: 'CYLINDER HEAD', th: '', rows: [['1', '888456/A', 'CYLINDER HEAD ASSY', '1', 'NOS', '', '', '', ''], ['3', 'NEW2/A', 'NEW STUD', '2', 'NOS', '', '', '', '']] },
      k9: { n: 'STAND', th: 'COL_PARTSLIST_IL9_x.svg', rows: [['1', 'NEW1/A', 'BOLT', '1', 'NOS', '', '', '', '']] } } }));
  const Z = buildRE(D, 'catalogues/royal-enfield', { sync: SY }), zd = Z.cat, zg = Z.dg, zi = v => zd.vars.indexOf(v);
  const st = zd.d.find(r => r[5] === 'NEW2/A'), bolt = zd.d.find(r => r[5] === 'NEW1/A'), NV = reVar('ALL NEW CLASSIC 350 - CHROME RED', 'NEW VARIANT'), SC = reVar('SCRAM 440 - TRAIL', 'BS6 - X1');
  ok(st && /weekly sync/.test(st[8]) && zd.mrp['888456/A'] === 4300 && bolt && zd.mrp['NEW1/A'] === 12 && zi(NV) >= 0 && zi(SC) >= 0 && zd.vmod[SC] === 'Scram 440'
    && bolt[11].includes(zi(SC)) && bolt[11].includes(zi(V1)) && st[11].includes(zi(NV))
    && zg.f[zg.p[String(zi(SC))]['FRAME — STAND']] === 'pf:catalogues/hero-sync/royal_enfield/svg/COL_PARTSLIST_IL9_x.svg:0:41' && Z.info.sync.models.join() === 'SCRAM 440 - TRAIL',
    'sync: changed list, new list, new variant and new model are searchable; diagram = the EPC SVG; MRP from the sync');
  ok(!buildRE(D).info.sync, 'no sync data: nothing changes');
} catch (e) { ok(false, 'error ' + e.stack); }
finally { srv.kill(); }
if (fails) console.log(log.slice(-3000));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
