// Update 11u (Sam 2026-10-23 "haan": after the 22 Oct break-in): the shop's data saved every night, kept 14 days, Admin downloads any day,
// and (when the .env names one) a copy sent to another server so a break-in here cannot take the backups too.
// 2026-11-05 (the server disk filled up and the site stopped; Sam: photos and catalogues stay as they are, only what is repeated goes):
// every night's file held ALL the photos again (46 GB for 14 days). Now each photo as taken is kept ONCE in data/backups/photos as a
// hard link: no extra disk space, and a photo removed from data/photos stays there. Files made before still holding photos are made
// slim once (any photo only they had goes into data/backups/photos first). No backup is made while the disk is nearly full.
// What goes in: the database (a clean copy made while the site runs), the photo AI's learning, the audit / access logs.
// Not in it: the photos (data/backups/photos, see above), catalogue files (Sam uploads them again), the AI model files, .env (passwords
// and keys stay on the server), logs, old backups.
// .env: BACKUP_AT (IST hour, default 2), BACKUP_KEEP (days, default 14), BACKUP_COPY_TO (user@host:folder; the photos go to its photos/),
// BACKUP_SSH_KEY (key file), BACKUP_MIN_FREE_MB (default 2048: less free disk than this and the database twice = no backup)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const NAME = /^bikepharma-(\d{4}-\d{2}-\d{2})(-\d{4})?\.tar\.gz$/;
const PHOTO = /^[a-f0-9]{32}\.(jpg|png|webp)$/;   // a photo as taken (the app's -c / -w copies are made again from it)
// tar's only complaint when a file holds no photos/ at all (nothing was written then)
const onlyNotFound = err => String(err || '').trim().split('\n').every(l => /Not found in archive|Exiting with failure status due to previous errors/.test(l));
const istDay = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);
const istHour = (t = Date.now()) => new Date(t + 5.5 * 3600e3).getUTCHours();
const run = (cmd, args, opt = {}) => new Promise(ok => { let err = ''; const c = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], ...opt }); c.stderr.on('data', d => { err += d; }); c.on('error', e => ok({ code: -1, err: String(e.message || e) })); c.on('close', code => ok({ code, err: err.slice(-500) })); });

export function backups({ store, dataDir, env = process.env, log = console.log }) {
  const dir = path.join(dataDir, 'backups'), state = path.join(dir, 'backups.json'), phDir = path.join(dir, 'photos'), srcPh = path.join(dataDir, 'photos');
  const keep = Math.max(1, parseInt(env.BACKUP_KEEP || '14', 10) || 14), at = Math.min(23, Math.max(0, parseInt(env.BACKUP_AT || '2', 10) || 0));
  const copyTo = String(env.BACKUP_COPY_TO || '').trim(), key = String(env.BACKUP_SSH_KEY || '').trim();
  const minFree = Math.max(64, +env.BACKUP_MIN_FREE_MB || 2048) * 1048576;
  let busy = null, slimP = null, lowAt = 0;
  const meta = () => { try { return JSON.parse(fs.readFileSync(state, 'utf8')); } catch { return {}; } };
  const putMeta = m => { fs.writeFileSync(state + '.tmp', JSON.stringify(m)); fs.renameSync(state + '.tmp', state); };
  function list() {
    let fl = []; try { fl = fs.readdirSync(dir).filter(f => NAME.test(f)); } catch {}
    const m = meta();
    return fl.map(f => { const st = fs.statSync(path.join(dir, f)); return { name: f, day: NAME.exec(f)[1], size: st.size, at: st.mtime.toISOString(), copied: (m[f] || {}).copied || null, copyErr: (m[f] || {}).copyErr || null }; })
      .sort((a, b) => b.name.localeCompare(a.name));
  }
  // every photo as taken, once: a hard link (the same file, no extra space); a photo the site removes later stays here
  function keepPhotos() {
    let fl = []; try { fl = fs.readdirSync(srcPh).filter(f => PHOTO.test(f)); } catch { return 0; }
    fs.mkdirSync(phDir, { recursive: true });
    let n = 0;
    for (const f of fl) {
      const from = path.join(srcPh, f), to = path.join(phDir, f);
      if (fs.existsSync(to)) continue;
      try { fs.linkSync(from, to); n++; }
      catch (e) {
        if (e.code !== 'EXDEV') { if (e.code !== 'EEXIST' && e.code !== 'ENOENT') log(new Date().toISOString(), 'backup photo', f, e.message); continue; }
        try { fs.copyFileSync(from, to + '.tmp'); fs.renameSync(to + '.tmp', to); n++; } catch (e2) { fs.rmSync(to + '.tmp', { force: true }); log(new Date().toISOString(), 'backup photo', f, e2.message); }   // data/backups on another disk
      }
    }
    if (n) log(new Date().toISOString(), 'backup: kept', n, 'new photo(s) in', phDir);
    return n;
  }
  const freeOf = p => { try { const s = fs.statfsSync(p); return s.bavail * s.bsize; } catch { return Infinity; } };
  const dbSize = () => { try { return fs.statSync(store.file).size; } catch { return 0; } };
  async function copyOut(f) {
    if (!copyTo) return;
    const m = meta(); m[f] = m[f] || {};
    const ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20'].concat(key ? ['-i', key] : []).join(' ');
    let err = '';
    if (!copyTo.includes(':')) {   // a folder on this computer (a mounted disk)
      try {
        fs.mkdirSync(path.join(copyTo, 'photos'), { recursive: true });
        const to = path.join(copyTo, f); if (!fs.existsSync(to)) fs.copyFileSync(path.join(dir, f), to);
        for (const p of (() => { try { return fs.readdirSync(phDir).filter(x => PHOTO.test(x)); } catch { return []; } })()) {
          const t = path.join(copyTo, 'photos', p); if (!fs.existsSync(t)) { fs.copyFileSync(path.join(phDir, p), t + '.tmp'); fs.renameSync(t + '.tmp', t); }
        }
      } catch (e) { err = 'Copy failed: ' + e.message; }
    } else {   // only files the other server does not have yet go (the photos: only new ones)
      const dest = copyTo.replace(/\/?$/, '/');
      let r = await run('rsync', ['-t', '--ignore-existing', '-e', ssh, path.join(dir, f), dest]);
      if (r.code === 0 && fs.existsSync(phDir)) r = await run('rsync', ['-rt', '--ignore-existing', '-e', ssh, phDir + '/', dest + 'photos/']);
      if (r.code !== 0) err = 'Copy to the other server failed (' + r.code + '): ' + r.err.trim();
    }
    if (err) { m[f].copyErr = err; log(new Date().toISOString(), 'backup copy failed', f, err); }
    else { m[f].copied = new Date().toISOString(); delete m[f].copyErr; log(new Date().toISOString(), 'backup copied to the other server', f); }
    putMeta(m);
  }
  // one backup now; why = 'night' | 'admin'
  function make(why = 'night') {
    if (busy) return busy;
    busy = (async () => {
      if (slimP) await slimP.catch(() => {});
      fs.mkdirSync(dir, { recursive: true });
      const free = freeOf(dir);
      if (free < minFree + 2 * dbSize()) {   // a backup must never fill the disk (2026-11-05: a full disk stopped the site)
        if (Date.now() - lowAt > 6 * 3600e3) { lowAt = Date.now(); log(new Date().toISOString(), 'backup skipped: disk nearly full,', Math.round(free / 1048576), 'MB free'); }
        throw new Error('Not enough free disk space for a backup (' + Math.round(free / 1048576) + ' MB free). Make room on the server first.');
      }
      keepPhotos();
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
          'Product photos are not inside: the server keeps every photo as taken once in data/backups/photos (copy them back to data/photos;',
          '  the app makes its white-background copies again by itself). With BACKUP_COPY_TO they are also on the other server, in photos/.',
          'Not inside: catalogue files (upload again from Admin > More > Catalogue files) and .env (keys and passwords stay on the server).', ''].join('\n'));
        const add = ['ai-learn.json', 'catalogue-access.log', 'alt', 'photos/ai-learn.json'].filter(f => fs.existsSync(path.join(dataDir, f)));
        const out = path.join(dir, name + '.part');
        const args = ['-czf', out, '-C', work, 'README.txt', 'database'];
        if (add.length) args.push('-C', dataDir, ...add);
        const r = await run('nice', ['-n', '10', 'tar', ...args]);
        if (r.code !== 0) { fs.rmSync(out, { force: true }); throw new Error('tar ' + r.code + ': ' + r.err.trim()); }
        fs.renameSync(out, path.join(dir, name));
        const m = meta(); m[name] = { ...(m[name] || {}), slim: 1 }; putMeta(m);
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
  // a file made before 2026-11-05 holds every photo again: any photo only it has goes into data/backups/photos (photos already there are
  // skipped, not written again), then the file is made again without the photos (same name; the database and the rest stay as they were)
  async function slim(b) {
    const file = path.join(dir, b.name), work = fs.mkdtempSync(path.join(dir, '.make-'));
    try {
      fs.mkdirSync(phDir, { recursive: true });
      const junk = ['--exclude=photos/*.tmp', '--exclude=photos/*.fail', '--exclude=photos/*.ai'];
      let r = await run('nice', ['-n', '10', 'tar', '-xzf', file, '-C', dir, '--skip-old-files', '--wildcards', '--exclude=photos/ai-learn.json', ...junk, 'photos/*']);
      if (r.code !== 0 && !onlyNotFound(r.err)) throw new Error('photos: tar ' + r.code + ': ' + r.err.trim());
      r = await run('nice', ['-n', '10', 'tar', '-xzf', file, '-C', work, '--exclude=photos/*.jpg', '--exclude=photos/*.png', '--exclude=photos/*.webp', ...junk]);
      if (r.code !== 0) throw new Error('tar ' + r.code + ': ' + r.err.trim());
      const parts = fs.readdirSync(work);
      if (!parts.includes('database')) throw new Error('no database inside');
      const out = file + '.part';
      r = await run('nice', ['-n', '10', 'tar', '-czf', out, '-C', work, ...parts]);
      if (r.code !== 0) { fs.rmSync(out, { force: true }); throw new Error('tar ' + r.code + ': ' + r.err.trim()); }
      const was = fs.statSync(file).size;
      fs.renameSync(out, file);
      log(new Date().toISOString(), 'backup made slim', b.name, was, '->', fs.statSync(file).size, 'bytes');
    } finally { fs.rmSync(work, { recursive: true, force: true }); }
  }
  function slimOld() {
    if (slimP || busy) return slimP;
    const m = meta(), todo = list().filter(b => !(m[b.name] || {}).slim && !(m[b.name] || {}).slimErr);
    if (!todo.length) return null;
    slimP = (async () => {
      keepPhotos();
      for (const b of todo) {
        if (freeOf(dir) < minFree) { log(new Date().toISOString(), 'backup slim waits: disk nearly full'); break; }
        let err = ''; try { await slim(b); } catch (e) { err = String(e.message || e).slice(0, 300); log(new Date().toISOString(), 'backup slim failed', b.name, err); }
        const mm = meta(); mm[b.name] = { ...(mm[b.name] || {}), ...(err ? { slimErr: err } : { slim: 1 }) }; putMeta(mm);
      }
    })().finally(() => { slimP = null; });
    return slimP;
  }
  // every 10 minutes: tonight's backup once the IST hour has come; a copy that failed is tried again
  function tick() {
    if (!busy && !slimP && slimOld()) return;
    const l = list();
    if (istHour() >= at && !fs.existsSync(path.join(dir, 'bikepharma-' + istDay() + '.tar.gz'))   /* 14j: an Admin backup that day does not count */) make('night').catch(e => log(new Date().toISOString(), 'backup failed', e.message));
    else if (copyTo && !busy) { const b = l.find(x => !x.copied); if (b) copyOut(b.name).catch(() => {}); }
  }
  for (const f of (() => { try { return fs.readdirSync(dir); } catch { return []; } })()) if (f.startsWith('.make-') || f.endsWith('.part')) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  setTimeout(tick, +env.BACKUP_FIRST_MS || 60e3).unref(); setInterval(tick, 600e3).unref();
  const file = n => NAME.test(String(n || '')) && fs.existsSync(path.join(dir, n)) ? path.join(dir, n) : null;
  return { list, make, file, copyTo: !!copyTo, keep, at, busy: () => !!(busy || slimP), slimOld, keepPhotos };
}
