// 24t: the weekly Excellon read on this server (lib/excellon.mjs): every part's MRP and name from Bajaj's dealer system into
// <Bajaj folder>/excellon_parts.json { at, rows: [[code, name, MRP, effective from]] }; the Bajaj catalogue builds again by itself (server.mjs).
// A part listed twice keeps its newest price. Fewer than 50,000 parts = something is wrong: the old file stays and ALERT_TO gets a mail.
// Run as the site user: node lib/excellonsync.mjs   (server.mjs starts it once a week at night when .env has EXCELLON_USER and EXCELLON_PASSWORD)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { excellon } from './excellon.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function pickNewest(rows) {
  const best = new Map();
  for (const r of rows) { if (!r.code) continue; const k = r.code.toUpperCase(), o = best.get(k); if (!o || String(r.from) >= String(o.from)) best.set(k, r); }
  return [...best.values()];
}
export async function excellonSync({ dir, env = process.env, log = console.log, client = null } = {}) {
  const X = client || excellon({ base: env.EXCELLON_URL || undefined, user: env.EXCELLON_USER, password: env.EXCELLON_PASSWORD });
  const s = await X.logIn();
  let rows; try { rows = await X.priceList(+env.EXCELLON_COMPANY || s.company || 0); } finally { await X.logOff(); }
  const list = pickNewest(rows);
  if (list.length < 50000) throw new Error('Excellon sent only ' + list.length + ' parts (about 108,000 expected); the old list is kept');
  const f = path.join(dir, 'excellon_parts.json'), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ at: new Date().toISOString(), n: list.length, rows: list.map(r => [r.code, r.name, r.mrp, r.from]) })); fs.renameSync(tmp, f);
  log(new Date().toISOString(), 'excellon: ' + list.length + ' parts (' + rows.length + ' lines) saved');
  return { parts: list.length, lines: rows.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
  const files = path.resolve(ROOT, process.env.FILES_DIR || path.join(process.env.DATA_DIR || 'data', 'project-files'));
  excellonSync({ dir: process.argv[2] || path.join(files, 'catalogues', 'bajaj') }).then(() => process.exit(0), async e => {
    console.error('excellon sync failed:', e.message);
    try { const { mailer } = await import('./mailer.mjs'); const to = String(process.env.ALERT_TO || '').split(/[,\s;]+/).filter(s => /@/.test(s)); if (to.length) await mailer(process.env).send(to, 'Bike Pharma: weekly Excellon (Bajaj MRP) sync failed', 'Reason: ' + e.message + '\nThe Bajaj catalogue keeps last week\'s list. Check EXCELLON_USER / EXCELLON_PASSWORD in .env, or log in to Excellon once by hand.'); } catch (x) { console.error('alert mail not sent:', x.message); }
    process.exit(1); });
}
