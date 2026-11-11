// 19s: Rolon's weekly list joins the aftermarket list (lib/rolonam.mjs). Data shaped like Rolon's own (_state.json, _kits.json).
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert';
import { rolonRows, mergeAm, rolonAmFile } from '../lib/rolonam.mjs';
const st = { types: { producttype: [{ id: 1, type: 'KIT' }, { id: 2, type: 'BELT' }, { id: 3, type: 'CHAIN' }] },
  brands: { 1: [{ type: 'BAJAJ' }, { type: 'BENELLI' }], 2: [{ type: '3 WHEELER BELT' }], 3: [{ type: 'CAM CHAIN' }] },
  master: {
    '1|BAJAJ': [
      { product: 'KIT', material: 'KIT3657HT01083914', oldmaterialcode: 'KIT BSOR 183', group1: 'PULSAR', vehicle: 'PULSAR 200CC NS', mrp: '1565.00', premium_product: 'true', delstat: '' },
      { product: 'KIT', material: 'KIT3657HT01083914', oldmaterialcode: 'KIT BSOR 183', group1: 'PULSAR', vehicle: 'PULSAR AS 200CC', mrp: '1565.00', premium_product: 'true', delstat: '' },
      { product: 'KIT', material: 'KIT3657HY01124314', oldmaterialcode: 'KIT BSOR 181', group1: 'KTM DUKE', vehicle: 'KTM DUKE 200CC (UPTO JUNE 2012)', mrp: '1888.00', delstat: '-' }],
    '1|BENELLI': [{ product: 'KIT', material: 'KIT313DPD01104614', oldmaterialcode: 'KIT HOR 347', group1: 'IMPERIALE', vehicle: 'IMPERIALE 400', mrp: '3660.00' }],
    '2|3 WHEELER BELT': [{ product: 'BELT', material: 'L01BCC00736', oldmaterialcode: 'CC 736', group1: 'VIKRAM', vehicle: 'VIKRAM III WHEELER PETROL', mrp: '116.00' }],
    '3|CAM CHAIN': [{ product: 'CHAIN', material: 'L0130140110100882', oldmaterialcode: 'B 000025 08802', group1: 'ENTICER', vehicle: 'ENTICER', mrp: '328.00' },
      { product: 'CHAIN', material: 'L0130140110100882', oldmaterialcode: 'B 000025 08802', group1: 'YBX', vehicle: 'YBX', mrp: '328.00' }] } };
const kits = { KIT3657HT01083914: [{ kitsapcode: 'KIT3657HT01083914', chain: 'R520BSOR104-1S', frontsprocket: '02 249', fspkt_teeth: '14', rearsprocket: '02 428', rspkt_teeth: '39', front_image: 'data:image/png;base64,AAAA' }] };
const R = rolonRows(st, kits), by = Object.fromEntries(R.map(r => [r.pn, r]));
assert.equal(R.length, 5, 'one line per material code');
assert.equal(by.KIT3657HT01083914.fit, 'BAJAJ: PULSAR 200CC NS, PULSAR AS 200CC');
assert.match(by.KIT3657HT01083914.nm, /^Chain sprocket kit · KIT BSOR 183 · chain R520BSOR104-1S · sprockets 14T front \/ 39T rear · premium$/);
assert.equal(by.KIT3657HT01083914.mrp, 1565);
assert.match(by.KIT3657HY01124314.nm, /discontinued/);
assert.equal(by.L01BCC00736.nm, 'Belt · 3 wheeler belt · CC 736');
assert.equal(by.L0130140110100882.fit, 'ENTICER, YBX');
assert.ok(!JSON.stringify(R).includes('base64'), 'no picture data in the list');
// merge: an old uploaded Rolon list goes, other companies stay, kinds and bikes are set
const base = { src: 'old', b: ['Endurance', 'Rolon'], ob: ['Bajaj'], ty: [['Chain sprocket kit', 'SPROCKET|CHAIN KIT'], ['Drive belt', '\\bBELT']],
  p: [[0, 'E1', 'Brake shoe', 'Brakes', 100, 'Pulsar', [], [], '', [], [], ''], [1, 'KITOLD', 'Chain sprocket kit old', 'Chain sprocket kit', 900, 'BAJAJ: X', [], [], 'Chain sprocket kit', [], [], '']] };
const xref = { b: ['Bajaj', 'KTM'], m: [['Pulsar NS 200', 'Pulsar 150'], ['Duke 200']] };
const M = mergeAm(base, st, kits, xref), rol = M.p.filter(p => M.b[p[0]] === 'Rolon');
assert.equal(M.p.length, 6); assert.equal(rol.length, 5); assert.ok(!M.p.some(p => p[1] === 'KITOLD'), 'old Rolon line gone'); assert.ok(M.p.some(p => p[1] === 'E1'));
assert.equal(M.b.filter(b => b === 'Rolon').length, 1);
const ns = rol.find(p => p[1] === 'KIT3657HT01083914'); assert.equal(ns[8], 'Chain sprocket kit'); assert.equal(ns[4], 1565);
assert.equal(rol.find(p => p[1] === 'L01BCC00736')[8], 'Drive belt');
const duke = rol.find(p => p[1] === 'KIT3657HY01124314'); assert.deepEqual(duke[9].map(([b, m]) => M.ob[b] + ' ' + m), ['KTM Duke 200']);
assert.ok(rol.every(p => p.length === 12 && Array.isArray(p[6]) && Array.isArray(p[9])));
// no uploaded list at all: Rolon alone still loads
const M0 = mergeAm(null, st, kits, null); assert.equal(M0.p.length, 5); assert.ok(M0.ty.length); assert.equal(M0.p[0][8], 'Chain sprocket kit');
// the file: made once, not again until a source changes; no Rolon folder = null
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'rolonam-')), D = path.join(T, 'rolon_dump'); fs.mkdirSync(D);
assert.equal(rolonAmFile({ baseFile: null, outFile: path.join(T, 'o.json'), dir: null }), null);
fs.writeFileSync(path.join(D, '_state.json'), JSON.stringify(st)); fs.writeFileSync(path.join(D, '_kits.json'), JSON.stringify(kits)); fs.writeFileSync(path.join(T, 'b.json'), JSON.stringify(base));
const o = rolonAmFile({ baseFile: path.join(T, 'b.json'), outFile: path.join(T, 'o.json'), dir: D }); assert.equal(JSON.parse(fs.readFileSync(o)).p.length, 6);
const m1 = fs.statSync(o).mtimeMs; rolonAmFile({ baseFile: path.join(T, 'b.json'), outFile: o, dir: D }); assert.equal(fs.statSync(o).mtimeMs, m1, 'not rebuilt');
const later = new Date(Date.now() + 5000); fs.utimesSync(path.join(D, '_state.json'), later, later);
rolonAmFile({ baseFile: path.join(T, 'b.json'), outFile: o, dir: D }); assert.ok(fs.statSync(o).mtimeMs > m1, 'rebuilt after new data');
fs.writeFileSync(path.join(D, '_state.json'), '{broken'); const l2 = new Date(Date.now() + 9000); fs.utimesSync(path.join(D, '_state.json'), l2, l2);
assert.equal(rolonAmFile({ baseFile: path.join(T, 'b.json'), outFile: o, dir: D }), null, 'half-written data = list as before');
const half = JSON.parse(JSON.stringify(st)); delete half.master['3|CAM CHAIN']; fs.writeFileSync(path.join(D, '_state.json'), JSON.stringify(half)); const l3 = new Date(Date.now() + 12000); fs.utimesSync(path.join(D, '_state.json'), l3, l3);
assert.equal(rolonAmFile({ baseFile: path.join(T, 'b.json'), outFile: o, dir: D }), o, 'a read in progress keeps the last full list'); assert.equal(JSON.parse(fs.readFileSync(o)).p.length, 6);
fs.rmSync(T, { recursive: true }); console.log('rolonam: all ok');
