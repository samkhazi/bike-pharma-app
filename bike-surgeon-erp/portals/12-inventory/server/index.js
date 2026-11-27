'use strict';
const path = require('node:path');
const express = require('express');
process.env.TZ ||= 'Asia/Kolkata';

const db = require('./db');
const inv = require('./inv');
const { seed } = require('./seed');
const { router } = require('./routes');
const { startJobs } = require('./jobs');
const billing = require('./billing');
const links = require('./links');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Old billing photos may come from OLD_PHOTO_URL; browser push loads the OneSignal page script when it is switched on
  const oldImg = (() => { try { return process.env.OLD_PHOTO_URL ? ' ' + new URL(process.env.OLD_PHOTO_URL).origin : ''; } catch (e) { return ''; } })();
  const os = process.env.ONESIGNAL_APP_ID ? ' https://cdn.onesignal.com https://onesignal.com https://api.onesignal.com' : '';
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', `default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'${os ? ' https://onesignal.com' : ''}; font-src https://fonts.gstatic.com; img-src 'self' data: blob:${oldImg}${os}; script-src 'self'${os}; connect-src 'self'${os}; frame-src 'self'${os}`);
    next();
  });
  // Writes from a browser must come from our own page (blocks cross-site form posts)
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') return next();
    const origin = req.headers.origin;
    try { if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-site request blocked.' }); }
    catch (e) { return res.status(403).json({ error: 'Cross-site request blocked.' }); }
    next();
  });
  // photo uploads and sheet imports carry their own bigger limit (routes.js)
  app.use('/api', (req, res, next) => (/^\/(parts\/\d+\/photos|import\/|flow\/read$)/.test(req.path) ? next() : express.json({ limit: '2mb' })(req, res, next)));
  app.get('/healthz', (req, res) => res.json({ ok: true, billing: billing.health() }));
  app.use('/api', router);
  app.use('/photos', express.static(inv.PHOTO_DIR(), { maxAge: '30d', fallthrough: false }));
  // OneSignal's worker must be served from the site root
  app.get('/OneSignalSDKWorker.js', (req, res) => { res.type('application/javascript'); res.send(process.env.ONESIGNAL_APP_ID ? "importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');" : ''); });
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0, index: 'index.html' }));
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : status === 413 ? 'This file is too big.' : err.message, ...(status < 500 && err.extra ? err.extra : {}) });
  });
  return app;
}

function start(port = Number(process.env.PORT || 3000)) {
  db.open();
  if (seed()) console.log(`First run: logins made. Owner (Saddam) 98200 00111, PIN ${process.env.SEED_PIN || '1234'}.`);
  startJobs();
  // parts and stock straight from the billing (every 3 seconds); a change goes to the admin panel at once
  billing.start(() => links.syncAdmin().catch(() => {}));
  return createApp().listen(port, () => console.log(`Bike Surgeon Inventory on http://localhost:${port}${process.env.DEMO === '1' ? ' (demo: clock frozen)' : ''}`));
}

module.exports = { createApp, start };
if (require.main === module) start();
