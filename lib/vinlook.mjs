// Chassis number -> model from the maker's own website (update 9o, Sam 2026-10-19 "automatic vehicle details fetch hona he").
// Sam's rule: the model comes only from the maker's reply, never guessed from the chassis letters.
// The makers' sites send no CORS headers, so the page cannot ask them: this server asks.
// Royal Enfield: spares.royalenfield.com GraphQL searchQueryVindetails (public, no login; a read despite the name "mutation").
// Honda: honda2wheelerparts.com Service.svc/FillChassisSearch (public, no login). The page wraps each value in AES-128-CBC with a fresh
// random 16-letter key, used as the IV too and sent after the text; the reply comes back the same way. No secret is involved.
// Hero: its e-catalogue answers only Indian addresses on port 8080, which Sam's server could not reach (2026-10-18): not wired.
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

export async function vinLook(vin) {
  vin = String(vin || '').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { error: 'Not a chassis number' };
  const hit = cache.get(vin);
  if (hit && Date.now() - hit.t < DAY) return hit.r;
  let r;
  if (vin.startsWith('ME3')) r = await askRE(vin);
  else if (vin.startsWith('ME4')) r = await askHonda(vin);
  else return { none: true };   // no maker site wired for this maker (yet)
  if (!r.error) { cache.set(vin, { t: Date.now(), r }); if (cache.size > 5000) cache.delete(cache.keys().next().value); }
  return r;
}
