// Cashier on real data (Sam, 6 Nov): Misba's front-door login gets the Cashier panel, first in her menu.
// A login is matched by Misba's phone in any of its panels; a login that already has the Cashier panel is left as it is.
//   node --env-file=.env tools/add-cashier-panel.js      (from the front-door folder; GATE_KEY must be in .env)
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MISBA = '9811120456';
const env = k => String(process.env[k] || '').trim();
if (!env('GATE_KEY')) { console.error('GATE_KEY is not in .env. Run it from the front-door folder with --env-file=.env. Nothing changed.'); process.exit(1); }
const key = crypto.createHash('sha256').update(env('GATE_KEY')).digest();
function seal(pin) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(pin), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); }
const pin = env('PIN_CASHIER') || env('START_PIN') || '1234';

const F = new DatabaseSync(env('DB_FILE') || path.join(__dirname, '..', 'data', 'front.db'));
F.exec('PRAGMA busy_timeout = 5000');
const logins = F.prepare('SELECT id, name, email FROM logins WHERE active = 1 AND owner = 0 ORDER BY id').all();
const panels = F.prepare('SELECT portal, phone, pos FROM panels WHERE login_id = ? ORDER BY pos');
let added = 0, had = 0;
F.exec('BEGIN');
for (const l of logins) {
  const ps = panels.all(l.id);
  if (!ps.some(p => p.phone === MISBA)) continue;
  if (ps.some(p => p.portal === 'cashier')) { had++; continue; }
  F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)').run(l.id, 'cashier', MISBA, seal(pin), Math.min(...ps.map(p => p.pos)) - 1);
  F.prepare("UPDATE sessions SET cookies = '{}', portal = 'cashier' WHERE login_id = ?").run(l.id);
  F.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'add-cashier-panel', `Cashier panel given to ${l.name}`);
  added++;
}
F.exec('COMMIT');
console.log(`Cashier panel on Misba's login: ${added ? 'added' : had ? 'already there' : 'no login with her phone found (give it in Logins by hand)'}.`);
