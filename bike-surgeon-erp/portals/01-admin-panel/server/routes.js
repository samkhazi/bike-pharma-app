'use strict';
const crypto = require('node:crypto');
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const store = require('./store');
const C = require('./clock');
const { seed } = require('./seed');

const router = express.Router();
const { requireUser, requireRole } = auth;

function clock() {
  const d = C.now();
  return { today: C.dmy(d), now: C.clock(d), long: C.long(d), month: `${C.MONTHS[d.getMonth()]} ${d.getFullYear()}`, wd: C.workingDays(d), demo: !!process.env.DEMO_CLOCK };
}

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

// ---- gadbad alerts from the Bike Pharma spares portal (server to server) -------
// The spares portal sends: POST /api/alerts/incoming with header X-Alert-Key: <ALERT_KEY>
// body {kind: 'cancel' | 'stock' | 'disc', ref, who, detail, amt}
const ALERT_KINDS = ['cancel', 'stock', 'disc'];
// Both incoming endpoints need the shared key in the X-Alert-Key header
function spareKey(req, res) {
  const key = process.env.ALERT_KEY || '';
  if (!key) { res.status(503).json({ error: 'Alerts are not switched on. Set ALERT_KEY on this server.' }); return false; }
  const got = Buffer.from(String(req.headers['x-alert-key'] || '')), want = Buffer.from(key);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) { res.status(401).json({ error: 'Wrong alert key.' }); return false; }
  return true;
}
const text = (v, n) => String(v ?? '').trim().slice(0, n);

router.post('/alerts/incoming', (req, res) => {
  if (!spareKey(req, res)) return;
  const b = req.body || {};
  if (!ALERT_KINDS.includes(b.kind)) return res.status(400).json({ error: `kind must be one of: ${ALERT_KINDS.join(', ')}.` });
  if (!text(b.ref, 120)) return res.status(400).json({ error: 'ref (bill number or part name) is needed.' });
  const amt = Number(b.amt);
  const d = C.now();
  // extId (optional): the sender's own id for the alert. The same one sent again (its answer was lost) is not a second alert (round 6)
  const extId = text(b.extId, 200);
  const id = db.tx(() => {
    const list = store.readCollection('alerts') || [];
    const had = extId && list.find(a => a.extId === extId);
    if (had) return had.id;
    const alert = { id: Math.max(0, ...list.map(a => a.id)) + 1, kind: b.kind, ref: text(b.ref, 120), who: text(b.who, 80) || 'Bike Pharma counter',
      detail: text(b.detail, 400), amt: Number.isFinite(amt) && amt > 0 ? Math.round(amt) : 0, at: `Today ${C.clock(d)}`, date: C.dmy(d), st: 'open', ...(extId ? { extId } : {}) };
    list.unshift(alert);
    store.writeCollection('alerts', list, null);
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(d), 'alert received', 'alerts', `${alert.kind} ${alert.ref}`);
    db.setSetting('revision', store.revision() + 1);
    return alert.id;
  });
  res.status(201).json({ id });
});

// Owner approvals asked by the spares portal. They show on the admin's Approvals page.
// POST body {type: 'discount' | 'order' | 'writeoff' | 'margin', extId, ref, by, detail, amt, pct}
// extId is the spares portal's own request id: sending it again does not add a second request.
// The spares portal reads the decision with GET /api/approvals/incoming/:extId
const APPROVAL_TYPES = { discount: 'Big discount', order: 'Order above budget', writeoff: 'Stock write-off', margin: 'Low margin' };
router.post('/approvals/incoming', (req, res) => {
  if (!spareKey(req, res)) return;
  const b = req.body || {};
  if (!APPROVAL_TYPES[b.type]) return res.status(400).json({ error: `type must be one of: ${Object.keys(APPROVAL_TYPES).join(', ')}.` });
  const extId = text(b.extId, 80), ref = text(b.ref, 120);
  if (!extId) return res.status(400).json({ error: 'extId (your request id) is needed.' });
  if (!ref) return res.status(400).json({ error: 'ref (bill, order or part) is needed.' });
  const amt = Number(b.amt), pct = Number(b.pct);
  const d = C.now();
  const out = db.tx(() => {
    const list = store.readCollection('approvals') || [];
    const old = list.find(a => a.src === 'Bike Pharma' && a.extId === extId);
    if (old) return { id: old.id, st: old.st, existed: true };
    const ap = { id: Math.max(0, ...list.map(a => a.id)) + 1, type: APPROVAL_TYPES[b.type], ref, by: text(b.by, 80) || 'Spares Sales Manager',
      detail: text(b.detail, 400), amt: Number.isFinite(amt) && amt > 0 ? Math.round(amt) : 0, at: `Today ${C.clock(d)}`, date: C.dmy(d),
      st: 'pending', src: 'Bike Pharma', extId };
    if (Number.isFinite(pct) && pct > 0) ap.pct = Math.round(pct * 10) / 10;
    list.unshift(ap);
    store.writeCollection('approvals', list, null);
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(d), 'approval asked', 'approvals', `${ap.type} ${ap.ref} (Bike Pharma)`);
    db.setSetting('revision', store.revision() + 1);
    return { id: ap.id, st: ap.st };
  });
  res.status(out.existed ? 200 : 201).json({ id: out.id, st: out.st });
});

router.get('/approvals/incoming/:extId', (req, res) => {
  if (!spareKey(req, res)) return;
  const ap = (store.readCollection('approvals') || []).find(a => a.src === 'Bike Pharma' && a.extId === req.params.extId);
  if (!ap) return res.status(404).json({ error: 'No such request.' });
  // st: pending | approved | rejected; note: why the owner said no (Spares and Supervisor show it)
  res.json({ id: ap.id, st: ap.st, by: ap.dec || null, ...(ap.note ? { note: ap.note } : {}) });
});

// Job card reopen and bill corrections from the service portal (Saniya). Ganesh or the owner decides in Approvals.
// POST /api/requests/incoming (X-Alert-Key)
//   {kind:'reopen', no, jc, plate, model, by, why}
//   {kind:'billfix', no, bill, jc, by, why, lines:[[name, amount]], diff}
// GET  /api/requests/incoming/:kind/:no  -> {st: asked|ok|no|done, okBy, okAt}. On 'ok' the service portal opens the
//      job card again (closed = null) or changes the bill, then POST /api/requests/incoming/billfix/:no/done.
const REQ_KINDS = ['reopen', 'billfix'];
router.post('/requests/incoming', (req, res) => {
  if (!spareKey(req, res)) return;
  const b = req.body || {};
  if (!REQ_KINDS.includes(b.kind)) return res.status(400).json({ error: 'kind must be reopen or billfix.' });
  const no = text(b.no, 30), why = text(b.why, 400);
  if (!no) return res.status(400).json({ error: 'no (the request number) is needed.' });
  if (!why) return res.status(400).json({ error: 'A reason is needed.' });
  const d = C.now();
  // src: which portal asked (round 8: Saniya's desk, the advisor portal or the cashier portal all ask here)
  const src = text(req.headers['x-portal'], 20);
  const row = { no, by: text(b.by, 80) || 'Service portal', at: `Today ${C.clock(d)}`, date: C.dmy(d), why, st: 'asked', ...(src ? { src } : {}) };
  if (b.kind === 'reopen') {
    if (!text(b.jc, 30)) return res.status(400).json({ error: 'jc (job card number) is needed.' });
    Object.assign(row, { jc: text(b.jc, 30), plate: text(b.plate, 20), model: text(b.model, 60) });
  } else {
    const lines = Array.isArray(b.lines) ? b.lines.filter(l => Array.isArray(l) && Number.isFinite(Number(l[1]))).slice(0, 30).map(l => [text(l[0], 120), Math.round(Number(l[1]))]) : [];
    if (!text(b.bill, 30) || !lines.length) return res.status(400).json({ error: 'bill and at least one line [name, amount] are needed.' });
    Object.assign(row, { bill: text(b.bill, 30), jc: text(b.jc, 30), lines, diff: lines.reduce((t, l) => t + l[1], 0) });
  }
  const out = db.tx(() => {
    const list = store.readCollection(b.kind) || [];
    const old = list.find(x => x.no === no);
    if (old) return { status: 200, st: old.st };
    list.unshift(row);
    store.writeCollection(b.kind, list, null);
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(d), 'request received', b.kind, `${no} ${row.jc || row.bill}`);
    db.setSetting('revision', store.revision() + 1);
    return { status: 201, st: 'asked' };
  });
  res.status(out.status).json({ no, st: out.st });
});
router.get('/requests/incoming/:kind/:no', (req, res) => {
  if (!spareKey(req, res)) return;
  if (!REQ_KINDS.includes(req.params.kind)) return res.status(404).json({ error: 'No such list.' });
  const x = (store.readCollection(req.params.kind) || []).find(r => r.no === req.params.no);
  if (!x) return res.status(404).json({ error: 'No such request.' });
  res.json({ no: x.no, st: x.st, okBy: x.okBy || null, okAt: x.okAt || null, ...(x.noWhy ? { note: x.noWhy } : {}), ...(x.doneNo ? { doneNo: x.doneNo, mode: x.mode || null } : {}) });
});
// Round 8: the admin panel is the one approver. The cashier and Saniya's desk read every answer here each minute, so a
// reopen the advisor asked also holds / opens the job card at the cashier and on Saniya's desk.
// GET /api/requests/list (X-Alert-Key) -> {reqs: [{kind, no, jc, bill, by, why, st, okBy, okAt, note, src, doneNo}]}, newest 300
router.get('/requests/list', (req, res) => {
  if (!spareKey(req, res)) return;
  const pick = kind => (store.readCollection(kind) || []).slice(0, 150).map(x => ({ kind, no: x.no, date: x.date || null, jc: x.jc || null, ...(x.bill ? { bill: x.bill } : {}), by: x.by, why: x.why,
    st: x.st, okBy: x.okBy || null, okAt: x.okAt || null, ...(x.noWhy ? { note: x.noWhy } : {}), ...(x.src ? { src: x.src } : {}), ...(x.doneNo ? { doneNo: x.doneNo } : {}) }));
  res.json({ reqs: [...pick('reopen'), ...pick('billfix')] });
});
// The Cashier panel reads the real bills + job cards of the Bike Surgeon service counter (Sam 6 Nov: Misba's cashier panel on real data)
// GET /api/feed/cashier (X-Alert-Key) -> {live, at, v, invoices: Bike Surgeon bills of the last 40 days, jobs: today's + still open job cards}
// ?v=<the v it holds>: nothing changed = {same: true, v} (the Cashier asks every few seconds, the lists come only on a change)
router.get('/feed/cashier', (req, res) => {
  if (!spareKey(req, res)) return;
  const C = require('./clock'), ob = require('./oldbill');
  const vs = store.versions(), v = `${vs.invoices || 0}.${vs.jobs || 0}.${C.dmy(C.now())}.${ob.linked() ? 1 : 0}`;
  if (req.query.v && req.query.v === v) return res.json({ same: true, v });
  const k = d => String(d || '').split('-').reverse().join('-');
  const from = k(C.dmy(C.addDays(C.now(), -40)));
  const invoices = (store.readCollection('invoices') || []).filter(b => b.b === 'bs' && k(b.date) >= from);
  const jobs = store.readCollection('jobs') || [];
  res.json({ live: ob.linked(), at: C.stamp ? C.stamp(C.now()) : '', v, invoices, jobs });
});
// The Moto Lab panel reads the real items and bills of the Moto Lab billing (Sam 27 Nov: "all data live, Moto Lab connected")
// GET /api/feed/motolab (X-Alert-Key) -> {live, at, items: [...] (null = not read), bills: [...]}, worked out like the billing
router.get('/feed/motolab', (req, res) => {
  if (!spareKey(req, res)) return;
  const ob = require('./oldbill'), f = ob.motolab();
  res.json({ live: ob.linked() && !!f, at: f ? f.at : '', items: f ? f.items : null, bills: f ? f.bills : [] });
});
// The Workshop desk reads who is the backup today: GET /api/requests/backup -> {name, ph, setBy, at} or {}
router.get('/requests/backup', (req, res) => {
  if (!spareKey(req, res)) return;
  res.json(store.readCollection('backup') || {});
});
router.post('/requests/incoming/billfix/:no/done', (req, res) => {
  if (!spareKey(req, res)) return;
  const r = db.tx(() => {
    const list = store.readCollection('billfix') || [];
    const x = list.find(y => y.no === req.params.no);
    if (!x) return 404;
    if (x.st === 'done') return 200; // sent again (the desk did not get the first answer): already done, round 6
    if (x.st !== 'ok') return 409;
    // the admin is told which bill settled it (BS-xxxx-A), how, and by whom (round 7)
    const b = req.body || {};
    Object.assign(x, { st: 'done', doneNo: text(b.doneNo, 30) || null, mode: text(b.mode, 10) || null, doneBy: text(b.by, 60) || null, doneAt: text(b.at, 30) || null });
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(C.now()), 'bill correction settled', 'billfix', `${x.no} ${x.doneNo || ''} ${x.mode || ''}`.trim());
    store.writeCollection('billfix', list, null);
    db.setSetting('revision', store.revision() + 1);
    return 200;
  });
  if (r !== 200) return res.status(r).json({ error: r === 404 ? 'No such request.' : 'Only an approved correction can be marked done.' });
  res.json({ no: req.params.no, st: 'done' });
});

// Reports from the Bike Pharma counter portal (14 Oct): warranty claims, rack checks, dead stock ideas,
// garage summaries, cancelled orders with advances returned, and bills made without internet.
// POST /api/import/counter with header X-Alert-Key: <ALERT_KEY>, body {list, rows: [...]}
// Rows are matched by their own number (garage summaries by phone + month): a row sent again replaces the old one.
const COUNTER_LISTS = { claims: 'no', rackc: 'no', deadsug: 'no', gsum: 'ph+month', bookings: 'no', offBills: 'no' };
router.post('/import/counter', (req, res) => {
  if (!spareKey(req, res)) return;
  const { list, rows } = req.body || {};
  const key = COUNTER_LISTS[list];
  if (!key) return res.status(400).json({ error: `list must be one of: ${Object.keys(COUNTER_LISTS).join(', ')}.` });
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) return res.status(400).json({ error: 'rows must be a list of 1 to 500 items.' });
  const idOf = r => key === 'ph+month' ? (r.ph && r.month ? `${r.ph}|${r.month}` : '') : String(r.no || '');
  if (rows.some(r => !r || typeof r !== 'object' || Array.isArray(r) || !idOf(r))) return res.status(400).json({ error: key === 'ph+month' ? 'Every row needs ph and month.' : 'Every row needs its no.' });
  const out = db.tx(() => {
    const cur = store.readCollection(list) || [];
    const at = new Map(cur.map((r, i) => [idOf(r), i]));
    const fresh = new Map();
    let updated = 0;
    for (const r of rows) { const k = idOf(r); if (at.has(k)) { cur[at.get(k)] = r; updated++; } else fresh.set(k, r); }
    const added = fresh.size;
    store.writeCollection(list, [...[...fresh.values()].reverse(), ...cur], null);
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(C.now()), 'counter import', list, `${added} added, ${updated} updated`);
    db.setSetting('revision', store.revision() + 1);
    return { added, updated };
  });
  res.json(out);
});

// Round 8: the workshop numbers come from the Floor Manager (service-portal), which sends its floor every minute.
// POST /api/import/workshop with X-Alert-Key, body {jobs, jobx, spareWait, month: {sales, labour, vehicles, past: {sales:[],
// labour:[], vehicles:[]}, today: {sales, labour, vehicles}, target}, at}. Today / Service floor / Waiting for spares and the
// Bike Surgeon target row then show the Floor Manager's numbers (money on the bill day, as the cashier and the accountant).
// While it is on, those three lists are read-only here (store.js).
router.post('/import/workshop', (req, res) => {
  if (!spareKey(req, res)) return;
  const b = req.body || {};
  const arr = (v, n) => Array.isArray(v) && v.length <= n && v.every(x => x && typeof x === 'object' && !Array.isArray(x));
  if (!arr(b.jobs, 500) || !arr(b.spareWait, 500) || !b.jobx || typeof b.jobx !== 'object' || Array.isArray(b.jobx)) return res.status(400).json({ error: 'Send {jobs: [...], jobx: {...}, spareWait: [...], month: {...}}.' });
  const m = b.month || {};
  const num = v => Math.round(Number(v) || 0);
  const nums = v => (Array.isArray(v) ? v : []).slice(0, 31).map(num);
  const month = { sales: num(m.sales), labour: num(m.labour), vehicles: num(m.vehicles), target: num(m.target),
    past: { sales: nums(m.past && m.past.sales), labour: nums(m.past && m.past.labour), vehicles: nums(m.past && m.past.vehicles) },
    today: { sales: num(m.today && m.today.sales), labour: num(m.today && m.today.labour), vehicles: num(m.today && m.today.vehicles) } };
  db.tx(() => {
    store.writeCollection('jobs', b.jobs, null);
    store.writeCollection('jobx', b.jobx, null);
    store.writeCollection('spareWait', b.spareWait, null);
    store.writeCollection('floor', { at: text(b.at, 30) || C.stamp(C.now()), date: C.dmy(C.now()), month }, null);
    db.setSetting('revision', store.revision() + 1);
  });
  res.json({ ok: true, jobs: b.jobs.length, spareWait: b.spareWait.length });
});

// The Moto Lab portal (Mehek Taj's store, 16 Oct): its bills, stock and month summary come in here so the admin shows
// The Moto Lab on its own page and in its own reports, never mixed into Bike Surgeon numbers.
// POST /api/import/motolab with X-Alert-Key (X-Portal: motolab), body with one or more of:
//   invoices: [{no, date, items: [[name, qty, rate]], lab, ...}]  upserted by no, always b 'ml'; read-only here (src 'motolab')
//   inventory: [{serial, name, stock, sp, cp, ...}]               upserted by serial among the b 'ml' rows; a new row gets the next id
//   summary: {date, at, month, today, orders, claims, budget, closing, byCat, top, stock}  replaces the collection motolab
// Rates may be negative (discount, exchange credit and MR- refund lines). Bill total = sum(qty * rate) + lab.
const ML_ST = ['paid', 'pending', 'draft', 'returned'];
router.post('/import/motolab', (req, res) => {
  if (!spareKey(req, res)) return;
  const b = req.body || {};
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  const bad = msg => res.status(400).json({ error: msg });
  if (!obj(b) || (b.invoices === undefined && b.inventory === undefined && b.summary === undefined)) return bad('Send {invoices: [...], inventory: [...], summary: {...}} (one or more).');
  if (b.invoices !== undefined) {
    if (!Array.isArray(b.invoices) || b.invoices.length > 2000) return bad('invoices must be a list of up to 2000 bills.');
    for (const v of b.invoices) {
      if (!obj(v) || !text(v.no, 30)) return bad('Every bill needs its no.');
      if (!Array.isArray(v.items) || v.items.some(it => !Array.isArray(it) || !String(it[0] ?? '').trim() || !Number.isFinite(Number(it[1])) || !Number.isFinite(Number(it[2]))))
        return bad(`${text(v.no, 30)}: items must be [name, qty, rate] lines.`);
      if (v.lab != null && !Number.isFinite(Number(v.lab))) return bad(`${text(v.no, 30)}: lab must be a number.`);
    }
  }
  if (b.inventory !== undefined && store.invLink()) delete b.inventory;   // stock comes from the Inventory portal (29 Oct)
  if (b.inventory !== undefined) {
    if (!Array.isArray(b.inventory) || b.inventory.length > 5000) return bad('inventory must be a list of up to 5000 items.');
    if (b.inventory.some(x => !obj(x) || !text(x.serial, 60))) return bad('Every stock item needs its serial.');
  }
  if (b.summary !== undefined && (!obj(b.summary) || (b.summary.month != null && !obj(b.summary.month)) || (b.summary.today != null && !obj(b.summary.today))))
    return bad('summary must be an object ({date, at, month: {...}, today: {...}, ...}).');
  const d = C.now();
  const out = db.tx(() => {
    const r = {};
    const parts = [];
    if (b.invoices !== undefined) {
      const cur = store.readCollection('invoices') || [];
      const at = new Map(cur.map((v, i) => [v.no, i]));
      const fresh = new Map();
      let updated = 0;
      for (const v of b.invoices) {
        const row = { ...v, no: text(v.no, 30), b: 'ml', src: 'motolab', disc: 0, st: ML_ST.includes(v.st) ? v.st : 'paid',
          items: v.items.map(it => [String(it[0]).slice(0, 160), Number(it[1]), Number(it[2])]), lab: Number(v.lab) || 0 };
        row.amt = store.billTotal(row);
        if (at.has(row.no)) {
          const i = at.get(row.no);
          if (cur[i].b !== 'ml') continue;   // never overwrite a Bike Surgeon bill with the same number
          cur[i] = row; updated++;
        } else fresh.set(row.no, row);
      }
      store.writeCollection('invoices', [...[...fresh.values()].reverse(), ...cur], null);
      r.invoices = { added: fresh.size, updated };
      parts.push(`bills ${fresh.size} added, ${updated} updated`);
    }
    if (b.inventory !== undefined) {
      const cur = store.readCollection('inventory') || [];
      const at = new Map(); cur.forEach((x, i) => { if (x.b === 'ml') at.set(String(x.serial), i); });
      let next = Math.max(0, ...cur.map(x => Number(x.id)).filter(Number.isFinite)) + 1;
      let added = 0, updated = 0;
      for (const x of b.inventory) {
        const serial = text(x.serial, 60);
        if (at.has(serial)) { const i = at.get(serial); cur[i] = { ...cur[i], ...x, serial, id: cur[i].id, b: 'ml' }; updated++; }
        else { const row = { cd: 0, wd: 0, md: 0, ...x, serial, id: next++, b: 'ml' }; cur.push(row); at.set(serial, cur.length - 1); added++; }
      }
      store.writeCollection('inventory', cur, null);
      r.inventory = { added, updated };
      parts.push(`stock ${added} added, ${updated} updated`);
    }
    if (b.summary !== undefined) {
      store.writeCollection('motolab', { ...b.summary, got: C.stamp(d) }, null);
      r.summary = true;
      parts.push(`summary of ${text(b.summary.date, 20) || 'today'}`);
    }
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(d), 'Moto Lab import', 'motolab', parts.join('; '));
    db.setSetting('revision', store.revision() + 1);
    return r;
  });
  res.json({ ok: true, ...out });
});

// The Inventory portal (12, 29 Oct): Bike Surgeon and The Moto Lab stock. POST /api/import/inventory with X-Alert-Key,
// body {parts: [{inv, b, active, serial, name, brand, model, stock, alert, rack, sp, cp, tax, hsn, cd, wd, md, date, lastSold, img}], url}.
// Rows are matched by `inv` (the Inventory portal's id); active: false removes the row. The first send replaces the
// stock list typed here (sample rows), and from then on stock and transfers are read-only in this panel.
// Discounts already set here (from the Spares portal, with discBy) are kept, except while the Inventory reads the billing
// (live: true): then the billing's discounts are sent and shown.
router.post('/import/inventory', (req, res) => {
  if (!spareKey(req, res)) return;
  const b = req.body || {};
  if (!Array.isArray(b.parts) || b.parts.length > 5000 || b.parts.some(x => !x || typeof x !== 'object' || !Number.isInteger(Number(x.inv)) || Number(x.inv) <= 0 || !['bs', 'ml'].includes(x.b)))
    return res.status(400).json({ error: 'Send {parts: [{inv, b: bs|ml, serial, name, stock, ...}]} (up to 5000).' });
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const out = db.tx(() => {
    const first = !store.invLink();
    const cur = first ? [] : (store.readCollection('inventory') || []);
    const at = new Map(cur.map((x, i) => [Number(x.inv), i]));
    let added = 0, updated = 0, removed = 0;
    const drop = new Set();
    for (const x of b.parts) {
      const inv = Number(x.inv), i = at.get(inv);
      if (x.active === false) { if (i !== undefined) { drop.add(i); removed++; } continue; }
      const row = { id: inv, inv, b: x.b, serial: text(x.serial, 60), name: text(x.name, 160), brand: text(x.brand, 60), model: text(x.model, 160),
        stock: Math.round(num(x.stock)), alert: Math.round(num(x.alert)), rack: text(x.rack, 30), sp: num(x.sp), cp: num(x.cp), tax: num(x.tax), hsn: text(x.hsn, 12),
        cd: num(x.cd), wd: num(x.wd), md: num(x.md), date: text(x.date, 10), lastSold: text(x.lastSold, 10), img: !!x.img, by: 'Inventory' };
      if (i !== undefined) {
        const o = cur[i];
        // while the Inventory portal reads the billing (live), the billing's discounts are the ones that count
        if (o.discBy && !b.live) { row.cd = o.cd; row.wd = o.wd; row.md = o.md; row.discBy = o.discBy; row.discAt = o.discAt; }
        cur[i] = row; updated++;
      } else { cur.push(row); at.set(inv, cur.length - 1); added++; }
    }
    const list = drop.size ? cur.filter((x, i) => !drop.has(i)) : cur;
    store.writeCollection('inventory', list, null);
    if (first) db.setSetting('inv_link', /^https:\/\//.test(String(b.url || '')) ? String(b.url).slice(0, 200) : 'linked');
    db.setSetting('inv_live', b.live ? '1' : '0');   // the Inventory reads the billing: its discounts are the ones shown
    db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(C.now()), 'Inventory import', 'inventory', `${added} added, ${updated} updated, ${removed} removed${first ? ' (first send: the typed stock list was replaced)' : ''}`);
    db.setSetting('revision', store.revision() + 1);
    return { added, updated, removed, total: list.length };
  });
  res.json({ ok: true, ...out });
});

// Ganesh's part discounts from the Spares Manager portal (round 5, Spares is the one place they are set).
// POST /api/import/discounts with X-Alert-Key, body {discounts: [{pno, disc: {cust, mech, by, at} | null}]}.
// Matched to Inventory by part number (serial). C = cust, M = mech; W (wholesellers) gets the mechanic (trade) rate.
const normNo = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
router.post('/import/discounts', (req, res) => {
  if (!spareKey(req, res)) return;
  const list = (req.body || {}).discounts;
  if (!Array.isArray(list) || !list.length || list.length > 2000) return res.status(400).json({ error: 'discounts must be a list of 1 to 2000 items.' });
  if (list.some(d => !d || typeof d !== 'object' || !normNo(d.pno))) return res.status(400).json({ error: 'Every row needs its pno.' });
  // while the Inventory reads the billing, the Stock list shows the billing's discounts (the ones it bills with): these wait
  if (db.setting('inv_live', '0') === '1') return res.json({ updated: 0, unknown: [], live: true });
  const pct = v => Math.max(0, Math.min(100, Math.round((Number(v) || 0) * 10) / 10));
  const out = db.tx(() => {
    const inv = store.readCollection('inventory') || [];
    let updated = 0; const unknown = [];
    for (const d of list) {
      const hit = inv.filter(x => normNo(x.serial) === normNo(d.pno));
      if (!hit.length) { unknown.push(String(d.pno).slice(0, 40)); continue; }
      const disc = d.disc && typeof d.disc === 'object' ? d.disc : null;
      for (const x of hit) Object.assign(x, { cd: disc ? pct(disc.cust) : 0, md: disc ? pct(disc.mech) : 0, wd: disc ? pct(disc.mech) : 0,
        discBy: disc ? text(disc.by, 40) || 'Ganesh' : '', discAt: disc ? text(disc.at, 20) : '' });
      updated += hit.length;
    }
    if (updated) {
      store.writeCollection('inventory', inv, null);
      db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(C.now()), 'discounts from Spares', 'inventory', `${updated} parts updated`);
      db.setSetting('revision', store.revision() + 1);
    }
    return { updated, unknown: unknown.slice(0, 50) };
  });
  res.json(out);
});

router.use(requireUser);

router.get('/me', (req, res) => res.json({ me: req.me, clock: clock() }));

router.post('/me/pin', (req, res) => {
  const { old, pin } = req.body || {};
  const a = db.one('SELECT pin_hash FROM accounts WHERE id = ?', req.me.id);
  if (!auth.oldPinOk(req.me.id, old, a.pin_hash)) return res.status(400).json({ error: 'Your current PIN is wrong.' });
  if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ error: 'The new PIN must be 4 digits.' });
  db.run('UPDATE accounts SET pin_hash = ? WHERE id = ?', auth.hashPin(pin), req.me.id);
  res.json({ ok: true });
});

// ---- data ----------------------------------------------------------------
router.get('/state', (req, res) => {
  let have = null;
  try { const h = req.query.have ? JSON.parse(String(req.query.have)) : null; if (h && typeof h === 'object' && !Array.isArray(h)) have = h; } catch { /* full state */ }
  res.json({ me: req.me, clock: clock(), ...store.snapshot(req.me, have) });
});
router.get('/rev', (req, res) => res.json({ rev: store.revision(), today: clock().today }));
router.post('/sync', (req, res) => {
  const { changes, ver } = req.body || {};
  res.json(store.sync(req.me, changes, ver));
});

router.post('/reset', requireRole('owner'), (req, res) => {
  if (process.env.ALLOW_RESET !== '1') return res.status(403).json({ error: 'Reset is switched off on this server.' });
  seed({ force: true });
  res.json({ ok: true });
});

// ---- logins (owner) ------------------------------------------------------
router.get('/accounts', requireRole('owner'), (req, res) =>
  res.json(db.all('SELECT id, name, phone, role, business, active, created_at FROM accounts ORDER BY id')));

router.post('/accounts', requireRole('owner'), (req, res) => {
  const id = auth.addAccount(req.body || {});
  db.run('INSERT INTO audit_log (at, account_id, action, detail) VALUES (?,?,?,?)', C.stamp(C.now()), req.me.id, 'login added', `${req.body.name} (${req.body.role})`);
  res.status(201).json({ id });
});

router.post('/accounts/:id/pin', requireRole('owner'), (req, res) => {
  const { pin } = req.body || {};
  if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ error: 'PIN must be 4 digits.' });
  const r = db.run('UPDATE accounts SET pin_hash = ? WHERE id = ?', auth.hashPin(pin), Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'No such login.' });
  db.run('DELETE FROM sessions WHERE account_id = ?', Number(req.params.id));
  res.json({ ok: true });
});

router.post('/accounts/:id/active', requireRole('owner'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.me.id) return res.status(400).json({ error: 'You cannot switch off your own login.' });
  const active = req.body && req.body.active ? 1 : 0;
  const r = db.run('UPDATE accounts SET active = ? WHERE id = ?', active, id);
  if (!r.changes) return res.status(404).json({ error: 'No such login.' });
  if (!active) db.run('DELETE FROM sessions WHERE account_id = ?', id);
  res.json({ ok: true });
});

router.get('/audit', requireRole('owner', 'accountant'), (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100);
  res.json(db.all(`SELECT l.at, coalesce(a.name, 'System') who, l.action, l.collection, l.detail
                   FROM audit_log l LEFT JOIN accounts a ON a.id = l.account_id ORDER BY l.id DESC LIMIT ?`, limit));
});

router.get('/salary-runs', requireRole('owner', 'accountant'), (req, res) =>
  res.json(db.all('SELECT * FROM salary_runs ORDER BY created_at DESC')));

// ---- exports (CSV opens in Excel; the sales file imports into Tally / Zoho) --------
const cell = v => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // stops Excel running formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = rows => '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
const r2 = n => Math.round(n * 100) / 100;
// '12-10-2026' -> '2026-10-12'
const iso = d => { const m = String(d || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const inRange = (d, q) => { const x = iso(d); return (!q.from || x >= q.from) && (!q.to || x <= q.to) && (!q.month || x.startsWith(q.month)); };
const inBiz = (x, q) => !q.b || q.b === 'all' || x.b === q.b;

const EXPORTS = {
  sales(q) {
    const rows = [['Bill no', 'Date', 'Business', 'Branch', 'Customer', 'Phone', 'Vehicle', 'Customer type', 'Line', 'Kind', 'Qty', 'Rate', 'Discount %', 'Amount', 'Payment', 'Status', 'Billed by']];
    for (const v of store.readCollection('invoices') || []) {
      if (!inBiz(v, q) || !inRange(v.date, q) || (q.no && v.no !== q.no)) continue;
      const base = [v.no, iso(v.date), v.b === 'bs' ? 'Bike Surgeon' : 'The Moto Lab', (v.br || 'rnr').toUpperCase(), v.cust, v.ph, v.plate, v.type];
      const tail = [v.pay, v.st, v.by];
      // a minus line of an old bill (special discount, coupon, wallet) is a discount, not goods; the rate to the paisa
      for (const [name, qty, rate] of v.items || []) rows.push([...base, name, rate < 0 ? 'Discount' : 'Goods', qty, r2(rate), v.disc || 0, r2(qty * rate * (1 - (v.disc || 0) / 100)), ...tail]);
      if (v.lab) rows.push([...base, 'Labour', 'Service', 1, v.lab, 0, v.lab, ...tail]);
    }
    return rows;
  },
  inventory(q) {
    const rows = [['Item id', 'Business', 'Serial', 'Name', 'Brand', 'Model', 'Stock', 'Low stock alert', 'Rack', 'Cost price', 'Selling price', 'GST %', 'HSN', 'Last sold']];
    for (const x of store.readCollection('inventory') || []) if (inBiz(x, q))
      rows.push([x.id, x.b, x.serial, x.name, x.brand, x.model, x.stock, x.alert, x.rack, x.cp, x.sp, x.tax, x.hsn, iso(x.lastSold)]);
    return rows;
  },
  credit(q) {
    const rows = [['Name', 'Phone', 'Type', 'Business', 'Branch', 'Billed', 'Paid', 'Due']];
    for (const c of store.readCollection('credit') || []) if (inBiz(c, q)) {
      const billed = (c.bills || []).reduce((t, b) => t + b[2], 0);
      const paid = (c.bills || []).reduce((t, b) => t + b[3], 0);
      rows.push([c.name, c.ph, c.type, c.b, (c.br || 'rnr').toUpperCase(), billed, paid, billed - paid]);
    }
    return rows;
  },
  expenses(q) {
    const rows = [['Date', 'Type', 'Note', 'Amount', 'Mode', 'Business', 'Branch']];
    for (const x of store.readCollection('expenses') || []) if (inBiz(x, q) && inRange(x.date, q))
      rows.push([iso(x.date), x.cat, x.note, x.amt, x.mode, x.b, (x.br || 'rnr').toUpperCase()]);
    return rows;
  },
  feedback() {
    const rows = [['Job card', 'Vehicle', 'Model', 'Customer', 'Phone', 'Service', 'Status']];
    for (const f of store.readCollection('feedback') || []) rows.push([f.jc, f.plate, f.model, f.cust, f.ph, f.service, f.st]);
    return rows;
  },
  transfers(q) {
    const rows = [['Transfer no', 'Date', 'Direction', 'Part', 'Part no', 'Qty', 'MRP', 'Value', 'By', 'Sent with', 'Status', 'Qty received']];
    for (const t of store.readCollection('transfers') || []) if (inRange(t.date, q))
      rows.push([t.no, iso(t.date), t.dir === 'dvg-rnr' ? 'DVG to RNR' : 'RNR to DVG', t.part, t.pno, t.qty, t.mrp, r2(t.qty * t.mrp), t.by, t.via, t.st, t.rcv]);
    // Monthly totals at the bottom, like the old panel's Monthly Report
    const tot = dir => { const L = rows.slice(1).filter(r => r[2] === dir); return [L.length, L.reduce((s, r) => s + r[5], 0), r2(L.reduce((s, r) => s + r[7], 0))]; };
    rows.push([]);
    for (const dir of ['DVG to RNR', 'RNR to DVG']) { const [n, qty, val] = tot(dir); rows.push([`Total ${dir}`, '', '', `${n} transfers`, '', qty, '', val]); }
    return rows;
  },
  claims() {
    const rows = [['Claim no', 'Date', 'Counter', 'Bill', 'Part', 'Part no', 'Qty', 'Why', 'Customer gets', 'Vendor', 'Sent on', 'Status', 'Taken by']];
    for (const c of store.readCollection('claims') || []) rows.push([c.no, iso(c.date), c.ctr, c.bill, c.name, c.pno, c.qty || 1, c.why, c.give, c.v || '', c.sentAt ? iso(c.sentAt) : '', c.st, c.by]);
    return rows;
  },
  calls() {
    const rows = [['Vehicle', 'Customer', 'Advisor', 'Result', 'When']];
    for (const c of (store.readCollection('reminders') || {}).calls || []) rows.push(c);
    return rows;
  },
};
const EXPORT_ROLES = { sales: ['owner', 'accountant', 'manager'], inventory: ['owner', 'accountant', 'manager', 'reception'], credit: ['owner', 'accountant'], expenses: ['owner', 'accountant'], feedback: ['owner', 'manager', 'advisor', 'reception', 'service'], calls: ['owner', 'manager', 'advisor', 'service'], transfers: ['owner', 'manager'], claims: ['owner', 'accountant', 'manager'] };

router.get('/export/:kind.csv', (req, res) => {
  const kind = req.params.kind, make = Object.hasOwn(EXPORTS, kind) && EXPORTS[kind];
  if (!make) return res.status(404).json({ error: 'No such export.' });
  if (!EXPORT_ROLES[kind].includes(req.me.role)) return res.status(403).json({ error: 'Your login cannot download this.' });
  const q = {};
  for (const k of ['b', 'from', 'to', 'month', 'no']) if (typeof req.query[k] === 'string') q[k] = req.query[k];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kind}-${C.ymd(C.now())}.csv"`);
  let rows = make(q);
  // reception does not see cost prices (see HIDDEN in store.js)
  if (store.HIDDEN[kind] && !store.HIDDEN[kind].roles.includes(req.me.role)) { const i = rows[0].indexOf('Cost price'); if (i >= 0) rows = rows.map(r => r.filter((_, j) => j !== i)); }
  res.send(csv(rows));
});

module.exports = { router, EXPORTS, csv };
