// 21p (Sam 2026-11-13 "kounse bike ko kounsa tyre suit hota he ... check karke poora list ready karke de"):
// reads every built catalogue (DATA_DIR/cat/<brand>.json) and lists, bike by bike, the front and rear tyre size printed in the
// tyre part's name or remark. Read only: nothing in the app changes. No prices are read or written.
//   node tools/tyre_list.mjs <cat dir> [out.csv]
import fs from 'node:fs';
import path from 'node:path';
const SKIP = /(-dg|-app|-build|-pages|-ph|-idx|^xref|^app)\b.*\.json$/i;
// 90/90-12, 100/80 17, 110/70R17, 2.75-18, 3.00 x 17, 2.75X18, 90-100-10 (first dash misprint), 3.50-10
const SIZE = /(\d{2,3})\s*[\/X]\s*(\d{2,3})\s*(?:-|–|X|\s|Z?R)\s*(\d{2})(?!\d)|(?<![\d.])(\d\.\d{1,2})\s*(?:-|–|X|\s)\s*(\d{2})(?!\d)/i;
// TVS writes the rim first: "TYRE TUBELESS 18 300 REAR" = 3.00-18, "17 90.00 FRONT" = 90 wide on a 17 rim (profile not printed)
const RIM1 = /\b(1[0-9]|2[01])\s+(\d{2,3})(?:\.00)?\b/, WONLY = /\((\d\.\d{2})\)/;
const sizeOf = s => { const t = String(s || '').toUpperCase(), m = SIZE.exec(t);
  if (m) return m[1] ? m[1] + '/' + m[2] + (/R/.test(m[0].replace(/^[\dX\/\s]+?(?=[-–XRZ\s]*\d{2}$)/, '')) ? ' R' : '-') + m[3] : (m[4].length === 3 ? m[4] + '0' : m[4]) + '-' + m[5];
  const r = RIM1.exec(t); if (r) { const w = +r[2]; if (w >= 225 && w <= 450 && w % 25 === 0) return (w / 100).toFixed(2) + '-' + r[1]; if (w >= 70 && w <= 200) return w + '/?-' + r[1] + ' (profile not printed)'; }
  const w = WONLY.exec(t); return w ? w[1] + '-? (rim not printed)' : ''; };
const isTyre = n => { const s = String(n || '').toUpperCase().replace(/TUBE\s*-?\s*LESS|TUBELESS/g, 'TL'); return /\bTY?I?RES?\b|\bTYRE|\bTIRE\b/.test(s) && !/\bTUBE\b|FLAP|VALVE|LEVER|GAUGE|LABEL|STICKER|CAUTION|PRESSURE|INFLAT|HUGGER|SEALANT|REPAIR|DECAL|PLATE|MANUAL|PUMP|GUARD|COVER|FENDER|TOOL|PATCH|\bRIM\b|WEIGHT|BALANC|SENSOR|\bKIT\b/.test(s); };
const sideOf = (name, asm) => { const s = ' ' + String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ') + ' '; if (/ (FRONT|FR|FRT|F) /.test(s)) return 'F'; if (/ (REAR|RR|R) /.test(s)) return 'R'; const a = String(asm || '').toUpperCase(); if (/FRONT|\bFR\b/.test(a) && !/REAR/.test(a)) return 'F'; if (/REAR|\bRR\b/.test(a) && !/FRONT/.test(a)) return 'R'; return '?'; };
const kindOf = s => /TUBE\s*-?\s*LESS|\bTL\b/i.test(s) ? 'Tubeless' : /TUBE\s*TYPE|\bTT\b/i.test(s) ? 'Tube type' : '';
const MAKER = /\b(MRF|CEAT|TVS|EUROGRIP|APOLLO|JK|MICHELIN|PIRELLI|METZELER|DUNLOP|IRC|BRIDGESTONE|MAXXIS|RALCO|BIRLA|TIMSUN|REMORA|PROTORQ|ZAPPER|NYLOGRIP|SECURA|GRIPP|ZOOM)\b/i;

export function tyres(catDir) {
  const out = [], stat = [];
  for (const f of fs.readdirSync(catDir).filter(f => f.endsWith('.json') && !SKIP.test(f)).sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(catDir, f), 'utf8')); } catch (e) { continue; }
    if (!d || !Array.isArray(d.d) || !Array.isArray(d.vars)) continue;
    const brand = d.brand || f.replace(/\.json$/, ''), by = new Map(), nosize = new Map(); let rows = 0;
    const mod = i => { const v = d.vars[i]; return (d.vmod && d.vmod[v]) || v || ''; };
    for (const r of d.d) {
      const name = (typeof r[6] === 'number' ? (d.desc || [])[r[6]] : r[6]) || ''; if (!isTyre(name)) continue;
      const rem = r[8] || '', asm = (d.asm || [])[r[3]] || '', size = sizeOf(name) || sizeOf(rem), side = sideOf(name, asm), txt = name + ' ' + rem; rows++;
      const mk = (MAKER.exec(txt) || [])[1] || '';
      for (const i of r[11] || []) {
        const m = mod(i); if (!m) continue;
        if (!size) { if (!nosize.has(m)) nosize.set(m, new Set()); nosize.get(m).add(String(r[5]) + ' ' + name); continue; }
        if (!by.has(m)) by.set(m, { F: new Map(), R: new Map(), '?': new Map(), vars: new Set() });
        const e = by.get(m), S = e[side]; if (!S.has(size)) S.set(size, { pn: new Set(), kind: new Set(), mk: new Set(), vars: new Set() });
        const x = S.get(size); x.pn.add(String(r[5]).trim()); if (kindOf(txt)) x.kind.add(kindOf(txt)); if (mk) x.mk.add(mk.toUpperCase()); x.vars.add(d.vars[i]); e.vars.add(d.vars[i]);
      }
    }
    const models = [...new Set((d.models && d.models.length ? d.models : d.vars.map((v, i) => mod(i))).filter(Boolean))]; let got = 0, only = 0;
    for (const m of models) {
      const e = by.get(m), ns = nosize.get(m);
      if (!e) { out.push({ brand, model: m, front: '', rear: '', side: '', note: ns ? 'tyre part found, no size in its name: ' + [...ns].slice(0, 3).join(' | ') : 'no tyre part in the catalogue', pn: '', kind: '', mk: '' }); if (ns) only++; continue; }
      got++;
      const j = M => [...M.keys()].sort().join(' or '), all0 = 0, known = new Set([...e.F.keys(), ...e.R.keys()]); if (e.F.size && e.R.size) for (const k of [...e['?'].keys()]) if (known.has(k)) e['?'].delete(k);
      const all = [...e.F.values(), ...e.R.values(), ...e['?'].values()];
      const u = k => [...new Set(all.flatMap(x => [...x[k]]))].join(' / ');
      const nv = M => [...M].map(([s, x]) => x.vars.size < e.vars.size && M.size > 1 ? s + ': ' + [...x.vars].slice(0, 2).map(v => v.split(' · ').slice(1, 2).join('') || v).join(', ') : '').filter(Boolean).join('; ');
      out.push({ brand, model: m, front: j(e.F), rear: j(e.R), side: j(e['?']), note: [nv(e.F) && 'front ' + nv(e.F), nv(e.R) && 'rear ' + nv(e.R)].filter(Boolean).join(' || '), pn: [...new Set(all.flatMap(x => [...x.pn]))].slice(0, 12).join(' / '), kind: u('kind'), mk: u('mk') });
    }
    stat.push({ brand, models: models.length, got, only, rows });
  }
  return { out, stat };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const { out, stat } = tyres(process.argv[2]), outF = process.argv[3];
  console.log('BRAND | bikes | tyre size found | tyre part without size | tyre rows read');
  for (const s of stat) console.log(s.brand + ' | ' + s.models + ' | ' + s.got + ' | ' + s.only + ' | ' + s.rows);
  for (const s of stat) {
    const ok = out.filter(r => r.brand === s.brand && (r.front || r.rear || r.side)), bad = out.filter(r => r.brand === s.brand && /no size/.test(r.note));
    console.log('\n== ' + s.brand);
    for (const r of ok.slice(0, 3)) console.log('   ' + r.model + ' : front ' + (r.front || '-') + ' | rear ' + (r.rear || '-') + (r.side ? ' | side not said ' + r.side : '') + (r.kind ? ' | ' + r.kind : ''));
    for (const r of bad.slice(0, 3)) console.log('   ? ' + r.model + ' : ' + r.note.slice(0, 150));
  }
  if (outF) {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    fs.writeFileSync(outF, '﻿' + ['Brand,Bike,Front tyre,Rear tyre,Size (front/rear not said),Tube or tubeless,Tyre make in catalogue,Which variant,Tyre part numbers'].concat(out.map(r => [r.brand, r.model, r.front, r.rear, r.side, r.kind, r.mk, r.note, r.pn].map(q).join(','))).join('\r\n') + '\r\n');
    console.log('\nfull list: ' + outF + ' (' + out.length + ' bikes)');
  }
}
