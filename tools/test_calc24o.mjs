// 24o: calculations (price rule, commission, MRP lots, profit from stock-in rate, GST, cart) checked against hand-worked numbers. Needs a server on 3033 with an admin calc@bikepharma.test / Test@1234.
// 24o: calculations checked against numbers worked out by hand
import { chromium } from '/Users/samkhazi/Downloads/OpenDots/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/Users/samkhazi/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:3033/app.html'); await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 20000 });
await p.fill('#loginId', 'calc@bikepharma.test'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(700); await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(1500);
const R = await p.evaluate(() => {
  const out = {};
  // test products (in memory only)
  const mk = (id, mrp, extra = {}) => { const pr = invPrices(mrp); const x = { id, name: 'Test ' + id, pn: 'TST' + id, brand: 'T', cat: 'Engine', mrp, price: pr.price, mp: pr.mp, ic: 'package', type: '', fits: '', war: 0, hsn: '87141090', gst: 18, ...extra }; PRODUCTS.push(x); DB.stock[id] = 10; return x; };
  DB.priceRule = { c: 5, m: 15 };
  out.rule = invPrices(1000);                                   // 950 / 850
  out.rule2 = invPrices(333);                                   // 316.35 / 283.05
  const a = mk('ztA', 100);
  // commission: customer with mechanic, 2 pcs, MRP 100, customer 5% off (95), mechanic 15% off (85): (95-85)*2 = 20
  out.com = invCom({ items: { ztA: 2 }, party: 'cxm' });
  DB.priceRule = { c: 5, m: 20 }; const a2 = mk('ztA2', 100);   // Sam's example: cust 5%, mech 20% -> 15 per pc
  out.com2 = invCom({ items: { ztA2: 1 }, party: 'cxm' }); DB.priceRule = { c: 5, m: 15 };
  // MRP lots: 2 old pcs at MRP 210, 1 new at 245 -> lines 2 x 199.5 and 1 x 232.75
  const l = mk('ztL', 245); DB.stock.ztL = 3; try { lotsSet('ztL', [{ m: 210, q: 2 }, { m: 245, q: 1 }]); } catch (e) { out.lotErr = e.message; }
  out.lots = lotLines('ztL', 3, 0); out.lotAmt = lotAmt('ztL', 3, 0); out.lotMrp = lotMrpAmt('ztL', 3);
  // profit: a bill of 2 x 95 with a posted stock-in rate of 70 -> profit 50, margin 26%
  DB.grns = DB.grns || []; DB.grns.push({ id: 'GRN-T1', supplier: 'T', status: 'posted', items: [{ pid: 'ztA', q: 5, rate: 70 }], date: today() });
  out.cost = itemCost({ pid: 'ztA' });
  out.profit = nhProfit([{ items: [{ pid: 'ztA', q: 2, r: 95 }] }]);
  // estimate only when never bought: mechanic price 85 x 0.85 = 72.25 -> rounded 72
  out.costEst = itemCost({ pid: 'ztA2' });
  // GST inside a price: 118 at 18% -> taxable 100, tax 18
  out.gst = gstTaxable([{ pid: 'ztA', q: 1, r: 118 }], 118);
  // cart: 3 x 95 = 285 < 499 -> delivery 40, total 325; MRP 300, discount 15
  const cart0 = DB.cart; DB.cart = [{ id: 'ztA', q: 3 }]; const cp0 = DB.coupon; DB.coupon = null; out.cart = cartTotals(); DB.cart = [{ id: 'ztA', q: 6 }]; out.cart2 = cartTotals(); DB.cart = cart0; DB.coupon = cp0;
  return out;
});
console.log(JSON.stringify(R));
const near = (a, b) => Math.abs(a - b) < 0.011;
ok(R.rule.price === 950 && R.rule.mp === 850, 'price rule: MRP 1000 -> customer 950, mechanic 850 ' + JSON.stringify(R.rule));
ok(near(R.rule2.price, 316.35) && near(R.rule2.mp, 283.05), 'price rule with paise: MRP 333 -> 316.35 / 283.05 ' + JSON.stringify(R.rule2));
ok(R.com === 20, 'commission: customer with mechanic, 2 pcs MRP 100 (95 vs 85) = ₹20, got ' + R.com);
ok(R.com2 === 15, 'commission (Sam example: customer 5%, mechanic 20%) = ₹15 per piece, got ' + R.com2);
ok(!R.lotErr && R.lots.length === 2 && R.lots[0].m === 210 && R.lots[0].q === 2 && near(R.lots[0].r, 199.5) && R.lots[1].m === 245 && near(R.lots[1].r, 232.75), 'MRP lots: old box sells at old MRP first (2 x 199.50 + 1 x 232.75) ' + JSON.stringify(R.lots) + (R.lotErr || ''));
ok(near(R.lotAmt, 631.75) && near(R.lotMrp, 665), 'MRP lots total ₹631.75 (MRP ₹665) got ' + R.lotAmt + ' / ' + R.lotMrp);
ok(R.cost === 70, 'cost = real stock-in rate ₹70, got ' + R.cost);
ok(R.profit.p === 50 && R.profit.pct === 26, 'profit: 2 x 95 sold, bought at 70 -> ₹50, 26% got ' + JSON.stringify(R.profit));
ok(R.costEst === 68, 'no stock-in rate: estimate 80 x 0.85 = ₹68, got ' + R.costEst);
ok(near(R.gst, 100), 'GST: ₹118 at 18% -> taxable ₹100, got ' + R.gst);
ok(R.cart.sub === 285 && R.cart.mrp === 300 && R.cart.disc === 15 && R.cart.del === 40 && R.cart.total === 325, 'cart: 3 x 95, MRP 300, saving 15, delivery 40, total 325 ' + JSON.stringify(R.cart));
ok(R.cart2.sub === 570 && R.cart2.del === 0 && R.cart2.total === 570, 'cart over ₹499: free delivery, total 570 ' + JSON.stringify(R.cart2));
ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
