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
export const BILL_KEYS = ['bills', 'stock', 'lots', 'omech', 'warranties', 'moves', 'cwl', 'wl', 'wclaims', 'ests', 'held', 'audit', 'crReq'];

function priceOf(id, get) {
  const np = (get('newProducts') || []).find(p => isObj(p) && p.id === id);
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
  const last = L.filter(isObj).slice(-1)[0]; if (last && num(last.m) === m) return null; // the newest lot is the part's own MRP: its set prices apply
  const r = get('priceRule') || {}; const pc = isFinite(parseFloat(r.c)) ? +r.c : 5, pm = isFinite(parseFloat(r.m)) ? +r.m : 15;
  const r2 = v => Math.round(v * 100) / 100;
  return { price: r2(m * (1 - pc / 100)), mp: r2(m * (1 - pm / 100)) };
}
const isoToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayOf = s => { const d = new Date(String(s) + ' ' + new Date().getFullYear()); return isNaN(d) ? null : d; };
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
  if (b.pm === 'Warranty') {
    if (num(b.amt) !== 0 || items.length !== 1 || num(items[0].r) !== 0 || num(items[0].q) !== 1) return 'warranty bill must be 1 part at Rs 0';
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
    if (!p) { want += num(it.r) * q; continue; }
    let exp = b.kind === 'mech' ? p.mp : p.price;
    // update 9i: a line from an older MRP lot of this part is priced by the Admin rule on that lot's MRP
    const lp = lotPrice(it, get); if (lp) exp = b.kind === 'mech' ? lp.mp : lp.price;
    if (exp > 0 && num(it.r) < exp - 0.5) return 'rate ' + num(it.r) + ' below the set price ' + exp + ' for ' + it.pid;
    want += Math.max(exp, num(it.r)) * q;
  }
  if (num(b.amt) < Math.round(want) - 1) return 'bill amount ' + num(b.amt) + ' below the parts total ' + Math.round(want);
  if (b.kind === 'mech' && !mgr(user)) {
    const cr = b.pm === 'Credit' ? num(b.amt) - num(b.w) : b.pm === 'Split' && isObj(b.split) ? num(b.split.Credit) : 0;
    const why = credNeed(b.p, cr, get);
    if (why) {
      const q = (get('crReq') || {})[b.crReq];
      if (!(isObj(q) && q.st === 'approved' && q.mc === b.p && cr <= num(q.amt))) return 'credit needs Manager: ' + why;
    }
  }
  return '';
}

// before the keys are written: a bad new bill refuses its whole transaction
export function checkNewBills(changes, user, get) {
  if (!user || user.role === 'admin' || !Array.isArray(changes.bills)) return [];
  const old = new Set((get('bills') || []).filter(isObj).map(b => String(b.id)));
  const out = [];
  for (const b of changes.bills) { if (isObj(b) && old.has(String(b.id))) continue; const why = badNewBill(b, changes, get, user); if (why) out.push((isObj(b) && b.id || 'bill') + ': ' + why); }
  return out;
}

const BILL_LOCK = ['amt', 'items', 'pm', 'split', 'kind', 'p', 'mob', 'w', 'iso', 'war', 'cancel'];
// 11r: a saved product's details change only through Admin (staff send a request in Approvals); photos may only go from data: to the server
const PROD_LOCK = ['name', 'pn', 'brand', 'pack', 'fits', 'warDays', 'photos'];
let photoGone = () => false; export const setPhotoGone = f => { photoGone = f; };   // 11t: server tells which /photos/ files are gone
// a part whose every photo is gone (or has none) may get new server photos from staff without Admin
const photoRetake = (o, n) => (!Array.isArray(o) || !o.length || o.every(u => photoGone(u))) && Array.isArray(n) && n.length >= 1 && n.length <= 4 && n.every(u => /^\/photos\/[a-f0-9]{32}/.test(String(u)));
// 11y (Sam 2026-10-23): staff may ADD server photos to a part (up to 4) without Admin; the photos it has stay as they are
const photoAdd = (o, n) => Array.isArray(o) && o.length && Array.isArray(n) && n.length > o.length && n.length <= 4 && o.every((u, i) => n[i] === u) && n.slice(o.length).every(u => /^\/photos\/[a-f0-9]{32}/.test(String(u)));
const photoMove = (o, n) => Array.isArray(o) && Array.isArray(n) && o.some(u => /^data:/.test(String(u))) && n.length <= o.length && n.every(u => !/^data:/.test(String(u)));
// after the merge: undo what this login may not change. Returns [value, notes]
export function guardValue(k, sv, merged, user, get) {
  if (!user || user.role === 'admin') return [merged, []];
  const notes = [];
  // the prices and credit limits the checks use: prices, offer prices and settings only Admin, mechanic limits only Manager / Admin
  if ((k === 'prices' || k === 'settings' || k === 'offers') && !deepEq(merged, sv)) { notes.push('change ' + k); return [sv, notes]; }
  if (k === 'vOver' && !mgr(user) && !deepEq(merged, sv)) { notes.push('change mechanic credit limits'); return [sv, notes]; }
  if (k === 'newProducts' && Array.isArray(merged) && Array.isArray(sv)) {
    const S = new Map(sv.filter(isObj).map(p => [String(p.id), p]));
    merged = merged.map(p => { const s = isObj(p) && S.get(String(p.id)); if (!s) return p; const bad = ['price', 'mp', 'mrp', ...PROD_LOCK].filter(f => JSON.stringify(p[f]) !== JSON.stringify(s[f]) && !(f === 'photos' && (photoMove(s[f], p[f]) || photoRetake(s[f], p[f]) || photoAdd(s[f], p[f])))); if (!bad.length) return p; notes.push('change ' + bad.join(', ') + ' of ' + p.id); const o = { ...p }; for (const f of bad) o[f] = s[f]; return o; });
  }
  if (k === 'approvals' && Array.isArray(merged)) {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(a => [String(a.id), a]));
    merged = merged.map(a => {
      if (!isObj(a)) return a; const s = S.get(String(a.id));
      const adminOnly = s && (s.po || s.pedit || (isObj(s.ret) && s.ret.need === 'admin') || num(s.pct) > 10);
      if (s && (a.st !== s.st || a.dec !== s.dec) && (!mgr(user) || adminOnly)) { notes.push('decide ' + (a.t || a.id)); return { ...a, st: s.st, dec: s.dec }; }
      if (!s && a.st !== 'pending' && (!mgr(user) || a.po || a.pedit || (isObj(a.ret) && a.ret.need === 'admin') || num(a.pct) > 10)) { notes.push('new request already decided ' + (a.t || a.id)); return { ...a, st: 'pending', dec: undefined }; }
      return a;
    });
    if (Array.isArray(sv)) { const M = new Set(merged.filter(isObj).map(a => String(a.id))); const gone = sv.filter(a => isObj(a) && !M.has(String(a.id))); if (gone.length) { notes.push('remove requests'); merged = [...merged, ...gone]; } }
  }
  if ((k === 'billReq' || k === 'crReq') && isObj(merged) && !mgr(user)) {
    const s0 = isObj(sv) ? sv : {}; merged = { ...merged };
    for (const [id, r] of Object.entries(merged)) {
      if (!isObj(r)) continue; const s = s0[id];
      if (s && (r.st !== s.st || r.ok !== s.ok)) { notes.push('decide ' + id); merged[id] = { ...r, st: s.st, ok: s.ok }; }
      else if (!s && r.st !== 'pending') { notes.push('new request already decided ' + id); merged[id] = { ...r, st: 'pending', ok: undefined }; }
    }
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
  if (k === 'grns' && Array.isArray(merged) && user.role !== 'accountant') {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(g => [String(g.id), g]));
    merged = merged.map(g => {
      if (!isObj(g)) return g; const s = S.get(String(g.id));
      // a part that waited for photos moves into the items with the rate Admin gave its waiting line
      const gone = (s && Array.isArray(s.wait) ? s.wait : []).filter(w => isObj(w) && !(Array.isArray(g.wait) ? g.wait : []).some(x => isObj(x) && x.wid === w.wid));
      const fix = (L, SL) => Array.isArray(L) ? L.map((it, i) => { if (!isObj(it)) return it; const own = (SL || []).filter(isObj); let r = own.find(x => x.pid !== undefined ? x.pid === it.pid : x.wid === it.wid);
        if (!r && it.pid !== undefined && !own.some(x => x.pid === it.pid)) { const j = gone.findIndex(w => num(w.q) === num(it.q)); if (j >= 0) r = gone.splice(j, 1)[0]; }
        const o = { ...it }; if (isObj(r) && r.rate !== undefined) o.rate = r.rate; else delete o.rate; return o; }) : L;
      const o = { ...g, items: fix(g.items, s && s.items), wait: fix(g.wait, s && s.wait) }; if (o.wait === undefined) delete o.wait; if (o.items === undefined) delete o.items; if (s && s.billAmt !== undefined) o.billAmt = s.billAmt; else delete o.billAmt; return o; });
  }
  if (k === 'waitParts' && Array.isArray(merged) && user.role !== 'accountant') {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(w => [String(w.id), w]));
    merged = merged.map(w => { if (!isObj(w)) return w; const s = S.get(String(w.id)); const o = { ...w }; if (s && s.rate !== undefined) o.rate = s.rate; else delete o.rate; return o; });
  }
  // purchase orders above the Admin's limit go to the supplier only after Admin approved them
  if (k === 'pos' && Array.isArray(merged)) {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(o => [String(o.id), o]));
    const lim = num(get('poLimit')) > 0 ? num(get('poLimit')) : 100000;
    const ok = id => (get('approvals') || []).some(a => isObj(a) && a.po === id && a.st === 'approved');
    merged = merged.map(o => {
      if (!isObj(o)) return o; const s = S.get(String(o.id)); const out = ['Sent', 'Received'];
      if (out.includes(o.status) && !(s && out.includes(s.status)) && num(o.est) > lim && !ok(o.id)) { notes.push('send ' + o.id + ' above the limit without Admin'); return { ...o, status: 'Waiting for Admin' }; }
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
