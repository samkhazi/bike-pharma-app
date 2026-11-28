// VR Garage check (28 Nov, the "VR Garage answered 500" on the Vehicle number page). Run as root on the server:
//   cd /home/bikesurgeon-panel/htdocs/panel.bikesurgeon.online/front-door && <node> --env-file=.env tools/vr-check.js <vehicle number>
// It logs in with the login kept in .env and asks VR Garage for ONE number a few ways, the way VR Garage's own website asks
// (seen in Sam's DevTools video), and stops at the first way that works. Use a number VR Garage already has (one searched on
// its website): VR Garage then answers from its cache and takes no credit ("credit used: no").
// It prints only answer codes, VR Garage's messages and FIELD NAMES: never the login, the password, the token or the
// vehicle's data. It changes nothing (no file, no database row; the front door keeps running as it is).
'use strict';
const path = require('node:path');
const crypto = require('node:crypto');

const env = k => String(process.env[k] || '').trim();
const URL_ = env('VRGARAGE_URL') || 'https://vr-api.vecrep.com/fetch-vehicle';
const LOGIN_URL = new URL('garageLogin', URL_.replace(/[^/]*$/, '')).toString();
const EMAIL = env('VRGARAGE_EMAIL');
const PASS = env('VRGARAGE_PASS64') ? Buffer.from(env('VRGARAGE_PASS64'), 'base64').toString('utf8') : String(process.env.VRGARAGE_PASSWORD || '');
const REG = String(process.argv[2] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const SITE = { Origin: 'https://app.vrgarage.co', Referer: 'https://app.vrgarage.co/', Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };

// never show anything that looks like a token or a long code; no HTML; one short line
const tidy = s => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[A-Za-z0-9_-]{20,}(\.[A-Za-z0-9_-]{8,}){0,2}/g, '[hidden]')
  .replace(/\s+/g, ' ').trim().slice(0, 160);
function names(o, out = new Set(), seen = new Set()) {
  if (!o || typeof o !== 'object' || seen.has(o) || out.size > 50) return out; seen.add(o);
  for (const [k, v] of Object.entries(o)) { if (!/^\d+$/.test(k)) out.add(k); if (v && typeof v === 'object') names(v, out, seen); }
  return out;
}
function pickTok(j) {   // the first string under token / accessToken / access_token, any depth (as the front door does)
  const st = [j], seen = new Set();
  while (st.length) {
    const x = st.shift(); if (!x || typeof x !== 'object' || seen.has(x)) continue; seen.add(x);
    for (const [k, v] of Object.entries(x)) if (/^(token|accesstoken|access_token)$/i.test(k) && typeof v === 'string' && v.trim()) return { tok: v.trim(), at: k };
    for (const v of Object.values(x)) if (v && typeof v === 'object') st.push(v);
  }
  return { tok: '', at: '' };
}
function claims(tok) {  // the NAMES inside the token (a JWT), never their values
  const p = String(tok).replace(/^Bearer\s+/i, '').split('.');
  if (p.length !== 3) return `not a JWT (${p.length} part${p.length === 1 ? '' : 's'})`;
  try { return Object.keys(JSON.parse(Buffer.from(p[1], 'base64url').toString('utf8'))).join(', ') || '(empty)'; } catch { return 'unreadable'; }
}
async function post(url, body, headers) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000), t0 = Date.now();
  try {
    const r = await fetch(url, { method: 'POST', signal: ac.signal, body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Custom-Header': 'foobar', ...headers } });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* not JSON */ }
    return { st: r.status, j, t, ms: Date.now() - t0 };
  } catch (e) {
    return { st: 0, j: null, t: e.name === 'AbortError' ? 'no answer in 25 seconds' : String((e.cause && (e.cause.code || e.cause.message)) || e.message), ms: Date.now() - t0 };
  } finally { clearTimeout(to); }
}
const said = x => tidy((x.j && (x.j.message || x.j.error || x.j.msg || (x.j.errors && JSON.stringify(x.j.errors)))) || (x.j ? '' : x.t));
async function login(label, extra, site) {
  const x = await post(LOGIN_URL, { email: EMAIL, password: PASS, ...extra }, site ? SITE : {});
  const { tok, at } = x.j ? pickTok(x.j) : { tok: '', at: '' };
  console.log(`${label} login: HTTP ${x.st}${x.j && x.j.responseCode != null ? ', code ' + x.j.responseCode : ''}${said(x) ? ', says "' + said(x) + '"' : ''}`);
  console.log(`   its answer has: ${x.j ? [...names(x.j)].join(', ') : '(not JSON)'}`);
  if (tok) console.log(`   token found under "${at}"; the token holds: ${claims(tok)}`);
  else console.log('   NO token in the answer');
  return tok;
}
async function search(label, tok, headers) {
  const x = await post(URL_, { vehicleNumber: REG }, { Authorization: 'Bearer ' + tok.replace(/^Bearer\s+/i, ''), ...headers });
  const j = x.j || {}, res = j.result;
  const ok = x.st >= 200 && x.st < 300 && (j.responseCode == null || +j.responseCode === 200) && res && typeof res === 'object' && Object.keys(res).length > 0;
  let line = `${label} search: HTTP ${x.st}${j.responseCode != null ? ', code ' + j.responseCode : ''}, ${x.ms} ms`;
  if (j.source != null) line += `, source ${tidy(j.source)}`;
  if (j.debit != null) line += `, credit used: ${j.debit ? 'YES' : 'no'}`;
  if (said(x)) line += `, says "${said(x)}"`;
  console.log(line);
  if (ok) {
    console.log(`   answer fields: ${[...names(res)].join(', ')}`);
    try {
      const d = require(path.join(process.cwd(), 'server', 'vehicles.js')).rcMap(j);
      console.log(`   the Vehicle number page reads: ${Object.entries(d).filter(([, v]) => v).map(([k]) => k).join(', ') || 'NOTHING'}`);
    } catch (e) { console.log('   (the front door code could not be read: ' + tidy(e.message) + ')'); }
  }
  return ok;
}
function lastCalls() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const D = new DatabaseSync(path.resolve(process.cwd(), process.env.DB_FILE || 'data/front.db'), { readOnly: true });
    const rows = D.prepare('SELECT at, reg, kind, result, ms, note FROM vr_calls ORDER BY id DESC LIMIT 8').all(); D.close();
    console.log(`Last ${rows.length} searches on this server (newest first):`);
    for (const r of rows) {
      const t = new Date(Date.parse(r.at) + 5.5 * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
      const g = String(r.reg || ''); const m = g.length > 6 ? g.slice(0, 4) + '..' + g.slice(-2) : g;
      console.log(`   ${t} IST  ${m.padEnd(10)} ${String(r.kind).padEnd(6)} ${String(r.result).padEnd(8)} ${r.ms == null ? '' : r.ms + ' ms'}  ${tidy(r.note)}`);
    }
  } catch (e) { console.log('Last searches: could not be read (' + tidy(e.message) + ')'); }
}

(async () => {
  console.log('VR Garage check: no login, password, token or vehicle data is shown. Nothing is changed.');
  if (!EMAIL || !PASS) { console.log('STOP  the VR Garage login is not in .env (run: bash /root/bs-erp-update.sh vrgarage)'); process.exit(1); }
  if (!/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(REG) && !/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(REG)) {
    console.log('STOP  give a vehicle number after the command, one VR Garage already has (searched on its website)'); process.exit(1);
  }
  // 1. exactly as the front door does today
  const t1 = await login('1', { deviceToken: 'bikesurgeon', deviceId: 'bikesurgeon-erp', deviceName: 'web', ipAddress: '0.0.0.0', device: 'web' });
  if (t1 && await search('1', t1, {})) { console.log('RESULT  way 1 works: the request of the front door is right.'); return lastCalls(); }
  // 2. the same token, with the headers a browser adds (VR Garage's website sends Origin app.vrgarage.co)
  if (t1 && await search('2 (browser headers)', t1, SITE)) { console.log('RESULT  way 2 works: VR Garage wants the website\'s Origin header.'); return lastCalls(); }
  // 3. a login like the website's: a new device id (a UUID) and a random device token, browser headers
  const u = crypto.randomUUID();
  const t3 = await login('3 (like the website)', { deviceToken: crypto.randomBytes(8).toString('hex'), deviceId: u, uuid: u, deviceName: 'web', ipAddress: '0.0.0.0', device: 'web' }, true);
  if (t3 && await search('3', t3, SITE)) { console.log('RESULT  way 3 works: the login must look like the website\'s (device id).'); return lastCalls(); }
  console.log('RESULT  no way worked. Send me a screenshot of all of this.');
  lastCalls();
})().catch(e => { console.log('FAILED  ' + tidy(e.message)); process.exit(1); });
