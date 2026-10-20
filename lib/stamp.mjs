// Update 9z (Sam 2026-10-20 "kis staff me entry ki thi"): who added a product or a stock entry comes from the login, not the app.
// A new product (an id the server does not have yet) gets by / byN / byT from this login; a product already saved keeps its own.
// A new stock movement gets byN from this login. Older lines without these keep showing the audit log's name in the app.
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const when = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).replace(/^(\d+ \w+),? /, '$1, ');
const nameOf = u => String(u.name || u.sid || u.label || u.id || '').slice(0, 60);
const bare = m => { const { byN, ...o } = m; return JSON.stringify(o); };

export function stampWho(k, sv, merged, user) {
  if (!user || !Array.isArray(merged)) return merged;
  if (k === 'newProducts') {
    const S = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map(p => [String(p.id), p]));
    return merged.map(p => {
      if (!isObj(p)) return p;
      const s = S.get(String(p.id));
      if (s) { const o = { ...p }; for (const f of ['by', 'byN', 'byT']) { if (f in s) o[f] = s[f]; else delete o[f]; } return o; }
      return { ...p, by: user.sid || p.by, byN: nameOf(user), byT: when() };
    });
  }
  if (k === 'moves') {
    const old = new Map();
    for (const m of Array.isArray(sv) ? sv : []) if (isObj(m)) { const b = bare(m); old.set(b, (old.get(b) || []).concat(m)); }
    return merged.map(m => {
      if (!isObj(m)) return m;
      const l = old.get(bare(m));
      if (l && l.length) { const s = l.shift(); return 'byN' in s ? { ...m, byN: s.byN } : (({ byN, ...o }) => o)(m); }
      return { ...m, byN: nameOf(user) };
    });
  }
  return merged;
}
