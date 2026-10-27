// Update 11u (Sam 2026-10-23 "haan": after the 22 Oct break-in): the shop's data saved every night, kept 14 days, Admin downloads any day,
// and (when the .env names one) a copy sent to another server so a break-in here cannot take the backups too.
// What goes in: the database (a clean copy made while the site runs), product photos as taken, the photo AI's learning, the audit / access logs.
// Not in it: catalogue files (Sam uploads them again), the AI model files, .env (passwords and keys stay on the server), logs, old backups.
// .env: BACKUP_AT (IST hour, default 2), BACKUP_KEEP (days, default 14), BACKUP_COPY_TO (user@host:folder), BACKUP_SSH_KEY (key file)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const NAME = /^bikepharma-(\d{4}-\d{2}-\d{2})(-\d{4})?\.tar\.gz$/;
const istDay = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);
const istHour = (t = Date.now()) => new Date(t + 5.5 * 3600e3).getUTCHours();
const run = (cmd, args, opt = {}) => new Promise(ok => { let err = ''; const c = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], ...opt }); c.stderr.on('data', d => { err += d; }); c.on('error', e => ok({ code: -1, err: String(e.message || e) })); c.on('close', code => ok({ code, err: err.slice(-500) })); });

export function backups({ store, dataDir, env = process.env, log = console.log }) {
  const dir = path.join(dataDir, 'backups'), state = path.join(dir, 'backups.json');
  const keep = Math.max(1, parseInt(env.BACKUP_KEEP || '14', 10) || 14), at = Math.min(23, Math.max(0, parseInt(env.BACKUP_AT || '2', 10) || 0));
  const copyTo = String(env.BACKUP_COPY_TO || '').trim(), key = String(env.BACKUP_SSH_KEY || '').trim();
  let busy = null;
  const meta = () => { try { return JSON.parse(fs.readFileSync(state, 'utf8')); } catch { return {}; } };
  const putMeta = m => { fs.writeFileSync(state + '.tmp', JSON.stringify(m)); fs.renameSync(state + '.tmp', state); };
  function list() {
    let fl = []; try { fl = fs.readdirSync(dir).filter(f => NAME.test(f)); } catch {}
    const m = meta();
    return fl.map(f => { const st = fs.statSync(path.join(dir, f)); return { name: f, day: NAME.exec(f)[1], size: st.size, at: st.mtime.toISOString(), copied: (m[f] || {}).copied || null, copyErr: (m[f] || {}).copyErr || null }; })
      .sort((a, b) => b.name.localeCompare(a.name));
  }
  async function copyOut(f) {
    if (!copyTo) return;
    const m = meta(); m[f] = m[f] || {};
    const ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20'].concat(key ? ['-i', key] : []).join(' ');
    if (!copyTo.includes(':')) {   // a folder on this computer (a mounted disk)
      try { fs.mkdirSync(copyTo, { recursive: true }); const to = path.join(copyTo, f); if (!fs.existsSync(to)) fs.copyFileSync(path.join(dir, f), to); m[f].copied = new Date().toISOString(); delete m[f].copyErr; }
      catch (e) { m[f].copyErr = 'Copy failed: ' + e.message; }
      return putMeta(m);
    }
    const r = await run('rsync', ['-t', '--ignore-existing', '-e', ssh, path.join(dir, f), copyTo.replace(/\/?$/, '/')]);
    if (r.code === 0) { m[f].copied = new Date().toISOString(); delete m[f].copyErr; log(new Date().toISOString(), 'backup copied to the other server', f); }
    else { m[f].copyErr = 'Copy to the other server failed (' + r.code + '): ' + r.err.trim(); log(new Date().toISOString(), 'backup copy failed', f, r.err.trim()); }
    putMeta(m);
  }
  // one backup now; why = 'night' | 'admin'
  function make(why = 'night') {
    if (busy) return busy;
    busy = (async () => {
      fs.mkdirSync(dir, { recursive: true });
      const day = istDay(), hm = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(11, 16).replace(':', '');
      const name = 'bikepharma-' + day + (why === 'night' && !fs.existsSync(path.join(dir, 'bikepharma-' + day + '.tar.gz')) ? '' : '-' + hm) + '.tar.gz';
      const work = fs.mkdtempSync(path.join(dir, '.make-'));
      try {
        const snap = path.join(work, 'database');
        fs.mkdirSync(snap);
        store.backupTo(path.join(snap, store.file ? path.basename(store.file) : 'bikepharma.sqlite'));
        fs.writeFileSync(path.join(work, 'README.txt'), [
          'Bike Pharma backup ' + day + ' (' + why + ')',
          'database/  the shop data (bills, stock, products, customers, logins, settings). Restore: stop the site, put this file in data/, start it.',
          'photos/    product photos as taken (the app makes its white-background copies again by itself)',
          'Not inside: catalogue files (upload again from Admin > More > Catalogue files) and .env (keys and passwords stay on the server).', ''].join('\n'));
        const add = ['photos', 'ai-learn.json', 'catalogue-access.log', 'alt'].filter(f => fs.existsSync(path.join(dataDir, f)));
        const out = path.join(dir, name + '.part');
        const args = ['-czf', out, '-C', work, 'README.txt', 'database'];
        if (add.length) args.push('-C', dataDir, '--exclude=photos/*-c.jpg', '--exclude=photos/*-w.jpg', '--exclude=photos/*.ai', ...add);
        const r = await run('nice', ['-n', '10', 'tar', ...args]);
        if (r.code !== 0) throw new Error('tar ' + r.code + ': ' + r.err.trim());
        fs.renameSync(out, path.join(dir, name));
        log(new Date().toISOString(), 'backup made', name, fs.statSync(path.join(dir, name)).size, 'bytes', why);
      } finally { fs.rmSync(work, { recursive: true, force: true }); }
      // keep the newest ones (by day): the 14 latest days, every backup of those days
      const days = [...new Set(list().map(b => b.day))].slice(0, keep);
      for (const b of list()) if (!days.includes(b.day)) { fs.rmSync(path.join(dir, b.name), { force: true }); const m = meta(); delete m[b.name]; putMeta(m); }
      await copyOut(name);
      return name;
    })().finally(() => { busy = null; });
    return busy;
  }
  // every 10 minutes: tonight's backup once the IST hour has come; a copy that failed is tried again
  function tick() {
    const l = list();
    if (istHour() >= at && !fs.existsSync(path.join(dir, 'bikepharma-' + istDay() + '.tar.gz'))   /* 14j: an Admin backup that day does not count */) make('night').catch(e => log(new Date().toISOString(), 'backup failed', e.message));
    else if (copyTo && !busy) { const b = l.find(x => !x.copied); if (b) copyOut(b.name).catch(() => {}); }
  }
  for (const f of (() => { try { return fs.readdirSync(dir); } catch { return []; } })()) if (f.startsWith('.make-') || f.endsWith('.part')) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  setTimeout(tick, 60e3).unref(); setInterval(tick, 600e3).unref();
  const file = n => NAME.test(String(n || '')) && fs.existsSync(path.join(dir, n)) ? path.join(dir, n) : null;
  return { list, make, file, copyTo: !!copyTo, keep, at, busy: () => !!busy };
}
