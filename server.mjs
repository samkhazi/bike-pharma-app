// Bike Pharma website + app server (bikepharma.com). No npm dependencies: node:http, node:sqlite, node:crypto.
// Serves public/ (landing page, app, catalogue files), logs people in (OTP for customers and mechanics,
// password for staff), keeps the shop database shared between every device, and reads diagram/photo
// files from data/project-files for staff.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openStore, HAS_SQLITE } from './lib/store.mjs';
import { roleClass, viewOf, scopeValue, canWrite, merge3, applyOwn, applyMine, mechLogins, moveCodes, deepEqual, cleanStrings, safeText, STAFF_ROLES, MECH_OWN } from './lib/merge.mjs';
import { otpConfig, makeOtp, deliverOtp } from './lib/sms.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export function loadEnv(file) {
  try { for (const line of fs.readFileSync(file, 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
}
loadEnv(path.join(ROOT, '.env'));
const env = process.env;
const PORT = +env.PORT || 3010, HOST = env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');
const PUBLIC_DIR = path.resolve(ROOT, env.PUBLIC_DIR || 'public');
const FILES_DIR = path.resolve(ROOT, env.FILES_DIR || path.join(DATA_DIR, 'project-files'));
const SESSION_DAYS = +env.SESSION_DAYS || 30;
const PROTECTED = (env.PROTECTED_DIRS || 'cat,bj,ph,phh,figs').split(',').map(s => s.trim()).filter(Boolean);
const OTP = otpConfig(env);
const store = openStore(DATA_DIR);
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

// ---------- first run: demo shop data, no accounts ----------
if (store.rev() === 0) {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'seed.json'), 'utf8'));
  seed.accounts = {};
  const w = {}; for (const [k, v] of Object.entries(seed)) w[k] = JSON.stringify(v);
  store.write(w);
  console.log('[bikepharma] new database created in', DATA_DIR);
}

// ---------- helpers ----------
const normId = v => { v = String(v || '').trim().toLowerCase(); if (v.includes('@')) return v; const d = v.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const stateVal = k => { const r = store.stateGet(k); return r ? JSON.parse(r.json) : undefined; };
const accounts = () => stateVal('accounts') || {};
const reader = () => { const c = new Map(); return k => { if (!c.has(k)) c.set(k, stateVal(k)); return c.get(k); }; }; // cached reads for one request
function setAccount(id, acc) { const a = accounts(); a[id] = acc; store.write({ accounts: JSON.stringify(a) }); }
function hashPw(pw) { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(String(pw), salt, 32); return salt.toString('hex') + ':' + h.toString('hex'); }
function checkPw(pw, stored) { if (!stored) return false; const [s, h] = String(stored).split(':'); if (!s || !h) return false; const x = crypto.scryptSync(String(pw), Buffer.from(s, 'hex'), 32); const y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); }
export { hashPw };

function cookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function isHttps(req) { return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || env.COOKIE_SECURE === '1'; }
function setSession(req, res, token, clear) {
  const parts = [`bp_s=${token || ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${clear ? 0 : SESSION_DAYS * 86400}`];
  if (isHttps(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function userOf(req) {
  const t = cookies(req).bp_s; if (!t || !/^[a-f0-9]{48}$/.test(t)) return null;
  const s = store.kvGet('sess', t); if (!s) return null;
  if (Date.now() - s.t > SESSION_DAYS * 86400e3) { store.kvDel('sess', t); return null; }
  const a = accounts()[s.uid]; if (!a || a.status === 'pending') return null;
  if ((stateVal('staffOff') || []).includes(s.uid)) return null;
  return { id: s.uid, ...a };
}
function sessionCreate(uid) { const t = crypto.randomBytes(24).toString('hex'); store.kvSet('sess', t, { uid, t: Date.now() }); return t; }
function json(res, code, obj) { const b = Buffer.from(JSON.stringify(obj)); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' }); res.end(b); }
function readBody(req, limit = 24 * 1024 * 1024) {
  return new Promise((ok, no) => { const c = []; let n = 0; req.on('data', d => { n += d.length; if (n > limit) { no(new Error('too large')); req.destroy(); } else c.push(d); }); req.on('end', () => ok(Buffer.concat(c))); req.on('error', no); });
}
const RATE = new Map();
function limited(key, max, windowMs) { const now = Date.now(); const l = (RATE.get(key) || []).filter(t => now - t < windowMs); if (l.length >= max) { RATE.set(key, l); return true; } l.push(now); RATE.set(key, l); return false; }
setInterval(() => { const now = Date.now(); for (const [k, l] of RATE) if (!l.some(t => now - t < 3600e3)) RATE.delete(k); }, 600e3).unref();
const ipOf = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const loginError = { off: 'This login has been deactivated by Admin. Please contact your Admin.', pending: 'Your account is waiting for Bike Pharma verification.' };

// ---------- API ----------
async function api(req, res, url, user) {
  const p = url.pathname, m = req.method;
  if (m === 'POST') {
    const origin = req.headers.origin; // same-site only
    if (origin && origin !== 'null') { try { if (new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Bad origin' }); } catch (e) { return json(res, 403, { error: 'Bad origin' }); } }
  }
  let body = {};
  if (m === 'POST') { try { const b = await readBody(req); body = b.length ? JSON.parse(b.toString('utf8')) : {}; } catch (e) { return json(res, 400, { error: 'Bad request body' }); } }
  const catList = () => { try { return fs.readdirSync(path.join(PUBLIC_DIR, 'cat')).filter(f => f.endsWith('.json')).sort(); } catch { return []; } };
  const cfg = () => ({ otpHint: OTP.mode === 'fixed' ? OTP.fixed : null, otpMode: OTP.mode, version: VERSION, cat: catList() });
  const full = u => ({ user: u ? u : null, db: viewOf(store.stateAll().map(r => r.key), reader(), u, true), rev: store.rev(), cfg: cfg() });

  if (p === '/api/health' && m === 'GET') return json(res, 200, { ok: true, rev: store.rev(), sqlite: HAS_SQLITE, version: VERSION });
  if (p === '/api/boot' && m === 'GET') { if (!user && cookies(req).bp_s) setSession(req, res, '', true); return json(res, 200, full(user)); }

  if (p === '/api/otp' && m === 'POST') {
    const id = normId(body.id);
    if (!id) return json(res, 200, { error: 'Enter your mobile number or email.' });
    const acc = accounts()[id];
    if ((stateVal('staffOff') || []).includes(id)) return json(res, 200, { error: loginError.off });
    if (acc && acc.status === 'pending') return json(res, 200, { error: loginError.pending });
    const isEmail = id.includes('@');
    if (acc && (STAFF_ROLES.includes(acc.role) || isEmail)) return json(res, 200, { kind: 'password', name: acc.name });
    if (!acc && isEmail) return json(res, 200, { error: 'This email isn’t registered. Staff logins are created by the Bike Pharma Admin.' });
    if (!/^[6-9]\d{9}$/.test(id)) return json(res, 200, { error: 'Enter a valid 10-digit mobile number.' });
    if (limited('otp:' + id, 5, 600e3) || limited('otpip:' + ipOf(req), 40, 600e3)) return json(res, 200, { error: 'Too many OTP requests. Please try again in a few minutes.' });
    const code = makeOtp(OTP);
    store.kvSet('otp', id, { code, exp: Date.now() + 10 * 60e3, tries: 0 });
    const d = await deliverOtp(OTP, id, code);
    if (!d.ok) return json(res, 200, { error: d.error });
    return json(res, 200, { kind: 'otp', signup: !acc });
  }

  if (p === '/api/login' && m === 'POST') {
    const id = normId(body.id);
    let acc = accounts()[id];
    if ((stateVal('staffOff') || []).includes(id)) return json(res, 200, { error: loginError.off });
    if (limited('login:' + id, 20, 600e3) || limited('loginip:' + ipOf(req), 100, 600e3)) return json(res, 200, { error: 'Too many tries. Please wait a few minutes.' });
    if (body.password != null) {
      if (!acc) return json(res, 200, { error: 'This login isn’t registered.' });
      if (!checkPw(body.password, store.kvGet('pw', id))) return json(res, 200, { error: 'Wrong password. Try again or ask the Bike Pharma Admin for a new one.' });
    } else {
      const o = store.kvGet('otp', id);
      if (!o) return json(res, 200, { error: 'Please ask for a new OTP.' });
      if (Date.now() > o.exp) { store.kvDel('otp', id); return json(res, 200, { error: 'This OTP has expired. Tap Resend OTP.' }); }
      if (o.tries >= 5) return json(res, 200, { error: 'Too many wrong tries. Tap Resend OTP to get a new one.' });
      if (String(body.otp || '') !== o.code) { o.tries++; store.kvSet('otp', id, o); const l = 5 - o.tries; return json(res, 200, { error: l > 0 ? `That OTP is incorrect. ${l} ${l === 1 ? 'try' : 'tries'} left.` : 'That OTP is incorrect.' }); }
      store.kvDel('otp', id);
      if (!acc) {
        const name = safeText(String((body.signup && body.signup.name) || '').trim().slice(0, 60));
        if (!name) return json(res, 200, { error: 'Enter your name to register.' });
        acc = { role: 'customer', name, label: 'Customer', sub: 'Customer account · joined ' + today(), status: 'active', joined: today() };
        setAccount(id, acc);
      }
    }
    if (acc.status === 'pending') return json(res, 200, { error: loginError.pending });
    const t = sessionCreate(id); setSession(req, res, t);
    return json(res, 200, full({ id, ...acc }));
  }

  if (p === '/api/logout' && m === 'POST') {
    const t = cookies(req).bp_s; if (t) store.kvDel('sess', t);
    setSession(req, res, '', true);
    return json(res, 200, full(null));
  }

  if (p === '/api/sync') {
    if (!user) return json(res, 401, { error: 'Please log in again.' });
    if (m === 'GET') {
      const since = +url.searchParams.get('since') || 0;
      return json(res, 200, { rev: store.rev(), changed: viewOf(store.stateSince(since).map(r => r.key), reader(), user, since === 0) });
    }
    const base = Math.max(0, +body.base || 0); const changes = (body.changes && typeof body.changes === 'object') ? body.changes : {};
    const writes = {}, changed = {}, refused = [];
    const staff = roleClass(user) === 'staff', scoped = !staff;
    for (const [k, cv0] of Object.entries(changes)) {
      if (!/^[A-Za-z_][\w]{0,40}$/.test(k) || cv0 === null || cv0 === undefined) continue;
      const cv = scoped ? cleanStrings(cv0) : cv0;
      const mode = canWrite(k, user); if (!mode) { refused.push(k); continue; }
      if (mode === 'mine') { // a mechanic's own job cards / customers, stored per mechanic
        const sk = MECH_OWN[k]; const sv = stateVal(sk); const merged = applyMine(sv, cv, user);
        if (!deepEqual(merged, sv)) writes[sk] = JSON.stringify(merged);
        if (!deepEqual(merged[user.id], cv0)) changed[k] = merged[user.id];
        continue;
      }
      const row = store.stateGet(k); const sv = row ? JSON.parse(row.json) : undefined;
      let merged;
      if (mode === 'own') merged = applyOwn(k, sv, cv, user);
      else if (!row || row.rev <= base) merged = cv;
      else { const bj = store.versionAt(k, base); merged = merge3(bj === undefined ? undefined : JSON.parse(bj), sv, cv); }
      if (!deepEqual(merged, sv)) writes[k] = JSON.stringify(merged);
      const back = scopeValue(k, merged, user);
      if (!deepEqual(back, cv0)) changed[k] = back === undefined ? null : back; // cleaned text goes back to the writer too
    }
    // the shop's bills: a new mechanic's first bill makes their login (and fixes the code on their later bills)
    if (staff && writes.bills) {
      const ml = mechLogins(JSON.parse(writes.bills), writes.accounts ? JSON.parse(writes.accounts) : accounts(), today());
      if (ml && ml.bills) { writes.bills = JSON.stringify(ml.bills); changed.bills = ml.bills; }
      if (ml && ml.accounts) { writes.accounts = JSON.stringify(ml.accounts); if ('accounts' in changes) changed.accounts = ml.accounts; }
      if (ml && ml.moved && ml.moved.length) {
        const mv = moveCodes(writes.omech ? JSON.parse(writes.omech) : stateVal('omech'), writes.warranties ? JSON.parse(writes.warranties) : stateVal('warranties'), ml.moved);
        if (mv.omech) { writes.omech = JSON.stringify(mv.omech); changed.omech = mv.omech; }
        if (mv.warranties) { writes.warranties = JSON.stringify(mv.warranties); changed.warranties = mv.warranties; }
      }
    }
    const rev = Object.keys(writes).length ? store.write(writes) : store.rev();
    const get = reader();
    for (const [k, v] of Object.entries(viewOf(store.stateSince(base).map(r => r.key), get, user))) if (!(k in changes)) changed[k] = v;
    if (refused.length) { // keys this user may not write: send back what the server has, so the app shows the truth
      const now = viewOf(store.stateAll().map(r => r.key), get, user, true);
      for (const k of refused) if (k in now && !deepEqual(now[k], changes[k])) changed[k] = now[k];
    }
    return json(res, 200, { rev, changed });
  }

  if (p === '/api/users/password' && m === 'POST') {
    if (!user) return json(res, 401, { error: 'Please log in again.' });
    if (user.role !== 'admin') return json(res, 403, { error: 'Only the Admin can set passwords.' });
    const id = normId(body.id); const pw = String(body.password || '');
    if (!id || pw.length < 6) return json(res, 200, { error: 'Password must be at least 6 characters.' });
    store.kvSet('pw', id, hashPw(pw));
    for (const [t, s] of store.kvAll('sess')) if (s.uid === id) store.kvDel('sess', t); // log that person out everywhere
    return json(res, 200, { ok: true });
  }

  if (p === '/api/password' && m === 'POST') {
    if (!user) return json(res, 401, { error: 'Please log in again.' });
    const pw = String(body.password || '');
    if (pw.length < 6) return json(res, 200, { error: 'Password must be at least 6 characters.' });
    if (!checkPw(body.old, store.kvGet('pw', user.id))) return json(res, 200, { error: 'Current password is wrong.' });
    store.kvSet('pw', user.id, hashPw(pw));
    return json(res, 200, { ok: true });
  }

  if ((p === '/api/files/list' || p === '/api/files/read') && m === 'GET') {
    if (!user) return json(res, 401, { error: 'not_granted' });
    if (roleClass(user) !== 'staff') return json(res, 403, { error: 'not_granted' });
    const rel = path.posix.normalize('/' + (url.searchParams.get('path') || '')).replace(/^\/+/, '');
    if (rel.includes('..')) return json(res, 404, { error: 'not_found' });
    const abs = path.join(FILES_DIR, rel);
    let st; try { st = fs.statSync(abs); } catch (e) { return json(res, 404, { error: 'not_found' }); }
    if (p === '/api/files/list') {
      if (!st.isDirectory()) return json(res, 404, { error: 'not_found' });
      const entries = fs.readdirSync(abs, { withFileTypes: true }).filter(e => !e.name.startsWith('.')).map(e => ({ path: (rel ? rel + '/' : '') + e.name, isDirectory: e.isDirectory() }));
      return json(res, 200, { entries, cursor: null });
    }
    if (!st.isFile()) return json(res, 404, { error: 'not_found' });
    const off = Math.max(0, +url.searchParams.get('offset') || 0); let len = +url.searchParams.get('length') || 0;
    if (!len || len > 32 * 1024 * 1024) len = Math.min(st.size - off, 32 * 1024 * 1024);
    len = Math.max(0, Math.min(len, st.size - off));
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': len, 'X-File-Size': st.size, 'Cache-Control': 'private, max-age=3600' });
    if (!len) return res.end();
    fs.createReadStream(abs, { start: off, end: off + len - 1 }).pipe(res);
    return;
  }
  return json(res, 404, { error: 'Not found' });
}

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.wasm': 'application/wasm', '.map': 'application/json', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const GZ_TYPES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.map', '.webmanifest']);
const GZ = new Map(); let gzBytes = 0; const GZ_MAX = 200 * 1024 * 1024;
function gzipped(file, st) {
  const key = file + '|' + st.mtimeMs + '|' + st.size; const c = GZ.get(key); if (c) return c;
  const buf = zlib.gzipSync(fs.readFileSync(file), { level: 6 });
  if (gzBytes + buf.length > GZ_MAX) { GZ.clear(); gzBytes = 0; }
  GZ.set(key, buf); gzBytes += buf.length; return buf;
}
function serveStatic(req, res, url, user) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return json(res, 400, { error: 'Bad path' }); }
  if (rel === '/' || rel === '') rel = '/index.html';
  rel = path.posix.normalize(rel).replace(/^\/+/, '');
  if (rel.includes('..') || rel.includes('\0')) return json(res, 404, { error: 'Not found' });
  const top = rel.split('/')[0];
  if (PROTECTED.includes(top) && roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: 'Staff login needed' });
  const file = path.join(PUBLIC_DIR, rel);
  let st; try { st = fs.statSync(file); } catch (e) { return json(res, 404, { error: 'Not found' }); }
  if (st.isDirectory()) return json(res, 404, { error: 'Not found' });
  const ext = path.extname(file).toLowerCase(); const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const h = { 'Content-Type': type, 'ETag': etag, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Vary': 'Accept-Encoding', ...(ext === '.html' ? { 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' } : {}) };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && st.size) {
    let a = range[1] === '' ? Math.max(0, st.size - +range[2]) : +range[1], b = range[2] === '' || range[1] === '' ? st.size - 1 : Math.min(+range[2], st.size - 1);
    if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  if (GZ_TYPES.has(ext) && st.size < 40 * 1024 * 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const buf = gzipped(file, st);
    res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', 'Content-Length': buf.length });
    return res.end(req.method === 'HEAD' ? undefined : buf);
  }
  res.writeHead(200, { ...h, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const user = userOf(req);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url, user);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
    return serveStatic(req, res, url, user);
  } catch (e) {
    console.error(new Date().toISOString(), req.method, req.url, e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' }); else res.end();
  }
});
server.listen(PORT, HOST, () => {
  console.log(`[bikepharma] v${VERSION} on http://${HOST}:${PORT}  public=${PUBLIC_DIR}  data=${DATA_DIR}  files=${FILES_DIR}  store=${HAS_SQLITE ? 'sqlite' : 'json'}  otp=${OTP.mode}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); store.close(); process.exit(0); });
