// 2026-10-11: browser Back / Forward (Mac trackpad swipe) moves between the app's own screens, not out to the website
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } }); const D = await ctx.newPage();
const errs = []; D.on('pageerror', e => errs.push(e.message));
await D.goto(BASE + '/', { waitUntil: 'load' }); await D.waitForTimeout(600);
await D.click('[data-login]'); await D.waitForTimeout(400);
let FR = null; const F = () => FR && !FR.isDetached() ? FR : (FR = D.frames().find(f => f !== D.mainFrame() && !f.isDetached()));
// the app's frame once its script is running (a reload makes a new frame)
const appUp = async () => { for (let k = 0; k < 60; k++) { FR = null; for (const f of D.frames()) { if (f === D.mainFrame() || f.isDetached()) continue; if (await f.evaluate(() => typeof S !== 'undefined' && !!S.stack && S.stack.length > 0 && cur().s !== 'boot').catch(() => false)) { FR = f; return f; } } await D.waitForTimeout(250); } throw new Error('app frame not up'); };
await D.waitForTimeout(1500);
const A = F();
await A.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s === 'login', null, { timeout: 20000 });
A.page().on('pageerror', e => errs.push(e.message));
await A.fill('#loginId', 'sam@bikepharma.com'); await A.evaluate(() => sendOtp()); await A.waitForTimeout(600);
await A.fill('#pw1', process.env.PW || 'Test@1234'); await A.evaluate(() => pwGo()); await A.waitForTimeout(1200);
await A.evaluate(() => { if (cur().s === 'roleok') reset(HOME[S.user.role]); }); await A.waitForTimeout(400);
const scr = () => F().evaluate(() => S.stack.map(x => x.s).join('>'));
const home = await scr(); ok(/ahome|home/.test(home), 'logged in, home: ' + home);
await F().evaluate(() => go('users')); await D.waitForTimeout(250);
await F().evaluate(() => go('audit')); await D.waitForTimeout(250);
ok(await scr() === home + '>users>audit', 'went home > users > audit: ' + await scr());
await D.evaluate(() => history.back()); await D.waitForTimeout(400);
ok(await scr() === home + '>users', 'browser Back: back to users · ' + await scr());
ok(D.url().endsWith('#login') && await D.evaluate(() => !document.getElementById('appv').hidden), 'still inside the app (url ' + D.url() + ')');
await D.evaluate(() => history.forward()); await D.waitForTimeout(400);
ok(await scr() === home + '>users>audit', 'browser Forward: audit again · ' + await scr());
await F().evaluate(() => back()); await D.waitForTimeout(400);
ok(await scr() === home + '>users', 'app back button: users · ' + await scr());
await D.evaluate(() => history.back()); await D.waitForTimeout(400);
ok(await scr() === home, 'browser Back: home · ' + await scr());
await F().evaluate(() => tab('mgstaff')); await D.waitForTimeout(250);
await D.evaluate(() => history.back()); await D.waitForTimeout(400);
ok(await scr() === home, 'Back after a menu tab: home · ' + await scr());
// logged in: Back from the first screen never shows the website (Sam: no landing page until log out)
for (let k = 0; k < 3; k++) { await D.evaluate(() => history.back()); await D.waitForTimeout(600); }
ok(await D.evaluate(() => !document.getElementById('appv').hidden) && (await scr()) === home, 'logged in: 3 x Back from home stays in the app at home · ' + await scr());
// opening the website again while logged in goes straight into the app
await D.goto(BASE + '/', { waitUntil: 'load' }); await D.waitForTimeout(1500);
ok(await D.evaluate(() => !document.getElementById('appv').hidden && location.hash === '#login' && !document.documentElement.classList.contains('bp-in')), 'logged in: the website opens straight into the app');
await appUp();
ok(await scr() === home, 'logged in: app opened at home · ' + await scr());
await D.evaluate(() => history.back()); await D.waitForTimeout(600);
await appUp();
ok(await D.evaluate(() => !document.getElementById('appv').hidden) && (await scr()) === home, 'logged in: Back after opening the website still shows the app at home · ' + await scr());
// after log out, Back goes to the website again
await F().evaluate(() => logout()); await D.waitForTimeout(800);
ok(await F().evaluate(() => !S.user && cur().s === 'login'), 'logged out: login screen');
ok(await D.evaluate(() => localStorage.getItem('bp_in') === null), 'logged out: the browser no longer counts as logged in');
await D.evaluate(() => history.back()); await D.waitForTimeout(600);
ok(await D.evaluate(() => document.getElementById('appv').hidden), 'logged out: Back shows the website');
await D.goto(BASE + '/', { waitUntil: 'load' }); await D.waitForTimeout(800);
ok(await D.evaluate(() => document.getElementById('appv').hidden && getComputedStyle(document.querySelector('header')).visibility === 'visible'), 'logged out: the website opens on the landing page');
ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
console.log(fails ? fails + ' FAILED' : 'ALL OK');
await b.close(); process.exit(fails ? 1 : 0);
