// 19f (Sam 2026-11-10): read only. Logs in to YPEC with the dealer login from the site's .env and shows how its parts catalogue page
// sends a figure's numbers and their places, so the Yamaha diagrams can point exactly like YPEC. Prints no password and no cookie.
//   node tools/ypec_probe.mjs [page url after /ypec/]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
const { _ypec } = await import('../lib/vinlook.mjs');
const B = _ypec.base(), say = (...a) => console.log(...a);
const SRC = process.argv.includes('src'), CALL = process.argv.includes('call'), FLOW = process.argv.includes('flow'), FIG = process.argv.includes('fig'), pg = process.argv.slice(2).map(x => x.replace(/^https?:\/\/[^/]+\/ypec\//, '')).find(x => !['src', 'call', 'flow', 'fig'].includes(x)) || 'html5/app/en/parts-search/app/parts_catalog_pc.html?modelBaseCode=&modelTypeCode=D704&modelYear=2025&productNo=010';
const L = await _ypec.login();
if (L.error) { say('LOGIN:', L.error); process.exit(1); }
say('login ok');
const jar = L.jar, get = async (u, b) => { try { return await _ypec.req(jar, u, b); } catch (e) { return 'ERR ' + e.message; } };
const url = new URL(pg, B + '/ypec/').toString();
const h = await get(url);
say('PAGE', new URL(url).pathname, h.length, 'chars;', (/<title>([^<]*)/i.exec(h) || [])[1] || '');
if (h.length < 3000) say(h.replace(/\s+/g, ' ').slice(0, 1500));
const srcs = [...h.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m => new URL(m[1], url).toString()).filter(u => u.startsWith(B));
if (CALL || FLOW || FIG) {   // 19i: makes the catalogue page's own data calls for this page address and shows what comes back (prices masked)
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
  if (FIG) {   // 19k: one real model, as the site does it: model list row > its diagram list > one diagram's parts and number places
    const C = B + '/ypec/control/', P = B + '/ypec/html5/app/en/parts-search/app/', code = q.modelTypeCode || 'D704';
    const L = await get(C + 'specification/ListModelSelection', { modelName: '', modelYearFrom: '', modelYearTo: '', modelTypeCode: code, productNo: '', colorType: '', prefixNo: '', serialNo: '', frameNo: '', engineNo: '', Operation: '',
      actionType: 'modelLabel', SearchFlg: ' ', baseCode: process.env.YPEC_BASE_CODE || '', prodCategory: '10', confirmId: '', pmpDisplayFlg: '0', pdfDisFlg: '1' });
    const rows = [...L.matchAll(/onKeyHtml5\(\s*'([^']*)',\s*'([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'/g)].map(m => m.slice(2));
    say('LIST', code, L.length, 'chars, rows', rows.length); for (const r of rows.slice(0, 6)) say('   ', JSON.stringify(r));
    const hid = {}; for (const m of L.matchAll(/<input[^>]*>/gi)) { const n = /\bname=["']?([\w.]+)/i.exec(m[0]), v = /\bvalue=["']([^"']*)/i.exec(m[0]); if (n) hid[n[1]] = v ? v[1] : ''; }
    say('LIST FORM', JSON.stringify(Object.fromEntries(Object.entries(hid).filter(([k]) => /lang|called|search|product|periodic/i.test(k)))));
    { const i = L.indexOf('indexHtml5Url ='); say('LINK CODE', sq(L.slice(Math.max(0, i - 700), i + 1500))); }
    const ci = await get(P + 'catalog_index.html'), cjs = await get(P + ((/src=["']([^"']*catalog_index\.js[^"']*)/i.exec(ci) || [])[1] || 'js/catalog_index.js'));
    for (const k of ['selectModelName =', 'selectCalledCode =', 'catalogIndex(', "forword('catalog_index', 'parts_catalog'"]) { let i = -1, n = 0; while ((i = cjs.indexOf(k, i + 1)) >= 0 && n++ < 3) say('INDEX JS', k, '|', sq(cjs.slice(Math.max(0, i - (k.startsWith('forword') ? 2200 : 300)), i + 300))); }
    if (!rows.length) { say(sq(L.replace(/<[^>]+>/g, ' ')).slice(0, 400)); process.exit(0); }
    const r0 = rows[0], nm = r0[5].replace(/\\n/g, '\n'), langs = [...new Set([hid.langId, hid.sesLangId, '02', 'en', '01', ''].filter(x => x !== undefined))];
    let idx = null, ib = null, tries = 0;
    out: for (const mn of [nm, encodeURIComponent(nm), nm.replace(/\n/g, ' '), r0[5]]) for (const lg of langs) for (const cc of ['1']) {
      if (tries++ >= 12) break out;
      const b0 = { modelBaseCode: r0[0], modelTypeCode: r0[1], modelYear: r0[2], productNo: r0[3], colorType: r0[4], catalogLangId: lg, calledCode: cc, modelName: mn };
      const R = await post('/ypec/services/html5/catalog_index', b0);
      say('TRY catalog_index lang=' + JSON.stringify(lg), 'name=' + JSON.stringify(mn), '>', R.st, R.t.length, 'chars');
      if (R.j && R.j.figDataCollection && R.j.figDataCollection.length) { idx = R; ib = b0; break out; }
      if (R.j) say('    ', JSON.stringify(mask(R.j)).slice(0, 300));
    }
    if (!idx) { say('catalog_index gave no diagram list'); process.exit(0); }
    sum('catalog_index', idx);
    const figs = idx.j.figDataCollection, i0 = all.indexOf('generateUrl(ypec.const.apiCatalogTextUrl'), src = all.slice(i0, all.indexOf('$.ajax(', i0));
    const keys = [...src.matchAll(/'(\w+)'\s*:\s*catalogIndexData\.(\w+)/g)].map(m => m[1]);
    let ok = null;
    for (const f of figs.slice(0, 2)) {
      const have = { ...ib, catalogNo: idx.j.catalogNo, illustNo: f.illustNo, figNo: f.figNo, figBranchNo: f.figBranchNo };
      const vars = ok ? [ok] : ['', 'undefined', null];
      for (const fill of vars) {
        const b1 = {}; for (const k of keys) { if (have[k] !== undefined && have[k] !== null) b1[k] = have[k]; else if (fill !== null) b1[k] = fill; }
        const R = await post('/ypec/services/html5/catalog_text', b1);
        say('TRY catalog_text fig', f.figNo, 'missing=' + JSON.stringify(fill), '>', R.st, R.t.length, 'chars');
        if (!R.j || !(R.j.partsDataCollection || R.j.hotspotDataCollection)) { if (R.j) say('    ', JSON.stringify(mask(R.j)).slice(0, 300)); continue; }
        ok = fill; sum('catalog_text fig ' + f.figNo + ' ' + (f.figName || ''), R);
        const hs = R.j.hotspotDataCollection || [], ps = R.j.partsDataCollection || [];
        say('   hotspots', hs.length, 'parts', ps.length, 'part refs with a place', new Set(ps.map(p => String(p.refNo)).filter(x => hs.some(h => String(h.refNo) === x))).size, 'of', new Set(ps.map(p => String(p.refNo))).size,
          'max x/y', Math.max(0, ...hs.map(h => +h.endPointX || 0)), Math.max(0, ...hs.map(h => +h.endPointY || 0)));
        const fu = (R.j.figDataCollection || []).find(x => x.figNo === f.figNo && x.illustFileURL) || f;
        if (fu.illustFileURL) { try { const iu = new URL(fu.illustFileURL, url).toString(); const r = await fetch(iu, { headers: { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '), Referer: url, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' } });
          const bf = Buffer.from(await r.arrayBuffer()); say('   PICTURE', new URL(iu).pathname, r.status, r.headers.get('content-type'), bf.length, 'bytes', dims(bf).join('x')); } catch (e) { say('   PICTURE error', e.message); } }
        break;
      }
    }
    const ap = await get(P + 'alternative_parts.html');
    for (const m of ap.matchAll(/<script[^>]+src=["']([^"']+)/gi)) { const u = new URL(m[1], P).toString(); if (!/parts-search\/app\/js/.test(u)) continue; const t = await get(u); let i = -1, n = 0; while ((i = t.indexOf('generateUrl(ypec.const.', i + 1)) >= 0 && n++ < 3) say('ALT JS', u.replace(/.*\/|\?.*/g, ''), '|', sq(t.slice(Math.max(0, i - 200), i + 1300))); }
    process.exit(0);
  }
  if (FLOW) {   // 19j: the way from choosing a model to its catalogue: the old search pages and the new catalogue-index page
    const C = B + '/ypec/control/', txt = h => sq(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' '));
    const seen = new Set(), ctx = (name, t, re, n = 500, max = 8) => { let m, k = 0; const r = new RegExp(re, 'g'); while ((m = r.exec(t)) && k < max) { const c = sq(t.slice(Math.max(0, m.index - 150), m.index + n)); if (seen.has(c)) continue; seen.add(c); k++; say('  ', name, '|', c); } };
    const acts = new Set();
    for (const pgN of ['specification/FrameModelSelection', 'specification/HeaderModelSelection']) {
      const t = await get(C + pgN); say('== OLD PAGE', pgN, t.length, 'chars');
      say('   fields:', [...t.matchAll(/<(?:input|select)[^>]*\bname=["']?([\w.]+)[^>]*/gi)].map(m => m[1] + (/type=["']?hidden/i.test(m[0]) ? '(h)' : '')).join(' '));
      say('   frames:', [...t.matchAll(/<i?frame[^>]*src=["']([^"']+)/gi)].map(m => m[1]).join(' '));
      for (const m of t.matchAll(/actionType(?:\.value)?\s*=\s*["'](\w+)["']/g)) acts.add(m[1]);
      ctx('js', t, 'actionType', 500, 10); ctx('js', t, 'function\\s+\\w+\\s*\\(', 300, 25);
    }
    say('ACTION TYPES', [...acts].join(',') || 'none seen');
    const base = { modelName: '', modelYearFrom: '', modelYearTo: '', modelTypeCode: '', productNo: '', colorType: '', prefixNo: '', serialNo: '', frameNo: '', engineNo: '', Operation: '', SearchFlg: ' ',
      baseCode: process.env.YPEC_BASE_CODE || '', prodCategory: '10', confirmId: '', pmpDisplayFlg: '0', pdfDisFlg: '1' };
    let rowSrc = '';
    for (const at of new Set([...acts, 'modelName', 'modelType', 'search'])) for (const f of [{ modelName: 'FZ' }, { modelTypeCode: 'D704' }]) {
      if (at === 'serialNo') continue;
      const t = await get(C + 'specification/ListModelSelection', { ...base, ...f, actionType: at });
      const fn = {}; for (const m of t.matchAll(/JavaScript:\s*(\w+)\(([^)]{0,600})\)/gi)) (fn[m[1]] = fn[m[1]] || []).push(m[2]);
      say('== LIST actionType=' + at, JSON.stringify(f), t.length, 'chars;', Object.entries(fn).map(([k, v]) => k + ' x' + v.length).join(', ') || txt(t).slice(0, 200));
      if (Object.keys(fn).length && !rowSrc) { rowSrc = t; for (const [k, v] of Object.entries(fn)) for (const x of v.slice(0, 2)) say('     ', k + '(' + sq(x) + ')');
        ctx('list js', t, 'function\\s+\\w+\\s*\\(', 900, 12); ctx('list html5', t, 'html5|parts_catalog|catalog_index', 400, 6);
        say('   list fields:', [...t.matchAll(/<(?:input|select)[^>]*\bname=["']?([\w.]+)[^>]*/gi)].map(m => m[1]).filter((x, i, a) => a.indexOf(x) === i).join(' ')); }
    }
    const P = B + '/ypec/html5/app/en/parts-search/app/', J2 = {};
    for (const n of ['catalog_index.html', 'catalog_index_pc.html', 'index.html', 'model_list.html', 'model_select.html']) {
      const t = await get(P + n); say('== NEW PAGE', n, t.length, 'chars', (/<title>([^<]*)/i.exec(t) || [])[1] || sq(t).slice(0, 80));
      for (const m of t.matchAll(/<script[^>]+src=["']([^"']+)/gi)) { const u = new URL(m[1], P + n).toString(), k = u.replace(/.*\/|\?.*/g, ''); if (/parts-search\//.test(u) && !(k in J) && !(k in J2)) { J2[k] = await get(u); say('     script', k, J2[k].length); } }
      ctx(n + ' inline', t, 'generateUrl\\(ypec\\.const\\.\\w+', 1500, 4);
    }
    for (const [k, t] of Object.entries({ ...J2, ...J })) { ctx(k, t, 'generateUrl\\(ypec\\.const\\.apiCatalogIndexUrl', 1800, 3); ctx(k, t, "setItem\\('ypecData\\w+'", 300, 6); ctx(k, t, "forword\\(", 300, 6); }
    for (const [k, t] of Object.entries(J2)) ctx(k, t, 'generateUrl\\(ypec\\.const\\.\\w+', 1500, 6);
    for (const b0 of [{ modelBaseCode: q.modelBaseCode || '', modelTypeCode: q.modelTypeCode, modelYear: q.modelYear, productNo: q.productNo }, { modelBaseCode: '', modelTypeCode: q.modelTypeCode, modelYear: q.modelYear, productNo: q.productNo, colorType: '', catalogLangId: '02', calledCode: '1' }])
      sum('catalog_index ' + Object.keys(b0).join(','), await post('/ypec/services/html5/catalog_index', b0));
    process.exit(0);
  }
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
