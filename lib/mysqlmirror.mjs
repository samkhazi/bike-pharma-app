// update 10m (Sam 2026-10-22 "phpMyAdmin me database ... products etc easily edit"): the shop data is copied into MySQL tables,
// one row per product / bill / customer, and edits made in phpMyAdmin come back into the app within a few seconds.
// The site keeps running on its own database (data/bikepharma.sqlite); MySQL is a two-way copy of it, so a MySQL outage never
// stops the shop. Turned on by MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD in .env.
// Tables: one per app key (friendly names below); _row = the record's id (or its place in the list), _pos = list order,
// _nulls = fields that are empty on purpose, _updated = last change. Columns holding lists or groups keep them as JSON text.
// _about lists the tables, _columns how each column turns back into app data, _sync what the server last wrote.
import { connect, escape, ident } from './mysql.mjs';

const NAMES = { newProducts: 'products', accounts: 'logins', cu: 'customers', sups: 'suppliers', grns: 'stock_in', moves: 'stock_moves',
  lots: 'mrp_lots', pos: 'purchase_orders', cwl: 'customer_wallet', bins: 'racks', notifs: 'notification_count' };
const ABOUT = { products: 'Products: part no. (pn), name, brand, MRP (mrp), customer price (price), mechanic price (mp), stock, rack (bin), photos',
  stock: 'Stock count per product id (_key = product id, value = pieces)', bills: 'Bills / invoices (items = JSON list of lines)',
  logins: 'Staff, mechanic and customer logins (no passwords here)', customers: 'Customers', suppliers: 'Suppliers',
  stock_in: 'Stock in (supplier bills, GRN)', stock_moves: 'Every stock movement', mrp_lots: 'Pieces per MRP for each product (JSON)',
  purchase_orders: 'Purchase orders', customer_wallet: 'Customer wallet entries (JSON per mobile)', racks: 'Racks / bins', audit: 'Audit log' };
const SKIP = new Set(['seed10', 'seedOT', 'noSeed', 'cwlFix']);   // internal one-time markers
const tableOf = k => NAMES[k] || k;
const okName = f => typeof f === 'string' && f.length > 0 && f.length <= 60 && !f.startsWith('_') && !/[\x00`]/.test(f);
const jt = v => v === null ? null : typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : typeof v === 'string' ? 's' : 'j';
const SQLT = { n: 'DOUBLE', b: 'TINYINT(1)', s: 'TEXT', j: 'LONGTEXT' };

// the rows of one app key: list of objects, map of id -> value, or one value
function rowsOf(v) {
  if (Array.isArray(v)) {
    const ids = v.map(o => o && typeof o === 'object' && !Array.isArray(o) && (typeof o.id === 'string' || typeof o.id === 'number') ? String(o.id) : null);
    const byId = ids.every(Boolean) && new Set(ids).size === ids.length && ids.every(i => i.length <= 191);
    return { shape: 'list', rows: v.map((o, i) => ({ k: byId ? ids[i] : 'r' + String(i).padStart(6, '0'), pos: i, o })) };
  }
  if (v && typeof v === 'object') return { shape: 'map', rows: Object.keys(v).filter(k => k.length <= 191).map((k, i) => ({ k, pos: i, o: v[k] })) };
  return { shape: 'value', rows: [{ k: 'value', pos: 0, o: v }] };
}
// a row's columns: objects spread into their fields, anything else into one 'value' column
function colsOf(o) {
  const out = {}, nulls = [], extra = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [f, x] of Object.entries(o)) { if (!okName(f)) { extra[f] = x; continue; } if (x === null) nulls.push(f); else out[f] = x; }
    if (Object.keys(extra).length) out._extra = extra;
  } else if (o === null) nulls.push('value'); else out.value = o;
  return { out, nulls, spread: !!(o && typeof o === 'object' && !Array.isArray(o)) };
}

export function startMirror(store, env, log = console) {
  const conf = { host: env.MYSQL_HOST, port: env.MYSQL_PORT || 3306, database: env.MYSQL_DATABASE, user: env.MYSQL_USER, password: env.MYSQL_PASSWORD };
  const S = { on: !!(conf.host && conf.database && conf.user), ok: false, err: '', tables: 0, lastPush: '', lastPull: '', pulls: 0 };
  if (!S.on) return { summary: () => S };
  let db = null, ready = false;
  const T = {};   // table -> {key, shape, cols: {name: type}, rows: Map(_row -> json of the row as written), fp}
  const dirty = new Set(); let timer = null, busy = Promise.resolve();
  const q = (sql) => db.query(sql);
  const task = f => (busy = busy.then(f).catch(e => { S.err = String(e && e.message || e).slice(0, 300); S.ok = false; log.error('mysql:', S.err); if (db && db.closed) { db = null; ready = false; } }));

  async function open() {
    db = await connect({ ...conf, timeout: 15000 }); await q('SET NAMES utf8mb4');
    await q("CREATE TABLE IF NOT EXISTS `_about` (`table_name` VARCHAR(64) PRIMARY KEY, `app_key` VARCHAR(64), `what` TEXT) DEFAULT CHARSET=utf8mb4");
    await q("CREATE TABLE IF NOT EXISTS `_columns` (`table_name` VARCHAR(64), `column_name` VARCHAR(64), `jtype` CHAR(1), PRIMARY KEY(`table_name`,`column_name`)) DEFAULT CHARSET=utf8mb4");
    await q("CREATE TABLE IF NOT EXISTS `_sync` (`table_name` VARCHAR(64) PRIMARY KEY, `app_key` VARCHAR(64), `shape` VARCHAR(8), `cnt` BIGINT, `last` VARCHAR(40)) DEFAULT CHARSET=utf8mb4");
    const cols = await q('SELECT * FROM `_columns`'); const syn = await q('SELECT * FROM `_sync`');
    for (const s of syn) T[s.table_name] = { key: s.app_key, shape: s.shape, cols: {}, rows: null, fp: s.cnt + '|' + s.last, saved: true };
    for (const c of cols) if (T[c.table_name]) T[c.table_name].cols[c.column_name] = c.jtype;
    ready = true; S.ok = true; S.err = '';
  }
  async function fp(t) { const r = await q(`SELECT COUNT(*) c, MAX(_updated) m FROM ${ident(t)}`); return r[0].c + '|' + (r[0].m || ''); }
  async function saveFp(t) { const x = T[t]; x.fp = await fp(t); const [c, m] = x.fp.split('|');
    await q(`REPLACE INTO _sync VALUES (${escape(t)},${escape(x.key)},${escape(x.shape)},${escape(+c)},${escape(m)})`); }
  async function ensureTable(t, key, shape) {
    if (T[t] && T[t].made) return T[t];
    await q(`CREATE TABLE IF NOT EXISTS ${ident(t)} (_row VARCHAR(191) NOT NULL PRIMARY KEY, _pos INT NOT NULL DEFAULT 0, _nulls TEXT NULL,
      _updated TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), KEY(_pos)) DEFAULT CHARSET=utf8mb4`);
    await q(`REPLACE INTO _about VALUES (${escape(t)},${escape(key)},${escape(ABOUT[t] || '')})`);
    const x = T[t] || (T[t] = { key, cols: {}, rows: null, fp: '' }); x.key = key; x.shape = shape; x.made = true;
    const have = new Set((await q(`SHOW COLUMNS FROM ${ident(t)}`)).map(r => r.Field.toLowerCase()));
    for (const c of Object.keys(x.cols)) if (!have.has(c.toLowerCase())) delete x.cols[c];
    S.tables = Object.values(T).filter(y => y.made).length; return x;
  }
  async function ensureCol(t, x, f, v) {
    const want = f === '_extra' ? 'j' : jt(v); let have = x.cols[f];
    if (!have) {
      const clash = Object.keys(x.cols).find(c => c.toLowerCase() === f.toLowerCase()); if (clash) return false;   // MySQL names ignore case
      if (Object.keys(x.cols).length >= 200) return false;   // rows whose field names keep changing: the rest goes into _extra
      await q(`ALTER TABLE ${ident(t)} ADD COLUMN ${ident(f)} ${SQLT[want]} NULL`); x.cols[f] = want;
      await q(`REPLACE INTO _columns VALUES (${escape(t)},${escape(f)},${escape(want)})`); return true;
    }
    if (have !== want && have !== 'j') {   // a column that now holds another kind of value keeps everything as JSON text
      await q(`ALTER TABLE ${ident(t)} MODIFY ${ident(f)} LONGTEXT NULL`);
      await q(`UPDATE ${ident(t)} SET ${ident(f)} = ${have === 's' ? `JSON_QUOTE(${ident(f)})` : ident(f)} WHERE ${ident(f)} IS NOT NULL`);
      x.cols[f] = 'j'; await q(`REPLACE INTO _columns VALUES (${escape(t)},${escape(f)},'j')`);
    }
    return true;
  }
  const sqlVal = (type, v) => type === 'j' ? escape(JSON.stringify(v)) : type === 'b' ? (v ? '1' : '0') : type === 'n' ? escape(+v) : escape(String(v));
  const fromSql = (type, s) => { if (s === null) return undefined; if (type === 'n') { const n = Number(s); return Number.isFinite(n) && s.trim() !== '' ? n : s; }
    if (type === 'b') return s === '1' || /^true$/i.test(s); if (type === 'j') { try { return JSON.parse(s); } catch (e) { return s; } } return s; };

  async function loadRows(t, x) { const m = new Map(); for (const r of await q(`SELECT * FROM ${ident(t)}`)) m.set(r._row, rowJson(x, r)); x.rows = m; }
  function rowJson(x, r) { return JSON.stringify(rowObj(x, r)); }
  function rowObj(x, r) {
    const nulls = (r._nulls || '').split(',').filter(Boolean);
    if (x.shape !== 'list' && x.shape !== 'map' || !Object.keys(x.cols).some(c => c !== 'value')) {
      if ('value' in x.cols) { const v = fromSql(x.cols.value, r.value); return v === undefined ? (nulls.includes('value') ? null : undefined) : v; }
    }
    const o = {};
    for (const [c, ty] of Object.entries(x.cols)) { if (c === 'value' && !('value' in r)) continue; const v = fromSql(ty, r[c]); if (c === '_extra') { if (v && typeof v === 'object') Object.assign(o, v); continue; } if (v !== undefined) o[c] = v; }
    for (const f of nulls) if (!(f in o)) o[f] = null;
    return o;
  }

  async function push(key) {
    const st = store.stateGet(key); if (!st || SKIP.has(key)) return;
    const t = tableOf(key); let v; try { v = JSON.parse(st.json); } catch (e) { return; }
    const { shape, rows } = rowsOf(v);
    const x = await ensureTable(t, key, shape); if (!x.rows) await loadRows(t, x);
    const keep = new Set(), up = [];
    for (const r of rows) { const c = colsOf(r.o); const j = JSON.stringify(r.o === undefined ? null : r.o) + '#' + r.pos; keep.add(r.k);
      if (x.rows.get(r.k) !== j) up.push({ r, c, j }); }
    const gone = [...x.rows.keys()].filter(k => !keep.has(k));
    if (!up.length && !gone.length) return;
    for (const u of up) for (const [f, val] of Object.entries(u.c.out)) if (f !== '_extra' && !(await ensureCol(t, x, f, val))) {
      (u.c.out._extra || (u.c.out._extra = {}))[f] = val; delete u.c.out[f]; }
    for (const u of up) if (u.c.out._extra) await ensureCol(t, x, '_extra', u.c.out._extra);
    await q('START TRANSACTION');
    try {
    for (let i = 0; i < up.length; i += 200) {
      const part = up.slice(i, i + 200), names = Object.keys(x.cols);
      const vals = part.map(({ r, c }) => '(' + [escape(r.k), escape(r.pos), escape(c.nulls.join(',') || null), ...names.map(n => n in c.out ? sqlVal(x.cols[n], c.out[n]) : 'NULL')].join(',') + ')');
      const all = ['_row', '_pos', '_nulls', ...names];
      await q(`INSERT INTO ${ident(t)} (${all.map(ident).join(',')}) VALUES ${vals.join(',')} ON DUPLICATE KEY UPDATE ${all.slice(1).map(n => `${ident(n)}=VALUES(${ident(n)})`).join(',')}`);
      for (const { r, j } of part) x.rows.set(r.k, j);
    }
    for (let i = 0; i < gone.length; i += 500) { const part = gone.slice(i, i + 500); await q(`DELETE FROM ${ident(t)} WHERE _row IN (${part.map(escape).join(',')})`); part.forEach(k => x.rows.delete(k)); }
    await q('COMMIT');
    } catch (e) { x.rows = null; try { await q('ROLLBACK'); } catch (e2) {} throw e; }   // read again from MySQL next time
    await saveFp(t); S.lastPush = new Date().toISOString();
  }
  // a table changed by someone else (phpMyAdmin): its rows become the app's data again
  async function pull(t) {
    const x = T[t]; if (!x || !x.key || SKIP.has(x.key)) return;
    const rev0 = (store.stateGet(x.key) || {}).rev;   // 13e: an app save while MySQL is read wins; this pull is tried again later
    const cols = await q(`SELECT column_name, jtype FROM _columns WHERE table_name=${escape(t)}`); for (const c of cols) x.cols[c.column_name] = c.jtype;
    const have = await q(`SHOW COLUMNS FROM ${ident(t)}`);
    for (const h of have) if (!h.Field.startsWith('_') && !x.cols[h.Field]) x.cols[h.Field] = /int|double|float|decimal/i.test(h.Type) ? 'n' : 's';   // a column Sam added himself
    const rows = await q(`SELECT * FROM ${ident(t)} ORDER BY _pos, _row`);
    let v;
    if (x.shape === 'list') v = rows.map(r => rowObj(x, r)).filter(o => o !== undefined);
    else if (x.shape === 'map') { v = {}; for (const r of rows) { const o = rowObj(x, r); if (o !== undefined) v[r._row] = o; } }
    else { const r = rows.find(r => r._row === 'value'); v = r ? rowObj(x, r) : null; }
    if (x.shape === 'list') { v.forEach((o, i) => { if (o && typeof o === 'object' && rows[i]._row && !/^r\d{6}$/.test(rows[i]._row) && o.id === undefined) o.id = rows[i]._row; }); }
    const json = JSON.stringify(v); const cur = store.stateGet(x.key);
    if ((cur || {}).rev !== rev0) return;
    /* a pull that would empty more than half of a list of 20 or more is held back (a wrong SQL query in phpMyAdmin) and the app's rows go back in; it shows in /api/health */
    try { const old = cur ? JSON.parse(cur.json) : null; const n0 = old && typeof old === 'object' ? Object.keys(old).length : 0, n1 = v && typeof v === 'object' ? Object.keys(v).length : 0;
      if (n0 >= 20 && n1 < n0 / 2) { S.held = `${t}: ${n0} -> ${n1} rows were not taken in; the app's rows were written back (${new Date().toISOString()})`; x.rows = null; dirty.add(x.key); return; } } catch (e) {}
    if (!cur || cur.json !== json) { pulling = x.key; try { store.write({ [x.key]: json }); } finally { pulling = null; } S.pulls++; S.lastPull = new Date().toISOString(); log.log('mysql: took the changes in', t); }
    const { rows: mine } = rowsOf(v); x.rows = new Map(mine.map(r => [r.k, JSON.stringify(r.o === undefined ? null : r.o) + '#' + r.pos]));
    // rows whose place or id the app gives differently are written back in its form
    dirty.add(x.key); await saveFp(t);
  }
  let pulling = null;
  async function tick() {
    if (!ready) { await open(); for (const r of store.stateAll()) if (!SKIP.has(r.key)) {
      const t = tableOf(r.key), x = T[t];
      if (x && x.saved) { try { const f = await fp(t); if (f !== x.fp) { await ensureTable(t, r.key, x.shape); await pull(t); continue; } } catch (e) {} }
      dirty.add(r.key); } }
    for (const k of [...dirty]) { dirty.delete(k); try { await push(k); } catch (e) { dirty.add(k); throw e; } }
    for (const [t, x] of Object.entries(T)) { if (!x.made || dirty.has(x.key)) continue; const f = await fp(t); if (f !== x.fp) await pull(t); }
    for (const k of [...dirty]) { dirty.delete(k); try { await push(k); } catch (e) { dirty.add(k); throw e; } }
    S.ok = true; S.err = '';
  }
  const orig = store.write.bind(store);
  store.write = changes => { const rev = orig(changes); for (const k of Object.keys(changes)) if (k !== pulling && !SKIP.has(k)) dirty.add(k); clearTimeout(timer); timer = setTimeout(() => task(tick), 400); return rev; };
  setInterval(() => task(tick), 4000).unref();
  task(tick);
  return { summary: () => ({ ...S, tables: S.tables }), flush: () => task(tick) };
}
