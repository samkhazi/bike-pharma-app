// 21t (Sam 2026-11-13 "find part me ... Spares dhoondna he ya tyre ya battery", design "Tyre and battery (13 Nov)"):
// reads, from every brand's built catalogue, the tyre size (front, rear) and the battery (volt, Ah) of each bike, printed in the
// part's name or remark, and which tyres / batteries exist in each size. lib/xrefbuild.mjs calls it on the files it reads anyway and
// writes DATA_DIR/fit.json. MRP only (the catalogue's own MRP map); nothing is changed in the catalogues.
// 90/90-12, 100/80 17, 110/70R17, 110X90-18, 2.75-18, 3.00 x 17
const SIZE = /(\d{2,3})\s*[\/X]\s*(\d{2,3})\s*(?:-|–|X|\s|Z?R)\s*(\d{2})(?!\d)|(?<![\d.])(\d\.\d{1,2})\s*(?:-|–|X|\s)\s*(\d{2})(?!\d)/i;
// TVS writes the rim first: "TYRE TUBELESS 18 300 REAR" = 3.00-18, "17 90.00 FRONT" = 90 wide on a 17 rim (profile not printed)
const RIM1 = /\b(1[0-9]|2[01])\s+(\d{2,3})(?:\.00)?\b/, WONLY = /\((\d\.\d{2})\)/;
export const sizeOf = s => { const t = String(s || '').toUpperCase(), m = SIZE.exec(t);
  if (m) return m[1] ? m[1] + '/' + m[2] + (/R/.test(m[0].replace(/^[\dX\/\s]+?(?=[-–XRZ\s]*\d{2}$)/, '')) ? ' R' : '-') + m[3] : (m[4].length === 3 ? m[4] + '0' : m[4]) + '-' + m[5];
  const r = RIM1.exec(t); if (r) { const w = +r[2]; if (w >= 225 && w <= 450 && w % 25 === 0) return (w / 100).toFixed(2) + '-' + r[1]; if (w >= 70 && w <= 200) return w + '/?-' + r[1] + ' (profile not printed)'; }
  const w = WONLY.exec(t); return w ? w[1] + '-? (rim not printed)' : ''; };
export const isTyre = n => { const s = String(n || '').toUpperCase().replace(/TUBE\s*-?\s*LESS|TUBELESS/g, 'TL'); return /\bTY?I?RES?\b|\bTYRE|\bTIRE\b/.test(s) && !/\bTUBE\b|FLAP|VALVE|LEVER|GAUGE|LABEL|STICKER|CAUTION|PRESSURE|INFLAT|HUGGER|SEALANT|REPAIR|DECAL|PLATE|MANUAL|PUMP|GUARD|COVER|FENDER|TOOL|PATCH|\bRIM\b|WEIGHT|BALANC|SENSOR|\bKIT\b/.test(s); };
export const sideOf = (name, asm) => { const s = ' ' + String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ') + ' '; if (/ (FRONT|FR|FRT|F) /.test(s)) return 'F'; if (/ (REAR|RR|R) /.test(s)) return 'R'; const a = String(asm || '').toUpperCase(); if (/FRONT|\bFR\b/.test(a) && !/REAR/.test(a)) return 'F'; if (/REAR|\bRR\b/.test(a) && !/FRONT/.test(a)) return 'R'; return 'U'; };
export const kindOf = s => /TUBE\s*-?\s*LESS|\bTL\b/i.test(s) ? 'Tubeless' : /TUBE\s*TYPE|\bTT\b/i.test(s) ? 'Tube type' : '';
const T_MAKER = /\b(MRF|CEAT|EUROGRIP|APOLLO|JK|MICHELIN|PIRELLI|METZELER|DUNLOP|IRC|BRIDGESTONE|MAXXIS|RALCO|BIRLA|TIMSUN)\b/i;
const B_MAKER = /\b(EXIDE|AMARON|TATA GREEN|SF SONIC|LIVGUARD|OKAYA|POWERZONE|YUASA|AMCO|BASE)\b/i;
export const isBatt = n => { const s = String(n || '').toUpperCase(); return /\bBATTERY\b|\bBATT\b/.test(s) && !/BAND|STRAP|COVER|\bBOX\b|TRAY|CABLE|WIRE|HOLDER|BRACKET|BRKT|CUSHION|RUBBER|\bCASE\b|LEAD|TERMINAL|\bSTAY\b|BELT|CLAMP|\bPAD\b|SENSOR|CHARGER|\bTUBE\b|PLATE|GUARD|\bLID\b|\bSEAT\b|BOLT|SCREW|\bNUT\b|PACK|MODULE|\bBMS\b|LOCK|CARRIER|DAMPER|\bCAP\b|LABEL|STICKER|HARNESS|CORD|FUSE|BREATHER|\bSET\b.*\bBAND\b|SUPPORT|PROTECTOR|SHEET|SPACER|COLLAR|STOPPER|CHARGING|COUPLER|CONNECTOR/.test(s); };
export const battOf = s => { const t = String(s || '').toUpperCase(), v = /(\d{1,2})\s*V(?:OLT)?\b/.exec(t), a = /(\d{1,2}(?:\.\d)?)\s*A\.?\s?H\b/.exec(t); if (!a && !v) return ''; if (v && ![6, 12].includes(+v[1])) return ''; return (v ? v[1] + ' V' : '') + (v && a ? ' ' : '') + (a ? a[1].replace(/\.0$/, '') + ' Ah' : ''); };
export const battType = s => /\bMF\b|MAINTENANCE\s*FREE|VRLA|SEALED/i.test(s) ? 'Maintenance free' : /LI-?ION|LITHIUM/i.test(s) ? 'Lithium' : '';
const pkk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function fitCollector() {
  const models = {}, tyre = {}, batt = {}, tsz = new Map(), bsz = new Map();
  const push = (M, k, row, max) => { let a = M.get(k); if (!a) M.set(k, a = []); if (a.length < max && !a.some(x => x[0] === row[0] && x[1] === row[1])) a.push(row); };
  return {
    add(d, vb) {
      const mod = i => { const v = d.vars[i]; return (d.vmod && d.vmod[v]) || v || ''; }, mrpOf = pn => { const M = d.mrp || {}; const v = M[pn] != null ? M[pn] : M[pkk(pn)]; return typeof v === 'number' && v > 0 ? v : 0; };
      const ms = models[vb] || (models[vb] = []); for (const m of (d.models && d.models.length ? d.models : d.vars.map((v, i) => mod(i)))) if (m && !ms.includes(m)) ms.push(m);
      const T = tyre[vb] || (tyre[vb] = {}), B = batt[vb] || (batt[vb] = {});
      for (const r of d.d) {
        const name = String((typeof r[6] === 'number' ? (d.desc || [])[r[6]] : r[6]) || ''), rem = String(r[8] || ''), pn = String(r[5] || '').trim(); if (!pn) continue;
        const ty = isTyre(name), bt = !ty && isBatt(name); if (!ty && !bt) continue;
        const txt = name + ' ' + rem, mrp = mrpOf(pn), bikes = [...new Set((r[11] || []).map(mod).filter(Boolean))];
        if (ty) {
          const size = sizeOf(name) || sizeOf(rem), side = sideOf(name, (d.asm || [])[r[3]]), kd = kindOf(txt), mk = ((T_MAKER.exec(txt) || [])[1] || '').toUpperCase();
          if (size && !size.includes('?')) push(tsz, size, [vb, pn, name, mrp, mk, kd, side === 'U' ? '' : side], 60);
          for (const m of bikes) { const e = T[m] || (T[m] = { F: [], R: [], U: [], kind: '', P: [], ns: [] });
            if (!size) { if (e.ns.length < 4 && !e.ns.some(x => x[0] === pn)) e.ns.push([pn, name, side, mrp]); continue; }
            if (!e[side].includes(size)) e[side].push(size); if (kd && !e.kind) e.kind = kd; if (e.P.length < 16 && !e.P.some(x => x[0] === pn)) e.P.push([pn, name, side, size, mrp, mk]); }
        } else {
          const spec = battOf(name) || battOf(rem), tp = battType(txt), mk = ((B_MAKER.exec(txt) || [])[1] || '').toUpperCase();
          if (spec && / Ah/.test(spec)) push(bsz, spec, [vb, pn, name, mrp, mk, tp], 60);
          for (const m of bikes) { const e = B[m] || (B[m] = { S: [], type: '', P: [], ns: [] });
            if (!spec) { if (e.ns.length < 4 && !e.ns.some(x => x[0] === pn)) e.ns.push([pn, name, '', mrp]); continue; }
            if (!e.S.includes(spec)) e.S.push(spec); if (tp && !e.type) e.type = tp; if (e.P.length < 10 && !e.P.some(x => x[0] === pn)) e.P.push([pn, name, spec, mrp, mk]); }
        }
      }
    },
    done() {
      for (const vb of Object.keys(tyre)) for (const e of Object.values(tyre[vb])) { for (const k of ['F', 'R', 'U']) e[k].sort(); if (e.F.length && e.R.length) e.U = e.U.filter(s => !e.F.includes(s) && !e.R.includes(s)); if (e.F.length || e.R.length || e.U.length) e.ns = []; }
      for (const vb of Object.keys(batt)) for (const e of Object.values(batt[vb])) if (e.S.length) e.ns = [];
      return { at: new Date().toISOString(), models, tyre, batt, tsz: Object.fromEntries(tsz), bsz: Object.fromEntries(bsz) };
    }
  };
}
