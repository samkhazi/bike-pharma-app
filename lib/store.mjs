// Storage for the Bike Pharma site: SQLite (node:sqlite, built into Node 22+) with a JSON-file fallback.
// Everything is tiny: shop state keys (one JSON value per top-level key of the app's DB), a short
// per-key history for 3-way merges, and small key/value namespaces (passwords, sessions, otps).
import fs from 'node:fs';
import path from 'node:path';

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }

export const HAS_SQLITE = !!DatabaseSync;
const HIST_KEEP = 400; // revisions of history kept per key (for merging stale clients)

export function openStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  if (DatabaseSync) return new SqlStore(path.join(dataDir, 'bikepharma.sqlite'));
  return new JsonStore(path.join(dataDir, 'bikepharma.json'));
}

class SqlStore {
  constructor(file) {
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS kv(ns TEXT, k TEXT, v TEXT, PRIMARY KEY(ns,k));
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, rev INTEGER NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS hist(key TEXT, rev INTEGER, json TEXT, PRIMARY KEY(key,rev));`);
    this.q = {
      metaGet: this.db.prepare('SELECT v FROM meta WHERE k=?'),
      metaSet: this.db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'),
      kvGet: this.db.prepare('SELECT v FROM kv WHERE ns=? AND k=?'),
      kvSet: this.db.prepare('INSERT INTO kv(ns,k,v) VALUES(?,?,?) ON CONFLICT(ns,k) DO UPDATE SET v=excluded.v'),
      kvDel: this.db.prepare('DELETE FROM kv WHERE ns=? AND k=?'),
      kvAll: this.db.prepare('SELECT k,v FROM kv WHERE ns=?'),
      stGet: this.db.prepare('SELECT rev,json FROM state WHERE key=?'),
      stAll: this.db.prepare('SELECT key,rev,json FROM state'),
      stSince: this.db.prepare('SELECT key,rev,json FROM state WHERE rev>?'),
      stSet: this.db.prepare('INSERT INTO state(key,rev,json) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET rev=excluded.rev,json=excluded.json'),
      stDel: this.db.prepare('DELETE FROM state WHERE key=?'),
      hiSet: this.db.prepare('INSERT OR REPLACE INTO hist(key,rev,json) VALUES(?,?,?)'),
      hiAt: this.db.prepare('SELECT json FROM hist WHERE key=? AND rev<=? ORDER BY rev DESC LIMIT 1'),
      hiPrune: this.db.prepare('DELETE FROM hist WHERE key=? AND rev<(SELECT rev FROM hist WHERE key=? ORDER BY rev DESC LIMIT 1 OFFSET ?)'),
    };
  }
  rev() { const r = this.q.metaGet.get('rev'); return r ? +r.v : 0; }
  kvGet(ns, k) { const r = this.q.kvGet.get(ns, k); return r ? JSON.parse(r.v) : undefined; }
  kvSet(ns, k, v) { this.q.kvSet.run(ns, k, JSON.stringify(v)); }
  kvDel(ns, k) { this.q.kvDel.run(ns, k); }
  kvAll(ns) { return this.q.kvAll.all(ns).map(r => [r.k, JSON.parse(r.v)]); }
  stateGet(key) { const r = this.q.stGet.get(key); return r ? { rev: +r.rev, json: r.json } : null; }
  stateAll() { return this.q.stAll.all().map(r => ({ key: r.key, rev: +r.rev, json: r.json })); }
  stateSince(rev) { return this.q.stSince.all(rev).map(r => ({ key: r.key, rev: +r.rev, json: r.json })); }
  versionAt(key, rev) { const r = this.q.hiAt.get(key, rev); return r ? r.json : undefined; }
  // changes: {key: jsonString | null}; writes all under one new revision, returns it
  write(changes) {
    const keys = Object.keys(changes); if (!keys.length) return this.rev();
    this.db.exec('BEGIN');
    try {
      const rev = this.rev() + 1;
      for (const k of keys) {
        const j = changes[k];
        if (j === null) { this.q.stDel.run(k); this.q.hiSet.run(k, rev, 'null'); }
        else { this.q.stSet.run(k, rev, j); this.q.hiSet.run(k, rev, j); }
        this.q.hiPrune.run(k, k, HIST_KEEP);
      }
      this.q.metaSet.run('rev', String(rev));
      this.db.exec('COMMIT');
      return rev;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  close() { this.db.close(); }
}

class JsonStore {
  constructor(file) {
    this.file = file; this.mtime = -1;
    this.d = { rev: 0, kv: {}, state: {}, hist: {} };
    this.load();
  }
  load() { // re-read when another process (admin.mjs) changed the file
    let st = null; try { st = fs.statSync(this.file); } catch (e) {}
    const m = st ? st.mtimeMs : 0; if (m === this.mtime) return;
    try { if (st) this.d = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { console.error('store: could not read', this.file, e.message); }
    this.mtime = m;
  }
  flush() { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.d)); fs.renameSync(tmp, this.file); this.mtime = fs.statSync(this.file).mtimeMs; }
  rev() { this.load(); return this.d.rev || 0; }
  kvGet(ns, k) { this.load(); const n = this.d.kv[ns]; return n && k in n ? n[k] : undefined; }
  kvSet(ns, k, v) { this.load(); (this.d.kv[ns] = this.d.kv[ns] || {})[k] = v; this.flush(); }
  kvDel(ns, k) { this.load(); if (this.d.kv[ns]) { delete this.d.kv[ns][k]; this.flush(); } }
  kvAll(ns) { this.load(); return Object.entries(this.d.kv[ns] || {}); }
  stateGet(key) { this.load(); const r = this.d.state[key]; return r ? { rev: r.rev, json: r.json } : null; }
  stateAll() { this.load(); return Object.entries(this.d.state).map(([key, r]) => ({ key, rev: r.rev, json: r.json })); }
  stateSince(rev) { return this.stateAll().filter(r => r.rev > rev); }
  versionAt(key, rev) { this.load(); const h = this.d.hist[key] || []; let best; for (const x of h) if (x.rev <= rev && (!best || x.rev > best.rev)) best = x; return best ? best.json : undefined; }
  write(changes) {
    this.load();
    const keys = Object.keys(changes); if (!keys.length) return this.rev();
    const rev = this.rev() + 1;
    for (const k of keys) {
      const j = changes[k];
      if (j === null) delete this.d.state[k]; else this.d.state[k] = { rev, json: j };
      const h = (this.d.hist[k] = this.d.hist[k] || []); h.push({ rev, json: j === null ? 'null' : j });
      if (h.length > HIST_KEEP) h.splice(0, h.length - HIST_KEEP);
    }
    this.d.rev = rev; this.flush(); return rev;
  }
  close() {}
}
