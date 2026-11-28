// New job card in the Service floor (Sam, 28 Nov 2026: "new job card service.bikesurgeon.online pe nahi jana chahiye ... naya
// portal, naye steps, nayi UI: VR Garage jaisa gaadi ka data apne aap (model sab), customer ka naam apne aap, phir CC, phir
// labour ... inspection ka data same, WhatsApp automation same, SmartPing same").
//
// The job card is saved in the Bike Surgeon billing exactly the way the service app's own pages save it (service.bikesurgeon.
// online/app: service-book-process.php to service-book-process4.php and checklist-api.php of 2 Nov 2026), so the billing, the
// mechanic portal (Sameer gives the mechanic and the bay there, which approves it), the cashier, the service reminders and this
// panel all see one of their own job cards:
//   1 customer + vehicle  user: found by the mobile number (its name is updated), else a new customer row like the app's own;
//                         job_card: a new row (approval PENDING, the time slot, the advisor); a_bikes: the customer's bike,
//                         once; then the vehicle number, make and model on the job card
//   2 services            the CC, the labour lines at the rate card's price of that CC (a custom line as typed), the general
//                         service checklist, the 23-point bike check (the same points in the same order), the customer's
//                         issue list (also into job_card_checklist), the delivery time; the billing's free-service rule: 3 free
//                         General Servicing per vehicle number, only the "General Servicing" line is Rs. 0
//   3 inspection          odometer, daily km, fuel and the 5 photos (odometer, front, rear, left, right) in the service app's
//                         own photo folder under its own names; then the customer's WhatsApp through SmartPing (the same two
//                         templates: the details, then each photo) and the SMS (Fast2SMS), logged in whatsapp_send_log
// After step 3 the job card waits for its mechanic in the mechanic portal (approval PENDING), as before.
// .env: JC_DB_USER + JC_DB_PASS (a login that may change only these tables: bash /root/bs-erp-update.sh jobcard makes it), the
// billing lines OLD_DB_HOST, OLD_DB_PORT, OLD_DB_BS, OLD_DB_PUBKEY, MYSQL_BIN, JC_PHOTO_DIR (the app's uploads/jc), JC_PHOTO_BASE,
// SMARTPING_API_KEY, FAST2SMS_KEY. JC_WRITE=0 = off (the New job card button opens the service app again).
'use strict';
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('./clock');
const db = require('./db');
const live = require('./billing');

const env = k => String(process.env[k] || '').trim();
const on = () => env('JC_WRITE') !== '0' && live.on() && !!(env('JC_DB_USER') && env('JC_DB_PASS') && env('JC_PHOTO_DIR'));
const PHOTO_BASE = () => (env('JC_PHOTO_BASE') || 'https://service.bikesurgeon.online/app/uploads/jc').replace(/\/+$/, '');
const WA_URL = () => env('SMARTPING_API_URL') || 'https://backend.api-wa.co/campaign/smartping/api/v2';
const WA_DETAILS = () => env('WA_CAMPAIGN_JOBCARD_DETAILS') || 'full details job card';
const WA_PHOTO = () => env('WA_CAMPAIGN_JOBCARD_PHOTO') || 'photos job card';
const SMS_URL = () => env('FAST2SMS_URL') || 'https://www.fast2sms.com/dev/bulkV2';
const waKey = () => env('SMARTPING_API_KEY').replace(/^["'\s]+|["'\s]+$/g, '');
const smsKey = () => env('FAST2SMS_KEY').replace(/^["'\s]+|["'\s]+$/g, '');
const fail = (status, msg) => Object.assign(new Error(msg), { status });

// ---------------- the billing, with the job card login ------------------------------------------------------------------------
// the SQL goes in on stdin (no length limit); the mysql program stops at the first error, so a START TRANSACTION ... COMMIT
// that fails half way is never committed
function mysql(sql) {
  const args = ['-h', env('OLD_DB_HOST') || '127.0.0.1', '-P', env('OLD_DB_PORT') || '3306', '-u', env('JC_DB_USER'),
    '--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4',
    ...(env('OLD_DB_PUBKEY') === '0' ? [] : ['--get-server-public-key']), env('OLD_DB_BS')];
  return new Promise((resolve, reject) => {
    const ch = execFile(env('MYSQL_BIN') || 'mysql', args, { env: { ...process.env, MYSQL_PWD: process.env.JC_DB_PASS || '' }, maxBuffer: 32 * 1024 * 1024, timeout: 30000 },
      (e, out, errOut) => e ? reject(fail(424, 'The billing database answered: ' + String(errOut || e.message).replace(/\s+/g, ' ').trim().slice(0, 220))) : resolve(out));
    ch.stdin.on('error', () => { /* the program ended first: its error comes above */ });
    ch.stdin.end(sql);
  });
}
async function rows(sql) {
  const out = await mysql(sql), r = [];
  for (const l of out.split('\n')) if (l.trim()) { try { r.push(JSON.parse(l)); } catch { /* a broken row is skipped */ } }
  return r;
}
async function insertId(sql) {
  const out = (await mysql(sql + '\nSELECT LAST_INSERT_ID();')).trim().split('\n');
  const id = Math.floor(Number(out[out.length - 1]));
  if (!(id > 0)) throw fail(424, 'The billing did not give the new row its number.');
  return id;
}
// a value written the way mysqli_real_escape_string writes it (quotes doubled when the server runs NO_BACKSLASH_ESCAPES)
let MODE = null;
async function ready() { if (MODE === null) MODE = (await mysql('SELECT @@SESSION.sql_mode;')).trim(); }
const ESC = { '\0': '\\0', '\n': '\\n', '\r': '\\r', '\x1a': '\\Z', '\\': '\\\\', "'": "\\'", '"': '\\"' };
const q = v => (v === null || v === undefined) ? 'NULL'
  : "'" + (/NO_BACKSLASH_ESCAPES/i.test(MODE || '') ? String(v).replace(/\0/g, '').replace(/'/g, "''") : String(v).replace(/[\0\n\r\x1a\\'"]/g, c => ESC[c])) + "'";
const J = cols => `JSON_OBJECT(${Object.entries(cols).map(([k, c]) => `'${k}', ${c}`).join(', ')})`;
const sub = (c, n) => `SUBSTRING(${c}, 1, ${n})`;

// ---------------- helpers ------------------------------------------------------------------------------------------------------
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const line = (v, n) => String(v ?? '').replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => { const n = Number(String(v ?? '').replace(/[₹,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const mobile = v => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d; };
const regOf = v => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
const vehKey = v => String(v ?? '').replace(/\s+/g, '').toUpperCase();   // the free-service rule's own: strtoupper(preg_replace('/\s+/', ''))
const nameKey = v => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');
const cut = (s, n) => { const a = Array.from(s); return a.length > n ? a.slice(0, n - 3).join('') + '...' : s; };   // mb_substr(0, n-3) . '...'
const empty = v => v === undefined || v === null || v === false || v === 0 || v === '' || v === '0' || (Array.isArray(v) && !v.length);   // PHP empty()
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const h12 = d => pad(((d.getHours() + 11) % 12) + 1);
const dmyA = d => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${h12(d)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? 'am' : 'pm'}`;   // date('d-m-Y h:i:s a')
const ymdHis = d => `${C.ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;   // date('Y-m-d H:i:s')
const dMYA = d => `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}, ${h12(d)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;   // date('d M Y, h:i A')
const nf = v => Math.round(num(v)).toLocaleString('en-US');   // number_format($x)
const parseWhen = t => { const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(t || '')); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) : null; };

// the old app's own lists (service-book3.php, service-book4.php)
const CC = [['110cc', 'Till 110CC'], ['125cc', '125-130CC'], ['150cc', '150CC'], ['200cc', '160-200CC'], ['300cc', '220-300CC'], ['650cc', '301-650CC']];
const GSC = ['Washing', 'Air Filter Cleaning', 'Battery Testing & Charging', 'Engine Oil Change', 'Valve Gap Adjustment', 'Drive Chain Adjustment',
  'Clutch Adjustment', 'Brake Check & Adjustment', 'Spark Plug Cleaning', 'Chain Sprocket Check'];
// the bike check, in the order the advisor walks round the bike (front tyre first, rear tyre last)
const POINTS = ['Front Tyre', 'Front Brake', 'Front Suspension/Forks', 'Front Mudguard', 'Headlight', 'Speedometer / Console', 'Handlebar / Switches',
  'Mirrors', 'Horn', 'Indicators (Front)', 'Fuel Tank', 'Seat', 'Engine', 'Exhaust / Silencer', 'Chain & Sprocket', 'Footrest', 'Rear Shock Absorber',
  'Rear Mudguard', 'Number Plate', 'Indicators (Rear)', 'Tail Light', 'Rear Brake', 'Rear Tyre'];
const POINT_ST = ['not_checked', 'done', 'in_service', 'scheduled', 'not_approved'];
const FUEL = [[0, 'Empty'], [25, '1/4'], [50, 'Half'], [75, '3/4'], [100, 'Full']];
const fuelLabel = v => v <= 5 ? 'Empty' : v <= 30 ? '1/4' : v <= 60 ? 'Half' : v <= 85 ? '3/4' : 'Full';
const PHOTOS = [['odo', 'Odometer'], ['s1', 'Front'], ['s2', 'Rear'], ['s3', 'Left Side'], ['s4', 'Right Side']];
const isGsName = n => /^\s*general\s+servic/i.test(String(n || ''));
// the time slot of the moment (service-book-process.php getSlot): 1 pm counts as 2-3, before 9 as 9-10, from 6 pm as 5-6
const SLOTS = [['9-10', 9], ['10-11', 10], ['11-12', 11], ['12-1', 12], ['2-3', 14], ['3-4', 15], ['4-5', 16], ['5-6', 17]];
function slotOf(d) {
  const h = d.getHours();
  const s = h === 13 ? SLOTS[4] : h < 9 ? SLOTS[0] : h >= 18 ? SLOTS[7] : SLOTS.find(([, f]) => h >= f && h < f + 1) || SLOTS[7];
  return { label: s[0], start: `${pad(s[1])}:00:00`, end: `${pad(s[1] + 1)}:00:00` };
}

// ---------------- what the billing gives ---------------------------------------------------------------------------------------
let LAB = { at: 0, list: [] };
async function labour() {
  if (LAB.list.length && Date.now() - LAB.at < 60000) return LAB.list;
  const r = await rows(`SELECT ${J({ id: 'id', c: sub('category', 60), n: sub('job_description', 300), '110cc': 'price_110cc', '125cc': 'price_125cc',
    '150cc': 'price_150cc', '200cc': 'price_200cc', '300cc': 'price_300cc', '650cc': 'IFNULL(price_650cc, price_300cc)' })} FROM \`labour_charges\` WHERE is_active=1 ORDER BY category, id;`);
  LAB = { at: Date.now(), list: r.map(x => ({ id: num(x.id), c: line(x.c, 60) || 'OTHER', n: line(x.n, 300), p: Object.fromEntries(CC.map(([k]) => [k, num(x[k])])) })).filter(x => x.id > 0 && x.n) };
  return LAB.list;
}
let ADV = { at: 0, list: [] };
async function advisorOf(user) {
  if (!ADV.list.length || Date.now() - ADV.at > 300000) {
    const r = await rows(`SELECT ${J({ id: 'id', n: sub('name', 60), ph: sub('phone', 20) })} FROM \`service_adviser\`;`);
    ADV = { at: Date.now(), list: r.map(a => ({ id: num(a.id), n: line(a.n, 60), raw: line(a.ph, 20), ph: String(a.ph ?? '').replace(/\D/g, '').slice(-10), k: nameKey(a.n) })) };
  }
  if (!user) return null;
  // like the job card list: the same name first (two advisors of the billing can share a phone), the phone only when one has it
  const ph = mobile(user.phone), nk = nameKey(user.name), byPh = ph.length === 10 ? ADV.list.filter(x => x.ph === ph) : [];
  return (nk && ADV.list.find(x => x.k === nk)) || (byPh.length === 1 ? byPh[0] : null);
}
const CARD = { id: 'jc.id', u: 'jc.user_id', n: sub('jc.name', 80), ph: sub('u.userphone', 20), un: sub('u.username', 80), p: sub('jc.vehicle_number', 24),
  mk: sub('jc.make', 40), mo: sub('jc.model', 60), pkg: sub('jc.service_package', 12), svc: sub('jc.service_type', 300), est: sub('jc.estimated_cost', 14),
  dl: sub('jc.delivery_time', 30), it: sub('jc.issue_text', 1200), cp: sub('jc.checkpoint_status', 6000), gs: sub('jc.general_service_checklist', 2000),
  free: 'jc.is_free_service_claim', km: sub('jc.odo_reading', 12), dk: 'jc.daily_km_avg', fu: sub('jc.fuel_level', 8), fl: sub('jc.fuel_label', 12),
  i1: sub('jc.image1', 120), st: sub('jc.status', 24), ap: sub('jc.approval', 16), at: sub('jc.created_at', 30), byn: sub('jc.created_by_name', 40) };
async function card(id) {
  const n = Math.floor(Number(id));
  if (!(n > 0) || n > 2e9) throw fail(404, 'No such job card.');
  const c = (await rows(`SELECT ${J(CARD)} FROM \`job_card\` jc LEFT JOIN \`user\` u ON u.id = jc.user_id WHERE jc.id = ${n};`))[0];
  if (!c) throw fail(404, `Job card #${n} is not in the billing.`);
  return c;
}
const st = c => String(c.st ?? '').trim().toUpperCase(), ap = c => String(c.ap ?? '').trim().toUpperCase();
// only a job card that is still being made (not yet with the mechanic) is changed here, like the app's own steps
function editable(c) {
  if (ap(c) !== 'PENDING' || !['', 'PENDING'].includes(st(c))) throw fail(409, `Job card #${c.id} is already ${ap(c) === 'APPROVED' ? 'with the mechanic' : 'closed'}: it is not changed here.`);
}
const stepOf = (c, lines) => !String(c.p || '').trim() ? 1 : !(String(c.svc || '').trim() || lines) ? 2 : !String(c.i1 || '').trim() ? 3 : 4;

// the billing's free-service rule (print-invoice-service.php fs_free_status): 3 free General Servicing visits per vehicle number,
// only when its first visit (after the offer started) was a General Servicing job card
const VALID = a => `UPPER(COALESCE(${a}.status,'')) NOT IN ('CANCELLED','CANCELED','DELETED','REJECTED') AND (TRIM(COALESCE(${a}.service_type,'')) != '' ` +
  `OR EXISTS (SELECT 1 FROM job_labour_items lv WHERE lv.job_card_id = ${a}.id))`;
const IS_GS = a => `(${a}.is_free_service_claim = 1 OR LOWER(TRIM(${a}.service_type)) LIKE 'general servic%' ` +
  `OR EXISTS (SELECT 1 FROM job_labour_items lg WHERE lg.job_card_id = ${a}.id AND LOWER(TRIM(lg.labour_name)) LIKE 'general servic%'))`;
async function freeStatus(veh, before = 0) {
  const out = { used: 0, remaining: 0, eligible: false, slot: 0, reason: 'existing_customer' };
  if (!veh) return out;
  const r = await rows(`SELECT ${J({ id: 'jc.id', gs: IS_GS('jc') })} FROM \`job_card\` jc WHERE UPPER(REPLACE(jc.vehicle_number,' ','')) = ${q(veh)} AND ${VALID('jc')}` +
    `${before > 0 ? ` AND jc.id < ${Math.floor(before)}` : ''} ORDER BY jc.id ASC;\nSELECT JSON_OBJECT('start', IFNULL(MIN(id), 0)) FROM \`job_card\` WHERE is_free_service_claim = 1;`);
  const cards = r.filter(x => x && x.id !== undefined), start = num((r.find(x => x && x.start !== undefined) || {}).start);
  if (!cards.length) return { used: 0, remaining: 3, eligible: true, slot: 1, reason: 'ok' };
  if (start > 0 && num(cards[0].id) < start) return out;
  if (!num(cards[0].gs)) return { ...out, reason: 'first_visit_not_gs' };
  const used = Math.min(3, cards.filter(x => num(x.gs)).length), rem = 3 - used;
  return { used, remaining: rem, eligible: rem > 0, slot: rem > 0 ? used + 1 : 0, reason: rem > 0 ? 'ok' : 'all_used' };
}

// ---------------- this panel's own notes: who made which job card here, and how its WhatsApp went ------------------------------
let made = false;
function local() {
  if (made) return;
  db.get().exec(`CREATE TABLE IF NOT EXISTS newjc_cards (jc INTEGER PRIMARY KEY, nonce TEXT UNIQUE, by_name TEXT, made_at TEXT, done_at TEXT, sent TEXT)`);
  made = true;
}
const noteOf = id => { local(); const r = db.one('SELECT * FROM newjc_cards WHERE jc = ?', id); let sent = null; try { sent = r && r.sent ? JSON.parse(r.sent) : null; } catch { /* kept */ } return r ? { by: r.by_name, at: r.made_at, done: r.done_at, sent } : null; };
function note(id, by, fields) {
  local();
  db.run('INSERT INTO newjc_cards (jc, by_name, made_at) VALUES (?, ?, ?) ON CONFLICT(jc) DO NOTHING', id, by, C.stamp(C.now()));
  for (const [k, v] of Object.entries(fields)) db.run(`UPDATE newjc_cards SET ${k} = ? WHERE jc = ?`, v, id);
}

// the photos are files of the service app's own folder: uploads/jc/<job card>_odo.jpg, _s1 ... _s4.jpg
const photoDir = () => env('JC_PHOTO_DIR');
function photoDirOk() { try { fs.accessSync(photoDir(), fs.constants.W_OK | fs.constants.X_OK); return true; } catch { return false; } }
function photosOf(id) {
  const o = {};
  for (const [k] of PHOTOS) { try { const s = fs.statSync(path.join(photoDir(), `${id}_${k}.jpg`)); o[k] = s.size > 0 ? s.mtimeMs : 0; } catch { o[k] = 0; } }
  return o;
}

// ---------------- the steps ---------------------------------------------------------------------------------------------------
async function boot(user) {
  await ready();
  const [lab, adv] = await Promise.all([labour(), advisorOf(user)]);
  const now = C.now(), sl = slotOf(now);
  const used = num(((await rows(`SELECT JSON_OBJECT('n', COUNT(*)) FROM \`job_card\` WHERE DATE(created_at) = ${q(C.ymd(now))} AND slot = ${q(sl.label)};`))[0] || {}).n);
  return { on: true, labour: lab, cc: CC.map(([k, l]) => ({ k, l })), gsc: GSC, points: POINTS, fuel: FUEL.map(([v, l]) => ({ v, l })), photos: PHOTOS.map(([k, l]) => ({ k, l })),
    slot: { label: sl.label, used, free: Math.max(0, 14 - used) }, me: { name: adv ? adv.n : line(user.name, 60), advisor: !!adv },
    wa: !!waKey(), sms: !!smsKey(), photoDir: photoDirOk(), today: C.ymd(now) };
}

// what the billing knows of a vehicle number and of a mobile number (the app's step 1 and 2 ask the same: fetch_user_name.php,
// the customer's bikes of a_bikes); a vehicle's last job cards give its customer, make, model and CC
async function find(query) {
  await ready();
  const reg = regOf(query.reg), ph = mobile(query.phone), out = {};
  if (reg.length >= 4) {
    const k = q(reg), [cards, bikes] = await Promise.all([
      rows(`SELECT ${J({ id: 'jc.id', u: 'jc.user_id', n: sub('jc.name', 80), ph: sub('u.userphone', 20), un: sub('u.username', 80), mk: sub('jc.make', 40), mo: sub('jc.model', 60),
        pkg: sub('jc.service_package', 12), st: sub('jc.status', 24), ap: sub('jc.approval', 16), at: sub('jc.created_at', 30), km: sub('jc.odo_reading', 12), i1: sub('jc.image1', 120) })} ` +
        `FROM \`job_card\` jc LEFT JOIN \`user\` u ON u.id = jc.user_id WHERE UPPER(REPLACE(REPLACE(jc.vehicle_number,' ',''),'-','')) = ${k} ORDER BY jc.id DESC LIMIT 8;`),
      rows(`SELECT ${J({ id: 'b.id', u: 'b.user_id', mk: sub('b.make', 40), mo: sub('b.model', 60), un: sub('u.username', 80), ph: sub('u.userphone', 20) })} ` +
        `FROM \`a_bikes\` b LEFT JOIN \`user\` u ON u.id = b.user_id WHERE UPPER(REPLACE(REPLACE(b.reg_no,' ',''),'-','')) = ${k} ORDER BY b.id DESC LIMIT 5;`),
    ]);
    const open = cards.filter(c => ap(c) === 'PENDING' && ['', 'PENDING'].includes(st(c)) && !String(c.i1 || '').trim());
    out.vehicle = { reg, cards: cards.map(c => ({ id: num(c.id), n: line(c.n || c.un, 80), ph: mobile(c.ph), mk: line(c.mk, 40), mo: line(c.mo, 60), pkg: line(c.pkg, 12).toLowerCase(),
      at: line(c.at, 30), km: line(c.km, 12), st: st(c), ap: ap(c) })), bikes: bikes.map(b => ({ mk: line(b.mk, 40), mo: line(b.mo, 60), n: line(b.un, 80), ph: mobile(b.ph) })),
      open: open.map(c => num(c.id)), free: await freeStatus(reg) };
  }
  if (/^\d{10}$/.test(ph)) {
    const u = (await rows(`SELECT ${J({ id: 'id', n: sub('username', 80) })} FROM \`user\` WHERE userphone = ${q(ph)} ORDER BY id LIMIT 1;`))[0];
    out.customer = { phone: ph, found: !!u, name: u ? line(u.n, 80) : '' };
    if (u) {
      const [bikes, open] = await Promise.all([
        rows(`SELECT ${J({ id: 'id', p: sub('reg_no', 24), mk: sub('make', 40), mo: sub('model', 60) })} FROM \`a_bikes\` WHERE user_id = ${num(u.id)} ORDER BY id DESC LIMIT 10;`),
        rows(`SELECT ${J({ id: 'id', p: sub('vehicle_number', 24), at: sub('created_at', 30) })} FROM \`job_card\` WHERE user_id = ${num(u.id)} AND approval = 'PENDING' ` +
          `AND (status IS NULL OR TRIM(status) IN ('', 'PENDING')) AND (image1 IS NULL OR TRIM(image1) = '') ORDER BY id DESC LIMIT 5;`),
      ]);
      out.customer.bikes = bikes.map(b => ({ p: regOf(b.p), mk: line(b.mk, 40), mo: line(b.mo, 60) })).filter(b => b.p);
      out.customer.open = open.map(c => ({ id: num(c.id), p: line(c.p, 24), at: line(c.at, 30) }));
    }
  }
  return out;
}

// steps 1 + 2 of the app (service-book-process.php, service-book-process2.php)
const BUSY = new Set();
async function startCard(user, b) {
  await ready(); local();
  const nonce = String(b.nonce || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 48);
  if (nonce.length < 16) throw fail(422, 'Open New job card again.');
  const ph = mobile(b.phone), name = line(b.name, 80), reg = regOf(b.reg), make = line(b.make, 40), model = line(b.model, 60);
  if (!/^\d{10}$/.test(ph)) throw fail(422, "Type the customer's 10-digit mobile number.");
  if (!name) throw fail(422, "Type the customer's name.");
  if (reg.length < 4) throw fail(422, 'Type the vehicle number.');
  if (!make || !model) throw fail(422, 'Type the make and the model of the vehicle.');
  if (BUSY.has(nonce)) throw fail(409, 'Saving, one moment.');
  const had = db.one('SELECT jc FROM newjc_cards WHERE nonce = ?', nonce);
  if (had) {   // the same tap twice (or again after a lost answer): the job card made the first time, with its vehicle
    const c = await card(had.jc);
    if (!String(c.p || '').trim()) { await vehicle(num(c.id), c.u, reg, make, model); live.tick(); }
    return { id: num(c.id), again: true };
  }
  BUSY.add(nonce);
  try {
    const adv = await advisorOf(user), now = C.now(), sl = slotOf(now);
    // the customer: found by the mobile number (the name as typed now), else a new customer like the app makes
    const u = (await rows(`SELECT JSON_OBJECT('id', id) FROM \`user\` WHERE userphone = ${q(ph)} ORDER BY id LIMIT 1;`))[0];
    let uid = u ? num(u.id) : 0;
    if (uid) await mysql(`UPDATE \`user\` SET username = ${q(name)} WHERE id = ${uid};`);
    else uid = await insertId('INSERT INTO `user` (username, userphone, shop_name, shop_address, GST, referal_code, business_approval_status, wallet, addisset, type) ' +
      `VALUES (${q(name)}, ${q(ph)}, '', '', '', '', 'pending', '0', '0', 'customer');`);
    const jc = await insertId('INSERT INTO `job_card` (user_id, phone, name, vehicle_number, make, model, last_service_date, service_type, service_package, ' +
      'estimated_cost, odo_reading, fuel_level, Issue_reported, dents_scratches, image1, image2, identifier, approval, created_at, delivery_time, dd, mm, yy, ' +
      `created_by, created_by_name, slot, slot_start, slot_end) VALUES (${q(uid)}, ${q(ph)}, ${q(name)}, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ` +
      `'PENDING', ${q(dmyA(now))}, '', ${q(pad(now.getDate()))}, ${q(pad(now.getMonth() + 1))}, ${q(now.getFullYear())}, ${q(adv ? adv.id : 0)}, ` +
      `${q(adv ? adv.n : line(user.name, 40))}, ${q(sl.label)}, ${q(sl.start)}, ${q(sl.end)});`);
    db.run('INSERT INTO newjc_cards (jc, nonce, by_name, made_at) VALUES (?, ?, ?, ?) ON CONFLICT(jc) DO UPDATE SET nonce = excluded.nonce', jc, nonce, line(user.name, 60), C.stamp(now));
    await vehicle(jc, uid, reg, make, model);
    live.tick();
    return { id: jc };
  } finally { BUSY.delete(nonce); }
}
async function vehicle(jc, uid, reg, make, model) {
  const has = await rows(`SELECT JSON_OBJECT('id', id) FROM \`a_bikes\` WHERE reg_no = ${q(reg)} AND user_id = ${q(uid)} LIMIT 1;`);
  await mysql((has.length ? '' : `INSERT INTO \`a_bikes\` (\`id\`, \`user_id\`, \`type\`, \`make\`, \`model\`, \`km\`, \`reg_no\`) VALUES (NULL, ${q(uid)}, 'bike', ${q(make)}, ${q(model)}, '-', ${q(reg)});\n`) +
    `UPDATE \`job_card\` SET \`vehicle_number\` = ${q(reg)}, \`make\` = ${q(make)}, \`model\` = ${q(model)} WHERE id = ${jc} AND user_id = ${q(uid)};`);
}
// step 1 again (Back): the customer's name and the vehicle of a job card being made; its mobile number stays
async function setVehicle(user, id, b) {
  await ready();
  const c = await card(id); editable(c);
  const name = line(b.name, 80), reg = regOf(b.reg), make = line(b.make, 40), model = line(b.model, 60);
  if (!name) throw fail(422, "Type the customer's name.");
  if (reg.length < 4) throw fail(422, 'Type the vehicle number.');
  if (!make || !model) throw fail(422, 'Type the make and the model of the vehicle.');
  await mysql(`UPDATE \`user\` SET username = ${q(name)} WHERE id = ${q(c.u)};\nUPDATE \`job_card\` SET name = ${q(name)} WHERE id = ${num(c.id)} AND user_id = ${q(c.u)};`);
  await vehicle(num(c.id), c.u, reg, make, model);
  live.tick();
  return { id: num(c.id) };
}

// a job card as it is now: the step to go on with, its lines, its photos, the last visits' issue lists of the vehicle
async function stateOf(id) {
  await ready();
  const c = await card(id), n = num(c.id);
  const [lab, chk] = await Promise.all([
    rows(`SELECT ${J({ n: sub('labour_name', 500), p: 'labour_price', cc: sub('cc_type', 12), cu: 'is_custom' })} FROM \`job_labour_items\` WHERE job_card_id = ${n} ORDER BY id;`),
    rows(`SELECT ${J({ t: sub('item', 400), s: sub('status', 16) })} FROM \`job_card_checklist\` WHERE job_card_id = ${n} ORDER BY id;`),
  ]);
  const veh = vehKey(c.p);
  // the earlier visits' issue lists (checklist-api.php get_history): the last 3 completed job cards of this vehicle
  const prevCards = veh ? await rows(`SELECT ${J({ id: 'id', at: sub('created_at', 30) })} FROM \`job_card\` WHERE UPPER(TRIM(vehicle_number)) = UPPER(${q(String(c.p).trim())}) ` +
    `AND status IN ('COMPLETED','STREAM_STOPPED') AND id != ${n} ORDER BY id DESC LIMIT 3;`) : [];
  const prevItems = prevCards.length ? await rows(`SELECT ${J({ jc: 'job_card_id', t: sub('item', 400), s: sub('status', 16), r: sub('reason', 300) })} FROM \`job_card_checklist\` ` +
    `WHERE job_card_id IN (${prevCards.map(p => num(p.id)).join(',')}) ORDER BY id;`) : [];
  let cp = {}, gs = {};
  try { cp = JSON.parse(c.cp || '{}') || {}; } catch { /* not JSON */ }
  try { gs = JSON.parse(c.gs || '{}') || {}; } catch { /* not JSON */ }
  const step = stepOf(c, lab.length), free = await freeStatus(veh, n);
  return {
    id: n, step, editable: ap(c) === 'PENDING' && ['', 'PENDING'].includes(st(c)),
    card: { phone: mobile(c.ph), name: line(c.n || c.un, 80), p: line(c.p, 24), mk: line(c.mk, 40), mo: line(c.mo, 60), cc: line(c.pkg, 12).toLowerCase(), est: num(c.est),
      dl: line(c.dl, 30), km: line(c.km, 12), dk: c.dk == null ? '' : String(num(c.dk) || ''), fu: line(c.fu, 8), at: line(c.at, 30), by: line(c.byn, 40), st: st(c), ap: ap(c),
      free: num(c.free) === 1, svc: line(c.svc, 300) },
    labour: lab.map(x => ({ n: line(x.n, 500), p: num(x.p), cc: line(x.cc, 12), custom: num(x.cu) === 1 })),
    issues: chk.map(x => ({ t: line(x.t, 400), s: line(x.s, 16) })),
    issueText: String(c.it || ''), points: cp, gsc: gs, free,
    prev: prevCards.map(p => ({ id: num(p.id), at: line(p.at, 30), items: prevItems.filter(x => num(x.jc) === num(p.id)).map(x => ({ t: line(x.t, 400), s: line(x.s, 16), r: line(x.r, 300) })) })).filter(p => p.items.length),
    photos: photosOf(n), note: noteOf(n),
  };
}

// step 3 of the app (service-book-process3.php + checklist-api.php save_items)
async function services(user, id, b) {
  await ready();
  const c = await card(id); editable(c);
  const n = num(c.id), cc = String(b.cc || '').toLowerCase();
  if (!CC.some(([k]) => k === cc)) throw fail(422, 'Choose the engine CC.');
  const deliv = String(b.delivery || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deliv) || !parseWhen(deliv)) throw fail(422, 'Set the expected delivery time.');
  // the labour lines: from the rate card at the price of this CC (never a price typed in the page), a custom line as typed
  const card0 = await labour(), seen = new Set(), lines = [];
  for (const x of Array.isArray(b.labour) ? b.labour.slice(0, 80) : []) {
    if (x && x.custom) {
      const nm = line(x.n, 300), pr = r2(num(x.p));
      if (!nm) throw fail(422, 'Type the name of the custom labour.');
      if (!(pr > 0) || pr > 1e6) throw fail(422, `Type a right amount for "${nm}".`);
      lines.push({ name: nm, price: pr, custom: true });
    } else {
      const r = card0.find(l => l.id === num(x && x.id));
      if (!r) throw fail(409, 'A labour line is not in the rate card any more. Open the page again.');
      if (seen.has(r.id)) continue;
      seen.add(r.id); lines.push({ name: r.n, price: r.p[cc], custom: false });
    }
  }
  if (!lines.length) throw fail(422, 'Choose at least one service.');
  // the general service checklist: every point with its tick and Yes / Maybe / No
  const g0 = b.gsc && typeof b.gsc === 'object' ? b.gsc : {}, gsc = {}, gsel = [];
  for (const l of GSC) {
    const v = g0[l], ck = !!(v && v.checked), an = ck ? (['yes', 'maybe', 'not'].includes(v.answer) ? v.answer : 'yes') : null;
    gsc[l] = { checked: ck, answer: an }; if (ck) gsel.push([l, an]);
  }
  // the bike check: every point with its state (and the date of a "later")
  const p0 = b.points && typeof b.points === 'object' ? b.points : {}, points = {};
  for (const l of POINTS) {
    const v = p0[l] || {}, s = POINT_ST.includes(v.status) ? v.status : 'not_checked';
    points[l] = { status: s, date: s === 'scheduled' && /^\d{4}-\d{2}-\d{2}$/.test(String(v.date || '')) ? v.date : null };
  }
  // the customer's issues: "1. text — Remark: remark", one per line (as the app's form sends it)
  const issues = (Array.isArray(b.issues) ? b.issues.slice(0, 40) : []).map(x => ({ t: line(x && x.t, 300), r: line(x && x.r, 300) })).filter(x => x.t);
  let issueText = issues.map((x, i) => `${i + 1}. ${x.t}${x.r ? ' — Remark: ' + x.r : ''}`).join('\r\n');
  issueText = cut(issueText, 1000);
  // free service: claimed only when the checklist or the General Servicing labour is chosen and the vehicle still has one
  let claim = 0, slot = 0, waived = 0;
  if (gsel.length || lines.some(l => isGsName(l.name))) {
    const veh = vehKey(c.p);
    if (veh) { const fs0 = await freeStatus(veh, n); if (fs0.eligible) { claim = 1; slot = fs0.slot; } }
  }
  if (claim) for (const l of lines) if (isGsName(l.name)) { waived += l.price; l.price = 0; l.waived = true; }
  waived = r2(waived);
  const total = r2(lines.reduce((a, l) => a + l.price, 0));
  const serviceType = cut(lines.map(l => l.name).join(' | '), 250);
  const out = [];
  if (issueText) out.push('CUSTOMER COMPLAINT: ' + issueText, '');
  out.push('CC: ' + cc.toUpperCase(), '', 'SELECTED LABOURS:');
  for (const l of lines) out.push(`- ${l.custom ? '[CUSTOM] ' : ''}${l.name}: Rs.${l.price}${l.waived ? ' [FREE SERVICE]' : ''}`);
  if (gsel.length) { out.push('', 'GENERAL SERVICE CHECKLIST:'); for (const [l, a] of gsel) out.push(`- ${l}: ${{ yes: 'Yes', maybe: 'Maybe', not: 'No' }[a]}`); }
  if (waived > 0) out.push('', `FREE SERVICE CLAIM (${['', '1st', '2nd', '3rd'][slot] || slot + 'th'} of 3) — General Servicing labour waived (Rs.${waived})`);
  out.push('', 'TOTAL LABOUR: Rs.' + total);
  const issueReported = cut(out.join('\n'), 1000);
  const items = issues.map(x => x.t);
  await mysql(['START TRANSACTION;',
    `UPDATE \`job_card\` SET service_type = ${q(serviceType)}, service_package = ${q(cc)}, estimated_cost = ${q(total)}, parts_estimate = '0', delivery_time = ${q(deliv)}, ` +
    `issue_reported = ${q(issueReported)}, issue_text = ${q(issueText)}, checkpoint_status = ${q(JSON.stringify(points))}, general_service_checklist = ${q(JSON.stringify(gsc))}, ` +
    `is_free_service_claim = ${q(claim)} WHERE id = ${n} AND user_id = ${q(c.u)} AND approval = 'PENDING';`,
    `DELETE FROM \`job_labour_items\` WHERE job_card_id = ${n};`,
    `INSERT INTO \`job_labour_items\` (job_card_id, labour_name, labour_price, cc_type, is_custom) VALUES ${lines.map(l => `(${n}, ${q(l.name)}, ${q(l.price)}, ${q(cc)}, ${l.custom ? 1 : 0})`).join(', ')};`,
    `DELETE FROM \`job_card_checklist\` WHERE job_card_id = ${n} AND status = 'pending';`,
    ...(items.length ? [`INSERT INTO \`job_card_checklist\` (job_card_id, item, status) VALUES ${items.map(t => `(${n}, ${q(t)}, 'pending')`).join(', ')};`] : []),
    'COMMIT;'].join('\n'));
  note(n, line(user.name, 60), {});
  live.tick();
  return { id: n, total, free: claim ? { slot, waived } : null };
}

// one photo of step 4 (the app compresses it in the page to 800 px, JPEG 0.55; here it must be a JPEG under 2.5 MB)
async function photo(id, slot, b) {
  if (!PHOTOS.some(([k]) => k === slot)) throw fail(404, 'No such photo.');
  const c = await card(id); editable(c);
  const n = num(c.id), m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(b.data || ''));
  if (!m) throw fail(422, 'The photo did not come as a JPEG picture. Take it again.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 1000 || buf.length > 2.5e6 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw fail(422, 'The photo could not be read. Take it again.');
  const file = path.join(photoDir(), `${n}_${slot}.jpg`), tmp = path.join(photoDir(), `.${n}_${slot}.${crypto.randomBytes(5).toString('hex')}.part`);
  try { fs.writeFileSync(tmp, buf, { mode: 0o644 }); fs.renameSync(tmp, file); }
  catch (e) { try { fs.unlinkSync(tmp); } catch { /* not made */ } throw fail(424, `The photo could not be saved in the service app's photo folder (${e.code || e.message}). Send a screenshot of this to Sam.`); }
  return { slot, kb: Math.round(buf.length / 1024) };
}

// step 4 of the app (service-book-process4.php): the odometer, the fuel, the photos, then the customer's WhatsApp and SMS
async function inspect(user, id, b) {
  await ready();
  const c = await card(id); editable(c);
  const n = num(c.id), odo = String(b.odo ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
  if (!num(odo)) throw fail(422, 'Type the odometer reading.');
  const kmv = num(b.km), km = kmv > 0 ? Math.floor(kmv) : null, fuel = Math.max(0, Math.min(100, Math.round(num(b.fuel) / 5) * 5));
  if (!String(c.svc || '').trim()) throw fail(409, 'Save the services first (step 2).');
  const have = photosOf(n), miss = PHOTOS.filter(([k]) => !have[k]).map(([k]) => k);
  if (miss.includes('odo')) throw fail(422, 'Take the odometer photo.');
  if (miss.length) throw fail(422, `Take all 4 photos of the bike (${4 - miss.length}/4 done).`);
  const now = C.now();
  await mysql(`UPDATE \`job_card\` SET odo_reading = ${q(odo)}, daily_km_avg = ${km === null ? 'NULL' : km}, fuel_level = ${q(fuel)}, fuel_label = ${q(fuelLabel(fuel))}, ` +
    `dents_scratches = issue_reported, image1 = ${q(`uploads/jc/${n}_odo.jpg`)}, image2 = ${q(`uploads/jc/${n}_s1.jpg`)}, status = 'PENDING', approval = 'PENDING', ` +
    `dd = ${q(pad(now.getDate()))}, mm = ${q(pad(now.getMonth() + 1))}, yy = ${q(now.getFullYear())}, created_at = ${q(ymdHis(now))} ` +
    `WHERE id = ${n} AND user_id = ${q(c.u)} AND approval = 'PENDING';`);
  note(n, line(user.name, 60), { done_at: C.stamp(now), sent: JSON.stringify({ state: 'sending', at: C.stamp(now) }) });
  live.tick();
  const adv = await advisorOf(user).catch(() => null);
  send(n, { name: adv ? adv.n : line(user.name, 60) || 'Bike Surgeon', phone: adv ? adv.raw : '' }).catch(e => console.error('New job card, WhatsApp:', e.message));
  return { id: n };
}
// "Send again" (only when the details did not go)
async function resend(user, id) {
  const nt = noteOf(Math.floor(Number(id)));
  if (!nt || !nt.done) throw fail(409, 'This job card was not finished here.');
  if (nt.sent && (nt.sent.state === 'sending' || (nt.sent.details && nt.sent.details.ok))) throw fail(409, nt.sent.state === 'sending' ? 'It is being sent now.' : 'The WhatsApp already went.');
  const c = await card(id), n = num(c.id), adv = await advisorOf(user).catch(() => null);
  note(n, line(user.name, 60), { sent: JSON.stringify({ state: 'sending', at: C.stamp(C.now()) }) });
  send(n, { name: adv ? adv.n : line(user.name, 60) || 'Bike Surgeon', phone: adv ? adv.raw : '' }).catch(e => console.error('New job card, WhatsApp:', e.message));
  return { id: n };
}

// ---------------- the customer's WhatsApp (SmartPing) and SMS (Fast2SMS), word for word the app's ----------------------------
async function messageData(n, adv) {
  const d = (await rows(`SELECT ${J({ id: 'jc.id', n: 'jc.name', un: 'u.username', ph: 'u.userphone', p: 'jc.vehicle_number', mk: 'jc.make', mo: 'jc.model', pkg: 'jc.service_package',
    it: 'jc.issue_text', dl: 'jc.delivery_time', km: 'jc.odo_reading', fu: 'jc.fuel_level', fl: 'jc.fuel_label' })} FROM \`job_card\` jc LEFT JOIN \`user\` u ON u.id = jc.user_id WHERE jc.id = ${n};`))[0];
  if (!d) throw new Error('job card not found');
  const lab = await rows(`SELECT ${J({ n: 'labour_name', p: 'labour_price' })} FROM \`job_labour_items\` WHERE job_card_id = ${n} ORDER BY id ASC;`);
  const items = lab.map(x => ({ name: String(x.n ?? ''), price: num(x.p) }));
  const dl = parseWhen(d.dl);
  return { id: n, name: d.n != null ? String(d.n) : d.un != null ? String(d.un) : 'Customer', phone: String(d.ph ?? ''), reg: String(d.p ?? '').toUpperCase(),
    makeModel: `${d.mk ?? ''} ${d.mo ?? ''}`.trim(), cc: String(d.pkg ?? '').toUpperCase(), odo: String(d.km ?? ''), fuel: String(d.fu ?? ''), fuelLabel: String(d.fl ?? ''),
    issue: String(d.it ?? ''), items, total: items.reduce((a, x) => a + x.price, 0), delivery: dl ? dMYA(dl) : '', advName: adv.name, advPhone: adv.phone };
}
const priceStr = x => x.price > 0 ? 'Rs.' + nf(x.price) : (/FREE SERVICE/i.test(x.name) ? 'FREE' : 'As applicable');
// the 9 values of the "full details job card" template (bikesurgeon_build_jobcard_template_params)
function params(d, now) {
  const p4 = [d.reg, d.makeModel, ...(d.cc ? [d.cc] : []), nf(d.odo) + ' km', `${d.fuel}% (${d.fuelLabel})`].join(' | ');
  let p5 = '-';
  if (d.issue.trim()) { const f = d.issue.trim().replace(/[\r\n\t]+/g, ' | ').replace(/ {5,}/g, '    '); if (f !== '') p5 = 'Complaint: ' + f; }
  let p6 = '-';
  if (d.items.length) { p6 = 'Services: ' + d.items.map(x => `${x.name} - ${priceStr(x)}`).join(' | '); if (d.total > 0) p6 += ' | Total: Rs.' + nf(d.total); }
  return [String(d.id), dMYA(now), `${d.name} | ${d.phone}`, p4, p5, p6, d.delivery ? 'Expected Delivery: ' + d.delivery : '-', d.advName, d.advPhone || '-'];
}
// the SMS (bikesurgeon_build_jobcard_message)
function smsText(d, now) {
  const L = '----------------------------------';
  let m = `JOB CARD #${d.id} - BIKE SURGEON\nDate: ${dMYA(now)}\n${L}\nCUSTOMER DETAILS\nName    : ${d.name}\nPhone   : ${d.phone}\n${L}\nVEHICLE DETAILS\n` +
    `Reg No  : ${d.reg}\nVehicle : ${d.makeModel}\n${d.cc ? `Engine  : ${d.cc}\n` : ''}ODO     : ${nf(d.odo)} km\nFuel    : ${d.fuel}% (${d.fuelLabel})\n${L}\n`;
  if (d.issue) m += `CUSTOMER COMPLAINT\n${d.issue}\n${L}\n`;
  if (d.items.length) {
    m += 'SERVICES REQUESTED\n' + d.items.map((x, i) => `${i + 1}. ${x.name} - ${priceStr(x)}\n`).join('');
    if (d.total > 0) m += `Est. Labour Total: Rs.${nf(d.total)}\n`;
    m += `${L}\n`;
  }
  if (d.delivery) m += `Expected Delivery: ${d.delivery}\n${L}\n`;
  m += `Service Adviser : ${d.advName}\n${d.advPhone ? `Adviser Contact : ${d.advPhone}\n` : ''}Workshop        : Bike Surgeon, Davanagere\n${L}\n` +
    `Vehicle condition photos are attached.\nPlease verify and keep for your records.\n${L}\n` +
    'Please note: our team takes a lunch break from 1:30 PM to 2:30 PM daily. Vehicles will not be serviced during this time. Feel free to reach out with any queries after 2:30 PM.\n' +
    `${L}\nTo watch the live stream of your bike service, download the Bike Surgeon app:\nAndroid : https://play.google.com/store/apps/details?id=com.bikesurgeonapp.user\n` +
    `iPhone  : https://apps.apple.com/in/app/bike-surgeon/id6753989854\n${L}\nThank you for choosing Bike Surgeon.`;
  return m;
}
// smartping_send of whatsapp-config.php
async function waSend(campaign, phone, userName, values, media) {
  const d = String(phone ?? '').replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return { ok: false, http: 0, response: '', error: `Invalid phone number '${phone}'` };
  if (!waKey()) return { ok: false, http: 0, response: '', error: 'SmartPing API key not set' };
  const body = { apiKey: waKey(), campaignName: campaign, destination: '+91' + d, userName: userName !== '' ? userName : 'Customer', source: 'job-card-created',
    templateParams: values.map(v => String(v)), ...(media ? { media } : {}) };
  try {
    const r = await fetch(WA_URL(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    let ok = r.status >= 200 && r.status < 300, j = null;
    try { j = JSON.parse(text); } catch { /* not JSON */ }
    if (j && typeof j === 'object') {
      if (j.success === false || j.success === 'false') ok = false;
      if (!empty(j.error) || !empty(j.errorMessage)) ok = false;
      if (j.status !== undefined && j.status !== null && ['error', 'failed', 'failure'].includes(String(j.status).toLowerCase())) ok = false;
    }
    const why = j && typeof j === 'object' ? line(j.errorMessage || j.error || j.message || '', 160) : '';
    return { ok, http: r.status, response: text, error: ok ? '' : 'SmartPing rejected the message' + (why ? ': ' + why : ` (HTTP ${r.status})`) };
  } catch (e) { return { ok: false, http: 0, response: '', error: 'Network error: ' + line(e.message, 160) }; }
}
async function waLog(n, campaign, phone, r) {
  try {
    await mysql('INSERT INTO `whatsapp_send_log` (job_card_id, campaign, phone, ok, http_code, response, error, sent_at) ' +
      `VALUES (${n}, ${q(campaign)}, ${q(phone)}, ${r.ok ? 1 : 0}, ${Math.floor(r.http) || 0}, ${q(Array.from(String(r.response || '')).slice(0, 2000).join(''))}, ${q(String(r.error || '').slice(0, 250))}, NOW());`);
  } catch (e) { if (!waLog.told) { waLog.told = true; console.error('New job card: whatsapp_send_log not written:', e.message); } }
}
// sendSMS of sms_helper.php
async function smsSend(phone, message) {
  const d = String(phone ?? '').trim().replace(/^\+?91/, '').replace(/\D/g, '');
  if (d.length !== 10 || !smsKey()) return false;
  const u = SMS_URL() + '?' + new URLSearchParams({ authorization: smsKey(), route: 'v', message, numbers: d, flash: '0' }).toString();
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);
    return !!(j && j.return === true);
  } catch { return false; }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function send(n, adv) {
  const S = { state: 'done', at: C.stamp(C.now()), details: null, photos: { ok: 0, of: 0 }, sms: smsKey() ? false : 'off' };
  try {
    const d = await messageData(n, adv), now = C.now();
    if (d.phone) {
      const r = await waSend(WA_DETAILS(), d.phone, d.name, params(d, now));
      await waLog(n, WA_DETAILS(), d.phone, r);
      S.details = { ok: r.ok, err: r.error };
      console.log(`New job card #${n}: details WhatsApp ${r.ok ? 'OK' : 'FAILED: ' + r.error}`);
      if (r.ok || r.http !== 0 || waKey()) {
        await wait(400);
        const have = photosOf(n);
        for (const [k, label] of PHOTOS) {
          if (!have[k]) continue;
          S.photos.of++;
          const file = `${n}_${k}.jpg`, rp = await waSend(WA_PHOTO(), d.phone, d.name, [String(n)], { url: `${PHOTO_BASE()}/${file}`, filename: file });
          await waLog(n, `${WA_PHOTO()} (${label})`, d.phone, rp);
          if (rp.ok) S.photos.ok++; else S.photos.err = rp.error;
          await wait(400);
        }
      }
      if (smsKey()) S.sms = await smsSend(d.phone, smsText(d, now));
    } else S.details = { ok: false, err: 'The customer has no mobile number in the billing.' };
  } catch (e) { S.details = S.details || { ok: false, err: line(e.message, 200) }; }
  finally { note(n, null, { sent: JSON.stringify(S) }); }
}

// ---------------- the routes (before the panel's "read only" rule) ------------------------------------------------------------
function routes(app, requireUser) {
  const wrap = fn => (req, res) => Promise.resolve().then(() => fn(req)).then(v => res.json(v), e => {
    const status = e.status && e.status < 500 ? e.status : 500;
    if (status === 500) console.error('New job card:', e);
    res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : e.message });
  });
  const body = req => (req.body && typeof req.body === 'object' ? req.body : {});
  app.get('/api/newjc/boot', requireUser, wrap(req => boot(req.user)));
  app.get('/api/newjc/find', requireUser, wrap(req => find(req.query || {})));
  app.post('/api/newjc/start', requireUser, wrap(req => startCard(req.user, body(req))));
  app.get('/api/newjc/:id', requireUser, wrap(req => stateOf(req.params.id)));
  app.post('/api/newjc/:id/vehicle', requireUser, wrap(req => setVehicle(req.user, req.params.id, body(req))));
  app.post('/api/newjc/:id/services', requireUser, wrap(req => services(req.user, req.params.id, body(req))));
  app.post('/api/newjc/:id/photo/:slot', requireUser, wrap(req => photo(req.params.id, req.params.slot, body(req))));
  app.post('/api/newjc/:id/inspect', requireUser, wrap(req => inspect(req.user, req.params.id, body(req))));
  app.post('/api/newjc/:id/resend', requireUser, wrap(req => resend(req.user, req.params.id)));
}

module.exports = { on, routes, _: { params, smsText, freeStatus, slotOf, fuelLabel, q, dmyA, dMYA, cut } };
