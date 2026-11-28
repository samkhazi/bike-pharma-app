// update 19l (Sam 2026-11-10: "YPEC se hi ... number ki jagah", his own dealer login): Yamaha's dealer parts catalogue (YPEC) keeps, for every
// diagram, the place of every ref number on its picture. This reads them the way YPEC's own page does, with the dealer login of the site's .env:
//   model code  -> POST control/specification/ListModelSelection (search by model label)      -> the code's rows (year, product, colour)
//   one row     -> POST services/html5/catalog_index                                           -> its diagrams (figNo, name, picture) + catalogue no.
//   one diagram -> POST services/html5/catalog_text                                            -> parts (ref, number, name, qty, new number) + number places
// Kept in <hero-sync>/yamaha/ypec/: models/<code>.json, img/<picture>.PNG (as YPEC sends it, untouched), coords.json {picture: [w, h, [[ref, x0, y0, x1, y1]]]}
// (pixels of that picture), done.json. No price is read or kept (MRP comes from Yamaha's MRP list). One request at a time with a pause; a model
// already read is only read again when YPEC's catalogue number for it changed. Run as the site user:
//   node lib/ypecsync.mjs [hero-sync dir] [yamaha upload dir] [--codes D704,DM49] [--limit 5] [--all] [--books-only] [--no-colours] [--no-pdf] [--pdf-books = only the scanned PDF books]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
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
// the whole model list page: codes that have a diagram link (onKeyHtml5), and the models that have only the PDF sign (onPdf)
export function listParse(h) {
  h = String(h || '');
  const args = x => [...x.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]), ok = c => /^[A-Z0-9]{3,4}$/.test(c);
  const link = new Set(listRows(h).map(r => String(r[1] || '').trim().toUpperCase()).filter(ok));
  // 23q: the arguments are read as quoted strings, so a model name with a bracket in it ('FZ-S (FI)') no longer cuts its row short (12 of 2059 rows were not counted)
  const pdf = [...h.matchAll(/onPdf\(\s*((?:'(?:[^'\\]|\\.)*'\s*,?\s*)+)\)/g)].map(m => args(m[1])).filter(a => a.length >= 6), seen = new Set(), pdfOnly = [];
  for (const a of pdf) { const c = String(a[1] || '').trim().toUpperCase(); if (!ok(c) || link.has(c) || seen.has(c)) continue; seen.add(c); pdfOnly.push({ code: c, year: a[2], productNo: a[3], colorType: a[4], name: String(a[5]).replace(/\\n/g, ' / '), a }); }
  return { codes: [...link].sort(), pdfOnly, pdfs: pdf.length, said: (/(\d+)\s*record\(s\)\s*found/i.exec(h) || [])[1] || '' };
}
// the colour types of one model code in its list rows (the year of the row the sync reads): [{ t, name, products, r }] sorted by type; r = that
// colour's row with the first row's product code when it has one
export function colourTypes(rows, code, r0) {
  const m = new Map();
  for (const r of rows) { if (r[1] !== code || r[2] !== r0[2]) continue; let c = m.get(r[4]); if (!c) m.set(r[4], c = { t: r[4], name: String(r[6] || '').trim(), products: [], r }); if (!c.products.includes(r[3])) c.products.push(r[3]); if (r[3] === r0[3]) c.r = r; }
  return [...m.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
}
// 24r (Sam 2026-11-27: the News column of a YPEC parts list, Parts News PDFs with the kits): a part row's news number and its PDF's address
// (kept apart from the parts, so the colour check above compares only parts). NV: the model files read with these; older ones are read again once
export const NV = 1;
export const txNews = tx => { const by = {}, url = {}; for (const p of tx.partsDataCollection || []) { const n = String(p.partsNewsNo || '').trim(); if (!n || !p.partNo) continue; (by[n] ||= []).includes(String(p.partNo)) || by[n].push(String(p.partNo)); if (p.partNewsURL) url[n] = String(p.partNewsURL); } return { by, url }; };
export const newsFile = n => String(n || '').replace(/[^A-Za-z0-9._-]/g, '_') + '.PDF';
export const txParts = tx => (tx.partsDataCollection || []).map(p => [refTok(p.refNo), String(p.partNo || ''), String(p.partName || ''), p.quantity ?? '', String(p.fsupersessionPno || ''), String(p.remarks || '')]);
// one diagram of another colour against the first colour's: null = the same parts; else its parts (a diagram the first colour does not have keeps its name + picture)
export function colourDiff(figs, f, tx) {
  const parts = txParts(tx), bf = figs.find(g => g.no === f.figNo && g.br === f.figBranchNo);
  if (!bf) return { name: f.figName, ill: f.illustNo, parts };
  return JSON.stringify(bf.parts) === JSON.stringify(parts) ? null : parts;
}
// 23q: the PDF window of a model (ListPdfSelection): its books [[catalogue no., address]]
export const pdfLinks = h => { const out = [], seen = new Set(); for (const m of String(h || '').matchAll(/["'](https?:\/\/[^"'\s<>]+\/([A-Za-z0-9_-]+)\.pdf)["']/gi)) { const k = m[2].toUpperCase(); if (!seen.has(k)) { seen.add(k); out.push([k, m[1].replace(/&amp;/g, '&')]); } } return out; };
// the page count of a PDF: poppler's pdfinfo when the server has it, else the /Count of its page tree
export function pdfPages(file) {
  try { const t = execFileSync('pdfinfo', [file], { maxBuffer: 1 << 22, stdio: ['ignore', 'pipe', 'ignore'] }).toString(), m = /^Pages:\s*(\d+)/m.exec(t); if (m && +m[1] > 0) return +m[1]; } catch (e) {}
  try { const b = fs.readFileSync(file).toString('latin1'); let n = 0; for (const m of b.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) n = Math.max(n, +(m[1] || m[2])); return n; } catch (e) { return 0; }
}
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
  // 23m/23n (Sam 2026-11-16: YPEC lists 2059 records back to 1985, RX100 36L0, RX135 4TL1 ... 'hamare paas q nhi aaye'): every model YPEC's model
  // list has, asked as Sam does it on the page: Model Name '*' with Model Year 1985 to next year, ONE request (a blank name or one year at a time
  // gives YPEC's error page; seen on the real site 2026-11-17). A row with a diagram link is read like a book code; a row with only the PDF sign
  // (RX100, RX135, Crux ...: scanned PDF books, no diagram data) is only noted in pdfonly.json.
  const listAll = async () => {
    const y1 = new Date().getFullYear() + 1; let h = '';
    for (let t = 0; t < 3; t++) {
      await sleep(wait);
      try { h = String(await _ypec.req(jar, B + '/ypec/control/specification/ListModelSelection', { modelName: '*', modelYearFrom: '1985', modelYearTo: String(y1), modelTypeCode: '', productNo: '', colorType: '', prefixNo: '', serialNo: '',
        frameNo: '', engineNo: '', Operation: '', actionType: 'modelName', SearchFlg: ' ', baseCode: process.env.YPEC_BASE_CODE || '', prodCategory: '10', confirmId: '', pmpDisplayFlg: '0', pdfDisFlg: '1' }, 120000)); } catch (e) { h = ''; say('YPEC model list: ' + e.message); }
      if (listRows(h).length) break;
      await login();
    }
    const { codes, pdfOnly, said, pdfs } = listParse(h);
    say('YPEC model list: ' + pdfs + ' models' + (said ? ' (YPEC says ' + said + ')' : '') + ', ' + codes.length + ' model codes with diagrams, ' + pdfOnly.length + ' with only a PDF book' + (said && +said !== pdfs ? '  << not all rows came' : ''));
    if (!codes.length) throw new Error('YPEC gave no model list');
    put(path.join(dir, 'pdfonly.json'), { at: new Date().toISOString(), models: pdfOnly });
    pdfList = pdfOnly;
    return codes;
  };
  // 23q (Sam 2026-11-18 'haan': the 42 old model codes YPEC has only as a scanned PDF book, RX100 / RX135 / Crux ...): their books are downloaded once
  // into ypec/pdf/<catalogue no.>.PDF as YPEC sends them (one copy per catalogue no., however many model codes share it) and listed in
  // pdfbooks.json { books: {catNo: {file, size, pages}}, models: {code: {name, year, cats: [catNo]}} }. The app shows their pages (lib/yamahabuild.mjs).
  const pdfBooks = async list => {
    const pdir = path.join(dir, 'pdf'), xf = path.join(dir, 'pdfbooks.json'), x = rj(xf) || {}; x.books ||= {}; x.models ||= {}; fs.mkdirSync(pdir, { recursive: true });
    const good = c => { const b = x.books[c]; if (!b || !(b.pages > 0)) return false; try { return fs.statSync(path.join(pdir, b.file)).size === b.size; } catch (e) { return false; } };
    say('YPEC PDF books: ' + list.length + ' model codes'); let n = 0, badP = 0;
    for (const m of list) {
      n++; const a = m.a || []; if (a.length < 6) continue;
      try {
        const old = x.models[m.code];
        if (!o.all && old && (old.cats || []).length && old.cats.every(good)) { st.pdfSame++; continue; }
        await sleep(wait);
        const body = { modelBaseCode: a[0], modelTypeCode: a[1], modelYear: a[2], productNo: a[3], colorType: a[4], modelName: String(a[5]).replace(/\\n/g, '\n'), colorName: a[6] || '', prodPictureNo: a[7] || '', langId: '02', searchType: 'modelName', sesLangId: '02', calledCode: '', periodicMaintePartsFlg: '', productId: '', prefixNo: '', serialNo: '' };
        let h = String(await _ypec.req(jar, B + '/ypec/control/catalogue/ListPdfSelection', body)), links = pdfLinks(h);
        if (!links.length && /log\s*in again|password/i.test(h)) { await login(); h = String(await _ypec.req(jar, B + '/ypec/control/catalogue/ListPdfSelection', body)); links = pdfLinks(h); }
        if (!links.length) { st.pdfFail++; say(m.code + ' ' + m.name + ': no PDF book in its window'); if (++badP >= 8) throw new Error('YPEC gives no PDF books: stopped'); continue; }
        const cats = [];
        for (const [cat, url] of links.slice(0, 6)) {
          if (good(cat)) { cats.push(cat); continue; }
          await sleep(wait);
          const file = cat + '.PDF', fp = path.join(pdir, file), same = (() => { try { return new URL(url).host === new URL(B).host; } catch (e) { return false; } })(),   // the books sit on another Yamaha host: the login cookie stays with YPEC, as in a browser
            ac = new AbortController(), to = setTimeout(() => ac.abort(), 180000); let pr, buf;
          try { pr = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': UA, Referer: B + '/', ...(same ? { Cookie: cookie() } : {}) } }); buf = Buffer.from(await pr.arrayBuffer()); } finally { clearTimeout(to); }
          if (!pr.ok || buf.slice(0, 4).toString('latin1') !== '%PDF') { say(m.code + ': book ' + cat + ' did not come (' + pr.status + ')'); continue; }
          fs.writeFileSync(fp + '.tmp', buf); fs.renameSync(fp + '.tmp', fp);
          const pages = pdfPages(fp); if (!(pages > 0)) { say(m.code + ': book ' + cat + ' has no readable page count'); continue; }
          x.books[cat] = { file, size: buf.length, pages }; cats.push(cat); st.pdfBooks++; st.pdfBytes += buf.length;
        }
        if (!cats.length) { st.pdfFail++; if (++badP >= 8) throw new Error('YPEC PDF books do not download: stopped'); continue; }
        badP = 0; x.models[m.code] = { name: m.name, year: m.year, cats }; st.pdfModels++; x.at = new Date().toISOString(); put(xf, x);
        say(m.code + ' ' + m.name + ' ' + m.year + ': ' + cats.map(c => c + ' (' + x.books[c].pages + ' pages)').join(', ') + ' (' + n + '/' + list.length + ')');
      } catch (e) { if (/stopped$/.test(e.message)) throw e; st.pdfFail++; say(m.code + ' PDF book: ' + e.message); if (++badP >= 8) throw new Error('too many failures in a row: stopped'); }
    }
    x.at = new Date().toISOString(); put(xf, x);
  };
  let pdfList = null;
  // 24r: every Parts News PDF a model's parts list points to, once (YPEC's own address for it, the dealer login's cookie); kept in ypec/news/
  const newsPdfs = async () => {
    const ndir = path.join(dir, 'news'); fs.mkdirSync(ndir, { recursive: true });
    const want = new Map(); for (const f of fs.readdirSync(mdir)) { if (!f.endsWith('.json')) continue; const m = rj(path.join(mdir, f)); for (const [n, u] of Object.entries((m && m.news) || {})) if (!want.has(n)) want.set(n, u); }
    // some news are web pages, not PDFs (no kit table to read): noted in news-skip.json and not asked again
    const skipF = path.join(ndir, 'news-skip.json'), skip = rj(skipF) || {};
    let got = 0, bad = 0, html = 0; st.news = want.size;
    for (const [n, u] of want) {
      const fp = path.join(ndir, newsFile(n)); if (fs.existsSync(fp) || skip[n]) continue;
      let url; try { url = new URL(u, B); } catch (e) { continue; } if (!/^https:$/.test(url.protocol) || !/(^|\.)yamaha-motor\.co\.jp$/i.test(url.hostname)) continue;   // only Yamaha's own server
      await sleep(wait);
      try { const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
        const r = await fetch(url.toString(), { signal: ac.signal, headers: { 'User-Agent': UA, Referer: REF, Cookie: cookie() } }).finally(() => clearTimeout(to)); const buf = Buffer.from(await r.arrayBuffer());
        if (r.ok && buf.subarray(0, 5).toString() === '%PDF-') { fs.writeFileSync(fp + '.tmp', buf); fs.renameSync(fp + '.tmp', fp); got++; bad = 0; }
        else if (r.ok && /^\s*</.test(buf.subarray(0, 64).toString())) { skip[n] = 'html'; html++; bad = 0; }
        else if (++bad >= 8) { say('Parts News PDFs do not download: stopped'); break; }
      } catch (e) { if (++bad >= 8) { say('Parts News PDFs do not download: stopped'); break; } }
    }
    put(skipF, skip); st.newsGot = got; st.newsHtml = html; say('YPEC Parts News: ' + want.size + ' news, ' + got + ' new PDF(s), ' + html + ' web page(s) skipped');
  };
  const coordsF = path.join(dir, 'coords.json'), coords = rj(coordsF) || {};
  const st = { models: 0, read: 0, same: 0, none: 0, failed: 0, figs: 0, pics: 0, places: 0, colModels: 0, colRead: 0, colSame: 0, colFail: 0, pdfModels: 0, pdfBooks: 0, pdfSame: 0, pdfFail: 0, pdfBytes: 0 };
  const publish = () => { if (o.pdfOnly) { const df = path.join(dir, 'done.json'); put(df, { ...(rj(df) || {}), pdfAt: new Date().toISOString(), pdfModels: st.pdfModels, pdfBooks: st.pdfBooks, pdfSame: st.pdfSame, pdfFail: st.pdfFail }); return; }   // 23q: a books-only run keeps the last full run's numbers (the new file time makes the app's Yamaha catalogue build again)
    put(coordsF, coords); put(path.join(dir, 'done.json'), { at: new Date().toISOString(), ...st, pictures: Object.keys(coords).length, modelsOnDisk: fs.readdirSync(mdir).filter(f => f.endsWith('.json')).length }); };
  let codes = o.codes && o.codes.length ? o.codes : bookCodes(o.yamahaDir, o.syncDir);
  if (o.limit) codes = codes.slice(0, o.limit);
  say('YPEC: ' + codes.length + ' model codes');
  await login();
  if (!(o.codes && o.codes.length) && !o.limit && !o.booksOnly && !o.newsOnly && !o.pdfOnly) { try { const have = new Set(codes), more = (await listAll()).filter(c => !have.has(c)); st.listOnly = more.length; say('YPEC: ' + more.length + ' model codes with no book here'); codes = codes.concat(more); } catch (e) { say('YPEC model list not read: ' + e.message); st.listFail = e.message; } }
  if (o.pdfOnly) { codes = []; o = { ...o, noColours: true }; }
  if (o.newsOnly) { codes = []; o = { ...o, noColours: true, noPdf: true }; }   // 24w: only the Parts News PDFs the model files point to
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
        if (!o.all && old && old.catalogNo === ix.catalogNo && old.year === r[2] && old.nv === NV && (old.figs || []).length === ix.figDataCollection.length && old.figs.every(f => !f.ill || coords[picFile(f.ill)] || f.nohot)) { st.same++; continue; }
        const m = { code, nv: NV, news: {}, year: r[2], productNo: r[3], colorType: r[4], name: String(ix.modelName || r[5]).replace(/\\n|\n/g, ' '), catalogNo: ix.catalogNo, fetched: new Date().toISOString(), figs: [] };
        for (const f of ix.figDataCollection) {
          const tx = await api('catalog_text', { ...base, catalogNo: ix.catalogNo, illustNo: f.illustNo, figNo: f.figNo, figBranchNo: f.figBranchNo, refNo: '', partNo: '', openMode: '', importOption: '' });
          const fg = { no: f.figNo, br: f.figBranchNo, name: f.figName, ill: f.illustNo, parts: [] };
          if (!tx) { fg.failed = true; m.figs.push(fg); continue; }
          fg.parts = txParts(tx);
          { const nw = txNews(tx); if (Object.keys(nw.by).length) fg.news = nw.by; Object.assign(m.news, nw.url); }
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
    // 23o (Sam 2026-11-17 '2059 hi chahiye ... exact RC ke colour ke hisab se hi catalogue open hona chahiye'): every colour type of a model code is read too.
    // Seen on the real site 2026-11-18 (BCF3): one code = one model year; two colour types differ in a few parts (tank covers, graphics, wheels: 8 of 937);
    // two product codes of one colour type do not differ. So one read per colour type, and only the diagrams whose parts differ from the first colour are kept.
    if (!o.noColours) {
      say('YPEC colours: ' + codes.length + ' model codes');
      let n = 0; bad = 0;
      for (const code of codes) {
        n++;
        const mf = path.join(mdir, code + '.json'), m = rj(mf); if (!m || m.none || !Array.isArray(m.figs)) continue;
        try {
          const { rows, lang } = await list(code), r0 = pickRow(rows, code); if (!r0) continue;
          const cols = colourTypes(rows, code, r0), sig = m.catalogNo + '|' + r0[4] + '|' + cols.map(c => c.t).join(',');
          if (!o.all && m.colSig === sig) { st.colSame++; continue; }
          const colors = []; let ok = true;
          for (const c of cols) {
            if (c.t === r0[4]) { colors.push({ t: c.t, name: c.name, products: c.products, base: true }); continue; }
            const b = { modelBaseCode: c.r[0], modelTypeCode: c.r[1], modelYear: c.r[2], productNo: c.r[3], colorType: c.r[4], catalogLangId: lang, calledCode: '2', modelName: c.r[5].replace(/\\n/g, '\n') };
            const ix = await api('catalog_index', b);
            if (!ix || !Array.isArray(ix.figDataCollection) || !ix.figDataCollection.length) { ok = false; st.colFail++; if (++bad >= 8) throw new Error('YPEC gives no diagram lists: stopped'); continue; }
            bad = 0;
            const figs = {};
            for (const f of ix.figDataCollection) {
              const tx = await api('catalog_text', { ...b, catalogNo: ix.catalogNo, illustNo: f.illustNo, figNo: f.figNo, figBranchNo: f.figBranchNo, refNo: '', partNo: '', openMode: '', importOption: '' });
              if (!tx) { ok = false; continue; }
              const d = colourDiff(m.figs, f, tx); if (d) figs[f.figNo + '/' + f.figBranchNo] = d;
            }
            colors.push({ t: c.t, name: c.name, products: c.products, ...(ix.catalogNo !== m.catalogNo ? { catalogNo: ix.catalogNo } : {}), figs }); st.colRead++;
          }
          m.color = r0[4]; m.colors = colors; if (ok) m.colSig = sig; else delete m.colSig;
          put(mf, m); st.colModels++;
          say(code + ' ' + m.name + ': ' + colors.length + ' colours, ' + colors.reduce((a, c) => a + Object.keys(c.figs || {}).length, 0) + ' diagrams differ (' + n + '/' + codes.length + ')');
        } catch (e) { if (/stopped$/.test(e.message)) throw e; st.colFail++; say(code + ' colours: ' + e.message); if (++bad >= 8) throw new Error('too many failures in a row: stopped'); }
      }
    }
    if (!o.noNews) await newsPdfs();
    if (!o.noPdf && pdfList && pdfList.length) await pdfBooks(pdfList);
  } finally { publish(); try { fs.unlinkSync(lock); } catch (e) {} }
  say('YPEC done: ' + JSON.stringify(st));
  return st;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); } } catch (e) {}
  const a = process.argv.slice(2), flag = n => { const i = a.indexOf(n); return i < 0 ? null : a[i + 1]; }, pos = a.filter((x, i) => !x.startsWith('--') && !['--codes', '--limit'].includes(a[i - 1]));
  // 23n (Sam 2026-11-17 'kuch issue hoke atka toh mail aayega na'): a sync that stops or ends with problems mails ALERT_TO (SMTP_* in .env)
  const failMail = async (sub, text) => { try { const { mailer } = await import('./mailer.mjs'); const to = String(process.env.ALERT_TO || '').split(/[,\s;]+/).filter(s => /@/.test(s)); if (to.length) await mailer(process.env).send(to, 'Bike Pharma: ' + sub, text); } catch (e) { console.error('alert mail not sent:', e.message); } };
  const files = path.resolve(ROOT, process.env.FILES_DIR || path.join(process.env.DATA_DIR || 'data', 'project-files'));
  ypecSync({ syncDir: pos[0] || path.join(files, 'catalogues', 'hero-sync'), yamahaDir: pos[1] || path.join(files, 'catalogues', 'yamaha'),
    codes: (flag('--codes') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean), limit: +(flag('--limit') || 0), all: a.includes('--all'), booksOnly: a.includes('--books-only'), noColours: a.includes('--no-colours'), noPdf: a.includes('--no-pdf'), noNews: a.includes('--no-news'), newsOnly: a.includes('--news-only'), pdfOnly: a.includes('--pdf-books'),
    log: (...x) => console.log(new Date().toISOString().slice(11, 19), ...x) })
    .then(async st => { if (st && (st.listFail || st.failed > 20 || st.colFail > 20 || st.pdfFail > 5)) await failMail('Yamaha YPEC sync: finished with problems', (st.listFail ? 'The YPEC model list was not read: ' + st.listFail + '\n' : '') + 'Models read ' + st.read + ', unchanged ' + st.same + ', failed ' + st.failed + ' of ' + st.models + '. Colours not read: ' + st.colFail + '. Scanned PDF books not read: ' + st.pdfFail + '.'); process.exit(0); },
      async e => { console.error('YPEC sync failed:', e.message); await failMail('Yamaha YPEC sync stopped', 'The weekly Yamaha (YPEC) sync stopped: ' + e.message + '\nThe catalogue in the app stays as it was. Log: data/ypecsync.log or pm2 logs.'); process.exit(1); });
}
