// 2026-10-15 Suzuki Intruder 150 (Sam: "year me kuch bhi option nhi aata", wants an Intruder bearing): Year lists 2018-2021, the GL150
// bearing shows, and results offer the same search in the Gixxer (same engine).  BASE4=http://127.0.0.1:3018 node tools/test_szfix.mjs
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
  await p.selectOption(S_('Brand'), 'Suzuki'); await p.waitForTimeout(1500);
  await p.selectOption(S_('Model'), 'Intruder 150');
  await p.waitForFunction(s => !/Loading years/.test(document.querySelector(s).innerText), S_('Year'), { timeout: 30000 }).catch(() => {});
  const yr = await opts('Year'), cc = await opts('Engine (cc)');
  ok(['2021', '2020', '2019', '2018'].every(y => yr.o.includes(y)), `${tag}: Intruder 150 Year lists ${yr.o.join(' ')}`);
  ok(cc.v === '155', `${tag}: Engine 155 cc (Suzuki's 154.9 cc)`);
  await p.selectOption(S_('Year'), '2019'); await p.waitForTimeout(300);
  await p.evaluate(() => go('findpart', { v: 'res', q: 'bearing', vb: 'Suzuki', vm: 'Intruder 150', yr: '2019', bs: 'Any', sort: 'best', n: 30 }));
  await p.waitForTimeout(1500);
  const t = await p.evaluate(() => document.querySelector('.m2').innerText);
  ok(/09262-12039/.test(t), `${tag}: bearing search in Intruder 150 2019 finds 09262-12039 BEARING (12X28X8)`);
  ok(/bearing in Suzuki Gixxer/i.test(t), `${tag}: results offer "bearing in Suzuki Gixxer" (same engine)`);
  await p.evaluate(() => [...document.querySelectorAll('.m2 button.chip')].find(x => /in Suzuki Gixxer$/.test(x.innerText)).click());
  await p.waitForTimeout(1500);
  const n = await p.evaluate(() => (cur().p || {}).vm + ' ' + (document.querySelector('.m2').innerText.match(/bearing/gi) || []).length);
  ok(/^Gixxer [1-9]/.test(n), `${tag}: tapping it opens the Gixxer bearings (${n})`);
  // Any brand: every brand's catalogue, every match (Sam 11:12Z "jitne bhi bearing hote hein sabhi show hona he", all brands)
  await p.evaluate(() => go('findpart', { v: 'res', q: 'bearing', vb: 'Any', vm: 'Any', yr: 'Any', bs: 'Any', sort: 'best', n: 30 }));
  await p.waitForFunction(() => !catPend().length && CAT_EXT.length >= 9, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(800);
  const any = await p.evaluate(() => { const R = m2Res(cur().p); return { n: R.list.length, b: [...new Set(R.list.map(r => r.vb))].sort().join(' ') }; });
  ok(any.n > 1000 && ['Bajaj', 'Hero', 'Honda', 'KTM', 'Royal Enfield', 'Suzuki', 'TVS', 'Yamaha'].every(x => any.b.includes(x)), `${tag}: Any brand "bearing": ${any.n} parts from ${any.b}`);
  if (tag === 'phone') await p.screenshot({ path: '/tmp/claude-0/szfix-phone.png', fullPage: false });
  ok(errs.length === 0, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`);
  await p.context().close();
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
