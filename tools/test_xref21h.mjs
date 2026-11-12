// 21h: Hero and Honda numbers that differ only at the end (made-up rows)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { buildXref } from '../lib/xrefbuild.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'x21h'));
const mk = (b, rows) => ({ brand: b, vars: ['v1'], vmod: { v1: b + ' Bike' }, d: rows.map(([pn, nm]) => [0, 0, 0, 0, 0, pn, nm, 0, '', 0, 0, [0]]) });
fs.writeFileSync(path.join(T, 'hero.json'), JSON.stringify(mk('Hero', [['45131-GZ0-006L', 'PIN BOLT'], ['34908-634-611H', 'BULB (12V10W) AMBER E MARK'], ['95701-06012-0F', 'BOLT FLANGE 6X12'], ['77240-KWF-900ZD', 'LID TAIL LIGHT(BOMBAY ORANGE)'],
  ['16173-001-000', 'O- RING'], ['95701-08038-08', 'BOLT, FLANGE, 8X38'], ['12209-GB4-680', 'SEAL, VALVE STEM OR'], ['22201GF6000S', 'DISC CLUTCH']])));
fs.writeFileSync(path.join(T, 'honda.json'), JSON.stringify(mk('Honda', [['45131-GZ0-006', 'BOLT, PIN'], ['34908-634-611', 'TAPPET ADJUSTER'], ['95701-06012-08', 'BOLT, FLANGE, 6X12'], ['77240-KWF-900ZB', 'LID, TAILLIGHT *R321* SPORTS RED'],
  ['16173-001-004', 'PACKING, FUEL STRAINER CUP'], ['95701-08038-00', 'BOLT, FLANGE, 8X38'], ['12209-GB4-682', 'SEAL, VALVE STEM(ARAI)'], ['22201-GF6-000', 'DISK, CLUTCH']])));
const r = buildXref(T, path.join(T, 'none.json'), path.join(T, 'none.json')), hi = r.b.indexOf('Honda');
ok(r.n['45131GZ0006L'] && r.n['45131GZ0006L'][hi] === '45131GZ0006' && /one more letter/.test(r.r['45131GZ0006L'][hi]), 'Hero 45131-GZ0-006L is the same part as Honda 45131-GZ0-006');
ok(!r.n['34908634611H'], 'one more letter but another name: not linked');
ok(r.n['22201GF6000S'] && /with S/.test(r.r['22201GF6000S'][hi]), 'the S rule still works');
const grp = k => (r.gk[k] || []).map(i => r.g[i][0]);
ok(grp('95701060120F').some(l => /only the last letter or number differs/.test(l)) && grp('957010601208').length === 1, 'bolt 95701-06012-0F / -08: check-before-fitting group on both');
ok(grp('957010803808').some(l => /only the last/.test(l)), 'bolt 95701-08038-08 / -00 (last number): group');
ok(!grp('77240KWF900ZD').some(l => /only the last/.test(l)), 'painted part (colour at the end): no group');
ok(!grp('16173001000').some(l => /only the last/.test(l)), 'other name (O-ring / packing): no group');
ok(grp('12209GB4680').length === 1 && /Honda design/.test(grp('12209GB4680')[0]), 'Honda-design number keeps its one Honda design group');
process.exit(fails ? 1 : 0);
