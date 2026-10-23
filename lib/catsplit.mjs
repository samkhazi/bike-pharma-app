// Update 11v (Sam 2026-10-23 "haan": Hero fast): a phone no longer downloads the whole Hero list (17 MB). cat/hero.json now sends only
// its head (bikes, books, section and part names, no part lines, numbers, MRPs or photos), and the part lines come from here as they
// are needed: the bike opened, a section, the lines a search can match. So nobody can copy the whole catalogue in one go: one answer
// is at most ROW_CAP lines, and a login that pulls more than CAT_ROWS_DAY_PCT % of a brand's lines in a day is stopped (catguard).
// Row numbers (g) are the line's place in the full file, so a phone keeps each line once however it came.
import fs from 'node:fs';

export const ROW_CAP = 40000;
const pk = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const qbOf = q => { q = String(q || '').trim().toUpperCase(); const k = pk(q);   // the app's catQb
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{3}$/.test(q) ? k.slice(0, 10) : /^[A-Z0-9]{5}-[A-Z0-9]{3}-[A-Z0-9]{5}$/.test(q) ? k.slice(0, 11) : /^[A-Z0-9]{5}-[A-Z0-9]{4}-[A-Z0-9]{1,4}$/.test(q) ? k.slice(0, 9) : ''; };
const mrpOf = (d, pn) => { if (!d.mrp || !pn) return 0; const v = d.mrp[pn]; if (v) return v;   // the app's catMrpOf
  if (!d._mk) { d._mk = new Map(); for (const k in d.mrp) if (d.mrp[k] && !d._mk.has(pk(k))) d._mk.set(pk(k), d.mrp[k]); } return d._mk.get(pk(pn)) || 0; };
const SC_CONF = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' }, scKey = s => pk(s).replace(/[OQDILZSBG]/g, c => SC_CONF[c]);   // the app's scKey (photo scan)
const PART_KEYS = ['mrp', 'phf', 'ph'];   // keyed by part number: sent with the lines, never in the head

// file(slug) -> the brand file to split, or null (the brand is sent whole)
export function catSplit({ file, pct = 60, log = console.log }) {
  const C = new Map();   // file -> { f, mt, size, d, ix, head }
  const seen = new Map();   // uid|slug -> { day, bits, n } lines sent today (each counted once)
  function loadFile(f) {
    let st; try { st = fs.statSync(f); } catch { return null; }
    let c = C.get(f);
    if (c && c.mt === st.mtimeMs && c.size === st.size) return c;
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d || !Array.isArray(d.d)) return null;
    c = { f, mt: st.mtimeMs, size: st.size, d, ix: null, head: null };
    C.set(f, c); return c;
  }
  const load = slug => { const f = file(slug); return f ? loadFile(f) : null; };
  function index(c) {
    if (c.ix) return c.ix;
    const d = c.d, by = { m: new Map(), pg: new Map(), di: new Map(), ai: new Map() }, stat = {}, dn = new Array((d.desc || []).length).fill(0);
    const add = (m, k, g) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(g); };
    d.d.forEach((r, g) => {
      const ms = new Set((r[11] || []).map(k => d.vmod[d.vars[k]]).filter(Boolean)), page = r[0] + '.' + r[2], k = pk(r[5]);
      ms.forEach(m => { add(by.m, m, g); const s = stat[m] || (stat[m] = { n: 0, pn: new Set(), pg: new Set() }); s.n++; if (k) s.pn.add(k); s.pg.add(page); });
      add(by.pg, page, g); add(by.di, r[6], g); add(by.ai, r[3], g); dn[r[6]]++;
    });
    const mst = {}; for (const m in stat) mst[m] = [stat[m].n, stat[m].pn.size, stat[m].pg.size];
    const pks = d.d.map(r => pk(r[5])), rks = d.d.map(r => pk(r[8]));
    return c.ix = { by, mst, dn, pks, rks };
  }
  // the head the phone gets in place of the whole file
  function head(slug) {
    const c = load(slug); if (!c) return null;
    if (!c.head) { const x = index(c), h = { ...c.d, d: [], split: 1, n: c.d.d.length, mst: x.mst, dn: x.dn }; PART_KEYS.forEach(k => { if (k in h) h[k] = {}; }); delete h._mk; c.head = Buffer.from(JSON.stringify(h)); }
    return { buf: c.head, etag: `W/"s${c.size.toString(16)}-${Math.floor(c.mt).toString(16)}"` };
  }
  // q: { m:[model], pg:['<book>.<plate>' or the app's page 'H<book>.<plate>'], pn:'<number>', sk:[scan keys], di:[desc no.], ai:[section no.] }
  function rows(slug, q, user) {
    const c = load(slug); if (!c) return { error: 'No such catalogue', code: 404 };
    const x = index(c), d = c.d, out = new Set(), arr = v => Array.isArray(v) ? v.slice(0, 50000) : [];
    const put = a => { if (a) for (const g of a) { if (out.size >= ROW_CAP) return; out.add(g); } };
    arr(q.m).forEach(m => put(x.by.m.get(String(m))));
    arr(q.pg).forEach(p => { p = String(p); put(x.by.pg.get(/^[A-Za-z]/.test(p) ? p.slice(1) : p)); });
    const pq = pk(q.pn);
    if (pq.length >= 3) {
      const qb = qbOf(q.pn);
      for (let g = 0; g < x.pks.length && out.size < ROW_CAP; g++) {
        const k = x.pks[g];
        if (k && (k.includes(pq) || x.rks[g].includes(pq) || (qb && k === qb) || (k.length >= 8 && pq.length > k.length && pq.length - k.length <= 5 && pq.startsWith(k)))) out.add(g);
      }
    }
    const sk = new Set(arr(q.sk).slice(0, 400).map(String).filter(k => k.length >= 5));
    if (sk.size) { if (!x.sk) x.sk = x.pks.map(scKey); for (let g = 0; g < x.sk.length && out.size < ROW_CAP; g++) if (x.sk[g] && sk.has(x.sk[g])) out.add(g); }
    arr(q.di).forEach(i => put(x.by.di.get(+i)));
    arr(q.ai).forEach(i => put(x.by.ai.get(+i)));
    const g = [...out].sort((a, b) => a - b), rs = g.map(i => d.d[i]), part = {};
    PART_KEYS.forEach(k => { if (d[k]) part[k] = {}; });
    for (const r of rs) { const pn = r[5]; if (!pn) continue; if (part.mrp) { const v = mrpOf(d, pn); if (v) part.mrp[pn] = v; } if (part.phf && d.phf[pn]) part.phf[pn] = d.phf[pn]; if (part.ph && d.ph[pn] != null) part.ph[pn] = d.ph[pn]; }
    // each line counted once a day per login: a login that has had more than pct % of the brand's lines today is a copy, not a day's work
    let over = false;
    if (user) {
      const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), k = user.id + '|' + slug;
      let s = seen.get(k); if (!s || s.day !== day || s.bits.length * 8 < d.d.length) seen.set(k, s = { day, bits: new Uint8Array((d.d.length >> 3) + 1), n: 0 });
      for (const i of g) { const b = 1 << (i & 7); if (!(s.bits[i >> 3] & b)) { s.bits[i >> 3] |= b; s.n++; } }
      over = s.n * 100 > d.d.length * pct;
      if (over && !s.told) { s.told = 1; log(new Date().toISOString(), '[catalogue] lines limit:', user.id, slug, s.n, 'of', d.d.length); }
    }
    return { g, d: rs, ...part, more: out.size >= ROW_CAP, over };
  }
  // the parsed file, shared with the part number lookup (pnlook) so the server holds it once
  // async for pnlook (reads without holding up the site; the parse itself is one step), same cache as loadFile
  const data = async f => {
    let st; try { st = await fs.promises.stat(f); } catch { return null; }
    const c = C.get(f); if (c && c.mt === st.mtimeMs && c.size === st.size) return c.d;
    const txt = await fs.promises.readFile(f, 'utf8'); await new Promise(r => setImmediate(r));
    const d = JSON.parse(txt); if (!d || !Array.isArray(d.d)) return null;
    C.set(f, { f, mt: st.mtimeMs, size: st.size, d, ix: null, head: null }); return d;
  };
  const reset = uid => { for (const k of [...seen.keys()]) if (k.startsWith(uid + '|')) seen.delete(k); };   // Admin unlocked the login
  return { head, rows, data, reset };
}
