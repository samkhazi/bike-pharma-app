// 24p (Sam 2026-11-24): before a counter makes a bill it claims the pieces (and the pushed bill) here, so two counters cannot sell the same
// last pieces or invoice one pushed bill twice. A claim ends when its bill (same u) is in the shop's data, when released, or after 3 minutes.
const TTL = 180e3, num = v => +v || 0, isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function billClaims(get, now = Date.now) {
  const C = new Map();
  return (body, user) => {
    const u = String((body && body.u) || ''); if (!/^[a-z0-9]{6,24}$/.test(u)) return [400, { error: 'Bad claim' }];
    const mine = C.get(u); if (mine && mine.by !== user.id) return [403, { error: 'Not your claim' }];
    if (body.release) { C.delete(u); return [200, { ok: true }]; }
    if (!isObj(body.items)) return [400, { error: 'Bad claim' }];
    const items = Object.entries(body.items).map(([k, q]) => [k, num(q)]);
    if (!items.length || items.length > 300 || items.some(([, q]) => !Number.isInteger(q) || q < 1)) return [400, { error: 'Bad claim' }];
    const bills = Array.isArray(get('bills')) ? get('bills') : [], done = new Set(bills.filter(isObj).map(b => String(b.u)));
    for (const [k, c] of C) if (now() - c.t > TTL || done.has(k)) C.delete(k);
    const push = String(body.push || '').slice(0, 40);
    if (push) {
      const row = (Array.isArray(get('pushed')) ? get('pushed') : []).find(p => isObj(p) && p.id === push), b = bills.find(x => isObj(x) && x.push === push && !x.cancel);
      if ((row && row.bill) || b) return [409, { error: 'This pushed bill is already made: ' + ((row && row.bill) || b.id) + '.' }];
      if (row && row.gone) return [409, { error: 'This pushed bill was removed.' }];
      for (const [k, c] of C) if (k !== u && c.push === push) return [409, { error: 'Another counter is making this pushed bill now.' }];
    }
    const st = get('stock') || {}, np = new Map((Array.isArray(get('newProducts')) ? get('newProducts') : []).filter(isObj).map(p => [String(p.id), p.name]));
    for (const [pid, q] of items) {
      let held = 0; for (const [k, c] of C) if (k !== u) held += num(c.items[pid]);
      const left = Math.max(0, num(Object.hasOwn(st, pid) ? st[pid] : 0) - held);
      if (q > left) return [409, { error: 'Only ' + left + ' pcs of ' + (np.get(pid) || pid) + ' left' + (held ? ', another counter is billing ' + held : '') + '. Change the quantity and try again.' }];
    }
    C.set(u, { by: user.id, items: Object.fromEntries(items), push, t: now() });
    return [200, { ok: true }];
  };
}
