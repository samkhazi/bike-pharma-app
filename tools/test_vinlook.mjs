// Update 9o (Sam 2026-10-19): Royal Enfield and Honda chassis numbers -> model from the maker's site, through our server (/api/vinlook).
// The makers' sites are stood in by a mock on MOCK_PORT; the server under test must run with
// VIN_RE_URL=http://127.0.0.1:3029/graphql VIN_HONDA_URL=http://127.0.0.1:3029/honda YPEC_URL=http://127.0.0.1:3029 YPEC_DEALER_CODE=D1
// YPEC_USER_ID=testuser YPEC_PASSWORD=x VIN_TVS_URL=http://127.0.0.1:3029/tvs/ (tools/run_tests.sh does).
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
const asked = []; let ypMenu = false;
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
  // update 10n: Bajaj EPC VIN search (form post vin_no; {data:{status,sku_code:[{id,text}],...}})
  if (q.url === '/bajaj/get_manufacturing_details/') { const v = new URLSearchParams(b).get('vin_no'); asked.push('bajaj:' + v); r.setHeader('Content-Type', 'application/json');
    const T = { MD2A11CZ5PCA00001: 'PULSAR NS200 FI ABS BS6 E20', MD2JPJ403PC000001: 'KTM 390 DUKE BS6', MD2JPAXCXMC090925: 'Duke 125 UG (00JP98ZZ)', MD2B64BX7NWB17715: 'Pulsar 125 BSVI Single seat (Disk break) (00DH40ZZ)' }[v];
    return r.end(JSON.stringify({ data: T ? { status: true, sku_code: [{ id: 'SKU1', text: T }], plant: 'CHAKAN', vehicle_off_line_date: '2023-05-10' } : { status: false } })); }
  const j = q.url.startsWith('/ypec/') ? {} : JSON.parse(b || '{}'); r.setHeader('Content-Type', 'application/json');
  if (q.url === '/graphql') { asked.push('re'); const v = RE[j.variables && j.variables.v]; return r.end(JSON.stringify({ data: { searchQueryVindetails: { vin_detail: v || { VIN: null, CategoryName: null, CategoryUrl: null } } } })); }
  // update 9r: dealer YPEC (login, terms page once, menu pages, search)
  if (q.url.startsWith('/ypec/')) { r.setHeader('Content-Type', 'text/html');
    const f = Object.fromEntries(new URLSearchParams(b));
    // like live YPEC (9t): terms page whose I ACCEPT is a link to the menu; search is "illegal access" until the menu page set the product
    if (q.url === '/ypec/control/LoginDealer') { asked.push('ylogin:' + f.ypec_user_id); ypMenu = false; r.setHeader('Set-Cookie', 'JSESSIONID=y1; Path=/'); return r.end(`<html>TERMS OF USE <form method="post"><a href="/ypec/control/common/FrameMainMenu">I&nbsp;&nbsp;&nbsp;ACCEPT</a></form></html>`); }
    if (q.url === '/ypec/control/common/FrameMainMenu') asked.push('yaccept:1');
    if (q.url === '/ypec/control/common/SheetMainMenu?prodCategory=10&langId=02') ypMenu = true;
    if (q.url === '/ypec/control/specification/ListModelSelection') { asked.push('ysearch:' + (q.headers.cookie || '') + ':' + f.frameNo);
      if (!ypMenu) return r.end('<html>Session time-out or illegal access. Please log in again.</html>');
      return r.end(f.frameNo === 'ME11CK01BB2008284' ? `<a href="JavaScript:onPdf( '','1CK1','2011','010','B','YZF-R15\\nR15 V2','BLACK METALLIC X','Y1CK100-2011B0000')">x</a>` : `<td class='MESSAGE'>Corresponding data doesn't exist.</td>`); }
    return r.end('<html>menu</html>'); }
  // update 9s: Hero e-catalogue (guest login, then the search with its token)
  if (q.url === '/hero/getGeneralUserDetails') { asked.push('hlogin'); return r.end(JSON.stringify({ authToken: 'T1', userId: 'General' })); }
  if (q.url === '/hero/fetchBikeSearchDetails') { asked.push('hsearch:' + q.headers['x-auth-token'] + ':' + j.vin);
    return r.end(JSON.stringify(j.vin === 'MBLHAW264RHK01290' ? { vin: j.vin, category: 'BIKE', model: 'PASSION_i3S_AACY', modelDesc: 'Passion-HZ(May,2023)', colour: '2008', colours: [{ id: '2008', name: 'BLACK (NH-1) TYPE 4' }] }
      : { msg: 'Entered VIN is incorrect, kindly check and retry with correct VIN.' })); }
  // update 9w: TVS parts shop (guest token, then the chassis search: a flat list of parts, each with SERIES)
  if (q.url === '/tvs/Setting/tokenGeneration') { asked.push('tlogin'); return r.end(JSON.stringify({ access_token: 'TT' })); }
  if (q.url.startsWith('/tvs/api/Catalouge/GetPartsearch')) { const v = new URL(q.url, 'http://x').searchParams.get('frameNumber'); asked.push('tsearch:' + q.headers.authorization + ':' + v);
    return r.end(JSON.stringify({ data: v === 'MD638AS15J1F04746' ? [1, 2, 3].map(i => ({ PART_ID: 'K' + i, SEGMENT: 'MOTORCYCLE', SERIES: 'APACHE RR 310', MODEL_DESC1: 'APACHE RR 310 BS4', MRP: 100, NDP: 80 }))
      : v === 'MD626AK38P2B02810' ? [1, 2, 3, 4].map(i => ({ PART_ID: 'N' + i, MODEL: i < 3 ? 'TVS NTORQ' : 'NTORQ 125', MODEL_DESC1: 'TVS NTORQ', SEGMENT: 'SCOOTER', SERIES: 'NTORQ Series' })) : [] })); }
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
// Yamaha (update 9r): dealer YPEC login from .env, its terms page sent once, model opens by itself
await vin('ME11CK01BB2008284'); await p.waitForFunction(() => cur().p.v === 'secs', null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(500); st = await p.evaluate(() => cur().p); t = await T();
ok(st.vb === 'Yamaha' && st.vm === 'R15 V2' && /Yamaha site: R15 V2 \(YZF-R15, 2011, BLACK METALLIC X\)/.test(t), 'Yamaha chassis opens R15 V2 by itself ' + st.vm + ' ' + (t.match(/Yamaha site[^\n]*/) || [''])[0]);
ok(asked.includes('ylogin:testuser') && asked.includes('yaccept:1') && asked.some(x => /^ysearch:JSESSIONID=y1:ME11CK01BB2008284$/.test(x)), 'YPEC: logged in with the .env values, terms page sent, search kept the login cookie ' + asked.filter(x => x[0] === 'y').join(' '));
await vin('ME11CK01BB2009999'); t = await T();
ok(/Yamaha’s site has no record of this chassis number/.test(t) && asked.filter(x => x.startsWith('ylogin')).length === 1, 'Yamaha: not found, staff pick; the login is reused');
// Hero (update 9s): the e-catalogue's guest login, model opens by itself
await vin('MBLHAW264RHK01290'); st = await p.evaluate(() => cur().p);
await p.waitForFunction(() => cur().p.v === 'secs', null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(500); t = await T();
ok(st.vb === 'Hero' && st.vm === 'Passion HZ' && /Hero site: Passion-HZ\(May,2023\) \(BLACK \(NH-1\) TYPE 4\)/.test(t) && asked.includes('hlogin') && asked.includes('hsearch:T1:MBLHAW264RHK01290'), 'Hero chassis opens Passion HZ by itself ' + st.vm);
// overnight review 2026-10-23 (Sam "chassis ka search bhi kaam nhi kar raha"): a chassis or bike number typed in Find Part's own search box opens the chassis search
await p.evaluate(() => tab('findpart')); await p.waitForTimeout(300); await p.fill('#vp #fp-q', 'mblhaw264rhk01290'); await p.press('#vp #fp-q', 'Enter'); await p.waitForTimeout(1500); st = await p.evaluate(() => cur().p);
ok(st.vb === 'Hero' && st.vm === 'Passion HZ' && st.vin === 'MBLHAW264RHK01290', 'chassis number typed in the part search box opens the bike by itself ' + JSON.stringify(st));
await p.evaluate(() => tab('findpart')); await p.waitForTimeout(300); await p.fill('#vp #fp-q', 'KA 17 HC 3942'); await p.press('#vp #fp-q', 'Enter'); await p.waitForTimeout(1200); st = await p.evaluate(() => [cur().p.v, (S.ui.vin || {}).q]);
ok(st[0] === 'vin' && st[1] === 'KA17HC3942', 'bike number typed in the part search box goes to the bike number search ' + st);
await p.evaluate(() => tab('findpart')); await p.waitForTimeout(300); await p.fill('#vp #fp-q', '17101KWPD00'); await p.press('#vp #fp-q', 'Enter'); await p.waitForTimeout(1200);
ok(await p.evaluate(() => cur().p.v === 'res'), 'a part number stays a part search');
await vin('MBLHAW264RHK09999'); t = await T();
ok(/Hero’s site has no record of this chassis number/.test(t), 'Hero: not on Hero’s site, staff pick');
// server with Hero off (server outside India): Hero goes the old way, nothing else asked
await p.route('**/api/vinlook*', rt => rt.fulfill({ contentType: 'application/json', body: '{"none":true}' }));
const n0 = asked.length; const AL = 'ABCDEFGHJKLMNPRSTUVWXYZ'; await vin('MBL' + Array.from({ length: 6 }, () => AL[Math.floor(Math.random() * AL.length)]).join('') + 'KC000011');
ok(asked.length === n0 && /Which Hero model/.test(await T()) && /model code/i.test(await T()), 'Hero off on the server: asks the model once per code, as before');
await p.unroute('**/api/vinlook*');
// the API is staff only
const anon = await (await fetch(BASE + '/api/vinlook?c=ME3K5A6FGT1002169')).status;
ok(anon === 401, 'not logged in: no chassis lookup (' + anon + ')');
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
await vin('MD638AS15J1F04746'); st = await p.evaluate(() => cur().p);
ok(st.vb === 'TVS' && st.vm === 'Apache RR 310' && asked.includes('tlogin') && asked.includes('tsearch:Bearer TT:MD638AS15J1F04746'), 'TVS chassis opens Apache RR 310 by itself ' + st.vm);
await vin('MD626AK38P2B02810'); st = await p.evaluate(() => cur().p);
ok(st.vb === 'TVS' && st.vm === 'Ntorq 125', 'Sam’s TVS chassis: site says MODEL NTORQ 125 / SERIES NTORQ Series, opens Ntorq 125 ' + st.vm);
// update 10n: Bajaj chassis -> model from Bajaj's EPC; KTM made by Bajaj on MD2 opens KTM
await vin('MD2A11CZ5PCA00001'); st = await p.evaluate(() => cur().p);
ok(st.vb === 'Bajaj' && st.vm === 'Pulsar NS200' && asked.includes('bajaj:MD2A11CZ5PCA00001'), 'Bajaj chassis opens Pulsar NS200 by itself ' + st.vb + ' ' + st.vm);
await vin('MD2JPJ403PC000001'); st = await p.evaluate(() => cur().p);
ok(st.vb === 'KTM' && st.vm === '390 Duke', 'Bajaj site says KTM 390 DUKE: opens KTM 390 Duke ' + st.vb + ' ' + st.vm);
await vin('MD2JPAXCXMC090925'); st = await p.evaluate(() => cur().p);
ok(st.vb === 'KTM' && st.vm === '125 Duke', 'Sam’s chassis: Bajaj site says "Duke 125 UG", opens KTM 125 Duke ' + st.vb + ' ' + st.vm);
await vin('MD2B64BX7NWB17715'); st = await p.evaluate(() => cur().p);
ok(st.vb === 'Bajaj' && st.vm === 'Pulsar 125' && /BS ?(VI|6)/.test(st.ed || '') && !/BS ?(IV|4)/.test(st.ed || ''), 'Sam’s chassis: Pulsar 125 BSVI Single seat, opens Bajaj Pulsar 125 BS6 book (not 2020 BS4) ' + st.vb + ' ' + st.vm + ' | ' + st.ed);
await vin('MD2A11CZ9PCA00009'); t = await T();
ok(/Bajaj’s site has no record of this chassis number/.test(t) && /Which brand is this/.test(t), 'Bajaj: not on Bajaj’s site, staff pick brand + model');
await b.close(); mock.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
