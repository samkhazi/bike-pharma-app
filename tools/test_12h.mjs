// update 12h: bike number -> RC details through Bike Pharma's VR Garage account (RC_API=vrgarage); mock VR Garage on 3031
//   node tools/test_12h.mjs
import http from 'node:http';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const asked = [], logins = [];
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
  const j = JSON.parse(b || '{}'); r.setHeader('Content-Type', 'application/json');
  if (q.url === '/garageLogin') { logins.push(j.email + ':' + j.device); return r.end(JSON.stringify(j.email === 'shop@bp.in' && j.password === 'pw' ? { responseCode: 200, token: 'fresh' } : { responseCode: 400, message: 'Invalid' })); }
  asked.push([q.url, q.headers.authorization, q.headers['x-custom-header'], j.vehicleNumber].join(':')); r.setHeader('Content-Type', 'application/json');
  if (q.headers.authorization === 'Bearer old') { r.statusCode = 401; return r.end('{}'); }
  if (j.vehicleNumber === 'KA68R4270') return r.end(JSON.stringify({ responseCode: 200, result: { vehicleNumber: 'KA68R4270', ownerName: 'S KHAZI', makerName: 'ROYAL ENFIELD', makerModel: 'CLASSIC 350', chassisNo: 'ME3J3A5FAM2000624', engineNo: 'J3A5FAM2000624', manufacturingMonthYear: '03/2021', fuelType: 'PETROL', vehicleColour: 'BLACK', insuranceCompany: 'TATA AIG', insuranceUpto: '2027-03-01' } }));
  r.end(JSON.stringify({ responseCode: 404, message: 'Record not found' })); }); });
await new Promise(f => mock.listen(3031, '127.0.0.1', f));
Object.assign(process.env, { RC_API: 'vrgarage', RC_API_KEY: 'Bearer tok123', RC_API_URL: 'http://127.0.0.1:3031/fetch-vehicle' });
const { rcLook } = await import('../lib/rclook.mjs');
const a = await rcLook('ka 68 r 4270');
ok(a.found && a.chassis === 'ME3J3A5FAM2000624' && a.maker === 'ROYAL ENFIELD' && a.model === 'CLASSIC 350' && a.owner === 'S KHAZI' && a.year === '2021' && a.insurer === 'TATA AIG', 'VR Garage reply read: chassis, maker, model, owner, year, insurance');
ok(asked[0] === '/fetch-vehicle:Bearer tok123:foobar:KA68R4270', 'asked as VR Garage asks: vehicleNumber, Bearer token (sent once), its header');
await rcLook('KA68R4270'); ok(asked.length === 1, 'the same number is not asked again (no credit spent twice)');
ok((await rcLook('DL3CAB0001')).found === false, 'a number VR Garage has no record of says so');
process.env.RC_API_KEY = 'old'; const e = await rcLook('MH12AB1234');
ok(/VR Garage did not accept the token/.test(e.error || ''), 'an expired token says to put a new one in .env');
// auto login: the copied token is old, the server logs in with VRGARAGE_EMAIL / PASSWORD and asks again
Object.assign(process.env, { VRGARAGE_EMAIL: 'shop@bp.in', VRGARAGE_PASSWORD: 'pw' });
const l = await rcLook('KA01AB0002');
ok(l.found === false && logins.join() === 'shop@bp.in:web' && asked.slice(-2).map(x => x.split(':')[1]).join() === 'Bearer old,Bearer fresh', 'refused token: logs in itself and asks again with the new token');
await rcLook('KA01AB0003'); ok(logins.length === 1 && asked.at(-1).split(':')[1] === 'Bearer fresh', 'the new token is kept (no login for every search)');
delete process.env.RC_API_KEY; process.env.VRGARAGE_PASSWORD = 'bad';
const { rcOn } = await import('../lib/rclook.mjs'); ok(rcOn(), 'email + password alone switch the search on');
mock.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
