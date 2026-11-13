// 22d: MRP / discount lock on the server. node tools/test_mrplock22d.mjs
import { guardValue } from '../lib/billguard.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const u = { id: 'm1', role: 'manager', name: 'Sunil' }, sv = { P1: { mrp: 100, price: 95, mp: 80 } }, nv = { P1: { mrp: 120, price: 114, mp: 96 } }, get = k => ({ prices: sv })[k];
const al = [{ id: 'PA1', pid: 'P1', st: 'new', why: 'new pack MRP', n: { mrp: 120, price: 114, mp: 96 } }];
let [v, n] = guardValue('prices', sv, nv, u, get, {}); ok(v.P1.mrp === 100 && n.length === 1, 'Manager without an alert row: refused');
[v, n] = guardValue('prices', sv, nv, u, get, { palerts: al }); ok(v.P1.mrp === 120 && !n.length, 'Manager with the alert row: saved');
[v, n] = guardValue('prices', sv, nv, u, get, { palerts: [{ ...al[0], why: '' }] }); ok(v.P1.mrp === 100, 'no reason: refused');
[v, n] = guardValue('prices', sv, nv, u, get, { palerts: [{ ...al[0], n: { mrp: 120, price: 110, mp: 96 } }] }); ok(v.P1.mrp === 100, 'alert with other prices: refused');
[v, n] = guardValue('prices', sv, { P1: { mrp: 100, price: 120, mp: 80 } }, u, get, { palerts: [{ ...al[0], n: { mrp: 100, price: 120, mp: 80 } }] }); ok(v.P1.price === 95, 'customer price above MRP: refused');
[v, n] = guardValue('prices', sv, nv, { id: 'b', role: 'billing' }, get, { palerts: al }); ok(v.P1.mrp === 100, 'Billing login: refused');
[v, n] = guardValue('palerts', [{ id: 'PA1', st: 'new', pid: 'P1' }], [{ id: 'PA1', st: 'ok', pid: 'P1' }, { id: 'PA2', st: 'new', pid: 'P2' }], u, get, {});
ok(v.length === 2 && v.find(a => a.id === 'PA1').st === 'new' && v.find(a => a.id === 'PA2').by === 'm1' && n.length === 1, 'Manager cannot close an alert, can add one (stamped with the login)');
[v, n] = guardValue('palerts', [{ id: 'PA1', st: 'new' }], [], u, get, {}); ok(v.length === 1, 'Manager cannot remove an alert');
[v, n] = guardValue('palerts', [{ id: 'PA1', st: 'new' }], [{ id: 'PA1', st: 'ok' }], { id: 'a', role: 'admin' }, get, {}); ok(v[0].st === 'ok', 'Admin closes it');
process.exit(fails ? 1 : 0);
