// 21t: a tyre maker's own size list (Sam's PDF, read with `pdftotext -layout list.pdf list.txt`) into the file the server reads:
//   node tools/tyre_brand_list.mjs list.txt CEAT "MCY w.e.f 01-04-2026" out.json [--mrp]
// Lines: <group> <platform> <6-digit SKU> <size + pattern + TL/TT + load index> <rate>. The rate is kept ONLY with --mrp, i.e. only
// after Sam says that column is the MRP (dealer rates never go into the app).
import fs from 'node:fs';
const [txt, brand, src, out, flag] = process.argv.slice(2), rows = [], bad = [];
const SZ = /^(\d{2,3})\/(\d{2,3})\s*(-|Z?R|\sR|\sB)\s*(\d{2})|^(\d\.\d{2})-(\d{2})/i;
for (const l of fs.readFileSync(txt, 'utf8').split('\n')) {
  const m = /(\d{6})\s{2,}(.+?)\s{2,}(\d{3,5})\s*$/.exec(l); if (!m) { if (/\d{6}/.test(l)) bad.push(l.trim()); continue; }
  const name = m[2].replace(/Â/g, '').replace(/\s+/g, ' ').trim(), z = SZ.exec(name); if (!z) { bad.push(l.trim()); continue; }
  const size = z[1] ? z[1] + '/' + z[2] + (/R/i.test(z[3]) ? ' R' : '-') + z[4] : z[5] + '-' + z[6];
  rows.push([m[1], name, size, /\bTL\b/i.test(name) ? 'TL' : /\bTT\b/i.test(name) ? 'TT' : '', /\sF\s/i.test(name + ' ') ? 'F' : '', flag === '--mrp' ? +m[3] : 0]);
}
fs.writeFileSync(out, JSON.stringify({ brand, kind: 't', src, rows }));
console.log(brand, 'tyres:', rows.length, '| sizes:', new Set(rows.map(r => r[2])).size, '| front marked:', rows.filter(r => r[4]).length, '| TL', rows.filter(r => r[3] === 'TL').length, 'TT', rows.filter(r => r[3] === 'TT').length, '| lines not read:', bad.length); for (const b of bad) console.log('  ?', b);
