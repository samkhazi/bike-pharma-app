// Every API endpoint. Each change answers {ok, msg, state, rev} so the page redraws at once.
'use strict';
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const store = require('./store');
const K = require('./motolab');
const C = require('./clock');
const notify = require('./notify');
const links = require('./links');
const oldlink = require('./oldlink');
const { seed } = require('./seed');

const router = express.Router();
const { httpError } = store;

const demo = () => process.env.DEMO === '1';
function clock() {
  const d = C.now();
  return { today: C.dmy(d), now: C.clock(d), long: C.long(d), short: `${C.long(d).slice(0, 3)} ${d.getDate()} ${C.MONTHS[d.getMonth()].slice(0, 3)}`,
    monthName: C.MONTHS[d.getMonth()], day: d.getDate(), greeting: C.greeting(d), ms: d.getTime(), frozen: !!process.env.DEMO_CLOCK };
}
const rules = () => ({ openFloat: K.OPEN_FLOAT(), discMax: K.DISC_MAX(), diffLimit: K.DIFF_LIMIT(), returnDays: K.RETURN_DAYS(), deadDays: K.DEAD_DAYS(), notes: K.NOTES, cats: K.CATS, sizes: K.SIZES, wa: !!process.env.WHATSAPP_URL });
// The accountant reads everything except the cost prices (profit is for the owner and Mehek only)
function stateFor(me) {
  const s = store.snapshot();
  s.items = K.itemsView();
  if (me.role === 'accountant') s.items = s.items.map(({ cp, ...it }) => it);
  return s;
}
const extra = () => ({ totals: K.totals(), month: K.month(), committed: K.committed() });
const done = (out, me) => ({ ok: true, ...(typeof out === 'string' ? { msg: out } : out), state: stateFor(me), ...extra(), rev: store.revision() });

// ---- who is calling: a signed-in person, or another portal (server-to-server) ---------------------
// Other portals send X-Feed-Key = FEED_KEY (or their own key from FEED_KEYS = "billing:k1,admin:k2,accounts:k3"),
// X-Portal (which portal) and X-By (the person). Off when both are empty.
const FEED = { billing: 'billing', admin: 'owner', accounts: 'accountant' };
const FEED_LABEL = { billing: 'Old billing site', admin: 'Admin panel', accounts: 'Accountant panel' };
function feedActor(req) {
  const key = req.headers['x-feed-key'];
  const own = key ? Object.fromEntries(String(process.env.FEED_KEYS || '').split(',').map(x => x.trim().split(':')).filter(x => x.length === 2 && x[0] && x[1]).map(([p, k]) => [k, p]))[key] : null;
  if (!own && (!key || !process.env.FEED_KEY || key !== process.env.FEED_KEY)) throw httpError(401, 'Wrong or missing feed key.');
  const portal = own || String(req.headers['x-portal'] || '');
  if (!FEED[portal]) throw httpError(400, `X-Portal must be one of: ${Object.keys(FEED).join(', ')}.`);
  const by = String(req.headers['x-by'] || '').trim().slice(0, 60);
  return { id: null, name: by || FEED_LABEL[portal], role: FEED[portal], portal, via: 'feed' };
}
function actor(req) {
  if (req.headers['x-feed-key'] !== undefined) return feedActor(req);
  const me = auth.userFromCookie(req);
  if (!me) throw httpError(401, 'Please sign in.');
  return me;
}

const wrap = fn => async (req, res, next) => { try { const out = await fn(req, res); if (out !== undefined && !res.headersSent) res.json(out); } catch (e) { next(e); } };
const LINKED = ['bills', 'rets', 'orders', 'handovers', 'plans', 'items', 'budget'];
function linked(fn) {
  const snap = () => Object.fromEntries(LINKED.map(n => [n, store.read(n)]));
  const before = snap(); const out = fn(); links.queue(before, snap()); return out;
}
const sendOut = () => { notify.flush().catch(() => {}); links.flush().catch(() => {}); };
const audit = (me, action, detail) => db.run('INSERT INTO audit_log (at, account_id, who, action, detail) VALUES (?,?,?,?,?)', C.stamp(C.now()), me.id, me.name, action, detail || null);
const detailOf = req => [req.params.no, req.params.id].filter(Boolean).join(' ') || undefined;

// One change: check the role, run it in a transaction, log it, bump the revision, send the fresh data.
const STAFF = ['manager', 'owner'];
function act(roles, name, fn) {
  return wrap(async req => {
    const me = actor(req);
    if (!roles.includes(me.role)) throw httpError(403, `Only ${auth.roleText(roles)} can do this.`);
    const out = db.tx(() => linked(() => { const r = fn(me, req.body || {}, req.params); audit(me, name, detailOf(req)); store.bump(); return r; }));
    sendOut();
    return me.via === 'feed' ? { ok: true, ...(typeof out === 'string' ? { msg: out } : out) } : done(out, me);
  });
}

// ---- real data (oldlink.js): bills, returns, stock in, new items and prices are made in the Moto Lab billing site, so they
// are read-only here (nothing is made twice). Orders, warranty claims, the budget, rack counts, sizes and the closing stay here.
const LIVE_BLOCK = [/^\/bills$/, /^\/returns$/, /^\/items$/, /^\/stock-in$/, /^\/import\/(items|hist)$/, /^\/reset$/];
router.use((req, res, next) => {
  if (req.method === 'GET' || !oldlink.live() || !LIVE_BLOCK.some(r => r.test(req.path))) return next();
  res.status(403).json({ error: req.path === '/reset' ? 'The panel shows the real bills. The sample data cannot be loaded.'
    : `Bills, returns, stock in and new items are made in the Moto Lab billing site (${oldlink.BILLING_URL().replace(/^https?:\/\//, '')}). They show here within a minute.` });
});

// ---- sign in -------------------------------------------------------------
router.post('/login', (req, res) => {
  const { phone, pin } = req.body || {};
  const r = auth.login(phone, pin);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.setHeader('Set-Cookie', auth.cookieHeader(r.cookie, auth.SESSION_DAYS * 86400));
  res.json({ me: r.me });
});
router.post('/logout', (req, res) => {
  auth.logout(req);
  res.setHeader('Set-Cookie', auth.cookieHeader('', 0));
  res.json({ ok: true });
});

// ---- data ----------------------------------------------------------------
router.get('/me', wrap(req => ({ me: actor(req), clock: clock() })));
router.get('/state', wrap(req => { const me = actor(req); if (me.via) throw httpError(403, 'Other portals use the feed routes.'); return { me, clock: clock(), rules: rules(), demo: demo(), live: oldlink.live(), billing: oldlink.BILLING_URL(), state: stateFor(me), ...extra(), rev: store.revision() }; }));
router.get('/rev', wrap(req => { actor(req); return { rev: store.revision(), today: clock().today }; }));
router.post('/me/pin', wrap(req => {
  const me = actor(req); if (!me.id) throw httpError(400, 'Only a signed-in person can change a PIN.');
  const { old, pin } = req.body || {};
  const a = db.one('SELECT pin_hash FROM accounts WHERE id = ?', me.id);
  if (!auth.oldPinOk(me.id, old, a.pin_hash)) throw httpError(400, 'Your current PIN is wrong.');
  if (!/^\d{4}$/.test(String(pin))) throw httpError(400, 'The new PIN must be 4 digits.');
  db.run('UPDATE accounts SET pin_hash = ? WHERE id = ?', auth.hashPin(pin), me.id);
  return { ok: true, msg: 'PIN changed.' };
}));
// A customer by phone: name, bike, past bills, orders waiting to be billed, exchange credit
router.get('/customers/:ph', wrap(req => {
  actor(req);
  const ph = K.phone(req.params.ph);
  const cust = store.read('cust').find(c => c.ph === ph) || null;
  const bills = store.read('bills').filter(b => b.ph === ph).slice(0, 20);
  return { cust, bills, spent: K.sum(bills, K.amtOf), orders: store.read('orders').filter(o => o.ph === ph && (o.st === 'ordered' || o.st === 'arrived')),
    credits: store.read('rets').filter(r => r.ph === ph && r.kind === 'exchange' && r.st === 'open') };
}));

router.post('/customers/:ph/sizes', act(STAFF, 'sizes saved', (me, b, p) => K.saveSizes(me, p, b)));

// ---- warranty claims (WC-xxxx) ------------------------------------------------
router.post('/claims', act(STAFF, 'warranty claim', (me, b) => K.newClaim(me, b)));
router.post('/claims/:no/step', act(STAFF, 'claim step', (me, b, p) => K.claimStep(me, p, b)));

// ---- bills, returns --------------------------------------------------------
router.post('/bills', act(STAFF, 'bill', (me, b) => K.makeBill(me, b)));
router.post('/returns', act(STAFF, 'return', (me, b) => K.returnBill(me, b)));

// ---- customer orders (advance MA-xxxx) ----------------------------------------
router.post('/orders', act(STAFF, 'new order', (me, b) => K.newOrder(me, b)));
router.post('/orders/:no/arrived', act(STAFF, 'order arrived', (me, b, p) => K.orderArrived(me, p)));
router.post('/orders/:no/cancel', act(STAFF, 'order cancelled', (me, b, p) => K.orderCancel(me, p, b)));
router.post('/orders/:no/billed', act(STAFF, 'order billed in the billing site', (me, b, p) => K.orderBilled(me, p, b)));

// ---- stock -------------------------------------------------------------------
router.post('/items', act(STAFF, 'new item', (me, b) => K.newItem(me, b)));
router.post('/items/:id', act(STAFF, 'item changed', (me, b, p) => K.editItem(me, p, b)));
router.post('/items/:id/count', act(STAFF, 'stock count', (me, b, p) => K.countItem(me, p, b)));
router.post('/stock-in', act(STAFF, 'stock in', (me, b) => K.stockIn(me, b)));

// ---- purchase budget ------------------------------------------------------------
router.post('/plans', act(STAFF, 'new plan', (me, b) => K.newPlan(me, b)));
router.post('/plans/:id/step', act(STAFF, 'plan step', (me, b, p) => K.planStep(me, p, b)));
router.post('/plans/:id/decide', act(['owner'], 'plan decided', (me, b, p) => K.planDecide(me, p, b)));
router.post('/budget', act(['owner'], 'budget set', (me, b) => K.setBudget(me, b)));
router.post('/target', act(['owner'], 'target set', (me, b) => K.setTarget(me, b)));

// ---- day closing: Mehek's PIN + the accountant's PIN ------------------------------
router.post('/closing', wrap(async req => {
  const me = actor(req);
  if (!STAFF.includes(me.role) || me.via) throw httpError(403, 'Only Mehek (or the owner) hands over the day.');
  const b = req.body || {};
  const mine = auth.verifyPin(me.name, b.pin, null);
  if (mine.error) throw httpError(mine.status, mine.error);
  const acc = auth.verifyPin(b.accName || 'Accountant', b.accPin, ['accountant', 'owner']);
  if (acc.error) throw httpError(acc.status, acc.error);
  const out = db.tx(() => linked(() => { const r = K.closing(me, b, acc); audit(me, 'day handed over', acc.name); store.bump(); return r; }));
  sendOut();
  return done(out, me);
}));
router.post('/closing/reopen', act(['owner'], 'day opened again', me => K.reopenDay(me)));

// ---- reports, lists ------------------------------------------------------------
const csv = rows => rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n') + '\n';
router.get('/export/:kind.csv', wrap((req, res) => {
  const me = actor(req);
  if (!['owner', 'accountant', 'manager'].includes(me.role)) throw httpError(403, 'Not allowed.');
  const m = String(req.query.month || '');   // yyyy-mm
  const inMonth = d => !m || `${d.slice(6)}-${d.slice(3, 5)}` === m;
  let rows;
  if (req.params.kind === 'bills') rows = [['Bill', 'Date', 'Time', 'Customer', 'Phone', 'Items', 'Fitting', 'Discount', 'Total', 'Advance', 'Exchange credit', 'Received', 'Mode', 'Cash part', 'By'],
    ...store.read('bills').filter(b => inMonth(b.date)).map(b => [b.no, b.date, b.at, b.cust, b.ph, b.lines.map(l => `${l[3]} x${l[1]} @${l[2]}`).join('; '), b.fit || 0, b.disc || 0, K.amtOf(b), b.adv || 0, b.credit || 0, K.recv(b), b.mode, b.cash || '', b.by])];
  else if (req.params.kind === 'returns') rows = [['No', 'Bill', 'Date', 'Customer', 'Items', 'Amount', 'How', 'Mode', 'Why', 'By'],
    ...store.read('rets').filter(r => inMonth(r.date)).map(r => [r.no, r.bill, r.date, r.cust, r.lines.map(l => `${l[3]} x${l[1]}`).join('; '), r.amt, r.kind, r.mode, r.why, r.by])];
  else if (req.params.kind === 'stock') rows = [['SKU', 'Item', 'Size', 'Category', 'Brand', 'Rack', 'Stock', 'Selling price', ...(me.role === 'accountant' ? [] : ['Cost price']), 'Sold 30 days', 'Last sale', 'Barcode'],
    ...K.itemsView().map(it => [it.sku, it.name, it.size, it.cat, it.brand, it.rack, it.stock, it.sp, ...(me.role === 'accountant' ? [] : [it.cp || 0]), it.s30, it.last, it.bar])];
  else throw httpError(404, 'Kinds: bills, returns, stock.');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="moto-lab-${req.params.kind}${m ? '-' + m : ''}.csv"`);
  res.send(csv(rows));
}));
router.get('/outbox', wrap(req => { const me = actor(req); if (me.role !== 'owner') throw httpError(403, 'Owner only.'); return { outbox: store.read('outbox'), links: links.status() }; }));
router.get('/audit', wrap(req => { const me = actor(req); if (me.role !== 'owner') throw httpError(403, 'Owner only.'); return { log: db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', Math.min(500, Number(req.query.limit) || 100)) }; }));

// ---- other portals (X-Feed-Key) ---------------------------------------------------
// Catalogue and stock from the old billing site (or the admin panel): rows matched by sku; a new sku is added.
router.post('/import/items', wrap(req => {
  const me = feedActor(req);
  if (!['billing', 'owner'].includes(me.role)) throw httpError(403, 'Only the old billing site or the admin panel sends items.');
  const list = (req.body || {}).items;
  if (!Array.isArray(list) || !list.length || list.length > 5000) throw httpError(400, 'Send {items: [...]} (1 to 5000).');
  const out = db.tx(() => linked(() => {
    const items = store.read('items'); let added = 0, updated = 0;
    for (const [i, x] of list.entries()) {
      const sku = String(x && x.sku || '').trim().toUpperCase();
      if (!sku || !String(x.name || '').trim() || !(Number(x.sp) > 0)) throw httpError(400, `Item ${i + 1}: sku, name and sp are needed.`);
      const cat = K.CATS.includes(x.cat) ? x.cat : 'Bike care';
      const row = { sku, name: String(x.name).trim().slice(0, 80), size: String(x.size || '').slice(0, 12), cat, brand: String(x.brand || 'Moto Lab').slice(0, 40), fits: K.cleanFits(x.fits ?? 'all'),
        rack: String(x.rack || '—').slice(0, 10), sp: Math.round(x.sp), cp: Math.max(0, Math.round(Number(x.cp) || 0)), alert: Math.max(0, Math.round(Number(x.alert ?? 2))),
        ...(x.stock != null ? { stock: Math.round(Number(x.stock) || 0) } : {}), ...(x.bar ? { bar: String(x.bar).slice(0, 20) } : {}),
        ...(x.base30 != null ? { base30: Math.max(0, Math.round(Number(x.base30) || 0)), baseAt: K.today() } : {}), ...(x.last ? { last: String(x.last) } : {}) };
      const it = items.find(y => y.sku === sku);
      if (it) { Object.assign(it, row); updated++; }
      else { const s = store.read('seq'); const id = Number(s.item || 1); s.item = id + 1; store.write('seq', s); items.push({ id, stock: 0, bar: `2900${String(id).padStart(9, '0')}`, added: K.today(), by: me.name, ...row }); added++; }
    }
    store.write('items', items); audit(me, 'items imported', `${added} added, ${updated} updated`); store.bump();
    return { added, updated };
  }));
  sendOut();
  return { ok: true, ...out };
}));
// Sale per day of this month before the portal started: {month: 'mm-yyyy', days: [day1, day2, ...]}
router.post('/import/hist', wrap(req => {
  const me = feedActor(req);
  if (me.role !== 'billing') throw httpError(403, 'Only the old billing site sends this.');
  const { month, days } = req.body || {};
  if (!/^\d{2}-\d{4}$/.test(String(month)) || !Array.isArray(days) || days.length > 31) throw httpError(400, "Send {month: 'mm-yyyy', days: [...]}.");
  db.tx(() => { store.write('hist', { month, days: days.map(v => Math.round(Number(v) || 0)) }, me.name); store.bump(); });
  return { ok: true };
}));
// The admin panel or the accountant panel sets this month's budget; the admin panel sets the target
router.post('/import/budget', act(['owner', 'accountant'], 'budget from another portal', (me, b) => K.setBudget(me, b)));
router.post('/import/target', act(['owner'], 'target from the admin panel', (me, b) => K.setTarget(me, b)));
// A day's sale for the admin panel / accountant panel: GET /api/feed/sales?date=dd-mm-yyyy
router.get('/feed/sales', wrap(req => {
  feedActor(req);
  const d = /^\d{2}-\d{2}-\d{4}$/.test(String(req.query.date || '')) ? req.query.date : K.today();
  return { date: d, totals: K.totals(d), month: d === K.today() ? K.month() : undefined, bills: store.read('bills').filter(b => b.date === d), returns: store.read('rets').filter(r => r.date === d) };
}));

// ---- sample data -----------------------------------------------------------------
router.post('/reset', wrap(req => {
  const me = actor(req);
  if (me.role !== 'owner' && !(demo() && me.role === 'manager')) throw httpError(403, 'Only the owner can reset.');
  if (process.env.ALLOW_RESET !== '1') throw httpError(403, 'Reset is off (ALLOW_RESET).');
  seed(true);
  return done('Sample data loaded again.', me);
}));

module.exports = { router };
