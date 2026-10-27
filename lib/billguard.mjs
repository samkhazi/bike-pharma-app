// Server checks for the Billing rules (Sam 2026-10-12 12:17Z "haan", thread "Billing profile"): the app is not trusted for these.
// 1. Price: a new bill's rates may not be below the price Admin set (customer price, or mechanic price on a mechanic bill).
// 2. Approve / Reject: only a Manager or Admin login decides a request (approvals, bill / credit requests, warranty claims);
//    a request Admin has to decide (purchase order above the limit, return above the limit) only Admin decides.
// 3. Bills already made: a non-Admin login cannot delete one or change its amount / parts / payment; only Manager or Admin cancels.
// 4. Credit above the mechanic's limit, or with an overdue bill, needs a request Manager already approved for that amount.
// 5. A Rs 0 warranty bill needs its claim: approved earlier, or the warranty still running on the server's own records.
// Admin is never checked. A new bill that fails 1, 4 or 5 is refused with everything it changed in the same sync.
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const num = v => +v || 0;
import { deepEqual as deepEq } from './merge.mjs';
const mgr = u => !!u && ['manager', 'admin'].includes(u.role);
// keys a bill changes together in one go (stock, credit, warranties, wallet, ...): refused with a refused bill
export const BILL_KEYS = ['bills', 'stock', 'lots', 'omech', 'warranties', 'moves', 'cwl', 'wl', 'wclaims', 'ests', 'held', 'audit', 'crReq', 'returns'];   // 13i: returns (exchange credit) go with their bill

// 14r: a part's mechanic price without any running offer (what purchase estimates use)
function baseMp(id, get) { const pr = (get('prices') || {})[id]; if (isObj(pr) && pr.mp != null) return num(pr.mp); let np = (get('newProducts') || []).find(p => isObj(p) && p.id === id); if (np && isObj(np._base)) np = { ...np, ...np._base }; return np ? num(np.mp) : 0; }
function priceOf(id, get) {
  let np = (get('newProducts') || []).find(p => isObj(p) && p.id === id);
  if (np && isObj(np._base)) np = { ...np, ...np._base };   // 13t: a row saved with an offer price counts at its normal price
  const pr = (get('prices') || {})[id];
  if (!np && !isObj(pr)) return null; // a part the server does not know: nothing to check against
  const p = { price: num(isObj(pr) && pr.price != null ? pr.price : np && np.price), mp: num(isObj(pr) && pr.mp != null ? pr.mp : np && np.mp) };
  // update 8q: Admin's offer price on dead stock, till its date and while the stock (before this bill) is above 0
  const o = (get('offers') || {})[id];
  if (isObj(o) && num(o.price) > 0 && String(o.till || '') >= isoToday() && num((get('stock') || {})[id]) > 0) { p.price = Math.min(p.price, num(o.price)); p.mp = Math.min(p.mp, num(o.price)); }
  return p;
}
// the Admin rule (customer MRP - c %, mechanic MRP - m %) on a lot's MRP, when the server's lots of this part have that MRP in stock
function lotPrice(it, get) {
  const m = num(it.mrp); const L = (get('lots') || {})[it.pid];
  if (!(m > 0) || !Array.isArray(L) || !L.some(l => isObj(l) && num(l.m) === m && num(l.q) > 0)) return null;
  const pr = (get('prices') || {})[it.pid], np = (get('newProducts') || []).find(x => isObj(x) && String(x.id) === String(it.pid));
  const own = isObj(pr) && num(pr.mrp) > 0 ? num(pr.mrp) : np ? num(isObj(np._base) && num(np._base.mrp) > 0 ? np._base.mrp : np.mrp) : 0;   // 14y: the part's own MRP, when the server knows it
  if (own > 0) { if (Math.abs(own - m) < 0.005) return null; }
  else { const last = L.filter(isObj).slice(-1)[0]; if (last && num(last.m) === m) return null; } // the newest lot is the part's own MRP: its set prices apply
  const r = get('priceRule') || {}; const pc = isFinite(parseFloat(r.c)) ? +r.c : 5, pm = isFinite(parseFloat(r.m)) ? +r.m : 15;
  const r2 = v => Math.round(v * 100) / 100;
  return { price: r2(m * (1 - pc / 100)), mp: r2(m * (1 - pm / 100)) };
}
const isoToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// 13j: "DD Mon YYYY" as written; "DD Mon" in this year, or the last one when that is more than 60 days ahead (same as the app's dmDate)
const dayOf = s => { s = String(s || '').replace('Sept', 'Sep'); let d; if (/\d{4}$/.test(s.trim())) d = new Date(s); else { const n = new Date(), y = n.getFullYear(); d = new Date(s + ' ' + y); if (!isNaN(d) && d - n > 60 * 864e5) d = new Date(s + ' ' + (y - 1)); } return isNaN(d) ? null : d; };
const todayD = () => new Date(new Date().toDateString());
function credNeed(code, amt, get) {
  if (!code || !(amt > 0)) return '';
  const rows = ((get('omech') || {})[code] || []).filter(isObj);
  const od = rows.filter(v => num(v.amt) > num(v.paid) && v.due && dayOf(v.due) && dayOf(v.due) < todayD()).length;
  if (od) return od + ' overdue bill(s)';
  const vo = (get('vOver') || {})[code];
  const acc = Object.values(get('accounts') || {}).find(a => isObj(a) && a.role === 'mechanic' && a.code === code && a.status === 'active');
  const limit = isObj(vo) ? (vo.none ? null : num(vo.limit)) : acc ? 25000 : null;
  const due = rows.reduce((s, v) => s + num(v.amt) - num(v.paid), 0);
  return limit != null && due + amt > limit ? 'outstanding ' + due + ' + ' + amt + ' above limit ' + limit : '';
}
function warRunning(w) {
  if (!isObj(w) || !w.start) return false;
  const end = new Date(w.start); end.setDate(end.getDate() + num(w.days));
  return !isNaN(end) && end >= todayD();
}

// a new bill: returns '' when fine, else why it is refused
function badNewBill(b, changes, get, user) {
  if (!isObj(b)) return 'not a bill';
  const items = Array.isArray(b.items) ? b.items : [];
  if (num(b.w) < 0 || num(b.exch) < 0) return 'wallet or exchange amount below 0';
  if (b.pm === 'Warranty') {
    if (num(b.amt) !== 0 || num(b.exch) || num(b.w) || items.length !== 1 || num(items[0].r) !== 0 || num(items[0].q) !== 1) return 'warranty bill must be 1 part at Rs 0';
    const sv = (get('wclaims') || []).find(c => isObj(c) && c.id === b.war);
    const cv = (Array.isArray(changes.wclaims) ? changes.wclaims : []).find(c => isObj(c) && c.id === b.war);
    const c = cv || sv; if (!c || c.pid !== items[0].pid) return 'no warranty claim for this part';
    if (mgr(user) || (sv && sv.st === 'Approved')) return '';
    const w = (get('warranties') || []).find(x => isObj(x) && x.id === c.w);
    return warRunning(w) ? '' : 'warranty over and the claim is not approved';
  }
  let want = 0;
  for (const it of items) {
    const p = priceOf(it.pid, get); const q = num(it.q);
    if (!Number.isInteger(q) || q < 1 || num(it.r) < 0) return 'bad qty or rate for ' + it.pid;   // 13e: a minus line lowered the total
    if (!p) { want += num(it.r) * q; continue; }
    let exp = b.kind === 'mech' ? p.mp : p.price;
    // update 9i: a line from an older MRP lot of this part is priced by the Admin rule on that lot's MRP
    const lp = lotPrice(it, get); if (lp) exp = b.kind === 'mech' ? lp.mp : lp.price;
    if (exp > 0 && num(it.r) < exp - 0.5) return 'rate ' + num(it.r) + ' below the set price ' + exp + ' for ' + it.pid;
    want += Math.max(exp, num(it.r)) * q;
  }
  if (num(b.amt) < Math.round(want) - 1) return 'bill amount ' + num(b.amt) + ' below the parts total ' + Math.round(want);
  // 13i: exchange credit only from an open exchange return (once) or the Change-cancelled bill a corrected bill replaces
  if (num(b.exch) > 0) {
    const others = [...(get('bills') || []), ...(changes.bills || [])].filter(o => isObj(o) && o !== b && o.id !== b.id);
    if (b.exchRef) {
      const r = (get('returns') || []).find(x => isObj(x) && x.id === b.exchRef);
      let rn = !r && mgr(user) && (changes.returns || []).find(x => isObj(x) && x.id === b.exchRef && x.mode === 'Exchange');   // 13l: the return made in this same sync (offline)
      if (rn) { const CR = Array.isArray(changes.returns) ? changes.returns : [], rb = exBill(rn.bill, get, changes.bills), all = retAll(get, CR); if (!rb || rb.cancel || (num(rn.tot) || num(rn.amt)) > num(rb.amt) - exTook(all, rn) + 0.5) rn = null; }   /* 14j: the same cap the returns guard puts on it */
      if (!(r && num(b.exch) <= num(r.exOpen) + 0.5) && !(rn && num(b.exch) <= num(rn.amt) + 0.5)) return 'exchange credit ' + num(b.exch) + ' not open on ' + b.exchRef;
      if (others.some(o => o.exchRef === b.exchRef)) return 'exchange credit ' + b.exchRef + ' already used';
    } else if (b.rebillOf) {
      const os = (get('bills') || []).find(o => isObj(o) && o.id === b.rebillOf), oc = (changes.bills || []).find(o => isObj(o) && o.id === b.rebillOf);
      const ob = os && os.cancel ? os : oc && os && sameBill(os, oc) ? oc : os;   // 13l: cancelled in this same sync
      if (!ob || !ob.cancel || ob.cancel.type !== 'Change' || num(b.exch) > exLeftOf(ob, get, changes.returns) + 0.5) return 'exchange credit not from ' + b.rebillOf;
      if (others.some(o => o.rebillOf === b.rebillOf && num(o.exch) > 0)) return 'exchange credit of ' + b.rebillOf + ' already used';
    } else return 'exchange credit without a return';
  }
  if (b.kind === 'mech' && !mgr(user)) {
    const cr = b.pm === 'Credit' ? num(b.amt) - num(b.w) : b.pm === 'Split' && isObj(b.split) ? num(b.split.Credit) : 0;
    const acc = isObj(get('accounts')) ? get('accounts')[b.mob] : null; const mc = isObj(acc) && acc.code ? acc.code : b.p;   // 13e: the real code, not the one the app sent
    const why = credNeed(mc, cr, get);
    if (why) {
      const q = (get('crReq') || {})[b.crReq];
      if (!(isObj(q) && q.st === 'approved' && q.mc === mc && cr <= num(q.amt))) return 'credit needs Manager: ' + why;
      // 13f: one approved request covers one bill
      const twice = (get('bills') || []).some(o => isObj(o) && o.crReq === b.crReq && o.id !== b.id) || (changes.bills || []).some(o => isObj(o) && o !== b && o.crReq === b.crReq && o.id !== b.id);
      if (twice) return 'credit request ' + b.crReq + ' was already used on another bill';
    }
  }
  return '';
}

// before the keys are written: a bad new bill refuses its whole transaction
// 13l: two counters can pick the same bill number before they see each other's bill. The later one gets the next free
// number here, in every key of its sync (omech, warranties, wallet rows, moves...), before anything is checked or merged.
const sameBill = (o, b) => o.u && b.u ? o.u === b.u : String(o.by || '') === String(b.by || '') && String(o.t || '') === String(b.t || '') && String(o.iso || '') === String(b.iso || '');   // u: each bill's own token
// baseIds: id -> bill as this client had already seen it (the value at its base rev): the same bill there is an edit, not a clash (the value at its base rev): those are edits, not clashes
export function renumBills(changes, get, baseIds) {
  const out = { renamed: [], keys: new Set() };
  if (!Array.isArray(changes.bills)) return out;
  const oldM = new Map((get('bills') || []).filter(isObj).map(b => [String(b.id), b]));
  const ids = new Set([...oldM.keys(), ...changes.bills.filter(isObj).map(b => String(b.id))]);
  for (const b of changes.bills) {
    const o = isObj(b) && oldM.get(String(b.id)); if (!o || sameBill(o, b) || (baseIds && baseIds.has(String(b.id)) && sameBill(baseIds.get(String(b.id)), b))) continue;
    const m = /^(.*?)(\d+)$/.exec(String(b.id)); if (!m) continue;
    let n = Math.max(0, ...[...ids].map(x => x.startsWith(m[1]) && /^\d+$/.test(x.slice(m[1].length)) ? +x.slice(m[1].length) : 0)) + 1;
    const nid = m[1] + String(n).padStart(m[2].length, '0'); ids.add(nid); out.renamed.push([String(b.id), nid]);
  }
  for (const [a, z] of out.renamed) {
    const re = new RegExp('(?<![\\w])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\d)', 'g');
    for (const k of Object.keys(changes)) {
      let j; try { j = JSON.stringify(changes[k]); } catch (e) { continue; }
      if (typeof j !== 'string' || !re.test(j)) continue; re.lastIndex = 0;
      changes[k] = JSON.parse(j.replace(re, z)); out.keys.add(k);
    }
  }
  return out;
}

export function checkNewBills(changes, user, get) {
  if (!user || !Array.isArray(changes.bills)) return [];
  const oldM = new Map((get('bills') || []).filter(isObj).map(b => [String(b.id), b])), old = new Set(oldM.keys());
  const out = [];
  if (user.role === 'admin') return out;
  for (const b of changes.bills) { if (isObj(b) && old.has(String(b.id))) continue; const why = badNewBill(b, changes, get, user); if (why) out.push((isObj(b) && b.id || 'bill') + ': ' + why); }
  return out;
}

const BILL_LOCK = ['amt', 'items', 'pm', 'split', 'kind', 'p', 'mob', 'w', 'exch', 'exchRef', 'rebillOf', 'iso', 'war', 'cancel', 'crReq'];
// 11r: a saved product's details change only through Admin (staff send a request in Approvals); photos may only go from data: to the server
const PROD_LOCK = ['name', 'pn', 'brand', 'pack', 'fits', 'warDays', 'photos'];
let photoGone = () => false; export const setPhotoGone = f => { photoGone = f; };   // 11t: server tells which /photos/ files are gone
// a part whose every photo is gone (or has none) may get new server photos from staff without Admin
const photoRetake = (o, n) => (!Array.isArray(o) || !o.length || o.every(u => photoGone(u))) && Array.isArray(n) && n.length >= 1 && n.length <= 4 && n.every(u => /^\/photos\/[a-f0-9]{32}/.test(String(u)));
// 11y (Sam 2026-10-23): staff may ADD server photos to a part (up to 4) without Admin; the photos it has stay as they are
const photoAdd = (o, n) => Array.isArray(o) && o.length && Array.isArray(n) && n.length > o.length && n.length <= 4 && o.every((u, i) => n[i] === u) && n.slice(o.length).every(u => /^\/photos\/[a-f0-9]{32}/.test(String(u)));
const photoMove = (o, n) => Array.isArray(o) && Array.isArray(n) && o.some(u => /^data:/.test(String(u))) && n.length <= o.length && n.every(u => !/^data:/.test(String(u)));
// after the merge: undo what this login may not change. Returns [value, notes]
// 13t: a posted stock-in (GRN) line with this MRP for the part, and the selling prices from Admin's % rule: Inventory may set these
// 13v: only Inventory / Manager, and only a GRN this same sync posts (it was not posted on the server before)
function grnLines(pid, get, inc, user) {
  if (!user || !['inventory', 'manager'].includes(user.role) || !inc || !Array.isArray(inc.grns)) return [];
  const was = new Map((Array.isArray(get('grns')) ? get('grns') : []).filter(isObj).map(g => [String(g.id), g]));
  return inc.grns.filter(g => isObj(g) && g.status === 'posted' && (was.get(String(g.id)) || {}).status !== 'posted')
    .flatMap(g => [...(Array.isArray(g.items) ? g.items : []), ...(Array.isArray(g.nw) ? g.nw : [])]).filter(it => isObj(it) && it.pid === pid)
    .concat(inc.grns.flatMap(g => {   // 14n: a waiting part finished on a bill already posted, with the waiting line's own MRP / tax
      const s = isObj(g) && was.get(String(g.id)); if (!s || s.status !== 'posted' || g.status !== 'posted') return [];
      const W = (Array.isArray(s.wait) ? s.wait : []).filter(w => isObj(w) && !(Array.isArray(g.wait) ? g.wait : []).some(x => isObj(x) && x.wid === w.wid));
      return (Array.isArray(g.items) ? g.items : []).filter(it => isObj(it) && it.pid === pid && it.wid !== undefined).flatMap(it => { const w = W.find(x => x.wid === it.wid); return w ? [{ ...it, bmrp: w.bmrp ?? it.bmrp, hsn: w.hsn ?? it.hsn, gst: w.gst ?? it.gst }] : []; });
    }));
}
function grnPriceOk(pid, v, get, inc, user) {
  if (!isObj(v)) return false; const m = num(v.mrp); if (!(m > 0)) return false;
  if (!grnLines(pid, get, inc, user).some(it => Math.abs(num(it.bmrp) - m) < 0.01)) return false;
  const r = isObj(get('priceRule')) ? get('priceRule') : {}, c = isFinite(parseFloat(r.c)) ? +r.c : 5, mm = isFinite(parseFloat(r.m)) ? +r.m : 15, r2 = x => Math.round(x * 100) / 100;
  return Math.abs(num(v.price) - r2(m * (1 - c / 100))) < 0.01 && Math.abs(num(v.mp) - r2(m * (1 - mm / 100))) < 0.01;
}
// 14j: what an exchange return may give: its bill (the server's copy first) not cancelled, less what other returns of that bill took
// 14q: a Change-cancelled bill's exchange credit still left: its exch less the share its returns already paid out
// 14r: the server's saved returns, plus only the rows it does not have yet (a client cannot lower a saved one here)
function retAll(get, inc) { const S = (get('returns') || []).filter(isObj), sid = new Set(S.map(x => String(x.id))); return [...S, ...(Array.isArray(inc) ? inc : []).filter(x => isObj(x) && !sid.has(String(x.id)))]; }
function exLeftOf(ob, get, inc) { const R = retAll(get, inc); return Math.max(0, num(ob.exch) - R.filter(x => isObj(x) && x.bill === ob.id && !String(x.id).startsWith('C-')).reduce((t, x) => t + num(x.ex), 0)); }
function exBill(id, get, nb) { return (get('bills') || []).find(b => isObj(b) && b.id === id) || (Array.isArray(nb) ? nb : []).find(b => isObj(b) && b.id === id); }
function exTook(rows, r) { return rows.filter(x => isObj(x) && x !== r && x.id !== r.id && x.bill === r.bill && !String(x.id).startsWith('C-') && !/-[RX]$/.test(String(x.id))).reduce((t, x) => t + (num(x.tot) || num(x.amt)), 0); }   /* 14m: with its wallet share */
export function guardValue(k, sv, merged, user, get, inc) {
  if (!user || user.role === 'admin') return [merged, []];
  const notes = [];
  if (k === 'prices' && isObj(merged) && !deepEq(merged, sv)) {   // 13t: only a part whose new prices come from a posted supplier bill
    const s0 = isObj(sv) ? sv : {}, out = {}; let took = 0;
    for (const [pid, v] of Object.entries(merged)) { if (deepEq(v, s0[pid])) { out[pid] = v; continue; } const o = isObj(s0[pid]) ? s0[pid] : {}; const extra = Object.keys({ ...o, ...(isObj(v) ? v : {}) }).filter(f => !['mrp', 'price', 'mp', 'hsn', 'gst'].includes(f) && !deepEq(o[f], v && v[f]));
      const priced = ['mrp', 'price', 'mp'].some(f => !deepEq(o[f], v && v[f])), L = grnLines(pid, get, inc, user);
      const taxOk = ['hsn', 'gst'].every(f => deepEq(o[f], v && v[f]) || L.some(it => String(it[f]) === String(v[f]) || (f === 'gst' && String(+it[f]) === String(v[f]))));
      if (!extra.length && taxOk && (!priced || grnPriceOk(pid, { ...o, ...v }, get, inc, user))) { out[pid] = v; took++; } else { notes.push('change prices of ' + pid); if (pid in s0) out[pid] = s0[pid]; } }
    for (const pid of Object.keys(s0)) if (!(pid in out)) { out[pid] = s0[pid]; if (!(pid in merged)) notes.push('change prices of ' + pid); }
    return [took ? out : sv, notes];
  }
  // the prices and credit limits the checks use: prices, offer prices and settings only Admin, mechanic limits only Manager / Admin
  if ((k === 'prices' || k === 'settings' || k === 'offers') && !deepEq(merged, sv)) { notes.push('change ' + k); return [sv, notes]; }
  // 13e: a lower-MRP lot lowers the bill price floor, so a Billing login can't bring in an MRP the part never had (returns use the bill's own MRPs)
  if (k === 'lots' && user.role === 'billing' && isObj(merged)) {
    const s0 = isObj(sv) ? sv : {}, bills = (get('bills') || []).filter(isObj); merged = { ...merged };
    for (const [pid, L] of Object.entries(merged)) {
      if (!Array.isArray(L)) continue;
      const pr = (get('prices') || {})[pid], np = (get('newProducts') || []).find(p => isObj(p) && p.id === pid);
      const known = new Set([...(Array.isArray(s0[pid]) ? s0[pid] : []).filter(isObj).map(l => num(l.m)), num(isObj(pr) ? pr.mrp : 0), num(isObj(np) ? np.mrp : 0)]);
      for (const b of bills) for (const it of Array.isArray(b.items) ? b.items : []) if (isObj(it) && it.pid === pid) known.add(num(it.mrp));
      known.delete(0); const top = Math.max(0, ...known);
      if (L.some(l => isObj(l) && num(l.q) > 0 && !known.has(num(l.m)) && num(l.m) < top)) { notes.push('new MRP lot for ' + pid); if (pid in s0) merged[pid] = s0[pid]; else delete merged[pid]; }
    }
  }
  if (k === 'vOver' && !mgr(user) && !deepEq(merged, sv)) { notes.push('change mechanic credit limits'); return [sv, notes]; }
  if (k === 'newProducts' && Array.isArray(merged)) {   // 13z: no list on the server yet counts as empty
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(p => [String(p.id), isObj(p._base) ? { ...p, ...p._base } : p]));   // 13s: an older row saved with an offer price counts at its normal price
    const rule = (() => { const r = isObj(get('priceRule')) ? get('priceRule') : {}; return { c: isFinite(parseFloat(r.c)) ? +r.c : 5, m: isFinite(parseFloat(r.m)) ? +r.m : 15 }; })(), r2 = x => Math.round(x * 100) / 100;
    // 13y: a new product from a non-Admin login gets its selling prices from its MRP by Admin's % rule, as the app does
    merged = merged.map(p => { const s = isObj(p) && S.get(String(p.id)); if (!s) { if (!isObj(p) || !(num(p.mrp) > 0)) return p; const price = r2(num(p.mrp) * (1 - rule.c / 100)), mp = r2(num(p.mrp) * (1 - rule.m / 100)); if (Math.abs(num(p.price) - price) < 0.01 && Math.abs(num(p.mp) - mp) < 0.01) return p; notes.push('set prices of new part ' + p.id); return { ...p, price, mp }; } const gp = grnPriceOk(p.id, p, get, inc, user); const bad = ['price', 'mp', 'mrp', ...PROD_LOCK].filter(f => JSON.stringify(p[f]) !== JSON.stringify(s[f]) && !(gp && ['price', 'mp', 'mrp'].includes(f)) && !(f === 'photos' && (photoMove(s[f], p[f]) || photoRetake(s[f], p[f]) || photoAdd(s[f], p[f])))); if (!bad.length) return p; notes.push('change ' + bad.join(', ') + ' of ' + p.id); const o = { ...p }; for (const f of bad) o[f] = s[f]; return o; });
    if (Array.isArray(sv)) { const M = new Set(merged.filter(isObj).map(p => String(p.id))); const gone = sv.filter(p => isObj(p) && !M.has(String(p.id))); if (gone.length) { notes.push('remove products'); merged = [...merged, ...gone]; } }   /* 14r: a part's price check stays */
  }
  if (k === 'approvals' && Array.isArray(merged)) {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(a => [String(a.id), a]));
    merged = merged.map(a => {
      if (!isObj(a)) return a; const s = S.get(String(a.id));
      if (s) { const fix = ['po', 'pedit', 'ret', 'pct', 'disc', 'kyc', 'br', 'cr', 'wcl', 'move', 't', 'd', 'est'].filter(f => JSON.stringify(a[f]) !== JSON.stringify(s[f])); if (fix.length) { notes.push('change ' + fix.join(', ') + ' of request ' + (a.t || a.id)); a = { ...a }; for (const f of fix) { if (s[f] === undefined) delete a[f]; else a[f] = s[f]; } } }   /* 14g: only the decision of a saved request may change */
      const retAdm = x => isObj(x.ret) && (x.ret.need === 'admin' || num(x.ret.amt) > (num(get('retLimit')) > 0 ? num(get('retLimit')) : 5000));   /* 14t: the limit, not the app's flag */
      const adminOnly = s && (s.po || s.pedit || retAdm(s) || num(s.pct) > 10);
      if (s && (a.st !== s.st || a.dec !== s.dec) && (!mgr(user) || adminOnly || s.st !== 'pending'))   /* 14j: a decided request stays decided */ { notes.push('decide ' + (a.t || a.id)); return { ...a, st: s.st, dec: s.dec }; }
      if (!s && a.st !== 'pending' && (!mgr(user) || a.po || a.pedit || retAdm(a) || num(a.pct) > 10)) { notes.push('new request already decided ' + (a.t || a.id)); return { ...a, st: 'pending', dec: undefined }; }
      return a;
    });
    if (Array.isArray(sv)) { const M = new Set(merged.filter(isObj).map(a => String(a.id))); const gone = sv.filter(a => isObj(a) && !M.has(String(a.id))); if (gone.length) { notes.push('remove requests'); merged = [...merged, ...gone]; } }
  }
  if ((k === 'billReq' || k === 'crReq') && isObj(merged) && !mgr(user)) {
    const s0 = isObj(sv) ? sv : {}; merged = { ...merged };
    for (const [id, r] of Object.entries(merged)) {
      if (!isObj(r)) continue; const s = s0[id];
      if (s) { const fix = ['amt', 'mc', 'bill', 'type'].filter(f => JSON.stringify(r[f]) !== JSON.stringify(s[f])); if (fix.length) { notes.push('change ' + fix.join(', ') + ' of ' + id); const o = { ...r }; for (const f of fix) { if (s[f] === undefined) delete o[f]; else o[f] = s[f]; } merged[id] = o; } }   /* 14h: what a saved request asks for stays as asked */
      if (s && (merged[id].st !== s.st || merged[id].ok !== s.ok)) { notes.push('decide ' + id); merged[id] = { ...merged[id], st: s.st, ok: s.ok }; }
      else if (!s && r.st !== 'pending') { notes.push('new request already decided ' + id); merged[id] = { ...r, st: 'pending', ok: undefined }; }
    }
  }
  // 14h: a saved return keeps what it gave back (its open exchange credit only goes down); a new exchange return is at most what its bill still holds
  if (k === 'returns' && Array.isArray(merged) && !mgr(user)) {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(r => [String(r.id), r]));
    const bill = id => exBill(id, get, inc && inc.bills);   /* 14j: the server's bill first */
    const Si = new Set((Array.isArray(sv) ? sv : []).filter(isObj).map(r => String(r.id))), all = [...(Array.isArray(sv) ? sv : []).filter(isObj), ...merged.filter(r => isObj(r) && !Si.has(String(r.id)))];   /* 14r: saved rows as the server has them */
    const out = [];
    for (const r of merged) {
      if (!isObj(r)) { out.push(r); continue; } const s = S.get(String(r.id));
      if (s) { const fix = ['amt', 'mode', 'bill', 'items', 'w', 'ex', 'tot'].filter(f => JSON.stringify(r[f]) !== JSON.stringify(s[f])); let o = r; if (fix.length) { notes.push('change ' + fix.join(', ') + ' of ' + r.id); o = { ...r }; for (const f of fix) { if (s[f] === undefined) delete o[f]; else o[f] = s[f]; } } if (num(o.exOpen) > num(s.exOpen) + 0.005) { notes.push('raise exchange credit of ' + r.id); o = { ...o, exOpen: s.exOpen }; } out.push(o); continue; }
      if (r.mode !== 'Exchange') {   /* 14o: a non-Manager login's only own refund row is a new bill's leftover exchange credit (returns go through Manager) */
        const nb = (inc && Array.isArray(inc.bills) ? inc.bills : []).find(b => isObj(b) && String(r.id) === b.id + '-X' && b.id === r.bill), was = nb && (get('bills') || []).some(b => isObj(b) && b.id === nb.id);
        const credit = !nb ? 0 : nb.exchRef ? (() => { const sr = (get('returns') || []).find(x => isObj(x) && x.id === nb.exchRef); return sr ? num(sr.exOpen) : 0; })() : nb.rebillOf ? exLeftOf((get('bills') || []).find(o => isObj(o) && o.id === nb.rebillOf) || {}, get, merged) : 0;   /* 14p: what the credit was before this bill, not the bill's capped exch */
        if (!nb || was || num(nb.exch) < num(nb.amt) - 0.5 || num(r.amt) > credit - num(nb.amt) + 0.5) { notes.push('refund ' + r.id + ' without approval'); continue; }
      }
      if (r.mode === 'Exchange' || String(r.id).startsWith('C-')) { notes.push('return ' + r.id + ' without approval'); continue; }   /* 14u: a new exchange return is made only on a Manager / Admin device */
      out.push(r);
    }
    if (Array.isArray(sv)) { const M = new Set(out.filter(isObj).map(r => String(r.id))); const gone = sv.filter(r => isObj(r) && !M.has(String(r.id))); if (gone.length) { notes.push('remove returns'); out.push(...gone); } }
    merged = out;
  }
  if (k === 'wclaims' && Array.isArray(merged) && !mgr(user)) {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(c => [String(c.id), c]));
    merged = merged.map(c => {
      if (!isObj(c)) return c; const s = S.get(String(c.id));
      if (s) {
        const ok = c.st === s.st || (s.st === 'Approved' && c.st === 'Replaced');
        if (!ok || c.old !== s.old && !(s.st === 'Approved' && c.st === 'Replaced')) { notes.push('change claim ' + c.id); return { ...c, st: s.st, ok: s.ok, old: s.old, rep: s.rep }; }
      } else if (c.st !== 'Waiting' && !warRunning((get('warranties') || []).find(x => isObj(x) && x.id === c.w))) { notes.push('claim ' + c.id + ' given without approval, warranty over'); return { ...c, st: 'Waiting', ok: undefined, rep: undefined }; }
      return c;
    });
  }
  // update 9c: the audit log only grows; no staff login but Admin removes or edits its rows
  if (k === 'audit' && Array.isArray(sv)) {
    const M = Array.isArray(merged) ? merged.slice() : []; const left = M.map(r => JSON.stringify(r)); let lost = 0;
    for (const r of sv) { const i = left.indexOf(JSON.stringify(r)); if (i >= 0) left[i] = null; else { M.push(r); lost++; } }
    if (lost) notes.push('remove ' + lost + ' audit row(s)');
    merged = M;
  }
  // stock: the Accountant does not move stock; nobody but Admin removes a part's stock line
  if (k === 'stock' && isObj(sv) && !deepEq(merged, sv)) {
    if (user.role === 'accountant') { notes.push('change stock'); return [sv, notes]; }
    const M = isObj(merged) ? { ...merged } : {}; let lost = 0;
    for (const id of Object.keys(sv)) if (!(id in M)) { M[id] = sv[id]; lost++; }
    for (const id of Object.keys(M)) if (!(num(M[id]) >= 0)) M[id] = isObj(sv) && id in sv ? sv[id] : 0;
    if (lost) notes.push('remove ' + lost + ' stock line(s)');
    merged = M;
  }
  // purchase rates: only Admin and Accountant enter them (the others do not even see them)
  if (k === 'grns' && Array.isArray(merged)) {   /* 14t: the Accountant enters rates, but a posted bill stays locked for them too */
    const acc = user.role === 'accountant';
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(g => [String(g.id), g]));
    merged = merged.map(g => {
      if (!isObj(g)) return g; const s = S.get(String(g.id));
      // a part that waited for photos moves into the items with the rate Admin gave its waiting line
      const gone = (s && Array.isArray(s.wait) ? s.wait : []).filter(w => isObj(w) && !(Array.isArray(g.wait) ? g.wait : []).some(x => isObj(x) && x.wid === w.wid));
      const goneW = new Set(gone.map(w => w.wid).filter(x => x !== undefined));
      const fix = (L, SL) => { if (!Array.isArray(L)) return L; const pool = (Array.isArray(SL) ? SL : []).filter(isObj); return L.map((it, i) => { if (!isObj(it)) return it; const own = (SL || []).filter(isObj); const k2 = x => x.nk !== undefined ? 'n' + x.nk : x.wid !== undefined ? 'w' + x.wid : x.pid !== undefined ? 'p' + x.pid : x.k !== undefined ? 'k' + x.k : null; const j0 = pool.findIndex(x => k2(x) !== null && k2(x) === k2(it)); let r = j0 >= 0 ? pool.splice(j0, 1)[0] : undefined;   // 14k: one server line per line, by new-part key, waiting id, then part
        if (!r && it.nk !== undefined) r = (s && Array.isArray(s.nw) ? s.nw : []).find(n => isObj(n) && n.k === it.nk);   // a new-part line just posted keeps the draft's rate
        if (!r && it.pid !== undefined) { let j = it.wid !== undefined ? gone.findIndex(w => w.wid === it.wid) : -1; if (j < 0 && !own.some(x => x.pid === it.pid)) j = gone.findIndex(w => num(w.q) === num(it.q));   /* 14l: by its waiting line even when the part is already on the bill */ /* 14e: by the waiting line first */ if (j >= 0) r = gone.splice(j, 1)[0]; }
        const o = { ...it }; for (const f of ['rate', 'lr', 'disc']) { if (isObj(r) && r[f] !== undefined) o[f] = r[f]; else delete o[f]; } return o; }); };   // 14c
      const o = acc ? { ...g } : { ...g, items: fix(g.items, s && s.items), wait: fix(g.wait, s && s.wait), nw: fix(g.nw, s && s.nw) }; if (!acc) { for (const f of ['wait', 'items', 'nw']) if (o[f] === undefined) delete o[f]; for (const f of ['billAmt', 'tax', 'bdisc', 'round', 'pays']) { if (s && s[f] !== undefined) o[f] = s[f]; else delete o[f]; } }
      if (s && s.status === 'posted') {   /* 14j: a posted supplier bill keeps what went into stock; only finished waiting parts join it */
        for (const f of ['status', 'supplier', 'inv']) { if (s[f] === undefined) delete o[f]; else o[f] = s[f]; }
        const SI = (Array.isArray(s.items) ? s.items : []).filter(isObj), OI = (Array.isArray(o.items) ? o.items : []).filter(isObj), same = (x, y) => x.nk !== undefined || y.nk !== undefined ? x.nk === y.nk && x.pid === y.pid : x.wid !== undefined || y.wid !== undefined ? x.wid === y.wid : x.pid === y.pid;
        const left = OI.slice(), items = SI.map(si => { const j = left.findIndex(x => same(si, x)); const oi = j >= 0 ? left.splice(j, 1)[0] : null; return oi ? { ...oi, pid: si.pid, q: si.q } : si; });   /* 14k: one to one */
        for (const oi of left) if (oi.wid !== undefined && goneW.has(oi.wid)) items.push(oi);
        if (JSON.stringify(items) !== JSON.stringify(o.items) || ['status', 'supplier', 'inv'].some(f => JSON.stringify(g[f]) !== JSON.stringify(s[f]))) notes.push('change posted supplier bill ' + s.id);
        o.items = items;
      }
      return o; });   // 14e: supplier payments only by Admin / Accountant
    if (Array.isArray(sv)) { const M = new Set(merged.filter(isObj).map(g => String(g.id))); const lost = sv.filter(g => isObj(g) && g.status === 'posted' && !M.has(String(g.id))); if (lost.length) { notes.push('remove supplier bills'); merged = [...merged, ...lost]; } }
  }
  if (k === 'waitParts' && Array.isArray(merged) && user.role !== 'accountant') {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(w => [String(w.id), w]));
    merged = merged.map(w => { if (!isObj(w)) return w; const s = S.get(String(w.id)); const o = { ...w }; for (const f of ['rate', 'lr', 'disc']) { if (s && s[f] !== undefined) o[f] = s[f]; else delete o[f]; } return o; });   // 14e
  }
  // purchase orders above the Admin's limit go to the supplier only after Admin approved them
  if (k === 'pos' && Array.isArray(merged)) {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(o => [String(o.id), o]));
    const lim = num(get('poLimit')) > 0 ? num(get('poLimit')) : 100000;
    const ok = (id, est) => (get('approvals') || []).some(a => isObj(a) && a.po === id && a.st === 'approved' && (a.est === undefined || est <= num(a.est) + 1));   /* 14o: approved for at least this amount */
    merged = merged.map(o => {
      if (!isObj(o)) return o; const s = S.get(String(o.id)); const out = ['Sent', 'Received'];
      const est = Math.max(num(o.est), (Array.isArray(o.items) ? o.items : []).reduce((t, i) => { const p = isObj(i) && baseMp(i.pid, get); return t + (p ? Math.round(p * 0.85) * num(i.q) : 0); }, 0));   /* 14g: worked out here too, not only from what the device says */
      if (s && (out.includes(s.status) || s.status === 'Waiting for Admin') && (JSON.stringify(o.items) !== JSON.stringify(s.items) || num(o.est) !== num(s.est) || (out.includes(s.status) && !out.includes(o.status)))) { notes.push('change sent ' + o.id); return { ...o, items: s.items, est: s.est, ...(out.includes(s.status) && !out.includes(o.status) ? { status: s.status } : {}) }; }   /* 14n/14o: a sent or waiting order keeps what was sent; a sent one stays sent */
      if (out.includes(o.status) && !(s && out.includes(s.status)) && est > lim && !ok(o.id, est)) { notes.push('send ' + o.id + ' above the limit without Admin'); return { ...o, status: s ? s.status : 'Draft' };   /* 14h: back as it was, so Send asks Admin with a request */ }
      return o;
    });
  }
  if (k === 'bills' && Array.isArray(merged) && Array.isArray(sv)) {
    const M = new Map(merged.filter(isObj).map(b => [String(b.id), b]));
    const keep = []; let n = 0;
    for (const s of sv) { if (isObj(s) && !M.has(String(s.id))) { keep.push(s); n++; } }
    merged = merged.map(b => {
      if (!isObj(b)) return b; const s = sv.find(x => isObj(x) && String(x.id) === String(b.id)); if (!s) return b;
      const lock = mgr(user) ? BILL_LOCK.filter(f => f !== 'cancel') : BILL_LOCK;
      const bad = lock.filter(f => JSON.stringify(b[f]) !== JSON.stringify(s[f]));
      if (!bad.length) return b;
      notes.push('change bill ' + b.id + ' (' + bad.join(', ') + ')'); const o = { ...b }; for (const f of bad) { if (s[f] === undefined) delete o[f]; else o[f] = s[f]; } return o;
    });
    if (n) { notes.push('delete ' + n + ' bill(s)'); merged = [...merged, ...keep]; }
  }
  return [merged, notes];
}

// one audit row per refusal, the way the app writes them
export function auditRows(user, notes) {
  const now = new Date();
  const t = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return notes.slice(0, 20).map(n => ({ who: (user.name || user.id) + ' (' + user.role + ')', a: 'Refused by server', e: String(n).slice(0, 160), o: '—', n: 'Not saved', t }));
}
