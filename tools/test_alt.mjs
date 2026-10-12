// 2026-10-12 update 8h: the web agent for part numbers that none of our catalogues has (lib/altagent.mjs, tools/altno.py).
// Update 8i: the alternate number list Sam gave (oemship.com, KTM/Bajaj/Triumph: public/cat/alt/lists.json) answers with no key and no
// approval; the web agent searches Scribd, then oemship.com, then the whole web.
// A fake Anthropic API on 127.0.0.1:3099 answers the way Claude with web search does. Start the server against it, then the test:
//   PORT=3018 ALT_API_URL=http://127.0.0.1:3099 ALT_TICK_MS=700 node server.mjs      (admin login sam@bikepharma.com / Test@1234)
//   BASE4=http://127.0.0.1:3018 OUT=<dir> node tools/test_alt.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const BASE = process.env.BASE4 || 'http://127.0.0.1:3018', OUT = process.env.OUT || '/tmp/claude-0/bptest4/out';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync(OUT, { recursive: true });

// ---- the fake Anthropic API
const calls = [];
const WEB = {
  '36JX9016': { where: 'scribd', name: 'KIT PIST.RING KTM125 EXP.', brand: 'KTM', bikes: 'KTM 125 Duke', alts: [], url: 'https://www.scribd.com/document/636020126/ktm-kit-list' },
  OE12345678: { where: 'oemship', name: 'BEARING CONE KIT', brand: 'Bajaj', bikes: 'Pulsar 150', alts: [{ pn: '36JG0011', how: 'alternate' }], url: 'https://oemship.com/product/bearing-cone-kit/' },
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
    const doms = j.tools[0].allowed_domains || [], dom = doms.includes('scribd.com') ? 'scribd' : doms.includes('oemship.com') ? 'oemship' : 'web';
    calls.push({ pn, model: j.model, n: j.messages.length, tools: j.tools, dom });
    if (pn === 'ER12345678') return send(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    const usage = { input_tokens: 9000, output_tokens: 250, server_tool_use: { web_search_requests: 1 } }, w = WEB[pn] && (WEB[pn].where || 'web') === dom ? WEB[pn] : null;
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

// ---- Find Part: 36JX9016 is in no catalogue and in no list -> says so, Search on Google, and goes to the agent's list by itself
const fp = async q => { await p.evaluate(q => { ALTC.t = 0; go('findpart', { v: 'res', q }); }, q);
  return until(async () => { const x = await screen(); return /found in|parts? for|another number/.test(x) && !/Loading|Searching the/.test(x) ? x : null; }, 40000); };
t = await fp('36JX9016');
ok(/No “36JX9016” found/.test(t) && /Admin can add this number’s other number/.test(t), 'Find Part 36JX9016: not found, the agent line shows (' + (t || '').split('\n').find(l => /web agent|Admin can/.test(l)) + ')');
ok(await p.evaluate(() => { const a = [...document.querySelectorAll('.alt-note a')].find(a => /Google/.test(a.textContent)); return a && a.target === '_blank' && a.href === 'https://www.google.com/search?q=%2236JX9016%22'; }), 'Search on Google opens Google for "36JX9016" in a new tab');
await p.screenshot({ path: OUT + '/alt-fp-none.png' });
let it = await until(() => item('36JX9016'), 5000);
ok(it && it.st === 'wait' && it.from.includes('Find Part'), 'the number went to the agent list from Find Part: ' + JSON.stringify(it && [it.st, it.from]));
ok((await api({ act: 'ask', pn: '36JG0011', from: 'findpart' })).st === 'incat' && !(await item('36JG0011')), 'a number our Bajaj catalogue has (36JG0011) is never queued');
ok((await api({ act: 'ask', pn: '36JG', from: 'findpart' })).error === 'Not a part number.', 'a too short number is refused');
ok((await api({ act: 'ask', pn: '36JG00', from: 'findpart' })).st === 'part' && !(await item('36JG00')), 'a number typed only in part (36JG00 of 36JG0011) is not queued');

// ---- update 8i: the oemship.com list (KTM, Bajaj, Triumph) answers at once, with no key and no approval
let r = await api({ act: 'ask', pn: '36JG0016', from: 'findpart' });
ok(r.st === 'list' && r.alt === '36JU0138' && !(await item('36JG0016')), 'list: 36JG0016 is answered by the oemship list (36JU0138), not queued for the web');
const line = (t, re) => (t || '').split('\n').find(l => re.test(l));
t = await fp('36JG0016');
ok(/36JG0016 is the new number of 36JU0138 \(KIT PISTON RING 125\)\. From the oemship\.com alternate list \(KTM, Bajaj, Triumph\)\./.test(t) && !/No “36JG0016” found/.test(t) && /\d+ parts? for “36JG0016”/.test(t),
  'Find Part 36JG0016 shows 36JU0138\'s parts: ' + line(t, /new number/));
await p.screenshot({ path: OUT + '/alt-list-fp.png' });
t = await fp('36JU0138');
ok(/New number: 36JG0016 \(KIT PIST\.RING KTM125 EXP\.\)\. From the oemship\.com/.test(t), 'Find Part 36JU0138 (in our KTM catalogue) names its new number: ' + line(t, /New number/));
t = await fp('36DH4194');
ok(/36DH4194 is an old number\. Its new number is 36PD0050/.test(t) && !/No “36DH4194” found/.test(t), 'Find Part 36DH4194 (an old number) shows the new number\'s parts: ' + line(t, /old number/));
t = await fp('T3850209-EN');
ok(/gives its new number T3850302-EN \(HBK ASSY, DTC, EN\), but our catalogues do not have that number either/.test(t), 'Find Part T3850209-EN (Triumph, no catalogue): ' + line(t, /gives its/));
it = await until(() => item('T3850209-EN'), 5000);
ok(it && it.st === 'wait', 'a list number whose other number no catalogue has still goes to the web agent');
await api({ act: 'del', pn: 'T3850209-EN' });
r = await api({ act: 'add', pn: '36JG0016' });
ok(r.st === 'list' && /oemship\.com alternate list.*the same part as 36JU0138/.test(r.error) && !(await item('36JG0016')), 'Look up a number 36JG0016: ' + r.error);
await p.evaluate(() => { S.ui.ap = null; S.ui.apErr = null; go('addproduct'); }); await p.waitForTimeout(300);
await p.fill('#ap-pn', '36JG0016');
await p.waitForFunction(() => S.ui.ap && S.ui.ap.look === '36JG0016' && document.querySelector('#vp .screen:last-child :is(.inv-found,.inv-pick,.inv-none,.inv-dup)'), null, { timeout: 90000 }); await p.waitForTimeout(200);
t = await p.evaluate(() => document.querySelector('#vp .screen:last-child').innerText);
ok(/gives its old number 36JU0138 \(KIT PISTON RING 125\)\. Type that number in Part number/.test(t), 'Add product 36JG0016: ' + line(t, /gives its/));
await p.evaluate(() => { S.ui.ap = null; go('more'); });
// a number that waited before the list came: the list answers it, and Admin's Not right turns the list's answer off
const LF = fileURLToPath(new URL('../public/cat/alt/lists.json', import.meta.url));
fs.renameSync(LF, LF + '.off');
try { r = await api({ act: 'add', pn: '36JG0016' }); } finally { fs.renameSync(LF + '.off', LF); }
ok(r.st === 'wait', 'with the list file away, 36JG0016 waits in the queue');
it = await until(async () => { const x = await item('36JG0016'); return x && x.st === 'ok' && x; }, 15000);
ok(it && it.dec.list && it.dec.alt === '36JU0138' && /oemship/.test(it.dec.by), 'the list is back: the waiting 36JG0016 is answered from it (' + (it && it.dec.by) + ')');
await p.evaluate(() => { go('altno'); altLoad(true); }); await p.waitForTimeout(900);
t = await screen();
ok(/Alternate number lists/.test(t) && /oemship\.com alternate list \(KTM, Bajaj, Triumph\): 3,701 number pairs/.test(t) && /From the oemship\.com alternate list/.test(t),
  'Alternate numbers page: the list with 3,701 pairs, and 36JG0016 answered from it');
await p.screenshot({ path: OUT + '/alt-list-admin.png', fullPage: true });
await p.click('.alt-card:has-text("36JG0016") button:has-text("Not right")'); await p.waitForTimeout(900);
ok((await item('36JG0016')).st === 'no', 'Not right: the list\'s answer for 36JG0016 is off');
t = await fp('36JG0016');
ok(/No “36JG0016” found/.test(t), 'after Not right, Find Part 36JG0016 does not use the list');
await api({ act: 'del', pn: '36JG0016' });

// ---- the key: a wrong one is refused, a right one switches the agent on
r = await api({ act: 'key', key: 'sk-ant-bad' + 'x'.repeat(30) });
ok(r.error && /refused/.test(r.error), 'a refused key: ' + r.error);
r = await api({ act: 'key', key: 'sk-ant-test' + 'x'.repeat(30) });
ok(r.ok && r.model === 'claude-haiku-5-5', 'the key is checked and kept on the server; AI ' + r.model);
ok(!JSON.stringify(await api()).includes('sk-ant-test'), 'the key never comes back to the app (only its last 4 letters)');

// ---- the agent looks 36JX9016 up
it = await until(async () => { const x = await item('36JX9016'); return x && x.st === 'found' && x; });
ok(it && it.res.name === 'KIT PIST.RING KTM125 EXP.' && it.res.where === 'scribd' && it.res.cites.length === 1 && /^https:\/\/www\.scribd\.com\//.test(it.res.cites[0].url),
  'agent: 36JX9016 = ' + (it && it.res.name) + ', found on Scribd, with the page it read');
ok(it && it.res.maybe.length && it.res.maybe[0].pn === '36JU0138' && it.res.maybe[0].brand === 'KTM',
  'our catalogue part with the same name, 125 cc first: ' + (it && it.res.maybe.map(m => m.pn + ' ' + m.desc + ' [' + m.models.slice(0, 2).join(', ') + ']').slice(0, 3).join(' | ')));
const c0 = calls.find(c => c.pn === '36JX9016');
ok(c0 && c0.model === 'claude-haiku-5-5' && c0.tools[0].type === 'web_search_20250305' && c0.dom === 'scribd' && calls.filter(c => c.pn === '36JX9016').length === 1, 'asked Claude with web search on scribd.com first: found there, no other search');

await p.evaluate(() => { go('altno'); altLoad(true); }); await p.waitForTimeout(900);
t = await screen();
ok(/To check/.test(t) && /On Scribd: KIT PIST\.RING KTM125 EXP\./.test(t) && /36JU0138/.test(t) && /Pages it read: Parts list/i.test(t) && /This is it/i.test(t),
  'Alternate numbers: 36JX9016 to check, with the web name, the page and This is it');
await p.screenshot({ path: OUT + '/alt-admin.png', fullPage: true });
await p.click('.alt-opt:has-text("36JU0138") button'); await p.waitForTimeout(900);
it = await item('36JX9016');
ok(it.st === 'ok' && it.dec.alt === '36JU0138' && it.dec.brand === 'KTM', 'This is it: 36JX9016 = 36JU0138 approved (' + it.dec.name + ')');

// ---- Find Part 36JX9016 now shows the KTM 125 piston ring kit
t = await fp('36JX9016');
ok(/36JX9016 is another number for 36JU0138/.test(t) && /36JU0138/.test(t) && !/No “36JX9016” found/.test(t), 'Find Part 36JX9016 shows 36JU0138\'s parts with the line: ' + (t || '').split('\n').find(l => /another number/.test(l)));
await p.screenshot({ path: OUT + '/alt-fp-ok.png' });

// ---- more answers: web numbers in our catalogue, a long search (pause_turn), nothing on the web
const MORE = ['AB12345678', 'PT12345678', 'ZZ99990001', 'OE12345678'];
for (const pn of MORE) await api({ act: 'add', pn });
await until(async () => { const L = (await api()).admin.items; return MORE.every(pn => { const x = L.find(i => i.pn === pn); return x && !['wait', 'run'].includes(x.st); }); });
const ab = await item('AB12345678'), pt = await item('PT12345678'), zz = await item('ZZ99990001'), oe = await item('OE12345678');
const doms = pn => calls.filter(c => c.pn === pn).map(c => c.dom).join();
ok(ab.st === 'found' && ab.res.where === 'web' && doms('AB12345678') === 'scribd,oemship,web' && ab.res.alts[0].cat && ab.res.alts[0].cat.brand === 'Bajaj' && !ab.res.alts[1].cat && !ab.res.maybe.length,
  'not on Scribd, not on oemship.com, then the whole web: 36JG0011 is in our Bajaj catalogue (' + (ab.res.alts[0].cat && ab.res.alts[0].cat.desc) + '), QQ00000001 is not');
ok(oe.st === 'found' && oe.res.where === 'oemship' && doms('OE12345678') === 'scribd,oemship' && oe.res.alts[0].cat && oe.res.alts[0].cat.pn === '36JG0011' && oe.res.cites[0].url.startsWith('https://oemship.com/'),
  'not on Scribd, found on oemship.com (' + doms('OE12345678') + '): no whole-web search');
ok(pt.st === 'found' && pt.res.alts[0].cat && pt.res.alts[0].cat.pn === '36JU0138' && calls.filter(c => c.pn === 'PT12345678').map(c => c.n).join() === '1,1,1,2',
  'a long web search (pause_turn) is continued: ' + calls.filter(c => c.pn === 'PT12345678').length + ' calls');
ok(zz.st === 'none' && zz.tries === 1 && zz.next > Date.now() + 6 * 86400e3 && doms('ZZ99990001') === 'scribd,oemship,web', 'nothing on Scribd, oemship.com or the web: Not found, next try in 7 days');
r = await api({ act: 'ok', pn: 'ZZ99990001', alt: 'QQ00000001' });
ok(r.error && /not in our catalogues either/.test(r.error), 'Admin cannot approve a number that is in no catalogue: ' + r.error);
await p.evaluate(() => { go('altno'); altLoad(true); }); await p.waitForTimeout(900);
ok(/On oemship\.com: BEARING CONE KIT/.test(await screen()), 'Alternate numbers: OE12345678 says On oemship.com');
await p.fill('#altm-AB12345678', '36jg0011'); await p.click('.alt-card:has-text("AB12345678") .alt-man button'); await p.waitForTimeout(900);
ok((await item('AB12345678')).dec.alt === '36JG0011', 'Admin typed the other number by hand (36jg0011): approved as 36JG0011');
const use = (await api()).admin.use;
ok(use.today - use0.today === 5 && use.searches - use0.searches === calls.length && use.inr > use0.inr, `use counted: 5 numbers looked up, ${use.searches - use0.searches} web searches (today ${use.today}, about ₹${use.inr} this month)`);

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
