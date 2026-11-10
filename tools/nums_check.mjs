// 18s: how many of a brand's diagram numbers the number reader finds (Sam 10 Nov "KTM ka bhi check kar testing kahan tak hua").
// Picks diagrams of one brand from DATA_DIR/cat/<slug>.json + <slug>-dg.json, reads each picture fresh (the cache in data/dghot is not
// used or changed) and prints, per diagram, the refs of its parts found on it and the ones missed. Run on the server as the site user:
//   sudo -u bikepharma <node> tools/nums_check.mjs ktm 10          (10 diagrams, spread over the brand; --dry: no reading)
// PDF pages (Bajaj books) are drawn by the browser, so they are skipped here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envf = (() => { try { return fs.readFileSync(path.join(ROOT, '.env'), 'utf8'); } catch { return ''; } })();
const ev = k => process.env[k] || (new RegExp('^\\s*' + k + '\\s*=\\s*"?(.*?)"?\\s*$', 'm').exec(envf) || [])[1];
const DATA_DIR = path.resolve(ROOT, ev('DATA_DIR') || 'data'), FILES_DIR = path.resolve(ROOT, ev('FILES_DIR') || path.join(DATA_DIR, 'project-files'));
const args = process.argv.slice(2), dry = args.includes('--dry'), [slug = 'ktm', nArg = '8'] = args.filter(a => !a.startsWith('--'));
const cat = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cat', slug + '.json'), 'utf8')), dg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cat', slug + '-dg.json'), 'utf8'));
function ascii85(buf) {
  let s = buf.toString('latin1').replace(/\s+/g, ''); if (s.startsWith('<~')) s = s.slice(2);
  const end = s.indexOf('~>'); if (end < 0) return null; s = s.slice(0, end);
  const out = Buffer.alloc(s.length * 4 + 8); let n = 0, acc = 0, cnt = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i);
    if (c === 122 && cnt === 0) { out.writeUInt32BE(0, n); n += 4; continue; } if (c < 33 || c > 117) return null;
    acc = acc * 85 + (c - 33); cnt++; if (cnt === 5) { out.writeUInt32BE(acc >>> 0, n); n += 4; acc = 0; cnt = 0; } }
  if (cnt) { for (let k = cnt; k < 5; k++) acc = acc * 85 + 84; const b = Buffer.alloc(4); b.writeUInt32BE(acc >>> 0, 0); b.copy(out, n, 0, cnt - 1); n += cnt - 1; }
  return out.subarray(0, n);
}
function img(u) {   // as server.mjs hotImg: a picture at a byte offset of a catalogue file
  const m = /^(p[fa]):(.+):(\d+):(\d+)$/.exec(u); if (!m) return null;
  const len = +m[4], buf = Buffer.alloc(len); let fd;
  try { fd = fs.openSync(path.join(FILES_DIR, m[2]), 'r'); if (fs.readSync(fd, buf, 0, len, +m[3]) !== len) return null; } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
  return m[1] === 'pa' && !(buf[0] === 0xFF && buf[1] === 0xD8) ? ascii85(buf) : buf;
}
// every (edition, fig) with a picture, and the refs of its parts
const refs = new Map();
for (const r of cat.d || []) { const ref = String(r[4] || '').trim().toUpperCase(); if (!ref) continue;
  for (const vi of r[11] || []) { const fi = (dg.p[vi] || dg.p[String(vi)] || {})[r[2]]; if (fi == null) continue; const u = dg.f[fi]; if (!u || u.startsWith('pdf:')) continue;
    if (!refs.has(u)) refs.set(u, { u, where: (cat.vars[vi] || vi) + ' · Fig ' + r[2], refs: new Set() }); refs.get(u).refs.add(ref); } }
const all = [...refs.values()].filter(x => x.refs.size), n = Math.min(all.length, +nArg || 8), pick = [];
for (let k = 0; k < n; k++) pick.push(all[Math.floor(k * all.length / n)]);
console.log(slug + ':', all.length, 'diagrams with a picture and refs; checking', n);
const norm = t => String(t).toUpperCase().replace(/\s+/g, '');
let readNums = null; if (!dry) ({ readNums } = await import('../ai/billread.mjs'));
let tf = 0, tt = 0;
for (const x of pick) {
  const b = img(x.u); if (!b) { console.log('NO PICTURE', x.where, x.u.slice(0, 80)); continue; }
  if (dry) { console.log('ok', x.where, b.length, 'bytes,', x.refs.size, 'refs'); continue; }
  const r = await readNums(b), got = new Set([...r.toks, ...(r.lo || [])].map(t => norm(t[0])));
  const miss = [...x.refs].filter(f => !got.has(norm(f)) && !got.has(norm(f).replace(/^(\d+)[A-Z]$|^(\d+)-\d+$/, '$1$2')));
  tf += x.refs.size - miss.length; tt += x.refs.size;
  console.log(`${x.refs.size - miss.length}/${x.refs.size}`, x.where, `(${r.w}x${r.h}, ${Math.round(r.ms / 100) / 10} s)`, miss.length ? 'missed: ' + miss.sort((a, b) => parseInt(a) - parseInt(b)).join(' ') : 'all found');
}
if (!dry) console.log(`TOTAL ${tf}/${tt} refs found (${tt ? Math.round(tf * 1000 / tt) / 10 : 0}%)`);
process.exit(0);
