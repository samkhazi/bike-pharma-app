// Registration number -> RC details (update 10d, Sam 2026-10-20 "sirf register number daalte hin sabhi details show hona he, jaise VR Garage me").
// VR Garage gets these from a paid RC-verification API (Vahan data). Bike Pharma uses its own account with such a provider; the key stays in
// .env and is never sent to the page:
//   RC_API_KEY=...                                   the provider's token (off when empty)
//   RC_API_URL=https://kyc-api.surepass.io/api/v1/rc/rc-full    (default; any provider with the same shape works)
//   RC_API_AUTH=bearer | header:<Header-Name>        how the key is sent (default bearer)
//   RC_API_FIELD=id_number                           the JSON field that carries the number (default id_number)
// Each search costs money, so one registration number is asked once a month and the answer reused.
// read when asked, not at import: server.mjs loads .env after its imports
const KEY = () => process.env.RC_API_KEY || '';
const cfg = () => ({ url: process.env.RC_API_URL || 'https://kyc-api.surepass.io/api/v1/rc/rc-full', auth: process.env.RC_API_AUTH || 'bearer', field: process.env.RC_API_FIELD || 'id_number' });
const cache = new Map();   // reg no -> {t, r}
const MONTH = 30 * 24 * 3600 * 1000;

export const rcOn = () => !!KEY();
export const rcClean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// state + district + series + number (KA17HC3942), or the Bharat series (22BH1234AA)
export const rcIsReg = s => /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(s) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(s);

// the providers name the same thing differently: the first key found (any depth, any case) wins
function pick(o, names) {
  const want = names.map(n => n.toLowerCase());
  const seen = new Set(), st = [o];
  while (st.length) {
    const x = st.shift();
    if (!x || typeof x !== 'object' || seen.has(x)) continue; seen.add(x);
    for (const [k, v] of Object.entries(x)) if (want.includes(k.toLowerCase()) && v != null && typeof v !== 'object' && String(v).trim()) return String(v).trim().slice(0, 160);
    for (const v of Object.values(x)) if (v && typeof v === 'object') st.push(v);
  }
  return '';
}
export function rcMap(j) {
  const g = (...n) => pick(j, n);
  const mfg = g('manufacturing_date_formatted', 'manufacturing_date', 'mfg_date', 'vehicle_manufacturing_month_year', 'month_year_of_mfg', 'manufacturingDate');
  const y = (/(19|20)\d{2}/.exec(mfg) || [])[0] || '';
  return {
    reg: g('rc_number', 'registration_number', 'reg_no', 'regNo', 'vehicle_number'),
    owner: g('owner_name', 'owner', 'ownerName'),
    maker: g('maker_description', 'maker', 'manufacturer', 'vehicle_manufacturer_name', 'makerDescription'),
    model: g('maker_model', 'model', 'vehicle_model', 'makerModel'),
    mfg, year: y,
    regDate: g('registration_date', 'reg_date', 'regDate'),
    fuel: g('fuel_type', 'fuel', 'fuelType'),
    colour: g('color', 'colour', 'vehicle_colour', 'vehicle_color'),
    chassis: g('vehicle_chasi_number', 'vehicle_chassis_number', 'chassis_number', 'chassis', 'chasi_no', 'chassisNumber'),
    engine: g('vehicle_engine_number', 'engine_number', 'engine', 'engine_no', 'engineNumber'),
    cc: g('cubic_capacity', 'vehicle_cubic_capacity', 'cc'),
    category: g('vehicle_category_description', 'vehicle_category', 'vehicle_class', 'class'),
    insurer: g('insurance_company', 'insurer', 'insurance_company_name'),
    insUpto: g('insurance_upto', 'insurance_valid_upto', 'insurance_expiry', 'insuranceUpto'),
    pucUpto: g('pucc_upto', 'puc_upto', 'puc_valid_upto'),
    status: g('rc_status', 'status_as_on', 'vehicle_status'),
  };
}

export async function rcLook(reg) {
  reg = rcClean(reg);
  if (!rcIsReg(reg)) return { error: 'Not a registration number' };
  if (!KEY()) return { off: true };
  const C = cfg();
  const hit = cache.get(reg);
  if (hit && Date.now() - hit.t < MONTH) return hit.r;
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (C.auth.startsWith('header:')) h[C.auth.slice(7)] = KEY(); else h.Authorization = 'Bearer ' + KEY();
  try {
    const r = await fetch(C.url, { method: 'POST', signal: ac.signal, headers: h, body: JSON.stringify({ [C.field]: reg }) });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 || r.status === 403) return { error: 'The RC service did not accept our key (check RC_API_KEY or the balance)' };
    if (r.status === 404 || r.status === 422) return { found: false };
    if (!r.ok) return { error: 'The RC service answered ' + r.status };
    const d = rcMap(j || {});
    if (!d.maker && !d.model && !d.chassis) return { found: false };
    const out = { found: true, ...d, reg: d.reg || reg };
    cache.set(reg, { t: Date.now(), r: out }); if (cache.size > 5000) cache.delete(cache.keys().next().value);
    return out;
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'The RC service did not answer' : 'The RC service could not be reached' };
  } finally { clearTimeout(to); }
}
