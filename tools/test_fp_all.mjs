// 2026-10-12 Sam 07:47Z "find part option ko tu khud 3-4 baar test kar sabhi": Find Part in 4 rounds, every brand, computer and phone.
//  1 part numbers (as printed, lower case without - or spaces, any brand)   2 part names, misspelt and shop words, inside a model
//  3 brand > model > year > sections > a section (diagram + table)         4 alternate list, other-number lines, Search by vehicle, odd input
// BASE4=http://127.0.0.1:3018 OUT=<dir> node tools/test_fp_all.mjs   (admin sam@bikepharma.com / Test@1234; FILES_DIR may hold some books:
// a diagram either draws or says its file is still to be uploaded, never a blank box)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018', OUT = process.env.OUT || '/tmp/claude-0/bptest5/out';
const ROUNDS = (process.env.ROUNDS || '1234').split('');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const CAT = new URL('../public/cat/', import.meta.url);
const SLUG = { KTM: 'ktm', Husqvarna: 'husqvarna', Hero: 'hero', 'Royal Enfield': 'royal-enfield', Yamaha: 'yamaha', Honda: 'honda', TVS: 'tvs', Bajaj: 'bajaj', Suzuki: 'suzuki' };
const pk = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
// 4 part numbers per brand, spread over the book, each a real number (6+ letters/digits)
const PN = {};
for (const [vb, s] of Object.entries(SLUG)) {
  const d = JSON.parse(fs.readFileSync(new URL(s + '.json', CAT))).d.map(r => r[5]).filter(x => x && pk(x).length >= 6 && /\d{3}/.test(x));
  PN[vb] = [0.1, 0.37, 0.63, 0.9].map(f => d[Math.floor(d.length * f)]);
}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const open = async (W, H) => {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(BASE + '/app.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
  await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
  await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
  await p.evaluate(() => { window.__w = async (f, n = 240) => { for (let k = 0; k < n; k++) { const x = f(); if (x) return x; await new Promise(r => setTimeout(r, 250)); } return null; };
    window.__brand = async vb => { const e = CAT_ALL.find(e => e.vb === vb); if (!e) return null; catAsk(e); await __w(() => e.st === 2, 400); return e.d ? e.d.models : null; }; });
  return p;
};
const screen = p => p.evaluate(() => document.querySelector('#vp .screen').innerText);
// a search, as the search bar runs it; waits until nothing is loading (two quiet looks in a row)
const search = async (p, prm) => {
  const t0 = Date.now(); await p.evaluate(prm => { if (typeof ALTC !== 'undefined') ALTC.t = 0; go('findpart', { v: 'res', yr: 'Any', bs: 'Any', sort: 'best', n: 30, ...prm }); }, prm);
  let last = '', same = 0;
  for (let k = 0; k < 240; k++) { await p.waitForTimeout(250); const x = await screen(p);
    if (/Loading|Searching|Checking the/i.test(x)) { same = 0; continue; } same = x === last ? same + 1 : 0; last = x; if (same >= 2) break; }
  return { t: last, ms: Date.now() - t0 };
};
const first = t => t.replace(/\s+/g, ' ').slice(0, 170);
const report = [];

// ---------------- Round 1: part numbers, every brand (computer)
if (ROUNDS.includes('1')) {
  console.log('\n== Round 1: part numbers, every brand (computer)');
  const p = await open(1280, 900);
  for (const [vb, list] of Object.entries(PN)) {
    for (const [i, pn] of list.entries()) {
      const q = i % 2 ? pn.toLowerCase().replace(/[-\s.]/g, '') : pn;
      const r = await search(p, i === 3 ? { q } : { q, vb });
      const hit = pk(r.t).includes(pk(pn)) && !/No “[^”]*” found/.test(r.t);
      ok(hit, `${vb} "${q}"${i === 3 ? ' (any brand)' : ''}: ${hit ? 'found' : 'NOT found'} in ${(r.ms / 1000).toFixed(1)} s | ${first(r.t)}`);
      report.push({ round: 1, vb, q, ok: hit, ms: r.ms });
    }
  }
  ok(p.errs.length === 0, 'round 1: no page errors ' + p.errs.slice(0, 2).join(' | '));
  await p.context().close();
}

// ---------------- Round 2: part names inside a model, misspelt and shop words (phone)
const NAMES = [
  ['Hero', /^Splendor\+$|Splendor Plus|^Splendor/i, [['clutch plate', /clutch/i], ['brek shoe', /shoe/i], ['air filter', /air|filter|cleaner|element/i]]],
  ['Honda', /^Shine/i, [['clucth plate', /clutch/i], ['head light', /head ?(light|lamp)|headlight/i], ['air filtar', /air|filter|cleaner|element/i]]],
  ['Bajaj', /Pulsar 150/i, [['chain sprocket kit', /chain|sprocket/i], ['hedlight', /head ?(light|lamp)|headlight/i], ['brake shoe', /shoe/i]]],
  ['TVS', /Apache RTR 160/i, [['brake pad', /pad/i], ['shocker', /shock|suspension|cushion|absorber/i], ['clutch cable', /cable/i]]],
  ['Yamaha', /^FZ/i, [['air filtar', /air|filter|cleaner|element/i], ['indicator', /flasher|winker|signal|indicator/i], ['clutch plate', /clutch|friction/i]]],
  ['Suzuki', /Access 125/i, [['self motor', /starter|starting motor|self/i], ['silencer', /muffler|silencer|exhaust/i], ['v belt', /belt/i]]],
  ['KTM', /200 Duke/i, [['piston ring', /ring/i], ['clutch plate', /clutch|disc|friction/i], ['brake pad', /pad/i]]],
  ['Royal Enfield', /Classic 350/i, [['clutch plate', /clutch|friction/i], ['brake shoe', /shoe/i], ['spark plug', /plug/i]]],
  ['Husqvarna', /Svartpilen/i, [['brake pad', /pad/i], ['chain', /chain/i]]],
];
if (ROUNDS.includes('2')) {
  console.log('\n== Round 2: part names inside a model, misspelt and shop words (phone)');
  const p = await open(390, 844);
  for (const [vb, mre, qs] of NAMES) {
    const vm = await p.evaluate(async ([vb, src, fl]) => { const ms = await __brand(vb); const re = new RegExp(src, fl); return ms ? (ms.find(m => re.test(m)) || ms[0]) : null; }, [vb, mre.source, mre.flags]);
    if (!vm) { ok(false, `${vb}: catalogue did not load`); continue; }
    for (const [q, want] of qs) {
      const r = await search(p, { q, vb, vm });
      const names = await p.evaluate(() => [...document.querySelectorAll('#vp .screen .m2-card, #vp .screen .fp-card, #vp .screen .card')].slice(0, 6).map(c => c.innerText.split('\n').slice(0, 2).join(' ')).join(' / '));
      const hit = !/No “[^”]*” found|No parts found|Nothing found/i.test(r.t) && want.test(names || r.t);
      ok(hit, `${vb} ${vm} "${q}": ${(r.ms / 1000).toFixed(1)} s | ${(names || first(r.t)).slice(0, 190)}`);
      report.push({ round: 2, vb, vm, q, ok: hit, ms: r.ms });
    }
  }
  await p.screenshot({ path: OUT + '/r2-phone.png' });
  ok(p.errs.length === 0, 'round 2: no page errors ' + p.errs.slice(0, 2).join(' | '));
  await p.context().close();
}

// ---------------- Round 3: brand > model > year > sections > a section, diagram + table (computer and phone)
const MODEL = { Hero: /Splendor/i, Honda: /Activa|Shine/i, Bajaj: /Pulsar/i, TVS: /Jupiter|Apache/i, Yamaha: /R15|FZ/i, Suzuki: /Gixxer|Access/i, KTM: /390 Duke|Duke/i, 'Royal Enfield': /Hunter|Classic/i, Husqvarna: /Vitpilen|Svartpilen/i };
if (ROUNDS.includes('3')) {
  for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
    console.log(`\n== Round 3: browse every brand to a section (${tag})`);
    const p = await open(W, H);
    for (const vb of Object.keys(SLUG)) {
      const r = await p.evaluate(async ([vb, src, fl, tag]) => {
        const ms = await __brand(vb); if (!ms) return { err: 'catalogue did not load' };
        const re = new RegExp(src, fl); const pickM = tag === 'phone' ? ms.filter(m => re.test(m)).slice(-1)[0] : ms.find(m => re.test(m)); const vm = pickM || ms[0];
        const Y = await __w(() => { const y = fpYrs({ vb, vm }); return y !== 'wait' && y; }, 200); const ys = (Y && Y.ys || []).map(String);
        const yr = ys.length ? ys[tag === 'phone' ? 0 : ys.length - 1] : 'Any';
        go('findpart', { v: 'year', vb, vm, yr: 'Any' }); await new Promise(r => setTimeout(r, 300));
        const yearTxt = document.querySelector('#vp .screen').innerText;
        await __w(() => dgLoad(vb), 200);
        const p0 = { vb, vm, yr }; go('findpart', { v: 'secs', ...p0 });
        const sc = await __w(() => { const s = catScope(m2A(p0)); return s && !s.loading && s; }, 200); if (!sc) return { vm, yr, err: 'sections did not load' };
        const secsTxt = document.querySelector('#vp .screen').innerText;
        const pages = [...new Set(sc.rows.map(r => r.page))]; const out = [];
        for (const pg of [pages[0], pages[Math.floor(pages.length / 2)], pages[pages.length - 1]]) {
          go('findpart', { v: 'sec', ...p0, pg }); const scr = document.querySelector('#vp .screen'); const t = scr.querySelector('.dg');
          const st = await __w(() => (t && /blob:/.test(t.style.backgroundImage) && 'drawn') || (/not on the server yet/.test(scr.innerText) && 'file to upload') || (/No diagram in the app/.test(scr.innerText) && 'no diagram in the book'), 160) || 'blank';
          const rows = sc.rows.filter(r => r.page === pg); const shown = rows.filter(r => scr.innerText.includes(r.part)).length;
          out.push({ pg, st, rows: rows.length, shown, mrp: /₹\s?[\d,]+/.test(scr.innerText), file: t && t.dataset.dg ? t.dataset.dg.split(':')[1].split('/').pop() : '' });
        }
        return { vm, yr, ys: ys.length, years: /choose model year/i.test(yearTxt), secs: pages.length, secsOk: secsTxt.length > 50, out };
      }, [vb, MODEL[vb].source, MODEL[vb].flags, tag]);
      if (r.err) { ok(false, `${tag} ${vb}: ${r.vm || ''} ${r.err}`); continue; }
      const good = r.secs > 0 && r.out.every(o => o.st !== 'blank' && o.rows > 0 && o.shown === o.rows);
      ok(good, `${tag} ${vb} > ${r.vm} > ${r.yr} (${r.ys} years): ${r.secs} sections; ` + r.out.map(o => `${o.pg}: ${o.st}, ${o.shown}/${o.rows} parts${o.mrp ? ', MRP' : ''}`).join(' | '));
      report.push({ round: 3, tag, vb, vm: r.vm, yr: r.yr, ok: good, out: r.out });
    }
    await p.screenshot({ path: `${OUT}/r3-${tag}.png` });
    ok(p.errs.length === 0, `round 3 ${tag}: no page errors ` + p.errs.slice(0, 2).join(' | '));
    await p.context().close();
  }
}

// ---------------- Round 4: alternate list, Search by vehicle, odd input (computer, then phone)
if (ROUNDS.includes('4')) {
  console.log('\n== Round 4: alternate list, Search by vehicle, odd input');
  const L = JSON.parse(fs.readFileSync(new URL('alt/lists.json', CAT)));
  const oldOnly = L.p.filter(r => r[5] === 2).filter((r, i, a) => i % Math.floor(a.length / 3) === 0).slice(0, 3);   // old number not in a book, new one is
  const newOnly = L.p.filter(r => r[5] === 1).filter((r, i, a) => i % Math.floor(a.length / 2) === 0).slice(0, 2);   // new number not in a book, old one is
  for (const [W, H, tag] of [[1280, 900, 'computer'], [390, 844, 'phone']]) {
    const p = await open(W, H);
    for (const r of tag === 'computer' ? oldOnly : oldOnly.slice(0, 1)) {
      const s = await search(p, { q: r[0] });
      const hit = pk(s.t).includes(pk(r[2])) && /oemship/i.test(s.t);
      ok(hit, `${tag}: old number ${r[0]} (not in a book) shows its new number ${r[2]} from the oemship list | ${first(s.t)}`);
    }
    for (const r of tag === 'computer' ? newOnly : []) {
      const s = await search(p, { q: r[2] });
      const hit = pk(s.t).includes(pk(r[0])) && /oemship/i.test(s.t);
      ok(hit, `${tag}: new number ${r[2]} (not in a book) shows its old number ${r[0]} | ${first(s.t)}`);
    }
    // Search by vehicle, every brand: brand + model, then Search parts
    for (const vb of Object.keys(SLUG)) {
      const v = await p.evaluate(async vb => {
        go('findpart'); await new Promise(r => setTimeout(r, 300));
        const sel = l => document.querySelector(`.m2-veh select[aria-label="${l}"]`);
        const set = async (l, val) => { const x = sel(l); x.value = val; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); };
        if (!sel('Brand')) return 'no vehicle form';
        await set('Brand', vb); const ms = await __w(() => { const o = [...sel('Model').options].map(o => o.value).filter(v => v !== 'Any'); return o.length && o; }, 200);
        if (!ms) return 'no models';
        await set('Model', ms[Math.floor(ms.length / 2)]); await __w(() => !/Loading years/.test(sel('Year').innerText), 120);
        m2Go(); await new Promise(r => setTimeout(r, 600));
        const c = cur().p || {}; return ['secs', 'year', 'res'].includes(c.v) ? `ok ${c.v} ${c.vm} ${c.yr || ''}` : 'stayed on ' + JSON.stringify(c);
      }, vb);
      ok(/^ok/.test(v), `${tag}: Search by vehicle ${vb}: ${v}`);
    }
    // odd input never breaks the page
    for (const q of ['zzqqxx', '<img src=x onerror=window.__x=1>', '   ' + PN.KTM[0].toLowerCase().replace(/(\d{3})/, '$1 ') + '  ', '12345678901234567890', 'स्पार्क प्लग']) {
      const s = await search(p, { q });
      const x = await p.evaluate(() => window.__x === 1);
      ok(!x && s.t.length > 20, `${tag}: "${q.trim().slice(0, 30)}" | ${first(s.t)}`);
    }
    if (tag === 'phone') await p.screenshot({ path: OUT + '/r4-phone.png' });
    ok(p.errs.length === 0, `round 4 ${tag}: no page errors ` + p.errs.slice(0, 2).join(' | '));
    await p.context().close();
  }
}
fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
const slow = report.filter(r => r.ms > 8000).map(r => `${r.vb} "${r.q}" ${(r.ms / 1000).toFixed(1)} s`);
console.log('\nslow searches (over 8 s): ' + (slow.join(', ') || 'none'));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
