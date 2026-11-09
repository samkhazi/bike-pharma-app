// KTM + Husqvarna catalogue made on the server from Sam's folder All Catalogues > KTM > KTM_PDF_HD_All_Years (uploaded by Admin into
// FILES_DIR/catalogues/ktm, 13c, Sam 2026-10-27 "All Catalogue me KTM ke catalogues hein usko upload karna he, PDF me jo diagram jaise hein
// waise hi chahiye"): ktm_build.json (the parts lists read from those 97 HD PDFs on 11 Oct, tools/ktm/ktm_parse.py + ktm_build.py; no MRP,
// the PDFs have none) and the PDFs themselves. Every diagram is the JPEG inside its PDF, read by byte range and sent unchanged (pa: refs,
// /api/files/read?a85=1), so it is exactly the PDF's picture. Identical drawings are read from one PDF, so 78 of the 97 PDFs are needed.
// Out: DATA_DIR/cat/ktm.json, ktm-dg.json, husqvarna.json, husqvarna-dg.json and their lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import { pnrOf, writeApp } from './herobuild.mjs';

export const KTM_RAW = ['ktm_build.json'];
export const KTM_MRP = 'ktm_mrp.json';   // 16q: MRP from the dealer DMS list (Sam's All Catalogues > KTM > KTM_Husqvarna_All_Parts_MRP + _MRP_DMS), made on the Mac
const BRANDS = [['ktm', 'KTM'], ['husqvarna', 'Husqvarna']];

/* dir: the uploaded folder (all files flat in it). Returns { ktm: {cat, dg, pnr}, husqvarna: {...}, info } */
// 16w (Sam 2026-10-30, JR403608 on the KTM 250 Duke page): KTM and Husqvarna parts made by Bajaj carry Bajaj numbers, so Bajaj's DMS old/new/alternate list (bajaj_alt.json) names their other numbers too
export function altRemarks(AL) {
  const toNew = new Map(), toOld = new Map(), alt = new Map(), up = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), mul = (m, k, v) => { const a = m.get(k) || []; if (!a.includes(v)) a.push(v); m.set(k, a); };
  const P = ((AL && AL.pairs) || []).filter(p => !/\(kit\)/i.test(String(p[3] || '')) && (p[2] === 'n' || !/^36[A-Z]{2}[0-9A-Z]{4}$/.test(up(p[0])) && !/^36[A-Z]{2}[0-9A-Z]{4}$/.test(up(p[1])))).map(([o, n, k]) => [up(o), up(n), k]).filter(([o, n]) => o && n && o !== n), nn = new Set(P.filter(p => p[2] === 'n').map(p => p[0] + '|' + p[1]));
  for (const [o, n, k] of P) { if (k === 'n' && !nn.has(n + '|' + o) && !toNew.has(o)) { toNew.set(o, n); mul(toOld, n, o); } else { mul(alt, o, n); mul(alt, n, o); } }
  // 16z: the old -> new chain only, not parts that merely share a new number (a kit)
  const walk = (pn, nx) => { const out = new Set([pn]), q = [pn]; while (q.length && out.size <= 11) { const x = q.shift(); for (const y of nx(x)) if (!out.has(y)) { out.add(y); q.push(y); } } return out; };
  const fwd = pn => walk(pn, x => toNew.has(x) ? [toNew.get(x)] : []), back = pn => walk(pn, x => toOld.get(x) || []);
  return pn => { pn = up(pn); const rem = [], said = new Set([pn]);
    if (toNew.has(pn)) { rem.push('New no. ' + toNew.get(pn)); said.add(toNew.get(pn)); }
    for (const o of toOld.get(pn) || []) if (!said.has(o)) { rem.push('Old no. ' + o); said.add(o); }
    for (const x of alt.get(pn) || []) if (!said.has(x)) { rem.push('Alternate no. ' + x); said.add(x); }
    const F = fwd(pn), B = back(pn), f = [...new Set([...F, ...B])]; if (f.length <= 11) for (const x of f) if (!said.has(x)) { rem.push((F.has(x) && !B.has(x) ? 'New' : B.has(x) && !F.has(x) ? 'Old' : 'Alternate') + ' no. ' + x); said.add(x); }   // 17d: new of new = New no., old of old = Old no.
    return rem; };
}

// 18d (Sam 2026-11-09 "ktmspcatalog ka weekly sync"): brand_sync/brands/ktm.py reads Bajaj's KTM Spare Parts Finder every week into
// <sync>/ktm/editions.json: { editions: { '<model id>_<year id>': { model: '390-DUKE-GEN3', my: 'MY-23', plates: [[kind, n, name, img, rows]] } } },
// rows [ref, pn, desc, qty, remarks], img = the diagram file in <sync>/ktm/img (the portal's picture, byte for byte).
// A model year the PDFs don't have becomes a new edition with its diagrams; a known one gets the part numbers it lacks.
const WORDS = { DUKE: 'Duke', ADVENTURE: 'Adventure', RALLY: 'Rally', ENDURO: 'Enduro', PLUS: 'Plus', SVARTPILEN: 'Svartpilen', VITPILEN: 'Vitpilen' };
export const prettyKtm = raw => String(raw || '').trim().split(/[- ]+/).filter(Boolean).map(w => WORDS[w.toUpperCase()] || w).join(' ');
export function mergeSync(out, syncDir, syncRel = 'catalogues/hero-sync') {
  let S = null; try { S = JSON.parse(fs.readFileSync(path.join(syncDir, 'ktm', 'editions.json'), 'utf8')); } catch { return null; }
  const info = { editions: 0, newEditions: [], parts: 0, diagrams: 0 }, up = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pic = f => { if (!f) return null; try { const z = fs.statSync(path.join(syncDir, 'ktm', 'img', f)).size; return z > 0 ? `pf:${syncRel}/ktm/img/${f}:0:${z}` : null; } catch { return null; } };
  for (const e of Object.values(S.editions || {})) {
    const my = /(\d{2})\s*$/.exec(String(e.my || '')); if (!my || !(e.plates || []).length) continue;
    const model = prettyKtm(e.model), year = 2000 + +my[1], slug = /SVARTPILEN|VITPILEN/i.test(model) ? 'husqvarna' : 'ktm', o = out[slug]; if (!o || !model) continue;
    const { cat, dg } = o, label = `${model} ${year} (MY${my[1]})`;
    let vi = cat.vars.indexOf(label); const fresh = vi < 0;
    if (fresh) { vi = cat.vars.length; cat.vars.push(label); cat.vmod[label] = model; dg.p[vi] = {}; if (!cat.models.includes(model)) { cat.models.push(model); cat.cur = cat.models.length; } info.newEditions.push(label); }
    const have = new Set(); if (!fresh) for (const r of cat.d) if (r[11].includes(vi)) have.add(up(r[5]));
    const idx = (arr, v) => { let i = arr.indexOf(v); if (i < 0) { i = arr.length; arr.push(v); } return i; };
    for (const [kind, n, name, img, rows] of e.plates) {
      const grp = `${kind} ${n}`, ref = pic(img);
      if (ref && dg.p[vi][grp] == null) { let fi = dg.f.indexOf(ref); if (fi < 0) { fi = dg.f.length; dg.f.push(ref); info.diagrams++; } dg.p[vi][grp] = fi; }
      for (const [rf, pn0, desc, qty, rem] of rows || []) { const pn = up(pn0), k = fresh ? grp + '|' + pn : pn; if (!pn || have.has(k)) continue; have.add(k);
        cat.d.push([0, -1, grp, idx(cat.asm, String(name || '').toUpperCase()), String(rf || ''), pn, idx(cat.desc, String(desc || '')), String(qty || ''), fresh ? String(rem || '') : ['KTM portal (weekly sync)', rem].filter(Boolean).join('; '), 0, 0, [vi]]); info.parts++; }
    }
    info.editions++;
  }
  // new model years go next to their model's other years (newest first), as the PDFs' editions are
  for (const slug of ['ktm', 'husqvarna']) { const { cat, dg } = out[slug]; if (!info.newEditions.some(l => cat.vmod[l])) continue;
    const yr = l => +((/ (\d{4}) \(MY/.exec(l) || [])[1] || 0), ord = cat.vars.map((l, i) => i).sort((a, b) => cat.models.indexOf(cat.vmod[cat.vars[a]]) - cat.models.indexOf(cat.vmod[cat.vars[b]]) || yr(cat.vars[b]) - yr(cat.vars[a]) || a - b);
    const to = new Map(ord.map((o, n) => [o, n])); cat.vars = ord.map(o => cat.vars[o]); dg.p = ord.map(o => dg.p[o] || {});
    for (const r of cat.d) r[11] = r[11].map(v => to.get(v)).sort((a, b) => a - b); }
  if (info.editions) for (const slug of ['ktm', 'husqvarna']) { const c = out[slug].cat; if (!c.src.some(x => /weekly/.test(x))) c.src.push('KTM Spare Parts Finder India (ktmspcatalog.bajajauto.com), weekly sync ' + (S.date || '')); }
  return info;
}

export function buildKtm(dir, rel = 'catalogues/ktm', altFile = '', syncDir = '') {
  const B = JSON.parse(fs.readFileSync(path.join(dir, 'ktm_build.json'), 'utf8'));
  const info = { models: 0, editions: 0, rows: 0, diagrams: 0, files: 0, missing: [], mrp: 0 }, out = { info };
  let M = {}; try { M = JSON.parse(fs.readFileSync(path.join(dir, KTM_MRP), 'utf8')).mrp || {}; } catch {}
  let AL = null; try { if (altFile) AL = JSON.parse(fs.readFileSync(altFile, 'utf8')); } catch {}
  const remOf = altRemarks(AL), BM = (AL && AL.mrp) || {}; info.alt = 0;
  if (syncDir) { const si = mergeSync(B, syncDir); if (si) info.sync = si; }   // 18d: before MRP / old-new remarks / counts, so the synced lines get them too
  for (const [slug] of BRANDS) {
    const { cat, dg } = B[slug];
    dg.dir = rel; dg.pick = 'All Catalogues > KTM > KTM_PDF_HD_All_Years';
    for (const [f, size] of dg.files) { info.files++; let st = null; try { st = fs.statSync(path.join(dir, f)); } catch {} if (!st || st.size !== size) info.missing.push(f); }
    cat.mrp = cat.mrp || {}; for (const r of cat.d) { const v = +M[String(r[5]).toUpperCase().replace(/[^A-Z0-9]/g, '')]; if (v > 0 && cat.mrp[r[5]] == null) { cat.mrp[r[5]] = v; info.mrp++; } }
    for (const r of cat.d) { const add = remOf(r[5]).filter(x => !String(r[8] || '').includes(x.replace(/^\w+ no\. /, ''))); if (!add.length) continue;
      r[8] = [r[8], ...add].filter(Boolean).join('; '); info.alt++;
      for (const x of add) { const n = x.replace(/^\w+ no\. /, ''), v = +M[n] || +BM[n]; if (v > 0 && cat.mrp[n] == null) cat.mrp[n] = Math.round(v * 100) / 100; } }   // MRP: KTM DMS first, else Bajaj DMS
    info.models += cat.models.length; info.editions += cat.vars.length; info.rows += cat.d.length; info.diagrams += dg.f.length;
    out[slug] = { cat, dg, pnr: pnrOf(cat) };
  }
  info.missing = [...new Set(info.missing)];
  return out;
}

// run as its own process (node lib/ktmbuild.mjs <public dir> <ktm dir> <out dir>), so a build never holds up the server
export function writeKtm(pub, dir, out, altFile = '', syncDir = '') {
  const t = Date.now(), r = buildKtm(dir, 'catalogues/ktm', altFile, syncDir);
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  for (const [slug, brand] of BRANDS) {
    const { cat, dg, pnr } = r[slug];
    put(slug + '-dg.json', JSON.stringify(dg)); put(slug + '.json', JSON.stringify(cat));
    put(slug + '-app.json', JSON.stringify({ brand, pnr, models: cat.models, cnt: { m: cat.models.length, pn: new Set(cat.d.map(x => x[5])).size } }));
  }
  writeApp(pub, out);
  put('ktm-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...r.info }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeKtm(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6]); console.log('ktm build:', i.models, 'models,', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.missing.length, 'PDFs not here yet'); }
  catch (e) { console.error('ktm build failed:', e.message); process.exit(1); }
}
