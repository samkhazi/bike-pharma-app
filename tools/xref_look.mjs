// What the cross-brand file (cat/xref.json) holds for given part numbers. Read only.
//   node tools/xref_look.mjs <cat dir> <part no> [part no ...]
import fs from 'node:fs'; import path from 'node:path';
const pk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const dir = process.argv[2], f = path.join(dir, 'xref.json');
let X; try { X = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log('xref.json nahi padha gaya:', e.message); process.exit(1); }
const age = f2 => { try { return new Date(fs.statSync(path.join(dir, f2)).mtimeMs + 5.5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' IST'; } catch { return 'nahi he'; } };
console.log('xref.json bana:', age('xref.json'), '| hero.json:', age('hero.json'), '| honda.json:', age('honda.json'));
console.log('brands:', X.b.join(', '), '| same numbers:', Object.keys(X.x).length, '| through another number:', Object.keys(X.n).length, '| groups:', X.g.length,
  '| new end groups:', X.g.filter(g => /only the last/.test(g[0])).length, '| one-more-letter links:', Object.values(X.r || {}).flatMap(o => Object.values(o)).filter(w => /one more letter/.test(w)).length);
for (const a of process.argv.slice(3)) {
  const k = pk(a); console.log('\n== ' + a);
  console.log('   in brands:', X.x[k] ? Object.keys(X.x[k]).map(i => X.b[i]).join(', ') : 'not in the same-number list');
  if (X.n[k]) for (const i in X.n[k]) console.log('   same part:', X.b[i], X.n[k][i], '(' + X.r[k][i] + ')');
  for (const gi of (X.gk || {})[k] || []) { const [lab, ck, o] = X.g[gi]; console.log('   group:', lab, '|', Object.keys(o).map(i => X.b[i] + ': ' + o[i].map(e => e[0]).join(', ')).join(' | ')); }
  if (!X.n[k] && !((X.gk || {})[k] || []).length) console.log('   no match and no group for this number');
  for (const slug of ['hero', 'honda']) { try { const d = JSON.parse(fs.readFileSync(path.join(dir, slug + '.json'), 'utf8')); const r = (d.d || []).find(r => pk(r[5]) === k);
    console.log('   ' + slug + '.json:', r ? String(r[5]) + ' | ' + (typeof r[6] === 'number' ? (d.desc || [])[r[6]] : r[6]) + ' | bikes ' + (r[11] || []).length + (d.split ? ' | split' : '') : 'not there'); } catch (e) { console.log('   ' + slug + '.json: ' + e.message); } }
}
