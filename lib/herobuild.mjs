// Hero catalogue made on the server from Sam's Raw Data (Downloads > Hero Catalogue > Raw Data, uploaded by Admin into
// FILES_DIR/catalogues/hero-raw): its editions that the app's Hero file (public/cat/hero.json) does not have yet are added to it,
// with their diagrams and part photos read straight out of the uploaded zips (pf: refs, nothing unpacked or copied).
// Out: DATA_DIR/cat/hero.json + hero-dg.json (served instead of public/cat ones) and the Hero line of the app's part number table.
import fs from 'node:fs';
import path from 'node:path';

export const HERO_RAW = ['Hero_Discontinuation_Parts_List.xlsx', 'hero_hidden_diagrams_1.zip', 'hero_hidden_diagrams_2.zip', 'hero_hidden_diagrams_3.zip',
  'hero_hidden_diagrams_4.zip', 'hero_hidden_models.json', 'hero_hidden_photos_1.zip', 'hero_hidden_photos_2.zip', 'hero_oldnew_harvest.json'];
const OTHER = 'Other parts (price list)';
// the app's Hero file when it has none (Sam may start Hero from the Raw Data alone)
export const EMPTY_HERO = () => ({ brand: 'Hero', src: [], bk: [], models: [], cur: 0, cc: {}, sheets: [], figs: [], vars: [], vmod: {}, asm: [], desc: [], d: [], fw: 'Fig', mrp: {}, phf: {}, phz: [] });
export const EMPTY_HERO_DG = () => ({ f: [], p: {}, dir: 'catalogues/hero-raw', files: [], spare: [], pick: 'Downloads > Hero Catalogue > Raw Data' });
const SRC = "Hero e-catalogue raw data (models, diagrams, part photos, old and new numbers), Sam's folder Hero Catalogue > Raw Data";

// a zip's stored (not compressed) entries: name -> [data offset, length]
export function zipIndex(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size, tl = Math.min(size, 65557), t = Buffer.alloc(tl);
    fs.readSync(fd, t, 0, tl, size - tl);
    let e = -1; for (let i = tl - 22; i >= 0; i--) if (t.readUInt32LE(i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('not a zip: ' + path.basename(file));
    let n = t.readUInt16LE(e + 10), cs = t.readUInt32LE(e + 12), co = t.readUInt32LE(e + 16);
    if (co === 0xffffffff || n === 0xffff) { // zip64 end record
      const l = e - 20; if (l >= 0 && t.readUInt32LE(l) === 0x07064b50) {
        const z = Buffer.alloc(56); fs.readSync(fd, z, 0, 56, Number(t.readBigUInt64LE(l + 8)));
        n = Number(z.readBigUInt64LE(32)); cs = Number(z.readBigUInt64LE(40)); co = Number(z.readBigUInt64LE(48));
      }
    }
    const c = Buffer.alloc(cs); fs.readSync(fd, c, 0, cs, co);
    const out = new Map(), lh = Buffer.alloc(30);
    for (let p = 0, k = 0; k < n && p + 46 <= cs; k++) {
      if (c.readUInt32LE(p) !== 0x02014b50) break;
      const meth = c.readUInt16LE(p + 10), nl = c.readUInt16LE(p + 28), xl = c.readUInt16LE(p + 30), kl = c.readUInt16LE(p + 32);
      let len = c.readUInt32LE(p + 20), off = c.readUInt32LE(p + 42);
      const name = c.toString('utf8', p + 46, p + 46 + nl);
      if (len === 0xffffffff || off === 0xffffffff) { // zip64 extra field
        let q = p + 46 + nl; const qe = q + xl;
        while (q + 4 <= qe) { const id = c.readUInt16LE(q), sz = c.readUInt16LE(q + 2);
          if (id === 1) { let r = q + 4; if (c.readUInt32LE(p + 24) === 0xffffffff) r += 8; if (len === 0xffffffff) { len = Number(c.readBigUInt64LE(r)); r += 8; } if (off === 0xffffffff) off = Number(c.readBigUInt64LE(r)); }
          q += 4 + sz; }
      }
      p += 46 + nl + xl + kl;
      if (meth !== 0 || name.endsWith('/')) continue;
      fs.readSync(fd, lh, 0, 30, off);
      if (lh.readUInt32LE(0) !== 0x04034b50) continue;
      out.set(name, [off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28), len]);
    }
    return out;
  } finally { fs.closeSync(fd); }
}

// width and height of a JPEG at off in an open file (0,0 when not found)
function jpegSize(fd, off, len) {
  const b = Buffer.alloc(Math.min(len, 65536)); fs.readSync(fd, b, 0, b.length, off);
  if (b[0] !== 0xff || b[1] !== 0xd8) return [0, 0];
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1]; if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [0, 0];
}

const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// "HF Dawn (formerly CD Dawn - Nov, 2006)" is the old book "CD Dawn (Nov, 2006)"
const formerly = s => { const m = /^.*?\(formerly (.+?) - (.+)\)\s*$/i.exec(s); return m ? m[1] + ' (' + m[2] + ')' : ''; };
const EXPORT_RX = /LATAM|EURO|\bEU4\b|TURKEY|BANGLADESH|NIGERIA|AFRICA|COLOMBIA|COLUMBIA|ARGENTINA|\bEXP\b/i;
// the app's Hero model a raw edition belongs to: [test on its name or base model, model]; first match wins
const MODEL_RULES = [
  [/formerly CBZ/i, 'CBZ Xtreme'], [/THRILLER/i, 'Thriller'], [/X-?TREME 200R/i, 'Xtreme 200R'], [/X-?TREME 200S/i, 'Xtreme 200S'], [/X-?TREME/i, 'Xtreme 150'],
  [/formerly CD Dawn/i, 'CD Dawn'], [/formerly CD Deluxe/i, 'CD Deluxe'], [/HF DAWN/i, 'HF Dawn'], [/HF[ -]?DELUXE/i, 'HF Deluxe'],
  [/ECO DELUXE/i, 'CD Deluxe'], [/ECO 100/i, 'Eco 100'], [/ECO 150/i, 'Eco 150'],
  [/DASH/i, 'Dash'], [/DAWN 125/i, 'Dawn 125'], [/DAWN 150/i, 'Dawn 150'], [/DAWN/i, 'Dawn 100'],
  [/SUPER SPLENDOR/i, 'Super Splendor'], [/PASSION PLUS/i, 'Passion Plus'], [/PASSION PRO/i, 'Passion Pro'],
  [/SPLENDOR NXG/i, 'Splendor NXG'], [/SPLENDOR PRO/i, 'Splendor Pro'], [/SPLENDOR\s*I(3S|SMART)/i, 'Splendor iSmart'], [/SPLENDOU?R\+|SPLENDOU?R PLUS/i, 'Splendor Plus'],
  [/PLEASURE ?\+|PLEASURE PLUS/i, 'Pleasure Plus'], [/PLEASURE/i, 'Pleasure'], [/GLAMOUR/i, 'Glamour'],
  [/MAESTRO[ _]EDGE/i, 'Maestro Edge 110'], [/MAESTRO/i, 'Maestro'], [/KARIZMA ZMR/i, 'Karizma ZMR'], [/XMR/i, 'Karizma XMR'], [/KARIZMA/i, 'Karizma'],
  [/HUNK|HUNTER/i, 'Hunk'], [/X440/i, 'Harley-Davidson X440'], [/IGNITOR/i, 'Ignitor'], [/DUET/i, 'Duet'], [/THRILLER/i, 'Thriller'],
  [/XPULSE.*200\s*T/i, 'Xpulse 200T'], [/XPULSE.*4V/i, 'Xpulse 200 4V'], [/XPULSE/i, 'Xpulse 200'], [/ACHIEVER/i, 'Achiever 150'],
];
const modelOf = (desc, base) => { for (const t of [desc, base || '']) for (const [rx, m] of MODEL_RULES) if (rx.test(t)) return m;
  return String(base || desc.replace(/\s*\(.*$/, '')).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); };
// the app's Hero model of a PDF edition: its folder in PDF > Models and its name
export function heroModel(folder, t) {
  const T = String(t || '').toUpperCase(), F = String(folder || '').toUpperCase(), h = rx => rx.test(T);
  switch (F) {
    case 'ACHIEVER': return 'Achiever 150';
    case 'CBZ': return 'CBZ Xtreme';
    case 'CD DAWN - CD DELUXE': return h(/FORMERLY CD DAWN/) ? 'CD Dawn' : h(/FORMERLY CD DELUXE/) ? 'CD Deluxe' : h(/HF DAWN/) ? 'HF Dawn' : h(/HF DELUXE/) ? 'HF Deluxe' : h(/DAWN 150/) ? 'Dawn 150' : h(/DAWN 125/) ? 'Dawn 125' : 'Dawn 100';
    case 'DASH': return 'Dash';
    case 'DESTINI': return h(/PRIME/) ? 'Destini Prime' : h(/\b110\b/) ? 'Destini 110' : 'Destini 125';
    case 'DUET': return 'Duet';
    case 'ECO': return h(/ECO 100/) ? 'Eco 100' : h(/ECO 150/) ? 'Eco 150' : 'Eco Deluxe';
    case 'GLAMOUR': return h(/XTEC/) ? 'Glamour Xtec' : 'Glamour';
    case 'HF': return h(/ECO DELUXE/) ? 'Eco Deluxe' : h(/HF[- ]?100/) ? 'HF 100' : h(/HF DAWN/) ? 'HF Dawn' : 'HF Deluxe';
    case 'HARLEY-DAVIDSON': return 'Harley-Davidson X440';
    case 'HUNK': return h(/THRILLER/) ? 'Thriller' : 'Hunk';
    case 'KARIZMA': return h(/XMR|FIGHTER|CENTENNIAL/) ? 'Karizma XMR' : h(/ZMR/) ? 'Karizma ZMR' : 'Karizma';
    case 'MAESTRO': return h(/EDGE.*125/) ? 'Maestro Edge 125' : h(/EDGE/) ? 'Maestro Edge 110' : 'Maestro';
    case 'MAVRICK': return 'Mavrick 440';
    case 'PASSION': return h(/HZ/) ? 'Passion HZ' : h(/X[ -]?PRO/) ? 'Passion X Pro' : h(/XTEC/) ? 'Passion Xtec' : h(/PRO/) ? 'Passion Pro' : 'Passion Plus';
    case 'PLEASURE': return h(/XTEC/) ? 'Pleasure Plus Xtec' : h(/PLUS|\+/) ? 'Pleasure Plus' : 'Pleasure';
    case 'SPLENDOR': return h(/NXG/) ? 'Splendor NXG' : h(/SPLENDOR PRO/) ? 'Splendor Pro' : h(/I3S\s*ISMART|ISMART/) ? 'Splendor iSmart' : h(/XTEC/) ? 'Splendor Plus Xtec' : 'Splendor Plus';
    case 'SUPER SPLENDOR': return 'Super Splendor';
    case 'VIDA': return h(/DIRT/) ? 'Vida Dirt.E K3' : h(/VX2/) ? 'Vida VX2' : h(/V2/) ? 'Vida V2' : 'Vida V1';
    case 'XOOM': return h(/160/) ? 'Xoom 160' : h(/125/) ? 'Xoom 125' : 'Xoom 110';
    case 'XPULSE': return h(/210/) ? 'Xpulse 210' : h(/200\s*T/) ? 'Xpulse 200T' : h(/4V/) ? 'Xpulse 200 4V' : 'Xpulse 200';
    case 'XTREME': return h(/250R/) ? 'Xtreme 250R' : h(/200S/) ? 'Xtreme 200S' : h(/200R/) ? 'Xtreme 200R' : h(/125/) ? 'Xtreme 125R' : h(/4V/) ? 'Xtreme 160R 4V' : h(/160R|STEALTH/) ? 'Xtreme 160R' : 'Xtreme 150';
  }
  return modelOf(t, folder);
}
// the PDF's 'Status / naya-purana no.' cell as the app's remark
export function remOf(st) {
  const s = String(st || ''), out = [], pn = x => (x.match(/[A-Z0-9][A-Z0-9-]{4,}/g) || []).filter(v => !/^(NOTSERVICEABLE|NLS)$/.test(v));
  if (/Non Current/i.test(s)) out.push('Non current (Hero)');
  if (/Not\s*serviceable/i.test(s)) out.push('No longer supplied (Hero)');
  const part = k => { const m = new RegExp(k + ':\\s*(.*?)(?=(?:Purana|Alt|Naya):|Chalu|Non Current|Hero cat|Public e-cat|$)', 'i').exec(s); return m ? pn(m[1].toUpperCase()) : []; };
  for (const x of part('Alt')) out.push('Alternate no. ' + x);
  for (const x of part('Purana')) out.push('Old no. ' + x);
  for (const x of part('Naya')) out.push('New no. ' + x);
  return out;
}
const normsOf = (desc, year, exp) => { if (exp) return 'EXP';
  if (/BS-?VI|BS6|OBD/i.test(desc)) return 'BS6'; if (/BS-?IV|BS4/i.test(desc)) return 'BS4';
  return year >= 2020 ? 'BS6' : year >= 2017 ? 'BS4' : 'BS3'; };

// the Hero line of the app's part number table (CAT_PNR), made as tools/build_public.py makes it
const PN_AL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pnPk = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pnShape = k => (k.match(/[A-Z]+|\d+/g) || []).map(m => (/\d/.test(m[0]) ? 'd' : 'a') + m.length).join('');
export function pnrOf(d) {
  const cnt = new Map(), firsts = new Map(), bits = new Uint8Array(162);
  for (const r of d.d) {
    const ks = [pnPk(r[5]), ...[...String(r[8] || '').matchAll(/(?:Alternate|Old|Probiking\)) no\. ([A-Z0-9][A-Z0-9-]{4,})/g)].map(m => pnPk(m[1]))];
    for (const k of ks) {
      if (!k) continue; const s = pnShape(k);
      cnt.set(s, (cnt.get(s) || 0) + 1); if (!firsts.has(s)) firsts.set(s, new Set()); firsts.get(s).add(k.slice(0, 2));
      for (let i = 0; i + 1 < k.length; i++) { const n = PN_AL.indexOf(k[i]) * 36 + PN_AL.indexOf(k[i + 1]); bits[n >> 3] |= 1 << (n & 7); }
    }
  }
  const t = [...cnt].sort((a, b) => b[1] - a[1]).map(([s, n]) => s + ':' + n + ':' + [...firsts.get(s)].sort().join('')).join(' ');
  return [t, Buffer.from(bits).toString('base64')];
}
// app.html with a brand's part number line replaced (11z: any brand made on the server, Hero and Honda)
export function patchApp(html, pnr, models = null, cnt = null, brand = 'Hero') {
  const B = brand.replace(/[^A-Za-z0-9 -]/g, ''), line = "'" + B + "':['" + pnr[0] + "','" + pnr[1] + "']";
  let out = html.replace(new RegExp("'" + B + "':\\['[^']*','[^']*'\\]"), () => line);
  if (out === html && !html.includes(line)) return null;
  // 11o: the Find Part model list (BRANDS_V) and the brand tile counts follow the made list (Harley-Davidson X440, Thriller, Dawn...)
  if (models && models.length) {
    // the two model lists: const BRANDS_V={...Hero:['..']...} and the later Object.assign(BRANDS_V,{..."Hero":[".."]...}); nothing else
    const near = (re, from) => { const k = out.indexOf(from); if (k < 0) return null; re.lastIndex = k; const m = re.exec(out); return m && m.index - k < 400000 ? m : null; };
    const m2 = near(new RegExp('"' + B + '":\\[("[^\\]]*")\\]', 'g'), 'Object.assign(BRANDS_V,{');
    const was = m2 ? JSON.parse('[' + m2[1] + ']') : [];   // the app's order first, new bikes after
    const at = m => { const i = was.indexOf(m); return i < 0 ? 1e6 : i; };
    models = models.map((m, i) => [m, i]).sort((x, y) => (at(x[0]) - at(y[0])) || (x[1] - y[1])).map(x => x[0]);
    if (m2) out = out.slice(0, m2.index) + '"' + B + '":' + JSON.stringify(models) + out.slice(m2.index + m2[0].length);
    const m1 = near(new RegExp('\\b' + B + ":\\['[^\\]]*'\\]", 'g'), 'const BRANDS_V={');
    if (m1) out = out.slice(0, m1.index) + B + ':' + JSON.stringify(models).replace(/'/g, "\\'").replace(/"/g, "'") + out.slice(m1.index + m1[0].length);
  }
  if (cnt) out = out.replace(new RegExp('"' + B + '":\\{"m":\\d+,"pn":\\d+\\}'), () => '"' + B + '":' + JSON.stringify(cnt));
  return out;
}
// out/app.html = the app with the lines of every brand made here (out/<slug>-app.json, written by each build); none: no app.html
export function writeApp(pub, out) {
  let html = fs.readFileSync(path.join(pub, 'app.html'), 'utf8'), n = 0;
  for (const f of fs.readdirSync(out).filter(f => f.endsWith('-app.json')).sort()) {
    try { const a = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')); const h = patchApp(html, a.pnr, a.models, a.cnt, a.brand); if (h) { html = h; n++; } }
    catch (e) { console.log('app lines of', f, 'not used:', e.message); }
  }
  const f = path.join(out, 'app.html');
  if (n) { fs.writeFileSync(f + '.tmp', html); fs.renameSync(f + '.tmp', f); } else fs.rmSync(f, { force: true });
  return n;
}

/* base: the app's Hero file + its diagram file; rawDir: the uploaded Raw Data folder; rawRel: that folder as pf: refs name it
   (catalogues/hero-raw). Returns { cat, dg, pnr, info } */
export function buildHero(base, baseDg, rawDir, rawRel = 'catalogues/hero-raw', opt = {}, pdfIx = null, pdfRel = 'catalogues/hero-pdf') {
  const zipIx = opt.zipIndex || zipIndex, jpg = opt.jpegSize || ((f, o, l) => { const fd = fs.openSync(f, 'r'); try { return jpegSize(fd, o, l); } finally { fs.closeSync(fd); } });
  const d = JSON.parse(JSON.stringify(base)), g = JSON.parse(JSON.stringify(baseDg));
  const models = JSON.parse(fs.readFileSync(path.join(rawDir, 'hero_hidden_models.json'), 'utf8'));
  const harvest = JSON.parse(fs.readFileSync(path.join(rawDir, 'hero_oldnew_harvest.json'), 'utf8'));
  const info = { editions: 0, skipped: [], newModels: [], rows: 0, diagrams: 0, noDiagram: 0, photos: 0, mrp: 0 };
  // old and new numbers
  const olds = new Map(), news = new Map();
  for (const [o, n] of harvest.supercedence || []) { if (!o || !n || o === n) continue;
    if (n !== 'NLS') { if (!olds.has(n)) olds.set(n, new Set()); olds.get(n).add(o); } if (!news.has(o)) news.set(o, new Set()); news.get(o).add(n); }
  // zips
  const dz = [], pz = [];
  for (const f of fs.readdirSync(rawDir).sort()) {
    if (/^hero_hidden_diagrams_\d+\.zip$/.test(f)) dz.push([f, zipIx(path.join(rawDir, f))]);
    else if (/^hero_hidden_photos_\d+\.zip$/.test(f)) pz.push([f, zipIx(path.join(rawDir, f))]);
  }
  const fig = new Map(); // groupNo -> pf ref
  for (const [f, ix] of dz) for (const [n, [o, l]] of ix) { const k = path.posix.basename(n).replace(/\.jpe?g$/i, ''); if (k !== n && !fig.has(k)) fig.set(k, `pf:${rawRel}/${f}:${o}:${l}`); }
  const figOf = gn => fig.get(gn) || fig.get(gn.replace(/_[^_]*$/, '')) || null;

  const have = new Set(d.vars.map(norm)), names = new Set(d.vars);
  const si = d.src.length; d.src.push(SRC);
  const bkOf = {}; const bk = n => { if (bkOf[n] == null) { bkOf[n] = d.bk.length; d.bk.push([si, n === 'EXP' ? [] : [n], n === 'EXP' ? 'Export model (not sold in India)' : '']); } return bkOf[n]; };
  const asmI = new Map(d.asm.map((a, i) => [a, i])), descI = new Map(d.desc.map((a, i) => [a, i]));
  const ai = a => { if (!asmI.has(a)) { asmI.set(a, d.asm.length); d.asm.push(a); } return asmI.get(a); };
  const di = a => { if (!descI.has(a)) { descI.set(a, d.desc.length); d.desc.push(a); } return descI.get(a); };
  const fIdx = new Map(g.f.map((f, i) => [f, i])); const fi = f => { if (!fIdx.has(f)) { fIdx.set(f, g.f.length); g.f.push(f); } return fIdx.get(f); };
  const rows = new Map(); // key -> row (vars merged)
  const usedPn = new Set();
  // the editions: each PDF in PDF > Models (its Raw Data model when it has one: same parts, with Hero's own diagram pictures), then any
  // Raw Data model no PDF has; domestic first, export below, newest first, as the app's list
  const pdfRef = (x, fg) => { const f = x.figs && x.figs[fg]; return f ? `pdf:${pdfRel}/${x.file}:0:${x.size}:${f[0]}:${f[1].join(',')}` : null; };
  let src = Object.values(models);
  if (pdfIx) {
    const byCode = new Map(Object.values(models).map(e => [e.model, e])), byName = new Map(Object.values(models).map(e => [norm(e.modelDesc), e])), used = new Set();
    src = pdfIx.eds.map(x => {
      const r = byCode.get(x.code) || (!x.code && byName.get(norm(x.title))); if (r) used.add(r);
      const figs = {}; for (const f of x.figs) figs[f[0]] = [f[2], f[3]];
      const e = r || { model: x.code, modelDesc: x.title, meta: { 'MODEL TYPE': x.export ? 'EXPORT' : 'DOMESTIC' }, modelDetails: { year: x.year, modelCC: x.cc },
        groups: x.figs.map(f => ({ groupNo: '', mapName: f[0], groupDesc: f[1], boms: (f[4] || []).map(b => ({ refno: b[0], component: b[1] === 'NOTSERVICEABLE' ? 'NOT SERVICEABLE' : b[1], partDesc: b[2], qty: b[3], price: String(b[4] || '').replace(/,/g, ''), status: b[5] })) })) };
      return { ...e, _pdf: { file: x.file, size: x.size, figs }, _model: heroModel(x.folder, x.title), _desc: x.title, _exp: x.export };
    }).concat(Object.values(models).filter(e => !used.has(e)));
  }
  const eds = src.map(e => {
    const desc = String(e._desc || e.modelDesc || (e.modelDetails && e.modelDetails.desc) || e.model || '').replace(/\s+/g, ' ').trim();
    const meta = e.meta || {}, year = +(e.modelDetails && e.modelDetails.year) || +(/(\d{4})/.exec(desc) || [])[1] || 0;
    const exp = e._exp != null ? e._exp : meta['MODEL TYPE'] ? meta['MODEL TYPE'] === 'EXPORT' : EXPORT_RX.test(desc);
    return { e, desc, meta, year, exp, cc: parseInt((e.modelDetails && e.modelDetails.modelCC) || '', 10) || 0 };
  }).sort((a, b) => (a.exp - b.exp) || (b.year - a.year));
  for (const x of eds) {
    const { e, desc, meta, year, exp } = x;
    if (!desc || have.has(norm(desc)) || (formerly(desc) && have.has(norm(formerly(desc))))) { info.skipped.push(desc); continue; }
    let name = exp && !/export|\bexp\b/i.test(desc) ? (desc.includes(' (') ? desc.replace(' (', ' export (') : desc + ' export') : desc;
    if (have.has(norm(name))) { info.skipped.push(desc); continue; }
    if (names.has(name)) name += ' ' + (e.modelCode || meta['MODEL CODE'] || e.model);
    const model = e._model || modelOf(desc, meta['BASE MODEL']);
    if (!d.models.includes(model)) { const o = d.models.indexOf(OTHER); if (o < 0) d.models.push(model); else d.models.splice(o, 0, model); info.newModels.push(model); } // before 'Other parts (price list)'
    if (d.cc[model] == null && x.cc) d.cc[model] = x.cc;
    const vi = d.vars.length; d.vars.push(name); d.vmod[name] = model; names.add(name);
    const b = bk(normsOf(desc, year, exp)), pg = {}; let seen = new Set();
    for (const grp of e.groups || []) {
      let fg = String(grp.mapName || grp.groupNo || '').trim(); if (!fg) continue;
      if (seen.has(fg) && grp.groupNo) { const g = String(grp.groupNo).split('_')[0]; if (g.startsWith(fg + '-') && !seen.has(g)) fg = g; } // F-18 DISC + DRUM: F-18-DISC, F-18-DRUM
      for (let k = 2; seen.has(fg); k++) fg = String(grp.mapName) + ' (' + k + ')';
      seen.add(fg);
      const ref = (grp.groupNo && figOf(String(grp.groupNo))) || (e._pdf && pdfRef(e._pdf, String(grp.mapName || '').trim())); if (ref) { pg[fg] = fi(ref); info.diagrams++; } else info.noDiagram++;
      const a = ai(String(grp.groupDesc || '').trim().toUpperCase());
      for (const m of grp.boms || []) {
        const pn = String(m.component || '').trim().toUpperCase(); if (!pn) continue;
        const rem = [];
        if (m.serviceability === 'N') rem.push('No longer supplied (Hero)');
        if (m.alternateComponent) rem.push('Alternate no. ' + String(m.alternateComponent).trim().toUpperCase());
        if (m.status) for (const x of remOf(m.status)) if (!rem.includes(x)) rem.push(x);
        for (const o of olds.get(pn) || []) if (!rem.includes('Old no. ' + o)) rem.push('Old no. ' + o);
        for (const n of news.get(pn) || []) if (!rem.includes('New no. ' + n)) rem.push('New no. ' + n);
        const r = [b, ref ? -1 : -2, fg, a, String(m.refno ?? ''), pn, di(String(m.partDesc || '').trim()), String(m.qty ?? ''), rem.join('; '), pn === 'NOT SERVICEABLE' ? 1 : 0, 0];
        const key = r.join('\u0001'); const o = rows.get(key);
        if (o) { if (o[11][o[11].length - 1] !== vi) o[11].push(vi); } else { r.push([vi]); rows.set(key, r); }
        usedPn.add(pn);
        const pr = Math.round(+m.price); if (pr > 0 && d.mrp[pn] == null) { d.mrp[pn] = pr; info.mrp++; }
      }
    }
    g.p[String(vi)] = pg; info.editions++;
  }
  for (const r of rows.values()) d.d.push(r);
  info.rows = rows.size;
  // the other numbers in Hero's parts search list: their MRP, and those no list has yet as 'Other parts (price list)' (no diagram)
  const inList = new Set(d.d.map(r => r[5])), extra = [];
  for (const s of harvest.searchParts || []) { const pn = String(s[0] || '').trim().toUpperCase(), pr = Math.round(+s[2]);
    if (pn && pr > 0 && d.mrp[pn] == null) { d.mrp[pn] = pr; info.mrp++; }
    if (pn && !inList.has(pn)) { inList.add(pn); extra.push([pn, String(s[1] || '').trim(), String(s[4] || '').trim()]); } }
  if (extra.length) {
    if (!d.models.includes(OTHER)) d.models.push(OTHER);
    const name = 'Hero parts search list (Raw Data)', vi = d.vars.length; d.vars.push(name); d.vmod[name] = OTHER; g.p[String(vi)] = {};
    const b = d.bk.length; d.bk.push([si, [], "Parts from Hero's parts search list (Raw Data) that no edition has: no diagram"]); const a = ai('PRICE LIST');
    for (const [pn, ds, alt] of extra) d.d.push([b, -2, '', a, '', pn, di(ds), '', alt && alt !== 'null' && alt !== pn ? 'Alternate no. ' + alt.toUpperCase() : '', 0, 0, [vi]]);
    info.priceListOnly = extra.length;
  }
  // part photos (each number's own photo; a number that already has one keeps it)
  if (!d.phf) d.phf = {}; if (!d.phz) d.phz = [];
  for (const [f, ix] of pz) {
    const zi = d.phz.length; let used = 0; const zf = path.join(rawDir, f);
    {
      for (const [n, [o, l]] of ix) {
        const pn = path.posix.basename(n).replace(/\.jpe?g$/i, '').trim().toUpperCase();
        if (pn === path.posix.basename(n).toUpperCase() || d.phf[pn]) continue;
        if (!usedPn.has(pn) && d.mrp[pn] == null) continue;
        const [w, h] = jpg(zf, o, l, n); if (!w) continue;
        d.phf[pn] = [zi, o, l, w, h]; used++;
      }
    }
    if (used) { d.phz.push(`${rawRel}/${f}`); info.photos += used; }
  }
  return { cat: d, dg: g, pnr: pnrOf(d), info };
}

// run as its own process (node lib/herobuild.mjs <public dir> <raw dir> <out dir>), so a build never holds up the server
export function writeHero(pub, rawDir, out, pdfDir = null) {
  const t = Date.now();
  const rd = (f, e) => { try { return JSON.parse(fs.readFileSync(path.join(pub, 'cat', f), 'utf8')); } catch (x) { if (x.code === 'ENOENT') return e(); throw x; } };
  const base = rd('hero.json', EMPTY_HERO), bdg = rd('hero-dg.json', EMPTY_HERO_DG);
  let ix = null; try { if (pdfDir) ix = JSON.parse(fs.readFileSync(path.join(pdfDir, 'hero_pdf_index.json'), 'utf8')); } catch (x) { if (x.code !== 'ENOENT') throw x; }
  const r = buildHero(base, bdg, rawDir, 'catalogues/hero-raw', {}, ix);
  fs.mkdirSync(out, { recursive: true });
  const put = (n, s) => { fs.writeFileSync(path.join(out, n + '.tmp'), s); fs.renameSync(path.join(out, n + '.tmp'), path.join(out, n)); };
  put('hero-dg.json', JSON.stringify(r.dg)); put('hero.json', JSON.stringify(r.cat));
  const ms = r.cat.models.filter(m => m !== OTHER), pns = new Set(r.cat.d.map(x => x[5]));
  put('hero-app.json', JSON.stringify({ brand: 'Hero', pnr: r.pnr, models: ms, cnt: { m: ms.length, pn: pns.size } }));
  writeApp(pub, out);
  const { skipped, ...info } = r.info;
  put('hero-build.json', JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - t, ...info, skipped }));
  return r.info;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { const i = writeHero(process.argv[2], process.argv[3], process.argv[4], process.argv[5]); console.log('hero build:', i.editions, 'editions,', i.rows, 'rows,', i.diagrams, 'diagrams,', i.photos, 'photos'); }
  catch (e) { console.error('hero build failed:', e.message); process.exit(1); }
}
