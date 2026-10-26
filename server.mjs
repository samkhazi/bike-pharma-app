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
import { roleClass, viewOf, scopeValue, canWrite, merge3, applyOwn, applyMine, mechLogins, moveCodes, deepEqual, cleanStrings, safeText, STAFF_ROLES, MECH_OWN, CUST_OWN } from './lib/merge.mjs';
import { guardScoped } from './lib/custguard.mjs';
import { vinLook, vinSetup } from './lib/vinlook.mjs';
import { rcLook } from './lib/rclook.mjs';
import { otpConfig, makeOtp, deliverOtp } from './lib/sms.mjs';
import { removeDemoData } from './lib/cleanup.mjs';
import { checkNewBills, guardValue, auditRows, BILL_KEYS, setPhotoGone } from './lib/billguard.mjs';
import { stampWho } from './lib/stamp.mjs';
import { photoAi, AI_VER } from './lib/photoai.mjs';
import { billAi } from './lib/billai.mjs';
import { makeAlt } from './lib/altagent.mjs';
import { pnLookup } from './lib/pnlook.mjs';
import { startMirror } from './lib/mysqlmirror.mjs';
import { catGuard } from './lib/catguard.mjs';
import { spawn } from 'node:child_process';
import { HERO_RAW, HERO_OPT, HERO_XL } from './lib/herobuild.mjs';
import { HONDA_RAW } from './lib/hondabuild.mjs';
import { BAJAJ_RAW } from './lib/bajajbuild.mjs';
import { YAMAHA_RAW } from './lib/yamahabuild.mjs';
import { RE_RAW } from './lib/rebuild.mjs';
import { TVS_RAW, TVS_ZIP } from './lib/tvsbuild.mjs';
import { backups } from './lib/backup.mjs';
import { catSplit } from './lib/catsplit.mjs';
import { monitor } from './lib/monitor.mjs';

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
vinSetup({ filesDir: FILES_DIR });   // 12f: RE chassis index
const SESSION_DAYS = +env.SESSION_DAYS || 30;
const PROTECTED = (env.PROTECTED_DIRS || 'cat,bj,ph,phh,figs').split(',').map(s => s.trim()).filter(Boolean);
const OTP = otpConfig(env);
const store = openStore(DATA_DIR);
const MIRROR = startMirror(store, process.env);   // MySQL copy for phpMyAdmin (10m), off unless MYSQL_* are in .env
const CATG = catGuard(store, DATA_DIR, env); CATG.tidy(); setInterval(() => CATG.tidy(), 86400e3).unref();   // catalogue limits + log (11h)
// Hero made on the server from Sam's Raw Data upload (11k) and the PDF > Models index (11m: hero_pdf_index.json, its parts + diagram pages): DATA_DIR/cat/hero.json, hero-dg.json and app.html (its Hero part number line)
// are served instead of the public ones; made again when the Raw Data or the app's own Hero files are newer
const HERO_OUT = path.join(DATA_DIR, 'cat'), HERO_RAW_DIR = path.join(FILES_DIR, 'catalogues', 'hero-raw'), HERO_PDF_DIR = path.join(FILES_DIR, 'catalogues', 'hero-pdf'), HERO_XL_DIR = path.join(FILES_DIR, 'catalogues', 'hero-excel'), HERO_SERVED = new Set(['cat/hero.json', 'cat/hero-dg.json', 'cat/honda.json', 'cat/honda-dg.json', 'cat/bajaj.json', 'cat/bajaj-dg.json', 'cat/yamaha.json', 'cat/yamaha-dg.json', 'cat/royal-enfield.json', 'cat/royal-enfield-dg.json', 'cat/tvs.json', 'cat/tvs-dg.json', 'app.html']);
// 11z: Honda the same way, from the whole Downloads > Honda Catalogue folder (FILES_DIR/catalogues/honda); one build at a time, as both write app.html
const HONDA_DIR = path.join(FILES_DIR, 'catalogues', 'honda');
// 12b: Bajaj too, from Downloads > Bajaj Catalogue (FILES_DIR/catalogues/bajaj)
const BAJAJ_DIR = path.join(FILES_DIR, 'catalogues', 'bajaj');
// 12e: Yamaha too, from Downloads > Yamaha Catalogue (FILES_DIR/catalogues/yamaha)
const YAMAHA_DIR = path.join(FILES_DIR, 'catalogues', 'yamaha');
// 12g: Royal Enfield too, from Downloads > Royal Enfield Catalogue (FILES_DIR/catalogues/royal-enfield)
const RE_DIR = path.join(FILES_DIR, 'catalogues', 'royal-enfield');
// 12y: TVS too, from Downloads > TVS Catalogues (FILES_DIR/catalogues/tvs)
const TVS_DIR = path.join(FILES_DIR, 'catalogues', 'tvs');
let heroBusy = false;
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
function heroBuild(why) {
  if (!HERO_RAW.every(f => fs.existsSync(path.join(HERO_RAW_DIR, f)))) return false;
  const src = [...HERO_RAW.map(f => path.join(HERO_RAW_DIR, f)), ...HERO_OPT.map(f => path.join(HERO_RAW_DIR, f)), ...HERO_XL.map(f => path.join(HERO_XL_DIR, f)), ...['cat/hero.json', 'cat/hero-dg.json', 'app.html'].map(f => path.join(PUBLIC_DIR, f)), path.join(ROOT, 'lib', 'herobuild.mjs'), path.join(HERO_PDF_DIR, 'hero_pdf_index.json')];
  if (why === 'start' && mtime(path.join(HERO_OUT, 'hero.json')) > Math.max(...src.map(mtime))) return false;
  catBuild('hero', why, [path.join(ROOT, 'lib', 'herobuild.mjs'), PUBLIC_DIR, HERO_RAW_DIR, HERO_OUT, HERO_PDF_DIR, HERO_XL_DIR]);
  return true;
}
function hondaBuild(why) {
  if (!HONDA_RAW.every(f => fs.existsSync(path.join(HONDA_DIR, f)))) return false;
  const src = [...HONDA_RAW.map(f => path.join(HONDA_DIR, f)), path.join(PUBLIC_DIR, 'app.html'), path.join(ROOT, 'lib', 'hondabuild.mjs'), path.join(ROOT, 'lib', 'herobuild.mjs')];
  if (why === 'start' && mtime(path.join(HERO_OUT, 'honda.json')) > Math.max(...src.map(mtime))) return false;
  catBuild('honda', why, [path.join(ROOT, 'lib', 'hondabuild.mjs'), PUBLIC_DIR, HONDA_DIR, HERO_OUT]);
  return true;
}
function bajajBuild(why) {
  if (!BAJAJ_RAW.every(f => fs.existsSync(path.join(BAJAJ_DIR, f)))) return false;
  const src = [...BAJAJ_RAW.map(f => path.join(BAJAJ_DIR, f)), path.join(PUBLIC_DIR, 'app.html'), path.join(ROOT, 'lib', 'bajajbuild.mjs'), path.join(ROOT, 'lib', 'herobuild.mjs')];
  if (why === 'start' && mtime(path.join(HERO_OUT, 'bajaj.json')) > Math.max(...src.map(mtime))) return false;
  catBuild('bajaj', why, [path.join(ROOT, 'lib', 'bajajbuild.mjs'), PUBLIC_DIR, BAJAJ_DIR, HERO_OUT]);
  return true;
}
function yamahaBuild(why) {
  if (!YAMAHA_RAW.every(f => fs.existsSync(path.join(YAMAHA_DIR, f)))) return false;
  const src = [...YAMAHA_RAW.map(f => path.join(YAMAHA_DIR, f)), path.join(PUBLIC_DIR, 'app.html'), path.join(ROOT, 'lib', 'yamahabuild.mjs'), path.join(ROOT, 'lib', 'herobuild.mjs')];
  if (why === 'start' && mtime(path.join(HERO_OUT, 'yamaha.json')) > Math.max(...src.map(mtime))) return false;
  catBuild('yamaha', why, [path.join(ROOT, 'lib', 'yamahabuild.mjs'), PUBLIC_DIR, YAMAHA_DIR, HERO_OUT]);
  return true;
}
function reBuild(why) {
  if (!RE_RAW.every(f => fs.existsSync(path.join(RE_DIR, f)))) return false;
  const src = [...RE_RAW.map(f => path.join(RE_DIR, f)), path.join(PUBLIC_DIR, 'app.html'), path.join(ROOT, 'lib', 'rebuild.mjs'), path.join(ROOT, 'lib', 'herobuild.mjs')];
  if (why === 'start' && mtime(path.join(HERO_OUT, 'royal-enfield.json')) > Math.max(...src.map(mtime))) return false;
  catBuild('royal-enfield', why, [path.join(ROOT, 'lib', 'rebuild.mjs'), PUBLIC_DIR, RE_DIR, HERO_OUT]);
  return true;
}
function tvsBuild(why) {
  if (!TVS_RAW.every(f => fs.existsSync(path.join(TVS_DIR, f)))) return false;
  const src = [...TVS_RAW.map(f => path.join(TVS_DIR, f)), path.join(TVS_DIR, TVS_ZIP), path.join(PUBLIC_DIR, 'app.html'), path.join(ROOT, 'lib', 'tvsbuild.mjs'), path.join(ROOT, 'lib', 'herobuild.mjs')];
  if (why === 'start' && mtime(path.join(HERO_OUT, 'tvs.json')) > Math.max(...src.map(mtime))) return false;
  catBuild('tvs', why, [path.join(ROOT, 'lib', 'tvsbuild.mjs'), PUBLIC_DIR, TVS_DIR, HERO_OUT]);
  return true;
}
const catQ = [];   // [slug, why, args]: the builds waiting, run one after another
function catBuild(slug, why, args) {
  if (catQ.some(q => q[0] === slug && q !== catQ[0])) return;   // already waiting (a running one is made again after it)
  catQ.push([slug, why, args]); if (catQ.length === 1) catRun();
}
function catRun() {
  const q = catQ[0]; if (!q) return;
  heroBusy = q[0] === 'hero';
  const c = spawn(process.execPath, ['--max-old-space-size=3072', ...q[2]], { stdio: ['ignore', 'inherit', 'inherit'] });
  c.on('exit', code => { console.log(new Date().toISOString(), q[0] + ' build (' + q[1] + ') ended', code); heroBusy = false; catQ.shift(); catRun(); });
}
heroBuild('start'); hondaBuild('start'); bajajBuild('start'); yamahaBuild('start'); reBuild('start'); tvsBuild('start');
const BACKUP = backups({ store, dataDir: DATA_DIR, env });   // 11u: every night + Admin > More > Backups
// 11v: Hero goes to phones as a head + the part lines they need (lib/catsplit.mjs); CAT_SPLIT=off sends the whole file as before
const heroFile = (slug = 'hero') => { for (const d of slug === 'hero' ? [HERO_OUT, path.join(PUBLIC_DIR, 'cat')] : [HERO_OUT]) { const f = path.join(d, slug + '.json'); if (fs.existsSync(f)) return f; } return null; };
const SPLIT_B = new Set(['hero', 'honda', 'bajaj', 'yamaha', 'royal-enfield', 'tvs']);   // the brands sent as a head + lines (11v, Honda 11z)
const SPLIT = catSplit({ file: slug => SPLIT_B.has(slug) && String(env.CAT_SPLIT || '').toLowerCase() !== 'off' ? heroFile(slug) : null, pct: +env.CAT_ROWS_DAY_PCT || 60 });
const PNLOOK = pnLookup(PUBLIC_DIR, [HERO_OUT], { load: f => { if (!SPLIT || String(env.CAT_SPLIT || '').toLowerCase() === 'off') return null; for (const b of SPLIT_B) if (f === heroFile(b)) return SPLIT.data(f); return null; } }); setTimeout(() => { PNLOOK('').catch(() => {}); }, 4000).unref();   // index the brand files soon after start
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

// ---------- first run: an empty shop, no accounts ----------
if (store.rev() === 0) {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'seed.json'), 'utf8'));
  seed.accounts = {};
  const w = {}; for (const [k, v] of Object.entries(seed)) w[k] = JSON.stringify(v);
  store.write(w);
  console.log('[bikepharma] new database created in', DATA_DIR);
}
// ---------- once: the old demo shop data goes (Sam 2026-10-11 "sample data jo kuch bhi he sabhi delete karde"); a copy is kept in data/ ----------
if (!store.kvGet('meta', 'demoRemoved')) {
  try {
    const r = removeDemoData(store, DATA_DIR, path.join(ROOT, 'lib', 'demo-data.json'));
    store.kvSet('meta', 'demoRemoved', { at: new Date().toISOString(), n: r.n, file: r.file ? path.basename(r.file) : '', keys: r.keys });
    if (r.n) console.log('[bikepharma] removed ' + r.n + ' sample records; a copy is in ' + r.file);
  } catch (e) { console.error('[bikepharma] sample data clean-up skipped (the site keeps running; try: node admin.mjs clear-demo):', e.message); }
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
const ipOf = req => (req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '';
const loginError = { off: 'This login has been deactivated by Admin. Please contact your Admin.', pending: 'Your account is waiting for Bike Pharma verification.' };

// ---------- web agent for part numbers no catalogue has (lib/altagent.mjs, update 8h) ----------
const ALT = makeAlt({ store, PUBLIC_DIR, env, json, roleClass, limited });

// ---------- API ----------
async function api(req, res, url, user) {
  const p = url.pathname, m = req.method;
  if (m === 'POST') {
    const origin = req.headers.origin; // same-site only
    if (origin && origin !== 'null') { try { if (new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Bad origin' }); } catch (e) { return json(res, 403, { error: 'Bad origin' }); } }
  }
  if (p === '/api/catup') return catUpload(req, res, url, user);
  if (p === '/api/photo/status') return photoStatus(req, res, url, user);
  if (p === '/api/photo/wrong') return photoWrong(req, res, url, user);
  if (p === '/api/photo') return photoUpload(req, res, user, url);
  if (p === '/api/backups' || p === '/api/backups/file') {
    if (!user || user.role !== 'admin') { drain(req); return json(res, user ? 403 : 401, { error: 'Only Admin' }); }
    if (p === '/api/backups' && m === 'GET') return json(res, 200, { list: BACKUP.list(), copyTo: BACKUP.copyTo, keep: BACKUP.keep, at: BACKUP.at, busy: BACKUP.busy() });
    if (p === '/api/backups' && m === 'POST') { drain(req); try { const name = await BACKUP.make('admin'); return json(res, 200, { name, list: BACKUP.list() }); } catch (e) { return json(res, 500, { error: 'Backup failed: ' + e.message }); } }
    if (p === '/api/backups/file' && m === 'GET') {
      const f = BACKUP.file(url.searchParams.get('name')); if (!f) return json(res, 404, { error: 'Backup not found' });
      console.log(new Date().toISOString(), 'backup downloaded', path.basename(f), 'by', user.id);
      res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Length': fs.statSync(f).size, 'Content-Disposition': 'attachment; filename="' + path.basename(f) + '"', 'Cache-Control': 'no-store' });
      return fs.createReadStream(f).pipe(res);
    }
    drain(req); return json(res, 405, { error: 'Method not allowed' });
  }
  if (p === '/api/photos/missing' && m === 'GET') return json(res, roleClass(user) === 'staff' ? 200 : user ? 403 : 401, roleClass(user) === 'staff' ? photosMissing(reader()) : { error: 'Staff login needed' });
  if (p === '/api/billread') return billRead(req, res, user);
  if (p === '/api/dghot' || p === '/api/dghot/edit') return dgHot(req, res, url, user);
  if (p === '/api/vinlook') {   // update 9o: chassis number -> model from the maker's site (staff only)
    drain(req);
    if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: user ? 'Staff login needed' : 'Please log in again' });
    if (limited('vin:' + user.id, 60, 10 * 60 * 1000)) return json(res, 429, { error: 'Too many chassis searches, try again in a few minutes' });
    return json(res, 200, await vinLook(url.searchParams.get('c')));
  }
  if (p === '/api/pnlook') {   // update 10r: part number -> its lines in every brand catalogue, so a phone does not load whole catalogues
    drain(req);
    if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: user ? 'Staff login needed' : 'Please log in again' });
    return json(res, 200, await PNLOOK(url.searchParams.get('q')));
  }
  if (p === '/api/rclook') {   // update 10d: registration number -> RC details from the paid RC API (staff only; the key stays here)
    drain(req);
    if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: user ? 'Staff login needed' : 'Please log in again' });
    if (limited('rc:' + user.id, 40, 10 * 60 * 1000)) return json(res, 429, { error: 'Too many registration searches, try again in a few minutes' });
    return json(res, 200, await rcLook(url.searchParams.get('r')));
  }
  let body = {};
  if (m === 'POST') { try { const b = await readBody(req); body = b.length ? JSON.parse(b.toString('utf8')) : {}; } catch (e) { return json(res, 400, { error: 'Bad request body' }); } }
  const catList = () => { const l = new Set(); for (const d of [path.join(PUBLIC_DIR, 'cat'), HERO_OUT]) { try { for (const f of fs.readdirSync(d)) if (f.endsWith('.json') && !/-(build|app)\.json$/.test(f)) l.add(f); } catch {} } return [...l].sort(); };
  const cfg = () => ({ otpHint: OTP.mode === 'fixed' ? OTP.fixed : null, otpMode: OTP.mode, version: VERSION, cat: catList() });
  const full = u => ({ user: u ? u : null, db: viewOf(store.stateAll().map(r => r.key), reader(), u, true), rev: store.rev(), cfg: cfg() });

  if (p === '/api/cat/rows' && m === 'POST') {   // 11v: the part lines of a split catalogue the phone needs now (staff only, counted like cat/ files)
    if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: user ? 'Staff login needed' : 'Please log in again' });
    const e = CATG.check(user); if (e) return json(res, 429, { error: e });
    const slug = String(body.b || ''); if (!/^[a-z0-9-]{1,40}$/.test(slug)) return json(res, 400, { error: 'Bad catalogue' });
    let r; try { r = SPLIT.rows(slug, body, user); } catch (x) { console.log(new Date().toISOString(), 'cat rows failed', x.message); return json(res, 500, { error: 'Could not read the catalogue' }); }
    if (r.error) return json(res, r.code || 400, { error: r.error });
    if (r.over) { CATG.stop(user, 'lines', ipOf(req)); return json(res, 429, { error: CATG.check(user) || 'Catalogue limit for today reached' }); }
    delete r.over;
    const raw = Buffer.from(JSON.stringify(r)), gz = /\bgzip\b/.test(req.headers['accept-encoding'] || ''), out = gz ? zlib.gzipSync(raw, { level: 6 }) : raw;
    CATG.count(user, 'cat', raw.length, 'cat/' + slug + '.json lines ' + r.g.length, ipOf(req));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': out.length, 'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
    return res.end(out);
  }
  if (p === '/api/alerts' || p === '/api/alerts/test' || p === '/api/alerts/report') {   // 11w: Admin sees whether email alerts are on, the last alerts, and sends a test email
    if (!user || user.role !== 'admin') return json(res, user ? 403 : 401, { error: 'Admin only' });
    if (p === '/api/alerts/report' && m === 'POST') { const d = String((body && body.day) || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json(res, 400, { error: 'Pick a date' }); try { await MON.report(d); return json(res, 200, { ok: true }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (p === '/api/alerts/test' && m === 'POST') { try { await MON.test(); return json(res, 200, { ok: true }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    let l = []; try { l = fs.readFileSync(path.join(DATA_DIR, 'alerts.log'), 'utf8').trim().split('\n').slice(-200).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(x => x && x.title).slice(-15).reverse(); } catch {}
    const mask = e => e.replace(/^(.{2}).*(@.*)$/, '$1…$2');
    return json(res, 200, { on: MON.on, to: MON.to.map(mask), last: l.map(x => ({ at: x.at, title: x.title })) });
  }
  if (p === '/api/alt') return ALT.api(m, body, user, res);
  if (p === '/api/health' && m === 'GET') return json(res, 200, { ok: true, rev: store.rev(), sqlite: HAS_SQLITE, version: VERSION, photoAi: PHOTO_AI.summary(), billAi: BILL_AI.summary(), mysql: MIRROR.summary() });
  if (p === '/api/boot' && m === 'GET') { if (!user && cookies(req).bp_s) setSession(req, res, '', true); return json(res, 200, full(user)); }

  if (p === '/api/otp' && m === 'POST') {
    const id = normId(body.id);
    if (!id) return json(res, 200, { error: 'Enter your mobile number or email.' });
    const acc = accounts()[id];
    if ((stateVal('staffOff') || []).includes(id)) return json(res, 200, { error: loginError.off });
    if (acc && acc.status === 'pending') return json(res, 200, { error: loginError.pending });
    const isEmail = id.includes('@');
    // staff and Admin: password, but a mobile-number login gets a real SMS OTP instead (Sam 2026-10-22, update 10t); never the test OTP
    if (acc && (isEmail || (STAFF_ROLES.includes(acc.role) && !(OTP.real && /^[6-9]\d{9}$/.test(id))))) return json(res, 200, { kind: 'password', name: acc.name });
    if (!acc && isEmail) return json(res, 200, { error: 'This email isn’t registered. Staff logins are created by the Bike Pharma Admin.' });
    if (!/^[6-9]\d{9}$/.test(id)) return json(res, 200, { error: 'Enter a valid 10-digit mobile number.' });
    // real SMS: a new OTP every 30 s at most, 5 SMS an hour per number, 20 an hour per IP (so nobody can empty the SMS balance)
    const prev = store.kvGet('otp', id);
    if (OTP.real && prev && prev.sent && Date.now() - prev.sent < 30e3) return json(res, 200, { error: 'Please wait ' + Math.ceil((30e3 - (Date.now() - prev.sent)) / 1000) + ' seconds before asking for a new OTP.' });
    if (OTP.real ? (limited('otph:' + id, 5, 3600e3) || limited('otphip:' + ipOf(req), 20, 3600e3)) : (limited('otp:' + id, 5, 600e3) || limited('otpip:' + ipOf(req), 40, 600e3))) return json(res, 200, { error: 'Too many OTP requests. Please try again later.' });
    const code = makeOtp(OTP);
    store.kvSet('otp', id, { code, exp: Date.now() + 5 * 60e3, tries: 0, sent: Date.now() });
    const d = await deliverOtp(OTP, id, code);
    if (!d.ok) { store.kvDel('otp', id); return json(res, 200, { error: d.error }); }
    return json(res, 200, { kind: 'otp', signup: !acc });
  }

  if (p === '/api/login' && m === 'POST') {
    const id = normId(body.id);
    let acc = accounts()[id];
    if ((stateVal('staffOff') || []).includes(id)) return json(res, 200, { error: loginError.off });
    if (limited('login:' + id, 20, 600e3) || limited('loginip:' + ipOf(req), 100, 600e3)) return json(res, 200, { error: 'Too many tries. Please wait a few minutes.' });
    if (body.password != null) {
      if (!acc) { MON.loginFail(ipOf(req), id, 'no such login'); return json(res, 200, { error: 'This login isn’t registered.' }); }
      if (!checkPw(body.password, store.kvGet('pw', id))) { MON.loginFail(ipOf(req), id, 'wrong password'); return json(res, 200, { error: 'Wrong password. Try again or ask the Bike Pharma Admin for a new one.' }); }
    } else {
      const o = store.kvGet('otp', id);
      if (!o) return json(res, 200, { error: 'Please ask for a new OTP.' });
      if (Date.now() > o.exp) { store.kvDel('otp', id); return json(res, 200, { error: 'This OTP has expired. Tap Resend OTP.' }); }
      if (o.tries >= 3) return json(res, 200, { error: 'Too many wrong tries. Tap Resend OTP to get a new one.' });
      if (String(body.otp || '') !== o.code) { MON.loginFail(ipOf(req), id, 'wrong OTP'); o.tries++; store.kvSet('otp', id, o); const l = 3 - o.tries; return json(res, 200, { error: l > 0 ? `That OTP is incorrect. ${l} ${l === 1 ? 'try' : 'tries'} left.` : 'That OTP is incorrect.' }); }
      store.kvDel('otp', id);
      if (!acc) {
        const name = safeText(String((body.signup && body.signup.name) || '').trim().slice(0, 60));
        if (!name) return json(res, 200, { error: 'Enter your name to register.' });
        acc = { role: 'customer', name, label: 'Customer', sub: 'Customer account · joined ' + today(), status: 'active', joined: today() };
        setAccount(id, acc);
      }
    }
    if (acc.status === 'pending') return json(res, 200, { error: loginError.pending });
    MON.loginOk({ id, ...acc }, ipOf(req), roleClass({ id, ...acc }) === 'staff');
    const t = sessionCreate(id); setSession(req, res, t);
    return json(res, 200, full({ id, ...acc }));
  }

  if (p === '/api/logout' && m === 'POST') {
    const t = cookies(req).bp_s; if (t) store.kvDel('sess', t);
    if (user && body && body.all) for (const [t2, s] of store.kvAll('sess')) if (s.uid === user.id) store.kvDel('sess', t2); // "Log out from all devices"

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
    // update 8o (Sam 2026-10-12): the Billing rules are checked here, not trusted from the app (lib/billguard.mjs)
    const gget = reader(); const gnotes = staff ? checkNewBills(changes, user, gget) : [];
    const gblock = gnotes.length ? new Set(BILL_KEYS) : null;
    // orders first: the wallet and warranty checks of a customer look at the orders of this same sync
    const ctx = { stock: null };
    for (const [k, cv0] of Object.entries(changes).sort(([a], [b]) => (b === 'orders') - (a === 'orders'))) {
      if (!/^[A-Za-z_][\w]{0,40}$/.test(k) || cv0 === null || cv0 === undefined) continue;
      const cv = scoped ? cleanStrings(cv0) : cv0;
      const mode = canWrite(k, user); if (!mode || (gblock && gblock.has(k))) { refused.push(k); continue; }
      if (mode === 'mine') { // a mechanic's own job cards / customers, stored per mechanic
        const sk = MECH_OWN[k] || CUST_OWN[k]; const sv = stateVal(sk); const merged = applyMine(sv, cv, user, !MECH_OWN[k]);
        if (!deepEqual(merged, sv)) writes[sk] = JSON.stringify(merged);
        if (!deepEqual(merged[user.id], cv0)) changed[k] = merged[user.id];
        continue;
      }
      const row = store.stateGet(k); const sv = row ? JSON.parse(row.json) : undefined;
      let merged;
      if (mode === 'own') merged = applyOwn(k, sv, cv, user);
      else if (!row || row.rev <= base) merged = cv;
      else { const bj = store.versionAt(k, base); merged = merge3(bj === undefined ? undefined : JSON.parse(bj), sv, cv); }
      if (staff) { const [gv, gn] = guardValue(k, sv, merged, user, gget); merged = gv; gnotes.push(...gn); }
      if (staff) merged = stampWho(k, sv, merged, user);   // update 9z: who added a product / stock entry
      if (staff) try { MON.write(k, sv, merged, user, ipOf(req)); } catch (e) { console.log('monitor write', e.message); }   // 11w: report + mass delete alert
      else { const [gv, gn] = guardScoped(k, sv, merged, user, gget, ctx); merged = gv; if (gn.length) console.log(new Date().toISOString(), 'refused for', user.id, gn.join(' | ')); }
      if (!deepEqual(merged, sv)) writes[k] = JSON.stringify(merged);
      const back = scopeValue(k, merged, user);
      if (!deepEqual(back, cv0)) changed[k] = back === undefined ? null : back; // cleaned text goes back to the writer too
    }
    // a customer's new online order takes its parts out of the shop's stock here (the app may not write stock)
    if (ctx.stock) { writes.stock = JSON.stringify(ctx.stock); changed.stock = scopeValue('stock', ctx.stock, user); }
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
    if (gnotes.length) { const au = writes.audit ? JSON.parse(writes.audit) : stateVal('audit') || []; writes.audit = JSON.stringify([...auditRows(user, gnotes), ...(Array.isArray(au) ? au : [])]); changed.audit = JSON.parse(writes.audit); console.log(new Date().toISOString(), 'refused for', user.id, gnotes.join(' | ')); }
    const rev = Object.keys(writes).length ? store.write(writes) : store.rev();
    const get = reader();
    for (const [k, v] of Object.entries(viewOf(store.stateSince(base).map(r => r.key), get, user))) if (!(k in changes)) changed[k] = v;
    if (refused.length) { // keys this user may not write: send back what the server has, so the app shows the truth
      const now = viewOf(store.stateAll().map(r => r.key), get, user, true);
      for (const k of refused) if (k in now && !deepEqual(now[k], changes[k])) changed[k] = now[k];
    }
    return json(res, 200, { rev, changed, ...(gnotes.length ? { why: gnotes[0] } : {}) });
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

  // catalogue guard (11h): Admin sees today's catalogue use and the stopped logins, and can unlock one
  if (p === '/api/catsec' && m === 'GET') {
    if (!user || user.role !== 'admin') return json(res, user ? 403 : 401, { error: 'Only Admin' });
    return json(res, 200, CATG.report());
  }
  if (p === '/api/catsec/unlock' && m === 'POST') {
    if (!user || user.role !== 'admin') { drain(req); return json(res, user ? 403 : 401, { error: 'Only Admin' }); }
    SPLIT.reset(String(body.id || ''));
    return json(res, 200, { ok: CATG.unlock(String(body.id || ''), user.id) });
  }

  if ((p === '/api/files/list' || p === '/api/files/read') && m === 'GET') {
    if (!user) return json(res, 401, { error: 'not_granted' });
    if (roleClass(user) !== 'staff') return json(res, 403, { error: 'not_granted' });
    const rel = path.posix.normalize('/' + (url.searchParams.get('path') || '')).replace(/^\/+/, '');
    // a '..' folder step is never allowed; two dots inside a file name are (Sam's TVS book "APACHE 160 4V PC ,..pdf")
    if (rel.split('/').includes('..') || rel.includes('\0')) return json(res, 404, { error: 'not_found' });
    const abs = path.join(FILES_DIR, rel);
    let st; try { st = fs.statSync(abs); } catch (e) { return json(res, 404, { error: 'not_found' }); }
    if (p === '/api/files/list') {
      if (!st.isDirectory()) return json(res, 404, { error: 'not_found' });
      const entries = fs.readdirSync(abs, { withFileTypes: true }).filter(e => !e.name.startsWith('.') && !e.name.endsWith('.part')).map(e => {
        const o = { path: (rel ? rel + '/' : '') + e.name, isDirectory: e.isDirectory() };
        if (e.isFile()) { try { o.size = fs.statSync(path.join(abs, e.name)).size; } catch (x) {} }
        return o;
      });
      return json(res, 200, { entries, cursor: null });
    }
    if (!st.isFile()) return json(res, 404, { error: 'not_found' });
    { const e = CATG.check(user); if (e) return json(res, 429, { error: e }); }
    const off = Math.max(0, +url.searchParams.get('offset') || 0); let len = +url.searchParams.get('length') || 0;
    if (!len || len > 32 * 1024 * 1024) len = Math.min(st.size - off, 32 * 1024 * 1024);
    len = Math.max(0, Math.min(len, st.size - off));
    const a85 = url.searchParams.get('a85') === '1';
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}-${off.toString(16)}-${len.toString(16)}${a85 ? '-a' : ''}"`;
    const head = { 'X-File-Size': st.size, 'Cache-Control': 'private, max-age=604800', 'ETag': etag, 'X-Content-Type-Options': 'nosniff' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    CATG.count(user, 'files', len, rel, ipOf(req));
    if (a85) { // a diagram stored in a catalogue PDF as ASCII85 text: send the JPEG bytes exactly as they were put in
      const buf = Buffer.alloc(len); const fd = fs.openSync(abs, 'r'); try { fs.readSync(fd, buf, 0, len, off); } finally { fs.closeSync(fd); }
      const img = ascii85(buf);
      if (!img || img[0] !== 0xFF || img[1] !== 0xD8) return json(res, 422, { error: 'not_an_image' });
      res.writeHead(200, { ...head, 'Content-Type': 'image/jpeg', 'Content-Length': img.length });
      return res.end(img);
    }
    res.writeHead(200, { ...head, 'Content-Type': 'application/octet-stream', 'Content-Length': len });
    if (!len) return res.end();
    fs.createReadStream(abs, { start: off, end: off + len - 1 }).pipe(res);
    return;
  }
  return json(res, 404, { error: 'Not found' });
}

// ---------- catalogue files (Sam's brand catalogues: PDFs, diagrams, photos) uploaded by Admin into data/project-files/catalogues ----------
// GET  /api/catup?path=catalogues/ktm/X.pdf&size=N   -> { have, done }  (how much of it the server already has)
// POST /api/catup?path=...&size=N&offset=K, body = the next bytes (one piece of the file) -> { have, done }
// A file already here with the same size is never taken again (one copy only); a cut connection resumes where it stopped.
const CAT_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.zip', '.json', '.csv', '.xlsx', '.xls', '.txt', '.bin', '.gz', '.tsv']);
const CAT_CHUNK_MAX = 16 * 1024 * 1024;
const catBusy = new Set();
function ascii85(buf) {
  let s = buf.toString('latin1').replace(/\s+/g, '');
  if (s.startsWith('<~')) s = s.slice(2);
  const end = s.indexOf('~>'); if (end < 0) return null; s = s.slice(0, end);
  let zc = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 122) zc++;
  const out = Buffer.alloc(Math.ceil((s.length - zc) / 5) * 4 + zc * 4 + 4); let n = 0, acc = 0, cnt = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 122 && cnt === 0) { out.writeUInt32BE(0, n); n += 4; continue; } // 'z' = four zero bytes
    if (c < 33 || c > 117) return null;
    acc = acc * 85 + (c - 33); cnt++;
    if (cnt === 5) { out.writeUInt32BE(acc >>> 0, n); n += 4; acc = 0; cnt = 0; }
  }
  if (cnt) { for (let k = cnt; k < 5; k++) acc = acc * 85 + 84; const b = Buffer.alloc(4); b.writeUInt32BE(acc >>> 0, 0); b.copy(out, n, 0, cnt - 1); n += cnt - 1; }
  return out.subarray(0, n);
}
function drain(req) { req.resume(); }
async function catUpload(req, res, url, user) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!user) { drain(req); return json(res, 401, { error: 'Please log in again' }); }
  if (user.role !== 'admin') { drain(req); return json(res, 403, { error: 'Only Admin can upload catalogues' }); }
  if (req.method === 'GET' && url.searchParams.get('space') === '1') { // free disk space where the catalogue files go (Honda's zip alone is 8 GB)
    let free = null, total = null;
    try { fs.mkdirSync(FILES_DIR, { recursive: true }); const st = fs.statfsSync(FILES_DIR); free = st.bavail * st.bsize; total = st.blocks * st.bsize; } catch (e) {}
    return json(res, 200, { free, total });
  }
  const rel = path.posix.normalize('/' + (url.searchParams.get('path') || '')).replace(/^\/+/, '');
  const segs = rel.split('/');
  if (segs[0] !== 'catalogues' || segs.length < 3 || segs.some(x => !/^[A-Za-z0-9_][A-Za-z0-9 \u00a0._()[\]+,;&%'\u2013-]{0,150}$/.test(x) || x === '..') || !CAT_EXTS.has(path.extname(rel).toLowerCase()) || rel.endsWith('.part')) {
    drain(req); return json(res, 400, { error: 'This file name or type cannot be uploaded' });
  }
  const size = Math.floor(+url.searchParams.get('size'));
  if (!(size > 0 && size <= 64 * 1024 ** 3)) { drain(req); return json(res, 400, { error: 'Bad file size' }); }
  const abs = path.join(FILES_DIR, rel), part = abs + '.part';
  const sizeOf = f => { try { const st = fs.statSync(f); return st.isFile() ? st.size : -1; } catch (e) { return -1; } };
  if (sizeOf(abs) === size) { drain(req); return json(res, 200, { have: size, done: true }); }
  const have0 = Math.max(0, sizeOf(part));
  if (req.method === 'GET') return json(res, 200, { have: have0 > size ? 0 : have0, done: false });
  const off = Math.floor(+url.searchParams.get('offset'));
  const len = +req.headers['content-length'] || 0;
  if (catBusy.has(abs)) { drain(req); return json(res, 409, { error: 'This file is already being uploaded', have: have0 }); }
  if (have0 > size) { try { fs.truncateSync(part, 0); } catch (e) {} drain(req); return json(res, 409, { have: 0 }); }
  if (off !== have0) { drain(req); return json(res, 409, { have: have0 }); }
  if (!len || len > CAT_CHUNK_MAX || off + len > size) { drain(req); return json(res, 400, { error: 'Bad piece of the file' }); }
  try { let d = path.dirname(abs); while (!fs.existsSync(d)) d = path.dirname(d); const fsx = fs.statfsSync(d); if (fsx.bavail * fsx.bsize < (size - off) + 256 * 1024 * 1024) { drain(req); return json(res, 507, { error: 'The server disk is full' }); } } catch (e) {}
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  catBusy.add(abs);
  try {
    await new Promise((ok, no) => {
      const w = fs.createWriteStream(part, { flags: 'a' }); let n = 0, bad = false;
      req.on('data', d => { n += d.length; if (n > len && !bad) { bad = true; req.unpipe(w); w.end(); no(new Error('too long')); } });
      req.on('aborted', () => { if (!bad) { bad = true; w.end(); no(new Error('aborted')); } });
      req.on('error', e => { if (!bad) { bad = true; w.end(); no(e); } });
      w.on('error', e => { if (!bad) { bad = true; no(e); } });
      w.on('finish', () => { if (!bad) ok(); });
      req.pipe(w);
    });
  } catch (e) {
    try { fs.truncateSync(part, off); } catch (x) {}
    catBusy.delete(abs);
    if (!res.headersSent && !res.destroyed) return json(res, 400, { error: 'The piece did not arrive whole, sending it again', have: off });
    return;
  }
  catBusy.delete(abs);
  let have = sizeOf(part);
  if (have !== off + len) { try { fs.truncateSync(part, off); } catch (x) {} return json(res, 400, { error: 'The piece did not arrive whole, sending it again', have: off }); }
  if (have === size) { fs.renameSync(part, abs); console.log(new Date().toISOString(), 'catalogue file uploaded', rel, size, 'by', user.id); if (abs.startsWith(HERO_RAW_DIR + path.sep) || abs.startsWith(HERO_XL_DIR + path.sep) || abs === path.join(HERO_PDF_DIR, 'hero_pdf_index.json')) heroBuild('upload'); if (path.dirname(abs) === HONDA_DIR && HONDA_RAW.includes(path.basename(abs))) hondaBuild('upload'); if (path.dirname(abs) === BAJAJ_DIR && BAJAJ_RAW.includes(path.basename(abs))) bajajBuild('upload'); if (path.dirname(abs) === YAMAHA_DIR && YAMAHA_RAW.includes(path.basename(abs))) yamahaBuild('upload'); if (path.dirname(abs) === RE_DIR && RE_RAW.includes(path.basename(abs))) reBuild('upload'); if (path.dirname(abs) === TVS_DIR && [...TVS_RAW, TVS_ZIP].includes(path.basename(abs))) tvsBuild('upload'); return json(res, 200, { have, done: true }); }
  return json(res, 200, { have, done: false });
}

// ---------- product photos (Sam 2026-10-11: 1 to 4 photos for every product, shown in the app) ----------
// Saved exactly as sent (no resizing or re-compression). The name is the photo's own fingerprint, so the same photo is kept once.
// The app shows the copies lib/photoai.mjs makes (background white or as taken, the faint logo behind the part): <hash>-c.jpg / <hash>-w.jpg.
// The photo as taken is for shop staff only.
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
// 11w: security alerts by email at once + the 9 pm products report (lib/monitor.mjs; SMTP_* and ALERT_TO in .env)
const MON = monitor({ store, rootDir: ROOT, dataDir: DATA_DIR, env, getState: k => stateVal(k), photoGone: u => photoGone(u), photoDir: PHOTO_DIR });
CATG.onStop = (user, kind, ip) => MON.catStop(user, kind, ip);
// 12z: no email when the site starts (Sam 2026-10-26: one came every few seconds while pm2 restarted it); only a line in the log
console.log(new Date().toISOString(), 'server started, pid ' + process.pid);
const PHOTO_MAX = 25 * 1024 * 1024;
const PHOTO_URL = /^\/photos\/([a-f0-9]{32})(?:-([cw]))?\.(jpg|png|webp)$/;
const PHOTO_AI = photoAi({ root: ROOT, photoDir: PHOTO_DIR, dataDir: DATA_DIR, env });
setTimeout(() => PHOTO_AI.backfill(), 5000).unref();
function photoKind(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return 'png';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return '';
}
async function photoUpload(req, res, user, url) {
  if (req.method !== 'POST') { drain(req); return json(res, 405, { error: 'Method not allowed' }); }
  if (roleClass(user) !== 'staff') { drain(req); return json(res, user ? 403 : 401, { error: user ? 'Only shop staff can add product photos' : 'Please log in again' }); }
  if (limited('photo:' + user.id, 600, 3600e3)) { drain(req); return json(res, 429, { error: 'Too many photos in one hour. Please wait a little.' }); }
  if ((+req.headers['content-length'] || 0) > PHOTO_MAX) { drain(req); return json(res, 413, { error: 'This photo is too big (25 MB max)' }); }
  let b; try { b = await readBody(req, PHOTO_MAX); } catch (e) { return json(res, 413, { error: 'This photo is too big (25 MB max)' }); }
  const kind = photoKind(b);
  if (!kind) return json(res, 400, { error: 'Only JPG, PNG or WEBP photos can be saved' });
  const name = crypto.createHash('sha256').update(b).digest('hex').slice(0, 32) + '.' + kind, file = path.join(PHOTO_DIR, name);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    const tmp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    fs.writeFileSync(tmp, b); fs.renameSync(tmp, file);
    console.log(new Date().toISOString(), 'product photo saved', name, b.length, 'by', user.id);
  }
  const h = name.slice(0, 32);
  if (!url || url.searchParams.get('ai') !== 'off') PHOTO_AI.enqueue(h); // a bill photo (expenses) needs no cut-out
  return json(res, 200, { url: '/photos/' + h + '-c.jpg', orig: '/photos/' + name, size: b.length, ai: PHOTO_AI.status(h) });
}
// ---------- "Apna AI" bill reader (Sam 2026-10-11 20:10Z): a bill page in, its text out ----------
// The phone sends the page it has cut out and straightened; ai/billread.mjs reads it in memory. Nothing is written to disk, nothing is kept.
const BILL_AI = billAi({ root: ROOT, dataDir: DATA_DIR, env });
const BILL_MAX = 12 * 1024 * 1024;
async function billRead(req, res, user) {
  if (req.method !== 'POST') { drain(req); return json(res, 405, { error: 'Method not allowed' }); }
  if (roleClass(user) !== 'staff') { drain(req); return json(res, user ? 403 : 401, { error: user ? 'Only shop staff can read bills' : 'Please log in again' }); }
  if (limited('bill:' + user.id, 400, 3600e3)) { drain(req); return json(res, 429, { error: 'Too many pages in one hour. Please wait a little.' }); }
  if ((+req.headers['content-length'] || 0) > BILL_MAX) { drain(req); return json(res, 413, { error: 'This page is too big (12 MB max)' }); }
  let b; try { b = await readBody(req, BILL_MAX); } catch (e) { return json(res, 413, { error: 'This page is too big (12 MB max)' }); }
  if (!photoKind(b)) return json(res, 400, { error: 'Send the page as a JPG, PNG or WEBP picture' });
  try { const r = await BILL_AI.read(b); return json(res, 200, { ok: true, ...r }); }
  catch (e) { return json(res, 503, { error: String(e && e.message || e).slice(0, 200) }); }
}
// ---------- diagram numbers (update 8m, Sam 2026-10-12 10:06Z "diagram pe jo numbers he 1,2,3,4,5,6,7, sabhi number clickable he"):
// where each ref number sits on a catalogue diagram. The bill reader's AI reads a diagram once, the first time staff open it, and the
// numbers are kept in data/dghot/ (one small file per diagram); Admin's own fixes (a number placed or taken away) are kept with them.
//   GET  /api/dghot?u=<diagram>&ocr=1   -> { toks, lo, ed }   toks = [[text, x0, y0, x1, y1, sure]] in fractions of the picture (null: not read);
//                                          lo = unsure readings, taken by the page only for a number of the diagram's list not found yet
//        a picture in a catalogue file on this server is read here; a PDF page ('pdf:' diagrams) answers { need: 'img' } until the
//        app sends the page as it drew it (POST); ocr=0 only gives Admin's fixes (Bajaj/Suzuki pages: the numbers are in the PDF's text)
//   POST /api/dghot?u=<diagram>  body = the drawn page (PNG/JPG)
//   POST /api/dghot/edit  { u, add: [text, x0, y0, x1, y1] } or { u, del: [x, y] }   Admin only
const HOT_DIR = path.join(DATA_DIR, 'dghot'), HOT_RUN = new Map(), HOT_MAX = 12 * 1024 * 1024;
const HOT_U = /^(?:p[fa]:catalogues\/[^\0]+?:\d+:\d+|pdf:catalogues\/[^\0]+?:\d+:\d+:\d+:[\d.]+,[\d.]+,[\d.]+,[\d.]+)$/;
const hotFile = u => path.join(HOT_DIR, crypto.createHash('sha1').update(u).digest('hex') + '.json');
const hotRead = u => { try { return JSON.parse(fs.readFileSync(hotFile(u), 'utf8')); } catch (e) { return null; } };
const hotWrite = (u, o) => { fs.mkdirSync(HOT_DIR, { recursive: true }); const f = hotFile(u), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, f); };
const hotOut = o => ({ toks: o.toks || null, lo: o.lo || [], ed: o.ed || [] });
// the diagram's picture straight out of the catalogue file here, as /api/files/read sends it
function hotImg(u) {
  const m = /^(p[fa]):(.+):(\d+):(\d+)$/.exec(u); if (!m) return null;
  const rel = path.posix.normalize('/' + m[2]).replace(/^\/+/, '');
  if (rel.split('/').includes('..') || !rel.startsWith('catalogues/')) return null;
  const len = +m[4]; if (!len || len > 32 * 1024 * 1024) return null;
  let buf = Buffer.alloc(len); let fd;
  try { fd = fs.openSync(path.join(FILES_DIR, rel), 'r'); if (fs.readSync(fd, buf, 0, len, +m[3]) !== len) return null; } catch (e) { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
  if (m[1] === 'pa' && !(buf[0] === 0xFF && buf[1] === 0xD8)) buf = ascii85(buf);
  return buf && photoKind(buf) ? buf : null;
}
// an SVG diagram (Hero's newest editions, update 9l): the page draws it and sends the PNG, as for a PDF page
function hotSvg(u) {
  const m = /^pf:(.+):(\d+):(\d+)$/.exec(u); if (!m) return false;
  const rel = path.posix.normalize('/' + m[1]).replace(/^\/+/, '');
  if (rel.split('/').includes('..') || !rel.startsWith('catalogues/')) return false;
  const buf = Buffer.alloc(Math.min(400, +m[3])); let fd;
  try { fd = fs.openSync(path.join(FILES_DIR, rel), 'r'); fs.readSync(fd, buf, 0, buf.length, +m[2]); } catch (e) { return false; } finally { if (fd !== undefined) fs.closeSync(fd); }
  return buf[0] === 0x3C && /<svg[\s>]/.test(buf.toString('latin1'));
}
async function hotOcr(res, u, buf, user) {
  let job = HOT_RUN.get(u);
  if (!job) {
    if (limited('dghot:' + user.id, 300, 3600e3)) return json(res, 429, { error: 'Too many diagrams in one hour. Please wait a little.' });
    job = BILL_AI.nums(buf).then(r => {
      const o = hotRead(u) || { u, ed: [] };
      Object.assign(o, { u, toks: r.toks, lo: r.lo || [], w: r.w, h: r.h, at: new Date().toISOString() }); hotWrite(u, o); return o;
    }).finally(() => HOT_RUN.delete(u));
    HOT_RUN.set(u, job);
  }
  try { return json(res, 200, hotOut(await job)); }
  catch (e) { const o = hotRead(u) || {}; return json(res, 200, { ...hotOut(o), toks: null, off: String(e && e.message || e).slice(0, 200) }); }
}
async function dgHot(req, res, url, user) {
  if (roleClass(user) !== 'staff') { drain(req); return json(res, user ? 403 : 401, { error: user ? 'Staff login needed' : 'Please log in again' }); }
  if (url.pathname === '/api/dghot/edit') {
    if (req.method !== 'POST') { drain(req); return json(res, 405, { error: 'Method not allowed' }); }
    if (user.role !== 'admin') { drain(req); return json(res, 403, { error: 'Only Admin can fix the diagram numbers' }); }
    let b; try { b = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8')); } catch (e) { return json(res, 400, { error: 'Bad request body' }); }
    const u = String(b && b.u || ''), f = v => typeof v === 'number' && v >= 0 && v <= 1;
    if (u.length > 600 || !HOT_U.test(u)) return json(res, 400, { error: 'Bad diagram' });
    const o = hotRead(u) || { u, toks: null, ed: [] }; o.ed = o.ed || [];
    if (Array.isArray(b.add) && /^[A-Z0-9][A-Z0-9 ./-]{0,9}$/i.test(String(b.add[0] || '')) && b.add.slice(1, 5).every(f)) o.ed.push({ a: 'add', t: String(b.add[0]).toUpperCase(), b: b.add.slice(1, 5).map(v => Math.round(v * 1e4) / 1e4), by: user.id, at: new Date().toISOString() });
    else if (Array.isArray(b.del) && b.del.slice(0, 2).every(f)) o.ed.push({ a: 'del', p: b.del.slice(0, 2).map(v => Math.round(v * 1e4) / 1e4), by: user.id, at: new Date().toISOString() });
    else return json(res, 400, { error: 'Nothing to change' });
    if (o.ed.length > 600) o.ed = o.ed.slice(-600);
    hotWrite(u, o);
    return json(res, 200, hotOut(o));
  }
  const u = String(url.searchParams.get('u') || '');
  if (u.length > 600 || !HOT_U.test(u)) { drain(req); return json(res, 400, { error: 'Bad diagram' }); }
  const o = hotRead(u) || { u, toks: null, ed: [] };
  if (req.method === 'GET') {
    if (o.toks || url.searchParams.get('ocr') !== '1') return json(res, 200, hotOut(o));
    if (u.startsWith('pdf:') || hotSvg(u)) return json(res, 200, { ...hotOut(o), need: 'img' });
    const buf = hotImg(u);
    if (!buf) return json(res, 404, { error: 'not_found' });   // this catalogue's files are not on the server yet
    return hotOcr(res, u, buf, user);
  }
  if (req.method !== 'POST') { drain(req); return json(res, 405, { error: 'Method not allowed' }); }
  if (!u.startsWith('pdf:') && !hotSvg(u)) { drain(req); return json(res, 400, { error: 'This diagram is read on the server' }); }
  if (o.toks) { drain(req); return json(res, 200, hotOut(o)); }
  if ((+req.headers['content-length'] || 0) > HOT_MAX) { drain(req); return json(res, 413, { error: 'This page is too big (12 MB max)' }); }
  let buf; try { buf = await readBody(req, HOT_MAX); } catch (e) { return json(res, 413, { error: 'This page is too big (12 MB max)' }); }
  if (!photoKind(buf)) return json(res, 400, { error: 'Send the page as a PNG or JPG picture' });
  return hotOcr(res, u, buf, user);
}
// GET /api/photo/status?h=<hash>,<hash>: is the clean copy ready (the app shows "Cleaning…" until it is)
function photoStatus(req, res, url, user) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: 'Staff login needed' });
  const st = {}, chk = {};
  for (const h of String(url.searchParams.get('h') || '').split(',').filter(x => /^[a-f0-9]{32}$/.test(x)).slice(0, 40)) { st[h] = PHOTO_AI.status(h); if (st[h] === 'done') chk[h] = PHOTO_AI.check(h); }
  return json(res, 200, { ai: PHOTO_AI.summary(), st, chk });
}
// POST /api/photo/wrong?h=<hash>: staff say the clean copy is not right; it is made again another way (and the AI learns from it)
// 11t (Sam 2026-10-23): the parts whose photos the server no longer has (the 22 Oct break-in emptied data/photos): { ids, n }
const photoHash = u => (/^\/photos\/([a-f0-9]{32})/.exec(String(u || '')) || [])[1];
function photoGone(u) { const h = photoHash(u); if (!h) return false; return !['jpg', 'png', 'webp'].some(x => fs.existsSync(path.join(PHOTO_DIR, h + '.' + x))) && !fs.existsSync(path.join(PHOTO_DIR, h + '-c.jpg')); }
setPhotoGone(photoGone);
function photosMissing(get) {
  const ids = [];
  for (const p of get('newProducts') || []) { if (!p || typeof p !== 'object') continue; const ph = Array.isArray(p.photos) ? p.photos : []; if (!ph.length || ph.every(photoGone)) ids.push(p.id); }
  return { ids, n: ids.length };
}
function photoWrong(req, res, url, user) {
  if (req.method !== 'POST') { drain(req); return json(res, 405, { error: 'Method not allowed' }); }
  drain(req);
  if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: 'Staff login needed' });
  if (limited('photowrong:' + user.id, 120, 3600e3)) return json(res, 429, { error: 'Too many in one hour. Please wait a little.' });
  const h = String(url.searchParams.get('h') || '');
  if (!/^[a-f0-9]{32}$/.test(h)) return json(res, 400, { error: 'Photo not found' });
  const r = PHOTO_AI.wrong(h);
  if (!r.ok) return json(res, 409, { error: r.error });
  console.log(new Date().toISOString(), 'photo-ai', 'photo', h, 'marked not right by', user.id, '·', r.left, 'way(s) left');
  return json(res, 200, { ok: true, left: r.left, st: PHOTO_AI.status(h) });
}
function servePhoto(req, res, m, user) {
  const [, h, v, ext] = m;
  let file, type, cache, etag;
  if (v) {   // the copies the app shows, to everyone (customers see them in the shop)
    if (ext !== 'jpg') return json(res, 404, { error: 'Not found' });
    // an hour in the phone's cache: a copy made again after "Not right" reaches every phone and the shop within the hour
    const ck = PHOTO_AI.check(h);
    file = path.join(PHOTO_DIR, `${h}-${v}.jpg`); type = MIME['.jpg']; cache = 'public, max-age=3600'; etag = `"${h}-${v}-${AI_VER}-${ck ? ck.tries : 0}"`;
    if (!PHOTO_AI.current(h)) { PHOTO_AI.enqueue(h); cache = 'no-cache'; etag = `"${h}-${v}-old"`; }   // an older copy: shown until the new one is made
    if (!fs.existsSync(file)) {   // not ready yet (or the photo AI is off): the photo as taken until then, asked again next time
      file = ''; for (const e of ['jpg', 'png', 'webp']) { const f = path.join(PHOTO_DIR, `${h}.${e}`); if (fs.existsSync(f)) { file = f; type = MIME['.' + e]; break; } }
      if (!file) return json(res, 404, { error: 'Not found' });
      PHOTO_AI.enqueue(h); cache = 'no-cache'; etag = `"${h}-o"`;
    }
  } else {   // the photo exactly as taken: shop staff only
    if (roleClass(user) !== 'staff') return json(res, user ? 403 : 401, { error: 'Staff login needed' });
    file = path.join(PHOTO_DIR, `${h}.${ext}`); type = MIME['.' + ext]; cache = 'private, max-age=31536000, immutable'; etag = `"${h}"`;
  }
  let st; try { st = fs.statSync(file); } catch (e) { return json(res, 404, { error: 'Not found' }); }
  const hd = { 'Content-Type': type, 'ETag': etag, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, hd); return res.end(); }
  res.writeHead(200, { ...hd, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
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
  const isCat = top === 'cat' && rel.endsWith('.json');
  if (isCat) { const e = CATG.check(user); if (e) return json(res, 429, { error: e }); }
  const spl = /^cat\/([a-z-]+)\.json$/.exec(rel);
  if (spl && SPLIT_B.has(spl[1])) {   // 11v: the head only (catsplit); the lines come from /api/cat/rows
    let hd = null; try { hd = SPLIT.head(spl[1]); } catch (x) { console.log(new Date().toISOString(), spl[1] + ' head failed', x.message); }
    if (hd) {
      const h = { 'Content-Type': 'application/json; charset=utf-8', 'ETag': hd.etag, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Accept-Encoding' };
      if (req.headers['if-none-match'] === hd.etag) { res.writeHead(304, h); return res.end(); }
      if (!hd.gz) hd.gz = zlib.gzipSync(hd.buf, { level: 6 });
      const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || ''), out = gz ? hd.gz : hd.buf;
      if (req.method !== 'HEAD') CATG.count(user, 'cat', hd.buf.length, rel, ipOf(req));
      res.writeHead(200, { ...h, 'Content-Length': out.length, ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
      return res.end(req.method === 'HEAD' ? undefined : out);
    }
  }
  let file = path.join(PUBLIC_DIR, rel);
  if (HERO_SERVED.has(rel) && fs.existsSync(path.join(HERO_OUT, path.basename(rel)))) file = path.join(HERO_OUT, path.basename(rel));
  let st; try { st = fs.statSync(file); } catch (e) { return json(res, 404, { error: 'Not found' }); }
  if (st.isDirectory()) return json(res, 404, { error: 'Not found' });
  const ext = path.extname(file).toLowerCase(); const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  // catalogue data (cat/) is asked again each time (304 when unchanged), so a pushed catalogue shows at once, not after an hour
  const h = { 'Content-Type': type, 'ETag': etag, 'Cache-Control': top === 'cat' ? 'private, no-cache' : ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Vary': 'Accept-Encoding', ...(ext === '.html' ? { 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' } : {}) };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && st.size) {
    let a = range[1] === '' ? Math.max(0, st.size - +range[2]) : +range[1], b = range[2] === '' || range[1] === '' ? st.size - 1 : Math.min(+range[2], st.size - 1);
    if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    if (isCat && req.method !== 'HEAD') CATG.count(user, 'cat', b - a + 1, rel, ipOf(req));
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  if (GZ_TYPES.has(ext) && st.size < 40 * 1024 * 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const buf = gzipped(file, st);
    if (isCat && req.method !== 'HEAD') CATG.count(user, 'cat', st.size, rel, ipOf(req));
    res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', 'Content-Length': buf.length });
    return res.end(req.method === 'HEAD' ? undefined : buf);
  }
  res.writeHead(200, { ...h, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  if (isCat) CATG.count(user, 'cat', st.size, rel, ipOf(req));
  fs.createReadStream(file).pipe(res);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    MON.probe(ipOf(req), url.pathname + url.search, req.method);   // 11w: requests only hacking tools send
    const user = userOf(req);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url, user);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
    const ph = PHOTO_URL.exec(url.pathname); if (ph) return servePhoto(req, res, ph, user);
    return serveStatic(req, res, url, user);
  } catch (e) {
    console.error(new Date().toISOString(), req.method, req.url, e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' }); else res.end();
  }
});
server.listen(PORT, HOST, () => {
  ALT.start();
  console.log(`[bikepharma] v${VERSION} on http://${HOST}:${PORT}  public=${PUBLIC_DIR}  data=${DATA_DIR}  files=${FILES_DIR}  store=${HAS_SQLITE ? 'sqlite' : 'json'}  otp=${OTP.mode}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { PHOTO_AI.stop(); server.close(); store.close(); process.exit(0); });
