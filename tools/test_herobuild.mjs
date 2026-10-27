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
// 12l: Hero's discontinued parts list (sheet 1: parts, sheet 2: the bikes each fits); 99999-TST-002 is in a list already
{ const c = (col, v) => `<c r="${col}1" t="inlineStr"><is><t>${v}</t></is></c>`, row = vs => '<row>' + vs.map((v, i) => c('ABCDEFGHI'[i], v)).join('') + '</row>';
  const sh = rows => `<?xml version="1.0"?><worksheet><sheetData>${rows.map(row).join('')}</sheetData></worksheet>`;
  fs.mkdirSync(W + '/x/xl/worksheets', { recursive: true });
  fs.writeFileSync(W + '/x/xl/worksheets/sheet1.xml', sh([['S NO.', 'PART NO', 'PART DESCRIPTION', 'OE', 'SAP PART NO', 'EOL', 'DISCONTINUATION DATE', 'LAST APPLICABLE MODEL', 'NIP'],
    ['1', '17910-TST-940', 'CABLE COMP., THROTTLE', '17910-TST-9400', '17910TST940S', '-2884', '30-11-2018', 'CD_DELUXE_MMC', '30-11-2008'],
    ['2', '99999-TST-002', 'GASKET TEST', '-', '99999TST002S', '1', '01-01-2020', 'X', '']]));
  fs.writeFileSync(W + '/x/xl/worksheets/sheet2.xml', sh([['S NO.', 'PART NO', 'PART DESCRIPTION', 'MODELS', 'MODEL DESCRIPTION'], ['1', '17910-TST-940', 'CABLE', 'CD_DELUXE_KSTK', 'HF Deluxe (formerly CD Deluxe - Mar, 2010)'],
    ['2', '17910-TST-940', 'CABLE', 'CD_DAWN', 'CD Dawn (2006)']]));
  execFileSync('zip', ['-q', '-r', R + '/Hero_Discontinuation_Parts_List.xlsx', 'xl'], { cwd: W + '/x' }); }
const bom = (ref, pn, desc, price, x = {}) => ({ refno: ref, component: pn, partDesc: desc, qty: 1, serviceability: 'Y', price: String(price), priceListCode: 'DP', altPartFlag: 'N', ...x });
fs.writeFileSync(R + '/hero_hidden_models.json', JSON.stringify({
  ACHIEVER_AAMC: { model: 'ACHIEVER_AAMC', modelDesc: 'Achiever (Nov, 2014)', meta: { 'MODEL TYPE': 'DOMESTIC', 'BASE MODEL': 'ACHIEVER' }, modelDetails: { year: 2014, modelCC: '150CC' }, groups: [] },
  SPLENDOR_TST1: { model: 'SPLENDOR_TST1', modelDesc: 'Splendor+ (Sep, 2003)', modelCode: 'TST1', meta: { 'MODEL TYPE': 'DOMESTIC', 'BASE MODEL': 'SPLENDOR+' }, modelDetails: { year: 2003, modelCC: '100CC' },
    groups: [{ groupNo: 'E-1_SPLENDOR_TST1', mapName: 'E-1', groupDesc: 'CYLINDER HEAD COVER', boms: [bom('1', '99999-TST-001', 'COVER TEST', 123), bom('2', '99999-TST-002', 'GASKET TEST', 45, { alternateComponent: '99999-TST-ALT' })] },
      { groupNo: 'E-9_SPLENDOR_TST1', mapName: 'E-9', groupDesc: 'NO PICTURE', boms: [bom('1', '99999-TST-003', 'BOLT TEST', 0, { serviceability: 'N' })] }] },
  DASH_TST2: { model: 'DASH_TST2', modelDesc: 'Dash (July, 2017)', modelCode: 'TST2', meta: { 'MODEL TYPE': 'EXPORT', 'BASE MODEL': 'DASH' }, modelDetails: { year: 2017, modelCC: '110CC' },
    groups: [{ groupNo: 'E-2_DASH_TST2', mapName: 'E-2', groupDesc: 'CRANK', boms: [bom('1', '99999-TST-001', 'COVER TEST', 123)] }] },
}));
fs.writeFileSync(R + '/hero_oldnew_harvest.json', JSON.stringify({ supercedence: [['88888-OLD-001', '99999-TST-001', 'a', 'b', ''], ['17910TST940S', '17910-TST-A00', 'c', 'd', ''], ['99999-TST-003', 'NLS', 'c', '', '']], searchParts: [['77777-TST-009', 'SEARCH ONLY', 66, '', null, 'PART', '77777-TST-009', '']] }));

await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3018', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', CAT_ROWS_DAY_PCT: '30' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3018';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  for (let i = 0; i < 120 && !/hero build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/hero build \(start\) ended 0/.test(log), 'Raw Data found at start: Hero made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const PUB = process.env.PUBLIC_DIR || 'public', pub = JSON.parse(fs.readFileSync(PUB + '/cat/hero.json', 'utf8'));
  const d = JSON.parse(fs.readFileSync(T + '/data/cat/hero.json', 'utf8')), g = await (await get('/cat/hero-dg.json')).json();
  // 11v: phones get the head only, the part lines from /api/cat/rows
  const hd = await (await get('/cat/hero.json')).json(), post = b => fetch(BASE + '/api/cat/rows', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ b: 'hero', ...b }) }).then(r => r.json());
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length && !Object.keys(hd.mrp).length && !Object.keys(hd.phf).length && hd.vars.length === d.vars.length, 'cat/hero.json sends the head only: no part lines, MRPs or photos');
  ok(hd.mst['Splendor Plus'] && hd.mst['Splendor Plus'][0] === d.d.filter(r => r[11].some(k => d.vmod[d.vars[k]] === 'Splendor Plus')).length, "the head counts each bike's lines");
  const sp = await post({ m: ['Splendor Plus'] });
  ok(sp.g.length === hd.mst['Splendor Plus'][0] && sp.d.every((r, i) => JSON.stringify(r) === JSON.stringify(d.d[sp.g[i]])) && sp.mrp['99999-TST-001'] === 123 && sp.phf['99999-TST-001'], "a bike's lines come with their MRPs and photos");
  const pn = await post({ pn: '99999TST001' });
  ok(pn.g.length === d.d.filter(r => r[5] === '99999-TST-001').length + d.d.filter(r => /99999TST001/.test(String(r[8]).toUpperCase().replace(/[^A-Z0-9]/g, '')) && r[5] !== '99999-TST-001').length, 'a part number: every line with it');
  ok(d.vars.length === pub.vars.length + 4, 'two new editions (+ the search list + discontinued list) added, the one the app already has (Achiever Nov 2014) not twice');
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
  const app = await (await get('/app.html')).text(), pa = fs.readFileSync(PUB + '/app.html', 'utf8');
  const hl = s => (/'Hero':\['[^']*','[^']*'\]/.exec(s) || [''])[0];
  ok(app.length > 1000 && hl(app) && hl(app) !== hl(pa), 'app sent with its Hero part number line made again');
  // 11o: the Find Part model lists + tile count follow the made list (Sam: Harley not in Hero's model list); nothing else changed
  const bl = s => [(/Object\.assign\(BRANDS_V,\{[\s\S]*?("Hero":\[[^\]]*\])/.exec(s) || [])[1], (/const BRANDS_V=\{[\s\S]*?(\bHero:\[[^\]]*\])/.exec(s) || [])[1], (/"Hero":\{"m":\d+,"pn":\d+\}/.exec(s) || [])[0]];
  const [a1, a2, a3] = bl(app), [p1, p2, p3] = bl(pa);
  ok(a1.startsWith('"Hero":["Splendor Plus"') && a1.includes('"Dash"') && a2.includes("'Dash'") && a3 === '"Hero":{"m":' + d.models.filter(m => m !== 'Other parts (price list)').length + ',"pn":' + new Set(d.d.map(r => r[5])).size + '}', 'Find Part model list has the new bikes (app order first): ' + a3);
  ok([[hl(app), hl(pa)], [a1, p1], [a2, p2], [a3, p3]].reduce((s, [x, y]) => s.replace(x, y), app) === pa, 'nothing else in the app changed');
  ok(fs.existsSync(T + '/data/cat/hero-build.json'), 'build report saved');
  ok((await get('/api/catup?path=' + encodeURIComponent('catalogues/hero-pdf/VIDA VX2 Go 2.2 RQ - Plus\u00a04.4 RQ (AUG.,2026) [VIDA_EBAJ].pdf') + '&size=10')).status === 200, 'PDF > Models names ([code], no-break space) can be uploaded');
  // a newer Raw Data file: made again at the next start
  fs.utimesSync(R + '/hero_hidden_models.json', new Date(), new Date(Date.now() + 5000));
  // Hero from the Raw Data alone (no Hero file in the app)
  const { writeHero } = await import('../lib/herobuild.mjs');
  fs.mkdirSync(T + '/pub', { recursive: true }); fs.copyFileSync(PUB + '/app.html', T + '/pub/app.html');
  const inf = writeHero(T + '/pub', R, T + '/only');
  const o = JSON.parse(fs.readFileSync(T + '/only/hero.json', 'utf8'));
  ok(inf.editions === 3 && o.vars.length === 5 && o.models.join() === 'Achiever 150,Splendor Plus,Dash,Other parts (price list)', 'Raw Data alone: its 3 editions, Other parts last: ' + o.models.join());
  // update 11m: with the PDF > Models index: each PDF an edition (its Raw Data model when the code matches), PDF-only editions get the
  // PDF's own rows, a group with no Raw Data picture shows its PDF page
  fs.mkdirSync(T + '/pdf', { recursive: true });
  fs.writeFileSync(T + '/pdf/hero_pdf_index.json', JSON.stringify({ eds: [
    { file: 'Splendor+ (Sep, 2003) [SPLENDOR_TST1].pdf', size: 100, title: 'Splendor+ (Sep, 2003)', code: 'SPLENDOR_TST1', export: false, year: 2003, cc: '100CC', folder: 'Splendor', figs: [['E-1', 'CYLINDER HEAD COVER', 3, [0, 0, 1, 0.5]], ['E-9', 'NO PICTURE', 4, [0, 0, 1, 1]]] },
    { file: 'Glamour (Jan, 2020) [GLAM_NEW].pdf', size: 200, title: 'Glamour (Jan, 2020)', code: 'GLAM_NEW', export: false, year: 2020, cc: '125CC', folder: 'Glamour', figs: [['F-2', 'KEY SET', 5, [0, 0, 1, 1], [['1', '35010-ACL-D0099', 'KEY SET', '1', '1,055', 'Chalu Purana: 35010ACLD00'], ['2', '35100-ACL-D0099', 'SWITCH', '1', '520', 'Not serviceable']]]] }] }));
  const ip = writeHero(T + '/pub', R, T + '/withpdf', T + '/pdf');
  const p = JSON.parse(fs.readFileSync(T + '/withpdf/hero.json', 'utf8')), pg = JSON.parse(fs.readFileSync(T + '/withpdf/hero-dg.json', 'utf8'));
  ok(ip.editions === 4 && p.models.join() === 'Glamour,Achiever 150,Splendor Plus,Dash,Other parts (price list)', 'PDF index: its 2 editions + the Raw Data ones no PDF has: ' + p.models.join());
  const gv = p.vars.indexOf('Glamour (Jan, 2020)'), gr = p.d.filter(r => r[11].includes(gv));
  ok(gr.length === 2 && gr[0][5] === '35010-ACL-D0099' && p.mrp['35010-ACL-D0099'] === 1055 && /Old no\. 35010ACLD00/.test(gr[0][8]) && /No longer supplied/.test(gr[1][8]), 'PDF-only edition: rows, MRP, old number, not serviceable from the PDF');
  const sv = p.vars.indexOf('Splendor+ (Sep, 2003)');
  ok(/^pf:catalogues\/hero-raw\//.test(pg.f[pg.p[sv]['E-1']]) && pg.f[pg.p[sv]['E-9']] === 'pdf:catalogues/hero-pdf/Splendor+ (Sep, 2003) [SPLENDOR_TST1].pdf:0:100:4:0,0,1,1', 'Raw Data picture first, else the PDF page');
  ok(pg.f[pg.p[gv]['F-2']] === 'pdf:catalogues/hero-pdf/Glamour (Jan, 2020) [GLAM_NEW].pdf:0:200:5:0,0,1,1', 'PDF-only edition diagram = its PDF page');
  // 11v: one login pulling bike after bike (more than CAT_ROWS_DAY_PCT=30 % of the lines today) is stopped, like a copy
  let st = 0, n = 0; for (const m of Object.keys(hd.mst)) { const r = await fetch(BASE + '/api/cat/rows', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ b: 'hero', m: [m] }) }); st = r.status; await r.arrayBuffer(); n++; if (st !== 200) break; }
  ok(st === 429 && n > 1 && (await get('/cat/royal-enfield.json')).status === 429, 'a login that pulls a third of the Hero lines is stopped for the day (' + n + ' bikes)');
  ok((await fetch(BASE + '/api/cat/rows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"b":"hero","m":["Dash"]}' })).status === 401, 'no login: no lines');
  const dc = d.d.filter(r => r[5] === '17910-TST-940'), dv = d.vars.indexOf('Hero discontinued parts (Raw Data)');
  ok(dc.length === 1 && dc[0][11].join() === String(dv) && d.vmod['Hero discontinued parts (Raw Data)'] === 'Other parts (price list)' && /Discontinued 30-11-2018; Hero no\. 17910TST940S; New no\. 17910-TST-A00; Last model CD_DELUXE_MMC; Fits HF Deluxe \(formerly CD Deluxe - Mar, 2010\), CD Dawn \(2006\)/.test(dc[0][8]),
    "Hero's discontinued parts list read: 17910-TST-940 comes in with its date, Hero no., new no., last model and bikes");
  const app0 = fs.readFileSync((process.env.PUBLIC_DIR || 'public') + '/app.html', 'utf8');
  ok(/const catNewNo=/.test(app0) && (app0.match(/\$\{catNewNo\((r|x)\.rem\)\}/g) || []).length === 3, 'the part card shows New part no. under a replaced part');
  ok(!d.d.some(r => r[11].includes(dv) && r[5] === '99999-TST-002'), 'a discontinued number some list already has is not added twice');
  const pl = await (await get('/api/pnlook?q=17910TST940S')).json();
  ok(pl.hits && pl.hits.some(h => h.part === '17910-TST-940'), 'searching 17910TST940S finds it');
  // 12m (Sam 2026-10-25 "koi bhi part miss nhi hona he", "har part aur har part ka diagram aur photo"): the A-Z + old/new lists (Excel),
  // Sam's own parts list, the upload package photos and the old Hero Honda books
  { const R2 = T + '/raw2', X = T + '/xl'; fs.cpSync(R, R2, { recursive: true }); fs.mkdirSync(X, { recursive: true });
    const c = (col, v) => `<c r="${col}1" t="inlineStr"><is><t>${v}</t></is></c>`, row = vs => '<row>' + vs.map((v, i) => c('ABCDEFGHIJKLMNOP'[i], v)).join('') + '</row>';
    const xlsx = (f, sheets) => { const D = W + '/x' + Math.random().toString(36).slice(2); fs.mkdirSync(D + '/xl/worksheets', { recursive: true });
      sheets.forEach((rs, i) => rs && fs.writeFileSync(D + `/xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0"?><worksheet><sheetData>${rs.map(row).join('')}</sheetData></worksheet>`));
      execFileSync('zip', ['-q', '-r', f, 'xl'], { cwd: D }); };
    xlsx(X + '/Hero_All_Parts_A-Z.xlsx', [[['Part No', 'Part Name', 'MRP (Rs)', 'Status', 'MOQ', 'Type', 'Naya Part No', 'Naya MRP', 'Purane Numbers', 'Alternate', 'Fits (models)'],
        ['55555-TST-100', 'LEVER TEST', '250', 'Public e-catalogue me nahi', '', '', '', '', '55555TST099', '', 'Xtreme Sports (Feb, 2015), Duet (Sep, 2015)'],
        ['99999-TST-003', 'BOLT TEST', '75', 'Chalu (Regular)', '', '', '', '', '', '', ''],
        ['99999-TST-002', 'GASKET TEST', '', 'Purana number, naya number dekho', '', '', '99999-TST-NEW', '', '', '', '']],
      null, [['Kit No', 'Kit Name', 'MRP (Rs)'], ['20K999S', 'KIT TEST', '945']], [['Family', 'Model', 'Model name (code)'], ['CD Deluxe', 'CD Deluxe (Nov, 2006)', 'CD_DELUXE_MMC']]]);
    xlsx(R2 + '/HERO PARTS ;IST.xlsx', [[['Part #', 'SKU'], ['*44444TST200S*', '*44444TST200S*'], ['44444TST201S', 'CABLE TEST-44444TST201S']]]);
    fs.writeFileSync(W + '/44444-TST-201.jpg', jpg('photo2')); fs.mkdirSync(W + '/HERO_Upload_Package/images/parts', { recursive: true }); fs.mkdirSync(W + '/HERO_Upload_Package/images/group', { recursive: true });
    fs.copyFileSync(W + '/44444-TST-201.jpg', W + '/HERO_Upload_Package/images/parts/44444-TST-201.jpg'); fs.copyFileSync(W + '/E-1_SPLENDOR_TST1.jpg', W + '/HERO_Upload_Package/images/group/55555-TST-100.jpg');
    execFileSync('zip', ['-0', '-q', '-r', R2 + '/HERO_Upload_Package_IMAGES_part1.zip', 'HERO_Upload_Package'], { cwd: W });
    fs.writeFileSync(R2 + '/old-book.pdf', Buffer.alloc(300));
    fs.writeFileSync(R2 + '/hero_old_books.json', JSON.stringify({ books: [{ file: 'old-book.pdf', size: 300, title: 'CD Dawn (Nov, 2006)', pages: [[24, 'F-3', 'HANDLE LEVER', [['1', '17910-TST-940', 'CABLE COMP., THROTTLE', '1'], ['2', '33333-TST-300', 'GRIP TEST', '2']]]] },
      { file: 'not-uploaded.pdf', size: 9, title: 'Passion PRO', pages: [[3, 'E-1', 'X', [['1', '22222-TST-001', 'X', '1']]]] }] }));
    // 12n: the MRP lists (own MRP only)
    xlsx(X + '/Hero_Parts_MRP_Filled.xlsx', [[['Part No', 'Part Name', 'Status', 'New part no.', 'Bikes', 'In app now', 'MRP (Rs)', 'Matched Part No', 'e-cat Description', 'Match via'],
      ['44444TST201S', 'CABLE TEST', '', '', '', 'Not yet', '315', '44444-TST-201', '', 'exact'], ['44444TST200S', '', '', '', '', 'Not yet', '99', 'family:44444TST2', '', 'variant-family']]]);
    xlsx(X + '/Hero_MRP_Extra_From_Catalogue.xlsx', [[['Part No', 'Part Name', 'Status', 'MRP (Rs)', 'Matched Part No', 'Source'], ['33333-TST-300, 33333-TST-300H', 'GRIP TEST', '', '120', '33333-TST-300', 'Same part (A-Z)'],
      ['17910-TST-940', 'CABLE', '', '400', '17910-TST-A00', 'Naye number ka MRP (A-Z)']]]);
    const i2 = writeHero(T + '/pub', R2, T + '/lists', null, X), q = JSON.parse(fs.readFileSync(T + '/lists/hero.json', 'utf8')), qg = JSON.parse(fs.readFileSync(T + '/lists/hero-dg.json', 'utf8'));
    const lv = q.vars.indexOf('Hero parts lists (Excel)'), bv = q.vars.indexOf('CD Dawn (Nov, 2006) (old Hero Honda book)'), rowsOf = n => q.d.filter(r => r[5] === n);
    ok(i2.oldBooks === 1 && bv >= 0 && !q.vars.some(v => /Passion PRO/.test(v)), 'old Hero Honda book whose PDF is uploaded is an edition; one not uploaded is left out');
    const bk = rowsOf('17910-TST-940');
    ok(bk.length === 1 && bk[0][11].join() === String(bv) && bk[0][1] === -1 && qg.f[qg.p[bv]['F-3']] === 'pdf:catalogues/hero-raw/old-book.pdf:0:300:24:0,0,1,1',
      '17910-TST-940 shows in its old book with the page as diagram (not again in the discontinued list)');
    ok(/Discontinued 30-11-2018/.test(bk[0][8]) && /New no\. 17910-TST-A00/.test(bk[0][8]) && /Last model CD Deluxe \(Nov, 2006\)/.test(bk[0][8]), 'the book row keeps the discontinued date, new no. and the last model by name');
    const a = rowsOf('55555-TST-100')[0];
    ok(a && a[11].join() === String(lv) && q.desc[a[6]] === 'LEVER TEST' && q.mrp['55555-TST-100'] === 250 && /Not in Hero's e-catalogue/.test(a[8]) && /Old no\. 55555TST099/.test(a[8]) && /Fits Xtreme Sports \(Feb, 2015\), Duet \(Sep, 2015\)$/.test(a[8]),
      'A-Z part no list has: name, MRP, status in English, old no., bikes (names with commas kept whole)');
    ok(q.mrp['99999-TST-003'] === 75 && rowsOf('99999-TST-002').every(r => /New no\. 99999-TST-NEW/.test(r[8])) && rowsOf('99999-TST-003').length === 1, 'a known part gets its missing MRP and new no. from the lists, no second row');
    ok(rowsOf('20K999S').length === 1 && q.mrp['20K999S'] === 945, 'kits from the A-Z list');
    const s1 = rowsOf('44444TST200S'), s2 = rowsOf('44444TST201S');
    ok(s1.length === 1 && s2.length === 1 && q.desc[s2[0][6]] === 'CABLE TEST' && s1[0][11].join() === String(lv), "Sam's own parts list: every number in (name without the number)");
    ok(q.phf['44444TST201S'] && q.phz[q.phf['44444TST201S'][0]] === 'catalogues/hero-raw/HERO_Upload_Package_IMAGES_part1.zip' && !q.phf['55555-TST-100'], 'upload package part photo goes to the same part written without dashes; diagrams in it are not photos');
    ok(i2.lists && i2.lists.parts === 4 && i2.lists.files.join() === 'Hero_All_Parts_A-Z.xlsx,HERO PARTS ;IST.xlsx,Hero_Parts_MRP_Filled.xlsx,Hero_MRP_Extra_From_Catalogue.xlsx', 'build report counts the list parts: ' + JSON.stringify(i2.lists));
    ok(q.mrp['44444TST201S'] === 315 && q.mrp['33333-TST-300'] === 120 && q.mrp['44444TST200S'] == null && q.mrp['17910-TST-940'] == null && i2.lists.mrpFound === 2 && i2.lists.mrpNotOwn === 2,
      "MRP lists: a part's own MRP is used; a look-alike or new number's MRP is not");
    // 14w: Hero's dealer list: its MRP wins, unknown numbers come in, old -> new pairs both ways
    const H = ['Part No (DMS)', 'Part Naam', 'MRP (Rs)', 'MRP kab se', 'HSN', 'Naya Part No (Superseded By)', 'Humare catalogue me?', 'Model'];
    xlsx(X + '/Hero_DMS_All_Parts_MRP.xlsx', [[['x', 'y']], [H], [H, ['*44444TST201S*', 'CABLE TEST', '330', '', '', '', 'Haan', ''], ['77777TST700S', 'DMS ONLY PART', '510', '', '', '', 'Nahi', 'SPLENDOR+ (2020) | PASSION'], ['33333-TST-300', 'GRIP TEST', '', '', '', '', 'Haan', '']],
      [['Purana Part No', 'Purana Naam', 'Purana MRP', 'Naya Part No', 'Naya Naam', 'Naya MRP'], ['44444TST200S', 'X', '90', '44444TST201S', 'CABLE TEST', '330']]]);
    const i3 = writeHero(T + '/pub', R2, T + '/dms', null, X), q3 = JSON.parse(fs.readFileSync(T + '/dms/hero.json', 'utf8')), r3 = n => q3.d.filter(r => r[5] === n);
    ok(q3.mrp['44444TST201S'] === 330 && q3.mrp['33333-TST-300'] === 120 && q3.mrp['77777TST700S'] === 510 && q3.mrp['44444TST200S'] === 90, 'dealer list MRP wins; a part it has no MRP for keeps its own: ' + JSON.stringify(i3.dms));
    ok(r3('77777TST700S').length === 1 && q3.vars[r3('77777TST700S')[0][11][0]] === 'Hero DMS parts (not in catalogue)' && /Fits SPLENDOR\+ \(2020\), PASSION/.test(r3('77777TST700S')[0][8]), 'a number only the dealer list has comes in with its bikes');
    ok(r3('44444TST200S').every(r => /New no\. 44444TST201S/.test(r[8])) && r3('44444TST201S').every(r => /Old no\. 44444TST200S/.test(r[8])) && i3.dms.mrpChanged === 1 && i3.dms.added === 1, 'old and new numbers show under each other');
    // 14z: brand_sync's weekly files (hero-sync): a new model with its diagram, new photo, the dealer CSV newer than the Excel
    const SY = T + '/hero-sync'; fs.mkdirSync(SY + '/hero/groups', { recursive: true }); fs.mkdirSync(SY + '/hero/diagrams'); fs.mkdirSync(SY + '/hero/photos'); fs.mkdirSync(SY + '/output/Hero DMS', { recursive: true });
    fs.writeFileSync(SY + '/hero/state.json', JSON.stringify({ last_run: '2026-11-01', models: { NEWBIKE_X: { desc: 'Newbike 125 (Nov, 2026)', year: 2026, modelCC: '125CC', groups: ['G-NEW-1'] } }, mrp: { '88888-TST-800': '640' } }));
    fs.writeFileSync(SY + '/hero/groups/G-NEW-1.json', JSON.stringify({ group: { groupNo: 'G-NEW-1', map: 'E-1', desc: 'CYLINDER HEAD' }, rows: [{ sn: '1', pn: '88888-TST-800', desc: 'HEAD COMP', qty: '1', mrp: '640' }] }));
    fs.writeFileSync(SY + '/hero/diagrams/G-NEW-1.jpg', jpg('fignew')); fs.writeFileSync(SY + '/hero/photos/88888-TST-800.jpg', jpg('phnew'));
    fs.writeFileSync(SY + '/hero/old_new.json', JSON.stringify({ '88888-TST-799': { new: '88888-TST-800' } }));
    const fut = new Date(Date.now() + 60000); fs.writeFileSync(SY + '/output/Hero DMS/Hero_DMS_Parts.csv', 'part_no,name,mrp,mrp_from,hsn,group,active,superseded_by,models\n88888-TST-800,HEAD COMP,655,,,,Y,,NEWBIKE\n44444TST201S,CABLE TEST,345,,,,Y,,\n'); fs.utimesSync(SY + '/output/Hero DMS/Hero_DMS_Parts.csv', fut, fut);
    const i4 = writeHero(T + '/pub', R2, T + '/sync', null, X, SY), q4 = JSON.parse(fs.readFileSync(T + '/sync/hero.json', 'utf8')), g4 = JSON.parse(fs.readFileSync(T + '/sync/hero-dg.json', 'utf8')), r4 = q4.d.filter(r => r[5] === '88888-TST-800'), nv = q4.vars.indexOf('Newbike 125 (Nov, 2026)');
    ok(nv >= 0 && r4.length === 1 && r4[0][11].includes(nv) && g4.f[g4.p[nv]['E-1']] === 'pf:catalogues/hero-sync/hero/diagrams/G-NEW-1.jpg:0:' + jpg('fignew').length && i4.sync.models === 1, 'weekly sync: a new model comes in with its diagram: ' + JSON.stringify(i4.sync));
    ok(q4.mrp['88888-TST-800'] === 655 && q4.mrp['44444TST201S'] === 345 && i4.dmsSrc.startsWith('brand_sync'), 'weekly dealer CSV (newer than the Excel) gives the MRP');
    ok(/Old no\. 88888-TST-799/.test(r4[0][8]) && q4.phz[q4.phf['88888-TST-800'][0]] === 'catalogues/hero-sync/hero/photos/88888-TST-800.jpg', 'weekly sync: old number and new photo');
    const hv = JSON.parse(fs.readFileSync(SY + '/hero/hero_have.json', 'utf8')); ok(hv.groups.includes('E-1_SPLENDOR_TST1') && hv.photos.includes('99999TST001'), 'the sync is told which diagrams and photos the server already has');
  }
} catch (e) { ok(false, 'error ' + e.stack); }
srv.kill(); if (fails) console.log(log.slice(-2000)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
