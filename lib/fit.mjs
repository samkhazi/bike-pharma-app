// 21t: Find Part > Tyre / Battery. Serves DATA_DIR/fit.json (lib/fitbuild.mjs, made with the cross-brand build) one bike at a time,
// plus the sizes Admin or Manager typed for bikes whose catalogue does not print them (kv 'fitsize', key kind|brand|model).
import fs from 'node:fs';
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const T_OK = /^(\d{2,3}\/\d{2,3}( R|-)\d{2}|\d\.\d{2}-\d{2})$/, B_OK = /^(6|12) V \d{1,2}(\.\d)? Ah$/;
export const tyreSize = s => { let t = String(s || '').toUpperCase().replace(/\s+/g, ' ').trim().replace(/^(\d{2,3})\s*[\/X]\s*(\d{2,3})\s*(?:-|X| )\s*(\d{2})$/, '$1/$2-$3').replace(/^(\d{2,3})\s*\/\s*(\d{2,3})\s*Z?R\s*(\d{2})$/, '$1/$2 R$3').replace(/^(\d\.\d{2})\s*(?:-|X| )\s*(\d{2})$/, '$1-$2'); return T_OK.test(t) ? t : ''; };
export const battSpec = (v, ah) => { const s = (+v || 0) + ' V ' + String(+ah || 0) + ' Ah'; return B_OK.test(s) ? s : ''; };

export function fitApi({ file, store, listDir }) {
  let C = null, LC = null;
  // tyre / battery makers' own lists (Sam's files, DATA_DIR/fit-lists/<brand>.json: { brand, kind 't'|'b', rows [[sku, name, size, TL/TT, F|R|'', mrp]] })
  const lists = () => { let fl = []; try { fl = fs.readdirSync(listDir).filter(f => f.endsWith('.json')).sort(); } catch { return { t: {}, b: {}, mk: { t: [], b: [] } }; }
    const sig = fl.map(f => { try { const st = fs.statSync(listDir + '/' + f); return f + st.mtimeMs + st.size; } catch { return f; } }).join('|');
    if (!LC || LC.sig !== sig) { const o = { sig, t: {}, b: {}, mk: { t: [], b: [] } };
      for (const f of fl) { try { const d = JSON.parse(fs.readFileSync(listDir + '/' + f, 'utf8')), k = d.kind === 'b' ? 'b' : 't', br = clean(d.brand, 30); if (!br || !Array.isArray(d.rows)) continue; if (!o.mk[k].includes(br)) o.mk[k].push(br);
        for (const r of d.rows) { const sz = k === 'b' ? clean(r[2], 20) : tyreSize(r[2]); if (!sz) continue; (o[k][sz] || (o[k][sz] = [])).push([br, clean(r[0], 30), clean(r[1], 90), +r[5] > 0 ? +r[5] : 0, br, r[3] === 'TL' ? 'Tubeless' : r[3] === 'TT' ? 'Tube type' : '', r[4] === 'F' || r[4] === 'R' ? r[4] : '', 1]); } } catch {} }
      LC = o; }
    return LC; };
  const inSize = (k, d, s) => [...(((k === 'b' ? d.bsz : d.tsz) || {})[s] || []), ...(lists()[k][s] || [])];
  const load = () => { let st; try { st = fs.statSync(file); } catch { return { models: {}, tyre: {}, batt: {}, tsz: {}, bsz: {} }; }
    if (!C || C.mt !== st.mtimeMs || C.size !== st.size) { try { C = { mt: st.mtimeMs, size: st.size, d: JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { return C ? C.d : { models: {}, tyre: {}, batt: {}, tsz: {}, bsz: {} }; } }
    return C.d; };
  const man = (k, vb, vm) => store.kvGet('fitsize', k + '|' + vb + '|' + vm) || null;
  const makers = L => [...new Set(L.map(x => x[4] || x[0] + ' genuine'))];
  return {
    // brands and models for the pickers; n = how many bikes have a size
    index(k) { const d = load(), S = k === 'b' ? d.batt : d.tyre, out = {}; for (const vb of Object.keys(d.models || {}).sort()) out[vb] = d.models[vb].filter(m => !/^Other /.test(m));
      let have = 0, all = 0; for (const vb of Object.keys(out)) for (const m of out[vb]) { all++; const e = (S[vb] || {})[m]; if ((e && (k === 'b' ? e.S.length : e.F.length + e.R.length + e.U.length)) || man(k, vb, m)) have++; }
      const mk = new Set(); for (const L of Object.values((k === 'b' ? d.bsz : d.tsz) || {})) for (const x of L) if (x[4]) mk.add(x[4]); for (const b of lists().mk[k]) mk.add(b);
      return { at: d.at || '', brands: out, have, all, makers: [...mk].sort() }; },
    bike(k, vb, vm) { const d = load(), e = ((k === 'b' ? d.batt : d.tyre)[vb] || {})[vm] || null, m = man(k, vb, vm), Z = k === 'b' ? d.bsz : d.tsz;
      const sizes = k === 'b' ? [...new Set([...(e ? e.S : []), ...(m && m.s ? [m.s] : [])])] : [...new Set([...(e ? [...e.F, ...e.R, ...e.U] : []), ...(m ? [m.f, m.r].filter(Boolean) : [])])];
      const fits = {}; for (const s of sizes) { const L = inSize(k, d, s); if (L.length) fits[s] = L.slice(0, 80); }
      return { known: !!(d.models[vb] || []).includes(vm), e, man: m, fits, makers: makers(Object.values(fits).flat()) }; },
    // a typed size: the tyres / batteries in it and the bikes that use it
    size(k, s) { const d = load(); s = k === 'b' ? clean(s, 20) : tyreSize(s); if (!s) return { size: '', fits: [], bikes: [] };
      const Z = k === 'b' ? d.bsz : d.tsz, S = k === 'b' ? d.batt : d.tyre, bikes = [];
      for (const vb of Object.keys(S)) for (const [m, e] of Object.entries(S[vb])) { if (k === 'b') { if (e.S.includes(s)) bikes.push([vb, m, '']); } else { const f = e.F.includes(s), r = e.R.includes(s), u = e.U.includes(s); if (f || r || u) bikes.push([vb, m, f && r ? 'Front and rear' : f ? 'Front' : r ? 'Rear' : '']); } }
      for (const [key, v] of store.kvAll('fitsize')) { const [kk, vb, m] = key.split('|'); if (kk !== k || bikes.some(b => b[0] === vb && b[1] === m)) continue; if (k === 'b' ? v.s === s : v.f === s || v.r === s) bikes.push([vb, m, k === 'b' ? '' : v.f === s && v.r === s ? 'Front and rear' : v.f === s ? 'Front' : 'Rear']); }
      const L = inSize(k, d, s); return { size: s, fits: L.slice(0, 120), bikes: bikes.slice(0, 200), makers: makers(L) }; },
    set(k, vb, vm, b, user) { const d = load(); vb = clean(vb); vm = clean(vm, 80); if (!(d.models[vb] || []).includes(vm)) return { error: 'Pick the bike first' };
      const key = k + '|' + vb + '|' + vm; if (b.del) { store.kvDel('fitsize', key); return { ok: true }; }
      let v; if (k === 'b') { const s = battSpec(b.v, b.ah); if (!s) return { error: 'Type the volt (6 or 12) and the Ah' }; v = { s, type: ['Maintenance free', 'Lithium', ''].includes(b.type) ? b.type : '' }; }
      else { const f = tyreSize(b.f), r = tyreSize(b.r); if (!f && !r) return { error: 'Type the size like 90/90-12 or 2.75-18' }; if ((b.f && !f) || (b.r && !r)) return { error: 'Type the size like 90/90-12 or 2.75-18' }; v = { f, r, kind: ['Tubeless', 'Tube type'].includes(b.kind) ? b.kind : '' }; }
      v.by = clean(user.name || user.id, 40); v.at = new Date().toISOString(); store.kvSet('fitsize', key, v); return { ok: true, man: v }; }
  };
}
