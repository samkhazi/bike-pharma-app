// 16r: cat/xref.json on the server: the same part in another brand, also through new / old / alternate numbers and the Bajaj DMS list
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { buildXref } from '../lib/xrefbuild.mjs';
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-')), row = (pn, vi, rem = '') => [0, -1, '1', 0, '1', pn, 0, '1', rem, 0, 0, [vi]];
const cat = (brand, vars, vmod, d) => ({ brand, vars, vmod, d });
fs.writeFileSync(T + '/ktm.json', JSON.stringify(cat('KTM', ['200 Duke · 2020'], { '200 Duke · 2020': '200 Duke' }, [row('01100905', 0), row('90130006000', 0), row('77701234', 0, 'New no. JR551234')])));
fs.writeFileSync(T + '/bajaj.json', JSON.stringify(cat('Bajaj', ['NS200 · 2024'], { 'NS200 · 2024': 'Pulsar NS200' }, [row('01100905', 0), row('DJ101234', 0), row('JR551234', 0)])));
fs.writeFileSync(T + '/ktm-dg.json', '{}'); fs.writeFileSync(T + '/bajaj_alt.json', JSON.stringify({ pairs: [['90130006000', 'DJ101234', 'a', 'DMS alternate']] }));
const X = buildXref(T, T + '/bajaj_alt.json'), K = X.b.indexOf('KTM'), B = X.b.indexOf('Bajaj');
ok(X.x['01100905'] && X.m[B][X.x['01100905'][B][0]] === 'Pulsar NS200' && !(X.n['01100905']), 'same number in KTM and Bajaj');
ok(X.n['90130006000'] && X.n['90130006000'][B] === 'DJ101234' && X.n['DJ101234'][K] === '90130006000', 'Bajaj DMS alternate: KTM part names the Bajaj number and back');
ok(X.n['77701234'] && X.n['77701234'][B] === 'JR551234', "a line's New no. found in the other brand");
// 16s: same size / design groups
const { specOf } = await import('../lib/xrefbuild.mjs');
ok(specOf('BEARING, RADIAL BALL, 6202')[1] === '6202' && specOf('OIL SEAL, 20X32X6')[1] === '20 x 32 x 6' && specOf('SPARK PLUG (CPR8EA-9)')[1] === 'CPR8EA-9' && specOf('BULB, HEADLIGHT (12V 35/35W)')[1] === '12V 35/35W' && specOf('CHAIN, DRIVE (428H-118L)')[1] === '428 x 118 links' && !specOf('BOLT, FLANGE, 6X25') && !specOf('FUSE BOX'), 'standard sizes read from part names, never a bolt or a fuse box');
fs.writeFileSync(T + '/hero.json', JSON.stringify(cat('Hero', ['Splendor'], {}, [row('96100-62020-00', 0), [0, -1, '1', 0, '', '12209-GB4-680', 'SEAL, VALVE STEM', '1', '', 0, 0, [0]]].map(r => (r[6] = r[6] || 'BEARING, RADIAL BALL, 6202', r)))));
fs.writeFileSync(T + '/tvs.json', JSON.stringify(cat('TVS', ['Apache'], {}, [[0, -1, '1', 0, '', 'K3200370', 'BEARING BALL 6202', '1', '', 0, 0, [0]]])));
fs.writeFileSync(T + '/honda.json', JSON.stringify(cat('Honda', ['CD 100'], {}, [[0, -1, '1', 0, '', '12209-GB4-682', 'SEAL, VALVE STEM(ARAI)', '1', '', 0, 0, [0]]])));
const Y = buildXref(T, T + '/bajaj_alt.json'), gl = pn => (Y.gk[pn] || []).map(i => Y.g[i]);
ok(gl('K3200370').some(g => g[0] === 'Ball bearing 6202' && g[1] === 1 && Object.keys(g[2]).length === 2), 'TVS 6202 bearing lists the Hero 6202 bearing (check before fitting)');
ok(gl('12209GB4680').some(g => /Honda design 12209-GB4/.test(g[0])), 'Hero and Honda: same Honda design, other revision');
fs.writeFileSync(T + '/hero.json', JSON.stringify(cat('Hero', ['Glamour'], {}, [[0, -1, '1', 0, '', '22201GF6000S', 'CLUTCH PLATE', '1', '', 0, 0, [0]]])));
fs.writeFileSync(T + '/honda.json', JSON.stringify(cat('Honda', ['Activa'], {}, [[0, -1, '1', 0, '', '22201-GF6-000', 'PLATE, CLUTCH', '1', '', 0, 0, [0]]])));
const Z = buildXref(T, T + '/bajaj_alt.json'), H = Z.b.indexOf('Honda');
ok(Z.n['22201GF6000S'] && Z.n['22201GF6000S'][H] === '22201GF6000' && /with S/.test(Z.r['22201GF6000S'][H]), "16u: Hero number + S finds the Honda number");
{ const { altRemarks } = await import('../lib/ktmbuild.mjs'), f = altRemarks({ pairs: [['DT402404', 'JR403608', 'n'], ['JU402400', 'DT402404', 'n'], ['JR403606', 'JR403608', 'n']] });
  const r = f('JR403608'); ok(r.includes('Old no. DT402404') && r.includes('Old no. JR403606') && r.includes('Alternate no. JU402400') && !f('AB123456').length, '16w: a KTM part with a Bajaj number gets the Bajaj DMS family'); }
fs.rmSync(T, { recursive: true, force: true });
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);
