import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
const ADMIN = 'sam@bikepharma.com', ADMIN_PW = 'Test@1234';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function page(ctx) { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); }); p.on('response', r => { if (r.status() >= 400 && !/fonts\./.test(r.url())) errs.push('http ' + r.status() + ' ' + r.url()); }); return p; }
const screen = p => p.evaluate(() => cur().s);
// the 6th digit sends the OTP by itself (otpIn); press Verify only when that did not happen, else a fast server answer gets
// overwritten by "Enter all 6 digits." (the boxes are already empty again)
const typeOtp = async (p, code) => { for (let i = 0; i < 6; i++) await p.fill('#otp' + i, code[i]);
  await p.evaluate(() => { const v = [0, 1, 2, 3, 4, 5].map(i => (document.getElementById('otp' + i) || {}).value || '').join(''); if (cur().s === 'otp' && v.length === 6 && !S.ui.otpBusy) verify(); });
  await p.waitForTimeout(600); };
const open = async (p) => { await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length, null, { timeout: 15000 }); await p.waitForTimeout(400); };

// ---- customer: register with OTP, data saved on the server, survives reload
const cA = await b.newContext({ viewport: { width: 420, height: 860 } }); const A = await page(cA);
await open(A); ok(await screen(A) === 'login', 'customer: login screen first');
// Sam 2026-10-11 12:06Z: on a phone the field showed only the number pad, so staff could not type their email.
// The number pad stays for a mobile number; "Use email instead" opens the letter keyboard (with @) at once, and switches back
const km = await A.evaluate(() => { const i = document.getElementById('loginId'), r = { phone: i.getAttribute('inputmode') };
  document.getElementById('lg-mode').click(); const j = document.getElementById('loginId');
  Object.assign(r, { mail: j.getAttribute('inputmode'), cap: j.getAttribute('autocapitalize'), focus: document.activeElement === j, pre: getComputedStyle(document.getElementById('lg-pre')).display,
    ph: j.placeholder, btn: document.getElementById('lg-mode').innerText });
  document.getElementById('lg-mode').click(); r.back = document.getElementById('loginId').getAttribute('inputmode'); r.pre2 = getComputedStyle(document.getElementById('lg-pre')).display; return r; });
ok(km.phone === 'tel' && km.mail === 'email' && km.cap === 'none' && km.focus && km.pre === 'none' && /@/.test(km.ph) && /mobile/i.test(km.btn) && km.back === 'tel' && km.pre2 !== 'none',
  'login: number pad for a mobile number, "Use email instead" opens the letter keyboard: ' + JSON.stringify(km));
await A.fill('#loginId', '9876543210'); await A.evaluate(() => sendOtp()); await A.waitForTimeout(500);
ok(await screen(A) === 'signup', 'customer: unknown number goes to signup');
await A.fill('#su-name', 'Test Customer'); await A.evaluate(() => signupNext()); await A.waitForTimeout(300);
ok(await screen(A) === 'otp', 'customer: otp screen');
ok(await A.evaluate(() => document.body.innerText.includes('Test OTP')), 'customer: test OTP hint shown (fixed mode)');
// the server's answer can take longer than typeOtp's 600 ms when the machine is busy: wait for it (up to 5 s) instead of failing
await typeOtp(A, '111111'); const tOtp = Date.now();
await A.waitForFunction(() => (S.ui.otpErr || '').includes('incorrect'), null, { timeout: 5000 }).catch(() => {});
ok((await A.evaluate(() => S.ui.otpErr || '')).includes('incorrect'), `customer: wrong OTP rejected by server (+${Date.now() - tOtp} ms after 600)`);
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
// Sam 2026-10-11 14:18Z: Admin sets the staff password himself; no login is made without one
await B.evaluate(() => { S.ui.ns = null; go('newstaff'); }); await B.waitForTimeout(300);
await B.fill('#ns1', 'Priya Test'); await B.fill('#ns2', 'priya@test.in');
await B.click('#vp .screen:last-child .foot .btn'); await B.waitForTimeout(400);
ok((await B.evaluate(() => S.ui.nsErr || '')).includes('Enter a password') && await B.evaluate(() => !DB.accounts['priya@test.in']), 'admin: New staff login asks for a password and makes no login without one');
await B.click('#vp .screen:last-child button:has-text("Make one")'); const made = await B.inputValue('#ns3');
ok(made.length === 8 && await B.evaluate(() => S.ui.ns.pw.length === 8), 'admin: Make one fills an 8-character password (' + made.length + ')');
await B.fill('#ns3', 'priya123'); await B.click('#vp .screen:last-child .foot .btn'); await B.waitForTimeout(900);
const staffPw = await B.evaluate(() => { const b = document.querySelector('.sheet .kv b'); return b ? b.textContent.trim() : ''; });
ok(staffPw === 'priya123', 'admin: staff login created with the password Admin typed (' + staffPw + ')');
await B.waitForTimeout(800);
const adminState = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(adminState.changed.accounts && adminState.changed.accounts['priya@test.in'] && adminState.changed.accounts['priya@test.in'].role === 'billing', 'admin: staff account synced to the server');
await B.evaluate(() => { closeSheet(); S.ui.ns = null; go('newstaff'); }); await B.waitForTimeout(300);
ok(await B.evaluate(() => { const t = document.querySelector('#vp .screen:last-child').innerText; return !/\bMechanic\b(?! logins are made)/.test(t.replace(/Mechanic logins are made from their first bill\./, '')) && /first bill/.test(t); }), 'admin: New staff login has staff roles only (mechanics come from their first bill)');
await B.evaluate(() => back());

const cC = await b.newContext({ viewport: { width: 420, height: 860 } }); const C = await page(cC);
await open(C); await C.fill('#loginId', 'priya@test.in'); await C.evaluate(() => sendOtp()); await C.waitForTimeout(500);
ok(await screen(C) === 'pw', 'staff: password screen');
await C.fill('#pw1', staffPw); await C.evaluate(() => pwGo()); await C.waitForTimeout(600);
ok(await screen(C) === 'roleok' && await C.evaluate(() => S.user.role === 'billing'), 'staff: logs in with the password Admin set');
ok(![401, 403].includes((await C.request.get(BASE + '/cat/xref.json')).status()), 'staff: catalogue files open (not locked; 404 while no catalogue is uploaded)');
const list = await C.request.get(BASE + '/api/files/list?path=').then(r => r.json());
ok(list.entries.some(e => e.path === 'catalogues' && e.isDirectory), 'staff: files list works');
const rd = await C.request.get(BASE + '/api/files/read?path=catalogues/test/a.bin&offset=10&length=5'); const buf = await rd.body();
ok(rd.status() === 200 && buf.length === 5 && buf[0] === 10 && buf[4] === 14 && rd.headers()['x-file-size'] === '256', 'staff: files read with offset/length works');
ok(await C.evaluate(async () => { const fs = await claude.use('files'); const r = await fs.read('catalogues/test/a.bin', { offset: 0, length: 3 }); return r.bytes.length === 3 && r.bytes[2] === 2; }), 'staff: in-app files shim reads through the server');

// ---- billing: a new mechanic's first bill makes their mechanic login (Sam 2026-10-10)
const newMechBill = (p, nm, pm) => p.evaluate(([nm, pm]) => { tab('invoice'); S.ui.inv = { party: 'mech', mc: 'new', nm, items: { p1: 1, p2: 2 }, pm, bc: '', bcErr: '' }; refresh(); const tot = P('p1').mp + 2 * P('p2').mp; genInvoice(tot); return { tot, sheet: (document.querySelector('.sheet') || {}).innerText || '' }; }, [nm, pm]);
ok(await C.evaluate(() => { tab('invoice'); S.ui.inv = { party: 'mech', mc: 'new', items: {}, pm: 'Credit', bc: '', bcErr: '' }; refresh(); return !!document.getElementById('nm-mob') && !!document.getElementById('nm-shop') && /first bill makes their mechanic login/.test(document.querySelector('#vp .screen:last-child').innerText); }), 'billing: Mechanic > New mechanic shows the details form');
ok(await C.evaluate(() => { S.ui.inv.items = { p1: 1 }; S.ui.inv.nm = { mob: '12345', name: '', shop: '', area: '', gst: '' }; genInvoice(P('p1').mp); return !document.querySelector('.sheet') && DB.bills.every(b => b.mob !== '12345'); }), 'billing: a wrong mobile number stops the bill');
await C.evaluate(() => { S.ui.inv = null; });
const nb = await newMechBill(C, { mob: '9008948080', name: 'Ravi Mech', shop: 'Ravi Test Garage', area: 'Rajajinagar', gst: '29abcde1234f1z5' }, 'Credit');
ok(/Mechanic login created/.test(nb.sheet) && /BP-MECH-2001/.test(nb.sheet), 'billing: invoice made and the sheet says the mechanic login was created (BP-MECH-2001)');
await C.evaluate(() => closeSheet()); await C.waitForTimeout(1500);
const sv1 = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
const ma = (sv1.changed.accounts || {})['9008948080'] || {};
ok(ma.role === 'mechanic' && ma.code === 'BP-MECH-2001' && ma.shop === 'Ravi Test Garage' && ma.area === 'Rajajinagar' && ma.gst === '29ABCDE1234F1Z5' && ma.status === 'active', 'server: mechanic account made from the bill ' + JSON.stringify(ma));
ok((sv1.changed.omech || {})['BP-MECH-2001'] && sv1.changed.omech['BP-MECH-2001'][0].amt === nb.tot, 'server: credit bill added to that mechanic\'s outstanding');
ok(await C.evaluate(() => realMechs().some(m => m.code === 'BP-MECH-2001' && m.mob === '9008948080')), 'billing: the new mechanic is now in the billing list');
const nb2 = await newMechBill(C, { mob: '9008948080', name: 'Dup', shop: 'Dup Garage', area: 'X', gst: '' }, 'Cash');
ok(!/Mechanic login created/.test(nb2.sheet), 'billing: same number again goes to the existing mechanic (no second login)');
await C.evaluate(() => closeSheet()); await C.waitForTimeout(1200);
const sv2 = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(sv2.changed.accounts['9008948080'].shop === 'Ravi Test Garage' && sv2.changed.bills.filter(b => b.kind === 'mech' && b.mob === '9008948080').every(b => b.p === 'BP-MECH-2001'), 'server: second bill kept on the same mechanic + code');
ok(await C.evaluate(() => { const d = invData(DB.bills.find(b => b.mob === '9008948080' && b.md).id); return d.gst === '29ABCDE1234F1Z5' && d.addr === 'Rajajinagar' && d.mob === '9008948080' && d.code === 'BP-MECH-2001'; }), 'billing: invoice shows the mechanic\'s own GSTIN, area, mobile and code');
// two devices at once: this app picks a code another device already used; the server gives the next code and moves the credit row
const race = await C.evaluate(() => { const o = window.nextMechCode; window.nextMechCode = () => 'BP-MECH-2001'; tab('invoice'); S.ui.inv = { party: 'mech', mc: 'new', nm: { mob: '9008948081', name: 'Race Mech', shop: 'Race Garage', area: 'Vijayanagar', gst: '' }, items: { p1: 1 }, pm: 'Credit', bc: '', bcErr: '' }; refresh(); genInvoice(P('p1').mp); window.nextMechCode = o; const id = DB.bills[0].id; try { closeSheet(); } catch (e) {} return id; });
await C.waitForTimeout(1500);
const sv4 = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
const rc = (sv4.changed.accounts['9008948081'] || {}).code;
ok(rc && rc !== 'BP-MECH-2001' && sv4.changed.bills.find(b => b.id === race).p === rc && !(sv4.changed.omech['BP-MECH-2001'] || []).some(r => r.id === race) && (sv4.changed.omech[rc] || []).some(r => r.id === race), 'server: a code already taken gets the next one, and the credit row moves with it (' + rc + ')');
ok(await C.evaluate(([id, rc]) => DB.bills.find(b => b.id === id).p === rc && !(DB.omech['BP-MECH-2001'] || []).some(r => r.id === id), [race, rc]), 'billing app gets the corrected code back');
// a billing login cannot change who is admin
await C.evaluate(() => { DB.accounts['priya@test.in'] = { ...DB.accounts['priya@test.in'], role: 'admin', label: 'Admin' }; save(); }); await C.waitForTimeout(1500);
const sv3 = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(sv3.changed.accounts['priya@test.in'].role === 'billing', 'security: billing staff cannot make themselves admin (server keeps billing)');
ok(await C.evaluate(() => DB.accounts['priya@test.in'].role === 'billing'), 'security: the refused change is undone in the billing app too');

// ---- mechanic: phone + OTP
const cM = await b.newContext({ viewport: { width: 420, height: 860 } }); const M = await page(cM);
await open(M); await M.fill('#loginId', '9008948080'); await M.evaluate(() => sendOtp()); await M.waitForTimeout(500);
ok(await screen(M) === 'otp', 'mechanic: known number goes straight to OTP');
await typeOtp(M, '123456'); ok(await M.evaluate(() => S.user && S.user.role === 'mechanic'), 'mechanic: OTP login works');
const mv = await M.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(Array.isArray(mv.changed.wl) && !('audit' in mv.changed) && !('grns' in mv.changed) && Object.keys(mv.changed.accounts).join() === '9008948080', 'mechanic: server sends wallet, no audit/GRN/staff data');
ok(mv.changed.bills.length === 2 && mv.changed.bills.every(b => b.mob === '9008948080') && !('omech' in mv.changed) && !('orec' in mv.changed), 'mechanic: sees only own 2 bills, no other mechanics\' dues ' + mv.changed.bills.map(b => b.id + ':' + b.p).join(','));
ok(mv.changed.minv.length === 2 && mv.changed.minv.some(v => v.amt === nb.tot && v.paid === 0 && v.due) && mv.changed.cl.length === 1 && mv.changed.cl[0].buy === nb.tot, 'mechanic: own invoices + credit ledger worked out from the shop\'s bills');
await M.evaluate(() => { const b = document.querySelector('#vp .btn'); if (cur().s === 'roleok') reset(HOME[S.user.role]); }); await M.waitForTimeout(500);
const mh = await M.evaluate(() => ({ s: cur().s, t: document.querySelector('#vp .screen:last-child').innerText }));
ok(mh.s === 'mhome' && /Ravi Test Garage/.test(mh.t) && /BP-MECH-2001/.test(mh.t) && !/Ravi Kumar Auto Works|BP-MECH-1025/.test(mh.t), 'mechanic: home shows own garage + code, no sample mechanic');
ok(await M.evaluate(() => outstanding() > 0 && mechDue(myCode()) === outstanding() && !creditBlocked(myCode())), 'mechanic: outstanding from own credit bill');
await M.evaluate(() => { tab('mshop'); go('mproduct', { id: 'p1' }); }); await M.waitForTimeout(400);
await M.evaluate(() => mBuy('p1', 3, 3 * P('p1').mp, 0)); await M.waitForTimeout(300);
ok(await M.evaluate(() => /Order from Bike Pharma/.test((document.querySelector('.sheet') || {}).innerText || '') && DB.minv.length === 2), 'mechanic: buying in the app sends an order to the shop, no made-up invoice');
await M.evaluate(() => { closeSheet(); S.ui.jc = { cust: 'Kiran', ph: '9900223311', bike: 'Pulsar', parts: [{ pid: 'p1', q: 1 }], labour: 300, issues: ['Oil change'] }; go('jobcard'); jcSave(); }); await M.waitForTimeout(1500);
ok(await M.evaluate(() => DB.jobs.length === 1 && DB.minv.length === 2), 'mechanic: job card saved, parts not billed by the app');
const mv2 = await M.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(mv2.changed.jobs.length === 1 && mv2.changed.jobs[0].cust === 'Kiran', 'mechanic: job card stored on the server for this mechanic');
const adm2 = await B.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(!('mjobs' in adm2.changed) && !(adm2.changed.jobs || []).some(j => j.cust === 'Kiran'), 'mechanic job cards stay private (not sent to staff)');
await M.evaluate(() => { DB.minv.unshift({ id: 'FAKE-1', d: today(), amt: 1, paid: 1 }); DB.cl.push({ d: today(), ref: 'fake', pay: 99999 }); save(); }); await M.waitForTimeout(1500);
ok(await M.evaluate(() => !DB.minv.some(v => v.id === 'FAKE-1') && !DB.cl.some(c => c.ref === 'fake')), 'security: a mechanic cannot write own invoices / payments (server undoes it)');
// the shop receives a payment: the mechanic's ledger shows it
await C.evaluate(() => { payOther('BP-MECH-2001', 100, 'UPI'); closeSheet(); }); await C.waitForTimeout(1500);
const mv3 = await M.request.get(BASE + '/api/sync?since=' + mv2.rev).then(r => r.json());
ok(mv3.changed.cl && mv3.changed.cl.some(c => c.pay === 100) && mv3.changed.minv.some(v => v.paid === 100), 'mechanic: payment recorded by the shop shows in their credit ledger');

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
await A.evaluate(() => { DB.orders.unshift({ id: 'BP-ORD-TEST-1', mob: S.uid, d: '10 Oct 2026', items: 1, amt: 489, del: 40, pm: 'UPI', st: 'Confirmed', list: [['p1', 1, 449]] }); save(); }); await A.waitForTimeout(1200);
const st2 = await C.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(st2.changed.orders.some(o => o.id === 'BP-ORD-TEST-1' && o.mob === '9876543210') && st2.changed.orders.length > 1, 'customer order visible to staff, other orders untouched');
const custView = await A.request.get(BASE + '/api/sync?since=0').then(r => r.json());
ok(custView.changed.orders.length === 1 && custView.changed.orders[0].id === 'BP-ORD-TEST-1', 'customer sees only own orders ' + JSON.stringify((custView.changed.orders||[]).map(o => [o.id, o.mob])));

// ---- logout + password reset
await C.evaluate(() => logout()); await C.waitForTimeout(800); ok(await screen(C) === 'login', 'staff: logout returns to login');
ok((await C.request.get(BASE + '/cat/xref.json')).status() === 401, 'staff: catalogue locked again after logout');
await B.evaluate(() => { S.ui.ut = 'Staff'; tab('users'); }); await B.waitForTimeout(300);
await B.click('#vp .screen:last-child .li:has-text("Priya Test")'); await B.waitForTimeout(400);
ok(await B.evaluate(() => !!document.querySelector('.sheet #sp-pw') && /set a new password/i.test(document.querySelector('#vp .screen:last-child').innerText)), 'admin: Users › Staff › tap a name shows Set a new password at the top');
await B.fill('.sheet #sp-pw', '123'); await B.click('.sheet button:has-text("Save password")'); await B.waitForTimeout(300);
ok((await B.textContent('.sheet #sp-err')).includes('at least 6'), 'admin: a short password is refused');
await B.click('.sheet button:has-text("Make one")'); const newPw = await B.inputValue('.sheet #sp-pw');
await B.click('.sheet button:has-text("Save password")'); await B.waitForTimeout(800);
ok(await B.evaluate(() => (document.querySelector('.sheet h3') || {}).textContent === 'Password saved' && (document.querySelector('.sheet .kv b') || {}).textContent === S.ui.pwShow), 'admin: new password saved and shown (' + newPw.length + ' chars)');
await B.evaluate(() => closeSheet());
await C.fill('#loginId', 'priya@test.in'); await C.evaluate(() => sendOtp()); await C.waitForTimeout(500); await C.fill('#pw1', staffPw); await C.evaluate(() => pwGo()); await C.waitForTimeout(500);
ok((await C.evaluate(() => S.ui.pwErr || '')).includes('Wrong'), 'staff: old password rejected after reset');
await C.fill('#pw1', newPw); await C.evaluate(() => pwGo()); await C.waitForTimeout(600); ok(await C.evaluate(() => S.user && S.user.role === 'billing'), 'staff: new password works');

// ---- landing page iframe path (index.html loads app.html into the frame)
const cV = await b.newContext({ viewport: { width: 1280, height: 860 } }); const V = await page(cV); await V.goto(BASE + '/', { waitUntil: 'load' }); await V.waitForTimeout(800);
ok(await V.evaluate(() => document.getElementById('appv').hidden), 'landing page: a visitor sees the website first, not the login');
// a browser where the customer is logged in (Sam 2026-10-11: no landing page until log out) goes straight into the app
const L = await page(cA); await L.goto(BASE + '/', { waitUntil: 'load' }); await L.waitForTimeout(2500);
ok(await L.evaluate(() => !document.getElementById('appv').hidden && location.hash === '#login'), 'landing page: logged-in browser opens straight into the app');
const fr = L.frames().find(f => f !== L.mainFrame());
ok(!!fr && await fr.evaluate(() => typeof S !== 'undefined' && S.user && S.user.role === 'customer').catch(() => false), 'landing page: app in the frame boots from the server with the customer session');

console.log('page errors:', errs.length ? errs : 'none');
ok(errs.length === 0, 'no page errors');
await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
