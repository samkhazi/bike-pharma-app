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
  ['Disc pad', 'DISC PAD|PAD (SET|KIT|COMP)|BRAKE PAD'],
  // 20h: Spark Minda's kinds
  ['Lock kit', 'LOCK (KIT|SET)|KEY SET|LOCK ASSY SET'], ['Ignition switch', 'IGNITION SWITCH|SWITCH,? ?(ASSY,? ?)?(COMBINATION|IGNITION|MAIN)|COMBINATION SWITCH'], ['Fuel tank cap', '(FUEL|TANK) ?(TANK ?)?(CAP|LID)|CAP,? ?(COMP,? ?)?FUEL'],
  ['Wiring harness', 'WIRING ?HARNESS|WIRE ?HARNESS|HARNESS,? ?(ASSY,? ?)?(WIRE|MAIN)|MAIN HARNESS'], ['Instrument cluster', 'INSTRUMENT CLUSTER|METER ASSY,? ?COMB|COMBINATION METER|SPEEDOMETER ASSY|CLUSTER'],
  ['CDI', '\\bC\\.?D\\.?I\\b|IGNITION CONTROL|ECU'], ['Ignition coil', 'IGNITION COIL|COIL,? ?(ASSY,? ?)?IGNITION|H\\.?T\\.? COIL'], ['Regulator rectifier', 'REGULATOR|RECTIFIER'], ['Flasher', 'FLASHER|WINKER RELAY'],
  ['Relay', 'RELAY'], ['Stator coil', 'STATOR'], ['Pickup coil', 'PICK ?UP COIL|PULSER'], ['Charging coil', 'CHARGING COIL'], ['Side stand sensor', 'SIDE ?STAND (POSITION )?(SENSOR|SWITCH)'], ['Starter motor', 'STARTER MOTOR|MOTOR,? ?(ASSY,? ?)?START'],
  ['Bearing', 'BEARING'],
  // 20o: MK Auto's kinds
  ['Hub centre combo', 'HUB CENT(RE|ER) COMBO'], ['Clutch combo', 'CLUTCH COMBO'], ['Pressure plate', 'PRESSURE PLATE'], ['Clutch inner assembly', 'INNER ASS'], ['Clutch shoe', 'CLUTCH SHOE'], ['Centrifugal clutch', 'CENTRIFUGAL'], ['Variator', 'VARIATOR'], ['Cush rubber', 'CUSH'],
  // 20n: King's kinds
  ['Lever', 'LEVER'], ['Handle yoke', 'YOKE|HOLDER,? ?(ASSY,? ?)?(LEVER|MASTER)|BRACKET,? ?(CLUTCH|BRAKE) LEVER'], ['Clutch hub', 'CLUTCH HUB|HUB,? ?CLUTCH'], ['Clutch center', 'CLUTCH CENT(ER|RE)|CENT(ER|RE),? ?(COMP,? ?)?CLUTCH'],
  ['Clutch housing', 'CLUTCH (HOUSING|OUTER)|OUTER,? ?(COMP,? ?)?CLUTCH|HOUSING,? ?CLUTCH'], ['Drum plate', 'DRUM PLATE|PANEL,? ?(COMP,? ?)?(FR|RR|FRONT|REAR)\\.? ?BRAKE|BRAKE PANEL'], ['Master cylinder', 'MASTER CYL'], ['Fuse wire', 'FUSE'], ['Lock', '\\bLOCK\\b'], ['Brake shoe', 'BRAKE SHOE|SHOE,? ?(SET|COMP|KIT)?,? ?BRAKE'], ['Clutch plate', 'CLUTCH PLATE|PLATE,? ?CLUTCH|DISC,? ?CLUTCH|FRICTION (PLATE|DISC)'],
  // 21e: Sandhar's kinds
  ['Indicator', 'INDICATOR|BLINKER'], ['Horn', '\\bHORN\\b'], ['Brake switch', '(BRAKE|STOP|CLUTCH) ?(LIGHT |LAMP )?SWITCH'], ['Handle bar switch', 'HANDLE ?BAR SWITCH|MODULAR SWITCH|UNIVERSAL SWITCH'], ['Bulb', '\\bBULBS?\\b'],
  ['Carbon brush', 'CARBON BRUSH'], ['Drive belt', 'DRIVE BELT|FAN BELT|V[- ]?BELT'], ['Swing arm', 'SWING ?ARM'], ['Weight roller', 'WEIGHT ROLL|ROLLER WEIGHT'], ['Fuel cock', 'FUEL COCK|PETROL (COCK|TAP)'],
  ['Coil plate', 'COIL PLATE'], ['Lighting coil', 'LIGHTING COIL'], ['Ignitor', 'IGNITOR'], ['Wheel cylinder kit', 'WHEEL CYL'], ['Clutch pulley', 'CLUTCH PULL(E)?Y'], ['Kick ratchet', 'RATCHET'], ['Handle bar', 'HANDLE ?BAR'], ['Rubber parts', 'RUBBER']];
const sp = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

export function mergeSuprajit(base, sup, xref) {
  const d = base && Array.isArray(base.p) ? base : { src: '', b: [], ob: [], ty: [], p: [] };
  const ty = (d.ty || []).concat(TY_SUP.filter(([n]) => !(d.ty || []).some(([m]) => m === n))), TYC = ty.map(([n, x]) => { try { return [n, new RegExp(x)]; } catch (e) { return [n, /$^/]; } });
  const tyOf = (...ss) => { for (const s of ss) { const u = String(s || '').toUpperCase(); for (const [n, x] of TYC) if (x.test(u)) return n; } return ''; };
  const BR = sp(sup.brand) || 'Suprajit', old = d.b.findIndex(b => String(b).toLowerCase() === BR.toLowerCase());
  const b = old >= 0 ? d.b.slice() : d.b.concat([BR]), bi = old >= 0 ? old : b.length - 1, ob = (d.ob || []).slice(), fit = fitter(xref);
  const p = d.p.filter(r => r[0] !== old), seen = new Set();
  for (const r of sup.rows || []) {
    const pn = sp(r.pn); if (!pn || seen.has(pn)) continue; seen.add(pn);
    const cable = r.sec === 'Control cable', nm0 = sp(r.nm), bikes = sp(r.fit || r.veh);
    const nm = (cable || nm0.toLowerCase().includes(String(r.sec || '').toLowerCase()) ? nm0 : [r.sec, nm0].filter(Boolean).join(' · ')) + (r.oldmrp ? ' · MRP of the ' + (sp(sup.oldname) || 'older') + ' list' : '');
    const fm = fit(r.mk, [bikes, sp(r.hay) || nm0].join(' , ')).map(([bn, m]) => { let i = ob.indexOf(bn); if (i < 0) { ob.push(bn); i = ob.length - 1; } return [i, m]; });
    const kind = cable ? tyOf(nm0 + ' CABLE') : r.sec === 'Lock' ? (tyOf(nm0) || 'Lock') : (tyOf(r.sec) || tyOf(nm0));
    p.push([bi, pn, nm, BR + ' ' + String(r.sec || 'part').toLowerCase(), Math.round(+r.mrp || 0), (r.mk ? r.mk + ': ' : '') + (bikes || (cable ? '' : sp(r.hay) || nm0)), (r.oem || []).map(sp).filter(Boolean), [], kind, fm, [], /^https:\/\//.test(r.img || '') ? r.img : '']);
  }
  return { ...d, src: [d.src, BR + ': its own price lists (MRP)'].filter(Boolean).join(' · '), b, ob, ty, p };
}
