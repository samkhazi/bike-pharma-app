// Inventory 2.0 straight on the billing (Sam 27 Nov: "in the old inventory the calculation is different, in new inventory
// calculation is different, the numbering mismatches"). Until switch day the billing sites hold the one real stock (a bill
// there takes the stock out at once), so Inventory 2.0 READS their parts table (cms_products) and keeps its parts exactly
// like it:
//   BS = the Bike Surgeon billing (billing.bikesurgeon.online, OLD_DB_BS): the workshop and the Bike Pharma counters
//   ML = The Moto Lab billing (themotolab.bikesurgeon.online, OLD_DB_ML)
// Every BILLING_TICK (3) seconds one tiny question asks MySQL for the checksum of cms_products; only when it changed (and
// at least every 10 minutes) the parts are read again and every difference is written here: part number, name, brand,
// model, MRP, cost, GST, discounts, stock, alert level, rack, batch, barcode, HSN, photos. A stock change is a line in the
// stock log ("Billing"). A part new in the billing comes in, a part deleted there leaves the list, and a part that was made
// only here (the billing does not have it) is set aside (Removed filter; its stock is kept). The numbers are read the way
// the billing reads them (its add-to-bill and bill calculation of 28 Oct): "1,250.00" is 1250, "18%" is 18, a GST rate
// that is not 5, 12, 18 or 28 is billed at 18 (and listed on Data check).
// Nothing is ever written to the billing: a read-only MySQL login (the admin panel's OLD_DB_* lines in .env). While a store
// is live, parts, stock and prices are changed in the billing only (Inventory shows it within seconds); photos, the order
// sheet, rack counts, alerts and the restock flow stay here. BILLING_LIVE=0 in .env switches it off (switch day).
'use strict';
const { execFile } = require('node:child_process');
const db = require('./db');
const C = require('./clock');

const env = k => String(process.env[k] || '').trim();
const DBS = { BS: 'OLD_DB_BS', ML: 'OLD_DB_ML' };
const NAMES = { BS: 'Bike Surgeon billing', ML: 'The Moto Lab billing' };
const SITES = { BS: 'https://billing.bikesurgeon.online', ML: 'https://themotolab.bikesurgeon.online' };
const userKey = store => (store === 'ML' && env('OLD_ML_USER') ? 'OLD_ML_USER' : 'OLD_DB_USER');
// a store is live when its database is set; BILLING_LIVE=0 = off for both
const live = store => env('BILLING_LIVE') !== '0' && !!DBS[store] && !!env(DBS[store]) && !!env(userKey(store));
const on = () => live('BS') || live('ML');
// stock of this store changes only in the billing: the live stores, and the Bike Pharma restock store while the link is on
// (its pieces go into the billing too, so there is one stock)
const locked = store => live(store) || (store === 'BP' && on());

// ---------------- MySQL through the command line (as the admin panel does it) --------------------------------------------
function run(store, sql) {
  const u = userKey(store);
  const args = ['-h', env('OLD_DB_HOST') || '127.0.0.1', '-P', env('OLD_DB_PORT') || '3306', '-u', env(u), '--batch', '--raw',
    '--skip-column-names', '--default-character-set=utf8mb4',
    // MySQL 8 users (caching_sha2_password) without TLS need the server's key; OLD_DB_PUBKEY=0 for a MariaDB client
    ...(env('OLD_DB_PUBKEY') === '0' ? [] : ['--get-server-public-key']), env(DBS[store]), '-e', sql];
  return new Promise((resolve, reject) => {
    execFile(env('MYSQL_BIN') || 'mysql', args, { env: { ...process.env, MYSQL_PWD: process.env[u === 'OLD_ML_USER' ? 'OLD_ML_PASS' : 'OLD_DB_PASS'] || '' },
      maxBuffer: 256 * 1024 * 1024, timeout: 50000 }, (err, out, errOut) => {
      if (err) return reject(new Error(String(errOut || err.message).replace(/\s+/g, ' ').trim().slice(0, 200)));
      resolve(out);
    });
  });
}
// the columns read (short names keep the answer small); The Moto Lab table has no gst_included / added_* columns: a column
// the table does not have is left out and the read is tried again
const COLS = { id: 'id', n: 'SUBSTRING(name, 1, 500)', d: 'SUBSTRING(description, 1, 1000)', br: 'SUBSTRING(brand, 1, 300)', mo: 'SUBSTRING(model, 1, 500)',
  mrp: 'gross_selling_price', cp: 'net_cost_price', tax: 'tax_rate', gi: 'gst_included', du: 'discount_to_user', dw: 'discount_to_wholeseller',
  dm: 'discount_to_mechanic', st: 'stock', al: 'stock_alert_on', bat: 'batch_no', sn: 'serial_no', bar: 'bar_code', i0: 'image', i1: 'image1', i2: 'image2',
  rack: 'rack', hsn: 'hsn', by: 'added_by_name', at: 'added_at' };
const missing = { BS: new Set(), ML: new Set() };
async function readParts(store) {
  for (let i = 0; i < 8; i++) {
    const cols = Object.entries(COLS).filter(([k]) => !missing[store].has(k));
    try {
      const out = await run(store, `SELECT JSON_OBJECT(${cols.map(([k, c]) => `'${k}', ${c}`).join(', ')}) FROM \`cms_products\``);
      const rows = [];
      for (const line of out.split('\n')) if (line.trim()) { try { rows.push(JSON.parse(line)); } catch { /* a broken row is skipped */ } }
      return rows;
    } catch (e) {
      const m = e.message.match(/Unknown column '(?:[\w`]+\.)?`?(\w+)`?' in 'field list'/i);
      const k = m && Object.keys(COLS).find(x => COLS[x] === m[1] || COLS[x].includes(`(${m[1]},`));
      if (!k || k === 'id' || k === 'st') throw e;
      missing[store].add(k);
    }
  }
  throw new Error('cms_products: too many missing columns');
}
async function checksum(store) {
  const out = await run(store, 'CHECKSUM TABLE `cms_products`');
  const v = (out.trim().split('\n')[0] || '').split('\t')[1];
  if (!v || v === 'NULL') throw new Error('MySQL gave no checksum');
  return v;
}

// ---------------- the billing's own way of reading its numbers -----------------------------------------------------------
const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// PHP floatval: the number at the start of the text ("18%" = 18, "abc" = 0)
const fl = v => { const m = String(v ?? '').match(/^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/); return m ? Number(m[0]) : 0; };
// prices: the billing takes the commas out first (ajax/add_to_invoice.php); kept exactly (no rounding), as the billing has them
const money = v => Math.max(0, fl(String(v ?? '').replace(/,/g, '')));
const SLABS = [5, 12, 18, 28];
// The rate each bill uses (only real GST slabs, anything else is billed at 18):
//   Bike Surgeon: bs_norm_gst_rate (includes/bs-invoice-calc.php): everything but digits, "." and "-" out ("18%" = 18),
//     0.18 = 18, a rate that is not 5, 12, 18 or 28 = 18
//   The Moto Lab: ml_invoice_build (includes/ml-invoice-calc.php): (float) of the rate (NULL = 18), 0.18 = 18, not a
//     whole 5, 12, 18 or 28 = 18
function gstOf(store, raw) {
  if (store === 'BS') {
    let v = fl(String(raw ?? '').replace(/[^0-9.-]/g, ''));
    if (v > 0 && v < 1) v = Math.round(v * 10000) / 100;
    const s = SLABS.find(x => Math.abs(v - x) < 0.01);
    return s !== undefined ? { gst: s, ok: true } : { gst: 18, ok: false };
  }
  let v = raw === null || raw === undefined ? 18 : fl(raw);
  if (v > 0 && v < 1) v *= 100;
  return SLABS.includes(Math.round(v)) && Math.abs(v - Math.round(v)) <= 0.01 ? { gst: Math.round(v), ok: true } : { gst: 18, ok: false };
}
const day = v => { const s = String(v || '').trim(); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null; };
const stampOf = v => { const d = day(v); if (!d) return null; const m = String(v).match(/[ T](\d{2}):(\d{2})/); return `${d} ${m ? `${m[1]}:${m[2]}` : '00:00'}`; };
const pkeyOf = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const photoFile = f => { const s = t(f, 200); return s && !/^(null|0)$/i.test(s) ? s : ''; };

// one billing row as Inventory fields (the same fields the 29 Oct import made, read the billing's way)
function fields(store, r) {
  const pno = t(r.sn, 100) || t(r.bar, 100) || `OLD-${r.id}`;
  const g = gstOf(store, r.tax);
  const f = {
    pno, pkey: pkeyOf(pno), name: t(r.n, 160) || t(r.d, 160) || pno, descr: t(r.d, 400), brand: t(r.br, 60).toUpperCase(), model: t(r.mo, 500),
    hsn: t(r.hsn, 12).replace(/\s/g, ''), gst: g.gst,
    // the billing adds GST on top only for "no" (gst-calc.php: anything else = in the price)
    gst_incl: String(r.gi ?? '').trim().toLowerCase() === 'no' ? 0 : 1,
    mrp: money(r.mrp), cost: money(r.cp),
    // The Moto Lab sells at net_cost_price (its bill takes that price, not a discount): kept as the selling price
    sell: store === 'ML' ? money(r.cp) : undefined,
    // Bike Surgeon discounts: (float) of the text ("16%" = 16, "" = 0), as its bill reads them
    d_user: store === 'ML' ? 0 : fl(r.du), d_whole: store === 'ML' ? 0 : fl(r.dw), d_mech: store === 'ML' ? 0 : fl(r.dm),
    // stock and alert level as the billing's Low Stock page reads them (CAST(... AS SIGNED): the whole number at the start)
    stock: Math.trunc(fl(r.st)), alert: Math.max(0, Math.trunc(fl(r.al))), rack: t(r.rack, 20).toUpperCase(), batch: t(r.bat, 60), bar: t(r.bar, 200),
  };
  if (f.sell === undefined) delete f.sell;
  return { f, gstOk: g.ok, photos: [r.i0, r.i1, r.i2].map(photoFile).filter(Boolean), by: t(r.by, 60), at: stampOf(r.at) };
}
const SYNC = ['pno', 'pkey', 'name', 'descr', 'brand', 'model', 'hsn', 'gst', 'gst_incl', 'mrp', 'cost', 'sell', 'd_user', 'd_whole', 'd_mech', 'alert', 'rack', 'batch', 'bar'];

// ---------------- one store: the billing's rows into the parts table ----------------------------------------------------
const ME = { id: null, name: 'Billing (live)', role: 'feed', portal: 'billing' };
function sync(store, rows) {
  const inv = require('./inv');
  const first = db.setting(`billing_first_${store}`, '') !== 'done';   // the first read brings many changes: no alerts for them
  const now = C.stamp(C.now()), ms = Date.now(), today = C.ymd(C.now());
  const out = { parts: 0, added: 0, changed: 0, stock: 0, removed: 0, aside: 0, linked: 0, gstFix: 0 };
  db.tx(() => {
    const cur = db.all('SELECT * FROM parts WHERE store = ?', store);
    const byOld = new Map(), loose = new Map();
    for (const p of cur) {
      if (p.old_id != null) { const o = byOld.get(Number(p.old_id)); if (!o || (p.active && !o.active)) byOld.set(Number(p.old_id), p); }
      else if (p.active) { const l = loose.get(p.pkey) || []; l.push(p); loose.set(p.pkey, l); }
    }
    const ph = new Map();
    for (const x of db.all('SELECT f.id, f.part, f.file FROM photos f JOIN parts p ON p.id = f.part WHERE f.old = 1 AND p.store = ? ORDER BY f.id', store)) {
      const l = ph.get(x.part) || []; l.push(x); ph.set(x.part, l);
    }
    const insMove = db.get().prepare("INSERT INTO stock_moves (at, part, qty, before, after, why, ref, src, who, note) VALUES (?,?,?,?,?,'billing',?,'billing',?,?)");
    const insPhoto = db.get().prepare('INSERT INTO photos (part, file, old, at, who) VALUES (?,?,1,?,?)');
    const delPhoto = db.get().prepare('DELETE FROM photos WHERE id = ?');
    const seen = new Set(), gstFix = [];
    const ref = NAMES[store];
    const alertOf = (p, before, after) => {
      if (first) return;
      if (p.alert > 0 && after <= p.alert && before > p.alert) {
        inv.addAlert(after <= 0 ? 'out' : 'low', p.pno, `${after <= 0 ? 'Out of stock' : 'Low stock'}: ${p.name} (${p.pno}${p.model ? ', ' + p.model : ''}) has ${after} left, alert at ${p.alert}. Rack ${p.rack || '—'}.`,
          { key: `low:${p.id}:${today}`, push: true });
      } else if (after < 0 && before >= 0) {
        inv.addAlert('neg', p.pno, `${p.name} (${p.pno}) went below 0 (${after}) in the billing. Count the rack.`, { key: `neg:${p.id}:${today}`, push: true });
      }
    };
    for (const r of rows) {
      const id = Number(r.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const { f, gstOk, photos, by, at } = fields(store, r);
      if (!gstOk) gstFix.push({ store, pno: f.pno, name: f.name, old: r.tax == null ? '' : String(r.tax).slice(0, 20) });
      out.parts++;
      let p = byOld.get(id);
      if (!p) {   // a part made here before the link, with the same part number: it is that billing row from now on
        const l = loose.get(f.pkey);
        if (l && l.length) { p = l.shift(); db.run('UPDATE parts SET old_id = ? WHERE id = ?', id, p.id); p.old_id = id; out.linked++; }
      }
      if (!p) {
        const cols = Object.keys(f).filter(k => k !== 'stock');
        const res = db.run(`INSERT INTO parts (store, ${cols.join(', ')}, stock, added_by, added_at, upd, old_id) VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?, ?, ?, ?)`,
          store, ...cols.map(k => f[k]), f.stock, by || NAMES[store], at || now, ms, id);
        const nid = Number(res.lastInsertRowid);
        if (f.stock) insMove.run(now, nid, f.stock, 0, f.stock, ref, ME.name, 'New part in the billing');
        for (const file of photos) insPhoto.run(nid, file, now, NAMES[store]);
        seen.add(nid); out.added++;
        continue;
      }
      seen.add(p.id);
      const diff = SYNC.filter(k => f[k] !== undefined && f[k] !== p[k]);
      const stockDiff = f.stock !== p.stock;
      const have = (ph.get(p.id) || []);
      const photoDiff = have.map(x => x.file).join('\n') !== photos.join('\n');
      if (!diff.length && !stockDiff && !photoDiff && p.active) continue;
      if (photoDiff) {
        const want = new Set(photos);
        for (const x of have) if (!want.has(x.file)) delPhoto.run(x.id);
        const got = new Set(have.map(x => x.file));
        for (const file of photos) if (!got.has(file)) insPhoto.run(p.id, file, now, NAMES[store]);
      }
      db.run(`UPDATE parts SET ${[...diff, 'stock'].map(k => `${k} = ?`).join(', ')}, active = 1, upd = ?, v = v + 1 WHERE id = ?`, ...diff.map(k => f[k]), f.stock, ms, p.id);
      if (stockDiff) {
        insMove.run(now, p.id, f.stock - p.stock, p.stock, f.stock, ref, ME.name, p.active ? '' : 'Back in the billing');
        alertOf({ ...p, ...f, id: p.id }, p.active ? p.stock : 0, f.stock);
        out.stock++;
      }
      if (diff.length || photoDiff || !p.active) out.changed++;
    }
    // not in the billing (any more): deleted there, or made only here
    const gone = [], aside = [];
    for (const p of cur) {
      if (!p.active || seen.has(p.id)) continue;
      if (p.old_id != null) {
        db.run('UPDATE parts SET active = 0, stock = 0, upd = ?, v = v + 1 WHERE id = ?', ms, p.id);
        if (p.stock) insMove.run(now, p.id, -p.stock, p.stock, 0, ref, ME.name, 'Deleted in the billing');
        gone.push(p.pno); out.removed++;
      } else {
        db.run('UPDATE parts SET active = 0, upd = ?, v = v + 1 WHERE id = ?', ms, p.id);
        aside.push(`${p.pno}${p.stock ? ` (stock ${p.stock})` : ''}`); out.aside++;
      }
    }
    if (gone.length) inv.audit(ME, 'part deleted in the billing', `${NAMES[store]}: ${gone.length} parts left the list: ${gone.slice(0, 40).join(', ')}${gone.length > 40 ? ' …' : ''}`);
    if (aside.length) inv.audit(ME, 'part set aside', `${aside.length} parts were made only in Inventory 2.0 and are not in the ${NAMES[store]}: set aside (Parts list > Removed). Add them in the billing if they are real: ${aside.slice(0, 40).join(', ')}${aside.length > 40 ? ' …' : ''}`);
    // the Data check list of wrong GST rates is the billing's own list now (rows marked "checked" stay hidden while the
    // billing keeps the same rate)
    const done = JSON.parse(db.setting('data_check_gst_done', '[]'));
    const keep = gstFix.filter(x => !done.some(d => d.store === store && d.pno === x.pno && d.old === x.old));
    const others = JSON.parse(db.setting('data_check_gst', '[]')).filter(x => x.store !== store);
    const next = JSON.stringify([...others, ...keep]);
    if (db.setting('data_check_gst', '[]') !== next) db.setSetting('data_check_gst', next);
    out.gstFix = keep.length;
    if (first) {
      db.setSetting(`billing_first_${store}`, 'done');
      inv.audit(ME, 'billing link on', `${NAMES[store]}: ${out.parts} parts, ${out.added} new, ${out.changed} changed, ${out.stock} stock changed, ${out.removed} deleted there, ${out.aside} set aside`);
    }
  });
  return out;
}

// ---------------- the loop -------------------------------------------------------------------------------------------
// Every BILLING_TICK (3) seconds the checksums; a read only when one changed, or every 10 minutes. A slow check, or a read
// that took long, makes the next check wait longer (never more than BILLING_SECONDS, 60), so the billing database is never
// asked more than it can take. Checksums not allowed (an error): a full read every BILLING_SECONDS.
const tick = () => Math.max(2, Number(env('BILLING_TICK')) || 3);
const slow = () => Math.max(20, Number(env('BILLING_SECONDS')) || 60);
const FULL_MS = 10 * 60 * 1000;
const state = { BS: { sum: null, at: 0 }, ML: { sum: null, at: 0 } };
let running = false, sumMs = 0, workMs = 0, readNow = false, sumPauseTill = 0, timer = null, onChange = null;
// ver changes whenever something read from the billing changed: an open page asks GET /api/live and loads again
let ver = Date.now();
const hms = d => [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
const nextIn = () => Math.min(slow() * 1000, Math.max(tick() * 1000, sumMs * 10, readNow ? workMs * 3 : 0));
async function pull(force = false) {
  if (!on() || running) return null;
  running = true;
  const last = lastStatus() || {};
  const status = { at: C.stamp(C.now()), sec: hms(C.now()), t: Date.now(), ok: true, fast: true, stores: { ...(last.stores || {}) } };
  let changed = false;
  readNow = false;
  try {
    for (const store of ['BS', 'ML']) {
      if (!live(store)) { delete status.stores[store]; continue; }
      const s = state[store], st = { ...(status.stores[store] || {}) };
      try {
        let sum = null;
        if (Date.now() >= sumPauseTill) {
          const t0 = Date.now();
          try { sum = await checksum(store); sumMs = Date.now() - t0; }
          catch (e) { sumPauseTill = Date.now() + slow() * 1000; st.sumErr = e.message.slice(0, 160); }
        }
        if (!sum) status.fast = false;
        const due = force || !s.at || !sum || sum !== s.sum || Date.now() - s.at >= FULL_MS;
        if (!due || (!sum && !force && s.at && Date.now() - s.at < slow() * 1000)) { status.stores[store] = st; continue; }
        const t1 = Date.now();
        const rows = await readParts(store);
        if (!rows.length) throw new Error('the billing gave no parts');
        const r = sync(store, rows);
        workMs = Date.now() - t1; readNow = true;
        s.sum = sum; s.at = Date.now();
        Object.assign(st, { ok: true, at: C.stamp(C.now()), parts: r.parts, ms: workMs, err: undefined });
        if (r.added || r.changed || r.stock || r.removed || r.aside) {
          changed = true;
          st.last = { at: st.at, added: r.added, changed: r.changed, stock: r.stock, removed: r.removed, aside: r.aside };
        }
        if (sum) delete st.sumErr;
      } catch (e) {
        status.ok = false;
        Object.assign(st, { ok: false, err: e.message.slice(0, 200), errAt: C.stamp(C.now()) });
        console.error(`billing link (${store}):`, st.err);
      }
      status.stores[store] = st;
    }
  } finally {
    running = false;
    if (changed) ver = Date.now();
    status.every = Math.round(nextIn() / 1000);
    status.check = sumMs;
    db.setSetting('billing_last', JSON.stringify(status));
  }
  if (changed && onChange) setImmediate(() => { try { onChange(); } catch (e) { console.error('billing link:', e.message); } });
  return status;
}
function start(changedFn) {
  if (!on() || timer) return null;
  onChange = changedFn || null;
  const loop = async () => {
    try { await pull(); } catch (e) { console.error('billing link:', e.message); }   // a round never stops the link
    timer = setTimeout(loop, nextIn());
  };
  timer = setTimeout(loop, 0);
  return true;
}
const lastStatus = () => { try { return JSON.parse(db.setting('billing_last', '') || 'null'); } catch { return null; } };
// what the pages see (no database answers in it, except for the owner and manager)
function view(me) {
  if (!on()) return { on: false };
  const l = lastStatus() || {}, boss = me && ['owner', 'manager'].includes(me.role);
  const stores = {};
  for (const s of ['BS', 'ML']) if (live(s)) {
    const x = (l.stores || {})[s] || {};
    stores[s] = { name: NAMES[s], site: SITES[s], ok: !!x.ok, at: x.at || null, parts: x.parts || 0, ...(boss && x.err ? { err: x.err } : {}), ...(boss && x.last ? { last: x.last } : {}) };
  }
  return { on: true, stores, fast: !!l.fast, every: l.every || tick(), at: l.at || null, sec: l.sec || null, ver };
}
// for /healthz: no database answers
const health = () => { if (!on()) return { on: false }; const l = lastStatus() || {}; return { on: true, ok: !!l.ok, at: l.at || null, fast: !!l.fast }; };

module.exports = { live, on, locked, start, pull, sync, fields, view, health, lastStatus, NAMES, SITES, gstOf, money, fl };
