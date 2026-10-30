// 16r (Sam 2026-10-30 "KTM ka koi part search kiya toh ... Bajaj ka eh part number match hota he"): cat/xref.json made on the server
// from the brands it built (DATA_DIR/cat/<slug>.json), as tools/build_public.py made it for the old shipped files: a part number that
// another brand's book has too. Also matched through a line's New / Old / Alternate no. and the Bajaj DMS alternates
// (catalogues/bajaj/bajaj_alt.json), and then the other brand's own number is named (n), e.g. KTM 90130006000 -> Bajaj DJ101234.
// Out: { b: brands, m: [[models of brand i]], x: { pk: { brandIdx: [modelIdx] } }, n: { pk: { brandIdx: 'its number' } } }
import fs from 'node:fs';
import path from 'node:path';

const pk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const SKIP = /-dg\.json$|-app\.json$|-build\.json$|^(xref|am|am-files|more-files)\.json$/;

export function buildXref(catDir, altFile) {
  // brand -> pk -> Set(models); and every pk's equal numbers (same part, other number)
  const by = new Map(), eq = new Map(), link = (a, b) => { if (!a || !b || a === b || a.length < 5 || b.length < 5) return;
    for (const [x, y] of [[a, b], [b, a]]) { if (!eq.has(x)) eq.set(x, new Set()); eq.get(x).add(y); } };
  for (const f of fs.readdirSync(catDir).filter(f => f.endsWith('.json') && !SKIP.test(f)).sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(catDir, f), 'utf8')); } catch { continue; }
    if (!d || !Array.isArray(d.d) || !d.vars || d.split) continue;
    const vb = d.brand || f.slice(0, -5);
    for (const r of d.d) {
      const k = pk(r[5]); if (k.length < 5) continue;
      const ms = by.get(k) || new Map(); by.set(k, ms); const s = ms.get(vb) || new Set(); ms.set(vb, s);
      for (const i of r[11] || []) { const v = d.vars[i]; const m = (d.vmod && d.vmod[v]) || v; if (m) s.add(m); }
      for (const m of String(r[8] || '').matchAll(/(?:New|Old|Alternate) no\. ([A-Z0-9][A-Z0-9-]{4,})/g)) link(k, pk(m[1]));
    }
  }
  try { for (const [a, b] of JSON.parse(fs.readFileSync(altFile, 'utf8')).pairs || []) link(pk(a), pk(b)); } catch {}
  const brands = [...new Set([...by.values()].flatMap(m => [...m.keys()]))].sort(), bi = new Map(brands.map((b, i) => [b, i]));
  const models = brands.map(() => []), mi = brands.map(() => new Map()), x = {}, n = {};
  const mIdx = (b, m) => { const t = mi[bi.get(b)]; if (!t.has(m)) { t.set(m, models[bi.get(b)].length); models[bi.get(b)].push(m); } return t.get(m); };
  for (const [k, own] of by) {
    const o = {}, nm = {};
    for (const [b, ms] of own) o[bi.get(b)] = [...ms].sort().map(m => mIdx(b, m));
    for (const e of eq.get(k) || []) for (const [b, ms] of by.get(e) || []) {   // the same part under another number: only brands this number is not in
      const i = bi.get(b); if (own.has(b) || nm[i]) continue; o[i] = [...ms].sort().map(m => mIdx(b, m)); nm[i] = e;
    }
    if (Object.keys(o).length < 2) continue;
    x[k] = o; if (Object.keys(nm).length) n[k] = nm;
  }
  return { b: brands, m: models, x, n };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const [catDir, altFile] = process.argv.slice(2), t = Date.now(), r = buildXref(catDir, altFile), f = path.join(catDir, 'xref.json');
    fs.writeFileSync(f + '.tmp', JSON.stringify(r)); fs.renameSync(f + '.tmp', f);
    console.log('xref:', Object.keys(r.x).length, 'shared part numbers,', Object.keys(r.n).length, 'through another number, between', r.b.join(', '), Date.now() - t, 'ms'); }
  catch (e) { console.error('xref build failed:', e.message); process.exit(1); }
}
