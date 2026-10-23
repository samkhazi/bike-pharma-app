// Update 11w (Sam 2026-10-23, after the 22 Oct break-in): security alerts by email at once, and a product report every night at 9 pm.
// Email goes to ALERT_TO (comma separated) through lib/mailer.mjs. Without SMTP in .env everything is still noted in data/alerts.log.
// At once: many wrong logins / OTPs from one IP or on one login, hacking requests (shell.php, .env, wp-admin ...), a staff or Admin
// login from a new IP, a login stopped by the catalogue guard, many products / bills / customers deleted in one save, the site's code
// files, .env or its nginx file changed while the site runs (update.sh restarts the site, so a real update is not an alert), the
// database file gone, many product photos gone. The site being down is watched from the other server (tools/uptime-watch.sh).
// Each alert is sent once per kind and source in ALERT_QUIET_MIN (30) minutes, and at most ALERT_MAX_HOUR (20) an hour; the rest go
// in one summary email.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { mailer } from './mailer.mjs';

const dayOf = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);   // IST date
const istTime = (t = Date.now()) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export const PROBE = /\.(php\d?|asp|aspx|jsp|cgi|pl|sh|sql|bak|old|swp)(\?|$)|(^|\/)\.(env|git|svn|htaccess|htpasswd|aws|ssh|DS_Store)(\/|$)|wp-(login|admin|content|includes)|xmlrpc|phpmyadmin|pma\/|adminer|\/etc\/passwd|\/proc\/self|\.\.\/|%2e%2e|cgi-bin|\/vendor\/phpunit|\/boaform|\/HNAP1|\/actuator|\/solr\/|\/console\/|eval\(|base64_decode|<script|union(\s|%20|\+)select|\/shell|webshell|\/config\.json$/i;
// the shop's lists: a save that removes this many of them at once is an alert
const WATCH = { newProducts: 'products', bills: 'bills', customers: 'customers', omech: 'mechanics', warranties: 'warranties', moves: 'stock entries', purchases: 'purchases', orders: 'orders' };

export function monitor({ store, rootDir, dataDir, env = process.env, getState, photoGone, photoDir, log = console.log }) {
  const M = mailer(env);
  const to = String(env.ALERT_TO || '').split(/[,\s;]+/).filter(s => /@/.test(s));
  const quiet = (+env.ALERT_QUIET_MIN || 30) * 60e3, maxHour = +env.ALERT_MAX_HOUR || 20, reportAt = Math.min(23, Math.max(0, parseInt(env.REPORT_AT ?? '21', 10) || 0));
  const delMin = +env.ALERT_DELETE_MIN || 5, site = String(env.SITE_NAME || 'bikepharma.com');
  const LOG = path.join(dataDir, 'alerts.log');
  const last = new Map(), sentAt = [], held = [];
  const on = M.ok && to.length > 0;
  const note = o => { try { fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n'); } catch {} };
  const send = (subject, text) => on ? M.send(to, subject, text).then(() => note({ sent: subject }), e => { note({ sendFailed: subject, error: String(e.message || e) }); log(new Date().toISOString(), '[alert] email failed:', e.message); }) : Promise.resolve();

  // kind: short code; key: what it is about (an IP, a login); lines: the details
  function alert(kind, key, title, lines = []) {
    const k = kind + '|' + key, now = Date.now();
    if (now - (last.get(k) || 0) < quiet) return false;
    last.set(k, now);
    const text = [title, '', ...lines, '', 'Time: ' + istTime(now) + ' (India)', 'Site: ' + site, '', 'This email is sent by the Bike Pharma server by itself. Every alert is also in data/alerts.log.'].join('\n');
    note({ kind, key, title, lines });
    log(new Date().toISOString(), '[alert]', kind, key, title);
    while (sentAt.length && now - sentAt[0] > 3600e3) sentAt.shift();
    if (sentAt.length >= maxHour) { held.push(title + (lines[0] ? ' — ' + lines[0] : '')); return true; }
    sentAt.push(now); send('[Bike Pharma alert] ' + title, text);
    return true;
  }
  function flushHeld() {
    const now = Date.now(); while (sentAt.length && now - sentAt[0] > 3600e3) sentAt.shift();
    if (!held.length || sentAt.length >= maxHour) return;
    const l = held.splice(0); sentAt.push(now);
    send('[Bike Pharma alert] ' + l.length + ' more alerts', ['More alerts came than one email each (at most ' + maxHour + ' an hour). These are they:', '', ...l.map(x => '- ' + x), '', 'Time: ' + istTime(now)].join('\n'));
  }

  // counts in a moving window
  const hits = new Map();
  const count = (k, win) => { const now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < win); a.push(now); hits.set(k, a); return a.length; };
  setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 3600e3) hits.delete(k); }, 600e3).unref();

  // wrong password or OTP: 10 from one IP, or 8 on one login, in 15 minutes
  function loginFail(ip, id, why) {
    const n = count('lf:' + ip, 900e3), m = count('lfi:' + id, 900e3);
    if (n >= 10) alert('login-ip', ip, 'Many wrong logins from one IP: ' + ip, [n + ' wrong logins in 15 minutes from IP ' + ip + '.', 'Last login tried: ' + id + ' (' + why + ')', 'If this is not your staff, someone is guessing passwords. The site already slows them down.']);
    if (m >= 8) alert('login-id', id, 'Many wrong logins on ' + id, [m + ' wrong tries in 15 minutes on the login ' + id + '.', 'Last from IP ' + ip + ' (' + why + ')']);
  }
  // a staff or Admin login from an IP this login never used
  function loginOk(user, ip, staff) {
    if (!staff || !user || !ip) return;
    const seen = store.kvGet('seenip', user.id) || [];
    if (seen.includes(ip)) return;
    store.kvSet('seenip', user.id, [ip, ...seen].slice(0, 30));
    if (seen.length) alert('newip', user.id + '|' + ip, 'Login from a new IP: ' + (user.name || user.id), ['Login: ' + user.id + ' (' + (user.role || '') + ')', 'New IP: ' + ip, 'Before: ' + seen.slice(0, 5).join(', '), 'If this was not this person, change this login\'s password in Admin and log it out from all devices.']);
  }
  // hacking requests: the paths a hacker's tool tries
  function probe(ip, p, method) {
    if (!PROBE.test(p)) return false;
    const n = count('pr:' + ip, 3600e3);
    const ps = (hits.get('prp:' + ip) || []); ps.push(method + ' ' + p.slice(0, 120)); hits.set('prp:' + ip, ps.slice(-10));
    if (n === 1 || n === 20) alert('probe', ip + (n >= 20 ? '|20' : ''), 'Hacking attempt from IP ' + ip, [n >= 20 ? n + ' hacking requests in an hour from this IP.' : 'A request that only a hacking tool sends:', ...ps.slice(-10).map(x => '  ' + x), 'The site refused it (nothing like that exists here). If it goes on, block this IP in the server firewall.']);
    return true;
  }
  function catStop(user, kind, ip) {
    alert('catstop', user.id, 'Catalogue copying stopped: ' + (user.name || user.id), ['Login ' + user.id + ' (' + (user.role || '') + ') pulled more catalogue than a day\'s work (' + kind + ') and is stopped for the catalogues today.', 'IP: ' + (ip || '-'), 'Admin can unlock it in Admin > Security alerts if it was real work.']);
  }

  // a staff save: products added and photos uploaded (for the 9 pm report), and many deleted at once (an alert)
  const ids = a => new Map((Array.isArray(a) ? a : []).filter(isObj).map(x => [String(x.id ?? x.no ?? x.code ?? JSON.stringify(x).slice(0, 80)), x]));
  function write(k, sv, merged, user, ip) {
    if (!Array.isArray(merged)) return;
    const S = ids(sv), N = ids(merged);
    if (WATCH[k]) {
      let gone = 0; const ex = []; for (const [i, x] of S) if (!N.has(i)) { gone++; if (ex.length < 8) ex.push('  ' + (x.name || x.pn || x.cust || x.no || i) + (x.pn && x.name ? ' (' + x.pn + ')' : '')); }
      if (gone >= delMin) alert('delete', k + '|' + user.id, gone + ' ' + WATCH[k] + ' deleted at once by ' + (user.name || user.id), [user.id + ' (' + (user.role || '') + ') saved a change that removes ' + gone + ' ' + WATCH[k] + ' (' + S.size + ' before, ' + N.size + ' after).', 'IP: ' + (ip || '-'), 'Some of them:', ...ex, 'If this was not meant, the nightly backup (Admin > More > Backups) has them.']);
    }
    if (k !== 'newProducts') return;
    const day = dayOf(), R = store.kvGet('prodday', day) || { added: [], photos: [] };
    let ch = false;
    for (const [i, p] of N) {
      const o = S.get(i), urls = (Array.isArray(p.photos) ? p.photos : []).filter(u => /^\/photos\//.test(String(u))), old = new Set(o && Array.isArray(o.photos) ? o.photos : []);
      if (!o) { R.added.push({ id: i, name: String(p.name || '').slice(0, 80), pn: String(p.pn || '').slice(0, 40), by: String(p.byN || user.name || user.id).slice(0, 60), at: Date.now(), ph: urls.length }); ch = true; }
      const nw = urls.filter(u => !old.has(u)).length;
      if (nw) { R.photos.push({ id: i, pn: String(p.pn || '').slice(0, 40), by: String(user.name || user.id).slice(0, 60), n: nw, at: Date.now() }); ch = true; }
    }
    if (ch) { R.added = R.added.slice(-3000); R.photos = R.photos.slice(-3000); store.kvSet('prodday', day, R); }
  }

  // the site's own files, .env and its nginx file: a change while the site runs (update.sh restarts it, so its changes are the new start)
  const FILES = () => {
    const l = ['server.mjs', 'admin.mjs', 'package.json', '.env', 'update.sh', 'restart.sh', 'check.sh', 'install.sh', 'ecosystem.config.cjs', 'public/index.html', 'public/app.html'].map(f => path.join(rootDir, f));
    try { for (const f of fs.readdirSync(path.join(rootDir, 'lib'))) if (f.endsWith('.mjs')) l.push(path.join(rootDir, 'lib', f)); } catch {}
    for (const f of String(env.ALERT_WATCH_FILES || '/etc/nginx/sites-enabled/bikepharma.com.conf').split(',').map(s => s.trim()).filter(Boolean)) l.push(f);
    return l;
  };
  const hash = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch (e) { return e.code === 'ENOENT' ? 'gone' : 'unreadable'; } };
  const base = new Map(); for (const f of FILES()) base.set(f, hash(f));
  const dbFile = store.file || null;
  const photoN = () => { try { return fs.readdirSync(photoDir).filter(f => /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(f)).length; } catch { return -1; } };
  let photos0 = photoN();
  function check() {
    const changed = [];
    for (const f of FILES()) { const h = hash(f), b = base.get(f); if (b === undefined) { base.set(f, h); continue; } if (h !== b && h !== 'unreadable') { changed.push((h === 'gone' ? 'DELETED ' : b === 'gone' ? 'NEW ' : 'CHANGED ') + f); base.set(f, h); } }
    if (changed.length) alert('files', changed.join(','), 'Website files changed on the server', ['These files changed while the site is running (not by update.sh):', ...changed.map(x => '  ' + x), 'If you or Nikhil did not just edit them, someone may be inside the server. Check it now.', 'If you only added a line to .env, restart the site (update.sh) and this is fine.']);
    if (dbFile && !fs.existsSync(dbFile)) alert('db', dbFile, 'The shop database file is gone', ['File missing: ' + dbFile, 'The site still holds the data in memory: do NOT restart it. Make a backup from Admin > More > Backups now and call for help.']);
    const n = photoN(); if (photos0 >= 0 && n >= 0 && photos0 - n >= 10) alert('photos', String(n), (photos0 - n) + ' product photos deleted on the server', ['Photo files: ' + photos0 + ' before, ' + n + ' now, in ' + photoDir + '.', 'The site never deletes product photos by itself.']);
    if (n >= 0) photos0 = n;
    flushHeld();
  }

  // the 9 pm report
  function reportText(day = dayOf()) {
    const R = store.kvGet('prodday', day) || { added: [], photos: [] }, prods = (getState('newProducts') || []).filter(isObj);
    const live = new Map(prods.map(p => [String(p.id), p])), phN = x => { const p = live.get(String(x.id)); return (p && Array.isArray(p.photos) ? p.photos : []).filter(u => u && !photoGone(u)).length; };
    const added = R.added.filter(x => live.has(String(x.id)));
    const by = new Map(); for (const x of added) by.set(x.by, (by.get(x.by) || 0) + 1);
    const pby = new Map(); let pn = 0; for (const x of R.photos) { pn += x.n; pby.set(x.by, (pby.get(x.by) || 0) + x.n); }
    const noPhoto = prods.filter(p => { const ph = (Array.isArray(p.photos) ? p.photos : []).filter(Boolean); return !ph.length || ph.every(u => photoGone(u)); });
    const [y, m, d] = day.split('-');
    return {
      subject: 'Bike Pharma daily report ' + d + '-' + m + '-' + y + ': ' + added.length + ' products added, ' + noPhoto.length + ' without photo',
      text: ['Bike Pharma products report for ' + d + '-' + m + '-' + y, '',
        'Products added today: ' + added.length, ...[...by].sort((a, b) => b[1] - a[1]).map(([n, c]) => '  ' + n + ': ' + c), '',
        'Photos uploaded today: ' + pn + (R.photos.length ? ' (on ' + new Set(R.photos.map(x => x.id)).size + ' products)' : ''), ...[...pby].sort((a, b) => b[1] - a[1]).map(([n, c]) => '  ' + n + ': ' + c), '',
        'Products without a photo now: ' + noPhoto.length + ' of ' + prods.length + ' (Inventory > Photos missing lists them)', '',
        added.length ? 'Products added today:' : 'No products were added today.',
        ...added.slice(0, 500).map((x, i) => (i + 1) + '. ' + x.name + (x.pn ? ' · ' + x.pn : '') + ' · by ' + x.by + ' · ' + new Date(x.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) + ' · ' + (n => n ? n + ' photo' + (n > 1 ? 's' : '') : 'no photo')(phN(x))),
        added.length > 500 ? '... and ' + (added.length - 500) + ' more' : '', '',
        noPhoto.length ? 'Without a photo (first 50):' : '', ...noPhoto.slice(0, 50).map(p => '  ' + (p.name || '') + ' · ' + (p.pn || '')), '',
        'Sent by the Bike Pharma server every night at ' + (reportAt > 12 ? reportAt - 12 + ' pm' : reportAt + ' am') + ' (India time).'].join('\n'),
    };
  }
  function tick() {
    try { check(); } catch (e) { log('monitor check failed', e.message); }
    const h = new Date(Date.now() + 5.5 * 3600e3).getUTCHours(), day = dayOf();
    if (h >= reportAt && !store.kvGet('reportsent', day)) {
      store.kvSet('reportsent', day, { at: new Date().toISOString() });
      const r = reportText(day); note({ report: day, subject: r.subject }); send(r.subject, r.text);
    }
    // old days go after 40 days
    if (Math.random() < 0.02) { const old = dayOf(Date.now() - 40 * 86400e3); for (const ns of ['prodday', 'reportsent']) for (const [k] of store.kvAll(ns)) if (k < old) store.kvDel(ns, k); }
  }
  const TICK = +env.MONITOR_TICK_MS || 120e3; setTimeout(tick, Math.min(30e3, TICK)).unref(); setInterval(tick, TICK).unref();
  return { on, to, alert, loginFail, loginOk, probe, catStop, write, check, reportText, tick, test: () => on ? M.send(to, 'Bike Pharma: test email', 'Email alerts work. The Bike Pharma server will email this address when something looks wrong, and a product report every night at 9 pm.\n\nTime: ' + istTime()) : Promise.reject(new Error(M.ok ? 'ALERT_TO not set in .env' : 'SMTP not set in .env')) };
}
