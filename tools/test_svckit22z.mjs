// 22z: a chain kit ask on a Honda bike shows Honda's own kit for that bike first (from the "Service kits" list: the note names the bike,
// or a sprocket inside the kit is one of the bike's own), never another bike's kit.   node tools/test_svckit22z.mjs  (own server on 3027, made-up Honda folder)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import zlib from 'node:zlib';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-svckit'; fs.rmSync(T, { recursive: true, force: true });
const H = T + '/pf/catalogues/honda'; fs.mkdirSync(H, { recursive: true });
const bin = (f, ims) => { const h = Buffer.from(JSON.stringify(ims.map(([k, b]) => [k, b.length]))); fs.writeFileSync(H + '/' + f, Buffer.concat([Buffer.from(String(h.length).padStart(10, '0')), h, ...ims.map(x => x[1])])); };
const { HONDA_BINS } = await import('../lib/hondabuild.mjs'); for (const f of HONDA_BINS) bin(f, []);
const F = ['CATEGORY', 'VEHICLE', 'MODEL', 'MODELID', 'AGGREGATE', 'ASSEMBLYNAME', 'ASSEMBLYID', 'GROUPNO', 'REFNO', 'PARTNO', 'DESCRIPTION', 'QTY', 'PRICE1', 'PRICE2', 'NS', 'STARTDATE', 'PARTID', 'ASSPARTID'];
const row = (veh, code, mid, asm, aid, fig, pn, desc, qty, mrp) => ['Motorcycles', veh, code, mid, 'FRAME', asm, aid, fig, '', pn, desc, qty, mrp, 0, 'S', '0', 1, 1];
const rows = [
  row('Livo', 'CB110MT', 8, 'SWINGARM', 65, 'F-20', '40530-K55-951', 'CHAIN, DRIVE(DAIDO) (DID420ADV-118LE)', 1, 560),
  row('Livo', 'CB110MT', 8, 'TRANSMISSION', 66, 'E-12', '23801-KWB-600', 'SPROCKET, DRIVE(14T)', 1, 127),
  row('Livo', 'CB110MT', 8, 'REAR WHEEL', 67, 'F-15', '41201-K1C-601', 'SPROCKET, FINAL DRIVEN(42T) (IFB)', 1, 316),
  row('Livo', 'CB110MT', 8, 'CAM CHAIN/TENSIONER', 68, 'E-5', '14321-KYY-900', 'SPROCKET, CAM(32T)', 1, 75),
  row('Livo', 'CB110MT', 8, 'PISTON', 69, 'E-7', '13101-K1C-000', 'PISTON', 1, 800),
  row('Livo', 'CB110MT', 8, 'PISTON', 69, 'E-7', '13011-K1C-000', 'RING SET, PISTON', 1, 600),
  row('Livo', 'CB110MT', 8, 'CYLINDER', 70, 'E-6', '06111-K1C-000', 'GASKET KIT A', 1, 166),
  row('CBF Stunner', 'CBF125M', 9, 'REAR WHEEL', 67, 'F-15', '41200-KWF-950', 'SPROCKET COMP., FINAL DRIVEN (42T)', 1, 900),
  row('CBF Stunner', 'CBF125M', 9, 'TRANSMISSION', 66, 'E-12', '23801-KWF-940', 'SPROCKET, DRIVE(16T)', 1, 300),
  row('Unicorn', 'CB160', 10, 'REAR WHEEL', 67, 'F-15', '41201-KSP-900', 'SPROCKET, FINAL DRIVEN(40T)', 1, 500),
];
fs.writeFileSync(H + '/honda_search_all.json.gz', zlib.gzipSync(JSON.stringify({ fields: F, rows })));
fs.writeFileSync(H + '/honda_extras.json', JSON.stringify({ v: 2, xl: {}, acc: [], kit: {}, gasket: [], site: [], other: [], refs: {},
  svc: [['06406-KWF-P01', 'CHAIN KIT,DRIVE(428-16&42T)', 4267, 'CBF STUNNER', '23801-KWF-940 · SPROCKET, DRIVE(16T) · 1 41200-KWF-950 · SPROCKET COMP., FINAL DRIVEN (42T) · 1'],
    ['06406-K1C-T01', 'CHAIN KIT,DRIVE(420-14&42T)', 1650, 'DREAM YUGA', '23801-KWB-600 · SPROCKET, DRIVE(14T) · 1 41201-K1C-601 · SPROCKET, FINAL DRIVEN(42T) · 1'],
    ['06406-K1C-T02', 'CHAIN KIT,DRIVE(420-14&41T)', 1500, 'LIVO BS6, CD 110', '23801-AAA-000 · SPROCKET, DRIVE(14T) · 1'],
    ['06406-KSP-T03', 'CHAIN KIT,DRIVE(428-15&40T)', 1900, 'UNICORN', '41201-KSP-900 · SPROCKET, FINAL DRIVEN(40T) · 1'],
    ['06141-K1C-T04', 'CAM CHAIN KIT', 700, 'LIVO', '14321-KYY-900 · SPROCKET, CAM(32T) · 1'],
    ['01210-K1C-T06', 'KIT, PISTON CYLINDER', 2854, 'ACTIVA 125', '13101-K1C-000 · PISTON · 1 13011-K1C-000 · RING SET, PISTON · 1 12191-ZZZ-900 · GASKET, CYLINDER · 1'],
    ['01210-KSP-T07', 'KIT, PISTON CYLINDER', 3100, 'UNICORN', '13101-KSP-000 · PISTON · 1'],
    ['01210-K1C-T08', 'PISTON KIT (0.25)', 990, 'LIVO', ''],
    ['02380-K14-910', 'KIT, CHAIN SPROCKET- DREAM YUGA (HET)', 822, '', '40530-K14-900 · CHAIN, DRIVE · 1 23801-KWB-600 · SPROCKET, DRIVE(14T) · 1 41201-K14-900 · SPROCKET, FINAL DRIVEN(41T) · 1'],
    ['06406-K1D-T05', 'CHAIN KIT,DRIVE(428-14&44T)', 1700, 'LIVON X', '']] }));
await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3027', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
let b;
try {
  for (let i = 0; i < 120 && !/honda build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/honda build \(start\) ended 0/.test(log), 'made-up Honda catalogue built');
  b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:3027/app.html'); await p.waitForSelector('#bpOpen', { state: 'detached', timeout: 9000 }).catch(() => {});
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1'); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.waitForTimeout(500);
  const run = async (q, vm) => { await p.evaluate(([q, vm]) => { reset('findpart'); go('findpart', { v: 'res', q, vb: 'Honda', vm, yr: 'Any', bs: 'Any', sort: 'best', n: 30 }); }, [q, vm]); await p.waitForTimeout(5000);
    return p.evaluate(() => { const t = document.querySelector('#vp .screen:last-child'); return { pns: (t.innerText.match(/\b\d{5}-[A-Z0-9]{3}-[A-Z0-9]{3,4}\b/g) || []), txt: t.innerText.replace(/\s+/g, ' ').slice(0, 500), split: !!(CAT_ALL.find(e => e.vb === 'Honda') || {}).split }; }); };
  let r = await run('Kit chain sprocket', 'Livo'); console.log(JSON.stringify(r));
  ok(r.pns[0] === '06406-K1C-T01', 'Livo: the kit whose sprockets are the Livo\'s own comes first (its note names another bike): ' + r.pns[0]);
  ok(!r.pns.includes('02380-K14-910'), 'Livo: the Dream Yuga kit that shares only the front sprocket is not shown');
  ok(r.pns.includes('06406-K1C-T02'), 'Livo: the kit whose note says "LIVO BS6" is there too');
  ok(!r.pns.includes('06406-KWF-P01') && !r.pns.includes('06406-KSP-T03') && !r.pns.includes('06406-K1D-T05'), 'Livo: the Stunner, Unicorn and "LIVON X" kits are not shown');
  ok(!r.pns.includes('06141-K1C-T04') && !r.pns.includes('14321-KYY-900'), 'Livo: no cam chain kit, no cam sprocket');
  ok(['40530-K55-951', '23801-KWB-600', '41201-K1C-601'].every(x => r.pns.includes(x)) && /kit for this bike is first/.test(r.txt), 'Livo: the chain and sprockets follow, and the note says so');
  r = await run('chain ki sprocket', 'CBF Stunner'); console.log(JSON.stringify(r.pns));
  ok(r.pns[0] === '06406-KWF-P01' && !r.pns.includes('06406-K1C-T01'), 'CBF Stunner: its own kit first, not the Livo\'s');
  r = await run('chain sprocket kit', 'Unicorn'); ok(r.pns[0] === '06406-KSP-T03', 'Unicorn: its own kit first: ' + r.pns[0]);
  r = await run('brake shoe', 'Livo'); ok(!r.pns.some(x => /^06406/.test(x)), 'another search on the Livo shows no chain kit');
  r = await run('piston kit', 'Livo'); console.log(JSON.stringify(r.pns));
  ok(r.pns.includes('01210-K1C-T06') && r.pns.includes('01210-K1C-T08') && !r.pns.includes('01210-KSP-T07'), 'piston kit on the Livo: its two kits (2 of 3 inside parts are the Livo\'s; note says LIVO), not the Unicorn\'s');
  r = await run('gasket kit', 'Livo'); ok(r.pns.includes('06111-K1C-000') && !r.pns.some(x => /^01210|^06406/.test(x)), 'gasket kit on the Livo: its own catalogue kit, no other kit: ' + r.pns);
  r = await run('piston', 'Livo'); ok(!r.pns.some(x => /^01210/.test(x)), 'piston (no "kit") on the Livo: as before');
  ok(!errs.length, 'no page errors ' + errs.join(';'));
} finally { if (b) await b.close(); srv.kill(); }
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
