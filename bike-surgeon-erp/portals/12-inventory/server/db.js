'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let db;

function open(file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'inventory.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrate();
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));   // indexes of a rebuilt table
  return db;
}

// Older databases get the new columns and stores (Inventory 2.0, 5 Nov 2026). Safe to run on every start.
function migrate() {
  const cols = t => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  const add = (t, defs) => { const have = cols(t); for (const [c, d] of defs) if (!have.includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`); };
  // parts.store had CHECK (store IN ('BS','ML')): rebuild the table once so Bike Pharma (BP) fits. Rows stay exactly the same.
  const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'parts'").get() || {}).sql || '';
  if (sql.includes("IN ('BS','ML')")) {
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec('BEGIN IMMEDIATE');
      db.exec('CREATE TABLE parts_bp ' + sql.slice(sql.indexOf('(')).replace("IN ('BS','ML')", "IN ('BS','ML','BP')"));
      db.exec('INSERT INTO parts_bp SELECT * FROM parts');
      const n1 = db.prepare('SELECT count(*) n FROM parts').get().n, n2 = db.prepare('SELECT count(*) n FROM parts_bp').get().n;
      if (n1 !== n2) throw new Error(`parts copy count ${n2} != ${n1}`);
      db.exec('DROP TABLE parts');
      db.exec('ALTER TABLE parts_bp RENAME TO parts');
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch (x) {} throw e; } finally { db.exec('PRAGMA foreign_keys = ON'); }
  }
  add('parts', [['sell', 'REAL NOT NULL DEFAULT 0'], ['sell_pct', 'REAL NOT NULL DEFAULT 0']]);
  add('accounts', [['ctr', "TEXT NOT NULL DEFAULT ''"]]);
  add('vendors', [['brands', "TEXT NOT NULL DEFAULT ''"], ['bank', "TEXT NOT NULL DEFAULT ''"],
    ['acc_name', "TEXT NOT NULL DEFAULT ''"], ['acc_no', "TEXT NOT NULL DEFAULT ''"], ['ifsc', "TEXT NOT NULL DEFAULT ''"], ['bank_name', "TEXT NOT NULL DEFAULT ''"], ['branch', "TEXT NOT NULL DEFAULT ''"]]);
  add('vendor_bills', [['flow', 'INTEGER NOT NULL DEFAULT 0'], ['stage', "TEXT NOT NULL DEFAULT ''"], ['sent_at', 'TEXT'], ['asg_at', 'TEXT'], ['priced_at', 'TEXT'], ['done_at', 'TEXT'], ['read_note', "TEXT NOT NULL DEFAULT ''"]]);
  add('vendor_bill_lines', [['brand', "TEXT NOT NULL DEFAULT ''"], ['cost', 'REAL'], ['disc', 'REAL'], ['disc_bill', 'REAL'], ['mrp_by', "TEXT NOT NULL DEFAULT ''"], ['ctr', "TEXT NOT NULL DEFAULT ''"], ['st', "TEXT NOT NULL DEFAULT ''"],
    ['sell_pct', 'REAL'], ['sell', 'REAL'], ['d_user', 'REAL'], ['d_mech', 'REAL'], ['d_whole', 'REAL'], ['shelf', "TEXT NOT NULL DEFAULT ''"],
    ['asg_by', 'TEXT'], ['asg_at', 'TEXT'], ['pr_by', 'TEXT'], ['pr_at', 'TEXT'], ['sk_by', 'TEXT'], ['sk_at', 'TEXT']]);
  db.exec('CREATE INDEX IF NOT EXISTS vbills_stage ON vendor_bills(flow, stage)');
  // Sam 6 Nov: bills with no due date (old imported bills) get bill date + the vendor's credit days
  db.exec(`UPDATE vendor_bills SET due = date(inv_date, '+' || coalesce((SELECT days FROM vendors v WHERE v.id = vendor_bills.vendor), 0) || ' days')
    WHERE coalesce(due, '') = '' AND inv_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`);
}

const get = () => db;
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

// Nested calls join the outer transaction
let depth = 0;
function tx(fn) {
  if (depth) return fn();
  db.exec('BEGIN IMMEDIATE'); depth++;
  try { const r = fn(); depth--; db.exec('COMMIT'); return r; }
  catch (e) { depth--; db.exec('ROLLBACK'); throw e; }
}

const setting = (k, fallback) => { const r = one('SELECT value FROM settings WHERE key = ?', k); return r ? r.value : fallback; };
const setSetting = (k, v) => run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v));

module.exports = { open, get, all, one, run, tx, setting, setSetting };
