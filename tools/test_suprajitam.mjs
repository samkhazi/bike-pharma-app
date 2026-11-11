// 20g: Suprajit's list joins the aftermarket list (lib/suprajitam.mjs + rolonAmFile). Sample lines shaped as tools/aftermarket/suprajit_parse.py writes them.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert';
import { mergeSuprajit } from '../lib/suprajitam.mjs'; import { rolonAmFile } from '../lib/rolonam.mjs';
const sup = { brand: 'Suprajit', oldname: 'Jan 2024', rows: [
  { pn: 'SHH0105', nm: 'Clutch Cable- I Smart', mk: 'Hero', veh: 'SPLNDR I - SMART 110 CC', sec: 'Control cable', mrp: 121, oem: ['22870AAF400S'], fit: 'SPLENDOR I - SMART 110 CC', hay: '' },
  { pn: 'SRE0114', nm: 'Clutch Cable', mk: 'Royal Enfield', veh: 'HIMALAYAN', sec: 'Control cable', mrp: 168, oem: ['574337/F'], fit: 'HIMALAYAN', hay: '' },
  { pn: 'SKB0327O', nm: 'Throttle Cable - Open', mk: 'Bajaj', veh: 'WND', sec: 'Control cable', mrp: 154, oem: ['DP191006'], oldmrp: 1, fit: 'WIND', hay: '' },
  { pn: 'SBA2001', nm: 'Chetak FR BR Inner', mk: 'Bajaj', veh: '', sec: 'Control cable', mrp: 40, oem: [], fit: '', hay: '' },
  { pn: 'SHTU0123', nm: 'SPLENDOR PRO', mk: '', veh: '', sec: 'Tank unit', mrp: 393, oem: ['37800KWA930S'], fit: '', hay: 'SPLENDOR PRO' },
  { pn: 'SBAF2001', nm: 'PULSAR 150/180 - FOAM AIR FILTER Foam', mk: '', veh: '', sec: 'Filter', mrp: 60, oem: [], fit: '', hay: 'PULSAR 150/180 - FOAM AIR FILTER FOAM' },
  { pn: 'SHH0105', nm: 'twice', mk: 'Hero', veh: '', sec: 'Control cable', mrp: 1, oem: [], fit: '', hay: '' }] };
const base = { src: 'old', b: ['Suprajit', 'Rolon'], ob: ['Bajaj'], ty: [['Chain sprocket kit', 'SPROCKET']],
  p: [[0, 'OLDSUP', 'Old cable', 'Cables', 50, 'X', [], [], '', [], [], ''], [1, 'KIT1', 'Chain sprocket kit', 'Rolon kit', 900, 'BAJAJ: X', [], [], 'Chain sprocket kit', [], [], '']] };
const xref = { b: ['Hero', 'Royal Enfield', 'Bajaj'], m: [['Splendor Pro', 'Splendor iSmart 110'], ['Himalayan'], ['Pulsar 150']] };
const M = mergeSuprajit(base, sup, xref), by = Object.fromEntries(M.p.map(p => [p[1], p]));
assert.equal(M.p.length, 7, 'six Suprajit lines (a number once) + Rolon'); assert.ok(!by.OLDSUP, 'old Suprajit line gone'); assert.ok(by.KIT1, 'Rolon stays');
assert.equal(M.b.filter(b => b === 'Suprajit').length, 1); assert.ok(M.p.every(p => p.length === 12));
assert.deepEqual(by.SHH0105[6], ['22870AAF400S']); assert.equal(by.SHH0105[8], 'Clutch cable'); assert.equal(by.SHH0105[4], 121); assert.equal(by.SHH0105[5], 'Hero: SPLENDOR I - SMART 110 CC');
assert.deepEqual(by.SRE0114[9].map(([b, m]) => M.ob[b] + ' ' + m), ['Royal Enfield Himalayan']);
assert.match(by.SKB0327O[2], /MRP of the Jan 2024 list/); assert.equal(by.SKB0327O[8], 'Throttle cable');
assert.equal(by.SBA2001[8], 'Front brake cable');
assert.equal(by.SHTU0123[2], 'Tank unit · SPLENDOR PRO'); assert.equal(by.SHTU0123[8], 'Tank unit'); assert.deepEqual(by.SHTU0123[9].map(([b, m]) => M.ob[b] + ' ' + m), ['Hero Splendor Pro']);
assert.equal(by.SBAF2001[8], 'Air filter'); assert.deepEqual(by.SBAF2001[9].map(([b, m]) => M.ob[b] + ' ' + m), ['Bajaj Pulsar 150']);
// kinds read the bike makers' own names too
const ty = n => { for (const [k, x] of M.ty) if (new RegExp(x).test(n)) return k; return ''; };
assert.equal(ty('CABLE COMP, CLUTCH'), 'Clutch cable'); assert.equal(ty('CABLE ASSY THROTTLE'), 'Throttle cable'); assert.equal(ty('CABLE COMP, FR. BRAKE'), 'Front brake cable'); assert.equal(ty('WIRE, SPEEDOMETER'), 'Speedometer cable');
assert.equal(ty('CLUTCH PLATE'), 'Clutch plate'); assert.equal(ty('CHAIN SPROCKET KIT'), 'Chain sprocket kit');
// the file: Suprajit alone (no Rolon folder), made once, again when the list changes; no list = null
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'supam-')), sf = path.join(T, 'suprajit.json'), of = path.join(T, 'o.json');
assert.equal(rolonAmFile({ baseFile: null, outFile: of, dir: null, supFile: sf }), null);
fs.writeFileSync(sf, JSON.stringify(sup));
assert.equal(rolonAmFile({ baseFile: null, outFile: of, dir: null, supFile: sf }), of);
const O = JSON.parse(fs.readFileSync(of, 'utf8')); assert.equal(O.p.length, 6); assert.deepEqual(O.b, ['Suprajit']);
const m1 = fs.statSync(of).mtimeMs; rolonAmFile({ baseFile: null, outFile: of, dir: null, supFile: sf }); assert.equal(fs.statSync(of).mtimeMs, m1, 'not made again');
// 20h: a second company's list (Spark Minda) joins the same way; both stay
const sm = { brand: 'Spark Minda', rows: [
  { pn: 'KT-1957AZ', nm: 'Lock Kit (Set of 5) for CD100', mk: 'Hero', veh: 'CD -100', sec: 'Lock kit', mrp: 465, oem: ['35010198900S'], fit: 'CD -100', hay: 'Lock Kit (Set of 5) for CD100' },
  { pn: 'SW-1154Z', nm: 'Ignition Switch Victor GL/GX', mk: 'TVS', veh: 'VICTOR', sec: 'Ignition switch', mrp: 467, oem: ['N2160070'], fit: 'VICTOR', hay: 'Ignition Switch Victor GL/GX' },
  { pn: 'LK-4271Z', nm: 'Steering Lock CD-100', mk: 'Hero', veh: 'CD -100', sec: 'Lock', mrp: 141, oem: [], fit: 'CD -100', hay: 'Steering Lock CD-100' },
  { pn: 'CC-104', nm: 'Clutch Cable', mk: 'Hero', veh: 'S.SPLENDER/GLAMOUR', sec: 'Control cable', mrp: 116, oem: ['22870KTC900S'], fit: 'S.SPLENDER/GLAMOUR', hay: '' },
  { pn: 'WH-1098CB', nm: 'Glamour New Model 2011', mk: 'Hero', veh: 'GLAMOUR', sec: 'Wiring harness', mrp: 1129, oem: ['32100-KTR-A00S'], fit: 'GLAMOUR', hay: 'Glamour New Model 2011' }] };
const M2 = mergeSuprajit(M, sm, xref), b2 = Object.fromEntries(M2.p.map(p => [p[1], p]));
assert.equal(M2.p.length, 12); assert.deepEqual(M2.b.slice(-1), ['Spark Minda']); assert.ok(b2.SHH0105 && b2.KIT1);
assert.equal(b2['KT-1957AZ'][8], 'Lock kit'); assert.equal(b2['SW-1154Z'][8], 'Ignition switch'); assert.equal(b2['LK-4271Z'][8], 'Lock'); assert.equal(b2['CC-104'][8], 'Clutch cable'); assert.equal(b2['WH-1098CB'][8], 'Wiring harness');
assert.equal(b2['WH-1098CB'][3], 'Spark Minda wiring harness'); assert.equal(b2['CC-104'][5], 'Hero: S.SPLENDER/GLAMOUR');
const ty2 = n => { for (const [k, x] of M2.ty) if (new RegExp(x).test(n)) return k; return ''; };
assert.equal(ty2('HARNESS, WIRE'), 'Wiring harness'); assert.equal(ty2('SWITCH ASSY, COMBINATION'), 'Ignition switch'); assert.equal(ty2('CABLE COMP, CLUTCH'), 'Clutch cable'); assert.equal(ty2('SEAT LOCK CABLE'), 'Seat lock cable');
const sf2 = path.join(T, 'sparkminda.json'); fs.writeFileSync(sf2, JSON.stringify(sm));
assert.equal(rolonAmFile({ baseFile: null, outFile: of, dir: null, supFiles: [sf, sf2, path.join(T, 'none.json')] }), of);
const O2 = JSON.parse(fs.readFileSync(of, 'utf8')); assert.equal(O2.p.length, 11); assert.deepEqual(O2.b, ['Suprajit', 'Spark Minda']);
fs.rmSync(T, { recursive: true }); console.log('suprajitam: all ok');
