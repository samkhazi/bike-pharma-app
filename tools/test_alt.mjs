// 2026-10-12 update 8h: the web agent for part numbers that none of our catalogues has (lib/altagent.mjs, tools/altno.py).
// A fake Anthropic API on 127.0.0.1:3099 answers the way Claude with web search does. Start the server against it, then the test:
//   PORT=3018 ALT_API_URL=http://127.0.0.1:3099 ALT_TICK_MS=700 node server.mjs      (admin login sam@bikepharma.com / Test@1234)
//   BASE4=http://127.0.0.1:3018 OUT=<dir> node tools/test_alt.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018', OUT = process.env.OUT || '/tmp/claude-0/bptest4/out';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync(OUT, { recursive: true });

// ---- the fake Anthropic API
const calls = [];
const WEB = {
  '36JG0016': { scribd: 1, name: 'KIT PIST.RING KTM125 EXP.', brand: 'KTM', bikes: 'KTM 125 Duke', alts: [], url: 'https://www.scribd.com/document/636020126/ktm-kit-list' },
  AB12345678: { name: 'BEARING CONE KIT', brand: 'Bajaj', bikes: 'Pulsar 150', alts: [{ pn: '36JG0011', how: 'new' }, { pn: 'QQ00000001', how: 'old' }], url: 'https://parts.example.com/ab' },
  PT12345678: { pause: 1, name: 'Piston ring kit', brand: 'KTM', bikes: '', alts: [{ pn: '36JU0138', how: 'same part' }], url: 'https://p.example.com/pt' },
};
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (String(req.headers['x-api-key'] || '').startsWith('sk-ant-bad')) return send(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    if (req.method === 'GET' && req.url.startsWith('/v1/models/')) return send(200, { id: decodeURIComponent(req.url.slice(11)), type: 'model', capabilities: { server_tools: { web_search: { supported: true } } } });
    if (req.method !== 'POST' || req.url !== '/v1/messages') return send(404, { type: 'error', error: { message: 'not found' } });
    const j = JSON.parse(body), pn = /Part number: (\S+)/.exec(j.messages[0].content)[1];
    const sc = !!(j.tools[0].allowed_domains || []).includes('scribd.com');
    calls.push({ pn, model: j.model, n: j.messages.length, tools: j.tools, sc });
    if (pn === 'ER12345678') return send(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    const usage = { input_tokens: 9000, output_tokens: 250, server_tool_use: { web_search_requests: 1 } }, w = WEB[pn] && !!WEB[pn].scribd === sc ? WEB[pn] : null;
    if (!w) return send(200, { content: [{ type: 'text', text: 'No page lists this number.\n```json\n{"found": false, "note": "No page has it."}\n```' }], stop_reason: 'end_turn', usage });
    const search = [{ type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: '"' + pn + '"' } },
      { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [{ type: 'web_search_result', url: w.url, title: 'Parts list', encrypted_content: 'x', page_age: null }] }];
    if (w.pause && j.messages.length === 1) return send(200, { content: search, stop_reason: 'pause_turn', usage });
    const fin = [{ type: 'text', text: pn + ' is listed as ' + w.name + '.', citations: [{ type: 'web_search_result_location', url: w.url, title: 'Parts list', cited_text: pn + ' ' + w.name, encrypted_index: 'x' }] },
      { type: 'text', text: '\n```json\n' + JSON.stringify({ found: true, name: w.name, brand: w.brand, bikes: w.bikes, alts: w.alts.map(a => ({ ...a, url: w.url })), note: 'From one parts list.' }) + '\n```' }];
    send(200, { content: w.pause ? fin : [...search, ...fin], stop_reason: 'end_turn', usage });
  });
});
await new Promise(r => mock.listen(3099, '127.0.0.1', r));

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/app.html', { waitUntil: 'load' });
await p.waitForFunction(() => typeof S !== 'undefined' && S.stack && S.stack.length && cur().s !== 'boot', null, { timeout: 15000 });
await p.fill('#loginId', 'sam@bikepharma.com'); await p.evaluate(() => sendOtp()); await p.waitForTimeout(500);
await p.fill('#pw1', 'Test@1234'); await p.evaluate(() => pwGo()); await p.waitForTimeout(900);
ok(await p.evaluate(() => S.user && S.user.role === 'admin'), 'admin logged in');
const api = o => p.evaluate(o => (o ? altPost(o) : fetch('/api/alt', { cache: 'no-store' }).then(r => r.json())), o);
const item = async pn => (await api()).admin.items.find(it => it.pn === pn);
const until = async (f, ms = 30000) => { const t = Date.now(); for (;;) { const v = await f(); if (v || Date.now() - t > ms) return v; await new Promise(r => setTimeout(r, 400)); } };
const screen = () => p.evaluate(() => document.querySelector('#vp .screen').innerText);
// a clean list, no key
for (const it of (await api()).admin.items) await api({ act: 'del', pn: it.pn });
await api({ act: 'key', key: '' }); await api({ act: 'cfg', on: true, perDay: 200 });
const use0 = (await api()).admin.use;

// ---- More > Alternate numbers, before a key
await p.evaluate(() => go('more')); await p.waitForTimeout(400);
ok(/Alternate numbers/.test(await screen()), 'More lists Alternate numbers (under Catalogue files)');
await p.evaluate(() => { ALTC.t = 0; go('altno'); }); await until(() => p.evaluate(() => !!ALTC.adm)); await p.waitForTimeout(300);
let t = await screen();
ok(/Off · no key/i.test(t) && /No numbers yet/.test(t), 'Alternate numbers: agent off (no key yet), nothing in the list');

// ---- Find Part: 36JG0016 is in no catalogue -> says so, Search on Google, and goes to the agent's list by itself
const fp = async q => { await p.evaluate(q => { ALTC.t = 0; go('findpart', { v: 'res', q }); }, q);
  return until(async () => { const x = await screen(); return /found in|parts? for|another number/.test(x) && !/Loading|Searching the/.test(x) ? x : null; }, 40000); };
t = await fp('36JG0016');
ok(/No “36JG0016” found/.test(t) && /Admin can add this number’s other number/.test(t), 'Find Part 36JG0016: not found, the agent line shows (' + (t || '').split('\n').find(l => /web agent|Admin can/.test(l)) + ')');
ok(await p.evaluate(() => { const a = [...document.querySelectorAll('.alt-note a')].find(a => /Google/.test(a.textContent)); return a && a.target === '_blank' && a.href === 'https://www.google.com/search?q=%2236JG0016%22'; }), 'Search on Google opens Google for "36JG0016" in a new tab');
await p.screenshot({ path: OUT + '/alt-fp-none.png' });
let it = await until(() => item('36JG0016'), 5000);
ok(it && it.st === 'wait' && it.from.includes('Find Part'), 'the number went to the agent list from Find Part: ' + JSON.stringify(it && [it.st, it.from]));
ok((await api({ act: 'ask', pn: '36JG0011', from: 'findpart' })).st === 'incat' && !(await item('36JG0011')), 'a number our Bajaj catalogue has (36JG0011) is never queued');
ok((await api({ act: 'ask', pn: '36JG', from: 'findpart' })).error === 'Not a part number.', 'a too short number is refused');
ok((await api({ act: 'ask', pn: '36JG00', from: 'findpart' })).st === 'part' && !(await item('36JG00')), 'a number typed only in part (36JG00 of 36JG0011) is not queued');

// ---- the key: a wrong one is refused, a right one switches the agent on
let r = await api({ act: 'key', key: 'sk-ant-bad' + 'x'.repeat(30) });
ok(r.error && /refused/.test(r.error), 'a refused key: ' + r.error);
r = await api({ act: 'key', key: 'sk-ant-test' + 'x'.repeat(30) });
ok(r.ok && r.model === 'claude-haiku-5-5', 'the key is checked and kept on the server; AI ' + r.model);
ok(!JSON.stringify(await api()).includes('sk-ant-test'), 'the key never comes back to the app (only its last 4 letters)');

// ---- the agent looks 36JG0016 up
it = await until(async () => { const x = await item('36JG0016'); return x && x.st === 'found' && x; });
ok(it && it.res.name === 'KIT PIST.RING KTM125 EXP.' && it.res.where === 'scribd' && it.res.cites.length === 1 && /^https:\/\/www\.scribd\.com\//.test(it.res.cites[0].url),
  'agent: 36JG0016 = ' + (it && it.res.name) + ', found on Scribd, with the page it read');
ok(it && it.res.maybe.length && it.res.maybe[0].pn === '36JU0138' && it.res.maybe[0].brand === 'KTM',
  'our catalogue part with the same name, 125 cc first: ' + (it && it.res.maybe.map(m => m.pn + ' ' + m.desc + ' [' + m.models.slice(0, 2).join(', ') + ']').slice(0, 3).join(' | ')));
const c0 = calls.find(c => c.pn === '36JG0016');
ok(c0 && c0.model === 'claude-haiku-5-5' && c0.tools[0].type === 'web_search_20250305' && c0.sc && calls.filter(c => c.pn === '36JG0016').length === 1, 'asked Claude with web search on scribd.com first: found there, no whole-web search');

await p.evaluate(() => { go('altno'); altLoad(true); }); await p.waitForTimeout(900);
t = await screen();
ok(/To check/.test(t) && /On Scribd: KIT PIST\.RING KTM125 EXP\./.test(t) && /36JU0138/.test(t) && /Pages it read: Parts list/i.test(t) && /This is it/i.test(t),
  'Alternate numbers: 36JG0016 to check, with the web name, the page and This is it');
await p.screenshot({ path: OUT + '/alt-admin.png', fullPage: true });
await p.click('.alt-opt:has-text("36JU0138") button'); await p.waitForTimeout(900);
it = await item('36JG0016');
ok(it.st === 'ok' && it.dec.alt === '36JU0138' && it.dec.brand === 'KTM', 'This is it: 36JG0016 = 36JU0138 approved (' + it.dec.name + ')');

// ---- Find Part 36JG0016 now shows the KTM 125 piston ring kit
t = await fp('36JG0016');
ok(/36JG0016 is another number for 36JU0138/.test(t) && /36JU0138/.test(t) && !/No “36JG0016” found/.test(t), 'Find Part 36JG0016 shows 36JU0138\'s parts with the line: ' + (t || '').split('\n').find(l => /another number/.test(l)));
await p.screenshot({ path: OUT + '/alt-fp-ok.png' });

// ---- more answers: web numbers in our catalogue, a long search (pause_turn), nothing on the web
for (const pn of ['AB12345678', 'PT12345678', 'ZZ99990001']) await api({ act: 'add', pn });
await until(async () => { const L = (await api()).admin.items; return ['AB12345678', 'PT12345678', 'ZZ99990001'].every(pn => { const x = L.find(i => i.pn === pn); return x && !['wait', 'run'].includes(x.st); }); });
const ab = await item('AB12345678'), pt = await item('PT12345678'), zz = await item('ZZ99990001');
ok(ab.st === 'found' && ab.res.where === 'web' && calls.filter(c => c.pn === 'AB12345678').map(c => c.sc).join() === 'true,false' && ab.res.alts[0].cat && ab.res.alts[0].cat.brand === 'Bajaj' && !ab.res.alts[1].cat && !ab.res.maybe.length,
  'not on Scribd, then the whole web: 36JG0011 is in our Bajaj catalogue (' + (ab.res.alts[0].cat && ab.res.alts[0].cat.desc) + '), QQ00000001 is not');
ok(pt.st === 'found' && pt.res.alts[0].cat && pt.res.alts[0].cat.pn === '36JU0138' && calls.filter(c => c.pn === 'PT12345678').map(c => c.n).join() === '1,1,2',
  'a long web search (pause_turn) is continued: ' + calls.filter(c => c.pn === 'PT12345678').length + ' calls');
ok(zz.st === 'none' && zz.tries === 1 && zz.next > Date.now() + 6 * 86400e3, 'nothing on the web: Not found, next try in 7 days');
r = await api({ act: 'ok', pn: 'ZZ99990001', alt: 'QQ00000001' });
ok(r.error && /not in our catalogues either/.test(r.error), 'Admin cannot approve a number that is in no catalogue: ' + r.error);
await p.evaluate(() => { go('altno'); altLoad(true); }); await p.waitForTimeout(900);
await p.fill('#altm-AB12345678', '36jg0011'); await p.click('.alt-card:has-text("AB12345678") .alt-man button'); await p.waitForTimeout(900);
ok((await item('AB12345678')).dec.alt === '36JG0011', 'Admin typed the other number by hand (36jg0011): approved as 36JG0011');
const use = (await api()).admin.use;
ok(use.today - use0.today === 4 && use.searches - use0.searches === 8 && use.inr > use0.inr, `use counted: 4 numbers looked up, ${use.searches - use0.searches} web searches (today ${use.today}, about ₹${use.inr} this month)`);

// ---- the day's limit: with today's numbers used up, a new number waits for tomorrow
await api({ act: 'cfg', perDay: use.today }); await api({ act: 'add', pn: 'LM12345678' }); await new Promise(r => setTimeout(r, 3000));
ok((await item('LM12345678')).st === 'wait' && !calls.some(c => c.pn === 'LM12345678'), `numbers a day = ${use.today}, all used: LM12345678 waits, Claude is not asked`);
await api({ act: 'del', pn: 'LM12345678' }); await api({ act: 'cfg', perDay: 200 });
// ---- Anthropic busy: the number waits, the page says so, the agent pauses
await api({ act: 'add', pn: 'ER12345678' });
await until(async () => (await api()).admin.cfg.err);
const g = await api(), er = g.admin.items.find(i => i.pn === 'ER12345678');
ok(er.st === 'wait' && /busy|error 529/.test(g.admin.cfg.err.msg) && g.admin.cfg.pause > Date.now(), 'Anthropic error: number back in the queue, agent waits (' + g.admin.cfg.err.msg + ')');
await p.evaluate(() => { go('altno'); altLoad(true); }); await p.waitForTimeout(700);
ok(/tries again in 10 minutes/.test(await screen()), 'the error shows on the Alternate numbers page');
await api({ act: 'del', pn: 'ER12345678' }); await api({ act: 'cfg', on: true });

// ---- Stock in: a line marked Not in a catalogue goes to the agent when the bill is saved
await p.evaluate(() => { S.ui.ge = { supplier: '', inv: '', items: [], nw: [{ k: 'x1', hand: 1, pn: 'HS12345678', pk: 'HS12345678', q: 1 }] }; try { geSave(false); } catch (e) {} });
it = await until(() => item('HS12345678'), 5000);
ok(it && it.from.includes('Stock in'), 'Stock in: the Not in a catalogue line went to the agent list');

// ---- phone
const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, storageState: await p.context().storageState() })).newPage();
ph.on('pageerror', e => errs.push('phone: ' + e.message));
await ph.goto(BASE + '/app.html', { waitUntil: 'load' });
await ph.waitForFunction(() => typeof S !== 'undefined' && S.user, null, { timeout: 15000 });
await ph.evaluate(() => go('altno')); await ph.waitForFunction(() => ALTC.adm, null, { timeout: 10000 }); await ph.waitForTimeout(500);
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= 390 && [...document.querySelectorAll('.alt-card,.alt-agent')].every(e => e.getBoundingClientRect().right <= 391)),
  'phone: the page fits 390 px, no sideways scroll');
await ph.screenshot({ path: OUT + '/alt-phone.png', fullPage: true });
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
for (const it of (await api()).admin.items) await api({ act: 'del', pn: it.pn });
await api({ act: 'key', key: '' }); await api({ act: 'cfg', on: true, perDay: 10 });
await b.close(); mock.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
