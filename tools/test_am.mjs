// 2026-10-15 update 8x, Sam: an original part number shows its aftermarket number ("accurate"), the original catalogue's part page
// shows it too, and Add product fills from an aftermarket number.  BASE4=http://127.0.0.1:3018 node tools/test_am.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
  const txt = () => p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
  // 1. the original number searched: its aftermarket part, marked exact
  await p.evaluate(() => amGo('DU201118'));
  await p.waitForFunction(() => AM_ST === 2, null, { timeout: 20000 }); await p.waitForTimeout(3000);
  let t = await txt();
  ok(/Aftermarket part for DU201118/.test(t) && /MotherSon · WH-BA01B/.test(t) && /Exact match/i.test(t), `${tag}: search DU201118 (Bajaj) shows MotherSon WH-BA01B, exact`);
  // 2. the aftermarket number searched: its part, MRP and the original number it is for
  await p.evaluate(() => amGo('WH-BA01B')); await p.waitForTimeout(3000); t = await txt();
  ok(/Aftermarket/i.test(t) && /MotherSon catalogue/i.test(t) && /DU201118/.test(t) && /MRP/.test(t), `${tag}: search WH-BA01B shows the MotherSon part, MRP and original DU201118`);
  // 3. the original catalogue's part page
  await p.evaluate(() => { catLoad('Bajaj'); });
  await p.waitForFunction(() => CAT_ALL.some(e => e.vb === 'Bajaj' && e.st === 2), null, { timeout: 60000 });
  await p.evaluate(() => { const r = catPkRows('Bajaj', 'DU201118')[0]; m2Part(r.i); }); await p.waitForTimeout(1500); t = await txt();
  ok(/Aftermarket part for this number/.test(t) && /WH-BA01B/.test(t), `${tag}: Bajaj DU201118 part page shows the aftermarket part`);
  // 4. same bike, same kind (no number printed): a Pulsar 150 clutch cable
  const pc = await p.evaluate(() => { const r = catRows().find(r => r.vb === 'Bajaj' && r.kind === 'd' && r.pk && /CABLE.*CLUTCH|CLUTCH.*CABLE/.test(String(r.desc).toUpperCase()) && m2FitL(r).some(m => /^Pulsar 150\b/.test(m)));
    if (!r) return null; m2Part(r.i); return r.part; });
  await p.waitForTimeout(1500); t = await txt();
  ok(pc && /Aftermarket for the same bike \(check\)/.test(t) && /Suprajit|Endurance|ASK/.test(t), `${tag}: Pulsar 150 clutch cable ${pc} lists aftermarket clutch cables for the bike`);
  // 5. Add product from an aftermarket number
  await p.evaluate(() => amAdd('520AM02069')); await p.waitForFunction(() => S.ui.ap && S.ui.ap.hit, null, { timeout: 60000 }).catch(() => {}); t = await txt();
  const a = await p.evaluate(() => ({ ...S.ui.ap, photos: S.ui.ap.photos.length }));
  ok(/Found in Endurance aftermarket catalogue/i.test(t) && a.type === 'Aftermarket' && a.pack === 'Endurance' && +a.mrp > 0 && a.fits.length > 0, `${tag}: Add product 520AM02069: Endurance, MRP ${a.mrp}, fits ${a.fits.join(', ')}`);
  ok(/photo/i.test(t), `${tag}: Add product asks for the photo`);
  if (tag === 'phone') await p.screenshot({ path: '/tmp/claude-0/am-phone.png' });
  ok(errs.length === 0, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`);
  await p.context().close();
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
