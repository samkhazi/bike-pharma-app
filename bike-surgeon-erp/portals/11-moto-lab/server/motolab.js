// The Moto Lab store rules. Every change of the portal is one function here; routes.js runs it inside a
// database transaction, then sends the fresh data back to the page. The server works out every amount itself
// (prices come from the catalogue, the advance from the order, the credit from the exchange) so the page can never send a wrong one.
'use strict';
const C = require('./clock');
const db = require('./db');
const store = require('./store');
const { httpError } = store;
// real data (oldlink.js, 27 Nov): bills, stock and prices come from the Moto Lab billing site
const live = () => db.setting('live', '') === 'on';

const num = (k, d) => () => Number(process.env[k] || d);
const OPEN_FLOAT = num('OPEN_FLOAT', 1000);  // cash left in the drawer for the next day
const DISC_MAX = num('DISC_MAX', 10);        // % discount Mehek can give on a bill; more needs the owner
const DIFF_LIMIT = num('DIFF_LIMIT', 100);   // closing difference above this needs a reason
const RETURN_DAYS = num('RETURN_DAYS', 7);   // returns and size exchanges within this many days of the bill
const DEAD_DAYS = num('DEAD_DAYS', 90);      // no sale for this many days = dead stock
const NOTES = [500, 200, 100, 50, 20, 10];
const CATS = ['Helmets', 'Riding gear', 'Bike protection', 'Lights', 'Luggage', 'Bike care', 'Phone & tech', 'Bike parts'];
const MODES = ['Cash', 'UPI', 'Split'];
// Sizes saved for each customer (from their bills, or typed by Mehek). An item's size kind comes from its category or name.
const SIZES = { Helmet: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], Jacket: ['S', 'M', 'L', 'XL', 'XXL', '3XL'], Gloves: ['S', 'M', 'L', 'XL', 'XXL'], Boots: ['6', '7', '8', '9', '10', '11', '12'] };
const szKind = it => !it || !it.size || it.size === 'Free' ? '' : it.cat === 'Helmets' ? 'Helmet' : /jacket/i.test(it.name) ? 'Jacket' : /glove/i.test(it.name) ? 'Gloves' : /boot|shoe/i.test(it.name) ? 'Boots' : '';
const CLAIM_NEXT = { Received: ['Sent to brand'], 'Sent to brand': ['Replaced', 'Repaired', 'Rejected'], Replaced: ['Given back'], Repaired: ['Given back'], Rejected: ['Given back'] };

const today = () => C.dmy(C.now());
// messages to customers go out only when a WhatsApp sender is set (notify.js); else they wait in the outbox
const waOn = () => !!process.env.WHATSAPP_URL;
const nowT = () => C.clock(C.now());
const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const int = v => Math.round(Number(v));
const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const inr = n => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const phone = v => String(v || '').replace(/\D/g, '').slice(-10);
const toDate = d => { const [a, b, c] = String(d).split('-').map(Number); return new Date(c, b - 1, a); };
const daysAgo = d => C.daysBetween(toDate(d), C.now());
const addMon = (d, m) => { const t = toDate(d); t.setMonth(t.getMonth() + m); return `${String(t.getDate()).padStart(2, '0')}-${String(t.getMonth() + 1).padStart(2, '0')}-${t.getFullYear()}`; };
const isDate = d => /^\d{2}-\d{2}-\d{4}$/.test(String(d || '')) && !isNaN(toDate(d));
const bad = m => { throw httpError(400, m); };

// ---- money (the page uses the same formulas in public/app.js) --------------------------------------
// bill lines: [item id or null, qty, rate, name]
const subOf = b => sum(b.lines, l => l[1] * l[2]);
const amtOf = b => subOf(b) - (b.disc || 0) + (b.fit || 0);      // the bill total
const saleOf = b => amtOf(b) - (b.credit || 0);                  // sale counted for the day: an exchanged piece was already sold on its first bill
const recv = b => amtOf(b) - (b.adv || 0) - (b.credit || 0);     // money taken at the bill
const cashOf = b => (b.mode === 'Cash' ? recv(b) : b.mode === 'Split' ? b.cash : 0);
const upiOf = b => (b.mode === 'UPI' ? recv(b) : b.mode === 'Split' ? recv(b) - b.cash : 0);
const advCash = o => (o.mode === 'Cash' ? o.adv : o.mode === 'Split' ? o.cash : 0);
const advUpi = o => (o.mode === 'UPI' ? o.adv : o.mode === 'Split' ? o.adv - o.cash : 0);

// Sold in the last 30 days and the last sale, from the bills (+ what the old billing site gave at the start: base30/baseAt)
function salesOf(items, bills) {
  const s = new Map(items.map(it => [it.id, { s30: it.baseAt && daysAgo(it.baseAt) < 30 ? it.base30 || 0 : 0, last: it.last || '' }]));
  for (const b of bills) {
    const recent = daysAgo(b.date) < 30;
    for (const l of b.lines) {
      const x = s.get(l[0]); if (!x) continue;
      if (recent) x.s30 += l[1];
      if (!x.last || toDate(b.date) > toDate(x.last)) x.last = b.date;
    }
  }
  return s;
}
// Items as the page shows them: with s30, last sale and the stock level
function itemsView() {
  const items = store.read('items'), s = salesOf(items, store.read('bills'));
  const none = live() ? '' : today();      // an item of the billing never sold has no last sale
  return items.map(it => { const x = s.get(it.id); return { ...it, s30: x.s30, last: x.last || it.added || none }; });
}
// live: only an item that still sells (a sale in the last DEAD_DAYS) is low; the billing keeps many old items at 0 or at the alert
const moving = it => !live() || it.s30 > 0 || (!!it.last && daysAgo(it.last) < DEAD_DAYS());
const lowLevel = it => !moving(it) ? '' : it.stock <= 0 ? (it.s30 > 0 ? 'Out, sells' : 'Out') : it.stock <= it.alert ? (it.s30 >= it.alert * 2 ? 'Order now' : 'Order soon') : '';
// no sale for DEAD_DAYS (an item never sold: counted from the day it is known to be in the store, it.since)
const isDead = it => it.stock > 0 && !!(it.last || it.since) && daysAgo(it.last || it.since) >= DEAD_DAYS();

// What the drawer and the Paytm QR should show today
function totals(d = today()) {
  const B = store.read('bills').filter(b => b.date === d);
  const orders = store.read('orders');
  const O = orders.filter(o => o.date === d);
  const OR = orders.filter(o => o.ret && o.ret.date === d);
  const R = store.read('rets').filter(r => r.date === d && r.kind === 'refund');
  const t = {
    n: B.length, sale: sum(B, saleOf) - sum(R, r => r.amt), fit: sum(B, b => b.fit || 0),
    cash: sum(B, cashOf), upi: sum(B, upiOf), card: sum(B, b => b.mode === 'Card' ? recv(b) : 0), pend: sum(B, b => b.mode === 'Pending' ? recv(b) : 0), advN: O.length, advC: sum(O, advCash), advU: sum(O, advUpi),
    refC: sum(R.filter(r => r.mode === 'Cash'), r => r.amt), refU: sum(R.filter(r => r.mode === 'UPI'), r => r.amt),
    advR: sum(OR.filter(o => o.ret.mode === 'Cash'), o => o.ret.amt), advRU: sum(OR.filter(o => o.ret.mode === 'UPI'), o => o.ret.amt),
  };
  t.open = OPEN_FLOAT();
  t.drawer = t.open + t.cash + t.advC - t.refC - t.advR;
  t.paytm = t.upi + t.advU - t.refU - t.advRU;
  t.advIn = t.advC + t.advU;
  return t;
}
// Sale this month: the old site's days before the portal started + the portal's bills, less refunds
function month(d = C.now()) {
  const key = C.dmy(d).slice(3);
  const h = store.read('hist');
  const days = Array.from({ length: d.getDate() }, () => 0);
  if (h.month === key) (h.days || []).forEach((v, i) => { if (i < days.length) days[i] += Number(v) || 0; });
  for (const b of store.read('bills')) if (b.date.slice(3) === key) days[+b.date.slice(0, 2) - 1] += saleOf(b);
  for (const r of store.read('rets')) if (r.kind === 'refund' && r.date.slice(3) === key) days[+r.date.slice(0, 2) - 1] -= r.amt;
  const tg = store.read('target');
  return { key, days, sale: sum(days, x => x), target: tg.month === key ? tg.amt || 0 : tg.amt || 0, daysIn: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
}
const committed = () => { const b = store.read('budget'); return (b.bought || 0) + sum(store.read('plans').filter(p => p.st === 'Planned' || p.st === 'Ordered' || p.st === 'Waiting for owner'), p => p.amt); };

// ---- helpers ------------------------------------------------------------------------------------------
const nextNo = (key, start) => { const s = store.read('seq'); const n = Number(s[key] || start); s[key] = n + 1; store.write('seq', s); return n; };
const pad4 = n => String(n).padStart(4, '0');
const dayLocked = () => store.read('handovers').some(h => h.date === today());
const isOwner = me => me.role === 'owner';
const nameOf = it => it.name + (it.size && it.size !== 'Free' ? ` (${it.size})` : '');
function upd(name, fn) { const L = store.read(name); const out = fn(L); store.write(name, L); return out; }
function wa(to, text, ref) {
  upd('outbox', L => { L.unshift({ id: (L[0] ? L[0].id : 0) + 1, to, text, ref, at: nowT(), date: today(), st: 'queued' }); if (L.length > 500) L.length = 500; });
}
function addVendor(v) { if (v) upd('vendors', L => { if (!L.some(x => x.toLowerCase() === v.toLowerCase())) L.push(v); }); }
function saveCust(ph, name, bike) {
  upd('cust', L => { const c = L.find(x => x.ph === ph); if (c) { if (bike) c.bike = bike; } else L.push({ ph, name, bike: bike || '', since: today() }); });
}

// ---- customer sizes ------------------------------------------------------------------------------------
// A helmet, jacket, gloves or boots on a bill saves that size for the customer. Returns what changed, e.g. "Helmet L".
function sizesFromBill(ph, lines, items, date) {
  return upd('cust', L => {
    const c = L.find(x => x.ph === ph); if (!c) return '';
    const got = [];
    for (const l of lines) { const k = szKind(l[0] != null && items.find(x => x.id === l[0])); if (!k) continue; const v = items.find(x => x.id === l[0]).size;
      c.sizes = c.sizes || {}; if (c.sizes[k] !== v) { c.sizes[k] = v; got.push(`${k} ${v}`); } c.szOn = date; }
    return got.join(' · ');
  });
}
// body {sizes: {Helmet: 'M', ...} ('' clears one), note}
function saveSizes(me, p, body) {
  const ph = phone(p.ph);
  return upd('cust', L => {
    const c = L.find(x => x.ph === ph); if (!c) throw httpError(404, 'No customer with this mobile. Make a bill first.');
    const sizes = {};
    for (const [k, v] of Object.entries(body.sizes || {})) {
      if (!SIZES[k]) bad(`Size kind must be one of: ${Object.keys(SIZES).join(', ')}.`);
      if (v === '' || v == null) continue;
      if (!SIZES[k].includes(String(v))) bad(`${k} size must be one of: ${SIZES[k].join(', ')}.`);
      sizes[k] = String(v);
    }
    c.sizes = sizes; c.szNote = text(body.note, 120); c.szOn = today(); c.szBy = me.name;
    return { msg: `Sizes saved for ${c.name}.` };
  });
}

// ---- warranty claims WC-xxxx ---------------------------------------------------------------------------
// body {bill, idx (line index on the bill), issue, swap (give a new piece from stock now)}
function newClaim(me, body) {
  const bills = store.read('bills'), b = bills.find(x => x.no === text(body.bill, 20));
  if (!b) throw httpError(404, 'No such bill.');
  const i = int(body.idx), l = b.lines[i], months = (b.wty || {})[i];
  if (!l || !(months > 0)) bad('That item was not sold with a warranty.');
  const until = addMon(b.date, months);
  if (daysAgo(until) > 0) bad(`The warranty ended on ${until}.`);
  if (store.read('rets').some(r => r.bill === b.no && (r.idx || []).includes(i))) bad('That item was returned.');
  const claims = store.read('claims');
  if (claims.some(c => c.bill === b.no && c.idx === i && c.st !== 'Given back')) throw httpError(409, 'There is already an open claim for this item.');
  const issue = text(body.issue, 120); if (!issue) bad('Type the problem.');
  if (body.swap && live()) bad('Give the new piece with a bill in the billing site (the stock is kept there), then save the claim without it.');
  const c = { no: `WC-${pad4(nextNo('claim', 1))}`, date: today(), at: nowT(), bill: b.no, idx: i, id: l[0], name: l[3], cust: b.cust, ph: b.ph, until, issue,
    st: 'Received', vendor: '', docket: '', by: me.name, steps: [['Received', today(), nowT(), body.swap ? 'New piece given from stock' : '']] };
  if (body.swap) {
    const items = store.read('items'), it = l[0] != null && items.find(x => x.id === l[0]);
    if (!it || it.stock < 1) throw httpError(409, `No ${l[3]} in stock to give now.`);
    it.stock -= 1; store.write('items', items); c.swap = true;
  }
  claims.unshift(c); store.write('claims', claims);
  wa(c.ph, `The Moto Lab: warranty claim ${c.no} for your ${c.name} (bill ${c.bill}) is registered. Problem: ${issue}.${c.swap ? ' You got a new piece today.' : ' We will message you at every step.'}`, c.no);
  return { msg: waOn() ? `${c.no} saved. Claim slip sent to ${c.cust} on WhatsApp.` : `${c.no} saved.`, no: c.no };
}
// body {st, vendor, docket (for Sent to brand), note (needed for Rejected)}
function claimStep(me, p, body) {
  const claims = store.read('claims'), c = claims.find(x => x.no === p.no);
  if (!c) throw httpError(404, 'No such claim.');
  const st = text(body.st, 20);
  if (!(CLAIM_NEXT[c.st] || []).includes(st)) throw httpError(409, `${c.no} is "${c.st}". Next can be: ${(CLAIM_NEXT[c.st] || ['nothing']).join(', ')}.`);
  let note = text(body.note, 120);
  if (st === 'Sent to brand') {
    const vendor = text(body.vendor, 60), docket = text(body.docket, 60);
    if (!vendor || !docket) bad('Choose the brand and type the courier docket, or "Hand delivery".');
    c.vendor = vendor; c.docket = docket; note = docket; addVendor(vendor);
  }
  if (st === 'Rejected' && !note) bad('Type why the brand rejected it.');
  c.st = st; c.steps.push([st, today(), nowT(), note]);
  let msg = `${c.no}: ${st.toLowerCase()}.`;
  if (c.swap && st !== 'Given back' && st !== 'Sent to brand') {
    // the customer already has a new piece: a replaced piece goes into stock and the claim is closed
    if (st === 'Replaced' && c.id != null) upd('items', L => { const it = L.find(x => x.id === c.id); if (it) it.stock += 1; });
    c.st = 'Given back'; c.steps.push(['Given back', today(), nowT(), st === 'Replaced' ? "Customer already had the new piece; the brand's piece went into stock" : 'Customer already had the new piece']);
    msg = `${c.no} closed.`;
  } else if (st === 'Sent to brand') {
    wa(c.ph, `The Moto Lab: your ${c.name} (claim ${c.no}) has gone to ${c.vendor}. We will tell you when it is back.`, c.no); msg = waOn() ? `Sent to ${c.vendor}. ${c.cust} gets a WhatsApp update.` : `Sent to ${c.vendor}.`;
  } else if (st === 'Given back') {
    wa(c.ph, `The Moto Lab: claim ${c.no} closed. Thank you for collecting your ${c.name}.`, c.no); msg = `${c.no} closed.`;
  } else {
    wa(c.ph, `The Moto Lab: your ${c.name} (claim ${c.no}) is back from the brand: ${st.toLowerCase()}${note ? ` (${note})` : ''}. Please collect it from the store.`, c.no);
    msg = waOn() ? `Marked ${st.toLowerCase()}. ${c.cust} got a WhatsApp to collect it.` : `Marked ${st.toLowerCase()}. Tell ${c.cust} to collect it.`;
  }
  store.write('claims', claims);
  return { msg };
}

// ---- bills ------------------------------------------------------------------------------------------
// body: {lines: [[itemId, qty]], fit, disc, ph, name, mode, cash, advNo (an arrived order), exch (an open exchange credit)}
function makeBill(me, body) {
  const items = store.read('items'), orders = store.read('orders'), rets = store.read('rets');
  const ph = phone(body.ph);
  if (ph.length !== 10) bad("Type the customer's 10-digit mobile.");
  const cust = store.read('cust').find(c => c.ph === ph);
  const name = cust ? cust.name : text(body.name, 60);
  if (!name) bad("Type the customer's name.");
  if (!Array.isArray(body.lines) || body.lines.length > 40) bad('Add the items to the bill.');
  const want = new Map();
  for (const l of body.lines) {
    const it = items.find(x => x.id === int(Array.isArray(l) ? l[0] : NaN)), q = int(Array.isArray(l) ? l[1] : NaN);
    if (!it) bad('An item on the bill is not in the catalogue.');
    if (!(q >= 1 && q <= 99)) bad(`Quantity of ${nameOf(it)} must be 1 to 99.`);
    want.set(it.id, (want.get(it.id) || 0) + q);
  }
  const lines = [];
  for (const [id, q] of want) {
    const it = items.find(x => x.id === id);
    if (it.stock < q) throw httpError(409, `Only ${Math.max(0, it.stock)} of ${nameOf(it)} in stock.`);
    lines.push([id, q, it.sp, nameOf(it)]);
  }
  // an order that arrived: its item at the order price, its advance comes off
  let order = null;
  if (body.advNo) {
    order = orders.find(o => o.no === body.advNo);
    if (!order || order.st !== 'arrived') throw httpError(409, `${body.advNo} is not waiting to be billed.`);
    if (order.ph !== ph) bad(`${order.no} is for ${order.cust} (${order.ph}).`);
    const it = order.item != null && items.find(x => x.id === order.item);
    if (it && it.stock < order.qty + (want.get(it.id) || 0)) throw httpError(409, `${nameOf(it)} for ${order.no} is not in stock. Mark the order arrived again after stock in.`);
    lines.push([it ? it.id : null, order.qty, Math.round(order.total / order.qty), it ? nameOf(it) : order.what]);
  }
  if (!lines.length) bad('Add the items to the bill.');
  const fit = int(body.fit || 0), disc = int(body.disc || 0);
  if (!(fit >= 0 && fit <= 5000)) bad('Fitting charge must be 0 to ₹5,000.');
  const sub = sum(lines, l => l[1] * l[2]);
  if (!(disc >= 0 && disc <= sub)) bad('Discount cannot be more than the items.');
  if (!isOwner(me) && disc > Math.floor(sub * DISC_MAX() / 100)) throw httpError(403, `Discount above ${DISC_MAX()}% needs the owner. Lower it or ask the owner.`);
  const b = { no: `ML-${nextNo('bill', 1001)}`, date: today(), at: nowT(), cust: name, ph, lines, fit, disc, mode: 'Cash', by: me.name };
  if (order) { b.adv = order.adv; b.advNo = order.no; }
  let credit = null;
  if (body.exch) {
    credit = rets.find(r => r.no === body.exch);
    if (!credit || credit.kind !== 'exchange' || credit.st !== 'open') throw httpError(409, `${body.exch} has no credit left.`);
    if (credit.ph !== ph) bad(`${credit.no} is for ${credit.cust}.`);
    b.credit = credit.amt; b.exchNo = credit.no;
  }
  if (recv(b) < 0) bad(`The advance or exchange credit (${inr((b.adv || 0) + (b.credit || 0))}) is more than this bill. Add items, or give money back as a return.`);
  const mode = text(body.mode, 10) || 'Cash';
  if (!MODES.includes(mode)) bad('Paid by must be Cash, UPI or Split.');
  b.mode = recv(b) === 0 ? 'Cash' : mode;
  if (b.mode === 'Split') { const c = int(body.cash); if (!(c > 0 && c < recv(b))) bad('Type the cash part (more than 0, less than the amount to collect).'); b.cash = c; }
  if (dayLocked()) b.late = true;
  // stock, order, credit, customer
  for (const l of lines) if (l[0] != null) { const it = items.find(x => x.id === l[0]); it.stock -= l[1]; }
  store.write('items', items);
  if (order) { order.st = 'given'; order.bill = b.no; order.adj = b.date; store.write('orders', orders); }
  if (credit) { credit.st = 'used'; credit.usedIn = b.no; store.write('rets', rets); }
  // brand warranty of each line at the time of sale: {line index: months}
  const wty = {}; lines.forEach((l, i) => { const it = l[0] != null && items.find(x => x.id === l[0]); if (it && it.wty > 0) wty[i] = it.wty; });
  if (Object.keys(wty).length) b.wty = wty;
  saveCust(ph, name);
  const sz = sizesFromBill(ph, lines, items, b.date);
  upd('bills', L => L.unshift(b));
  wa(ph, `The Moto Lab bill ${b.no}: ${lines.map(l => `${l[3]}${l[1] > 1 ? ' x' + l[1] : ''}`).join(', ')}. Total ${inr(amtOf(b))}${b.adv ? `, advance ${inr(b.adv)}` : ''}${b.credit ? `, exchange credit ${inr(b.credit)}` : ''}. Paid ${inr(recv(b))} by ${b.mode}. Thank you!`, b.no);
  return { msg: `Bill ${b.no} saved${b.late ? '. The day was handed over, so it goes to the accountant as a late bill' : ''}.`, no: b.no, sz };
}

// Return or size exchange within RETURN_DAYS: body {bill, idx: [line indexes], kind 'refund'|'exchange', mode, why}
function returnBill(me, body) {
  const bills = store.read('bills'), b = bills.find(x => x.no === body.bill);
  if (!b) throw httpError(404, 'No such bill.');
  if (daysAgo(b.date) >= RETURN_DAYS() && !isOwner(me)) throw httpError(403, `Returns only within ${RETURN_DAYS()} days of the bill. The owner can allow an older one.`);
  const why = text(body.why, 200); if (!why) bad('Type why the customer is returning it.');
  const kind = body.kind === 'refund' ? 'refund' : body.kind === 'exchange' ? 'exchange' : bad('Choose exchange or money back.');
  const rets = store.read('rets');
  const done = new Set(rets.filter(r => r.bill === b.no).flatMap(r => r.idx));
  const idx = [...new Set((Array.isArray(body.idx) ? body.idx : []).map(int))];
  if (!idx.length || idx.some(i => !(i >= 0 && i < b.lines.length))) bad('Pick the items that come back.');
  if (idx.some(i => done.has(i))) throw httpError(409, 'That item was already returned.');
  const lines = idx.map(i => b.lines[i]);
  const share = subOf(b) ? 1 - (b.disc || 0) / subOf(b) : 1;            // the bill's discount is shared by its items
  const amt = Math.round(sum(lines, l => l[1] * l[2]) * share);
  const mode = kind === 'refund' ? (body.mode === 'UPI' ? 'UPI' : 'Cash') : '—';
  if (kind === 'refund' && mode === 'Cash' && dayLocked()) throw httpError(403, 'The day is handed over. Give money back by UPI, or tomorrow.');
  const r = { no: `MR-${pad4(nextNo('ret', 1))}`, bill: b.no, date: today(), at: nowT(), cust: b.cust, ph: b.ph, idx, lines, amt, kind, mode, why, by: me.name,
    st: kind === 'refund' ? 'done' : 'open' };
  const items = store.read('items');
  for (const l of lines) { const it = l[0] != null && items.find(x => x.id === l[0]); if (it) it.stock += l[1]; }
  store.write('items', items);
  rets.unshift(r); store.write('rets', rets);
  if (kind === 'refund') wa(b.ph, `The Moto Lab: ${inr(amt)} given back by ${mode} for ${lines.map(l => l[3]).join(', ')} (bill ${b.no}).`, r.no);
  return { msg: kind === 'refund' ? `${r.no}: ${inr(amt)} given back by ${mode}. Stock updated.` : `${r.no}: ${inr(amt)} credit for ${b.cust}. Bill the new size now.`, no: r.no };
}

// ---- customer orders (advance MA-xxxx) -----------------------------------------------------------------
function newOrder(me, body) {
  const ph = phone(body.ph); if (ph.length !== 10) bad("Type the customer's 10-digit mobile.");
  const cust = store.read('cust').find(c => c.ph === ph);
  const name = cust ? cust.name : text(body.name, 60); if (!name) bad("Type the customer's name.");
  const what = text(body.what, 120); if (!what) bad('Type the item.');
  const qty = int(body.qty || 1), total = int(body.total), adv = int(body.adv);
  if (!(qty >= 1 && qty <= 20)) bad('Quantity must be 1 to 20.');
  if (!(total > 0)) bad('Type the price.');
  if (!(adv > 0 && adv <= total)) bad('Advance must be more than 0 and not above the price.');
  const mode = MODES.includes(body.mode) ? body.mode : 'Cash';
  if (mode === 'Cash' && dayLocked()) throw httpError(403, 'The day is handed over. Take this advance by UPI, or tomorrow.');
  const items = store.read('items');
  const it = body.item != null && body.item !== '' ? items.find(x => x.id === int(body.item)) : items.find(x => nameOf(x).toLowerCase() === what.toLowerCase());
  const eta = isDate(body.eta) ? body.eta : bad('Vendor date must be dd-mm-yyyy.');
  const o = { no: `MA-${pad4(nextNo('order', 1))}`, date: today(), at: nowT(), cust: name, ph, item: it ? it.id : null, what: it ? nameOf(it) + (what.toLowerCase() !== nameOf(it).toLowerCase() ? ` · ${what}` : '') : what,
    qty, total, adv, mode, vendor: text(body.vendor, 80), eta, st: 'ordered', by: me.name };
  if (mode === 'Split') { const c = int(body.cash); if (!(c > 0 && c < adv)) bad('Type the cash part of the advance.'); o.cash = c; }
  saveCust(ph, name); addVendor(o.vendor);
  upd('orders', L => L.unshift(o));
  wa(ph, `The Moto Lab: advance ${o.no} ${inr(adv)} for ${o.what}. Price ${inr(total)}, balance ${inr(total - adv)}. We will message you when it arrives.`, o.no);
  return { msg: waOn() ? `${o.no} saved. Advance receipt sent on WhatsApp.` : `${o.no} saved.`, no: o.no };
}
function orderArrived(me, p) {
  return upd('orders', L => {
    const o = L.find(x => x.no === p.no); if (!o) throw httpError(404, 'No such order.');
    if (o.st !== 'ordered') throw httpError(409, `${o.no} is ${o.st}.`);
    o.st = 'arrived'; o.arr = today(); o.arrAt = nowT();
    // the ordered piece comes into stock (kept for this customer until the bill); live: stock in is made in the billing site
    if (o.item != null && !live()) { const items = store.read('items'); const it = items.find(x => x.id === o.item); if (it) { it.stock += o.qty; store.write('items', items); } }
    wa(o.ph, `The Moto Lab: your ${o.what} has arrived. Balance ${inr(o.total - o.adv)}. Please visit the store.`, o.no);
    return { msg: waOn() ? `${o.no} arrived. WhatsApp sent to ${o.cust}.` : `${o.no} arrived. Tell ${o.cust} it is here.` };
  });
}
// Live: the order is billed in the billing site. body {bill: its bill number}. The advance taken here comes off that bill
// (in today's cash and UPI) once the bill shows here.
function orderBilled(me, p, body) {
  if (!live()) throw httpError(409, 'Make the bill here with New bill.');
  const orders = store.read('orders'), o = orders.find(x => x.no === p.no);
  if (!o) throw httpError(404, 'No such order.');
  if (o.st !== 'ordered' && o.st !== 'arrived') throw httpError(409, `${o.no} is ${o.st}.`);
  const no = text(body.bill, 40).toUpperCase().replace(/\s+/g, '');
  if (!no) bad('Type the bill number from the billing site.');
  const bills = store.read('bills'), b = bills.find(x => x.no.toUpperCase() === no);
  if (!b) throw httpError(409, `Bill ${no} is not here yet. A bill shows here within a minute after it is saved in the billing site. Try again in a minute.`);
  if (orders.some(x => x.no !== o.no && x.bill === b.no)) throw httpError(409, `Bill ${b.no} is already used for another order.`);
  o.st = 'given'; o.bill = b.no; o.adj = b.date; o.billedBy = me.name;
  store.write('orders', orders);
  const took = applyAdvances(bills, orders);
  if (took) store.write('bills', bills);
  return { msg: b.advNo === o.no ? `${o.no} given with bill ${b.no}. The advance ${inr(b.adv)} comes off it.` : `${o.no} given with bill ${b.no}. The bill is below the order price, so it is taken as the balance only.` };
}
// The advance of an order billed in the billing site comes off its bill (b.adv, b.advNo). A bill below 90% of the order price
// is taken as the balance only (made for what was left to pay). Returns true when a bill changed.
function applyAdvances(bills, orders) {
  const byNo = new Map(bills.map(b => [b.no, b]));
  let changed = false;
  for (const o of orders) {
    if (o.st !== 'given' || !o.bill) continue;
    const b = byNo.get(o.bill);
    if (!b || b.advNo || amtOf(b) < 0.9 * o.total) continue;
    b.adv = Math.min(o.adv, amtOf(b)); b.advNo = o.no; changed = true;
  }
  return changed;
}
function orderCancel(me, p, body) {
  const why = text(body.why, 200); if (!why) bad('Type why it is cancelled.');
  return upd('orders', L => {
    const o = L.find(x => x.no === p.no); if (!o) throw httpError(404, 'No such order.');
    if (o.st !== 'ordered' && o.st !== 'arrived') throw httpError(409, `${o.no} is ${o.st}.`);
    const mode = body.mode === 'UPI' ? 'UPI' : 'Cash';
    if (mode === 'Cash' && dayLocked()) throw httpError(403, 'The day is handed over. Give the advance back by UPI, or tomorrow.');
    o.st = 'cancelled'; o.ret = { amt: o.adv, mode, why, date: today(), at: nowT(), by: me.name };
    wa(o.ph, `The Moto Lab: order ${o.no} cancelled. Advance ${inr(o.adv)} given back by ${mode}.`, o.no);
    return { msg: `${inr(o.adv)} returned by ${mode}.` };
  });
}

// ---- stock -----------------------------------------------------------------------------------------------
function cleanFits(f) {
  if (f === 'all' || f == null) return 'all';
  if (!Array.isArray(f) || !f.length || f.length > 30) bad('Fits must be "all" or a list of bikes.');
  return f.map(x => {
    if (!Array.isArray(x) || x.length < 3) bad('Each bike is [brand, model, cc, [years]].');
    const years = (Array.isArray(x[3]) ? x[3] : []).map(int).filter(y => y >= 1990 && y <= 2100);
    if (!text(x[0], 40) || !text(x[1], 60) || !(int(x[2]) > 0)) bad('Each bike needs brand, model and cc.');
    return [text(x[0], 40), text(x[1], 60), int(x[2]), years];
  });
}
function newItem(me, body) {
  const name = text(body.name, 80), sp = int(body.sp);
  if (!name || !(sp > 0)) bad('Type the name and selling price.');
  const cat = CATS.includes(body.cat) ? body.cat : bad(`Category must be one of: ${CATS.join(', ')}.`);
  const items = store.read('items');
  const id = nextNo('item', 1);
  const sku = text(body.sku, 30).toUpperCase() || `ML-${pad4(id)}`;
  if (items.some(x => x.sku === sku)) throw httpError(409, `SKU ${sku} is already used.`);
  const bar = text(body.bar, 20) || `2900${String(id).padStart(9, '0')}`;
  if (items.some(x => x.bar === bar)) throw httpError(409, 'That barcode is already on another item.');
  const it = { id, sku, name, size: text(body.size, 12), cat, brand: text(body.brand, 40) || 'Moto Lab', fits: cleanFits(body.fits), stock: 0, rack: text(body.rack, 10) || '—',
    sp, cp: Math.max(0, int(body.cp || 0)), alert: Math.max(0, int(body.alert ?? 2)), wty: Math.min(60, Math.max(0, int(body.wty || 0))), bar, added: today(), by: me.name, ...(int(body.fit) > 0 ? { fit: int(body.fit) } : {}) };
  items.push(it); store.write('items', items);
  return { msg: `${nameOf(it)} saved. Add stock with Stock in.`, id };
}
function editItem(me, p, body) {
  return upd('items', L => {
    const it = L.find(x => x.id === int(p.id)); if (!it) throw httpError(404, 'No such item.');
    // live: price, rack and alert are the billing's; only the brand warranty and the usual fitting charge are set here
    if (live()) {
      if (body.wty == null && body.fit == null) bad('Price, rack and stock alert are changed in the billing site.');
      if (body.wty != null) {
        it.wty = Math.min(60, Math.max(0, int(body.wty) || 0));
        upd('bills', B => { for (const b of B) b.lines.forEach((l, i) => { if (l[0] !== it.id) return; const w = b.wty || {}; if (it.wty > 0) w[i] = it.wty; else delete w[i]; if (Object.keys(w).length) b.wty = w; else delete b.wty; }); });
      }
      if (body.fit != null) it.fit = Math.max(0, int(body.fit) || 0);
      return { msg: `${nameOf(it)}: warranty ${it.wty ? it.wty + ' months' : 'none'}.` };
    }
    if (body.sp != null) { const v = int(body.sp); if (!(v > 0)) bad('Selling price must be more than 0.'); it.sp = v; }
    if (body.alert != null) it.alert = Math.max(0, int(body.alert) || 0);
    if (body.rack != null) it.rack = text(body.rack, 10) || '—';
    if (body.wty != null) it.wty = Math.min(60, Math.max(0, int(body.wty) || 0));
    if (body.fit != null) it.fit = Math.max(0, int(body.fit) || 0);
    if (body.cp != null && isOwner(me)) it.cp = Math.max(0, int(body.cp) || 0);
    if (body.fits != null) it.fits = cleanFits(body.fits);
    return { msg: `${nameOf(it)} updated.` };
  });
}
function countItem(me, p, body) {
  const got = int(body.got);
  if (!(got >= 0 && got <= 9999)) bad('Type the count (0 or more).');
  const items = store.read('items'), it = items.find(x => x.id === int(p.id)); if (!it) throw httpError(404, 'No such item.');
  // live: the count is kept as a rack check; the stock itself is corrected in the billing site
  const was = it.stock; if (!live()) { it.stock = got; store.write('items', items); }
  upd('counts', L => { L.unshift({ no: `CT-${pad4(nextNo('count', 1))}`, id: it.id, sku: it.sku, name: nameOf(it), date: today(), at: nowT(), was, got, by: me.name }); if (L.length > 1000) L.length = 1000; });
  if (live()) return { msg: got === was ? 'Count matches the billing.' : `Counted ${got}, the billing shows ${was} (${got - was > 0 ? '+' : ''}${got - was}). Correct the stock in the billing site.` };
  return { msg: got === was ? 'Count matches.' : `Stock set to ${got} (${got - was > 0 ? '+' : ''}${got - was}). The admin panel sees the difference.` };
}
function stockIn(me, body) {
  const inv = text(body.inv, 40), vendor = text(body.vendor, 80);
  if (!inv || !vendor) bad('Type the vendor and the vendor invoice number.');
  const items = store.read('items');
  const lines = (Array.isArray(body.lines) ? body.lines : []).map(l => [int(l[0]), int(l[1])]).filter(l => l[1] > 0);
  if (!lines.length) bad('Type at least one quantity.');
  for (const [id, q] of lines) { const it = items.find(x => x.id === id); if (!it) bad('An item is not in the catalogue.'); if (q > 999) bad('Quantity too big.'); it.stock += q; }
  store.write('items', items); addVendor(vendor);
  upd('stockIn', L => L.unshift({ no: `SI-${pad4(nextNo('stockin', 1))}`, date: today(), at: nowT(), vendor, inv, lines, by: me.name, ...(body.plan != null ? { plan: int(body.plan) } : {}) }));
  return { msg: `${sum(lines, l => l[1])} pieces added to stock.` };
}

// ---- purchase budget ---------------------------------------------------------------------------------
function newPlan(me, body) {
  const amt = int(body.amt), what = text(body.what, 120), vendor = text(body.vendor, 80);
  if (!(amt > 0) || !what || !vendor) bad('Type the vendor, what and the amount.');
  const on = isDate(body.on) ? body.on : bad('Order date must be dd-mm-yyyy.');
  const B = store.read('budget');
  const over = committed() + amt > (B.amt || 0);
  const p = { id: nextNo('plan', 1), vendor, what, amt, on, st: over ? 'Waiting for owner' : 'Planned', by: me.name, date: today() };
  upd('plans', L => L.push(p)); addVendor(vendor);
  return { msg: over ? 'Above the budget: sent to the owner for OK.' : 'Plan saved.', id: p.id };
}
function planStep(me, p, body) {
  const plans = store.read('plans'), pl = plans.find(x => x.id === int(p.id)); if (!pl) throw httpError(404, 'No such plan.');
  const st = body.st;
  const NEXT = { Planned: ['Ordered', 'Dropped'], Ordered: ['Goods received', 'Dropped'] };
  if (!(NEXT[pl.st] || []).includes(st)) throw httpError(409, `A plan that is "${pl.st}" cannot become "${st}".`);
  pl.st = st; pl.stAt = nowT();
  if (st === 'Goods received') { const B = store.read('budget'); B.bought = (B.bought || 0) + pl.amt; store.write('budget', B); }
  store.write('plans', plans);
  return { msg: st === 'Goods received' ? 'Counted as bought. Add the items to stock.' : st === 'Dropped' ? 'Plan dropped.' : 'Marked ordered.' };
}
function planDecide(me, p, body) {
  const plans = store.read('plans'), pl = plans.find(x => x.id === int(p.id)); if (!pl) throw httpError(404, 'No such plan.');
  if (pl.st !== 'Waiting for owner') throw httpError(409, 'This plan is not waiting for the owner.');
  if (!body.ok && !text(body.why)) bad('Type why it is not approved.');
  pl.st = body.ok ? 'Planned' : 'Not approved'; pl.ans = { by: me.name, at: nowT(), date: today(), ...(body.ok ? {} : { why: text(body.why) }) };
  store.write('plans', plans);
  return { msg: body.ok ? 'Plan approved.' : 'Plan not approved.' };
}
function setBudget(me, body) {
  const amt = int(body.amt); if (!(amt >= 0)) bad('Type the budget.');
  const key = C.dmy(C.now()).slice(3), B = store.read('budget');
  store.write('budget', B.month === key ? { ...B, amt } : { month: key, amt, bought: 0 });
  return { msg: `Budget set to ${inr(amt)} for this month.` };
}
function setTarget(me, body) {
  const amt = int(body.amt); if (!(amt >= 0)) bad('Type the target.');
  store.write('target', { month: C.dmy(C.now()).slice(3), amt, by: me.name });
  return { msg: `Target set to ${inr(amt)}.` };
}

// ---- day closing ----------------------------------------------------------------------------------
// body {notes: {500: n, ...}, coins, why}. Both PINs are checked in routes.js before this runs.
function closing(me, body, acc) {
  if (dayLocked()) throw httpError(409, 'Today is already handed over.');
  const t = totals();
  const n = body.notes || {};
  const counted = sum(NOTES, v => v * Math.max(0, int(n[v]) || 0)) + Math.max(0, int(body.coins) || 0);
  const diff = counted - t.drawer;
  const why = text(body.why, 200);
  if (Math.abs(diff) > DIFF_LIMIT() && !why) bad(`The cash is ${inr(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}. Type why.`);
  const leave = Math.min(OPEN_FLOAT(), counted);
  const h = { date: today(), at: nowT(), bills: t.n, sale: t.sale, cash: t.drawer, counted, diff, leave, upi: t.paytm, ...(t.card ? { card: t.card } : {}), by: me.name, acc: acc.name, ...(why ? { why } : {}),
    notes: Object.fromEntries(NOTES.map(v => [v, Math.max(0, int(n[v]) || 0)])), coins: Math.max(0, int(body.coins) || 0) };
  upd('handovers', L => L.unshift(h));
  return { msg: `Handed over ${inr(counted - leave)} to ${acc.name}. ${inr(leave)} stays in the drawer for tomorrow.` };
}
function reopenDay(me) {
  const L = store.read('handovers'); const i = L.findIndex(h => h.date === today());
  if (i < 0) throw httpError(409, 'Today is not handed over.');
  L.splice(i, 1); store.write('handovers', L);
  return { msg: 'Today is open again. Hand over again at closing.' };
}

module.exports = { saleOf, SIZES, szKind, addMon, saveSizes, newClaim, claimStep, OPEN_FLOAT, DISC_MAX, DIFF_LIMIT, RETURN_DAYS, DEAD_DAYS, NOTES, CATS, today, nowT, sum, inr, phone, daysAgo, subOf, amtOf, recv, cashOf, upiOf, advCash, advUpi,
  itemsView, lowLevel, isDead, totals, month, committed, dayLocked, nameOf, makeBill, returnBill, newOrder, orderArrived, orderCancel, orderBilled, applyAdvances, live,
  newItem, editItem, countItem, stockIn, newPlan, planStep, planDecide, setBudget, setTarget, closing, reopenDay, cleanFits };
