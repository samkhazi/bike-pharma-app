// update 8u (Sam 2026-10-15 11:26Z, Mittal's Year list "2023 · BS VI / 2018 · BS IV / 2014 · DTS-i"; plan OK'd 11:40Z): the Year select lists
// the model's catalogue versions; every model has a list and every line has parts; the chosen line stays through sections, a section
// and Specific part lookup.   BASE4=http://127.0.0.1:3018 node tools/test_fpver.mjs
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
  await p.evaluate(() => go('findpart')); await p.waitForTimeout(500);
  const S_ = l => `.m2-veh select[aria-label="${l}"]`;
  const opts = l => p.evaluate(s => { const x = document.querySelector(s); return { v: x.value, o: [...x.options].map(o => o.value) }; }, S_(l));
  const pick = async (l, v) => { await p.selectOption(S_(l), v); await p.waitForTimeout(300); };
  const waitYears = () => p.waitForFunction(s => !/Loading years/.test(document.querySelector(s).innerText), S_('Year'), { timeout: 60000 }).catch(() => {});
  if (tag === 'computer') {
    await p.evaluate(() => { CAT_ALL.filter(e => M2_CNT[e.vb]).forEach(e => { if (!CAT_EXT.includes(e)) CAT_EXT.push(e); }); catLoad(); });
    await p.waitForFunction(() => !catPend().length, null, { timeout: 180000 });
    const r = await p.evaluate(() => { let n = 0; const bad = [];
      Object.keys(M2_CNT).forEach(vb => (BRANDS_V[vb] || []).forEach(vm => { n++; const V = fpVers(vb, vm); if (V === 'wait' || !V.length) { bad.push(vb + ' ' + vm); return; }
        V.forEach(g => { const sc = catScope(m2A({ vb, vm, ed: g.lab })); if (!sc || sc.loading || !sc.rows.length) bad.push(vb + ' ' + vm + ' [' + g.lab + ']'); }); }));
      return { n, bad }; });
    ok(r.n > 300 && !r.bad.length, `every model (${r.n}) has a Year list and every line opens parts ${r.bad.slice(0, 5).join(', ')}`);
  }
  // Bajaj Pulsar 150: like Mittal, version lines with the norm
  await pick('Brand', 'Bajaj'); await p.waitForTimeout(1500); await pick('Model', 'Pulsar 150'); await waitYears();
  let yr = await opts('Year');
  ok(['2026 · BS VI', '2025 · BS VI', '2020 · BS IV', '2016 · BS III'].every(x => yr.o.includes(x)) && yr.v === 'Any', `${tag}: Pulsar 150 Year: ${yr.o.join(' | ')}`);
  await pick('Year', '2020 · BS IV'); await p.evaluate(() => m2Go()); await p.waitForTimeout(900);
  const sec = await p.evaluate(() => { const c = cur().p; const all = m2Secs(catScope(m2A({ vb: c.vb, vm: c.vm })).rows).length; return { v: c.v, ed: c.ed, n: m2Secs(catScope(m2A(c)).rows).length, all, t: document.querySelector('.m2').innerText.slice(0, 80) }; });
  ok(sec.v === 'secs' && sec.ed === '2020 · BS IV' && sec.n > 0 && sec.n < sec.all && /2020 · BS IV/.test(sec.t), `${tag}: Search parts opens only 2020 · BS IV: ${sec.n} of ${sec.all} sections ("${sec.t.split('\n')[0]}")`);
  await p.evaluate(() => m2Sec(m2Secs(catScope(m2A(cur().p)).rows)[0].pg)); await p.waitForTimeout(600);
  ok(await p.evaluate(() => cur().p.v === 'sec' && cur().p.ed === '2020 · BS IV'), `${tag}: a section keeps 2020 · BS IV`);
  await p.evaluate(() => back()); await p.waitForTimeout(500);
  await p.evaluate(() => { const i = document.getElementById('fp-q'); if (i) i.value = 'brake shoe'; S.ui.fp.q = 'brake shoe'; fpSearchRaw(); }); await p.waitForTimeout(900);
  const lk = await p.evaluate(() => { const c = cur().p, R = m2Res(c); return { v: c.v, ed: c.ed, n: R.list.length, bad: R.list.filter(r => r.norms && r.norms.length && !r.norms.includes('BS4')).length }; });
  ok(lk.v === 'res' && lk.ed === '2020 · BS IV' && lk.n > 0 && !lk.bad, `${tag}: Specific part lookup "brake shoe" stays in 2020 · BS IV (${lk.n} parts, ${lk.bad} of other norms)`);
  // a model with no years in its books: version names (old Royal Enfield)
  await p.evaluate(() => go('findpart')); await p.waitForTimeout(400);
  await pick('Brand', 'Royal Enfield'); await p.waitForTimeout(1500); await pick('Model', 'Classic 350 (old)'); await waitYears();
  yr = await opts('Year');
  ok(yr.o.includes('Classic 350 ABS · BS IV') && yr.o.includes('Classic 350 · BS III'), `${tag}: Classic 350 (old) Year: ${yr.o.join(' | ')}`);
  // one version only: picked for you (Bajaj Avenger 180 · DTS-i)
  await pick('Brand', 'Bajaj'); await p.waitForTimeout(800); await pick('Model', 'Avenger 180'); await waitYears();
  yr = await opts('Year'); ok(yr.o.join() === 'DTS-i' && yr.v === 'DTS-i', `${tag}: Avenger 180: its one version DTS-i, picked`);
  // a new model clears the line
  await pick('Model', 'Pulsar 150'); await waitYears(); yr = await opts('Year'); ok(yr.v === 'Any', `${tag}: another model starts with All years`);
  if (tag === 'phone') { await pick('Year', '2020 · BS IV'); await p.screenshot({ path: '/tmp/claude-0/fpver-phone.png' }); }
  ok(errs.length === 0, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`);
  await p.context().close();
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
