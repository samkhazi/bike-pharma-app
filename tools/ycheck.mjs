// Prints what the server holds for the Yamaha bikes whose name or code matches a word (default RX): the uploaded parts books,
// the YPEC model files and the scanned books. Reads only; changes nothing.  node tools/ycheck.mjs RX
import fs from 'node:fs'; import path from 'node:path';
const re = new RegExp(process.argv[2] || 'RX', 'i'), F = process.env.FILES_DIR || 'data/project-files';
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const yd = path.join(F, 'catalogues/yamaha'), yp = path.join(F, 'catalogues/hero-sync/yamaha/ypec');
const B = rj(path.join(yd, 'yamaha_build.json')) || {}, names = B.names || {}, X = rj(path.join(yp, 'pdfbooks.json')) || {};
const hit = (code, ...t) => re.test(code) || re.test(names[code] || '') || t.some(x => re.test(String(x || '')));
const codes = new Set();
console.log('== uploaded books (yamaha_build.json) ==');
for (const b of B.books || []) { if (!(b.codes || []).some(c => hit(c, b.title, b.file))) continue; (b.codes || []).forEach(c => codes.add(c));
  let z = -1; try { z = fs.statSync(path.join(yd, b.file)).size; } catch { z = -1; }
  console.log([(b.codes || []).join('+'), (b.codes || []).map(c => names[c] || '?').join('+'), b.date, 'figs ' + (b.figs || []).length, 'rows ' + (b.figs || []).reduce((n, f) => n + (f.rows || []).length, 0), 'pages ' + (b.pages || '?'), z < 0 ? 'FILE MISSING' : 'file ' + z + ' B', b.file].join(' | ')); }
console.log('== scanned books (pdfbooks.json) ==');
for (const [c, m] of Object.entries(X.models || {})) { if (!hit(c, m.name)) continue; codes.add(c);
  console.log([c, m.name, m.year, (m.cats || []).map(k => { const b = (X.books || {})[k]; let z = -1; try { z = fs.statSync(path.join(yp, 'pdf', b.file)).size; } catch { z = -1; } return k + (b ? ' ' + b.pages + 'p ' + (z === b.size ? 'ok' : 'FILE ' + z + ' want ' + b.size) : ' no book'); }).join(', ')].join(' | ')); }
console.log('== YPEC model files ==');
let fl = []; try { fl = fs.readdirSync(path.join(yp, 'models')).filter(f => f.endsWith('.json')); } catch { fl = []; }
for (const f of fl) { const m = rj(path.join(yp, 'models', f)); if (!m) continue; const c = String(m.code || f.replace('.json', '')).toUpperCase(); if (!codes.has(c) && !hit(c, m.name)) continue;
  console.log([c, m.name, m.year, m.none ? 'NONE (no diagrams in YPEC)' : 'figs ' + (m.figs || []).length + ' parts ' + (m.figs || []).reduce((n, x) => n + (x.parts || []).length, 0), 'colours ' + (m.colors || []).length].join(' | ')); }
const L = rj(path.join(yp, 'list.json')); if (L) { const rows = (L.rows || L.models || L || []); if (Array.isArray(rows)) { console.log('== YPEC list =='); for (const r of rows) { const s = JSON.stringify(r); if (re.test(s)) console.log(s.slice(0, 200)); } } }
const info = rj(path.join(F, 'catalogues/yamaha/yamaha_info.json')) || rj('data/yamaha_info.json'); if (info) console.log('== build info ==', JSON.stringify({ scan: info.scan, ypec: info.ypec && { models: info.ypec.models, parts: info.ypec.parts }, editions: info.editions }));
