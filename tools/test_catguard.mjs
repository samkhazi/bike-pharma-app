// update 11h: catalogue guard (staff only, a daily amount per login, every download logged, Admin unlock)
// usage: node tools/test_catguard.mjs   (own server on 3019, fresh database, CAT_DAY_MB=20)
import { spawn } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-catg'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/pf/catalogues/t', { recursive: true });
fs.writeFileSync(T + '/pf/catalogues/t/a.bin', Buffer.alloc(3 * 1024 * 1024, 7));
await new Promise(r => { const a = spawn('node', ['--no-warnings', 'admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234'], { env: { ...process.env, DATA_DIR: T + '/data' } }); a.on('exit', r); });
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3019', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', CAT_DAY_MB: '20', CAT_FILES_DAY_MB: '5' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
await new Promise(r => setTimeout(r, 1500));
const BASE = 'http://127.0.0.1:3019';
let cookie = '';
const get = (p, h = {}) => fetch(BASE + p, { headers: { cookie, 'Accept-Encoding': 'identity', ...h } });
try {
  ok((await get('/cat/hero.json')).status === 401, 'no login: catalogue refused');
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sam@bikepharma.com', password: 'Test@1234' }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  let r = await get('/cat/hero.json'); const et = r.headers.get('etag'); await r.arrayBuffer();
  ok(r.status === 200 && /private/.test(r.headers.get('cache-control')), 'staff gets a brand list (private, not cached by others)');
  ok((await get('/cat/hero.json', { 'If-None-Match': et })).status === 304, 'unchanged list = 304 (not counted)');
  let c = await (await get('/api/catsec')).json();
  ok(c.use.length === 1 && c.use[0].catMB > 10 && c.use[0].catMB < 15 && !c.stopped.length, 'Admin sees today\'s use: ' + JSON.stringify(c.use[0]));
  r = await get('/cat/royal-enfield.json'); await r.arrayBuffer(); ok(r.status === 200, 'second brand still sent (limit passed now)');
  r = await get('/cat/yamaha.json'); const j = await r.json();
  ok(r.status === 429 && /limit/i.test(j.error), 'third brand refused after the day\'s amount: ' + j.error);
  ok((await get('/api/files/read?path=catalogues/t/a.bin&offset=0&length=100')).status === 429, 'catalogue files also stopped for that login');
  c = await (await get('/api/catsec')).json();
  ok(c.stopped.length === 1 && c.stopped[0].kind === 'cat', 'stopped login listed for Admin');
  const lg = fs.readFileSync(T + '/data/catalogue-access.log', 'utf8').trim().split('\n').map(l => JSON.parse(l));
  ok(lg.filter(x => x.file).length === 2 && lg.some(x => x.blocked === 'cat') && lg.every(x => !('password' in x)), 'downloads + the stop written to the access log');
  const u = await (await fetch(BASE + '/api/catsec/unlock', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.stopped[0].id }) })).json();
  ok(u.ok, 'Admin unlock');
  r = await get('/cat/yamaha.json'); await r.arrayBuffer(); ok(r.status === 200, 'after unlock the catalogue opens again');
  r = await get('/api/files/read?path=catalogues/t/a.bin&offset=0&length=' + 3 * 1024 * 1024); await r.arrayBuffer(); ok(r.status === 200, 'file read counted');
  r = await get('/api/files/read?path=catalogues/t/a.bin&offset=0&length=' + 3 * 1024 * 1024); await r.arrayBuffer();
  r = await get('/api/files/read?path=catalogues/t/a.bin&offset=0&length=10'); ok(r.status === 429, 'file reads over CAT_FILES_DAY_MB stopped too');
} catch (e) { ok(false, 'error ' + e.stack); }
srv.kill(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
