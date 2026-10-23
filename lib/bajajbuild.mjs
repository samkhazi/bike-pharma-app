// Bajaj catalogue made on the server from Sam's folder Downloads > Bajaj Catalogue (uploaded by Admin into FILES_DIR/catalogues/bajaj, 12b):
// Raw Data/bajaj_build.json (all 290 books of PDF > Models: the Bajaj EPC viewer's plates for 247 of them, the model PDFs' own tables for
// the others, old -> new numbers from Excel/Bajaj_Band_Parts.xlsx; made on Sam's Mac) and the model PDFs: every diagram is the picture on
// its PDF page (pdf: refs, Sam's new colour PDFs); a picture only the Viewer_img zips have would be read out of them (pf: refs).
// Sam 2026-10-23: no prices at all (no 99rpm, no MRP csv) and no KTM / Husqvarna from the Bajaj EPC.
// Out: DATA_DIR/cat/bajaj.json + bajaj-dg.json (the app's brand file format) and the Bajaj lines of the app (part number table, models).
import fs from 'node:fs';
import path from 'node:path';
import { pnrOf, writeApp, zipIndex } from './herobuild.mjs';

export const BAJAJ_ZIPS = Array.from({ length: 16 }, (_, i) => 'Viewer_img_' + String(i + 1).padStart(2, '0') + '.zip');   // only when a plate has no picture in its PDF (none now)
export const BAJAJ_RAW = ['bajaj_build.json'];
const SRC = "Bajaj EPC catalogue viewer (plates, diagrams) and Bajaj model PDFs, old and new numbers from Bajaj's Excel, Sam's folder Downloads > Bajaj Catalogue";
export const OTHER = 'Other Bajaj (no model name)';
// the app's Bajaj names, on sale now first (CUR of them)
const ORDER = ['Pulsar 150', 'Pulsar 125', 'Pulsar 150 Twin Disc', 'Pulsar N160', 'Pulsar N150', 'Pulsar N125', 'Pulsar NS125', 'Pulsar NS160', 'Pulsar NS200',
  'Pulsar RS200', 'Pulsar N250', 'Pulsar F250', 'Pulsar NS400Z', 'Pulsar 220F', 'Pulsar P150', 'Platina 100', 'Platina 110', 'CT 110X', 'CT 125X',
  'Freedom 125 CNG', 'Avenger 160 Street', 'Avenger 220 Cruise', 'Dominar 400', 'Dominar 250',
  'Avenger 220 Street', 'Pulsar 180', 'CT 100', 'CT 110', 'Avenger 150 Street', 'Avenger 180 Street', 'Pulsar 135 LS', 'Pulsar AS150', 'Pulsar NS150',
  'Pulsar AS200', 'Pulsar 200', 'V15', 'V12', 'Discover 125', 'Discover 110', 'Discover 100', 'Discover 150', 'Discover 125M', 'Discover 100M',
  'Discover 125 ST', 'Discover 125T', 'Discover 100T', 'Discover D102C', 'Discover D105B', OTHER];
const CUR = 24;
const CC = { 'Pulsar 150': 149, 'Pulsar 125': 125, 'Pulsar 150 Twin Disc': 149, 'Pulsar N160': 165, 'Pulsar N150': 149, 'Pulsar N125': 125, 'Pulsar NS125': 125,
  'Pulsar NS160': 160, 'Pulsar NS200': 199, 'Pulsar RS200': 199, 'Pulsar N250': 249, 'Pulsar F250': 249, 'Pulsar NS400Z': 373, 'Pulsar 220F': 220,
  'Pulsar P150': 149, 'Platina 100': 102, 'Platina 110': 115, 'CT 110X': 115, 'CT 125X': 125, 'Freedom 125 CNG': 125, 'Avenger 160 Street': 160,
  'Avenger 220 Cruise': 220, 'Avenger 220 Street': 220, 'Dominar 400': 373, 'Dominar 250': 248, 'Pulsar 180': 178, 'CT 100': 102, 'CT 110': 115,
  'Avenger 150 Street': 150, 'Avenger 180 Street': 180, 'Pulsar 135 LS': 135, 'Pulsar AS150': 149, 'Pulsar NS150': 149, 'Pulsar AS200': 199,
  'Pulsar 200': 199, 'V15': 150, 'V12': 125, 'Discover 125': 125, 'Discover 110': 115, 'Discover 100': 102, 'Discover 150': 144, 'Discover 125M': 125,
  'Discover 100M': 102, 'Discover 125 ST': 125, 'Discover 125T': 125, 'Discover 100T': 102 };
const MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const up = s => String(s ?? '').trim().toUpperCase();
const tc = s => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

// the app's model for a PDF folder + edition title (the title decides: Pulsar 125's folder also has NS 125 books)
export function bajajModel(folder, title) {
  const t = up(title).replace(/\s+/g, ' '), f = up(folder);
  if (/^SKU /.test(t) || /UNNAMED/.test(f)) return OTHER;
  if (/AVENGER/.test(t)) { const n = (t.match(/AVENGER (\d{3})/) || [])[1];
    if (n === '220') return /CRUISE/.test(t) ? 'Avenger 220 Cruise' : /STREET/.test(t) ? 'Avenger 220 Street' : 'Avenger 220 Cruise';
    return n ? 'Avenger ' + n + ' Street' : tc(folder); }
  if (/^CT ?1/.test(t)) { const m = t.match(/^CT ?(\d{3}) ?(X)?/); return m[1] === '125' ? 'CT 125X' : 'CT ' + m[1] + (m[2] ? 'X' : ''); }
  if (/^DISCO|^D10\dC?/.test(t) || /DISCOVER/.test(f)) {
    if (/D102C/.test(t)) return 'Discover D102C'; if (/D105B/.test(t)) return 'Discover D105B';
    if (/^DISCO-M|^DISCOVER M /.test(t)) return 'Discover 100M'; if (/DISCOVER-H/.test(t)) return 'Discover 150';
    const n = (t.match(/DISCOVER[- ]?(\d{3})/) || [])[1] || (f.match(/(\d{3})/) || [])[1];
    if (n === '100' || n === '125') { if (/ ST\b/.test(t)) return 'Discover ' + n + ' ST'; if (/ M[- ]/.test(t)) return 'Discover ' + n + 'M'; if (/ T[- ]/.test(t)) return 'Discover ' + n + 'T'; }
    return 'Discover ' + n; }
  if (/DOMINAR/.test(t)) return /250/.test(t) ? 'Dominar 250' : 'Dominar 400';
  if (/FREEDOM/.test(t)) return 'Freedom 125 CNG';
  if (/PLATINA/.test(t)) return /110/.test(t) ? 'Platina 110' : 'Platina 100';
  if (/^V ?1[25]/.test(t)) return /^V ?12/.test(t) ? 'V12' : 'V15';
  if (/PULS/.test(t)) {
    let m;
    if ((m = t.match(/\bNS ?(\d{3})|(\d{3}) NS\b/))) { const n = m[1] || m[2]; return n === '400' ? 'Pulsar NS400Z' : 'Pulsar NS' + n; }
    if ((m = t.match(/\bAS ?(\d{3})/))) return 'Pulsar AS' + m[1];
    if (/\bRS ?200|200 SS/.test(t)) return 'Pulsar RS200';
    if ((m = t.match(/\bN ?(\d{3})/))) return 'Pulsar N' + m[1];
    if (/F ?250/.test(t)) return 'Pulsar F250';
    if (/P ?150/.test(t)) return 'Pulsar P150';
    if (/135/.test(t)) return 'Pulsar 135 LS';
    if (/220/.test(t)) return 'Pulsar 220F';
    if (/200/.test(t)) return 'Pulsar 200';
    if (/180/.test(t)) return 'Pulsar 180';
    if (/150/.test(t)) return /TWIN DIS[CK]|\bTD\b/.test(t) ? 'Pulsar 150 Twin Disc' : 'Pulsar 150';
    if (/125/.test(t)) return 'Pulsar 125';
  }
  return tc(folder);
}

/* dir: the uploaded folder (all files flat in it); rel: that folder as pf: refs name it. Returns { cat, dg, pnr, info } */
export function buildBajaj(dir, rel = 'catalogues/bajaj', opt = {}) {
  const zix = opt.zipIndex || zipIndex;
  const B = JSON.parse(fs.readFileSync(path.join(dir, 'bajaj_build.json'), 'utf8'));
  const info = { models: 0, editions: 0, rows: 0, diagrams: 0, noDiagram: 0, pdfDiagrams: 0, oldNew: 0 };
  // the viewer's pictures: <hash>.jpg -> pf: ref in its zip
  const pic = new Map(), files = [];
  for (const f of BAJAJ_ZIPS) {
    const p = path.join(dir, f); if (!fs.existsSync(p)) continue;
    files.push([f, fs.statSync(p).size]);
    for (const [n, [o, l]] of zix(p)) { const h = path.basename(n).replace(/\.jpe?g$/i, ''); if (!pic.has(h)) pic.set(h, `pf:${rel}/${f}:${o}:${l}`); }
  }
  // old -> new numbers: a part's line says its new no., a new part's line its old ones
  const toNew = new Map(), toOld = new Map();
  for (const [o, n] of B.oldnew || []) { if (!o || !n || o === n) continue; toNew.set(o, n); const a = toOld.get(n) || []; if (!a.includes(o)) a.push(o); toOld.set(n, a); }
  const d = { brand: 'Bajaj', src: [SRC], bk: [[0, [], '']], models: [], cur: CUR, cc: {}, sheets: [], figs: [],
    vars: [], vmod: {}, asm: [], desc: [], d: [], fw: 'Fig', mrp: {} };
  const g = { f: [], p: {}, dir: rel, files, spare: [], pick: 'Downloads > Bajaj Catalogue' };
  const asmI = new Map(), descI = new Map(), fIdx = new Map();
  const ai = a => { if (!asmI.has(a)) { asmI.set(a, d.asm.length); d.asm.push(a); } return asmI.get(a); };
  const di = a => { if (!descI.has(a)) { descI.set(a, d.desc.length); d.desc.push(a); } return descI.get(a); };
  const fi = f => { if (!fIdx.has(f)) { fIdx.set(f, g.f.length); g.f.push(f); } return fIdx.get(f); };
  const at = m => { const i = ORDER.indexOf(m); return i < 0 ? 1e3 : i; };
  const when = e => e.year * 12 + Math.max(0, MON.indexOf(e.mon));
  const eds = (B.eds || []).map(e => ({ ...e, m: bajajModel(e.folder, e.title) }))
    .sort((a, b) => (at(a.m) - at(b.m)) || a.m.localeCompare(b.m) || (when(b) - when(a)) || String(b.sku).localeCompare(String(a.sku)));
  for (const e of eds) {
    if (!d.models.includes(e.m)) { d.models.push(e.m); if (CC[e.m]) d.cc[e.m] = CC[e.m]; }
    e.vi = d.vars.length; const v = `${e.m} · ${String(e.title).trim()} (${e.mon}, ${e.year}) · ${e.sku}`; d.vars.push(v); d.vmod[v] = e.m; g.p[String(e.vi)] = {};
  }
  d.cur = d.models.filter(m => at(m) < CUR).length;
  info.models = d.models.filter(m => m !== OTHER).length; info.editions = eds.length;
  const rows = new Map();
  for (const e of eds) {
    const pg = g.p[String(e.vi)], seen = new Map();
    (e.plates || []).forEach(([label, diag, list], k) => {
      const m = /^\s*(\d+[A-Z]?)\s*-\s*(.*)$/i.exec(String(label || '')), f0 = m ? m[1] : String(k + 1), asm = (m ? m[2] : String(label || '')).trim().toUpperCase();
      const nth = (seen.get(f0) || 0) + 1; seen.set(f0, nth); const fig = nth > 1 ? f0 + ' (' + nth + ')' : f0;
      let ref = null;
      if (typeof diag === 'string') ref = pic.get(diag) || null;
      else if (Array.isArray(diag) && diag[0] === 'pdf' && diag[2]) { ref = `pdf:${rel}/${e.file}:0:${e.size}:${diag[1]}:${diag[2]}`; info.pdfDiagrams++; }
      if (ref) { pg[fig] = fi(ref); info.diagrams++; } else info.noDiagram++;
      for (const [rf, pn0, ds, q] of list || []) {
        const pn = up(pn0); if (!pn) continue;
        const rem = []; if (toNew.has(pn)) rem.push('New no. ' + toNew.get(pn)); for (const o of toOld.get(pn) || []) rem.push('Old no. ' + o);
        const row = [0, ref ? -1 : -2, fig, ai(asm), String(rf ?? '').trim(), pn, di(String(ds || '').trim()), String(q ?? ''), rem.join('; '), 0, 0];
        const key = row.join('\u0001'), o = rows.get(key);
        if (o) o[11].add(e.vi); else { row.push(new Set([e.vi])); rows.set(key, row); }
      }
    });
  }
  for (const r of rows.values()) { r[11] = [...r[11]].sort((a, b) => a - b); if (r[8]) info.oldNew++; d.d.push(r); }
  info.rows = rows.size;
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/bajajbuild.mjs <public dir> <bajaj dir> <out dir>), so a build never holds up the server
export function writeBajaj(pub, dir, out) {
  const t = Date.now(), r = buildBajaj(dir);
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  put('bajaj-dg.json', JSON.stringify(r.dg)); put('bajaj.json', JSON.stringify(r.cat));
  const ms = r.cat.models.filter(m => m !== OTHER), pns = new Set(r.cat.d.map(x => x[5]));
  put('bajaj-app.json', JSON.stringify({ brand: 'Bajaj', pnr: r.pnr, models: ms, cnt: { m: ms.length, pn: pns.size } }));
  writeApp(pub, out);
  put('bajaj-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...r.info }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeBajaj(process.argv[2], process.argv[3], process.argv[4]); console.log('bajaj build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.noDiagram, 'without'); }
  catch (e) { console.error('bajaj build failed:', e.message); process.exit(1); }
}
