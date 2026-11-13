// 21t: a tyre maker's own size list (Sam's PDF, read with `pdftotext -layout list.pdf list.txt`) into the file the server reads:
//   node tools/tyre_brand_list.mjs list.txt CEAT "MCY w.e.f 01-04-2026" out.json [--mrp]
// Lines: <group> <platform> <6-digit SKU> <size + pattern + TL/TT + load index> <rate>. The rate is kept ONLY with --mrp, i.e. only
// after Sam says that column is the MRP (dealer rates never go into the app).
import fs from 'node:fs';
const [txt, brand, src, out, flag] = process.argv.slice(2), rows = [], bad = [];
const SZ = /^(\d{2,3})\/(\d{2,3})\s*(-|Z?R|\sR|\sB)\s*(\d{2})|^(\d\.\d{2})-(\d{2})/i;
let skip = false, secTL = false;
for (const l of fs.readFileSync(txt, 'utf8').split('\n')) {
  if (/^\s*(3\s*WHEELER|THREE WHEELER|CAR|TRUCK|FARM)\b/i.test(l)) { skip = true; secTL = false; continue; } if (/^\s*(SCOOTER|MOTORCYCLE|MOPED)\s*$/i.test(l)) { skip = false; secTL = false; continue; }
  // with a 6-digit SKU (CEAT) or without one (Apollo: "<size> <load> <pattern> <TL> -D   <rate>")
  let m = /(\d{6})\s{2,}(.+?)\s{2,}(\d{3,5})\s*$/.exec(l); if (!m) { const n = /^\s*(\d\S*.*?)\s{2,}(\d{3,5})\s*$/.exec(l); if (n) m = [0, '', n[1], n[2]]; }
  if (!m) { if (/\d{6}/.test(l)) bad.push(l.trim()); else if (l.trim()) secTL = /\bTL\s*$/i.test(l.trim()); continue; } if (skip || /\bTUBE\b|ACTITUBE/i.test(m[2].replace(/\bWITH\b.*|\+.*/i, ''))) continue;
  const name = m[2].replace(/Â/g, '').replace(/\s*-\s*D\s*\.?\s*$/i, '').replace(/\s+/g, ' ').trim(), z = SZ.exec(name); if (!z) { bad.push(l.trim()); continue; }
  const size = z[1] ? z[1] + '/' + z[2] + (/R/i.test(z[3]) ? ' R' : '-') + z[4] : z[5] + '-' + z[6], N = ' ' + name.toUpperCase().replace(/[()]/g, ' ') + ' ';
  rows.push([m[1], name, size, /\sTL[\s-]/.test(N) || secTL ? 'TL' : /\sTT[\s-]/.test(N) ? 'TT' : '', /\s(F|FM|F\d)[\s-]/.test(N) ? 'F' : /\s(RM|R\d)[\s-]/.test(N) ? 'R' : '', flag === '--mrp' ? +m[3] : 0]);
}
fs.writeFileSync(out, JSON.stringify({ brand, kind: 't', src, rows }));
console.log(brand, 'tyres:', rows.length, '| sizes:', new Set(rows.map(r => r[2])).size, '| front marked:', rows.filter(r => r[4] === 'F').length, 'rear marked:', rows.filter(r => r[4] === 'R').length, '| TL', rows.filter(r => r[3] === 'TL').length, 'TT', rows.filter(r => r[3] === 'TT').length, '| lines not read:', bad.length); for (const b of bad) console.log('  ?', b);
