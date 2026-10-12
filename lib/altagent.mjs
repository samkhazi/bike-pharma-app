// Web agent for part numbers that none of our catalogues has (update 8h, Sam 2026-10-12 06:20Z "mere system me ek agent ko daalde o
// mere catalogues ko update karta rahega", 06:27Z "banade").
// A number staff searched in Find Part, saved in Add product or took in with Stock in waits in a list (kv 'alt'). With an Anthropic API
// key (Admin pastes it in More > Alternate numbers, or ANTHROPIC_API_KEY in .env) the server asks Claude with web search what the part
// is and which other numbers it goes by, a few numbers a day (Admin sets how many). A number it brings is kept only with the pages it
// read; Scribd first (Sam 06:52Z "scribd.com me sabhi catalogues hein isliye first preference usko hi dena"), then the whole web. Our catalogue's parts with that number, or with the same name, are listed and Admin says which one is right. Only then does
// Find Part show it. The catalogue files never change. Google's own search (Gemini grounding) is not used: its terms forbid building
// a database from its results.
// Update 8i (Sam 07:33Z "oemship.com isme aise hi sabhi brands ke alternate numbers honge sabhi lelo aur server pe update kardena"): the
// alternate number lists Sam gives (public/cat/alt/lists.json, tools/altlist_build.py) answer first, with no web search and no approval;
// the web search goes Scribd, then oemship.com, then the whole web.
import fs from 'node:fs';
import path from 'node:path';

const pk = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// a part number: 5 to 24 letters/digits with at least 4 digits (the app's fpIsPn rule)
export const pnLike = k => k.length >= 5 && k.length <= 24 && (k.match(/\d/g) || []).length >= 4;
const pnShow = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ./-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const istDay = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);
const FROM = { findpart: 'Find Part', product: 'Add product', stockin: 'Stock in', admin: 'Admin' };
const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];

// ---------- our catalogues (public/cat/<brand>.json, the files Find Part reads) ----------
const ABBR = { PIST: 'PISTON', PSTN: 'PISTON', BRG: 'BEARING', CYL: 'CYLINDER', CYLN: 'CYLINDER', GSKT: 'GASKET', GSK: 'GASKET', CLT: 'CLUTCH',
  CLUT: 'CLUTCH', SPKT: 'SPROCKET', SPRKT: 'SPROCKET', CBL: 'CABLE', ASSY: '', ASSLY: '', ASY: '', COMP: '', CPL: '', RINGS: 'RING',
  PISTONS: 'PISTON', BEARINGS: 'BEARING', CABLES: 'CABLE', PLATES: 'PLATE', PADS: 'PAD', SHOES: 'SHOE', SEALS: 'SEAL', GASKETS: 'GASKET',
  SPRINGS: 'SPRING', BOLTS: 'BOLT', NUTS: 'NUT', SCREWS: 'SCREW', WASHERS: 'WASHER', LEVERS: 'LEVER', FILTERS: 'FILTER' };
const STOP = new Set(['KIT', 'SET', 'ASSEMBLY', 'COMPLETE', 'EXP', 'EXPORT', 'NEW', 'OLD', 'FOR', 'WITH', 'WITHOUT', 'AND', 'THE', 'PART',
  'PARTS', 'GENUINE', 'ORIGINAL', 'OEM', 'SPARE', 'SPARES', 'NUMBER', 'TYPE', 'MODEL', 'MODELS', 'BIKE', 'BIKES', 'MOTORCYCLE', 'SCOOTER',
  'SIZE', 'STD', 'STANDARD', 'BSVI', 'BSIV', 'OBD', 'KTM', 'BAJAJ', 'HERO', 'HONDA', 'TVS', 'YAMAHA', 'SUZUKI', 'ROYAL', 'ENFIELD',
  'HUSQVARNA', 'MOTOCORP', 'AUTO', 'MOTOR', 'MOTORS', 'INDIA', 'LTD', 'DUKE', 'PULSAR', 'APACHE']);
const toks = s => String(s || '').toUpperCase().replace(/([A-Z])(\d)/g, '$1 $2').replace(/(\d)([A-Z])/g, '$1 $2')
  .split(/[^A-Z0-9]+/).filter(Boolean).map(t => (t in ABBR ? ABBR[t] : t)).filter(Boolean);
function nameWords(name) {
  const w = [], n = [];
  for (const t of toks(name)) {
    if (/^\d{2,4}$/.test(t)) { if (!n.includes(t)) n.push(t); continue; }
    if (t.length < 3 || /\d/.test(t) || STOP.has(t) || /^MY$/.test(t)) continue;
    if (!w.includes(t)) w.push(t);
  }
  return { w, n };
}
const wordIn = (w, ts) => ts.some(t => t === w || (w.length >= 4 && t.length >= 4 && (t.startsWith(w) || w.startsWith(t))));

export function makeCatalogue(PUBLIC_DIR) {
  const dir = path.join(PUBLIC_DIR, 'cat');
  let idx = null, sig = '', checked = 0;
  const files = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('-dg.json') && f !== 'xref.json').sort(); } catch (e) { return []; } };
  const sigOf = fl => fl.map(f => { try { const s = fs.statSync(path.join(dir, f)); return f + ':' + s.size + ':' + Math.floor(s.mtimeMs); } catch (e) { return f; } }).join('|');
  const load = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  // every part number of every brand, normalised -> which brand files have it (bit i = file i); built once, again when a file changes
  function index() {
    const now = Date.now();
    if (idx && now - checked < 60e3) return idx;
    checked = now; const fl = files().slice(0, 30), s = sigOf(fl);
    if (idx && s === sig) return idx;
    const m = new Map(), brands = [];
    fl.forEach((f, i) => {
      const d = load(f); brands[i] = { f, brand: (d && d.brand) || f.replace(/\.json$/, '') }; if (!d) return;
      for (const r of d.d || []) { if (!Array.isArray(r)) continue; const k = pk(r[5]); if (k) m.set(k, (m.get(k) || 0) | (1 << i)); }
    });
    idx = { m, brands }; sig = s; return idx;
  }
  const has = k => index().m.has(k);
  // a number that starts a longer catalogue number was most likely typed only in part ("36JG00" of 36JG0011)
  const partOf = k => { for (const x of index().m.keys()) if (x.length > k.length && x.startsWith(k)) return true; return false; };
  const brandOf = k => { const I = index(), b = I.m.get(k) || 0; return I.brands.filter((x, i) => b & (1 << i)).map(x => x.brand); };
  const rowInfo = (d, r) => {
    const ms = [...new Set((r[11] || []).map(i => (d.vmod && d.vmod[d.vars[i]]) || d.vars[i]).filter(Boolean))];
    const mrp = d.mrp && +d.mrp[r[5]] > 0 ? +d.mrp[r[5]] : 0;
    return { pn: String(r[5]), brand: d.brand, desc: clip(d.desc && d.desc[r[6]], 80), models: ms, mrp };
  };
  const merge = (a, b) => { for (const m of b.models) if (!a.models.includes(m)) a.models.push(m); if (!a.mrp && b.mrp) a.mrp = b.mrp; if (!a.desc && b.desc) a.desc = b.desc; };
  // the catalogue rows of these numbers: k -> {pn, brand, desc, models, mrp}
  function details(ks) {
    const I = index(), want = new Map(); let bits = 0;
    for (const k of ks) { const b = I.m.get(k); if (b) { want.set(k, null); bits |= b; } }
    I.brands.forEach((x, i) => {
      if (!(bits & (1 << i))) return; const d = load(x.f); if (!d) return;
      for (const r of d.d || []) { const k = pk(r[5]); if (!want.has(k)) continue; const o = rowInfo(d, r); const p = want.get(k); if (p) merge(p, o); else want.set(k, o); }
    });
    for (const [k, v] of want) if (!v) want.delete(k);
    return want;
  }
  // our parts whose name has the words of the web's name ("KIT PIST.RING KTM125" -> piston ring parts, 125 cc bikes first)
  function byName(name, bikes, brand, skip) {
    const { w, n } = nameWords(name); if (!w.length) return [];
    const bw = toks(bikes).filter(t => t.length >= 3 && !/\d/.test(t) && !STOP.has(t)); n.push(...toks(bikes).filter(t => /^\d{3}$/.test(t) && !n.includes(t)));
    const I = index(), bl = String(brand || '').toLowerCase();
    let use = I.brands.map((x, i) => i).filter(i => bl && (bl.includes(I.brands[i].brand.toLowerCase()) || I.brands[i].brand.toLowerCase().includes(bl)));
    if (!use.length) use = I.brands.map((x, i) => i);
    const need = w.length <= 2 ? w.length : Math.ceil(w.length * 0.67), best = new Map();
    for (const i of use) {
      const d = load(I.brands[i].f); if (!d) continue; const dt = new Map();
      for (const r of d.d || []) {
        const k = pk(r[5]); if (!k || k === skip) continue;
        let ts = dt.get(r[6]); if (!ts) { ts = toks(d.desc && d.desc[r[6]]); dt.set(r[6], ts); }
        const hit = w.filter(x => wordIn(x, ts)).length; if (hit < need) continue;
        const o = rowInfo(d, r), mt = o.models.join(' | ').toUpperCase();
        const sc = hit / w.length + (n.some(x => new RegExp('(^|[^0-9])' + x + '([^0-9]|$)').test(mt)) ? 1 : 0) + (bw.some(x => mt.includes(x)) ? 0.5 : 0);
        const p = best.get(k); if (!p) best.set(k, { ...o, sc }); else { merge(p, o); if (sc > p.sc) p.sc = sc; }
      }
    }
    return [...best.values()].sort((a, b) => b.sc - a.sc || a.models.length - b.models.length).slice(0, 6)
      .map(o => ({ pn: o.pn, brand: o.brand, desc: o.desc, models: o.models.slice(0, 8), mrp: o.mrp }));
  }
  return { index, has, partOf, brandOf, details, byName };
}

// ---------- the agent: Claude with web search ----------
const SYS = 'You look up two-wheeler (motorcycle and scooter) spare part numbers for a spare parts shop in India. Use web search. ' +
  'Report only what the web pages you read say. Never invent or guess a part number.';
const WHERE = { scribd: 'Search scribd.com (parts catalogues and price lists people uploaded there) for this exact part number.',
  oemship: 'Search oemship.com (an Indian shop for genuine spare parts, with part lists and alternate number lists) for this exact part number.',
  web: 'Search the web for this exact part number.' };
const DOMAINS = { scribd: ['scribd.com', 'www.scribd.com'], oemship: ['oemship.com', 'www.oemship.com'] };
const ASK = (pn, where) => `Part number: ${pn}

${WHERE[where] || WHERE.web} What part is it (part name, bike brand, bike models)? Which other part numbers do the pages give for the same part (old or new number, superseded number, alternate number, the maker's own number)?

Finish with one JSON object in a \`\`\`json block:
{"found": true, "name": "part name as the page writes it", "brand": "bike brand", "bikes": "bike models", "alts": [{"pn": "other number", "how": "old | new | alternate | same part", "url": "page that says so"}], "note": "one short line"}
If no page has this number, finish with {"found": false, "note": "one short line"}.`;

function lastJson(text) {
  const fenced = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]).reverse();
  for (const s of fenced) { try { const j = JSON.parse(s); if (j && typeof j === 'object') return j; } catch (e) {} }
  const starts = [...String(text).matchAll(/\{\s*"found"/g)].map(m => m.index).reverse();
  for (const i of starts) for (let e = text.lastIndexOf('}'); e > i; e = text.lastIndexOf('}', e - 1)) { try { return JSON.parse(text.slice(i, e + 1)); } catch (x) {} }
  return null;
}
function readOut(blocks) {
  let text = ''; const cites = [], seen = new Set(), qs = [], pages = [];
  for (const b of blocks || []) {
    if (b.type === 'text') {
      text += b.text || '';
      for (const c of b.citations || []) if (c.url && /^https?:\/\//.test(c.url) && !seen.has(c.url)) { seen.add(c.url); cites.push({ url: clip(c.url, 400), title: clip(c.title, 120), txt: clip(c.cited_text, 200) }); }
    } else if (b.type === 'server_tool_use' && b.input && b.input.query) qs.push(clip(b.input.query, 120));
    else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r.url && /^https?:\/\//.test(r.url)) pages.push({ url: clip(r.url, 400), title: clip(r.title, 120) });
  }
  return { text, cites, qs, pages };
}
class ApiError extends Error { constructor(msg, wait) { super(msg); this.wait = wait; } }
function apiError(status, j) {
  const m = String((j && j.error && j.error.message) || '').toLowerCase();
  if (status === 401 || status === 403) return new ApiError('Anthropic refused the API key. Paste the key again in More > Alternate numbers.', 3600e3);
  if (m.includes('credit')) return new ApiError('The Anthropic credit is finished. Add credit at console.anthropic.com > Billing.', 3600e3);
  if (m.includes('web search') && m.includes('not enabled')) return new ApiError('Web search is switched off for your Anthropic account (console.anthropic.com > Settings).', 3600e3);
  if (status === 404) return new ApiError('The AI model is not open for this key.', 3600e3);
  if (status === 429) return new ApiError('Anthropic is busy (too many requests). The agent tries again in 10 minutes.', 600e3);
  return new ApiError(status ? `Anthropic answered with error ${status}. The agent tries again in 10 minutes.` : 'The server could not reach Anthropic. The agent tries again in 10 minutes.', 600e3);
}

export function makeAlt({ store, PUBLIC_DIR, env, json, roleClass, limited }) {
  const URL = String(env.ALT_API_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
  const TICK = Math.max(200, +env.ALT_TICK_MS || 30e3);
  const cat = makeCatalogue(PUBLIC_DIR);
  const cfg = () => ({ on: true, perDay: 10, key: '', model: '', err: null, pause: 0, ...(store.kvGet('altcfg', 'cfg') || {}) });
  const setCfg = o => store.kvSet('altcfg', 'cfg', { ...cfg(), ...o });
  const keyOf = c => env.ANTHROPIC_API_KEY || c.key || '';
  const use = day => store.kvGet('altuse', day) || { n: 0, s: 0, i: 0, o: 0 };
  const addUse = u => { const d = istDay(), x = use(d); store.kvSet('altuse', d, { n: x.n + (u.n || 0), s: x.s + (u.s || 0), i: x.i + (u.i || 0), o: x.o + (u.o || 0) }); };
  const items = () => store.kvAll('alt').map(([, v]) => v);
  const put = it => store.kvSet('alt', it.k, it);
  // a search cut by a restart goes back in the queue
  for (const it of items()) if (it.st === 'run') put({ ...it, st: 'wait' });

  // ---------- the alternate number lists Sam gave (public/cat/alt/lists.json): used as they are, no Admin approval ----------
  const LIST = path.join(PUBLIC_DIR, 'cat', 'alt', 'lists.json');
  let LS = { m: new Map(), lists: [] }, lsSig = null, lsGen = 0;
  function lists() { // number -> [{pn: its other number, d: that number's description, dir: 'new' | 'old', L: list}], read again when the file changes
    let s = ''; try { const st = fs.statSync(LIST); s = st.size + ':' + Math.floor(st.mtimeMs); } catch (e) {}
    if (s === lsSig) return LS;
    const m = new Map(), add = (k, o) => { const a = m.get(k); if (a) a.push(o); else m.set(k, [o]); }; let ls = [];
    if (s) try {
      const j = JSON.parse(fs.readFileSync(LIST, 'utf8')); ls = (j.lists || []).map(l => ({ name: clip(l.name, 80), n: +l.n || 0 }));
      for (const [o, od, n, nd, L] of j.p || []) { const ko = pk(o), kn = pk(n); if (!ko || !kn || ko === kn) continue; add(ko, { pn: n, d: nd, dir: 'new', L }); add(kn, { pn: o, d: od, dir: 'old', L }); }
    } catch (e) { console.error('[alt] lists.json: ' + (e.message || e)); }
    LS = { m, lists: ls }; lsSig = s; lsGen++; return LS;
  }
  // the list's other number for k that one of our catalogues has
  const listCat = k => { const I = lists(); for (const x of I.m.get(k) || []) if (cat.has(pk(x.pn))) return { ...x, list: (I.lists[x.L] || {}).name || 'alternate list' }; return null; };
  const listDec = (lc, now) => { const a = pk(lc.pn), d = cat.details([a]).get(a) || {}; return { alt: d.pn || lc.pn, name: d.desc || lc.d || '', brand: d.brand || '', by: lc.list, at: now, list: 1, dir: lc.dir }; };
  // numbers that waited before a list had them: the list answers (Admin's "Not right" stays)
  let flAt = 0, flGen = 0;
  function fromLists() { // when a list file is read again, and every 10 minutes (a catalogue may have come)
    lists(); if (lsGen === flGen && Date.now() - flAt < 600e3) return; flAt = Date.now(); flGen = lsGen;
    const now = new Date().toISOString();
    for (const v of items()) if (['wait', 'none', 'found'].includes(v.st)) { const lc = listCat(v.k); if (lc) put({ ...v, st: 'ok', dec: listDec(lc, now) }); }
  }

  async function call(key, model, body) {
    let r;
    try { r = await fetch(URL + '/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model, ...body }), signal: AbortSignal.timeout(180e3) }); }
    catch (e) { throw apiError(0); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw apiError(r.status, j);
    return j;
  }
  // one search round: Scribd only (its documents as the search engine shows them; nothing is opened behind a login), oemship.com only, or the whole web
  async function round(key, model, pn, where, u) {
    const first = { role: 'user', content: ASK(pn, where) }; let out = [];
    const tool = { type: 'web_search_20250305', name: 'web_search', max_uses: DOMAINS[where] ? 2 : 3 };
    if (DOMAINS[where]) tool.allowed_domains = DOMAINS[where];
    for (let turn = 0; turn < 3; turn++) {
      const j = await call(key, model, { max_tokens: 1500, system: SYS, messages: turn ? [first, { role: 'assistant', content: out }] : [first], tools: [tool] });
      u.i += (j.usage && j.usage.input_tokens) || 0; u.o += (j.usage && j.usage.output_tokens) || 0;
      u.s += (j.usage && j.usage.server_tool_use && j.usage.server_tool_use.web_search_requests) || 0;
      out = out.concat(j.content || []);
      if (j.stop_reason !== 'pause_turn') break;
    }
    return out;
  }
  async function lookUp(it) {
    const c = cfg(), key = keyOf(c), model = env.ALT_MODEL || c.model || MODELS[0];
    const u = { n: 0, s: 0, i: 0, o: 0 }; let o, j, where;
    try {
      for (where of ['scribd', 'oemship', 'web']) {
        o = readOut(await round(key, model, it.pn, where, u)); j = lastJson(o.text) || {};
        if (j.found !== false && (j.name || (Array.isArray(j.alts) && j.alts.length))) break;
      }
      u.n = 1;
    } finally { if (u.n || u.s || u.i || u.o) addUse(u); }
    const alts = []; const ak = new Set([it.k]);
    for (const a of Array.isArray(j.alts) ? j.alts : []) {
      const k = pk(a && a.pn); if (!pnLike(k) || ak.has(k)) continue; ak.add(k);
      alts.push({ pn: pnShow(a.pn), k, how: clip(a.how, 30), url: /^https?:\/\//.test(String(a.url || '')) ? clip(a.url, 400) : '' });
      if (alts.length >= 8) break;
    }
    const info = cat.details(alts.map(a => a.k));
    const res = { name: clip(j.name, 120), brand: clip(j.brand, 40), bikes: clip(j.bikes, 160), note: clip(j.note, 200),
      alts: alts.map(a => ({ ...a, cat: info.get(a.k) || null })), maybe: [], where, cites: o.cites.slice(0, 6), pages: o.cites.length ? [] : o.pages.slice(0, 5), qs: o.qs.slice(0, 4), at: new Date().toISOString() };
    if (res.name && !res.alts.some(a => a.cat)) res.maybe = cat.byName(res.name, res.bikes, res.brand, it.k);
    const found = j.found !== false && !!(res.name || res.alts.length);
    const tries = (it.tries || 0) + 1;
    return { ...it, st: found ? 'found' : 'none', res, tries, next: found ? 0 : Date.now() + 7 * 86400e3, ran: res.at, pri: 0 };
  }
  let busy = false;
  async function tick() {
    if (busy) return; const c = cfg();
    try { fromLists(); } catch (e) { console.error('[alt] lists: ' + (e.message || e)); }
    if (!keyOf(c) || c.on === false || Date.now() < (c.pause || 0)) return;
    if (use(istDay()).n >= (c.perDay == null ? 10 : c.perDay)) return;
    const now = Date.now();
    const due = items().filter(v => (v.st === 'wait' || (v.st === 'none' && (v.tries || 0) < 3)) && (v.next || 0) <= now)
      .sort((a, b) => (b.pri || 0) - (a.pri || 0) || String(a.at).localeCompare(String(b.at)));
    if (!due.length) return;
    let it = due[0];
    if (cat.has(it.k)) { put({ ...it, st: 'incat', inCat: cat.brandOf(it.k) }); return; } // a catalogue that came later has it
    const lc = listCat(it.k); if (lc) { put({ ...it, st: 'ok', dec: listDec(lc, new Date().toISOString()) }); return; } // a list that came later has it
    busy = true; put(it = { ...it, st: 'run' });
    try { put(await lookUp(it)); if (cfg().err) setCfg({ err: null }); }
    catch (e) { put({ ...it, st: 'wait' }); setCfg({ err: { at: new Date().toISOString(), msg: e.message || String(e) }, pause: Date.now() + (e.wait || 600e3) }); console.error('[alt] ' + it.pn + ': ' + (e.message || e)); }
    finally { busy = false; }
  }
  function start() {
    setInterval(() => { tick().catch(e => { busy = false; console.error('[alt]', e.message || e); }); }, TICK).unref();
    setTimeout(() => { try { cat.index(); } catch (e) {} }, 20e3).unref(); // warm up the catalogue index
  }

  async function testKey(key) {
    const tryM = [...new Set([env.ALT_MODEL, ...MODELS].filter(Boolean))]; let last = '';
    for (const m of tryM) {
      let r; try { r = await fetch(`${URL}/v1/models/${encodeURIComponent(m)}`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(20e3) }); }
      catch (e) { return { error: 'The server could not reach Anthropic. Try again in a minute.' }; }
      if (r.status === 401 || r.status === 403) return { error: 'Anthropic refused this key. Copy it again from console.anthropic.com > API keys.' };
      if (!r.ok) { last = m + ': ' + r.status; continue; }
      const j = await r.json().catch(() => ({})); const ws = j && j.capabilities && j.capabilities.server_tools && j.capabilities.server_tools.web_search;
      if (ws && ws.supported === false) { last = m + ': no web search'; continue; }
      return { model: m };
    }
    return { error: 'No AI model with web search is open for this key (' + last + ').' };
  }
  const view = it => ({ k: it.k, pn: it.pn, st: it.st, from: (it.from || []).map(f => FROM[f] || f), by: it.by || '', at: it.at, tries: it.tries || 0, next: it.next || 0,
    res: it.res || null, dec: it.dec || null, inCat: it.inCat || null });
  const monthUse = () => { const m = istDay().slice(0, 7), t = { n: 0, s: 0, i: 0, o: 0 }; for (const [d, u] of store.kvAll('altuse')) if (d.startsWith(m)) for (const x in t) t[x] += u[x] || 0; return t; };
  const inr = u => { const usd = u.s * 0.01 + u.i * (+env.ALT_PRICE_IN || 1) / 1e6 + u.o * (+env.ALT_PRICE_OUT || 5) / 1e6; return Math.round(usd * (+env.ALT_INR || 88)); };

  async function api(m, body, user, res) {
    if (!user) return json(res, 401, { error: 'Please log in again.' });
    if (roleClass(user) !== 'staff') return json(res, 403, { error: 'not_granted' });
    const admin = user.role === 'admin', c = cfg();
    if (m === 'GET') {
      const all = items(), ap = {}, st = {};
      for (const it of all) { st[it.k] = it.st; if (it.st === 'ok' && it.dec) ap[it.k] = { alt: it.dec.alt, name: it.dec.name || '', ...(it.dec.list ? { list: it.dec.by, dir: it.dec.dir } : {}) }; }
      const out = { ap, st, on: !!keyOf(c) && c.on !== false };
      if (admin) {
        const mu = monthUse(), today = use(istDay());
        out.admin = { items: all.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 500).map(view),
          cfg: { on: c.on !== false, perDay: c.perDay == null ? 10 : c.perDay, keySet: env.ANTHROPIC_API_KEY ? 'env' : c.key ? 'admin' : '', keyTail: (keyOf(c) || '').slice(-4),
            model: env.ALT_MODEL || c.model || MODELS[0], err: c.err, pause: c.pause || 0 },
          use: { today: today.n, month: mu.n, searches: mu.s, inr: inr(mu) }, lists: lists().lists };
      }
      return json(res, 200, out);
    }
    if (m !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const act = String(body.act || ''), k = pk(body.pn), now = new Date().toISOString(), who = user.name || user.id;
    if (act === 'ask') { // staff: a number no catalogue has
      if (!pnLike(k)) return json(res, 200, { error: 'Not a part number.' });
      if (limited('alt:' + user.id, 300, 86400e3)) return json(res, 429, { error: 'Too many numbers today.' });
      const it = store.kvGet('alt', k); const from = FROM[body.from] ? String(body.from) : 'findpart';
      if (it) {
        const fr = (it.from || []).includes(from) ? it.from || [] : [...(it.from || []), from];
        const lc = ['wait', 'none', 'found'].includes(it.st) && listCat(k);
        if (lc) { put({ ...it, from: fr, st: 'ok', dec: listDec(lc, now) }); return json(res, 200, { st: 'ok', alt: lc.pn }); }
        if (fr !== it.from) put({ ...it, from: fr }); return json(res, 200, { st: it.st });
      }
      if (cat.has(k)) return json(res, 200, { st: 'incat' });
      const lc = listCat(k); if (lc) return json(res, 200, { st: 'list', alt: lc.pn });
      if (cat.partOf(k)) return json(res, 200, { st: 'part' });
      put({ k, pn: pnShow(body.pn), st: 'wait', from: [from], by: who, at: now, tries: 0, next: 0, pri: 0 });
      return json(res, 200, { st: 'wait' });
    }
    if (!admin) return json(res, 403, { error: 'Only the Admin can do this.' });
    if (act === 'add' || act === 'retry') {
      if (!pnLike(k)) return json(res, 200, { error: 'Type a whole part number (at least 4 digits).' });
      if (cat.has(k)) return json(res, 200, { st: 'incat', error: pnShow(body.pn) + ' is already in our ' + cat.brandOf(k).join(', ') + ' catalogue: Find Part shows it.' });
      const lc = listCat(k);
      if (lc) {
        const it0 = store.kvGet('alt', k); if (it0) put({ ...it0, st: 'ok', dec: listDec(lc, now) });
        return json(res, 200, { st: 'list', error: `${pnShow(body.pn)} is in the ${lc.list}: the same part as ${lc.pn}${lc.d ? ' (' + clip(lc.d, 60) + ')' : ''}. Find Part shows it.` });
      }
      const it = store.kvGet('alt', k) || { k, pn: pnShow(body.pn), from: ['admin'], by: who, at: now };
      put({ ...it, st: 'wait', tries: 0, next: 0, pri: 1, dec: null });
      return json(res, 200, { st: 'wait' });
    }
    const it = store.kvGet('alt', k);
    if (act === 'cfg') { const o = {}; if ('on' in body) o.on = !!body.on; if ('perDay' in body) o.perDay = Math.max(0, Math.min(200, Math.round(+body.perDay) || 0)); if (o.on) o.pause = 0; setCfg(o); return json(res, 200, { ok: true }); }
    if (act === 'key') {
      const key = String(body.key || '').trim();
      if (!key) { setCfg({ key: '', model: '', err: null, pause: 0 }); return json(res, 200, { ok: true }); }
      if (!/^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(key)) return json(res, 200, { error: 'This does not look like an Anthropic API key (it starts with sk-ant-).' });
      const t = await testKey(key); if (t.error) return json(res, 200, { error: t.error });
      setCfg({ key, model: t.model, err: null, pause: 0, on: true }); return json(res, 200, { ok: true, model: t.model });
    }
    if (!it) return json(res, 200, { error: 'This number is not in the list any more.' });
    if (act === 'del') { store.kvDel('alt', k); return json(res, 200, { ok: true }); }
    if (act === 'no') { put({ ...it, st: 'no', dec: { none: 1, by: who, at: now } }); return json(res, 200, { ok: true }); }
    if (act === 'undo') { // a list's answer that Admin takes back stays off (the list would give it again)
      const L = !!(it.dec && it.dec.list); put({ ...it, st: L ? 'no' : it.res ? 'found' : 'wait', dec: L ? { none: 1, list: 1, by: who, at: now } : null }); return json(res, 200, { ok: true });
    }
    if (act === 'ok') {
      const a = pk(body.alt);
      if (!pnLike(a) || a === k) return json(res, 200, { error: 'Type the other part number.' });
      if (!cat.has(a)) return json(res, 200, { error: pnShow(body.alt) + ' is not in our catalogues either. Pick a number that Find Part shows.' });
      const d = cat.details([a]).get(a) || {};
      put({ ...it, st: 'ok', dec: { alt: d.pn || pnShow(body.alt), name: d.desc || '', brand: d.brand || '', by: who, at: now } });
      return json(res, 200, { ok: true });
    }
    return json(res, 200, { error: 'Unknown action.' });
  }
  return { api, start, tick, cat };
}
