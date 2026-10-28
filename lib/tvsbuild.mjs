// TVS catalogue made on the server from Sam's folder Downloads > TVS Catalogues (uploaded by Admin into FILES_DIR/catalogues/tvs, 12y,
// Sam 2026-10-26 "usme ka poora data mujhe mere server me chahiye", "koi bhi data miss nhi hona he"):
// Raw Data/tvs_build.json (made on Sam's Mac from his TVS dealer e-catalogue export: every model's parts by variant (qty per variant),
// TVS's where-used list (colours, painted parts, older variants), the MRP lists; dealer prices are left out) and Raw Data/tvs_diagrams.zip
// (the e-catalogue's diagram pictures, decoded unchanged, read by byte range: pf: refs). Sam's PDFs are made from this same data.
// Out: DATA_DIR/cat/tvs.json + tvs-dg.json (the app's brand file format) and the TVS lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pnrOf, writeApp, zipIndex, jpegSize } from './herobuild.mjs';

export const TVS_RAW = ['tvs_build.json'];
export const TVS_ZIP = 'tvs_diagrams.zip';
export const OTHER = 'Other parts (price list)';
// 13b (Sam 2026-10-26: "TVS Catalogue2 me se saare files ... server pe add karna he, pehle jo kiya hun usko repeat nhi karna"): what the first
// upload did not have. tvs_extra.json is made on Sam's Mac (~/hx/tv2/extra.py) from the CSVs of All Catalogues > TVS Catalogue2: new/old numbers
// (superseded, TVS P902 alternates), blocked parts, 1,682 more parts, colour-wise painted parts with their colour pictures, kits with what is
// inside; the zips (part photos, painted colour pictures, kit photos) are read unchanged by byte range.
export const TVS_EXTRA = 'tvs_extra.json';
export const TVS_PHOTOS = [1, 2, 3, 4, 5].map(i => 'TVS_Part_Photos_0' + i + '.zip');
export const TVS_PAINT = ['MOPED', 'MOTORCYCLE', 'SCOOTER', 'SCOOTY'].map(s => 'TVS_Painted_Parts_' + s + '.zip');
export const TVS_KITZ = 'TVS_Kit_Parts.zip';
export const TVS_MORE = [TVS_EXTRA, ...TVS_PHOTOS, ...TVS_PAINT, TVS_KITZ];
export const KITS = 'Kits (TVS)';
// width and height of a photo, read from the zip without unpacking it (TVS's ".png" photos are often JPEGs inside)
function picSize(file, o, l) { if (l < 24) return [0, 0]; const fd = fs.openSync(file, 'r'); try { const b = Buffer.alloc(24); fs.readSync(fd, b, 0, 24, o);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)]; return b[0] === 0xff && b[1] === 0xd8 ? jpegSize(fd, o, l) : [0, 0]; } finally { fs.closeSync(fd); } }
// the app's TVS names, on sale now first (CUR of them)
const ORDER = ['Apache RTR 160 2V', 'Apache RTR 160 4V', 'Apache RTR 180 2V', 'Apache RTR 200 4V', 'Apache RTR 310', 'Apache RR 310', 'Apache RTX',
  'Ronin 225', 'Raider 125', 'Radeon', 'Sport', 'Star City Plus', 'Star City', 'XL100', 'XL Super', 'Jupiter 110', 'Jupiter 110 (2024)', 'Jupiter 125',
  'NTorq 125', 'NTorq 150', 'Wego 110', 'Scooty Pep Plus', 'Scooty Zest', 'iQube', 'Orbiter', 'Phoenix 125', 'Victor',
  'Apache 150', 'Scooty Pep', 'Scooty Streak', 'Flame', 'Jive', KITS, OTHER];
const CUR = 25;
const CC = { 'Apache RTR 160 2V': 160, 'Apache RTR 160 4V': 160, 'Apache RTR 180 2V': 177, 'Apache RTR 200 4V': 198, 'Apache RTR 310': 312,
  'Apache RR 310': 312, 'Apache RTX': 299, 'Ronin 225': 225, 'Raider 125': 125, 'Radeon': 110, 'Sport': 110, 'Star City Plus': 110, 'Star City': 110,
  'XL100': 99, 'XL Super': 70, 'Jupiter 110': 110, 'Jupiter 110 (2024)': 113, 'Jupiter 125': 125, 'NTorq 125': 125, 'NTorq 150': 150, 'Wego 110': 110,
  'Scooty Pep Plus': 88, 'Scooty Zest': 110, 'Phoenix 125': 125, 'Victor': 110, 'Apache 150': 150, 'Scooty Pep': 75, 'Scooty Streak': 88, 'Flame': 125, 'Jive': 110 };
const up = s => String(s ?? '').trim().toUpperCase();

// the TVS sync's saved state (brand_sync/brands/tvs.py), or null when the sync has not run on this server
export function syncState(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'tvs', 'state.json'), 'utf8')); } catch { return null; } }

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
  let X = null; try { X = JSON.parse(fs.readFileSync(path.join(dir, TVS_EXTRA), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') console.log('tvs: ' + TVS_EXTRA + ' not read:', e.message); }
  info.extra = !!X;
  const zipOf = f => { const zp2 = path.join(dir, f); if (!fs.existsSync(zp2)) return null; try { const ix = zix(zp2); if (!files.some(x => x[0] === f)) files.push([f, fs.statSync(zp2).size]); return ix; } catch (e) { console.log('tvs: ' + f + ' not read:', e.message); return null; } };
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
  // painted parts per colour and the kits become editions of their own (diagram = the colour picture / the kit photo)
  const norm = m => String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const known = new Map([...ORDER, ...(B.eds || []).map(e => e.m)].map(m => [norm(m), m]));
  // the painted list names models its own way ("2", "PEP +", "APACHE"): its sub-model id is the start of the e-catalogue's diagram ids
  const subM = new Map(); for (const e of B.eds || []) if (e.kind === 'cat') for (const f of e.figs || []) if (f[2] && /^\d{18}/.test(f[2]) && !subM.has(f[2].slice(0, 18))) subM.set(f[2].slice(0, 18), e.m);
  const AKA = { PEP: 'Scooty Pep', 'PEP+': 'Scooty Pep Plus', STREAK: 'Scooty Streak', ZEST: 'Scooty Zest', XL: 'XL100', XLSUPERHD: 'XL Super', JUPITER: 'Jupiter 110',
    JUPITER125: 'Jupiter 125', NTORQ: 'NTorq 125', NTORQ150: 'NTorq 150', WEGO: 'Wego 110', PHOENIX: 'Phoenix 125', RAIDER125: 'Raider 125', VICTOR2016: 'Victor', STARCITY: 'Star City', IQUBE: 'iQube' };
  const nice = (m, sub) => subM.get(sub) || known.get(norm(m)) || AKA[norm(m)] || String(m).trim().toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  const xeds = [];
  const seenV = new Map();   // the same colour on two variants of one model: "RED · painted parts (2)"
  for (const [seg, m, sub, col, cid, zf, file, list] of (X && X.painted) || []) {
    const mm = nice(m, sub), k = mm + '|' + col, n = (seenV.get(k) || 0) + 1; seenV.set(k, n);
    xeds.push({ m: mm, v: col + ' · painted parts' + (n > 1 ? ' (' + n + ')' : ''), kind: 'paint', zf, file, list, sub, cid });
  }
  for (const [seg, m, kpn, kds, appl, photo, list] of (X && X.kits) || []) {
    const v = (m || seg) + ' kits'; let e = xeds.find(x => x.kind === 'kit' && x.v === v); if (!e) xeds.push(e = { m: KITS, v, kind: 'kit', kits: [] });
    e.kits.push({ kpn, kds, appl, photo, list });
  }
  eds.push(...xeds.sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || String(a.v).localeCompare(String(b.v))));
  eds.sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || ((a.kind === 'cat' ? 0 : a.kind === 'apps' ? 1 : 2) - (b.kind === 'cat' ? 0 : b.kind === 'apps' ? 1 : 2)) || (a.k ?? 1e9) - (b.k ?? 1e9) || String(a.v).localeCompare(String(b.v)));
  const other = (B.other || []).length || ((X && X.parts) || []).length ? [{ m: OTHER, v: 'TVS price list (no model)', kind: 'other', figs: [] }] : [];
  for (const e of [...eds, ...other]) {
    if (!d.models.includes(e.m)) { d.models.push(e.m); if (CC[e.m]) d.cc[e.m] = CC[e.m]; }
    e.vi = d.vars.length; const v = e.m === KITS ? `${KITS} · ${e.v}` : `${e.m} · ${String(e.v).trim()}${e.kind === 'apps' ? ' (where-used list)' : ''}`; d.vars.push(v); d.vmod[v] = e.m; g.p[String(e.vi)] = {};
  }
  d.cur = d.models.filter(m => at(m) < CUR).length;
  info.models = d.models.filter(m => m !== OTHER && m !== KITS).length; info.editions = eds.length;
  const rows = new Map();
  // new / old / alternate numbers and blocked parts, on every line of that number (the app shows "New part no." / "Old part no." from them)
  const sup = new Map(Object.entries((X && X.sup) || {})), old = new Map(), alt = new Map(Object.entries((X && X.alt) || {})), blk = new Set((X && X.blocked) || []);
  for (const [o, n] of sup) { if (!old.has(n)) old.set(n, []); old.get(n).push(o); }
  const remOf = (pn, more) => { const r = []; if (sup.has(pn)) r.push('New no. ' + sup.get(pn)); for (const o of old.get(pn) || []) r.push('Old no. ' + o);
    for (const a of alt.get(pn) || []) if (a !== sup.get(pn)) r.push('Alternate no. ' + a); if (blk.has(pn)) r.push('Blocked by TVS'); if (more) r.push(more); return r.join('; '); };
  const add = (vi, fig, asm, ref, rf, pn, ds, q, rem0) => {
    const rem = remOf(pn, rem0);
    const row = [0, ref ? -1 : -2, fig, ai(asm), String(rf ?? '').trim(), pn, di(String(ds || '').trim()), String(q ?? ''), rem || '', 0, 0];
    const key = row.join('\u0001'), o = rows.get(key);
    if (o) o[11].add(vi); else { row.push(new Set([vi])); rows.set(key, row); }
  };
  const pz = new Map(TVS_PAINT.map(f => [f, zipOf(f)])), kz = zipOf(TVS_KITZ);
  const figAt = new Map(), have = new Map();   // diagram id -> [[edition, fig, assembly]]; edition|fig -> its part numbers (for the sync's additions)
  for (const e of eds) {
    const pg = g.p[String(e.vi)], used = new Set();
    if (e.kind === 'paint') {
      const fig = 'Painted parts · ' + e.v.replace(/ · painted parts( \(\d+\))?$/, ''), ix = pz.get(e.zf), hit = ix && ix.get(e.file), ref = hit ? `pf:${rel}/${e.zf}:${hit[0]}:${hit[1]}` : null;
      if (ref) { pg[fig] = fi(ref); info.diagrams++; } else info.noDiagram++;
      for (const [rf, pn0, ds, q] of e.list) { const pn = up(pn0); if (pn) add(e.vi, fig, 'PAINTED PARTS (' + up(e.v.replace(/ · painted parts( \(\d+\))?$/, '')) + ')', ref, rf, pn, ds, q, ''); }
      info.painted = (info.painted || 0) + e.list.length; continue;
    }
    if (e.kind === 'kit') {
      for (const k of e.kits) {
        let fig = k.kds + ' · ' + k.kpn, n = 2; while (used.has(fig)) fig = k.kds + ' · ' + k.kpn + ' (' + n++ + ')'; used.add(fig);
        const hit = kz && k.photo && kz.get(k.photo), ref = hit ? `pf:${rel}/${TVS_KITZ}:${hit[0]}:${hit[1]}` : null;
        if (ref) pg[fig] = fi(ref);
        add(e.vi, fig, 'KIT ' + up(k.kds), ref, 'Kit', k.kpn, k.kds, '1', 'Kit' + (k.appl ? ' · fits ' + k.appl : ''));
        k.list.forEach(([pn0, ds, q], i) => { const pn = up(pn0); if (pn) add(e.vi, fig, 'KIT ' + up(k.kds), ref, String(i + 1), pn, ds, q, 'In kit ' + k.kpn); });
        info.kits = (info.kits || 0) + 1;
      }
      continue;
    }
    const figs = e.kind === 'cat' ? [...(e.figs || [])].sort((a, b) => (parseInt(a[0], 10) || 0) - (parseInt(b[0], 10) || 0)) : e.figs || [];   // Fig 1, 2, 3...
    for (const [f0, asm, dg, list] of figs) {
      let fig = String(f0 || asm).trim(), n = 2; while (used.has(fig)) fig = String(f0 || asm).trim() + ' (' + n++ + ')'; used.add(fig);
      const ref = dg ? pic.get(dg) || null : null;
      if (ref) { pg[fig] = fi(ref); info.diagrams++; } else info.noDiagram++;
      const got = new Set(); have.set(e.vi + '|' + fig, got); if (dg && e.kind === 'cat') { if (!figAt.has(dg)) figAt.set(dg, []); figAt.get(dg).push([e.vi, fig, up(asm)]); }
      for (const [rf, pn0, ds, q, rem] of list || []) { const pn = up(pn0); if (pn) { add(e.vi, fig, up(asm), ref, rf, pn, ds, q, rem); got.add(pn); } }
    }
  }
  const kit = new Set((B.kits || []).map(k => up(k[0])));
  for (const e of other) for (const [pn0, ds] of B.other) { const pn = up(pn0); if (!pn) continue; add(e.vi, 'Price List', 'TVS PRICE LIST (NO MODEL)', null, '', pn, ds, '', kit.has(pn) ? 'Kit / consumable' : 'TVS price list'); info.other++; }
  for (const e of other) for (const [pn0, ds] of (X && X.parts) || []) { const pn = up(pn0); if (!pn) continue; add(e.vi, 'Price List', 'TVS PRICE LIST (NO MODEL)', null, '', pn, ds, '', 'TVS parts list'); info.other++; }
  // 15d: the weekly TVS sync on this server (brand_sync's data in FILES_DIR/catalogues/hero-sync/tvs): the dealer system's MRP list (MRP only,
  // its dealer price is never read), parts TVS added to a diagram, new diagrams and models, new kits, parts only in the MRP list
  const S = opt.sync ? syncState(opt.sync) : null;
  if (S) {
    const sy = info.sync = { mrp: 0, figs: 0, rows: 0, other: 0, kits: 0, at: S.last_run || '' };
    for (const [pn, v] of Object.entries(S.mrp || {})) if (+(v && v.mrp) > 0) { d.mrp[up(pn)] = Math.round(+v.mrp); sy.mrp++; }
    for (const [pn, k] of Object.entries(S.kits || {})) if (+k.mrp > 0 && !d.mrp[up(pn)]) d.mrp[up(pn)] = Math.round(+k.mrp);
    const newEd = (m, v) => { if (!d.models.includes(m)) { d.models.push(m); if (CC[m]) d.cc[m] = CC[m]; } const vi = d.vars.length, n = m === KITS ? `${KITS} · ${v}` : `${m} · ${v}`; d.vars.push(n); d.vmod[n] = m; g.p[String(vi)] = {}; info.editions++; return vi; };
    const syEd = new Map(), edOf = (m, v) => { const k = m + '|' + v; if (!syEd.has(k)) syEd.set(k, newEd(m, v)); return syEd.get(k); };
    const imgRef = url => { if (!url) return null; const ext = (path.extname(String(url).split('?')[0]).toLowerCase().slice(0, 5)) || '.png', f = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + ext;
      try { const n = fs.statSync(path.join(opt.sync, 'tvs', 'img', f)).size; return n ? `pf:${opt.syncRel}/tvs/img/${f}:0:${n}` : null; } catch { return null; } };
    for (const [sid, sr] of Object.entries(S.series || {})) for (const [aid, a] of Object.entries(sr.asms || {})) {
      let A; try { A = JSON.parse(fs.readFileSync(path.join(opt.sync, 'tvs', 'asm', sid + '_' + aid + '.json'), 'utf8')); } catch { continue; }
      const dg = String(a.fig || ''), ref = imgRef(a.img), at = figAt.get(dg);
      // 16d: the uploaded zip's picture is old when TVS changed the picture or added parts to this diagram -> the sync's picture
      if (at && ref) for (const [vi, fig] of at) { const pg = g.p[String(vi)], got = have.get(vi + '|' + fig);
        if (a.newpic || (got && got.size && (A.rows || []).some(r => up(r.pn) && !got.has(up(r.pn))))) { if (pg[fig] !== fi(ref)) { pg[fig] = fi(ref); sy.newpics = (sy.newpics || 0) + 1; } } }
      const put = (vi, fig, asm) => { const pg = g.p[String(vi)]; if (pg[fig] == null && ref) { pg[fig] = fi(ref); info.diagrams++; }
        let got = have.get(vi + '|' + fig); if (!got) have.set(vi + '|' + fig, got = new Set());
        for (const r of A.rows || []) { const pn = up(r.pn); if (!pn || got.has(pn)) continue; got.add(pn); add(vi, fig, asm, pg[fig] != null, r.sn, pn, r.desc, r.qty, r.remarks || ''); sy.rows++; } };
      if (at) { for (const [vi, fig, asm] of at) put(vi, fig, asm); continue; }
      const vi = edOf(nice(sr.name, dg.slice(0, 18)), 'New in e-catalogue (weekly sync)'), pg = g.p[String(vi)];
      let fig = String(a.name || aid).trim(), n = 2; while (pg[fig] != null || have.has(vi + '|' + fig)) fig = String(a.name || aid).trim() + ' (' + n++ + ')';
      if (!ref) info.noDiagram++; sy.figs++; put(vi, fig, up(a.name)); figAt.set(dg, [[vi, fig, up(a.name)]]);
    }
    const inRows = new Set([...rows.values()].map(r => r[5]));
    for (const [kpn0, k] of Object.entries(S.kits || {})) { const kpn = up(kpn0); if (inRows.has(kpn)) continue;
      const vi = edOf(KITS, 'Kits (weekly sync)'), fig = (k.desc || 'Kit') + ' · ' + kpn, asm = 'KIT ' + up(k.desc);
      add(vi, fig, asm, null, 'Kit', kpn, k.desc, '1', 'Kit' + (k.appl || k.model ? ' · fits ' + (k.appl || k.model) : ''));
      (k.parts || []).forEach(([pn0, ds, q], i) => { const pn = up(pn0); if (pn) add(vi, fig, asm, null, String(i + 1), pn, ds, q, 'In kit ' + kpn); });
      inRows.add(kpn); sy.kits++; }
    for (const r of rows.values()) inRows.add(r[5]);
    for (const [pn0, v] of Object.entries(S.mrp || {})) { const pn = up(pn0); if (!pn || inRows.has(pn)) continue; inRows.add(pn);
      add(other.length ? other[0].vi : edOf(OTHER, 'TVS price list (no model)'), 'Price List', 'TVS PRICE LIST (NO MODEL)', null, '', pn, v.desc, '', 'TVS price list (weekly sync)'); sy.other++; }
  }
  for (const [pn, m] of [...Object.entries(B.mrp || {}), ...Object.entries((X && X.mrp) || {})]) if (+m > 0 && !d.mrp[up(pn)]) { d.mrp[up(pn)] = Math.round(+m); info.mrp++; }
  // each part's own photo (TVS_Part_Photos_0n.zip: <part no.>.png; the kit zip's photos/<part no.>.png too)
  d.phf = {}; d.phz = []; info.photos = 0;
  const rowPn = new Set([...rows.values()].map(r => r[5]));
  for (const f of [...TVS_PHOTOS, TVS_KITZ]) {
    const ix = f === TVS_KITZ ? kz : zipOf(f); if (!ix) continue;
    const zi = d.phz.length; let used = 0;
    for (const [n, [o, l]] of ix) {
      if (!/\.png$/i.test(n) || (f === TVS_KITZ && !n.startsWith('photos/'))) continue;
      const pn = up(path.posix.basename(n).replace(/\.png$/i, '')); if (!rowPn.has(pn) || d.phf[pn]) continue;
      const [w, h] = picSize(path.join(dir, f), o, l) || []; if (!w) continue;
      d.phf[pn] = [zi, o, l, w, h]; used++;
    }
    if (used) { d.phz.push(`${rel}/${f}`); info.photos += used; }
  }
  for (const r of rows.values()) { r[11] = [...r[11]].sort((a, b) => a - b); d.d.push(r); }
  info.rows = rows.size;
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/tvsbuild.mjs <public dir> <tvs dir> <out dir>), so a build never holds up the server
export function writeTvs(pub, dir, out, sync) {
  const t = Date.now(), r = buildTvs(dir, 'catalogues/tvs', sync ? { sync, syncRel: 'catalogues/' + path.basename(sync) } : {});
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
  try { const i = writeTvs(process.argv[2], process.argv[3], process.argv[4], process.argv[5]); console.log('tvs build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.noDiagram, 'without'); }
  catch (e) { console.error('tvs build failed:', e.message); process.exit(1); }
}
