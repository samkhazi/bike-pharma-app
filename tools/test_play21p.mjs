// 21p (Google Play): /privacy and /delete-account open without a login; the reviewers' test login (.env REVIEW_PHONE + REVIEW_OTP,
// no SMS, never for staff or mechanics); a customer deletes their own account (personal data gone, bills / orders / warranties kept);
// staff and mechanic logins can't; the app's Account > Delete my account and the privacy sheet's full policy.
// usage: node tools/test_play21p.mjs   (own server on 3035 with a fresh database, mock SMS on 3036)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
import { openStore } from '../lib/store.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sent = [];
const mock = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); sent.push(Object.fromEntries(u.searchParams)); r.end('{"status":"SUCCESS"}'); }).listen(3036);
const T = '/tmp/claude-0/bptest-play21p'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/pf', { recursive: true }); fs.mkdirSync(T + '/data', { recursive: true });
const REV = '9000000001', ROTP = '246810', CUST = '9876511111', OTHER = '9876544444', WEB = '9876566666', ADMIN = '9876522222', MECH = '9876533333';
const run = (args, env) => new Promise(r => { const a = spawn('node', args, { env: { ...process.env, ...env } }); a.on('exit', r); });
await run(['--no-warnings', 'admin.mjs', 'add-admin', ADMIN, 'Boss', '--password', 'Test@1234'], { DATA_DIR: T + '/data' });
{ // a customer with data in every personal key, two more customers, a mechanic, and the shop's records of the customer
  const st = openStore(T + '/data'); const acc = JSON.parse((st.stateGet('accounts') || { json: '{}' }).json);
  const c = (name) => ({ role: 'customer', name, label: 'Customer', sub: 'Customer account', status: 'active' });
  Object.assign(acc, { [CUST]: c('Ravi Test'), [OTHER]: c('Other Test'), [WEB]: c('Web Test'), [MECH]: { role: 'mechanic', name: 'Mech Test', code: 'BP-MECH-2001', status: 'active' } });
  const per = v => ({ [CUST]: v, [OTHER]: v });
  st.write({ accounts: JSON.stringify(acc), cu: JSON.stringify(per({ addrs: [['Home', 'MG Road', '', true]], bikes: [{ r: 'KA27AB1234', b: 'Hero', m: 'Splendor' }], cart: [], wish: ['t21p-p1'] })),
    cwl: JSON.stringify(per([{ id: 't21p-w', amt: 20 }])), chats: JSON.stringify(per([{ t: 'hello' }])), nprefs: JSON.stringify(per({ offers: false })), cdocs: JSON.stringify(per({ ins: 'x' })),
    reviews: JSON.stringify([{ id: 't21p-r1', m: CUST, t: 'good' }, { id: 't21p-r2', m: OTHER, t: 'ok' }]), bills: JSON.stringify([{ id: 'T21P-B1', mob: CUST, amt: 100 }]),
    orders: JSON.stringify([{ id: 'T21P-O1', mob: CUST, d: '12 Nov' }]), warranties: JSON.stringify([{ id: 'T21P-W1', party: CUST, name: 'Chain' }]) });
  st.close();
}
const env = { ...process.env, PORT: '3035', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', PUBLIC_DIR: 'public', OTP_MODE: 'fixed', RENFLAIR_API_KEY: 'k3y', RENFLAIR_URL: 'http://127.0.0.1:3036/V1.php?API={key}&PHONE={phone}&OTP={otp}', REVIEW_PHONE: REV, REVIEW_OTP: ROTP };
let srv = spawn('node', ['--no-warnings', 'server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
await new Promise(r => setTimeout(r, 1500));
const BASE = 'http://127.0.0.1:3035';
const call = async (p, b, { cookie = '', ip = '1.1.1.1' } = {}) => { const r = await fetch(BASE + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const sc = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).join('; '), m = /bp_s=([a-f0-9]*)/.exec(sc); let j = {}; try { j = await r.json(); } catch {} return { j, status: r.status, cookie: m ? 'bp_s=' + m[1] : '', cleared: /bp_s=;/.test(sc) }; };
let b;
try {
  // the two pages, no login
  for (const [u, want] of [['/privacy', 'Privacy policy'], ['/privacy/', 'Privacy policy'], ['/privacy-policy', 'Privacy policy'], ['/delete-account', 'Delete your Bike Pharma account']]) {
    const r = await fetch(BASE + u); const t = await r.text();
    ok(r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && t.includes(want) && t.includes('samkhazi@bikepharma.com'), u + ' opens without a login (' + r.status + ')');
  }
  for (const u of ['/constructor', '/__proto__', '/toString', '/privacy.htm']) ok((await fetch(BASE + u)).status === 404, u + ' is still 404');
  const pv = await (await fetch(BASE + '/privacy')).text();
  ok(['Grievance officer', 'Ranebennur', '72 months', '/delete-account', 'We do not sell or rent your data'].every(x => pv.includes(x)), 'privacy policy: contact, grievance officer, retention, deletion link, no sale');

  // Google's reviewers: the fixed OTP, no SMS
  let r = await call('/api/otp', { id: REV });
  ok(r.j.kind === 'otp' && r.j.signup === true && sent.length === 0, 'review number: OTP asked, no SMS sent ' + JSON.stringify(r.j));
  r = await call('/api/login', { id: REV, otp: '111111', signup: { name: 'Google Review' } });
  ok(/incorrect/.test(r.j.error || ''), 'review number: a wrong OTP is refused');
  r = await call('/api/login', { id: REV, otp: ROTP, signup: { name: 'Google Review' } });
  ok(r.j.user && r.j.user.id === REV && r.j.user.role === 'customer' && /Google Play review login/.test(r.j.user.sub || ''), 'review number logs in with REVIEW_OTP as a customer, marked as the review login');
  r = await call('/api/otp', { id: CUST });
  ok(r.j.kind === 'otp' && sent.length === 1 && sent[0].PHONE === CUST && sent[0].OTP !== ROTP, 'any other number still gets a real SMS with a random OTP');
  const custOtp = sent[0].OTP;

  // the deletion page asks no SMS for numbers that are not customers
  r = await call('/api/otp', { id: '9876555555', del: 1 }, { ip: '3.3.3.3' });
  ok(/No Bike Pharma account/.test(r.j.error || '') && sent.length === 1, 'deletion page: unknown number, no SMS');
  r = await call('/api/otp', { id: MECH, del: 1 }, { ip: '3.3.3.3' });
  ok(/mechanic or staff/.test(r.j.error || '') && sent.length === 1, 'deletion page: mechanic number, no SMS');
  r = await call('/api/otp', { id: ADMIN, del: 1 }, { ip: '3.3.3.3' });
  ok(/mechanic or staff/.test(r.j.error || '') && sent.length === 1, 'deletion page: Admin number, no SMS');

  // a customer deletes their own account
  r = await call('/api/login', { id: CUST, otp: custOtp, lite: 1 });
  ok(r.j.user && r.j.user.id === CUST && r.j.user.kind === 'customer' && r.j.user.name === 'Ravi Test' && !('db' in r.j) && r.cookie, 'lite login: only who is logged in, no shop data ' + JSON.stringify(r.j).slice(0, 120));
  const ck = r.cookie;
  r = await call('/api/me', null, { cookie: ck });
  ok(r.j.user && r.j.user.id === CUST && r.j.user.kind === 'customer', '/api/me says who is logged in');
  ok((await call('/api/me')).j.user === null, '/api/me without a login: nobody');
  r = await call('/api/account/delete', {}, { cookie: ck });
  ok(/Tick the box/.test(r.j.error || ''), 'deleting needs the confirm');
  ok((await call('/api/account/delete', { confirm: 'DELETE' })).status === 401, 'deleting needs a login');
  r = await call('/api/account/delete', { confirm: 'DELETE' }, { cookie: ck });
  ok(r.j.ok === true && r.cleared, 'customer deletes their account; the login cookie is cleared');
  ok(/account deleted by its owner 98\*{6}11/.test(log) && !log.includes(CUST), 'the server log keeps only a masked number');
  ok((await call('/api/me', null, { cookie: ck })).j.user === null && (await call('/api/sync?since=0', null, { cookie: ck })).status === 401, 'the old login no longer works');
  r = await call('/api/otp', { id: CUST }, { ip: '4.4.4.4' });
  ok(r.j.kind === 'otp' && r.j.signup === true, 'the same number later starts a new account');

  // staff and mechanics can't
  r = await call('/api/login', { id: ADMIN, password: 'Test@1234' });
  const ack = r.cookie; r = await call('/api/account/delete', { confirm: 'DELETE' }, { cookie: ack });
  ok(/business accounts/.test(r.j.error || '') && (await call('/api/me', null, { cookie: ack })).j.user, 'Admin cannot delete their login here, stays logged in');

  // the browser: the deletion page logged out (OTP), on a phone
  b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 380, height: 820 } }); const p = await ctx.newPage();
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await p.goto(BASE + '/privacy', { waitUntil: 'load' });
  ok(!(await wide()), 'privacy page fits a phone (no sideways scroll)');
  await p.goto(BASE + '/delete-account', { waitUntil: 'load' }); await p.waitForSelector('#mob');
  ok(!(await wide()), 'deletion page fits a phone');
  await p.fill('#mob', '98765 44444'); await p.click('#b1'); await p.waitForSelector('#otp');
  const o2 = sent[sent.length - 1]; ok(o2.PHONE === OTHER, 'page sends the OTP to the number typed');
  await p.fill('#otp', '000000'); await p.click('#b2'); await p.waitForTimeout(400);
  ok(/incorrect/.test(await p.textContent('.err')), 'a wrong OTP shows the error on the page');
  await p.fill('#otp', o2.OTP); await p.click('#b2'); await p.waitForSelector('#ok');
  ok((await p.textContent('#box')).includes('Other Test') && await p.isDisabled('#b3'), 'confirm step: the name, Delete stays off until the box is ticked');
  await p.check('#ok'); await p.click('#b3'); await p.waitForSelector('h3.done');
  ok((await p.textContent('#box')).includes('Your account is deleted'), 'deleted from the page');

  // the app: Account > Delete my account opens the page, logged in (review login); the privacy sheet links the full policy
  const p2 = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  await p2.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p2.evaluate(async (a) => { await fetch('/api/otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a[0] }) }); await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a[0], otp: a[1] }) }); }, [REV, ROTP]);
  await p2.goto(BASE + '/app.html', { waitUntil: 'load' }); await p2.waitForFunction(() => typeof S !== 'undefined' && S.user && S.stack && S.stack.length, null, { timeout: 15000 });
  await p2.evaluate(() => legalSheet('privacy')); await p2.waitForTimeout(300);
  const sh = await p2.evaluate(() => (document.querySelector('.sheet') || document.body).innerText);
  ok(/Read the full privacy policy/i.test(sh) && !/DRAFT/.test(sh) && /63614 44960/.test(sh) && /Account > Delete my account/.test(sh), 'privacy sheet: full policy button, no DRAFT tag, the shop phone, how to delete');
  await p2.evaluate(() => { closeSheet(); go('account'); }); await p2.waitForTimeout(400);
  ok(await p2.locator('button.li', { hasText: 'Delete my account' }).count() === 1, 'Account has Delete my account');
  await Promise.all([p2.waitForURL(/\/delete-account$/), p2.locator('button.li', { hasText: 'Delete my account' }).click()]);
  await p2.waitForSelector('#ok');
  ok((await p2.textContent('#box')).includes('Google Review'), 'it opens the deletion page with the logged-in account, no OTP needed');
  await p2.goto(BASE + '/app.html', { waitUntil: 'load' }); await p2.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length, null, { timeout: 15000 });
  await p2.evaluate(() => logout()); await p2.waitForTimeout(400);
  ok((await p2.evaluate(() => document.body.innerText)).includes('Bike Pharma Automobiles, Ranebennur'), 'login screen names Ranebennur');
} finally { if (b) await b.close(); srv.kill(); mock.close(); }
await new Promise(r => setTimeout(r, 400));
{ // what is left in the database
  const st = openStore(T + '/data'), v = k => JSON.parse((st.stateGet(k) || { json: 'null' }).json);
  const acc = v('accounts');
  ok(!(CUST in acc) && !(OTHER in acc) && ADMIN in acc && MECH in acc && REV in acc, 'deleted accounts are gone; Admin, mechanic and the review login stay');
  ok(['cu', 'cwl', 'chats', 'nprefs', 'cdocs'].every(k => { const x = v(k) || {}; return !(CUST in x) && !(OTHER in x); }), 'their addresses, bikes, wishlist, wallet, chat, settings and papers are gone');
  ok(JSON.stringify(v('reviews')) === '[]', 'their reviews are gone');
  ok(v('bills').some(x => x.id === 'T21P-B1') && v('orders').some(x => x.id === 'T21P-O1') && v('warranties').some(x => x.id === 'T21P-W1'), 'bills, orders and warranties stay (tax records)');
  ok(!st.kvAll('sess').some(([, s]) => s.uid === CUST || s.uid === OTHER), 'no sessions left for them');
  st.close();
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
