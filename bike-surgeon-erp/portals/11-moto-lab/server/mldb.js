// Straight from the Moto Lab billing's database (Sam, 27 Nov 2026: "direct connect database only, I need instant").
// This panel reads the billing's MySQL database itself, READ ONLY, through the mysql command line program (like the admin
// panel's server/oldbill.js; nothing is ever written there). Every LIVE_SECONDS (3) one tiny question asks MySQL for the
// checksums of the four tables the bills come from; only when one of them changed are the items and bills read again.
// The bills are worked out exactly like the billing does: the same calculation as the admin panel's oldbill.js (a port of
// the billing's includes/ml-invoice-calc.php, checked to the rupee on 1927 real bills), so both panels show the same.
// .env (update.sh copies these lines from the admin panel's .env): OLD_DB_ML (the database), OLD_DB_USER + OLD_DB_PASS
// (or OLD_ML_USER + OLD_ML_PASS), OLD_DB_HOST, OLD_DB_PORT, OLD_DB_PUBKEY, MYSQL_BIN.
'use strict';
const { execFile } = require('node:child_process');
const C = require('./clock');

const env = k => String(process.env[k] || '').trim();
const on = () => !!(env('OLD_DB_ML') && (env('OLD_ML_USER') || env('OLD_DB_USER')));
const TABLES = ['invoice', 'invoice_items', 'ml_invoice_labour', 'cms_products'];

function mysql(sql) {
  const own = !!env('OLD_ML_USER');
  const args = ['-h', env('OLD_DB_HOST') || '127.0.0.1', '-P', env('OLD_DB_PORT') || '3306', '-u', env(own ? 'OLD_ML_USER' : 'OLD_DB_USER'),
    '--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4',
    // MySQL 8 users (caching_sha2_password) without TLS need the server's key; OLD_DB_PUBKEY=0 for a MariaDB client
    ...(env('OLD_DB_PUBKEY') === '0' ? [] : ['--get-server-public-key']), env('OLD_DB_ML'), '-e', sql];
  return new Promise((resolve, reject) => {
    execFile(env('MYSQL_BIN') || 'mysql', args, { env: { ...process.env, MYSQL_PWD: process.env[own ? 'OLD_ML_PASS' : 'OLD_DB_PASS'] || '' }, maxBuffer: 256 * 1024 * 1024, timeout: 50000 },
      (err, out, errOut) => err ? reject(new Error(String(errOut || err.message).replace(/\s+/g, ' ').trim().slice(0, 200))) : resolve(out));
  });
}
// q('invoice', {no: 'invoice_no', ...}): SELECT JSON_OBJECT('no', invoice_no, ...) FROM invoice, one object per line
async function q(table, cols) {
  const out = await mysql(`SELECT JSON_OBJECT(${Object.entries(cols).map(([k, c]) => `'${k}', ${c}`).join(', ')}) FROM \`${table}\``)
    .catch(e => { throw new Error(`${table}: ${e.message}`); });
  const rows = [];
  for (const line of out.split('\n')) if (line.trim()) { try { rows.push(JSON.parse(line)); } catch { /* a broken row is skipped */ } }
  return rows;
}

// the tiny check: one checksum per table (it changes when any row is added, changed or deleted)
async function stamp() {
  const out = await mysql(`CHECKSUM TABLE ${TABLES.map(t => `\`${t}\``).join(', ')}`);
  const st = out.split('\n').map(l => l.trim()).filter(Boolean).join('|');
  if (!st) throw new Error('MySQL gave no checksum');
  return st;
}

async function read() {
  const [inv, lines, lab, prods] = await Promise.all([
    q('invoice', { id: 'id', no: 'invoice_no', cust: 'customer_name', ph: 'customer_phone', type: 'type', total: 'total_amount',
      st: 'payment_status', pay: 'payment_method', sc: 'split_cash', su: 'split_upi', by: 'created_by_name', date: 'date', time: 'time', net: 'net_payable',
      spd: 'special_discount', wal: 'wallet_used', paid: 'paid_at', cby: 'collected_by_name' }),
    q('invoice_items', { id: 'id', i: 'invoice_id', p: 'product_id', n: 'product_name', q: 'quantity', r: 'rate', a: 'amount' }),
    q('ml_invoice_labour', { i: 'invoice_id', a: 'labour_amount' }),
    // a failed read of the items keeps the bills going (null = the items stay as they were)
    q('cms_products', { id: 'id', n: 'name', br: 'brand', sp: 'net_cost_price', mrp: 'gross_selling_price', st: 'stock', al: 'stock_alert_on',
      sn: 'serial_no', bar: 'bar_code', rack: 'rack' }).catch(e => { console.error('Moto Lab billing database:', e.message); return null; }),
  ]);
  return feed({ inv, lines, lab, prods });
}

// ---------------- small helpers (as in the admin panel's oldbill.js) -----------------------------------------------------
const num = v => { const n = Number(String(v ?? '').replace(/[₹,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 100) / 100;
const s = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const phone = v => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : d; };
const pad = n => String(n).padStart(2, '0');
// '28-10-2026' (or 2026-10-28) -> '28-10-2026'
function dmy(v) {
  const t = String(v ?? '').trim();
  let m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${pad(m[1])}-${pad(m[2])}-${m[3]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
// '06:17:59pm' / '18:17:59' / '2026-10-28 18:57:04' -> '6:17 pm'; and minutes of the day for sorting
function hm(v) {
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?/i);
  if (!m) return { txt: '', min: -1 };
  let h = Number(m[1]); const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return { txt: `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'am' : 'pm'}`, min: h * 60 + Number(m[2]) };
}
const TYPE = { U: 'Customer', M: 'Mechanic', W: 'Wholeseller' };

// ---------------- the Moto Lab bills, worked out exactly like the Moto Lab billing does ----------------------------------
// (includes/ml-invoice-calc.php of 24 Oct: the one calculation of its bills, All Invoices and Sales Report)
//   parts   = item price x qty: the price saved on the bill when the bill is frozen (paid with net_payable) or its item was
//             deleted, else the item's CURRENT price (net_cost_price is the selling price there, gross_selling_price the MRP)
//   special discount = parts x special_discount % (parts only); net = parts - special discount - wallet + labour
//             (a frozen bill: its net_payable). A split bill: the difference to the bill goes on its larger part.
//   day     = the day it was paid (paid_at), else the bill date. Only PAID bills are a sale.
const ML_UPI = ['upi', 'gpay', 'phonepe', 'paytm'], ML_CARD = ['card', 'debit', 'credit'];
// paise rounded like PHP round(x, 2): half away from zero on the decimal value (5% of 536.325 is 26.82, not 26.81)
const rp = n => { const a = Math.abs(Number(n) || 0), r = Number(Math.round(Number(a + 'e2')) + 'e-2'); return Number.isFinite(r) ? (n < 0 ? -r : r) : r2(n); };
// the bill number as the billing prints it (no number: ML + financial year + / + id)
function mlNo(v) {
  const raw = s(v.no, 40);
  if (raw) return raw.replace(/^BS/, 'ML');
  const d = dmy(v.date) || C.dmy(C.now()), m = Number(d.slice(3, 5)), y = Number(d.slice(6)), yy = n => String(n % 100).padStart(2, '0');
  return `ML${m >= 4 ? yy(y) + yy(y + 1) : yy(y - 1) + yy(y)}/${String(v.id).padStart(3, '0')}`;
}
function calc(ml) {
  const prod = new Map((ml.prods || []).map(p => [String(p.id), p]));
  const lines = new Map(), lab = new Map();
  for (const l of [...ml.lines].sort((a, b) => num(a.i) - num(b.i) || num(a.id) - num(b.id))) { const k = String(l.i); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(l); }
  for (const l of ml.lab) lab.set(String(l.i), (lab.get(String(l.i)) || 0) + num(l.a));
  const out = [];
  for (const v of ml.inv) {
    const paid = String(v.st || '').toUpperCase().trim() === 'PAID';
    const frozen = paid && v.net != null && String(v.net).trim() !== '';
    const parts = [];
    let pt = 0;
    for (const l of lines.get(String(v.id)) || []) {
      const qty = Math.trunc(num(l.q)); if (qty <= 0) continue;
      const p = prod.get(String(l.p)), cur = rp(num(p && p.sp)), saved = frozen || !(p && cur > 0);
      const total = saved ? rp(num(l.a)) || rp(rp(num(l.r)) * qty) : rp(cur * qty);
      parts.push({ pid: num(l.p) || null, name: s(p && p.n) || s(l.n) || `Item ${l.p}`, qty, total });
      pt += total;
    }
    pt = rp(pt);
    const labour = rp(lab.get(String(v.id)) || 0), sdPct = num(v.spd), wallet = rp(num(v.wal));
    const sd = sdPct > 0 ? rp(pt * sdPct / 100) : 0;
    const net = frozen ? rp(num(v.net)) : rp(pt - sd - wallet + labour);
    const method = String(v.pay || '').toLowerCase().trim() || 'cash';
    const mode = !paid ? 'Pending' : method === 'split' ? 'Split' : ML_UPI.includes(method) ? 'UPI' : ML_CARD.includes(method) ? 'Card' : 'Cash';
    let split = null;
    if (mode === 'Split') {
      const c = rp(num(v.sc)), u = rp(num(v.su)), d = rp(net - c - u);
      split = c + u > 0 ? (c >= u ? [rp(c + d), u] : [c, rp(u + d)]) : [net, 0];
    }
    const when = /^20\d\d-\d\d-\d\d/.test(String(v.paid || '')) ? String(v.paid) : null, t = hm(when ? when.slice(11) : v.time);
    const by = s(paid && s(v.cby) ? v.cby : v.by, 60).replace(/\s+-\s+.*$/, '').trim();
    out.push({ id: num(v.id), no: mlNo(v), date: dmy(when) || dmy(v.date), time: t.txt, min: t.min,
      cust: s(v.cust, 80), ph: phone(v.ph), type: TYPE[String(v.type).trim()] || 'Customer', parts, labour, net, mode, split, by });
  }
  return out;
}

// the same shape as the admin panel's GET /api/feed/motolab: items, and bills with lines [item id, qty, rate, name],
// fit = labour, net = the bill total
function feed(ml) {
  const items = ml.prods == null ? null : ml.prods.map(p => ({ id: num(p.id), name: s(p.n, 120), brand: s(p.br, 60), sp: r2(num(p.sp)), mrp: r2(num(p.mrp)),
    stock: Math.round(num(p.st)), alert: Math.round(num(p.al)), sku: s(p.sn, 60), bar: s(p.bar, 30), rack: s(p.rack, 20) })).filter(p => p.id && p.name);
  const bills = calc(ml).filter(c => c.date).map(c => ({ no: c.no, id: c.id, date: c.date, at: c.time, min: c.min, cust: c.cust, ph: c.ph,
    lines: c.parts.map(p => [p.pid, p.qty, r2(p.total / p.qty), p.name]), fit: c.labour, net: c.net, mode: c.mode, ...(c.split ? { cash: c.split[0] } : {}), by: c.by }));
  return { items, bills };
}

module.exports = { on, stamp, read, feed, calc, TABLES };
