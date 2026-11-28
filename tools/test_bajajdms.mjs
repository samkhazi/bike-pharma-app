// update 23f (Sam 2026-11-14 'sabhi'): every detail of Bajaj's dealer system (DMS) Part List reaches the Bajaj catalogue: HSN, GST, part group and
// 'not serviceable' in a catalogue line's remarks, the list's own alternate column as alternates, (parts no edition has are listed by 23k)
// usage: node tools/test_bajajdms.mjs   (no server: bajajDms + buildBajaj on a small made-up Bajaj folder)
import fs from 'node:fs'; import zlib from 'node:zlib';
import { bajajDms, buildBajaj } from '../lib/bajajbuild.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const D = '/tmp/claude-0/bptest-bajajdms'; fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D, { recursive: true });
const zip = (f, ents) => { const loc = [], cen = []; let off = 0;
  for (const [n, s] of ents) { const b = Buffer.from(s), nb = Buffer.from(n), c = zlib.crc32(b), h = Buffer.alloc(30), e = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14); h.writeUInt32LE(b.length, 18); h.writeUInt32LE(b.length, 22); h.writeUInt16LE(nb.length, 26);
    e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt32LE(c, 16); e.writeUInt32LE(b.length, 20); e.writeUInt32LE(b.length, 24); e.writeUInt16LE(nb.length, 28); e.writeUInt32LE(off, 42);
    loc.push(h, nb, b); cen.push(e, nb); off += 30 + nb.length + b.length; }
  const cd = Buffer.concat(cen), z = Buffer.alloc(22); z.writeUInt32LE(0x06054b50, 0); z.writeUInt16LE(ents.length, 8); z.writeUInt16LE(ents.length, 10); z.writeUInt32LE(cd.length, 12); z.writeUInt32LE(off, 16);
  fs.writeFileSync(D + '/' + f, Buffer.concat([...loc, cd, z])); };
const xlsx = (f, rows) => zip(f, [['xl/worksheets/sheet1.xml', '<worksheet><sheetData>' + rows.map((r, i) => `<row r="${i + 1}">` + r.map((v, j) => {
  const ref = String.fromCharCode(65 + j) + (i + 1); return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c t="inlineStr" r="${ref}"><is><t>${v}</t></is></c>`; }).join('') + '</row>').join('') + '</sheetData></worksheet>']]);
// as Sam's export (8 Nov 2026): 'Part ' with a space, MRP as a raw float, part codes with leading zeros
xlsx('Part List.xlsx', [['Part Code', 'Part ', 'GST Rate', 'Primary UOM', 'Is Serviceable', 'HSN Code', 'Sale Price', 'Purchase Price', 'MRP', 'Part Group', 'Alternate Part Code', 'Alternate Part Name', 'Is AlternatePart Serviceable'],
  ['PD511536', 'COVER ASSEMBLY HEAD CYLINDER', 'GST 28%', 'EACH', 'Yes', '87141090', 0, 900, 1260.0000000001, 'BAL Parts', '', '', ''],
  ['01100314', 'PLUG', 'GST 18%', 'EACH', 'No', '87081090', 0, 42, 0.56999999999999995, 'BAL Parts', '', '', ''],
  ['JL171023', 'BRACKET SIDE COVER MTG RH', 'GST 28%', 'EACH', 'Yes', '87141090', 0, 90, 126, 'BAL Parts', 'JL171099', 'BRACKET COVER SIDE RH', 'Yes']]);
xlsx('List of Alternate Items And Service Ability Indicator And MR.xlsx', [['Original Item', 'Description', 'MRP For Original', 'Alternate Item', 'Alt Item Description', 'Servicability Indicator', 'MRP Of Alt', 'Alt Effective Date'],
  ['DK101010', 'FRAME BODY', 5000, 'DK101099', 'FRAME BODY', 'N', 5200, 45922]]);
fs.writeFileSync(D + '/bajaj_build.json', JSON.stringify({ v: 1, eds: [{ sku: '00DH60ZZ', title: 'Pulsar 150 BS VI OBD2', mon: 'Apr', year: 2023, folder: 'PULSAR 150', file: 'x.pdf', size: 1, src: 'viewer',
  plates: [['1 - COVER CYLINDER HEAD', null, [['1', 'PD511536', 'COVER ASSEMBLY HEAD CYLINDER', '1']]], ['2 - FRAME', null, [['1', 'DK101010', 'FRAME BODY', '1']]]] }], oldnew: [] }));
fs.writeFileSync(D + '/bajaj_alt.json', JSON.stringify({ v: 1, pairs: [], mrp: { PD511536: 1250.5 }, dms: 'Part List.xlsx|1|1;' }));   // merged by the old (v1) code

const m = bajajDms(D);
ok(m && m.parts === 3 && m.listAlt === 1 && m.mrpChanged >= 1, 'a v1 merge is done again: 3 parts with details, 1 alternate from the list\'s own column: ' + JSON.stringify(m));
const A = JSON.parse(fs.readFileSync(D + '/bajaj_alt.json', 'utf8'));
ok(JSON.stringify(A.info['01100314']) === JSON.stringify(['PLUG', '87081090', '18%', 'BAL Parts', 'N', 'EACH']) && A.mrp['01100314'] === 0.57 && A.mrp.PD511536 === 1260, 'details kept per part (leading zeros, GST as %, raw float MRP rounded)');
ok(bajajDms(D) === null, 'same files: not merged again');
const { cat: d } = buildBajaj(D);
const row = pn => d.d.filter(r => r[5] === pn);
ok(/HSN 87141090; GST 28%; Group BAL Parts/.test(row('PD511536')[0][8]) && !/Not serviceable/.test(row('PD511536')[0][8]), 'a catalogue line shows its HSN, GST and group');
ok(/New no\. DK101099/.test(row('DK101010')[0][8]), 'the alternates list still gives the new number');
const plug = row('01100314')[0], v = plug && plug[11][0];
ok(plug && d.vmod[d.vars[v]] === 'Other Bajaj (no model name)' && /dealer part list/.test(d.vars[v]) && d.desc[plug[6]] === 'PLUG' && /Not serviceable \(Bajaj DMS\)/.test(plug[8]) && /HSN 87081090; GST 18%/.test(plug[8]) && d.mrp['01100314'] === 0.57, "a part only the DMS has (23k's dealer part list lines): name, MRP and the 23f details, under Other Bajaj");
ok(/Alternate no\. JL171099/.test(row('JL171023')[0][8]) && row('PD511536').every(r => r[11][0] !== v) && row('01100314').length === 1, "the Part List's own alternate column is an alternate; a catalogue part is not listed again; a DMS-only part once");
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
