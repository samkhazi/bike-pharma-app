// 2026-10-19 update 9l: Hero update from Sam's folder Updated Hero Catalogue (tools/brands/hero_update.py, tools/hero9l.py).
// Needs catalogues/hero/Hero_Update_19Oct.zip in the server's FILES_DIR.   BASE4=http://127.0.0.1:3021 node tools/test_hero9l.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3021';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
await p.evaluate(async () => { catLoad('Hero'); for (let i = 0; i < 400 && CAT_ALL.some(e => e.vb === 'Hero' && e.st !== 2); i++) await new Promise(r => setTimeout(r, 500)); });
await p.evaluate(async () => { dgLoad('Hero'); for (let i = 0; i < 100 && !dgLoad('Hero'); i++) await new Promise(r => setTimeout(r, 300)); });
const P = o => ({ v: 'res', yr: 'Any', bs: 'Any', sort: 'best', n: 30, ...o });
const ed = await p.evaluate(() => CAT_VARS.filter(([vb, v]) => vb === 'Hero' && /OCT, 2026/.test(v)).map(x => x[1]));
ok(ed.length === 2, 'the 2 new Hero editions are listed: ' + ed.join(' | '));
// a part of the new Destini 110 edition and its diagram (an SVG in the update zip, drawn as a PNG)
const t1 = await p.evaluate(P => { go('findpart', P); const R = m2Res(P); const r = R.list.find(r => r.vv.some(v => /SPECIAL EDITION/.test(v)));
  S.ui.fp = Object.assign(S.ui.fp || {}, { vv: r && r.vv.find(v => /SPECIAL EDITION/.test(v)) });
  return { n: R.list.length, r: r && r.part, f: r && dgFig(r) }; }, P({ q: 'clutch', vb: 'Hero', vm: 'Destini 110' }));
ok(t1.r && /Hero_Update_19Oct\.zip/.test(JSON.stringify(t1.f)), `Destini 110 Special Edition clutch line ${t1.r}, diagram ${JSON.stringify(t1.f).slice(0, 90)}`);
const u = t1.f && t1.f.u;
const img = await p.evaluate(async u => { const src = await catPf(u); const im = new Image(); im.src = src; await im.decode(); return [im.naturalWidth, im.naturalHeight]; }, u);
ok(img[0] >= 2000 && img[1] >= 1300, 'SVG diagram drawn as a PNG ' + img.join('x'));
const hs = await p.evaluate(async u => (await fetch('/api/dghot?u=' + encodeURIComponent(u) + '&ocr=1', { credentials: 'same-origin' })).json(), u);
ok(hs.need === 'img', 'clickable numbers: the server asks the page for the drawn SVG diagram');
// an old number finds the line of its new number
const t2 = await p.evaluate(P => { const R = m2Res(P); return R.list.map(r => r.part); }, P({ q: '12391-GW8-681', vb: 'Hero', vm: 'Any' }));
ok(t2.includes('12391-AAH-00099'), 'old no. 12391-GW8-681 finds 12391-AAH-00099 (' + t2.slice(0, 3).join(', ') + ')');
// a price-list part (no diagram) with its MRP, and a kit in the editions it fits
const t3 = await p.evaluate(P => { const r = m2Res(P).list.find(r => r.part === '06427-KTP-900H'); return r && { m: r.vms[0], mrp: r.mrp }; }, P({ q: '06427-KTP-900H', vb: 'Hero', vm: 'Any' }));
ok(t3 && t3.m === 'Other parts (price list)' && +String(t3.mrp).replace(/\D/g, '') === 410, 'price-list part 06427-KTP-900H, MRP ' + JSON.stringify(t3));
const t4 = await p.evaluate(P => { const L = m2Res(P).list.filter(r => r.part === '20K1110S'); return L.flatMap(r => r.vms); }, P({ q: '20K1110S', vb: 'Hero', vm: 'Any' }));
ok(t4.includes('Splendor Plus') && t4.includes('HF Deluxe'), 'kit 20K1110S is in Splendor Plus and HF Deluxe: ' + [...new Set(t4)].join(', '));
// a part photo that only the update zip has
const ph = await p.evaluate(async () => { const e = CAT_ALL.find(e => e.vb === 'Hero'); const x = catPh(e.d, '06451-GE2-405'); if (!x) return null; const src = await catPf(x.z); const im = new Image(); im.src = src; await im.decode(); return [x.z, im.naturalWidth]; });
ok(ph && /Hero_Update_19Oct\.zip/.test(ph[0]) && ph[1] > 0, 'new part photo from the update zip ' + JSON.stringify(ph));
await p.evaluate(() => go('catup')); await p.waitForFunction(() => CUP.st === 2, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(500);
const t5 = await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
ok(/Updated Hero Catalogue/.test(t5), 'Catalogue files names the folder Updated Hero Catalogue');
ok(errs.length === 0, `no page errors ${errs.slice(0, 2).join(' | ')}`);
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
