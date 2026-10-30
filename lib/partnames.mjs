// Sam 2026-10-30: "eh sabhi jod-de alternate part name me ... eh alternate name sirf hamare backend me rehna he": his part-names list
// (lib/names/part-names.json from tools/partnames.py) stays on the server. A search word that is a garage / local name, a standard name or
// any company's own name of a part gives back that part's names in the asked brand, so Find Part shows it; the list never goes out whole.
import fs from 'node:fs';

const key = s => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const ascii = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export function partNames(file) {
  let D = null, idx = null;
  const load = () => {
    if (idx) return;
    try { D = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { D = { groups: [] }; }
    idx = new Map(); const put = (k, i) => { k = key(k); if (!k) return; const a = idx.get(k) || []; if (!a.includes(i)) a.push(i); idx.set(k, a); };
    D.groups.forEach((g, i) => {
      put(g.s, i); for (const p of String(g.s).split(/[()/+,]/)) put(p, i);   // 'Lock Set (Ignition + Tank Cap + Seat Lock)' -> lock set, ignition, ...
      for (const x of g.g) put(x, i);
      for (const l of Object.values(g.n)) for (const x of l) put(x, i);
    });
  };
  // q: what was typed; brand: 'Any' or one brand. Returns { groups: [standard names], names: { brand: [company names, A-Z 0-9 form] } }
  return function look(q, brand = 'Any', cap = 4000) {
    load(); let k = key(q); if (!k) return { groups: [], names: {} };
    let ids = idx.get(k) || (k.endsWith('s') && idx.get(k.slice(0, -1))) || idx.get(k + 's') || [];
    if (ids.length > 3) ids = ids.slice(0, 3);   // a word that is in many groups says little
    const names = {};
    for (const i of ids) for (const [b, l] of Object.entries(D.groups[i].n)) if (brand === 'Any' || b === brand) { const a = names[b] || (names[b] = []); for (const x of l) if (a.length < cap && !a.includes(x)) a.push(x); }
    return { groups: ids.map(i => D.groups[i].s), names };
  };
}
export { ascii as pnAscii };
