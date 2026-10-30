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
const descOf = (d, r) => typeof r[6] === 'number' ? (d.desc || [])[r[6]] : r[6];
const words = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(w => w && !/^(BS\d|BS|CC|\d+CC|OLD|NEW|MODEL|HERO|HONDA|TVS|BAJAJ|YAMAHA|SUZUKI|KTM|ROYAL|ENFIELD|RE)$/.test(w));

export function buildXref(catDir, altFile, amFile) {
  // brand -> pk -> Map(brand -> Set(models)); every pk's equal numbers (same part, other number) with why
  const by = new Map(), eq = new Map(), why = new Map(), info = new Map(), link = (a, b, w) => { if (!a || !b || a === b || a.length < 5 || b.length < 5) return;
    for (const [x, y] of [[a, b], [b, a]]) { if (!eq.has(x)) eq.set(x, new Set()); eq.get(x).add(y); if (!why.has(x + '|' + y)) why.set(x + '|' + y, w); } };
  const brandModels = new Map();
  for (const f of fs.readdirSync(catDir).filter(f => f.endsWith('.json') && !SKIP.test(f)).sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(catDir, f), 'utf8')); } catch { continue; }
    if (!d || !Array.isArray(d.d) || !d.vars || d.split) continue;
    const vb = d.brand || f.slice(0, -5); if (!brandModels.has(vb)) brandModels.set(vb, new Set());
    for (const r of d.d) {
      const k = pk(r[5]); if (k.length < 5) continue;
      const ms = by.get(k) || new Map(); by.set(k, ms); const s = ms.get(vb) || new Set(); ms.set(vb, s);
      for (const i of r[11] || []) { const v = d.vars[i]; const m = (d.vmod && d.vmod[v]) || v; if (m) { s.add(m); brandModels.get(vb).add(m); } }
      if (!info.has(k)) info.set(k, [String(r[5]).trim(), descOf(d, r) || '']);
      for (const m of String(r[8] || '').matchAll(/(New|Old|Alternate) no\. ([A-Z0-9][A-Z0-9-]{4,})/g)) link(k, pk(m[2]), m[1] + ' no. in the catalogue');
    }
  }
  try { for (const [a, b, kd, src] of JSON.parse(fs.readFileSync(altFile, 'utf8')).pairs || []) link(pk(a), pk(b), /circular/i.test(src || '') ? 'Bajaj circular (rationalised)' : 'Bajaj DMS alternate'); } catch {}
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
  return { b: brands, m: models, x, n, r, g, gk };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const [catDir, altFile, amFile] = process.argv.slice(2), t = Date.now(), r = buildXref(catDir, altFile, amFile), f = path.join(catDir, 'xref.json');
    fs.writeFileSync(f + '.tmp', JSON.stringify(r)); fs.renameSync(f + '.tmp', f);
    console.log('xref:', Object.keys(r.x).length, 'shared part numbers,', Object.keys(r.n).length, 'through another number,', r.g.length, 'same-size groups, between', r.b.join(', '), Date.now() - t, 'ms'); }
  catch (e) { console.error('xref build failed:', e.message); process.exit(1); }
}
