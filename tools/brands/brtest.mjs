// update 7 (11 Oct): Hero, Royal Enfield, Yamaha, Honda, TVS from Sam's package: models, sections, diagrams + photos out of the zips,
// MRP on search cards / section table / part page, compatible parts across brands, Catalogue files page (folder to pick, free space).
// PASS=1 collects the zip byte ranges the screens ask for (NEED file); PASS=2 expects them filled with the real bytes.
import { BASE, ok, note, newPage, done } from './common.mjs';
import fs from 'fs';
const NEED = '/tmp/claude-0/brtest/need.json', PASS = +(process.env.PASS || 1);
const ready = f => f.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && document.querySelector('.screen'), null, { timeout: 20000 });
const scrText = f => f.evaluate(() => { const sc = [...document.querySelectorAll('#vp .screen')].pop(); return sc ? sc.innerText : ''; });
async function login(f, id, pw) { await f.goto(BASE + '/app.html', { waitUntil: 'load' }); await ready(f); await f.fill('#loginId', id); await f.evaluate(() => sendOtp()); await f.waitForTimeout(600); await f.fill('#pw1', pw); await f.evaluate(() => pwGo()); await f.waitForTimeout(900); await f.evaluate(() => { if (cur().s === 'roleok') reset(HOME[S.user.role]); }); await f.waitForTimeout(400); return f.evaluate(() => S.user && S.user.role); }
const dgState = f => f.waitForFunction(() => { const e = document.querySelector('#vp .screen [data-dg]'); return !e || e.classList.contains('on') || e.classList.contains('dg-no'); }, null, { timeout: 30000 }).catch(() => {}).then(() => f.evaluate(() => { const e = document.querySelector('#vp .screen [data-dg]'); return e ? { u: e.dataset.dg, on: e.classList.contains('on'), no: e.classList.contains('dg-no') } : null; }));
const need = new Set();
const A = await newPage({ width: 1280, height: 860 });
ok(await login(A, 'sam@bikepharma.com', 'Review@1234') === 'admin', 'admin logs in');
await A.evaluate(() => reset('findpart')); await A.waitForTimeout(800);
let t = await scrText(A);
ok(/7 of \d+ brands in/.test(t), 'Find Part home: 7 brands in');
const CASES = { Hero: 'clutch', 'Royal Enfield': 'brake', Yamaha: 'brake', Honda: 'brake', TVS: 'brake' };
for (const [vb, q] of Object.entries(CASES)) {
  // the brand's first current model, latest year
  await A.evaluate(vb => { go('findpart', { v: 'brand', vb }); }, vb);
  await A.waitForFunction(vb => { const e = CAT_ALL.find(e => e.vb === vb); return e && (e.st === 2 || e.st === 3); }, vb, { timeout: 60000 });
  const info = await A.evaluate(vb => { const e = CAT_ALL.find(e => e.vb === vb); return { st: e.st, models: BRANDS_V[vb].length, m0: BRANDS_V[vb][0], cur: e.d && e.d.cur, rows: e.d && e.d.d.length, mrp: e.d && e.d.mrp ? Object.keys(e.d.mrp).length : 0 }; }, vb);
  ok(info.st === 2 && info.rows > 1000, `${vb}: catalogue loads (${JSON.stringify(info)})`);
  const vm = info.m0;
  await A.waitForTimeout(300);
  const yrs = await A.evaluate(([vb, vm]) => { const Y = fpYrs({ vb, vm }); return Y === 'wait' ? 'wait' : Y.ys; }, [vb, vm]);
  const yr = Array.isArray(yrs) && yrs.length ? String(yrs[yrs.length - 1]) : 'Any';
  await A.evaluate(([vb, vm, yr]) => { go('findpart', { v: 'secs', vb, vm, yr }); }, [vb, vm, yr]);
  await A.waitForFunction(() => { const sc = catScope(m2A(cur().p)); return sc && !sc.loading; }, null, { timeout: 30000 });
  const secs = await A.evaluate(() => { const sc = catScope(m2A(cur().p)); return m2Secs(sc.rows).map(s => s.pg); });
  ok(secs.length > 5, `${vb} ${vm} ${yr}: ${secs.length} sections`);
  for (const k of [0, Math.floor(secs.length / 2)]) {
    await A.evaluate(pg => m2Sec(pg), secs[k]); await A.waitForTimeout(300);
    const d = await dgState(A); const tt = await scrText(A);
    if (d) need.add(d.u);
    const mrpN = (tt.match(/₹[\d,]+/g) || []).length;
    note(`${vb} ${vm} ${yr} section ${k} ${secs[k]}: ${JSON.stringify(d)} MRP shown ${mrpN}`);
    if (!d && /\.$/.test(secs[k])) note(`${vb} ${secs[k]}: a section without a diagram in the book (essentials / kits)`);
    else { ok(d && /^pf:catalogues\//.test(d.u), `${vb} ${secs[k]}: diagram link into the brand's zip`); if (PASS === 2) ok(d && d.on, `${vb} ${secs[k]}: diagram shows`); }
    ok(mrpN > 0 || vb === 'KTM', `${vb} ${secs[k]}: section table shows MRP (${mrpN})`);
    await A.evaluate(() => back()); await A.waitForTimeout(200);
  }
  // search results show MRP on the cards
  await A.evaluate(([vb, vm, yr, q]) => go('findpart', { v: 'res', q, vb, vm, yr, cc: 'Any', bs: 'Any', sort: 'best', n: 30 }), [vb, vm, yr, q]); await A.waitForTimeout(900);
  const cards = await A.evaluate(() => [...document.querySelectorAll('#vp .screen .m2-c')].map(c => (c.querySelector('.m2-pr') || {}).innerText || ''));
  note(`${vb} search "${q}": ${cards.length} cards, e.g. ${JSON.stringify(cards.slice(0, 3))}`);
  ok(cards.length > 0 && cards.some(c => /MRP\s*₹[\d,]+/.test(c)), `${vb}: search cards show "MRP ₹…"`);
  await A.screenshot({ path: `/tmp/claude-0/bptest/br-${vb.replace(/ /g, '')}-search.png` });
}
// part photos (Hero, Royal Enfield): from the image zips
for (const vb of ['Hero', 'Royal Enfield']) {
  const r = await A.evaluate(vb => { const r = catRows().find(r => r.vb === vb && r.ph && r.ph.z && r.mrp); if (!r) return null; go('findpart', { v: 'part', i: r.i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any', yr: 'Any' }); return { part: r.part, z: r.ph.z, mrp: r.mrp }; }, vb);
  await A.waitForTimeout(PASS === 2 ? 2500 : 1200);
  if (r) need.add(r.z);
  const ph = await A.evaluate(() => { const e = document.querySelector('#vp .screen .fpc-photo'); return e ? { bg: e.style.backgroundImage.slice(0, 9), u: e.dataset.bg } : null; });
  const tt = await scrText(A);
  note(`${vb} part ${JSON.stringify(r)} photo ${JSON.stringify(ph)}`);
  ok(r && /MRP/.test(tt) && tt.includes(Number(r.mrp).toLocaleString('en-IN')), `${vb} part page shows its MRP`);
  if (PASS === 2) ok(ph && ph.bg.startsWith('url("blob'), `${vb} part page: the part's own photo shows`);
  await A.screenshot({ path: `/tmp/claude-0/bptest/br-${vb.replace(/ /g, '')}-part.png` });
}
// compatible: a Hero part whose number is also in Honda's book
const cx = await A.evaluate(() => { const r = catRows().find(r => r.vb === 'Hero' && XR && XR.x[xrPk(r)] && Object.keys(XR.x[xrPk(r)]).some(b => XR.b[b] === 'Honda')); if (!r) return null; go('findpart', { v: 'part', i: r.i, vb: r.vb, pg: r.page, pk: r.pk, ref: r.ref || '', vm: 'Any', yr: 'Any' }); return r.part + ' ' + r.desc; });
await A.waitForTimeout(1200); t = await scrText(A);
ok(cx && /Same part number in other brands/.test(t) && /Honda/.test(t), 'compatible: a Hero part shared with Honda lists Honda · ' + cx);
await A.screenshot({ path: '/tmp/claude-0/bptest/br-compat.png' });
// Catalogue files page
await A.evaluate(() => go('catup')); await A.waitForTimeout(1500); t = await scrText(A);
note(t.slice(0, 1500));
ok(/Free space on your server/.test(t), 'catup: free space on the server shown');
for (const b of ['Hero', 'Royal Enfield', 'Yamaha', 'Honda', 'TVS']) ok(new RegExp(b + '[\\s\\S]{0,80}files on the server').test(t), 'catup: card for ' + b);
ok(/All Catalogues > BikeSurgeon_Catalog_Import > Honda/.test(t) || /Ready/i.test(t), 'catup: names the folder to pick (or Ready)');
await A.screenshot({ path: '/tmp/claude-0/bptest/br-catup.png', fullPage: true });
ok(!A.errs.length, 'no page errors ' + JSON.stringify(A.errs.slice(0, 4)));
note('bad requests ' + JSON.stringify(A.bad.slice(0, 8)));
if (PASS === 1) fs.writeFileSync(NEED, JSON.stringify([...need]));
await done('brands ' + PASS);
