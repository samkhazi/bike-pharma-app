// The service advisors' job cards straight from the Bike Surgeon billing (Sam, 28 Nov 2026: "kitne job card bane, kaun se
// pending, kisko assign kiya hua hai, ye job card kitna baaki hai, online bookings kitni aayi ... ekdam accurate").
// READ ONLY: this panel asks the billing's MySQL database through the mysql command line program (like the Moto Lab panel's
// server/mldb.js and the admin panel's server/oldbill.js); nothing is ever written there. Every LIVE_SECONDS (3) one small
// question asks MySQL for the checksums of the tables read; only a changed table is read again (all of them every 10 minutes).
//
// ACCURATE = THE OLD SERVICE APP'S OWN SQL (service.bikesurgeon.online/app): MySQL itself decides with the old pages' own
// conditions which tab a job card is in, so every count and list is the old site's (its collation, its spaces, its case):
//   Pending approval  approval='PENDING' AND status='PENDING'                     (job-cards.php)
//   Ongoing           approval='APPROVED' AND status='ONGOING'
//   Completed         status IN ('COMPLETED','STREAM_STOPPED')   STREAM_STOPPED = paused, a job of more than one day (the billing
//                     shows it as "Paused / Multi-Day"); the service app lists it under Completed
//   Not approved      status='NOT_APPROVED'
//   Other status      none of these (the old app shows them in no tab; listed here so the tabs add up to every job card)
//   Today's job cards dd, mm, yy = today, Indian time                               (scheduled.php)
//   Online bookings   status 'pending' / 'confirmed' / 'converted' / 'cancelled'     (online-bookings.php)
//   Service reminders booked = 0, next_service_due <= CURDATE(), next call due or none (home.php, per advisor)
//   One job card      labour lines, issue checklist, parts of its latest bill (goods_price x qty less the line's discount %,
//                     else the part's discount_to_user, to the paisa), parts requests (job-card-labour.php)
// .env (update.sh copies these lines from the admin panel's .env): OLD_DB_BS, OLD_DB_USER + OLD_DB_PASS, OLD_DB_HOST,
// OLD_DB_PORT, OLD_DB_PUBKEY, MYSQL_BIN. FLOOR_LIVE=0 = off (the sample floor of the design comes back).
'use strict';
const { execFile } = require('node:child_process');
const C = require('./clock');
const db = require('./db');

const env = k => String(process.env[k] || '').trim();
const on = () => env('FLOOR_LIVE') !== '0' && !!(env('OLD_DB_BS') && env('OLD_DB_USER'));
const EVERY = Math.max(2, Number(env('LIVE_SECONDS')) || 3) * 1000;
const FULL_MS = 10 * 60 * 1000;

function mysql(sql) {
  const args = ['-h', env('OLD_DB_HOST') || '127.0.0.1', '-P', env('OLD_DB_PORT') || '3306', '-u', env('OLD_DB_USER'),
    '--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4',
    // MySQL 8 users (caching_sha2_password) without TLS need the server's key; OLD_DB_PUBKEY=0 for a MariaDB client
    ...(env('OLD_DB_PUBKEY') === '0' ? [] : ['--get-server-public-key']), env('OLD_DB_BS'), '-e', sql];
  return new Promise((resolve, reject) => {
    execFile(env('MYSQL_BIN') || 'mysql', args, { env: { ...process.env, MYSQL_PWD: process.env.OLD_DB_PASS || '' }, maxBuffer: 256 * 1024 * 1024, timeout: 50000 },
      (err, out, errOut) => err ? reject(new Error(String(errOut || err.message).replace(/\s+/g, ' ').trim().slice(0, 200))) : resolve(out));
  });
}
// one JSON object per line (JSON_OBJECT escapes every line break, --raw keeps it as it is)
async function rows(sql, what) {
  const out = await mysql(sql).catch(e => { throw new Error(`${what}: ${e.message}`); });
  const r = [];
  for (const line of out.split('\n')) if (line.trim()) { try { r.push(JSON.parse(line)); } catch { /* a broken row is skipped */ } }
  return r;
}
const J = cols => `JSON_OBJECT(${Object.entries(cols).map(([k, c]) => `'${k}', ${c}`).join(', ')})`;
const sub = (c, n) => `SUBSTRING(${c}, 1, ${n})`;
// the checksum of each table (it changes when any row is added, changed or deleted): Map table -> checksum
async function stamp(tables) {
  const out = await mysql(`CHECKSUM TABLE ${tables.map(t => `\`${t}\``).join(', ')}`);
  const m = new Map();
  for (const line of out.split('\n')) { const [t, v] = line.trim().split('\t'); if (t) m.set(t.slice(t.indexOf('.') + 1), v || 'NULL'); }
  if (!m.size) throw new Error('MySQL gave no checksum');
  return m;
}

// ---------------- helpers --------------------------------------------------------------------------------------------------
const num = v => { const n = Number(String(v ?? '').replace(/[₹,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 100) / 100;
const s = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const up = v => s(v, 40).toUpperCase();
const pad = n => String(n).padStart(2, '0');
const plate = v => s(v, 24).toUpperCase();
const regKey = v => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nameKey = v => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');
const digits = v => String(v ?? '').replace(/\D/g, '').slice(-10);
// a time of the billing (Indian time) -> 'YYYY-MM-DD HH:MM': '2026-11-24 12:15:01', '2026-11-24T17:14', '24-11-2026 12:05:16 pm'
function when(v) {
  const t = String(v ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return m[4] === undefined ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}-${m[3]} ${pad(m[4])}:${m[5]}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?)?/i);
  if (!m) return '';
  const d = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  if (m[4] === undefined) return d;
  let h = Number(m[4]); const ap = (m[6] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${d} ${pad(h)}:${m[5]}`;
}
const dayOf = v => when(v).slice(0, 10);
const group = (list, k) => { const m = new Map(); for (const x of list || []) { const key = String(x[k]); if (!m.has(key)) m.set(key, []); m.get(key).push(x); } return m; };

// ---------------- what is read -----------------------------------------------------------------------------------------------
// the old pages' tab of a job card, decided by MySQL itself
const TAB = "CASE WHEN approval='PENDING' AND status='PENDING' THEN 'p' WHEN approval='APPROVED' AND status='ONGOING' THEN 'o' " +
  "WHEN status IN ('COMPLETED','STREAM_STOPPED') THEN 'c' WHEN status='NOT_APPROVED' THEN 'n' ELSE 'x' END";
const BOOKING = "CASE WHEN status='pending' THEN 'pending' WHEN status='confirmed' THEN 'confirmed' WHEN status='converted' THEN 'converted' " +
  "WHEN status='cancelled' THEN 'cancelled' ELSE '' END";
// today as scheduled.php asks it: dd, mm (two digits) and yy (the year, four digits), Indian time
const context = (now = C.now()) => ({ dd: pad(now.getDate()), mm: pad(now.getMonth() + 1), yy: String(now.getFullYear()) });
// need: without it nothing can be shown; the others give an empty part (a WARN line) when this login may not read them
function sources(x) {
  return {
    jc: { tables: ['job_card'], need: true, sql: `SELECT ${J({ id: 'id', p: sub('vehicle_number', 24), mk: sub('make', 40), mo: sub('model', 60),
      n: sub('name', 80), ph: sub('phone', 20), svc: sub('service_type', 200), pkg: sub('service_package', 12), est: sub('estimated_cost', 14),
      km: sub('odo_reading', 12), st: sub('status', 24), ap: sub('approval', 16), at: sub('created_at', 30), done: sub('completed_at', 30),
      go: sub('mechanic_assigned_at', 30), due: sub('delivery_time', 30), mech: 'mechanic_id', bay: 'bay_id', by: 'created_by',
      byn: sub('created_by_name', 40), free: 'is_free_service_claim', tab: TAB,
      td: `CASE WHEN dd='${x.dd}' AND mm='${x.mm}' AND yy='${x.yy}' THEN 1 ELSE 0 END` })} FROM \`job_card\`` },
    mech: { tables: ['mechanic'], sql: `SELECT ${J({ id: 'id', n: sub('name', 60), st: sub('status', 20) })} FROM \`mechanic\`` },
    bay: { tables: ['bay'], sql: `SELECT ${J({ id: 'id', n: sub('name', 30) })} FROM \`bay\`` },
    adv: { tables: ['service_adviser'], sql: `SELECT ${J({ id: 'id', n: sub('name', 60), ph: sub('phone', 20), st: sub('status', 16) })} FROM \`service_adviser\`` },
    bk: { tables: ['a_service_bookings'], sql: `SELECT ${J({ id: 'id', n: sub('name', 80), ph: sub('phone', 20), type: sub('type', 60),
      pick: sub('pickupType', 20), addr: sub('address', 200), lat: sub('latitude', 24), lng: sub('longitude', 24), bike: sub('bike_details', 120),
      note: sub('note', 300), at: sub('date_time', 30), sched: sub('scheduled_for', 30), ab: 'attended_by', abn: sub('attended_by_name', 40),
      aat: sub('attended_at', 30), f: BOOKING })} FROM \`a_service_bookings\`` },
    // only the bills of job cards (a counter bill has no job card)
    inv: { tables: ['invoice', 'service_invoice'], sql: `SELECT ${J({ id: 'id', jc: 'job_card_id', no: sub('invoice_no', 30), st: sub('payment_status', 16) })} FROM \`invoice\` ` +
      'WHERE job_card_id > 0 OR id IN (SELECT invoice_id FROM `service_invoice`)' },
    si: { tables: ['service_invoice'], sql: `SELECT ${J({ i: 'invoice_id', jc: 'job_card_id' })} FROM \`service_invoice\`` },
    // the parts requests as the old job card list asks them: request_type != 'return' (MySQL decides), the newest by pushed_at
    pr: { tables: ['service_parts_request'], sql: `SELECT ${J({ id: 'id', jc: 'job_card_id', st: sub('status', 16), at: sub('pushed_at', 30) })} ` +
      "FROM `service_parts_request` WHERE request_type != 'return'" },
    pri: { tables: ['service_parts_request_items'], sql: `SELECT ${J({ rid: 'request_id', st: sub('item_status', 16), cs: sub('checking_started_at', 30) })} FROM \`service_parts_request_items\`` },
    cl: { tables: ['job_card_checklist'], sql: `SELECT ${J({ jc: 'job_card_id', st: 'status', n: 'COUNT(*)' })} FROM \`job_card_checklist\` GROUP BY job_card_id, status` },
    qc: { tables: ['job_card_qc'], sql: `SELECT ${J({ jc: 'job_card_id', lv: 'level', st: sub('status', 16), at: sub('checked_at', 30) })} FROM \`job_card_qc\`` },
    rem: { tables: ['next_service_reminders'], sql: `SELECT ${J({ a: 'advisor_id', n: 'COUNT(*)' })} FROM \`next_service_reminders\` WHERE booked = 0 ` +
      'AND next_service_due <= CURDATE() AND (next_call_due IS NULL OR next_call_due <= CURDATE()) GROUP BY advisor_id' },
    quo: { tables: ['quotations'], sql: `SELECT ${J({ n: 'COUNT(*)' })} FROM \`quotations\`` },
  };
}

// ---------------- the link --------------------------------------------------------------------------------------------------
const L = { on: false, ok: false, err: '', warn: {}, at: 0, check: 0, fast: false, rev: 0, raw: {}, sql: {}, sums: null, read: new Set(), full: 0, busy: false };
let V = null;   // what the pages get, made again after each read that changed something
// the version of V the pages have: a new one after each change (and after a restart, so a page never keeps old data)
const BOOT = Date.now().toString(36);
const revOf = () => `${BOOT}.${L.rev}`;

async function round() {
  const x = context(), src = sources(x), t0 = Date.now();
  const full = !L.read.size || Date.now() - L.full >= FULL_MS;
  let sums = null;
  if (L.read.size) {
    try { sums = await stamp([...L.read]); L.check = Date.now() - t0; L.fast = true; delete L.sumErr; }
    catch (e) { L.fast = false; L.sumErr = e.message.slice(0, 160); }
  }
  // no checksums (this login may not ask for them): everything every minute
  if (!sums && L.read.size && !full && Date.now() - L.at < 60000) return;
  const changed = t => !sums || !L.sums || sums.get(t) !== L.sums.get(t);
  const todo = Object.entries(src).filter(([k, q]) => full || L.sql[k] !== q.sql || q.tables.some(changed));
  if (!todo.length) { L.sums = sums; L.at = Date.now(); return; }
  const got = await Promise.all(todo.map(([k, q]) => rows(q.sql, k).then(r => [k, r, null], e => [k, null, e])));
  for (const [k, r, e] of got) {
    const q = src[k];
    if (e) {
      if (q.need) throw e;
      L.warn[k] = e.message.slice(0, 160); L.raw[k] = L.raw[k] || []; L.sql[k] = q.sql;   // tried again at the next full read
      continue;
    }
    delete L.warn[k]; L.raw[k] = r; L.sql[k] = q.sql; q.tables.forEach(t => L.read.add(t));
  }
  if (sums) L.sums = sums; else if (full) L.sums = null;
  if (full) L.full = Date.now();
  V = view(); L.rev++; L.at = Date.now();
}
async function tick() {
  if (L.busy) return;
  L.busy = true;
  try { await round(); if (!L.ok) console.log(`Service floor: the billing's job cards are read (${(L.raw.jc || []).length} job cards)`); L.ok = true; L.err = ''; }
  catch (e) { if (L.ok || L.err !== e.message) console.error('Service floor, billing database:', e.message); L.ok = false; L.err = e.message.slice(0, 200); L.at = Date.now(); }
  finally { L.busy = false; keep(); }
}
// how the last read went, for update.sh (settings key billing_last); written when it changes, else once a minute
let kept = '', keptAt = 0;
function keep() {
  const v = { at: new Date(L.at || Date.now()).toISOString(), ok: L.ok, fast: L.fast, every: EVERY / 1000, check: L.check, cards: (L.raw.jc || []).length,
    bookings: (L.raw.bk || []).length, ...(L.err ? { err: L.err } : {}), ...(L.sumErr ? { sumErr: L.sumErr } : {}),
    ...(Object.keys(L.warn).length ? { warn: Object.entries(L.warn).map(([k, w]) => `${k}: ${w}`).join(' | ').slice(0, 300) } : {}) };
  const t = JSON.stringify({ ...v, at: '' });
  if (t === kept && Date.now() - keptAt < 60000) return;
  kept = t; keptAt = Date.now();
  try { db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'billing_last', JSON.stringify(v)); }
  catch (e) { console.error('Service floor, settings:', e.message); }
}
function start() {
  if (!on()) return [];
  L.on = true;
  tick();
  return [setInterval(tick, EVERY)];
}

// ---------------- the pages' data ---------------------------------------------------------------------------------------------
const STAGE = { p: 'Pending approval', o: 'Ongoing', c: 'Completed', n: 'Not approved', x: 'Other status' };
function view() {
  const R = L.raw, now = C.now(), today = C.ymd(now);
  const mech = new Map((R.mech || []).map(m => [String(m.id), m]));
  const bays = new Map((R.bay || []).map(b => [String(b.id), b]));
  const advs = new Map((R.adv || []).map(a => [String(a.id), a]));
  // the bill of a job card: the billing's own link (service_invoice) or invoice.job_card_id; the newest bill shows
  const invById = new Map((R.inv || []).map(v => [String(v.id), v]));
  const billOf = new Map();
  const addBill = (jc, v) => { const k = String(num(jc)); if (k === '0' || !v) return; const b = billOf.get(k); if (!b || num(v.id) > num(b.id)) billOf.set(k, v); };
  for (const v of R.inv || []) addBill(v.jc, v);
  for (const x of R.si || []) addBill(x.jc, invById.get(String(x.i)));
  // the latest parts request of a job card (returns left out by MySQL), as on the old job card list
  const items = group(R.pri, 'rid'), prOf = new Map();
  for (const p of R.pr || []) {
    const k = String(num(p.jc)), b = prOf.get(k);
    if (!b || String(p.at) > String(b.at) || (String(p.at) === String(b.at) && num(p.id) > num(b.id))) prOf.set(k, p);
  }
  const clOf = new Map();
  for (const x of R.cl || []) {
    const k = String(num(x.jc)), c = clOf.get(k) || { done: 0, nd: 0, pend: 0 }, st = s(x.st).toLowerCase();
    c[st === 'done' ? 'done' : st === 'not_done' ? 'nd' : 'pend'] += num(x.n); clOf.set(k, c);
  }
  const qcOf = new Map();
  for (const x of R.qc || []) { const k = String(num(x.jc)), b = qcOf.get(k); if (!b || num(x.lv) > num(b.lv) || (num(x.lv) === num(b.lv) && String(x.at) >= String(b.at))) qcOf.set(k, x); }

  const cards = [];
  for (const j of R.jc || []) {
    const id = num(j.id); if (!id) continue;
    const m = mech.get(String(j.mech)), b = bays.get(String(j.bay)), a = advs.get(String(j.by)), k = String(id);
    const bill = billOf.get(k), pr = prOf.get(k), cl = clOf.get(k), qc = qcOf.get(k);
    const c = { id, p: plate(j.p), mk: s(j.mk, 40), mo: s(j.mo, 60), n: s(j.n, 80), ph: s(j.ph, 20), svc: s(j.svc, 200), pkg: s(j.pkg, 12),
      est: num(j.est), km: s(j.km, 12), st: up(j.st), ap: up(j.ap), tab: STAGE[j.tab] ? j.tab : 'x', td: num(j.td) === 1,
      at: when(j.at), go: when(j.go), done: when(j.done), due: when(j.due),
      mech: m ? s(m.n, 60) : (num(j.mech) ? `Mechanic ${num(j.mech)}` : ''), mid: num(j.mech) || 0,
      bay: b ? s(b.n, 30) : (num(j.bay) ? `Bay ${num(j.bay)}` : ''),
      by: s(j.byn, 40) || (a ? s(a.n, 40) : ''), bid: num(j.by) || 0, free: num(j.free) === 1 };
    if (bill) c.bill = { no: s(bill.no, 30), st: up(bill.st) };
    if (pr) {
      // as job-cards.php: nobody attended yet = status exactly 'pending'; a part being checked = item_status exactly 'checking'
      // with checking_started_at set
      const its = items.get(String(pr.id)) || [], cnt = {};
      for (const i of its) { const st = s(i.st, 16).toLowerCase() || 'pending'; cnt[st] = (cnt[st] || 0) + 1; }
      const chk = its.filter(i => i.st === 'checking' && i.cs !== null && i.cs !== undefined && i.cs !== '' && i.cs !== '0').length;
      c.pr = { st: s(pr.st, 16).toLowerCase(), wait: pr.st === 'pending', chk, at: when(pr.at), n: its.length, cnt };
    }
    if (cl) c.cl = cl;
    if (qc) c.qc = { lv: num(qc.lv), st: s(qc.st, 16).toLowerCase() };
    cards.push(c);
  }
  cards.sort((a, b) => b.id - a.id);
  const tabs = { p: 0, o: 0, c: 0, n: 0, x: 0 };
  for (const c of cards) tabs[c.tab]++;

  const bookings = (R.bk || []).map(b => {
    const abId = num(b.ab), join = advs.get(String(abId));
    // as online-bookings.php: attended_by_name, else the advisor's name by attended_by (an empty name stays empty)
    const abn = b.abn !== null && b.abn !== undefined ? s(b.abn, 40) : join ? s(join.n, 40) : '';
    const lat = s(b.lat, 24), lng = s(b.lng, 24), loc = lat !== '' && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    return { id: num(b.id), n: s(b.n, 80), ph: s(b.ph, 20), type: s(b.type, 60), pick: s(b.pick, 20), addr: s(b.addr, 200), bike: s(b.bike, 120),
      note: s(b.note, 300), at: when(b.at), sched: dayOf(b.sched), f: s(b.f, 12), ab: abId > 0 && abn ? abn : '', aat: abId > 0 && abn ? when(b.aat) : '',
      ...(loc ? { lat: Number(lat), lng: Number(lng) } : {}) };
  }).sort((a, b) => b.id - a.id);
  const bk = { all: bookings.length, pending: 0, confirmed: 0, converted: 0, cancelled: 0, today: 0, sched: 0 };
  for (const b of bookings) { if (bk[b.f] !== undefined) bk[b.f]++; if (b.at.slice(0, 10) === today) bk.today++; if (b.sched === today) bk.sched++; }

  const rem = {};
  for (const r of R.rem || []) rem[String(num(r.a))] = num(r.n);
  const mechs = (R.mech || []).map(m => ({ id: num(m.id), n: s(m.n, 60), st: up(m.st) })).sort((a, b) => a.n.localeCompare(b.n));
  const advisors = (R.adv || []).map(a => ({ id: num(a.id), n: s(a.n, 60), active: up(a.st) !== 'INACTIVE' }));
  return { at: Date.now(), today, cards, tabs, bookings, bk, rem, quotes: num(((R.quo || [])[0] || {}).n), mechs, advisors,
    has: { bk: !L.warn.bk && !!R.bk, pr: !L.warn.pr && !!R.pr, cl: !L.warn.cl && !!R.cl, qc: !L.warn.qc && !!R.qc, rem: !L.warn.rem && !!R.rem, bill: !L.warn.inv && !!R.inv } };
}

// the login's advisor row of the old app: the same mobile number, else the same name
function advisorOf(user) {
  if (!V || !user) return null;
  const ph = digits(user.phone), nk = nameKey(user.name);
  const list = (L.raw.adv || []).map(a => ({ id: num(a.id), n: s(a.n, 60), ph: digits(a.ph), k: nameKey(a.n) }));
  // the name first (two advisors of the billing can have the same phone), the phone only when one advisor has it
  const byPh = ph.length === 10 ? list.filter(x => x.ph === ph) : [];
  const a = (nk && list.find(x => x.k === nk)) || (byPh.length === 1 ? byPh[0] : null);
  return a ? { id: a.id, name: a.n } : null;
}
const status = () => ({ on: L.on, ok: L.ok, err: L.err, at: L.at ? new Date(L.at).toISOString() : '', fast: L.fast, warn: Object.keys(L.warn) });
const CARD_KEYS = ['id', 'p', 'mk', 'mo', 'n', 'ph', 'svc', 'pkg', 'est', 'km', 'st', 'ap', 'tab', 'td', 'at', 'go', 'done', 'due', 'mech', 'mid', 'bay', 'by', 'bid', 'free', 'bill', 'pr', 'cl', 'qc'];

// GET /api/live: the counts of every tab and page, the open job cards (pending, ongoing, other status), today's and the last
// 3 days' finished ones, the bookings and the mechanics
function live(user, rev) {
  if (!V) return { rev: revOf(), link: status(), ready: false };
  if (String(rev || '') === revOf()) return { rev: revOf(), same: true, link: status(), now: C.stamp(C.now()) };
  const since = C.ymd(C.addDays(C.now(), -3)), me = advisorOf(user), month = V.today.slice(0, 7);
  const paused = c => c.tab === 'c' && c.st === 'STREAM_STOPPED';
  const cards = V.cards.filter(c => c.tab === 'p' || c.tab === 'o' || c.tab === 'x' || paused(c) || c.td || c.at.slice(0, 10) >= since || c.done.slice(0, 10) >= since);
  const today = V.cards.filter(c => c.td);
  const doneToday = V.cards.filter(c => c.done.slice(0, 10) === V.today);
  const byAdv = {};
  for (const c of today) { const k = c.by || 'Not named'; byAdv[k] = (byAdv[k] || 0) + 1; }
  // each mechanic: the job cards he has now (Ongoing), completed today and this month, paused
  const ms = new Map(V.mechs.map(m => [m.id, { id: m.id, n: m.n, st: m.st, now: [], today: 0, month: 0, paused: 0 }]));
  for (const c of V.cards) {
    const m = ms.get(c.mid); if (!m) continue;
    if (c.tab === 'o') m.now.push({ id: c.id, p: c.p, mo: c.mo, go: c.go, at: c.at, due: c.due, bay: c.bay });
    if (c.tab === 'c' && !paused(c) && c.done) { if (c.done.slice(0, 10) === V.today) m.today++; if (c.done.slice(0, 7) === month) m.month++; }
    if (paused(c)) m.paused++;
  }
  return { rev: revOf(), link: status(), ready: true, today: V.today, now: C.stamp(C.now()), me, mstats: [...ms.values()],
    counts: { tabs: V.tabs, all: V.cards.length, made: today.length, mine: me ? today.filter(c => c.bid === me.id).length : 0, byAdv,
      todayTabs: { p: today.filter(c => c.tab === 'p').length, o: today.filter(c => c.tab === 'o').length, c: today.filter(c => c.tab === 'c').length, n: today.filter(c => c.tab === 'n').length },
      doneToday: doneToday.filter(c => c.tab === 'c' && !paused(c)).length, naToday: doneToday.filter(c => c.tab === 'n').length,
      paused: V.cards.filter(paused).length,
      bk: V.bk, quotes: V.quotes, rem: { mine: me ? V.rem[String(me.id)] || 0 : 0, all: Object.values(V.rem).reduce((a, n) => a + n, 0) } },
    cards, bookings: V.bookings.slice(0, 300), mechs: V.mechs, advisors: V.advisors, has: V.has };
}

// GET /api/live/list: one tab (or every job card), searched like the old app (vehicle number, name or phone), newest first,
// 100 at a time (before = the last id shown)
// age: '' (all), 'today', 'week' (the last 7 days, today too), 'old' (before that), by the day the job card was made
function list({ tab = 'all', q = '', mine = false, age = '', before = 0, n = 100 } = {}, user) {
  if (!V) return { rev: revOf(), ready: false, cards: [], total: 0, more: false };
  const me = mine ? advisorOf(user) : null;
  // like the old app's LIKE '%...%' on the vehicle number, name and phone; a plate also without its spaces, a job card by
  // number, the make and model (3 letters or more)
  const w = String(q).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40), wk = regKey(w).toLowerCase(), wd = w.replace(/\D/g, '');
  const jcNo = (w.match(/^(?:jc)?\s*#?\s*(\d{1,7})$/) || [])[1];
  const hit = c => !w || c.p.toLowerCase().includes(w) || (wk.length >= 2 && regKey(c.p).toLowerCase().includes(wk)) || c.n.toLowerCase().includes(w) ||
    (wd.length >= 3 && c.ph.replace(/\D/g, '').includes(wd)) || (!!jcNo && String(c.id) === jcNo) || (w.length >= 3 && `${c.mk} ${c.mo}`.toLowerCase().includes(w));
  const week = C.ymd(C.addDays(C.now(), -6));
  const ageOf = c => (c.td ? 'today' : (c.at.slice(0, 10) || '0000') >= week ? 'week' : 'old');
  const ages = { today: 0, week: 0, old: 0 };
  const base = V.cards.filter(c => (tab === 'all' || c.tab === tab) && (!mine || (me && c.bid === me.id)) && hit(c));
  for (const c of base) { const a = ageOf(c); ages[a]++; if (a === 'today') ages.week++; }
  const all = !age ? base : base.filter(c => { const a = ageOf(c); return age === 'week' ? a !== 'old' : a === age; });
  const from = before ? all.findIndex(c => c.id < before) : 0;
  const page = from < 0 ? [] : all.slice(from, from + Math.min(200, Math.max(1, n)));
  const counts = { p: 0, o: 0, c: 0, n: 0, x: 0 };
  for (const c of V.cards) if ((!mine || (me && c.bid === me.id)) && hit(c)) counts[c.tab]++;
  return { rev: revOf(), ready: true, total: all.length, counts, ages, cards: page, more: from >= 0 && from + page.length < all.length, mine: !!me };
}

// GET /api/live/jc/:id: one job card, every part of it (asked when it is opened; kept 3 seconds)
const cache = new Map();
async function card(id) {
  id = Math.floor(Number(id));
  if (!(id > 0)) throw Object.assign(new Error('Job card number is not right.'), { status: 400 });
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 3000 && hit.rev === L.rev) return hit.v;
  const soft = (sql, what) => rows(sql, what).catch(e => ({ err: e.message.slice(0, 160) }));
  const [jr] = await rows(`SELECT ${J({ id: 'id', p: sub('vehicle_number', 24), mk: sub('make', 40), mo: sub('model', 60), n: sub('name', 80),
    ph: sub('phone', 20), svc: sub('service_type', 600), pkg: sub('service_package', 12), est: sub('estimated_cost', 14), pe: sub('parts_estimate', 14),
    km: sub('odo_reading', 12), avg: sub('daily_km_avg', 12), fuel: sub('fuel_level', 12), fl: sub('fuel_label', 30), last: sub('last_service_date', 30),
    issue: sub('issue_text', 2000), rep: sub('issue_reported', 4000), cp: 'checkpoint_status', gs: 'general_service_checklist', st: sub('status', 24),
    ap: sub('approval', 16), at: sub('created_at', 30), done: sub('completed_at', 30), go: sub('mechanic_assigned_at', 30), ini: sub('initiated_at', 30),
    due: sub('delivery_time', 30), slot: sub('slot', 12), mech: 'mechanic_id', bay: 'bay_id', by: 'created_by', byn: sub('created_by_name', 40),
    free: 'is_free_service_claim', tab: TAB })} FROM \`job_card\` WHERE id = ${id}`, 'job card');
  if (!jr) throw Object.assign(new Error(`Job card ${id} is not in the billing.`), { status: 404 });
  // the quotation of this vehicle as the old page finds it (the number upper case, spaces at the ends cut); bills: the job card's
  // own and those the billing links to it (service_invoice)
  const raw = String(jr.p ?? '').trim().toUpperCase(), reg = /^[A-Z0-9 -]{1,24}$/.test(raw) ? raw : '';
  const linked = (L.raw.si || []).filter(x => num(x.jc) === id).map(x => Math.floor(num(x.i))).filter(n => n > 0);
  const [lab, chk, bills, parts, preq, pitems, qcs, quotes] = await Promise.all([
    soft(`SELECT ${J({ id: 'id', n: sub('labour_name', 300), a: 'labour_price', cc: sub('cc_type', 12), cu: 'is_custom' })} FROM \`job_labour_items\` WHERE job_card_id = ${id} ORDER BY id`, 'labour'),
    soft(`SELECT ${J({ id: 'id', item: sub('item', 300), st: sub('status', 16), why: sub('reason', 300), at: sub('updated_at', 30) })} FROM \`job_card_checklist\` WHERE job_card_id = ${id} ORDER BY id`, 'checklist'),
    soft(`SELECT ${J({ id: 'id', no: sub('invoice_no', 30), st: sub('payment_status', 16), d: sub('date', 20), t: sub('time', 20), by: sub('created_by_name', 40) })} ` +
      `FROM \`invoice\` WHERE job_card_id = ${id}${linked.length ? ` OR id IN (${linked.join(', ')})` : ''} ORDER BY id DESC`, 'bills'),
    soft(`SELECT ${J({ id: 'ii.id', n: "COALESCE(p.name, 'Item')", pn: "COALESCE(p.serial_no, '-')", br: "COALESCE(p.brand, '—')", q: 'ii.qty', g: 'ii.goods_price',
      a: 'ROUND(ii.goods_price * ii.qty * (1 - COALESCE(NULLIF(ii.discount_percent, 0), p.discount_to_user, 0) / 100), 2)' })} ` +
      `FROM \`invoice_items\` ii LEFT JOIN \`cms_products\` p ON p.id = ii.product_id WHERE ii.invoice_id = (SELECT id FROM \`invoice\` WHERE job_card_id = ${id} ORDER BY id DESC LIMIT 1) ORDER BY ii.id`, 'parts'),
    soft(`SELECT ${J({ id: 'id', st: sub('status', 16), at: sub('pushed_at', 30), att: sub('attended_at', 30), by: sub('attended_by', 40), type: sub('request_type', 16),
      miss: 'is_missed', prod: sub('products', 1000) })} FROM \`service_parts_request\` WHERE job_card_id = ${id} AND request_type != 'return' ORDER BY pushed_at DESC, id DESC`, 'parts requests'),
    soft(`SELECT ${J({ id: 'id', rid: 'request_id', n: sub('product_name', 200), st: sub('item_status', 16), cs: sub('checking_started_at', 30), lbl: sub('arranging_label', 40),
      until: sub('arranging_until', 30), res: sub('resolved_at', 30), by: sub('updated_by', 40) })} FROM \`service_parts_request_items\` ` +
      `WHERE request_id IN (SELECT id FROM \`service_parts_request\` WHERE job_card_id = ${id} AND request_type != 'return') ORDER BY id`, 'parts request items'),
    soft(`SELECT ${J({ lv: 'level', st: sub('status', 16), by: sub('checked_by', 40), at: sub('checked_at', 30), notes: sub('notes', 300) })} FROM \`job_card_qc\` WHERE job_card_id = ${id} ORDER BY id`, 'QC'),
    reg ? soft(`SELECT ${J({ id: 'id', at: sub('created_at', 30), st: sub('status', 16) })} FROM \`quotations\` WHERE vehicle_number = '${reg}' ORDER BY id DESC LIMIT 3`, 'quotations') : [],
  ]);
  const list = v => (Array.isArray(v) ? v : []);
  const m = (L.raw.mech || []).find(x => num(x.id) === num(jr.mech)), b = (L.raw.bay || []).find(x => num(x.id) === num(jr.bay)),
    a = (L.raw.adv || []).find(x => num(x.id) === num(jr.by));
  // inspection points (the mechanic marks them in his app) and the general service items asked for
  let points = null, gsl = [];
  try { const o = JSON.parse(jr.cp || 'null'); if (o && typeof o === 'object' && !Array.isArray(o)) { points = {}; for (const v of Object.values(o)) { const st = s(v && v.status, 20) || 'not_checked'; points[st] = (points[st] || 0) + 1; } } } catch { /* not JSON */ }
  try { const o = JSON.parse(jr.gs || 'null'); if (o && typeof o === 'object' && !Array.isArray(o)) gsl = Object.entries(o).slice(0, 40).map(([k, v]) => [s(k, 60), !!(v && v.checked), s(v && v.answer, 20)]); } catch { /* not JSON */ }
  const its = group(list(pitems), 'rid');
  const labour = list(lab).map(x => ({ n: s(x.n, 300), a: num(x.a), cc: s(x.cc, 12), cu: num(x.cu) === 1 }));
  const partRows = list(parts).map(x => ({ n: s(x.n, 160), pn: s(x.pn, 60), br: s(x.br, 60), q: num(x.q), a: r2(num(x.a)) }));
  const v = {
    rev: revOf(),
    jc: { id, p: plate(jr.p), mk: s(jr.mk, 40), mo: s(jr.mo, 60), n: s(jr.n, 80), ph: s(jr.ph, 20), svc: s(jr.svc, 600), pkg: s(jr.pkg, 12),
      est: num(jr.est), pe: num(jr.pe), km: s(jr.km, 12), avg: s(jr.avg, 12), fuel: s(jr.fuel, 12), fl: s(jr.fl, 30), last: s(jr.last, 30),
      issue: String(jr.issue ?? '').trim().slice(0, 2000), st: up(jr.st), ap: up(jr.ap), tab: STAGE[jr.tab] ? jr.tab : 'x',
      at: when(jr.at), done: when(jr.done), go: when(jr.go), ini: when(jr.ini), due: when(jr.due), slot: s(jr.slot, 12),
      mech: m ? s(m.n, 60) : (num(jr.mech) ? `Mechanic ${num(jr.mech)}` : ''), bay: b ? s(b.n, 30) : (num(jr.bay) ? `Bay ${num(jr.bay)}` : ''),
      by: s(jr.byn, 40) || (a ? s(a.n, 40) : ''), free: num(jr.free) === 1 },
    points, gs: gsl,
    labour, labourTotal: r2(labour.reduce((t, x) => t + x.a, 0)),
    checklist: Array.isArray(chk) ? chk.map(x => ({ item: s(x.item, 300), st: s(x.st, 16).toLowerCase() || 'pending', why: s(x.why, 300), at: when(x.at) })) : null,
    parts: Array.isArray(parts) ? partRows : null, partsTotal: r2(partRows.reduce((t, x) => t + x.a, 0)),
    bills: list(bills).map(x => ({ no: s(x.no, 30), st: up(x.st), d: s(x.d, 20), t: s(x.t, 20), by: s(x.by, 40).replace(/\s+-\s+.*$/, '') })),
    requests: Array.isArray(preq) ? preq.map(r => {
      let names = []; try { const pj = JSON.parse(r.prod); if (Array.isArray(pj)) names = pj.map(x => s(typeof x === 'string' ? x : x && (x.name || x.product_name), 120)).filter(Boolean); } catch { /* plain text */ }
      if (!names.length && r.prod) names = [s(r.prod, 200)];
      return { id: num(r.id), st: s(r.st, 16).toLowerCase(), at: when(r.at), att: when(r.att), by: s(r.by, 40), miss: num(r.miss) === 1, names,
        items: (its.get(String(r.id)) || []).map(i => ({ n: s(i.n, 200), st: s(i.st, 16).toLowerCase() || 'pending', cs: when(i.cs), lbl: s(i.lbl, 40), until: when(i.until), res: when(i.res), by: s(i.by, 40) })) };
    }) : null,
    qc: Array.isArray(qcs) ? qcs.map(x => ({ lv: num(x.lv), st: s(x.st, 16).toLowerCase(), by: s(x.by, 40), at: when(x.at), notes: s(x.notes, 300) })) : null,
    quotes: list(quotes).map(x => ({ id: num(x.id), at: when(x.at), st: up(x.st) })),
  };
  cache.set(id, { at: Date.now(), rev: L.rev, v });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return v;
}

module.exports = { on, start, live, list, card, status, tick, when, view: () => V, CARD_KEYS };
