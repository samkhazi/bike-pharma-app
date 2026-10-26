// update 11w: email alerts + the 9 pm products report (lib/monitor.mjs, lib/mailer.mjs), with a fake SMTP server
// usage: node tools/test_alerts.mjs   (own server on 3023, fake SMTP on 3024, fresh database)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import net from 'node:net';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-alerts'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });
fs.writeFileSync(T + '/nginx.conf', 'proxy_pass http://127.0.0.1:3010;');
// the fake SMTP server: keeps every mail (decoded) and the login it got
const mails = []; let auth = [];
// a mail's parts (12z: text + html + the PDF report): text = the plain text part, html, pdf (Buffer)
function parse(h, b) {
  const o = { text: '', html: '', pdf: null }, walk = (h, b) => { const bd = /boundary="([^"]+)"/.exec(h);
    if (bd) { for (const p of b.split('--' + bd[1]).slice(1, -1)) { const i = p.indexOf('\n\n'); walk(p.slice(0, i), p.slice(i + 2)); } return; }
    const v = Buffer.from(b.replace(/\s/g, ''), 'base64');
    if (/application\/pdf/.test(h)) o.pdf = v; else if (/text\/html/.test(h)) o.html = v.toString(); else if (!o.text) o.text = v.toString(); };
  walk(h, b); return o;
}
const smtp = net.createServer(s => {
  let buf = '', data = false, msg = [], rcpt = [], st = 0;
  s.write('220 fake ESMTP\r\n');
  s.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\r\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2);
    if (data) { if (l === '.') { data = false; const raw = msg.join('\n'), [h, b] = raw.split('\n\n'); const sub = (/^Subject: (.*)$/m.exec(h) || [])[1] || '';
      mails.push({ to: rcpt.slice(), subject: /^=\?UTF-8\?B\?/.test(sub) ? Buffer.from(sub.slice(10, -2), 'base64').toString() : sub, ...parse(h, raw.slice(h.length + 2)) }); msg = []; rcpt = []; s.write('250 queued\r\n'); } else msg.push(l.replace(/^\.\./, '.')); continue; }
    if (st) { auth.push(Buffer.from(l, 'base64').toString()); s.write(st++ === 1 ? '334 UGFzc3dvcmQ6\r\n' : '235 ok\r\n'); if (st > 2) st = 0; continue; }
    if (/^EHLO/.test(l)) s.write('250-fake\r\n250 AUTH LOGIN\r\n'); else if (l === 'AUTH LOGIN') { st = 1; s.write('334 VXNlcm5hbWU6\r\n'); }
    else if (/^MAIL FROM/.test(l)) s.write('250 ok\r\n'); else if (/^RCPT TO:<(.*)>/.test(l)) { rcpt.push(/<(.*)>/.exec(l)[1]); s.write('250 ok\r\n'); } else if (l === 'DATA') { data = true; s.write('354 go\r\n'); } else if (l === 'QUIT') { s.write('221 bye\r\n'); s.end(); } else s.write('250 ok\r\n'); } });
  s.on('error', () => {});
}).listen(3024);
await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const env = { ...process.env, PORT: '3023', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', SMTP_HOST: '127.0.0.1', SMTP_PORT: '3024', SMTP_TLS: 'off', SMTP_USER: 'alerts@test.in', SMTP_PASS: 'abcd efgh ijkl mnop',
  ALERT_TO: 'one@test.in, two@test.in', MONITOR_TICK_MS: '700', REPORT_AT: '0', ALERT_WATCH_FILES: T + '/nginx.conf' };
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3023', wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 8000) => { for (let t = 0; t < ms; t += 200) { if (f()) return true; await wait(200); } return false; };
const mail = re => mails.find(m => re.test(m.subject));
const login = (ip, password) => fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ id: 'sam@bikepharma.com', password }) });
try {
  await until(() => /on http/.test(log));
  ok(await until(() => mail(/daily report/)), 'the products report goes at the report hour: ' + (mail(/daily report/) || {}).subject);
  const m0 = mail(/daily report/);
  ok(m0.to.join() === 'one@test.in,two@test.in' && auth[0] === 'alerts@test.in' && auth[1] === 'abcdefghijklmnop', 'to both addresses, logged in with the Gmail App Password (spaces taken out)');
  ok(/Products added (today|that day)/.test(m0.text) && /BIKE PHARMA/.test(m0.html) && m0.pdf && m0.pdf.slice(0, 5).toString() === '%PDF-' && /%%EOF\s*$/.test(m0.pdf.toString('latin1')), 'the report: plain text, a designed html email and a PDF attached');
  await wait(1500); ok(!mails.some(m => /server started/i.test(m.subject)), '12z: no email when the server starts');
  // first good login from one IP, then wrong passwords from another
  let r = await login('10.0.0.1', 'Test@1234'); const cookie = (r.headers.get('set-cookie') || '').split(';')[0]; await r.json();
  for (let i = 0; i < 10; i++) await (await login('6.6.6.6', 'nope' + i)).json();
  ok(await until(() => mail(/Many wrong logins from one IP: 6\.6\.6\.6/)), 'ten wrong passwords from one IP: an alert with the IP');
  ok(mails.filter(m => /6\.6\.6\.6/.test(m.subject)).length === 1, 'sent once, not once per try');
  await (await login('7.7.7.7', 'Test@1234')).json();
  ok(await until(() => mail(/Login from a new IP/) && /7\.7\.7\.7/.test(mail(/Login from a new IP/).text)), 'Admin login from a new IP: an alert');
  // a hacking tool's requests
  for (const u of ['/wp-login.php', '/.env', '/shell.php?cmd=id']) await (await fetch(BASE + u, { headers: { 'X-Forwarded-For': '5.5.5.5' } })).arrayBuffer();
  await (await fetch(BASE + '/app.html', { headers: { 'X-Forwarded-For': '4.4.4.4' } })).arrayBuffer();
  ok(await until(() => mail(/Hacking attempt from IP 5\.5\.5\.5/)) && /wp-login\.php/.test(mail(/Hacking attempt/).text), 'wp-login.php / .env / shell.php: a hacking alert with the IP and path');
  ok(!mails.some(m => /4\.4\.4\.4/.test(m.subject)), 'a normal page is no alert');
  // products: 6 added (the report counts them), then all removed in one save (an alert)
  const sync = (changes, base) => fetch(BASE + '/api/sync', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' }, body: JSON.stringify({ base, changes }) }).then(r => r.json());
  const ps = [1, 2, 3, 4, 5, 6].map(i => ({ id: 'pt' + i, name: 'Test part ' + i, pn: 'TP-00' + i, brand: 'Test', mrp: 100, photos: [] }));
  let s1 = await sync({ newProducts: ps }, 0);
  const rep = await (await fetch(BASE + '/api/alerts', { headers: { cookie } })).json();
  ok(rep.on === true && rep.to.length === 2 && rep.to.every(x => x.includes('…@test.in')) && rep.last.some(x => /hacking/i.test(x.title)), 'Admin sees alerts on, the addresses (half hidden) and the last alerts');
  await sync({ newProducts: [] }, s1.rev);
  ok(await until(() => mail(/6 products deleted at once/)) && /Test part/.test(mail(/6 products deleted/).text), 'six products deleted in one save: an alert naming them');
  // a file of the site changed while it runs
  fs.writeFileSync(T + '/nginx.conf', 'root /var/www/fake;');
  ok(await until(() => mail(/Website files changed/)) && /nginx\.conf/.test(mail(/Website files changed/).text), 'its nginx file changed: an alert');
  const t = await (await fetch(BASE + '/api/alerts/test', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: '{}' })).json();
  ok(t.ok && await until(() => mail(/test email/)), 'Admin: Send a test email');
  // a day before the counting started: the report comes from the products' own "Added by" date (server stamp "22 Oct, 3:45 pm")
  const rr = await (await fetch(BASE + '/api/alerts/report', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ day: '2026-10-22' }) })).json();
  ok(rr.ok && await until(() => mail(/daily report 22-10-2026/)) && /not counted/.test(mail(/daily report 22-10-2026/).text), 'Admin: a past day\'s report on demand');
  const { monitor } = await import('../lib/monitor.mjs'), kv = new Map();
  const fs2 = { kvGet: (n, k) => kv.get(n + k), kvSet: (n, k, v) => kv.set(n + k, v), kvAll: () => [], kvDel: () => {} };
  const M2 = monitor({ store: fs2, rootDir: T, dataDir: T + '/m2', env: { MONITOR_TICK_MS: '99999999' }, getState: () => [{ id: 'a', name: 'Old clutch plate', pn: 'CP-1', byN: 'Ravi', byT: '22 Oct, 3:45 pm', photos: [] }, { id: 'b', name: 'Other', pn: 'X', byN: 'Ravi', byT: '21 Oct, 1:00 pm', photos: ['/photos/x.jpg'] }], photoGone: () => false, photoDir: T, log: () => {} });
  const r2 = M2.reportText('2026-10-22');
  ok(/1 products added, 1 without photo/.test(r2.subject) && /Ravi: 1/.test(r2.text) && /Old clutch plate · CP-1 · by Ravi · 3:45 pm · no photo/.test(r2.text), 'a past day: products counted from their Added by date');
  ok((await fetch(BASE + '/api/alerts')).status === 401, 'no login: no alert list');
  ok(!/abcdefghijklmnop|abcd efgh/.test(log + fs.readFileSync(T + '/data/alerts.log', 'utf8')), 'the password is in no log');
} catch (e) { ok(false, 'error ' + e.stack); }
srv.kill(); smtp.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
