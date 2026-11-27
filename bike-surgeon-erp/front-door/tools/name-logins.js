// Name-wise logins (Sam, 26 Nov 2026): every staff member signs in with their own mobile number and password, and is
// their own person inside every panel of their role, exactly as in the panels' staff list (STAFF-AND-LOGINS.md):
// the demo people of the zip (Misba 98111 20456 ...) become the real people (same name, same role, their own number).
//
//   node --env-file=.env tools/name-logins.js --people people.json --dirs dirs.json --out FILE --backup DIR [--dry] [--reset key,key | all]
//   node --env-file=.env tools/name-logins.js --undo DIR      (puts every login and every panel account back as in that backup)
//   node --env-file=.env tools/name-logins.js --old-off       (switches off the older logins of the staff who have a name-wise login)
//
// people.json: the attendance app's staff list (tools/att-people.php): users (id, name, mobile, status), admins (owners).
// dirs.json:   {"admin": "/path/of/the/admin/panel", "cashier": "...", ...} (the folder each panel runs in).
// For each person and each panel of their role it finds that panel's account (by their number, else the demo person's
// number, else the name) and sets their number, role, PIN and switches it on; a missing one is added. Then the person
// gets one front-door login (mobile number + password) with all those panels, their own panel first. The new password
// and PIN go only to --out (root only). Running it again keeps everyone's password and PIN (--reset gives new ones).
// The older logins of these people (misba@gmail.com, sultan@gmail.com ...) keep working, so nobody is locked out before
// they have their new login; they now open the panels as the real person. --old-off switches them off (later, when
// everyone uses the new login). Owner logins and the shared counter logins stay as they are. Before any change every
// database is copied to --backup (--undo DIR brings it back). Nothing secret is printed: no PIN, password or full number.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { ALL } = require('../server/portals');
const gate = require('../server/index');

// ---------------- who works where (from each panel's own staff list in the zip) ----------------------------------------
// from: ['admin' | 'staff', id in the attendance app, a word that must be in that name]; sample: the demo phone of the zip.
// panels: [panel, role in that panel, extra columns], in the order of the menu (the first one opens after sign in).
const C1 = 'C1', C2 = 'C2', C3 = 'C3', C4 = 'C4';
const counterStaff = (key, name, id, word, sample, ctr, alias = []) => ({ key, name, from: ['staff', id, word], sample, alias,
  panels: [['counter', 'staff', { counter: ctr }], ['inventory', 'counter', { ctr }], ['maintainer', 'counter', { ctr }],
    ['supervisor', 'staff', { counter: ctr }], ['accounts', 'cashier', { business: 'bs' }]] });
const OWNER_PANELS = [['admin', 'owner', { business: 'both' }], ['cashier', 'owner'], ['inventory', 'owner'], ['floor', 'owner'],
  ['maintainer', 'as:sultan'], ['desk', 'as:ganesh'], ['accounts', 'owner', { business: 'both' }], ['counter', 'owner'],
  ['spares', 'owner'], ['supervisor', 'owner'], ['motolab', 'owner']];   // as: the Maintainer and Workshop desk have no owner role
const PEOPLE = [
  { key: 'saddam', name: 'Saddam', from: ['admin', 5, 'saddam'], sample: '9820000111', owner: true, alias: ['owner', 'saddam (owner)'], panels: OWNER_PANELS },
  { key: 'ramzan', name: 'Ramzan', from: ['admin', 4, 'ramzan'], sample: '', owner: true, alias: [], panels: OWNER_PANELS },
  { key: 'sajiya', name: 'Sajiya Banu', from: ['staff', 57, 'sajiya'], sample: '9820000222', alias: ['accountant', 'sajya', 'sajiya'],
    panels: [['accounts', 'accountant', { business: 'both' }], ['inventory', 'accountant'], ['cashier', 'accountant'], ['admin', 'accountant', { business: 'both' }], ['motolab', 'accountant']] },
  { key: 'ganesh', name: 'Ganesh', from: ['staff', 18, 'ganesh'], sample: '9876543210', alias: [],
    panels: [['spares', 'manager'], ['inventory', 'manager'], ['admin', 'manager', { business: 'bs' }], ['cashier', 'manager'], ['desk', 'manager'],
      ['accounts', 'manager', { business: 'bs' }], ['counter', 'manager'], ['supervisor', 'manager']] },
  { key: 'nagaraj', name: 'Nagaraj', from: ['staff', 12, 'nagaraj'], sample: '9876543211', alias: ['nagaraja'],
    panels: [['supervisor', 'supervisor'], ['inventory', 'supervisor'], ['counter', 'supervisor'], ['spares', 'supervisor'], ['maintainer', 'supervisor']] },
  { key: 'sultan', name: 'Sultan Yattina Halli', from: ['staff', 19, 'sultan'], sample: '9876543212', alias: ['sultan'],
    panels: [['floor', 'service_manager'], ['maintainer', 'manager'], ['desk', 'viewer'], ['cashier', 'smgr'], ['admin', 'service', { business: 'bs' }]] },
  { key: 'misba', name: 'Misba', from: ['staff', 47, 'misba'], sample: '9811120456', alias: [],
    panels: [['cashier', 'cashier'], ['inventory', 'cashier'], ['admin', 'reception', { business: 'bs' }], ['accounts', 'cashier', { business: 'bs' }]] },
  { key: 'sharath', name: 'Sharath', from: ['staff', 34, 'sharath'], sample: '9819033871', alias: [],
    panels: [['floor', 'service_advisor'], ['cashier', 'advisor'], ['maintainer', 'advisor']] },
  { key: 'syed', name: 'Syed Shahid', from: ['staff', 61, 'shahid'], sample: '9819033872', alias: [],
    panels: [['floor', 'service_advisor'], ['cashier', 'advisor'], ['maintainer', 'advisor'], ['admin', 'advisor', { business: 'bs' }]] },
  { key: 'yaseenraza', name: 'Yaseen Raza', from: ['staff', 63, 'raza'], sample: '9819033873', alias: [],
    panels: [['floor', 'service_advisor'], ['cashier', 'advisor'], ['maintainer', 'advisor']] },
  { key: 'prasad', name: 'Prasad', from: ['staff', 51, 'prasad'], sample: '9845012233', alias: [],
    panels: [['maintainer', 'maintainer'], ['inventory', 'store']] },
  { key: 'saniya', name: 'Saniya', from: ['staff', 48, 'saniya'], sample: '9741100222', alias: [],
    panels: [['desk', 'desk'], ['maintainer', 'desk'], ['cashier', 'desk'], ['counter', 'staff', { counter: 'WS' }], ['supervisor', 'staff', { counter: 'WS' }],
      ['accounts', 'cashier', { business: 'bs' }]] },
  { key: 'shoukat', name: 'Shoukat', from: ['staff', 17, 'showkhath'], sample: '9741100227', alias: ['showkhath'],
    panels: [['counter', 'staff', { counter: C2 }], ['inventory', 'counter', { ctr: C2 }], ['desk', 'backup'], ['maintainer', 'counter', { ctr: C2 }],
      ['supervisor', 'staff', { counter: C2 }], ['accounts', 'cashier', { business: 'bs' }]] },
  counterStaff('radhika', 'Radhika', 70, 'radhika', '9741100225', C1),
  counterStaff('manjula', 'Manjula', 52, 'manjula', '9741100226', C2, ['majula']),
  counterStaff('taslim', 'Taslim', 56, 'taslim', '9741100228', C3, ['thaslim']),
  counterStaff('yaseenkhatib', 'Yaseen Khatib', 10, 'khatib', '9741100229', C3),
  counterStaff('nazneen', 'Nazneen', 30, 'nazneen', '9741100221', C4, ['nazeen']),
  { key: 'mehek', name: 'Mehek Taj', from: ['staff', 24, 'meh'], sample: '9845000333', alias: ['mehek', 'mehak', 'mehak taj'],
    panels: [['motolab', 'manager'], ['inventory', 'store'], ['accounts', 'manager', { business: 'ml' }]] },
];
// the database file of each panel inside its folder (DB_FILE in that folder's .env wins)
const DBFILE = { admin: 'admin.db', accounts: 'accounts.db', cashier: 'cashier.db', counter: 'counter.db', desk: 'desk.db', floor: 'portal.db',
  maintainer: 'desk.db', spares: 'spares.db', supervisor: 'supervisor.db', motolab: 'motolab.db', inventory: 'inventory.db' };
const PLACEHOLDER = new Set(['accountant', 'owner', 'saddam (owner)']);   // demo names that become the person's own name
// The panels send to each other signed in as a demo person of the zip (run-together/env: ACCT_PHONE = the Accountant in
// the Accountant panel, for the Cashier, Counter, Supervisor, Moto Lab and Inventory; SPARES_PHONE = Nagaraj in the Spares
// manager, for the Supervisor). Those accounts keep their number and PIN as the link (renamed, so the name is free), and
// the real person gets an own account next to it. The numbers are also read from each panel's .env.
const LINK_OF = { ACCT_PHONE: ['accounts', 'Panels link', 'portal'], SPARES_PHONE: ['spares', 'Supervisor panel link', ''] };
const LINK_DEMO = [['ACCT_PHONE', '9820000222'], ['SPARES_PHONE', '9876543211']];
const tableOf = portal => (portal === 'floor' ? 'users' : 'accounts');

// ---------------- small helpers -------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? String(args[i + 1] || '') : ''; };
const DRY = args.includes('--dry');
const RESET = new Set(arg('--reset').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const reset = k => RESET.has('all') || RESET.has(k);
const say = s => process.stdout.write(s + '\n');
const stop = s => { say(s); process.exit(1); };
const env = k => String(process.env[k] || '').trim();
const digits = s => String(s || '').replace(/\D/g, '');
const phone10 = s => { let d = digits(s); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); if (d.length === 11 && d.startsWith('0')) d = d.slice(1); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
const words = s => String(s || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const mask = p => 'xxxxxx' + String(p).slice(-4);
const show = p => String(p).replace(/(\d{5})(\d{5})/, '$1 $2');
const hashPin = pin => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(String(pin), salt, 32).toString('hex')}`; };
const ist = (t = Date.now()) => { const d = new Date(new Date(t).getTime() + 5.5 * 36e5), p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
const rnd = n => crypto.randomInt(n);
function newPin(avoid) {
  for (;;) {
    const p = String(rnd(10000)).padStart(4, '0');
    if (new Set(p).size < 3 || '0123456789'.includes(p) || '9876543210'.includes(p) || avoid.has(p) || /^(19|20)\d\d$/.test(p)) continue;
    avoid.add(p);
    return p;
  }
}
function newPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz', d = '23456789';
  return [0, 1, 2, 3].map(() => a[rnd(a.length)]).join('') + [0, 1, 2, 3].map(() => d[rnd(d.length)]).join('');
}
// a panel's files belong to that panel's user: run as root, the tool opens each database as its owner, so the files
// SQLite adds next to it (-wal, -shm) stay that user's
function asOwner(file, fn) {
  if (typeof process.geteuid !== 'function' || process.geteuid() !== 0) return fn();
  const st = fs.statSync(file); if (st.uid === 0) return fn();
  process.setegid(st.gid); process.seteuid(st.uid);
  try { return fn(); } finally { process.seteuid(0); process.setegid(0); }
}
// back to root for a moment inside asOwner (the passwords file is in /root)
function asRoot(fn) {
  if (typeof process.geteuid !== 'function' || process.getuid() !== 0 || process.geteuid() === 0) return fn();
  const u = process.geteuid(), g = process.getegid();
  process.seteuid(0); process.setegid(0);
  try { return fn(); } finally { process.setegid(g); process.seteuid(u); }
}
function dbFileOf(portal, dir) {
  let f = '';
  try { const m = fs.readFileSync(path.join(dir, '.env'), 'utf8').match(/^DB_FILE=(.*)$/m); if (m) f = m[1].trim().replace(/^["']|["']$/g, ''); } catch { /* no .env */ }
  return f ? path.resolve(dir, f) : path.join(dir, 'data', DBFILE[portal]);
}
const cols = (D, t) => D.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
const hasTable = (D, t) => !!D.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
// is the name of an account unique in this panel (most panels: it is shown on bills and used for PIN checks)?
const uniqueName = (D, t) => D.prepare(`PRAGMA index_list(${t})`).all().some(ix => ix.unique &&
  (c => c.length === 1 && c[0].name === 'name')(D.prepare(`PRAGMA index_info(${JSON.stringify(ix.name)})`).all()));
const sessCol = D => (hasTable(D, 'sessions') ? cols(D, 'sessions').find(c => c === 'account_id' || c === 'user_id') : '');

const frontFile = arg('--front') || env('DB_FILE') || path.join(__dirname, '..', 'data', 'front.db');
if (!env('GATE_KEY')) stop('GATE_KEY is not in .env: run it from the front-door folder with --env-file=.env. Nothing changed.');
if (!fs.existsSync(frontFile)) stop(`The front door database was not found (${frontFile}). Nothing changed.`);

// ---------------- backup and undo --------------------------------------------------------------------------------------
// every database is copied whole (VACUUM INTO: a clean copy while the panels keep running) into DIR, plus manifest.json
function backup(dir, files) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
  const list = {};
  for (const [k, file] of files) {
    const tmp = path.join(path.dirname(file), `.names-backup-${process.pid}-${k}.db`);
    fs.rmSync(tmp, { force: true });
    asOwner(file, () => { const D = new DatabaseSync(file, { readOnly: true }); try { D.exec('PRAGMA busy_timeout = 8000'); D.prepare('VACUUM INTO ?').run(tmp); } finally { D.close(); } });
    const to = path.join(dir, k + '.db');
    try { fs.renameSync(tmp, to); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(tmp, to); fs.rmSync(tmp, { force: true }); }
    if (process.geteuid && process.geteuid() === 0) fs.chownSync(to, 0, 0);
    fs.chmodSync(to, 0o600);
    const B = new DatabaseSync(to, { readOnly: true });   // the copy must open and hold the accounts
    try { if (!hasTable(B, k === 'front' ? 'logins' : tableOf(k))) throw new Error(`the copy of ${k} has no accounts`); } finally { B.close(); }
    list[k] = file;
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), files: list }, null, 1), { mode: 0o600 });
}
// undo: the account tables of every panel and the logins of the front door get the rows of the backup again
function undo(dir) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const keys = Object.keys(man.files).sort((a, b) => (a === 'front') - (b === 'front'));   // the front door last
  let bad = 0;
  for (const k of keys) {
    const file = man.files[k], tables = k === 'front' ? ['logins', 'panels', 'people'] : [tableOf(k)];
    try {
      const B = new DatabaseSync(path.join(dir, k + '.db'), { readOnly: true });
      const saved = {};
      try { for (const t of tables) saved[t] = hasTable(B, t) ? { cols: cols(B, t), rows: B.prepare(`SELECT * FROM ${t}`).all() } : { cols: [], rows: [] }; } finally { B.close(); }
      asOwner(file, () => {
        const D = new DatabaseSync(file, { enableForeignKeyConstraints: false });
        try {
          D.exec('PRAGMA busy_timeout = 8000; BEGIN IMMEDIATE');
          try {
            for (const t of tables) {
              if (!hasTable(D, t)) continue;
              const c = cols(D, t).filter(x => saved[t].cols.includes(x));
              if (k !== 'front') {   // panel sessions of every account that changed (or was added) start again
                const sc = sessCol(D), was = new Map(saved[t].rows.map(r => [r.id, r]));
                for (const r of D.prepare(`SELECT * FROM ${t}`).all()) {
                  const o = was.get(r.id);
                  if (sc && (!o || c.some(x => String(o[x]) !== String(r[x])))) D.prepare(`DELETE FROM sessions WHERE ${sc} = ?`).run(r.id);
                }
              }
              D.prepare(`DELETE FROM ${t}`).run();
              if (!saved[t].rows.length || !c.length) continue;   // the backup had none (people: older front door)
              const ins = D.prepare(`INSERT INTO ${t} (${c.join(', ')}) VALUES (${c.map(() => '?').join(', ')})`);
              for (const r of saved[t].rows) ins.run(...c.map(x => r[x] ?? null));
            }
            if (k === 'front') {
              D.prepare('DELETE FROM sessions WHERE login_id NOT IN (SELECT id FROM logins WHERE active = 1)').run();
              D.prepare("UPDATE sessions SET cookies = '{}'").run();
              D.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'name-logins', `Undo: logins put back as on ${man.at}`);
            }
            D.exec('COMMIT');
          } catch (e) { D.exec('ROLLBACK'); throw e; }
        } finally { D.close(); }
      });
      say(`OK       ${k === 'front' ? 'Front door logins' : ALL[k] ? ALL[k].name : k}: put back`);
    } catch (e) { bad++; say(`FAILED   ${k}: ${e.message}`); }
  }
  say(bad ? `${bad} problem(s): see the FAILED lines.` : `Everything is back as on ${ist(man.at)} IST. The new passwords and PINs of that run do not work any more.`);
  // the passwords file says which of its blocks no longer works (each block names its backup)
  const out = arg('--out');
  if (!bad && out && fs.existsSync(out)) asRoot(() => fs.appendFileSync(out, `(Undo ${ist()} IST: the block "backup ${path.basename(dir)}" above was taken back. Its passwords and PINs do not work any more.)\n\n`));
  process.exitCode = bad ? 2 : 0;
}
// the older logins of staff who now have a name-wise login: not an owner login, not name-wise, and it opens a panel as that
// person or carries their name (misba@gmail.com "Misba", nagaraj@gmail.com "Nagaraj (supervisor)", accountant@ ...)
const plain = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z]+/g, ' ').trim();
function oldLogins(D, persons) {   // persons: [{ name, phone, names: [...] }]
  const out = [];
  for (const l of D.prepare('SELECT * FROM logins WHERE active = 1 AND owner = 0 AND person IS NULL ORDER BY id').all()) {
    const rows = D.prepare('SELECT phone FROM panels WHERE login_id = ?').all(l.id);
    const as = persons.filter(p => rows.some(r => r.phone === p.phone) || p.names.includes(plain(l.name)));
    if (as.length) out.push({ l, as });
  }
  return out;
}
const namesOf = p => [p.name, ...p.alias].map(plain);
if (args.includes('--old-off')) {
  const D = asOwner(frontFile, () => { const d = gate.open(frontFile); d.prepare('SELECT count(*) n FROM logins').get(); return d; });
  const persons = D.prepare('SELECT * FROM logins WHERE person IS NOT NULL AND active = 1').all()
    .map(l => ({ l, def: PEOPLE.find(p => p.key === l.person) })).filter(x => x.def).map(x => ({ name: x.l.name, phone: x.l.phone, names: namesOf(x.def) }));
  if (!persons.length) stop('There are no name-wise logins yet. Nothing changed.');
  const list = oldLogins(D, persons);
  asOwner(frontFile, () => {
    D.exec('BEGIN IMMEDIATE');
    try {
      for (const { l, as } of list) {
        D.prepare('UPDATE logins SET active = 0 WHERE id = ?').run(l.id);
        D.prepare('DELETE FROM sessions WHERE login_id = ?').run(l.id);
        D.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'name-logins', `Switched off ${l.email || l.name}: ${as.map(p => p.name).join(', ')} uses the name-wise login`);
      }
      D.exec('COMMIT');
    } catch (e) { D.exec('ROLLBACK'); throw e; }
  });
  D.close();
  for (const { l, as } of list) say(`OFF      ${l.email || mask(l.phone)} (${l.name}): ${as.map(p => p.name).join(', ')} now signs in with their own mobile number`);
  say(list.length ? `${list.length} older login(s) switched off (they can be switched on again in Logins).` : 'No older staff login is on.');
  return;
}
if (arg('--undo')) { undo(arg('--undo')); return; }

// ---------------- 1. the real people (number from the attendance app) -------------------------------------------------
if (!arg('--people') || !arg('--dirs')) stop('Give --people FILE and --dirs FILE. Nothing changed.');
const src = JSON.parse(fs.readFileSync(arg('--people'), 'utf8'));
const dirs = JSON.parse(fs.readFileSync(arg('--dirs'), 'utf8'));
const out = arg('--out'), backupDir = arg('--backup');
if (!DRY && (!out || !backupDir)) stop('Give --out FILE (for the new passwords) and --backup DIR. Nothing changed.');
const people = [], problems = [];
for (const p of PEOPLE) {
  const list = p.from[0] === 'admin' ? src.admins || [] : src.users || [];
  const r = list.find(x => Number(x.id) === p.from[1]);
  const why = !r ? 'not in the attendance staff list' : !words(r.name).includes(p.from[2]) ? 'the attendance staff list has another name at that place'
    : (p.from[0] === 'admin' ? String(r.is_active) !== '1' : String(r.status) !== 'active') ? 'switched off in the attendance app'
    : !phone10(p.from[0] === 'admin' ? r.phone : r.mobile) ? 'no proper 10-digit mobile number in the attendance app' : '';
  if (why) { problems.push(`${p.name}: ${why}. No login made.`); continue; }
  people.push({ ...p, phone: phone10(p.from[0] === 'admin' ? r.phone : r.mobile) });
}
const byKey = Object.fromEntries(people.map(p => [p.key, p]));
const dup = people.find(p => people.some(q => q !== p && q.phone === p.phone));
if (dup) stop(`STOP: ${dup.name} has the same mobile number as someone else in the attendance app. Nothing changed.`);
if (!people.length) stop('STOP: nobody could be read from the attendance staff list. Nothing changed.');
// a real number that is also a demo number of the zip (shared counter logins ...) would mix two people up
const demoPhones = new Set([...PEOPLE.map(p => p.sample), ...Object.values(ALL).flatMap(x => x.people.map(y => y[1]))].filter(Boolean));
const clash = people.find(p => demoPhones.has(p.phone));
if (clash) stop(`STOP: ${clash.name}'s mobile number in the attendance app is one of the demo numbers. Nothing changed.`);

// the link accounts of the panels (see LINK_OF)
const links = {};   // portal -> Map(phone -> {name, role})
const linkAdd = (k, v) => { const [portal, name, role] = LINK_OF[k], d = phone10(v); if (d) (links[portal] = links[portal] || new Map()).set(d, { name, role }); };
for (const [k, v] of LINK_DEMO) linkAdd(k, v);
for (const dir of new Set(Object.values(dirs))) {
  let t = ''; try { t = fs.readFileSync(path.join(dir, '.env'), 'utf8'); } catch { continue; }
  for (const k of Object.keys(LINK_OF)) { const m = t.match(new RegExp(`^${k}=(.*)$`, 'm')); if (m) linkAdd(k, m[1].trim().replace(/^["']|["']$/g, '')); }
}
const linkClash = people.find(p => Object.values(links).some(m => m.has(p.phone)));
if (linkClash) stop(`STOP: ${linkClash.name}'s mobile number is the link login of the panels. Nothing changed.`);

// the panels and their databases
const files = [];   // [portal, file]
for (const portal of Object.keys(ALL)) {
  if (!people.some(p => p.panels.some(x => x[0] === portal))) continue;
  const file = dirs[portal] && dbFileOf(portal, dirs[portal]);
  if (file && fs.existsSync(file)) files.push([portal, file]);
}
if (!DRY) {
  try { backup(backupDir, [['front', frontFile], ...files]); }
  catch (e) { stop(`STOP: the backup did not work (${e.message}). Nothing changed.`); }
}

// ---------------- 2. front door: who already has a name-wise login (keeps password + PIN on a second run) -------------
// gate.open: the same table update as the front door; the first read is done as the owner too (it opens the -shm file)
const F = asOwner(frontFile, () => { const d = DRY ? new DatabaseSync(frontFile, { readOnly: true }) : gate.open(frontFile); d.prepare('SELECT count(*) n FROM logins').get(); return d; });
const personCol = cols(F, 'logins').includes('person');
const avoidPins = new Set(['1234', env('START_PIN'), ...Object.keys(process.env).filter(k => /^PIN_/.test(k)).map(env)]);
for (const p of people) {
  const own = personCol ? F.prepare('SELECT * FROM logins WHERE person = ?').get(p.key) : null;
  const l = own || (personCol ? F.prepare('SELECT * FROM logins WHERE phone = ? AND person IS NULL').get(p.phone) : null);
  p.login = l || null;
  p.pin = '';
  if (own && !reset(p.key)) {   // the PIN this person already has, read from one of their own panels
    for (const row of F.prepare('SELECT * FROM panels WHERE login_id = ?').all(own.id)) {
      try { if (row.phone === own.phone) { p.pin = gate.unseal(row.pin); break; } } catch { /* key changed */ }
    }
  }
  if (p.pin) avoidPins.add(p.pin);
}
for (const p of people) {
  p.fresh = !p.pin;   // a login that was not name-wise yet (made by hand with this number) gets its own PIN too
  if (!p.pin) p.pin = newPin(avoidPins);
  p.password = p.login && !reset(p.key) ? '' : newPassword();
}

// ---------------- 3. each panel: the person's own account (number, role, PIN, on) -------------------------------------
const results = {};    // key -> [{portal, ok, msg}]
const moves = [];      // [portal, old phone, new phone] for the front door's panel rows
const peopleRows = []; // [portal, phone, name, sample]
const note = (p, portal, ok, msg) => (results[p.key] = results[p.key] || []).push({ portal, ok, msg });
for (const portal of Object.keys(ALL)) {
  const who = people.filter(p => p.panels.some(x => x[0] === portal && !x[1].startsWith('as:')));
  if (!who.length) continue;
  const f = files.find(x => x[0] === portal);
  if (!f) { for (const p of who) note(p, portal, false, `${ALL[portal].name}: its database was not found`); continue; }
  const file = f[1], table = tableOf(portal);
  try {
    asOwner(file, () => {
      const D = new DatabaseSync(file, DRY ? { readOnly: true } : {});
      try {
        D.exec('PRAGMA busy_timeout = 8000');
        const has = new Set(cols(D, table)), uniq = uniqueName(D, table), sc = sessCol(D);
        if (!DRY) D.exec('BEGIN IMMEDIATE');
        try {
          for (const p of who) {
            const [, role, extra = {}] = p.panels.find(x => x[0] === portal);
            const names = [p.name, ...p.alias].map(n => n.toLowerCase());
            // the demo person's account is the link of the other panels here: it stays (renamed), the person gets an own one
            const link = p.sample && links[portal] && links[portal].get(p.sample);
            const L = link ? D.prepare(`SELECT * FROM ${table} WHERE phone = ?`).get(p.sample) : null;
            let linkNote = '';
            if (L && (PLACEHOLDER.has(String(L.name).toLowerCase().trim()) || names.includes(String(L.name).toLowerCase().trim()))) {
              let ln = link.name;
              for (let n = 2; D.prepare(`SELECT 1 FROM ${table} WHERE lower(name) = lower(?) AND id <> ?`).get(ln, L.id); n++) ln = `${link.name} ${n}`;
              if (!DRY) D.prepare(`UPDATE ${table} SET name = ?${link.role ? ', role = ?' : ''} WHERE id = ?`).run(...[ln, ...(link.role ? [link.role] : []), L.id]);
              linkNote = ` (the demo login ${L.name} stays as "${ln}", the link of the other panels)`;
            }
            let a = D.prepare(`SELECT * FROM ${table} WHERE phone = ?`).get(p.phone), how = 'own';
            if (!a && p.sample && !link) { a = D.prepare(`SELECT * FROM ${table} WHERE phone = ?`).get(p.sample); how = 'demo'; }
            if (!a) { a = D.prepare(`SELECT * FROM ${table} ORDER BY active DESC, id`).all().find(x => names.includes(String(x.name).toLowerCase().trim()) && !x.login && !(L && x.id === L.id)); how = 'name'; }
            // the name in the panel: the panel's own spelling stays (Sultan / Sultan Yattina Halli); a demo name becomes theirs
            let name = a && !PLACEHOLDER.has(String(a.name).toLowerCase().trim()) ? a.name : p.name;
            if (uniq && D.prepare(`SELECT 1 FROM ${table} WHERE lower(name) = lower(?) AND id <> ?`).get(name, a ? a.id : -1)) {
              if (!a) { note(p, portal, false, `${ALL[portal].name}: another account there is already called ${name}`); continue; }
              name = a.name;
            }
            const set = { name, phone: p.phone, role, pin_hash: hashPin(p.pin), active: 1 };
            if (has.has('business') && extra.business) set.business = extra.business;
            if (has.has('counter')) set.counter = extra.counter || null;
            if (has.has('ctr')) set.ctr = extra.ctr || (portal === 'inventory' ? '' : null);
            // the demo person of this panel, when the real person already had an own account there: switched off
            const demo = how === 'own' && p.sample && !link ? D.prepare(`SELECT * FROM ${table} WHERE phone = ? AND id <> ? AND active = 1`).get(p.sample, a.id) : null;
            if (!DRY) {
              if (a) {
                const k = Object.keys(set);
                D.prepare(`UPDATE ${table} SET ${k.map(c => c + ' = ?').join(', ')} WHERE id = ?`).run(...k.map(c => set[c]), a.id);
                if (sc && (a.role !== role || a.phone !== p.phone)) D.prepare(`DELETE FROM sessions WHERE ${sc} = ?`).run(a.id);
              } else {
                set.created_at = ist();
                const k = Object.keys(set);
                D.prepare(`INSERT INTO ${table} (${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`).run(...k.map(c => set[c]));
              }
              if (demo) {
                D.prepare(`UPDATE ${table} SET active = 0 WHERE id = ?`).run(demo.id);
                if (sc) D.prepare(`DELETE FROM sessions WHERE ${sc} = ?`).run(demo.id);
              }
            }
            for (const old of new Set([a && a.phone, p.sample].filter(x => x && x !== p.phone))) moves.push([portal, old, p.phone]);
            moves.push([portal, p.phone, p.phone]);
            peopleRows.push([portal, p.phone, name, p.sample && (how === 'demo' || demo || link) ? p.sample : a && a.phone !== p.phone ? a.phone : '']);
            const what = !a ? 'added' : how === 'demo' ? 'demo account made theirs' : 'their account updated';
            note(p, portal, true, `${ALL[portal].name}${ALL[portal].hidden ? ' (in the menu later)' : ''}: ${what} as ${name}, ${role}${extra.counter || extra.ctr ? ' ' + (extra.counter || extra.ctr) : ''}${demo ? ' (demo account switched off)' : ''}${linkNote}`);
          }
          if (!DRY) D.exec('COMMIT');
        } catch (e) { if (!DRY) D.exec('ROLLBACK'); throw e; }
      } finally { D.close(); }
    });
  } catch (e) {
    // a failed panel keeps its old data: its moves are taken back so the front door does not use the new PIN there
    for (let i = moves.length - 1; i >= 0; i--) if (moves[i][0] === portal) moves.splice(i, 1);
    for (let i = peopleRows.length - 1; i >= 0; i--) if (peopleRows[i][0] === portal) peopleRows.splice(i, 1);
    for (const p of who) {
      const r = (results[p.key] = results[p.key] || []);
      const x = r.find(y => y.portal === portal);
      if (!x) r.push({ portal, ok: false, msg: `${ALL[portal].name}: ${e.message}` });
      else if (x.ok) { x.ok = false; x.msg = `${ALL[portal].name}: not changed (${e.message})`; }
    }
  }
}

// ---------------- 4. front door: logins, their panels, who is who --------------------------------------------------------
const okIn = (p, portal) => (results[p.key] || []).some(x => x.portal === portal && x.ok);
const visible = p => p.panels.filter(x => okIn(p, x[0]) || (x[1].startsWith('as:') && byKey[x[1].slice(3)] && okIn(byKey[x[1].slice(3)], x[0])));
const listNames = (p, hidden) => visible(p).filter(x => !!ALL[x[0]].hidden === hidden).map(x => ALL[x[0]].name).join(', ');
let wroteOut = false;
function writeOut() {
  const made = people.filter(p => p.loginId && (p.password || p.fresh));
  const block = made.map(p => [
    p.name,
    '  Open:      https://panel.bikesurgeon.online',
    `  Mobile:    ${show(p.phone)}`,
    p.password ? `  Password:  ${p.password}   (after signing in: menu > Change my password)` : '  Password:  as before',
    `  PIN:       ${p.pin}   (only when a screen asks for your PIN, e.g. the counter closing)`,
    `  Panels:    ${listNames(p, false) || '-'}${listNames(p, true) ? `\n  Later:     ${listNames(p, true)}` : ''}`,
  ].join('\n')).join('\n\n');
  const head = `Bike Surgeon panel: name-wise logins · ${ist()} IST · backup ${path.basename(backupDir || '-')} · KEEP THIS FILE PRIVATE, send each person only their own part\n\n`;
  asRoot(() => {
    const fd = fs.openSync(out, 'a', 0o600); fs.writeSync(fd, head + (block || 'No new passwords this time (everyone keeps theirs).') + '\n\n'); fs.closeSync(fd);
    fs.chmodSync(out, 0o600);
  });
  wroteOut = true;
}
const stillOn = [], ownerAs = [];
try {   // (one transaction: on any error the panels go back to the backup too, see the end)
if (!DRY) asOwner(frontFile, () => {
  F.exec('BEGIN IMMEDIATE');
  try {
    // every login that signs in as a demo person who is now a real person: to the real person's number and PIN
    for (const [portal, from, to] of moves) {
      const p = people.find(x => x.phone === to);
      F.prepare('UPDATE panels SET phone = ?, pin = ? WHERE portal = ? AND phone = ?').run(to, gate.seal(p.pin), portal, from);
    }
    for (const [portal, phone, name, sample] of peopleRows) {
      F.prepare('DELETE FROM people WHERE portal = ? AND (phone = ? OR (name = ? AND phone <> ?))').run(portal, phone, name, phone);
      F.prepare('INSERT INTO people (portal, phone, name, sample) VALUES (?,?,?,?)').run(portal, phone, name, sample || '');
    }
    for (const p of [...people].sort((a, b) => (a.owner ? 1 : 0) - (b.owner ? 1 : 0))) {   // owners last: they use Sultan's and Ganesh's rows
      const rows = [];
      for (const [portal, role] of p.panels) {
        if (role.startsWith('as:')) {
          const o = byKey[role.slice(3)];
          if (o && okIn(o, portal)) rows.push([portal, o.phone, o.pin]);
          else note(p, portal, false, `${ALL[portal].name}: ${role.slice(3)} has no account there, so this panel cannot open yet`);
          continue;
        }
        if (okIn(p, portal)) rows.push([portal, p.phone, p.pin]);
      }
      if (!rows.length) { problems.push(`${p.name}: no panel could be set, no login made.`); continue; }
      let id = p.login && p.login.id;
      const other = F.prepare('SELECT id, name FROM logins WHERE phone = ? AND id IS NOT ?').get(p.phone, id ?? null);
      if (other) { problems.push(`${p.name}: their mobile number is already the login of "${other.name}". Change that login in Logins, then run this again.`); continue; }
      if (id) {
        F.prepare('UPDATE logins SET name = ?, phone = ?, person = ?, owner = ?, active = 1 WHERE id = ?').run(p.name, p.phone, p.key, p.owner ? 1 : 0, id);
        if (p.password) { F.prepare('UPDATE logins SET pass = ? WHERE id = ?').run(gate.hashPass(p.password), id); F.prepare('DELETE FROM sessions WHERE login_id = ?').run(id); }
      } else {
        id = Number(F.prepare('INSERT INTO logins (name, email, phone, pass, owner, active, created_at, person) VALUES (?,?,?,?,?,1,?,?)')
          .run(p.name, null, p.phone, gate.hashPass(p.password), p.owner ? 1 : 0, new Date().toISOString(), p.key).lastInsertRowid);
      }
      const keep = F.prepare('SELECT portal, phone, pin, pos FROM panels WHERE login_id = ?').all(id).filter(r => !ALL[r.portal]);   // a panel this tool does not know stays
      F.prepare('DELETE FROM panels WHERE login_id = ?').run(id);
      rows.forEach(([portal, phone, pin], i) => F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)').run(id, portal, phone, gate.seal(pin), i));
      for (const r of keep) F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)').run(id, r.portal, r.phone, r.pin, 100 + r.pos);
      p.loginId = id;
      F.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'name-logins', `Name-wise login ${p.login ? 'checked' : 'made'}: ${p.name}`);
    }
    // an owner login by email that carries an owner's name (ramzan@... "Ramzan"): opens that owner's own accounts from now on
    for (const p of people.filter(x => x.owner && x.loginId)) {
      for (const l of F.prepare('SELECT id, name, email, phone FROM logins WHERE owner = 1 AND person IS NULL').all()) {
        if (!namesOf(p).includes(plain(l.name))) continue;
        const was = F.prepare('SELECT portal, phone, pin, pos FROM panels WHERE login_id = ?').all(l.id);
        const mine = F.prepare('SELECT portal, phone, pin, pos FROM panels WHERE login_id = ? ORDER BY pos').all(p.loginId).filter(r => ALL[r.portal]);
        F.prepare('DELETE FROM panels WHERE login_id = ?').run(l.id);
        for (const r of [...mine, ...was.filter(r => !ALL[r.portal]).map(r => ({ ...r, pos: 100 + r.pos }))])
          F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)').run(l.id, r.portal, r.phone, r.pin, r.pos);
        if (mine.some(r => !was.some(w => w.portal === r.portal && w.phone === r.phone))) {
          ownerAs.push(`${l.email || mask(l.phone)} (${l.name}): owner login, now opens as ${p.name}`);
          F.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'name-logins', `Owner login ${l.email || l.name} now opens as ${p.name}`);
        }
      }
    }
    // the older logins of these people stay on (nobody is locked out): listed, switched off later with --old-off
    for (const { l, as } of oldLogins(F, people.filter(p => p.loginId).map(p => ({ name: p.name, phone: p.phone, names: namesOf(p) }))))
      stillOn.push(`${l.email || mask(l.phone)} (${l.name}): now opens as ${as.map(p => p.name).join(', ')}`);
    F.prepare("UPDATE sessions SET cookies = '{}'").run();   // every open screen signs in to the panels again with the new PINs
    writeOut();   // the new passwords are kept before the logins change, so none is ever lost
    F.exec('COMMIT');
  } catch (e) { try { F.exec('ROLLBACK'); } catch { /* not started */ } throw e; }
});
} catch (e) {
  // the panels were changed but the front door could not be: everything goes back to the backup, so no login breaks
  say(`FAILED   front door: ${e.message}. Everything is put back as before:`);
  try { F.close(); } catch { /* closed */ }
  undo(backupDir);
  if (wroteOut) try { fs.appendFileSync(out, '(The logins above were NOT made: an error put everything back. Ignore them.)\n\n'); } catch { /* no file */ }
  process.exit(3);
}
F.close();

// ---------------- 5. the report (the new passwords and PINs are only in --out) ---------------------------------------
say(`${DRY ? 'DRY RUN (nothing changed)' : 'Name-wise logins'}: ${people.length} people`);
for (const p of PEOPLE) {
  const q = byKey[p.key]; if (!q) continue;
  const r = results[q.key] || [];
  const bad = r.filter(x => !x.ok);
  const state = DRY ? '' : !q.loginId ? 'NO LOGIN' : q.password ? 'new password + PIN' : q.fresh ? 'password kept, new PIN' : 'password + PIN kept';
  say(`${bad.length || (!DRY && !q.loginId) ? 'FAILED ' : 'OK     '}  ${q.name.padEnd(21)} ${mask(q.phone)}  ${state}`);
  for (const x of bad) say(`          ${x.msg}`);
  if (DRY) for (const x of r.filter(y => y.ok)) say(`          ${x.msg}`);
}
for (const s of problems) say(`FAILED   ${s}`);
for (const s of ownerAs) say(`OK       ${s}`);
for (const s of stillOn) say(`STILL ON ${s}`);
if (stillOn.length && !DRY) say('         These older logins keep working until you switch them off: bash /root/bs-erp-update.sh old-off (or one by one in Logins).');
const failed = problems.length + people.reduce((n, p) => n + (results[p.key] || []).filter(x => !x.ok).length, 0);
say(failed ? `${failed} problem(s): see the FAILED lines.` : DRY ? 'Ready: nothing would fail.' : 'All name-wise logins are ready.');
process.exitCode = failed ? 2 : 0;
