// Phone + 4-digit PIN sign-in. PINs are scrypt-hashed; sessions live in the database and
// the browser only holds a random httpOnly cookie.
'use strict';
const crypto = require('node:crypto');
const db = require('./db');
const C = require('./clock');

const COOKIE = 'bs_inv';
const SESSION_DAYS = 14;
const ROLES = {
  owner: 'Owner',                 // Saddam: everything, logins, settings, applies big stock cuts
  manager: 'Inventory manager',   // everything in the stock; applies rack checks, cuts stock, pays vendors
  store: 'Store keeper',          // adds parts, stock in, photos, rack checks, stickers, order sheet; no cost prices
  accountant: 'Accountant',       // vendors, dues, payment calendar, due date changes (with a reason); no part costs
  cashier: 'Cashier',             // Inventory 2.0: uploads vendor bills (AI reads the lines), sends them to the supervisor
  supervisor: 'Supervisor',       // Inventory 2.0: New stock, checks the purchase discount (% only), gives items to counters
  counter: 'Counter staff',       // Inventory 2.0: own counter's items, shelf no., puts them into stock after pricing
};

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function checkPin(pin, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const got = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

const digits = s => String(s || '').replace(/\D/g, '').slice(-10);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// 5 wrong PINs for a phone = 10 minute wait
const fails = new Map();
const locked = phone => { const f = fails.get(phone); return f && f.count >= 5 && Date.now() - f.at < 10 * 60 * 1000; };

function login(phone, pin) {
  phone = digits(phone);
  if (locked(phone)) return { error: 'Too many wrong PINs. Try again in 10 minutes.', status: 429 };
  const a = db.one('SELECT * FROM accounts WHERE phone = ? AND active = 1', phone);
  if (!a || !/^\d{4}$/.test(String(pin)) || !checkPin(pin, a.pin_hash)) {
    const f = fails.get(phone) || { count: 0, at: 0 };
    fails.set(phone, { count: f.count + 1, at: Date.now() });
    return { error: 'Wrong phone number or PIN.', status: 401 };
  }
  fails.delete(phone);
  const raw = crypto.randomBytes(32).toString('base64url');
  const t = new Date();
  db.run('INSERT INTO sessions (token, account_id, created_at, expires_at) VALUES (?,?,?,?)',
    sha(raw), a.id, t.toISOString(), new Date(t.getTime() + SESSION_DAYS * 864e5).toISOString());
  db.run('INSERT INTO audit_log (at, account_id, who, action) VALUES (?,?,?,?)', C.stamp(C.now()), a.id, a.name, 'sign in');
  return { me: publicAccount(a), cookie: raw };
}

const publicAccount = a => ({ id: a.id, name: a.name, phone: a.phone, role: a.role, roleLabel: ROLES[a.role] + (a.ctr ? ' ' + a.ctr : ''), ctr: a.ctr || '' });

function readCookie(req) {
  const h = req.headers.cookie || '';
  const m = h.split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
}

function cookieHeader(value, maxAgeSec) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

// Express middleware: attaches req.me or answers 401
function requireUser(req, res, next) {
  const raw = readCookie(req);
  if (raw) {
    const a = db.one(`SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id
                      WHERE s.token = ? AND s.expires_at > ? AND a.active = 1`, sha(raw), new Date().toISOString());
    if (a) { req.me = publicAccount(a); return next(); }
  }
  res.status(401).json({ error: 'Please sign in.' });
}

const roleText = roles => roles.map(r => (ROLES[r] || r).toLowerCase()).join(' or ');
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.me.role) ? next() : res.status(403).json({ error: `Only ${roleText(roles)} can do this.` });

function logout(req) {
  const raw = readCookie(req);
  if (raw) db.run('DELETE FROM sessions WHERE token = ?', sha(raw));
}

function addAccount({ name, phone, role, pin, ctr }) {
  phone = digits(phone);
  if (!name || !String(name).trim()) throw Object.assign(new Error('Name is needed.'), { status: 400 });
  if (phone.length !== 10) throw Object.assign(new Error('Phone must have 10 digits.'), { status: 400 });
  if (!ROLES[role]) throw Object.assign(new Error(`Role must be one of: ${Object.keys(ROLES).join(', ')}.`), { status: 400 });
  if (!/^\d{4}$/.test(String(pin))) throw Object.assign(new Error('PIN must be 4 digits.'), { status: 400 });
  if (db.one('SELECT 1 FROM accounts WHERE phone = ?', phone)) throw Object.assign(new Error('This phone already has a login.'), { status: 409 });
  if (db.one('SELECT 1 FROM accounts WHERE lower(name) = lower(?)', String(name).trim())) throw Object.assign(new Error('Someone with this name already has a login.'), { status: 409 });
  ctr = String(ctr || '').toUpperCase();
  if (role === 'counter' && !/^C[1-9]$/.test(ctr)) throw Object.assign(new Error('Pick the counter (C1 to C4).'), { status: 400 });
  const r = db.run('INSERT INTO accounts (name, phone, role, pin_hash, created_at, ctr) VALUES (?,?,?,?,?,?)',
    String(name).trim(), phone, role, hashPin(pin), C.stamp(C.now()), role === 'counter' ? ctr : '');
  return Number(r.lastInsertRowid);
}

// Changing your own PIN: a wrong current PIN counts like a wrong sign-in (5 wrong = 10 minute wait), so a signed-in
// screen left open cannot be used to try every PIN (round 3, 15 Oct)
function oldPinOk(id, pin, stored) {
  const k = 'own:' + id;
  if (locked(k)) throw Object.assign(new Error('Too many wrong PINs. Try again in 10 minutes.'), { status: 429 });
  if (/^\d{4}$/.test(String(pin || '')) && checkPin(String(pin), stored)) { fails.delete(k); return true; }
  const f = fails.get(k) || { count: 0, at: 0 };
  fails.set(k, { count: f.count + 1, at: Date.now() });
  return false;
}

module.exports = { oldPinOk, roleText, readCookie, sha, hashPin, checkPin, login, logout, requireUser, requireRole, cookieHeader, digits, addAccount, publicAccount, ROLES, SESSION_DAYS };
