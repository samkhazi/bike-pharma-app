// update 19m: a close-up (zoomed) diagram moves by drag and by wheel, stays inside its edges, and a drag is not a tap.
// usage: node tools/test_hsdrag.mjs   (own server on 3031, fresh database)
import { spawn } from 'node:child_process'; import fs from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-hsdrag'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/pf', { recursive: true });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3031', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off' }, stdio: 'ignore' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch('http://127.0.0.1:3031/app.html')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 500)); }
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:3031/app.html', { waitUntil: 'load' });
  await p.evaluate(() => { window.TAPS = [];
    document.body.insertAdjacentHTML('beforeend', `<div class="m3" id="tz" style="position:fixed;left:100px;top:100px;width:400px;z-index:99999;background:#fff"><div class="hs-clip z"><div class="dg m3-fig" data-hk="t" onclick="TAPS.push('dg')"
      style="position:relative;width:400px;height:300px;transform-origin:0 0;--hz:2.2;transform:translate(-40%,-40%) scale(2.2)"><div class="hs" onclick="event.stopPropagation();TAPS.push('hs')" style="position:absolute;left:45%;top:45%;width:5%;height:5%"></div></div></div></div>`); });
  const tf = () => p.evaluate(() => document.querySelector('#tz .dg').style.transform.replace(/(-?[\d.]+)%/g, (m, v) => (+v).toFixed(0) + '%').replace(/,\s*/g, ','));
  await p.mouse.move(300, 250); await p.mouse.down(); await p.mouse.move(340, 280, { steps: 4 }); await p.mouse.up(); await p.mouse.click(300, 250, { delay: 0 }).catch(() => {});
  const t1 = await tf();
  ok(t1 === 'translate(-30%,-30%) scale(2.2)', 'drag moves the close-up with the pointer: ' + t1);
  ok((await p.evaluate(() => TAPS.length)) === 0, 'a drag (and the click right after it) is not a tap');
  await p.mouse.move(300, 250); await p.mouse.down(); await p.mouse.move(1200, 880, { steps: 5 }); await p.mouse.up();
  ok((await tf()) === 'translate(0%,0%) scale(2.2)', 'never past the top-left edge');
  await p.mouse.move(300, 250); await p.mouse.down(); await p.mouse.move(-900, -900, { steps: 5 }); await p.mouse.up();
  ok((await tf()) === 'translate(-120%,-120%) scale(2.2)', 'never past the bottom-right edge');
  await p.waitForTimeout(450); await p.mouse.move(300, 250); await p.mouse.wheel(-40, -60); const t2 = await tf();
  ok(t2 === 'translate(-110%,-100%) scale(2.2)', 'wheel / two fingers move it too: ' + t2);
  await p.waitForTimeout(450);
  const hb = await p.evaluate(() => { const r = document.querySelector('#tz .hs').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.evaluate(() => { document.querySelector('#tz .dg').style.transform = 'translate(-40%,-40%) scale(2.2)'; }); await p.waitForTimeout(800);
  const hb2 = await p.evaluate(() => { const r = document.querySelector('#tz .hs').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.mouse.click(hb2[0], hb2[1]);
  const tp = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return TAPS.join() + ' @' + (e && e.className) + ' ' + x + ',' + y; }, hb2);
  ok(tp.startsWith('hs '), 'a plain tap on a number still picks it ' + tp);
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
} catch (e) { ok(false, 'error ' + e.stack); }
finally { await b.close(); srv.kill(); }
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
