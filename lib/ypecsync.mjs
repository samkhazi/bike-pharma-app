// update 19l (Sam 2026-11-10: "YPEC se hi ... number ki jagah", his own dealer login): Yamaha's dealer parts catalogue (YPEC) keeps, for every
// diagram, the place of every ref number on its picture. This reads them the way YPEC's own page does, with the dealer login of the site's .env:
//   model code  -> POST control/specification/ListModelSelection (search by model label)      -> the code's rows (year, product, colour)
//   one row     -> POST services/html5/catalog_index                                           -> its diagrams (figNo, name, picture) + catalogue no.
//   one diagram -> POST services/html5/catalog_text                                            -> parts (ref, number, name, qty, new number) + number places
// Kept in <hero-sync>/yamaha/ypec/: models/<code>.json, img/<picture>.PNG (as YPEC sends it, untouched), coords.json {picture: [w, h, [[ref, x0, y0, x1, y1]]]}
// (pixels of that picture), done.json. No price is read or kept (MRP comes from Yamaha's MRP list). One request at a time with a pause; a model
// already read is only read again when YPEC's catalogue number for it changed. Run as the site user:
//   node lib/ypecsync.mjs [hero-sync dir] [yamaha upload dir] [--codes D704,DM49] [--limit 5] [--all]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const refTok = r => { const s = String(r ?? '').trim().toUpperCase(); return /^\d+$/.test(s) ? String(+s) : s; };   // '01' -> '1', as the books print it
export const picFile = ill => String(ill || '').replace(/[^A-Za-z0-9._-]/g, '_') + '.PNG';
export function picSize(b) {   // [w, h] of a PNG, GIF or JPEG
  if (!b || b.length < 24) return [0, 0];
  if (b[0] === 0x89) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0x47) return [b.readUInt16LE(6), b.readUInt16LE(8)];
  for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); }
  return [0, 0];
}
// the rows of a model list page: [modelBaseCode, modelTypeCode, modelYear, productNo, colorType, modelName, colorName]
export const listRows = h => [...String(h).matchAll(/onKeyHtml5\(\s*'[^']*',\s*'([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','[^']*'/g)].map(m => m.slice(1, 8));
export const pickRow = (rows, code) => rows.filter(r => r[1] === code).sort((a, b) => String(b[2]).localeCompare(String(a[2])) || String(a[3]).localeCompare(String(b[3])) || String(a[4]).localeCompare(String(b[4])))[0] || null;
// the codes of Sam's Yamaha books (uploaded list + the weekly sync's books)
export function bookCodes(yamahaDir, syncDir) {
  const s = new Set(), rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  for (const b of ((rj(path.join(yamahaDir, 'yamaha_build.json')) || {}).books || [])) for (const c of b.codes || []) s.add(c);
  for (const b of Object.values((rj(path.join(syncDir, 'yamaha', 'state.json')) || {}).books || {})) for (const c of (b && b.codes) || []) s.add(c);
  return [...s].filter(c => /^[A-Z0-9]{3,4}$/.test(c)).sort();
}

export async function ypecSync(o = {}) {
  const say = o.log || console.log, sleep = ms => new Promise(r => setTimeout(r, ms)), wait = o.wait ?? 700;
  const dir = path.join(o.syncDir, 'yamaha', 'ypec'), mdir = path.join(dir, 'models'), idir = path.join(dir, 'img');
  fs.mkdirSync(mdir, { recursive: true }); fs.mkdirSync(idir, { recursive: true });
  const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const put = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); };
  const lock = path.join(dir, 'run.lock');
  try { const l = rj(lock); if (l && Date.now() - l.at < 6 * 3600e3 && l.pid !== process.pid) { try { process.kill(l.pid, 0); say('already running (pid ' + l.pid + ')'); return { running: true }; } catch (e) {} } } catch (e) {}
  put(lock, { pid: process.pid, at: Date.now() });
  const { _ypec } = await import('./vinlook.mjs');
  const B = _ypec.base(), UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
  const REF = B + '/ypec/html5/app/en/parts-search/app/catalog_index.html';
  let jar = null;
  const login = async () => { const l = await _ypec.login(); if (l.error) throw new Error(l.error); jar = l.jar; };
  const cookie = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
  const api = async (name, body) => {   // one of YPEC's JSON calls; an empty answer = logged out: one new login, one more try
    for (let t = 0; t < 2; t++) {
      await sleep(wait);
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000); let txt = '';
      try { const r = await fetch(B + '/ypec/services/html5/' + name, { method: 'POST', body: JSON.stringify(body), signal: ac.signal, headers: { 'User-Agent': UA, 'Content-Type': 'application/json',
        Accept: 'application/json, text/javascript, */*; q=0.01', 'Accept-Language': 'en-US,en;q=0.9', 'X-Requested-With': 'XMLHttpRequest', Referer: REF, Origin: B, Cookie: cookie() } }); txt = await r.text(); }
      catch (e) { txt = ''; } finally { clearTimeout(to); }
      try { const j = JSON.parse(txt); if (j && typeof j === 'object') return j; } catch (e) {}
      if (!t) await login();
    }
    return null;
  };
  const list = async code => {
    for (let t = 0; t < 2; t++) {
      await sleep(wait);
      const h = await _ypec.req(jar, B + '/ypec/control/specification/ListModelSelection', { modelName: '', modelYearFrom: '', modelYearTo: '', modelTypeCode: code, productNo: '', colorType: '', prefixNo: '', serialNo: '',
        frameNo: '', engineNo: '', Operation: '', actionType: 'modelLabel', SearchFlg: ' ', baseCode: process.env.YPEC_BASE_CODE || '', prodCategory: '10', confirmId: '', pmpDisplayFlg: '0', pdfDisFlg: '1' });
      const rows = listRows(h); if (rows.length || !/log\s*in again|password/i.test(h) || t) return { rows, lang: (/name=["']?langId["']?[^>]*value=["']([^"']*)/i.exec(h) || [])[1] || '02' };
      await login();
    }
    return { rows: [], lang: '02' };
  };
  const coordsF = path.join(dir, 'coords.json'), coords = rj(coordsF) || {};
  const st = { models: 0, read: 0, same: 0, none: 0, failed: 0, figs: 0, pics: 0, places: 0 };
  const publish = () => { put(coordsF, coords); put(path.join(dir, 'done.json'), { at: new Date().toISOString(), ...st, pictures: Object.keys(coords).length, modelsOnDisk: fs.readdirSync(mdir).filter(f => f.endsWith('.json')).length }); };
  let codes = o.codes && o.codes.length ? o.codes : bookCodes(o.yamahaDir, o.syncDir);
  if (o.limit) codes = codes.slice(0, o.limit);
  say('YPEC: ' + codes.length + ' model codes');
  await login();
  let bad = 0;
  try {
    for (const code of codes) {
      st.models++;
      try {
        const mf = path.join(mdir, code + '.json'), old = rj(mf);
        const { rows, lang } = await list(code), r = pickRow(rows, code);
        if (!r) { st.none++; put(mf, { code, none: true, fetched: new Date().toISOString() }); continue; }
        const base = { modelBaseCode: r[0], modelTypeCode: r[1], modelYear: r[2], productNo: r[3], colorType: r[4], catalogLangId: lang, calledCode: '2', modelName: r[5].replace(/\\n/g, '\n') };
        const ix = await api('catalog_index', base);
        if (!ix || !Array.isArray(ix.figDataCollection) || !ix.figDataCollection.length) { st.failed++; if (++bad >= 8) throw new Error('YPEC gives no diagram lists: stopped'); say(code + ': no diagram list'); continue; }
        bad = 0;
        if (!o.all && old && old.catalogNo === ix.catalogNo && old.year === r[2] && (old.figs || []).length === ix.figDataCollection.length && old.figs.every(f => !f.ill || coords[picFile(f.ill)] || f.nohot)) { st.same++; continue; }
        const m = { code, year: r[2], productNo: r[3], colorType: r[4], name: String(ix.modelName || r[5]).replace(/\\n|\n/g, ' '), catalogNo: ix.catalogNo, fetched: new Date().toISOString(), figs: [] };
        for (const f of ix.figDataCollection) {
          const tx = await api('catalog_text', { ...base, catalogNo: ix.catalogNo, illustNo: f.illustNo, figNo: f.figNo, figBranchNo: f.figBranchNo, refNo: '', partNo: '', openMode: '', importOption: '' });
          const fg = { no: f.figNo, br: f.figBranchNo, name: f.figName, ill: f.illustNo, parts: [] };
          if (!tx) { fg.failed = true; m.figs.push(fg); continue; }
          fg.parts = (tx.partsDataCollection || []).map(p => [refTok(p.refNo), String(p.partNo || ''), String(p.partName || ''), p.quantity ?? '', String(p.fsupersessionPno || ''), String(p.remarks || '')]);
          const hs = (tx.hotspotDataCollection || []).filter(h => [h.startPointX, h.startPointY, h.endPointX, h.endPointY].every(v => typeof v === 'number'));
          const pf = picFile(f.illustNo), pp = path.join(idir, pf);
          if (f.illustNo && f.illustFileURL && !fs.existsSync(pp)) {
            await sleep(wait);
            try { const pr = await fetch(new URL(f.illustFileURL, B).toString(), { headers: { 'User-Agent': UA, Referer: REF, Cookie: cookie() } }); const buf = Buffer.from(await pr.arrayBuffer());
              if (pr.ok && picSize(buf)[0] > 0) { fs.writeFileSync(pp + '.tmp', buf); fs.renameSync(pp + '.tmp', pp); st.pics++; } } catch (e) {}
          }
          if (!hs.length) fg.nohot = true;
          else if (fs.existsSync(pp)) {
            const [w, h] = picSize(fs.readFileSync(pp)), have = coords[pf] && coords[pf][0] === w ? coords[pf][2] : [], key = p => p.join(',');
            const seen = new Set(have.map(key)), add = hs.map(h => [refTok(h.refNo), h.startPointX, h.startPointY, h.endPointX, h.endPointY]).filter(p => !seen.has(key(p)) && seen.add(key(p)));
            if (w > 0 && h > 0) { coords[pf] = [w, h, have.concat(add)]; st.places += add.length; }
          }
          m.figs.push(fg); st.figs++;
        }
        put(mf, m); st.read++;
        say(code + ' ' + m.name + ' ' + m.year + ': ' + m.figs.length + ' diagrams (' + st.models + '/' + codes.length + ')');
      } catch (e) { if (/stopped$/.test(e.message)) throw e; st.failed++; say(code + ': ' + e.message); if (++bad >= 8) throw new Error('too many failures in a row: stopped'); }
      if (st.models % 10 === 0) publish();
    }
  } finally { publish(); try { fs.unlinkSync(lock); } catch (e) {} }
  say('YPEC done: ' + JSON.stringify(st));
  return st;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
  const a = process.argv.slice(2), flag = n => { const i = a.indexOf(n); return i < 0 ? null : a[i + 1]; }, pos = a.filter((x, i) => !x.startsWith('--') && !['--codes', '--limit'].includes(a[i - 1]));
  const files = path.resolve(ROOT, process.env.FILES_DIR || path.join(process.env.DATA_DIR || 'data', 'project-files'));
  ypecSync({ syncDir: pos[0] || path.join(files, 'catalogues', 'hero-sync'), yamahaDir: pos[1] || path.join(files, 'catalogues', 'yamaha'),
    codes: (flag('--codes') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean), limit: +(flag('--limit') || 0), all: a.includes('--all'),
    log: (...x) => console.log(new Date().toISOString().slice(11, 19), ...x) })
    .then(() => process.exit(0), e => { console.error('YPEC sync failed:', e.message); process.exit(1); });
}
