// All of Bike Pharma's catalogues in the Bike Surgeon ERP (Sam, 28 Nov: "can u add all catalogues from bikepharma"). The
// Catalogue page in the one screen's menu is Bike Pharma's own Find Part (bikepharma.com/app.html), passed through this front
// door with Bike Surgeon's key: BP_CAT_KEY here = BS_CAT_KEY in bikepharma.com's .env (bash /root/bs-erp-update.sh catalogue
// makes it). Nothing is copied, so a catalogue Bike Pharma adds is here at once. With that key Bike Pharma's server opens Find
// Part only (no bills, customers, prices or stock of Bike Pharma, nothing saved there). Two questions are answered here instead:
//   /api/bsstock  Bike Surgeon's own stock of a part (the billing's cms_products, read only, read again every 2 minutes)
//   /api/rclook   a vehicle number (the Vehicle number page's saved answers and its VR Garage login: vehicles.rcFor)
// Safety: the page runs sealed off (CSP sandbox: no cookies, no way into the billing pages around it) and reaches only
// /__gate/cat/t/<ticket>/...; a ticket belongs to one sign in and stops with it (sign out, login switched off).
'use strict';
const https = require('node:https');
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const vehicles = require('./vehicles');

const env = k => String(process.env[k] || '').trim();
const base = () => (env('BP_CAT_URL') || 'https://bikepharma.com').replace(/\/+$/, '');
const catKey = () => env('BP_CAT_KEY');
const on = () => catKey().length >= 32;
let H = null;   // from index.js: { all, now }
function init(h) { H = h; }
const KEY_MSG = "Bike Pharma's server does not know Bike Surgeon's key yet. Owner: on the Bike Surgeon server run bash /root/bs-erp-update.sh catalogue and do the two steps it prints.";

// ---------------- tickets: /__gate/cat/t/<16 letters of the sign in><its seal> ------------------------------------------------
const mac = tok => crypto.createHmac('sha256', 'bs-catalogue|' + env('GATE_KEY')).update(String(tok)).digest('hex').slice(0, 32);
const ticketOf = s => String(s.token).slice(0, 16) + mac(s.token);
const known = new Map();   // ticket -> { who, until }: checked again after a minute
function whoOf(t) {
  if (!/^[0-9a-f]{48}$/.test(t)) return null;
  const c = known.get(t); if (c && c.until > Date.now()) return c;
  known.delete(t);
  const want = Buffer.from(t.slice(16));
  const rows = H.all(`SELECT s.token, l.name FROM sessions s JOIN logins l ON l.id = s.login_id
                      WHERE substr(s.token, 1, 16) = ? AND s.expires > ? AND l.active = 1`, t.slice(0, 16), H.now());
  const r = rows.find(x => crypto.timingSafeEqual(Buffer.from(mac(x.token)), want));
  if (!r) return null;
  if (known.size > 2000) known.clear();
  const v = { who: String(r.name || 'staff').slice(0, 80), until: Date.now() + 60000 };
  known.set(t, v);
  return v;
}
// the one screen asks for the page's address once (GET /__gate/cat-open)
const open = s => (on() ? { url: `/__gate/cat/t/${ticketOf(s)}/app.html` } : { off: true });

// ---------------- Bike Pharma's server ---------------------------------------------------------------------------------------
const agent = new https.Agent({ keepAlive: true, maxSockets: 24 });
function up(method, path, headers, body) {
  const u = new URL(base() + path), web = u.protocol === 'https:';
  return new Promise((resolve, reject) => {
    const r = (web ? https : http).request(u, { method, agent: web ? agent : undefined, timeout: 60000,
      headers: { ...headers, 'x-bs-cat': catKey(), 'user-agent': 'BikeSurgeonERP-catalogue/1', ...(body ? { 'content-length': body.length } : {}) } }, resolve);
    r.on('timeout', () => r.destroy(new Error('Bike Pharma did not answer in time')));
    r.on('error', reject);
    r.end(body || undefined);
  });
}
const read = (s, limit) => new Promise((resolve, reject) => { const parts = []; let n = 0;
  s.on('data', d => { n += d.length; if (n > limit) { s.destroy(); reject(new Error('Too large')); } else parts.push(d); });
  s.on('end', () => resolve(Buffer.concat(parts))); s.on('error', reject); });
// Bike Pharma takes the key (a staff file list answers; without the key it says "log in")
const PROBE = { ok: false, at: 0, msg: '' };
async function probe() {
  if (Date.now() - PROBE.at < (PROBE.ok ? 60000 : 10000)) return PROBE;
  try {
    const r = await up('GET', '/api/files/list?path=', { accept: 'application/json' }); r.resume();
    PROBE.ok = r.statusCode === 200 || r.statusCode === 404;
    PROBE.msg = PROBE.ok ? '' : r.statusCode === 401 ? KEY_MSG : `Bike Pharma's server answered ${r.statusCode}. Try again in a minute.`;
  } catch (e) { PROBE.ok = false; PROBE.msg = `Bike Pharma's server cannot be reached just now (${String(e.message).slice(0, 120)}). Try again in a minute.`; }
  PROBE.at = Date.now();
  return PROBE;
}

// ---------------- the page: Bike Pharma's app.html with a small start script ---------------------------------------------------
// The script: Bike Pharma's '/api/...' addresses go to this ticket's folder; the sealed box has no browser storage, so one in
// memory stands in; the menu passes a vehicle from the Vehicle number page ("reg=KA17HC3942") to Find Part (#reg=, catDeep).
const SHIM = `(()=>{const P=location.pathname.replace(/\\/[^\\/]*$/,'');const fx=u=>{if(typeof u==='string'&&u[0]==='/'&&u[1]!=='/'&&!u.startsWith(P+'/'))return P+u;if(u instanceof URL&&u.origin===location.origin&&!u.pathname.startsWith(P+'/'))return P+u.pathname+u.search;return u;};`
  + `const F=window.fetch.bind(window);window.fetch=(u,o)=>F(fx(u),o);`
  + `for(const k of ['localStorage','sessionStorage']){let ok=false;try{window[k].getItem('x');ok=true;}catch(e){}if(ok)continue;const m=new Map(),st={getItem:x=>m.has(String(x))?m.get(String(x)):null,setItem:(x,v)=>{m.set(String(x),String(v));},removeItem:x=>{m.delete(String(x));},clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};try{Object.defineProperty(window,k,{value:st,configurable:true});}catch(e){}}`
  + `addEventListener('message',e=>{if(e.source!==parent||!e.data||typeof e.data.bsCat!=='string')return;const h=e.data.bsCat;if(!/^(reg|vin)=[A-Z0-9]{4,30}$/.test(h))return;if(location.hash==='#'+h)location.hash='';location.hash=h;});})();`;
const APP = { etag: '', html: null, gz: null, at: 0, busy: null };
function appPage() {
  if (APP.html && Date.now() - APP.at < 60000) return Promise.resolve(APP);
  if (APP.busy) return APP.busy;
  APP.busy = (async () => {
    try {
      const r = await up('GET', '/app.html', { 'accept-encoding': 'gzip', ...(APP.etag && APP.html ? { 'if-none-match': APP.etag } : {}) });
      if (r.statusCode === 304 && APP.html) { r.resume(); APP.at = Date.now(); return APP; }
      if (r.statusCode !== 200) { r.resume(); throw new Error(`Bike Pharma's app page answered ${r.statusCode}`); }
      let b = await read(r, 30e6);
      if (/gzip/i.test(String(r.headers['content-encoding'] || ''))) b = zlib.gunzipSync(b);
      const t = b.toString('utf8');
      if (!/<head>/i.test(t)) throw new Error("Bike Pharma's app page looks different: the Catalogue needs an update");
      APP.html = Buffer.from(t.replace(/<head>/i, h => `${h}<script>${SHIM}</script>`));
      APP.gz = zlib.gzipSync(APP.html, { level: 6 });
      APP.etag = String(r.headers.etag || ''); APP.at = Date.now();
      return APP;
    } catch (e) {
      if (APP.html) { APP.at = Date.now() - 45000; return APP; }   // the copy from before keeps working; asked again in 15 s
      throw e;
    } finally { APP.busy = null; }
  })();
  return APP.busy;
}
// The page's rules. The sandbox gives it an origin of its own (no cookies, no reach into the menu or the billing pages);
// Find Part's own inline code, Google fonts and the two PDF/picture libraries it loads from cdnjs are allowed.
function siteOf(req) {
  const h = String(req.headers.host || ''); if (!/^[a-z0-9.-]+(:\d+)?$/i.test(h)) return '';
  const pr = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return `${pr === 'https' || pr === 'http' ? pr : env('COOKIE_SECURE') === '1' ? 'https' : 'http'}://${h}`;
}
function appCsp(req) {
  const o = siteOf(req), me = `'self'${o ? ' ' + o : ''}`;
  return ['sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-forms',
    `default-src ${me}`, `script-src ${me} 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com`,
    `style-src ${me} 'unsafe-inline' https://fonts.googleapis.com`, `font-src ${me} https://fonts.gstatic.com data:`,
    `img-src ${me} data: blob: https:`, `connect-src ${me} data: blob:`, `worker-src ${me} blob:`, `media-src ${me} data: blob:`,
    "object-src 'none'", `base-uri ${me}`, "form-action 'none'", `frame-ancestors ${me}`].join('; ');
}
// any other file of the catalogue opened on its own stays sealed too
const SEAL = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-file-size, content-range, content-length, etag' };
function send(res, status, v) {
  const b = Buffer.from(JSON.stringify(v));
  res.writeHead(status, { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': b.length,
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': SEAL });
  res.end(b);
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function note(res, status, msg) {
  const b = Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalogue</title>
<body style="margin:0;background:#fff;color:#151515;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif"><div style="max-width:560px;margin:56px auto;padding:0 20px">
<h1 style="font-size:22px;margin:0 0 10px">Catalogue</h1><p style="margin:0 0 16px">${esc(msg)}</p></div></body></html>`);
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-length': b.length, 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', 'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'" });
  res.end(b);
}

// ---------------- Bike Surgeon's stock (the billing's parts, read only) ----------------------------------------------------
const pk = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fl = v => { const m = String(v ?? '').match(/^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/); return m ? Number(m[0]) : 0; };   // as the billing reads stock
const STK = { m: null, at: 0, busy: null, err: '' };
async function stock() {
  if (STK.m && Date.now() - STK.at < 120000) return STK.m;
  if (!STK.busy) STK.busy = (async () => {
    try {
      const out = await vehicles.mysql("SELECT JSON_OBJECT('sn', SUBSTRING(serial_no, 1, 100), 'bc', SUBSTRING(bar_code, 1, 100), 'st', SUBSTRING(stock, 1, 30), 'rk', SUBSTRING(rack, 1, 40)) FROM `cms_products`");
      const m = new Map();
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        let r; try { r = JSON.parse(line); } catch { continue; }
        const n = Math.trunc(fl(r.st)), rack = String(r.rk || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 20);
        for (const k of new Set([pk(r.sn), pk(r.bc)])) {
          if (k.length < 4) continue;
          const x = m.get(k); if (x) { x.n += n; if (!x.rack && rack) x.rack = rack; } else m.set(k, { n, rack });
        }
      }
      STK.m = m; STK.at = Date.now(); STK.err = '';
    } catch (e) { STK.err = e.message; STK.at = Date.now() - 90000; console.log('catalogue: billing stock not read:', e.message); }
    finally { STK.busy = null; }
  })();
  if (!STK.m) await STK.busy;
  return STK.m;
}
// the part's number as Bike Pharma's catalogue has it; Yamaha numbers with or without the last 00, Hero's with or without its S
function stockOf(m, k) {
  let x = m.get(k);
  if (!x && k.length === 10) x = m.get(k + '00');
  if (!x && k.length === 12 && k.endsWith('00')) x = m.get(k.slice(0, 10));
  if (!x && /^[0-9A-Z]{6,}S$/.test(k)) x = m.get(k.slice(0, -1));
  return x || null;
}

// ---------------- the requests of the page ---------------------------------------------------------------------------------
// Bike Pharma's rules for this key, here too (its server.mjs catDenied): reads, the catalogue lines (POST), the catalogues folder
const API_GET = new Set(['boot', 'sync', 'pnlook', 'fpname', 'vinlook', 'fit', 'dghot', 'same', 'files/list', 'files/read']);
const FILES = /^(cat|figs|vendor|bj|ph|phh)\//;
const PASS_IN = ['accept', 'accept-encoding', 'range', 'if-range', 'if-none-match', 'if-modified-since', 'content-type'];
const PASS_OUT = ['content-type', 'content-length', 'content-encoding', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control', 'x-file-size', 'vary'];
async function forward(req, res, rest, search) {
  const m = req.method;
  let body = null;
  if (m === 'POST') body = await read(req, 256 * 1024); else req.resume();
  const h = {}; for (const k of PASS_IN) if (req.headers[k]) h[k] = req.headers[k];
  const r = await up(m, '/' + rest + search, h, body);
  if (r.statusCode === 401) { r.resume(); return send(res, 403, { error: KEY_MSG }); }   // never Bike Pharma's own log in page here
  const out = { ...CORS, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': SEAL };
  for (const k of PASS_OUT) if (r.headers[k] != null) out[k] = r.headers[k];
  res.writeHead(r.statusCode, out);
  if (m === 'HEAD') { r.resume(); return res.end(); }
  r.pipe(res);
  r.on('error', () => res.destroy());
}
async function handle(req, res, u) {
  try {
    const mt = /^\/__gate\/cat\/t\/([^/]+)(?:\/(.*))?$/.exec(u.pathname);
    if (!mt) return send(res, 404, { error: 'Not found.' });
    const rest = mt[2] || '', m = req.method;
    if (m === 'OPTIONS') {   // the sealed page's own origin asks first before a POST or a range read
      res.writeHead(204, { ...CORS, 'access-control-allow-methods': 'GET, HEAD, POST', 'access-control-allow-headers': 'content-type, range, if-range, if-none-match', 'access-control-max-age': '600' });
      return res.end();
    }
    if (m !== 'GET' && m !== 'HEAD' && m !== 'POST') { req.resume(); return send(res, 405, { error: 'Not allowed.' }); }
    const who = whoOf(mt[1]);
    if (!who) { req.resume(); return rest === 'app.html' || rest === '' ? note(res, 403, 'This Catalogue page was opened by a sign in that has ended. Open Catalogue again from the menu.') : send(res, 403, { error: 'Open Catalogue again from the menu.' }); }
    if (!on()) { req.resume(); return rest === 'app.html' ? note(res, 503, 'The Catalogue is not switched on. Owner: on the server run bash /root/bs-erp-update.sh catalogue') : send(res, 503, { error: 'The Catalogue is not switched on.' }); }
    if (rest === '') { res.writeHead(302, { location: `/__gate/cat/t/${mt[1]}/app.html`, 'cache-control': 'no-store' }); return res.end(); }
    if (rest === 'app.html' && m !== 'POST') {
      const p = await probe();
      if (!p.ok) return note(res, 503, p.msg);
      let a; try { a = await appPage(); } catch (e) { return note(res, 502, `Bike Pharma's Find Part did not open: ${e.message}. Try again in a minute.`); }
      const gz = /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')), b = gz ? a.gz : a.html;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-length': b.length, vary: 'accept-encoding',
        ...(gz ? { 'content-encoding': 'gzip' } : {}), 'content-security-policy': appCsp(req), 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' });
      return res.end(m === 'HEAD' ? undefined : b);
    }
    if (rest === 'api/bsstock' && m === 'GET') {
      const want = [...new Set(String(u.searchParams.get('pk') || '').split(',').map(pk).filter(k => k.length >= 4 && k.length <= 30))].slice(0, 300);
      const s = await stock();
      if (!s) return send(res, 503, { error: STK.err || 'The billing stock could not be read.' });
      const out = {}; for (const k of want) { const x = stockOf(s, k); if (x) out[k] = { n: x.n, rack: x.rack }; }
      return send(res, 200, { stock: out, at: new Date(STK.at).toISOString() });
    }
    if (rest === 'api/rclook' && m === 'GET') return send(res, 200, await vehicles.rcFor(u.searchParams.get('r'), who.who));
    if (rest.startsWith('api/')) {
      const a = rest.slice(4);
      if (!(m === 'POST' ? a === 'cat/rows' : API_GET.has(a))) { req.resume(); return send(res, 403, { error: 'Bike Surgeon catalogue: Find Part only' }); }
      if (a.startsWith('files/')) { const f = String(u.searchParams.get('path') || '').replace(/^\/+/, ''); if (f.split('/').includes('..') || !(f === 'catalogues' || f.startsWith('catalogues/') || (f === '' && a === 'files/list'))) { req.resume(); return send(res, 403, { error: 'Bike Surgeon catalogue: Find Part only' }); } }
      return await forward(req, res, rest, u.search);
    }
    if (m !== 'POST' && FILES.test(rest) && !rest.split('/').includes('..')) return await forward(req, res, rest, u.search);
    req.resume();
    return send(res, 404, { error: 'Not found.' });
  } catch (e) {
    console.log('catalogue:', e.message);
    if (res.headersSent) return res.destroy();
    return send(res, 502, { error: `Bike Pharma's server did not answer (${String(e.message).slice(0, 120)}). Try again in a minute.` });
  }
}

module.exports = { init, on, open, handle, _: { whoOf, stockOf, probe, STK, APP, PROBE, SHIM } };
