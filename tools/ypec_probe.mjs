// 19f (Sam 2026-11-10): read only. Logs in to YPEC with the dealer login from the site's .env and shows how its parts catalogue page
// sends a figure's numbers and their places, so the Yamaha diagrams can point exactly like YPEC. Prints no password and no cookie.
//   node tools/ypec_probe.mjs [page url after /ypec/]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
const { _ypec } = await import('../lib/vinlook.mjs');
const B = _ypec.base(), say = (...a) => console.log(...a);
const SRC = process.argv.includes('src'), CALL = process.argv.includes('call'), pg = process.argv.slice(2).map(x => x.replace(/^https?:\/\/[^/]+\/ypec\//, '')).find(x => x !== 'src' && x !== 'call') || 'html5/app/en/parts-search/app/parts_catalog_pc.html?modelBaseCode=&modelTypeCode=D704&modelYear=2025&productNo=010';
const L = await _ypec.login();
if (L.error) { say('LOGIN:', L.error); process.exit(1); }
say('login ok');
const jar = L.jar, get = async (u, b) => { try { return await _ypec.req(jar, u, b); } catch (e) { return 'ERR ' + e.message; } };
const url = new URL(pg, B + '/ypec/').toString();
const h = await get(url);
say('PAGE', new URL(url).pathname, h.length, 'chars;', (/<title>([^<]*)/i.exec(h) || [])[1] || '');
if (h.length < 3000) say(h.replace(/\s+/g, ' ').slice(0, 1500));
const srcs = [...h.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m => new URL(m[1], url).toString()).filter(u => u.startsWith(B));
if (CALL) {   // 19i: makes the catalogue page's own data calls for this page address and shows what comes back (prices masked)
  const J = {}; for (const s of srcs) if (/parts-search\//.test(s)) J[s.replace(/.*\/|\?.*/g, '')] = await get(s);
  const all = Object.values(J).join('\n'), sq = t => t.replace(/\s+/g, ' ');
  const q = Object.fromEntries(new URL(url).searchParams), cid = {};
  for (const m of all.matchAll(/catalogIndexData\.(\w+)\s*=\s*reqParams\['(\w+)'\]/g)) if (q[m[2]] !== undefined) cid[m[1]] = q[m[2]];
  say('PAGE PARAMS', Object.keys(q).join(','));
  const mask = v => Array.isArray(v) ? v.map(mask) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /jsession|dealer|userId|password/i.test(k) ? '#' : /(P(Before|After)Vat|price|cost|dlrP|retP)/i.test(k) && typeof x !== 'object' ? '#' : mask(x)])) : v;
  const post = async (u, body) => {
    const r = await fetch(B + u, { method: 'POST', body: JSON.stringify(body), headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
      'Content-Type': 'application/json', Accept: 'application/json, text/javascript, */*; q=0.01', 'Accept-Language': 'en-US,en;q=0.9', 'X-Requested-With': 'XMLHttpRequest', Referer: url, Origin: B, Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { st: r.status, t, j };
  };
  const sum = (name, R) => {
    say('==', name, 'status', R.st, R.t.length, 'chars'); if (!R.j) return say('   not JSON:', sq(R.t).slice(0, 400));
    for (const [k, v] of Object.entries(R.j)) {
      if (Array.isArray(v)) { say('  ', k, '[' + v.length + ']'); for (const x of v.slice(0, /hotspot/i.test(k) ? 6 : 2)) say('      ', JSON.stringify(mask(x)).slice(0, 900)); }
      else say('  ', k, '=', /jsession/i.test(k) ? '#' : JSON.stringify(mask(v)).slice(0, 200));
    }
  };
  const dims = b => b[0] === 0x89 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : b[0] === 0x47 ? [b.readUInt16LE(6), b.readUInt16LE(8)] : (() => { for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } return [0, 0]; })();
  const calls = [];
  for (const m of all.matchAll(/ajaxOption\.url\s*=\s*ypec\.controller\.generateUrl\(ypec\.const\.(api\w+Url)\);\s*ajaxOption\.data\s*=\s*JSON\.stringify\(\{([\s\S]*?)\}\);/g)) { calls.push([m[1], m[2]]); say('CALL', m[1], '{', sq(m[2]).slice(0, 700), '}'); }
  const cu = n => { const m = new RegExp("ypec\\.const\\." + n + "\\s*=\\s*ypec\\.const\\.apiBaseUrl\\s*\\+\\s*'([^']+)'").exec(all); return m ? '/ypec/services/html5' + m[1] : null; };
  const body = (src, extra = {}) => { const o = {}; for (const m of src.matchAll(/'?(\w+)'?\s*:\s*catalogIndexData\.(\w+)/g)) { const v = m[2] in extra ? extra[m[2]] : cid[m[2]]; if (v !== undefined) o[m[1]] = v; } return o; };
  for (const n of ['apiCatalogIndexUrl', 'apiCatalogTextUrl']) {
    const i0 = all.indexOf('generateUrl(ypec.const.' + n), i1 = all.indexOf('$.ajax(', i0), u = cu(n); if (i0 < 0 || !u) { say('==', n, 'call not found in the page code'); continue; }
    const c = [n, all.slice(i0, i1 < 0 ? i0 + 3000 : i1)]; say('SRC', n, sq(c[1]).slice(0, 1800));
    const b0 = body(c[1]); say('BODY KEYS', n, Object.keys(b0).join(','));
    const R = await post(u, b0); sum(n, R);
    if (n !== 'apiCatalogTextUrl' || !R.j) continue;
    const figs = R.j.figDataCollection || [], f0 = figs.find(f => f.illustFileURL);
    say('   figs', figs.length, 'hotspots', (R.j.hotspotDataCollection || []).length, 'parts', (R.j.partsDataCollection || []).length);
    if (f0) { try { const iu = new URL(f0.illustFileURL, url).toString(); const r = await fetch(iu, { headers: { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '), Referer: url, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' } });
      const bf = Buffer.from(await r.arrayBuffer()); say('   PICTURE', new URL(iu).pathname, r.status, r.headers.get('content-type'), bf.length, 'bytes', dims(bf).join('x')); } catch (e) { say('   PICTURE error', e.message); } }
    const f2 = figs.find(f => f.figNo !== (R.j.figNo || b0.figNo) && f !== figs[0]) || figs[1];
    if (f2) { const b2 = body(c[1], { figNo: f2.figNo, illustNo: f2.illustNo, figBranchNo: f2.figBranchNo }); const R2 = await post(u, b2); say('SECOND FIG', f2.figNo, f2.figName); sum(n + ' (fig ' + f2.figNo + ')', R2); }
  }
  for (const k of ['apiCatalogIndexUrl', 'apiPartsCatalogUrl', 'parts_catalog']) { let i = -1, c = 0; while ((i = all.indexOf(k, i + 1)) >= 0 && c++ < 4) say('USE', k, '|', sq(all.slice(Math.max(0, i - 500), i + 500))); }
  process.exit(0);
}
if (SRC) {   // 19g: the catalogue page's own code around its data call and its hotspot map
  const J = {}; for (const s of srcs) if (/parts-search\//.test(s)) J[s.replace(/.*\/|\?.*/g, '')] = await get(s);
  const sq = t => t.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
  for (const f of ['ypec.const.js', 'ypec.controller.js', 'ypec.util.js']) say('=====', f, '\n' + sq(J[f] || 'none'));
  const cut = (f, re, n, back = 0) => { const t = J[f] || ''; let m, k = 0; const r = new RegExp(re, 'g'); while ((m = r.exec(t)) && k++ < 6) say('=====', f, '@' + m.index, '\n' + sq(t.slice(Math.max(0, m.index - back), m.index + n))); };
  cut('parts_catalog.common.js', 'initPartsList = function', 4500); cut('parts_catalog.common.js', 'createHotspotMap = function', 3000);
  cut('parts_catalog.common.js', 'reqParams\\s*=', 1200); cut('parts_catalog.imagemap.js', ',init = function', 3000);
  for (const f of ['parts_catalog.common.js', 'parts_catalog_pc.js']) cut(f, '\\$\\.ajax\\(', 300, 900);
  process.exit(0);
}
say('SCRIPTS', srcs.length); for (const s of srcs) say('  ', s.slice(B.length));
const inl = [...h.matchAll(/<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
const KEY = /hot\s*spot|coord|callout|usemap|<area|\barea\b|imagemap|svg|canvas|illust|figNo|figureNo|refNo|\.json|ajax|fetch\(|XMLHttpRequest|url\s*:|\/ypec\/|control\//i;
const show = (name, t) => {
  const seen = new Set(); let n = 0;
  for (const raw of t.split(/\n|;(?=\s*[\w$.]+\s*[=(])/)) {
    const l = raw.replace(/\s+/g, ' ').trim(); if (!l || !KEY.test(l)) continue;
    const m = KEY.exec(l), i = Math.max(0, m.index - 120), c = l.slice(i, i + 300); if (seen.has(c)) continue; seen.add(c);
    if (n++ < 40) say('   |', c);
  }
  say('  ', name, t.length, 'chars,', n, 'lines of interest');
};
show('inline script', inl);
for (const s of srcs) { if (/jquery|bootstrap|angular(\.min)?\.js|vue(\.min)?\.js|react|lodash|moment|polyfill/i.test(s)) continue; show(s.slice(B.length), await get(s)); }
const hs = [...h.matchAll(/<(?:img|map|area|svg|canvas|object|embed|iframe)\b[^>]{0,300}/gi)].map(m => m[0].replace(/\s+/g, ' '));
say('PAGE TAGS', hs.length); for (const x of hs.slice(0, 25)) say('  ', x);
