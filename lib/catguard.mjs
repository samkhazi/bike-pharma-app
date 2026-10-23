// Catalogue guard (Sam 2026-10-23 "poore catalogues ek secured API banake ... server pe hi rhakh de"): the brand catalogues (cat/*.json)
// and the catalogue files (diagrams, books, part photos through /api/files) go out only to a staff login, every login has a daily
// amount, and every catalogue download is written to a log. A login that pulls more than a normal day's work (someone copying the
// catalogues) is stopped for the catalogues only, and Admin sees it in Security alerts and can unlock it. The day is India's day.
import fs from 'node:fs';
import path from 'node:path';

const MB = 1024 * 1024;
const dayOf = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);   // IST date

export function catGuard(store, dataDir, env = {}) {
  // a phone that loads every brand once is ~60 MB of catalogue lists; a day of diagrams and photos is a few hundred MB
  const LIM = { cat: (+env.CAT_DAY_MB || 300) * MB, files: (+env.CAT_FILES_DAY_MB || 3000) * MB };
  const LOG = path.join(dataDir, 'catalogue-access.log');
  const key = (uid, day) => uid + '|' + day;
  const get = (uid, day = dayOf()) => store.kvGet('catuse', key(uid, day)) || { cat: 0, files: 0, n: 0 };
  const log = o => { try { fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n'); } catch (e) {} };
  const blocked = uid => store.kvGet('catblock', uid + '|' + dayOf()) || null;

  return {
    LIM,
    // before sending: null = go ahead, else the error to send (429)
    check(user) {
      const b = blocked(user.id);
      return b ? 'Catalogue limit for today reached on this login. Admin can unlock it in Security alerts.' : null;
    },
    // after a send: count it, log it, block when the day's amount is passed
    count(user, kind, bytes, what, ip) {
      if (!bytes) return;
      const day = dayOf(), u = get(user.id, day);
      u[kind] = (u[kind] || 0) + bytes; u.n = (u.n || 0) + 1; u.name = user.name || ''; u.role = user.role || '';
      store.kvSet('catuse', key(user.id, day), u);
      if (kind === 'cat') log({ uid: user.id, name: user.name || '', role: user.role || '', file: what, bytes, ip });
      if (u[kind] > LIM[kind] && !blocked(user.id)) {
        const b = { at: new Date().toISOString(), kind, mb: Math.round(u[kind] / MB), name: user.name || '', role: user.role || '', ip };
        store.kvSet('catblock', user.id + '|' + day, b);
        log({ uid: user.id, name: user.name || '', blocked: kind, mb: b.mb, ip });
        console.log(new Date().toISOString(), '[catalogue] login stopped for today:', user.id, kind, b.mb + ' MB');
      }
    },
    // Admin: today's use and the stopped logins
    report() {
      const day = dayOf(), use = [], stopped = [];
      for (const [k, v] of store.kvAll('catuse')) { const [uid, d] = k.split('|'); if (d === day) use.push({ id: uid, name: v.name || '', role: v.role || '', catMB: +(v.cat / MB).toFixed(1), filesMB: +(v.files / MB).toFixed(1), n: v.n || 0 }); }
      for (const [k, v] of store.kvAll('catblock')) { const [uid, d] = k.split('|'); if (d === day && !v.unlocked) stopped.push({ id: uid, ...v }); }
      use.sort((a, b) => (b.catMB + b.filesMB) - (a.catMB + a.filesMB));
      return { day, limitMB: { cat: LIM.cat / MB, files: LIM.files / MB }, stopped, use: use.slice(0, 50) };
    },
    unlock(uid, by) {
      const day = dayOf(), b = blocked(uid); if (!b) return false;
      store.kvDel('catblock', uid + '|' + day);
      store.kvSet('catuse', key(uid, day), { cat: 0, files: 0, n: 0, name: b.name, role: b.role });   // a fresh day's amount
      log({ uid, unlocked: true, by });
      return true;
    },
    // old days are dropped (kept 30 days)
    tidy() {
      const old = dayOf(Date.now() - 30 * 86400e3);
      for (const ns of ['catuse', 'catblock']) for (const [k] of store.kvAll(ns)) if (k.split('|')[1] < old) store.kvDel(ns, k);
    },
  };
}
