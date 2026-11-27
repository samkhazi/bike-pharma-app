// Inventory 2.0 (Bike Pharma restock): gives the Inventory panel to the front-door logins of the restock people, so the
// panel bar of their own panel shows "Inventory" (Misba: upload vendor bill, Nagaraj: New stock, Ganesh: selling price,
// counter staff: their counter list, accountant: dues + payment calendar). Their own panel stays the one that opens first.
// A login is matched by the phone it uses in its other panels; logins that already have the Inventory panel are left.
//   node --env-file=.env tools/add-inventory-panel.js      (from the front-door folder; GATE_KEY must be in .env)
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PHONES = { '9811120456': 'Misba (cashier)', '9876543211': 'Nagaraj (supervisor)', '9876543210': 'Ganesh (manager)', '9820000222': 'Accountant',
  '9741100231': 'Counter 1', '9741100232': 'Counter 2', '9741100233': 'Counter 3', '9741100234': 'Counter 4' };
const env = k => String(process.env[k] || '').trim();
if (!env('GATE_KEY')) { console.error('GATE_KEY is not in .env. Run it from the front-door folder with --env-file=.env. Nothing changed.'); process.exit(1); }
const key = crypto.createHash('sha256').update(env('GATE_KEY')).digest();
function seal(pin) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(pin), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); }
const pin = env('PIN_INVENTORY') || env('START_PIN') || '1234';

const F = new DatabaseSync(path.join(__dirname, '..', 'data', 'front.db'));
F.exec('PRAGMA busy_timeout = 5000');
const logins = F.prepare('SELECT id, name, email FROM logins WHERE active = 1 ORDER BY id').all();
const panels = F.prepare('SELECT portal, phone, pos FROM panels WHERE login_id = ? ORDER BY pos');
let added = 0;
F.exec('BEGIN');
for (const l of logins) {
  const ps = panels.all(l.id);
  if (ps.some(p => p.portal === 'inventory')) continue;
  const hit = ps.find(p => PHONES[p.phone]);
  if (!hit) continue;
  F.prepare('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)').run(l.id, 'inventory', hit.phone, seal(pin), Math.max(...ps.map(p => p.pos)) + 1);
  F.prepare("UPDATE sessions SET cookies = '{}' WHERE login_id = ?").run(l.id);
  F.prepare('INSERT INTO audit (at, who, what) VALUES (?,?,?)').run(new Date().toISOString(), 'add-inventory-panel', `Inventory panel given to ${l.name} as ${PHONES[hit.phone]}`);
  added++; console.log(`Inventory panel added: ${l.name} (${l.email}) as ${PHONES[hit.phone]}`);
}
F.exec('COMMIT');
console.log(`Logins given the Inventory panel: ${added}.`);
