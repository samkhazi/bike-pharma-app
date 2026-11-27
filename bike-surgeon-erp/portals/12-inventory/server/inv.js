// The inventory rules: parts, stock moves, stock in from vendor bills, vendors, transfers, order sheet, rack checks,
// returns, sales from the other portals, alerts and reports. Every change runs in one transaction and writes the audit log.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const C = require('./clock');
const billing = require('./billing');

const httpError = (status, msg, extra) => Object.assign(new Error(msg), { status, ...(extra ? { extra } : {}) });
const fail = (status, msg) => { throw httpError(status, msg); };
const stamp = () => C.stamp(C.now());
const today = () => C.ymd(C.now());
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const int = n => Math.round(Number(n) || 0);
const txt = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const pkeyOf = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const STORES = { BS: 'Bike Surgeon', ML: 'The Moto Lab', BP: 'Bike Pharma' };
const ML_CATS = ['Helmets', 'Riding gear', 'Bike protection', 'Lights', 'Luggage', 'Bike care', 'Phone & tech'];
const REDUCE_WHY = ['Damaged', 'Lost / missing', 'Used in workshop', 'Expired', 'Sample given', 'Wrong entry', 'Other'];
const PAY_MODES = ['Cash', 'UPI', 'Bank', 'Cheque'];
// Purchase price and margin: only the owner (admin) and the manager (Sam, 5 Nov 2026). The supervisor sees the discount % only.
const seesCost = me => ['owner', 'manager'].includes(me.role);
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const storeOf = s => (STORES[s] ? s : 'BS');
// Until switch day the billing sites hold the one stock and Inventory reads them (server/billing.js): the parts, stock and
// prices of a live store are changed in the billing (they show here within seconds). liveCheck = the part list of BS / ML;
// stockCheck = stock of BS / ML, and of the Bike Pharma restock store (its pieces go into the billing too).
const liveMsg = (store, what = 'Make this change') => `${STORES[store] || 'This'} stock comes straight from the billing until switch day. ${what} in the billing (${store === 'ML' ? 'themotolab' : 'billing'}.bikesurgeon.online): it shows here within seconds.`;
const liveCheck = (store, what) => { if (billing.live(store)) fail(409, liveMsg(store, what)); };
const stockCheck = (store, what) => { if (billing.locked(store)) fail(409, liveMsg(store, what)); };

function audit(me, action, detail) {
  db.run('INSERT INTO audit_log (at, account_id, who, action, detail) VALUES (?,?,?,?,?)', stamp(), me.id || null, me.name || '', action, detail == null ? null : String(detail).slice(0, 1000));
}
// Running number per kind: VB-0001, TR-0001 ...
function nextNo(kind, table) {
  const k = 'seq_' + kind;
  let n = Number(db.setting(k, 0)) + 1;
  // never hand out a number that is already used (an import may have brought it)
  while (db.one(`SELECT 1 FROM ${table} WHERE no = ?`, `${kind}-${String(n).padStart(4, '0')}`)) n++;
  db.setSetting(k, n);
  return `${kind}-${String(n).padStart(4, '0')}`;
}

// ---------------- parts ----------------------------------------------------------------------------------------------
const PHOTO_DIR = () => process.env.PHOTO_DIR || path.join(path.dirname(process.env.DB_FILE && process.env.DB_FILE !== ':memory:' ? process.env.DB_FILE : path.join(__dirname, '..', 'data', 'x')), 'photos');
function photoUrl(ph) {
  if (ph.old) { const base = process.env.OLD_PHOTO_URL; return base ? base.replace(/\/?$/, '/') + encodeURIComponent(ph.file) : null; }
  return '/photos/' + encodeURIComponent(ph.file);
}
const priceOf = (mrp, d) => r2(mrp * (1 - (Number(d) || 0) / 100));

function partOut(p, me, { photos } = {}) {
  const ph = photos || db.all('SELECT * FROM photos WHERE part = ? ORDER BY id', p.id);
  // The Moto Lab bills at its selling price (net_cost_price in its billing), not at MRP less a discount
  const mlSell = p.store === 'ML' && p.sell > 0;
  return {
    id: p.id, store: p.store, pno: p.pno, name: p.name, descr: p.descr, brand: p.brand, model: p.model, cat: p.cat, size: p.size,
    hsn: p.hsn, gst: p.gst, gstIncl: !!p.gst_incl, mrp: p.mrp, ...(seesCost(me) ? { cost: p.cost } : {}),
    dUser: p.d_user, dWhole: p.d_whole, dMech: p.d_mech,
    prices: mlSell ? { user: p.sell, whole: p.sell, mech: p.sell } : { user: priceOf(p.mrp, p.d_user), whole: priceOf(p.mrp, p.d_whole), mech: priceOf(p.mrp, p.d_mech) },
    sell: p.sell || 0,
    stock: p.stock, alert: p.alert, rack: p.rack, batch: p.batch, bar: p.bar, wty: p.wty, active: !!p.active,
    lastSale: p.last_sale, addedBy: p.added_by, addedAt: p.added_at, v: p.v,
    low: p.alert > 0 && p.stock <= p.alert, photos: ph.map(x => ({ id: x.id, url: photoUrl(x), old: !!x.old })).filter(x => x.url),
    photoCount: ph.length,
  };
}
const partRow = id => db.one('SELECT * FROM parts WHERE id = ?', Number(id)) || fail(404, 'Part not found.');

// Search: every word must match one of name, description, brand, model, part no., barcode or rack
function partFilter({ q, store, brand, f, rack, days, ids } = {}) {
  const where = [], args = [];
  if (ids) { const list = String(ids).split(',').map(Number).filter(n => n > 0).slice(0, 500); where.push(`p.id IN (${list.map(() => '?').join(',') || 'NULL'})`); args.push(...list); }
  if (store && STORES[store]) { where.push('p.store = ?'); args.push(store); }
  if (f !== 'removed') where.push('p.active = 1'); else where.push('p.active = 0');
  for (const w of String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = `%${w.replace(/[%_]/g, '')}%`, k = pkeyOf(w);
    where.push(`(p.name LIKE ? OR p.descr LIKE ? OR p.brand LIKE ? OR p.model LIKE ? OR p.pno LIKE ? OR p.bar LIKE ? OR p.rack LIKE ?${k ? ' OR p.pkey LIKE ?' : ''})`);
    args.push(like, like, like, like, like, like, like, ...(k ? [`%${k}%`] : []));
  }
  if (brand) { where.push('p.brand = ?'); args.push(brand); }
  if (rack) { where.push('p.rack = ?'); args.push(rack); }
  const dead = C.ymd(C.addDays(C.now(), -(Number(days) || 90)));
  if (f === 'low') where.push('p.alert > 0 AND p.stock <= p.alert AND p.stock > 0');
  if (f === 'out') where.push('p.stock <= 0');
  if (f === 'neg') where.push('p.stock < 0');
  if (f === 'instock') where.push('p.stock > 0');
  if (f === 'nophoto') where.push('NOT EXISTS (SELECT 1 FROM photos x WHERE x.part = p.id)');
  if (f === 'norack') where.push("p.rack = ''");
  if (f === 'noprice') where.push('p.mrp <= 0');
  if (f === 'dead') { where.push("p.stock > 0 AND (p.last_sale IS NULL OR p.last_sale < ?) AND substr(p.added_at, 1, 10) < ?"); args.push(dead, dead); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}
const SORTS = { name: 'p.name, p.id', stock: 'p.stock DESC, p.name', low: 'p.stock - p.alert, p.name', rack: 'p.rack, p.name', new: 'p.id DESC', pno: 'p.pkey', mrp: 'p.mrp DESC' };
function listParts(me, o = {}) {
  const { sql, args } = partFilter(o);
  const size = Math.min(200, Math.max(10, Number(o.size) || 50)), page = Math.max(1, Number(o.page) || 1);
  const total = db.one(`SELECT count(*) n FROM parts p ${sql}`, ...args).n;
  const rows = db.all(`SELECT p.* FROM parts p ${sql} ORDER BY ${SORTS[o.sort] || SORTS.name} LIMIT ? OFFSET ?`, ...args, size, (page - 1) * size);
  return { rows: rows.map(p => partOut(p, me)), total, page, pages: Math.max(1, Math.ceil(total / size)) };
}
function getPart(me, id) {
  const p = partRow(id);
  const from = C.ymd(C.addDays(C.now(), -90));
  const s90 = db.one('SELECT coalesce(sum(qty),0) q, count(DISTINCT bill) b FROM sales WHERE part = ? AND cancelled = 0 AND day >= ?', p.id, from);
  return {
    part: partOut(p, me),
    moves: db.all('SELECT * FROM stock_moves WHERE part = ? ORDER BY id DESC LIMIT 100', p.id),
    sales: { qty90: s90.q, bills90: s90.b, last: db.all('SELECT bill, day, qty, rate, src FROM sales WHERE part = ? AND cancelled = 0 ORDER BY day DESC, id DESC LIMIT 20', p.id) },
    orders: db.all("SELECT * FROM order_sheet WHERE part = ? AND status IN ('pending','partial') ORDER BY id", p.id),
    buys: seesCost(me) ? db.all(`SELECT l.qty, l.rate, l.mrp, b.no, b.inv_no, b.inv_date, v.name vendor FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.bill
      JOIN vendors v ON v.id = b.vendor WHERE l.part = ? AND b.status != 'CANCELLED' ORDER BY b.inv_date DESC LIMIT 10`, p.id) : [],
    same: db.all('SELECT id, name, model, stock, store FROM parts WHERE pkey = ? AND id != ? AND active = 1 LIMIT 10', p.pkey, p.id),
  };
}
function findByCode(me, code, store) {
  const k = pkeyOf(code);
  if (!k) return { rows: [] };
  const rows = db.all(`SELECT * FROM parts WHERE active = 1 AND (pkey = ? OR bar = ?) ${store ? 'AND store = ?' : ''} ORDER BY stock DESC LIMIT 20`, k, String(code).trim(), ...(store ? [store] : []));
  return { rows: rows.map(p => partOut(p, me)) };
}

const PART_FIELDS = {
  pno: v => txt(v, 60), name: v => txt(v, 160), descr: v => txt(v, 400), brand: v => txt(v, 60).toUpperCase(), model: v => txt(v, 120),
  cat: v => txt(v, 40), size: v => txt(v, 12), hsn: v => txt(v, 12).replace(/\s/g, ''), gst: v => r2(v), gst_incl: v => (v === false || v === 0 || v === 'no' ? 0 : 1),
  mrp: v => r2(v), cost: v => r2(v), d_user: v => r2(v), d_whole: v => r2(v), d_mech: v => r2(v), alert: v => Math.max(0, int(v)),
  rack: v => txt(v, 20).toUpperCase(), batch: v => txt(v, 40), bar: v => txt(v, 40), wty: v => Math.max(0, int(v)),
};
const API_NAMES = { gstIncl: 'gst_incl', dUser: 'd_user', dWhole: 'd_whole', dMech: 'd_mech' };
function cleanPart(b, me, { isNew } = {}) {
  const out = {};
  for (const [k0, v] of Object.entries(b || {})) {
    const k = API_NAMES[k0] || k0;
    if (PART_FIELDS[k] && v !== undefined && v !== null) out[k] = PART_FIELDS[k](v);
  }
  if (!seesCost(me)) delete out.cost;           // the store keeper does not see or set cost prices
  if (isNew) {
    if (!out.name) fail(400, 'Part name is needed.');
    if (!out.pno) fail(400, 'Part number is needed.');
  } else {
    if ('name' in out && !out.name) fail(400, 'Part name is needed.');
    if ('pno' in out && !out.pno) fail(400, 'Part number is needed.');
  }
  if ('mrp' in out && !(out.mrp >= 0)) fail(400, 'MRP must be 0 or more.');
  if ('cost' in out && !(out.cost >= 0)) fail(400, 'Cost price must be 0 or more.');
  if ('gst' in out && !gstSlabs().includes(out.gst)) fail(400, `GST must be one of: ${gstSlabs().join(', ')} %.`);
  for (const d of ['d_user', 'd_whole', 'd_mech']) if (d in out && !(out[d] >= 0 && out[d] <= 90)) fail(400, 'Discount must be between 0 and 90 %.');
  if ('cost' in out && 'mrp' in out && out.mrp > 0 && out.cost > out.mrp) fail(400, 'Cost price is more than the MRP. Check the numbers.');
  if (out.pno) out.pkey = pkeyOf(out.pno);
  return out;
}

function addPart(me, b) {
  const store = storeOf(b.store);
  liveCheck(store, 'Add the part');
  const f = cleanPart(b, me, { isNew: true });
  const stock = Math.max(0, int(b.stock));
  return db.tx(() => {
    const same = db.one('SELECT id, name, model FROM parts WHERE store = ? AND pkey = ? AND active = 1', store, f.pkey);
    if (same && !b.sameNoOk) throw httpError(409, `Part number ${f.pno} is already in the list (${same.name}${same.model ? ', ' + same.model : ''}). Open it, or tick "Same number, different part".`, { sameId: same.id });
    const cols = Object.keys(f);
    const r = db.run(`INSERT INTO parts (store, ${cols.join(', ')}, stock, added_by, added_at, upd) VALUES (?, ${cols.map(() => '?').join(', ')}, 0, ?, ?, ?)`,
      store, ...cols.map(c => f[c]), me.name, stamp(), Date.now());
    const id = Number(r.lastInsertRowid);
    if (stock) move(me, id, stock, 'stock-in', { ref: txt(b.ref, 40) || 'Opening stock' });
    audit(me, 'part added', `${f.pno} ${f.name} (${store}) stock ${stock}`);
    return { id, msg: `${f.name} added.` };
  });
}
function editPart(me, id, b) {
  const p = partRow(id);
  liveCheck(p.store, 'Change the part');
  if (b.v != null && Number(b.v) !== p.v) throw httpError(409, 'Someone else changed this part just now. The page shows the new details; make your change again.');
  if ('stock' in (b || {}) && int(b.stock) !== p.stock) fail(400, 'Stock is not changed here. Use Stock in, Reduce stock or a rack check, so every change is in the log.');
  const f = cleanPart(b, me);
  delete f.stock;
  return db.tx(() => {
    if (f.pkey && f.pkey !== p.pkey) {
      const same = db.one('SELECT id, name FROM parts WHERE store = ? AND pkey = ? AND active = 1 AND id != ?', p.store, f.pkey, p.id);
      if (same && !b.sameNoOk) throw httpError(409, `Part number ${f.pno} is already used by ${same.name}.`, { sameId: same.id });
    }
    const cols = Object.keys(f).filter(c => f[c] !== p[c]);
    if (!cols.length) return { id: p.id, msg: 'Nothing changed.' };
    db.run(`UPDATE parts SET ${cols.map(c => `${c} = ?`).join(', ')}, upd = ?, v = v + 1 WHERE id = ?`, ...cols.map(c => f[c]), Date.now(), p.id);
    audit(me, 'part changed', `${p.pno} ${p.name}: ` + cols.map(c => `${c} ${p[c]} → ${f[c]}`).join(', '));
    if (cols.includes('mrp') && p.mrp > 0 && f.mrp < p.mrp * 0.7) addAlert('price', p.pno, `MRP of ${p.name} (${p.pno}) cut from ₹${p.mrp} to ₹${f.mrp} by ${me.name}.`, { roles: 'owner', key: `price:${p.id}:${p.v}` });
    return { id: p.id, msg: 'Saved.' };
  });
}
function setActive(me, id, active) {
  const p = partRow(id);
  liveCheck(p.store, active ? 'Add the part' : 'Delete the part');
  if (!active && p.stock !== 0) fail(400, `${p.name} still has ${p.stock} in stock. Bring the stock to 0 first (Reduce stock or a rack check).`);
  db.tx(() => { db.run('UPDATE parts SET active = ?, upd = ?, v = v + 1 WHERE id = ?', active ? 1 : 0, Date.now(), p.id); audit(me, active ? 'part back in the list' : 'part removed', `${p.pno} ${p.name}`); });
  return { msg: active ? 'Part is back in the list.' : 'Part removed from the list. Old bills keep it.' };
}
// Many parts at once: rack, alert level, discounts, GST, HSN (owner / manager)
const BULK = ['rack', 'alert', 'd_user', 'd_whole', 'd_mech', 'gst', 'hsn', 'brand'];
function bulkEdit(me, ids, b) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000) fail(400, 'Pick 1 to 2000 parts.');
  for (const r of db.all(`SELECT DISTINCT store FROM parts WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids.map(Number))) liveCheck(r.store, 'Change these parts');
  const f = cleanPart(b, me);
  const cols = Object.keys(f).filter(c => BULK.includes(c));
  if (!cols.length) fail(400, `Nothing to change. Bulk change takes: ${BULK.join(', ')}.`);
  return db.tx(() => {
    let n = 0;
    for (const id of ids) n += Number(db.run(`UPDATE parts SET ${cols.map(c => `${c} = ?`).join(', ')}, upd = ?, v = v + 1 WHERE id = ? AND active = 1`, ...cols.map(c => f[c]), Date.now(), Number(id)).changes);
    audit(me, 'bulk change', `${n} parts: ` + cols.map(c => `${c} = ${f[c]}`).join(', '));
    return { msg: `${n} parts changed.`, n };
  });
}

// ---------------- stock moves ----------------------------------------------------------------------------------------
// The one place stock changes. qty + in / - out. A sale from another portal may take stock below 0 (the bill was
// really made): that part shows on the "Below 0" list until someone counts the rack.
function move(me, partId, qty, why, { ref = '', src = 'inventory', note = '', allowNegative = false, day } = {}) {
  qty = int(qty);
  if (!qty) return null;
  const p = partRow(partId);
  stockCheck(p.store);   // never a second stock next to the billing's
  const after = p.stock + qty;
  if (after < 0 && !allowNegative) fail(400, `Only ${p.stock} of ${p.name} in stock.`);
  db.run('UPDATE parts SET stock = ?, upd = ?, v = v + 1' + (why === 'sale' && qty < 0 ? ', last_sale = max(coalesce(last_sale, \'\'), ?)' : '') + ' WHERE id = ?',
    after, Date.now(), ...(why === 'sale' && qty < 0 ? [day || today()] : []), p.id);
  db.run('INSERT INTO stock_moves (at, part, qty, before, after, why, ref, src, who, note) VALUES (?,?,?,?,?,?,?,?,?,?)',
    stamp(), p.id, qty, p.stock, after, why, String(ref || ''), src, me.name || '', String(note || '').slice(0, 300));
  if (p.alert > 0 && after <= p.alert && p.stock > p.alert) {
    addAlert(after <= 0 ? 'out' : 'low', p.pno, `${after <= 0 ? 'Out of stock' : 'Low stock'}: ${p.name} (${p.pno}${p.model ? ', ' + p.model : ''}) has ${after} left, alert at ${p.alert}. Rack ${p.rack || '—'}.`,
      { key: `low:${p.id}:${today()}`, push: true });
  } else if (after < 0 && p.stock >= 0) {
    addAlert('neg', p.pno, `${p.name} (${p.pno}) went below 0 (${after}) after ${ref || why}. Count the rack.`, { key: `neg:${p.id}:${today()}`, push: true });
  }
  return after;
}

function reduce(me, id, b) {
  const p = partRow(id), qty = int(b.qty);
  stockCheck(p.store, 'Cut the stock');
  if (!(qty > 0)) fail(400, 'How many pieces? Enter a number above 0.');
  if (!REDUCE_WHY.includes(b.why)) fail(400, `Pick a reason: ${REDUCE_WHY.join(', ')}.`);
  const note = txt(b.note, 300);
  if (['Other', 'Wrong entry', 'Lost / missing'].includes(b.why) && !note) fail(400, 'Write a short note for this reason.');
  return db.tx(() => {
    const after = move(me, p.id, -qty, 'reduce', { note: `${b.why}${note ? ': ' + note : ''}` });
    const value = r2(qty * (p.cost || p.mrp));
    audit(me, 'stock reduced', `${p.pno} ${p.name} -${qty} (${b.why}) ${note}`);
    const limit = Number(db.setting('reduce_alert', 2000));
    if (value >= limit) {
      addAlert('reduce', p.pno, `${me.name} cut ${qty} × ${p.name} (${p.pno}) from stock, ₹${value}: ${b.why}${note ? ', ' + note : ''}.`, { roles: 'owner', key: `reduce:${p.id}:${Date.now()}`, push: true, wa: true });
      queue('admin', '/api/alerts/incoming', { kind: 'stock', ref: `${p.pno} ${p.name}`.slice(0, 120), who: `${me.name} (Bike Surgeon inventory)`, detail: `Stock cut by ${qty}: ${b.why}${note ? ', ' + note : ''}`, amt: value, extId: `INV-RD-${p.id}-${Date.now()}` });
    }
    return { msg: `${qty} taken out of stock. ${after} left.` };
  });
}
// A customer brought a part back (bill cancelled at the counter, or a single part returned)
function returnIn(me, id, b) {
  const p = partRow(id), qty = int(b.qty);
  stockCheck(p.store, 'Take the customer return');
  if (!(qty > 0)) fail(400, 'How many pieces came back?');
  const bill = txt(b.bill, 40);
  if (!bill) fail(400, 'Bill number of the sale is needed.');
  return db.tx(() => {
    const after = move(me, p.id, qty, 'return-in', { ref: bill, note: txt(b.note, 300) });
    audit(me, 'customer return', `${p.pno} +${qty} bill ${bill}`);
    return { msg: `${qty} back in stock (${after}).` };
  });
}

// ---------------- vendors and stock in -------------------------------------------------------------------------------
function vendorRow(id) { return db.one('SELECT * FROM vendors WHERE id = ?', Number(id)) || fail(404, 'Vendor not found.'); }
// Bank details are for paying the vendor: only the owner, manager and accountant get them.
const BANK_KEYS = ['bank', 'acc_name', 'acc_no', 'ifsc', 'bank_name', 'branch'];
const PAYERS = ['owner', 'manager', 'accountant'];
const bankless = v => { const o = { ...v }; for (const k of BANK_KEYS) delete o[k]; return o; };
const forRole = (me, v) => (me && PAYERS.includes(me.role) ? v : bankless(v));
function vendorsList(me) {
  return db.all(`SELECT v.*,
      coalesce((SELECT sum(amount - paid) FROM vendor_bills WHERE vendor = v.id AND status = 'PENDING'), 0) + v.opening due,
      (SELECT count(*) FROM vendor_bills WHERE vendor = v.id AND status = 'PENDING') pending,
      (SELECT count(*) FROM vendor_bills WHERE vendor = v.id AND status = 'PENDING' AND due < ?) late,
      (SELECT max(inv_date) FROM vendor_bills WHERE vendor = v.id) last
    FROM vendors v ORDER BY v.active DESC, v.name`, today()).map(v => forRole(me, { ...v, due: r2(v.due), bankOk: !!(v.acc_no && v.ifsc) }));
}
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function saveVendor(me, id, b) {
  const f = { name: txt(b.name, 100), phone: String(b.phone || '').replace(/\D/g, '').slice(-10), address: txt(b.address, 300), gstin: txt(b.gstin, 15).toUpperCase(), days: Math.max(0, Math.min(365, int(b.days ?? 30))),
    brands: txt(b.brands, 200), bank: txt(b.bank, 200),
    acc_name: txt(b.accName, 100), acc_no: String(b.accNo || '').replace(/\s/g, ''), ifsc: String(b.ifsc || '').replace(/\s/g, '').toUpperCase(), bank_name: txt(b.bankName, 80), branch: txt(b.branch, 100) };
  if (!f.name) fail(400, 'Vendor name is needed.');
  if (f.acc_name || f.acc_no || f.ifsc || f.bank_name || f.branch) {
    if (!f.acc_name || !f.acc_no || !f.ifsc || !f.bank_name || !f.branch) fail(400, 'Bank details: fill all five (account holder name, account number, IFSC, bank name, branch) or leave all empty.');
    if (!/^\d{9,18}$/.test(f.acc_no)) fail(400, 'Account number should be 9 to 18 digits.');
    if (b.accNo2 != null && String(b.accNo2).replace(/\s/g, '') !== f.acc_no) fail(400, 'The two account numbers do not match. Type it again.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.ifsc)) fail(400, 'IFSC does not look right (11 letters and digits, like SBIN0001234).');
  }
  if (!PAYERS.includes(me.role) && id) for (const k of BANK_KEYS) delete f[k];   // the store keeper cannot see or change them
  if (f.gstin && !GSTIN.test(f.gstin)) fail(400, 'GSTIN does not look right (15 letters and digits, like 29ABCDE1234F1Z5).');
  if (b.opening != null && me.role !== 'store') f.opening = r2(b.opening);
  return db.tx(() => {
    const same = db.one('SELECT id FROM vendors WHERE lower(name) = lower(?) AND id != ?', f.name, Number(id) || 0);
    if (same) fail(409, 'A vendor with this name is already there.');
    if (id) {
      vendorRow(id);
      db.run(`UPDATE vendors SET ${Object.keys(f).map(k => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(f), Number(id));
      if (b.active != null) db.run('UPDATE vendors SET active = ? WHERE id = ?', b.active ? 1 : 0, Number(id));
      audit(me, 'vendor changed', f.name);
      return { id: Number(id), msg: 'Vendor saved.' };
    }
    const r = db.run('INSERT INTO vendors (name, phone, address, gstin, days, opening, brands, bank, acc_name, acc_no, ifsc, bank_name, branch, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      f.name, f.phone, f.address, f.gstin, f.days, f.opening || 0, f.brands, f.bank || '', f.acc_name || '', f.acc_no || '', f.ifsc || '', f.bank_name || '', f.branch || '', stamp());
    audit(me, 'vendor added', f.name);
    return { id: Number(r.lastInsertRowid), msg: 'Vendor added.' };
  });
}
function vendorPage(me, id) {
  const v = vendorRow(id);
  const bills = db.all('SELECT * FROM vendor_bills WHERE vendor = ? ORDER BY inv_date DESC, id DESC LIMIT 300', v.id);
  return { vendor: vendorsList(me).find(x => x.id === v.id), bills: bills.map(billOut),
    payments: db.all('SELECT p.*, b.no, b.inv_no FROM vendor_payments p JOIN vendor_bills b ON b.id = p.bill WHERE b.vendor = ? ORDER BY p.day DESC, p.id DESC LIMIT 300', v.id),
    returns: db.all('SELECT r.*, p.name, p.pno FROM vendor_returns r JOIN parts p ON p.id = r.part WHERE r.vendor = ? ORDER BY r.id DESC LIMIT 100', v.id) };
}
const billOut = b => ({ ...b, balance: b.status === 'PENDING' ? r2(b.amount - b.paid) : 0, late: b.status === 'PENDING' && b.due && b.due < today() });
function billPage(me, id) {
  const b = db.one('SELECT b.*, v.name vendor_name, v.gstin vendor_gstin FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.id = ?', Number(id)) || fail(404, 'Vendor bill not found.');
  return { bill: billOut(b), lines: db.all('SELECT * FROM vendor_bill_lines WHERE bill = ? ORDER BY id', b.id), payments: db.all('SELECT * FROM vendor_payments WHERE bill = ? ORDER BY id', b.id) };
}
function listBills(me, o = {}) {
  const where = [], args = [];
  if (o.status && ['PENDING', 'CLEARED', 'CANCELLED'].includes(o.status)) { where.push('b.status = ?'); args.push(o.status); }
  if (o.late) { where.push("b.status = 'PENDING' AND b.due < ?"); args.push(today()); }
  if (o.from && isDay(o.from)) { where.push('b.inv_date >= ?'); args.push(o.from); }
  if (o.to && isDay(o.to)) { where.push('b.inv_date <= ?'); args.push(o.to); }
  if (o.q) { where.push('(b.inv_no LIKE ? OR b.no LIKE ? OR v.name LIKE ?)'); const l = `%${String(o.q).trim()}%`; args.push(l, l, l); }
  return db.all(`SELECT b.*, v.name vendor_name FROM vendor_bills b JOIN vendors v ON v.id = b.vendor ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.inv_date DESC, b.id DESC LIMIT 500`, ...args).map(billOut);
}

// Stock in: one vendor bill with its lines. Each line is an existing part (part id) or a new part ({new: {...}}).
// The cost price and MRP on the part follow the bill when they changed. The bill becomes a payable (due date = date + vendor days).
function stockIn(me, b) {
  const v = vendorRow(b.vendor);
  if (!v.active) fail(400, `${v.name} is switched off. Switch the vendor on first.`);
  const invNo = txt(b.invNo, 40), invDate = isDay(b.invDate) ? b.invDate : fail(400, 'Bill date is needed (YYYY-MM-DD).');
  if (!invNo) fail(400, "The vendor's bill number is needed.");
  if (invDate > today()) fail(400, 'Bill date is in the future.');
  const store = storeOf(b.store);
  stockCheck(store, 'Enter the vendor bill (stock in)');
  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (!lines.length || lines.length > 500) fail(400, 'Add 1 to 500 lines.');
  return db.tx(() => {
    const dup = db.one("SELECT no FROM vendor_bills WHERE vendor = ? AND upper(inv_no) = upper(?) AND status != 'CANCELLED'", v.id, invNo);
    if (dup && !b.dupOk) throw httpError(409, `Bill ${invNo} of ${v.name} is already entered (${dup.no}). Tick "Enter again" only if it really is a second bill.`);
    const no = nextNo('VB', 'vendor_bills');
    const days = b.days != null ? Math.max(0, int(b.days)) : v.days;
    const due = C.ymd(C.addDays(C.parse(invDate), days));
    const r = db.run('INSERT INTO vendor_bills (no, store, vendor, inv_no, inv_date, due, amount, notes, by, at, posted) VALUES (?,?,?,?,?,?,?,?,?,?,1)',
      no, store, v.id, invNo, invDate, due, 0, txt(b.notes, 300), me.name, stamp());
    const billId = Number(r.lastInsertRowid);
    let total = 0;
    lines.forEach((l, i) => {
      const bad = m => fail(400, `Line ${i + 1}: ${m}`);
      const qty = int(l.qty), rate = r2(l.rate), gst = l.gst != null ? r2(l.gst) : null;
      if (!(qty > 0)) bad('quantity must be above 0.');
      if (!(rate >= 0)) bad('rate must be 0 or more.');
      let p;
      if (l.part) { p = partRow(l.part); if (p.store !== store) bad(`${p.name} is in ${STORES[p.store]}, not ${STORES[store]}.`); }
      else if (l.new) {
        const { id } = addPart(me, { ...l.new, store, stock: 0, sameNoOk: l.new.sameNoOk });
        p = partRow(id);
      } else bad('pick the part, or fill in a new part.');
      const g = gst != null ? gst : p.gst;
      if (!gstSlabs().includes(g)) bad(`GST must be one of: ${gstSlabs().join(', ')} %.`);
      const mrp = l.mrp != null && Number(l.mrp) > 0 ? r2(l.mrp) : p.mrp;
      if (mrp > 0 && rate > mrp) bad(`rate ₹${rate} is more than the MRP ₹${mrp}.`);
      const amount = l.amount != null && Number(l.amount) > 0 ? r2(l.amount) : r2(qty * rate * (1 + g / 100));
      total += amount;
      db.run('INSERT INTO vendor_bill_lines (bill, part, pno, name, hsn, gst, qty, rate, mrp, amount) VALUES (?,?,?,?,?,?,?,?,?,?)', billId, p.id, p.pno, p.name, p.hsn, g, qty, rate, mrp, amount);
      const upd = {};
      if (seesCost(me) && rate > 0 && rate !== p.cost) upd.cost = rate;
      if (mrp !== p.mrp && l.mrp != null) upd.mrp = mrp;
      if (gst != null && gst !== p.gst) upd.gst = gst;
      if (Object.keys(upd).length) db.run(`UPDATE parts SET ${Object.keys(upd).map(k => `${k} = ?`).join(', ')}, upd = ?, v = v + 1 WHERE id = ?`, ...Object.values(upd), Date.now(), p.id);
      move(me, p.id, qty, 'stock-in', { ref: `${no} / ${invNo}` });
    });
    const amount = b.amount != null && Number(b.amount) > 0 ? r2(b.amount) : r2(Math.round(total));
    db.run('UPDATE vendor_bills SET amount = ? WHERE id = ?', amount, billId);
    if (Math.abs(amount - total) > Math.max(5, total * 0.02)) addAlert('bill', no, `${no} (${v.name} ${invNo}): bill total ₹${amount} but lines add up to ₹${r2(total)}. Check it.`, { key: `billdiff:${billId}` });
    audit(me, 'stock in', `${no} ${v.name} ${invNo} ₹${amount}, ${lines.length} lines`);
    // order sheet rows of these parts that were waiting get the quantity
    for (const l of db.all('SELECT part, qty FROM vendor_bill_lines WHERE bill = ?', billId)) markOrdered(me, l.part, l.qty);
    return { id: billId, no, msg: `${no} saved: ${lines.length} lines into stock, ₹${amount} to pay by ${C.dmy(C.parse(due))}.` };
  });
}
// Goods that came in fill the open order-sheet rows of that part (oldest first)
function markOrdered(me, part, qty) {
  let left = qty;
  for (const o of db.all("SELECT * FROM order_sheet WHERE part = ? AND status IN ('pending','partial') ORDER BY day, id", part)) {
    if (left <= 0) break;
    const take = Math.min(left, o.qty - o.got);
    left -= take;
    const got = o.got + take;
    db.run('UPDATE order_sheet SET got = ?, status = ? WHERE id = ?', got, got >= o.qty ? 'done' : 'partial', o.id);
  }
}
function cancelBill(me, id, b) {
  const { bill } = billPage(me, id);
  if (bill.status === 'CANCELLED') fail(400, 'This bill is already cancelled.');
  if (bill.paid > 0) fail(400, 'Money was already paid on this bill. It cannot be cancelled.');
  const why = txt(b.why, 200) || fail(400, 'Why is it cancelled?');
  return db.tx(() => {
    // a restock (flow) bill: only the items the counters already put in stock come out again
    const raw = db.one('SELECT flow FROM vendor_bills WHERE id = ?', bill.id);
    const lines = raw && raw.flow ? db.all("SELECT * FROM vendor_bill_lines WHERE bill = ? AND st = 'stocked'", bill.id) : bill.posted ? db.all('SELECT * FROM vendor_bill_lines WHERE bill = ?', bill.id) : [];
    // the stock of a live store is in the billing: it is taken out there
    const inBilling = billing.locked(bill.store);
    if (!inBilling) for (const l of lines) if (l.part) move(me, l.part, -l.qty, 'stock-in', { ref: `${bill.no} cancelled`, note: why, allowNegative: true });
    db.run("UPDATE vendor_bills SET status = 'CANCELLED', notes = trim(notes || ' Cancelled: ' || ?) WHERE id = ?", why, bill.id);
    audit(me, 'vendor bill cancelled', `${bill.no}: ${why}`);
    return { msg: inBilling && lines.length ? `${bill.no} cancelled. Its stock is in the billing: take it out there if it came in.` : `${bill.no} cancelled; its stock was taken out again.` };
  });
}
function pay(me, id, b) {
  const { bill } = billPage(me, id);
  if (bill.status !== 'PENDING') fail(400, `This bill is ${bill.status.toLowerCase()}.`);
  const amount = r2(b.amount), day = isDay(b.day) ? b.day : today();
  if (!(amount > 0)) fail(400, 'Amount must be above 0.');
  if (amount > bill.balance + 0.5) fail(400, `Only ₹${bill.balance} is left on this bill.`);
  if (!PAY_MODES.includes(b.mode)) fail(400, `Mode must be ${PAY_MODES.join(', ')}.`);
  if (day > today()) fail(400, 'Payment date is in the future.');
  return db.tx(() => {
    db.run('INSERT INTO vendor_payments (bill, amount, mode, ref, day, by, at) VALUES (?,?,?,?,?,?,?)', bill.id, amount, b.mode, txt(b.ref, 60), day, me.name, stamp());
    const paid = r2(bill.paid + amount), clear = b.clear || paid >= bill.amount - 0.5;
    db.run('UPDATE vendor_bills SET paid = ?, status = ?, cleared_at = ? WHERE id = ?', paid, clear ? 'CLEARED' : 'PENDING', clear ? stamp() : null, bill.id);
    audit(me, 'vendor paid', `${bill.no} ₹${amount} ${b.mode}${clear ? ' (cleared)' : ''}`);
    return { msg: clear ? `₹${amount.toLocaleString('en-IN')} paid. ${bill.no} is cleared.` : `₹${amount.toLocaleString('en-IN')} paid. ₹${r2(bill.amount - paid).toLocaleString('en-IN')} left.` };
  });
}
function vendorReturn(me, b) {
  const v = vendorRow(b.vendor), p = partRow(b.part), qty = int(b.qty);
  stockCheck(p.store, 'Make the return to the vendor');
  if (!(qty > 0)) fail(400, 'How many pieces go back?');
  const why = txt(b.why, 200) || fail(400, 'Why does it go back?');
  return db.tx(() => {
    const no = nextNo('VR', 'vendor_returns');
    const rate = b.rate != null ? r2(b.rate) : p.cost;
    db.run('INSERT INTO vendor_returns (no, vendor, part, qty, rate, why, day, by) VALUES (?,?,?,?,?,?,?,?)', no, v.id, p.id, qty, rate, why, today(), me.name);
    move(me, p.id, -qty, 'vendor-return', { ref: no, note: `${v.name}: ${why}` });
    audit(me, 'vendor return', `${no} ${p.pno} ×${qty} to ${v.name}`);
    return { no, msg: `${no}: ${qty} × ${p.name} back to ${v.name}.` };
  });
}
function vendorReturnDone(me, no, b) {
  const r = db.one('SELECT * FROM vendor_returns WHERE no = ?', String(no)) || fail(404, 'Vendor return not found.');
  if (r.status !== 'Sent') fail(400, `Already ${r.status.toLowerCase()}.`);
  if (!['Credit received', 'Replaced'].includes(b.status)) fail(400, 'Status must be "Credit received" or "Replaced".');
  return db.tx(() => {
    db.run('UPDATE vendor_returns SET status = ? WHERE id = ?', b.status, r.id);
    const inBilling = billing.locked((db.one('SELECT store FROM parts WHERE id = ?', r.part) || {}).store);
    if (b.status === 'Replaced' && !inBilling) move(me, r.part, r.qty, 'stock-in', { ref: `${r.no} replaced` });
    audit(me, 'vendor return closed', `${r.no} ${b.status}`);
    return { msg: b.status === 'Replaced' ? (inBilling ? `Marked as replaced. Put the ${r.qty} pieces into stock in the billing.` : `${r.qty} replaced pieces are back in stock.`) : 'Marked as credit received.' };
  });
}

// ---------------- branch transfers DVG ⇄ RNR -------------------------------------------------------------------------
function transfer(me, b) {
  if (!['dvg-rnr', 'rnr-dvg'].includes(b.dir)) fail(400, 'Pick the direction: Davanagere → Ranebennur or Ranebennur → Davanagere.');
  const qty = int(b.qty);
  if (!(qty > 0)) fail(400, 'Quantity must be above 0.');
  const day = isDay(b.day) ? b.day : today();
  if (day > today()) fail(400, 'Transfer date is in the future.');
  const margin = r2(b.margin || 0);
  if (!(margin >= 0 && margin <= 90)) fail(400, 'Margin must be 0 to 90 %.');
  stockCheck('BS', 'Make the transfer');
  return db.tx(() => {
    let p, isNew = 0;
    if (b.part) p = partRow(b.part);
    else if (b.dir === 'rnr-dvg' && b.new) { const { id } = addPart(me, { ...b.new, store: 'BS', stock: 0 }); p = partRow(id); isNew = 1; }
    else fail(400, b.dir === 'dvg-rnr' ? 'Pick a part that is in stock. A part that is not in the list cannot go out.' : 'Pick the part, or fill in the new part.');
    if (p.store !== 'BS') fail(400, 'Branch transfers are for Bike Surgeon stock only.');
    const mrp = b.mrp != null && Number(b.mrp) > 0 ? r2(b.mrp) : p.mrp;
    const no = nextNo('TR', 'transfers');
    const before = p.stock;
    const after = move(me, p.id, b.dir === 'dvg-rnr' ? -qty : qty, b.dir === 'dvg-rnr' ? 'transfer-out' : 'transfer-in', { ref: no, note: txt(b.note, 200) });
    const profit = r2(mrp * margin / 100);
    db.run('INSERT INTO transfers (no, dir, part, pno, name, hsn, mrp, margin, profit, qty, before, after, new_item, day, by, note, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      no, b.dir, p.id, p.pno, p.name, p.hsn, mrp, margin, profit, qty, before, after, isNew, day, me.name, txt(b.note, 200), stamp());
    queue('accounts', '/api/import/transfers', { transfers: [{ no, date: C.dmy(C.parse(day)), at: stamp(), dir: b.dir, part: p.name, pno: p.pno, qty, mrp, by: me.name, via: 'Bike Surgeon inventory', st: b.dir === 'rnr-dvg' ? 'received' : 'sent', ...(b.dir === 'rnr-dvg' ? { gotQty: qty, gotBy: me.name, got: stamp() } : {}) }] }, `ACC-TR-${no}`);
    audit(me, 'transfer', `${no} ${b.dir} ${p.pno} ×${qty}`);
    return { no, msg: `${no}: ${qty} × ${p.name} ${b.dir === 'dvg-rnr' ? 'sent to Ranebennur' : 'received from Ranebennur'}. Stock now ${after}.` };
  });
}
function listTransfers(o = {}) {
  const where = [], args = [];
  if (o.dir) { where.push('dir = ?'); args.push(o.dir); }
  if (isDay(o.from)) { where.push('day >= ?'); args.push(o.from); }
  if (isDay(o.to)) { where.push('day <= ?'); args.push(o.to); }
  return db.all(`SELECT * FROM transfers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY day DESC, id DESC LIMIT 1000`, ...args);
}

// ---------------- daily order sheet ----------------------------------------------------------------------------------
function addOrder(me, b) {
  const qty = int(b.qty);
  if (!(qty > 0)) fail(400, 'Quantity must be above 0.');
  let p = b.part ? partRow(b.part) : null;
  const name = p ? p.name : txt(b.name, 160);
  if (!name) fail(400, 'Pick the part, or type its name.');
  return db.tx(() => {
    if (p) {
      const open = db.one("SELECT id, qty - got remain FROM order_sheet WHERE part = ? AND status IN ('pending','partial')", p.id);
      if (open && !b.again) throw httpError(409, `${p.name} is already on the order sheet (${open.remain} still to come). Tick "Order again" for more.`);
    }
    const r = db.run('INSERT INTO order_sheet (day, store, part, brand, pno, name, qty, vendor, promise, by, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      today(), p ? p.store : storeOf(b.store), p ? p.id : null, p ? p.brand : txt(b.brand, 60).toUpperCase(), p ? p.pno : txt(b.pno, 60), name, qty, txt(b.vendor, 100), isDay(b.promise) ? b.promise : '', me.name, stamp());
    audit(me, 'order sheet add', `${name} ×${qty}`);
    return { id: Number(r.lastInsertRowid), msg: `${name} added to today's order sheet.` };
  });
}
function editOrder(me, id, b) {
  const o = db.one('SELECT * FROM order_sheet WHERE id = ?', Number(id)) || fail(404, 'Order row not found.');
  if (!['pending', 'partial'].includes(o.status)) fail(400, `This row is ${o.status}.`);
  return db.tx(() => {
    if (b.cancel) { db.run("UPDATE order_sheet SET status = 'cancelled' WHERE id = ?", o.id); audit(me, 'order sheet cancel', `${o.name}`); return { msg: 'Order row cancelled.' }; }
    if (b.receive != null) {
      const q = int(b.receive);
      if (!(q > 0)) fail(400, 'How many came?');
      if (o.got + q > o.qty) fail(400, `Only ${o.qty - o.got} were ordered. Add a new row for more.`);
      if (o.part) move(me, o.part, q, 'stock-in', { ref: `Order sheet ${o.day}`, note: o.vendor });
      const got = o.got + q;
      db.run('UPDATE order_sheet SET got = ?, status = ? WHERE id = ?', got, got >= o.qty ? 'done' : 'partial', o.id);
      audit(me, 'order sheet receive', `${o.name} +${q}`);
      return { msg: got >= o.qty ? 'All received.' : `${q} received, ${o.qty - got} still to come.` };
    }
    const f = {};
    if (b.qty != null) { f.qty = int(b.qty); if (!(f.qty >= Math.max(1, o.got))) fail(400, `Quantity cannot be below what already came (${o.got}).`); }
    if (b.vendor != null) f.vendor = txt(b.vendor, 100);
    if (b.promise != null) f.promise = isDay(b.promise) ? b.promise : '';
    if (!Object.keys(f).length) fail(400, 'Nothing to change.');
    db.run(`UPDATE order_sheet SET ${Object.keys(f).map(k => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(f), o.id);
    return { msg: 'Saved.' };
  });
}
// Rows of earlier days still waiting move to today (the old row is marked 'carried')
function carryOrders() {
  const t = today();
  const old = db.all("SELECT * FROM order_sheet WHERE day < ? AND status IN ('pending','partial')", t);
  if (!old.length) return 0;
  db.tx(() => {
    for (const o of old) {
      db.run("UPDATE order_sheet SET status = 'carried' WHERE id = ?", o.id);
      db.run('INSERT INTO order_sheet (day, store, part, brand, pno, name, qty, vendor, promise, got, status, carried_from, by, at) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?)',
        t, o.store, o.part, o.brand, o.pno, o.name, o.qty - o.got, o.vendor, o.promise, 'pending', o.id, o.by, o.at);
    }
  });
  return old.length;
}
function orderSheet(o = {}) {
  const day = isDay(o.day) ? o.day : today();
  return { day, rows: db.all('SELECT o.*, p.stock, p.rack FROM order_sheet o LEFT JOIN parts p ON p.id = o.part WHERE o.day = ? ORDER BY o.brand, o.name', day),
    late: db.all("SELECT o.*, p.stock FROM order_sheet o LEFT JOIN parts p ON p.id = o.part WHERE o.status IN ('pending','partial') AND o.promise != '' AND o.promise < ? ORDER BY o.promise", today()) };
}
// Reorder ideas: low or out parts with sales in the last 90 days, most sold first; quantity = 30 days of sale, at least the alert level
// all parts at or below their alert level (the billing's Low Stock Alert page): the page shows the 500 most sold, the CSV all
const reorderCount = (o = {}) => db.one(`SELECT count(*) n FROM parts WHERE active = 1 AND alert > 0 AND stock <= alert ${o.store ? 'AND store = ?' : ''}`, ...(o.store ? [o.store] : [])).n;
function reorder(me, o = {}) {
  const from = C.ymd(C.addDays(C.now(), -90));
  const rows = db.all(`SELECT p.*, coalesce((SELECT sum(qty) FROM sales s WHERE s.part = p.id AND s.cancelled = 0 AND s.day >= ?), 0) sold90,
      (SELECT qty - got FROM order_sheet x WHERE x.part = p.id AND x.status IN ('pending','partial') LIMIT 1) onorder
    FROM parts p WHERE p.active = 1 AND p.alert > 0 AND p.stock <= p.alert ${o.store ? 'AND p.store = ?' : ''}
    ORDER BY sold90 DESC, p.stock - p.alert LIMIT ${o.all ? 50000 : 500}`, from, ...(o.store ? [o.store] : []));
  return rows.map(p => ({ ...partOut(p, me, { photos: [] }), sold90: p.sold90, onOrder: p.onorder || 0,
    suggest: Math.max(p.alert * 2 - p.stock, Math.ceil(p.sold90 / 3) - p.stock, 1), level: p.stock <= 0 ? 'Order now' : p.sold90 >= 6 ? 'Order now' : 'Order soon' }));
}

// ---------------- rack checks ----------------------------------------------------------------------------------------
function startCount(me, b) {
  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (!lines.length || lines.length > 1000) fail(400, 'Count 1 to 1000 parts.');
  return db.tx(() => {
    const no = nextNo('RC', 'counts');
    let diff = 0;
    for (const [i, l] of lines.entries()) {
      const p = partRow(l.part), counted = int(l.counted);
      if (!(counted >= 0) || l.counted === '' || l.counted == null) fail(400, `Line ${i + 1}: enter the count (0 or more).`);
      if (counted !== p.stock) diff++;
      db.run('INSERT INTO counts (no, rack, part, system, counted, by, at) VALUES (?,?,?,?,?,?,?)', no, txt(b.rack, 20).toUpperCase() || p.rack, p.id, p.stock, counted, me.name, stamp());
    }
    if (!diff) db.run("UPDATE counts SET status = 'applied', done_by = ?, done_at = ? WHERE no = ?", me.name, stamp(), no);
    else addAlert('count', no, `${me.name} counted rack ${txt(b.rack, 20) || ''}: ${diff} of ${lines.length} parts differ. Check and apply ${no}.`, { key: `count:${no}`, push: true });
    audit(me, 'rack check', `${no} ${lines.length} parts, ${diff} differ`);
    return { no, msg: diff ? `${no} saved: ${diff} parts differ. A manager applies it.` : `${no}: every count matches the stock.` };
  });
}
function listCounts() {
  return db.all(`SELECT c.no, c.rack, c.by, c.at, CASE WHEN sum(c.status = 'waiting') > 0 THEN 'waiting' ELSE min(c.status) END status, count(*) n, sum(c.counted != c.system) diff, sum((c.counted - c.system) * p.mrp) value
    FROM counts c JOIN parts p ON p.id = c.part GROUP BY c.no ORDER BY max(c.id) DESC LIMIT 200`);
}
function countPage(no) {
  const rows = db.all('SELECT c.*, p.name, p.pno, p.stock now, p.mrp, p.store FROM counts c JOIN parts p ON p.id = c.part WHERE c.no = ? ORDER BY c.id', String(no));
  if (!rows.length) fail(404, 'Rack check not found.');
  return { no, rows };
}
function applyCount(me, no, b) {
  const { rows } = countPage(no);
  const waiting = rows.filter(r => r.status === 'waiting');
  if (!waiting.length) fail(400, 'Nothing waiting in this rack check.');
  if (!b.drop) for (const r of waiting) if (r.counted !== r.system) stockCheck(r.store, 'Correct the stock of this rack');
  return db.tx(() => {
    let n = 0;
    for (const r of waiting) {
      if (b.drop) { db.run("UPDATE counts SET status = 'dropped', done_by = ?, done_at = ? WHERE id = ?", me.name, stamp(), r.id); continue; }
      // the difference found at counting time is applied to today's stock (sales since then stay counted)
      const d = r.counted - r.system;
      if (d) { move(me, r.part, d, 'count', { ref: no, note: `counted ${r.counted}, system had ${r.system}`, allowNegative: true }); n++; }
      db.run("UPDATE counts SET status = 'applied', done_by = ?, done_at = ? WHERE id = ?", me.name, stamp(), r.id);
    }
    audit(me, b.drop ? 'rack check dropped' : 'rack check applied', `${no} ${n} parts changed`);
    return { msg: b.drop ? 'Rack check dropped. Stock not changed.' : `${n} parts corrected from ${no}.` };
  });
}

// ---------------- sales from the other portals -----------------------------------------------------------------------
// {store, bills: [{no, day (YYYY-MM-DD or DD-MM-YYYY), cancel, lines: [{pno | sku | part, qty, rate, name}]}]}
// The same bill sent again replaces its lines (only the difference moves stock). cancel: true puts all of it back.
const dayOf = s => { s = String(s || ''); if (isDay(s)) return s; const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : today(); };
function findPart(store, l) {
  if (l.part) { const p = db.one('SELECT * FROM parts WHERE id = ? AND store = ?', Number(l.part), store); if (p) return p; }
  // old: the part's id in the old billing database (the admin panel's live link to the old sites sends it)
  if (l.old) { const p = db.one('SELECT * FROM parts WHERE store = ? AND old_id = ? ORDER BY active DESC, stock DESC LIMIT 1', store, Number(l.old)); if (p) return p; }
  const code = l.pno || l.sku || l.bar;
  if (code) {
    const k = pkeyOf(code);
    const p = db.one('SELECT * FROM parts WHERE store = ? AND (pkey = ? OR bar = ?) ORDER BY active DESC, stock DESC LIMIT 1', store, k, String(code).trim());
    if (p) return p;
  }
  if (l.name) {
    const p = db.one("SELECT * FROM parts WHERE store = ? AND active = 1 AND (lower(name) = lower(?) OR lower(name || ' (' || size || ')') = lower(?)) ORDER BY stock DESC LIMIT 1", store, String(l.name).trim(), String(l.name).trim());
    if (p) return p;
  }
  return null;
}
function importSales(me, b) {
  const store = storeOf(b && b.store);
  const bills = (b && b.bills) || [];
  if (!Array.isArray(bills) || !bills.length || bills.length > 1000) fail(400, 'Send {store, bills: [...]} (1 to 1000).');
  const src = me.portal || me.role || 'inventory';
  const out = { bills: 0, lines: 0, unknown: [] };
  // live: the billing already took the stock out (Inventory reads its stock), so only the sales history is kept here
  const hist = billing.locked(store);
  if (hist) out.history = true;
  db.tx(() => {
    for (const [i, bl] of bills.entries()) {
      const no = txt(bl && bl.no, 40);
      if (!no) fail(400, `Bill ${i + 1}: no is needed.`);
      const day = dayOf(bl.day || bl.date);
      const had = db.all('SELECT * FROM sales WHERE src = ? AND bill = ? AND store = ?', src, no, store);
      const want = new Map();     // part id → {qty, rate, pno, name}
      if (!bl.cancel) for (const l of bl.lines || []) {
        const p = findPart(store, l);
        const qty = int(l.qty);
        if (!qty) continue;
        if (!p) { out.unknown.push({ bill: no, code: l.pno || l.sku || l.name || '' }); continue; }
        const w = want.get(p.id) || { qty: 0, rate: r2(l.rate), pno: p.pno, name: p.name };
        w.qty += qty; want.set(p.id, w);
      }
      const old = new Map();
      for (const s of had.filter(x => !x.cancelled)) old.set(s.part, (old.get(s.part) || 0) + s.qty);
      const ids = new Set([...want.keys(), ...old.keys()]);
      for (const id of ids) {
        if (id == null) continue;
        const d = (want.get(id)?.qty || 0) - (old.get(id) || 0);
        if (d && hist) { if (d > 0) db.run("UPDATE parts SET last_sale = max(coalesce(last_sale, ''), ?) WHERE id = ?", day, id); out.lines++; }
        else if (d) { move(me, id, -d, d > 0 ? 'sale' : 'sale-cancel', { ref: no, src, allowNegative: true, day }); out.lines++; }
      }
      db.run('UPDATE sales SET cancelled = 1 WHERE src = ? AND bill = ? AND store = ?', src, no, store);
      for (const [id, w] of want) db.run('INSERT INTO sales (store, bill, day, part, pno, name, qty, rate, src) VALUES (?,?,?,?,?,?,?,?,?)', store, no, day, id, w.pno, w.name, w.qty, w.rate, src);
      out.bills++;
    }
    if (out.lines) audit(me, 'sales in', `${src}: ${out.bills} bills, ${out.lines} ${hist ? 'sale lines (stock as in the billing)' : 'stock changes'}${out.unknown.length ? `, ${out.unknown.length} unknown parts` : ''}`);
    // live: a part new in the billing comes in within seconds, so an unknown part there is no alert
    if (out.unknown.length && !hist) addAlert('unknown', src, `${out.unknown.length} sold parts from ${src} are not in the inventory: ${out.unknown.slice(0, 5).map(u => u.code).join(', ')}${out.unknown.length > 5 ? ' …' : ''}`, { key: `unk:${src}:${today()}:${out.unknown[0].code}` });
  });
  return out;
}

// ---------------- photos ---------------------------------------------------------------------------------------------
const MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
function addPhoto(me, id, b) {
  const p = partRow(id);
  const m = String(b.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) fail(400, 'Send a JPG, PNG or WEBP photo.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 200) fail(400, 'This photo file is empty.');
  const sig = buf.subarray(0, 12).toString('latin1');   // the file must really be the picture type it says
  if (!(sig.startsWith('\xff\xd8') || sig.startsWith('\x89PNG') || (sig.startsWith('RIFF') && sig.slice(8) === 'WEBP'))) fail(400, 'This file is not a JPG, PNG or WEBP photo.');
  if (db.one('SELECT count(*) n FROM photos WHERE part = ?', p.id).n >= 6) fail(400, 'A part keeps at most 6 photos. Remove one first.');
  const dir = PHOTO_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const file = `p${p.id}-${Date.now()}.${MIME[m[1]]}`;
  fs.writeFileSync(path.join(dir, file), buf);     // saved exactly as uploaded, full quality
  db.tx(() => {
    db.run('INSERT INTO photos (part, file, at, who) VALUES (?,?,?,?)', p.id, file, stamp(), me.name);
    db.run('UPDATE parts SET upd = ? WHERE id = ?', Date.now(), p.id);
    audit(me, 'photo added', `${p.pno} ${file}`);
  });
  return { msg: 'Photo added.' };
}
function delPhoto(me, id, photoId) {
  const ph = db.one('SELECT * FROM photos WHERE id = ? AND part = ?', Number(photoId), Number(id)) || fail(404, 'Photo not found.');
  db.tx(() => { db.run('DELETE FROM photos WHERE id = ?', ph.id); audit(me, 'photo removed', ph.file); });
  if (!ph.old) { try { fs.unlinkSync(path.join(PHOTO_DIR(), ph.file)); } catch (e) { /* already gone */ } }
  return { msg: 'Photo removed.' };
}

// ---------------- alerts, settings -----------------------------------------------------------------------------------
const GST_DEFAULT = [0, 5, 12, 18, 28, 40];
function gstSlabs() { try { const v = JSON.parse(db.setting('gst_slabs', JSON.stringify(GST_DEFAULT))); return Array.isArray(v) && v.length ? v.map(Number) : GST_DEFAULT; } catch (e) { return GST_DEFAULT; } }
// A bell alert; push: also a browser push; wa: also a WhatsApp message to the alert phones now (else it is in the daily summary)
function addAlert(kind, ref, text, { roles = 'owner,manager', key = null, push = false, wa = false } = {}) {
  if (key && db.one('SELECT 1 FROM alerts WHERE key = ?', key)) return;
  db.run('INSERT INTO alerts (at, kind, ref, text, roles, key) VALUES (?,?,?,?,?,?)', stamp(), kind, String(ref || ''), text, roles, key);
  if (push) queue('push', '/notifications', { roles: roles.split(','), title: 'Bike Surgeon inventory', text });
  if (wa) for (const to of alertPhones()) queue('whatsapp', '/', { to: '91' + to, via: 'whatsapp', text: `Bike Surgeon inventory: ${text}`, ref: `${kind}:${ref}` });
}
const alertPhones = () => String(db.setting('alert_phones', process.env.ALERT_PHONES || '')).split(',').map(s => s.replace(/\D/g, '').slice(-10)).filter(s => s.length === 10);
function alertsFor(me) {
  const rows = db.all('SELECT * FROM alerts ORDER BY id DESC LIMIT 200').filter(a => a.roles.split(',').includes(me.role));
  return rows.map(a => ({ id: a.id, at: a.at, kind: a.kind, ref: a.ref, text: a.text, seen: JSON.parse(a.seen).includes(me.id) }));
}
function seeAlerts(me) {
  db.tx(() => { for (const a of db.all('SELECT id, seen, roles FROM alerts ORDER BY id DESC LIMIT 200')) {
    const s = JSON.parse(a.seen); if (a.roles.split(',').includes(me.role) && !s.includes(me.id)) db.run('UPDATE alerts SET seen = ? WHERE id = ?', JSON.stringify([...s, me.id]), a.id);
  } });
  return { msg: 'All read.' };
}
// Once a day (DAILY_HOUR, default 10 am): low-stock summary and vendor dues on WhatsApp to the alert phones, and bell alerts
// for bills due in 3 days, today, and late.
function dailyAlerts(force = false) {
  const d = C.now(), t = today();
  if (!force && (d.getHours() < Number(process.env.DAILY_HOUR || 10) || db.setting('daily_done') === t)) return false;
  db.tx(() => {
    db.setSetting('daily_done', t);
    const in3 = C.ymd(C.addDays(d, 3));
    const due = db.all("SELECT b.*, v.name vname FROM vendor_bills b JOIN vendors v ON v.id = b.vendor WHERE b.status = 'PENDING' AND b.due IS NOT NULL AND b.due <= ? ORDER BY b.due", in3);
    for (const b of due) {
      const kind = b.due < t ? 'late' : b.due === t ? 'due' : 'soon';
      addAlert(kind === 'soon' ? 'due' : kind, b.no, `${kind === 'late' ? 'Late' : kind === 'due' ? 'Due today' : 'Due in 3 days'}: ${b.vname} bill ${b.inv_no} (${b.no}), ₹${r2(b.amount - b.paid)}, due ${C.dmy(C.parse(b.due))}.`,
        { roles: 'owner,manager,accountant', key: `due:${b.id}:${kind}:${kind === 'late' ? t.slice(0, 7) + (d.getDate() <= 15 ? 'a' : 'b') : ''}` });
    }
    const low = db.all('SELECT store, count(*) n, sum(stock <= 0) o FROM parts WHERE active = 1 AND alert > 0 AND stock <= alert GROUP BY store');
    const lateSum = due.filter(b => b.due < t).reduce((s, b) => s + b.amount - b.paid, 0);
    const lines = [`Bike Surgeon inventory, ${C.dmy(d)}`];
    for (const l of low) lines.push(`${STORES[l.store]}: ${l.n} parts low (${l.o} out of stock).`);
    if (due.length) lines.push(`Vendor bills due in 3 days or late: ${due.length}${lateSum ? `, late ₹${Math.round(lateSum)}` : ''}.`);
    const neg = db.one('SELECT count(*) n FROM parts WHERE active = 1 AND stock < 0').n;
    if (neg) lines.push(`${neg} parts below 0: count those racks.`);
    if (lines.length > 1) for (const to of alertPhones()) queue('whatsapp', '/', { to: '91' + to, via: 'whatsapp', text: lines.join('\n'), ref: `daily:${t}` }, `WA-daily-${t}-${to}`);
  });
  return true;
}

// ---------------- reports --------------------------------------------------------------------------------------------
function kpis(me) {
  const k = {};
  for (const s of Object.keys(STORES)) {
    const r = db.one(`SELECT count(*) parts, coalesce(sum(CASE WHEN stock > 0 THEN stock END),0) pcs, coalesce(sum(CASE WHEN stock > 0 THEN stock * mrp END),0) mrpv,
      coalesce(sum(CASE WHEN stock > 0 THEN stock * cost END),0) costv, sum(alert > 0 AND stock <= alert AND stock > 0) low, sum(stock <= 0) out, sum(stock < 0) neg,
      sum(alert > 0 AND stock <= alert) alow
      FROM parts WHERE active = 1 AND store = ?`, s);
    k[s] = { parts: r.parts, pcs: r.pcs, mrpValue: Math.round(r.mrpv), ...(seesCost(me) ? { costValue: Math.round(r.costv) } : {}), low: r.low || 0, out: r.out || 0, neg: r.neg || 0, alertLow: r.alow || 0,
      noPhoto: db.one('SELECT count(*) n FROM parts p WHERE active = 1 AND store = ? AND NOT EXISTS (SELECT 1 FROM photos x WHERE x.part = p.id)', s).n,
      dead: db.one(`SELECT count(*) n FROM parts p ${partFilter({ store: s, f: 'dead' }).sql}`, ...partFilter({ store: s, f: 'dead' }).args).n };
  }
  const v = db.one("SELECT coalesce(sum(amount - paid),0) due, coalesce(sum(CASE WHEN due < ? THEN amount - paid END),0) late, sum(due < ?) nlate FROM vendor_bills WHERE status = 'PENDING'", today(), today());
  k.vendors = { due: Math.round(v.due + (db.one('SELECT coalesce(sum(opening),0) o FROM vendors WHERE active = 1').o)), late: Math.round(v.late), lateBills: v.nlate || 0 };
  k.orders = db.one("SELECT count(*) n FROM order_sheet WHERE status IN ('pending','partial')").n;
  k.counts = db.one("SELECT count(DISTINCT no) n FROM counts WHERE status = 'waiting'").n;
  return k;
}
function byBrand(me, store = 'BS') {
  return db.all(`SELECT brand, count(*) parts, sum(max(stock,0)) pcs, round(sum(max(stock,0) * mrp)) mrpv${seesCost(me) ? ', round(sum(max(stock,0) * cost)) costv' : ''},
    sum(alert > 0 AND stock <= alert) low FROM parts WHERE active = 1 AND store = ? GROUP BY brand ORDER BY mrpv DESC`, storeOf(store));
}
function movers(me, { store = 'BS', days = 30, limit = 100 } = {}) {
  const from = C.ymd(C.addDays(C.now(), -Math.max(1, Math.min(365, Number(days) || 30))));
  return db.all(`SELECT p.id, p.pno, p.name, p.brand, p.model, p.stock, p.rack, p.mrp, sum(s.qty) qty, count(DISTINCT s.bill) bills
    FROM sales s JOIN parts p ON p.id = s.part WHERE s.cancelled = 0 AND s.day >= ? AND s.store = ? GROUP BY p.id ORDER BY qty DESC LIMIT ?`, from, storeOf(store), Math.min(1000, Number(limit) || 100));
}
function movesLog(o = {}) {
  const where = [], args = [];
  if (o.why) { where.push('m.why = ?'); args.push(o.why); }
  if (isDay(o.from)) { where.push('m.at >= ?'); args.push(o.from); }
  if (isDay(o.to)) { where.push('m.at < ?'); args.push(C.ymd(C.addDays(C.parse(o.to), 1))); }
  if (o.who) { where.push('m.who = ?'); args.push(o.who); }
  if (o.store) { where.push('p.store = ?'); args.push(o.store); }
  if (o.q) { where.push('(p.name LIKE ? OR p.pno LIKE ? OR m.ref LIKE ?)'); const l = `%${String(o.q).trim()}%`; args.push(l, l, l); }
  return db.all(`SELECT m.*, p.name, p.pno, p.store, p.mrp FROM stock_moves m JOIN parts p ON p.id = m.part ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC LIMIT ?`, ...args, Math.min(5000, Number(o.limit) || 500));
}
// Stock value by HSN and GST rate (taxable value and tax at MRP)
function gstStock(store = 'BS') {
  return db.all(`SELECT hsn, gst, count(*) parts, sum(max(stock,0)) pcs, round(sum(max(stock,0) * CASE WHEN gst_incl = 1 THEN mrp / (1 + gst / 100.0) ELSE mrp END), 2) taxable,
    round(sum(max(stock,0) * CASE WHEN gst_incl = 1 THEN mrp - mrp / (1 + gst / 100.0) ELSE mrp * gst / 100.0 END), 2) tax
    FROM parts WHERE active = 1 AND store = ? GROUP BY hsn, gst ORDER BY taxable DESC`, storeOf(store));
}
function dues() {
  const t = today(), d30 = C.ymd(C.addDays(C.now(), -30)), d60 = C.ymd(C.addDays(C.now(), -60));
  return db.all(`SELECT v.id, v.name, v.opening,
      coalesce(sum(CASE WHEN b.due >= ? THEN b.amount - b.paid END),0) notdue,
      coalesce(sum(CASE WHEN b.due < ? AND b.due >= ? THEN b.amount - b.paid END),0) late30,
      coalesce(sum(CASE WHEN b.due < ? AND b.due >= ? THEN b.amount - b.paid END),0) late60,
      coalesce(sum(CASE WHEN b.due < ? THEN b.amount - b.paid END),0) late90
    FROM vendors v LEFT JOIN vendor_bills b ON b.vendor = v.id AND b.status = 'PENDING' GROUP BY v.id HAVING notdue + late30 + late60 + late90 + v.opening > 0 ORDER BY late90 DESC, late60 DESC`,
  t, t, d30, d30, d60, d60);
}


// ---------------- data check (mistakes brought from the old billing site) --------------------------------------------
function dataCheck(me, store = 'BS') {
  store = storeOf(store);
  const lim = 300;
  const dups = db.all(`SELECT pkey, count(*) n, sum(stock) stock, group_concat(id) ids FROM parts WHERE store = ? AND active = 1 AND pkey != '' GROUP BY pkey HAVING n > 1 ORDER BY n DESC, pkey LIMIT ?`, store, lim)
    .map(d => ({ pkey: d.pkey, n: d.n, stock: d.stock, parts: db.all(`SELECT id, pno, name, model, stock, mrp, rack FROM parts WHERE id IN (${d.ids.split(',').map(Number).join(',')}) ORDER BY id`) }));
  const q = (where, ...a) => db.all(`SELECT id, pno, name, model, brand, stock, mrp, ${seesCost(me) ? 'cost,' : ''} gst, hsn, rack FROM parts WHERE store = ? AND active = 1 AND ${where} ORDER BY name LIMIT ${lim}`, store, ...a);
  const gstFix = JSON.parse(db.setting('data_check_gst', '[]')).filter(x => x.store === store).slice(0, lim);
  return {
    counts: {
      dups: db.one(`SELECT count(*) n FROM (SELECT pkey FROM parts WHERE store = ? AND active = 1 AND pkey != '' GROUP BY pkey HAVING count(*) > 1)`, store).n,
      noMrp: db.one('SELECT count(*) n FROM parts WHERE store = ? AND active = 1 AND mrp <= 0', store).n,
      neg: db.one('SELECT count(*) n FROM parts WHERE store = ? AND active = 1 AND stock < 0', store).n,
      costOver: seesCost(me) ? db.one('SELECT count(*) n FROM parts WHERE store = ? AND active = 1 AND mrp > 0 AND cost > mrp', store).n : null,
      noHsn: db.one("SELECT count(*) n FROM parts WHERE store = ? AND active = 1 AND hsn = ''", store).n,
      noRack: db.one("SELECT count(*) n FROM parts WHERE store = ? AND active = 1 AND rack = '' AND stock > 0", store).n,
      gstFix: JSON.parse(db.setting('data_check_gst', '[]')).filter(x => x.store === store).length,
    },
    dups, noMrp: q('mrp <= 0'), neg: q('stock < 0'), costOver: seesCost(me) ? q('mrp > 0 AND cost > mrp') : [], noHsn: q("hsn = ''"), gstFix,
  };
}
// The same part entered more than once: keep one row; the others give it their stock, photos, sales, moves and bill lines
function mergeParts(me, keepId, ids) {
  const keep = partRow(keepId);
  liveCheck(keep.store, 'Join the rows');
  const others = [...new Set((ids || []).map(Number))].filter(id => id !== keep.id).map(partRow);
  if (!others.length) fail(400, 'Pick the other rows to join into this one.');
  for (const o of others) if (o.store !== keep.store) fail(400, `${o.name} is in ${STORES[o.store]}.`);
  return db.tx(() => {
    let add = 0;
    for (const o of others) {
      for (const t of ['photos', 'sales', 'vendor_bill_lines', 'transfers', 'order_sheet', 'counts', 'vendor_returns']) db.run(`UPDATE ${t} SET part = ? WHERE part = ?`, keep.id, o.id);
      db.run('UPDATE stock_moves SET part = ?, note = trim(note || \' (from row \' || ? || \')\') WHERE part = ?', keep.id, o.id, o.id);
      add += o.stock;
      db.run('UPDATE parts SET active = 0, stock = 0, upd = ?, v = v + 1 WHERE id = ?', Date.now(), o.id);
    }
    if (add) {
      const p = partRow(keep.id);
      db.run('UPDATE parts SET stock = ?, upd = ?, v = v + 1 WHERE id = ?', p.stock + add, Date.now(), p.id);
      db.run("INSERT INTO stock_moves (at, part, qty, before, after, why, ref, src, who, note) VALUES (?,?,?,?,?,'edit','Joined rows','inventory',?,?)", stamp(), p.id, add, p.stock, p.stock + add, me.name, `stock of rows ${others.map(o => o.id).join(', ')} added`);
    }
    db.run("UPDATE parts SET last_sale = (SELECT max(day) FROM sales s WHERE s.part = parts.id AND s.cancelled = 0), upd = ? WHERE id = ?", Date.now(), keep.id);
    audit(me, 'parts joined', `${keep.pno}: kept ${keep.id}, joined ${others.map(o => o.id).join(', ')} (+${add} stock)`);
    return { msg: `${others.length + 1} rows joined into one. Stock now ${keep.stock + add}.` };
  });
}
function dropGstCheck(me, store, pno) {
  const list = JSON.parse(db.setting('data_check_gst', '[]'));
  // the live billing link builds this list again from the billing: a checked row stays hidden while its rate is the same
  const done = JSON.parse(db.setting('data_check_gst_done', '[]'));
  for (const x of list) if (x.store === store && x.pno === pno && !done.some(d => d.store === store && d.pno === pno && d.old === x.old)) done.push({ store, pno, old: x.old });
  db.setSetting('data_check_gst_done', JSON.stringify(done.slice(-5000)));
  db.setSetting('data_check_gst', JSON.stringify(list.filter(x => !(x.store === store && x.pno === pno))));
  audit(me, 'GST checked', `${store} ${pno}`);
  return { msg: 'Marked as checked.' };
}

// ---------------- outbox ---------------------------------------------------------------------------------------------
// Saved with the change (same transaction). A newer body with the same ext_id replaces the one still waiting.
function queue(target, p, body, extId = null) {
  const b = JSON.stringify(body);
  if (extId) {
    const w = db.one('SELECT id FROM outbox WHERE ext_id = ? AND sent_at IS NULL', extId);
    if (w) { db.run('UPDATE outbox SET body = ?, tries = 0, last_error = NULL, dead = 0 WHERE id = ?', b, w.id); return; }
  }
  db.run('INSERT INTO outbox (target, path, body, ext_id, created_at) VALUES (?,?,?,?,?)', target, p, b, extId, stamp());
}

module.exports = {
  reorderCount, STORES, ML_CATS, REDUCE_WHY, PAY_MODES, httpError, fail, pkeyOf, seesCost, gstSlabs, partOut, partRow, listParts, getPart, findByCode, addPart, editPart, setActive, bulkEdit,
  move, reduce, returnIn, vendorsList, saveVendor, vendorPage, billPage, listBills, stockIn, cancelBill, pay, vendorReturn, vendorReturnDone,
  transfer, listTransfers, addOrder, editOrder, carryOrders, orderSheet, reorder, startCount, listCounts, countPage, applyCount,
  importSales, dataCheck, mergeParts, dropGstCheck, addPhoto, delPhoto, PHOTO_DIR, addAlert, alertsFor, seeAlerts, dailyAlerts, alertPhones, kpis, byBrand, movers, movesLog, gstStock, dues, queue, audit, partFilter, today, stamp,
  liveCheck, stockCheck,
};
