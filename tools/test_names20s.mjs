// 20s: a part with no name (or only filler dots) takes its name from a later list or the weekly sync; the MRP too
// usage: node tools/test_names20s.mjs
import fs from 'node:fs'; import * as H from '../lib/herobuild.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-names', R = T + '/raw', SY = T + '/sync'; fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(R, { recursive: true }); fs.mkdirSync(SY + '/output/Hero DMS', { recursive: true });
fs.writeFileSync(R + '/hero_hidden_models.json', '{}'); fs.writeFileSync(R + '/hero_oldnew_harvest.json', '{"supercedence":[]}');
fs.writeFileSync(R + '/Hero_Complete_Parts_List.csv', 'part,desc,x,mrp,old\n22870-TST-C00,&#8729;&#8729;&#8729;&#8729;&#8729;&#8729;,,,\n11111-TST-000,PLAIN NAME,,50,\n33333-TST-000,,,,\n');
fs.writeFileSync(SY + '/output/Hero DMS/Hero_DMS_Parts.csv', 'part_no,name,mrp,mrp_from,hsn,group,active,superseded_by,models\n22870TSTC00S,"PLATE COMP., CLUTCH LIFTER",83,,,,Y,,\n11111-TST-000,DMS NAME,55,,,,Y,,\n33333-TST-000,&#8729;&#8729;&#8729;,,,,,Y,,\n');
const E = H.EMPTY_HERO(), G = H.EMPTY_HERO_DG();
let r; try { r = H.buildHero(E, G, R, 'catalogues/hero-raw', { syncDir: SY }); } catch (e) { console.log('FAIL build', e); process.exit(1); }
const d = r.cat, row = pn => d.d.find(x => x[5] === pn), nm = pn => row(pn) && d.desc[row(pn)[6]];
ok(nm('22870-TST-C00') === 'PLATE COMP., CLUTCH LIFTER', 'filler-dot name is replaced by the weekly dealer list name: ' + nm('22870-TST-C00'));
ok(d.mrp['22870-TST-C00'] === 83, 'its missing MRP comes from the weekly dealer list');
ok(nm('11111-TST-000') === 'PLAIN NAME' && d.mrp['11111-TST-000'] === 55, 'a part that has a name keeps it; MRP is the dealer list one: ' + nm('11111-TST-000'));
ok(H.blankName(nm('33333-TST-000')), 'no name anywhere stays empty (no junk): "' + nm('33333-TST-000') + '"');
ok(r.info.dms && r.info.dms.nameSet === 1, 'build report counts the names filled: ' + JSON.stringify(r.info.dms && r.info.dms.nameSet) + (r.info.listsErr || r.info.dmsErr || ''));
// 20t: no weekly CSV: the sync's own parts.json is read
{ fs.rmSync(SY + '/output/Hero DMS/Hero_DMS_Parts.csv'); fs.mkdirSync(SY + '/hero_dms');
  fs.writeFileSync(SY + '/hero_dms/parts.json', JSON.stringify({ '22870TSTC00S': { name: 'PLATE FROM JSON', mrp: 91, sup: '', models: [] } }));
  const q = H.buildHero(H.EMPTY_HERO(), H.EMPTY_HERO_DG(), R, 'catalogues/hero-raw', { syncDir: SY }).cat, rw = q.d.find(x => x[5] === '22870-TST-C00');
  ok(rw && q.desc[rw[6]] === 'PLATE FROM JSON' && q.mrp['22870-TST-C00'] === 91, 'without the weekly CSV, name and MRP come from hero_dms/parts.json'); }
// other brands: the shared helper on their rows
{ const dd = { desc: ['', 'OLD', '....'], d: [[0, 0, '', 0, '', '53199-K0N-D10', 0], [0, 0, '', 0, '', 'AB12', 1], [0, 0, '', 0, '', 'N1', 2]] }, di = a => { let i = dd.desc.indexOf(a); if (i < 0) i = dd.desc.push(a) - 1; return i; };
  const n = H.fillNames(dd.d, dd, di, { '53199K0ND10': { desc: 'SPRING', mrp: 5 }, AB12: { name: 'NEW' }, N1: { name: '' } });
  ok(n === 1 && dd.desc[dd.d[0][6]] === 'SPRING' && dd.desc[dd.d[1][6]] === 'OLD' && dd.d[2][6] === 2, 'fillNames: only the empty name is filled, by number without dashes'); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
