// update 12b: Bajaj made on the server from Sam's Downloads > Bajaj Catalogue folder: the EPC viewer's plates with their HQ diagrams read
// straight out of the stored Viewer_img zips, the model PDFs' own tables (diagram from the PDF page) for books the viewer lacks, old and
// new numbers, compatible models, no prices, the app's Bajaj names
// usage: node tools/test_bajajbuild.mjs   (own server on 3027, fresh database, a small made-up Bajaj folder)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import zlib from 'node:zlib';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-bajaj'; fs.rmSync(T, { recursive: true, force: true });
const D = T + '/pf/catalogues/bajaj'; fs.mkdirSync(D, { recursive: true });
// a stored (not compressed) zip, as Sam's Viewer_img zips are
const zip = (f, ents) => { const loc = [], cen = []; let off = 0;
  for (const [n, b] of ents) { const nb = Buffer.from(n), c = zlib.crc32(b), h = Buffer.alloc(30), e = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14); h.writeUInt32LE(b.length, 18); h.writeUInt32LE(b.length, 22); h.writeUInt16LE(nb.length, 26);
    e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt32LE(c, 16); e.writeUInt32LE(b.length, 20); e.writeUInt32LE(b.length, 24); e.writeUInt16LE(nb.length, 28); e.writeUInt32LE(off, 42);
    loc.push(h, nb, b); cen.push(e, nb); off += 30 + nb.length + b.length; }
  const cd = Buffer.concat(cen), z = Buffer.alloc(22); z.writeUInt32LE(0x06054b50, 0); z.writeUInt16LE(ents.length, 8); z.writeUInt16LE(ents.length, 10); z.writeUInt32LE(cd.length, 12); z.writeUInt32LE(off, 16);
  fs.writeFileSync(D + '/' + f, Buffer.concat([...loc, cd, z])); };
const jpg = s => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(s), Buffer.from([0xff, 0xd9])]);
const { BAJAJ_ZIPS, bajajModel } = await import('../lib/bajajbuild.mjs');
zip(BAJAJ_ZIPS[0], [['Bajaj Catalogue Viewer/img/aa11.jpg', jpg('cylinder-head')], ['Bajaj Catalogue Viewer/img/bb22.jpg', jpg('frame')]]);
for (const f of BAJAJ_ZIPS.slice(1)) zip(f, []);
fs.writeFileSync(D + '/Pulsar 220 LED (May, 2026) [00DK15ZZ].pdf', '%PDF-1.4 test');
const ed = (sku, title, mon, year, folder, plates, src = 'viewer') => ({ sku, title, mon, year, folder, file: `${title} (${mon}, ${year}) [${sku}].pdf`, size: 14, src, plates });
fs.writeFileSync(D + '/bajaj_build.json', JSON.stringify({ v: 1, eds: [
  Object.assign(ed('00DH60ZZ', 'Pulsar 150 BS VI OBD2', 'Apr', 2023, 'PULSAR 150', [['1 - COVER CYLINDER HEAD', 'aa11', [['1', 'PD511536', 'COVER ASSEMBLY HEAD CYLINDER', '1'], ['2', 'JG511021', 'WASHER', '2']]],
    ['2 - FRAME', 'bb22', [['1', 'DK101010', 'FRAME BODY', '1']]], ['3 - TOOL KIT', 'zz99', [['1', 'JF300011', 'TOOL KIT', '1']]]]),
    { bom: [['1', 'COVER CYLINDER HEAD', 'PD511999', 'GASKET COVER HEAD', '1', '2023-04-01', ''], ['48', 'Electrical Equipments', 'DJ201201', 'WIRING HARNESS', '1', '2010-12-01', '2012-05-01']] }),
  ed('00DH70ZZ', 'Pulsar 150 SD', 'Oct', 2025, 'Pulsar 150 SD', [['1 - Cover Cylinder Head', 'aa11', [['1', 'PD511536', 'COVER ASSEMBLY HEAD CYLINDER', '1']]]]),
  ed('00JR67ZZ', 'Pulsar 150 Single Seat, TFT, Twin Disc, ISG', 'Aug', 2026, 'Pulsar 150 UG', [['1 - COVER CYLINDER HEAD', 'aa11', [['1', 'PD511536', 'COVER ASSEMBLY HEAD CYLINDER', '1']]]]),
  ed('00DK15ZZ', 'Pulsar 220 LED', 'May', 2026, 'Pulsar 220 LED', [['1 - FRAME', ['pdf', 8, '0.2186,0.0642,0.7836,0.5642'], [['1', 'DK101011', 'FRAME BODY', '1']]],
    ['All parts (EPC me is BOM ka diagram nahi)', null, [['5', '14151033', 'BOLT', '4']]]], 'pdf'),
  ed('00JL34ZZ', 'SKU 00JL34ZZ', 'Jan', 2024, 'Unnamed SKU (EPC me model naam nahi)', [['All parts', null, [['1', 'XX900001', 'TEST PART', '1']]]], 'pdf'),
], oldnew: [['14151033', 'KPAA6200'], ['JG511000', 'JG511021']] }));

await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3027', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3027';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, ...h } });
try {
  ok(bajajModel('Pulsar 125', 'Pulsar NS 125 BSVI') === 'Pulsar NS125' && bajajModel('Pulsar NS 200', 'PULSAR 200 NS FI - WVTA') === 'Pulsar NS200' && bajajModel('Pulsar NS 200', 'PULSAR AS 200 BS IV') === 'Pulsar AS200'
    && bajajModel('PULSAR RS 200', 'Pulsar 200 SS ABS') === 'Pulsar RS200' && bajajModel('Pulsar 250', 'Pulsar F250') === 'Pulsar F250' && bajajModel('Pulsar N150', 'Pulsar N 150') === 'Pulsar N150'
    && bajajModel('Pulsar NS 400', 'Pulsar NS 400') === 'Pulsar NS400Z' && bajajModel('PULSAR 220', 'PULSAR 220 S-NO COLOR') === 'Pulsar 220F' && bajajModel('PULSAR 150', 'Pulsar 150 twin disk ABS') === 'Pulsar 150 Twin Disc',
    "the PDF folder + title give the app's Bajaj names (Pulsars)");
  ok(bajajModel('AVENGER 220', 'AVENGER 220 STREET - ABS') === 'Avenger 220 Street' && bajajModel('AVENGER 220', 'Avenger 220 cruise') === 'Avenger 220 Cruise' && bajajModel('AVENGER 160', 'Avenger 160 Strret BS VI') === 'Avenger 160 Street'
    && bajajModel('CT 110', 'CT 110 X') === 'CT 110X' && bajajModel('CT 125X', 'CT 125') === 'CT 125X' && bajajModel('CT 100', 'CT100 KS BSVI UG') === 'CT 100' && bajajModel('Freedom 125 NG04', 'Freedom NG04 Disc LED') === 'Freedom 125 CNG'
    && bajajModel('V', 'V 15 POWER UP') === 'V15' && bajajModel('DISCOVER 100', 'DISCO-M DRUM BRAKE ES-NO COLOR') === 'Discover 100M' && bajajModel('DISCOVER 125', 'DISCOVER 125 T-DISC NO COLOR') === 'Discover 125T'
    && bajajModel('DOMINAR 400', 'DOMINAR D 400 ABS') === 'Dominar 400', "and the others (Avenger, CT, Freedom, V, Discover, Dominar)");
  for (let i = 0; i < 120 && !/bajaj build \(start\) ended/.test(log); i++) await new Promise(r => setTimeout(r, 500));
  ok(/bajaj build \(start\) ended 0/.test(log), 'the Bajaj folder found at start: Bajaj made on the server');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const d = JSON.parse(fs.readFileSync(T + '/data/cat/bajaj.json', 'utf8')), g = await (await get('/cat/bajaj-dg.json')).json();
  ok(d.models.join() === 'Pulsar 150,Pulsar 150 Twin Disc,Pulsar 220F,Other Bajaj (no model name)', "models in the app's order, a book with no model name under Other Bajaj");
  ok(d.vars[0] === 'Pulsar 150 · Pulsar 150 SD (Oct, 2025) · 00DH70ZZ' && d.vars[1] === 'Pulsar 150 · Pulsar 150 BS VI OBD2 (Apr, 2023) · 00DH60ZZ', 'editions newest first, with the book title, date and SKU');
  const V = s => d.vars.findIndex(v => v.endsWith(' · ' + s)), byPn = pn => d.d.filter(r => r[5] === pn);
  const head = byPn('PD511536');
  ok(head.length === 1 && head[0][11].join() === [V('00DH70ZZ'), V('00DH60ZZ'), V('00JR67ZZ')].sort((a, b) => a - b).join() && head[0][2] === '1' && d.asm[head[0][3]] === 'COVER CYLINDER HEAD', 'compatible: one line lists every edition with the same part (fig 1, its assembly)');
  ok(head[0][4] === '1' && byPn('JG511021')[0][7] === '2' && /Old no\. JG511000/.test(byPn('JG511021')[0][8]) && /New no\. KPAA6200/.test(byPn('14151033')[0][8]), 'ref no. and qty kept; old and new numbers from the Excel');
  ok(Object.keys(d.mrp).length === 0 && !JSON.stringify(d).includes('KTM'), 'no prices at all (Sam), nothing of KTM');
  const bom1 = byPn('PD511999')[0], bom2 = byPn('DJ201201')[0];
  ok(bom1 && bom1[2] === '1' && bom1[1] === -1 && bom1[4] === '' && /Bajaj BOM list/.test(bom1[8]) && bom2 && bom2[2] === '48' && d.asm[bom2[3]] === 'ELECTRICAL EQUIPMENTS' && bom2[1] === -2 && /used till 2012-05-01/.test(bom2[8]),
    "12c: the rest of the book's BOM is in too: under its plate's diagram, a plate the book has not under its own name; an ended part says till when");
  const pg = g.p[String(V('00DH60ZZ'))], m = /^pf:(.+):(\d+):(\d+)$/.exec(g.f[pg['1']]);
  ok(m && m[1] === 'catalogues/bajaj/Viewer_img_01.zip' && g.f[pg['1']] === g.f[g.p[String(V('00DH70ZZ'))]['1']], 'diagram from the viewer zip, the same picture shared by the editions');
  const pic = Buffer.from(await (await get(`/api/files/read?path=${encodeURIComponent(m[1])}&offset=${m[2]}&length=${m[3]}`)).arrayBuffer());
  ok(pic.equals(jpg('cylinder-head')), 'the diagram read out of the stored zip is the picture');
  ok(pg['3'] == null && byPn('JF300011')[0][1] === -2 && byPn('PD511536')[0][1] === -1, 'a picture the zips do not have: no diagram (not a broken one)');
  const p220 = g.p[String(V('00DK15ZZ'))];
  ok(g.f[p220['1']] === 'pdf:catalogues/bajaj/Pulsar 220 LED (May, 2026) [00DK15ZZ].pdf:0:14:8:0.2186,0.0642,0.7836,0.5642' && byPn('14151033')[0][1] === -2, "a book the viewer lacks: its diagram from the model PDF's page; its list with no diagram");
  ok(g.dir === 'catalogues/bajaj' && g.files.length === 16 && g.pick === 'Downloads > Bajaj Catalogue', 'diagram file names the folder to pick');
  const hd = await (await get('/cat/bajaj.json')).json();
  ok(hd.split === 1 && hd.d.length === 0 && hd.n === d.d.length, 'cat/bajaj.json sends the head only (fast, like Hero and Honda)');
  const sp = await fetch(BASE + '/api/cat/rows', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ b: 'bajaj', m: ['Pulsar 220F'] }) }).then(r => r.json());
  ok(sp.g.length === 2, "a bike's Bajaj lines come on their own");
  const app = await (await get('/app.html')).text(), pa = fs.readFileSync('public/app.html', 'utf8');
  const bl = s => (/'Bajaj':\['[^']*','[^']*'\]/.exec(s) || [''])[0], ml = s => (/Object\.assign\(BRANDS_V,\{[\s\S]*?("Bajaj":\[[^\]]*\])/.exec(s) || [])[1];
  ok(bl(app) && bl(app) !== bl(pa) && ml(app).startsWith('"Bajaj":["Pulsar 150","Pulsar 150 Twin Disc","Pulsar 220F"]') && /"Bajaj":\{"m":3,"pn":/.test(app), 'app sent with its Bajaj part number line + model list made again (Other Bajaj not a bike)');
  ok((await get('/api/catup?path=' + encodeURIComponent('catalogues/bajaj/Pulsar 150 Single Seat, TFT, Twin Disc, ISG (Aug, 2026) [00JR68ZZ].pdf') + '&size=10')).status === 200, 'a model PDF with commas in its name can be uploaded');
  ok((await get('/api/catup?path=' + encodeURIComponent('catalogues/bajaj/SKU HHDT07ZZ - parts PULSAR RS 200 ABS - BS IV se 20% milte hain (Jan, 2017) [HHDT07ZZ].pdf') + '&size=10')).status === 200 && (await get('/api/catup?path=' + encodeURIComponent('catalogues/bajaj/../x.pdf') + '&size=10')).status !== 200, "12d: a name with % in it can be uploaded (Sam's Bajaj book), a '..' still cannot");
  const mf = JSON.parse(fs.readFileSync('public/cat/more-files.json', 'utf8')).sets.find(s => s.dir === 'catalogues/bajaj');
  ok(mf && mf.pick === 'Downloads > Bajaj Catalogue' && mf.files[0][0] === 'bajaj_build.json' && mf.files.slice(1).every(f => /\.pdf$/.test(f[0])) && mf.files.length > 200 && !mf.files.some(f => /Viewer_im|\.jpg$|^~\$|DS_Store/.test(f[0])) && new Set(mf.files.map(f => f[0])).size === mf.files.length, 'upload card: bajaj_build.json + the model PDFs with diagrams, every file once (no viewer zips or loose pictures)');
} catch (e) { ok(false, 'error ' + e.stack); }
finally { srv.kill(); }
if (fails) console.log(log.slice(-3000));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
