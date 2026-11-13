// 22g: return / replace requests on the server. node tools/test_rreq22g.mjs
import { guardScoped } from '../lib/custguard.mjs'; import { canWrite, applyOwn, scopeValue } from '../lib/merge.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const cu = { id: '9876501234', role: 'customer', name: 'Ravi' }, me = { id: '9000000001', role: 'mechanic', name: 'Mech', code: 'BPM-1' };
ok(canWrite('rreq', cu) === 'own' && canWrite('rreq', me) === 'own' && canWrite('rreq', { id: 's', role: 'billing', sid: 'B1' }) === 'merge', 'who may write requests');
const sv = [{ id: 'RR-OLD1', mob: '9876501234', ref: 'BP-ORD-1', kind: 'Return', st: 'Sent' }, { id: 'RR-OTH1', mob: '9111111111', ref: 'BP-ORD-9', kind: 'Return', st: 'Sent' }];
let merged = applyOwn('rreq', sv, [{ ...sv[0], st: 'Accepted' }, { id: 'RR-NEW1', mob: '9876501234', ref: 'BP-ORD-2', kind: 'Replace', why: 'Damaged', st: 'Accepted', name: 'X<b>' }, { id: 'RR-FAKE', mob: '9111111111', ref: 'x', kind: 'Return' }], cu);
let [v, n] = guardScoped('rreq', sv, merged, cu, () => undefined, {});
ok(v.find(r => r.id === 'RR-OLD1').st === 'Sent', 'a customer cannot accept the own request');
ok(v.find(r => r.id === 'RR-NEW1').st === 'Sent' && v.find(r => r.id === 'RR-NEW1').name === 'Ravi', 'a new request is always Sent, with the login name');
ok(v.filter(r => r.mob === '9111111111').length === 1 && !v.some(r => r.id === 'RR-FAKE'), 'no request under another number');
[v, n] = guardScoped('rreq', sv, applyOwn('rreq', sv, [], cu), cu, () => undefined, {}); ok(v.some(r => r.id === 'RR-OLD1'), 'a customer cannot delete a saved request');
const many = Array.from({ length: 10 }, (_, i) => ({ id: 'RR-M' + i + 'XYZ', mob: cu.id, ref: 'o' + i, kind: 'Return', st: 'Sent' }));
[v, n] = guardScoped('rreq', many, [...many, { id: 'RR-ELEVEN', mob: cu.id, ref: 'o11', kind: 'Return' }], cu, () => undefined, {}); ok(v.length === 10, 'at most 10 open requests');
const vw = scopeValue('rreq', sv, cu); ok(Array.isArray(vw) && vw.length === 1 && vw[0].id === 'RR-OLD1', 'a customer sees only the own requests');
process.exit(fails ? 1 : 0);
