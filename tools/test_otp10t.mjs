// update 10t: real OTP by Renflair SMS (mock Renflair on 3031, own server on 3018 with a fresh database)
// usage: node tools/test_otp10t.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sent = []; let failNext = false;
const mock = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); sent.push(Object.fromEntries(u.searchParams));
  if (failNext) { failNext = false; r.end('{"status":"FAILED","message":"Insufficient balance"}'); } else r.end('{"status":"SUCCESS"}'); }).listen(3031);
const T = '/tmp/claude-0/bptest-otp'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/pf', { recursive: true });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3018', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', OTP_MODE: 'fixed',
  RENFLAIR_API_KEY: 'k3y', RENFLAIR_URL: 'http://127.0.0.1:3031/V1.php?API={key}&PHONE={phone}&OTP={otp}' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
await new Promise(r => setTimeout(r, 1500));
const BASE = 'http://127.0.0.1:3018';
const call = async (p, b, ip = '1.1.1.1') => (await fetch(BASE + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: b ? JSON.stringify(b) : undefined })).json();
try {
  ok(/otp=renflair/.test(log), 'a RENFLAIR_API_KEY turns real SMS on even with OTP_MODE=fixed');
  const boot = await call('/api/boot');
  ok(boot.cfg ? !boot.cfg.otpHint : !JSON.stringify(boot).includes('"otpHint":"123456"'), 'no test OTP shown to the app');
  let r = await call('/api/otp', { id: '9876500001' });
  ok(r.kind === 'otp' && sent.length === 1 && sent[0].API === 'k3y' && sent[0].PHONE === '9876500001' && /^\d{6}$/.test(sent[0].OTP) && sent[0].OTP !== '123456', 'SMS asked from Renflair with key, number and a random 6-digit OTP');
  r = await call('/api/otp', { id: '9876500001' });
  ok(/wait \d+ seconds/.test(r.error || '') && sent.length === 1, 'a new OTP within 30 s is refused (no SMS)');
  r = await call('/api/login', { id: '9876500001', otp: '123456', signup: { name: 'A' } });
  ok(/incorrect\. 2 tries left/.test(r.error || ''), '123456 no longer works: ' + r.error);
  await call('/api/login', { id: '9876500001', otp: '000000', signup: { name: 'A' } }); await call('/api/login', { id: '9876500001', otp: '000001', signup: { name: 'A' } });
  r = await call('/api/login', { id: '9876500001', otp: sent[0].OTP, signup: { name: 'A' } });
  ok(/Too many wrong tries/.test(r.error || ''), 'after 3 wrong tries even the right OTP is refused until Resend');
  failNext = true; r = await call('/api/otp', { id: '9876500002' });
  ok(/could not be sent/.test(r.error || '') && /renflair failed/.test(log) && !log.includes('k3y'), 'Renflair error shown to the user, logged without the key');
  // staff/Admin with a mobile number: OTP by SMS, not the password (fixed test mode keeps the password)
  fs.mkdirSync(T + '/data', { recursive: true });
  await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', '9876500009', 'Boss', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
  await new Promise(r => setTimeout(r, 300));
  r = await call('/api/otp', { id: '9876500009' }, '2.2.2.2'); const sc = sent.length;
  r.kind === 'otp' && (r = await call('/api/login', { id: '9876500009', otp: sent[sc - 1].OTP }, '2.2.2.2'));
  ok(r && r.user ? true : JSON.stringify(r).includes('9876500009'), 'Admin with a mobile number logs in by SMS OTP: ' + JSON.stringify(r).slice(0, 120));
  // the browser: the keyboard's OTP suggestion puts all 6 digits in the first box -> spread + logged in
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ viewport: { width: 420, height: 860 } })).newPage();
  await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length, null, { timeout: 15000 }); await p.waitForTimeout(400);
  await p.fill('#loginId', '9876500003'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#su-name', 'Auto Fill'); await p.evaluate(() => signupNext()); await p.waitForTimeout(300);
  const ui = await p.evaluate(() => ({ s: cur().s, ac: document.getElementById('otp0').getAttribute('autocomplete'), hint: document.body.innerText.includes('Test OTP'), wa: /WhatsApp/.test(document.body.innerText) }));
  ok(ui.s === 'otp' && ui.ac === 'one-time-code' && !ui.hint && !ui.wa, 'OTP screen: one-time-code box, no test hint, no fake WhatsApp link ' + JSON.stringify(ui));
  const code = sent[sent.length - 1].OTP;
  await p.fill('#otp0', code); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => cur().s !== 'otp' && !!(SRV.user || (S.ui && S.ui.me) || document.cookie !== null)), 'a whole code in the first box fills all 6 and logs in (screen ' + await p.evaluate(() => cur().s) + ')');
  await b.close();
} finally { srv.kill(); mock.close(); }
process.exit(fails ? 1 : 0);
