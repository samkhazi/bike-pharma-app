// Yamaha catalogue made on the server from Sam's folder Downloads > Yamaha Catalogue (uploaded by Admin into FILES_DIR/catalogues/yamaha, 12e):
// Raw Data/yamaha_build.json (made on Sam's Mac from the 440 parts books of PDF > Models that have a text layer, with Excel: official MRP,
// superseding old -> new numbers, spares kit contents SPR118, colour codes, model names from the service schedule and labour rates) and the
// book PDFs: every diagram is the left part of its PDF page (pdf: refs). One edition per model code, from its newest book; older books of
// the same code add only the parts the newest one does not list, under "<fig> (<book date>)" with their own diagram.
// Out: DATA_DIR/cat/yamaha.json + yamaha-dg.json (the app's brand file format) and the Yamaha lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import { pnrOf, writeApp } from './herobuild.mjs';

export const YAMAHA_RAW = ['yamaha_build.json'];
const SRC = "Yamaha parts books (IYM dealer portal), Yamaha MRP, superseding and kit lists, Sam's folder Downloads > Yamaha Catalogue";
export const OTHER = 'Other Yamaha (no model name)';
// on sale now first (CUR of them), then the older bikes
const NOW = ['R15 V4', 'R15 V3', 'MT-15 V2', 'XSR 155', 'FZ-S FI Version 4.0', 'FZ FI Version 4.0', 'FZ-S FI Hybrid', 'FZ-X', 'FZ 25', 'FZS 25', 'R3',
  'Aerox 155', 'Aerox 155 Version S', 'Fascino 125 FI', 'Cygnus Ray ZR 125 FI', 'Ray ZR Street Rally'];
const CC = { 'R15': 150, 'R15 V2': 150, 'R15 V3': 155, 'R15 V4': 155, 'MT-15': 155, 'MT-15 V2': 155, 'XSR 155': 155, 'R3': 321, 'FZ 25': 249, 'FZS 25': 249,
  'FZ16': 153, 'FZ-S': 153, 'FZ FI Version 2.0': 149, 'FZ FI Version 3.0': 149, 'FZ FI Version 4.0': 149, 'FZ-S FI Version 2.0': 149, 'FZ-S FI Version 3.0': 149,
  'FZ-S FI Version 4.0': 149, 'FZ-S FI Hybrid': 149, 'FZ-X': 149, 'FZ Rave': 149, 'Fazer': 153, 'Fazer FI': 149, 'Aerox 155': 155, 'Aerox 155 Version S': 155,
  'Fascino': 113, 'Fascino S': 113, 'Fascino 125 FI': 125, 'Cygnus Ray ZR 125 FI': 125, 'Ray ZR Street Rally': 125, 'Cygnus Ray ZR': 113, 'Cygnus Ray Z': 113,
  'Cygnus Ray': 113, 'Cygnus Alpha': 113, 'Alba': 106, 'Crux': 106, 'Libero': 106, 'YBR110': 106, 'YBR125': 123, 'YBX125': 123, 'YD125': 123, 'Enticer': 123,
  'Gladiator': 123, 'Saluto': 125, 'Saluto RX': 110, 'SZ': 153, 'SZ-R': 153, 'SZ-RR': 153, 'SZ-S': 153, 'SZ-X': 153, 'RX100': 98, 'RX135': 132 };
const up = s => String(s ?? '').trim().toUpperCase();
// a Yamaha number without dashes, 12 long (B0T-E1102-10 -> B0TE11021000), as the MRP, superseding and kit lists write it
export const ymKey = pn => { const c = up(pn).replace(/[-–\s]/g, ''); return c.length === 10 ? c + '00' : c; };
const noQty = q => q == null || /^(|-|–|0)$/.test(String(q).trim());

/* dir: the uploaded folder (all files flat in it); rel: that folder as pdf: refs name it. Returns { cat, dg, pnr, info } */
// the Yamaha sync's saved state (brand_sync/brands/yamaha.py, pymidol), or null when the sync has not run on this server
export function syncState(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'yamaha', 'state.json'), 'utf8')); } catch { return null; } }

export function buildYamaha(dir, rel = 'catalogues/yamaha', opt = {}) {
  const B = JSON.parse(fs.readFileSync(path.join(dir, 'yamaha_build.json'), 'utf8'));
  // 16h: the weekly pymidol sync on this server: its MRP list is the newest (MRP only), its superseding pairs and kits join the uploaded ones
  const S = opt.sync ? syncState(opt.sync) : null, MRP = { ...(B.mrp || {}) };
  if (S) { for (const [pn, v] of Object.entries(S.mrp || {})) if (+(v && v.mrp) > 0) MRP[ymKey(pn)] = +v.mrp;
    B.sup = [...(B.sup || []), ...(S.sup || [])];
    B.kits = [...(B.kits || [])]; for (const [k, kv] of Object.entries(S.kits || {})) for (const p of (kv && kv.parts) || []) if (p && p[0]) B.kits.push([k, p[0]]); }
  const info = { models: 0, editions: 0, books: 0, rows: 0, diagrams: 0, older: 0, mrp: 0, oldNew: 0, kits: 0, missing: [] };
  const books = [...(B.books || [])];   // a book PDF not uploaded yet only has no diagram till it is (the refs name it)
  for (const b of books) { const p = path.join(dir, b.file); if (!fs.existsSync(p) || fs.statSync(p).size !== b.size) info.missing.push(b.file); }
  // 16i: model catalogues the weekly sync downloaded and read (brand_sync/brands/yamaha_books.py): new models and newer books join the uploaded ones,
  // their diagrams are pages of the downloaded PDF (FILES_DIR/catalogues/hero-sync/output/Yamaha/PDF/Models)
  const names = { ...(B.names || {}) };
  if (S) { const known = new Set(books.map(b => path.basename(b.file) + '|' + b.size)), syncRel = (opt.syncRel || 'catalogues/hero-sync') + '/output/Yamaha/PDF/Models';
    const pre = new Map(); for (const [c, n] of Object.entries(names)) { const k = c.slice(0, 3), m = pre.get(k) || new Map(); m.set(n, (m.get(n) || 0) + 1); pre.set(k, m); }
    const tidy = n => String(n || '').replace(/^YAMAHA\s*-?\s*/i, '').replace(/\s+(IND|NPL|SEA|BGD|LKA)\b.*$/i, '').trim();
    info.sync = { books: 0, newModels: [] };
    for (const b of Object.values(S.books || {})) { if (!b || !b.rows || !(b.figs || []).length || known.has(b.file + '|' + b.size)) continue;
      books.push({ ...b, rel: syncRel }); info.sync.books++;
      for (const c of b.codes || []) if (!names[c]) { const m = pre.get(c.slice(0, 3)); names[c] = m ? [...m].sort((x, y) => y[1] - x[1])[0][0] : (tidy(b.name) || OTHER); info.sync.newModels.push(c + ' ' + names[c]); } } }
  info.books = books.length;
  // dashed number of every book part, so the lists' numbers read like the books'
  const dash = new Map();
  for (const b of books) for (const f of b.figs || []) for (const r of f.rows || []) { const p = up(r[1]).replace(/–/g, '-'); if (p && !dash.has(ymKey(p))) dash.set(ymKey(p), p); }
  // 19x (Sam 2026-11-11): a number only the MRP list has (12 characters, B44H35000300) is written the way the books write theirs (B44-H3500-03):
  // the dash places are taken from the books' own numbers that start the same way (3-5-2, or 5-5 for the 9.... standard parts); the last 00 is not written
  const dashAt = new Map(); for (const p of dash.values()) { const i = p.indexOf('-'); if (i !== 3 && i !== 5) continue; const c = dashAt.get(p[0]) || [0, 0]; c[i === 3 ? 0 : 1]++; dashAt.set(p[0], c); }
  const ymFmt = c => { if (!/^[A-Z0-9]{10}00$/.test(c)) return c; const n = dashAt.get(c[0]), five = n ? n[1] > n[0] : c[0] === '9', b = c.slice(0, 10);
    return five ? b.slice(0, 5) + '-' + b.slice(5) : b.slice(0, 3) + '-' + b.slice(3, 8) + '-' + b.slice(8); };
  const show = c => dash.get(c) || ymFmt(c);
  const toNew = new Map(), toOld = new Map();
  for (const [o0, n0] of B.sup || []) { const o = ymKey(o0), n = ymKey(n0); if (!o || !n || o === n) continue; toNew.set(o, n); const a = toOld.get(n) || []; if (!a.includes(o)) a.push(o); toOld.set(n, a); }
  const kit = new Map();
  for (const [k, pn] of B.kits || []) { const c = ymKey(pn), a = kit.get(c) || []; if (k && !a.includes(k)) a.push(String(k).trim()); kit.set(c, a); }
  const col = B.colours || {};
  const colRem = s => String(s || '').trim().replace(/\s+/g, ' ').replace(/\b[A-Z0-9]{2,7}\b/g, w => col[w] && !/^\d+$/.test(w) ? w + ' (' + col[w] + ')' : w);
  // editions: one per model code, its books newest first
  const byCode = new Map();
  for (const b of books) for (const c of b.codes || []) { if (!byCode.has(c)) byCode.set(c, []); byCode.get(c).push(b); }
  for (const a of byCode.values()) a.sort((x, y) => String(y.date).localeCompare(String(x.date)) || x.file.localeCompare(y.file));
  const nameOf = c => names[c] || OTHER;
  const at = m => { const i = NOW.indexOf(m); return i < 0 ? (m === OTHER ? 2e3 : 1e3) : i; };
  const eds = [...byCode].map(([code, bs]) => ({ code, bs, m: nameOf(code) }))
    .sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || String(b.bs[0].date).localeCompare(String(a.bs[0].date)) || a.code.localeCompare(b.code));
  const d = { brand: 'Yamaha', src: [SRC], bk: [[0, [], '']], models: [], cur: 0, cc: {}, sheets: [], figs: [],
    vars: [], vmod: {}, asm: [], desc: [], d: [], fw: 'Fig', mrp: {} };
  const g = { f: [], p: {}, dir: rel, files: [], spare: [], pick: 'Downloads > Yamaha Catalogue' };
  const asmI = new Map(), descI = new Map(), fIdx = new Map();
  const ai = a => { if (!asmI.has(a)) { asmI.set(a, d.asm.length); d.asm.push(a); } return asmI.get(a); };
  const di = a => { if (!descI.has(a)) { descI.set(a, d.desc.length); d.desc.push(a); } return descI.get(a); };
  const fi = f => { if (!fIdx.has(f)) { fIdx.set(f, g.f.length); g.f.push(f); } return fIdx.get(f); };
  for (const e of eds) {
    if (!d.models.includes(e.m)) { d.models.push(e.m); if (CC[e.m]) d.cc[e.m] = CC[e.m]; }
    const b = e.bs[0]; e.vi = d.vars.length;
    const v = `${e.m} · ${e.code} ${String(b.title || '').trim()} (${b.date})`; d.vars.push(v); d.vmod[v] = e.m; g.p[String(e.vi)] = {};
  }
  d.cur = d.models.filter(m => at(m) < NOW.length).length;
  info.models = d.models.filter(m => m !== OTHER).length; info.editions = eds.length;
  const rows = new Map();
  // 19l: YPEC's own picture of a diagram when the YPEC sync (lib/ypecsync.mjs) has it with the places of its numbers: that picture is shown, so
  // every number sits exactly where Yamaha's dealer catalogue has it. Matched per model code by fig number and name.
  const yp = opt.sync ? path.join(opt.sync, 'yamaha', 'ypec') : null, ypRel = (opt.syncRel || 'catalogues/hero-sync') + '/yamaha/ypec/img/';
  let ypC = {}; if (yp) try { ypC = JSON.parse(fs.readFileSync(path.join(yp, 'coords.json'), 'utf8')) || {}; } catch { ypC = {}; }
  const nm = s => up(s).replace(/[^A-Z0-9]/g, ''), ypSize = new Map(); info.sitePics = 0;
  const ypFigs = code => { let m = null; try { m = JSON.parse(fs.readFileSync(path.join(yp, 'models', code + '.json'), 'utf8')); } catch { return null; } return m && Array.isArray(m.figs) ? m.figs : null; };
  const ypRef = (figs, f) => {
    const n = String(f.fig).trim(), c = figs.filter(x => x.ill && (String(x.no) === n || (/^\d+$/.test(n) && /^\d+$/.test(String(x.no)) && +x.no === +n)));
    const x = c.find(x => nm(x.name) === nm(f.name)) || (c.length === 1 ? c[0] : null); if (!x) return null;
    const file = String(x.ill).replace(/[^A-Za-z0-9._-]/g, '_') + '.PNG'; if (!Array.isArray(ypC[file]) || !(ypC[file][2] || []).length) return null;
    if (!ypSize.has(file)) { let z = 0; try { z = fs.statSync(path.join(yp, 'img', file)).size; } catch { z = 0; } ypSize.set(file, z); }
    return ypSize.get(file) ? `pf:${ypRel}${file}:0:${ypSize.get(file)}` : null;
  };
  for (const e of eds) {
    const pg = g.p[String(e.vi)], have = new Set(), yf = yp && Object.keys(ypC).length ? ypFigs(e.code) : null;
    e.bs.forEach((b, bi) => {
      const figs = new Map();   // this book's fig label -> its name, so a fig split over two pages stays one fig
      for (const f of b.figs || []) {
        const list = (f.rows || []).filter(r => r[1] && (r[3] && Object.prototype.hasOwnProperty.call(r[3], e.code) ? !noQty(r[3][e.code]) : (b.codes || []).length === 1))
          .filter(r => bi === 0 || !have.has(ymKey(r[1])));
        if (!list.length) continue;
        const name = up(f.name), f0 = String(f.fig);
        let fig = bi ? f0 + ' (' + b.date + ')' : f0;
        if (figs.has(fig) && figs.get(fig) !== name) { let n = 2; while (figs.has(fig + ' (' + n + ')') && figs.get(fig + ' (' + n + ')') !== name) n++; fig = fig + ' (' + n + ')'; }
        let ref = null;
        if (!figs.has(fig)) {
          figs.set(fig, name);
          const sp = yf && !bi && ypRef(yf, f);
          if (sp) { ref = sp; pg[fig] = fi(ref); info.diagrams++; info.sitePics++; if (bi) info.older++; }
          else if (f.page && f.crop) { ref = `pdf:${b.rel || rel}/${b.file}:0:${b.size}:${f.page}:${f.crop}`; pg[fig] = fi(ref); info.diagrams++; if (bi) info.older++; }
        } else if (pg[fig] != null) ref = g.f[pg[fig]];
        for (const r of list) {
          const pn = up(r[1]).replace(/–/g, '-'), k = ymKey(pn); if (bi === 0) have.add(k);
          const rem = [], rm = colRem(r[4]); if (rm) rem.push(rm);
          if (toNew.has(k)) rem.push('New no. ' + show(toNew.get(k)));
          for (const o of toOld.get(k) || []) rem.push('Old no. ' + show(o));
          const ks = kit.get(k); if (ks) { rem.push('In kit: ' + ks.slice(0, 3).join(', ') + (ks.length > 3 ? ' and ' + (ks.length - 3) + ' more' : '')); }
          if (bi) rem.push('From the ' + b.date + ' book');
          const q = r[3] && r[3][e.code] != null ? String(r[3][e.code]).trim() : '';
          const row = [0, ref ? -1 : -2, fig, ai(name), String(r[0] ?? '').trim(), pn, di(String(r[2] || '').trim()), q, rem.join('; '), 0, 0];
          const key = row.join('\u0001'), o = rows.get(key);
          if (o) o[11].add(e.vi); else { row.push(new Set([e.vi])); rows.set(key, row); }
          if (d.mrp[pn] == null && MRP[k] > 0) { d.mrp[pn] = Math.round(+MRP[k]); info.mrp++; }
        }
      }
    });
  }
  // 16h: parts only in the sync's MRP list (new parts, accessories, no book yet): findable under one 'price list' edition, with MRP and old/new numbers
  // 19u (Sam 2026-11-11, B44H350003 'toh phir eh show q nhi ho raha'): a part only in the MRP list that is the new number of a part some book has is
  // listed in that part's places (same model, diagram and ref no.) and not under 'no model'
  const byK = new Map(); for (const r of rows.values()) { const k = ymKey(r[5]), a = byK.get(k); if (a) a.push(r); else byK.set(k, [r]); }
  const oldPlaces = k => { const seen = new Set([k]), q = [k], out = []; while (q.length && seen.size < 12) { const x = q.shift(); for (const o of toOld.get(x) || []) { if (seen.has(o)) continue; seen.add(o); if (byK.has(o)) out.push([o, byK.get(o)]); else q.push(o); } } return out; };
  info.newPlaced = 0;
  if (S) { const inRows = new Set([...rows.values()].map(r => ymKey(r[5]))); let vi = -1; info.sync = { ...info.sync, mrp: Object.keys(S.mrp || {}).length, other: 0, at: S.last_run || '' };
    for (const [pn0, v] of Object.entries(S.mrp || {})) { const k = ymKey(pn0); if (!k || inRows.has(k) || !(+(v && v.mrp) > 0)) continue; inRows.add(k);
      if (vi < 0) { if (!d.models.includes(OTHER)) d.models.push(OTHER); vi = d.vars.length; const n = OTHER + ' · Yamaha MRP list (weekly sync)'; d.vars.push(n); d.vmod[n] = OTHER; g.p[String(vi)] = {}; }
      const pn = show(k), rem = [];
      if (toNew.has(k)) rem.push('New no. ' + show(toNew.get(k)));
      for (const o of toOld.get(k) || []) rem.push('Old no. ' + show(o));
      const ks = kit.get(k); if (ks) rem.push('In kit: ' + ks.slice(0, 3).join(', ') + (ks.length > 3 ? ' and ' + (ks.length - 3) + ' more' : ''));
      rem.push('Yamaha MRP list (weekly sync)');
      const pls = oldPlaces(k);
      if (!pls.length) rows.set('sync\u0001' + k, [0, -2, 'MRP list', ai('YAMAHA MRP LIST (NO MODEL)'), '', pn, di(String(v.name || '').trim()), '', rem.join('; '), 0, 0, new Set([vi])]);
      if (d.mrp[pn] == null) d.mrp[pn] = Math.round(+v.mrp); info.sync.other++;
      const dsc = di(String(v.name || '').trim()), rm = rem.slice(0, -1);
      for (const [o, rs] of pls) for (const r of rs) { const key = 'new\u0001' + k + '\u0001' + r[1] + '\u0001' + r[2] + '\u0001' + r[3] + '\u0001' + r[4], h = rows.get(key);
        if (h) { for (const x of r[11]) h[11].add(x); continue; }
        rows.set(key, [0, r[1], r[2], r[3], r[4], pn, dsc, r[7], [...rm.filter(t => t !== 'Old no. ' + show(o)), 'New number of ' + show(o), 'Yamaha MRP list (weekly sync)'].join('; '), 0, 0, new Set(r[11])]); info.newPlaced++; } } }
  for (const r of rows.values()) { r[11] = [...r[11]].sort((a, b) => a - b); if (/(Old|New) no\./.test(r[8])) info.oldNew++; if (/In kit:/.test(r[8])) info.kits++; d.d.push(r); }
  info.rows = rows.size;
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/yamahabuild.mjs <public dir> <yamaha dir> <out dir>), so a build never holds up the server
export function writeYamaha(pub, dir, out, sync) {
  const t = Date.now(), r = buildYamaha(dir, 'catalogues/yamaha', sync ? { sync } : {});
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  put('yamaha-dg.json', JSON.stringify(r.dg)); put('yamaha.json', JSON.stringify(r.cat));
  const ms = r.cat.models.filter(m => m !== OTHER), pns = new Set(r.cat.d.map(x => x[5]));
  put('yamaha-app.json', JSON.stringify({ brand: 'Yamaha', pnr: r.pnr, models: ms, cnt: { m: ms.length, pn: pns.size } }));
  writeApp(pub, out);
  put('yamaha-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...r.info, missing: r.info.missing.length, missingFiles: r.info.missing.slice(0, 50) }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeYamaha(process.argv[2], process.argv[3], process.argv[4], process.argv[5]); console.log('yamaha build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.missing.length, 'books not uploaded yet'); }
  catch (e) { console.error('yamaha build failed:', e.message); process.exit(1); }
}
