// update 10r (Sam 2026-10-22: on Shivanna's phone Add product went "back" while a part number was typed): the phone loaded every
// catalogue a half-typed number could be in (Hero alone ~225 MB, a few parts later ~750 MB), and a phone browser that runs out of memory
// reloads the page. Now the server looks the number up in the brand files and sends only that part's lines; the phone loads nothing.
// Each brand file (public/cat/<slug>.json, the same format the app reads) is indexed once by part key and again when the file changes.
import fs from 'node:fs';
import path from 'node:path';

const pk = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const SKIP = /-dg\.json$|^(am|am-files|more-files|xref)\.json$/;

// the app's catPh: a part's own photo in the brand's files
function photo(d, pn) {
  const x = d.ph && d.ph[pn];
  if (x == null) { const f = !d.ph && d.phf && d.phf[pn]; return f ? { z: 'pf:' + d.phz[f[0]] + ':' + f[1] + ':' + f[2], w: f[3], h: f[4] } : null; }
  if (typeof x !== 'number') return { u: 'bin:' + d.phb[x[0]] + ':' + x[1] + ':' + x[2], w: x[3], h: x[4] };
  const f = d.phf && d.phf[pn]; return f ? { pg: x, z: 'pf:' + d.phz[f[0]] + ':' + f[1] + ':' + f[2], w: f[3], h: f[4] } : { pg: x };
}

// the app's catMrpOf: MRP by the exact number, else by the number without dashes and spaces
function mrpOf(d, pn) {
  if (!d.mrp || !pn) return 0; const v = d.mrp[pn]; if (v) return v;
  if (!d._mk) { d._mk = new Map(); for (const k in d.mrp) if (d.mrp[k] && !d._mk.has(pk(k))) d._mk.set(pk(k), d.mrp[k]); }
  return d._mk.get(pk(pn)) || 0;
}

function index(d) {
  const vb = d.brand, by = new Map();
  for (const r of d.d || []) {
    const k = pk(r[5]); if (!k) continue;
    let e = by.get(k); if (!e) by.set(k, e = { rows: [], vv: new Set(), norms: new Set(), none: 0 });
    e.rows.push(r); (r[11] || []).forEach(i => e.vv.add(i));
    const b = d.bk && d.bk[r[0]]; if (b && b[1]) b[1].forEach(n => e.norms.add(n)); else e.none = 1;
  }
  // per part: the line the app would show (one with a photo first), its qty per bike, MRP, every book variant that lists it
  const parts = new Map();
  for (const [k, e] of by) {
    let rep = null, ph = null;
    for (const r of e.rows) { const p = photo(d, r[5]); if (p) { rep = r; ph = p; break; } }
    if (!rep) rep = e.rows[0];
    const qs = e.rows.map(r => parseInt(r[7]) || 0).filter(Boolean);
    const mrp = e.rows.reduce((m, r) => Math.max(m, +mrpOf(d, r[5]) || 0), 0);
    parts.set(k, { part: rep[5], desc: d.desc[rep[6]], asm: d.asm[rep[3]] || '', qty: qs.length ? Math.max(...qs) : 0, mrp, ph, vv: [...e.vv], norms: [...e.norms], none: e.none });
  }
  const nv = {}; (d.vars || []).forEach(v => { const m = d.vmod[v] || v; nv[m] = (nv[m] || 0) + 1; });
  return { vb, parts, vars: d.vars || [], vmod: d.vmod || {}, nv };
}

// the app's ocrNear, for a number no catalogue has (a misread bill line): the closest numbers in the catalogues, each counted once
const OCR_EQ = ['O0', 'D0', 'Q0', 'I1', 'L1', 'T1', 'B8', 'S5', 'Z2', 'Z7', 'G6', 'A4', 'E8'];
const ocrCost = (a, b) => a === b ? 0 : OCR_EQ.includes(a + b) || OCR_EQ.includes(b + a) ? 0.3 : 1;
function ocrDist(a, b, max) {
  const n = a.length, m = b.length; if (Math.abs(n - m) > 1) return 99; let p = [], c = [];
  for (let j = 0; j <= m; j++) p[j] = j;
  for (let i = 1; i <= n; i++) { c = [i]; let lo = i; for (let j = 1; j <= m; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + ocrCost(a[i - 1], b[j - 1])); if (c[j] < lo) lo = c[j]; } if (lo > max) return 99; p = c; }
  return p[m];
}
function near(B, k) {
  const out = new Map();
  for (const [, c] of B) {
    if (!c.ix) continue;
    for (const [key, p] of c.ix.parts) {
      if (Math.abs(key.length - k.length) > 1) continue;
      const n = Math.min(key.length, k.length); let same = 0; for (let i = 0; i < n; i++) if (key[i] === k[i]) same++;
      if (same < n - 3 && key.slice(0, 3) !== k.slice(0, 3) && key.slice(-3) !== k.slice(-3)) continue;
      const d = ocrDist(k, key, 1.2); if (d > 1.2) continue;
      const o = out.get(key); if (!o || d < o.d) out.set(key, { k: key, pn: p.part || key, d });
    }
  }
  return [...out.values()].sort((a, b) => a.d - b.d).slice(0, 6);
}

export function pnLookup(publicDir, more = [], opt = {}) {   // more: folders whose brand files replace the public ones of the same name (Hero made on the server)
  // opt.load(file): an already parsed copy of a file (11v: the split Hero file is held once, by catsplit), or null to read it here
  const dirs = [path.join(publicDir, 'cat'), ...more], cache = new Map();   // file -> { mt, size, ix } or { mt, size, err }
  // one file at a time, with a pause between files, so the website keeps answering while the index is made (a big file ~0.5 s)
  let busy = null;
  const brands = () => busy || (busy = (async () => {
    const at = new Map(); for (const dir of dirs) { try { for (const f of await fs.promises.readdir(dir)) if (f.endsWith('.json') && !SKIP.test(f)) at.set(f, path.join(dir, f)); } catch {} }
    const fl = [...at.keys()].sort();
    const out = [];
    for (const f of fl) {
      let st; try { st = await fs.promises.stat(at.get(f)); } catch { continue; }
      let c = cache.get(f);
      if (!c || c.mt !== st.mtimeMs || c.size !== st.size || c.at !== at.get(f)) {
        c = { mt: st.mtimeMs, size: st.size, at: at.get(f) };
        try { let d = opt.load ? await opt.load(at.get(f)) : null; if (!d) { const txt = await fs.promises.readFile(at.get(f), 'utf8'); await new Promise(r => setImmediate(r)); d = JSON.parse(txt); } if (!d || !d.brand || !Array.isArray(d.d)) continue; await new Promise(r => setImmediate(r)); c.ix = index(d); }
        catch (e) { c.err = String(e.message || e); }
        cache.set(f, c); await new Promise(r => setImmediate(r));
      }
      out.push([f, c]);
    }
    return out;
  })().finally(() => { busy = null; }));
  const one = (ix, k) => {
    const p = ix.parts.get(k); if (!p) return null;
    const vv = p.vv.map(i => ix.vars[i]), vmod = {}, nv = {};
    vv.forEach(v => { const m = ix.vmod[v] || v; vmod[v] = m; nv[m] = ix.nv[m] || 0; });
    return { vb: ix.vb, pk: k, part: p.part, desc: p.desc, asm: p.asm, qty: p.qty, mrp: p.mrp, ph: p.ph, vv, vmod, nv, norms: p.norms, none: p.none };
  };
  // a number: the brands that list it; Hero's lists add an 'S' (service part) to the catalogue number, so with no line the S / no-S twin is tried
  return async function look(q) {
    const k = pk(q); const B = await brands();
    const res = { pk: k, in: B.filter(([, c]) => c.ix).map(([, c]) => c.ix.vb), fail: B.filter(([, c]) => c.err).map(([f]) => f), hits: [] };
    if (k.length < 4) return res;
    const find = key => B.map(([, c]) => c.ix && one(c.ix, key)).filter(Boolean);
    res.hits = find(k);
    if (!res.hits.length && /^[0-9A-Z]{6,}$/.test(k)) { const k2 = /S$/.test(k) ? k.slice(0, -1) : k + 'S'; const h2 = find(k2); if (h2.length) { res.hits = h2; res.twin = k2; } }
    if (!res.hits.length && k.length >= 6) res.near = near(B, k);
    return res;
  };
}
