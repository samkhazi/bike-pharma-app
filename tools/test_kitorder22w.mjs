// 22w: "kit chain sprocket" (any word order) finds the catalogue's drive chain and sprockets like "chain sprocket kit" does.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html'); await p.waitForSelector('#bpOpen', { state: 'detached', timeout: 9000 }).catch(() => {});
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1'); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.waitForTimeout(500);
for (const [q, want] of [['chain sprocket kit', 1], ['Kit chain sprocket', 1], ['sprocket chain set', 1], ['chain n sprocket full kit', 1], ['kit sprocket', 1], ['cam chain kit', 0], ['chain lock', 0], ['kit gasket', 0]])
  ok(await p.evaluate(q => catKitQ(catNorm(q)), q) === !!want, JSON.stringify(q) + (want ? ' is' : ' is not') + ' a chain sprocket kit ask');
const run = async q => { await p.evaluate(q => { reset('findpart'); go('findpart', { v: 'res', q, vb: 'Bajaj', vm: window.__vm, yr: 'Any', bs: 'Any', sort: 'best', n: 30 }); }, q); await p.waitForTimeout(3500); return (await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText)).replace(/\s+/g, ' '); };
await p.evaluate(async () => { reset('findpart'); });
const vm = await p.evaluate(async () => { const e = CAT_ALL.find(e => e.vb === 'Bajaj'); if (!e) return window.__vm = ''; catAsk(e); for (let i = 0; i < 80 && e.st !== 2; i++) await new Promise(r => setTimeout(r, 250)); const ms = (e.d && e.d.models || []).map(m => m.name || m.n || m); return window.__vm = ms.find(m => /pulsar 150/i.test(m)) || ms[0] || ''; });
console.log('model:', vm);
if (vm) { const A = await run('chain sprocket kit'), B = await run('Kit chain sprocket'); const n = t => (t.match(/(\d+) parts? for/) || [])[1]; console.log(A.slice(0, 200), '\n', B.slice(0, 200));
  if (!n(A) || n(A) === '0') console.log('NOTE: the local test catalogue has no drive chain rows for this model, so only the word check ran'); ok(n(B) === n(A), 'Kit chain sprocket gives the same count as chain sprocket kit: ' + n(B)); }
else console.log('SKIP: no Bajaj chain rows in the local data');
ok(!errs.length, 'no page errors ' + errs.join(';')); await b.close(); process.exit(fails ? 1 : 0);
