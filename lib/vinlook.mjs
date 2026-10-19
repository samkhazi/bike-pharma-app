// Chassis number -> model from the maker's own website (update 9o, Sam 2026-10-19 "automatic vehicle details fetch hona he").
// Sam's rule: the model comes only from the maker's reply, never guessed from the chassis letters.
// The makers' sites send no CORS headers, so the page cannot ask them: this server asks.
// Royal Enfield: spares.royalenfield.com GraphQL searchQueryVindetails (public, no login; a read despite the name "mutation").
// Honda: honda2wheelerparts.com Service.svc/FillChassisSearch (public, no login). The page wraps each value in AES-128-CBC with a fresh
// random 16-letter key, used as the IV too and sent after the text; the reply comes back the same way. No secret is involved.
// Hero: its e-catalogue answers only Indian addresses on port 8080, which Sam's server could not reach (2026-10-18): not wired.
// Yamaha (update 9r, Sam 2026-10-19 "eh dekh yamaha ka aise chala"): the dealer YPEC (ypec.ymcapps.net) with Sam's own dealer login, which he
// keeps in .env (YPEC_BASE_CODE, YPEC_DEALER_CODE, YPEC_USER_ID, YPEC_PASSWORD). If YPEC shows its Terms of Use page again, the server
// submits it for Sam's dealer account, as Sam asked (2026-10-19 15:31Z "code me kaisa he waise hi kar"); he had accepted them in the browser.
import crypto from 'node:crypto';
const RE_URL = process.env.VIN_RE_URL || 'https://spares.royalenfield.com/graphql';
const RE_Q = 'mutation S($v: String!){searchQueryVindetails(input:{Vehicle_code:$v,Type:"VIN"}){vin_detail{VIN CategoryName CategoryUrl}}}';
const cache = new Map();   // VIN -> {t, r}: one ask per chassis per day
const DAY = 24 * 3600 * 1000;

async function askRE(vin) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(RE_URL, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Store: 'default', Accept: 'application/json' },
      body: JSON.stringify({ query: RE_Q, variables: { v: vin } }) });
    if (!r.ok) return { error: 'Royal Enfield site answered ' + r.status };
    const j = await r.json();
    const d = j && j.data && j.data.searchQueryVindetails && j.data.searchQueryVindetails.vin_detail;
    const x = Array.isArray(d) ? d[0] : d;
    if (!x || !x.CategoryName || !x.CategoryUrl) return { found: false };
    let name = '';
    try { name = new URL(x.CategoryUrl, 'https://spares.royalenfield.com/').searchParams.get('searchResultName') || ''; } catch (e) {}
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const model = name.replace(/\s*\(.*$/, '').trim();
    return { found: true, vb: 'Royal Enfield', name, model, code: String(x.CategoryName).slice(0, 80),
      url: 'https://spares.royalenfield.com/' + String(x.CategoryUrl).replace(/^\/+/, '').slice(0, 400) };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'Royal Enfield site did not answer' : 'Royal Enfield site could not be reached' };
  } finally { clearTimeout(to); }
}

const HONDA_URL = process.env.VIN_HONDA_URL || 'https://honda2wheelerparts.com/Service.svc/FillChassisSearch';
const hEnc = v => { const k = crypto.randomBytes(8).toString('hex'); const c = crypto.createCipheriv('aes-128-cbc', Buffer.from(k, 'utf8'), Buffer.from(k, 'utf8'));
  return Buffer.concat([c.update(String(v), 'utf8'), c.final()]).toString('base64') + k; };
const hDec = s => { s = String(s || ''); if (s.length < 17) return ''; const k = s.slice(-16); const d = crypto.createDecipheriv('aes-128-cbc', Buffer.from(k, 'utf8'), Buffer.from(k, 'utf8'));
  return Buffer.concat([d.update(Buffer.from(s.slice(0, -16), 'base64')), d.final()]).toString('utf8'); };
export const _honda = { hEnc, hDec };   // tests

async function askHonda(vin) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(HONDA_URL, { method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://honda2wheelerparts.com/SearchByVIN.aspx?Type=VIN' },
      body: JSON.stringify({ strVIN: hEnc(vin), strEngine: hEnc(''), strMANDTENGINE: hEnc('false'), issbom: hEnc('false'), iLngId: hEnc('1') }) });
    if (!r.ok) return { error: 'Honda site answered ' + r.status };
    const j = await r.json();
    const t = JSON.parse(hDec(j && j.d) || '{}');
    const x = (t.tbl_chassismaster || [])[0];
    if (!x || !x.VEHICLE) return { found: false };
    const ms = /Date\((\d+)\)/.exec(String(x.STARTDATE || ''));
    const model = String(x.VEHICLE).replace(/\s+/g, ' ').trim().slice(0, 80), code = String(x.MODEL || x.SBOMCODE || '').slice(0, 40);
    return { found: true, vb: 'Honda', name: model + (code ? ' (' + code + ')' : ''), model, code,
      since: ms ? new Date(+ms[1]).toISOString().slice(0, 10) : '' };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'Honda site did not answer' : 'Honda site could not be reached' };
  } finally { clearTimeout(to); }
}

const YPEC = process.env.YPEC_URL || 'https://ypec.ymcapps.net';
let ySess = null;   // {jar: Map} the YPEC login, reused until it runs out
async function yReq(jar, url, body) {   // one YPEC request with its cookies; redirects followed by hand so their cookies are kept
  for (let hop = 0; hop < 6; hop++) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    let r;
    try {
      r = await fetch(url, { method: body ? 'POST' : 'GET', redirect: 'manual', signal: ac.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(jar.size ? { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } : {}) },
        body: body ? new URLSearchParams(body).toString() : undefined });
    } finally { clearTimeout(to); }
    for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) { const m = /^([^=;\s]+)=([^;]*)/.exec(c); if (m) jar.set(m[1], m[2]); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url).toString(); body = null; continue; }
    if (!r.ok) throw new Error('Yamaha site answered ' + r.status);
    return await r.text();
  }
  throw new Error('Yamaha site sent too many redirects');
}
const yTerms = h => /I\s*ACCEPT/i.test(h) && /TERMS\s*OF\s*USE/i.test(h);
const yOut = h => !/onPdf\(/.test(h) && (/password/i.test(h) && /login/i.test(h) || /session/i.test(h) && /time\s*out/i.test(h));
async function yAccept(jar, h) {   // the Terms page's own form, sent as its I ACCEPT button would
  const f = /<form[^>]*action=["']([^"']+)["']/i.exec(h); if (!f) return h;
  const fields = {}; for (const m of h.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi)) fields[m[1]] = m[2];
  const a = f[1], url = /^https?:/.test(a) ? a : YPEC + (a.startsWith('/') ? a : '/ypec/control/' + a);
  return yReq(jar, url, fields);
}
async function yLogin() {
  const e = process.env;
  if (!e.YPEC_DEALER_CODE || !e.YPEC_USER_ID || !e.YPEC_PASSWORD) return { error: 'The Yamaha login is not set on the server yet' };
  const jar = new Map();
  let h = await yReq(jar, YPEC + '/ypec/control/LoginDealer', { ypec_base_code: e.YPEC_BASE_CODE || '', ypec_dealer_code: e.YPEC_DEALER_CODE, ypec_user_id: e.YPEC_USER_ID, ypec_password: e.YPEC_PASSWORD });
  if (yTerms(h)) h = await yAccept(jar, h);
  if (yTerms(h)) return { error: 'Yamaha’s parts catalogue wants its terms accepted: open YPEC once in the browser (Pymidol > YPEC)' };
  if (yOut(h)) return { error: 'The Yamaha login on the server did not work: check the YPEC values in .env' };
  await yReq(jar, YPEC + '/ypec/control/common/FrameMainMenu');
  await yReq(jar, YPEC + '/ypec/control/specification/FrameModelSelection');
  return { jar };
}
const ySearch = (jar, vin) => yReq(jar, YPEC + '/ypec/control/specification/ListModelSelection', {
  modelName: '', modelYearFrom: '', modelYearTo: '', modelTypeCode: '', productNo: '', colorType: '', prefixNo: '', serialNo: '',
  frameNo: vin, engineNo: '', Operation: '', actionType: 'serialNo', SearchFlg: ' ', baseCode: process.env.YPEC_BASE_CODE || '',
  prodCategory: '10', confirmId: '', pmpDisplayFlg: '0', pdfDisFlg: '1' });   // prodCategory 10 = motorcycles
async function askYamaha(vin) {
  try {
    let h;
    for (let t = 0; t < 2; t++) {
      if (!ySess) { const l = await yLogin(); if (l.error) return l; ySess = l; }
      h = await ySearch(ySess.jar, vin);
      if (yTerms(h) || yOut(h)) { ySess = null; if (t) return { error: yTerms(h) ? 'Yamaha’s parts catalogue wants its terms accepted: open YPEC once in the browser (Pymidol > YPEC)' : 'Yamaha site logged us out' }; continue; }
      break;
    }
    const m = /JavaScript:onPdf\(\s*'([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/i.exec(h);
    if (!m) return { found: false };
    const parts = m[6].split(/\\+n|\n/), code = parts[0].trim(), model = (parts[1] || parts[0]).replace(/\s+/g, ' ').trim().slice(0, 80);
    return { found: true, vb: 'Yamaha', model, code: code.slice(0, 40), year: m[3], color: m[7].slice(0, 60),
      name: model + ' (' + [code, m[3], m[7]].filter(Boolean).join(', ').slice(0, 100) + ')' };
  } catch (e) {
    console.error('[vinlook] yamaha', e && e.message);
    ySess = null;
    return { error: e && e.name === 'AbortError' ? 'Yamaha site did not answer' : 'Yamaha site could not be reached' };
  }
}

export async function vinLook(vin) {
  vin = String(vin || '').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { error: 'Not a chassis number' };
  const hit = cache.get(vin);
  if (hit && Date.now() - hit.t < DAY) return hit.r;
  let r;
  if (vin.startsWith('ME3')) r = await askRE(vin);
  else if (vin.startsWith('ME4')) r = await askHonda(vin);
  else if (vin.startsWith('ME1')) r = await askYamaha(vin);
  else return { none: true };   // no maker site wired for this maker (yet)
  if (!r.error) { cache.set(vin, { t: Date.now(), r }); if (cache.size > 5000) cache.delete(cache.keys().next().value); }
  return r;
}
