// Vehicle number (Sam 27 Nov, "VR Garage in job card + billing counter"): a registration number gives the chassis, model,
// engine number and owner from VR Garage; staff can change the customer name and the model. Every number is asked ONLY
// ONCE: VR Garage's answer is kept in this database for ever (a search costs money). The billing's job cards are read here
// (read only) every few seconds: a number on an old job card shows its visits at once, and the vehicle of every NEW job
// card is asked by itself, once. Nothing is ever written to the billing.
//   .env  VRGARAGE_EMAIL + VRGARAGE_PASS64 (base64 of the password): typed on the server with  bash /root/bs-erp-update.sh vrgarage
//         VRGARAGE_URL (default https://vr-api.vecrep.com/fetch-vehicle), VR_MAX_DAY (searches a day, 300), VR_MAX_PERSON_DAY (60)
//         the billing: OLD_DB_HOST/PORT/USER/PASS/BS, OLD_DB_PUBKEY, MYSQL_BIN (update.sh copies them from the admin panel's .env);
//         GAADI_LIVE=0 = no billing read
// VR Garage API (as Bike Pharma's lib/rclook.mjs, Sam's vrgarage-lookup zip of 24 Oct): POST <base>/garageLogin
// {email, password, ...} -> {token}; POST <base>/fetch-vehicle {vehicleNumber} with Bearer <token> -> {responseCode, result}.
'use strict';
const { execFile } = require('node:child_process');

const env = k => String(process.env[k] || '').trim();
const now = () => new Date().toISOString();
const IST = 5.5 * 3600e3;
const istDay = (ms = Date.now()) => new Date(ms + IST).toISOString().slice(0, 10);   // YYYY-MM-DD in India
let db = null;
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const kvGet = k => { const r = one('SELECT v FROM kv WHERE k = ?', k); return r ? r.v : null; };
const kvSet = (k, v) => run('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));

// ---------------- numbers ------------------------------------------------------------------------------------------------
const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
// state + district + series + number (KA17AB1234), or the Bharat series (22BH1234AA)
// (6 signs at least: "KA17" is a number typed half, and a search costs money)
const isReg = s => s.length >= 6 && (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(s) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(s));
const showReg = r => { const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(r); return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : r; };

// ---------------- VR Garage's answer -> our fields (the same names Bike Pharma's lookup reads) -----------------------------
// the providers name the same thing differently: the first key found (any depth, any case) wins
function pick(o, names) {
  const want = names.map(n => n.toLowerCase());
  const seen = new Set(), st = [o];
  while (st.length) {
    const x = st.shift();
    if (!x || typeof x !== 'object' || seen.has(x)) continue; seen.add(x);
    for (const [k, v] of Object.entries(x)) if (want.includes(k.toLowerCase()) && v != null && typeof v !== 'object' && String(v).trim()) return String(v).trim().slice(0, 160);
    for (const v of Object.values(x)) if (v && typeof v === 'object') st.push(v);
  }
  return '';
}
function rcMap(j) {
  const g = (...n) => pick(j, n);
  const mfg = g('manufacturing_date_formatted', 'manufacturing_date', 'mfg_date', 'vehicle_manufacturing_month_year', 'month_year_of_mfg', 'manufacturingDate', 'mfgDate', 'manufacturingMonthYear', 'manufacturingYear');
  const year = (/(19|20)\d{2}/.exec(mfg) || [])[0] || '';
  return {
    owner: g('owner_name', 'owner', 'ownerName', 'owner_name_masked'),
    maker: g('maker_description', 'maker', 'manufacturer', 'vehicle_manufacturer_name', 'makerDescription', 'makerName', 'vehicleMaker', 'manufacturerName'),
    model: g('maker_model', 'model', 'vehicle_model', 'makerModel', 'vehicleModel', 'modelName'),
    mfg, year,
    regDate: g('registration_date', 'reg_date', 'regDate', 'registrationDate'),
    fuel: g('fuel_type', 'fuel', 'fuelType', 'fuelDescription'),
    colour: g('color', 'colour', 'vehicle_colour', 'vehicle_color', 'vehicleColour', 'vehicleColor', 'colorName'),
    chassis: g('vehicle_chasi_number', 'vehicle_chassis_number', 'chassis_number', 'chassis', 'chasi_no', 'chassisNumber', 'chassisNo', 'chasisNo', 'chassis_no', 'vin', 'vinNumber', 'frameNumber'),
    engine: g('vehicle_engine_number', 'engine_number', 'engine', 'engine_no', 'engineNumber', 'engineNo'),
    cc: g('cubic_capacity', 'vehicle_cubic_capacity', 'cc', 'cubicCapacity', 'engineCapacity'),
    category: g('vehicle_category_description', 'vehicle_category', 'vehicle_class', 'class', 'vehicleClass', 'vehicleCategory', 'vehicleClassDescription'),
    insurer: g('insurance_company', 'insurer', 'insurance_company_name', 'insuranceCompany', 'insuranceCompanyName'),
    insUpto: g('insurance_upto', 'insurance_valid_upto', 'insurance_expiry', 'insuranceUpto', 'insuranceValidUpto', 'insuranceExpiryDate'),
    pucUpto: g('pucc_upto', 'puc_upto', 'puc_valid_upto', 'puccUpto', 'pucUpto', 'pucValidUpto'),
    status: g('rc_status', 'status_as_on', 'vehicle_status', 'rcStatus', 'vehicleStatus'),
  };
}
const readable = d => !!(d && (d.maker || d.model || d.chassis));
// how many plain values an answer has (an empty "result" = VR Garage has nothing for this number)
function values(o, n = 0, seen = new Set()) {
  if (!o || typeof o !== 'object' || seen.has(o)) return n; seen.add(o);
  for (const v of Object.values(o)) n = v && typeof v === 'object' ? values(v, n, seen) : v != null && String(v).trim() ? n + 1 : n;
  return n;
}
// the names of the fields VR Garage sent (never their values): shown to the owner when an answer could not be read
function keyNames(o, out = new Set(), seen = new Set()) {
  if (!o || typeof o !== 'object' || seen.has(o) || out.size > 60) return out; seen.add(o);
  for (const [k, v] of Object.entries(o)) { if (!/^\d+$/.test(k)) out.add(k); if (v && typeof v === 'object') keyNames(v, out, seen); }
  return out;
}

// ---------------- VR Garage ------------------------------------------------------------------------------------------------
const VR = { tok: '', busy: new Map(), err: '', errAt: 0 };
const vrUrl = () => env('VRGARAGE_URL') || 'https://vr-api.vecrep.com/fetch-vehicle';
const vrPass = () => { const b = env('VRGARAGE_PASS64'); if (b) return Buffer.from(b, 'base64').toString('utf8'); return String(process.env.VRGARAGE_PASSWORD || ''); };
const vrOn = () => !!env('VRGARAGE_EMAIL') && !!vrPass();
async function post(url, body, headers = {}, ms = 20000) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Custom-Header': 'foobar', ...headers },
      body: JSON.stringify(body) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* not JSON */ }
    return { r, j };
  } finally { clearTimeout(to); }
}
const reach = e => (e && e.name === 'AbortError' ? 'VR Garage did not answer in 20 seconds' : `VR Garage could not be reached from this server (${(e && e.cause && (e.cause.code || e.cause.message)) || (e && e.message) || 'network'})`);
async function vrLogin(email = env('VRGARAGE_EMAIL'), pass = vrPass()) {
  const u = new URL('garageLogin', vrUrl().replace(/[^/]*$/, ''));
  const { r, j } = await post(u, { email, password: pass, deviceToken: 'bikesurgeon', deviceId: 'bikesurgeon-erp', deviceName: 'web', ipAddress: '0.0.0.0', device: 'web' });
  return { tok: j ? pick(j, ['token', 'accessToken', 'access_token']) : '', status: r.status, code: j && j.responseCode, msg: j && j.message ? String(j.message).slice(0, 120) : '' };
}
// update.sh vrgarage: is this login (the mobile number or email of VR Garage's email box) + password right? (a login only,
// no search: nothing is paid) -> 'ok' or why not
async function loginTest(email, pass) {
  try {
    const x = await vrLogin(String(email || '').trim(), String(pass || ''));
    if (x.tok) return 'ok';
    return `VR Garage did not accept this login and password (answer ${x.status}${x.code != null ? ', code ' + x.code : ''}${x.msg ? ': ' + x.msg : ''})`;
  } catch (e) { return reach(e); }
}
// one search (it costs money): {state: found | notfound | unread | error, d, raw, msg}
async function ask(reg) {
  const askWith = async tok => {
    const { r, j } = await post(vrUrl(), { vehicleNumber: reg }, { Authorization: 'Bearer ' + String(tok).replace(/^Bearer\s+/i, '') });
    return { r, j, no: r.status === 401 || r.status === 403 || (j && [401, 403].includes(+j.responseCode)) };
  };
  if (!VR.tok) VR.tok = (await vrLogin()).tok;
  if (!VR.tok) return { state: 'error', msg: 'VR Garage did not accept the login: type it again on the server (bash /root/bs-erp-update.sh vrgarage)' };
  let x = await askWith(VR.tok);
  if (x.no) { VR.tok = (await vrLogin()).tok; if (VR.tok) x = await askWith(VR.tok); }
  if (x.no) { VR.tok = ''; return { state: 'error', msg: 'VR Garage did not let us in: check the login (bash /root/bs-erp-update.sh vrgarage) or the credits' }; }
  const { r, j } = x;
  if (r.ok && j && j.responseCode != null && +j.responseCode !== 200) {
    const m = String(j.message || '').slice(0, 120);
    return /not ?found|no record|invalid|does not exist/i.test(m) ? { state: 'notfound', raw: j } : { state: 'error', msg: 'VR Garage: ' + (m || 'no data, try again later') };
  }
  if (r.status === 404 || r.status === 422) return { state: 'notfound', raw: j };
  if (!r.ok) return { state: 'error', msg: 'VR Garage answered ' + r.status };
  const d = rcMap(j || {});
  if (readable(d)) return { state: 'found', d, raw: j };
  return values(j && j.result !== undefined ? j.result : j) ? { state: 'unread', raw: j } : { state: 'notfound', raw: j };
}
const PAID = "result IN ('found', 'notfound', 'unread')";
const dayFrom = () => new Date(Date.parse(istDay() + 'T00:00:00Z') - IST).toISOString();
const monthFrom = () => new Date(Date.parse(istDay().slice(0, 8) + '01T00:00:00Z') - IST).toISOString();
const usedToday = who => one(`SELECT count(*) n FROM vr_calls WHERE at >= ?${who ? " AND who = ? AND kind = 'manual'" : ''}`, dayFrom(), ...(who ? [who] : [])).n;
const MAXDAY = () => Number(env('VR_MAX_DAY')) || 300, MAXPERSON = () => Number(env('VR_MAX_PERSON_DAY')) || 60;
function save(reg, res, who) {
  const d = JSON.stringify(res.d || {}), raw = res.raw ? JSON.stringify(res.raw).slice(0, 30000) : null;
  const found = res.state === 'found' ? 1 : res.state === 'unread' ? 2 : 0;
  if (one('SELECT 1 FROM vehicles WHERE reg = ?', reg)) run('UPDATE vehicles SET found = ?, d = ?, raw = ?, asked_at = ?, asked_by = ? WHERE reg = ?', found, d, raw, now(), who, reg);
  else run('INSERT INTO vehicles (reg, found, d, raw, asked_at, asked_by) VALUES (?,?,?,?,?,?)', reg, found, d, raw, now(), who);
}
// ask VR Garage for one number (one at a time per number), keep the answer; kind: auto (new job card), manual (the page), again (owner)
function lookup(reg, who, kind) {
  if (VR.busy.has(reg)) return VR.busy.get(reg);
  const p = (async () => {
    if (!vrOn()) return { state: 'off' };
    if (usedToday() >= MAXDAY()) return { state: 'cap', msg: `Today's ${MAXDAY()} VR Garage searches are used up. It opens again tomorrow.` };
    if (kind === 'manual' && usedToday(who) >= MAXPERSON()) return { state: 'cap', msg: `You asked VR Garage ${MAXPERSON()} times today. Ask the owner, or try tomorrow.` };
    const t0 = Date.now(); let res;
    try { res = await ask(reg); } catch (e) { res = { state: 'error', msg: reach(e) }; }
    run('INSERT INTO vr_calls (at, reg, who, kind, result, ms, note) VALUES (?,?,?,?,?,?,?)', now(), reg, String(who).slice(0, 80), kind, res.state, Date.now() - t0, String(res.msg || '').slice(0, 200));
    if (res.state === 'error') { VR.err = res.msg; VR.errAt = Date.now(); console.log('vehicle number:', res.msg); }
    else { VR.err = ''; save(reg, res, String(who).slice(0, 80)); }
    return res;
  })().finally(() => VR.busy.delete(reg));
  VR.busy.set(reg, p);
  return p;
}
// a later version reads more of VR Garage's field names: answers kept from before are read again (no new search)
function remap() {
  for (const v of all('SELECT reg, found, d, raw FROM vehicles WHERE raw IS NOT NULL AND found IN (1, 2)')) {
    let j; try { j = JSON.parse(v.raw); } catch { continue; }
    const d = rcMap(j), s = JSON.stringify(d);
    if (readable(d) && (v.found !== 1 || s !== v.d)) run('UPDATE vehicles SET found = 1, d = ? WHERE reg = ?', s, v.reg);
  }
}

// ---------------- the billing's job cards (read only) -------------------------------------------------------------------
const L = { on: false, ok: false, at: 0, err: '', cards: new Map(), byReg: new Map(), maxId: 0, fullAt: 0, busy: false, saved: 0, jcFrom: null };
const linkOn = () => env('GAADI_LIVE') !== '0' && !!env('OLD_DB_BS') && !!env('OLD_DB_USER');
function mysql(sql) {
  const args = ['-h', env('OLD_DB_HOST') || '127.0.0.1', '-P', env('OLD_DB_PORT') || '3306', '-u', env('OLD_DB_USER'), '--batch', '--raw',
    '--skip-column-names', '--default-character-set=utf8mb4',
    // MySQL 8 users (caching_sha2_password) without TLS need the server's key; OLD_DB_PUBKEY=0 for a MariaDB client
    ...(env('OLD_DB_PUBKEY') === '0' ? [] : ['--get-server-public-key']), env('OLD_DB_BS'), '-e', sql];
  // only what the mysql program needs (the front door's own keys stay here)
  const e = { PATH: process.env.PATH || '/usr/bin:/bin', HOME: process.env.HOME || '/tmp', LANG: process.env.LANG || 'C.UTF-8', MYSQL_PWD: process.env.OLD_DB_PASS || '' };
  for (const k of Object.keys(process.env)) if (/^(OLD_FIXTURE|FAKE_[A-Z_]+)$/.test(k)) e[k] = process.env[k];   // the sandbox's stand-in mysql
  return new Promise((resolve, reject) => execFile(env('MYSQL_BIN') || 'mysql', args, { env: e, maxBuffer: 64 * 1024 * 1024, timeout: 30000 },
    (err, out, errOut) => (err ? reject(new Error(String(errOut || err.message).replace(/\s+/g, ' ').trim().slice(0, 200))) : resolve(out))));
}
const JC = { id: 'id', p: 'SUBSTRING(vehicle_number, 1, 30)', mk: 'SUBSTRING(make, 1, 60)', mo: 'SUBSTRING(model, 1, 80)', n: 'SUBSTRING(name, 1, 80)',
  ph: 'SUBSTRING(phone, 1, 20)', dd: 'dd', mm: 'mm', yy: 'yy', at: 'SUBSTRING(created_at, 1, 40)', st: 'SUBSTRING(status, 1, 20)' };
const pad = n => String(n).padStart(2, '0');
// a job card's day: its dd/mm/yy columns, else created_at ("2026-11-24T10:20" or "24-11-2026 10:20:05 am")
function jcDay(j) {
  const d = parseInt(j.dd, 10), m = parseInt(j.mm, 10), y = parseInt(j.yy, 10);
  if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 2000) return `${y}-${pad(m)}-${pad(d)}`;
  const t = String(j.at || ''); let x;
  if ((x = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return `${x[1]}-${x[2]}-${x[3]}`;
  if ((x = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(t))) return `${x[3]}-${pad(x[2])}-${pad(x[1])}`;
  return '';
}
const digits10 = s => String(s || '').replace(/\D/g, '').slice(-10);
function index() {
  const by = new Map();
  for (const j of L.cards.values()) { const r = clean(j.p); if (!isReg(r)) continue; if (!by.has(r)) by.set(r, []); by.get(r).push(j.id); }
  for (const ids of by.values()) ids.sort((a, b) => b - a);
  L.byReg = by;
}
async function readCards(full) {
  if (L.busy) return; L.busy = true;
  const from = full ? 0 : L.maxId;
  try {
    const cols = Object.entries(JC).map(([k, c]) => `'${k}', ${c}`).join(', ');
    const out = await mysql(`SELECT JSON_OBJECT(${cols}) FROM \`job_card\`${from ? ` WHERE id > ${Math.floor(from)}` : ''}`);
    const got = full ? new Map() : L.cards; let n = 0;
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      let j; try { j = JSON.parse(line); } catch { continue; }
      const id = Number(j.id); if (!(id > 0) || (!full && id <= from)) continue;
      got.set(id, { id, p: String(j.p || '').trim(), mk: String(j.mk || '').trim(), mo: String(j.mo || '').trim(), n: String(j.n || '').trim(), ph: digits10(j.ph), day: jcDay(j), st: String(j.st || '').trim().toUpperCase() });
      n++;
    }
    if (full || n) { L.cards = got; let mx = 0; for (const id of got.keys()) if (id > mx) mx = id; L.maxId = mx; index(); }
    if (full) L.fullAt = Date.now();
    const first = !L.ok; L.ok = true; L.err = ''; L.at = Date.now();
    if (L.jcFrom == null) {   // the first good read: only job cards after this one are asked by themselves
      const was = kvGet('jc_from'); L.jcFrom = was != null ? Number(was) : L.maxId; if (was == null) kvSet('jc_from', L.jcFrom);
    }
    if (first || n) wantNew();
    status(first || n > 0);
  } catch (e) {
    const first = L.ok || !L.err; L.ok = false; L.err = e.message; L.at = Date.now();
    if (first) console.log('vehicle number: the billing could not be read:', e.message);
    status(true);
  } finally { L.busy = false; }
}
// the update script reads this (front.db, kv gaadi_last) to say whether the page reads the billing
function status(force) {
  if (!force && Date.now() - L.saved < 60000) return;
  L.saved = Date.now();
  kvSet('gaadi_last', JSON.stringify({ on: linkOn(), at: L.at, ok: L.ok, err: L.err, cards: L.cards.size, plates: L.byReg.size, maxId: L.maxId, from: L.jcFrom, vr: vrOn() }));
}

// ---------------- the vehicle of every new job card, asked by itself ------------------------------------------------------
const queue = [];   // [reg, job card id]
const WINDOW_DAYS = 3;
function tried(reg) {   // an error a short while ago, or 3 tries today: wait
  const r = one("SELECT count(*) n, max(at) last FROM vr_calls WHERE reg = ? AND result = 'error' AND at >= ?", reg, dayFrom());
  return r.n >= 3 || (r.last && Date.now() - Date.parse(r.last) < 30 * 60000);
}
const asked = reg => { const v = one('SELECT found FROM vehicles WHERE reg = ?', reg); return !!v && v.found != null; };
function wantNew() {
  if (L.jcFrom == null) return;
  const since = istDay(Date.now() - WINDOW_DAYS * 864e5);
  for (const j of L.cards.values()) {
    if (j.id <= L.jcFrom || (j.day && j.day < since)) continue;
    const r = clean(j.p);
    if (isReg(r) && !asked(r) && !queue.some(q => q[0] === r)) queue.push([r, j.id]);
  }
  queue.sort((a, b) => a[1] - b[1]);
}
async function work() {
  if (!vrOn() || !queue.length || VR.busy.size) return;
  const [reg, jc] = queue[0];
  if (asked(reg) || tried(reg)) { queue.shift(); return; }
  if (VR.err && Date.now() - VR.errAt < 60000) return;   // VR Garage just failed: a minute's pause for everyone
  queue.shift();
  const res = await lookup(reg, 'job card ' + jc, 'auto');
  if (res.state === 'cap') queue.unshift([reg, jc]);
}

// ---------------- what the page gets ------------------------------------------------------------------------------------
const dmy = d => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : '');
const cardView = j => ({ jc: j.id, date: dmy(j.day), plate: clean(j.p) || j.p.slice(0, 20), model: [j.mk, j.mo].filter(Boolean).join(' ').slice(0, 80), cust: j.n, ph: j.ph, st: j.st });
const history = reg => (L.byReg.get(reg) || []).map(id => L.cards.get(id)).filter(Boolean).map(cardView);
function savedView(reg, owner) {
  const v = one('SELECT * FROM vehicles WHERE reg = ?', reg); if (!v) return null;
  let d = {}; try { d = JSON.parse(v.d || '{}'); } catch { /* kept as it is */ }
  const out = { found: v.found, d, name: v.name || '', model: v.model || '', at: v.asked_at || '', by: v.asked_by || '', editedBy: v.edited_by || '', editedAt: v.edited_at || '' };
  if (owner && v.found === 2 && v.raw) { try { out.fields = [...keyNames(JSON.parse(v.raw))].slice(0, 60); } catch { /* not JSON */ } }
  return out;
}
const vrView = owner => ({ on: vrOn(), err: VR.err && Date.now() - VR.errAt < 15 * 60000 ? VR.err : '', ...(owner ? {
  today: one(`SELECT count(*) n FROM vr_calls WHERE at >= ? AND ${PAID}`, dayFrom()).n,
  month: one(`SELECT count(*) n FROM vr_calls WHERE at >= ? AND ${PAID}`, monthFrom()).n,
  saved: one('SELECT count(*) n FROM vehicles WHERE found = 1').n } : {}) });
const linkView = () => ({ on: linkOn(), ok: L.ok, err: L.ok ? '' : L.err, cards: L.cards.size, at: L.at ? new Date(L.at).toISOString() : '' });
function vehicleView(reg, owner, look) {
  const h = history(reg);
  return { no: reg, show: showReg(reg), saved: savedView(reg, owner), visits: h.length, history: h.slice(0, 20), vr: vrView(owner), link: linkView(), ...(look ? { look } : {}) };
}
const queued = reg => queue.some(q => q[0] === reg) || VR.busy.has(reg);
function recentView(owner) {
  const ids = [...L.cards.keys()].sort((a, b) => b - a).slice(0, 40);
  const cards = ids.map(id => {
    const j = L.cards.get(id), c = cardView(j), r = clean(j.p), ok = isReg(r);
    const v = ok ? savedView(r, false) : null;
    const vr = !ok ? { st: 'bad' } : v && v.found === 1 ? { st: 'found', model: v.model || v.d.model || '', maker: v.d.maker || '', chassis: v.d.chassis || '', engine: v.d.engine || '', name: v.name || v.d.owner || '' }
      : v && v.found === 0 ? { st: 'notfound' } : v && v.found === 2 ? { st: 'unread' }
      : !vrOn() ? { st: 'off' } : queued(r) ? { st: 'wait' } : L.jcFrom != null && id > L.jcFrom ? { st: 'wait' } : { st: 'old' };
    return { ...c, valid: ok, vr };
  });
  return { cards, vr: vrView(owner), link: linkView() };
}

// ---------------- API: /__gate/api/vehicle... (any signed-in login) -----------------------------------------------------------
async function api(req, res, u, s, h) {
  const p = u.pathname, m = req.method, owner = !!s.owner, who = String(s.name || 'staff').slice(0, 80);
  const regOf = v => { const r = clean(v); if (!isReg(r)) throw h.err(400, 'Type the full vehicle number, like KA17AB1234.'); return r; };
  if (m === 'GET' && p === '/__gate/api/vehicle') {
    const reg = regOf(u.searchParams.get('no'));
    let look = null;
    if (u.searchParams.get('look') === '1' && !asked(reg)) look = await lookup(reg, who, 'manual');
    return h.json(res, 200, vehicleView(reg, owner, look && { state: look.state, msg: look.msg || '' }));
  }
  if (m === 'POST' && p === '/__gate/api/vehicle') {   // the customer name and the model, as the staff know them
    const b = await h.body(req), reg = regOf(b.no);
    const name = String(b.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null, model = String(b.model ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
    if (!one('SELECT 1 FROM vehicles WHERE reg = ?', reg)) run('INSERT INTO vehicles (reg, found, d) VALUES (?, NULL, \'{}\')', reg);
    run('UPDATE vehicles SET name = ?, model = ?, edited_by = ?, edited_at = ? WHERE reg = ?', name, model, who, now(), reg);
    return h.json(res, 200, vehicleView(reg, owner));
  }
  if (m === 'POST' && p === '/__gate/api/vehicle/again') {   // owner: ask VR Garage once more (a number it did not know, or could not be read)
    if (!owner) throw h.err(403, 'Only the owner can ask VR Garage again.');
    const b = await h.body(req), reg = regOf(b.no);
    const v = one('SELECT found FROM vehicles WHERE reg = ?', reg);
    if (v && v.found === 1) throw h.err(400, 'This vehicle already has its VR Garage details.');
    const look = await lookup(reg, who, 'again');
    return h.json(res, 200, vehicleView(reg, owner, { state: look.state, msg: look.msg || '' }));
  }
  if (m === 'GET' && p === '/__gate/api/vehicle/recent') return h.json(res, 200, recentView(owner));
  if (m === 'GET' && p === '/__gate/api/vehicle/many') {   // saved details of up to 80 numbers (the Cashier's job cards); never asks VR Garage
    const regs = [...new Set(String(u.searchParams.get('nos') || '').split(',').map(clean).filter(isReg))].slice(0, 80);
    const list = {};
    for (const r of regs) {
      const v = savedView(r, false);
      if (v && (v.found === 1 || v.name || v.model)) list[r] = { model: v.model || v.d.model || '', maker: v.d.maker || '', chassis: v.d.chassis || '', engine: v.d.engine || '', name: v.name || v.d.owner || '' };
    }
    return h.json(res, 200, { list });
  }
  throw h.err(404, 'Not found.');
}

// ---------------- start -----------------------------------------------------------------------------------------------------
function init(database) {
  db = database;
  db.exec(`CREATE TABLE IF NOT EXISTS vehicles (reg TEXT PRIMARY KEY, found INTEGER, d TEXT NOT NULL DEFAULT '{}', raw TEXT, name TEXT, model TEXT,
      edited_by TEXT, edited_at TEXT, asked_at TEXT, asked_by TEXT);
    CREATE TABLE IF NOT EXISTS vr_calls (id INTEGER PRIMARY KEY, at TEXT NOT NULL, reg TEXT NOT NULL, who TEXT NOT NULL, kind TEXT NOT NULL, result TEXT NOT NULL, ms INTEGER, note TEXT);
    CREATE INDEX IF NOT EXISTS vr_calls_at ON vr_calls (at);
    CREATE INDEX IF NOT EXISTS vr_calls_reg ON vr_calls (reg);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);`);
  remap();
}
let timers = [];
const later = (i, fn, ms) => { timers[i] = setTimeout(fn, ms); if (timers[i].unref) timers[i].unref(); };
function start() {
  stop();
  L.on = linkOn();
  if (L.on) {
    const tick = async () => {
      await readCards(!L.ok || Date.now() - L.fullAt > 10 * 60000).catch(() => {});
      later(0, tick, L.ok ? (Number(env('GAADI_SECONDS')) || 5) * 1000 : 60000);
    };
    later(0, tick, 1500);
  } else { L.at = Date.now(); status(true); }
  const loop = async () => { await work().catch(e => console.log('vehicle number:', e.message)); later(1, loop, 3000); };
  later(1, loop, 4000);
}
function stop() { timers.forEach(t => clearTimeout(t)); timers = []; }

module.exports = { init, start, stop, api, loginTest, rcMap, clean, isReg, _: { L, VR, queue, readCards, work, wantNew, lookup } };
