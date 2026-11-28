// 24t: lib/excellon.mjs + lib/excellonsync.mjs + bajajDms against a fake Excellon (no network). usage: node tools/test_excellon.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { excellon } from '../lib/excellon.mjs'; import { excellonSync, pickNewest } from '../lib/excellonsync.mjs'; import { bajajDms } from '../lib/bajajbuild.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const seen = [];
const okResp = (op, inner = '') => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op}Response xmlns="http://Excellon.FW5.Host"><${op}Result xmlns:b="x"><b:ErrorCode>None</b:ErrorCode><b:IsRequestSuccessful>true</b:IsRequestSuccessful>${inner}</${op}Result></${op}Response></s:Body></s:Envelope>`;
const row = (c, n, m, d) => `<CustomEntity352 diffgr:id="x" msdata:rowOrder="0"><CompanyID>11744</CompanyID><ItemCode>${c}</ItemCode><ItemName>${n}</ItemName><EffectiveFrom>${d}T00:00:00+05:30</EffectiveFrom><PrevMRP>1</PrevMRP><NewMRP>${m}</NewMRP><ItemGroupType>BAL Parts</ItemGroupType><PriceRevisionStatus>Increased</PriceRevisionStatus></CustomEntity352>`;
let N = 3;
const fake = async (url, o) => { const op = /EntityService\/(\w+)"/.exec(o.headers.SOAPAction)[1], b = o.body; seen.push([op, b]);
  if (op === 'LogIn') return { status: 200, text: async () => /<d:Password>right<\/d:Password>/.test(b) ? okResp('LogIn', '<b:AuthenticationToken>TOK</b:AuthenticationToken><b:DefaultCompanyID>11744</b:DefaultCompanyID>') : okResp('LogIn').replace('<b:IsRequestSuccessful>true', '<b:IsRequestSuccessful>false').replace('</b:IsRequestSuccessful>', '</b:IsRequestSuccessful><b:LastErrorMessage>Invalid user</b:LastErrorMessage>') };
  if (op === 'Entity') return { status: 200, text: async () => okResp('Entity', '<b:EntityKey>EK-1</b:EntityKey><b:ManagerKey>MK</b:ManagerKey>') };
  if (op === 'EntityAction' && /StoreAction/.test(b)) { let rs = row('31201027', 'BATTERY', 812, '2020-07-01') + row('31201027', 'BATTERY', 749, '2025-09-22') + row('24101696', 'CONVERTER &amp; CAT', 3574.5, '2025-09-22'); for (let i = 0; i < N; i++) rs += row('X' + i, 'P' + i, 10, '2024-01-01'); return { status: 200, text: async () => okResp('EntityAction', rs) }; }
  return { status: 200, text: async () => okResp(op) }; };
{ const X = excellon({ user: 'u', password: 'wrong', fetchFn: fake }); let e = ''; try { await X.logIn(); } catch (x) { e = x.message; } ok(/Invalid user/.test(e), 'a wrong login says why: ' + e); }
seen.length = 0;
const X = excellon({ user: 'u', password: 'right', fetchFn: fake }); const s = await X.logIn(); const rows = await X.priceList(s.company); await X.logOff();
ok(s.company === 11744, 'login gives the company');
ok(seen.map(x => x[0]).join(',') === 'LogIn,Entity,EntityAction,EntityAction,LogOff', 'calls: LogIn, Entity, SetProperty, StoreAction, LogOff: ' + seen.map(x => x[0]).join(','));
ok(/<d:AuthenticationToken>TOK</.test(seen[1][1]) && /CustomEntity350/.test(seen[1][1]) && /<d:EntityViewID>6771</.test(seen[1][1]), 'Entity asks for the price report with the session');
ok(/<d:ManagerKey>MK</.test(seen[3][1]) && /<e:ActionID>29921</.test(seen[3][1]) && /<e:Guid>EK-1</.test(seen[3][1]) && /<e:Guid>EK-1</.test(seen[2][1]) && /PropertyName>CompanyID</.test(seen[2][1]) && />11744</.test(seen[2][1]), 'company set, then Generate (29921) on that report');
ok(!seen.some(([op, b]) => op !== 'LogIn' && /Password/.test(b)), 'the password goes only in LogIn');
ok(rows.length === 3 + N && rows.find(r => r.code === '24101696').name === 'CONVERTER & CAT' && rows.find(r => r.code === '24101696').mrp === 3574.5, 'rows read, names unescaped');
ok(pickNewest(rows).find(r => r.code === '31201027').mrp === 749, 'a part listed twice keeps its newest price');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exl-'));
let e2 = ''; try { await excellonSync({ dir, client: excellon({ user: 'u', password: 'right', fetchFn: fake }), log: () => {} }); } catch (x) { e2 = x.message; }
ok(/only 5 parts/.test(e2) && !fs.existsSync(path.join(dir, 'excellon_parts.json')), 'too few parts: nothing written, says why');
N = 60000; const r = await excellonSync({ dir, client: excellon({ user: 'u', password: 'right', fetchFn: fake }), log: () => {} });
ok(r.parts === 60002 && fs.existsSync(path.join(dir, 'excellon_parts.json')), 'a full list is saved');
fs.writeFileSync(path.join(dir, 'bajaj_alt.json'), JSON.stringify({ pairs: [], mrp: { '31201027': 700, 'OLD1': 5 }, nm: { OLD1: 'OLD PART' } }));
const info = bajajDms(dir), A = JSON.parse(fs.readFileSync(path.join(dir, 'bajaj_alt.json'), 'utf8'));
ok(info && info.excellon === 60002 && A.mrp['31201027'] === 749 && A.mrp['24101696'] === 3574.5 && A.nm['24101696'] === 'CONVERTER & CAT', 'the Bajaj build takes the Excellon MRP and names');
ok(A.mrp.OLD1 === 5 && A.nm.OLD1 === 'OLD PART', 'parts only the older list has stay');
ok(bajajDms(dir) === null, 'the same list is not merged twice');
fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
