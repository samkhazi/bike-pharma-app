// Real data (Sam, 27 Nov 2026: "all data live, Moto Lab connected"). Bills are still MADE in the Moto Lab billing site
// (themotolab.bikesurgeon.online). The admin panel reads its database every minute (01-admin-panel/server/oldbill.js, worked
// out exactly like the billing); this panel asks the admin panel for the items and bills every minute:
// GET ADMIN_URL/api/feed/motolab with X-Alert-Key: ALERT_KEY.
// While the link is on, bills, returns, stock in, new items and prices are made in the billing site (read-only here, so
// nothing is made twice). Customer orders with advance, warranty claims, the purchase budget, rack counts, customer sizes
// and the day closing are made here, against the real bills.
// The first good read clears the sample data. MOTOLAB_LIVE=0 switches the link off (the sample day stays as it is).
'use strict';
const db = require('./db');
const C = require('./clock');
const store = require('./store');
const M = require('./motolab');

const base = () => String(process.env.ADMIN_URL || '').replace(/\/$/, '');
const wanted = () => process.env.MOTOLAB_LIVE !== '0' && !!base() && !!process.env.ALERT_KEY;
const live = () => db.setting('live', '') === 'on';
// nothing goes to the other portals while the first real read has not cleared the sample rows yet (links.js)
const waiting = () => wanted() && !live();
const BILLING_URL = () => String(process.env.BILLING_URL || 'https://themotolab.bikesurgeon.online');
// bills kept here: a year and a bit, so warranty claims find the bill
const DAYS = () => Math.max(40, Number(process.env.ML_DAYS) || 400);
const status = { at: '', ok: false, error: '' };

const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const key = d => String(d || '').split('-').reverse().join('-');   // dd-mm-yyyy -> yyyy-mm-dd, for sorting
const up = v => String(v || '').trim().toUpperCase();

// The billing has no categories: the category comes from the item's name and brand (first match), else Bike parts
const CAT_RULES = [
  ['Bike parts', /key ?chain/i],
  ['Riding gear', /jacket|glove|glouse|bala|\bboots\b|shoe|knee|elbow|riding pant|rain ?coat|neck|t-?shirt|scarf|gog+le|goggel|googel/i],
  ['Helmets', /helmet|helmat|studds|steelbird|steel bird|axor|vega|\bls2\b|\bsmk\b|ignyte|\bhjc\b|\bagv\b|shoei|\bmt (thunder|stinger|targo|hummer|blade|revenge|rapide)\b/i],
  ['Phone & tech', /mobile|phone|charger|usb|bluto|blueto|intercom|gps|tracker|camera|bobo|holder/i],
  ['Lights', /light|lite\b|\bled\b|lamp|bulb|horn|indicator|\bind\b|h ?l assy|fog|projector|drl|flash|hella|\btail\b|mini drive|\bh[47]\b|\b\d{2,3}w\b|osram|philips/i],
  ['Bike protection', /guard|slider|bash|sump|tank pad|radiator|raditer|saree|mud ?flap|visor|wind ?screen|wind ?shield|protector|protecter|crash|\bcras\b|belly|hugger|grill/i],
  ['Luggage', /saddle|\bbag\b|luggage|lugage|\blug\b|rope|carrier|carrir|top ?box|bungee|\bnet\b|back ?rest|\brack\b/i],
  ['Bike care', /polish|shine|clean|clearner|wash|lube|chain|wax|spray|cover|coolant|\boil\b|shampoo|cloth|microfiber|degreas|motul|silicon|brush/i],
];
const catOf = (name, brand) => { const t = `${name} ${brand || ''}`; for (const [c, re] of CAT_RULES) if (re.test(t)) return c; return 'Bike parts'; };

// ---- the billing's items and bills -> this panel's lists ------------------------------------------------------------------
// bills: the feed's bills, newest first; the bill total stays the billing's (disc = what is off the items, fit = labour)
function billOf(v) {
  const lines = (v.lines || []).map(l => [l[0] == null ? null : Number(l[0]), Number(l[1]) || 0, r2(l[2]), String(l[3] || '')]);
  const sub = r2(M.sum(lines, l => l[1] * l[2]));
  let fit = r2(v.fit), disc = r2(sub + fit - r2(v.net));
  if (disc < 0) { fit = r2(v.net - sub); disc = 0; }   // more than the items and labour (rare): shown as the labour
  const b = { no: String(v.no), date: v.date, at: v.at || '', cust: v.cust || 'Walk-in', ph: v.ph || '', lines, fit, disc, mode: v.mode || 'Cash', by: v.by || '', src: 'billing' };
  if (b.mode === 'Split') b.cash = r2(v.cash);
  return b;
}

// items: price, stock, rack and alert from the billing; the warranty months and the usual fitting charge are set here and kept.
// last = the last day it was sold (all bills); since = the first day it is known to be in the store (an item never sold
// is dead stock after DEAD_DAYS from then: item ids go up, so a bill with a newer item shows this one was already there)
function itemsOf(feed, had, all) {
  const last = new Map(), byDay = [];
  for (const v of all) {
    let top = 0;
    for (const l of v.lines || []) { const id = Number(l[0]); if (!id) continue; top = Math.max(top, id); const d = last.get(id); if (!d || key(v.date) > key(d)) last.set(id, v.date); }
    if (top) byDay.push([key(v.date), top, v.date]);
  }
  byDay.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  let run = 0; const steps = [];              // [highest item id seen so far, day]
  for (const [, top, d] of byDay) if (top > run) { run = top; steps.push([top, d]); }
  const since = id => { let lo = 0, hi = steps.length - 1, got = ''; while (lo <= hi) { const m = (lo + hi) >> 1; if (steps[m][0] >= id) { got = steps[m][1]; hi = m - 1; } else lo = m + 1; } return got; };
  const old = new Map(had.map(it => [it.id, it]));
  return feed.map(p => {
    const o = old.get(p.id) || {};
    // the billing's serial no., barcode and brand are often the item's name again: then ML + its id, no barcode, no brand
    const nm = up(p.name), sn = up(p.sku);
    const it = { id: p.id, sku: (sn && sn !== nm ? sn : `ML${p.id}`).slice(0, 40), name: p.name, size: '', cat: catOf(p.name, p.brand), brand: up(p.brand) === nm ? '' : p.brand || '', fits: 'all',
      rack: p.rack || '—', sp: r2(p.sp), mrp: r2(p.mrp), cp: 0, stock: Math.round(Number(p.stock) || 0), alert: p.alert > 0 ? Math.round(p.alert) : 1, bar: up(p.bar) === nm ? '' : p.bar || '',
      last: last.get(p.id) || '', src: 'billing' };
    if (!it.last) { const s = since(p.id); if (s) it.since = s; }
    if (o.wty > 0) it.wty = o.wty;
    if (o.fit > 0) it.fit = o.fit;
    return it;
  });
}

// customers: everyone with a 10-digit mobile on a bill (name of the newest bill, first and last bill); the sizes saved here
// and customers added here with an order are kept
function custOf(all, had) {
  const by = new Map(had.map(c => [c.ph, { ...c }]));
  for (const v of [...all].sort((a, b) => key(a.date) < key(b.date) ? -1 : key(a.date) > key(b.date) ? 1 : a.id - b.id)) {
    if (!/^\d{10}$/.test(String(v.ph || ''))) continue;
    const c = by.get(v.ph) || { ph: v.ph, name: '', bike: '', since: v.date };
    if (v.cust) c.name = String(v.cust).slice(0, 60);
    if (!c.since || key(v.date) < key(c.since)) c.since = v.date;
    if (!c.last || key(v.date) > key(c.last)) c.last = v.date;
    by.set(v.ph, c);
  }
  return [...by.values()].map(c => ({ ...c, name: c.name || 'No name' }))
    .sort((a, b) => { const x = key(a.last || a.since), y = key(b.last || b.since); return x < y ? 1 : x > y ? -1 : 0; });
}

// warranty months of each line (from the item, set here), so claims work on the billing's bills
function withWarranty(bills, items) {
  const wty = new Map(items.filter(it => it.wty > 0).map(it => [it.id, it.wty]));
  for (const b of bills) {
    const w = {}; b.lines.forEach((l, i) => { if (l[0] != null && wty.has(l[0])) w[i] = wty.get(l[0]); });
    if (Object.keys(w).length) b.wty = w; else delete b.wty;
  }
}

// the sample day goes on the first real read; the numbers (MA-, WC-, CT-) start again
function clearSample() {
  const mo = C.dmy(C.now()).slice(3);
  for (const n of store.LISTS) store.write(n, [], 'billing link');
  store.write('budget', { month: mo, amt: 0, bought: 0 }, 'billing link');
  store.write('target', { month: mo, amt: 0 }, 'billing link');
  store.write('hist', {}, 'billing link');
  store.write('seq', {}, 'billing link');
  db.run('DELETE FROM links_out');            // rows of the sample day never go to the other portals
  db.run('INSERT INTO audit_log (at, who, action, detail) VALUES (?,?,?,?)', C.stamp(C.now()), 'Billing link', 'live link on', 'Sample data cleared: bills and stock come from the Moto Lab billing');
}

function apply(d) {
  const all = (d.bills || []).filter(v => v && v.no && /^\d{2}-\d{2}-\d{4}$/.test(String(v.date || '')));
  const from = key(C.dmy(C.addDays(C.now(), -DAYS())));
  const keep = all.filter(v => key(v.date) >= from)
    .sort((a, b) => key(a.date) < key(b.date) ? 1 : key(a.date) > key(b.date) ? -1 : (b.min - a.min) || (b.id - a.id));
  let changed = false;
  db.tx(() => {
    if (!live()) { clearSample(); db.setSetting('live', 'on'); changed = true; }
    const items = Array.isArray(d.items) ? itemsOf(d.items, store.read('items'), all) : store.read('items');   // items not read: kept
    const bills = keep.map(billOf);
    withWarranty(bills, items);
    M.applyAdvances(bills, store.read('orders'));
    const cust = custOf(all, store.read('cust'));
    for (const [n, v] of [['items', items], ['bills', bills], ['cust', cust]]) {
      if (JSON.stringify(store.read(n)) !== JSON.stringify(v)) { store.write(n, v, 'billing link'); changed = true; }
    }
    if (changed) { store.bump(); require('./links').putSummary(); }
  });
  if (changed) require('./links').flush().catch(() => {});
  return { bills: keep.length, items: Array.isArray(d.items) ? d.items.length : null, changed };
}

async function pull() {
  if (!wanted()) return null;
  status.at = C.stamp(C.now());
  try {
    const r = await fetch(base() + '/api/feed/motolab', { headers: { 'X-Alert-Key': process.env.ALERT_KEY }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`admin panel answered ${r.status}`);
    const d = await r.json();
    if (!d.live) throw new Error('the admin panel has not read the Moto Lab billing yet');
    const out = apply(d);
    Object.assign(status, { ok: true, error: '', ...out });
    return out;
  } catch (e) {
    Object.assign(status, { ok: false, error: String(e.message || e).slice(0, 200) });
    console.error('Moto Lab billing link:', status.error);
    return null;
  }
}

function start() {
  if (!wanted()) return;
  pull();
  setInterval(() => { pull(); }, Math.max(20, Number(process.env.LIVE_SECONDS) || 60) * 1000).unref();
}

module.exports = { live, waiting, pull, start, status, apply, catOf, billOf, itemsOf, custOf, BILLING_URL };
