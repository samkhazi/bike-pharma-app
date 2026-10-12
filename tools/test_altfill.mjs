// 2026-10-12 update 8l (Sam 08:38Z: Add product said "Not in the catalogues" for 36JG0016, "phir se waise hi aa raha he"): a number no
// catalogue has fills from its other number (oemship list: old number 36JU0138, KTM) in Add product, Stock in and Paste supplier bill;
// the part keeps the typed number.
// BASE=http://127.0.0.1:3015 node tools/test_altfill.mjs   (run_tests.sh's server, admin sam@bikepharma.com / Test@1234)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015', OUT = process.env.OUT || '/tmp/claude-0/nr';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
  const one = t => (t || '').replace(/\s+/g, ' ').slice(0, 170);
  const until = async (fn, arg) => { for (let k = 0; k < 160; k++) { const v = await p.evaluate(fn, arg); if (v) return v; await p.waitForTimeout(250); } return null; };
  // Add product: typed the way staff type it (small letters), the card fills from 36JU0138
  await p.evaluate(() => { S.ui.ap = null; go('addproduct'); });
  await p.click('#ap-pn'); await p.keyboard.type('36jg0016', { delay: 30 });
  let t = await until(() => { const c = document.querySelector('#vp .screen .inv-found'); return c ? c.innerText : null; });
  const a = await p.evaluate(() => ({ pn: S.ui.ap.pn, name: S.ui.ap.name, brand: S.ui.ap.brand, fits: S.ui.ap.fits.length }));
  ok(/Found in KTM catalogue/i.test(t) && /36JG0016 is the new number of 36JU0138/.test(t) && a.pn === '36JG0016' && a.brand === 'KTM' && a.name && a.fits > 0,
    `${tag} Add product 36jg0016: ${one(t)} | pn ${a.pn}, ${a.brand}, ${a.name}, ${a.fits} bikes`);
  ok(!(await p.evaluate(() => /Not in the catalogues/i.test(document.querySelector('#vp .screen').innerText))), `${tag} Add product 36JG0016: no "Not in the catalogues"`);
  if (tag === 'computer') await p.screenshot({ path: OUT + '/altfill-addproduct.png' });
  // the old number itself: found as before, no "new number" line
  await p.evaluate(() => { S.ui.ap = null; go('addproduct'); S.ui.ap.pn = '36JU0138'; apLookNow(); });
  t = await until(() => { const c = document.querySelector('#vp .screen .inv-found'); return c ? c.innerText : null; });
  ok(/Found in KTM catalogue/i.test(t) && !/new number/.test(t) && await p.evaluate(() => S.ui.ap.pn === '36JU0138'), `${tag} Add product 36JU0138 (in the catalogue): ${one(t)}`);
  // a number nobody has: still "Not in the catalogues"
  await p.evaluate(() => { S.ui.ap = null; go('addproduct'); S.ui.ap.pn = 'ZQ90817264'; apLookNow(); });
  t = await until(() => { const c = document.querySelector('#vp .screen .inv-none'); return c ? c.innerText : null; });
  ok(/Not in the catalogues/i.test(t || ''), `${tag} Add product ZQ90817264 (no catalogue, no list): ${one(t)}`);
  // Stock in: the code box makes a KTM new-part line with the typed number; a second scan adds +1
  await p.evaluate(() => { S.ui.ap = null; const g = geState('new'); S.ui.ge = g; go('grnedit', { id: g.id }); geCode('36JG0016'); });
  let nw = await until(() => S.ui.ge && S.ui.ge.nw && S.ui.ge.nw[0] ? S.ui.ge.nw.map(n => ({ pn: n.pn, vb: n.vb, name: n.name, q: n.q, via: n.via && n.via.alt })) : null);
  await p.evaluate(() => geCode('36JG0016')); await p.waitForTimeout(400);
  const q2 = await p.evaluate(() => S.ui.ge.nw.length === 1 ? S.ui.ge.nw[0].q : -S.ui.ge.nw.length);
  t = await p.evaluate(() => { const c = document.querySelector('#vp .screen .inv-pan'); return c ? c.innerText : ''; });
  ok(nw && nw.length === 1 && nw[0].pn === '36JG0016' && nw[0].vb === 'KTM' && nw[0].via === '36JU0138' && q2 === 2 && /new number of 36JU0138/.test(t),
    `${tag} Stock in 36JG0016: ${JSON.stringify(nw)}, second scan qty ${q2} | ${one(t)}`);
  // Paste supplier bill
  await p.evaluate(() => { S.ui.ip = { txt: '36JG0016 2 900', pick: {} }; go('invpaste'); });
  t = await until(() => { const x = document.querySelector('#vp .screen .inv-cl'); return x && !/Checking/.test(x.innerText) ? x.innerText : null; });
  ok(/same part as 36JU0138/.test(t || '') && /KTM catalogue/.test(t || ''), `${tag} Paste supplier bill 36JG0016: ${one(t)}`);
  if (tag === 'phone') await p.screenshot({ path: OUT + '/altfill-paste-phone.png' });
  ok(errs.length === 0, `${tag} no page errors ` + errs.slice(0, 2).join(' | '));
  await p.context().close();
}
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
