// First run: the logins and a small sample stock (so every page can be tried). EMPTY_START=1 makes only the owner login
// (for going live; the real parts come from the old billing database with `npm run import-old`).
'use strict';
const db = require('./db');
const auth = require('./auth');
const inv = require('./inv');
const C = require('./clock');

const SAMPLE_ACCOUNTS = [   // one staff list for every portal (STAFF-AND-LOGINS.md)
  { name: 'Saddam', phone: '9820000111', role: 'owner' },
  { name: 'Inventory Manager', phone: '9820000444', role: 'manager' },   // name to be given by Sam
  { name: 'Prasad', phone: '9845012233', role: 'store' },               // workshop spares, sits with the mechanics
  { name: 'Mehek Taj', phone: '9845000333', role: 'store' },            // The Moto Lab items
  { name: 'Accountant', phone: '9820000222', role: 'accountant' },
  // Inventory 2.0 (Bike Pharma restock flow)
  { name: 'Misba', phone: '9811120456', role: 'cashier' },
  { name: 'Nagaraj', phone: '9876543211', role: 'supervisor' },
  { name: 'Ganesh', phone: '9876543210', role: 'manager' },
  { name: 'Counter 1', phone: '9741100231', role: 'counter', ctr: 'C1' },
  { name: 'Counter 2', phone: '9741100232', role: 'counter', ctr: 'C2' },
  { name: 'Counter 3', phone: '9741100233', role: 'counter', ctr: 'C3' },
  { name: 'Counter 4', phone: '9741100234', role: 'counter', ctr: 'C4' },
];

const BS_PARTS = [
  // pno, name, brand, model, mrp, cost, gst, hsn, stock, alert, rack, sold in 90 days
  ['64200-KZK-E40ZA', 'Front cover set (illus)', 'HONDA', 'Dio', 1822, 1500, 28, '87141090', 2, 1, 'D1', 3],
  ['61310-K23-D60', 'Cover assembly H/L (meter inner)', 'HONDA', 'CB 110', 243, 163, 28, '87141090', 3, 1, 'D1', 1],
  ['15400-KWN-901', 'Oil filter element', 'HONDA', 'Activa / Shine', 160, 110, 18, '84212300', 40, 15, 'A2', 64],
  ['06455-KVR-405', 'Brake shoe set front', 'HONDA', 'Shine / Unicorn', 420, 300, 28, '87141090', 9, 6, 'B1', 22],
  ['31916-KRM-841', 'Spark plug CPR8EA-9', 'NGK', 'Universal 110-125cc', 145, 98, 28, '85111000', 4, 10, 'A1', 51],
  ['MOTUL-3100-1L', 'Engine oil 10W30 1 L', 'MOTUL', 'Universal', 520, 410, 18, '27101980', 30, 12, 'OIL', 75],
  ['CASTROL-ACT-900', 'Activ 4T 20W40 900 ml', 'CASTROL', 'Universal', 380, 300, 18, '27101980', 0, 10, 'OIL', 40],
  ['17220-KWP-900', 'Air filter element', 'HONDA', 'Activa 125', 280, 200, 28, '84213100', 6, 4, 'A3', 12],
  ['DID-428H-132', 'Chain 428H 132L', 'DID', 'Universal 150cc', 980, 760, 28, '73151100', 5, 3, 'C1', 8],
  ['JS351002', 'Clutch plate set', 'BAJAJ', 'Pulsar 150', 860, 640, 28, '87141090', 1, 2, 'C2', 6],
  ['DJ101019', 'Brake pad front', 'BAJAJ', 'Pulsar 220 / NS200', 450, 330, 28, '87141090', 7, 4, 'B2', 14],
  ['N9040040', 'Speedo cable', 'TVS', 'Apache RTR 160', 210, 150, 28, '87141090', 8, 3, 'E1', 0],
  ['K4120780', 'Fork oil seal pair', 'TVS', 'Jupiter', 240, 170, 28, '40169330', 12, 4, 'E2', 9],
  ['5VD-E3440-00', 'Oil filter', 'YAMAHA', 'FZ / R15', 190, 140, 18, '84212300', 14, 6, 'A2', 18],
  ['RE-570081', 'Clutch cable', 'ROYAL ENFIELD', 'Classic 350', 520, 390, 28, '87141090', 3, 2, 'F1', 4],
  ['BOSCH-H4-12V', 'Headlight bulb H4 12V', 'BOSCH', 'Universal', 330, 220, 28, '85392190', 0, 5, 'L1', 11],
  ['MRF-90-100-10', 'Tyre 90/100-10 Zapper', 'MRF', 'Activa / Jupiter', 1650, 1380, 28, '40114010', 4, 2, 'T1', 7],
  ['EXIDE-XLTZ5', 'Battery XLTZ5', 'EXIDE', 'Universal 110cc', 1850, 1480, 28, '85071000', 2, 2, 'BAT', 5],
  ['PIAGGIO-CVT-B', 'CVT belt', 'PIAGGIO', 'Vespa 125', 1450, 1100, 28, '40103999', 1, 0, 'C3', 0],
];
const ML_ITEMS = [
  // sku, name, brand, cat, size, mrp, cost, stock, alert, rack, wty, sold
  ['AX-STR-M', 'Axor Street helmet', 'AXOR', 'Helmets', 'M', 2500, 1850, 4, 3, 'H1', 12, 6],
  ['AX-STR-L', 'Axor Street helmet', 'AXOR', 'Helmets', 'L', 2500, 1850, 2, 3, 'H1', 12, 5],
  ['RYN-GLV-M', 'Rynox Air GT gloves', 'RYNOX', 'Riding gear', 'M', 1950, 1450, 5, 2, 'G2', 6, 3],
  ['HJG-FOG-P', 'HJG LED fog lights (pair)', 'HJG', 'Lights', '', 2850, 2100, 3, 2, 'L3', 6, 4],
  ['VPR-TB-30', 'Viaterra tail bag 30 L', 'VIATERRA', 'Luggage', '', 3400, 2500, 1, 1, 'B4', 0, 0],
  ['MTL-CHN-LUB', 'Motul chain lube 150 ml', 'MOTUL', 'Bike care', '', 450, 330, 12, 5, 'C1', 0, 14],
];

function loadSample() {
  const me = { id: null, name: 'Sample', role: 'owner' };
  const now = C.now();
  const ago = n => C.ymd(C.addDays(now, -n));
  // vendors
  const v1 = inv.saveVendor(me, null, { name: 'Sri Ganesh Auto Distributors', phone: '9448012345', gstin: '29ABCDE1234F1Z5', address: 'P B Road, Davanagere', days: 30 }).id;
  const v2 = inv.saveVendor(me, null, { name: 'Karnataka Lubricants', phone: '9448098765', address: 'Hubballi', days: 15 }).id;
  const v3 = inv.saveVendor(me, null, { name: 'Moto Gear Hub', phone: '9845011122', address: 'Bengaluru', days: 7, opening: 4200 }).id;
  const ids = {};
  for (const [pno, name, brand, model, mrp, cost, gst, hsn, stock, alert, rack] of BS_PARTS)
    ids[pno] = inv.addPart(me, { store: 'BS', pno, name, brand, model, mrp, cost, gst, hsn, stock, alert, rack, dUser: 0, dWhole: 10, dMech: 7, ref: 'Opening stock' }).id;
  for (const [sku, name, brand, cat, size, mrp, cost, stock, alert, rack, wty] of ML_ITEMS)
    ids[sku] = inv.addPart(me, { store: 'ML', pno: sku, name, brand, cat, size, mrp, cost, gst: 18, hsn: cat === 'Helmets' ? '65061010' : '87149990', stock, alert, rack, wty, ref: 'Opening stock' }).id;
  // sales spread over the last 90 days (stock above is what is left today, so the sales do not move it)
  let n = 1;
  for (const [pno, , , , mrp, , , , , , , sold] of BS_PARTS) for (let i = 0; i < sold; i++)
    db.run('INSERT INTO sales (store, bill, day, part, pno, name, qty, rate, src) VALUES (?,?,?,?,?,?,?,?,?)', 'BS', `BS-${4000 + (n++ % 700)}`, ago((i * 7 + pno.length) % 88 + 1), ids[pno], pno, '', 1, mrp, 'billing');
  for (const [sku, , , , , mrp, , , , , , sold] of ML_ITEMS) for (let i = 0; i < sold; i++)
    db.run('INSERT INTO sales (store, bill, day, part, pno, name, qty, rate, src) VALUES (?,?,?,?,?,?,?,?,?)', 'ML', `ML-${1700 + (n++ % 150)}`, ago((i * 11) % 80 + 1), ids[sku], sku, '', 1, mrp, 'motolab');
  db.run('UPDATE parts SET last_sale = (SELECT max(day) FROM sales s WHERE s.part = parts.id)');
  db.run("UPDATE parts SET added_at = ? WHERE store = 'BS'", C.stamp(C.addDays(now, -200)));
  // a vendor bill paid in part, one due soon, one late
  const b1 = inv.stockIn(me, { vendor: v1, invNo: 'SGA/2026/1182', invDate: ago(40), lines: [{ part: ids['15400-KWN-901'], qty: 20, rate: 110 }, { part: ids['06455-KVR-405'], qty: 10, rate: 300 }] });
  inv.pay(me, b1.id, { amount: 3000, mode: 'Bank', ref: 'NEFT 88123', day: ago(20) });
  inv.stockIn(me, { vendor: v2, invNo: 'KL-5521', invDate: ago(12), lines: [{ part: ids['MOTUL-3100-1L'], qty: 24, rate: 410, gst: 18 }] });
  inv.stockIn(me, { vendor: v3, invNo: 'MGH-0907', invDate: ago(4), store: 'ML', lines: [{ part: ids['RYN-GLV-M'], qty: 4, rate: 1450 }] });
  // the stock-in moves above added pieces: bring the shelves back to the sample counts
  for (const [code, want] of [...BS_PARTS.map(p => [p[0], p[8]]), ...ML_ITEMS.map(p => [p[0], p[7]])]) {
    const p = inv.partRow(ids[code]);
    if (p.stock !== want) inv.move(me, p.id, want - p.stock, 'sale', { ref: 'Sample sales', src: 'billing', allowNegative: true });
  }
  inv.transfer(me, { dir: 'dvg-rnr', part: ids['15400-KWN-901'], qty: 5, margin: 8, note: 'RNR branch short' });
  inv.addOrder(me, { part: ids['CASTROL-ACT-900'], qty: 24, vendor: 'Karnataka Lubricants', promise: C.ymd(C.addDays(now, 1)) });
  inv.addOrder(me, { part: ids['BOSCH-H4-12V'], qty: 10, vendor: 'Sri Ganesh Auto Distributors' });
  inv.startCount({ id: null, name: 'Prasad', role: 'store' }, { rack: 'A2', lines: [{ part: ids['15400-KWN-901'], counted: 34 }, { part: ids['5VD-E3440-00'], counted: 14 }] });
  db.run('DELETE FROM outbox');   // sample rows are not sent anywhere
  db.run("DELETE FROM alerts WHERE kind IN ('low','out','neg')");
  inv.dailyAlerts(true); db.run("DELETE FROM outbox WHERE target = 'whatsapp'"); db.run("DELETE FROM settings WHERE key = 'daily_done'");
}

// Returns true when it loaded anything
function seed({ force = false } = {}) {
  const hasAccounts = db.one('SELECT count(*) n FROM accounts').n > 0;
  if (hasAccounts && !force) return false;
  const pin = process.env.SEED_PIN || '1234';
  const empty = process.env.EMPTY_START === '1';
  db.tx(() => {
    if (force) for (const t of ['counts', 'order_sheet', 'transfers', 'vendor_returns', 'vendor_payments', 'vendor_bill_lines', 'vendor_bills', 'vendors', 'sales', 'stock_moves', 'photos', 'parts', 'alerts', 'outbox', 'pull_marks']) db.run(`DELETE FROM ${t}`);
    if (force) db.run("DELETE FROM settings WHERE key LIKE 'seq_%'");
    if (!hasAccounts) for (const a of SAMPLE_ACCOUNTS) if (!empty || a.role === 'owner') auth.addAccount({ ...a, pin });
    if (!empty && db.one('SELECT count(*) n FROM parts').n === 0) loadSample();   // never over real parts (old data loaded before the first start)
  });
  return true;
}

module.exports = { seed, SAMPLE_ACCOUNTS };

if (require.main === module) {
  db.open();
  console.log(seed({ force: process.argv.includes('--force') }) ? 'Data loaded.' : 'Database already has data. Use --force to reload the sample (logins are kept).');
}
