import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
const ADMIN = 'sam@bikepharma.com', ADMIN_PW = 'Test@1234';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function page(ctx) { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); }); p.on('response', r => { if (r.status() >= 400 && !/fonts\./.test(r.url())) errs.push('http ' + r.status() + ' ' + r.url()); }); return p; }
const screen = p => p.evaluate(() => cur().s);
const typeOtp = async (p, code) => { for (let i = 0; i < 6; i++) await p.fill('#otp' + i, code[i]); await p.evaluate(() => verify()); await p.waitForTimeout(600); };
const open = async (p) => { await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length, null, { timeout: 15000 }); await p.waitForTimeout(400); };

// ---- customer: register with OTP, data saved on the server, survives reload
const cA = await b.newContext({ viewport: { width: 420, height: 860 } }); const A = await page(cA);
await open(A); ok(await screen(A) === 'login', 'customer: login screen first');
await A.fill('#loginId', '9876543210'); await A.evaluate(() => sendOtp()); await A.waitForTimeout(500);
ok(await screen(A) === 'signup', 'customer: unknown number goes to signup');
await A.fill('#su-name', 'Test Customer'); await A.evaluate(() => signupNext()); await A.waitForTimeout(300);
ok(await screen(A) === 'otp', 'customer: otp screen');
ok(await A.evaluate(() => document.body.innerText.includes('Test OTP')), 'customer: test OTP hint shown (fixed mode)');
await typeOtp(A, '111111'); ok((await A.evaluate(() => S.ui.otpErr || '')).includes('incorrect'), 'customer: wrong OTP rejected by server');
await typeOtp(A, '123456'); ok(await screen(A) === 'roleok', 'customer: correct OTP logs in');
ok(await A.evaluate(() => S.user && S.user.role === 'customer' && S.user.name === 'Test Customer'), 'customer: account created as customer');
await A.evaluate(() => { DB.wish.push('p4'); DB.bikes.push({ m: 'Honda Activa 6G', reg: 'KA01AB1234' }); save(); }); await A.waitForTimeout(1200);
const srvA = await A.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(srvA.changed.cu && srvA.changed.cu['9876543210'] && srvA.changed.cu['9876543210'].wish.includes('p4'), 'customer: wishlist saved on the server (own cu entry)');
ok(!('audit' in srvA.changed) && !('grns' in srvA.changed) && Object.keys(srvA.changed.accounts || {}).join() === '9876543210', 'customer: sees no staff data, only own account');
await open(A); ok(await A.evaluate(() => S.user && S.user.role === 'customer' && DB.wish.includes('p4') && DB.bikes.length === 1), 'customer: reload keeps login + data (no localStorage)');
ok(await A.evaluate(() => localStorage.getItem('bp-db') === null), 'customer: nothing stored in localStorage');
const xrefCust = await A.request.get(BASE + '/cat/xref.json'); ok(xrefCust.status() === 403, 'customer: catalogue files locked (403)');

// ---- admin: password login, create staff, staff logs in with password
const cB = await b.newContext({ viewport: { width: 420, height: 860 } }); const B = await page(cB);
await open(B); await B.fill('#loginId', ADMIN); await B.evaluate(() => sendOtp()); await B.waitForTimeout(500);
ok(await screen(B) === 'pw', 'admin: password screen');
await B.fill('#pw1', 'wrongpass'); await B.evaluate(() => pwGo()); await B.waitForTimeout(500); ok((await B.evaluate(() => S.ui.pwErr || '')).includes('Wrong password'), 'admin: wrong password rejected');
await B.fill('#pw1', ADMIN_PW); await B.evaluate(() => pwGo()); await B.waitForTimeout(600);
ok(await screen(B) === 'roleok' && await B.evaluate(() => S.user.role === 'admin'), 'admin: password login works');
ok(await B.evaluate(() => DB.accounts['9876543210'] && DB.accounts['9876543210'].name === 'Test Customer'), 'admin: sees the new customer account');
await B.evaluate(() => { S.ui.ns = { name: 'Priya Test', login: 'priya@test.in', role: 'Billing' }; go('newstaff'); createStaff(); }); await B.waitForTimeout(800);
const staffPw = await B.evaluate(() => { const b = document.querySelector('.sheet .kv b'); return b ? b.textContent.trim() : ''; });
ok(staffPw.length === 10, 'admin: staff login created with a one-time password (' + (staffPw ? 'shown' : 'missing') + ')');
await B.waitForTimeout(800);
const adminState = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(adminState.changed.accounts && adminState.changed.accounts['priya@test.in'] && adminState.changed.accounts['priya@test.in'].role === 'billing', 'admin: staff account synced to the server');
await B.evaluate(() => { S.ui.ns = { name: 'Ravi Mech', login: '9008948080', role: 'Mechanic' }; closeSheet(); go('newstaff'); createStaff(); }); await B.waitForTimeout(800);
ok(await B.evaluate(() => DB.accounts['9008948080'] && DB.accounts['9008948080'].role === 'mechanic' && !document.querySelector('.sheet .kv b')), 'admin: mechanic login created (OTP, no password)');
await B.evaluate(() => closeSheet());

const cC = await b.newContext({ viewport: { width: 420, height: 860 } }); const C = await page(cC);
await open(C); await C.fill('#loginId', 'priya@test.in'); await C.evaluate(() => sendOtp()); await C.waitForTimeout(500);
ok(await screen(C) === 'pw', 'staff: password screen');
await C.fill('#pw1', staffPw); await C.evaluate(() => pwGo()); await C.waitForTimeout(600);
ok(await screen(C) === 'roleok' && await C.evaluate(() => S.user.role === 'billing'), 'staff: logs in with the one-time password');
ok(![401, 403].includes((await C.request.get(BASE + '/cat/xref.json')).status()), 'staff: catalogue files open (not locked; 404 while no catalogue is uploaded)');
const list = await C.request.get(BASE + '/api/files/list?path=').then(r => r.json());
ok(list.entries.some(e => e.path === 'catalogues' && e.isDirectory), 'staff: files list works');
const rd = await C.request.get(BASE + '/api/files/read?path=catalogues/test/a.bin&offset=10&length=5'); const buf = await rd.body();
ok(rd.status() === 200 && buf.length === 5 && buf[0] === 10 && buf[4] === 14 && rd.headers()['x-file-size'] === '256', 'staff: files read with offset/length works');
ok(await C.evaluate(async () => { const fs = await claude.use('files'); const r = await fs.read('catalogues/test/a.bin', { offset: 0, length: 3 }); return r.bytes.length === 3 && r.bytes[2] === 2; }), 'staff: in-app files shim reads through the server');

// ---- mechanic: phone + OTP
const cM = await b.newContext({ viewport: { width: 420, height: 860 } }); const M = await page(cM);
await open(M); await M.fill('#loginId', '9008948080'); await M.evaluate(() => sendOtp()); await M.waitForTimeout(500);
ok(await screen(M) === 'otp', 'mechanic: known number goes straight to OTP');
await typeOtp(M, '123456'); ok(await M.evaluate(() => S.user && S.user.role === 'mechanic'), 'mechanic: OTP login works');
const mv = await M.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(Array.isArray(mv.changed.wl) && !('audit' in mv.changed) && !('grns' in mv.changed) && Object.keys(mv.changed.accounts).join() === '9008948080', 'mechanic: server sends wallet, no audit/GRN/staff data');

// ---- concurrent edits from admin and staff merge instead of overwriting
await B.evaluate(() => { DB.stock.p1 = 99; DB.tasks.unshift({ id: 'T-9001', type: 'count', ids: [], to: 'x', due: 'today', st: 'open' }); save(); });
await C.evaluate(() => { DB.stock.p2 = 77; DB.tasks.unshift({ id: 'T-9002', type: 'count', ids: [], to: 'y', due: 'today', st: 'open' }); save(); });
await B.waitForTimeout(2500);
const st = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(st.changed.stock.p1 === 99 && st.changed.stock.p2 === 77, 'merge: both stock changes kept');
ok(st.changed.tasks.some(t => t.id === 'T-9001') && st.changed.tasks.some(t => t.id === 'T-9002'), 'merge: both new tasks kept');
await B.waitForTimeout(16000); // poll brings the other user's change
ok(await B.evaluate(() => DB.stock.p2 === 77 && DB.tasks.some(t => t.id === 'T-9002')), 'merge: admin page received the staff change by polling');
ok(await C.evaluate(() => DB.stock.p1 === 99 && DB.tasks.some(t => t.id === 'T-9001')), 'merge: staff page received the admin change');

// ---- customer order appears for staff
await A.evaluate(() => { DB.orders.unshift({ id: 'BP-ORD-TEST-1', mob: S.uid, d: '10 Oct 2026', items: 1, amt: 100, pm: 'UPI', st: 'Confirmed' }); save(); }); await A.waitForTimeout(1200);
const st2 = await C.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(st2.changed.orders.some(o => o.id === 'BP-ORD-TEST-1' && o.mob === '9876543210') && st2.changed.orders.length > 1, 'customer order visible to staff, other orders untouched');
const custView = await A.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(custView.changed.orders.length === 1 && custView.changed.orders[0].id === 'BP-ORD-TEST-1', 'customer sees only own orders ' + JSON.stringify((custView.changed.orders||[]).map(o => [o.id, o.mob])));

// ---- logout + password reset
await C.evaluate(() => logout()); await C.waitForTimeout(800); ok(await screen(C) === 'login', 'staff: logout returns to login');
ok((await C.request.get(BASE + '/cat/xref.json')).status() === 401, 'staff: catalogue locked again after logout');
await B.evaluate(() => staffPw('priya@test.in')); await B.waitForTimeout(800);
const newPw = await B.evaluate(() => { const b = document.querySelector('.sheet .kv b'); return b ? b.textContent.trim() : ''; }); await B.evaluate(() => closeSheet());
await C.fill('#loginId', 'priya@test.in'); await C.evaluate(() => sendOtp()); await C.waitForTimeout(500); await C.fill('#pw1', staffPw); await C.evaluate(() => pwGo()); await C.waitForTimeout(500);
ok((await C.evaluate(() => S.ui.pwErr || '')).includes('Wrong'), 'staff: old password rejected after reset');
await C.fill('#pw1', newPw); await C.evaluate(() => pwGo()); await C.waitForTimeout(600); ok(await C.evaluate(() => S.user && S.user.role === 'billing'), 'staff: new password works');

// ---- landing page iframe path (index.html loads app.html into the frame)
const L = await page(cA); await L.goto(BASE + '/', { waitUntil: 'load' }); await L.waitForTimeout(800);
ok(await L.evaluate(() => document.getElementById('appv').hidden), 'landing page: shows the website first, not the login');
await L.evaluate(() => document.querySelector('[data-login]').click()); await L.waitForTimeout(2500);
const fr = L.frames().find(f => f !== L.mainFrame());
ok(!!fr && await fr.evaluate(() => typeof S !== 'undefined' && S.user && S.user.role === 'customer').catch(() => false), 'landing page: app in the frame boots from the server with the customer session');

console.log('page errors:', errs.length ? errs : 'none');
ok(errs.length === 0, 'no page errors');
await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
