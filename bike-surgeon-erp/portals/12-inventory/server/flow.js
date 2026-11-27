// Inventory 2.0 · Bike Pharma restock flow (Sam's meeting note + ERP 2.0 flowchart, 5 Nov 2026).
//   1 Accountant: vendors with credit days, dues, payment calendar, due date changes need a reason (kept in history)
//   2 Cashier: uploads the vendor bill (AI reads the lines), picks the vendor; due date = bill date + credit days
//   3 Supervisor: New stock; checks the purchase discount (% only, never rupees), gives items to the brand
//     counters. Pending → Assigned → Inventory updated. 1 day.
//   4 Manager: selling % + customer / mechanic / wholesaler discount %, Update. 1 day. Email the same day.
//   5 Counter: own items, shelf no., submit into stock. Only after the manager priced it ("Contact your manager").
// Stock only goes up at step 5, so an item that has no selling price cannot be sold.
'use strict';
const db = require('./db');
const C = require('./clock');
const inv = require('./inv');

const { fail, httpError, stamp, today, audit, pkeyOf } = inv;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const int = n => Math.round(Number(n) || 0);
const txt = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const STORE = 'BP';
const TAT_H = 24;   // hours for the supervisor, and again for the manager

// ---- counters and brands (owner can change them in Settings) --------------------------------------------------------
const CTR_DEFAULT = { C1: ['Hero', 'Honda'], C2: ['Bajaj', 'TVS'], C3: ['Suzuki', 'Royal Enfield'], C4: ['Yamaha', 'KTM'] };
function counters() {
  try { const v = JSON.parse(db.setting('counter_brands', '')); if (v && typeof v === 'object' && Object.keys(v).length) return v; } catch (e) { /* default */ }
  return CTR_DEFAULT;
}
const brandKey = b => String(b || '').toUpperCase().replace(/[^A-Z]/g, '').replace(/^RE$/, 'ROYALENFIELD');
function ctrOf(brand) {
  const k = brandKey(brand);
  if (!k) return '';
  for (const [c, list] of Object.entries(counters())) if (list.some(b => brandKey(b) === k)) return c;
  return '';
}
const brandList = () => [...new Set(Object.values(counters()).flat())];
function setCounters(me, b) {
  const out = {};
  for (const [c, list] of Object.entries(b || {})) {
    if (!/^C[1-9]$/.test(c)) fail(400, `Counter ${c} must be C1 to C9.`);
    out[c] = (Array.isArray(list) ? list : String(list).split(',')).map(x => txt(x, 40)).filter(Boolean);
  }
  if (!Object.keys(out).length) fail(400, 'Give at least one counter.');
  db.setSetting('counter_brands', JSON.stringify(out));
  audit(me, 'counter brands changed', JSON.stringify(out));
  return 'Counters saved.';
}

// ---- money helpers ---------------------------------------------------------------------------------------------------
// Purchase discount % on MRP: (MRP − rate with GST) / MRP (same as the Bike Pharma bill reader)
const discOf = (mrp, rate, gst) => (mrp > 0 ? r2((mrp - rate * (1 + gst / 100)) / mrp * 100) : null);
const costOf = (mrp, disc) => r2(mrp * (1 - disc / 100));                       // purchase price per piece, with GST
// Customer / mechanic / wholesaler % are off the selling price. The parts list keeps % off MRP (what every portal
// already uses), so the same final price is saved as % off MRP.
const offMrp = (mrp, sell, d) => (mrp > 0 ? r2((1 - sell * (1 - d / 100) / mrp) * 100) : 0);
const hoursSince = at => (at ? (C.now() - C.parse(at)) / 3600000 : 0);
const tat = at => { const h = hoursSince(at); return { hours: Math.round(h * 10) / 10, left: Math.round((TAT_H - h) * 10) / 10, late: h > TAT_H }; };

// ---- 1 · accountant ----------------------------------------------------------------------------------------------------
function payStatus(b) {
  if (b.status === 'CANCELLED') return 'Cancelled';
  if (b.status === 'CLEARED') return 'Full paid';
  if (b.paid > 0) return 'Partial paid';
  return 'Not paid';
}
const billRow = b => ({ ...b, balance: b.status === 'PENDING' ? r2(b.amount - b.paid) : 0,   // a cleared bill (vendor gave a discount for the rest) has nothing left
  late: b.status === 'PENDING' && !!b.due && b.due < today(), pay: payStatus(b),
  edits: db.one('SELECT count(*) n FROM due_edits WHERE bill = ?', b.id).n });

function dues(me, o = {}) {
  const where = ["b.status != 'CANCELLED'"], args = [];
  if (o.vendor) { where.push('b.vendor = ?'); args.push(int(o.vendor)); }
  if (o.show === 'open' || !o.show) where.push("b.status = 'PENDING'");
  if (o.show === 'paid') where.push("b.status = 'CLEARED'");
  const bills = db.all(`SELECT b.*, v.name vendor_name, v.days vendor_days, v.acc_name, v.acc_no, v.ifsc, v.bank_name, v.branch, v.bank vendor_upi FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE ${where.join(' AND ')} ORDER BY b.due, b.id LIMIT 1000`, ...args).map(billRow);
  const t = today(), wk = C.ymd(C.addDays(C.now(), 7));
  const open = bills.filter(b => b.status === 'PENDING');
  return { bills, kpi: { due: r2(open.reduce((s, b) => s + b.balance, 0)), week: r2(open.filter(b => b.due >= t && b.due <= wk).reduce((s, b) => s + b.balance, 0)),
    late: r2(open.filter(b => b.late).reduce((s, b) => s + b.balance, 0)), lateBills: open.filter(b => b.late).length } };
}

function editDue(me, id, b) {
  const bill = db.one('SELECT * FROM vendor_bills WHERE id = ?', int(id)) || fail(404, 'Vendor bill not found.');
  if (bill.status !== 'PENDING') fail(400, `This bill is ${bill.status === 'CLEARED' ? 'fully paid' : 'cancelled'}. Its due date cannot change.`);
  const nd = isDay(b.due) ? b.due : fail(400, 'Pick the new due date.');
  const why = txt(b.why, 300);
  if (why.length < 5) fail(400, 'Write the reason for the change (at least a few words).');
  if (nd === bill.due) fail(400, 'This is the same due date.');
  if (nd < bill.inv_date) fail(400, 'The due date cannot be before the bill date.');
  return db.tx(() => {
    db.run('INSERT INTO due_edits (bill, old, new, why, by, at) VALUES (?,?,?,?,?,?)', bill.id, bill.due, nd, why, me.name, stamp());
    db.run('UPDATE vendor_bills SET due = ? WHERE id = ?', nd, bill.id);
    audit(me, 'due date changed', `${bill.no} ${bill.due} → ${nd}: ${why}`);
    return { msg: `Due date of ${bill.inv_no} changed to ${C.dmy(C.parse(nd))}. Saved in the edit history.` };
  });
}
const dueHistory = (o = {}) => db.all(`SELECT e.*, b.no, b.inv_no, v.name vendor_name FROM due_edits e JOIN vendor_bills b ON b.id = e.bill JOIN vendors v ON v.id = b.vendor
  ${o.vendor ? 'WHERE b.vendor = ?' : o.bill ? 'WHERE e.bill = ?' : ''} ORDER BY e.id DESC LIMIT 300`, ...(o.vendor ? [int(o.vendor)] : o.bill ? [int(o.bill)] : []));

// Payment calendar: every open bill on its due day, plus what was paid each day of that month
function calendar(me, month) {
  const m = /^\d{4}-\d{2}$/.test(String(month || '')) ? month : today().slice(0, 7);
  const from = `${m}-01`, to = `${m}-31`;
  const bills = db.all(`SELECT b.*, v.name vendor_name, v.acc_name, v.acc_no, v.ifsc, v.bank_name, v.branch, v.bank vendor_upi FROM vendor_bills b JOIN vendors v ON v.id = b.vendor
    WHERE b.status = 'PENDING' AND b.due >= ? AND b.due <= ? ORDER BY b.due, v.name`, from, to).map(billRow);
  const late = db.all(`SELECT b.*, v.name vendor_name, v.acc_name, v.acc_no, v.ifsc, v.bank_name, v.branch, v.bank vendor_upi FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.status = 'PENDING' AND b.due < ? ORDER BY b.due`, today()).map(billRow);
  const paid = db.all(`SELECT p.day, sum(p.amount) amount, count(*) n FROM vendor_payments p WHERE p.day >= ? AND p.day <= ? GROUP BY p.day`, from, to);
  return { month: m, bills, late, paid };
}

// ---- 2 · cashier: upload a vendor bill -----------------------------------------------------------------------------
// The AI read result is kept here for 3 hours (never on disk), so the MRP the cashier sends back can be checked against it.
const READS = new Map();
function keepRead(lines, meta) {
  const id = require('node:crypto').randomBytes(9).toString('base64url');
  READS.set(id, { at: Date.now(), lines, meta });
  for (const [k, v] of READS) if (Date.now() - v.at > 3 * 3600000) READS.delete(k);
  return id;
}
const findBP = pno => { const k = pkeyOf(pno); return k ? db.one("SELECT * FROM parts WHERE store = 'BP' AND pkey = ? AND active = 1 ORDER BY stock DESC, id LIMIT 1", k) : null; };

// What the cashier sees after reading: each line with the list's part (if any), MRP locked
function lookLines(lines) {
  return (lines || []).slice(0, 300).map(l => {
    const p = findBP(l.pno);
    return { pno: txt(l.pno, 40), name: txt(l.name || (p && p.name), 120), brand: txt(l.brand || (p && p.brand), 40), qty: int(l.qty) || 1, rate: r2(l.rate), gst: l.gst != null ? r2(l.gst) : (p ? p.gst : 18),
      hsn: txt(l.hsn || (p && p.hsn), 12), mrp: l.mrp > 0 ? r2(l.mrp) : p ? p.mrp : 0, mrpFrom: l.mrp > 0 ? 'bill' : p && p.mrp ? 'list' : '', part: p ? p.id : null, inList: !!p };
  });
}

function uploadBill(me, b) {
  const v = db.one('SELECT * FROM vendors WHERE id = ?', int(b.vendor)) || fail(400, 'Pick the vendor from the list.');
  if (!v.active) fail(400, `${v.name} is switched off. Ask the accountant.`);
  const invNo = txt(b.invNo, 40) || fail(400, "Type the vendor's bill number.");
  const invDate = isDay(b.invDate) ? b.invDate : fail(400, 'Pick the bill date.');
  if (invDate > today()) fail(400, 'Bill date is in the future.');
  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (!lines.length || lines.length > 300) fail(400, 'The bill needs 1 to 300 lines.');
  const read = b.readId ? READS.get(String(b.readId)) : null;
  const locked = me.role === 'cashier';
  return db.tx(() => {
    const dup = db.one("SELECT no FROM vendor_bills WHERE vendor = ? AND upper(inv_no) = upper(?) AND status != 'CANCELLED'", v.id, invNo);
    if (dup && !b.dupOk) throw httpError(409, `Bill ${invNo} of ${v.name} is already entered (${dup.no}).`, { dup: dup.no });
    const no = inv_nextNo();
    const due = C.ymd(C.addDays(C.parse(invDate), v.days));
    const r = db.run(`INSERT INTO vendor_bills (no, store, vendor, inv_no, inv_date, due, amount, notes, by, at, posted, flow, stage, sent_at, read_note)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,1,'nagaraj',?,?)`, no, STORE, v.id, invNo, invDate, due, 0, txt(b.notes, 300), me.name, stamp(), stamp(), read ? 'AI read' : txt(b.readNote, 120) || 'Typed by hand');
    const billId = Number(r.lastInsertRowid);
    let total = 0;
    lines.forEach((l, i) => {
      const bad = m => fail(400, `Line ${i + 1}: ${m}`);
      const qty = int(l.qty), rate = r2(l.rate), gst = r2(l.gst ?? 18);
      if (!(qty > 0)) bad('quantity must be above 0.');
      if (!(rate > 0)) bad('rate must be above 0.');
      if (!inv.gstSlabs().includes(gst)) bad(`GST must be one of: ${inv.gstSlabs().join(', ')} %.`);
      let p = l.part ? db.one("SELECT * FROM parts WHERE id = ? AND store = 'BP'", int(l.part)) : findBP(l.pno);
      // MRP: from the AI read, else from the parts list. The cashier cannot change it; only a new part without either gets a typed MRP.
      const fromRead = read && read.lines.find(x => pkeyOf(x.pno) && pkeyOf(x.pno) === pkeyOf(l.pno) && x.mrp > 0);
      let mrp = r2(l.mrp), mrpBy = 'bill';
      if (locked && fromRead) mrp = r2(fromRead.mrp);
      else if (locked && p && p.mrp > 0) { mrp = p.mrp; mrpBy = 'list'; }
      else if (locked) mrpBy = 'typed';
      if (!(mrp > 0)) bad('MRP is needed.');
      if (rate * (1 + gst / 100) > mrp + 0.5) bad(`rate with GST (₹${r2(rate * (1 + gst / 100))}) is more than the MRP ₹${mrp}.`);
      const pno = txt(l.pno, 40) || (p && p.pno) || bad('part number is needed.');
      const name = txt(l.name, 120) || (p && p.name) || bad('part name is needed.');
      const brand = txt(l.brand, 40) || (p && p.brand) || '';
      if (!p) {
        const { id } = inv.addPart(me.role === 'cashier' ? { ...me, role: 'manager' } : me, { store: STORE, pno, name, brand, mrp, gst, hsn: txt(l.hsn, 12), stock: 0, sameNoOk: true });
        p = db.one('SELECT * FROM parts WHERE id = ?', id);
        db.run('UPDATE parts SET added_by = ? WHERE id = ?', me.name, id);
      }
      const amount = r2(qty * rate * (1 + gst / 100));
      total += amount;
      const disc = discOf(mrp, rate, gst);
      db.run(`INSERT INTO vendor_bill_lines (bill, part, pno, name, hsn, gst, qty, rate, mrp, amount, brand, cost, disc, disc_bill, mrp_by, ctr, st)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`, billId, p.id, pno, name, txt(l.hsn, 12) || p.hsn, gst, qty, rate, mrp, amount, brand, r2(rate * (1 + gst / 100)), disc, disc, mrpBy, ctrOf(brand));
    });
    const amount = Number(b.amount) > 0 ? r2(b.amount) : r2(Math.round(total));
    db.run('UPDATE vendor_bills SET amount = ? WHERE id = ?', amount, billId);
    if (Math.abs(amount - total) > Math.max(5, total * 0.02)) inv.addAlert('bill', no, `${no} (${v.name} ${invNo}): bill total ₹${amount} but lines add up to ₹${r2(total)}. Check it.`, { key: `billdiff:${billId}`, roles: 'owner,manager,accountant' });
    inv.addAlert('newstock', no, `New stock: ${v.name} bill ${invNo}, ${lines.length} items. Check the discount and give them to the counters.`, { roles: 'owner,supervisor', push: true, key: `ns:${billId}` });
    audit(me, 'vendor bill uploaded', `${no} ${v.name} ${invNo} ₹${amount}, ${lines.length} lines`);
    return { id: billId, no, msg: `${invNo} sent to the Supervisor (New stock). Pay ₹${amount.toLocaleString('en-IN')} by ${C.dmy(C.parse(due))}.` };
  });
}
function inv_nextNo() {
  let n = Number(db.setting('seq_VB', 0)) + 1;
  while (db.one('SELECT 1 FROM vendor_bills WHERE no = ?', `VB-${String(n).padStart(4, '0')}`)) n++;
  db.setSetting('seq_VB', n);
  return `VB-${String(n).padStart(4, '0')}`;
}
const myUploads = me => db.all(`SELECT b.id, b.no, b.inv_no, b.inv_date, b.amount, b.stage, b.at, v.name vendor_name, (SELECT count(*) FROM vendor_bill_lines WHERE bill = b.id) items
  FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.flow = 1 ${me.role === 'cashier' ? 'AND b.by = ?' : ''} ORDER BY b.id DESC LIMIT 100`, ...(me.role === 'cashier' ? [me.name] : []));

// ---- 3 · supervisor: New stock -------------------------------------------------------------------------------------
// What each role may see of a line: the counter never sees cost or discount; the supervisor sees discount % only.
function lineOut(l, me) {
  const o = { id: l.id, bill: l.bill, part: l.part, pno: l.pno, name: l.name, brand: l.brand, qty: l.qty, mrp: l.mrp, gst: l.gst, hsn: l.hsn, ctr: l.ctr, st: l.st, shelf: l.shelf,
    sell: l.sell, dUser: l.d_user, dMech: l.d_mech, dWhole: l.d_whole, asgBy: l.asg_by, asgAt: l.asg_at, prBy: l.pr_by, prAt: l.pr_at, skBy: l.sk_by, skAt: l.sk_at, mrpBy: l.mrp_by };
  if (['owner', 'manager', 'supervisor'].includes(me.role)) Object.assign(o, { disc: l.disc, discBill: l.disc_bill });
  if (['owner', 'manager'].includes(me.role)) Object.assign(o, { rate: l.rate, cost: l.cost, sellPct: l.sell_pct, amount: l.amount });
  if (me.role === 'cashier' || me.role === 'accountant') Object.assign(o, { rate: l.rate, amount: l.amount });
  return o;
}
const billHead = b => ({ id: b.id, no: b.no, invNo: b.inv_no, invDate: b.inv_date, vendor: b.vendor_name, vendorId: b.vendor, stage: b.stage, by: b.by, at: b.at, sentAt: b.sent_at,
  asgAt: b.asg_at, pricedAt: b.priced_at, doneAt: b.done_at, readNote: b.read_note });

function newStock(me, o = {}) {
  const bills = db.all(`SELECT b.*, v.name vendor_name FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.flow = 1 AND b.status != 'CANCELLED' ORDER BY b.id DESC LIMIT 400`);
  const lines = db.all(`SELECT bill, st, brand, count(*) n FROM vendor_bill_lines WHERE bill IN (SELECT id FROM vendor_bills WHERE flow = 1) GROUP BY bill, st, brand`);
  const rows = bills.map(b => {
    const ls = lines.filter(x => x.bill === b.id), cnt = st => ls.filter(x => x.st === st).reduce((s, x) => s + x.n, 0);
    const items = ls.reduce((s, x) => s + x.n, 0);
    const st = b.stage === 'nagaraj' ? 'Pending' : b.stage === 'done' ? 'Inventory updated' : 'Assigned';
    return { ...billHead(b), items, brands: [...new Set(ls.map(x => x.brand).filter(Boolean))], status: st, pending: cnt('pending'), assigned: cnt('assigned'), priced: cnt('priced'), stocked: cnt('stocked'),
      tat: b.stage === 'nagaraj' ? tat(b.sent_at) : b.stage === 'ganesh' ? tat(b.asg_at) : null };
  });
  const tab = ['Pending', 'Assigned', 'Inventory updated'].includes(o.tab) ? o.tab : 'Pending';
  const n = s => rows.filter(r => r.status === s).length;
  return { tab, counts: { Pending: n('Pending'), Assigned: n('Assigned'), 'Inventory updated': n('Inventory updated') }, rows: rows.filter(r => r.status === tab).slice(0, 200) };
}
function flowBill(me, id) {
  const b = db.one('SELECT b.*, v.name vendor_name FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.id = ? AND b.flow = 1', int(id)) || fail(404, 'This bill is not in New stock.');
  let lines = db.all('SELECT * FROM vendor_bill_lines WHERE bill = ? ORDER BY id', b.id);
  if (me.role === 'counter') lines = lines.filter(l => l.ctr === me.ctr);
  const head = billHead(b);
  if (['owner', 'manager', 'accountant', 'cashier'].includes(me.role)) Object.assign(head, { amount: b.amount, due: b.due });
  return { bill: head, lines: lines.map(l => lineOut(l, me)), counters: counters(), brands: brandList(), tat: b.stage === 'nagaraj' ? tat(b.sent_at) : b.stage === 'ganesh' ? tat(b.asg_at) : null };
}

function assign(me, id, b) {
  const bill = db.one('SELECT b.*, v.name vendor_name FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.id = ? AND b.flow = 1', int(id)) || fail(404, 'This bill is not in New stock.');
  if (bill.status === 'CANCELLED') fail(400, 'This bill is cancelled.');
  const list = Array.isArray(b.lines) ? b.lines : [];
  if (!list.length) fail(400, 'Pick the items to assign.');
  const ctrs = counters();
  return db.tx(() => {
    const changed = [];
    for (const x of list) {
      const l = db.one('SELECT * FROM vendor_bill_lines WHERE id = ? AND bill = ?', int(x.id), bill.id) || fail(404, 'Item not found on this bill.');
      if (l.st === 'stocked') fail(409, `${l.name} is already in stock.`);
      const brand = txt(x.brand ?? l.brand, 40) || fail(400, `${l.name}: pick the brand.`);
      const ctr = String(x.ctr || ctrOf(brand) || '').toUpperCase();
      if (!ctrs[ctr]) fail(400, `${l.name}: pick the counter.`);
      let disc = x.disc != null && x.disc !== '' ? r2(x.disc) : l.disc;
      if (!(disc >= 0 && disc < 100)) fail(400, `${l.name}: discount must be 0 to 99 %.`);
      const upd = { brand, ctr, disc, st: l.st === 'pending' ? 'assigned' : l.st, asg_by: me.name, asg_at: stamp() };
      if (disc !== l.disc) {
        const cost = costOf(l.mrp, disc);
        Object.assign(upd, { cost, rate: r2(cost / (1 + l.gst / 100)) });
        changed.push({ l, disc });
      }
      db.run(`UPDATE vendor_bill_lines SET ${Object.keys(upd).map(k => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(upd), l.id);
      if (l.part && brand !== '') db.run("UPDATE parts SET brand = ?, upd = ?, v = v + 1 WHERE id = ? AND brand = ''", brand, Date.now(), l.part);
    }
    for (const c of changed) {
      const diff = r2((c.l.disc_bill - c.disc) / 100 * c.l.mrp * c.l.qty);
      audit(me, 'purchase discount changed', `${bill.no} ${c.l.pno}: bill ${c.l.disc_bill} % → ${c.disc} %`);
      if (diff) inv.addAlert('disc', bill.no, `${bill.vendor_name} bill ${bill.inv_no}: ${c.l.name} discount should be ${c.disc} % (bill says ${c.l.disc_bill} %). ${diff > 0 ? `Ask the vendor for ₹${Math.abs(diff)} back` : `Vendor billed ₹${Math.abs(diff)} less`}.`,
        { roles: 'owner,manager,accountant', key: `disc:${c.l.id}:${c.disc}` });
    }
    const left = db.one("SELECT count(*) n FROM vendor_bill_lines WHERE bill = ? AND st = 'pending'", bill.id).n;
    if (!left && bill.stage === 'nagaraj') {
      db.run("UPDATE vendor_bills SET stage = 'ganesh', asg_at = ? WHERE id = ?", stamp(), bill.id);
      inv.addAlert('price', bill.no, `${bill.vendor_name} bill ${bill.inv_no}: items assigned. Set the selling price today.`, { roles: 'owner,manager', push: true, key: `pr:${bill.id}` });
      // no email to the manager (Sam, 5 Nov): the manager gets a popup in the panel instead (public/app.js priceNag)
    }
    audit(me, 'items assigned', `${bill.no}: ${list.length}`);
    return { msg: left ? `${list.length} assigned. ${left} still pending on this bill.` : `All items of ${bill.inv_no} assigned. The Manager gets them for the selling price.` };
  });
}

// ---- 4 · manager: pricing ------------------------------------------------------------------------------------------
function pricing(me, o = {}) {
  const done = o.tab === 'done';
  const rows = db.all(`SELECT l.*, b.no bill_no, b.inv_no, b.asg_at bill_asg, v.name vendor_name FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill JOIN vendors v ON v.id = b.vendor
    WHERE b.flow = 1 AND b.status != 'CANCELLED' AND ${done ? "l.st IN ('priced','stocked') AND l.pr_at >= ?" : "l.st = 'assigned'"} ORDER BY l.asg_at, l.id LIMIT 500`, ...(done ? [today()] : []));
  return { tab: done ? 'done' : 'waiting', waiting: db.one("SELECT count(*) n FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill WHERE b.flow = 1 AND b.status != 'CANCELLED' AND l.st = 'assigned'").n,
    doneToday: db.one("SELECT count(*) n FROM vendor_bill_lines WHERE pr_at >= ?", today()).n,
    rows: rows.map(l => ({ ...lineOut(l, me), billNo: l.bill_no, invNo: l.inv_no, vendor: l.vendor_name, tat: tat(l.asg_at) })) };
}
function price(me, b) {
  const list = Array.isArray(b.lines) ? b.lines : [];
  if (!list.length) fail(400, 'Pick the items to update.');
  return db.tx(() => {
    const bills = new Set();
    for (const x of list) {
      const l = db.one('SELECT * FROM vendor_bill_lines WHERE id = ?', int(x.id)) || fail(404, 'Item not found.');
      if (!['assigned', 'priced'].includes(l.st)) fail(409, l.st === 'pending' ? `${l.name} is not assigned by the supervisor yet.` : `${l.name} is already in stock. Change its price on the part.`);
      const pct = r2(x.sellPct), du = r2(x.dUser), dm = r2(x.dMech), dw = r2(x.dWhole);
      if (!(pct >= 0 && pct <= 500)) fail(400, `${l.name}: selling % must be 0 to 500.`);
      for (const [n, v] of [['Customer', du], ['Mechanic', dm], ['Wholesaler', dw]]) if (!(v >= 0 && v < 100)) fail(400, `${l.name}: ${n} discount must be 0 to 99 %.`);
      const sell = r2(l.cost * (1 + pct / 100));
      if (sell > l.mrp + 0.005) fail(400, `${l.name}: selling price ₹${sell} is above the MRP ₹${l.mrp}. Lower the selling %.`);
      const lowest = Math.min(sell * (1 - du / 100), sell * (1 - dm / 100), sell * (1 - dw / 100));
      if (lowest < l.cost - 0.005 && !x.lossOk) fail(400, `${l.name}: after the biggest discount the price ₹${r2(lowest)} is below the purchase price ₹${l.cost}. Tick "Sell below cost" if this is right.`);
      db.run("UPDATE vendor_bill_lines SET sell_pct = ?, sell = ?, d_user = ?, d_mech = ?, d_whole = ?, st = CASE WHEN st = 'assigned' THEN 'priced' ELSE st END, pr_by = ?, pr_at = ? WHERE id = ?",
        pct, sell, du, dm, dw, me.name, stamp(), l.id);
      if (l.part) {
        const p = db.one('SELECT * FROM parts WHERE id = ?', l.part);
        db.run('UPDATE parts SET mrp = ?, cost = ?, gst = ?, sell = ?, sell_pct = ?, d_user = ?, d_mech = ?, d_whole = ?, upd = ?, v = v + 1 WHERE id = ?',
          l.mrp, l.rate, l.gst, sell, pct, offMrp(l.mrp, sell, du), offMrp(l.mrp, sell, dm), offMrp(l.mrp, sell, dw), Date.now(), p.id);
      }
      bills.add(l.bill);
    }
    for (const id of bills) {
      const left = db.one("SELECT count(*) n FROM vendor_bill_lines WHERE bill = ? AND st IN ('pending','assigned')", id).n;
      if (!left) db.run("UPDATE vendor_bills SET stage = CASE WHEN stage = 'ganesh' THEN 'counters' ELSE stage END, priced_at = coalesce(priced_at, ?) WHERE id = ?", stamp(), id);
    }
    audit(me, 'selling price set', `${list.length} items`);
    return { msg: `${list.length} item${list.length > 1 ? 's' : ''} priced. Counters can put ${list.length > 1 ? 'them' : 'it'} into stock now.` };
  });
}

// ---- 5 · counter -----------------------------------------------------------------------------------------------------
function counterList(me, o = {}) {
  const ctr = me.role === 'counter' ? me.ctr : String(o.ctr || 'C1').toUpperCase();
  const brand = txt(o.brand, 40);
  const rows = db.all(`SELECT l.*, b.no bill_no, b.inv_no, v.name vendor_name, p.rack FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill JOIN vendors v ON v.id = b.vendor LEFT JOIN parts p ON p.id = l.part
    WHERE b.flow = 1 AND b.status != 'CANCELLED' AND l.ctr = ? AND (l.st IN ('assigned','priced') OR (l.st = 'stocked' AND l.sk_at >= ?)) ${brand ? 'AND l.brand = ?' : ''}
    ORDER BY CASE l.st WHEN 'priced' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END, l.id LIMIT 500`, ctr, today(), ...(brand ? [brand] : []));
  return { ctr, brands: counters()[ctr] || [], rows: rows.map(l => ({ ...lineOut(l, me), billNo: l.bill_no, invNo: l.inv_no, vendor: l.vendor_name, rack: l.rack })) };
}
function stockLine(me, id, b) {
  const l = db.one('SELECT l.*, b.no bill_no, b.inv_no, b.status bst FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill WHERE l.id = ? AND b.flow = 1', int(id)) || fail(404, 'Item not found.');
  if (me.role === 'counter' && l.ctr !== me.ctr) fail(403, `This item is for counter ${l.ctr}.`);
  if (l.bst === 'CANCELLED') fail(400, 'This bill is cancelled.');
  if (l.st === 'stocked') fail(409, `${l.name} is already in stock.`);
  if (l.st !== 'priced') throw httpError(409, 'Contact your manager. This item has no selling price yet, so it cannot go into stock or be sold.', { contactManager: true });
  const shelf = txt(b.shelf, 20).toUpperCase() || fail(400, 'Type the shelf number.');
  return db.tx(() => {
    db.run("UPDATE vendor_bill_lines SET shelf = ?, st = 'stocked', sk_by = ?, sk_at = ? WHERE id = ?", shelf, me.name, stamp(), l.id);
    db.run('UPDATE parts SET rack = ?, upd = ?, v = v + 1 WHERE id = ?', shelf, Date.now(), l.part);
    // while the billing link is on, the billing holds the one stock: the counter puts the pieces in there (they show in
    // Inventory within seconds); here the item is marked done with its shelf
    const inBilling = require('./billing').locked(STORE);
    if (!inBilling) inv.move(me, l.part, l.qty, 'stock-in', { ref: `${l.bill_no} / ${l.inv_no}`, note: `Counter ${l.ctr}, shelf ${shelf}` });
    const left = db.one("SELECT count(*) n FROM vendor_bill_lines WHERE bill = ? AND st != 'stocked'", l.bill).n;
    if (!left) db.run("UPDATE vendor_bills SET stage = 'done', posted = 1, done_at = ? WHERE id = ?", stamp(), l.bill);
    return { msg: inBilling ? `${l.name}: shelf ${shelf} saved. Now add the ${l.qty} pieces in the billing (billing.bikesurgeon.online): they show here within seconds.` : `${l.name}: ${l.qty} into stock on shelf ${shelf}.` };
  });
}

// ---- admin: flow tracker, late alerts, email to the manager -------------------------------------------------------------
function tracker(me) {
  const bills = db.all(`SELECT b.*, v.name vendor_name FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.flow = 1 AND b.status != 'CANCELLED'
    AND (b.stage != 'done' OR b.done_at >= ?) ORDER BY b.id DESC LIMIT 300`, C.ymd(C.addDays(C.now(), -7)));
  const rows = bills.map(b => ({ ...billHead(b), nagaraj: b.asg_at ? { done: true, hours: r2((C.parse(b.asg_at) - C.parse(b.sent_at)) / 3600000) } : tat(b.sent_at),
    ganesh: b.priced_at ? { done: true, hours: r2((C.parse(b.priced_at) - C.parse(b.asg_at)) / 3600000) } : b.asg_at ? tat(b.asg_at) : null,
    counters: b.done_at ? { done: true } : db.one("SELECT count(*) n, sum(st = 'stocked') s FROM vendor_bill_lines WHERE bill = ?", b.id),
    total: r2(((b.done_at ? C.parse(b.done_at) : C.now()) - C.parse(b.sent_at)) / 3600000) }));
  const k = s => rows.filter(r => r.stage === s).length;
  return { rows, kpi: { nagaraj: k('nagaraj'), ganesh: k('ganesh'), counters: k('counters'), late: rows.filter(r => (r.stage === 'nagaraj' && r.nagaraj.late) || (r.stage === 'ganesh' && r.ganesh && r.ganesh.late)).length } };
}
// Every hour: bills over the 1-day time get one bell alert (and push) for the person and the owner
function lateCheck() {
  for (const b of db.all("SELECT b.*, v.name vname FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.flow = 1 AND b.status != 'CANCELLED' AND b.stage IN ('nagaraj','ganesh')")) {
    if (b.stage === 'nagaraj' && tat(b.sent_at).late) inv.addAlert('tat', b.no, `Late: ${b.vname} bill ${b.inv_no} waiting for the supervisor more than 1 day.`, { roles: 'owner,supervisor', push: true, key: `tat1:${b.id}` });
    if (b.stage === 'ganesh' && tat(b.asg_at).late) inv.addAlert('tat', b.no, `Late: ${b.vname} bill ${b.inv_no} waiting for selling price more than 1 day.`, { roles: 'owner,manager', push: true, key: `tat2:${b.id}` });
  }
}
// Mail to the manager the same day the supervisor assigns (MAIL_* in .env; see server/mail.js). One mail per bill.
function queueMail(billId) {
  const to = String(db.setting('price_mail', process.env.PRICE_MAIL_TO || '')).trim();
  if (!to) return;
  const b = db.one('SELECT b.*, v.name vname FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.id = ?', billId);
  const lines = db.all("SELECT pno, name, brand, qty, ctr FROM vendor_bill_lines WHERE bill = ? AND st = 'assigned'", billId);
  const rows = lines.map(l => `<tr><td>${esc(l.pno)}</td><td>${esc(l.name)}</td><td>${esc(l.brand)}</td><td align="right">${l.qty}</td><td>${esc(l.ctr)}</td></tr>`).join('');
  inv.queue('mail', '/', { to, subject: `${lines.length} new items waiting for your selling price (${b.vname} ${b.inv_no})`,
    text: `The Supervisor assigned these items today. Counters cannot put them into stock until you price them (1 day).\n\n${lines.map(l => `${l.pno}  ${l.name}  ${l.brand}  qty ${l.qty}  ${l.ctr}`).join('\n')}\n\nOpen New stock in the Inventory panel.`,
    html: `<p>The Supervisor assigned these items today. Counters cannot put them into stock until you price them (1 day).</p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:13px"><tr><th>Part no.</th><th>Description</th><th>Brand</th><th>Qty</th><th>Counter</th></tr>${rows}</table><p>Open <b>New stock</b> in the Inventory panel.</p>` }, `MAIL-price-${billId}`);
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Counts for the menu (the New stock count blinks while a bill waits for the supervisor)
function badges(me) {
  const one = (sql, ...a) => db.one(sql, ...a).n;
  return {
    newStock: one("SELECT count(*) n FROM vendor_bills WHERE flow = 1 AND stage = 'nagaraj' AND status != 'CANCELLED'"),
    pricing: one("SELECT count(*) n FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill WHERE b.flow = 1 AND b.status != 'CANCELLED' AND l.st = 'assigned'"),
    counter: me.role === 'counter' ? one("SELECT count(*) n FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill WHERE b.flow = 1 AND b.status != 'CANCELLED' AND l.ctr = ? AND l.st = 'priced'", me.ctr) : 0,
    dues: one("SELECT count(*) n FROM vendor_bills WHERE status = 'PENDING' AND due < ?", today()),
  };
}

module.exports = { counters, setCounters, ctrOf, brandList, dues, editDue, dueHistory, calendar, keepRead, lookLines, uploadBill, myUploads, newStock, flowBill, assign, pricing, price,
  counterList, stockLine, tracker, lateCheck, badges, payStatus, discOf, offMrp, TAT_H };
