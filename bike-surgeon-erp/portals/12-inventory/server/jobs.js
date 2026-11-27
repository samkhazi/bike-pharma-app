// Background jobs: links every minute; order sheet carry-over, daily alerts, nightly backup and old sessions every 5 minutes.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const inv = require('./inv');
const links = require('./links');
const C = require('./clock');

// Copies the database to BACKUP_DIR once a day after 11 pm and keeps the last 30 copies.
function backup({ force = false } = {}) {
  const dir = process.env.BACKUP_DIR;
  if (!dir) return null;
  const d = C.now();
  if (d.getHours() < 23 && !force) return null;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `inventory-${C.ymd(d)}.db`);
  if (fs.existsSync(file)) return null;
  db.get().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(dir).filter(f => /^inventory-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -30);
  for (const f of old) fs.unlinkSync(path.join(dir, f));
  return file;
}

function slow() {
  try { const f = backup(); if (f) console.log(`Backup saved: ${f}`); } catch (e) { console.error('backup job', e); }
  try { db.run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString()); } catch (e) { console.error('session cleanup', e); }
  try { inv.carryOrders(); } catch (e) { console.error('order sheet carry', e); }
  try { inv.dailyAlerts(); } catch (e) { console.error('daily alerts', e); }
  try { require('./flow').lateCheck(); } catch (e) { console.error('late check', e); }
  // sent outbox rows older than 60 days
  try { db.run('DELETE FROM outbox WHERE sent_at IS NOT NULL AND sent_at < ?', C.stamp(C.addDays(C.now(), -60))); } catch (e) { console.error('outbox cleanup', e); }
}
let running = false;
async function fast() {
  if (running) return;
  running = true;
  try { await links.tick(); } catch (e) { console.error('links', e); } finally { running = false; }
}

function startJobs() {
  slow(); fast();
  return [setInterval(slow, 5 * 60 * 1000), setInterval(fast, Number(process.env.LINK_SECONDS || 60) * 1000)];
}

module.exports = { backup, startJobs, slow, fast };
