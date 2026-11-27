// Every API endpoint (docs/API.md). Reads answer data; each change answers {ok, msg, ...} and the page loads fresh data.
'use strict';
const express = require('express');
const crypto = require('node:crypto');
const db = require('./db');
const auth = require('./auth');
const inv = require('./inv');
const csv = require('./csv');
const links = require('./links');
const C = require('./clock');
const { seed } = require('./seed');
const flow = require('./flow');
const reader = require('./reader');
const billing = require('./billing');

const router = express.Router();
const { httpError } = inv;

function clock() {
  const d = C.now();
  return { today: C.ymd(d), dmy: C.dmy(d), now: C.clock(d), long: C.long(d), ms: d.getTime(), tz: process.env.TZ || 'Asia/Kolkata', frozen: !!process.env.DEMO_CLOCK };
}
const wrap = fn => async (req, res, next) => { try { const out = await fn(req, res); if (out !== undefined && !res.headersSent) res.json(out); } catch (e) { next(e); } };

// ---- who is calling: a signed-in login, or another portal's server (X-Feed-Key)
// FEED_KEYS = "cashier:k1,counter:k2,desk:k3,motolab:k4,..." (one key per sender; the key names the portal), or the shared FEED_KEY + X-Portal.
const FEED_PORTALS = { cashier: 'Cashier portal', counter: 'Counter staff portal', desk: 'Workshop desk portal', motolab: 'The Moto Lab portal', supervisor: 'Supervisor portal', spares: 'Spares Manager portal', admin: 'Admin panel', accounts: 'Accountant panel', billing: 'Old billing site' };
function feedActor(req) {
  const key = String(req.headers['x-feed-key'] || '');
  const keys = Object.fromEntries(String(process.env.FEED_KEYS || '').split(',').map(x => x.trim().split(':')).filter(x => x.length === 2 && x[0] && x[1]).map(([p, k]) => [k, p]));
  const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const own = Object.entries(keys).find(([k]) => key && same(k, key));
  const shared = process.env.FEED_KEY && key && same(process.env.FEED_KEY, key);
  if (!own && !shared) throw httpError(401, 'Wrong or missing feed key.');
  const portal = own ? own[1] : String(req.headers['x-portal'] || '');
  if (!FEED_PORTALS[portal]) throw httpError(400, `X-Portal must be one of: ${Object.keys(FEED_PORTALS).join(', ')}.`);
  return { id: null, name: String(req.headers['x-by'] || '').trim().slice(0, 60) || FEED_PORTALS[portal], role: 'feed', portal };
}
function me(req) {
  if (req.headers['x-feed-key'] !== undefined) return feedActor(req);
  const raw = auth.readCookie(req);
  if (raw) {
    const a = db.one('SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ? AND s.expires_at > ? AND a.active = 1', auth.sha(raw), new Date().toISOString());
    if (a) return auth.publicAccount(a);
  }
  throw httpError(401, 'Please sign in.');
}
const ALL = ['owner', 'manager', 'store', 'accountant'], STAFF = ['owner', 'manager', 'store'], BOSS = ['owner', 'manager'];
// Inventory 2.0 roles see only their own pages (and the parts list without costs)
const EVERY = [...ALL, 'cashier', 'supervisor', 'counter'];
const LABEL = { owner: 'the owner', manager: 'the manager', store: 'the store keeper', accountant: 'the accountant', cashier: 'the cashier', supervisor: 'the supervisor', counter: 'the counter staff' };
// A read or a change, for these roles
const can = (roles, fn) => wrap((req, res) => {
  const m = me(req);
  if (m.role === 'feed' || !roles.includes(m.role)) throw httpError(403, `Only ${roles.map(r => LABEL[r]).join(' or ')} can do this.`);
  return fn(m, req, res);
});
const change = (roles, fn) => can(roles, (m, req, res) => {
  const out = fn(m, req.body || {}, req, res);
  setImmediate(() => links.flush().catch(() => {}));
  return { ok: true, ...(typeof out === 'string' ? { msg: out } : out) };
});
const feed = fn => wrap((req, res) => { const m = me(req); if (m.role !== 'feed') throw httpError(403, 'Only the other portals call this (X-Feed-Key).'); return fn(m, req, res); });

// ---- sign in -------------------------------------------------------------------------------------------------------
router.post('/login', (req, res) => {
  const { phone, pin } = req.body || {};
  const r = auth.login(phone, pin);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.setHeader('Set-Cookie', auth.cookieHeader(r.cookie, auth.SESSION_DAYS * 86400));
  res.json({ me: r.me });
});
router.post('/logout', (req, res) => { auth.logout(req); res.setHeader('Set-Cookie', auth.cookieHeader('', 0)); res.json({ ok: true }); });
router.post('/pin', change(EVERY, (m, b) => {
  const a = db.one('SELECT * FROM accounts WHERE id = ?', m.id);
  if (!auth.oldPinOk(m.id, b.old, a.pin_hash)) throw httpError(400, 'Your current PIN is wrong.');
  if (!/^\d{4}$/.test(String(b.pin || ''))) throw httpError(400, 'New PIN must be 4 digits.');
  db.run('UPDATE accounts SET pin_hash = ? WHERE id = ?', auth.hashPin(b.pin), m.id);
  inv.audit(m, 'own PIN changed');
  return 'PIN changed.';
}));

// ---- the page's start data -----------------------------------------------------------------------------------------
router.get('/state', can(EVERY, m => ({
  me: m, clock: clock(), demo: process.env.DEMO === '1', kpis: inv.kpis(m),
  // the billing link (server/billing.js): which stores are read straight from the billing, and when they were read last
  live: billing.view(m),
  flow: { badges: flow.badges(m), counters: flow.counters(), brands: flow.brandList(), tatHours: flow.TAT_H, ...(m.role === 'owner' ? { priceMail: db.setting('price_mail', process.env.PRICE_MAIL_TO || '') } : {}) },
  lists: {
    stores: inv.STORES, gst: inv.gstSlabs(), reduceWhy: inv.REDUCE_WHY, payModes: inv.PAY_MODES, mlCats: inv.ML_CATS,
    brands: db.all("SELECT store, brand, count(*) n FROM parts WHERE active = 1 AND brand != '' GROUP BY store, brand ORDER BY brand"),
    racks: db.all("SELECT store, rack, count(*) n FROM parts WHERE active = 1 AND rack != '' GROUP BY store, rack ORDER BY rack"),
    vendors: db.all('SELECT id, name, active, days, gstin, phone FROM vendors ORDER BY name'),
  },
  settings: { reduceAlert: Number(db.setting('reduce_alert', 2000)), ...(m.role === 'owner' ? { alertPhones: inv.alertPhones() } : {}), oldPhotos: !!process.env.OLD_PHOTO_URL },
  push: process.env.ONESIGNAL_APP_ID ? { appId: process.env.ONESIGNAL_APP_ID } : null,
  unseen: inv.alertsFor(m).filter(a => !a.seen).length,
})));

// the billing link only (an open page asks it every few seconds: when ver changed it loads the page again)
router.get('/live', can(EVERY, m => billing.view(m)));

// ---- parts ---------------------------------------------------------------------------------------------------------
router.get('/parts', can(EVERY, (m, req) => inv.listParts(m, req.query)));
router.get('/parts/code/:code', can(EVERY, (m, req) => inv.findByCode(m, req.params.code, req.query.store)));
router.get('/parts/:id', can(EVERY, (m, req) => inv.getPart(m, req.params.id)));
router.post('/parts', change(STAFF, (m, b) => inv.addPart(m, b)));
router.patch('/parts/:id', change(STAFF, (m, b, req) => inv.editPart(m, req.params.id, b)));
router.post('/parts/:id/active', change(BOSS, (m, b, req) => inv.setActive(m, req.params.id, !!b.active)));
router.post('/parts/bulk', change(BOSS, (m, b) => inv.bulkEdit(m, b.ids, b.set || {})));
router.post('/parts/:id/reduce', change(BOSS, (m, b, req) => inv.reduce(m, req.params.id, b)));
router.post('/parts/:id/return', change(STAFF, (m, b, req) => inv.returnIn(m, req.params.id, b)));
router.post('/parts/:id/photos', express.json({ limit: '30mb' }), change(STAFF, (m, b, req) => inv.addPhoto(m, req.params.id, b)));
router.delete('/parts/:id/photos/:pid', change(STAFF, (m, b, req) => inv.delPhoto(m, req.params.id, req.params.pid)));
router.post('/import/parts-csv', express.json({ limit: '30mb' }), change(BOSS, (m, b) => csv.importParts(m, b)));

// ---- vendors, stock in, payments -----------------------------------------------------------------------------------
router.get('/vendors', can(ALL, m => ({ vendors: inv.vendorsList(m) })));
router.get('/vendors/:id', can(ALL, (m, req) => inv.vendorPage(m, req.params.id)));
router.post('/vendors', change([...STAFF, 'accountant'], (m, b) => inv.saveVendor(m, null, b)));
router.patch('/vendors/:id', change([...STAFF, 'accountant'], (m, b, req) => inv.saveVendor(m, req.params.id, b)));
router.get('/bills', can(ALL, (m, req) => ({ bills: inv.listBills(m, req.query) })));
router.get('/bills/:id', can(ALL, (m, req) => inv.billPage(m, req.params.id)));
router.post('/stock-in', change(STAFF, (m, b) => inv.stockIn(m, b)));
router.post('/bills/:id/pay', change(['owner', 'manager', 'accountant'], (m, b, req) => inv.pay(m, req.params.id, b)));
router.post('/bills/:id/cancel', change(BOSS, (m, b, req) => inv.cancelBill(m, req.params.id, b)));
router.post('/vendor-returns', change(BOSS, (m, b) => inv.vendorReturn(m, b)));
router.post('/vendor-returns/:no/done', change(BOSS, (m, b, req) => inv.vendorReturnDone(m, req.params.no, b)));


// ---- Inventory 2.0 · Bike Pharma restock flow (server/flow.js) -----------------------------------------------------
const MONEY = ['owner', 'manager', 'accountant'], UPLOAD = ['owner', 'manager', 'accountant', 'cashier'];
router.get('/flow/dues', can(MONEY, (m, req) => flow.dues(m, req.query)));
router.post('/flow/bills/:id/due', change(MONEY, (m, b, req) => flow.editDue(m, req.params.id, b)));
router.get('/flow/due-history', can(MONEY, (m, req) => ({ rows: flow.dueHistory(req.query) })));
router.get('/flow/calendar', can(MONEY, (m, req) => flow.calendar(m, req.query.month)));
router.post('/flow/read', express.json({ limit: '60mb' }), can(UPLOAD, async (m, req) => {
  const r = await reader.readBill((req.body || {}).files);
  if (!r.ok) return { ok: false, reason: r.reason };
  const lines = flow.lookLines(r.lines);
  return { ok: true, readId: flow.keepRead(r.lines, { no: r.no, date: r.date, total: r.total }), no: r.no, date: r.date, gstin: r.gstin, total: r.total, lines };
}));
router.post('/flow/look', can(UPLOAD, (m, req) => ({ lines: flow.lookLines((req.body || {}).lines) })));
router.post('/flow/upload', change(UPLOAD, (m, b) => flow.uploadBill(m, b)));
router.get('/flow/uploads', can(UPLOAD, m => ({ rows: flow.myUploads(m) })));
router.get('/flow/new-stock', can(['owner', 'manager', 'supervisor'], (m, req) => flow.newStock(m, req.query)));
router.get('/flow/bills/:id', can(['owner', 'manager', 'supervisor', 'accountant', 'cashier', 'counter'], (m, req) => flow.flowBill(m, req.params.id)));
router.post('/flow/bills/:id/assign', change(['owner', 'manager', 'supervisor'], (m, b, req) => flow.assign(m, req.params.id, b)));
router.get('/flow/pricing', can(BOSS, (m, req) => flow.pricing(m, req.query)));
router.post('/flow/price', change(BOSS, (m, b) => flow.price(m, b)));
router.get('/flow/counter', can(['owner', 'manager', 'supervisor', 'counter'], (m, req) => flow.counterList(m, req.query)));
router.post('/flow/lines/:id/stock', change(['owner', 'manager', 'counter'], (m, b, req) => flow.stockLine(m, req.params.id, b)));
router.get('/flow/tracker', can(BOSS, m => flow.tracker(m)));
router.post('/flow/counters', change(['owner'], (m, b) => flow.setCounters(m, b.counters)));
router.post('/flow/price-mail', change(['owner'], (m, b) => {
  const list = String(b.to || '').split(',').map(x => x.trim()).filter(Boolean);
  if (list.some(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) throw httpError(400, 'Check the email address.');
  db.setSetting('price_mail', list.join(','));
  inv.audit(m, 'pricing email changed', list.join(','));
  return list.length ? `Pricing emails go to ${list.join(', ')}.` : 'Pricing emails switched off.';
}));

// ---- transfers, order sheet, reorder, rack checks ------------------------------------------------------------------
router.get('/transfers', can(ALL, (m, req) => ({ transfers: inv.listTransfers(req.query) })));
router.post('/transfers', change(BOSS, (m, b) => inv.transfer(m, b)));
router.get('/orders', can(ALL, (m, req) => inv.orderSheet(req.query)));
router.post('/orders', change(STAFF, (m, b) => inv.addOrder(m, b)));
router.patch('/orders/:id', change(STAFF, (m, b, req) => inv.editOrder(m, req.params.id, b)));
router.get('/reorder', can(ALL, (m, req) => ({ rows: inv.reorder(m, req.query), total: inv.reorderCount(req.query) })));
router.get('/counts', can(ALL, () => ({ counts: inv.listCounts() })));
router.get('/counts/:no', can(ALL, (m, req) => inv.countPage(req.params.no)));
router.post('/counts', change(STAFF, (m, b) => inv.startCount(m, b)));
router.post('/counts/:no/apply', change(BOSS, (m, b, req) => inv.applyCount(m, req.params.no, b)));

// ---- reports and sheets --------------------------------------------------------------------------------------------
router.get('/moves', can(ALL, (m, req) => ({ moves: inv.movesLog(req.query) })));
router.get('/reports/brands', can(ALL, (m, req) => ({ rows: inv.byBrand(m, req.query.store) })));
router.get('/reports/movers', can(ALL, (m, req) => ({ rows: inv.movers(m, req.query) })));
router.get('/reports/gst', can(ALL, (m, req) => ({ rows: inv.gstStock(req.query.store) })));
router.get('/data-check', can(ALL, (m, req) => inv.dataCheck(m, req.query.store)));
router.post('/parts/:id/join', change(BOSS, (m, b, req) => inv.mergeParts(m, req.params.id, b.ids)));
router.post('/data-check/gst-done', change(BOSS, (m, b) => inv.dropGstCheck(m, b.store, b.pno)));
router.get('/reports/dues', can(['owner', 'manager', 'accountant'], () => ({ rows: inv.dues() })));
const SHEETS = {
  parts: (m, q) => csv.exportParts(m, q),
  moves: (m, q) => csv.toCsv(['at', 'store', 'serial_no', 'name', 'qty', 'before', 'after', 'why', 'ref', 'from', 'who', 'note'], inv.movesLog({ ...q, limit: 5000 }).map(x => [x.at, x.store, x.pno, x.name, x.qty, x.before, x.after, x.why, x.ref, x.src, x.who, x.note])),
  transfers: (m, q) => csv.toCsv(['no', 'day', 'direction', 'serial_no', 'name', 'hsn', 'mrp', 'margin_%', 'profit', 'qty', 'stock_before', 'stock_after', 'new_item', 'by', 'note'], inv.listTransfers(q).map(t => [t.no, t.day, t.dir, t.pno, t.name, t.hsn, t.mrp, t.margin, t.profit, t.qty, t.before, t.after, t.new_item ? 'yes' : 'no', t.by, t.note])),
  bills: (m, q) => csv.toCsv(['no', 'vendor', 'vendor_bill_no', 'bill_date', 'due', 'amount', 'paid', 'balance', 'status', 'store', 'entered_by'], inv.listBills(m, q).map(b => [b.no, b.vendor_name, b.inv_no, b.inv_date, b.due, b.amount, b.paid, b.balance, b.status, b.store, b.by])),
  orders: (m, q) => csv.toCsv(['day', 'brand', 'serial_no', 'name', 'qty', 'received', 'vendor', 'promise', 'status', 'by'], inv.orderSheet(q).rows.map(o => [o.day, o.brand, o.pno, o.name, o.qty, o.got, o.vendor, o.promise, o.status, o.by])),
  reorder: (m, q) => csv.toCsv(['store', 'serial_no', 'name', 'brand', 'model', 'rack', 'stock', 'alert', 'sold_90_days', 'on_order', 'suggest', 'level'], inv.reorder(m, { ...q, all: 1 }).map(p => [p.store, p.pno, p.name, p.brand, p.model, p.rack, p.stock, p.alert, p.sold90, p.onOrder, p.suggest, p.level])),
  gst: (m, q) => csv.toCsv(['hsn', 'gst_%', 'parts', 'pieces', 'taxable_value', 'gst_value'], inv.gstStock(q.store).map(r => [r.hsn, r.gst, r.parts, r.pcs, r.taxable, r.tax])),
  brands: (m, q) => csv.toCsv(['brand', 'parts', 'pieces', 'value_at_mrp', ...(inv.seesCost(m) ? ['value_at_cost'] : []), 'low'], inv.byBrand(m, q.store).map(r => [r.brand, r.parts, r.pcs, r.mrpv, ...(inv.seesCost(m) ? [r.costv] : []), r.low])),
};
router.get('/export/:kind', can(ALL, (m, req, res) => {
  const kind = String(req.params.kind).replace(/\.csv$/, '');
  if (!SHEETS[kind]) throw httpError(404, `Sheets: ${Object.keys(SHEETS).join(', ')}.`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${kind}-${C.ymd(C.now())}.csv"`);
  res.send(SHEETS[kind](m, req.query));
}));

// ---- alerts, push, settings, logins --------------------------------------------------------------------------------
router.get('/alerts', can(EVERY, m => ({ alerts: inv.alertsFor(m) })));
router.post('/alerts/seen', change(EVERY, m => inv.seeAlerts(m)));
router.post('/push/device', change(EVERY, (m, b) => {
  const player = String(b.player || '').trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(player)) throw httpError(400, 'Bad device id.');
  db.run('INSERT INTO push_devices (account, player, at) VALUES (?,?,?) ON CONFLICT(player) DO UPDATE SET account = excluded.account, at = excluded.at', m.id, player, inv.stamp());
  return 'This device gets alerts now.';
}));
router.post('/settings', change(['owner'], (m, b) => {
  if (b.gst != null) {
    const list = [...new Set((Array.isArray(b.gst) ? b.gst : String(b.gst).split(',')).map(Number))].filter(n => n >= 0 && n <= 40).sort((a, c) => a - c);
    if (!list.length) throw httpError(400, 'Give at least one GST rate.');
    const used = db.all(`SELECT DISTINCT gst FROM parts WHERE active = 1 AND gst NOT IN (${list.map(() => '?').join(',')})`, ...list).map(r => r.gst);
    if (used.length) throw httpError(400, `Parts still use GST ${used.join(', ')} %. Change those parts first.`);
    db.setSetting('gst_slabs', JSON.stringify(list));
  }
  if (b.reduceAlert != null) { const n = Number(b.reduceAlert); if (!(n >= 0)) throw httpError(400, 'Amount must be 0 or more.'); db.setSetting('reduce_alert', Math.round(n)); }
  if (b.alertPhones != null) {
    const list = String(b.alertPhones).split(',').map(s => s.replace(/\D/g, '').slice(-10)).filter(Boolean);
    if (list.some(p => p.length !== 10)) throw httpError(400, 'Each phone needs 10 digits.');
    db.setSetting('alert_phones', list.join(','));
  }
  inv.audit(m, 'settings changed', JSON.stringify(b).slice(0, 300));
  return 'Settings saved.';
}));
router.get('/links', can(['owner', 'manager'], () => links.status()));
router.post('/links/retry/:id', change(['owner'], (m, b, req) => { links.retry(req.params.id); return 'It will be sent again within a minute.'; }));
router.get('/accounts', can(['owner'], () => ({ accounts: db.all('SELECT id, name, phone, role, ctr, active, created_at FROM accounts ORDER BY active DESC, name'), roles: auth.ROLES })));
router.post('/accounts', change(['owner'], (m, b) => { const id = auth.addAccount(b); inv.audit(m, 'login added', `${b.name} ${b.role}`); return { id, msg: `Login added for ${b.name}.` }; }));
router.patch('/accounts/:id', change(['owner'], (m, b, req) => {
  const a = db.one('SELECT * FROM accounts WHERE id = ?', Number(req.params.id));
  if (!a) throw httpError(404, 'Login not found.');
  if (a.id === m.id && (b.active === false || (b.role && b.role !== 'owner'))) throw httpError(400, 'You cannot switch off or change your own owner login.');
  if ((b.role || a.role) === 'counter' && !(b.ctr != null ? String(b.ctr) : a.ctr)) throw httpError(400, 'Pick the counter (C1 to C4) for a counter login.');
  if (b.role != null) { if (!auth.ROLES[b.role]) throw httpError(400, 'Unknown role.'); db.run('UPDATE accounts SET role = ? WHERE id = ?', b.role, a.id); }
  if (b.ctr != null) { const c = String(b.ctr).toUpperCase(); if (c && !/^C[1-9]$/.test(c)) throw httpError(400, 'Counter must be C1 to C9.'); db.run('UPDATE accounts SET ctr = ? WHERE id = ?', c, a.id); }
  if (b.active != null) { db.run('UPDATE accounts SET active = ? WHERE id = ?', b.active ? 1 : 0, a.id); if (!b.active) db.run('DELETE FROM sessions WHERE account_id = ?', a.id); }
  if (b.pin != null) { if (!/^\d{4}$/.test(String(b.pin))) throw httpError(400, 'PIN must be 4 digits.'); db.run('UPDATE accounts SET pin_hash = ? WHERE id = ?', auth.hashPin(b.pin), a.id); db.run('DELETE FROM sessions WHERE account_id = ?', a.id); }
  inv.audit(m, 'login changed', `${a.name}: ${Object.keys(b).join(', ')}`);
  return 'Login saved.';
}));
router.get('/audit', can(['owner'], (m, req) => ({ log: db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', Math.min(1000, Number(req.query.limit) || 200)) })));

// ---- the other portals (X-Feed-Key) --------------------------------------------------------------------------------
// A bill made at the cashier, a counter, the workshop desk or The Moto Lab takes its parts out of stock (same bill again = only the difference)
router.post('/import/sales', express.json({ limit: '5mb' }), feed((m, req) => ({ ok: true, ...inv.importSales(m, req.body) })));
router.get('/feed/parts', feed((m, req) => {
  const since = Number(req.query.since) || 0, st = inv.STORES[req.query.store] ? req.query.store : 'BS';
  const rows = db.all('SELECT * FROM parts WHERE store = ? AND upd > ? ORDER BY upd LIMIT 2000', st, since);
  const cost = ['admin', 'accounts'].includes(m.portal);
  return { parts: rows.map(p => ({ id: p.id, pno: p.pno, name: p.name, brand: p.brand, model: p.model, hsn: p.hsn, gst: p.gst, mrp: p.mrp, ...(cost ? { cost: p.cost } : {}), dUser: p.d_user, dWhole: p.d_whole, dMech: p.d_mech, stock: p.stock, alert: p.alert, rack: p.rack, bar: p.bar, active: !!p.active, upd: p.upd })),
    next: rows.length ? rows[rows.length - 1].upd : since, more: rows.length === 2000 };
}));
router.get('/feed/stock', feed((m, req) => {
  const st = inv.STORES[req.query.store] ? req.query.store : 'BS';
  const k = inv.pkeyOf(req.query.pno);
  if (!k) throw httpError(400, 'pno is needed.');
  return { parts: db.all('SELECT id, pno, name, model, stock, rack, mrp FROM parts WHERE store = ? AND active = 1 AND (pkey = ? OR bar = ?) ORDER BY stock DESC LIMIT 20', st, k, String(req.query.pno).trim()) };
}));

// ---- sample data (npm run dev) -------------------------------------------------------------------------------------
router.post('/reset', change(['owner'], () => {
  if (process.env.ALLOW_RESET !== '1') throw httpError(403, 'Reset is switched off on this server.');
  seed({ force: true });
  return 'Sample data loaded again.';
}));

module.exports = { router, feedActor };
