// CSV in and out. Import takes the old billing site's product sheet columns (products_import.csv) or this portal's own
// export, so a sheet downloaded from here can be changed in Excel and loaded back.
'use strict';
const db = require('./db');
const inv = require('./inv');

function parse(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
// Excel opens it as text-safe: a cell starting with = + - @ gets a leading ' (no formula injection)
const cellOut = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (head, rows) => '﻿' + [head, ...rows].map(r => r.map(cellOut).join(',')).join('\r\n') + '\r\n';

// Column names (old sheet or this portal's export) → part fields
const COLS = {
  name: 'name', part_name: 'name', description: 'descr', descr: 'descr', brand: 'brand', model: 'model', category: 'cat', cat: 'cat', size: 'size',
  gross_selling_price: 'mrp', mrp: 'mrp', selling_price: 'mrp', net_cost_price: 'cost', cost: 'cost', cost_price: 'cost',
  tax_rate: 'gst', gst: 'gst', gst_included: 'gst_incl', discount_to_user: 'd_user', d_user: 'd_user', discount_to_wholeseller: 'd_whole', d_whole: 'd_whole',
  discount_to_mechanic: 'd_mech', d_mech: 'd_mech', stock: 'stock', stock_alert_on: 'alert', alert: 'alert', batch_no: 'batch', batch: 'batch',
  serial_no: 'pno', part_no: 'pno', pno: 'pno', sku: 'pno', bar_code: 'bar', barcode: 'bar', bar: 'bar', rack: 'rack', hsn: 'hsn', warranty_months: 'wty', wty: 'wty',
};
const num = v => { const n = Number(String(v ?? '').replace(/[₹,\s%]/g, '')); return Number.isFinite(n) ? n : 0; };

// New part numbers are added (with their stock as opening stock). A part number already in the list gets its details
// changed; its stock is NOT changed from a sheet (that goes through Stock in or a rack check) and is listed back.
function importParts(me, { csv, store, dryRun }) {
  const rows = parse(csv);
  if (rows.length < 2) inv.fail(400, 'The sheet has no rows under the heading row.');
  if (rows.length > 25001) inv.fail(400, 'At most 25,000 rows in one sheet.');
  const head = rows[0].map(h => COLS[String(h).trim().toLowerCase().replace(/[\s.]+/g, '_')] || null);
  if (!head.includes('name') || !head.includes('pno')) inv.fail(400, 'The heading row needs at least name and serial_no (or part_no).');
  store = inv.STORES[store] ? store : 'BS';
  inv.liveCheck(store, 'Add or change parts');   // live: the part list is the billing's (server/billing.js)
  const out = { added: 0, updated: 0, same: 0, stockSkipped: [], errors: [] };
  const slabs = inv.gstSlabs();
  const work = () => {
    rows.slice(1).forEach((r, i) => {
      const line = i + 2, x = {};
      head.forEach((f, j) => { if (f && r[j] !== undefined && String(r[j]).trim() !== '') x[f] = String(r[j]).trim(); });
      if (!x.name || !x.pno) { out.errors.push(`Row ${line}: name and part number are needed.`); return; }
      for (const f of ['mrp', 'cost', 'gst', 'd_user', 'd_whole', 'd_mech', 'alert', 'wty']) if (x[f] != null) x[f] = num(x[f]);
      if (x.gst_incl != null) x.gst_incl = /^(no|0|n|false)$/i.test(x.gst_incl) ? 0 : 1;
      if (x.gst != null && !slabs.includes(x.gst)) { out.errors.push(`Row ${line}: GST ${x.gst} % is not one of ${slabs.join(', ')}.`); return; }
      const stock = x.stock != null ? Math.round(num(x.stock)) : null; delete x.stock;
      const p = db.one('SELECT * FROM parts WHERE store = ? AND pkey = ? AND active = 1 ORDER BY id LIMIT 1', store, inv.pkeyOf(x.pno));
      try {
        if (!p) { inv.addPart(me, { ...x, store, stock: Math.max(0, stock || 0), sameNoOk: true, ref: 'Sheet import' }); out.added++; return; }
        const r2 = inv.editPart(me, p.id, x);
        if (r2.msg === 'Nothing changed.') out.same++; else out.updated++;
        if (stock != null && stock !== p.stock) out.stockSkipped.push({ pno: p.pno, name: p.name, now: p.stock, sheet: stock });
      } catch (e) { out.errors.push(`Row ${line} (${x.pno}): ${e.message}`); }
    });
  };
  if (dryRun) {
    // run everything, then throw it away
    try { db.tx(() => { work(); throw Object.assign(new Error('dry'), { dry: true }); }); } catch (e) { if (!e.dry) throw e; }
  } else db.tx(() => { work(); inv.audit(me, 'sheet import', `${out.added} added, ${out.updated} changed, ${out.errors.length} errors`); });
  out.errors = out.errors.slice(0, 200);
  out.stockSkipped = out.stockSkipped.slice(0, 200);
  return { ...out, dryRun: !!dryRun, msg: `${dryRun ? 'Check only: ' : ''}${out.added} new, ${out.updated} changed, ${out.same} same, ${out.errors.length} errors.` };
}

const PART_HEAD = ['id', 'store', 'serial_no', 'name', 'description', 'brand', 'model', 'category', 'size', 'hsn', 'tax_rate', 'gst_included', 'mrp', 'cost', 'discount_to_user', 'discount_to_wholeseller', 'discount_to_mechanic', 'stock', 'stock_alert_on', 'rack', 'batch_no', 'bar_code', 'warranty_months', 'last_sale', 'photos'];
function exportParts(me, filter) {
  const { sql, args } = inv.partFilter(filter);
  const rows = db.all(`SELECT p.*, (SELECT count(*) FROM photos x WHERE x.part = p.id) ph FROM parts p ${sql} ORDER BY p.store, p.brand, p.name`, ...args);
  const cost = inv.seesCost(me);
  return toCsv(PART_HEAD.filter(h => cost || h !== 'cost'), rows.map(p => [p.id, p.store, p.pno, p.name, p.descr, p.brand, p.model, p.cat, p.size, p.hsn, p.gst, p.gst_incl ? 'yes' : 'no', p.mrp, ...(cost ? [p.cost] : []),
    p.d_user, p.d_whole, p.d_mech, p.stock, p.alert, p.rack, p.batch, p.bar, p.wty, p.last_sale || '', p.ph]));
}

module.exports = { parse, toCsv, importParts, exportParts };
