// Links to the other portals and to WhatsApp / push. Runs every minute (jobs.js). An empty URL = that link is off.
//  Sent from the outbox:  accounts (02 Accountant: transfers), admin (01 Admin: stock alerts), whatsapp, push (OneSignal)
//  Kept in step:          desk (05 Workshop desk: Bike Surgeon parts list + stock), motolab (11 Moto Lab: items + stock)
//  Pulled:                desk stock moves (parts Saniya put on job cards), Moto Lab bills and returns (stock goes down)
'use strict';
const db = require('./db');
const inv = require('./inv');
const C = require('./clock');
const billing = require('./billing');

const env = k => String(process.env[k] || '').trim();
const TIMEOUT = 15000;
const last = {};   // target → {at, ok, error} for Settings > Links

async function call(url, { method = 'GET', headers = {}, body } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), signal: ctl.signal });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
    return { status: r.status, json, text };
  } finally { clearTimeout(t); }
}
const feedHeaders = key => ({ 'X-Feed-Key': key, 'X-Portal': 'billing', 'X-By': 'Bike Surgeon inventory' });

// Accountant panel: a `portal` login (ACCT_PHONE / ACCT_PIN); the cookie is kept and renewed on a 401
let acctCookie = null;
async function acctCall(p, body) {
  const go = () => fetch(env('ACCT_URL') + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(acctCookie ? { cookie: acctCookie } : {}) }, body, signal: AbortSignal.timeout(TIMEOUT) });
  if (!acctCookie) await signInAcct();
  let r = await go();
  if (r.status === 401) { await signInAcct(); r = await go(); }
  return { status: r.status, text: await r.text() };
}
async function signInAcct() {
  const r = await fetch(env('ACCT_URL') + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: env('ACCT_PHONE'), pin: env('ACCT_PIN') }), signal: AbortSignal.timeout(TIMEOUT) });
  if (r.status !== 200) throw new Error(`accountant login answered ${r.status}`);
  acctCookie = (r.headers.get('set-cookie') || '').split(';')[0];
}

// One outbox row → its target. Answers {ok} or {retry, error} or {dead, error}
const SENDERS = {
  accounts: async row => {
    if (!env('ACCT_URL')) return null;
    const r = await acctCall(row.path, row.body);
    return r.status < 300 || r.status === 409 ? { ok: true } : { status: r.status, error: r.text.slice(0, 200) };
  },
  admin: async row => {
    if (!env('ADMIN_URL') || !env('ALERT_KEY')) return null;
    const r = await call(env('ADMIN_URL') + row.path, { method: 'POST', headers: { 'X-Alert-Key': env('ALERT_KEY'), 'X-Portal': 'inventory' }, body: row.body });
    return r.status < 300 ? { ok: true } : { status: r.status, error: r.text.slice(0, 200) };
  },
  // Email (Inventory 2.0: items waiting for the manager's price). MAIL_* in .env, see mail.js
  mail: async row => {
    const mail = require('./mail');
    if (!mail.ready()) return null;
    await mail.send(JSON.parse(row.body));
    return { ok: true };
  },
  // WhatsApp sender (same contract as the other portals): POST WHATSAPP_URL, X-Api-Key, {to: '91…', via, text, ref}
  whatsapp: async row => {
    if (!env('WHATSAPP_URL')) return null;
    const r = await call(env('WHATSAPP_URL'), { method: 'POST', headers: { 'X-Api-Key': env('WHATSAPP_KEY') }, body: row.body });
    return r.status < 300 ? { ok: true } : { status: r.status, error: r.text.slice(0, 200) };
  },
  // Browser push through OneSignal (the old billing and service sites used it): to every device of the alert's roles
  push: async row => {
    if (!env('ONESIGNAL_APP_ID') || !env('ONESIGNAL_REST_KEY')) return null;
    const b = JSON.parse(row.body);
    const ids = db.all(`SELECT d.player FROM push_devices d JOIN accounts a ON a.id = d.account WHERE a.active = 1 AND a.role IN (${b.roles.map(() => '?').join(',')})`, ...b.roles).map(x => x.player);
    if (!ids.length) return { ok: true };
    const r = await call('https://onesignal.com/api/v1/notifications', { method: 'POST', headers: { Authorization: 'Basic ' + env('ONESIGNAL_REST_KEY') },
      body: { app_id: env('ONESIGNAL_APP_ID'), include_player_ids: ids, headings: { en: b.title }, contents: { en: b.text }, url: env('PUBLIC_URL') || undefined } });
    return r.status < 300 ? { ok: true } : { status: r.status, error: r.text.slice(0, 200) };
  },
};

let busy = false;
async function flush() {
  if (busy) return;
  busy = true;
  const down = new Set();
  try {
    for (const row of db.all('SELECT * FROM outbox WHERE sent_at IS NULL AND dead = 0 ORDER BY id LIMIT 200')) {
      if (down.has(row.target) || !SENDERS[row.target]) continue;
      let res;
      try { res = await SENDERS[row.target](row); } catch (e) { res = { status: 0, error: e.message }; }
      if (res === null) { down.add(row.target); last[row.target] = { at: C.stamp(C.now()), ok: false, error: 'link off (no URL)' }; continue; }
      if (res.ok) { db.run('UPDATE outbox SET sent_at = ?, tries = tries + 1, last_error = NULL WHERE id = ?', C.stamp(C.now()), row.id); last[row.target] = { at: C.stamp(C.now()), ok: true }; continue; }
      const refused = res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status);
      db.run('UPDATE outbox SET tries = tries + 1, last_error = ?, dead = ? WHERE id = ?', `${res.status} ${res.error || ''}`.slice(0, 300), refused ? 1 : 0, row.id);
      last[row.target] = { at: C.stamp(C.now()), ok: false, error: `${res.status} ${res.error || ''}`.slice(0, 200) };
      if (refused) db.tx(() => inv.addAlert('link', row.target, `The ${row.target} link refused a message (${res.status}). See Settings → Links.`, { roles: 'owner', key: `link:${row.id}` }));
      else down.add(row.target);   // portal down: keep the order, try again next minute
    }
  } finally { busy = false; }
}

// ---- keep the workshop desk (05) and The Moto Lab (11) parts lists in step: parts changed since the last send
const mark = (src, v) => { if (v === undefined) { const r = db.one('SELECT mark FROM pull_marks WHERE src = ?', src); return r ? r.mark : null; } db.run('INSERT INTO pull_marks (src, mark) VALUES (?, ?) ON CONFLICT(src) DO UPDATE SET mark = excluded.mark', src, String(v)); };
// Where a send stopped: "upd:id". Many rows share one upd (an import, a bulk edit), so the id breaks the tie;
// an old mark without ":id" means "everything up to this upd was sent".
const cursor = name => { const [u, i] = String(mark(name) || '0').split(':'); return [Number(u) || 0, i === undefined ? Number.MAX_SAFE_INTEGER : Number(i) || 0]; };
const AFTER = '(upd > ? OR (upd = ? AND id > ?))';
async function syncParts(target) {
  const isDesk = target === 'desk';
  const url = env(isDesk ? 'SANIYA_URL' : 'MOTOLAB_URL'), key = env(isDesk ? 'SANIYA_KEY' : 'MOTOLAB_KEY');
  if (!url || !key) return;
  const [u, i] = cursor('sync:' + target);
  const rows = db.all(`SELECT * FROM parts WHERE store = ? AND active = 1 AND ${AFTER} ${isDesk ? '' : 'AND mrp > 0'} ORDER BY upd, id LIMIT 500`, isDesk ? 'BS' : 'ML', u, u, i);
  if (!rows.length) return;
  const sent = new Set(isDesk ? [] : JSON.parse(mark('sent:motolab') || '[]'));
  const body = isDesk
    ? { parts: rows.map(p => ({ name: p.name, pno: p.pno, brand: p.brand || undefined, models: p.model ? p.model.split(/\s*[,/]\s*/).filter(Boolean).slice(0, 20) : [], mrp: Math.round(p.mrp), rack: p.rack, stock: Math.max(0, p.stock), min: p.alert })) }
    // The Moto Lab keeps its own stock (it enters its own vendor stock): the stock goes only with an item it has not had yet
    : { items: rows.map(p => ({ sku: p.pno, name: p.name, sp: Math.round(p.mrp), size: p.size, cat: inv.ML_CATS.includes(p.cat) ? p.cat : 'Bike care', brand: p.brand || 'Moto Lab', fits: 'all', rack: p.rack || '—', cp: Math.round(p.cost), alert: p.alert, ...(sent.has(p.id) ? {} : { stock: Math.max(0, p.stock) }), ...(p.bar ? { bar: p.bar } : {}), ...(p.last_sale ? { last: C.dmy(C.parse(p.last_sale)) } : {}) })) };
  try {
    const r = await call(url + (isDesk ? '/api/import/parts' : '/api/import/items'), { method: 'POST', headers: feedHeaders(key), body });
    if (r.status >= 300) { last[target] = { at: C.stamp(C.now()), ok: false, error: `${r.status} ${r.text.slice(0, 160)}` }; return; }
    mark('sync:' + target, `${rows[rows.length - 1].upd}:${rows[rows.length - 1].id}`);
    if (!isDesk) { for (const p of rows) sent.add(p.id); mark('sent:motolab', JSON.stringify([...sent])); }
    last[target] = { at: C.stamp(C.now()), ok: true, sent: rows.length };
  } catch (e) { last[target] = { at: C.stamp(C.now()), ok: false, error: e.message }; }
}

const ACTOR = portal => ({ id: null, name: { desk: 'Workshop desk', motolab: 'The Moto Lab' }[portal], role: 'feed', portal });
// Parts Saniya put on a job card (or took back) at the workshop desk: GET /api/feed/stock-moves?after=
async function pullDesk() {
  const url = env('SANIYA_URL'), key = env('SANIYA_KEY');
  if (!url || !key) return;
  try {
    const after = mark('pull:desk');
    const r = await call(`${url}/api/feed/stock-moves?after=${Number(after) || 0}`, { headers: feedHeaders(key) });
    if (r.status !== 200 || !r.json) throw new Error(`${r.status} ${r.text.slice(0, 120)}`);
    const moves = r.json.moves || [];
    if (after === null) { mark('pull:desk', moves.length ? moves[moves.length - 1].id : 0); last.deskPull = { at: C.stamp(C.now()), ok: true, moves: 0 }; return; }   // the first read only marks where to start
    if (!moves.length) { last.deskPull = { at: C.stamp(C.now()), ok: true, moves: 0 }; return; }
    // a job card line = a sale of the workshop (one bill per job card); 'import' rows are our own parts sync
    const bills = new Map();
    for (const m of moves) {
      if (m.why === 'import') continue;
      const no = m.jc ? `JC-${m.jc}` : (m.ref || `DESK-${m.id}`);
      const b = bills.get(no) || { no, day: m.day, lines: [] };
      b.lines.push({ pno: m.pno, qty: -Number(m.qty) });
      bills.set(no, b);
    }
    db.tx(() => {
      for (const b of bills.values()) {
        // add this pull's change on top of what the job card already had
        const had = db.all("SELECT pno, qty FROM sales WHERE src = 'desk' AND bill = ? AND cancelled = 0", b.no);
        const sum = new Map(had.map(h => [inv.pkeyOf(h.pno), h.qty]));
        for (const l of b.lines) sum.set(inv.pkeyOf(l.pno), (sum.get(inv.pkeyOf(l.pno)) || 0) + l.qty);
        inv.importSales(ACTOR('desk'), { store: 'BS', bills: [{ no: b.no, day: b.day, lines: [...sum].map(([pno, qty]) => ({ pno, qty })) }] });
      }
      mark('pull:desk', moves[moves.length - 1].id);
    });
    last.deskPull = { at: C.stamp(C.now()), ok: true, moves: moves.length };
  } catch (e) { last.deskPull = { at: C.stamp(C.now()), ok: false, error: e.message }; }
}
// The Moto Lab: today's bills and returns (GET /api/feed/sales?date=). Lines are [item id, qty, rate, name]; matched by name.
async function pullMotolab() {
  const url = env('MOTOLAB_URL'), key = env('MOTOLAB_KEY');
  if (!url || !key) return;
  try {
    const days = [C.now(), C.addDays(C.now(), -1)].map(C.dmy);
    for (const d of days) {
      const r = await call(`${url}/api/feed/sales?date=${d}`, { headers: feedHeaders(key) });
      if (r.status !== 200 || !r.json) throw new Error(`${r.status} ${r.text.slice(0, 120)}`);
      const bills = (r.json.bills || []).map(b => ({ no: b.no, day: b.date, cancel: !!b.cancelled || b.st === 'cancelled', lines: (b.lines || []).map(l => ({ name: l[3], qty: Number(l[1]) || 0, rate: Number(l[2]) || 0 })) }));
      // a return / exchange puts its pieces back: a minus line under the return number
      for (const x of r.json.returns || []) bills.push({ no: x.no, day: x.date, lines: (x.lines || []).map(l => ({ name: l[3], qty: -(Number(l[1]) || 0), rate: Number(l[2]) || 0 })) });
      if (bills.length) db.tx(() => inv.importSales(ACTOR('motolab'), { store: 'ML', bills }));
    }
    last.motolabPull = { at: C.stamp(C.now()), ok: true };
  } catch (e) { last.motolabPull = { at: C.stamp(C.now()), ok: false, error: e.message }; }
}

// ---- the admin panel (01) shows the same stock: every part change goes to POST /api/import/inventory (X-Alert-Key).
// Removed parts go with active: false so the admin drops them. Up to 10 batches of 2000 per run (the first run sends all).
// While the billing link is on (server/billing.js) the Bike Pharma restock store has no stock of its own (it is in the
// billing), so its rows go as removed: the admin shows exactly the billing's parts. A change read from the billing is
// sent at once (soon), not at the next minute.
let adminBusy = false, adminAgain = false;
async function syncAdmin() {
  if (adminBusy) { adminAgain = true; return; }
  adminBusy = true;
  try { do { adminAgain = false; await syncAdmin1(); } while (adminAgain); } finally { adminBusy = false; }
}
async function syncAdmin1() {
  const url = env('ADMIN_URL'), key = env('ALERT_KEY');
  if (!url || !key) return;
  // the link was switched on or off: everything goes once more (Bike Pharma rows out, or back)
  const mode = billing.on() ? 'live' : 'own';
  if (db.setting('admin_stock_mode', 'own') !== mode) { db.run("DELETE FROM pull_marks WHERE src = 'sync:admin'"); db.setSetting('admin_stock_mode', mode); }
  const asOff = p => mode === 'live' && p.store === 'BP';
  try {
    for (let n = 0; n < 10; n++) {
      const [u, i] = cursor('sync:admin');
      const rows = db.all(`SELECT p.*, (SELECT count(*) FROM photos f WHERE f.part = p.id) nph FROM parts p WHERE ${AFTER.replace(/upd/g, 'p.upd').replace('id >', 'p.id >')} ORDER BY p.upd, p.id LIMIT 2000`, u, u, i);
      if (!rows.length) break;
      const dmy = s => s ? C.dmy(C.parse(s)) : '';
      // prices exactly as here (as the billing has them), so the admin's stock value is the same to the rupee
      const parts = rows.map(p => ({ inv: p.id, b: p.store === 'ML' ? 'ml' : 'bs', active: !!p.active && !asOff(p), serial: p.pno, name: p.name, brand: p.brand, model: p.model,
        stock: p.stock, alert: p.alert, rack: p.rack, sp: p.mrp, cp: p.cost, tax: p.gst, hsn: p.hsn, cd: p.d_user, wd: p.d_whole, md: p.d_mech,
        date: dmy(p.added_at), lastSold: dmy(p.last_sale), img: p.nph > 0 }));
      const r = await call(url + '/api/import/inventory', { method: 'POST', headers: { 'X-Alert-Key': key, 'X-Portal': 'inventory' }, body: { parts, url: env('PUBLIC_URL') || undefined, ...(mode === 'live' ? { live: true } : {}) } });
      if (r.status >= 300) { last.adminStock = { at: C.stamp(C.now()), ok: false, error: `${r.status} ${r.text.slice(0, 160)}` }; return; }
      mark('sync:admin', `${rows[rows.length - 1].upd}:${rows[rows.length - 1].id}`);
      last.adminStock = { at: C.stamp(C.now()), ok: true, sent: rows.length };
    }
  } catch (e) { last.adminStock = { at: C.stamp(C.now()), ok: false, error: e.message }; }
}

async function tick() {
  await pullDesk(); await pullMotolab();
  await syncParts('desk'); await syncParts('motolab'); await syncAdmin();
  await flush();
}

function status() {
  const wait = db.all("SELECT target, count(*) n, max(last_error) err FROM outbox WHERE sent_at IS NULL AND dead = 0 GROUP BY target");
  const bl = billing.lastStatus();
  if (billing.on() && bl) for (const [s, x] of Object.entries(bl.stores || {})) last['billing' + s] = { at: x.at || x.errAt || bl.at, ok: !!x.ok, ...(x.err ? { error: x.err } : {}), parts: x.parts };
  const dead = db.all('SELECT id, target, path, last_error, created_at FROM outbox WHERE dead = 1 ORDER BY id DESC LIMIT 50');
  const on = { ...(billing.live('BS') ? { billingBS: true } : {}), ...(billing.live('ML') ? { billingML: true } : {}),
    accounts: !!env('ACCT_URL'), admin: !!(env('ADMIN_URL') && env('ALERT_KEY')), desk: !!(env('SANIYA_URL') && env('SANIYA_KEY')), motolab: !!(env('MOTOLAB_URL') && env('MOTOLAB_KEY')),
    whatsapp: !!env('WHATSAPP_URL'), push: !!(env('ONESIGNAL_APP_ID') && env('ONESIGNAL_REST_KEY')), mail: require('./mail').ready() };
  return { on, waiting: wait, refused: dead, last };
}
function retry(id) { db.run('UPDATE outbox SET dead = 0, tries = 0 WHERE id = ? AND dead = 1', Number(id)); }

module.exports = { tick, flush, status, retry, syncParts, syncAdmin, pullDesk, pullMotolab };
