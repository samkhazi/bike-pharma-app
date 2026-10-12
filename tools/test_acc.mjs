// Update 8p (Sam 2026-10-12, thread "Accountant profile"): a new staff role, Accountant: supplier payments and advances, due alerts,
// udhaar, cash book, expenses, GST report, khata, salary & advance, refunds, cheques, cash handover, P&L (Admin), Tally / Zoho export,
// bank statement match and WhatsApp udhaar reminders. Runs after test_mgr.mjs on the same server (it uses that stock in and orders).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE3 || 'http://127.0.0.1:3017';
const ADMIN = 'sam@bikepharma.com', PW = 'Test@1234';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function mk(w, h) { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(w + ' console: ' + m.text()); }); return p; }
async function login(p, id, pw) {
  await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(400);
  await p.fill('#loginId', id); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500); await p.fill('#pw1', pw); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
}
const T = p => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
const SC = '#vp .screen:last-child';

const Ad = await mk(1440, 900); await login(Ad, ADMIN, PW);
await Ad.evaluate(() => { S.ui.ns = null; go('newstaff'); S.ui.ns.role = 'Accountant'; refresh(); }); await Ad.waitForTimeout(300);
ok(/Accountant/.test(await T(Ad)), 'new staff login offers the Accountant role');
await Ad.fill('#ns1', 'Asha Accounts'); await Ad.fill('#ns2', 'asha@test.in'); await Ad.fill('#ns3', 'asha1234'); await Ad.click(SC + ' .foot .btn'); await Ad.waitForTimeout(900); await Ad.evaluate(() => closeSheet());
ok(await Ad.evaluate(() => DB.accounts['asha@test.in'] && DB.accounts['asha@test.in'].role === 'accountant' && /-ACC-/.test(DB.accounts['asha@test.in'].sid)), 'admin made an Accountant login');
await Ad.waitForTimeout(2500);

const A = await mk(390, 844); await login(A, 'asha@test.in', 'asha1234');
ok(await A.evaluate(() => S.user && S.user.role === 'accountant' && HOME.accountant === 'achome'), 'accountant logged in');
await A.evaluate(() => tab('achome')); await A.waitForTimeout(300);
let t = await T(A);
ok(/We owe suppliers/.test(t) && /Mechanic udhaar/.test(t) && /Cash today/.test(t) && /GST report/.test(t) && /Export for CA/.test(t), 'accountant home tiles and links');
ok(await A.evaluate(() => !allowed('invoice') && !allowed('mgmargin') && !allowed('grnedit') && !allowed('masterprice') && !allowed('acpl') && allowed('supdue') && allowed('mechdues') && allowed('dayclose')), 'no billing, margin, stock edit, pricing or P&L; supplier bills, udhaar, day closing open');
// a test bill (UPI) to see in the cash book, GST and Tally
await A.evaluate(() => { const p = PRODUCTS[0]; DB.bills.unshift({ id: 'INV-T-1', kind: 'walk', p: 'Walk-in', t: '10:00 AM', iso: isoToday(), pm: 'UPI', amt: 1180, items: [{ pid: p.id, q: 1, r: 1180, mrp: 1180 }] }); });
// 1. supplier bill: rates visible, pay part
const g = await A.evaluate(() => { const g = DB.grns.find(x => x.inv === 'TS-1'); return g && { id: g.id, bal: bpBal(g) }; });
ok(g && g.bal === 360, 'the Manager stock in (rates by Admin) is ₹360 to pay ' + JSON.stringify(g));
await A.evaluate(id => go('grnview', { id }), g.id); await A.waitForTimeout(300); t = await T(A);
ok(/360/.test(t), 'accountant sees the bill amount');
await A.evaluate(id => supPaySheet(id), g.id); await A.fill('#spy-a', '100'); await A.evaluate(id => supPaySave(id), g.id); await A.waitForTimeout(200);
// advance on an order
const po = await A.evaluate(() => (acPOs()[0] || {}).id); ok(!!po, 'approved purchase orders listed ' + po);
await A.evaluate(id => acAdvSheet(id), po); await A.fill('#adv-a', '50'); await A.evaluate(id => acAdvSave(id), po); await A.waitForTimeout(200);
ok(await A.evaluate(() => supOut(sups().find(s => s.n === 'Test Supplier')) === 210), 'supplier balance after ₹100 paid and ₹50 advance: ₹210');
await A.evaluate(() => go('acledger', { n: 'Test Supplier' })); await A.waitForTimeout(200); t = await T(A);
ok(/Khata/.test(t) && /Advance/.test(t) && /210/.test(t), 'supplier khata shows bill, payment, advance, balance ₹210');
// 5. expense
await A.evaluate(() => { tab('achome'); acExpAdd(); }); await A.fill('#ex-a', '500'); await A.fill('#ex-n', 'Tea'); await A.evaluate(() => acExpSave()); await A.waitForTimeout(200);
ok(await A.evaluate(() => DB.exp[0].a === 500 && DB.exp[0].iso === isoToday()), 'expense saved');
// 9. salary
const k = 'asha@test.in';
await A.evaluate(k => { acSalSet(k); }, k); await A.fill('#sl-a', '20000'); await A.evaluate(k => acSalSetOk(k), k);
await A.evaluate(k => acAdvGive(k), k); await A.fill('#sa-a', '3000'); await A.evaluate(k => acAdvGiveOk(k), k);
await A.evaluate(k => { acSalPay(k); acSalPayOk(k); }, k); await A.waitForTimeout(200);
ok(await A.evaluate(() => DB.salPay[0].net === 17000 && DB.salPay[0].adv === 3000), 'salary paid ₹17,000 after ₹3,000 advance cut');
// 7. cash book
await A.evaluate(() => { S.ui.cbd = null; go('accash'); }); await A.waitForTimeout(200); t = await T(A);
ok(/INV-T-1/.test(t) && /Supplier bill/.test(t) && /Advance/.test(t) && /Expense · Rent/.test(t) && /Salary advance/.test(t) && /17,000/.test(t), 'cash book: bill in, supplier payment, advance, expense, salary out');
ok(await A.evaluate(() => acBook(isoToday()).filter(x => x.t === 'Expense · Salaries').length === 0 && acBook(isoToday()).filter(x => /^Salary · /.test(x.t)).length === 1), 'salary not counted twice in the cash book');
// 6. GST + 14. export
await A.evaluate(() => go('acgst')); await A.waitForTimeout(200); t = await T(A);
const gl = await A.evaluate(() => JSON.stringify(acGstLines(acMon(isoToday())).filter(x => x.b.id === 'INV-T-1').map(x => [x.tot, x.tax, x.rt])));
ok(/GST on sales/i.test(t) && gl === '[[1180,180,18]]', 'GST report: ₹180 GST on the ₹1,180 bill at 18% ' + gl);
const own = await A.evaluate(() => { const b = DB.bills.find(x => x.id === 'INV-T-1'), p = P(b.items[0].pid), old = p.gst; bpSetP(p, { gst: '28' }); const r = acGstLines(acMon(isoToday())).find(x => x.b.id === 'INV-T-1'); bpSetP(P(b.items[0].pid), { gst: old || '' }); return r && r.rt; });
ok(own === 28, 'a part with its own GST % (28) uses it, not the 18% default: ' + own);
const tx = await A.evaluate(() => acTally(acMon(isoToday())));
ok(/<VOUCHER VCHTYPE="Sales"/.test(tx) && /Output CGST @9%/.test(tx) && /<VOUCHER VCHTYPE="Payment"/.test(tx) && /<VOUCHER VCHTYPE="Purchase"/.test(tx), 'Tally XML has sales, purchase and payment vouchers');
ok(await A.evaluate(() => { const r = acZoho(acMon(isoToday()), 'inv'); return r.length > 1 && r[0][0] === 'Invoice Date'; }), 'Zoho Books invoices CSV');
await A.evaluate(() => go('acexport')); await A.waitForTimeout(200); ok(/Tally/.test(await T(A)) && /Zoho Books/.test(await T(A)), 'export page: Tally and Zoho Books');
// 11. cheque
await A.evaluate(() => { go('accheq'); acChqAdd(); }); await A.fill('#cq-p', 'Ravi'); await A.fill('#cq-n', '123456'); await A.fill('#cq-a', '5000'); await A.evaluate(() => { acChqSave(); acChqSt(0, 'Cleared'); });
ok(await A.evaluate(() => DB.cheq[0].st === 'Cleared'), 'cheque added and cleared');
// 15. bank statement
const st = 'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance\n' + (await A.evaluate(() => { const d = isoToday().split('-'); return d[2] + '/' + d[1] + '/' + d[0]; })) + ',UPI/123/CUSTOMER,,1180.00,5000\n' + (await A.evaluate(() => { const d = isoToday().split('-'); return d[2] + '/' + d[1] + '/' + d[0]; })) + ',NEFT/XYZ,,999.00,5999\n';
await A.evaluate(st => { const L = acBkParse(st); DB.bankRec = acBkMatch(L); go('acbank'); }, st); await A.waitForTimeout(200); t = await T(A);
ok(/1 of 2/.test(t) && /NEFT\/XYZ/.test(t), 'bank statement: UPI bill matched, unknown NEFT listed');
// 12. handover, 10. refunds, 16. reminders render
await A.evaluate(() => go('dayclose')); await A.waitForTimeout(200); ok(/Cash handover to Accountant/.test(await T(A)), 'day closing shows the cash handover');
for (const s of ['acref', 'acremind', 'acpo', 'acsal', 'acexp', 'asupp', 'supdue', 'mechdues']) { await A.evaluate(s => go(s), s); await A.waitForTimeout(120); }
ok(true, 'refunds, reminders, orders, salary, expenses, suppliers, dues pages open');
await A.waitForTimeout(2500);
// Admin: P&L and Accounts
await Ad.reload(); await Ad.waitForFunction(() => typeof S !== 'undefined' && S.user, null, { timeout: 15000 }); await Ad.waitForTimeout(800);
await Ad.evaluate(() => go('acpl')); await Ad.waitForTimeout(200); t = await T(Ad);
ok(/Profit & loss/.test(t) && /Expenses/.test(t), 'admin opens Profit & loss');
ok(await Ad.evaluate(() => (DB.exp || []).some(x => x.n === 'Tea') && (DB.supAdv || []).length === 1), 'admin sees the accountant\'s entries (synced)');
ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
