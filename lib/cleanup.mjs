// One-time removal of the old demo shop data from a live database.
// Sam 2026-10-11: "sample data jo kuch bhi he sabhi delete karde". Versions up to update 5 started every new
// database with demo products, mechanics, bills, orders, suppliers, expenses and so on (lib/demo-data.json lists
// them). This removes them and anything that only exists because of them (bills of demo products, bills to demo
// mechanics, their stock moves), and keeps everything real: logins, staff, settings, products added in Inventory,
// bills of real products, mechanics made from real bills. Everything removed is first saved to
// data/removed-sample-data-<date>.json so it can be put back by hand.
import fs from 'node:fs';
import path from 'node:path';

const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
const canon = v => JSON.stringify(sortKeys(v));
// how a record is recognised: its demo id plus a field or two that a real record with the same number would not share
const MATCH = {
  approvals: e => [e.id, e.t, e.d], bills: e => [e.id], grns: e => [e.id, e.supplier, e.inv], pos: e => [e.id, e.supplier],
  orders: e => [e.id, e.d], sorders: e => [e.id, e.mob, e.name], tasks: e => [e.id, e.type, e.note], warranties: e => [e.id, e.party, e.name],
  schemes: e => [e.id, e.n], minv: e => [e.id, e.d, e.amt], batches: e => [e.pid, e.b], sups: e => [e.n, e.gst],
};
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const MAPS = ['omech', 'stock', 'bins', 'cu', 'cwl']; // collections keyed by product / mechanic / customer (targets, backup are single records)

export function removeDemoData(store, dataDir, demoFile) {
  const demo = JSON.parse(fs.readFileSync(demoFile, 'utf8'));
  const live = {}; for (const r of store.stateAll()) live[r.key] = JSON.parse(r.json);
  const realP = new Set((live.newProducts || []).map(p => p && p.id));
  const demoP = new Set(demo.products.filter(id => !realP.has(id)));
  const demoM = new Set(demo.mechs), demoC = new Set(demo.customers);
  const accounts = isObj(live.accounts) ? live.accounts : {};
  const realC = new Set(Object.keys(accounts)); // a demo number someone really signed up with keeps their own data
  const removed = {}, changes = {};
  const out = (key, v) => (removed[key] = removed[key] || []).push(v);
  const itemPids = r => (Array.isArray(r.items) ? r.items.map(i => i && i.pid) : []).concat(r.pid !== undefined ? [r.pid] : []).filter(Boolean);
  const onlyDemoP = r => { const l = itemPids(r); return l.length > 0 && l.every(p => demoP.has(p)); };

  // 1. lists: the demo records themselves, then records that exist only because of demo products / mechanics
  const goneBills = new Set();
  for (const [key, val] of Object.entries(live)) {
    if (!Array.isArray(val)) continue;
    const d = Array.isArray(demo.values[key]) ? demo.values[key] : [];
    const f = MATCH[key] || canon, ks = new Set(d.map(e => canon(MATCH[key] ? f(e) : e)));
    const keep = val.filter(e => {
      let gone = ks.has(canon(MATCH[key] ? f(e) : e));
      if (!gone && isObj(e)) {
        if (key === 'bills') gone = onlyDemoP(e) || (e.kind === 'mech' && demoM.has(e.p));
        else if (['moves', 'batches', 'grns', 'pos', 'sorders', 'warranties'].includes(key)) gone = onlyDemoP(e);
        else if (key === 'tasks') gone = (e.mech && demoM.has(e.mech)) || (Array.isArray(e.ids) && e.ids.length > 0 && e.ids.every(p => demoP.has(p)));
      }
      if (gone) { out(key, e); if (key === 'bills') goneBills.add(e.id); }
      return !gone;
    });
    if (keep.length !== val.length) live[key] = keep, changes[key] = keep;
  }
  if (goneBills.size && Array.isArray(live.moves)) { // stock moves of the removed bills
    const keep = live.moves.filter(m => { const g = isObj(m) && goneBills.has(m.ref); if (g) out('moves', m); return !g; });
    if (keep.length !== live.moves.length) live.moves = keep, changes.moves = keep;
  }
  if (goneBills.size && isObj(live.cwl)) { // wallet cashback / use lines of the removed bills
    const ids = [...goneBills]; let ch = false; const o = { ...live.cwl };
    for (const [k, l] of Object.entries(live.cwl)) if (Array.isArray(l)) {
      const keep = l.filter(e => !(isObj(e) && ids.some(id => String(e.t || '').includes(id))));
      if (keep.length !== l.length) { out('cwl.' + k, l.filter(e => !keep.includes(e))); o[k] = keep; ch = true; }
    }
    if (ch) live.cwl = o, changes.cwl = o;
  }
  // 2. maps keyed by product id, mechanic code or customer number
  for (const [key, val] of Object.entries(live)) {
    if (!isObj(val) || key === 'accounts' || key === 'targets' || key === 'backup') continue;
    const d = MAPS.includes(key) && isObj(demo.values[key]) ? demo.values[key] : {};
    let ch = false; const o = { ...val };
    for (const [k, v] of Object.entries(val)) {
      let gone = demoP.has(k) || demoM.has(k) || (demoC.has(k) && !realC.has(k));
      if (!gone && k in d && !realP.has(k)) { // a real product (added in Inventory) keeps its stock / bin even if it equals the old demo value
        if (canon(v) === canon(d[k])) gone = true;
        else if (Array.isArray(v) && Array.isArray(d[k])) { // e.g. a demo wallet with real lines added
          const ks = new Set(d[k].map(canon)); const keep = v.filter(e => !ks.has(canon(e)));
          if (keep.length !== v.length) { out(key + '.' + k, v.filter(e => ks.has(canon(e)))); o[k] = keep; ch = true; }
        }
      }
      if (!gone && key === 'cu' && isObj(v)) { // a customer's cart / wish list holding demo products
        const c = { ...v };
        if (Array.isArray(c.cart)) c.cart = c.cart.filter(x => !(x && demoP.has(x.id)));
        if (Array.isArray(c.wish)) c.wish = c.wish.filter(x => !demoP.has(x));
        if (canon(c) !== canon(v)) { out('cu.' + k, v); o[k] = c; ch = true; }
      }
      if (gone) { out(key, { [k]: v }); delete o[k]; ch = true; }
    }
    if (ch) live[key] = o, changes[key] = o;
  }
  // 3. single values
  if (isObj(live.targets) && /Rahul Menon/.test(String(live.targets.setBy || ''))) { out('targets', live.targets); changes.targets = null; }
  if (live.backup && canon(live.backup) === canon(demo.values.backup)) { out('backup', live.backup); changes.backup = { auto: 0, last: '' }; }
  // 4. logins made for demo mechanics (from a bill to one of them)
  const acc = { ...accounts }; let ach = false;
  for (const [id, a] of Object.entries(accounts)) if (a && a.role === 'mechanic' && demoM.has(a.code)) { out('accounts', { [id]: a }); delete acc[id]; ach = true; }
  if (ach) changes.accounts = acc;

  const n = Object.values(removed).reduce((s, l) => s + l.length, 0);
  let file = '';
  if (n) {
    file = path.join(dataDir, 'removed-sample-data-' + new Date().toISOString().slice(0, 10) + '.json');
    fs.writeFileSync(file, JSON.stringify({ removedAt: new Date().toISOString(), why: 'Sam 2026-10-11: delete all sample data', removed }, null, 1));
    const w = {}; for (const [k, v] of Object.entries(changes)) w[k] = v === null ? null : JSON.stringify(v);
    store.write(w);
  }
  return { n, file, keys: Object.fromEntries(Object.entries(removed).map(([k, l]) => [k, l.length])) };
}
