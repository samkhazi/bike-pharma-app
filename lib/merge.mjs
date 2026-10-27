// Shared shop database: one JSON value per top-level key of the app's DB object.
// Staff see and merge everything; customers and mechanics see and write only their own slice.

export const STAFF_ROLES = ['billing', 'sales', 'manager', 'inventory', 'accountant', 'admin'];
export const DEMO_CUST = '8951860708'; // old demo rows without an owner belong to this id (app convention)
// who can log in and as what, and the price rule for new products: only the Admin changes these
export const ADMIN_ONLY = ['accounts', 'staffOff', 'staffRole', 'priceRule', 'amPick', 'poLimit', 'retLimit'];
// purchase rates and staff salaries: only Admin and Accountant see or write them (update 9c)
export const RATE_ROLES = ['admin', 'accountant'];
const SAL_KEYS = ['sal', 'salPay', 'salAdv'];
const seesRate = user => !!user && RATE_ROLES.includes(user.role);
// grns without purchase rates for the other staff logins
const noRate = it => { if (!isObj(it)) return it; const { rate, lr, disc, ...o } = it; return o; };   // 14c: list rate + discount give the rate too
const grnsNoRate = v => Array.isArray(v) ? v.map(g => { if (!isObj(g)) return g; const { billAmt, tax, bdisc, round, ...o } = g; if (Array.isArray(o.items)) o.items = o.items.map(noRate); if (Array.isArray(o.wait)) o.wait = o.wait.map(noRate); if (Array.isArray(o.nw)) o.nw = o.nw.map(noRate); return o; }) : v;
// the mechanic price is not shown to customers or logged-out visitors
const PRICE_HIDE = ['mp', 'cost', 'rate', 'bin', 'by', 'byN', 'byT', 'sup'];
// update 9z (Sam 2026-10-20 "sirf admin me hi show hona he"): who added a product / stock entry is for Admin and Manager only (09:29Z)
const noWho = (key, v) => !Array.isArray(v) ? v : key === 'newProducts' ? v.map(p => { if (!isObj(p)) return p; const { by, byN, byT, ...o } = p; return o; }) : key === 'moves' ? v.map(m => { if (!isObj(m)) return m; const { byN, ...o } = m; return o; }) : v;
function publicView(key, value, cls) {
  if (key === 'newProducts' && Array.isArray(value)) return value.map(p => { if (!isObj(p)) return p; const o = isObj(p._base) ? { ...p, ...p._base } : { ...p }; delete o._base; for (const f of PRICE_HIDE) if (!(cls === 'mechanic' && f === 'mp')) delete o[f]; return o; });
  if (key === 'prices' && isObj(value) && cls !== 'mechanic') { const o = {}; for (const [k, v] of Object.entries(value)) { if (isObj(v)) { const { mp, cost, ...r } = v; o[k] = r; } else o[k] = v; } return o; }
  if (key === 'offers' && isObj(value)) { const o = {}; for (const [k, v] of Object.entries(value)) if (isObj(v)) o[k] = { price: v.price, till: v.till }; return o; }   // 13s: customers and mechanics see the offer price, not who set it
  return value;
}

export function roleClass(user) {
  if (!user) return 'anon';
  if (STAFF_ROLES.includes(user.role)) return 'staff';
  return user.role === 'mechanic' ? 'mechanic' : 'customer';
}

// keys everyone (even logged-out) may read whole: shop settings, products, offers
const PUBLIC = ['settings', 'stock', 'prices', 'newProducts', 'campaigns', 'schemes', 'offers', 'notifs', 'seed10', 'seedOT', 'cwlFix', 'tbFix', 'vOver'];
// objects keyed by the user's own id
const OWN_MAP = ['cu', 'cwl', 'chats', 'nprefs', 'accounts'];
// arrays where each row belongs to one user
const OWN_ROWS = { orders: r => r.mob || DEMO_CUST, bills: r => r.mob || '', warranties: r => r.party || '', sorders: r => r.mob || '', reviews: r => r.m || '' };
// a mechanic's own job cards and customers, kept per mechanic: app key -> server key holding { [mobile]: rows }
export const MECH_OWN = { jobs: 'mjobs', mcust: 'mcusts' };
const MECH_OWN_KEYS = Object.values(MECH_OWN);
// a mechanic's invoices, credit ledger and wallet (app keys minv, cl, wl) are worked out from these shop keys (mechView)
export const MECH_SRC = ['bills', 'omech', 'orec', 'accounts'];
// a customer's own insurance / PUC papers and reminder choice: app key -> server key holding { [mobile]: value } (update 9c: no longer shared)
export const CUST_OWN = { docs: 'cdocs', docRem: 'cdocrem', docRemCh: 'cdocremch' };
const CUST_OWN_KEYS = Object.values(CUST_OWN);
// what a scoped user may write back; 'own' = own slice only, 'merge' = 3-way merged like staff
const WRITE = {
  // accounts are written only by the Admin (role, status, discount): a customer or mechanic must never change their own record
  customer: { cu: 'own', cwl: 'own', chats: 'own', nprefs: 'own', orders: 'own', sorders: 'own', reviews: 'own', warranties: 'own', docs: 'mine', docRem: 'mine', docRemCh: 'mine' },
  // a mechanic's bills, credit, payments and wallet are written by the shop only; 'mine' = their own job cards / customers
  mechanic: { cu: 'own', cwl: 'own', chats: 'own', nprefs: 'own', orders: 'own', reviews: 'own', warranties: 'own', jobs: 'mine', mcust: 'mine' },
};

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!(k in b) || !deepEqual(a[k], b[k])) return false;
  return true;
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const idArr = v => Array.isArray(v) && v.length > 0 && v.every(x => isObj(x) && x.id != null);
const rowKey = r => String(r.id);

// Three-way merge: base = value the client started from, server = current value, client = client's value.
export function merge3(base, server, client) {
  if (deepEqual(server, base)) return client;          // nobody else changed it
  if (deepEqual(client, base)) return server;          // this client did not change it
  if (deepEqual(server, client)) return client;
  if (idArr(server) && idArr(client) && (idArr(base) || (Array.isArray(base) && !base.length) || base === undefined)) {
    const B = new Map((base || []).map(r => [rowKey(r), r])), S = new Map(server.map(r => [rowKey(r), r])), C = new Map(client.map(r => [rowKey(r), r]));
    const out = [];
    // rows added on the server since base, not known to the client: keep (newest first, like the app's unshift)
    for (const r of server) { const k = rowKey(r); if (!B.has(k) && !C.has(k)) out.push(r); }
    for (const r of client) {
      const k = rowKey(r); const b = B.get(k), s = S.get(k);
      if (s === undefined && b !== undefined) continue;          // deleted on the server meanwhile
      out.push(s === undefined || b === undefined ? r : merge3(b, s, r));
    }
    return out;
  }
  if (isObj(server) && isObj(client) && (isObj(base) || base === undefined)) {
    const b = base || {}; const out = {};
    for (const k of new Set([...Object.keys(server), ...Object.keys(client), ...Object.keys(b)])) {
      const inB = k in b, inS = k in server, inC = k in client;
      if (!inS && !inC) continue;
      if (!inS) { if (inB) continue; out[k] = client[k]; continue; }   // server deleted it (client unchanged) or client added it
      if (!inC) { if (inB && deepEqual(b[k], server[k])) continue; out[k] = server[k]; continue; } // client deleted it, or never had it
      out[k] = merge3(b[k], server[k], client[k]);
    }
    return out;
  }
  if (Array.isArray(server) && Array.isArray(client) && (Array.isArray(base) || base === undefined)) return mergeRows(base || [], server, client);
  return client; // scalars: the latest writer wins
}
// 13m: MRP lots ({part: [{m, q, at}]}): per part, the pieces of each MRP are counts, merged like stock
export function mergeLots(base, server, client) {
  if (!isObj(server) || !isObj(client)) return merge3(base, server, client);
  const b = isObj(base) ? base : {}, out = {};
  const qm = L => { const o = {}; for (const r of Array.isArray(L) ? L : []) if (isObj(r)) o[r.m] = (o[r.m] || 0) + (+r.q || 0); return o; };
  for (const k of new Set([...Object.keys(server), ...Object.keys(client), ...Object.keys(b)])) {
    const inS = k in server, inC = k in client, inB = k in b;
    if (deepEqual(client[k], b[k])) { if (inS) out[k] = server[k]; continue; }
    if (deepEqual(server[k], b[k])) { if (inC) out[k] = client[k]; continue; }
    const B = qm(b[k]), S = qm(server[k]), C = qm(client[k]), q = {}, rows = [], seen = new Set();
    for (const m of new Set([...Object.keys(B), ...Object.keys(S), ...Object.keys(C)])) { const x = B[m] || 0, s = S[m] || 0, c = C[m] || 0; q[m] = s !== x && c !== x ? Math.max(0, s + c - x) : c !== x ? c : s; }   // a missing MRP counts 0
    for (const r of [...(Array.isArray(server[k]) ? server[k] : []), ...(Array.isArray(client[k]) ? client[k] : [])]) {
      if (!isObj(r) || seen.has(String(r.m))) continue; seen.add(String(r.m)); if (+q[r.m] > 0) rows.push({ ...r, q: q[r.m] }); }
    if (rows.length) out[k] = rows; else if (!inS && !inC) continue;
  }
  return out;
}
// 13l: lists of rows with no id (moves, audit, cash/wallet ledgers): the server's rows, less those this client removed, plus
// the rows it added (in front when it adds in front, as the app's unshift does). Rows are matched by their JSON.
export function mergeRows(base, server, client) {
  const cnt = a => { const m = new Map(); for (const r of a) { const j = JSON.stringify(r); m.set(j, (m.get(j) || 0) + 1); } return m; };
  const B = cnt(base), C = cnt(client);
  const gone = new Map(); for (const [j, n] of B) { const d = n - (C.get(j) || 0); if (d > 0) gone.set(j, d); }
  const left = new Map(B); const add = [];
  for (const r of client) { const j = JSON.stringify(r); const n = left.get(j) || 0; if (n > 0) left.set(j, n - 1); else add.push(r); }
  const out = []; for (const r of server) { const j = JSON.stringify(r); const g = gone.get(j) || 0; if (g > 0) { gone.set(j, g - 1); continue; } out.push(r); }
  const front = add.length && client.length && JSON.stringify(client[0]) === JSON.stringify(add[0]);
  return front ? [...add, ...out] : [...out, ...add];
}

// 13e: stock counts ({part: qty}) changed on two devices from the same start: both sales count (10 -> 9 and 10 -> 9 = 8, not 9)
export function mergeCounts(base, server, client) {
  if (!isObj(server) || !isObj(client)) return merge3(base, server, client);
  const b = isObj(base) ? base : {}, out = merge3(base, server, client);
  for (const k of Object.keys(out)) {
    const x = b[k], s = server[k], c = client[k];
    if ([x, s, c].every(v => typeof v === 'number' && isFinite(v)) && s !== x && c !== x) out[k] = Math.max(0, s + (c - x));
  }
  return out;
}

// What a user may see of one key. Returns undefined when the key is hidden.
export function scopeValue(key, value, user) {
  const cls = roleClass(user);
  if (MECH_OWN_KEYS.includes(key) || CUST_OWN_KEYS.includes(key)) return undefined; // only the user it belongs to sees it (viewOf)
  if (cls === 'staff' && !['admin', 'manager'].includes(user.role) && (key === 'newProducts' || key === 'moves')) return noWho(key, value);
  if (cls === 'staff') return SAL_KEYS.includes(key) && !seesRate(user) ? undefined : key === 'grns' && !seesRate(user) ? grnsNoRate(value) : key === 'waitParts' && !seesRate(user) && Array.isArray(value) ? value.map(noRate) : value;
  if (PUBLIC.includes(key)) return publicView(key, value, cls);
  if (cls === 'anon') return undefined;
  const uid = user.id;
  if (OWN_MAP.includes(key)) return isObj(value) && uid in value ? { [uid]: value[uid] } : {};
  if (key in OWN_ROWS) {
    if (!Array.isArray(value)) return [];
    const own = cls === 'mechanic' ? mechRow(key, user) : (r => OWN_ROWS[key](r) === uid);
    return value.filter(r => isObj(r) && own(r));
  }
  return undefined;
}
// rows a mechanic owns: the shop's bills made out to them (mobile or code), warranties on those bills, their own rows
function mechRow(key, user) {
  const uid = user.id, code = user.code || '';
  if (key === 'bills') return r => r.kind === 'mech' && (r.mob === uid || (!!code && r.p === code));
  if (key === 'warranties') return r => r.party === uid || (!!code && r.party === code);
  return r => OWN_ROWS[key](r) === uid;
}

// The app's DB for one user, for the state keys in `keys` (every key when all = true). get(k) = a key's current value.
export function viewOf(keys, get, user, all = false) {
  const out = {};
  for (const k of keys) { const v = scopeValue(k, get(k), user); if (v !== undefined) out[k] = v; }
  if (roleClass(user) === 'mechanic') {
    for (const [ak, sk] of Object.entries(MECH_OWN)) if (all || keys.includes(sk)) { const m = get(sk); out[ak] = isObj(m) && Array.isArray(m[user.id]) ? m[user.id] : []; }
    if (all || keys.some(k => MECH_SRC.includes(k))) Object.assign(out, mechView(get, user));
  }
  if (roleClass(user) === 'customer') for (const [ak, sk] of Object.entries(CUST_OWN)) if (all || keys.includes(sk)) { const m = get(sk); if (isObj(m) && user.id in m) out[ak] = m[user.id]; }
  return out;
}

// A mechanic's own books, from what the shop wrote: every bill made out to them (minv: newest first, like the app),
// their credit rows (omech[code]) and payments received (orec) as the outstanding ledger (cl: oldest first). No wallet yet.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dShort = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + ' ' + MON[+m[2] - 1] : ''; };
// 13t: with the year: "DD Mon YYYY" as written, "DD Mon" this year (IST), or last year if that is more than 60 days ahead
const dKey = d => { const m = /^(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))?/.exec(String(d || '')); if (!m) return 0; const mo = MON.indexOf(m[2]), now = new Date(Date.now() + 5.5 * 3600e3); let y = m[3] ? +m[3] : now.getUTCFullYear();
  if (!m[3] && Date.UTC(y, mo, +m[1]) - now.getTime() > 60 * 864e5) y--; return y * 10000 + mo * 100 + +m[1]; };
export function mechView(get, user) {
  const uid = user.id, code = user.code || '';
  const B = get('bills'), O = get('omech'), R = get('orec');
  const bills = (Array.isArray(B) ? B : []).filter(b => isObj(b) && b.kind === 'mech' && (b.mob === uid || (!!code && b.p === code)));
  const om = code && isObj(O) && Array.isArray(O[code]) ? O[code].filter(isObj) : [];
  const rec = code && Array.isArray(R) ? R.filter(r => isObj(r) && r.code === code) : [];
  const credit = new Map(om.map(c => [String(c.id), c]));
  const inv = c => ({ id: c.id, d: c.d, amt: +c.amt || 0, paid: +c.paid || 0, ...(c.due ? { due: c.due } : {}) });
  const minv = bills.filter(b => !b.cancel || credit.has(String(b.id))).map(b => { const c = credit.get(String(b.id)); const net = Math.max(0, (+b.amt || 0) - (+b.w || 0) - (+b.rt || 0)); /* 14a: less what was returned */ if (c) { const o = { ...inv(c), ...(b.iso ? { iso: b.iso } : {}) }; if (b.cancel) return o; const sp = !(b.pm !== 'Split') && isObj(b.split) ? (+b.split.Cash || 0) + (+b.split.UPI || 0) + (+b.split.Card || 0) : 0;
    /* 14c: money returned on pieces already paid for comes off both the total and the paid part (the dues stay as they are) */ const back = Math.min(Math.max(0, (+b.rt || 0) - (+b.rtd || 0)), o.paid + sp); const r = x => Math.round(x * 100) / 100; return { ...o, amt: r(o.amt + sp - back), paid: r(o.paid + sp - back) }; } /* 13w: a Split bill shows its whole total, the dues stay the credit part's */ return { id: b.id, d: dShort(b.iso), iso: b.iso, amt: net, paid: net }; }); /* 14a: iso so the app can tell today from the same date last year */
  for (const c of om) if (!bills.some(b => String(b.id) === String(c.id))) minv.push(inv(c));
  const cl = [...om.map(c => ({ d: c.d, inv: c.id, buy: +c.amt || 0, k: dKey(c.d) })), ...rec.map(r => ({ d: r.d, ref: r.ref, pay: +r.amt || 0, k: dKey(r.d) }))]
    .map((x, i) => ({ ...x, i })).sort((a, b) => a.k - b.k || a.i - b.i).map(({ k, i, ...x }) => x);
  return { minv, cl, wl: [] };
}

// Text written by customers and mechanics is shown to staff: no HTML tags or quotes that could break out of the page.
const SAFE_CH = { '<': '‹', '>': '›', '"': '”', "'": '’', '`': 'ʼ' };
export const safeText = s => String(s).replace(/[<>"'`]/g, c => SAFE_CH[c]);
export function cleanStrings(v, depth = 0) {
  if (typeof v === 'string') return safeText(v);
  if (depth > 40 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => cleanStrings(x, depth + 1));
  const o = {}; for (const [k, x] of Object.entries(v)) o[safeText(k)] = cleanStrings(x, depth + 1); return o;
}

export function canWrite(key, user) {
  const cls = roleClass(user);
  if (MECH_OWN_KEYS.includes(key) || CUST_OWN_KEYS.includes(key)) return null;
  if (cls === 'staff') return (ADMIN_ONLY.includes(key) && user.role !== 'admin') || (SAL_KEYS.includes(key) && !seesRate(user)) ? null : 'merge';
  if (cls === 'anon') return null;
  return Object.hasOwn(WRITE[cls], key) ? WRITE[cls][key] || null : null;   // 14b: never Object.prototype names
}

// 'mine': a mechanic's own rows for app key `key`, kept under MECH_OWN[key] as { [mobile]: rows }
export function applyMine(server, client, user, any = false) {
  const s = isObj(server) ? server : {};
  if (any) return JSON.stringify(client).length > 200000 ? s : { ...s, [user.id]: client };
  return { ...s, [user.id]: Array.isArray(client) ? client.filter(isObj).slice(0, 5000) : [] };
}

// A mechanic's login is made from their first bill (Sam 2026-10-10): the shop bills a new mechanic with their mobile
// number and details (bill.md). Staff and admin numbers are never touched; a registered customer becomes a mechanic.
// Codes start at BP-MECH-2001 (the app's sample mechanics use lower numbers). Returns null when nothing changes.
const MECH_CODE = /^BP-MECH-(\d{4})$/;
export function mechLogins(bills, accs, today) {
  if (!Array.isArray(bills)) return null;
  const out = { ...(isObj(accs) ? accs : {}) }; let accChanged = false, billsChanged = false; const moved = [];
  const used = new Set(Object.values(out).map(a => isObj(a) ? a.code : null).filter(Boolean));
  const next = () => { let n = 2000; for (const c of used) { const m = MECH_CODE.exec(c); if (m && +m[1] > n) n = +m[1]; } return 'BP-MECH-' + (n + 1); };
  const rows = bills.map(b => {
    if (!isObj(b) || b.kind !== 'mech' || !/^[6-9]\d{9}$/.test(b.mob || '')) return b;
    const a = out[b.mob];
    if (isObj(a) && a.role === 'mechanic' && a.code && a.status !== 'pending') { if (b.p === a.code) return b; billsChanged = true; if (b.p) moved.push({ id: b.id, from: b.p, to: a.code }); return { ...b, p: a.code }; }
    if (isObj(a) && !['customer', 'mechanic'].includes(a.role)) return b;
    const md = isObj(b.md) ? b.md : null; if (!md || !String(md.name || '').trim()) return b;
    const want = MECH_CODE.exec(b.p || '');
    const code = want && +want[1] > 2000 && !used.has(b.p) ? b.p : next(); used.add(code);
    const t = v => safeText(String(v || '').trim()).slice(0, 80);
    const shop = t(md.shop) || t(b.pname) || t(md.name);
    out[b.mob] = { ...(isObj(a) ? a : {}), role: 'mechanic', name: t(md.name), label: 'Mechanic', sub: shop + ' · ' + code, shop, area: t(md.area), gst: t(md.gst).toUpperCase(), code, status: 'active', joined: (isObj(a) && a.joined) || today, firstInv: String(b.id || '') };
    accChanged = true;
    // the bill keeps the same cleaned details as the new login (no HTML in names)
    const row = { ...b, p: code, pname: shop, md: { name: t(md.name), shop, area: t(md.area), gst: t(md.gst).toUpperCase() } };
    if (JSON.stringify(row) === JSON.stringify(b)) return b; billsChanged = true; if (b.p && b.p !== code) moved.push({ id: b.id, from: b.p, to: code }); return row;
  });
  return accChanged || billsChanged ? { accounts: accChanged ? out : null, bills: billsChanged ? rows : null, moved } : null;
}

// When the server gives a bill another mechanic code (two devices made a new mechanic at once, or the app had an old
// list), the bill's credit row and warranties move to that code too, so no mechanic sees another one's dues.
export function moveCodes(omech, warranties, moved) {
  const om = isObj(omech) ? { ...omech } : {}; let omCh = false;
  const wr = Array.isArray(warranties) ? warranties.slice() : []; let wrCh = false;
  for (const { id, from, to } of moved || []) {
    if (!id || !from || !to || from === to) continue;
    const src = Array.isArray(om[from]) ? om[from] : [];
    const hit = src.filter(r => isObj(r) && r.id === id);
    if (hit.length) { const rest = src.filter(r => !(isObj(r) && r.id === id)); if (rest.length) om[from] = rest; else delete om[from]; om[to] = [...(Array.isArray(om[to]) ? om[to] : []), ...hit]; omCh = true; }
    for (let i = 0; i < wr.length; i++) if (isObj(wr[i]) && wr[i].inv === id && wr[i].party === from) { wr[i] = { ...wr[i], party: to }; wrCh = true; }
  }
  return { omech: omCh ? om : null, warranties: wrCh ? wr : null };
}

// Apply a scoped user's value for one key onto the server value ('own' mode).
export function applyOwn(key, server, client, user) {
  const uid = user.id;
  if (OWN_MAP.includes(key)) {
    const s = isObj(server) ? server : {};
    if (!isObj(client) || !(uid in client)) return s;
    return { ...s, [uid]: client[uid] };
  }
  if (key in OWN_ROWS) {
    const own = OWN_ROWS[key]; const s = Array.isArray(server) ? server : []; const c = Array.isArray(client) ? client : [];
    const mine = c.filter(r => isObj(r) && own(r) === uid); // rows that are not plainly the user's own are dropped
    const byId = new Map(mine.filter(r => r.id != null).map(r => [rowKey(r), r]));
    const seen = new Set(); const out = [];
    for (const r of s) {
      if (!isObj(r) || own(r) !== uid) { out.push(r); continue; }
      const k = r.id != null ? rowKey(r) : null;
      if (k && byId.has(k)) { out.push(byId.get(k)); seen.add(k); } // updated or unchanged
      // else: removed by the user (or a row without id) -> dropped
    }
    const fresh = mine.filter(r => !(r.id != null && seen.has(rowKey(r))));
    return [...fresh, ...out];
  }
  return server;
}
