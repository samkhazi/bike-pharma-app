// 20g (Sam 2026-11-11 "dono catalogue ko use karke server me add karde"): Suprajit's parts (control cables, speedometers, tank units,
// filters, mirrors, brake shoes, clutch plates, disc pads) in the aftermarket list (cat/am.json), next to Rolon.
// The data is one file on the server (suprajit.json, made by tools/aftermarket/suprajit_parse.py from Suprajit's own price lists:
// the older list gives the original part number of a part, the newest gives the MRP). MRP only.
// A part with an original number shows under that original part; the rest are found by bike + kind (the app says "check").
// Suprajit lines of an older uploaded list are dropped, so no part shows twice.
import { fitter } from './rolonam.mjs';

const CW = '(CABLE|WIRE)';
const both = (a) => `${CW}.*(${a})|(${a}).*${CW}`;
// kinds a cable can be, as Suprajit and the bike makers both write them (CABLE COMP, CLUTCH / Clutch Cable / WIRE, CLUTCH)
export const TY_SUP = [['Clutch cable', both('CLUTCH|CLUTH')], ['Throttle cable', both('THROTTLE|ACCELERATOR')], ['Front brake cable', both('(FR|FRT|FRONT)\\.? ?(BRAKE|BARKE|BR\\b)')],
  ['Rear brake cable', both('(RR|REAR)\\.? ?(BRAKE|BR\\b)')], ['Speedometer cable', both('SPEEDO(METER)?')], ['Choke cable', both('CHOKE')], ['Seat lock cable', both('SEAT ?(LOCK|LATCH)')], ['Gear cable', both('GEAR')], ['Brake cable', both('BRAKE')],
  ['Air filter', 'AIR ?FILTER|FOAM FILTER|AIR CLEANER|ELEMENT,? ?(COMP,? ?)?AIR'], ['Oil filter', 'OIL ?FILTER'], ['Fuel filter', 'FUEL ?FILTER'],
  ['Tank unit', 'TANK UNIT|FUEL (UNIT|GAUGE UNIT|LEVEL)|UNIT,? ?FUEL'], ['Speedometer', 'SPEEDOMETER|SPEEDO METER|METER ASS'], ['Mirror', 'MIRROR'],
  ['Disc pad', 'DISC PAD|PAD (SET|KIT|COMP)|BRAKE PAD'], ['Brake shoe', 'BRAKE SHOE|SHOE,? ?(SET|COMP|KIT)?,? ?BRAKE'], ['Clutch plate', 'CLUTCH PLATE|PLATE,? ?CLUTCH|DISC,? ?CLUTCH|FRICTION (PLATE|DISC)']];
const sp = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

export function mergeSuprajit(base, sup, xref) {
  const d = base && Array.isArray(base.p) ? base : { src: '', b: [], ob: [], ty: [], p: [] };
  const ty = (d.ty || []).concat(TY_SUP.filter(([n]) => !(d.ty || []).some(([m]) => m === n))), TYC = ty.map(([n, x]) => { try { return [n, new RegExp(x)]; } catch (e) { return [n, /$^/]; } });
  const tyOf = (...ss) => { for (const s of ss) { const u = String(s || '').toUpperCase(); for (const [n, x] of TYC) if (x.test(u)) return n; } return ''; };
  const old = d.b.findIndex(b => String(b).toLowerCase() === 'suprajit');
  const b = old >= 0 ? d.b.slice() : d.b.concat(['Suprajit']), bi = old >= 0 ? old : b.length - 1, ob = (d.ob || []).slice(), fit = fitter(xref);
  const p = d.p.filter(r => r[0] !== old), seen = new Set();
  for (const r of sup.rows || []) {
    const pn = sp(r.pn); if (!pn || seen.has(pn)) continue; seen.add(pn);
    const cable = r.sec === 'Control cable', nm0 = sp(r.nm), bikes = sp(r.fit || r.veh);
    const nm = (cable ? nm0 : [r.sec, nm0].filter(Boolean).join(' · ')) + (r.oldmrp ? ' · MRP of the Jan 2024 list' : '');
    const fm = fit(r.mk, [bikes, sp(r.hay) || nm0].join(' , ')).map(([bn, m]) => { let i = ob.indexOf(bn); if (i < 0) { ob.push(bn); i = ob.length - 1; } return [i, m]; });
    const kind = cable ? tyOf(nm0 + ' CABLE') : (tyOf(r.sec) || tyOf(nm0));
    p.push([bi, pn, nm, 'Suprajit ' + String(r.sec || 'part').toLowerCase(), Math.round(+r.mrp || 0), (r.mk ? r.mk + ': ' : '') + (bikes || (cable ? '' : sp(r.hay) || nm0)), (r.oem || []).map(sp).filter(Boolean), [], kind, fm, [], '']);
  }
  return { ...d, src: [d.src, 'Suprajit: its own price lists (MRP)'].filter(Boolean).join(' · '), b, ob, ty, p };
}
