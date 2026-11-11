// 19s (Sam 2026-11-11 "Rolon ka catalogue ... isko add karna he", "server daal de"): Rolon's parts in the aftermarket list (cat/am.json).
// The weekly Rolon job keeps its data in the site user's ~/rolon_dump (_state.json = every part, _kits.json = what is inside a kit).
// This reads those two files and puts Rolon into the aftermarket list the app already loads: one line per material code (the bikes
// of the same code joined), MRP as Rolon gives it, the old code and the kit's chain + sprocket teeth in the name so a search by
// bike, old code or chain finds it. Rolon lines of an older uploaded list are dropped, so no part shows twice.
// Nothing is written into Sam's uploads: the merged list is a file of its own, made again when a source changes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mergeSuprajit } from './suprajitam.mjs';

const sp = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const nice = s => { const t = sp(s).toLowerCase(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
const TYPE_NAME = { KIT: 'Chain sprocket kit' };
const NOT_MAKER = /KITS?$|^MOPED$|ELECTRIC|FOREIGN|WHEELER/i;
// 19t: kinds Rolon sells that the uploaded list may not name, so an original chain's page can show Rolon's chain
const TY_MORE = [['Cam chain', 'CAM ?CHAIN|TIMING CHAIN|CHAIN,? ?CAM|CHAIN,? ?TIMING|SILENT CHAIN'], ['Drive chain', 'DRIVE ?CHAIN|CHAIN,? ?DRIVE']];
// used only when no aftermarket list is uploaded yet (the uploaded list brings its own kinds)
const TY0 = [['Chain sprocket kit', 'SPROCKET|CHAIN KIT'], ['Drive belt', '\\bBELT'], ['Steering cone set', 'STEERING|CONE SET'], ['Air filter', 'AIR ?FILTER'],
  ['Starter motor', 'STARTER MOTOR'], ['Shock absorber', 'CUSHION']];

export function rolonDir(env = process.env) {
  for (const d of [env.ROLON_DIR, path.join(os.homedir(), 'rolon_dump'), '/home/bikepharma/rolon_dump']) if (d && fs.existsSync(path.join(d, '_state.json'))) return d;
  return null;
}

// one line per material code: { pn, nm, g, mrp, fit, mk (bike maker of a kit, else '') , veh: [vehicle names] }
export function rolonRows(st, kits = {}) {
  const types = (st && st.types && st.types.producttype) || [], by = new Map();
  for (const t of types) for (const b of (st.brands || {})[String(t.id)] || []) for (const r of (st.master || {})[t.id + '|' + b.type] || []) {
    const pn = sp(r.material); if (!pn) continue;
    const ty = sp(t.type).toUpperCase(), sub = sp(b.type), kit = ty === 'KIT', maker = kit && !NOT_MAKER.test(sub);   // 19t: 'BPR KITS', 'MOPED' are kit ranges, not bike makers
    let o = by.get(pn);
    if (!o) {
      const k = (kits[pn] || [])[0] || null, bits = [TYPE_NAME[ty] || nice(ty)];
      if (!maker && sub && sub.toUpperCase() !== ty) bits.push(nice(sub));
      if (sp(r.oldmaterialcode)) bits.push(sp(r.oldmaterialcode));
      if (k) {
        if (sp(k.chain) && sp(k.chain) !== '-') bits.push('chain ' + sp(k.chain));
        const f = sp(k.fspkt_teeth), b2 = sp(k.rspkt_teeth); if (/\d/.test(f) || /\d/.test(b2)) bits.push('sprockets ' + [f && f + 'T front', b2 && b2 + 'T rear'].filter(Boolean).join(' / '));
      }
      if (sp(r.delstat) === '-') bits.push('discontinued');
      if (String(r.premium_product).toLowerCase() === 'true') bits.push('premium');
      o = { pn, nm: bits.join(' · '), g: 'Rolon ' + (TYPE_NAME[ty] || nice(ty)).toLowerCase(), mrp: Math.round(parseFloat(String(r.mrp || '').replace(/[^\d.]/g, '')) || 0), mk: maker ? sub : '', veh: [] };
      by.set(pn, o);
    }
    for (const v of [sp(r.vehicle), sp(r.group1)]) if (v && !o.veh.some(x => x.toUpperCase() === v.toUpperCase()) && (v === sp(r.vehicle) || !o.veh.some(x => x.toUpperCase().includes(v.toUpperCase())))) o.veh.push(v);
    if (maker && sub && o.mk && o.mk.toUpperCase() !== sub.toUpperCase() && !o.mk.toUpperCase().split(' / ').includes(sub.toUpperCase())) o.mk += ' / ' + sub;
  }
  return [...by.values()].map(o => ({ ...o, fit: (o.mk ? o.mk + ': ' : '') + o.veh.join(', ') }));
}

// the bikes as model names of our own catalogues (as tools/aftermarket/am_build.py fits_of): every word of the model is in the text
const norm = s => ' ' + String(s || '').toUpperCase().replace(/(\d)\s*CC\b/g, '$1').replace(/(\d)([A-Z])/g, '$1 $2').replace(/([A-Z])(\d)/g, '$1 $2').replace(/[^A-Z0-9]+/g, ' ').trim() + ' ';
export function fitter(xref) {
  const B = (xref && xref.b) || [], M = (xref && xref.m) || [];
  const W = B.map((b, i) => (M[i] || []).map(m => [m, norm(String(m).replace(/\(.*?\)/g, '')).trim().split(' ').filter(Boolean)]));
  return (mk, text) => {
    const t = norm(text), mu = String(mk || '').toUpperCase(), out = [];
    const bs = B.map((b, i) => i).filter(i => mu && mu.split(' / ').some(x => x === String(B[i]).toUpperCase() || x.startsWith(String(B[i]).toUpperCase() + ' ') || String(B[i]).toUpperCase().startsWith(x + ' ')));
    B.forEach((b, i) => { if (!bs.includes(i) && t.includes(' ' + norm(b).trim() + ' ')) bs.push(i); });   // a KTM kit listed under Bajaj names KTM in its bike
    for (const i of (bs.length ? bs : mu ? [] : B.map((b, j) => j))) for (const [m, ws] of W[i]) if (ws.length && (bs.length || ws.length > 1 || ws[0].length > 5) && t.includes(' ' + ws.join(' ') + ' ')) out.push([B[i], m]);
    return out;
  };
}

export function mergeAm(base, st, kits, xref) {
  const d = base && Array.isArray(base.p) ? base : { src: '', b: [], ob: [], ty: [], p: [] };
  const ty0 = d.ty && d.ty.length ? d.ty : TY0, ty = ty0.concat(TY_MORE.filter(([n]) => !ty0.some(([m]) => m === n))), TYC = ty.map(([n, x]) => { try { return [n, new RegExp(x)]; } catch (e) { return [n, /$^/]; } });
  const tyOf = (...ss) => { for (const s of ss) { const u = String(s || '').toUpperCase(); for (const [n, x] of TYC) if (x.test(u)) return n; } return ''; };
  const old = d.b.findIndex(b => String(b).toLowerCase() === 'rolon');
  const b = old >= 0 ? d.b.slice() : d.b.concat(['Rolon']), bi = old >= 0 ? old : b.length - 1, ob = (d.ob || []).slice(), fit = fitter(xref);
  const p = d.p.filter(r => r[0] !== old);                       // an older uploaded Rolon list goes: only the fresh one shows
  for (const r of rolonRows(st, kits)) {
    const fm = fit(r.mk, r.veh.join(' , ')).map(([bn, m]) => { let i = ob.indexOf(bn); if (i < 0) { ob.push(bn); i = ob.length - 1; } return [i, m]; });
    p.push([bi, r.pn, r.nm, r.g, r.mrp, r.fit, [], [], tyOf(r.nm, r.g), fm, [], '']);
  }
  return { ...d, src: [d.src, 'Rolon: its own weekly list (MRP)'].filter(Boolean).join(' · '), b, ob, ty, p };
}

// the merged list as a file (made again only when a source is newer); null = neither Rolon's nor Suprajit's data here, serve the list as before
// 20g: Suprajit's list (supFile, lib/suprajitam.mjs) joins the same way, with or without Rolon
export function rolonAmFile({ baseFile, outFile, dir = rolonDir(), xrefFile, supFile = null, supFiles = null }) {
  const mt = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
  const sups = (supFiles || [supFile]).filter(f => f && mt(f));   // 20h: more than one company's list (Suprajit, Spark Minda)
  if (!dir && !sups.length) return null;
  const sf = dir ? path.join(dir, '_state.json') : null, kf = dir ? path.join(dir, '_kits.json') : null;
  const self = Math.max(mt(new URL(import.meta.url).pathname), mt(new URL('./suprajitam.mjs', import.meta.url).pathname));
  // made again when any source changed (a file added, removed or re-made), told by a small note next to the list
  const sig = JSON.stringify([sf, kf, ...sups, baseFile, xrefFile].map(f => f ? [f, mt(f)] : 0).concat([self])), sigFile = outFile + '.sig';
  let was = ''; try { was = fs.readFileSync(sigFile, 'utf8'); } catch (e) {}
  if (was === sig && mt(outFile) > 0) return outFile;
  const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const xref = xrefFile ? rd(xrefFile) : null;
  let out = baseFile ? rd(baseFile) : null, any = false;
  const st = sf ? rd(sf) : null;
  if (st && st.master) {
    // while the weekly job is reading (the file fills group by group) the list made from the last full read stays
    const want = new Set(Object.entries(st.brands || {}).flatMap(([k, v]) => (v || []).map(b => k + '|' + b.type))).size;
    if (!want || Object.keys(st.master).length < want) return mt(outFile) > 0 ? outFile : null;
    const m = mergeAm(out, st, rd(kf) || {}, xref);
    if (m.p.some(r => m.b[r[0]] === 'Rolon')) { out = m; any = true; }
  }
  for (const f of sups) { const sup = rd(f); if (sup && Array.isArray(sup.rows) && sup.rows.length) { out = mergeSuprajit(out, sup, xref); any = true; } }
  if (!any) return null;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = outFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(out)); fs.renameSync(tmp, outFile); fs.writeFileSync(sigFile, sig);
  return outFile;
}
