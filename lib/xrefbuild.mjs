// 16r (Sam 2026-10-30 "KTM ka koi part search kiya toh ... Bajaj ka eh part number match hota he"): cat/xref.json made on the server
// from the brands it built (DATA_DIR/cat/<slug>.json), as tools/build_public.py made it for the old shipped files: a part number that
// another brand's book has too. Also matched through a line's New / Old / Alternate no. and the Bajaj DMS alternates
// (catalogues/bajaj/bajaj_alt.json), and then the other brand's own number is named (n), e.g. KTM 90130006000 -> Bajaj DJ101234.
// Out: { b: brands, m: [[models of brand i]], x: { pk: { brandIdx: [modelIdx] } }, n: { pk: { brandIdx: 'its number' } },
//        r: { pk: { brandIdx: why the other number is the same part } },
//        g: [[label, check, { brandIdx: [[pn, [modelIdx]]] }]], gk: { pk: [groupIdx] } }
// 16s (Sam 2026-10-30 "kounsa part kounse brand me ke kounse part number se exact match hoga"): g = groups of parts in
// several brands that are the same size or design but not the same number: a standard bearing / oil seal / O-ring / spark plug /
// bulb / fuse / battery / chain / tyre read from the part name, a Honda-design part (same Honda part family and model code, other
// supplier or revision, Hero and Honda), and one aftermarket part that the aftermarket catalogue says fits both brands' bikes.
// check = 1: the same size, check before fitting (seal type, clearance, length); 0: the same by number.
import { fitCollector } from './fitbuild.mjs';
import fs from 'node:fs';
import path from 'node:path';

const pk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const SKIP = /-dg\.json$|-app\.json$|-build\.json$|^(xref|am|am-files|more-files)\.json$/;

// 16s: the standard size a part's own name gives: [kind, size, check]. Only kinds whose size is the whole part (a 6202 bearing is a
// 6202 bearing in every brand), never a bolt (thread pitch, head, length differ) or a gasket (shape)
const D = '(\\d{1,3}(?:[.,]\\d{1,2})?)', X = '\\s*[X×*]\\s*', nd = v => v.replace(',', '.').replace(/\.0+$/, '');
export function specOf(desc) {
  const u = ' ' + String(desc || '').toUpperCase().replace(/–/g, '-') + ' '; let m;
  if (/\bBEARING|\bBRG\b/.test(u) && (m = /(?<![\d.])(6[0-3]\d{2}|16\d{3}|60\/\d{2}|62\/\d{2}|63\/\d{2})(?![\d.])/.exec(u))) {
    const seal = /2RS|DDU|LLU|RS1|\bRS\b/.test(u) ? ' 2RS' : /\bZZ\b|2Z\b/.test(u) ? ' ZZ' : ''; const c3 = /\bC3\b|-C3\b/.test(u) ? ' C3' : '';
    return ['Ball bearing', m[1] + seal + c3, 1]; }
  if (/OIL SEAL|SEAL[ ,]+OIL|DUST SEAL|SEAL,? DUST/.test(u) && (m = new RegExp(D + X + D + X + D).exec(u))) return [/DUST/.test(u) ? 'Dust seal' : 'Oil seal', m.slice(1).map(nd).join(' x '), 1];
  if (/O[- ]?RING|RING,? O\b|RING - O\b/.test(u) && (m = new RegExp(D + X + D + '(?!\\s*[X×*]\\s*\\d)').exec(u))) return ['O-ring', m.slice(1).map(nd).join(' x '), 1];
  if (/SPARK PLUG|PLUG,? SPARK|PLUG - SPARK/.test(u) && (m = /\b((?:C?P?R|D?P?R|B?P?R)\d{1,2}[A-Z]{1,4}(?:-\d{1,2})?|U\d{2}[A-Z]{2,4}\d?|ZFR\d[A-Z]?(?:-\d+)?|IU\d{2}|MR\d[A-Z]+|UR\d[A-Z]+|CR\d[A-Z]+(?:-\d+)?)\b/.exec(u))) return ['Spark plug', m[1], 0];
  if (/\bBULB\b|\bBLB\b/.test(u) && (m = /(\d{1,2})\s*V[\s,-]*(\d{1,2}(?:\.\d)?(?:\s*\/\s*\d{1,2}(?:\.\d)?)?)\s*W/.exec(u))) {
    const base = (/\b(T10|T13|T15|BA9S|BA15S|BAY15D|BA20D|P15D|H4|HS1|HS5|H6|H7|S25|G18)\b/.exec(u) || [])[1];
    return ['Bulb', m[1] + 'V ' + m[2].replace(/\s/g, '') + 'W' + (base ? ' ' + base : ''), 1]; }
  if (/\bCHAIN\b/.test(u) && !/CAM|TIMING|TENSION|GUIDE|CASE|COVER|ADJUST|SLIPPER|SPROCKET|KIT/.test(u) && (m = /\b(415|420|428|520|525|530)\s*H?\s*[-X×*(]?\s*(\d{2,3})\s*L?\b/.exec(u)) && +m[2] >= 80 && +m[2] <= 140) return ['Drive chain', m[1] + ' x ' + m[2] + ' links', 1];
  if (/\bFUSE\b/.test(u) && !/BOX|HOLDER|CASE|COVER/.test(u) && (m = /(\d{1,2})\s*A(?:MP)?\b/.exec(u))) return ['Fuse', m[1] + 'A', 0];
  if (/\bBATTERY\b/.test(u) && !/COVER|BAND|BOX|CASE|HOLDER|CABLE|STAY|BRACKET|TRAY|SET PLATE/.test(u) && (m = /\b((?:[EYG])?T[XZ]?\d{1,2}[A-Z]{0,2}(?:-[A-Z]{1,2})?|12N\d{1,2}[A-Z]?-\d[A-Z]{0,2})\b/.exec(u))) return ['Battery', m[1], 1];
  if (/\bTYRE\b|\bTIRE\b/.test(u) && !/TUBE|VALVE|FLAP/.test(u) && (m = /\b(\d{2,3}\/\d{2,3}\s*-?\s*R?\s*\d{2}|\d\.\d{2}\s*[-X]\s*\d{2})\b/.exec(u))) return ['Tyre', m[1].replace(/\s+/g, ''), 1];
  return null;
}
// a Honda-design number (Honda and Hero, the Hero Honda years): 5-digit part family + 3-letter model code, e.g. 12209-GB4-680
const hondaKey = pn => { const m = /^(\d{5})-?([A-Z0-9]{3})-?([A-Z0-9]{3,5})$/.exec(String(pn || '').trim().toUpperCase()); return m && /[A-Z]/.test(m[2]) ? m[1] + '-' + m[2] : null; };
// 21h: two part names say the same thing (half of the shorter name's words are in the other)
const NM_STOP = /^(COMP|ASSY|SET|KIT|SUB|TYPE|THE|AND|FOR|WITH|RH|LH|R|L|FR|RR|A|B|NO|\d+)$/;
const nmWords = s => new Set(String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').split(' ').filter(w => w.length > 1 && !NM_STOP.test(w)));
export const namesAlike = (a, b) => { const A = nmWords(a), B = nmWords(b); if (!A.size || !B.size) return false; let n = 0; for (const w of A) if (B.has(w)) n++; return n * 2 >= Math.min(A.size, B.size); };
// a painted part: the number ends with its colour (77240-KWF-900ZD) or the name carries a colour code (*NH1*)
const painted = (pn, nm) => /^\d{5}-?[A-Z0-9]{3}-?[A-Z0-9]{3}Z[A-Z]?$/.test(String(pn || '').trim().toUpperCase()) || /\*[A-Z0-9-]+\*/.test(String(nm || ''));
const descOf = (d, r) => typeof r[6] === 'number' ? (d.desc || [])[r[6]] : r[6];
const words = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(w => w && !/^(BS\d|BS|CC|\d+CC|OLD|NEW|MODEL|HERO|HONDA|TVS|BAJAJ|YAMAHA|SUZUKI|KTM|ROYAL|ENFIELD|RE)$/.test(w));

export function buildXref(catDir, altFile, amFile) {
  // brand -> pk -> Map(brand -> Set(models)); every pk's equal numbers (same part, other number) with why
  const by = new Map(), eq = new Map(), why = new Map(), info = new Map(), link = (a, b, w) => { if (!a || !b || a === b || a.length < 5 || b.length < 5) return;
    for (const [x, y] of [[a, b], [b, a]]) { if (!eq.has(x)) eq.set(x, new Set()); eq.get(x).add(y); if (!why.has(x + '|' + y)) why.set(x + '|' + y, w); } };
  const brandModels = new Map(), pnBy = new Map(), nameBy = new Map();
  const FIT = fitCollector();
  for (const f of fs.readdirSync(catDir).filter(f => f.endsWith('.json') && !SKIP.test(f)).sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(catDir, f), 'utf8')); } catch { continue; }
    if (!d || !Array.isArray(d.d) || !d.vars || d.split) continue;
    const vb = d.brand || f.slice(0, -5); if (!brandModels.has(vb)) brandModels.set(vb, new Set());
    try { FIT.add(d, vb); } catch (e) { console.error('tyre/battery read failed for ' + vb + ':', e.message); }   // 21t
    for (const r of d.d) {
      const k = pk(r[5]); if (k.length < 5) continue;
      const ms = by.get(k) || new Map(); by.set(k, ms); const s = ms.get(vb) || new Set(); ms.set(vb, s);
      for (const i of r[11] || []) { const v = d.vars[i]; const m = (d.vmod && d.vmod[v]) || v; if (m) { s.add(m); brandModels.get(vb).add(m); } }
      if (!info.has(k)) info.set(k, [String(r[5]).trim(), descOf(d, r) || '']);
      if (!pnBy.has(k + '|' + vb)) { pnBy.set(k + '|' + vb, String(r[5]).trim()); nameBy.set(k + '|' + vb, descOf(d, r) || ''); }
      for (const m of String(r[8] || '').matchAll(/(New|Old|Alternate) no\. ([A-Z0-9][A-Z0-9-]{4,})/g)) link(k, pk(m[2]), m[1] + ' no. in the catalogue');
    }
  }
  try { for (const [a, b, kd, src] of JSON.parse(fs.readFileSync(altFile, 'utf8')).pairs || []) link(pk(a), pk(b), /circular/i.test(src || '') ? 'Bajaj circular (rationalised)' : 'Bajaj DMS alternate'); } catch {}
  // 16u: old Hero genuine numbers are the Honda number + 'S' (22201GF6000S = Honda 22201-GF6-000)
  for (const [k, ms] of by) if (ms.has('Hero') && /^\d{5}[A-Z0-9]{5,8}S$/.test(k) && by.has(k.slice(0, -1))) link(k, k.slice(0, -1), 'Hero no. with S = Honda no.');
  // 21h (Sam 2026-11-12 "last ka ek number ka alphabet change rehta he", haan): Hero and Honda numbers that differ only at the end.
  // One more letter/number on the Hero number (45131-GZ0-006L = Honda 45131-GZ0-006) with the same name = the same part.
  // Same length, only the last letter/number differs, same name, not painted = a size group to check before fitting (endG).
  const endG = [], onlyIn = (k, b, not) => by.get(k).has(b) && !by.get(k).has(not), nmOf = k => (info.get(k) || [])[1] || '', pnOf = k => (info.get(k) || [k])[0];
  const hondaStem = new Map();
  for (const k of by.keys()) if (onlyIn(k, 'Honda', 'Hero')) { const s = k.slice(0, -1); if (!hondaStem.has(s)) hondaStem.set(s, []); hondaStem.get(s).push(k); }
  for (const k of by.keys()) {
    if (!onlyIn(k, 'Hero', 'Honda') || k.length < 9) continue;
    const cut = k.slice(0, -1);
    if (!k.endsWith('S') && by.has(cut) && onlyIn(cut, 'Honda', 'Hero') && namesAlike(nmOf(k), nmOf(cut)) && !painted(pnOf(k), nmOf(k)) && !painted(pnOf(cut), nmOf(cut))) { link(k, cut, 'Hero no. with one more letter = Honda no.'); continue; }
    if (hondaKey(pnOf(k)) || painted(pnOf(k), nmOf(k))) continue;   // a Honda-design number is in its 'Honda design' group already
    for (const k2 of hondaStem.get(cut) || []) if (k2.length === k.length && k2 !== k && namesAlike(nmOf(k), nmOf(k2)) && !painted(pnOf(k2), nmOf(k2))) endG.push([cut, k, k2]);
  }
  const brands = [...new Set([...by.values()].flatMap(m => [...m.keys()]))].sort(), bi = new Map(brands.map((b, i) => [b, i]));
  const models = brands.map(() => []), mi = brands.map(() => new Map()), x = {}, n = {}, r = {};
  const mIdx = (b, m) => { const t = mi[bi.get(b)]; if (!t.has(m)) { t.set(m, models[bi.get(b)].length); models[bi.get(b)].push(m); } return t.get(m); };
  for (const [k, own] of by) {
    const o = {}, nm = {}, rw = {};
    for (const [b, ms] of own) o[bi.get(b)] = [...ms].sort().map(m => mIdx(b, m));
    for (const e of eq.get(k) || []) for (const [b, ms] of by.get(e) || []) {   // the same part under another number: only brands this number is not in
      const i = bi.get(b); if (own.has(b) || nm[i]) continue; o[i] = [...ms].sort().map(m => mIdx(b, m)); nm[i] = e; rw[i] = why.get(k + '|' + e) || '';
    }
    if (Object.keys(o).length < 2) continue;
    x[k] = o; if (Object.keys(nm).length) { n[k] = nm; r[k] = rw; }
  }
  // 16s: groups of the same size / design across brands
  const G = new Map(), put = (key, label, check, k) => { const own = by.get(k); if (!own) return;
    const g = G.get(key) || { label, check, b: new Map() }; G.set(key, g);
    for (const [b, ms] of own) { const a = g.b.get(b) || new Map(); g.b.set(b, a); if (!a.has(k)) a.set(k, ms); } };
  for (const [k, [pn, desc]] of info) {
    const sp = specOf(desc); if (sp) put('s|' + sp[0] + '|' + sp[1], sp[0] + ' ' + sp[1], sp[2], k);
    const hk = by.get(k).has('Hero') || by.get(k).has('Honda') ? hondaKey(pn) : null; if (hk) put('h|' + hk, 'Honda design ' + hk + ' (other supplier or revision)', 1, k);
  }
  for (const [stem, a, b] of endG) { put('e|' + stem, 'Hero / Honda number, only the last letter or number differs', 1, a); put('e|' + stem, '', 1, b); }
  // an aftermarket part the aftermarket catalogue says fits bikes of two brands: those bikes' parts of that kind
  try { const A = JSON.parse(fs.readFileSync(amFile, 'utf8')), TY = new Map((A.ty || []).map(([nm, re]) => [nm, new RegExp(re)]));
    const byModel = new Map();   // brand|model -> [pk]
    for (const [k, own] of by) for (const [b, ms] of own) for (const m of ms) { const key = b + '|' + m; if (!byModel.has(key)) byModel.set(key, []); byModel.get(key).push(k); }
    for (const p of A.p || []) {
      const ty = p[8], re = TY.get(ty); if (!ty || !re) continue;
      const segs = String(p[5] || '').split(';').map(s => /^\s*([A-Za-z ]+):\s*(.*)$/.exec(s)).filter(Boolean)
        .map(m => [brands.find(b => b.toUpperCase() === m[1].trim().toUpperCase()), m[2]]).filter(s => s[0]);
      if (new Set(segs.map(s => s[0])).size < 2) continue;
      const hits = [];
      for (const [b, txt] of segs) for (const name of txt.split(/[\/,]/)) { const w = words(name.replace(/-.*$/, '')); if (!w.length) continue;
        for (const m of brandModels.get(b) || []) { const mw = new Set(words(m)); if (w.every(t => mw.has(t))) for (const k of byModel.get(b + '|' + m) || []) if (re.test(String((info.get(k) || [])[1]).toUpperCase())) hits.push(k); } }
      const hb = new Set(hits.flatMap(k => [...by.get(k).keys()])); if (hb.size < 2) continue;
      const lab = ty + ': ' + A.b[p[0]] + ' ' + p[1] + ' fits both';
      for (const k of hits) put('a|' + A.b[p[0]] + '|' + p[1], lab, 1, k);
    } } catch {}
  const g = [], gk = {};
  for (const v of G.values()) {
    if (v.b.size < 2) continue;
    const all = [...v.b.values()].flatMap(a => [...a.keys()]); if (all.every(k => [...v.b.values()].every(a => a.has(k)))) continue;   // only the same number in every brand: x has it already
    const o = {}; for (const [b, a] of v.b) o[bi.get(b)] = [...a].slice(0, 8).map(([k, ms]) => [(info.get(k) || [k])[0], [...ms].sort().slice(0, 12).map(m => mIdx(b, m))]);
    const gi = g.length; g.push([v.label, v.check, o]);
    for (const k of new Set([...v.b.values()].flatMap(a => [...a.keys()]))) (gk[k] || (gk[k] = [])).push(gi);
  }
  // 21n: the Admin report's lists (Same parts): [tab, why, brand A, number, name, brand B, number, name]; c = found from the catalogues
  // (the part is the same), k = same design or size (check before fitting). One line a pair of numbers and brands.
  const pairs = [], seenP = new Set(), nmOf2 = (k, b) => (nameBy.get(k + '|' + b) || (info.get(k) || [])[1] || ''), pnOf2 = (k, b) => (pnBy.get(k + '|' + b) || (info.get(k) || [k])[0]);
  const addP = (tab, whyT, ba, ka, bb, kb) => { if (ba === bb) return; const [A, B] = ba < bb ? [[ba, ka], [bb, kb]] : [[bb, kb], [ba, ka]], id = tab + '|' + A[0] + '|' + A[1] + '|' + B[0] + '|' + B[1];
    if (seenP.has(id) || seenP.has('c' + id.slice(1))) return; seenP.add(id); pairs.push([tab, whyT, A[0], pnOf2(A[1], A[0]), nmOf2(A[1], A[0]), B[0], pnOf2(B[1], B[0]), nmOf2(B[1], B[0])]); };
  for (const [k, own] of by) {
    const bs = [...own.keys()].sort();
    for (let i = 0; i < bs.length && i < 4; i++) for (let j = i + 1; j < bs.length && j < 4; j++) addP('c', 'Same number', bs[i], k, bs[j], k);
    for (const e of eq.get(k) || []) for (const b2 of (by.get(e) || new Map()).keys()) for (const b1 of bs) if (!own.has(b2) && !(by.get(e) || new Map()).has(b1)) addP('c', why.get(k + '|' + e) || 'Other number', b1, k, b2, e);
  }
  for (const v of G.values()) {
    if (v.b.size < 2) continue; let nG = 0; const bl = [...v.b.keys()].sort();
    for (let i = 0; i < bl.length; i++) for (let j = i + 1; j < bl.length; j++) for (const ka of [...v.b.get(bl[i]).keys()].slice(0, 4)) for (const kb of [...v.b.get(bl[j]).keys()].slice(0, 4)) { if (ka === kb || nG >= 12) continue; nG++; addP('k', v.label, bl[i], ka, bl[j], kb); }
  }
  let fit = null; try { fit = FIT.done(); } catch (e) { console.error('tyre/battery list failed:', e.message); }
  return { b: brands, m: models, x, n, r, g, gk, pairs, fit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const [catDir, altFile, amFile] = process.argv.slice(2), t = Date.now(), r = buildXref(catDir, altFile, amFile), f = path.join(catDir, 'xref.json'), pf = path.join(catDir, '..', 'xref-pairs.json'), pairs = r.pairs, fit = r.fit, ff = path.join(catDir, '..', 'fit.json'); delete r.pairs; delete r.fit;
    fs.writeFileSync(f + '.tmp', JSON.stringify(r)); fs.renameSync(f + '.tmp', f);
    try { fs.writeFileSync(pf + '.tmp', JSON.stringify({ at: new Date().toISOString(), pairs })); fs.renameSync(pf + '.tmp', pf); } catch (e) { console.error('xref pairs not written:', e.message); }
    try { if (fit) { fs.writeFileSync(ff + '.tmp', JSON.stringify(fit)); fs.renameSync(ff + '.tmp', ff); } } catch (e) { console.error('tyre/battery list not written:', e.message); }
    console.log('xref:', Object.keys(r.x).length, 'shared part numbers,', Object.keys(r.n).length, 'through another number,', r.g.length, 'same-size groups, between', r.b.join(', '), Date.now() - t, 'ms'); }
  catch (e) { console.error('xref build failed:', e.message); process.exit(1); }
}
