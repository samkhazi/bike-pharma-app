// 22e: udhaar limit caps on the server. node tools/test_crcap22e.mjs
import { guardValue } from '../lib/billguard.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sv = { M1: { tier: 'Silver', limit: 10000, since: 'Nov 2026', kyc: 'x' } }, g = (role, v) => guardValue('vOver', sv, v, { id: 'u', role }, () => undefined, {});
ok(g('billing', { M1: { ...sv.M1, limit: 15000 } })[0].M1.limit === 15000, 'Billing gives 15,000');
ok(g('billing', { M1: { ...sv.M1, limit: 15001 } })[0].M1.limit === 10000, 'Billing cannot give 15,001');
ok(g('billing', { M1: { ...sv.M1, tier: 'Gold', limit: 12000 } })[0].M1.tier === 'Silver', 'Billing cannot change the tier');
ok(g('billing', { ...sv, M2: { tier: 'Bronze', limit: 5000 } })[0].M2.limit === 5000, 'Billing sets a first limit (Bronze)');
ok(g('manager', { M1: { ...sv.M1, limit: 50000 } })[0].M1.limit === 50000 && g('manager', { M1: { ...sv.M1, limit: 60000 } })[0].M1.limit === 10000, 'Manager up to 50,000');
ok(g('manager', { M1: { none: 1 } })[0].M1.none === 1, 'Manager can take verification away');
ok(g('sales', { M1: { ...sv.M1, limit: 100 } })[0].M1.limit === 10000 && g('inventory', {})[0].M1.limit === 10000, 'Sales / Inventory: no change');
ok(g('admin', { M1: { ...sv.M1, limit: 900000 } })[0].M1.limit === 900000, 'Admin any amount');
const big = { M1: { tier: 'Gold', limit: 40000 } }; ok(guardValue('vOver', big, { M1: { tier: 'Gold', limit: 5000 } }, { id: 'u', role: 'billing' }, () => undefined, {})[0].M1.limit === 40000, 'Billing cannot touch a limit above its cap');
process.exit(fails ? 1 : 0);
