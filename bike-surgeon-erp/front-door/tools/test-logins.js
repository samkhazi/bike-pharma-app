// Test logins for checking the Inventory 2.0 restock flow (Sam, 5 Nov): one front-door login per person, email by name,
// password given on the command line. Each opens the Inventory first, then their own panel. An email that is already
// there is left as it is. Switch them off in Logins (/__gate/logins) after testing.
//   node --env-file=.env --disable-warning=ExperimentalWarning tools/test-logins.js PASSWORD      (from the front-door folder)
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PEOPLE = [   // name, email, inventory phone, own panel
  ['Misba (cashier)', 'misba@gmail.com', '9811120456', 'cashier'],
  ['Nagaraj (supervisor)', 'nagaraj@gmail.com', '9876543211', 'supervisor'],
  ['Ganesh (manager)', 'ganesh@gmail.com', '9876543210', 'spares'],
  ['Accountant', 'accountant@gmail.com', '9820000222', 'accounts'],
  ['Counter 1 Hero + Honda', 'hero@gmail.com', '9741100231', 'counter'],
  ['Counter 2 Bajaj + TVS', 'bajaj@gmail.com', '9741100232', 'counter'],
  ['Counter 3 Suzuki + RE', 'suzuki@gmail.com', '9741100233', 'counter'],
  ['Counter 4 Yamaha + KTM', 'yamaha@gmail.com', '9741100234', 'counter'],
];
const env = k => String(process.env[k] || '').trim();
const pass = process.argv[2];
if (!pass) { console.error('Give the password: node --env-file=.env tools/test-logins.js PASSWORD'); process.exit(1); }
if (!env('GATE_KEY')) { console.error('GATE_KEY is not in .env. Run it from the front-door folder with --env-file=.env. Nothing changed.'); process.exit(1); }
const key = crypto.createHash('sha256').update(env('GATE_KEY')).digest();
function seal(pin) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(pin), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); }
const hashPass = p => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(String(p), salt, 32).toString('hex')}`; };
const pinOf = k => env('PIN_' + k.toUpperCase()) || env('START_PIN') || '1234';

const F = new DatabaseSync(path.join(__dirname, '..', 'data', 'front.db'));
F.exec('PRAGMA busy_timeout = 5000');
let made = 0;
F.exec('BEGIN');
for (const [name, email, phone, own] of PEOPLE) {
  if (F.prepare('SELECT 1 FROM logins WHERE lower(email) = ?').get(email)) { console.log(`kept   ${email} (already there)`); continue; }
  const id = Number(F.prepare('INSERT INTO logins (name, email, pass, owner, active, created_at) VALUES (?,?,?,0,1,?)').run(name, email, hashPass(pass), new Date().toISOString()).lastInsertRowid);
  F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,0)').run(id, 'inventory', phone, seal(pinOf('inventory')));
  F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,1)').run(id, own, phone, seal(pinOf(own)));
  F.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'test-logins', `Test login made: ${name} (${email})`);
  made++; console.log(`added  ${email}  ${name}`);
}
F.exec('COMMIT');
console.log(`Test logins made: ${made}.`);
