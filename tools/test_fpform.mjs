// 2026-10-12 Find Part > Search by vehicle (Sam: "Engine (CC) me automatic aana he selected models ke kounse kounse CC ke vahicels hein", "year bhi
// same aise hi"): after a model is picked, Engine (cc) lists only that model's cc and Year only that model's years (picked when there is one).
// BASE4=http://127.0.0.1:3018 node tools/test_fpform.mjs   (any server with the admin login sam@bikepharma.com / Test@1234)
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
  const opts = l => p.evaluate(s => { const x = document.querySelector(s); return { v: x.value, dis: x.disabled, o: [...x.options].map(o => o.value) }; }, S_(l));
  const pick = async (l, v) => { await p.selectOption(S_(l), v); await p.waitForTimeout(250); };
  const waitYears = () => p.waitForFunction(s => !/Loading years/.test(document.querySelector(s).innerText), S_('Year'), { timeout: 30000 }).catch(() => {});
  // model first: cc = only that model's, picked; the model list stays whole
  await pick('Brand', 'Honda'); await p.waitForTimeout(1200);
  const nModels = (await opts('Model')).o.length;
  await pick('Model', 'Shine 100'); await waitYears();
  let cc = await opts('Engine (cc)'), md = await opts('Model'), yr = await opts('Year');
  ok(cc.v === '100' && cc.o.join() === '100', `${tag}: Honda Shine 100: Engine (cc) shows only 100 cc, picked (${cc.o.join(' ')})`);
  ok(md.o.length === nModels, `${tag}: picking the model keeps the whole Honda model list (${md.o.length - 1} models)`);
  ok(yr.o[0] === 'Any' && yr.o.length > 2 && yr.v === 'Any', `${tag}: Shine 100 has ${yr.o.length - 1} years: Year lists them with Any year (${yr.o.join(' ')})`);
  await pick('Model', 'Shine 100 DX'); cc = await opts('Engine (cc)');
  ok(cc.o.length === 1, `${tag}: switching model straight away works (Shine 100 DX: ${cc.o.join(' ')} cc)`);
  // one book year: picked for you, Search goes straight to the sections
  await pick('Brand', 'TVS'); await p.waitForTimeout(1500);
  await pick('Model', 'Scooty'); await waitYears(); await p.waitForTimeout(300);
  cc = await opts('Engine (cc)'); yr = await opts('Year');
  ok(cc.dis && cc.o.join() === 'Any', `${tag}: TVS Scooty (no cc in the book): Engine (cc) says Not listed, locked`);
  ok(yr.o.length === 1 && yr.v === yr.o[0] && /^2010/.test(yr.v), `${tag}: TVS Scooty: Year is its only version, 2010, picked (${yr.o.join(' ')})`);
  await p.evaluate(() => m2Go()); await p.waitForTimeout(800);
  ok(await p.evaluate(() => cur().p && cur().p.v === 'secs' && /^2010/.test(cur().p.ed)), `${tag}: Search parts opens Scooty 2010 sections straight away`);
  await p.evaluate(() => go('findpart')); await p.waitForTimeout(500);
  // a model with books with and without years keeps Any year (All books) first, nothing hidden
  await pick('Model', 'Star City Plus'); await waitYears(); yr = await opts('Year');
  ok(yr.v === 'Any' && yr.o.some(o => /^2017/.test(o)), `${tag}: TVS Star City Plus (e-catalogue + 2017 book): Year stays All years, 2017 in the list (${yr.o.join(' | ')})`);
  // cc first: narrows the models; after a model the cc list keeps Any cc to undo it
  await pick('Brand', 'Bajaj'); await p.waitForTimeout(1200);
  await pick('Engine (cc)', '150'); md = await opts('Model');
  ok(md.o.length > 2 && await p.evaluate(ms => ms.filter(m => m !== 'Any').every(m => String(MODEL_CC[m]) === '150'), md.o), `${tag}: Bajaj 150 cc first: the model list has only 150 cc models (${md.o.length - 1})`);
  await pick('Model', md.o[1]); cc = await opts('Engine (cc)');
  ok(cc.v === '150' && cc.o.join() === 'Any,150', `${tag}: then a model: Engine (cc) = 150 picked, with Any cc to undo (${cc.o.join(' ')})`);
  await pick('Engine (cc)', 'Any'); cc = await opts('Engine (cc)'); md = await opts('Model');
  ok(cc.v === '150' && cc.o.join() === '150' && md.o.length > 12, `${tag}: Any cc: the model stays, cc follows it, all Bajaj models listed again (${md.o.length - 1})`);
  // brand change clears it all
  await pick('Brand', 'Hero'); await p.waitForTimeout(800); cc = await opts('Engine (cc)'); md = await opts('Model');
  ok(cc.v === 'Any' && cc.o.length > 3 && md.v === 'Any', `${tag}: another brand starts clean (Any cc, ${cc.o.length - 1} cc sizes)`);
  if (tag === 'phone') await p.screenshot({ path: '/tmp/claude-0/nr/fpform-phone.png' });
  ok(errs.length === 0, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`);
  await p.context().close();
}
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
