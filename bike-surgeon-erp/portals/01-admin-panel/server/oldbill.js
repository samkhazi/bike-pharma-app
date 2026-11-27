// Live link to the old PHP billing sites (billing.bikesurgeon.online and themotolab.bikesurgeon.online, 29 Oct).
// Every OLD_SECONDS (60) the panel READS their MySQL databases (a read-only user, nothing is ever written there) and
// fills its own lists with the real data: bills (invoices), today's job cards (jobs), customers, credit, mechanic
// sales, quotations, coupons and the workshop pages (mechanics, parts requests, waiting for spares, free service,
// feedback calls, service reminders). The first read also clears the sample lists. A list is rewritten only when its data
// changed, so open pages reload only then. Bills also go to the Inventory portal (POST /api/import/sales) so stock
// goes down for every part sold on the old sites.
// It talks to MySQL through the `mysql` command line program (installed with MySQL on the server), so no extra
// npm package is needed. The password goes to it in the MYSQL_PWD environment variable, never on the command line.
'use strict';
const { execFile } = require('node:child_process');
const crypto = require('node:crypto');
const db = require('./db');
const store = require('./store');
const C = require('./clock');

const env = k => String(process.env[k] || '').trim();
const on = () => !!(env('OLD_DB_USER') && (env('OLD_DB_BS') || env('OLD_DB_ML')));

// The lists the old sites own while the link is on (read-only in the panel)
const FROM_OLD = ['invoices', 'jobs', 'customers', 'credit', 'mechSales', 'quotes', 'coupons',
  'mechList', 'mechs', 'partsReq', 'spareWait', 'freeSvc', 'feedback', 'reminders'];
// Sample-only lists cleared on the first live read (they come back as the shop fills them in)
const SAMPLE_LISTS = ['memos', 'freeSvc', 'feedback', 'partsReq', 'trays', 'orders', 'returns', 'targets', 'targetHistory', 'todo',
  'closings', 'expenses', 'waLog', 'due', 'approvals', 'log', 'pos', 'mechs', 'staff', 'adv', 'spareWait', 'alerts', 'claims',
  'rackc', 'deadsug', 'gsum', 'bookings', 'offBills', 'reopen', 'billfix', 'catalogue', 'overrides', 'vendors', 'transfers'];
const SAMPLE_OBJECTS = { motolab: {}, daily: {}, deadAct: {}, backup: {}, jobx: {}, salPaid: {}, reminders: { adv: [], calls: [] } };

const linked = () => db.setting('old_link', '') === 'on';

// ---------------- MySQL through the command line ---------------------------------------------------------------------
// q('bs', 'invoice', {no: 'invoice_no', ...}) runs SELECT JSON_OBJECT('no', invoice_no, ...) FROM invoice and gives the
// rows as objects. One table per query (joins are done here), one JSON object per line (--raw keeps it as is).
function q(which, table, cols, where = '') {
  const database = env(which === 'bs' ? 'OLD_DB_BS' : 'OLD_DB_ML');
  const user = env(which === 'ml' && env('OLD_ML_USER') ? 'OLD_ML_USER' : 'OLD_DB_USER');
  const pass = process.env[which === 'ml' && env('OLD_ML_USER') ? 'OLD_ML_PASS' : 'OLD_DB_PASS'] || '';
  const sql = `SELECT JSON_OBJECT(${Object.entries(cols).map(([k, c]) => `'${k}', ${c}`).join(', ')}) FROM \`${table}\`${where ? ' WHERE ' + where : ''}`;
  const args = ['-h', env('OLD_DB_HOST') || '127.0.0.1', '-P', env('OLD_DB_PORT') || '3306', '-u', user, '--batch', '--raw',
    '--skip-column-names', '--default-character-set=utf8mb4',
    // MySQL 8 users (caching_sha2_password) without TLS need the server's key; OLD_DB_PUBKEY=0 for a MariaDB client
    ...(env('OLD_DB_PUBKEY') === '0' ? [] : ['--get-server-public-key']), database, '-e', sql];
  return new Promise((resolve, reject) => {
    execFile(env('MYSQL_BIN') || 'mysql', args, { env: { ...process.env, MYSQL_PWD: pass }, maxBuffer: 256 * 1024 * 1024, timeout: 50000 }, (err, out, errOut) => {
      if (err) return reject(new Error(`${which} ${table}: ${String(errOut || err.message).replace(/\s+/g, ' ').trim().slice(0, 200)}`));
      const rows = [];
      for (const line of out.split('\n')) if (line.trim()) { try { rows.push(JSON.parse(line)); } catch { /* a broken row is skipped */ } }
      resolve(rows);
    });
  });
}

// ---------------- small helpers ---------------------------------------------------------------------------------------
const num = v => { const n = Number(String(v ?? '').replace(/[₹,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 100) / 100;
const s = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const phone = v => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : d; };
const pad = n => String(n).padStart(2, '0');
// '28-10-2026' (or 2026-10-28) → '28-10-2026'; key '2026-10-28' for sorting
function dmy(v) {
  const t = String(v ?? '').trim();
  let m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${pad(m[1])}-${pad(m[2])}-${m[3]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
const key = d => d ? d.split('-').reverse().join('-') : '';
// '06:17:59pm' / '18:17:59' / '2026-10-28 18:57:04' → '6:17 pm'; and minutes of the day for sorting
function hm(v) {
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?/i);
  if (!m) return { txt: '', min: -1 };
  let h = Number(m[1]); const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return { txt: `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'am' : 'pm'}`, min: h * 60 + Number(m[2]) };
}
const PAY = { upi: 'UPI', cash: 'Cash', card: 'Card', split: 'Split', credit: 'Credit' };
const TYPE = { U: 'Customer', M: 'Mechanic', W: 'Wholeseller' };
const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
const hash = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');

// Bill lines, made to add up to the bill's own total: the old sites sometimes changed a total after the lines (coupon,
// special discount, a line removed). A higher total gets an "Other charges" line, a lower one a bill discount %.
function fitLines(items, partsTotal) {
  const sum = items.reduce((a, i) => a + i[1] * i[2], 0);
  if (!items.length && partsTotal > 0.5) return { items: [['Parts (old bill)', 1, r2(partsTotal)]], disc: 0 };
  const diff = r2(partsTotal - sum);
  if (diff > 0.5) return { items: [...items, ['Other charges (old bill)', 1, diff]], disc: 0 };
  if (diff < -0.5 && sum > 0) return { items, disc: Math.min(100, r2(-diff / sum * 100)) };
  return { items, disc: 0 };
}

// ---------------- read everything --------------------------------------------------------------------------------------
let products = { at: 0, bs: new Map() };
async function readBs() {
  const [inv, lines, lab, jcs, mech, bays, users, quotes, qItems, coupons, cUse] = await Promise.all([
    q('bs', 'invoice', { id: 'id', no: 'invoice_no', cust: 'customer_name', ph: 'customer_phone', type: 'type', total: 'total_amount',
      st: 'payment_status', pay: 'payment_method', sc: 'split_cash', su: 'split_upi', sk: 'split_card', by: 'created_by_name',
      jc: 'job_card_id', date: 'date', time: 'time', net: 'net_payable', bal: 'balance_due', cleared: 'credit_cleared_at', paid: 'paid_date', veh: 'vehicle_number' }),
    q('bs', 'invoice_items', { i: 'invoice_id', p: 'product_id', n: 'name', q: 'qty', a: 'selling_price', sn: 'serial_no' }),
    q('bs', 'job_labour_items', { jc: 'job_card_id', a: 'labour_price' }),
    q('bs', 'job_card', { id: 'id', ph: 'phone', cust: 'name', plate: 'vehicle_number', make: 'make', model: 'model', pkg: 'service_package',
      svc: 'SUBSTRING(service_type, 1, 120)', st: 'status', at: 'created_at', done: 'completed_at', go: 'initiated_at', late: 'delay_minutes',
      mech: 'mechanic_id', bay: 'bay_id', slot: 'slot', adv: 'created_by_name', dd: 'dd', mm: 'mm', yy: 'yy', free: 'is_free_service_claim' }),
    q('bs', 'mechanic', { id: 'id', name: 'name' }),
    q('bs', 'bay', { id: 'id', name: 'name' }),
    q('bs', 'user', { id: 'id', ph: 'userphone', wallet: 'wallet' }),
    q('bs', 'quotations', { id: 'id', cust: 'customer_name', ph: 'customer_phone', plate: 'vehicle_number', make: 'make', model: 'model', by: 'created_by', at: 'created_at', cc: 'cc_type' }),
    q('bs', 'quotation_items', { qid: 'quotation_id', n: 'name', q: 'qty', p: 'unit_price', d: 'discount_percent', a: 'amount' }),
    q('bs', 'coupons', { id: 'id', code: 'code', pct: 'discount_percent', till: 'valid_until', st: 'status', desc: 'description' }),
    q('bs', 'coupon_usage', { cid: 'coupon_id', amt: 'discount_amount', at: 'used_at' }),
  ]);
  // part names for lines saved without one (product list read again every 10 minutes)
  if (Date.now() - products.at > 10 * 60 * 1000 || !products.bs.size) {
    const p = await q('bs', 'cms_products', { id: 'id', n: 'name', sn: 'serial_no' });
    products = { at: Date.now(), bs: new Map(p.map(x => [String(x.id), x])) };
  }
  // workshop pages; a table missing on the old site gives an empty page, not a stopped link
  const opt = (...a) => q(...a).catch(e => { console.error('old billing link:', e.message); return []; });
  const [preq, pitems, fbk, rem, calls, advs] = await Promise.all([
    opt('bs', 'service_parts_request', { id: 'id', jc: 'job_card_id', plate: 'bike_number', prod: 'SUBSTRING(products, 1, 600)', st: 'status',
      at: 'pushed_at', by: 'attended_by', att: 'attended_at', miss: 'is_missed', type: 'request_type' }, 'pushed_at >= NOW() - INTERVAL 40 DAY'),
    opt('bs', 'service_parts_request_items', { rid: 'request_id', n: 'product_name', st: 'item_status', until: 'arranging_until', lbl: 'arranging_label', upd: 'updated_at' },
      'request_id IN (SELECT id FROM service_parts_request WHERE pushed_at >= NOW() - INTERVAL 40 DAY)'),
    opt('bs', 'feedback_calls', { jc: 'job_card_id', cust: 'customer_name', ph: 'customer_phone', plate: 'vehicle_number', svc: 'SUBSTRING(service_type, 1, 120)',
      r: 'overall_rating', mood: 'customer_mood', comp: 'SUBSTRING(complaint, 1, 200)', rem: 'SUBSTRING(remarks, 1, 200)', cs: 'call_status', at: 'called_at' }, 'called_at >= NOW() - INTERVAL 4 DAY'),
    opt('bs', 'next_service_reminders', { id: 'id', jc: 'job_card_id', adv: 'advisor_id', plate: 'vehicle_number', cust: 'customer_name', due: 'next_service_due', st: 'last_call_status', at: 'created_at' }),
    opt('bs', 'next_service_call_log', { rid: 'reminder_id', adv: 'advisor_id', cs: 'call_status', at: 'called_at' }),
    opt('bs', 'service_adviser', { id: 'id', name: 'name' }),
  ]);
  return { inv, lines, lab, jcs, mech, bays, users, quotes, qItems, coupons, cUse, preq, pitems, fbk, rem, calls, advs };
}
async function readMl() {
  const [inv, lines, lab, prods] = await Promise.all([
    q('ml', 'invoice', { id: 'id', no: 'invoice_no', cust: 'customer_name', ph: 'customer_phone', type: 'type', total: 'total_amount',
      st: 'payment_status', pay: 'payment_method', sc: 'split_cash', su: 'split_upi', by: 'created_by_name', date: 'date', time: 'time', net: 'net_payable',
      spd: 'special_discount', wal: 'wallet_used', paid: 'paid_at', cby: 'collected_by_name' }),
    q('ml', 'invoice_items', { id: 'id', i: 'invoice_id', p: 'product_id', n: 'product_name', q: 'quantity', r: 'rate', a: 'amount' }),
    q('ml', 'ml_invoice_labour', { i: 'invoice_id', a: 'labour_amount' }),
    // the store's items: their price is the price of the older bills, and the Moto Lab panel shows them with stock and rack.
    // A failed read keeps the bills going (null = items not read)
    q('ml', 'cms_products', { id: 'id', n: 'name', br: 'brand', sp: 'net_cost_price', mrp: 'gross_selling_price', st: 'stock', al: 'stock_alert_on',
      sn: 'serial_no', bar: 'bar_code', rack: 'rack' }).catch(e => { console.error('old billing link:', e.message); return null; }),
  ]);
  return { inv, lines, lab, prods };
}

// ---------------- The Moto Lab bills, worked out exactly like the Moto Lab billing does -----------------------------------
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
function mlCalc(ml) {
  const prod = new Map((ml.prods || []).map(p => [String(p.id), p]));
  const lines = new Map(), lab = new Map();
  for (const l of [...ml.lines].sort((a, b) => num(a.i) - num(b.i) || num(a.id) - num(b.id))) { const k = String(l.i); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(l); }
  for (const l of ml.lab) lab.set(String(l.i), (lab.get(String(l.i)) || 0) + num(l.a));
  const out = [];
  for (const v of ml.inv) {
    const paid = String(v.st || '').toUpperCase().trim() === 'PAID';
    const frozen = paid && v.net != null && String(v.net).trim() !== '';
    const parts = [], fwd = [];
    let pt = 0;
    for (const l of lines.get(String(v.id)) || []) {
      // for the Inventory portal: the saved line, by old id only (as the stock import matched them, unchanged since 29 Oct)
      const q0 = num(l.q);
      if (q0) fwd.push({ old: num(l.p) || undefined, qty: q0, rate: rp((num(l.a) || num(l.r) * q0) / q0) });
      const qty = Math.trunc(q0); if (qty <= 0) continue;
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
    out.push({ id: num(v.id), no: mlNo(v), oldNo: s(v.no, 40) || `ML-OLD-${v.id}`, day: dmy(v.date), date: dmy(when) || dmy(v.date), time: t.txt, min: t.min,
      cust: s(v.cust, 80), ph: phone(v.ph), type: TYPE[String(v.type).trim()] || 'Customer', parts, fwd, pt, sdPct, sd, wallet, labour, net, frozen, paid, mode, split, by });
  }
  return out;
}

// What the Moto Lab panel shows from the Moto Lab billing (GET /api/feed/motolab): its items and every bill. Bill lines are
// [item id, qty, rate, name]; fit = labour; net = the bill total. Kept from the last good read.
let mlLast = null;
function mlFeed(ml) {
  const items = ml.prods == null ? null : ml.prods.map(p => ({ id: num(p.id), name: s(p.n, 120), brand: s(p.br, 60), sp: r2(num(p.sp)), mrp: r2(num(p.mrp)),
    stock: Math.round(num(p.st)), alert: Math.round(num(p.al)), sku: s(p.sn, 60), bar: s(p.bar, 30), rack: s(p.rack, 20) })).filter(p => p.id && p.name);
  const bills = mlCalc(ml).filter(c => c.date).map(c => ({ no: c.no, id: c.id, date: c.date, at: c.time, min: c.min, cust: c.cust, ph: c.ph,
    lines: c.parts.map(p => [p.pid, p.qty, r2(p.total / p.qty), p.name]), fit: c.labour, net: c.net, mode: c.mode, ...(c.split ? { cash: c.split[0] } : {}), by: c.by }));
  return { items, bills };
}
const motolab = () => mlLast;

// ---------------- old rows → the panel's lists ---------------------------------------------------------------------------
const JST = { COMPLETED: 'done', ONGOING: 'ongoing', 'WORK IN PROGRESS': 'ongoing', PENDING: 'pending', STREAM_STOPPED: 'paused', NOT_APPROVED: 'pending' };
const dur = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
// MySQL's own clock (CURRENT_TIMESTAMP columns) runs on UTC; the PHP pages wrote Indian time. utcIst: UTC → 'yyyy-mm-dd hh:mm' IST
const utcIst = v => { const t = Date.parse(String(v ?? '').replace(' ', 'T') + 'Z'); return Number.isFinite(t) ? new Date(t + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ') : ''; };
const svcName = j => { const svc = s(j.svc, 120); return /^GENERAL SERVIC/i.test(svc) ? `General service${j.pkg ? ` (${s(j.pkg, 20)})` : ''}` : cap(svc.toLowerCase()) || s(j.pkg, 40) || 'Service'; };
const plateKey = v => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const RES = { CONNECTED: 'Connected', BOOKED: 'Booked', RNR: 'No answer', NA: 'Not reachable', NOT_INTERESTED: 'Not interested', PENDING: 'To call' };

function build(bs, ml, today = C.dmy(C.now())) {
  const out = { invoices: [], jobs: [], customers: [], credit: [], mechSales: [], quotes: [], coupons: [] };
  const sales = [];              // for the Inventory portal: {store, no, day, cancel, lines: [{old, pno, name, qty, rate}]}
  const sortKey = new Map();

  if (bs) {
    const jcById = new Map(bs.jcs.map(j => [String(j.id), j]));
    const mechName = new Map(bs.mech.map(m => [String(m.id), s(m.name, 60)]));
    const bayName = new Map(bs.bays.map(b => [String(b.id), s(b.name, 20)]));
    const labour = new Map();
    for (const l of bs.lab) labour.set(String(l.jc), (labour.get(String(l.jc)) || 0) + num(l.a));
    const lines = new Map();
    for (const l of bs.lines) { const k = String(l.i); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(l); }
    // the labour of a job card goes on its first bill only (a job card can get a second bill for spares added later)
    const firstBill = new Map();
    for (const v of [...bs.inv].sort((a, b) => num(a.id) - num(b.id))) if (v.jc && !firstBill.has(String(v.jc))) firstBill.set(String(v.jc), String(v.id));
    const cr = new Map();
    for (const v of bs.inv) {
      // a bill counts on the day it was PAID, like the old Sales Report and All Invoices (paid_date, else the bill date)
      const date = dmy(v.paid) || dmy(v.date);
      if (!date) continue;
      const no = s(v.no, 40) || `BS-OLD-${v.id}`;
      const ls = lines.get(String(v.id)) || [];
      const items = [], fwd = [];
      for (const l of ls) {
        const qty = num(l.q); if (!qty) continue;
        const prod = products.bs.get(String(l.p));
        const name = s(l.n) || s(prod && prod.n) || s(l.sn) || s(prod && prod.sn) || `Part ${l.p}`;
        items.push([name, qty, r2(num(l.a) / qty)]);
        fwd.push({ old: num(l.p) || undefined, pno: s(l.sn || (prod && prod.sn), 60) || undefined, qty, rate: r2(num(l.a) / qty) });
      }
      const jc = v.jc && String(v.jc) !== '0' ? String(v.jc) : '';
      const job = jc ? jcById.get(jc) : null;
      const parts = num(v.total);
      const labSum = jc && firstBill.get(jc) === String(v.id) ? labour.get(jc) || 0 : 0;
      // net_payable (the printed bill, saved since 23 Oct 2026) is the truth: labour = what is left after the parts,
      // a bill below its parts total had a discount and no labour, and paise go to the round-off below
      const net = v.net != null ? num(v.net) : 0, d = r2(net - parts);
      let lab = labSum, partsTo = parts;
      if (net > 0 && Math.abs(d - labSum) >= 1.5) { if (d >= 0) lab = d; else { lab = 0; if (d <= -1.5) partsTo = net; } }
      const fit = fitLines(items, partsTo);
      const st = String(v.st || '').toUpperCase().trim();
      const method = String(v.pay || '').toLowerCase().trim();
      const t = hm(v.time);
      const bill = { no, b: 'bs', br: 'dvg', date, time: t.txt, cust: s(v.cust, 80), ph: phone(v.ph), type: TYPE[String(v.type).trim()] || 'Customer',
        items: fit.items, lab: r2(lab), disc: fit.disc, pay: st === 'CREDIT' ? 'Credit' : st === 'PAID' ? PAY[method] || cap(method) || 'Cash' : '',
        st: st === 'PENDING' ? 'pending' : 'paid', by: s(v.by, 60), src: 'billing', oid: num(v.id) };
      if (bill.pay === 'Split') bill.split = [r2(num(v.sc)), r2(num(v.su) + num(v.sk))];
      if (job || jc) {
        Object.assign(bill, { jc, plate: s((job && job.plate) || v.veh, 20).toUpperCase(), model: s(job ? `${job.make || ''} ${job.model || ''}` : '', 60),
          adv: s(job && job.adv, 60), svc: job && String(job.st || '').toUpperCase().trim() === 'COMPLETED' ? 'Finalized' : 'Work in progress' });
        const inAt = job && hm(job.at).txt, outAt = job && job.done && hm(job.done).txt;
        if (inAt) bill.inAt = inAt;
        if (outAt) bill.outAt = outAt;
      }
      bill.amt = r2(bill.items.reduce((a, i) => a + i[1] * i[2], 0) * (1 - bill.disc / 100) + bill.lab);
      // round-off of the printed bill (net payable), so totals match the old report to the paisa
      const ro = net > 0 ? r2(net - bill.amt) : 0;
      if (ro && Math.abs(ro) < 2) { bill.ro = ro; bill.amt = r2(bill.amt + ro); }
      out.invoices.push(bill);
      sortKey.set(bill, `${key(date)} ${String(t.min).padStart(4, '0')} ${String(v.id).padStart(8, '0')}`);
      sales.push({ store: 'BS', no, day: key(dmy(v.date) || date), lines: fwd });   // stock moves on the bill date, as before
      // credit (udhaar): bills given on credit, open or cleared
      const bal = num(v.bal);
      if ((st === 'CREDIT' || bal > 0.5) && bill.ph) {
        const c = cr.get(bill.ph) || { id: cr.size + 1, name: bill.cust, ph: bill.ph, type: bill.type, b: 'bs', br: 'dvg', bills: [], pays: [] };
        c.bills.push([no, dmy(v.date) || date, bill.amt, v.cleared ? bill.amt : r2(bill.amt - Math.min(bal, bill.amt))]);
        cr.set(bill.ph, c);
      }
    }

    // job cards: today's, plus older ones still open from the last 30 days ("never closed")
    const t0 = key(today), back = key(C.dmy(C.addDays(C.now(), -30)));
    for (const j of bs.jcs) {
      const d = j.dd && j.mm && j.yy ? `${pad(j.dd)}-${pad(j.mm)}-${j.yy}` : dmy(j.at);
      if (!d) continue;
      let st = JST[String(j.st || '').toUpperCase().trim()] || 'pending';
      // an older card still open (waiting, working or paused for spares) is a pending vehicle, not one "in today"
      let old = false;
      if (key(d) !== t0) { if (st === 'done' || key(d) < back) continue; old = true; }
      const go = j.go ? hm(j.go) : null, done = j.done ? hm(j.done) : null;
      const late = num(j.late);
      if (st === 'ongoing' && late > 0) st = 'delayed';
      out.jobs.push({ jc: String(j.id), plate: s(j.plate, 20).toUpperCase(), model: s(`${j.make || ''} ${j.model || ''}`, 60), cust: s(j.cust, 80), ph: phone(j.ph),
        service: svcName(j),
        slot: s(j.slot, 10), mech: mechName.get(String(j.mech)) || '', bay: Number(String(bayName.get(String(j.bay)) || '').replace(/\D/g, '')) || '',
        started: go && go.txt ? go.txt : '', time: go && done && done.min >= go.min ? dur(done.min - go.min) : '', st, adv: s(j.adv, 60),
        ...(st === 'delayed' ? { delay: dur(late) } : {}), ...(old ? { old: true } : {}), date: d });
    }
    out.jobs.sort((a, b) => Number(b.jc) - Number(a.jc));

    // quotations and coupons
    const qi = new Map();
    for (const x of bs.qItems) { const k = String(x.qid); if (!qi.has(k)) qi.set(k, []); const qn = num(x.q) || 1; qi.get(k).push([s(x.n, 120), qn, r2((num(x.a) || num(x.p) * qn * (1 - num(x.d) / 100)) / qn)]); }
    out.quotes = bs.quotes.sort((a, b) => num(b.id) - num(a.id)).map(x => ({ id: `Q${String(x.id).padStart(4, '0')}`, date: dmy(x.at), plate: s(x.plate, 20).toUpperCase(),
      cust: s(x.cust, 80), ph: phone(x.ph), variant: s(x.cc, 20), model: s(`${x.make || ''} ${x.model || ''}`, 60), by: s(x.by, 60), items: qi.get(String(x.id)) || [] }));
    const use = new Map();
    for (const u of bs.cUse) { const k = String(u.cid); const o = use.get(k) || { n: 0, t: 0, last: '' }; o.n++; o.t += num(u.amt); const d = dmy(u.at); if (key(d) > key(o.last)) o.last = d; use.set(k, o); }
    out.coupons = bs.coupons.map(c => { const u = use.get(String(c.id)) || { n: 0, t: 0, last: '' };
      return { code: s(c.code, 30), pct: num(c.pct), till: dmy(c.till), desc: s(c.desc, 80), uses: u.n, total: r2(u.t), last: u.last, off: String(c.st || '').toUpperCase() !== 'ACTIVE' }; });

    workshop(bs, out, today, { jcById, mechName, bayName, labour });
    out.credit = [...cr.values()];
    // wallets and customer ids from the old user table
    out._users = new Map(bs.users.map(u => [phone(u.ph), u]));
  }

  if (ml) {
    // worked out like the Moto Lab billing itself (mlCalc). The admin's lines are [name, qty, each] with the special discount as
    // the bill discount %; a frozen bill's lines are made to add up to its net payable; the wallet is a minus line
    for (const c of mlCalc(ml)) {
      if (!c.date) continue;
      const items = c.parts.map(p => [p.name, p.qty, r2(p.total / p.qty)]);
      if (c.wallet) items.push(['Wallet used (old bill)', 1, -c.wallet]);
      const fit = c.frozen ? fitLines(items, r2(c.net - c.labour)) : { items, disc: Math.min(100, Math.max(0, c.sdPct)) };
      const bill = { no: c.no, b: 'ml', br: 'dvg', date: c.date, time: c.time, cust: c.cust, ph: c.ph, type: c.type,
        items: fit.items, lab: c.labour, disc: fit.disc, pay: c.paid ? c.mode : '', st: c.paid ? 'paid' : 'pending', by: c.by, src: 'billing', oid: c.id };
      if (c.split) bill.split = c.split;
      bill.amt = r2(bill.items.reduce((a, i) => a + i[1] * i[2], 0) * (1 - bill.disc / 100) + bill.lab);
      const ro = r2(c.net - bill.amt);                 // paise of rounding, so the totals match the Moto Lab report
      if (ro && Math.abs(ro) < 2) { bill.ro = ro; bill.amt = c.net; }
      out.invoices.push(bill);
      sortKey.set(bill, `${key(c.date)} ${String(c.min).padStart(4, '0')} ${String(c.id).padStart(8, '0')}`);
      if (c.day) sales.push({ store: 'ML', no: c.oldNo, day: key(c.day), lines: c.fwd });   // stock: as before (same bill number and day)
    }
  }

  out.invoices.sort((a, b) => sortKey.get(b) < sortKey.get(a) ? -1 : sortKey.get(b) > sortKey.get(a) ? 1 : 0);

  // customers and mechanic sales, from the bills
  const cust = new Map(), mech = new Map();
  const month = today.slice(3), lastM = (() => { const [m, y] = month.split('-').map(Number); return m === 1 ? `12-${y - 1}` : `${pad(m - 1)}-${y}`; })();
  for (const v of [...out.invoices].reverse()) {           // oldest first, so the newest name and type win
    if (!v.ph) continue;
    const k = `${v.b}:${v.ph}`;
    const u = v.b === 'bs' && out._users ? out._users.get(v.ph) : null;
    const c = cust.get(k) || { id: u ? num(u.id) : `${v.b.toUpperCase()}-${cust.size + 1}`, name: '', ph: v.ph, type: 'Customer', b: v.b, br: 'dvg', wallet: u ? num(u.wallet) : 0, visits: 0, spent: 0, last: '' };
    if (v.cust) c.name = v.cust;
    c.type = v.type; c.visits++; if (v.st === 'paid') c.spent = r2(c.spent + v.amt); c.last = v.date;
    cust.set(k, c);
    if (v.type === 'Mechanic') {
      const m = mech.get(v.ph) || [v.cust, v.ph, 0, 0, 0, 0, 0];
      m[0] = v.cust || m[0]; m[2]++; m[3] += v.items.reduce((a, i) => a + i[1], 0);
      if (v.date.slice(3) === month) m[4] = r2(m[4] + v.amt);
      if (v.date.slice(3) === lastM) m[5] = r2(m[5] + v.amt);
      m[6] = r2(m[6] + v.amt);
      mech.set(v.ph, m);
    }
  }
  out.customers = [...cust.values()].map(c => ({ ...c, name: c.name || 'No name' })).sort((a, b) => key(b.last) < key(a.last) ? -1 : key(b.last) > key(a.last) ? 1 : 0);
  out.mechSales = [...mech.values()].sort((a, b) => b[6] - a[6]);
  delete out._users;
  for (const v of out.invoices) delete v.oid;
  return { lists: out, sales };
}

// ---------------- workshop pages ---------------------------------------------------------------------------------------
function workshop(bs, out, today, { jcById, mechName, bayName, labour }) {
  const t0 = key(today), month = today.slice(3), nowMs = C.now().getTime();
  const jDate = j => j.dd && j.mm && j.yy ? `${pad(j.dd)}-${pad(j.mm)}-${j.yy}` : dmy(j.at);
  const jView = id => { const j = jcById.get(String(id)) || {};
    return { model: s(`${j.make || ''} ${j.model || ''}`, 60), cust: s(j.cust, 80), ph: phone(j.ph), mech: mechName.get(String(j.mech)) || '',
      bay: Number(String(bayName.get(String(j.bay)) || '').replace(/\D/g, '')) || '' }; };

  // mechanics: every mechanic of the old site; "Present" when a job card of today has them
  const today_ = out.jobs.filter(j => !j.old && j.st !== 'stale');
  out.mechList = bs.mech.map(m => { const name = s(m.name, 60); const mine = today_.filter(j => j.mech === name);
    const first = mine.map(j => hm(j.started)).filter(x => x.min >= 0).sort((a, b) => a.min - b.min)[0];
    return { name, role: 'Mechanic', b: 'bs', br: 'dvg', att: mine.length ? 'Present' : 'Not seen', in: first ? first.txt : '', out: '' }; })
    .sort((a, b) => a.name.localeCompare(b.name));
  const ms = new Map();
  for (const j of bs.jcs) {
    const d = jDate(j); if (d.slice(3) !== month || String(j.st || '').toUpperCase().trim() !== 'COMPLETED') continue;
    const n = mechName.get(String(j.mech)); if (!n) continue;
    const m = ms.get(n) || { name: n, b: 'bs', br: 'dvg', veh: 0, lab: 0, cb: 0 }; m.veh++; m.lab = r2(m.lab + (labour.get(String(j.id)) || 0)); ms.set(n, m);
  }
  out.mechs = [...ms.values()];

  // parts requests of today (pushed_at is Indian time); 15 minutes without an answer = overdue
  const items = new Map();
  for (const x of bs.pitems) { const k = String(x.rid); if (!items.has(k)) items.set(k, []); items.get(k).push(x); }
  out.partsReq = bs.preq.filter(p => key(dmy(p.at)) === t0).sort((a, b) => num(b.id) - num(a.id)).map(p => {
    let parts = []; try { parts = JSON.parse(p.prod); } catch { /* plain text */ }
    if (!Array.isArray(parts) || !parts.length) parts = (items.get(String(p.id)) || []).map(x => x.n);
    if (!parts.length && p.prod) parts = [p.prod];
    const st0 = String(p.st || '').toLowerCase(), at = C.parse(p.at);
    const st = st0 === 'done' ? 'done' : st0 === 'missed' || num(p.miss) ? 'overdue'
      : st0 === 'seen' || p.att ? 'progress' : at && nowMs - at.getTime() > 15 * 60000 ? 'overdue' : 'progress';
    return { id: num(p.id), plate: s(p.plate, 20).toUpperCase(), jc: String(p.jc), ...jView(p.jc), parts: parts.map(x => s(x, 80)).filter(Boolean),
      st, time: hm(p.att).txt || '', by: s(p.by, 40), ret: p.type === 'return' };
  });

  // waiting for spares: items marked "arranging" and not yet arranged (last 40 days)
  const reqById = new Map(bs.preq.map(p => [String(p.id), p]));
  const since = key(C.dmy(C.addDays(C.now(), -40)));
  out.spareWait = bs.pitems.filter(x => x.st === 'arranging' && key(dmy((reqById.get(String(x.rid)) || {}).at)) >= since).map(x => {
    const p = reqById.get(String(x.rid)) || {}; const v = jView(p.jc);
    const until = utcIst(x.until), late = until && Date.parse(String(x.until).replace(' ', 'T') + 'Z') < nowMs;
    return { part: s(x.n, 80), qty: 1, price: 0, plate: s(p.plate, 20).toUpperCase(), model: v.model, mech: v.mech || '—', jc: String(p.jc || ''), vendor: '—',
      ordered: dmy(p.at), eta: late ? `Late (${s(x.lbl, 20) || 'no time given'})` : until.slice(0, 10) === t0 ? `Today ${hm(until.slice(11)).txt}` : until ? `${dmy(until)} ${hm(until.slice(11)).txt}` : s(x.lbl, 20) || '—',
      tone: late ? 'orange' : 'blue', overdue: !!late };
  });

  // free service: vehicles with free service claims, up to three per vehicle, newest vehicle first
  const free = new Map();
  for (const j of [...bs.jcs].sort((a, b) => num(a.id) - num(b.id))) {
    if (!num(j.free)) continue;
    const k = plateKey(j.plate); if (!k) continue;
    const f = free.get(k) || { plate: s(j.plate, 20).toUpperCase(), cust: s(j.cust, 80), ph: phone(j.ph), s: [], last: 0 };
    if (f.s.length < 3) f.s.push([jDate(j), String(j.st || '').toUpperCase().trim() === 'COMPLETED' ? 'done' : 'open']);
    f.last = num(j.id); f.cust = s(j.cust, 80) || f.cust; free.set(k, f);
  }
  out.freeSvc = [...free.values()].sort((a, b) => b.last - a.last).map(({ last, ...f }) => { while (f.s.length < 3) f.s.push(null); return f; });

  // feedback calls: calls made today, and vehicles delivered today or yesterday not called yet
  const called = new Set(bs.fbk.map(f => String(f.jc)));
  const yday = key(C.dmy(C.addDays(C.now(), -1)));
  const fb = bs.fbk.filter(f => key(dmy(f.at)) === t0).map(f => ({ plate: s(f.plate, 20).toUpperCase(), model: jView(f.jc).model, cust: s(f.cust, 80), ph: phone(f.ph), jc: String(f.jc),
    service: s(f.svc, 120), st: 'done', rating: Math.max(0, Math.min(5, num(f.r))), note: s(f.rem || f.comp || f.mood || f.cs, 200), by: '' }));
  for (const j of bs.jcs) {
    const d = key(jDate(j));
    if ((d !== t0 && d !== yday) || String(j.st || '').toUpperCase().trim() !== 'COMPLETED' || called.has(String(j.id))) continue;
    fb.push({ plate: s(j.plate, 20).toUpperCase(), model: s(`${j.make || ''} ${j.model || ''}`, 60), cust: s(j.cust, 80), ph: phone(j.ph), jc: String(j.id),
      service: svcName(j), st: 'pending', rating: 0, note: '' });
  }
  out.feedback = fb;

  // service reminders (next service calls) by advisor; call times are UTC on the old site
  const advName = new Map(bs.advs.map(a => [String(a.id), s(a.name, 40)]));
  const remById = new Map(bs.rem.map(r => [String(r.id), r]));
  const visits = new Map();
  for (const j of bs.jcs) { const k = plateKey(j.plate); if (k) visits.set(k, Math.max(visits.get(k) || 0, num(j.id))); }
  const adv = new Map(), A = id => { const n = advName.get(String(id)) || `Advisor ${id}`; if (!adv.has(n)) adv.set(n, [n, 0, 0, 0, 0]); return adv.get(n); };
  let due = 0, back = 0;
  for (const r of bs.rem) {
    const done = ['BOOKED', 'NOT_INTERESTED'].includes(String(r.st)), came = (visits.get(plateKey(r.plate)) || 0) > num(r.jc);
    if (came) { back++; A(r.adv)[4]++; }
    if (!came && !done && r.due && key(dmy(r.due)) <= t0) { due++; A(r.adv)[3]++; }
  }
  let callsToday = 0, bookedToday = 0;
  for (const c of bs.calls) {
    const at = utcIst(c.at), a = A(c.adv); a[2]++;
    if (key(dmy(at)) === t0) { a[1]++; callsToday++; if (c.cs === 'BOOKED') bookedToday++; }
  }
  const recent = [...bs.calls].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30).map(c => { const r = remById.get(String(c.rid)) || {}; const at = utcIst(c.at);
    return [s(r.plate, 20).toUpperCase(), s(r.cust, 60), advName.get(String(c.adv)) || '', RES[c.cs] || cap(String(c.cs || '').toLowerCase()), at ? `${dmy(at)} ${hm(at.slice(11)).txt}` : '']; });
  out.reminders = { adv: [...adv.values()].sort((a, b) => b[2] - a[2]), calls: recent, kpi: [due, callsToday, bookedToday, back] };
}

// ---------------- sales to the Inventory portal ------------------------------------------------------------------------
async function sendSales(sales) {
  const url = env('INV_URL'), k = env('INV_FEED_KEY');
  if (!url || !k) return 'off';
  const seen = new Map(db.all('SELECT no, h FROM old_sent').map(r => [r.no, r.h]));
  const want = [];
  const nos = new Set();
  for (const x of sales) {
    const id = `${x.store}:${x.no}`; nos.add(id);
    const bill = { no: x.no, day: x.day, lines: x.lines };
    const h = hash(bill);
    if (seen.get(id) !== h) want.push({ id, store: x.store, bill, h });
  }
  // a bill deleted on the old site puts its stock back
  for (const id of seen.keys()) if (!nos.has(id)) { const [store, ...no] = id.split(':'); want.push({ id, store, bill: { no: no.join(':'), cancel: true }, h: 'gone' }); }
  let sent = 0;
  for (const store of ['BS', 'ML']) {
    const mine = want.filter(w => w.store === store);
    for (let i = 0; i < mine.length; i += 500) {
      const part = mine.slice(i, i + 500);
      const res = await fetch(url.replace(/\/+$/, '') + '/api/import/sales', { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-feed-key': k, 'x-portal': 'billing', 'x-by': 'Old billing site' },
        body: JSON.stringify({ store, bills: part.map(w => w.bill) }), signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`Inventory said ${res.status}: ${(await res.text()).slice(0, 160)}`);
      db.tx(() => { for (const w of part) w.h === 'gone' ? db.run('DELETE FROM old_sent WHERE no = ?', w.id) : db.run('INSERT INTO old_sent (no, h) VALUES (?, ?) ON CONFLICT(no) DO UPDATE SET h = excluded.h', w.id, w.h); });
      sent += part.length;
    }
  }
  return sent;
}

// ---------------- one round ----------------------------------------------------------------------------------------------
let running = false;
async function pull() {
  if (!on() || running) return null;
  running = true;
  const status = { at: C.stamp(C.now()), ok: false };
  try {
    const [bs, ml] = await Promise.all([env('OLD_DB_BS') ? readBs() : null, env('OLD_DB_ML') ? readMl() : null]);
    const { lists, sales } = build(bs, ml);
    if (ml) mlLast = { at: C.stamp(C.now()), ...mlFeed(ml) };   // for the Moto Lab panel (GET /api/feed/motolab)
    const changed = [];
    db.tx(() => {
      if (!linked()) {                       // first live read: the sample data goes
        for (const n of SAMPLE_LISTS) store.writeCollection(n, [], null);
        for (const [n, v] of Object.entries(SAMPLE_OBJECTS)) store.writeCollection(n, v, null);
        db.setSetting('old_link', 'on');
        changed.push('sample cleared');
      }
      for (const [n, v] of Object.entries(lists)) {
        const h = hash(v);
        if (db.setting(`old_h_${n}`, '') === h) continue;
        store.writeCollection(n, v, null);
        db.setSetting(`old_h_${n}`, h);
        changed.push(n);
      }
      if (changed.length) {
        db.run('INSERT INTO audit_log (at, action, collection, detail) VALUES (?,?,?,?)', C.stamp(C.now()), 'old billing', changed.join(', '), `${lists.invoices.length} bills, ${lists.jobs.length} job cards`);
        db.setSetting('revision', store.revision() + 1);
      }
    });
    Object.assign(status, { ok: true, bills: lists.invoices.length, jobs: lists.jobs.length, customers: lists.customers.length, changed });
    try { status.stock = await sendSales(sales); } catch (e) { status.stock = 'error'; status.stockErr = e.message.slice(0, 200); }
  } catch (e) {
    status.err = e.message.slice(0, 300);
    console.error('old billing link:', status.err);
  } finally {
    running = false;
    db.setSetting('old_last', JSON.stringify(status));
  }
  return status;
}

function start() {
  if (!on()) return null;
  const secs = Math.max(20, Number(env('OLD_SECONDS')) || 60);
  pull();
  return setInterval(pull, secs * 1000);
}
const lastStatus = () => { try { return JSON.parse(db.setting('old_last', '') || 'null'); } catch { return null; } };

module.exports = { FROM_OLD, linked, pull, start, build, lastStatus, on, motolab, mlCalc, mlFeed };
