// update 11u: Backups (Sam 2026-10-23): Admin makes / lists / downloads a backup; it holds the database and the photos as taken;
// a copy goes to the "other server" (here a local folder through rsync); staff cannot see or download backups.
// usage: node tools/test_backup.mjs   (own server on 3022, fresh database)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-backup'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/out', { recursive: true });
const run = (args, env) => new Promise(r => { const a = spawn('node', ['--no-warnings', ...args], { env: { ...process.env, DATA_DIR: T + '/data', ...env } }); a.on('exit', r); });
await run(['admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234']);
fs.mkdirSync(T + '/data/photos', { recursive: true }); fs.writeFileSync(T + '/data/photos/' + 'ab'.repeat(16) + '.jpg', 'orig'); fs.writeFileSync(T + '/data/photos/' + 'ab'.repeat(16) + '-c.jpg', 'copy');
const srv = spawn('node', ['--no-warnings', 'server.mjs'], { env: { ...process.env, PORT: '3022', DATA_DIR: T + '/data', FILES_DIR: T + '/pf', PHOTO_AI: 'off', BACKUP_COPY_TO: T + '/out' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const BASE = 'http://127.0.0.1:3022'; let cookie = '';
const call = (m, p, b) => fetch(BASE + p, { method: m, headers: { cookie, ...(b ? { 'Content-Type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined });
try {
  await new Promise(r => setTimeout(r, 1500));
  ok((await call('GET', '/api/backups')).status === 401, 'no login: no backups');
  const lr = await call('POST', '/api/login', { id: 'sam@bikepharma.com', password: 'Test@1234' }); cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  let j = await (await call('GET', '/api/backups')).json();
  ok(Array.isArray(j.list) && j.list.length === 0 && j.copyTo === true && j.keep === 14, 'Admin: empty list, copy set up, 14 days ' + JSON.stringify(j));
  j = await (await call('POST', '/api/backups')).json();
  ok(/^bikepharma-\d{4}-\d{2}-\d{2}-\d{4}\.tar\.gz$/.test(j.name) && j.list.length === 1 && j.list[0].copied, 'backup made and copied to the other server ' + JSON.stringify(j).slice(0, 200));
  ok(fs.existsSync(T + '/out/' + j.name), 'the copy is in the other folder');
  const r = await call('GET', '/api/backups/file?name=' + encodeURIComponent(j.name)); const buf = Buffer.from(await r.arrayBuffer());
  ok(r.status === 200 && /attachment/.test(r.headers.get('content-disposition')) && buf.length > 100, 'download works');
  fs.writeFileSync(T + '/dl.tar.gz', buf); const names = execFileSync('tar', ['-tzf', T + '/dl.tar.gz']).toString().split('\n');
  ok(names.includes('database/bikepharma.sqlite') && names.includes('README.txt') && names.includes('photos/' + 'ab'.repeat(16) + '.jpg') && !names.some(n => /-c\.jpg$/.test(n)), 'holds the database, readme and the photo as taken (not the app copy) ' + names.join(','));
  fs.mkdirSync(T + '/x'); execFileSync('tar', ['-xzf', T + '/dl.tar.gz', '-C', T + '/x']);
  const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(T + '/x/database/bikepharma.sqlite');
  ok(db.prepare('SELECT COUNT(*) n FROM kv').get().n > 0, 'database copy opens and has the logins');
  ok((await call('GET', '/api/backups/file?name=../bikepharma.sqlite')).status === 404, 'only backup files can be downloaded');
} catch (e) { ok(false, 'error ' + e.stack); }
srv.kill(); if (fails) console.log(log.slice(-1500)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
