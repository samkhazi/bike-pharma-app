// 21g (Sam 2026-11-12 "Honda aur Hero ke koi koi part number bhi same aate hein bas last ka ek number ka alphabet change rehta he"):
// reads the two built catalogues and lists the Hero and Honda part numbers that are the same or differ only at the end.
// Read only: nothing in the app changes. No prices are read or written.
//   node tools/hero_honda_compare.mjs <cat dir with hero.json + honda.json> [out.csv]
import fs from 'node:fs';
import path from 'node:path';
const pk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const STOP = /^(COMP|ASSY|SET|KIT|SUB|TYPE|THE|AND|FOR|WITH|RH|LH|R|L|FR|RR|A|B|NO|\d+)$/;
const words = s => new Set(String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').split(' ').filter(w => w.length > 1 && !STOP.test(w)));
const alike = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return false; let n = 0; for (const w of A) if (B.has(w)) n++; return n * 2 >= Math.min(A.size, B.size); };

export function load(catDir, slug) {
  const d = JSON.parse(fs.readFileSync(path.join(catDir, slug + '.json'), 'utf8')), m = new Map();
  for (const r of d.d || []) {
    const k = pk(r[5]); if (k.length < 8) continue;
    let e = m.get(k); if (!e) m.set(k, e = { pn: String(r[5]).trim(), nm: (typeof r[6] === 'number' ? (d.desc || [])[r[6]] : r[6]) || '', mods: new Set() });
    for (const i of r[11] || []) { const v = (d.vars || [])[i], mo = (d.vmod && d.vmod[v]) || v; if (mo && e.mods.size < 4) e.mods.add(mo); }
  }
  return m;
}

export function compare(hero, honda) {
  const out = [], put = (kind, h, o) => out.push({ kind, hero: h.pn, heroName: h.nm, heroBikes: [...h.mods].join(' / '), honda: o.pn, hondaName: o.nm, hondaBikes: [...o.mods].join(' / '), names: alike(h.nm, o.nm) ? 'alike' : 'different' });
  const stem = new Map();   // Honda numbers by all but the last character
  for (const [k, o] of honda) { const s = k.slice(0, -1); if (!stem.has(s)) stem.set(s, []); stem.get(s).push([k, o]); }
  for (const [k, h] of hero) {
    if (honda.has(k)) { put('1 same number', h, honda.get(k)); continue; }
    const cut = k.slice(0, -1);
    if (honda.has(cut)) { put(k.endsWith('S') ? '2 Hero = Honda + S' : '3 Hero = Honda + one more letter/number', h, honda.get(cut)); continue; }
    for (const [k2, o] of stem.get(cut) || []) if (k2.length === k.length) put(/[A-Z]/.test(k.slice(-1) + k2.slice(-1)) ? '4 only the last letter differs' : '5 only the last number differs', h, o);
    for (const [k2, o] of stem.get(k) || []) put('6 Honda = Hero + one more letter/number', h, o);
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.hero.localeCompare(b.hero));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const dir = process.argv[2], outF = process.argv[3];
  const hero = load(dir, 'hero'), honda = load(dir, 'honda'), rows = compare(hero, honda);
  console.log('Hero part numbers:', hero.size, '| Honda part numbers:', honda.size);
  const kinds = [...new Set(rows.map(r => r.kind))];
  for (const k of kinds) {
    const rs = rows.filter(r => r.kind === k), ok = rs.filter(r => r.names === 'alike');
    console.log('\n== ' + k + ': ' + rs.length + ' pairs | names alike: ' + ok.length + ' | names different: ' + (rs.length - ok.length));
    const step = Math.max(1, Math.floor(ok.length / 8)), bad = rs.filter(r => r.names !== 'alike'), bstep = Math.max(1, Math.floor(bad.length / 4));
    for (let i = 0; i < ok.length && i < step * 8; i += step) console.log('   ' + ok[i].hero + ' (' + ok[i].heroName + ')  =  ' + ok[i].honda + ' (' + ok[i].hondaName + ')');
    for (let i = 0; i < bad.length && i < bstep * 4; i += bstep) console.log('   ? ' + bad[i].hero + ' (' + bad[i].heroName + ')  /  ' + bad[i].honda + ' (' + bad[i].hondaName + ')');
  }
  if (!rows.length) console.log('no pairs found');
  if (outF) {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    fs.writeFileSync(outF, ['kind,hero no,hero name,hero bikes,honda no,honda name,honda bikes,names'].concat(rows.map(r => [r.kind, r.hero, r.heroName, r.heroBikes, r.honda, r.hondaName, r.hondaBikes, r.names].map(q).join(','))).join('\n') + '\n');
    console.log('\nfull list: ' + outF + ' (' + rows.length + ' pairs)');
  }
}
