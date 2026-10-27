// Server checks for what customers and mechanics write (update 9c, from the 10-pass review):
// the app is not trusted for money, stock or order status.
// - orders: a new online order must use the shop's prices and fit the shop's stock; it starts as Confirmed and the
//   server takes its parts out of stock. An order already placed cannot be changed from the app.
// - cwl (wallet): money can only be spent from the app; the one credit allowed is the cashback of an order placed
//   in the same sync, at the shop's cashback rate. Earlier wallet rows cannot be changed or removed.
// - warranties: only for the parts of an order placed in the same sync; earlier rows cannot be changed.
// - sorders (part orders): a new one has no advance and the shop's price; earlier rows cannot be changed.
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = v => +v || 0;
const J = v => JSON.stringify(v);

function priceOf(id, get) {
  const pr = (get('prices') || {})[id];
  if (isObj(pr) && pr.price != null) return num(pr.price);
  const np = (get('newProducts') || []).find(p => isObj(p) && p.id === id);
  return np && np.price != null ? num(np.price) : null;
}
const cbRate = get => { const s = get('settings'); const r = isObj(s) && isObj(s.cw) ? +s.cw.online : NaN; return r >= 0 && r <= 0.2 ? r : 0.02; };

function badOrder(o, stock, get) {
  if (!isObj(o) || !Array.isArray(o.list) || !o.list.length) return 'no parts';
  let sub = 0; const want = {};
  for (const l of o.list) {
    if (!Array.isArray(l)) return 'bad line';
    const [pid, q, r] = l;
    if (!Number.isInteger(q) || q < 1 || q > 999) return 'bad qty for ' + pid;
    const p = priceOf(pid, get);
    if (p == null) return 'no shop price for ' + pid;   // 13e: an unpriced (deleted) part was ordered at Rs 0
    if (num(r) < p - 0.5) return 'price ' + num(r) + ' below ' + p + ' for ' + pid;
    want[pid] = (want[pid] || 0) + q; sub += Math.max(num(r), p || 0) * q;
  }
  for (const [pid, q] of Object.entries(want)) if (pid in stock && q > num(stock[pid])) return 'only ' + num(stock[pid]) + ' in stock of ' + pid;
  // 13e: the shop has no coupons yet (CPNS is empty in the app), so a coupon amount is refused; delivery (Rs 40 below Rs 499)
  // and the cash-on-delivery fee (Rs 20) are worked out here, and the order total can't be above them (cashback is paid on it)
  if (num(o.cp) > 0) return 'coupon ' + String(o.code || '').slice(0, 20) + ' not known';
  const tot = Math.round(sub) + (sub >= 499 ? 0 : 40) + (o.pm === 'Cash on delivery' ? 20 : 0);
  if (num(o.amt) < tot - 1) return 'amount ' + num(o.amt) + ' below the total ' + tot;
  if (num(o.amt) > tot + 1) return 'amount ' + num(o.amt) + ' above the total ' + tot;
  return '';
}

// rows of one user in an array key: [mine, others]
const split = (arr, own) => { const m = [], o = []; for (const r of Array.isArray(arr) ? arr : []) (isObj(r) && own(r) ? m : o).push(r); return [m, o]; };

export function guardScoped(k, sv, merged, user, get, ctx) {
  const uid = user.id, notes = [];
  if (k === 'orders' && Array.isArray(merged)) {
    const own = r => (r.mob || '') === uid;
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(r => [String(r.id), r]));
    const stock = { ...(ctx.stock || get('stock') || {}) }; let took = false;
    ctx.newOrders = new Map();
    const out = [];
    const wl = (get('cwl') || {})[uid]; let bal = (Array.isArray(wl) ? wl : []).filter(isObj).reduce((s, e) => s + num(e.cr) - num(e.dr), 0);
    for (const r of merged) {
      if (!isObj(r) || !own(r)) { out.push(r); continue; }
      const s = S.get(String(r.id));
      if (s) { if (J(s) !== J(r)) notes.push('change order ' + r.id); out.push(s); continue; }
      const why = badOrder(r, stock, get) || (num(r.w) > Math.max(0, bal) + 0.5 || num(r.w) < 0 ? 'wallet ' + num(r.w) + ' above balance ' + bal : '');
      if (why) { notes.push('order ' + r.id + ': ' + why); continue; }
      const o = { ...r, st: 'Confirmed' }; bal -= num(r.w);   // 13e: the next order of this sync sees what this one spent
      for (const [pid, q] of o.list) if (pid in stock) { stock[pid] = Math.max(0, num(stock[pid]) - q); took = true; }
      ctx.newOrders.set(String(o.id), o); out.push(o);
    }
    if (took) ctx.stock = stock;
    // 13e: the wallet money an order spends is taken off here, not left to the app (the cwl step below keeps it)
    const used = [...ctx.newOrders.values()].filter(o => num(o.w) > 0).map(o => ({ d: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }), t: 'Used on ' + o.id, dr: num(o.w) }));   // 13f: the app's date form
    if (used.length) ctx.walletUsed = used;
    const M = new Set(out.filter(isObj).map(r => String(r.id)));
    for (const s of S.values()) if (own(s) && !M.has(String(s.id))) out.push(s);
    return [out, notes];
  }
  if (k === 'cwl' && isObj(merged)) {
    const S = isObj(sv) && Array.isArray(sv[uid]) ? sv[uid] : [], C = Array.isArray(merged[uid]) ? merged[uid] : [];
    const left = S.map(J); const add = [];
    const rate = cbRate(get), seen = new Set(S.filter(isObj).map(e => e.t));
    for (const e of C) {
      const i = left.indexOf(J(e)); if (i >= 0) { left[i] = null; continue; } // already on the server
      if (!isObj(e)) continue;
      if (/^Used on /.test(String(e.t || ''))) continue;   // 13f: only the server writes these (accepted new orders), so a resent or refused order takes nothing
      if (num(e.dr) > 0 && !num(e.cr)) { add.push(e); continue; }
      const m = /^Cashback · (.+)$/.exec(String(e.t || '')); const o = m && ctx.newOrders && ctx.newOrders.get(m[1]);
      if (o && !num(o.fee) && !seen.has(e.t) && num(e.cr) > 0 && num(e.cr) <= Math.round((num(o.amt) - num(o.fee) - num(o.w)) * rate) + 1 && !e.dr) { add.push(e); seen.add(e.t); continue; }
      notes.push('wallet row ' + String(e.t || '').slice(0, 40));
    }
    if (left.some(x => x !== null)) notes.push('remove wallet rows');
    ctx.cwlDone = true;
    return [{ ...merged, [uid]: [...S, ...add, ...(ctx.walletUsed || [])] }, notes];
  }
  if (k === 'warranties' && Array.isArray(merged)) {
    const own = r => (r.party || '') === uid;
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(r => [String(r.id), r]));
    const used = {}; const out = [];
    for (const r of merged) {
      if (!isObj(r) || !own(r)) { out.push(r); continue; }
      const s = S.get(String(r.id));
      if (s) { if (J(s) !== J(r)) notes.push('change warranty ' + r.id); out.push(s); continue; }
      const o = ctx.newOrders && ctx.newOrders.get(String(r.inv));
      const line = o && o.list.find(l => l[0] === r.pid);
      const k2 = r.inv + '|' + r.pid; const q = Math.max(1, num(r.qty));
      if (!line || (used[k2] || 0) + q > line[1]) { notes.push('warranty ' + r.id + ' without an order'); continue; }
      used[k2] = (used[k2] || 0) + q; out.push(r);
    }
    // the user's own warranties that the app dropped stay on the server
    const M = new Set(out.filter(isObj).map(r => String(r.id)));
    for (const s of S.values()) if (own(s) && !M.has(String(s.id))) out.push(s);
    return [out, notes];
  }
  if (k === 'sorders' && Array.isArray(merged)) {
    const own = r => (r.mob || '') === uid;
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(r => [String(r.id), r]));
    const out = [];
    for (const r of merged) {
      if (!isObj(r) || !own(r)) { out.push(r); continue; }
      const s = S.get(String(r.id));
      if (s) { if (J(s) !== J(r)) notes.push('change part order ' + r.id); out.push(s); continue; }
      const q = num(r.q); const p = priceOf(r.pid, get);
      if (!Number.isInteger(q) || q < 1 || q > 50 || !r.pid) { notes.push('part order ' + r.id); continue; }
      out.push({ ...r, adv: 0, amt: p != null ? p * q : num(r.amt), src: 'App' });
    }
    const M = new Set(out.filter(isObj).map(r => String(r.id)));
    for (const s of S.values()) if (own(s) && !M.has(String(s.id))) out.push(s);
    return [out, notes];
  }
  return [merged, notes];
}
