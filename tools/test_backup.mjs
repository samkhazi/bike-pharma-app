// update 11u: Backups (Sam 2026-10-23): Admin makes / lists / downloads a backup; it holds the database;
// a copy goes to the "other server" (here a local folder through rsync); staff cannot see or download backups.
// 2026-11-05 (the disk filled up): photos are not in the file any more but kept once in data/backups/photos (hard links); an older file
// that still holds photos is made slim (a photo only it had is kept first); no backup while the disk is nearly full.
// usage: node tools/test_backup.mjs   (own server on 3022, fresh database)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = '/tmp/claude-0/bptest-backup'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T + '/out', { recursive: true });
const run = (args, env) => new Promise(r => { const a = spawn('node', ['--no-warnings', ...args], { env: { ...process.env, DATA_DIR: T + '/data', ...env } }); a.on('exit', r); });
await run(['admin.mjs', 'add-admin', 'sam@bikepharma.com', 'Sam', '--password', 'Test@1234']);
fs.mkdirSync(T + '/data/photos', { recursive: true }); fs.writeFileSync(T + '/data/photos/' + 'ab'.repeat(16) + '.jpg', 'orig'); fs.writeFileSync(T + '/data/photos/' + 'ab'.repeat(16) + '-c.jpg', 'copy');
fs.writeFileSync(T + '/data/photos/ai-learn.json', '{"v":1,"k":{}}');
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
  ok(names.includes('database/bikepharma.sqlite') && names.includes('README.txt') && names.includes('photos/ai-learn.json') && !names.some(n => /\.jpg$/.test(n)), 'holds the database, readme and the photo AI learning, no photos ' + names.join(','));
  const P = 'ab'.repeat(16) + '.jpg', kept = T + '/data/backups/photos/' + P;
  ok(fs.existsSync(kept) && fs.statSync(kept).ino === fs.statSync(T + '/data/photos/' + P).ino && !fs.existsSync(T + '/data/backups/photos/' + 'ab'.repeat(16) + '-c.jpg'), 'the photo as taken is kept once as a hard link (no extra space), not the app copy');
  ok(fs.readFileSync(T + '/out/photos/' + P, 'utf8') === 'orig', 'the photo went to the other server too');
  fs.mkdirSync(T + '/x'); execFileSync('tar', ['-xzf', T + '/dl.tar.gz', '-C', T + '/x']);
  const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(T + '/x/database/bikepharma.sqlite');
  ok(db.prepare('SELECT COUNT(*) n FROM kv').get().n > 0, 'database copy opens and has the logins');
  ok((await call('GET', '/api/backups/file?name=../bikepharma.sqlite')).status === 404, 'only backup files can be downloaded');
  fs.rmSync(T + '/data/photos/' + P); ok(fs.readFileSync(kept, 'utf8') === 'orig', 'a photo removed from data/photos is still in the backup photos');
} catch (e) { ok(false, 'error ' + e.stack); }
srv.kill();
// the backup code on its own: an old file with photos made slim, and no backup on a nearly full disk
try {
  const { backups } = await import('../lib/backup.mjs');
  const D = T + '/lib/data', B = D + '/backups', old = 'bikepharma-2026-11-04.tar.gz', h1 = 'cd'.repeat(16) + '.jpg', h2 = 'ef'.repeat(16) + '.png';
  fs.mkdirSync(D + '/photos', { recursive: true }); fs.mkdirSync(B, { recursive: true }); fs.writeFileSync(D + '/bikepharma.sqlite', 'the database');
  fs.writeFileSync(D + '/photos/' + h1, 'still here');
  const src = T + '/lib/old'; fs.mkdirSync(src + '/database', { recursive: true }); fs.mkdirSync(src + '/photos');
  fs.writeFileSync(src + '/README.txt', 'old'); fs.writeFileSync(src + '/database/bikepharma.sqlite', 'old database'); fs.writeFileSync(src + '/catalogue-access.log', 'log');
  fs.writeFileSync(src + '/photos/' + h1, 'still here'); fs.writeFileSync(src + '/photos/' + h2, 'only in the old file'); fs.writeFileSync(src + '/photos/ai-learn.json', '{}'); fs.writeFileSync(src + '/photos/x.jpg.tmp', 'half');
  execFileSync('tar', ['-czf', B + '/' + old, '-C', src, 'README.txt', 'database', 'catalogue-access.log', 'photos']);
  const store = { file: D + '/bikepharma.sqlite', backupTo: f => fs.copyFileSync(D + '/bikepharma.sqlite', f) }, quiet = () => {};
  const K = backups({ store, dataDir: D, env: { BACKUP_FIRST_MS: '999999999' }, log: quiet });
  await K.slimOld();
  const n2 = execFileSync('tar', ['-tzf', B + '/' + old]).toString().split('\n').filter(Boolean);
  ok(!n2.some(n => /\.(jpg|png|webp|tmp)$/.test(n)) && n2.includes('database/bikepharma.sqlite') && n2.includes('catalogue-access.log') && n2.includes('photos/ai-learn.json'), 'old file made slim: no photos, the database and the rest stay ' + n2.join(','));
  ok(fs.readFileSync(B + '/photos/' + h2, 'utf8') === 'only in the old file' && fs.statSync(B + '/photos/' + h1).ino === fs.statSync(D + '/photos/' + h1).ino && !fs.existsSync(B + '/photos/x.jpg.tmp') && !fs.existsSync(B + '/photos/ai-learn.json'), 'a photo only the old file had is kept; one still in data/photos stays a hard link; no junk');
  ok(JSON.parse(fs.readFileSync(B + '/backups.json', 'utf8'))[old].slim === 1 && K.slimOld() === null, 'made slim once only');
  const name = await K.make('admin'); const n3 = execFileSync('tar', ['-tzf', B + '/' + name]).toString();
  ok(/database\/bikepharma\.sqlite/.test(n3) && !/\.jpg/.test(n3) && K.list().length === 2, 'a new backup holds the database, no photos');
  const L = backups({ store, dataDir: D, env: { BACKUP_FIRST_MS: '999999999', BACKUP_MIN_FREE_MB: String(1e9) }, log: quiet });
  let e1 = ''; await L.make('admin').catch(e => { e1 = e.message; });
  ok(/Not enough free disk space/.test(e1) && L.list().length === 2, 'nearly full disk: no backup, a clear message (' + e1 + ')');
} catch (e) { ok(false, 'error ' + e.stack); }
if (fails) console.log(log.slice(-1500)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
