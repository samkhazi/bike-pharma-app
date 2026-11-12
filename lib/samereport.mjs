// 21n (Sam 2026-11-12 "admin me uska ek alag hi list show hona he", design "Same parts (12 Nov)"): the Admin report of same parts.
// Lists come from DATA_DIR/xref-pairs.json (written by lib/xrefbuild.mjs): c = found from the catalogues, k = same design or size
// (to check). Pairs staff marked the same (kv samepart) or wrong (kv samewrong) leave the "to check" list.
import fs from 'node:fs';
const pk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const pairKey = (a, b) => [pk(a), pk(b)].sort().join('|');
const csvCell = v => { v = String(v == null ? '' : v); if (/^[=+@\t\r]|^-[^\d.]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
export const toCsv = rows => rows.map(l => l.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function sameReport({ file, store }) {
  let C = null;   // { mt, size, pairs }
  const load = () => { let st; try { st = fs.statSync(file); } catch { return { at: '', pairs: [] }; }
    if (!C || C.mt !== st.mtimeMs || C.size !== st.size) { try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); C = { mt: st.mtimeMs, size: st.size, at: d.at || '', pairs: Array.isArray(d.pairs) ? d.pairs : [] }; } catch { C = { mt: st.mtimeMs, size: st.size, at: '', pairs: [] }; } }
    return C; };
  const done = () => new Set(store.kvAll('samepart').map(([k]) => k)), wrong = () => new Set(store.kvAll('samewrong').map(([k]) => k));
  // tab c | k; q = number or name words; bp = 'Hero|Honda' or ''
  function rows(tab, q, bp) {
    const d = load(), D = tab === 'k' ? done() : null, W = tab === 'k' ? wrong() : null, qk = pk(q), qw = String(q || '').toUpperCase().split(/[^A-Z0-9]+/).filter(w => w.length > 1);
    const all = d.pairs.filter(p => p[0] === tab && !(D && (D.has(pairKey(p[3], p[6])) || W.has(pairKey(p[3], p[6])))));
    const bps = new Map(); for (const p of all) { const k = p[2] + '|' + p[5]; bps.set(k, (bps.get(k) || 0) + 1); }
    let L = bp ? all.filter(p => p[2] + '|' + p[5] === bp) : all;
    if (qk.length >= 3 || qw.length) L = L.filter(p => { const nums = pk(p[3]) + ' ' + pk(p[6]); if (qk.length >= 3 && nums.includes(qk)) return true; const nm = (p[4] + ' ' + p[7]).toUpperCase(); return qw.length > 0 && qw.every(w => nm.includes(w)); });
    return { at: d.at, total: L.length, all: all.length, bps: [...bps].sort((a, b) => b[1] - a[1]).slice(0, 12), L };
  }
  return {
    page(tab, q, bp, off = 0, n = 50) { const r = rows(tab, q, bp); return { at: r.at, total: r.total, all: r.all, bps: r.bps, rows: r.L.slice(off, off + n).map(p => p.slice(1)) }; },
    csv(tab, q, bp) {
      if (tab === 's') return toCsv([['Brand A', 'Part no A', 'Name A', 'Brand B', 'Part no B', 'Name B', 'Added by', 'Added on']].concat(store.kvAll('samepart').map(([, v]) => v).sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .map(v => [v.a.vb, v.a.pn, v.a.name, v.b.vb, v.b.pn, v.b.name, v.by, String(v.at || '').slice(0, 16).replace('T', ' ')])));
      return toCsv([['Brand A', 'Part no A', 'Name A', 'Brand B', 'Part no B', 'Name B', tab === 'k' ? 'Why to check' : 'Why the same']].concat(rows(tab, q, bp).L.map(p => [p[2], p[3], p[4], p[5], p[6], p[7], p[1]])));
    },
  };
}
