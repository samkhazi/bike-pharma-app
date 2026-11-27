// Front door tests: two stand-in panels (sign-in with phone + PIN, a page and an API) behind the front door.
'use strict';
process.env.PANELS_OFF = '';   // these tests use the demo panels too
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const seen = [];
function fakePanel(name, cookieName, loginPath) {
  const sessions = new Map();
  return http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; });
    req.on('end', () => {
      seen.push({ name, url: req.url, cookie: req.headers.cookie || '', host: req.headers.host });
      const tok = ((req.headers.cookie || '').match(new RegExp(cookieName + '=([^;]+)')) || [])[1];
      if (req.method === 'POST' && req.url === loginPath) {
        const { phone, pin } = JSON.parse(b || '{}');
        if (phone === '7000000099') { res.writeHead(403, { 'content-type': 'application/json' }); return res.end('{"error":"You are not the backup for the desk today. Ask Ganesh to set you as the backup."}'); }
        if (pin !== '1234') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"Wrong phone number or PIN."}'); }
        const t = 'tok' + Math.random().toString(36).slice(2); sessions.set(t, phone);
        res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': `${cookieName}=${t}; Path=/; HttpOnly` }); return res.end('{"ok":true}');
      }
      if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html', etag: '"x"' }); return res.end(`<html><body><h1>${name}</h1></body></html>`); }
      if (req.url === '/app.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' }); return res.end(`// ${name}`); }
      if (req.url === '/api/state') {
        if (!sessions.has(tok)) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"sign in"}'); }
        res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': `${cookieName}=${tok}; Path=/` }); return res.end(JSON.stringify({ panel: name, phone: sessions.get(tok) }));
      }
      if (req.url === '/api/echo' && req.method === 'POST') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ panel: name, got: JSON.parse(b), who: sessions.get(tok) })); }
      if (req.url === '/api/forget') { sessions.clear(); res.writeHead(200); return res.end('{}'); }
      res.writeHead(404); res.end('{}');
    });
  });
}

let base, gate;
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
test.before(async () => {
  process.env.PORT_ADMIN = await listen(fakePanel('admin', 'bs_admin', '/api/login'));
  process.env.PORT_FLOOR = await listen(fakePanel('floor', 'bs_session', '/api/auth/login'));
  process.env.PORT_CASHIER = await listen(fakePanel('cashier', 'bs_cash', '/api/login'));
  Object.assign(process.env, { DB_FILE: ':memory:', GATE_KEY: 'test-key', GATE_OWNER_EMAIL: 'Owner@Shop.in', GATE_OWNER_PASSWORD: 'owner-pass-1', START_PIN: '1234' });
  const g = require('../server/index.js');
  gate = g.start(0);
  await new Promise(r => gate.on('listening', r));
  base = `http://127.0.0.1:${gate.address().port}`;
});
test.after(() => setTimeout(() => process.exit(0), 50));

function client() {
  let jar = '';
  const call = async (path, opt = {}) => {
    const r = await fetch(base + path, { redirect: 'manual', ...opt, headers: { ...(opt.body ? { 'content-type': 'application/json' } : {}), ...(jar ? { cookie: jar } : {}), ...(opt.headers || {}) } });
    const sc = r.headers.get('set-cookie'); if (sc) { const c = sc.split(';')[0]; jar = c.endsWith('=') ? '' : c; }
    const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: r.status, body, headers: r.headers, setCookie: sc };
  };
  call.post = (p, b, h) => call(p, { method: 'POST', body: JSON.stringify(b), headers: h });
  call.patch = (p, b) => call(p, { method: 'PATCH', body: JSON.stringify(b) });
  return call;
}

test('without a login every page goes to the sign-in page, the API answers 401', async () => {
  const c = client();
  const r = await c('/');
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/__gate/login');
  assert.equal((await c('/api/state')).status, 401);
  const l = await c('/__gate/login');
  assert.equal(l.status, 200); assert.match(l.body, /Sign in/);
});

test('the sign-in page (shop photo in 3D): its photo, style and logo are served versioned; the photo comes back unchanged', async () => {
  const fs = require('node:fs'), path = require('node:path');
  const l = await client()('/__gate/login');
  for (const f of ['login.css', 'login.js', 'logo.svg', 'building.jpg']) assert.match(l.body, new RegExp(`/__gate/${f.replace('.', '\\.')}\\?v=[0-9a-f]{10}"`), f);
  const u = l.body.match(/\/__gate\/building\.jpg\?v=[0-9a-f]{10}/)[0];
  const r = await fetch(base + u);
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.match(r.headers.get('cache-control'), /immutable/);
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(fs.readFileSync(path.join(__dirname, '../public/building.jpg'))));
  assert.equal((await fetch(base + '/__gate/login.css')).headers.get('content-type'), 'text/css; charset=utf-8');
});

test('owner signs in with email (any case) + password and lands in the admin panel; wrong password is refused', async () => {
  const c = client();
  assert.equal((await c.post('/__gate/login', { email: 'owner@shop.in', password: 'nope' })).status, 401);
  const r = await c.post('/__gate/login', { email: ' OWNER@shop.in ', password: 'owner-pass-1' });
  assert.equal(r.status, 200); assert.match(r.setCookie, /HttpOnly/);
  const page = await c('/__x', { headers: { accept: 'text/html' } });   // the old one-panel way still works for any other path
  const home = await c('/');                                     // '/' is the one screen with every panel in one menu
  assert.equal(home.status, 200); assert.match(home.body, /\/__gate\/shell\.js/);
  assert.match(home.headers.get('content-security-policy'), /frame-src 'self'/);
  const pa = await c('/p/admin/');
  assert.equal(pa.status, 200);
  assert.match(pa.body, /<h1>admin<\/h1>/);
  assert.match(pa.body, /\/__gate\/inshell\.js/);               // the panel inside the one screen hides its own menu
  assert.equal(pa.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(page.status, 404);
  assert.equal(pa.headers.get('etag'), null);
  assert.equal(r.headers.get('clear-site-data'), null);          // sign in keeps the browser's saved files (speed)
  assert.equal(pa.headers.get('cache-control'), 'no-store');     // a page itself is never kept
  assert.match(pa.body, /\/__gate\/inshell\.js\?v=[0-9a-f]{10}/);   // gate files are versioned
  const st = await c('/api/state');
  assert.deepEqual(st.body, { panel: 'admin', phone: '9820000111' });
  assert.equal(st.setCookie, null);                              // the panel's own cookie never reaches the browser
  assert.equal((await c('/app.js')).headers.get('cache-control'), 'no-cache');
  const last = seen.filter(x => x.name === 'admin').pop();
  assert.doesNotMatch(last.cookie, /bs_gate/);                   // and the front door's cookie never reaches the panel
});

test('owner switches panel; the floor panel signs in on its own path; a login cannot open a panel it does not have', async () => {
  const c = client();
  await c.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  const me = await c('/__gate/me');
  assert.equal(me.body.owner, true); assert.equal(me.body.panels.length, 11);
  assert.equal((await c.post('/__gate/switch', { portal: 'floor' })).status, 200);
  assert.deepEqual((await c('/api/state')).body, { panel: 'floor', phone: '9820000111' });
  assert.match((await c('/', { headers: { 'sec-fetch-dest': 'iframe' } })).headers.get('location'), /^\/p\/floor\/$/);
  assert.equal((await c.post('/__gate/switch', { portal: 'nope' })).status, 403);
});

test('owner adds a login for Misba (cashier only); she lands in the cashier and cannot see logins or switch', async () => {
  const o = client();
  await o.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  const list = await o('/__gate/api/logins');
  assert.equal(list.body.portals.length, 11);
  assert.equal((await o.post('/__gate/api/logins', { name: 'Misba', email: 'misba@shop.in', password: 'short', panels: [{ portal: 'cashier', phone: '98111 20456' }] })).status, 400);
  assert.equal((await o.post('/__gate/api/logins', { name: 'Misba', email: 'misba@shop.in', password: 'misba-pass-1', panels: [{ portal: 'cashier', phone: '9811120456', pin: '12a4' }] })).status, 400);
  const add = await o.post('/__gate/api/logins', { name: 'Misba', email: 'misba@shop.in', password: 'misba-pass-1', panels: [{ portal: 'cashier', phone: '98111 20456' }] });
  assert.equal(add.status, 200, JSON.stringify(add.body));
  assert.equal((await o.post('/__gate/api/logins', { name: 'X', email: 'MISBA@shop.in', password: 'misba-pass-1', panels: [{ portal: 'cashier', phone: '9811120456' }] })).status, 409);
  const m = client();
  await m.post('/__gate/login', { email: 'misba@shop.in', password: 'misba-pass-1' });
  assert.deepEqual((await m('/api/state')).body, { panel: 'cashier', phone: '9811120456' });
  assert.equal((await m('/__gate/api/logins')).status, 403);
  assert.equal((await m.post('/__gate/switch', { portal: 'admin' })).status, 403);
  const me = await m('/__gate/me'); assert.equal(me.body.owner, false); assert.equal(me.body.panels.length, 1);
  // a write goes through with its body
  assert.deepEqual((await m.post('/api/echo', { a: 1 })).body, { panel: 'cashier', got: { a: 1 }, who: '9811120456' });
});

test('a panel PIN that is wrong shows a clear message; the owner fixes it and it works', async () => {
  const o = client();
  await o.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  const add = await o.post('/__gate/api/logins', { name: 'Sultan', email: 'sultan@shop.in', password: 'sultan-pass', panels: [{ portal: 'floor', phone: '9876543212', pin: '9999' }] });
  assert.equal(add.status, 200);
  const s = client();
  await s.post('/__gate/login', { email: 'sultan@shop.in', password: 'sultan-pass' });
  const bad = await s('/api/state');
  assert.equal(bad.status, 503); assert.match(bad.body.error, /Could not sign in to Service floor.*Wrong phone number or PIN/);
  const page = await s('/p/floor/', { headers: { accept: 'text/html' } });
  assert.equal(page.status, 503); assert.match(page.body, /did not open/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self'/);   // shown inside the one screen
  const id = (await o('/__gate/api/logins')).body.logins.find(l => l.email === 'sultan@shop.in').id;
  assert.equal((await o.patch(`/__gate/api/logins/${id}`, { panels: [{ portal: 'floor', phone: '9876543212', pin: '1234' }] })).status, 200);
  assert.deepEqual((await s('/api/state')).body, { panel: 'floor', phone: '9876543212' });
  // changing only the name keeps the PIN
  assert.equal((await o.patch(`/__gate/api/logins/${id}`, { name: 'Sultan Y', panels: [{ portal: 'floor', phone: '9876543212', pin: '' }] })).status, 200);
  assert.deepEqual((await s('/api/state')).body, { panel: 'floor', phone: '9876543212' });
});

test('a staff login by mobile number: any way of typing the number; one number = one login; a panel rule shows its own message', async () => {
  const o = client();
  await o.post('/__gate/login', { login: 'owner@shop.in', password: 'owner-pass-1' });
  assert.equal((await o.post('/__gate/api/logins', { name: 'R', phone: '12345', password: 'radhika-pass-1', panels: [{ portal: 'cashier', phone: '7000000070' }] })).status, 400);
  assert.equal((await o.post('/__gate/api/logins', { name: 'Radhika', phone: '+91 70000 00070', password: 'radhika-pass-1', panels: [{ portal: 'cashier', phone: '7000000070' }] })).status, 200);
  assert.equal((await o.post('/__gate/api/logins', { name: 'X', phone: '7000000070', password: 'x-pass-1234', panels: [{ portal: 'cashier', phone: '7000000070' }] })).status, 409);
  for (const typed of ['7000000070', '+91 70000-00070', '070000 00070']) {
    const r = client();
    assert.equal((await r.post('/__gate/login', { login: typed, password: 'radhika-pass-1' })).status, 200, typed);
    assert.equal((await r('/__gate/me')).body.name, 'Radhika');
    assert.deepEqual((await r('/p/cashier/api/state')).body, { panel: 'cashier', phone: '7000000070' });
  }
  assert.equal((await client().post('/__gate/login', { login: '7000000070', password: 'wrong-pass-1' })).status, 401);
  assert.equal((await client().post('/__gate/login', { login: '700000007', password: 'radhika-pass-1' })).status, 401);
  // the desk backup on a day Ganesh has not set them: the panel's own words, no "fix the PIN" hint
  assert.equal((await o.post('/__gate/api/logins', { name: 'Shoukat', phone: '7000000017', password: 'shoukat-pass-1', panels: [{ portal: 'cashier', phone: '7000000099' }] })).status, 200);
  const k = client(); await k.post('/__gate/login', { login: '7000000017', password: 'shoukat-pass-1' });
  const bad = await k('/p/cashier/api/state');
  assert.equal(bad.status, 503);
  assert.equal(bad.body.error, 'Could not sign in to Cashier: You are not the backup for the desk today. Ask Ganesh to set you as the backup.');
});

test('the panel forgetting its session: a read signs in again by itself', async () => {
  const c = client();
  await c.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  await c.post('/__gate/switch', { portal: 'cashier' });
  assert.equal((await c('/api/state')).status, 200);
  await c('/api/forget');
  assert.deepEqual((await c('/api/state')).body, { panel: 'cashier', phone: '9820000111' });
});

test("the panel's own sign-out signs out of the front door; a switched-off login cannot sign in", async () => {
  const c = client();
  await c.post('/__gate/login', { email: 'misba@shop.in', password: 'misba-pass-1' });
  assert.equal((await c.post('/api/logout', {})).status, 200);
  assert.equal((await c('/api/state')).status, 401);
  const o = client();
  await o.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  const id = (await o('/__gate/api/logins')).body.logins.find(l => l.email === 'misba@shop.in').id;
  const own = (await o('/__gate/api/logins')).body.logins.find(l => l.owner).id;
  assert.equal((await o.patch(`/__gate/api/logins/${own}`, { active: false })).status, 400);
  assert.equal((await o.patch(`/__gate/api/logins/${id}`, { active: false })).status, 200);
  assert.equal((await c.post('/__gate/login', { email: 'misba@shop.in', password: 'misba-pass-1' })).status, 401);
});

test('cross-site posts are refused; 5 wrong passwords lock the email for 10 minutes', async () => {
  const c = client();
  assert.equal((await c.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' }, { origin: 'https://evil.example' })).status, 403);
  for (let i = 0; i < 5; i++) await c.post('/__gate/login', { email: 'sultan@shop.in', password: 'wrong' });
  const r = await c.post('/__gate/login', { email: 'sultan@shop.in', password: 'sultan-pass' });
  assert.equal(r.status, 429); assert.match(r.body.error, /Try again in 10 minutes, or ask the owner to set a new password in Logins/);
  // the owner sees the lock in Logins; a new password opens it at once (the old lock is not kept)
  const o = client();
  await o.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  const l = (await o('/__gate/api/logins')).body.logins.find(x => x.email === 'sultan@shop.in');
  assert.equal(l.locked, 10);
  assert.equal((await o('/__gate/api/logins')).body.logins.find(x => x.owner).locked, 0);
  assert.equal((await o.patch(`/__gate/api/logins/${l.id}`, { password: 'sultan-new-1' })).status, 200);
  assert.equal((await o('/__gate/api/logins')).body.logins.find(x => x.id === l.id).locked, 0);
  assert.equal((await client().post('/__gate/login', { email: 'sultan@shop.in', password: 'sultan-pass' })).status, 401);
  // a space copied at the end of the password still signs in; a space inside does not
  assert.equal((await client().post('/__gate/login', { email: 'sultan@shop.in', password: 'sultan-new-1 ' })).status, 200);
  assert.equal((await client().post('/__gate/login', { email: 'sultan@shop.in', password: 'sultan new-1' })).status, 401);
  assert.equal((await client().post('/__gate/login', { email: ' Sultan@Shop.in ', password: 'sultan-new-1' })).status, 200);
});

test('own password change', async () => {
  const c = client();
  await c.post('/__gate/login', { email: 'owner@shop.in', password: 'owner-pass-1' });
  assert.equal((await c.post('/__gate/password', { old: 'bad', password: 'new-owner-pass' })).status, 400);
  assert.equal((await c.post('/__gate/password', { old: 'owner-pass-1', password: 'new-owner-pass' })).status, 200);
  assert.equal((await client().post('/__gate/login', { email: 'owner@shop.in', password: 'new-owner-pass' })).status, 200);
});

test('one screen: every panel at /p/<key>/, its /api calls kept to it by path, header or page; others refused', async () => {
  const c = client();
  await c.post('/__gate/login', { email: 'owner@shop.in', password: 'new-owner-pass' });
  assert.deepEqual((await c('/p/floor/api/state')).body, { panel: 'floor', phone: '9820000111' });
  assert.deepEqual((await c('/api/state', { headers: { 'x-gate-p': 'cashier' } })).body, { panel: 'cashier', phone: '9820000111' });
  assert.deepEqual((await c('/api/state', { headers: { referer: base + '/p/floor/#today' } })).body, { panel: 'floor', phone: '9820000111' });
  assert.deepEqual((await c('/api/state')).body.panel, 'admin');                       // nothing said: the session's panel
  assert.equal((await c('/', { headers: { 'sec-fetch-dest': 'iframe', referer: base + '/p/cashier/' } })).headers.get('location'), '/p/cashier/');
  assert.equal((await c.post('/__gate/api/logins', { name: 'Ravi', email: 'ravi@shop.in', password: 'ravi-pass-1', panels: [{ portal: 'floor', phone: '9876543212' }] })).status, 200);
  const s = client();
  await s.post('/__gate/login', { email: 'ravi@shop.in', password: 'ravi-pass-1' });
  assert.deepEqual((await s('/p/floor/api/state')).body, { panel: 'floor', phone: '9876543212' });
  assert.equal((await s('/p/admin/api/state')).status, 403);
  assert.equal((await s('/api/state', { headers: { referer: base + '/p/admin/' } })).status, 403);
  const n = client();
  const out = await n('/p/floor/', { headers: { 'sec-fetch-dest': 'iframe' } });
  assert.equal(out.status, 200); assert.match(out.body, /out\.js/);                    // signed out inside a frame: whole screen to sign in
  for (const f of ['shell.js', 'shell.css', 'inshell.js', 'inshell.css', 'out.js']) assert.equal((await n('/__gate/' + f)).status, 200, f);
});
