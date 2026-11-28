// 24t (Sam 2026-11-28 'sync ko auto karna padega server pe hi'): Bajaj's dealer system Excellon (bal.excelloncloud.com) read from this server,
// the way the Excellon Bajaj 5 program reads it (its plain SOAP endpoint WS/EntityService.svc; seen 2026-11-28 with the program's own message log):
//   LogIn (the dealer login of .env EXCELLON_USER / EXCELLON_PASSWORD) -> Entity 'CustomEntity350' (view 6771 = Part Price Revision Summary)
//   -> SetProperty CompanyID -> StoreAction 29921 (= Generate) -> rows CustomEntity352 (ItemCode, ItemName, NewMRP, PrevMRP, EffectiveFrom, ...)
//   -> LogOff. Only reads: no other action of Excellon is called. The rows go to the Bajaj folder as the DMS part list the Bajaj build already reads.
import crypto from 'node:crypto';

const NS = 'http://Excellon.FW5.Host', RQ = 'http://schemas.datacontract.org/2004/07/Excellon.FW5.SDK.DataContracts.Requests', DC = 'http://schemas.datacontract.org/2004/07/Excellon.FW5.Data.DataContracts';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tag = (b, t) => { const m = new RegExp('<(?:\\w+:)?' + t + '(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?' + t + '>').exec(b); return m ? m[1] : null; };
const unesc = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// force: Excellon allows one session per login; an open one (the Excellon program on the shop's PC, or a session that did not end) is ended first
export function excellon({ base = 'https://bal.excelloncloud.com', user, password, machine = 'bikepharma-server', force = true, appAuth = '8ga8MBal2jotMfdc', fetchFn = fetch, timeoutMs = 600000 } = {}) {
  const url = base.replace(/\/$/, '') + '/WS/EntityService.svc';
  let token = null; const jar = new Map();   // the load balancer's cookie (AWSALB): every call of one session goes to the server that logged it in
  const keep = r => { const h = r.headers; const all = h && (typeof h.getSetCookie === 'function' ? h.getSetCookie() : String(h.get && h.get('set-cookie') || '').split(/,(?=\s*\w+=)/)); for (const c of all || []) { const m = /^\s*([^=;\s]+)=([^;]*)/.exec(c); if (m) jar.set(m[1], m[2]); } };
  async function call(op, inner, managerKey = null) {
    const head = (token ? `<d:AuthenticationToken>${esc(token)}</d:AuthenticationToken>` : '') + '<d:ClientType>0</d:ClientType>' + (managerKey ? `<d:ManagerKey>${esc(managerKey)}</d:ManagerKey>` : '') + `<d:RequestKey>${crypto.randomUUID()}</d:RequestKey>`;
    const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op} xmlns="${NS}"><request xmlns:d="${RQ}" xmlns:e="${DC}" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${head}${inner}</request></${op}></s:Body></s:Envelope>`;
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), timeoutMs);
    let r, t; try { r = await fetchFn(url, { method: 'POST', body, signal: ac.signal, headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${NS}/EntityService/${op}"`, 'X-App-Auth': appAuth, ...(jar.size ? { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } : {}) } }); keep(r); t = await r.text(); } finally { clearTimeout(to); }
    const fault = tag(t, 'faultstring'); if (fault) throw new Error(op + ': ' + unesc(fault).slice(0, 200));
    if (tag(t, 'IsRequestSuccessful') !== 'true') throw new Error(op + ': ' + (unesc(tag(t, 'LastErrorMessage') || tag(t, 'ErrorCode') || ('HTTP ' + r.status))).slice(0, 200));
    return t;
  }
  // X-App-Auth: the Excellon program's own header (the same for every dealer, seen in its requests)
  async function logIn() {
    if (!user || !password) throw new Error('EXCELLON_USER / EXCELLON_PASSWORD are not in .env');
    const t = await call('LogIn', `<d:ForceLogin>${force ? 'true' : 'false'}</d:ForceLogin><d:MachineName>${esc(machine)}</d:MachineName><d:OSUserName>${esc(machine)}</d:OSUserName><d:Password>${esc(password)}</d:Password><d:UserName>${esc(user)}</d:UserName>`);
    token = tag(t, 'AuthenticationToken'); if (!token || tag(t, 'IsLogInSuccessful') === 'false') { token = null; throw new Error('LogIn: ' + (unesc(tag(t, 'LastErrorMessage') || 'not logged in')).slice(0, 200)); }
    return { company: +(tag(t, 'DefaultCompanyID') || 0) };
  }
  async function logOff() { if (!token) return; try { await call('LogOff', ''); } catch (e) { /* the session ends by itself */ } token = null; }
  const action = (mk, type, data) => call('EntityAction', `<d:ActionType>${type}</d:ActionType><d:ArchiveDbStoreType>0</d:ArchiveDbStoreType><d:IsArchive>false</d:IsArchive>${data}`, mk);
  // the Part Price Revision Summary (MRP, every part): [{ code, name, group, mrp, prev, from, status }]
  async function priceList(company) {
    const e = await call('Entity', '<d:ArchiveDbStoreType>0</d:ArchiveDbStoreType><d:CompanyID>0</d:CompanyID><d:EntityID>0</d:EntityID><d:EntityType>CustomEntity350</d:EntityType><d:EntityViewID>6771</d:EntityViewID><d:IsArchive>false</d:IsArchive>');
    const mk = tag(e, 'ManagerKey'); if (!mk) throw new Error('Entity: no ManagerKey');
    const g = tag(e, 'EntityKey'); if (!g) throw new Error('Entity: no EntityKey');   // the report's own key: the company and Generate are set on it
    if (company) await action(mk, 'SetProperty', `<d:SetPropertyData><e:EntityId>0</e:EntityId><e:EntityType>CustomEntity350</e:EntityType><e:Guid>${g}</e:Guid><e:ParentGuid>${g}</e:ParentGuid><e:PropertyName>CompanyID</e:PropertyName><e:PropertyValue xmlns:x="http://www.w3.org/2001/XMLSchema" i:type="x:long">${+company}</e:PropertyValue><e:RelationName></e:RelationName></d:SetPropertyData>`);
    const t = await action(mk, 'StoreAction', `<d:StoreActionData><e:ActionID>29921</e:ActionID><e:Guid>${g}</e:Guid><e:RootGuid></e:RootGuid></d:StoreActionData>`);
    const rows = [];
    for (const m of t.matchAll(/<CustomEntity352\b[^>]*>([\s\S]*?)<\/CustomEntity352>/g)) {
      const b = m[1], v = k => unesc(tag(b, k) || '');
      rows.push({ code: v('ItemCode').trim(), name: v('ItemName').trim(), group: v('ItemGroupType'), mrp: +v('NewMRP') || 0, prev: +v('PrevMRP') || 0, from: v('EffectiveFrom').slice(0, 10), status: v('PriceRevisionStatus') });
    }
    return rows;
  }
  return { logIn, logOff, priceList, call };
}
