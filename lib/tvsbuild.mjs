// TVS catalogue made on the server from Sam's folder Downloads > TVS Catalogues (uploaded by Admin into FILES_DIR/catalogues/tvs, 12y,
// Sam 2026-10-26 "usme ka poora data mujhe mere server me chahiye", "koi bhi data miss nhi hona he"):
// Raw Data/tvs_build.json (made on Sam's Mac from his TVS dealer e-catalogue export: every model's parts by variant (qty per variant),
// TVS's where-used list (colours, painted parts, older variants), the MRP lists; dealer prices are left out) and Raw Data/tvs_diagrams.zip
// (the e-catalogue's diagram pictures, decoded unchanged, read by byte range: pf: refs). Sam's PDFs are made from this same data.
// Out: DATA_DIR/cat/tvs.json + tvs-dg.json (the app's brand file format) and the TVS lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import { pnrOf, writeApp, zipIndex } from './herobuild.mjs';

export const TVS_RAW = ['tvs_build.json'];
export const TVS_ZIP = 'tvs_diagrams.zip';
export const OTHER = 'Other parts (price list)';
// the app's TVS names, on sale now first (CUR of them)
const ORDER = ['Apache RTR 160 2V', 'Apache RTR 160 4V', 'Apache RTR 180 2V', 'Apache RTR 200 4V', 'Apache RTR 310', 'Apache RR 310', 'Apache RTX',
  'Ronin 225', 'Raider 125', 'Radeon', 'Sport', 'Star City Plus', 'Star City', 'XL100', 'XL Super', 'Jupiter 110', 'Jupiter 110 (2024)', 'Jupiter 125',
  'NTorq 125', 'NTorq 150', 'Wego 110', 'Scooty Pep Plus', 'Scooty Zest', 'iQube', 'Orbiter', 'Phoenix 125', 'Victor',
  'Apache 150', 'Scooty Pep', 'Scooty Streak', 'Flame', 'Jive', OTHER];
const CUR = 25;
const CC = { 'Apache RTR 160 2V': 160, 'Apache RTR 160 4V': 160, 'Apache RTR 180 2V': 177, 'Apache RTR 200 4V': 198, 'Apache RTR 310': 312,
  'Apache RR 310': 312, 'Apache RTX': 299, 'Ronin 225': 225, 'Raider 125': 125, 'Radeon': 110, 'Sport': 110, 'Star City Plus': 110, 'Star City': 110,
  'XL100': 99, 'XL Super': 70, 'Jupiter 110': 110, 'Jupiter 110 (2024)': 113, 'Jupiter 125': 125, 'NTorq 125': 125, 'NTorq 150': 150, 'Wego 110': 110,
  'Scooty Pep Plus': 88, 'Scooty Zest': 110, 'Phoenix 125': 125, 'Victor': 110, 'Apache 150': 150, 'Scooty Pep': 75, 'Scooty Streak': 88, 'Flame': 125, 'Jive': 110 };
const up = s => String(s ?? '').trim().toUpperCase();

/* dir: the uploaded folder (all files flat in it); rel: that folder as pf: refs name it. Returns { cat, dg, pnr, info } */
export function buildTvs(dir, rel = 'catalogues/tvs', opt = {}) {
  const zix = opt.zipIndex || zipIndex;
  const B = JSON.parse(fs.readFileSync(path.join(dir, 'tvs_build.json'), 'utf8'));
  const info = { models: 0, editions: 0, rows: 0, diagrams: 0, noDiagram: 0, mrp: 0, other: 0, zip: false };
  // the diagram pictures: <fig id>.png -> pf: ref in the zip (a figure only has no picture till the zip is uploaded)
  const pic = new Map(), files = [], zp = path.join(dir, TVS_ZIP);
  if (fs.existsSync(zp)) {
    files.push([TVS_ZIP, fs.statSync(zp).size]);
    try { for (const [n, [o, l]] of zix(zp)) pic.set(path.basename(n).replace(/\.\w+$/, ''), `pf:${rel}/${TVS_ZIP}:${o}:${l}`); info.zip = true; }
    catch (e) { console.log('tvs: ' + TVS_ZIP + ' not read:', e.message); }
  }
  const d = { brand: 'TVS', src: [B.src], bk: [[0, [], '']], models: [], cur: CUR, cc: {}, sheets: [], figs: [],
    vars: [], vmod: {}, asm: [], desc: [], d: [], fw: 'Fig', mrp: {} };
  const g = { f: [], p: {}, dir: rel, files, spare: [], pick: 'Downloads > TVS Catalogues' };
  const asmI = new Map(), descI = new Map(), fIdx = new Map();
  const ai = a => { if (!asmI.has(a)) { asmI.set(a, d.asm.length); d.asm.push(a); } return asmI.get(a); };
  const di = a => { if (!descI.has(a)) { descI.set(a, d.desc.length); d.desc.push(a); } return descI.get(a); };
  const fi = f => { if (!fIdx.has(f)) { fIdx.set(f, g.f.length); g.f.push(f); } return fIdx.get(f); };
  const at = m => { const i = ORDER.indexOf(m); return i < 0 ? 1e3 : i; };
  // the e-catalogue's variants first, then TVS's older variant names (where-used list)
  const eds = (B.eds || []).map((e, k) => ({ ...e, k })).sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || ((a.kind === 'cat' ? 0 : 1) - (b.kind === 'cat' ? 0 : 1)) || a.k - b.k);
  const other = (B.other || []).length ? [{ m: OTHER, v: 'TVS price list (no model)', kind: 'other', figs: [] }] : [];
  for (const e of [...eds, ...other]) {
    if (!d.models.includes(e.m)) { d.models.push(e.m); if (CC[e.m]) d.cc[e.m] = CC[e.m]; }
    e.vi = d.vars.length; const v = `${e.m} · ${String(e.v).trim()}${e.kind === 'apps' ? ' (where-used list)' : ''}`; d.vars.push(v); d.vmod[v] = e.m; g.p[String(e.vi)] = {};
  }
  d.cur = d.models.filter(m => at(m) < CUR).length;
  info.models = d.models.filter(m => m !== OTHER).length; info.editions = eds.length;
  const rows = new Map();
  const add = (vi, fig, asm, ref, rf, pn, ds, q, rem) => {
    const row = [0, ref ? -1 : -2, fig, ai(asm), String(rf ?? '').trim(), pn, di(String(ds || '').trim()), String(q ?? ''), rem || '', 0, 0];
    const key = row.join('\u0001'), o = rows.get(key);
    if (o) o[11].add(vi); else { row.push(new Set([vi])); rows.set(key, row); }
  };
  for (const e of eds) {
    const pg = g.p[String(e.vi)], used = new Set();
    const figs = e.kind === 'cat' ? [...(e.figs || [])].sort((a, b) => (parseInt(a[0], 10) || 0) - (parseInt(b[0], 10) || 0)) : e.figs || [];   // Fig 1, 2, 3...
    for (const [f0, asm, dg, list] of figs) {
      let fig = String(f0 || asm).trim(), n = 2; while (used.has(fig)) fig = String(f0 || asm).trim() + ' (' + n++ + ')'; used.add(fig);
      const ref = dg ? pic.get(dg) || null : null;
      if (ref) { pg[fig] = fi(ref); info.diagrams++; } else info.noDiagram++;
      for (const [rf, pn0, ds, q, rem] of list || []) { const pn = up(pn0); if (pn) add(e.vi, fig, up(asm), ref, rf, pn, ds, q, rem); }
    }
  }
  const kit = new Set((B.kits || []).map(k => up(k[0])));
  for (const e of other) for (const [pn0, ds] of B.other) { const pn = up(pn0); if (!pn) continue; add(e.vi, 'Price List', 'TVS PRICE LIST (NO MODEL)', null, '', pn, ds, '', kit.has(pn) ? 'Kit / consumable' : 'TVS price list'); info.other++; }
  for (const [pn, m] of Object.entries(B.mrp || {})) if (+m > 0) { d.mrp[up(pn)] = Math.round(+m); info.mrp++; }
  for (const r of rows.values()) { r[11] = [...r[11]].sort((a, b) => a - b); d.d.push(r); }
  info.rows = rows.size;
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/tvsbuild.mjs <public dir> <tvs dir> <out dir>), so a build never holds up the server
export function writeTvs(pub, dir, out) {
  const t = Date.now(), r = buildTvs(dir);
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  put('tvs-dg.json', JSON.stringify(r.dg)); put('tvs.json', JSON.stringify(r.cat));
  const ms = r.cat.models.filter(m => m !== OTHER), pns = new Set(r.cat.d.map(x => x[5]));
  put('tvs-app.json', JSON.stringify({ brand: 'TVS', pnr: r.pnr, models: ms, cnt: { m: ms.length, pn: pns.size } }));
  writeApp(pub, out);
  put('tvs-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...r.info }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeTvs(process.argv[2], process.argv[3], process.argv[4]); console.log('tvs build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.noDiagram, 'without'); }
  catch (e) { console.error('tvs build failed:', e.message); process.exit(1); }
}
