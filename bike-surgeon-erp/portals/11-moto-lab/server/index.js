'use strict';
const path = require('node:path');
const express = require('express');
process.env.TZ ||= 'Asia/Kolkata';

const db = require('./db');
const { seed } = require('./seed');
const { router } = require('./routes');
const notify = require('./notify');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self'");
    next();
  });
  // Item imports from the old billing site can be large
  app.use(express.json({ limit: '5mb' }));
  // Writes must come from our own page (blocks cross-site form posts)
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') return next();
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-site request blocked.' });
    next();
  });
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.use('/api', router);
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: 'index.html' }));
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500);
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
  const file = path.join(dir, `motolab-${C.ymd(d)}.db`);
  if (fs.existsSync(file)) return null;
  db.get().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(dir).filter(f => /^motolab-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -30);
  for (const f of old) fs.unlinkSync(path.join(dir, f));
  return file;
}
const backupTick = () => { try { const f = backup(); if (f) console.log(`Backup saved: ${f}`); } catch (e) { console.error('backup job', e); } };

function start(port = Number(process.env.PORT || 3000)) {
  db.open();
  if (seed()) console.log(`First run: ${process.env.EMPTY_START === '1' ? 'empty start' : 'sample data loaded'}. Sample logins: server/seed.js, PIN ${process.env.SEED_PIN || '1234'}.`);
  // WhatsApp messages and rows for the accountant and admin panels that could not go out are tried again every minute
  setInterval(() => { notify.flush().catch(() => {}); require('./links').flush().catch(() => {}); }, 60000).unref();
  backupTick(); setInterval(backupTick, 5 * 60 * 1000).unref();
  // real items and bills of the Moto Lab billing, through the admin panel, every minute (oldlink.js)
  require('./oldlink').start();
  return createApp().listen(port, () => console.log(`The Moto Lab portal on http://localhost:${port}`));
}

module.exports = { createApp, start, backup };
if (require.main === module) start();
