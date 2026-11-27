// Checks every login and every panel of it (Sam, 5 Nov "check all logins, all portals"): is the panel running, and does
// it accept this login's phone + PIN? Prints one line per login and panel. Shows no PIN or password and no full mobile
// number (only the last 4 digits, so a screenshot of it is safe); changes nothing.
//   node --env-file=.env --disable-warning=ExperimentalWarning tools/check-all.js [--short]     (from the front-door folder)
// --short: one line per login (its panels only when one of them fails).
'use strict';
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { ALL: PORTALS } = require('../server/portals');   // every panel, also the ones out of the menu

const env = k => String(process.env[k] || '').trim();
if (!env('GATE_KEY')) { console.error('GATE_KEY is not in .env. Run it from the front-door folder with --env-file=.env.'); process.exit(1); }
const key = crypto.createHash('sha256').update(env('GATE_KEY')).digest();
function unseal(v) { const [iv, tag, enc] = String(v).split('.').map(x => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString('utf8'); }
const F = new DatabaseSync(env('DB_FILE') || path.join(__dirname, '..', 'data', 'front.db'), { readOnly: true });
const hasPeople = !!F.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'people'").get();
const loginCols = F.prepare('PRAGMA table_info(logins)').all().map(c => c.name);
const mask = p => (p ? 'xxxxxx' + String(p).slice(-4) : '');
function who(portal, phone) {
  const r = hasPeople && F.prepare('SELECT name FROM people WHERE portal = ? AND phone = ?').get(portal, phone);
  if (r) return r.name;
  const s = PORTALS[portal] && PORTALS[portal].people.find(x => x[1] === phone);
  return s ? s[0] : '';
}

function call(p, body) {
  return new Promise(resolve => {
    const b = JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port: p.port, path: p.login, method: 'POST', timeout: 15000,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b), 'x-forwarded-for': 'check-all' } }, res => {
      let t = ''; res.setEncoding('utf8'); res.on('data', d => { t += d; });
      res.on('end', () => { let m = ''; try { m = JSON.parse(t).error || ''; } catch { m = t.slice(0, 80); } resolve({ status: res.statusCode, msg: m, cookie: !!res.headers['set-cookie'] }); });
    });
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.on('error', e => resolve({ status: 0, msg: e.code === 'ECONNREFUSED' ? 'NOT RUNNING' : e.message }));
    r.end(b);
  });
}

const SHORT = process.argv.includes('--short');
// a panel's own rule that refuses a right phone + PIN on some days: not a fault of the login (shown as NOTE, not counted)
const RULES = [[403, /not the backup for the desk today/i, 'PIN OK; opens only on the days Ganesh sets this person as the desk backup']];
(async () => {
  let bad = 0, off = 0, notes = 0;
  const logins = F.prepare('SELECT * FROM logins ORDER BY owner DESC, name').all();
  for (const l of logins) {
    const id = l.email || (loginCols.includes('phone') ? mask(l.phone) : '');
    if (!l.active) { off++; if (!SHORT) console.log(`\n${id}  (${l.name}, SWITCHED OFF)`); continue; }   // a switched-off login cannot sign in: not checked
    const panels = F.prepare('SELECT * FROM panels WHERE login_id = ? ORDER BY pos').all(l.id);
    const lines = []; let n = 0;
    for (const row of panels) {
      const p = PORTALS[row.portal];
      if (!p) { lines.push(`  ??      ${row.portal}: unknown panel`); n++; continue; }
      let pin = ''; try { pin = unseal(row.pin); } catch { lines.push(`  FAILED  ${p.name}: PIN cannot be read (GATE_KEY changed?)`); n++; continue; }
      const r = await call(p, { phone: row.phone, pin });
      const ok = r.status === 200 && r.cookie;
      const rule = !ok && RULES.find(([st, re]) => r.status === st && re.test(r.msg));
      if (rule) notes++; else if (!ok) n++;
      const w = who(row.portal, row.phone);
      lines.push(`  ${ok ? 'OK    ' : rule ? 'NOTE  ' : 'FAILED'}  ${p.name}${p.hidden ? ' (not in the menu yet)' : ''} (port ${p.port}) as ${w ? w + ' ' : ''}${mask(row.phone)}${ok ? '' : ': ' + (rule ? rule[2] : r.msg || 'status ' + r.status)}`);
    }
    bad += n;
    if (SHORT) {
      console.log(`${n ? 'FAILED' : 'OK    '}  ${String(id).padEnd(28)} ${l.name}: ${panels.length} panel(s)${n ? '' : ' open'}`);
      lines.filter(x => !x.startsWith('  OK')).forEach(x => console.log(x));   // FAILED and NOTE lines
    } else { console.log(`\n${id}  (${l.name})`); lines.forEach(x => console.log(x)); }
  }
  console.log(`\n${bad ? bad + ' problem(s) found.' : 'All logins open all their panels.'}${notes ? ` ${notes} note(s): a panel's own rule, not a fault.` : ''}${off ? ` ${off} login(s) switched off (not checked).` : ''}`);
  process.exitCode = bad ? 2 : 0;
})();
