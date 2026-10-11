// 2026-10-10: landing page first, desktop login without the left panel, Find Part empty state while no catalogue is uploaded
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function page(ctx) { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); }); return p; }
const bootApp = async (p) => { await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 }); await p.waitForTimeout(500); };

// ---- landing page opens first on a computer; Log in opens the app; #login deep link still works
const cD = await b.newContext({ viewport: { width: 1366, height: 860 } }); const D = await page(cD);
await D.goto(BASE + '/', { waitUntil: 'load' }); await D.waitForTimeout(800);
ok(await D.evaluate(() => document.getElementById('appv').hidden && !document.body.classList.contains('appopen')), 'desktop: landing page shows first (app view hidden)');
ok(await D.evaluate(() => { const h = document.querySelector('.hero-art'); return !!h && h.getBoundingClientRect().height > 200; }), 'desktop: hero with the bike is visible');
await D.click('[data-login]'); await D.waitForTimeout(300);
ok(await D.evaluate(() => !document.getElementById('appv').hidden), 'desktop: Log in opens the app view');
await D.waitForTimeout(1500); const fr = D.frames().find(f => f !== D.mainFrame()); await fr.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s === 'login', null, { timeout: 15000 });
await D.waitForTimeout(600);
ok(await fr.evaluate(() => document.documentElement.classList.contains('wv-login')), 'desktop login: wide login mode on');
ok(await fr.evaluate(async () => { const f = window.claude && claude.use && await claude.use('files'); return !!(f && f.list && f.read); }), 'website frame: the app reads catalogue files from this server (diagrams open inside the website too)');
ok(await fr.evaluate(() => { const h = document.querySelector('.screen>.hero'); return !h || h.getBoundingClientRect().width === 0; }), 'desktop login: left brand panel gone');
ok(await fr.evaluate(() => { const s = document.querySelector('.screen>.sheet-card'); return s && s.getBoundingClientRect().width > innerWidth * 0.95; }), 'desktop login: form card spans the page');
ok(await fr.evaluate(() => { const l = document.querySelector('.sheet-card>.lg-lang'); return l && l.getBoundingClientRect().height > 10 && l.querySelectorAll('button').length === 3; }), 'desktop login: EN/KN/HI pills kept inside the form card');
ok(await fr.evaluate(() => { const i = document.getElementById('loginId'); const r = i.getBoundingClientRect(); return r.width > 300 && r.left > 200 && (innerWidth - r.right) > 200; }), 'desktop login: login field centred');
ok(await fr.evaluate(() => !document.querySelector('.wv-lgh')), 'desktop login: "Genuine parts. Trusted mechanics." heading no longer injected');
await D.screenshot({ path: '/tmp/claude-0/bptest/login-desktop.png' });
ok(!(await D.$('#appClose')) && !(await D.content()).includes('Back to website'), 'desktop: no "Back to website" button');
await D.goBack(); await D.waitForTimeout(400);
ok(await D.evaluate(() => document.getElementById('appv').hidden), 'desktop: browser Back returns to the landing page');
await D.goto(BASE + '/#login', { waitUntil: 'load' }); await D.waitForTimeout(800);
ok(await D.evaluate(() => !document.getElementById('appv').hidden), 'desktop: /#login opens the app directly');

// ---- phone keeps the app layout with the brand hero
const cP = await b.newContext({ viewport: { width: 390, height: 844 } }); const P = await page(cP);
await P.goto(BASE + '/app.html', { waitUntil: 'load' }); await bootApp(P);
ok(await P.evaluate(() => cur().s === 'login' && !document.documentElement.classList.contains('wv-login')), 'phone: login screen, not wide mode');
ok(await P.evaluate(() => { const h = document.querySelector('.screen>.hero'); return h && h.getBoundingClientRect().height > 100 && h.querySelector('.lg-lang'); }), 'phone: brand hero + language pills unchanged');

// ---- staff: Find Part has only the brands whose catalogue is in (11 Oct: KTM, Husqvarna, Hero, Royal Enfield, Yamaha, Honda, TVS, Bajaj, Suzuki), the rest say coming soon (no claude.ai links, no errors)
const cS = await b.newContext({ viewport: { width: 1366, height: 860 } }); const Sx = await page(cS);
await Sx.goto(BASE + '/app.html', { waitUntil: 'load' }); await bootApp(Sx);
await Sx.fill('#loginId', 'sam@bikepharma.com'); await Sx.evaluate(() => sendOtp()); await Sx.waitForTimeout(500);
ok(await Sx.evaluate(() => cur().s === 'pw'), 'admin: password screen');
await Sx.fill('#pw1', 'Test@1234'); await Sx.evaluate(() => pwGo()); await Sx.waitForTimeout(800);
ok(await Sx.evaluate(() => S.user && S.user.role === 'admin'), 'admin: logged in');
ok(await Sx.evaluate(() => window.CAT_OFF === false && CAT_ALL.map(e => e.vb).sort().join() === 'Bajaj,Hero,Honda,Husqvarna,KTM,Royal Enfield,Suzuki,TVS,Yamaha'), 'admin: catalogue manifest = the 9 brands whose files are on the server');
// Any brand part number search opens a brand only when the typed number has the shape of that brand's numbers (catRoute): every brand's own numbers must route to it
const route = await Sx.evaluate(async () => { const bad = []; let n = 0;
  for (const e of CAT_ALL) { const d = await (await fetch(e.url)).json(); const step = Math.max(1, Math.floor(d.d.length / 400));
    for (let i = 0; i < d.d.length; i += step) { const k = catPk(d.d[i][5]); if (k.length < 5) continue; n++; if (!catRoute(k).l.includes(e)) bad.push(e.vb + ' ' + k); } }
  return { n, bad: bad.slice(0, 5), nb: bad.length }; });
ok(route.n > 2500 && route.nb === 0, `Any brand part number search: ${route.n} sampled numbers of the 9 brands all route to their own brand ${route.nb ? JSON.stringify(route.bad) : ''}`);
await Sx.evaluate(() => go('findpart')); await Sx.waitForTimeout(600);
ok(await Sx.evaluate(() => cur().s === 'findpart' && /9 of \d+ brands in/.test(document.body.innerText) && document.body.innerText.includes('Catalogue coming soon')), 'admin: Find Part shows the 9 brands in, other brands coming soon');
ok(await Sx.evaluate(() => !document.querySelector('a[href*="claude.ai"]')), 'admin: no claude.ai links on the screen');
await Sx.screenshot({ path: '/tmp/claude-0/bptest/findpart-home.png' });
await Sx.evaluate(() => go('usearch')); await Sx.waitForTimeout(400);
const q = await Sx.$('input[type="search"], .inp input'); if (q) { await q.fill('clutch plate'); await Sx.waitForTimeout(900); }
ok(await Sx.evaluate(() => cur().s === 'usearch'), 'admin: search screen works with no catalogue (no crash)');
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
