// 19f (Sam 2026-11-10): read only. Logs in to YPEC with the dealer login from the site's .env and shows how its parts catalogue page
// sends a figure's numbers and their places, so the Yamaha diagrams can point exactly like YPEC. Prints no password and no cookie.
//   node tools/ypec_probe.mjs [page url after /ypec/]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
const { _ypec } = await import('../lib/vinlook.mjs');
const B = _ypec.base(), say = (...a) => console.log(...a);
const pg = process.argv[2] || 'html5/app/en/parts-search/app/parts_catalog_pc.html?modelBaseCode=&modelTypeCode=D704&modelYear=2025&productNo=010';
const L = await _ypec.login();
if (L.error) { say('LOGIN:', L.error); process.exit(1); }
say('login ok');
const jar = L.jar, get = async (u, b) => { try { return await _ypec.req(jar, u, b); } catch (e) { return 'ERR ' + e.message; } };
const url = new URL(pg, B + '/ypec/').toString();
const h = await get(url);
say('PAGE', new URL(url).pathname, h.length, 'chars;', (/<title>([^<]*)/i.exec(h) || [])[1] || '');
if (h.length < 3000) say(h.replace(/\s+/g, ' ').slice(0, 1500));
const srcs = [...h.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m => new URL(m[1], url).toString()).filter(u => u.startsWith(B));
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
