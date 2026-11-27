// Links to the other portals. Every change of a bill, a return, an order advance, a purchase plan, an item or the evening
// closing is queued in the `links_out` table inside the same transaction, then sent (right after the change, and again
// every minute until it goes). A newer version of the same row replaces the waiting one.
//
//   Accountant panel  ACCT_URL, signed in with ACCT_PHONE / ACCT_PIN (a portal login there: imports only, reads nothing)
//     bills           POST /api/import/bills     {bills: [...]}      counter 'ml'. Money back is its own row MR-xxxx with a minus
//                                                                    amount and correctionOf. A size exchange sends nothing by
//                                                                    itself: the new bill is sent less the credit.
//     advances        POST /api/import/advances  {advances: [...]}   counter 'ml', no MA-xxxx (same no again = updated)
//     closings        POST /api/import/closings  {closings: [...]}   ctr 'ml' + date (a resend replaces it)
//     plans           POST /api/import/plans     {plans: [...], budget}  Mehek's purchase plans + this month's budget
//                                                                    ("budget left with Mehek" on the accountant's pages)
//     summary         POST /api/import/motolab-summary {summary}     the day's Moto Lab report (same shape as for the admin)
//   Admin panel       ADMIN_URL, header X-Alert-Key: ALERT_KEY, X-Portal: motolab
//     sales + stock   POST /api/import/motolab   {invoices: [...]} and {inventory: [...]}  (b 'ml'; invoices by no, stock by serial = SKU)
//     summary         POST /api/import/motolab   {summary}   month vs target, today, orders, warranty claims, sizes, budget, closing, stock
//   The admin panel and the accountant panel keep The Moto Lab as its own business with its own reports.
//   Full shapes: docs/API.md ("Sent to other portals").
//
// Empty URL = nothing is sent to that portal (the rows wait in links_out), so the portal works on its own.
'use strict';
const db = require('./db');
const C = require('./clock');
const M = require('./motolab');

const J = JSON.stringify;
const base = k => String(process.env[k] || '').replace(/\/$/, '');

function put(path, extId, body) {
  db.run(`INSERT INTO links_out (path, ext_id, body, created_at) VALUES (?,?,?,?)
          ON CONFLICT(ext_id) DO UPDATE SET path = excluded.path, body = excluded.body, sent_at = NULL, tries = 0, last_error = NULL
          WHERE links_out.body <> excluded.body`, path, extId, J(body), C.stamp(C.now()));
}

// ---- shapes the accountant panel takes ---------------------------------------------------------
const lineTxt = b => b.lines.map(l => `${l[3]}${l[1] > 1 ? ' x' + l[1] : ''}`).join(', ');
function billOut(b) {
  const amount = M.amtOf(b) - (b.credit || 0); // the exchanged item was sold on its first bill
  const got = M.recv(b);
  return { no: b.no, date: b.date, time: b.at, counter: 'ml', customer: b.cust,
    details: `${lineTxt(b)}${b.fit ? ` · fitting ₹${b.fit}` : ''}${b.exchNo ? ` · exchange ${b.exchNo} (credit ₹${b.credit})` : ''}`.slice(0, 160),
    amount, labour: 0, mode: b.mode, by: b.by,
    ...(b.mode === 'Split' ? { cash: b.cash, upi: got - b.cash } : {}),
    ...(b.adv ? { adv: b.adv, advNo: b.advNo } : {}) };
}
const refundOut = r => ({ no: r.no, date: r.date, time: r.at, counter: 'ml', customer: r.cust, details: `Money back for ${r.bill}: ${lineTxt(r)} · ${r.why}`.slice(0, 160),
  amount: -r.amt, labour: 0, mode: r.mode, by: r.by, correctionOf: r.bill });
const OST = { ordered: 'ordered', arrived: 'arrived', given: 'given', cancelled: 'cancelled' };
const advOut = o => ({ no: o.no, date: o.date, at: o.at, counter: 'ml', customer: o.cust, phone: o.ph, for: `${o.what}${o.qty > 1 ? ' x' + o.qty : ''}, to order`,
  total: o.total, amount: o.adv, mode: o.mode, ...(o.mode === 'Split' ? { cash: o.cash } : {}), by: o.by, who: 'Customer', order: o.no, ost: OST[o.st], eta: o.eta,
  st: o.st === 'given' ? 'adjusted' : o.st === 'cancelled' ? 'returned' : 'open', ...(o.bill ? { bill: o.bill, adj: o.adj } : {}),
  ...(o.ret ? { ret: { amt: o.ret.amt, mode: o.ret.mode, date: o.ret.date, at: o.ret.at, by: o.ret.by, why: o.ret.why } } : {}) });
function closingOut(h, bills, orders) {
  const day = bills.filter(b => b.date === h.date), sp = day.filter(b => b.mode === 'Split');
  const A = orders.filter(o => o.date === h.date);
  const note = [h.why ? `Cash difference: ${h.why}` : '', `Moto Lab UPI ₹${h.upi} (the shared Paytm QR is matched in the daily QR check)`, h.card ? `Card ₹${h.card} on the card machine` : '',
    h.leave ? `Counted ₹${h.counted}, ₹${h.leave} left in the drawer for tomorrow` : ''].filter(Boolean).join('. ');
  return { ctr: 'ml', date: h.date, cash: Math.max(0, h.counted - (h.leave || 0)), upi: h.upi, adv: { n: A.length, cash: A.reduce((t, o) => t + M.advCash(o), 0), upi: A.reduce((t, o) => t + M.advUpi(o), 0) },
    split: { n: sp.length, amt: sp.reduce((t, b) => t + M.recv(b), 0), cash: sp.reduce((t, b) => t + b.cash, 0), upi: sp.reduce((t, b) => t + M.recv(b) - b.cash, 0) },
    diff: h.diff, bills: day.length, at: h.at, by: h.by, note };
}
const planOut = p => ({ ext: `ML-P-${p.id}`, sec: 'The Moto Lab', vendor: p.vendor, what: p.what, amt: p.amt, on: p.on, st: p.st, by: p.by });

// ---- shapes the admin panel takes (its own invoice and inventory rows, b 'ml') ----------------------
// The admin panel takes a discount as a percent, so the rupee discount and an exchange credit go as minus lines (disc 0):
// its total sum(qty*rate) + lab is then the Moto Lab sale of that bill. A money-back return is its own row with minus rates.
const invOut = b => ({ no: b.no, b: 'ml', date: b.date, time: b.at, cust: b.cust, ph: b.ph, type: 'Customer',
  items: [...b.lines.map(l => [l[3], l[1], l[2]]), ...(b.disc ? [['Discount', 1, -b.disc]] : []), ...(b.credit ? [[`Exchange credit ${b.exchNo}`, 1, -b.credit]] : [])],
  lab: b.fit || 0, disc: 0, pay: b.mode, st: 'paid', by: b.by, ...(b.adv ? { adv: b.adv, advNo: b.advNo } : {}), ...(b.exchNo ? { exch: b.exchNo } : {}) });
function retInvOut(r) { // refunds only; the share of the bill's discount is already in r.amt
  const full = M.sum(r.lines, l => l[1] * l[2]) || 1;
  const items = r.lines.map(l => [`${l[3]} (refund)`, l[1], -Math.round(l[2] * r.amt / full)]);
  const diff = -r.amt - M.sum(items, l => l[1] * l[2]); if (diff) items.push(['Rounding', 1, diff]);
  return { no: r.no, b: 'ml', date: r.date, time: r.at, cust: r.cust, ph: r.ph, type: 'Return', of: r.bill, items, lab: 0, disc: 0, pay: r.mode, st: 'paid', by: r.by, why: r.why };
}
const fitsTxt = it => it.fits === 'all' ? 'Universal' : it.fits.map(f => `${f[0]} ${f[1]}`).join(', ');
const stockOut = it => ({ serial: it.sku, name: M.nameOf(it), brand: it.brand, model: fitsTxt(it), stock: it.stock, rack: it.rack, sp: it.sp, cp: it.cp || 0, alert: it.alert, b: 'ml', bar: it.bar, cat: it.cat, wty: it.wty || 0 });

// ---- the day's Moto Lab report (admin "The Moto Lab" page, accountant "The Moto Lab" page) ----------------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function summaryOut() {
  const now = C.now(), d = M.today(), t = M.totals(), mo = M.month();
  const y = now.getFullYear(), m = now.getMonth(), daysIn = mo.daysIn;
  const work = n => Array.from({ length: n }, (_, i) => new Date(y, m, i + 1).getDay()).filter(w => w !== 0).length; // Mon–Sat
  const S = require('./store'), orders = S.read('orders');
  const items = M.itemsView(), claims = S.read('claims'), cust = S.read('cust'), B = S.read('budget'), H = S.read('handovers');
  const MB = S.read('bills').filter(b => b.date.slice(3) === mo.key);
  const lines = MB.flatMap(b => b.lines.filter(l => l[0] != null).map(l => ({ it: items.find(x => x.id === l[0]), q: l[1], a: l[1] * l[2] }))).filter(x => x.it);
  const group = f => { const g = new Map(); for (const x of lines) { const k = f(x.it); const v = g.get(k) || [k, 0, 0]; v[1] += x.q; v[2] += x.a; g.set(k, v); } return [...g.values()].sort((a, b) => b[2] - a[2]); };
  const open = orders.filter(o => o.st === 'ordered' || o.st === 'arrived');
  const openC = claims.filter(c => c.st !== 'Given back'), since = c => c.steps[c.steps.length - 1][1];
  const dead = items.filter(M.isDead), last = H[0] || null;
  return { date: d, at: M.nowT(),
    month: { key: mo.key, name: MONTHS[m], sale: mo.sale, target: mo.target, days: mo.days, daysIn, workDays: work(daysIn), workDone: work(now.getDate()) },
    today: { sale: t.sale, bills: t.n, cash: t.cash, upi: t.upi, card: t.card, pend: t.pend, fit: t.fit, advIn: t.advIn, refunds: t.refC + t.refU },
    orders: { open: open.length, arrived: open.filter(o => o.st === 'arrived').length, late: open.filter(o => o.st === 'ordered' && o.eta && M.daysAgo(o.eta) > 0).length, advHeld: M.sum(open, o => o.adv) },
    claims: { open: openC.length, ready: openC.filter(c => ['Replaced', 'Repaired', 'Rejected'].includes(c.st)).length, late: openC.filter(c => c.st === 'Sent to brand' && M.daysAgo(since(c)) > 14).length,
      list: openC.slice(0, 20).map(c => ({ no: c.no, cust: c.cust, name: c.name, st: c.st, since: since(c) })) },
    sizes: { customers: cust.length, withSizes: cust.filter(c => c.sizes && Object.keys(c.sizes).length).length },
    budget: { month: B.month || mo.key, amt: B.amt || 0, bought: B.bought || 0, committed: M.committed(), left: (B.amt || 0) - M.committed() },
    closing: last ? { date: last.date, counted: last.counted, diff: last.diff, at: last.at, by: last.by } : null,
    byCat: group(it => it.cat), top: group(M.nameOf).slice(0, 8),
    stock: { items: items.length, pieces: M.sum(items, it => Math.max(0, it.stock)), value: M.sum(items, it => Math.max(0, it.stock) * it.sp), low: items.filter(it => it.alert > 0 && it.stock <= it.alert).length,
      dead: dead.length, deadValue: M.sum(dead, it => it.stock * it.sp) } };
}

// Called inside every change with the lists before and after it
function queue(before, after) {
  const changed = (name, key) => { const had = new Map((before[name] || []).map(x => [x[key], J(x)])); return (after[name] || []).filter(x => had.get(x[key]) !== J(x)); };
  // live (oldlink.js): bills, returns and stock are the billing site's; the admin panel reads them there itself
  const own = !require('./oldlink').live();
  for (const b of own ? changed('bills', 'no') : []) {
    // a size exchange for the same price adds no money (the piece was sold on its first bill): nothing for the accountant
    if (M.amtOf(b) - (b.credit || 0) > 0) put('/api/import/bills', `ACC-B-${b.no}`, { bills: [billOut(b)] });
    put('/api/import/motolab', `ADM-I-${b.no}`, { invoices: [invOut(b)] });
  }
  for (const r of own ? changed('rets', 'no') : []) if (r.kind === 'refund') { // a size exchange sends nothing: the next bill carries the credit
    put('/api/import/bills', `ACC-B-${r.no}`, { bills: [refundOut(r)] });
    put('/api/import/motolab', `ADM-I-${r.no}`, { invoices: [retInvOut(r)] });
  }
  for (const o of changed('orders', 'no')) put('/api/import/advances', `ACC-A-${o.no}`, { advances: [advOut(o)] });
  for (const h of changed('handovers', 'date')) put('/api/import/closings', `ACC-CL-ml-${h.date}`, { closings: [closingOut(h, after.bills, after.orders)] });
  const B = after.budget || {};
  for (const p of changed('plans', 'id')) put('/api/import/plans', `ACC-P-${p.id}`, { plans: [planOut(p)] });
  if (J(before.budget) !== J(after.budget) && B.month) put('/api/import/plans', `ACC-BUD-${B.month}`, { plans: [], budget: { sec: 'The Moto Lab', who: 'Mehek Taj', kind: 'Accessories', month: B.month, amt: B.amt || 0 } });
  for (const it of own ? changed('items', 'id') : []) put('/api/import/motolab', `ADM-S-${it.sku}`, { inventory: [stockOut(it)] });
  putSummary();
}
// one report row per day, replaced on every change (sent last, after the bills it counts); live: also after every billing read
// that changed something (oldlink.js), so the admin's "today" of the Moto Lab stays the real one
function putSummary() {
  const sm = summaryOut();
  put('/api/import/motolab', `ADM-SUM-${sm.date}`, { summary: sm });
  put('/api/import/motolab-summary', `ACC-SUM-${sm.date}`, { summary: sm });
}

// ---- sending -----------------------------------------------------------------------------------
let cookie = '';
async function signedFetch(path, body) {
  const b = base('ACCT_URL');
  const go = () => fetch(b + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: J(body), signal: AbortSignal.timeout(10000) });
  let r = await go();
  if (r.status === 401) {
    const l = await fetch(b + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: J({ phone: process.env.ACCT_PHONE || '', pin: process.env.ACCT_PIN || '' }), signal: AbortSignal.timeout(10000) });
    if (!l.ok) throw new Error(`ACCT_URL: sign in refused (${l.status})`);
    cookie = String(l.headers.get('set-cookie') || '').split(';')[0];
    r = await go();
  }
  return r;
}
const TARGETS = { 'ACC-': { url: 'ACCT_URL', name: 'accountant panel' }, 'ADM-': { url: 'ADMIN_URL', name: 'admin panel' } };
const targetOf = extId => Object.keys(TARGETS).find(p => String(extId).startsWith(p));
const adminFetch = (path, body) => fetch(base('ADMIN_URL') + path, { method: 'POST', body: J(body), signal: AbortSignal.timeout(10000),
  headers: { 'Content-Type': 'application/json', 'X-Alert-Key': process.env.ALERT_KEY || '', 'X-Portal': 'motolab' } });

let busy = false, again = false;
async function flush() {
  const on = Object.keys(TARGETS).filter(p => base(TARGETS[p].url));
  if (busy) again = true;
  if (!on.length || busy) return { sent: 0, failed: 0 };
  if (require('./oldlink').waiting()) return { sent: 0, failed: 0 };   // the first real read clears the sample rows first
  busy = true;
  const out = { sent: 0, failed: 0 };
  const down = new Set(); // a portal that is not reached (or answers 5xx) gets nothing more this run, so its rows keep their order
  try {
    for (const m of db.all('SELECT * FROM links_out WHERE sent_at IS NULL ORDER BY id LIMIT 300')) {
      const p = targetOf(m.ext_id);
      if (!p || !on.includes(p) || down.has(p)) continue;
      try {
        const r = p === 'ACC-' ? await signedFetch(m.path, JSON.parse(m.body)) : await adminFetch(m.path, JSON.parse(m.body));
        if (!r.ok) throw Object.assign(new Error(`${TARGETS[p].name} answered ${r.status}${r.status === 400 || r.status === 409 ? ': ' + ((await r.json().catch(() => ({}))).error || '') : ''}`), { status: r.status });
        // a newer body saved while this one was on its way still has to go
        db.run('UPDATE links_out SET sent_at = ?, tries = tries + 1, last_error = NULL WHERE id = ? AND body = ?', C.stamp(C.now()), m.id, m.body);
        out.sent++;
      } catch (e) {
        out.failed++;
        db.run('UPDATE links_out SET tries = tries + 1, last_error = ? WHERE id = ?', String(e.message).slice(0, 200), m.id);
        if (!e.status || e.status >= 500) down.add(p);
      }
    }
  } finally { busy = false; if (again) { again = false; setImmediate(() => flush().catch(() => {})); } }
  return out;
}

const status = () => db.all('SELECT path, ext_id, created_at, sent_at, tries, last_error FROM links_out ORDER BY id DESC LIMIT 200');

module.exports = { put, queue, putSummary, flush, status, billOut, refundOut, advOut, closingOut, planOut, invOut, retInvOut, stockOut, summaryOut };
