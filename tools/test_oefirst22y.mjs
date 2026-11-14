// 22y: original (catalogue) parts come before the aftermarket parts on the results page; "chain ki sprocket" is a chain sprocket kit ask.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html'); await p.waitForSelector('#bpOpen', { state: 'detached', timeout: 9000 }).catch(() => {});
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForSelector('#pw1'); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForFunction(() => S.user); await p.waitForTimeout(500);
for (const [q, want] of [['chain ki sprocket', 1], ['chain aur sprocket', 1], ['chain sprocket ka kit', 1], ['Kit chain sprocket', 1], ['cam chain ki sprocket', 0], ['chain ki', 0]])
  ok(await p.evaluate(q => catKitQ(catNorm(q)), q) === !!want, JSON.stringify(q) + (want ? ' is' : ' is not') + ' a chain sprocket kit ask');
const run = async (q, vm) => { await p.evaluate(([q, vm]) => { reset('findpart'); go('findpart', { v: 'res', q, vb: vm ? 'Bajaj' : 'Any', vm: vm || 'Any', yr: 'Any', bs: 'Any', sort: 'best', n: 30 }); }, [q, vm]); await p.waitForTimeout(4000);
  return p.evaluate(() => { const t = document.querySelector('#vp .screen:last-child'), y = e => e ? e.getBoundingClientRect().top : null; const h = [...t.querySelectorAll('h3')].find(x => /Aftermarket parts/.test(x.textContent));
    const tb = t.querySelector('table,.fp-tb,.m2-tb') || [...t.querySelectorAll('*')].find(x => /^Part name/.test(x.textContent.trim()) && x.children.length < 8); return { am: y(h), oe: y(tb), low: !!document.getElementById('amLow'), jump: /aftermarket parts? below/.test(t.innerText), txt: t.innerText.replace(/\s+/g, ' ').slice(0, 260) }; }); };
for (const q of process.argv.slice(2).length ? process.argv.slice(2) : ['cable', 'cover', 'washer']) { const r = await run(q); console.log(q, JSON.stringify(r));
  if (r.am !== null && r.oe !== null) ok(r.oe < r.am && r.low && r.jump, q + ': original parts are above the aftermarket parts, with the line on top'); else console.log('  (not both kinds here)'); }
ok(!errs.length, 'no page errors ' + errs.join(';')); await b.close(); process.exit(fails ? 1 : 0);
