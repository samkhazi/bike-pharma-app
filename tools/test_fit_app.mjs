// 21t: Find Part > Spares / Tyre / Battery. Needs a server on 3033 (admin sam@bikepharma.com / Test@1234).
// Writes made-up catalogues to a temp folder, builds fit.json with lib/xrefbuild.mjs and puts it in DATA_DIR:
//   node tools/test_fit_app.mjs <DATA_DIR> [screenshot dir]
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { sizeOf, isTyre, isBatt, battOf } from '../lib/fitbuild.mjs'; import { tyreSize } from '../lib/fit.mjs';
const [DATA, SHOT] = process.argv.slice(2); let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(a === b, m + ' (' + a + ')');
eq(sizeOf('TYRE REAR 110X90-18 ZAPPER Q'), '110/90-18', 'size 110X90-18'); eq(sizeOf('TYRE TUBELESS 18 300 REAR'), '3.00-18', 'TVS rim first'); eq(sizeOf('TIRE COMP 130/70 R17 TL'), '130/70 R17', 'radial');
eq(sizeOf('TYRE FR 2.75-18 42P'), '2.75-18', 'inch size'); ok(!isTyre('TUBE, TYRE 2.75-18') && !isTyre('TYRE SPEED SENSOR') && isTyre('TYRE,TUBELESS 100/80-17'), 'tube and sensor are not tyres');
ok(isBatt('BATTERY ASSY 12V 5AH MF') && !isBatt('BAND, BATTERY') && !isBatt('COVER BATTERY') && !isBatt('BATTERY PACK 3.94 KWH'), 'battery, not its band, cover or EV pack');
eq(battOf('BATTERY ASSY 12V 5AH MF'), '12 V 5 Ah', 'battery spec'); eq(battOf('BATTERY (12V-4AH)'), '12 V 4 Ah', 'battery spec with dash'); eq(tyreSize('90/90 12'), '90/90-12', 'typed size'); eq(tyreSize('abc'), '', 'bad typed size');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-')), cat = path.join(tmp, 'cat'); fs.mkdirSync(cat);
const mk = (brand, models, rows, mrp) => { const vars = [], vmod = {}, desc = [], asm = [], d = []; const ix = (a, v) => { let i = a.indexOf(v); if (i < 0) { a.push(v); i = a.length - 1; } return i; };
  for (const [pn, name, sec, rem, vs] of rows) d.push([0, -1, '1', ix(asm, sec), '1', pn, ix(desc, name), '1', rem, 0, 0, vs.map(v => { const i = ix(vars, v); vmod[v] = v.split(' · ')[0]; return i; })]);
  fs.writeFileSync(path.join(cat, brand.toLowerCase() + '.json'), JSON.stringify({ brand, models, vars, vmod, asm, desc, d, mrp })); };
mk('Hero', ['Splendor Plus', 'Xtreme 160R', 'Glamour Xtec'], [
  ['42711-KCC-901S', 'TYRE, REAR (3.00-18 52P)', 'REAR WHEEL', '', ['Splendor Plus · Drum']], ['44711-KCC-901S', 'TYRE FR 2.75-18 42P', 'FRONT WHEEL', '', ['Splendor Plus · Drum']],
  ['44711-KCC-777', 'TYRE FRONT 80/100-18 TL MRF', 'FRONT WHEEL', '', ['Splendor Plus · Alloy']], ['44712-KCC-900S', 'TUBE, TYRE 2.75-18', 'FRONT WHEEL', '', ['Splendor Plus · Drum']],
  ['31500-KCC-000', 'BATTERY ASSY 12V 3AH MF (EXIDE)', 'BATTERY', '', ['Splendor Plus · Drum', 'Splendor Plus · Alloy']], ['50325-KCC-000', 'BAND, BATTERY', 'BATTERY', '', ['Splendor Plus · Drum']],
  ['44711-AAZ-000', 'TYRE,TUBELESS 100/80-17 MRF', 'FRONT WHEEL', '', ['Xtreme 160R · Single disc']], ['42711-AAZ-000', 'TIRE COMP 130/70 R17 TL', 'REAR WHEEL', '', ['Xtreme 160R · Single disc']],
  ['44711-AAN-B03', 'TYRE FRONT', 'FRONT WHEEL', '', ['Glamour Xtec · Drum']], ['31500-AAN-000', 'BATTERY', 'BATTERY', '', ['Glamour Xtec · Drum']]],
  { '42711-KCC-901S': 1520, '44711-KCC-901S': 1450, '44711-KCC-777': 1780, '31500-KCC-000': 1150, '44711-AAN-B03': 1610 });
mk('Honda', ['Shine 100'], [['44711-K0L-D01', 'TIRE, FR. (2.75-18) (CEAT)', 'FRONT WHEEL', '', ['Shine 100 · STD']], ['31500-K0L-D01', 'BATTERY (12V-3AH)', 'BATTERY', '', ['Shine 100 · STD']]], { '44711-K0L-D01': 1390, '31500-K0L-D01': 1210 });
execFileSync(process.execPath, ['lib/xrefbuild.mjs', cat, path.join(tmp, 'none.json'), path.join(tmp, 'none2.json')], { stdio: 'ignore' });
const fit = JSON.parse(fs.readFileSync(path.join(tmp, 'fit.json'), 'utf8')); fs.copyFileSync(path.join(tmp, 'fit.json'), path.join(DATA, 'fit.json'));
ok(fit.tyre.Hero['Splendor Plus'].F.join() === '2.75-18,80/100-18' && fit.tyre.Hero['Splendor Plus'].R.join() === '3.00-18', 'build: Splendor front and rear sizes');
ok(fit.tsz['2.75-18'].length === 2 && fit.batt.Hero['Splendor Plus'].S[0] === '12 V 3 Ah' && fit.bsz['12 V 3 Ah'].length === 2, 'build: tyres and batteries by size across brands');
fs.mkdirSync(path.join(DATA, 'fit-lists'), { recursive: true }); const LISTF = path.join(DATA, 'fit-lists', 'testy.json'); try { fs.rmSync(LISTF); } catch {}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOT ? 2 : 1 })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
await p.evaluate(async () => { for (const k of ['t', 'b']) await api('POST', '/api/fit', { k, vb: 'Hero', vm: 'Glamour Xtec', del: 1 }); reset('findpart'); }); await p.waitForTimeout(600);
const txt = () => p.evaluate(() => document.querySelector('.scroll').innerText.replace(/\s+/g, ' '));
let t = await txt(); ok(/Spares/i.test(t) && /Tyre/i.test(t) && /Battery/i.test(t) && /Type a part name or number/i.test(t), 'Find Part opens on Spares with the three buttons');
await p.evaluate(() => fitMode('t')); await p.waitForTimeout(900); t = await txt(); ok(/Which bike is the tyre for/i.test(t) && /Bike brand/i.test(t) && /Tyre brand/i.test(t) && /3 of 4 bikes/i.test(t), 'Tyre: brand, model, tyre brand pickers');
if (SHOT) await p.screenshot({ path: path.join(SHOT, 'fit1.png') });
await p.evaluate(() => fitGo()); await p.waitForTimeout(300); ok((await p.evaluate(() => cur().p.v || 'home')) === 'home', 'Show tyres without a bike stays');
await p.selectOption('select[aria-label="Bike brand"]', 'Hero'); await p.waitForTimeout(300); await p.selectOption('select[aria-label="Model"]', 'Splendor Plus'); await p.waitForTimeout(300);
await p.evaluate(() => fitGo()); await p.waitForTimeout(1000); t = await txt(); console.log(t.slice(0, 400));
ok(/FRONT 2\.75-18 or 80\/100-18/i.test(t) && /REAR 3\.00-18/i.test(t) && /44711-KCC-901S/.test(t) && /44711-K0L-D01 · Honda catalogue/i.test(t) && /₹1,450/.test(t), 'Splendor: sizes, and the tyres of both brands in the front size with MRP');
if (SHOT) await p.screenshot({ path: path.join(SHOT, 'fit2.png') });
await p.evaluate(() => { fitSt().mk = 'CEAT'; refresh(); }); await p.waitForTimeout(400); t = await txt(); ok(/44711-K0L-D01/.test(t) && !/44711-KCC-901S ·/.test(t), 'tyre brand chip filters');
await p.evaluate(() => { fitSt().mk = 'All'; fitSt().side = 'R'; refresh(); }); await p.waitForTimeout(400); t = await txt(); ok(/Rear · 3\.00-18/i.test(t) && /42711-KCC-901S/.test(t), 'Rear chip shows the rear size');
await p.evaluate(() => fitMode('b')); await p.waitForTimeout(1000); t = await txt(); ok(/Battery of this bike/i.test(t) && /VOLT 12 V/i.test(t) && /CAPACITY 3 Ah/i.test(t) && /31500-K0L-D01/.test(t) && /Maintenance free/i.test(t), 'Battery of the same bike: volt, Ah, batteries of both brands');
if (SHOT) await p.screenshot({ path: path.join(SHOT, 'fit4.png') });
await p.evaluate(() => { S.ui.fpm = 't'; go('findpart', { v: 'fit', k: 't', vb: 'Hero', vm: 'Glamour Xtec' }); }); await p.waitForTimeout(1000); t = await txt();
ok(/Size not found/i.test(t) && /does not say the size/i.test(t) && /44711-AAN-B03/.test(t) && /Add the size/i.test(t), 'Glamour Xtec: size not found, Admin can add');
if (SHOT) await p.screenshot({ path: path.join(SHOT, 'fit3.png') });
await p.evaluate(() => fitAdd('t')); await p.waitForTimeout(300); await p.fill('#fit-f', 'abc'); await p.evaluate(() => fitSave('t')); await p.waitForTimeout(500);
ok(await p.evaluate(() => !document.getElementById('fit-err').hidden), 'a wrong size is refused');
await p.evaluate(() => { fitSt().side = 'F'; }); await p.fill('#fit-f', '80/100 18'); await p.fill('#fit-r', '2.75-18'); await p.evaluate(() => fitSave('t')); await p.waitForTimeout(1200); t = await txt();
ok(/FRONT 80\/100-18/i.test(t) && /typed by/i.test(t) && /44711-KCC-777/.test(t), 'typed size is saved and the tyres of that size show');
await p.evaluate(() => { fitSt().side = 'R'; refresh(); }); await p.waitForTimeout(400); t = await txt(); ok(!/44711-K0L-D01/.test(t) && /No part in this size/i.test(t), 'rear list leaves out front-only tyres');
await p.evaluate(() => go('findpart', { v: 'fitsz', k: 't', q: '2.75 18' })); await p.waitForTimeout(1000); t = await txt();
ok(/2\.75-18/.test(t) && /Hero Splendor Plus/i.test(t) && /Honda Shine 100/i.test(t) && /Hero Glamour Xtec/i.test(t), 'size search: tyres and the bikes that use it (typed one too)');
const r = await p.evaluate(async () => { const x = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null); const y = await fetch('/api/fit?k=t', { credentials: 'same-origin' }); return y.status; });
ok(r === 401 || r === 403, 'logged out: the list is refused (' + r + ')');
ok(!errs.length, 'no page errors ' + errs.join(' | ').slice(0, 200));
// a tyre maker's list comes in: only that maker shows (Sam: only the brands whose catalogue he has)
fs.writeFileSync(LISTF, JSON.stringify({ brand: 'Testy', kind: 't', rows: [['900001', '2.75-18 TESTY GRIP F TL 42P', '2.75-18', 'TL', 'F', 0], ['900002', '3.00-18 TESTY GRIP TT 52P', '3.00-18', 'TT', '', 0]] }));
await p.evaluate(async () => { await api('GET', '/api/me').catch(() => 0); }); 
await p.goto('http://127.0.0.1:3033/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
await p.evaluate(() => { S.ui.fpm = 't'; reset('findpart'); }); await p.waitForTimeout(900);
const opts = await p.evaluate(() => [...document.querySelector('select[aria-label="Tyre brand"]').options].map(o => o.textContent).join('|')); ok(opts === 'All tyre brands|Testy', 'with a maker list in, Tyre brand lists only that maker (' + opts + ')');
await p.evaluate(() => { fitSt().side = 'F'; go('findpart', { v: 'fit', k: 't', vb: 'Hero', vm: 'Splendor Plus' }); }); await p.waitForTimeout(1000); t = await txt();
ok(/2\.75-18 TESTY GRIP F TL 42P/i.test(t) && /900001 · Testy list · Tubeless/i.test(t) && !/MRP not listed/i.test(t) && !/44711-K0L-D01/.test(t), 'the size lists the maker list only, with no price line, not other bike makers\' parts');
ok(/own tyre part · Hero catalogue/i.test(t) && /44711-KCC-901S/.test(t) && /₹1,450/.test(t), 'the bike\'s own tyre part stays in its own card with MRP');
if (SHOT) await p.screenshot({ path: path.join(SHOT, 'fit5.png'), fullPage: false });
await p.evaluate(() => { fitSt().side = 'R'; refresh(); }); await p.waitForTimeout(400); t = await txt(); ok(/900002/.test(t) && !/900001/.test(t) && /42711-KCC-901S/.test(t), 'rear: the maker\'s rear tyre and the bike\'s own rear part');
// 21z (Sam 13 Nov "number daalke tyre number find karne ke option ko nikal de"): no bike number box on the Tyre / Battery page
await p.evaluate(() => { S.ui.fpm = 't'; reset('findpart'); }); await p.waitForTimeout(900); t = await txt(); ok(!/Have the bike number/i.test(t) && await p.evaluate(() => !document.getElementById('fit-reg')), 'Tyre page has no bike number box');
await p.evaluate(() => { S.ui.fpm = 's'; reset('findpart'); }); await p.waitForTimeout(600); ok(await p.evaluate(() => !!document.getElementById('fp-reg')), 'Spares keeps its bike number box');
fs.rmSync(LISTF); await b.close(); console.log(fails ? fails + ' FAILED' : 'all pass'); process.exit(fails ? 1 : 0);
