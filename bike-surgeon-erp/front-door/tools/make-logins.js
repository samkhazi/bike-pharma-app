// Makes a front-door login for every active person on the Admin panel's Users page (Settings > Users), with the same
// email (Sam, 29 Oct). Owners get every panel; everyone else gets the panels where their name is one of that panel's
// people, opening first in their own panel (HOME). A new random password for each goes to STDOUT only, so run it as
//   node --env-file=.env tools/make-logins.js ../data/admin.db > /root/file      (from the front-door folder)
// Emails that already have a login are left as they are. Notes go to STDERR.
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { PORTALS, OWNER_AS, KEYS } = require('../server/portals');

const env = k => String(process.env[k] || '').trim();
const say = s => process.stderr.write(s + '\n');
const adminDb = process.argv[2];
if (!adminDb || !env('GATE_KEY')) { say('Usage: node --env-file=.env tools/make-logins.js <admin.db>  (GATE_KEY must be in .env)'); process.exit(1); }

// the panel each person works in, by first name (others: the first panel their name is found in)
const HOME = { mehek: 'motolab', sultan: 'floor', misba: 'cashier', saniya: 'desk', ganesh: 'spares', sharath: 'floor', syed: 'floor', yaseen: 'floor', manjula: 'counter', nazneen: 'counter', prasad: 'maintainer', nagaraj: 'supervisor' };
// counter staff sign in to the Counter panel as their counter (STAFF-AND-LOGINS.md: Manjula C2, Nazneen C4)
const COUNTER = { manjula: '9741100232', nazneen: '9741100234' };

const key = crypto.createHash('sha256').update(env('GATE_KEY')).digest();
function seal(pin) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(pin), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); }
const hashPass = p => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(String(p), salt, 32).toString('hex')}`; };
const pinOf = k => env('PIN_' + k.toUpperCase()) || env('START_PIN') || '1234';
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
const password = () => { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.randomBytes(10)].map(b => a[b % a.length]).join(''); };

const A = new DatabaseSync(adminDb, { readOnly: true });
const users = A.prepare("SELECT data FROM records WHERE collection = 'users' ORDER BY pos").all().map(r => JSON.parse(r.data));
const accounts = A.prepare('SELECT name, phone, active FROM accounts').all();
A.close();

const F = new DatabaseSync(path.join(__dirname, '..', 'data', 'front.db'));
F.exec('PRAGMA busy_timeout = 5000');
const has = F.prepare('SELECT 1 FROM logins WHERE lower(email) = ?');
const addLogin = F.prepare('INSERT INTO logins (name, email, pass, owner, active, created_at) VALUES (?,?,?,?,1,?)');
const addPanel = F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)');
const audit = F.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)');

const made = [], skipped = [];
F.exec('BEGIN');
for (const u of users) {
  const email = String(u.email || '').trim().toLowerCase(), full = norm(u.name), first = full.split(' ')[0];
  if (!u.active) { skipped.push(`${u.name}: switched off on the Users page`); continue; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped.push(`${u.name}: no email`); continue; }
  if (has.get(email)) { skipped.push(`${u.name}: ${email} already has a login`); continue; }
  const owner = u.role === 'Owner';
  let panels = [];
  if (owner) panels = KEYS.map(k => [k, OWNER_AS[k]]);
  else {
    const acc = accounts.find(a => a.active && norm(a.name) === full);
    if (acc) panels.push(['admin', acc.phone]);
    for (const k of KEYS) {
      if (k === 'admin') continue;
      const p = PORTALS[k].people.find(x => norm(x[0]) === full || norm(x[0]) === first);
      if (p) panels.push([k, p[1]]);
    }
    if (COUNTER[first] && !panels.some(p => p[0] === 'counter')) panels.push(['counter', COUNTER[first]]);
    const h = panels.findIndex(p => p[0] === HOME[first]);
    if (h > 0) panels.unshift(...panels.splice(h, 1));
  }
  if (!panels.length) { skipped.push(`${u.name}: not a person in any panel yet (add in Logins and pick a panel)`); continue; }
  const pass = password();
  const id = Number(addLogin.run(String(u.name).trim(), email, hashPass(pass), owner ? 1 : 0, new Date().toISOString()).lastInsertRowid);
  panels.forEach(([k, ph], i) => addPanel.run(id, k, ph, seal(pinOf(k)), i));
  audit.run(new Date().toISOString(), 'make-logins', `Login made for ${u.name} (${email})`);
  made.push([u.name, email, pass, panels.map(p => PORTALS[p[0]].name).join(', ')]);
}
F.exec('COMMIT');

process.stdout.write(`Bike Surgeon logins · open https://panel.bikesurgeon.online · made ${new Date().toISOString().slice(0, 16)} UTC\n\n`);
for (const [n, e, p, ps] of made) process.stdout.write(`${n}\n  Email:    ${e}\n  Password: ${p}\n  Panels:   ${ps} (first one opens)\n\n`);
if (skipped.length) process.stdout.write('Not made:\n' + skipped.map(s => '  ' + s).join('\n') + '\n');
say(`Logins made: ${made.length}. Not made: ${skipped.length}.`);
skipped.forEach(s => say('  ' + s));
