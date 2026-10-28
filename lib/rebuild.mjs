// Royal Enfield catalogue made on the server from Sam's folder Downloads > Royal Enfield Catalogue (uploaded by Admin into
// FILES_DIR/catalogues/royal-enfield, 12g, Sam 2026-10-24 "server pe add karna he abhi"):
// Raw Data/re_build.json (made on Sam's Mac from the RE EPC download: every India & SAARC model and variant, their parts lists,
// the page of each list in PDF > Models, Bike Pharma MRP from Excel/RoyalEnfield_Parts_MRP_List.csv, the EPC part photos),
// the 140 model PDFs (every diagram is its PDF page, pdf: refs) and the part photos (<part no. with / as _>.jpg).
// One edition per RE variant, named "<EPC model> (<variant>)" as the chassis search names it, so a chassis opens its own variant.
// Sam's variant PDFs are these same pages, so only the model PDFs go up (no 31 GB copy). The 3D .pvz files are not used (PTC only).
// Out: DATA_DIR/cat/royal-enfield.json + royal-enfield-dg.json and the RE lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import { pnrOf, writeApp } from './herobuild.mjs';

export const RE_RAW = ['re_build.json'];
const SRC = "Royal Enfield EPC (India & SAARC): parts lists, diagrams in the model PDFs, part photos; Bike Pharma RE MRP list. Sam's folder Downloads > Royal Enfield Catalogue";
// the app's RE names, on sale now first (CUR of them)
const ORDER = ['Classic 350', 'Bullet 350', 'Hunter 350', 'Meteor 350', 'Goan Classic 350', 'Himalayan 450', 'Scram 440', 'Guerrilla 450',
  'Interceptor 650', 'Continental GT 650', 'Super Meteor 650', 'Shotgun 650', 'Bear 650', 'Classic 650', 'Bullet 650', 'Flying Flea C6',
  'Classic 350 (old)', 'Bullet 350 (old)', 'Scram 411', 'Himalayan 411', 'Classic 500', 'Bullet 500', 'Bullet Trials 350', 'Bullet Trials 500',
  'Continental GT 535', 'Thunderbird 350', 'Thunderbird 350X', 'Thunderbird 500', 'Thunderbird 500X'];
const CUR = 16;
const CC = { 'Classic 350': 349, 'Bullet 350': 349, 'Hunter 350': 349, 'Meteor 350': 349, 'Goan Classic 350': 349, 'Himalayan 450': 452, 'Scram 440': 443,
  'Guerrilla 450': 452, 'Interceptor 650': 648, 'Continental GT 650': 648, 'Super Meteor 650': 648, 'Shotgun 650': 648, 'Bear 650': 648,
  'Classic 650': 648, 'Bullet 650': 648, 'Classic 350 (old)': 346, 'Bullet 350 (old)': 346, 'Scram 411': 411, 'Himalayan 411': 411,
  'Classic 500': 499, 'Bullet 500': 499, 'Bullet Trials 350': 346, 'Bullet Trials 500': 499, 'Continental GT 535': 535,
  'Thunderbird 350': 346, 'Thunderbird 350X': 346, 'Thunderbird 500': 499, 'Thunderbird 500X': 499 };
const tc = s => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

// the app's model for an EPC model name ("ALL NEW CLASSIC 350 - CHROME BRONZE" -> Classic 350, "CLASSIC 350 ABS - BSIV" -> Classic 350 (old))
export function reModel(mn) {
  const t = String(mn || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (/^ALL NEW CLASSIC 350/.test(t)) return 'Classic 350';
  if (/^GOAN CLASSIC/.test(t)) return 'Goan Classic 350';
  if (/^CLASSIC 350/.test(t)) return 'Classic 350 (old)';
  if (/^CLASSIC 500/.test(t)) return 'Classic 500';
  if (/^CLASSIC 650/.test(t)) return 'Classic 650';
  if (/^BULLET TR(IA|AI)LS? (350|500)/.test(t)) return 'Bullet Trials ' + t.match(/(350|500)/)[1];
  if (/^BULLET 650/.test(t)) return 'Bullet 650';
  if (/^BULLET 500/.test(t)) return 'Bullet 500';
  if (t === 'BULLET 350') return 'Bullet 350';
  if (/^BULLET (X )?350/.test(t)) return 'Bullet 350 (old)';
  if (/^CONTINENTAL GT 650/.test(t)) return 'Continental GT 650';
  if (/^CONTINENTAL GT/.test(t)) return 'Continental GT 535';
  if (/^FF\.?C6|FLYING FLEA/.test(t)) return 'Flying Flea C6';
  if (/^GUERRILLA/.test(t)) return 'Guerrilla 450';
  if (/^HIMALAYAN SCRAM 411|^SCRAM 411/.test(t)) return 'Scram 411';
  if (/^SCRAM 440/.test(t)) return 'Scram 440';
  if (/^HIMALAYAN 450/.test(t)) return 'Himalayan 450';
  if (/^HIMALAYAN/.test(t)) return 'Himalayan 411';
  if (/^HUNTER 350/.test(t)) return 'Hunter 350';
  if (/^INTERCEPTOR BEAR/.test(t)) return 'Bear 650';
  if (/^INTERCEPTOR/.test(t)) return 'Interceptor 650';
  if (/^SUPER METEOR/.test(t)) return 'Super Meteor 650';
  if (/^METEOR 350/.test(t)) return 'Meteor 350';
  if (/^SHOTGUN/.test(t)) return 'Shotgun 650';
  let m;
  if ((m = t.match(/^THUNDERBIRD (X )?(350|500)/))) return 'Thunderbird ' + m[2] + (m[1] ? 'X' : '');
  return tc(t.replace(/\s+-\s+.*$/, ''));
}
export const OTHER = 'Other Royal Enfield (no model)';
export const reVar = (mn, vn) => String(mn).trim() + ' (' + String(vn).trim() + ')';
// the weekly RE EPC sync's saved state (brand_sync/brands/royal_enfield.py), or null when it has not run on this server
export function syncState(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'royal_enfield', 'state.json'), 'utf8')); } catch { return null; } }
const safe = s => String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/\.$/, '').slice(0, 150);   // as royal_enfield.py names its SVG files

/* dir: the uploaded folder (all files flat in it); rel: that folder as refs name it. Returns { cat, dg, pnr, info } */
export function buildRE(dir, rel = 'catalogues/royal-enfield', opt = {}) {
  const B = JSON.parse(fs.readFileSync(path.join(dir, 're_build.json'), 'utf8'));
  const info = { models: 0, editions: 0, rows: 0, diagrams: 0, mrp: 0, photos: 0, missing: [] };
  const at = m => { const i = ORDER.indexOf(m); return i < 0 ? 1e3 : i; };
  const M = B.models || {};
  for (const mn in M) { const p = path.join(dir, M[mn].file); if (!fs.existsSync(p) || fs.statSync(p).size !== M[mn].size) info.missing.push(M[mn].file); }
  // 16j: the weekly RE EPC sync on this server: changed parts lists replace the uploaded ones, new parts lists, new variants and new models
  // join (diagram = the EPC's own SVG it downloaded), its MRP list wins. A list key of the upload is the EPC key + '#n' (one per copy).
  const PL = { ...(B.pl || {}) }, MRP = { ...(B.mrp || {}) }, NEWK = new Set(), S = opt.sync ? syncState(opt.sync) : null;
  const vars = [...(B.vars || [])];
  if (S) {
    const svgDir = path.join(opt.sync, 'royal_enfield', 'svg'), svgRel = (opt.syncRel || 'catalogues/hero-sync') + '/royal_enfield/svg';
    const svgRef = th => { if (!th) return null; try { const st = fs.statSync(path.join(svgDir, safe(th))); return st.size > 0 ? `pf:${svgRel}/${safe(th)}:0:${st.size}` : null; } catch { return null; } };
    const bases = new Map(); for (const k in PL) { const b = k.split('#')[0]; if (!bases.has(b)) bases.set(b, []); bases.get(b).push(k); }
    const sameRows = (a, b) => a.length === b.length && a.every((r, i) => r[0] === b[i][0] && r[1] === b[i][1] && r[2] === b[i][2] && String(r[3]) === String(b[i][3]));
    info.sync = { changed: 0, lists: 0, models: [], variants: 0, mrp: 0, at: S.last_run || '' };
    for (const [k, v] of Object.entries(S.pl || {})) {
      const rows = (v.rows || []).map(r => [r[0], r[1], r[2], r[3]]), ks = bases.get(k);
      if (ks) { for (const bk of ks) if (!sameRows(PL[bk] || [], rows)) { PL[bk] = rows; NEWK.add(bk); info.sync.changed++; } }
      else PL['sync:' + k] = rows;
    }
    const keyOf = k => (bases.get(k) || [])[0] || 'sync:' + k;
    for (const [mn, m] of Object.entries(S.models || {})) {
      if (!M[mn]) { M[mn] = { lists: [] }; info.sync.models.push(mn); }
      const L = M[mn].lists, known = new Map(L.map((l, i) => [l[0].split('#')[0], i])), fresh = [];
      for (const [sec, k, n, th] of m.tree || []) { if (known.has(k)) continue;
        known.set(k, L.length); fresh.push(L.length); L.push([keyOf(k), n === sec ? sec : sec + ' — ' + n, 0, svgRef(th)]); NEWK.add(keyOf(k)); info.sync.lists++; }
      const vt = (S.vtree || {}), had = new Set(vars.filter(x => x[0] === mn).map(x => x[1]));
      for (let i = 0; i < vars.length; i++) if (vars[i][0] === mn && fresh.length) vars[i] = [...vars[i].slice(0, 3), [...vars[i][3], ...fresh]];
      for (const vn of Object.keys(m.variants || {})) { if (had.has(vn)) continue;
        const own = vt[mn + '|' + vn], ks = own && own.length ? own.map(t => known.get(t[1])).filter(i => i != null) : L.map((_, i) => i);
        vars.push([mn, vn, String(vn).split(' - ').pop(), ks]); info.sync.variants++; }
    }
    for (const [pn, v] of Object.entries(S.mrp || {})) if (+(v && v.mrp) > 0 && MRP[pn] !== +v.mrp) { MRP[pn] = +v.mrp; info.sync.mrp++; }
  }
  const eds = vars.filter(v => M[v[0]]).map(([mn, vn, code, ks]) => ({ mn, vn, code, ks, m: reModel(mn) }))
    .sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || a.mn.localeCompare(b.mn) || a.vn.localeCompare(b.vn));
  const d = { brand: 'Royal Enfield', src: [SRC], bk: [[0, [], '']], models: [], cur: 0, cc: {}, sheets: [], figs: [],
    vars: [], vmod: {}, asm: [], desc: [], d: [], fw: 'Section', mrp: {}, phf: {}, phz: [] };
  const g = { f: [], p: {}, dir: rel, files: [], spare: [], pick: 'Downloads > Royal Enfield Catalogue' };
  const asmI = new Map(), descI = new Map(), fIdx = new Map();
  const ai = a => { if (!asmI.has(a)) { asmI.set(a, d.asm.length); d.asm.push(a); } return asmI.get(a); };
  const di = a => { if (!descI.has(a)) { descI.set(a, d.desc.length); d.desc.push(a); } return descI.get(a); };
  const fi = f => { if (!fIdx.has(f)) { fIdx.set(f, g.f.length); g.f.push(f); } return fIdx.get(f); };
  // each model's lists: [key, section title, page]; a title twice in one model gets " (2)"
  const figOf = {};
  for (const mn in M) { const seen = new Map(); figOf[mn] = M[mn].lists.map(([, t]) => { const n = (seen.get(t) || 0) + 1; seen.set(t, n); return n > 1 ? t + ' (' + n + ')' : t; }); }
  const rows = new Map(), seenV = new Set(), byMn = {};
  for (const e of eds) {
    const v = reVar(e.mn, e.vn); if (seenV.has(v)) continue; seenV.add(v);
    if (!d.models.includes(e.m)) { d.models.push(e.m); if (CC[e.m]) d.cc[e.m] = CC[e.m]; }
    const vi = d.vars.length; d.vars.push(v); d.vmod[v] = e.m; const pg = g.p[String(vi)] = {}; (byMn[e.mn] = byMn[e.mn] || []).push(vi);
    const L = M[e.mn];
    for (const j of e.ks) {
      const l = L.lists[j]; if (!l) continue; const [key, title, page] = l, fig = figOf[e.mn][j];
      const dref = l.length > 3 ? l[3] : `pdf:${rel}/${L.file}:0:${L.size}:${page}:0,0,1,1`;   // a list the sync added: its SVG (or none yet)
      if (dref) pg[fig] = fi(dref);
      const sec = String(title).split(' — ')[0].toUpperCase();
      for (const [ref, pn, ds, q] of PL[key] || []) {
        if (!pn) continue;
        const row = [0, dref ? -1 : -2, fig, ai(sec), String(ref || ''), pn, di(String(ds || '').trim()), String(q || ''), NEWK.has(key) ? 'Royal Enfield EPC (weekly sync)' : '', 0, 0];
        const k = row.join('\u0001'), o = rows.get(k);
        if (o) o[11].add(vi); else { row.push(new Set([vi])); rows.set(k, row); }
        if (d.mrp[pn] == null && MRP[pn] > 0) { d.mrp[pn] = MRP[pn]; info.mrp++; }
      }
    }
  }
  // 16m: RE's public spares store (brand_sync/brands/re_spares.py, weekly): its model categories have the EPC model names. A part it sells
  // for a model that model's lists lack is added to that model; a model category we do not have becomes a model; its MRP is the newest.
  const SP = opt.sync ? (() => { try { return JSON.parse(fs.readFileSync(path.join(opt.sync, 're_spares', 'state.json'), 'utf8')); } catch { return null; } })() : null;
  if (SP && SP.parts) {
    info.spares = { at: SP.last_run || '', parts: 0, models: [], other: 0, mrp: 0 };
    const add = (vis, fig, pn, v) => { const row = [0, -2, fig, ai(fig.toUpperCase()), '', pn, di(String(v.name || '').trim()), '', 'Royal Enfield spares store (weekly sync)', 0, 0, new Set(vis)];
      rows.set('sp\u0001' + fig + '\u0001' + pn, row); info.spares.parts++; };
    const seen = new Set(), viMn = {}, pm = {}; for (const [mn, vs] of Object.entries(byMn)) for (const x of vs) viMn[x] = mn;
    for (const r of rows.values()) { seen.add(r[5]); for (const x of r[11]) { const m = viMn[x]; (pm[m] = pm[m] || new Set()).add(r[5]); } }
    const newVar = (m, name) => { if (!d.models.includes(m)) { d.models.push(m); if (CC[m]) d.cc[m] = CC[m]; } const vi = d.vars.length; d.vars.push(name); d.vmod[name] = m; g.p[String(vi)] = {}; return vi; };
    for (const [mn, pns] of Object.entries(SP.cats || {})) {
      let vis = byMn[mn];
      const have = pm[mn] || new Set();
      const miss = pns.filter(pn => SP.parts[pn] && !have.has(pn)); if (!miss.length) continue;
      if (!vis) { vis = [newVar(reModel(mn), reVar(mn, 'RE spares store'))]; info.spares.models.push(mn); }
      for (const pn of miss) { add(vis, 'More parts (RE spares store)', pn, SP.parts[pn]); seen.add(pn); }
    }
    let ov = -1;
    for (const [pn, v] of Object.entries(SP.parts)) { if (seen.has(pn)) continue; seen.add(pn);
      if (ov < 0) ov = newVar(OTHER, OTHER + ' · RE spares store (weekly sync)'); add([ov], 'Parts (RE spares store)', pn, v); info.spares.other++; }
    for (const [pn, v] of Object.entries(SP.parts)) if (+v.mrp > 0) { if (d.mrp[pn] !== +v.mrp) info.spares.mrp++; d.mrp[pn] = +v.mrp; }
  }
  info.diagrams = g.f.length;
  for (const r of rows.values()) { r[11] = [...r[11]].sort((a, b) => a - b); d.d.push(r); }
  info.rows = rows.size; info.editions = d.vars.length;
  d.cur = d.models.filter(m => at(m) < CUR).length;
  info.models = d.models.length;
  // part photos: one loose jpg each, read whole
  const used = new Set(d.d.map(r => r[5]));
  for (const [pn, [f, size, w, h]] of Object.entries(B.ph || {})) {
    if (!used.has(pn)) continue;
    d.phf[pn] = [d.phz.length, 0, size, w, h]; d.phz.push(`${rel}/${f}`); info.photos++;
  }
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/rebuild.mjs <public dir> <re dir> <out dir>), so a build never holds up the server
export function writeRE(pub, dir, out, sync) {
  const t = Date.now(), r = buildRE(dir, 'catalogues/royal-enfield', sync && fs.existsSync(sync) ? { sync } : {});
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  put('royal-enfield-dg.json', JSON.stringify(r.dg)); put('royal-enfield.json', JSON.stringify(r.cat));
  const pns = new Set(r.cat.d.map(x => x[5])), ms = r.cat.models.filter(m => m !== OTHER);
  put('royal-enfield-app.json', JSON.stringify({ brand: 'Royal Enfield', pnr: r.pnr, models: ms, cnt: { m: ms.length, pn: pns.size } }));
  writeApp(pub, out);
  put('royal-enfield-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...r.info, missing: r.info.missing.length, missingFiles: r.info.missing.slice(0, 50) }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeRE(process.argv[2], process.argv[3], process.argv[4], process.argv[5]); console.log('royal enfield build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.photos, 'photos,', i.missing.length, 'model PDFs not uploaded yet'); }
  catch (e) { console.error('royal enfield build failed:', e.message); process.exit(1); }
}
