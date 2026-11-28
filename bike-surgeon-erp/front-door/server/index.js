// Front door of panel.bikesurgeon.online (Sam, 29 Oct): ONE link and ONE sign-in (email + password) for every panel.
// The login decides the panel: Misba lands in the Cashier, Sultan on the Service floor, the owner in the Admin panel and
// can switch to any other. Every panel keeps running as its own app on an inside port (portals.js); the front door signs
// in to it with the person's phone + PIN of that panel (kept encrypted here) and passes each request through, so the
// browser only ever holds the front door's own cookie. Plain Node 22, no npm packages.
// Name-wise logins (Sam, 26 Nov): a login can be a mobile number instead of an email (tools/name-logins.js makes one
// for every staff member, with their own name, number and the panels of their role).
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { PORTALS, OWNER_AS, KEYS } = require('./portals');
const vehicles = require('./vehicles');   // Vehicle number page (VR Garage, the billing's job cards): vehicles.js
const catalogue = require('./catalogue');   // Catalogue page: Bike Pharma's Find Part with Bike Surgeon's stock (catalogue.js)

const COOKIE = 'bs_gate';
const DAYS = 14;
const PUB = path.join(__dirname, '..', 'public');
const env = k => String(process.env[k] || '').trim();
const now = () => new Date().toISOString();
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const err = (status, msg) => Object.assign(new Error(msg), { status });

// ---------------- database --------------------------------------------------------------------------------------------
let db;
function open(file = env('DB_FILE') || path.join(__dirname, '..', 'data', 'front.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS logins (${LOGIN_COLS});
    CREATE TABLE IF NOT EXISTS panels (login_id INTEGER NOT NULL, portal TEXT NOT NULL, phone TEXT NOT NULL, pin TEXT NOT NULL, pos INTEGER NOT NULL,
      PRIMARY KEY (login_id, portal));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, login_id INTEGER NOT NULL, portal TEXT NOT NULL, cookies TEXT NOT NULL DEFAULT '{}',
      expires TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL, who TEXT, what TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS people (portal TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL, sample TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (portal, phone));`);
  migrate();
  vehicles.init(db);
  return db;
}
// people: the real staff inside each panel (name, their own number), written by tools/name-logins.js; sample = the demo
// person of the zip they replaced in that panel (that demo phone no longer signs in there).

// A login is an email or a 10-digit mobile number (or both). Older databases (email only) get the new columns once.
const LOGIN_COLS = `id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, pass TEXT NOT NULL,
      owner INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, person TEXT UNIQUE`;
function migrate() {
  const cols = db.prepare('PRAGMA table_info(logins)').all();
  const mail = cols.find(c => c.name === 'email');
  if (cols.some(c => c.name === 'phone') && cols.some(c => c.name === 'person') && mail && !mail.notnull) return;
  const keep = ['id', 'name', 'email', 'phone', 'pass', 'owner', 'active', 'created_at', 'person'].filter(c => cols.some(x => x.name === c)).join(', ');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE logins_new (${LOGIN_COLS});
      INSERT INTO logins_new (${keep}) SELECT ${keep} FROM logins;
      DROP TABLE logins;
      ALTER TABLE logins_new RENAME TO logins;`);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const audit = (who, what) => run('INSERT INTO audit (at, who, what) VALUES (?,?,?)', now(), who, what);
catalogue.init({ all, now });

// ---------------- passwords and PINs ----------------------------------------------------------------------------------
const hashPass = p => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(String(p), salt, 32).toString('hex')}`; };
const passOk = (p, stored) => { const [, salt, h] = String(stored).split('$'); if (!salt || !h) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(String(p), salt, 32), Buffer.from(h, 'hex')); };
// a panel PIN is needed again to sign in to that panel, so it is kept encrypted (AES-256-GCM, key from GATE_KEY)
const key = () => { if (!env('GATE_KEY')) throw err(500, 'GATE_KEY is missing in .env'); return crypto.createHash('sha256').update(env('GATE_KEY')).digest(); };
function seal(pin) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(pin), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); }
function unseal(v) { const [iv, tag, enc] = String(v).split('.').map(x => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString('utf8'); }
const digits = s => String(s || '').replace(/\D/g, '').slice(-10);
const goodEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// what a person types to sign in: an email (any case) or a mobile number (spaces, +91 are fine)
const loginKey = v => { const t = String(v || '').trim(); return t.includes('@') ? t.toLowerCase() : digits(t); };
const showPhone = p => (p ? String(p).replace(/(\d{5})(\d{5})/, '$1 $2') : '');
const idOf = l => l.email || showPhone(l.phone);

// First run: the owner's login, with every panel. The password is printed once in the log.
function firstRun() {
  if (one('SELECT 1 FROM logins LIMIT 1')) return null;
  const email = (env('GATE_OWNER_EMAIL') || 'owner@bikesurgeon.online').toLowerCase();
  const pass = env('GATE_OWNER_PASSWORD') || crypto.randomBytes(6).toString('base64url');
  const id = Number(run('INSERT INTO logins (name, email, pass, owner, created_at) VALUES (?,?,?,1,?)', 'Saddam', email, hashPass(pass), now()).lastInsertRowid);
  KEYS.forEach((k, i) => run('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)', id, k, OWNER_AS[k],
    seal(env('PIN_' + k.toUpperCase()) || env('START_PIN') || '1234'), i));
  return { email, pass };
}

// ---------------- sessions --------------------------------------------------------------------------------------------
// 5 wrong passwords on one mobile number or email: that login waits 10 minutes (kept in memory, a restart clears it).
// The owner setting a new password (or switching the login on) in Logins opens it at once.
const fails = new Map(), LOCK_MS = 10 * 60 * 1000;
const lockLeft = k => { const f = k && fails.get(k); return f && f.n >= 5 ? Math.max(0, LOCK_MS - (Date.now() - f.at)) : 0; };
const lockMin = l => Math.ceil(Math.max(lockLeft(l.phone), lockLeft(l.email)) / 60000);
function cookieOf(req) { const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '=')); return m ? m.slice(COOKIE.length + 1) : ''; }
const setCookie = (res, v, age) => res.setHeader('Set-Cookie', `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env('COOKIE_SECURE') === '1' ? '; Secure' : ''}`);
function session(req) {
  const raw = cookieOf(req); if (!raw) return null;
  const s = one(`SELECT s.*, l.name, l.email, l.phone, l.owner FROM sessions s JOIN logins l ON l.id = s.login_id
                 WHERE s.token = ? AND s.expires > ? AND l.active = 1`, sha(raw), now());
  if (!s) return null;
  if (!PORTALS[s.portal]) { const f = panelsOf(s.login_id)[0]; if (f) s.portal = f.portal; }   // its panel was taken out of the menu
  return { ...s, cookies: JSON.parse(s.cookies || '{}') };
}
const panelsOf = id => all('SELECT * FROM panels WHERE login_id = ? ORDER BY pos', id).filter(p => PORTALS[p.portal]);

function signIn(id, pass) {
  const k = loginKey(id);
  const left = Math.ceil(lockLeft(k) / 60000);
  if (left) throw err(429, `Too many wrong passwords. Try again in ${left} minute${left === 1 ? '' : 's'}, or ask the owner to set a new password in Logins.`);
  const typed = String(pass || ''), trimmed = typed.trim();   // a space copied at the end (e.g. from WhatsApp) does not count
  const l = k.includes('@') ? one('SELECT * FROM logins WHERE email = ? AND active = 1', k)
    : k.length === 10 ? one('SELECT * FROM logins WHERE phone = ? AND active = 1', k) : null;
  if (!l || !(passOk(typed, l.pass) || (trimmed !== typed && passOk(trimmed, l.pass)))) { const f = fails.get(k) || { n: 0 }; fails.set(k, { n: f.n + 1, at: Date.now() }); throw err(401, 'Wrong mobile number, email or password.'); }
  fails.delete(k);
  const first = panelsOf(l.id)[0];
  if (!first) throw err(403, 'This login has no panel yet. Ask the owner.');
  const raw = crypto.randomBytes(32).toString('base64url');
  run('INSERT INTO sessions (token, login_id, portal, expires) VALUES (?,?,?,?)', sha(raw), l.id, first.portal, new Date(Date.now() + DAYS * 864e5).toISOString());
  run('DELETE FROM sessions WHERE expires < ?', now());
  audit(idOf(l), 'sign in');
  return raw;
}

// Sign in to a panel as the person of this login: POST its own sign-in with phone + PIN, keep its cookie.
// One sign-in at a time per session and panel: a page asking while the sign-in runs waits for the same one.
const inFlight = new Map();
function panelLogin(s, portal) {
  const k = s.token + ':' + portal;
  if (!inFlight.has(k)) inFlight.set(k, panelLogin1(s, portal).finally(() => inFlight.delete(k)));
  return inFlight.get(k).then(c => { s.cookies[portal] = c; return c; });
}
// cookies of other panels may have been saved meanwhile: add ours to what is stored, never overwrite the rest
function saveCookie(s, portal, c) {
  const cur = JSON.parse((one('SELECT cookies FROM sessions WHERE token = ?', s.token) || {}).cookies || '{}');
  if (c) cur[portal] = c; else delete cur[portal];
  run('UPDATE sessions SET cookies = ? WHERE token = ?', JSON.stringify(cur), s.token);
}
// right after sign in: sign in to the login's panels one by one while the browser loads the screen (first panel first)
function preLogin(raw) {
  const s = one('SELECT token, login_id FROM sessions WHERE token = ?', sha(raw)); if (!s) return;
  const ses = { ...s, cookies: {} };
  (async () => { for (const p of panelsOf(s.login_id)) await panelLogin(ses, p.portal).catch(() => {}); })();
}
async function panelLogin1(s, portal) {
  const p = PORTALS[portal], row = one('SELECT * FROM panels WHERE login_id = ? AND portal = ?', s.login_id, portal);
  if (!p || !row) return Promise.reject(err(403, 'This login cannot open that panel.'));
  const body = JSON.stringify({ phone: row.phone, pin: unseal(row.pin) });
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: p.port, path: p.login, method: 'POST', timeout: 15000,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'x-forwarded-for': 'front-door' } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', d => { text += d; });
      res.on('end', () => {
        const c = (res.headers['set-cookie'] || []).map(x => x.split(';')[0]).find(x => /=./.test(x));
        if (res.statusCode !== 200 || !c) { let m = ''; try { m = JSON.parse(text).error; } catch { /* not JSON */ } return reject(err(503, `Could not sign in to ${p.name}: ${String(m || 'status ' + res.statusCode).replace(/\.$/, '')}.${res.statusCode === 403 ? '' : ' The owner can fix the phone or PIN in Logins.'}`)); }   // 403 = the panel's own rule (e.g. desk backup not set today): its message says what to do
        s.cookies[portal] = c; saveCookie(s, portal, c);
        resolve(c);
      });
    });
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.on('error', () => reject(err(503, `${p.name} is not running right now.`)));
    r.end(body);
  });
}

// ---------------- passing requests to the panel -----------------------------------------------------------------------
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer', 'cookie', 'host']);
const BAR = '<script src="/__gate/bar.js" defer></script>';
// a panel shown inside the one screen: its own sidebar is hidden (the menu is the shell's) and its /api calls keep to this panel
// Speed (Sam, 5 Nov "login and loading take too long"): every .js / .css / .svg gets ?v=<version> in the page, and a
// versioned file is kept by the browser for a year (a new version has a new address, so an update is never stale).
// Pages (HTML) are never kept. This replaces emptying the browser cache at every sign in, which made each login cold.
const gateVer = {};
const gv = f => gateVer[f] || (gateVer[f] = crypto.createHash('sha1').update(fs.readFileSync(path.join(PUB, f))).digest('hex').slice(0, 10));
const versionGate = t => t.replace(/(\/__gate\/([a-z-]+\.(?:js|css|svg|jpg)))"/g, (m, u, f) => { try { return `${u}?v=${gv(f)}"`; } catch { return m; } });
const INSHELL_T = '<link rel="stylesheet" href="/__gate/inshell.css"><script src="/__gate/inshell.js"></script>';
const STATIC_RE = /\.(?:js|css|svg|png|jpg|webp|ico|woff2?)(?:\?|$)/i;
// version of a panel's own file = a hash of the file itself, read from the panel (on this server, fast) and kept 20 s
const assetVer = new Map();
function panelVer(portal, file) {
  const k = portal + '/' + file, hit = assetVer.get(k);
  if (hit && Date.now() - hit.at < 20000) return Promise.resolve(hit.v);
  return new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port: PORTALS[portal].port, path: '/' + file, method: 'GET', timeout: 3000 }, res => {
      const h = crypto.createHash('sha1'); res.on('data', d => h.update(d));
      res.on('end', () => { const v = res.statusCode === 200 ? h.digest('hex').slice(0, 10) : ''; assetVer.set(k, { v, at: Date.now() }); resolve(v); });
    });
    r.on('timeout', () => r.destroy()); r.on('error', () => resolve('')); r.end();
  });
}
async function versionPanel(portal, t) {
  const files = [...new Set([...t.matchAll(/(?:src|href)="([a-z0-9_-]+\.(?:js|css|svg))"/gi)].map(m => m[1]))];
  const v = Object.fromEntries(await Promise.all(files.map(async f => [f, await panelVer(portal, f)])));
  return t.replace(/((?:src|href)=")([a-z0-9_-]+\.(?:js|css|svg))"/gi, (m, a, f) => (v[f] ? `${a}${f}?v=${v[f]}"` : m));
}
const html0 = r => /text\/html/i.test(r.headers['content-type'] || '') && r.statusCode === 200;
// pre = '/p/<key>' when the panel is shown inside the one-screen menu (shell), '' for the old single-panel way
function forward(req, res, s, portal, retry, url = req.url, pre = '') {
  const p = PORTALS[portal];
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && !k.startsWith('x-gate')) headers[k] = v;
  headers.host = req.headers.host || '127.0.0.1';
  headers.cookie = s.cookies[portal];
  headers['x-forwarded-for'] = req.socket.remoteAddress || '';
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'http';
  const up = http.request({ host: '127.0.0.1', port: p.port, path: url, method: req.method, headers }, r => {
    // the panel's own session ran out: sign in again and try once more (only reads, a write is never sent twice)
    if (r.statusCode === 401 && retry && req.method === 'GET') {
      r.resume();
      return panelLogin(s, portal).then(() => forward(req, res, s, portal, false, url, pre), e => fail(req, res, e));
    }
    if (r.statusCode === 401) { delete s.cookies[portal]; saveCookie(s, portal, null); }
    const out = {};
    for (const [k, v] of Object.entries(r.headers)) if (!HOP.has(k) || k === 'transfer-encoding' && !html0(r)) out[k] = v;
    delete out['set-cookie'];                         // the panel's cookie stays here, the browser keeps only ours
    if (pre) {
      out['x-frame-options'] = 'SAMEORIGIN';          // the panel opens inside the one-screen menu (same site only)
      if (out.location && /^\/(?!\/)/.test(out.location) && !out.location.startsWith('/p/') && !out.location.startsWith('/__gate/')) out.location = pre + out.location;
    }
    const keep = pre && r.statusCode === 200 && /[?&]v=[0-9a-f]{10}(&|$)/.test(url) && STATIC_RE.test(url);
    if (keep) { out['cache-control'] = 'public, max-age=31536000, immutable'; delete out.vary; }   // versioned file of a panel
    else { out['cache-control'] = 'no-cache'; out.vary = 'Cookie'; }   // the same /app.js is a different file in each panel
    const html = html0(r) && req.method === 'GET';
    if (!html) { res.writeHead(r.statusCode, out); return r.pipe(res); }
    out['cache-control'] = 'no-store';
    const parts = []; r.on('data', d => parts.push(d));
    r.on('end', async () => {
      let t = Buffer.concat(parts).toString('utf8');
      const INSHELL = versionGate(INSHELL_T);
      if (pre) { t = /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, m => m + INSHELL) : INSHELL + t; t = await versionPanel(portal, t).catch(() => t); }  // inside the one-screen menu
      else t = t.includes('</body>') ? t.replace('</body>', BAR + '</body>') : t + BAR;
      delete out.etag; delete out['last-modified'];
      out['content-length'] = Buffer.byteLength(t);
      res.writeHead(200, out); res.end(t);
    });
  });
  up.on('error', () => fail(req, res, err(503, `${p.name} is not running right now.`)));
  if (req.method === 'GET' || req.method === 'HEAD') up.end(); else req.pipe(up);
}

// a panel that is down or refuses the PIN answers 503 (not 502: Cloudflare hides a 502 behind its own page, so the message was lost)
function fail(req, res, e) {
  if (res.headersSent) return res.destroy();
  const status = e.status || 500;
  if (status >= 500 && status !== 503) console.error(e);
  const msg = status >= 500 && status !== 503 ? 'Something went wrong on the server.' : e.message;
  if (/text\/html/.test(req.headers.accept || '') && req.method === 'GET') return page(res, 'problem.html', status, { MSG: esc(msg) }, PROBLEM_CSP);
  json(res, status, { error: msg });
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function json(res, status, v) { const b = JSON.stringify(v); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(b) }); res.end(b); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
function page(res, file, status = 200, vars = {}, csp, keep) {
  const ext = path.extname(file), isHtml = ext === '.html';
  let t = fs.readFileSync(path.join(PUB, file), ext === '.jpg' ? null : 'utf8');   // the sign-in photo is sent as it is
  if (typeof t === 'string') { for (const [k, v] of Object.entries(vars)) t = t.split(`{{${k}}}`).join(v); }
  if (isHtml) t = versionGate(t);
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)], 'cache-control': isHtml ? 'no-store' : keep ? 'public, max-age=31536000, immutable' : 'no-cache', 'content-length': Buffer.byteLength(t),
    'content-security-policy': csp || "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' });
  res.end(t);
}
function body(req, limit = 100000) {
  return new Promise((resolve, reject) => { let n = 0; const parts = [];
    req.on('data', d => { n += d.length; if (n > limit) { reject(err(413, 'Too large.')); req.destroy(); } else parts.push(d); });
    req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch { reject(err(400, 'Bad request.')); } });
    req.on('error', reject); });
}

// ---------------- the front door's own pages and API ------------------------------------------------------------------
const meOf = s => ({ name: s.name, email: idOf(s), owner: !!s.owner, portal: s.portal, portalName: PORTALS[s.portal] && PORTALS[s.portal].name,
  panels: panelsOf(s.login_id).map(p => ({ key: p.portal, name: PORTALS[p.portal].name })), cat: catalogue.on() });
// who a phone is inside a panel: a real staff member (people) or a person of the sample data
function whoIn(portal, phone) {
  const r = one('SELECT name FROM people WHERE portal = ? AND phone = ?', portal, phone); if (r) return r.name;
  const p = PORTALS[portal] && PORTALS[portal].people.find(x => x[1] === phone); return p ? p[0] : '';
}
// the people of a panel for the Logins page: the real staff, then the sample people nobody replaced (shared counters ...)
function peopleOf(portal) {
  const real = all('SELECT name, phone, sample FROM people WHERE portal = ? ORDER BY name', portal);
  const gone = new Set(real.flatMap(r => [r.phone, r.sample]));
  return [...real.map(r => [r.name, r.phone]), ...PORTALS[portal].people.filter(p => !gone.has(p[1]))];
}
const viewLogin = l => ({ id: l.id, name: l.name, email: l.email || '', phone: l.phone || '', staff: !!l.person, owner: !!l.owner, active: !!l.active, locked: lockMin(l),
  panels: panelsOf(l.id).map(p => ({ portal: p.portal, phone: p.phone, who: whoIn(p.portal, p.phone) })) });

function savePanels(id, panels, keepOld) {
  if (!Array.isArray(panels) || !panels.length) throw err(400, 'Pick at least one panel.');
  const old = new Map(all('SELECT * FROM panels WHERE login_id = ?', id).map(p => [p.portal, p]));
  const rows = panels.map((p, i) => {
    if (!PORTALS[p.portal]) throw err(400, 'Unknown panel.');
    const phone = digits(p.phone); if (phone.length !== 10) throw err(400, `${PORTALS[p.portal].name}: the phone needs 10 digits.`);
    const pin = String(p.pin || '').trim();
    if (pin && !/^\d{4}$/.test(pin)) throw err(400, `${PORTALS[p.portal].name}: the PIN has 4 digits.`);
    const was = old.get(p.portal);
    // a staff member's own PIN of that panel (kept on their name-wise login) is used when none is typed
    const staff = one('SELECT p.pin FROM panels p JOIN logins l ON l.id = p.login_id WHERE l.person IS NOT NULL AND p.portal = ? AND p.phone = ? LIMIT 1', p.portal, phone);
    const sealed = pin ? seal(pin) : keepOld && was && was.phone === phone ? was.pin : staff ? staff.pin : seal(env('PIN_' + p.portal.toUpperCase()) || env('START_PIN') || '1234');
    return [id, p.portal, phone, sealed, i];
  });
  if (new Set(rows.map(r => r[1])).size !== rows.length) throw err(400, 'The same panel is there twice.');
  run('DELETE FROM panels WHERE login_id = ?', id);
  for (const p of old.values()) if (!PORTALS[p.portal]) rows.push([id, p.portal, p.phone, p.pin, 100 + p.pos]);   // panels taken out of the menu stay as they were
  for (const r of rows) run('INSERT INTO panels (login_id, portal, phone, pin, pos) VALUES (?,?,?,?,?)', ...r);
  run("UPDATE sessions SET cookies = '{}' WHERE login_id = ?", id);   // signs in to the panels again with the new details
}

async function gateRoute(req, res, u) {
  const p = u.pathname, m = req.method;
  if (m !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw err(403, 'Cross-site request blocked.');
  if (m === 'GET' && p === '/__gate/login') return session(req) ? redirect(res, '/') : page(res, 'login.html');
  if (m === 'GET' && /^\/__gate\/(login\.js|login\.css|building\.jpg|logo-white\.svg|bar\.js|logins\.js|gate\.css|logo\.svg|shell\.js|shell\.css|inshell\.js|inshell\.css|out\.js|gaadi\.js|gaadi\.css)$/.test(p)) return page(res, p.slice(8), 200, {}, undefined, /^v=[0-9a-f]{10}$/.test(u.search.slice(1)) && u.search.slice(3) === gv(p.slice(8)));
  if (m === 'POST' && p === '/__gate/login') {
    const b = await body(req); const raw = signIn(b.login ?? b.email, b.password);
    setCookie(res, raw, DAYS * 86400); preLogin(raw); return json(res, 200, { ok: true });
  }
  const s = session(req);
  if (!s && m === 'GET' && p === '/__gate/gaadi') return req.headers['sec-fetch-dest'] === 'iframe' ? page(res, 'out.html', 200, {}, OUT_CSP) : redirect(res, '/__gate/login');
  if (!s) return m === 'GET' && p === '/__gate/logins' ? redirect(res, '/__gate/login') : json(res, 401, { error: 'Please sign in again.' });
  if (m === 'POST' && p === '/__gate/logout') { run('DELETE FROM sessions WHERE token = ?', s.token); setCookie(res, '', 0); return json(res, 200, { ok: true }); }
  if (m === 'GET' && p === '/__gate/me') return json(res, 200, meOf(s));
  if (m === 'POST' && p === '/__gate/switch') {
    const b = await body(req);
    if (!panelsOf(s.login_id).some(x => x.portal === b.portal)) throw err(403, 'This login cannot open that panel.');
    run('UPDATE sessions SET portal = ? WHERE token = ?', b.portal, s.token); return json(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/__gate/password') {
    const b = await body(req); const l = one('SELECT * FROM logins WHERE id = ?', s.login_id);
    if (!passOk(b.old || '', l.pass)) throw err(400, 'The current password is wrong.');
    if (String(b.password || '').length < 8) throw err(400, 'The new password needs at least 8 letters or numbers.');
    run('UPDATE logins SET pass = ? WHERE id = ?', hashPass(b.password), l.id);
    run('DELETE FROM sessions WHERE login_id = ? AND token <> ?', l.id, s.token); audit(idOf(l), 'changed own password');
    return json(res, 200, { ok: true });
  }
  // every login: the Vehicle number page (it opens in the one screen's menu) and its API
  if (m === 'GET' && p === '/__gate/gaadi') return page(res, 'gaadi.html', 200, {}, GAADI_CSP);
  if (p.startsWith('/__gate/api/vehicle')) return await vehicles.api(req, res, u, s, { json, body, err });
  // every login: the Catalogue page (its address carries a ticket of this sign in; catalogue.js)
  if (m === 'GET' && p === '/__gate/cat-open') return json(res, 200, catalogue.open(s));
  // owner only: the logins
  if (!s.owner) throw err(403, 'Only the owner can change logins.');
  if (m === 'GET' && p === '/__gate/logins') return page(res, 'logins.html');
  if (m === 'GET' && p === '/__gate/api/logins') return json(res, 200, { logins: all('SELECT * FROM logins ORDER BY owner DESC, name').map(viewLogin),
    portals: KEYS.map(k => ({ key: k, name: PORTALS[k].name, people: peopleOf(k) })) });
  if (m === 'POST' && p === '/__gate/api/logins') {
    const b = await body(req); const name = String(b.name || '').trim();
    const { email, phone } = loginIds(b, {});
    if (!name) throw err(400, 'Name is needed.');
    if (String(b.password || '').length < 8) throw err(400, 'The password needs at least 8 letters or numbers.');
    db.exec('BEGIN');
    try {
      const id = Number(run('INSERT INTO logins (name, email, phone, pass, owner, created_at) VALUES (?,?,?,?,?,?)', name, email, phone, hashPass(b.password), b.owner ? 1 : 0, now()).lastInsertRowid);
      savePanels(id, b.panels, false); db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    audit(idOf(s), `added login ${email || phone}`); return json(res, 200, { ok: true });
  }
  const pm = p.match(/^\/__gate\/api\/logins\/(\d+)$/);
  if (m === 'PATCH' && pm) {
    const id = Number(pm[1]), l = one('SELECT * FROM logins WHERE id = ?', id); if (!l) throw err(404, 'No such login.');
    const b = await body(req);
    const name = b.name != null ? String(b.name).trim() : l.name;
    const { email, phone } = loginIds(b, l);
    if (!name) throw err(400, 'Name is needed.');
    if (b.password && String(b.password).length < 8) throw err(400, 'The password needs at least 8 letters or numbers.');
    const active = b.active == null ? l.active : b.active ? 1 : 0, owner = b.owner == null ? l.owner : b.owner ? 1 : 0;
    if (id === s.login_id && (!active || !owner)) throw err(400, 'You cannot switch off or demote your own login.');
    db.exec('BEGIN');
    try {
      run('UPDATE logins SET name = ?, email = ?, phone = ?, active = ?, owner = ? WHERE id = ?', name, email, phone, active, owner, id);
      if (b.password) { run('UPDATE logins SET pass = ? WHERE id = ?', hashPass(b.password), id); run('DELETE FROM sessions WHERE login_id = ? AND token <> ?', id, s.token); }
      if (b.panels) savePanels(id, b.panels, true);
      if (!active) run('DELETE FROM sessions WHERE login_id = ?', id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    if (b.password || (active && !l.active)) for (const k of [l.phone, l.email, phone, email]) if (k) fails.delete(loginKey(k));   // a new password opens a locked login
    audit(idOf(s), `changed login ${email || phone}`); return json(res, 200, { ok: true });
  }
  throw err(404, 'Not found.');
}
// email and mobile number of a login from the Logins form (l = the login being changed, {} for a new one); one is enough
function loginIds(b, l) {
  const email = b.email != null ? String(b.email).trim().toLowerCase() || null : l.email || null;
  const typed = b.phone != null ? String(b.phone).trim() : null;
  const phone = typed != null ? digits(typed) || null : l.phone || null;
  if (typed && (typed.replace(/\D/g, '').length < 10 || !/^[6-9]/.test(phone))) throw err(400, 'The mobile number needs 10 digits.');
  if (!email && !phone) throw err(400, 'Give a mobile number or an email.');
  if (email && !goodEmail(email)) throw err(400, 'Type a proper email.');
  if (email && email !== l.email && one('SELECT 1 FROM logins WHERE email = ?', email)) throw err(409, 'This email already has a login.');
  if (phone && phone !== l.phone && one('SELECT 1 FROM logins WHERE phone = ?', phone)) throw err(409, 'This mobile number already has a login.');
  return { email, phone };
}
// Which panel a request is for: /p/<key>/... in the path, else the x-gate-p header (inshell.js adds it), else the page it came
// from (Referer /p/<key>/...: links, pictures, CSV downloads), else the panel of the session (the old one-panel way).
const KEYRE = /^\/p\/([a-z]+)(\/.*)?$/;
function refKey(req) {
  try { const m = new URL(req.headers.referer || '').pathname.match(KEYRE); return m && PORTALS[m[1]] ? m[1] : ''; } catch { return ''; }
}
function route(req, u) {
  const frame = req.headers['sec-fetch-dest'] === 'iframe';
  const m = u.pathname.match(KEYRE);
  if (m && PORTALS[m[1]]) { const path = m[2] || '/'; return { key: m[1], pre: '/p/' + m[1], path, url: path + u.search, frame }; }
  if (u.pathname === '/' || u.pathname === '/index.html') return { key: '', pre: '', path: u.pathname, url: req.url, frame };
  const h = String(req.headers['x-gate-p'] || ''); const key = PORTALS[h] ? h : refKey(req);
  return { key, pre: key ? '/p/' + key : '', path: u.pathname, url: req.url, frame };
}
const SHELL_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self'; frame-src 'self'; frame-ancestors 'none'";
const PROBLEM_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'self'";
const OUT_CSP = "default-src 'self'; script-src 'self'; frame-ancestors 'self'";
const GAADI_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'self'";
function redirect(res, to) { res.writeHead(302, { location: to, 'cache-control': 'no-store' }); res.end(); }

async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/healthz') return json(res, 200, { ok: true });
    if (u.pathname.startsWith('/__gate/cat/t/')) return await catalogue.handle(req, res, u);   // the Catalogue page: its ticket, no cookie (sealed off)
    if (u.pathname.startsWith('/__gate/')) return await gateRoute(req, res, u);
    const s = session(req);
    const r = route(req, u);
    if (!s) {
      if (req.method !== 'GET' || r.path.startsWith('/api/')) return json(res, 401, { error: 'Please sign in again.' });
      return r.frame ? page(res, 'out.html', 200, {}, OUT_CSP) : redirect(res, '/__gate/login');   // inside the menu: the whole screen goes to sign in
    }
    // a panel's own "sign out" signs out of the front door
    if (req.method === 'POST' && (r.path === '/api/logout' || r.path === '/api/auth/logout')) {
      run('DELETE FROM sessions WHERE token = ?', s.token); setCookie(res, '', 0); return json(res, 200, { ok: true });
    }
    // the one screen (Sam, 5 Nov): every panel of this login in one menu. A frame asking for '/' gets its panel's /p/ page.
    if (req.method === 'GET' && !r.key && (r.path === '/' || r.path === '/index.html')) {
      if (!r.frame) return page(res, 'shell.html', 200, {}, SHELL_CSP);
      return redirect(res, `/p/${refKey(req) || s.portal}/`);
    }
    const portal = r.key || s.portal;
    if (!panelsOf(s.login_id).some(x => x.portal === portal)) throw err(403, 'This login cannot open that panel any more.');
    if (!s.cookies[portal]) await panelLogin(s, portal);
    forward(req, res, s, portal, true, r.url, r.pre);
  } catch (e) { fail(req, res, e); }
}

function start(port = Number(env('PORT') || 3022)) {
  open();
  const first = firstRun();
  if (first) console.log(`First run: owner login ${first.email}, password ${first.pass} (change it after signing in: Logins > your name).`);
  const server = http.createServer(handle);
  server.listen(port, () => console.log(`Bike Surgeon front door on http://localhost:${port}`));
  vehicles.start();
  return server;
}

if (require.main === module) start();
module.exports = { start, open, handle, firstRun, seal, unseal, hashPass, loginKey };
