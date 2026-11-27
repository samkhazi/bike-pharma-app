// Real data (Sam, 6 Nov 2026: Misba's cashier panel on the real bills, not the sample day).
// Bills are still MADE in the old billing site (billing.bikesurgeon.online). The admin panel checks its database every
// few seconds (01-admin-panel/server/oldbill.js); this panel asks the admin panel every LIVE_TICK (3) seconds whether the
// Bike Surgeon bills and job cards changed and shows them: GET ADMIN_URL/api/feed/cashier?v=<version> with
// X-Alert-Key: ALERT_KEY (unchanged = a tiny {same: true}; everything again every 10 minutes). An admin panel without
// versions is asked every minute as before; no answer = asked again a little later each time (at most a minute).
// While the link is on, bills, advances, cancels and corrections are read-only here (they happen in the billing site,
// so a bill is never made twice). Petty cash and the counter closing are written here, against the real bills.
// The first good read clears the sample lists. CASHIER_LIVE=0 switches the link off (the sample day stays as it is).
'use strict';
const db = require('./db');
const C = require('./clock');
const store = require('./store');

const base = () => String(process.env.ADMIN_URL || '').replace(/\/$/, '');
const wanted = () => process.env.CASHIER_LIVE !== '0' && !!base() && !!process.env.ALERT_KEY;
const live = () => db.setting('live', '') === 'on';
const status = { at: '', ok: false, error: '' };

const MODE = { Cash: 'Cash', UPI: 'UPI', Card: 'Card', Split: 'Split', Credit: 'Credit' };
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;

// one admin bill -> one cashier bill (the fields the cashier pages read)
function bill(v) {
  const mode = v.st === 'pending' ? 'Pending' : MODE[v.pay] || (v.pay ? String(v.pay) : 'Cash');
  // a bill with no job card is a spares sale at the counter (no vehicle)
  const jc = v.jc ? String(v.jc) : '';
  const b = { no: String(v.no), date: v.date, at: v.time || '', jc: jc || '—', plate: v.plate || (jc ? '' : '—'), model: v.model || (jc ? '' : 'Spares sale'),
    cust: v.cust || '', ph: v.ph || '', adv: v.adv || '', amount: r2(v.amt), labour: r2(v.lab), mode, by: v.by || '', type: v.type || 'Customer',
    items: Array.isArray(v.items) ? v.items : [], src: 'billing' };
  // the old bill's discount is a % of the spares: shown here in rupees
  const dp = num(v.disc);
  if (dp > 0) b.disc = r2(b.items.reduce((t, i) => t + num(i[1]) * num(i[2]), 0) * dp / 100);
  if (mode === 'Split') { b.cash = r2((v.split || [])[0]); const card = r2((v.split || [])[2]); if (card) b.card = card; }
  return b;
}

// admin job cards -> the cashier's job list. A finished job card without a bill is "ready to collect" (the bill is made in
// the billing site); one with a bill is done here.
function jobs(list, bills) {
  const billed = new Map();
  for (const b of bills) if (b.jc && b.jc !== '—' && !billed.has(b.jc)) billed.set(b.jc, b.no);
  const today = C.dmy(C.now());
  return list.filter(j => j && j.jc).map(j => {
    const done = j.st === 'done', inv = billed.get(String(j.jc)) || null;
    return { jc: String(j.jc), plate: j.plate || '', model: j.model || '', cust: j.cust || '', ph: j.ph || '', adv: j.adv || '', mech: j.mech || '',
      bay: j.bay || '', service: j.service || '', st: j.st || '', date: j.date || today, old: !!j.old, remind: [], lines: [], est: 0, why: '',
      readyAt: done ? (j.time ? `done (${j.time})` : 'done') : null, readyDate: done ? (j.date || today) : undefined,
      closed: done ? { by: j.adv || 'Advisor', at: '' } : null, inv, src: 'billing' };
  });
}

const SAMPLE = ['jobs', 'bills', 'advs', 'vendors', 'vinv', 'petty', 'handovers', 'fixes', 'outbox'];

const every = () => Math.max(2, Number(process.env.LIVE_TICK) || 3);
// the last full read or error, for the update script: setting link_last {at, ok, fast, bills, jobs | error}
const keep = x => { try { db.setSetting('link_last', JSON.stringify({ at: new Date().toISOString(), ...x })); } catch { /* never stops the link */ } };
const FULL_MS = 10 * 60 * 1000;
let have = '', full = 0, fails = 0, fast = true, said = '';
async function pull(force = false) {
  if (!wanted()) return null;
  status.at = C.stamp(C.now());
  try {
    const ask = !force && have && Date.now() - full < FULL_MS ? '?v=' + encodeURIComponent(have) : '';
    const r = await fetch(base() + '/api/feed/cashier' + ask, { headers: { 'X-Alert-Key': process.env.ALERT_KEY }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`admin panel answered ${r.status}`);
    const d = await r.json();
    if (d.same) { Object.assign(status, { ok: true, error: '' }); fails = 0; said = ''; return { same: true }; }
    if (!d.live) throw new Error('the admin panel is not linked to the billing site yet');
    const bills = (d.invoices || []).map(bill);
    const js = jobs(d.jobs || [], bills);
    let changed = false;
    db.tx(() => {
      if (!live()) {
        // first real read: the sample day goes away (petty cash, closings and the rest start empty)
        for (const n of SAMPLE) store.write(n, [], 'billing link');
        db.setSetting('live', 'on');
        changed = true;
      }
      for (const [n, v] of [['bills', bills], ['jobs', js]]) {
        if (JSON.stringify(store.read(n)) !== JSON.stringify(v)) { store.write(n, v, 'billing link'); changed = true; }
      }
      if (changed) store.bump();
    });
    Object.assign(status, { ok: true, error: '' });
    have = d.v || ''; fast = !!d.v; full = Date.now(); fails = 0; said = '';
    keep({ ok: true, fast, bills: bills.length, jobs: js.length });
    return { bills: bills.length, jobs: js.length, changed };
  } catch (e) {
    have = ''; fails++;
    Object.assign(status, { ok: false, error: String(e.message || e).slice(0, 200) });
    if (status.error !== said) { said = status.error; console.error('cashier billing link:', status.error); keep({ ok: false, error: status.error }); }   // once, not every few seconds
    return null;
  }
}
// seconds to the next ask: LIVE_TICK; an older admin panel (no versions): LIVE_SECONDS (60); no answer: longer each time
const wait = () => fails ? Math.min(60, every() * 2 ** Math.min(fails, 5)) : fast ? every() : Math.max(20, Number(process.env.LIVE_SECONDS) || 60);

function start() {
  if (!wanted()) return;
  const loop = async () => {
    try { await pull(); } catch { /* pull keeps its own errors */ }
    setTimeout(loop, wait() * 1000).unref();
  };
  loop();
}

module.exports = { live, pull, start, status, bill, jobs, wait };
