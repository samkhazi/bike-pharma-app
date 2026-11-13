// 22a: with a split catalogue (lines sent as needed) an old number must show its New part no. Needs a server on 3033 with CAT_SPLIT on and
// a Bajaj test catalogue where JG511021 says "Old no. JG511000" and JG511000 has its own line with no remark.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }), p = await b.newPage();
await p.goto('http://127.0.0.1:3033/app.html'); await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1');
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.evaluate(() => reset(HOME[S.user.role]));
const card = async q => { await p.evaluate(() => go('findpart')); await p.waitForSelector('#fp-q'); await p.fill('#fp-q', q); await p.evaluate(() => fpGo());
  await p.waitForFunction(q => { const e = document.querySelector('.fp-pn .fp-pn-no'); return e && e.textContent.replace(/\W/g, '') === q; }, q, { timeout: 15000 });
  await p.waitForTimeout(800); return p.evaluate(() => [...document.querySelectorAll('.fp-pn .fp-tile')].map(e => e.innerText.replace(/\s+/g, ' ').trim())); };
ok(await p.evaluate(() => !!CAT_ALL.find(e => e.vb === 'Bajaj')), 'Bajaj catalogue listed');
const o = await card('JG511000'); console.log(o.join(' | ')); ok(await p.evaluate(() => !!CAT_ALL.find(e => e.vb === 'Bajaj').d.split), 'catalogue is split');
ok(/new part no\. JG511021/i.test(o[0]), 'old number shows its new number'); ok(!/JG511021/.test(o[1]), 'not shown as old');
const n = await card('JG511021'); console.log(n.join(' | ')); ok(/this is the latest/i.test(n[0]) && /JG511000/.test(n[1]), 'new number shows the old one, itself latest');
await b.close(); process.exit(fails ? 1 : 0);
