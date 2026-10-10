// Shared shop database: one JSON value per top-level key of the app's DB object.
// Staff see and merge everything; customers and mechanics see and write only their own slice.

export const STAFF_ROLES = ['billing', 'sales', 'manager', 'inventory', 'admin'];
export const DEMO_CUST = '8951860708'; // old demo rows without an owner belong to this id (app convention)

export function roleClass(user) {
  if (!user) return 'anon';
  if (STAFF_ROLES.includes(user.role)) return 'staff';
  return user.role === 'mechanic' ? 'mechanic' : 'customer';
}

// keys everyone (even logged-out) may read whole: shop settings, products, offers
const PUBLIC = ['settings', 'stock', 'prices', 'newProducts', 'campaigns', 'schemes', 'notifs', 'seed10', 'seedOT', 'cwlFix', 'tbFix', 'vOver'];
// objects keyed by the user's own id
const OWN_MAP = ['cu', 'cwl', 'chats', 'nprefs', 'accounts'];
// arrays where each row belongs to one user
const OWN_ROWS = { orders: r => r.mob || DEMO_CUST, bills: r => r.mob || '', warranties: r => r.party || '', sorders: r => r.mob || '', reviews: r => r.m || '' };
// keys the mechanic app uses whole (the app keeps one mechanic ledger)
const MECH_WHOLE = ['wl', 'cl', 'minv', 'omech', 'jobs', 'mcust'];
// keys the customer app uses whole
const CUST_WHOLE = ['docs', 'docRem', 'docRemCh'];
// what a scoped user may write back; 'own' = own slice only, 'merge' = 3-way merged like staff
const WRITE = {
  // accounts are written only by the Admin (role, status, discount): a customer or mechanic must never change their own record
  customer: { cu: 'own', cwl: 'own', chats: 'own', nprefs: 'own', orders: 'own', reviews: 'own', warranties: 'own', stock: 'merge', docs: 'merge', docRem: 'merge', docRemCh: 'merge', notifs: 'merge' },
  mechanic: { cu: 'own', cwl: 'own', chats: 'own', nprefs: 'own', orders: 'own', reviews: 'own', warranties: 'own', stock: 'merge', wl: 'merge', cl: 'merge', minv: 'merge', omech: 'merge', jobs: 'merge', mcust: 'merge', notifs: 'merge' },
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
  return client; // scalars and unkeyed arrays: the latest writer wins
}

// What a user may see of one key. Returns undefined when the key is hidden.
export function scopeValue(key, value, user) {
  const cls = roleClass(user);
  if (cls === 'staff') return value;
  if (PUBLIC.includes(key)) return value;
  if (cls === 'anon') return undefined;
  const uid = user.id;
  if (OWN_MAP.includes(key)) return isObj(value) && uid in value ? { [uid]: value[uid] } : {};
  if (key in OWN_ROWS) {
    if (!Array.isArray(value)) return [];
    if (key === 'bills' && cls === 'mechanic') return value.filter(r => r.kind === 'mech');
    const own = OWN_ROWS[key]; return value.filter(r => isObj(r) && own(r) === uid);
  }
  if (cls === 'mechanic' && MECH_WHOLE.includes(key)) return value;
  if (cls === 'customer' && CUST_WHOLE.includes(key)) return value;
  return undefined;
}

export function scopeDb(rows, user) { // rows: [{key, json}]
  const out = {};
  for (const r of rows) { const v = scopeValue(r.key, JSON.parse(r.json), user); if (v !== undefined) out[r.key] = v; }
  return out;
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
  if (cls === 'staff') return 'merge';
  if (cls === 'anon') return null;
  return WRITE[cls][key] || null;
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
