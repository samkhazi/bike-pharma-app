'use strict';
const path = require('node:path');
const express = require('express');
process.env.TZ ||= 'Asia/Kolkata';

const db = require('./db');
const { seed } = require('./seed');
const { router } = require('./routes');
const auth = require('./auth');
// LIVE (28 Nov 2026, Sam: the service advisors' job card portal on the real data): the billing's job cards, read only
const live = require('./billing');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'");
    next();
  });
  app.use(express.json({ limit: '50kb' }));
  // Writes must come from our own page (blocks cross-site form posts)
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') return next();
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-site request blocked.' });
    next();
  });
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  if (live.on()) {
    // the pages read the billing (server/billing.js); the design's sample floor (its own tables) is never shown or sent
    const wrapA = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).then(v => { if (!res.headersSent) res.json(v); }, next);
    app.get('/api/live', auth.requireUser, wrapA(req => live.live(req.user, (req.query || {}).rev)));
    app.get('/api/live/list', auth.requireUser, wrapA(req => {
      const q = req.query || {}, tab = ['p', 'o', 'c', 'n', 'x', 'all'].includes(q.tab) ? q.tab : 'all';
      const age = ['today', 'week', 'old'].includes(q.age) ? q.age : '';
      return live.list({ tab, q: String(q.q || ''), mine: q.mine === '1', age, before: Number(q.before) || 0, n: Number(q.n) || 100 }, req.user);
    }));
    app.get('/api/live/jc/:id', auth.requireUser, wrapA(req => live.card(req.params.id)));
    app.get('/api/state', auth.requireUser, (req, res) => res.json({ live: true, me: req.user }));
    // read only until switch day: job cards, bookings and mechanics are changed in the service app (the billing). Sign in,
    // sign out, a PIN change and the other panels' feeds still work.
    app.use('/api', (req, res, next) => {
      if (req.method === 'GET' || req.method === 'HEAD' || /^\/auth\/(login|logout)$/.test(req.path) || /^\/users\/\d+\/pin$/.test(req.path) || /^\/import\//.test(req.path)) return next();
      res.status(403).json({ error: 'Read only: job cards are changed in the service app until switch day.' });
    });
    const page = (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, '..', 'public', 'live.html')); };
    app.get('/', page);
    app.get('/index.html', page);
  }
  app.use('/api', router);
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: 'index.html' }));
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
  });
  return app;
}

// Copies the database to BACKUP_DIR once a day after 11 pm and keeps the last 30 copies (round 6, like the other portals).
function backup() {
  const dir = process.env.BACKUP_DIR;
  if (!dir) return null;
  const fs = require('node:fs'), C = require('./clock'), d = C.now();
  if (d.getHours() < 23) return null;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `portal-${C.ymd(d)}.db`);
  if (fs.existsSync(file)) return null;
  db.get().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(dir).filter(f => /^portal-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -30);
  for (const f of old) fs.unlinkSync(path.join(dir, f));
  return file;
}
const backupTick = () => { try { const f = backup(); if (f) console.log(`Backup saved: ${f}`); } catch (e) { console.error('backup job', e); } };

function start(port = Number(process.env.PORT || 3000)) {
  db.open();
  if (seed()) console.log(`First run: sample workshop loaded. Sign in with 98765 43212 and PIN ${process.env.SEED_PIN || '1234'}.`);
  backupTick(); setInterval(backupTick, 5 * 60 * 1000).unref();
  // mechanic / bay to the Spares Maintainer portal and QC to the cashier, every minute until they go (round 7); LIVE: off
  // (they would send the sample floor), the billing's job cards are read every few seconds instead
  if (live.on()) live.start().forEach(t => t.unref());
  else require('./links').start().forEach(t => t.unref());
  return createApp().listen(port, () => console.log(`Service Manager Portal on http://localhost:${port}${live.on() ? ' (LIVE: the billing\'s job cards)' : ''}`));
}

module.exports = { createApp, start, backup };
if (require.main === module) start();
