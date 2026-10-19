// Update 9o (Sam 2026-10-19): Royal Enfield and Honda chassis numbers -> model from the maker's site, through our server (/api/vinlook).
// The makers' sites are stood in by a mock on MOCK_PORT; the server under test must run with
// VIN_RE_URL=http://127.0.0.1:3029/graphql VIN_HONDA_URL=http://127.0.0.1:3029/honda (tools/run_tests.sh does).
import http from 'node:http';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { _honda } from '../lib/vinlook.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const RE = { ME3K5A6FGT1002169: { VIN: 'ME3K5A6FGT1002169', CategoryName: 'BS6 - VQJG60AB', CategoryUrl: 'himalayan-450-6153/bs6-vqjg60ab-10339.html?vin=ME3K5A6FGT1002169&searchResultName=HIMALAYAN 450 (BS6 - VQJG60AB)' },
  ME3U3S5C1KC000011: { VIN: 'ME3U3S5C1KC000011', CategoryName: 'BS4', CategoryUrl: 'classic-350/bs4.html?searchResultName=CLASSIC 350 (BS4)' },
  ME3U3S5F2LK959792: { VIN: 'ME3U3S5F2LK959792', CategoryName: 'VBQN60GM', CategoryUrl: 'classic-350/x.html?searchResultName=CLASSIC 350 ABS - BSVI (VBQN60GM)' },
  ME3J3S5C1MC000011: { VIN: 'ME3J3S5C1MC000011', CategoryName: 'BS6', CategoryUrl: 'classic-350/y.html?searchResultName=CLASSIC 350 (BS6)' },
  ME3J3S5C1PC000011: { VIN: 'ME3J3S5C1PC000011', CategoryName: 'BS6', CategoryUrl: 'classic-350/z.html?searchResultName=CLASSIC 350 (BS6)' } };
const HONDA = { ME4KC311AK8485736: { VEHICLE: 'CB Unicorn', MODEL: 'CBF150MH', CHASSISNO: 'ME4KC311AK8485736', SBOMCODE: 'CBF150MH', STARTDATE: '/Date(1548873000000)/' } };
const asked = [];
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
  const j = JSON.parse(b || '{}'); r.setHeader('Content-Type', 'application/json');
  if (q.url === '/graphql') { asked.push('re'); const v = RE[j.variables && j.variables.v]; return r.end(JSON.stringify({ data: { searchQueryVindetails: { vin_detail: v || { VIN: null, CategoryName: null, CategoryUrl: null } } } })); }
  if (q.url === '/honda') { asked.push('honda'); const v = _honda.hDec(j.strVIN); return r.end(JSON.stringify({ d: _honda.hEnc(JSON.stringify({ tbl_chassismaster: HONDA[v] ? [HONDA[v]] : [] })) })); }
  r.statusCode = 404; r.end('{}'); }); });
await new Promise(ok2 => mock.listen(3029, '127.0.0.1', ok2));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(400);
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
const T = () => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
const vin = async c => { await p.evaluate(() => { S.ui.vin = null; go('findpart', { v: 'vin' }); }); await p.waitForTimeout(200); await p.fill('#vin-q', c); await p.press('#vin-q', 'Enter'); await p.waitForTimeout(1200); };
// RE: the site's model opens by itself
await vin('ME3K5A6FGT1002169');
let st = await p.evaluate(() => cur().p); let t = await T();
ok(st.v === 'year' && st.vb === 'Royal Enfield' && st.vm === 'Himalayan 450', 'RE chassis opens Himalayan 450 by itself ' + JSON.stringify({ v: st.v, vm: st.vm }));
await p.waitForFunction(() => cur().p.v === 'secs', null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(500);
ok(/Royal Enfield site: HIMALAYAN 450 \(BS6 - VQJG60AB\)/.test(await T()), 'the bike card shows what RE’s site said');
// update 9p: two books of that name (Classic 350 and Classic 350 (old)): the site's text or the chassis year picks the book by itself
await vin('ME3U3S5F2LK959792'); st = await p.evaluate(() => cur().p);
ok(['year', 'secs'].includes(st.v) && st.vm === 'Classic 350 (old)', 'Sam’s chassis: site says CLASSIC 350 ABS - BSVI, opens Classic 350 (old) by itself ' + st.vm);
await vin('ME3U3S5C1KC000011'); st = await p.evaluate(() => cur().p);
ok(st.vm === 'Classic 350 (old)' && !(await p.evaluate(() => (DB.vinMap || {})['ME3U3S5C'])), '2019 Classic 350 opens the old book, nothing saved for the code ' + st.vm);
await vin('ME3J3S5C1PC000011'); st = await p.evaluate(() => cur().p);
ok(st.vm === 'Classic 350', '2023 Classic 350 opens the new book ' + st.vm);
// 2021: either book fits, staff pick one of the two with the RC hint
await vin('ME3J3S5C1MC000011'); t = await T();
const chips = await p.evaluate(() => [...document.querySelectorAll('#vp .screen:last-child button.chip')].map(x => x.innerText.trim()));
ok(/Royal Enfield site: CLASSIC 350 \(BS6\)/.test(t) && /manufacturing month on the RC card/.test(t) && chips.includes('Classic 350') && chips.includes('Classic 350 (old)') && !chips.includes('Hunter 350'), '2021: only the two Classic 350 books to pick, with the RC hint: ' + chips.join(', '));
await p.click('#vp .screen:last-child button.chip:has-text("Classic 350 (old)")'); await p.waitForTimeout(500);
ok(await p.evaluate(() => cur().p.vm === 'Classic 350 (old)' && !(DB.vinMap || {})['ME3J3S5C']), 'the pick opens that model and is not saved for the code');
// RE: not on the site (Sam's test number)
await vin('ME343S5C1KC927703'); t = await T();
ok(/Royal Enfield’s site has no record of this chassis number/.test(t) && /Which Royal Enfield model/.test(t), 'RE: not on RE’s site, staff pick the model');
// Honda
await vin('ME4KC311AK8485736'); st = await p.evaluate(() => cur().p); t = await T();
ok(st.vb === 'Honda' && st.vm === 'CB Unicorn' && /Honda site: CB Unicorn \(CBF150MH\)/.test(t), 'Honda chassis opens CB Unicorn by itself ' + st.vm);
// other makers: no site asked, the old way
const n0 = asked.length; const AL = 'ABCDEFGHJKLMNPRSTUVWXYZ'; await vin('MBL' + Array.from({ length: 6 }, () => AL[Math.floor(Math.random() * AL.length)]).join('') + 'KC000011');
ok(asked.length === n0 && /Which Hero model/.test(await T()), 'Hero: no site asked, asks the model as before');
// the API is staff only
const anon = await (await fetch(BASE + '/api/vinlook?c=ME3K5A6FGT1002169')).status;
ok(anon === 401, 'not logged in: no chassis lookup (' + anon + ')');
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
await b.close(); mock.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
