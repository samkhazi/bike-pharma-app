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
fs.rmSync(T, { recursive: true, force: true });
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);
