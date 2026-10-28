// Honda catalogue made on the server from Sam's folder Downloads > Honda Catalogue (uploaded whole by Admin into FILES_DIR/catalogues/honda, 11z):
// Raw Data/honda_search_all.json.gz (every model's parts with MRP), Raw Data/Diagrams HQ/honda_hq_*.bin (the diagrams, one per assembly,
// read straight out of the .bin files: pf: refs, nothing unpacked) and Raw Data/honda_extras.json (made from his Excel, Old Volumes and the
// model PDFs: ref numbers, old numbers, colours, accessories, service kits, site-only parts).
// Out: DATA_DIR/cat/honda.json + honda-dg.json (the app's brand file format) and the Honda lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pnrOf, writeApp } from './herobuild.mjs';

export const HONDA_BINS = ['honda_hq_0000_0840.bin', 'honda_hq_0840_1300.bin', 'honda_hq_1300_2540.bin', 'honda_hq_2540_3820.bin', 'honda_hq_3820_5190.bin',
  'honda_hq_5190_6410.bin', 'honda_hq_6410_7400.bin', 'honda_hq_7400_8561.bin', 'honda_hq_fix3.bin'];
export const HONDA_RAW = ['honda_search_all.json.gz', 'honda_extras.json', ...HONDA_BINS];
const SRC = "Honda e-catalogue raw data (models, diagrams, MRP) with Honda's Excel lists, Old Volumes and model PDFs, Sam's folder Downloads > Honda Catalogue";
// Honda's vehicle names as the app writes them (tools/brands/brands_build.py)
const NAME = { 'CB Shine/ Shine 125': 'CB Shine / Shine 125', 'Activa125': 'Activa 125', 'HNESS': "H'ness CB350", 'GRAZIA': 'Grazia', 'XBLADE': 'X-Blade',
  'Shine100 DX': 'Shine 100 DX', 'CLIQ': 'Cliq', 'Activa e': 'Activa e:', '500X': 'CB500X' };
const ORDER = ['Activa', 'Activa 125', 'Shine 100', 'Shine 100 DX', 'CB Shine / Shine 125', 'SP125', 'SP160', 'Dio', 'Dio 125', 'CB Unicorn 160', 'Livo',
  'CD 110 Dream', 'Hornet 2.0', 'CB125 Hornet', 'CB200X', "H'ness CB350", 'CB350', 'CB300F', 'CB300R', 'Activa e:', 'QC1', 'CB500X', 'CB650R', 'CBR650R',
  'Africa Twin', 'X-Blade', 'Grazia', 'Navi', 'Cliq', 'Activa i', 'Aviator', 'Dream Yuga', 'Dream Neo', 'CB Shine SP', 'CB Hornet 160R', 'CB Twister',
  'CB Trigger', 'CB Unicorn', 'CB Unicorn Dazzler', 'CBF Stunner', 'CBR150R', 'CBR250R', 'CBR650F', 'Eterno'];
const CUR = 25;   // ORDER[0..24] are on sale now
const CC = { 'Activa': 110, 'Activa 125': 125, 'Shine 100': 100, 'Shine 100 DX': 100, 'CB Shine / Shine 125': 125, 'SP125': 125, 'SP160': 160, 'Dio': 110,
  'Dio 125': 125, 'CB Unicorn 160': 160, 'Livo': 110, 'CD 110 Dream': 110, 'Hornet 2.0': 184, 'CB125 Hornet': 125, 'X-Blade': 160, 'CB200X': 184,
  "H'ness CB350": 350, 'CB350': 350, 'CB300F': 293, 'CB300R': 286, 'CB500X': 471, 'CB650R': 649, 'CBR650R': 649, 'Africa Twin': 1084, 'Grazia': 125,
  'Navi': 110, 'Cliq': 110, 'Activa i': 110, 'Aviator': 110, 'Dream Yuga': 110, 'Dream Neo': 110, 'CB Shine SP': 125, 'CB Hornet 160R': 163,
  'CB Twister': 110, 'CB Trigger': 150, 'CB Unicorn': 150, 'CB Unicorn Dazzler': 150, 'CBF Stunner': 125, 'CBR150R': 150, 'CBR250R': 249, 'CBR650F': 649, 'Eterno': 150 };
export const EXTRA = ['Accessories & merchandise', 'Service kits', 'Other parts (site search)'];   // no diagrams; not bikes of the Find Part list
// the model-year letter, the last letter of the code (SCV110S = 2025; I O Q U are not used; a code ending in a digit has no year)
const YL = 'ABCDEFGHJKLMNPRST';
export const hondaYears = code => [...new Set(String(code).split('/').map(p => p ? YL.indexOf(p.slice(-1)) : -1).filter(i => i >= 0).map(i => 2010 + i))].sort();
const varName = (m, code) => { const ys = hondaYears(code); const yl = ys.length ? (ys.length === 1 ? String(ys[0]) : ys[0] + '-' + ys[ys.length - 1]) : ''; return m + ' · ' + (yl ? yl + ' · ' : '') + code; };
const up = s => String(s ?? '').trim().toUpperCase();
const normD = s => up(s).replace(/[^A-Z0-9]/g, '');

const fsize = f => { try { return fs.statSync(f).size; } catch { return 0; } };
// the Honda sync's saved state (brand_sync/brands/honda.py), or null when the sync has not run on this server
export function syncState(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'honda', 'state.json'), 'utf8')); } catch { return null; } }

// a .bin of diagrams: a 10-digit header length, the header ([[key, size], ...]) and the pictures back to back
export function binIndex(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const h = Buffer.alloc(10); fs.readSync(fd, h, 0, 10, 0); const L = +h.toString('latin1');
    if (!(L > 1)) throw new Error('not a diagram file: ' + path.basename(file));
    const b = Buffer.alloc(L); fs.readSync(fd, b, 0, L, 10);
    let off = 10 + L; return JSON.parse(b.toString('utf8')).map(([k, n]) => { const o = [String(k), off, +n]; off += +n; return o; });
  } finally { fs.closeSync(fd); }
}

/* dir: the uploaded folder (all files flat in it); rel: that folder as pf: refs name it. Returns { cat, dg, pnr, info } */
export function buildHonda(dir, rel = 'catalogues/honda', opt = {}) {
  const bix = opt.binIndex || binIndex;
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'honda_search_all.json.gz'))).toString('utf8'));
  const X = JSON.parse(fs.readFileSync(path.join(dir, 'honda_extras.json'), 'utf8'));
  const F = Object.fromEntries((raw.fields || []).map((k, i) => [k, i])), R = raw.rows;
  const info = { models: 0, editions: 0, rows: 0, diagrams: 0, noDiagram: 0, refs: 0, mrp: 0, extra: 0 };
  // diagrams: model id + assembly id -> picture; an assembly's picture is the same in every model that has it
  const exact = new Map(), byAsm = new Map(), files = [];
  for (const f of HONDA_BINS) {
    const p = path.join(dir, f); if (!fs.existsSync(p)) continue;
    files.push([f, fs.statSync(p).size]);
    for (const [k, o, n] of bix(p)) { const s = k.split('_'), a = s[s.length - 1], m = s[s.length - 2], ref = `pf:${rel}/${f}:${o}:${n}`;
      if (f === 'honda_hq_fix3.bin' || !exact.has(m + '_' + a)) exact.set(m + '_' + a, ref); if (!byAsm.has(a) || f === 'honda_hq_fix3.bin') byAsm.set(a, ref); }
  }
  const d = { brand: 'Honda', src: [SRC], bk: [[0, [], ''], [0, [], "From Honda's Excel lists and Old Volumes: no diagram"]], models: [], cur: CUR, cc: {}, sheets: [], figs: [],
    vars: [], vmod: {}, asm: [], desc: [], d: [], fw: 'Fig', mrp: {} };
  const g = { f: [], p: {}, dir: rel, files, spare: [], pick: 'Downloads > Honda Catalogue' };
  const asmI = new Map(), descI = new Map(), fIdx = new Map();
  const ai = a => { if (!asmI.has(a)) { asmI.set(a, d.asm.length); d.asm.push(a); } return asmI.get(a); };
  const di = a => { if (!descI.has(a)) { descI.set(a, d.desc.length); d.desc.push(a); } return descI.get(a); };
  const fi = f => { if (!fIdx.has(f)) { fIdx.set(f, g.f.length); g.f.push(f); } return fIdx.get(f); };
  const setMrp = (pn, v) => { const p = Math.round(+v); if (pn && p > 0 && d.mrp[pn] == null) { d.mrp[pn] = p; info.mrp++; } };
  // 15d: the weekly Honda sync on this server (brand_sync's data in FILES_DIR/catalogues/hero-sync/honda): its MRP is the newest, so it goes first
  const S = opt.sync ? syncState(opt.sync) : null;
  if (S) { info.sync = { mrp: 0, models: 0, figs: 0, rows: 0, extra: 0, at: S.last_run || '' };
    for (const [pn, v] of Object.entries(S.mrp || {})) { const before = d.mrp[up(pn)]; setMrp(up(pn), v && v.mrp); if (before == null && d.mrp[up(pn)] != null) info.sync.mrp++; }
    for (const a of Object.values(S.acc || {})) setMrp(up(a.pn), a.mrp); }
  // the editions (model codes): bikes in the app's order, newest first
  const eds = new Map();
  for (const r of R) { const code = String(r[F.MODEL]); if (!eds.has(code)) eds.set(code, { code, m: NAME[r[F.VEHICLE]] || String(r[F.VEHICLE]).trim(), mid: String(r[F.MODELID]) }); }
  const at = m => { const i = ORDER.indexOf(m); return i < 0 ? 1e3 : i; };
  const yOf = c => { const y = hondaYears(c); return y.length ? y[y.length - 1] : 0; };
  const list = [...eds.values()].sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || (yOf(b.code) - yOf(a.code)) || b.code.localeCompare(a.code));
  for (const e of list) {
    if (!d.models.includes(e.m)) { d.models.push(e.m); if (CC[e.m]) d.cc[e.m] = CC[e.m]; }
    e.vi = d.vars.length; const v = varName(e.m, e.code); d.vars.push(v); d.vmod[v] = e.m; g.p[String(e.vi)] = {};
  }
  d.cur = d.models.filter(m => at(m) < CUR).length;
  info.models = d.models.length; info.editions = list.length;
  // ref numbers from the model PDFs: code -> fig -> [[ref, part no.], ...]
  const refs = X.refs || {}, xl = X.xl || {};
  const refQ = new Map();   // code|fig -> part no. -> refs not used yet
  const refOf = (code, fig, pn) => { const k = code + '|' + fig; let q = refQ.get(k);
    if (!q) { q = new Map(); for (const [rf, p] of ((refs[code.replace(/\//g, '-')] || {})[fig] || [])) { const a = q.get(up(p)) || []; a.push(String(rf)); q.set(up(p), a); } refQ.set(k, q); }
    const a = q.get(pn); return a && a.length ? (a.length > 1 ? a.shift() : a[0]) : ''; };
  // gasket kits: what is inside, on the kit's own line in that model
  const gk = new Map(); for (const [code, name, inn] of X.gasket || []) gk.set(code + '|' + normD(name), inn);
  const kitHas = inn => 'Kit has: ' + inn.map(([p, ds, q]) => p + ' ' + ds + (q > 1 ? ' ×' + q : '')).join(', ');
  const asmSeen = new Map();   // code|fig -> [assembly id, ...] (two assemblies under one fig no.: the second is 'E-10 (2)')
  const rows = new Map(), inRaw = new Set();
  const figOf = new Map(), have = new Map();   // code|assembly id -> fig as shown; edition|fig -> its part numbers (for the sync's additions)
  for (const r of R) {
    const e = eds.get(String(r[F.MODEL])), pn = up(r[F.PARTNO]); if (!pn) continue;
    const fig0 = String(r[F.GROUPNO] || '').trim(), aid = String(r[F.ASSEMBLYID]), k0 = e.code + '|' + fig0;
    let s = asmSeen.get(k0); if (!s) asmSeen.set(k0, s = []); if (!s.includes(aid)) s.push(aid);
    const fig = s.indexOf(aid) ? fig0 + ' (' + (s.indexOf(aid) + 1) + ')' : fig0;
    const pg = g.p[String(e.vi)];
    if (pg[fig] == null) { const ref = exact.get(e.mid + '_' + aid) || byAsm.get(aid); if (ref) { pg[fig] = fi(ref); info.diagrams++; } else { pg[fig] = -1; info.noDiagram++; } }
    const x = xl[pn] || [], rem = [];
    if (x[0] && x[0] !== pn) rem.push('Old no. ' + x[0]);
    if (x[1]) rem.push('Colour: ' + x[1]);
    const kit = gk.get(e.code + '|' + normD(r[F.DESCRIPTION])); if (kit) rem.push(kitHas(kit));
    const ref = refOf(e.code, fig0, pn); if (ref) info.refs++;
    const row = [0, pg[fig] >= 0 ? -1 : -2, fig, ai(String(r[F.ASSEMBLYNAME] || '').trim()), ref, pn, di(String(r[F.DESCRIPTION] || '').trim()),
      String(r[F.QTY] ?? ''), rem.join('; '), r[F.NS] === 'NS' ? 1 : 0, 0];
    const key = row.join('\u0001'), o = rows.get(key);
    if (o) o[11].add(e.vi); else { row.push(new Set([e.vi])); rows.set(key, row); }
    inRaw.add(pn); setMrp(pn, r[F.PRICE1]);
    figOf.set(e.code + '|' + aid, fig); const hk = e.vi + '|' + fig; if (!have.has(hk)) have.set(hk, new Set()); have.get(hk).add(pn);
  }
  // the sync's new models, new assemblies and parts added to an assembly (diagrams: the sync's own pictures, read whole: pf: refs)
  const H = (S && S.hist) || {};
  if (S) for (const [code, c] of Object.entries(S.crawled || {})) {
    let e = eds.get(code);
    if (!e) { const m = NAME[c.series] || String(c.series || code).trim(); e = { code, m, mid: String(c.mid) }; eds.set(code, e);
      if (!d.models.includes(m)) { d.models.push(m); if (CC[m]) d.cc[m] = CC[m]; }
      e.vi = d.vars.length; const v = varName(m, code); d.vars.push(v); d.vmod[v] = m; g.p[String(e.vi)] = {}; info.sync.models++; info.editions++; }
    const pg = g.p[String(e.vi)];
    for (const [agg, fig0, name, aid, h] of c.asms || []) {
      let A; try { A = JSON.parse(fs.readFileSync(path.join(opt.sync, 'honda', 'asm', c.mid + '_' + aid + '.json'), 'utf8')); } catch { continue; }
      let fig = figOf.get(code + '|' + aid);
      if (fig == null) { fig = String(fig0 || name).trim(); let n = 2; while (pg[fig] != null || have.has(e.vi + '|' + fig)) fig = String(fig0 || name).trim() + ' (' + n++ + ')';
        const img = h ? path.join(opt.sync, 'honda', 'img', h + '.jpg') : '', size = img ? fsize(img) : 0;
        pg[fig] = size ? fi(`pf:${opt.syncRel}/honda/img/${h}.jpg:0:${size}`) : -1; if (size) info.diagrams++; else info.noDiagram++; info.sync.figs++; }
      const hk = e.vi + '|' + fig; if (!have.has(hk)) have.set(hk, new Set()); const got = have.get(hk);
      for (const x of A.rows || []) { const pn = up(x.pn); if (!pn || got.has(pn)) continue; got.add(pn);
        const rem = []; if (x.color) rem.push('Colour: ' + x.color);
        const row = [0, pg[fig] >= 0 ? -1 : -2, fig, ai(String(name || '').trim()), String(x.ref ?? '').trim(), pn, di(String(x.desc || '').trim()), String(x.qty ?? ''), rem.join('; '), x.ns === 'NS' ? 1 : 0, 0, new Set([e.vi])];
        const k = row.slice(0, 11).join('\u0001'), o = rows.get(k); if (o) o[11].add(e.vi); else rows.set(k, row); inRaw.add(pn); setMrp(pn, x.mrp); info.sync.rows++; }
    }
  }
  // old numbers from Honda's History page: on the new number's lines ("Old no."), and the old number itself findable ("New no.")
  if (S) for (const r of rows.values()) for (const o of H[r[5]] || []) if (o[0] && !r[8].includes('Old no. ' + up(o[0]))) r[8] = (r[8] ? r[8] + '; ' : '') + 'Old no. ' + up(o[0]);
  for (const vi in g.p) for (const f in g.p[vi]) if (g.p[vi][f] < 0) delete g.p[vi][f];
  for (const r of rows.values()) { r[11] = [...r[11]].sort((a, b) => a - b); d.d.push(r); }
  info.rows = rows.size;
  // what no model has: accessories, service kits, parts found only in Honda's site search (no diagrams)
  const seen = new Set(inRaw), xv = {};
  const xvar = (m, name) => { if (xv[name] == null) { if (!d.models.includes(m)) d.models.push(m); xv[name] = d.vars.length; d.vars.push(name); d.vmod[name] = m; g.p[String(xv[name])] = {}; } return xv[name]; };
  const add = (m, name, a, pn, ds, mrp, rem, ns = 0) => { pn = up(pn); if (!/\d/.test(pn) || pn.split(' ').length > 2 || pn.length < 5 || seen.has(pn)) return;   // a name in the number column is no part number
    seen.add(pn); setMrp(pn, mrp);
    d.d.push([1, -2, '', ai(a), '', pn, di(String(ds || '').trim()), '', rem, ns, 0, [xvar(m, name)]]); info.extra++; };
  const fits = s => (s = String(s || '').trim()) ? 'Fits: ' + s.replace(/\s*;\s*/g, ', ') : '';
  for (const [t, pn, ds, mrp, m] of X.acc || []) add(EXTRA[0], 'Honda ' + t, up(t), pn, ds, mrp, fits(m));
  for (const [pn, ds, mrp, m, inn] of X.svc || []) add(EXTRA[1], 'Honda service kits', 'SERVICE KITS', pn, ds, mrp, [fits(m), inn ? 'Kit has: ' + String(inn).replace(/\s+/g, ' ').trim() : ''].filter(Boolean).join('; '));
  for (const [pn, k] of Object.entries(X.kit || {})) add(EXTRA[1], 'Honda service kits', 'SERVICE KITS', pn, k.n, k.mrp, [fits(k.m), k.in && k.in.length ? kitHas(k.in) : ''].filter(Boolean).join('; '));
  for (const [pn, ds, mrp, note] of X.site || []) add(EXTRA[2], 'Honda site search only', 'SITE SEARCH ONLY', pn, ds, mrp, note || '');
  for (const [pn, ds, mrp, note] of X.other || []) { const ns = /not serviceable|\bNS\b/i.test(note || '') ? 1 : 0; add(EXTRA[2], 'Honda other accessories (site search)', 'OTHER ACCESSORIES', pn, ds, mrp, ns ? '' : note || '', ns); }
  if (S) { const n0 = info.extra;   // what the sync found that nothing above has: accessories and kits, new part numbers, old numbers
    for (const [id, a] of Object.entries(S.acc || {})) { const inn = (S.kits || {})[id];
      add(EXTRA[0], 'Honda ' + String(a.sec || 'accessories').toLowerCase(), up(a.sec || 'ACCESSORIES'), a.pn, a.desc, a.mrp, [fits((a.models || []).join('; ')), inn && inn.length ? kitHas(inn) : ''].filter(Boolean).join('; ')); }
    for (const [pn, v] of Object.entries(S.mrp || {})) add(EXTRA[2], 'Honda new parts (weekly sync)', 'NEW PARTS (HONDA SITE)', pn, v.desc, v.mrp, '', v.ns === 'NS' ? 1 : 0);
    for (const [nw, olds] of Object.entries(H)) for (const o of olds) add(EXTRA[2], 'Honda old part numbers', 'OLD PART NUMBERS', o[0], o[1] || ((S.mrp || {})[nw] || {}).desc, o[2], 'New no. ' + up(nw));
    info.sync.extra = info.extra - n0; }
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/hondabuild.mjs <public dir> <honda dir> <out dir>), so a build never holds up the server
export function writeHonda(pub, dir, out, sync) {
  const t = Date.now(), r = buildHonda(dir, 'catalogues/honda', sync ? { sync, syncRel: 'catalogues/' + path.basename(sync) } : {});
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  put('honda-dg.json', JSON.stringify(r.dg)); put('honda.json', JSON.stringify(r.cat));
  const ms = r.cat.models.filter(m => !EXTRA.includes(m)), pns = new Set(r.cat.d.map(x => x[5]));
  put('honda-app.json', JSON.stringify({ brand: 'Honda', pnr: r.pnr, models: ms, cnt: { m: ms.length, pn: pns.size } }));
  writeApp(pub, out);
  put('honda-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...r.info }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeHonda(process.argv[2], process.argv[3], process.argv[4], process.argv[5]); console.log('honda build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.refs, 'refs,', i.extra, 'extra parts'); }
  catch (e) { console.error('honda build failed:', e.message); process.exit(1); }
}
