// 2026-10-12 update 8k (Sam 08:05Z "har search bar me search hona he koi bhi part number daalun agar o hamre server pe he toh show hona he",
// 08:15Z customers see only our stock, 08:18Z "mere staff ko poore cataogues show hone hein"): a part number in a staff search bar shows the
// brand catalogues' card; the bill's item box takes a part number; customers never get the card.
// BASE=http://127.0.0.1:3015 node tools/test_fphit.mjs   (a server with test_shop.mjs's products and the admin sam@bikepharma.com / Test@1234)
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
  const card = async () => { for (let k = 0; k < 160; k++) { const t = await p.evaluate(() => { const c = document.querySelector('#vp .screen .fp-hit'); return c ? (c.dataset.wait ? 'wait' : c.innerText) : null; }); if (t && t !== 'wait') return t; await p.waitForTimeout(250); } return null; };
  const one = t => (t || '').replace(/\s+/g, ' ').slice(0, 150);
  // Universal search (typed in its own bar)
  await p.evaluate(() => { S.ui.sq = '36JG0016'; tab('usearch'); }); let t = await card();
  ok(/Brand catalogues/.test(t) && /36JU0138/.test(t) && /Kit Piston Ring/i.test(t) && /new number/.test(t), `${tag} Universal search 36JG0016: ${one(t)}`);
  await p.evaluate(() => { S.ui.sq = 'clutch plate'; refresh(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('#vp .screen .us-fp') && !document.querySelector('#vp .screen .fp-hit')), `${tag} Universal search "clutch plate": Find Part button, no card`);
  // Stock & racks
  await p.evaluate(() => { S.ui.rq = 'JP181701'; go('racks'); }); t = await card();
  ok(/Spoiler Tank Inner/i.test(t) && /JP181701/.test(t), `${tag} Stock & racks JP181701 (not in our stock): ${one(t)}`);
  await p.evaluate(() => { S.ui.rq = 'clutch plate'; refresh(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /Search “clutch plate” in all brand catalogues/.test(document.querySelector('#vp .screen').innerText)), `${tag} Stock & racks "clutch plate": Search in all brand catalogues button`);
  // typing keeps the cursor in the bar while the card fills in
  await p.evaluate(() => { S.ui.rq = ''; refresh(); }); await p.click('#rq'); await p.keyboard.type('36DH4194', { delay: 40 }); t = await card();
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'rq' && document.activeElement.value === '36DH4194') && /36PD0050|36DH4194/.test(t), `${tag} typing 36DH4194 in Stock & racks: card fills, cursor stays in the bar | ${one(t)}`);
  // Warranty check
  await p.evaluate(() => { S.ui.wq = 'JP181701'; go('warreg'); }); t = await card();
  ok(/JP181701/.test(t), `${tag} Warranty check JP181701: card shows the catalogue part`);
  // Scan to find: not in our stock
  await p.evaluate(() => { go('scanfind'); doScan('36JG0016'); }); t = await card();
  ok(/36JU0138/.test(t) && await p.evaluate(() => /No part found for “36JG0016”/.test(document.querySelector('#vp .screen').innerText)), `${tag} Scan to find 36JG0016: not in stock + catalogue card`);
  if (tag === 'phone') await p.screenshot({ path: OUT + '/fphit-phone.png' });
  // customers and mechanics: never
  ok(await p.evaluate(() => { const r = S.user.role; const o = []; for (const k of ['customer', 'mechanic']) { S.user.role = k; o.push(fpHit('36JU0138'), fpHit('clutch plate', 1)); } S.user.role = r; return o.every(h => h === ''); }), `${tag} customer and mechanic: no catalogue card, no catalogue button`);
  ok(errs.length === 0, `${tag} no page errors ` + errs.slice(0, 2).join(' | '));
  await p.context().close();
}
// the bill (billing staff; run_tests.sh's shop has priya@test.in): a part number we stock goes on the bill, one we do not stock shows the card
{ const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const tag = 'billing phone';
  // Admin gives the billing login a known password first (the suite before may have changed it)
  const a = await p.context().browser().newContext().then(c => c.newPage()); await a.goto(BASE + '/app.html', { waitUntil: 'load' });
  await a.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await a.fill('#loginId', 'sam@bikepharma.com'); await a.evaluate(() => sendOtp()); await a.waitForTimeout(500);
  await a.fill('#pw1', 'Test@1234'); await a.evaluate(() => pwGo()); await a.waitForTimeout(900);
  ok((await a.evaluate(() => srvSetPw('priya@test.in', 'priya123'))) === '', 'Admin sets the billing login password'); await a.context().close();
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'priya@test.in'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', process.env.STAFF_PW || 'priya123'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
  ok(await p.evaluate(() => S.user && S.user.role === 'billing'), 'billing staff logged in');
  const card = async () => { for (let k = 0; k < 160; k++) { const t = await p.evaluate(() => { const c = document.querySelector('#vp .screen .fp-hit'); return c ? (c.dataset.wait ? 'wait' : c.innerText) : null; }); if (t && t !== 'wait') return t; await p.waitForTimeout(250); } return null; };
  let t;
  // the bill: a part number we stock goes on the bill; one we do not stock shows the card
  const x = await p.evaluate(() => { const x = PRODUCTS.find(p => p.pn && DB.stock[p.id] > 0 && /\d{3}/.test(p.pn)); return x && { id: x.id, pn: x.pn }; });
  await p.evaluate(() => { S.ui.inv = null; go('invoice'); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const i = document.getElementById('inv-bc'); return i && i.placeholder === 'Barcode or part number' && i.getAttribute('inputmode') !== 'numeric'; }), `${tag} bill: item box says Barcode or part number, letters allowed`);
  if (x) { await p.evaluate(pn => invAddCode(pn.toLowerCase()), x.pn); await p.waitForTimeout(300);
    ok(await p.evaluate(id => (S.ui.inv.items[id] || 0) === 1 && !S.ui.inv.bcErr, x.id), `${tag} bill: part number ${x.pn} (typed in small letters) adds our stocked part`); }
  else ok(false, 'no stocked product with a part number in this test shop');
  await p.evaluate(() => invAddCode('36JU0138')); t = await card();
  ok(/No product in our stock with barcode or part number 36JU0138/.test(await p.evaluate(() => document.querySelector('#vp .screen').innerText)) && /Kit Piston Ring/i.test(t), `${tag} bill: 36JU0138 (not stocked) says so and shows the catalogue card`);
  await p.screenshot({ path: OUT + '/fphit-bill.png' });
  ok(errs.length === 0, `${tag} no page errors ` + errs.slice(0, 2).join(' | '));
  await p.context().close(); }
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
