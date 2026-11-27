// Reads a vendor bill (photos or a PDF) with the AI reader and gives back the lines. The file is only held in memory
// while it is read; it is never written to disk or the database (Sam: bill photos are never kept).
// INVOICE_READER_URL: POST { image: <base64>, mime } (one page each) and answers
//   { no, date, gstin, total, lines: [{ pno, name, brand, hsn, qty, rate, mrp, gst, amt }] }
// Same contract as the cashier panel's reader, with part no., MRP and GST added.
// Or ANTHROPIC_API_KEY (no INVOICE_READER_URL): the server sends all pages in one request to Claude and gets the same
// fields back as JSON (READER_MODEL, default claude-opus-5-5). Plain fetch: this portal has no npm packages but express.
// Without either the cashier types the lines.
'use strict';
const MAX = 8 * 1024 * 1024;
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
const s = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function decode(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length && buf.length <= MAX ? { mime: m[1], buf } : null;
}

const LINE = { type: 'object', additionalProperties: false, required: ['pno', 'name', 'brand', 'hsn', 'qty', 'rate', 'mrp', 'rate_incl', 'gst', 'amt'],
  properties: { pno: { type: 'string' }, name: { type: 'string' }, brand: { type: 'string' }, hsn: { type: 'string' }, qty: { type: 'number' },
    rate: { type: 'number' }, mrp: { type: 'number' }, rate_incl: { type: 'number' }, gst: { type: 'number' }, amt: { type: 'number' } } };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['no', 'date', 'gstin', 'total', 'lines'],
  properties: { no: { type: 'string' }, date: { type: 'string' }, gstin: { type: 'string' }, total: { type: 'number' }, lines: { type: 'array', items: LINE } } };
const ASK = `These are the pages of one vendor bill (purchase invoice) of an Indian motorcycle spare parts shop. Read it and fill the JSON.
no: the vendor's bill / invoice number. date: the bill date as YYYY-MM-DD. gstin: the VENDOR's (seller's) GSTIN, not the buyer's. total: the grand total payable in rupees.
lines: every item line on every page, in order, once each (a line repeated at a page break counts once). pno: part number exactly as printed (a code that wraps onto a second line is one part number). name: the description. If the bill gives only the code and no words, write a short clear item name: maker + what the item is (from the HSN, e.g. 8507 battery, 4011 tyre, 4013 tube, 2710 oil, 8511 spark plug, 8512 light or horn, 7318 nut / bolt) + the model, e.g. "Exide battery XLTZ4A". Never give a name that is only the part number.
brand: the bike brand or part maker if printed or clear from the part (Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, Royal Enfield, KTM...), else "".
hsn: HSN code or "". qty: quantity. rate: the net price of ONE unit before GST, after any trade discount on the line. mrp: MRP of one unit. Use the MRP / M.R.P. / list price column if there is one. If there is no MRP column but the bill shows a tax-inclusive price of one unit before the line discount (e.g. a column "Rate (Incl. of Tax)" next to the rate without tax, then a Disc. % column), that inclusive price is the MRP. Else 0. rate_incl: a printed tax-inclusive price of one unit before discount (a column like "Rate (Incl. of Tax)"), else 0.
gst: GST % of the line (CGST + SGST, or IGST), e.g. 18 or 28. amt: line amount as printed.
Use "" or 0 for anything not printed. Never guess numbers. Do not include totals, freight or round-off as item lines.`;

async function readWithClaude(list) {
  const content = list.map(f => f.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.buf.toString('base64') } }
    : { type: 'image', source: { type: 'base64', media_type: f.mime, data: f.buf.toString('base64') } });
  content.push({ type: 'text', text: ASK });
  const r = await fetch(`${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, { method: 'POST', signal: AbortSignal.timeout(180000),
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    body: JSON.stringify({ model: process.env.READER_MODEL || 'claude-opus-5-5', max_tokens: 16000, fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }] }) });
  if (!r.ok) {
    console.error('bill reader: Claude answered', r.status, (await r.text().catch(() => '')).slice(0, 300));
    return { fail: r.status === 401 || r.status === 403 ? 'The AI reader key is not accepted. Ask the owner, and type the lines for now.' : `The AI reader answered ${r.status}. Try again or type the lines.` };
  }
  const d = await r.json();
  if (d.stop_reason === 'refusal') return { fail: 'The AI reader could not read this bill. Type the lines.' };
  if (d.stop_reason === 'max_tokens') return { fail: 'The bill is too long to read at once. Read fewer pages at a time.' };
  const t = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return { data: JSON.parse(t) }; } catch { return { fail: 'The AI reader gave an unreadable answer. Try again or type the lines.' }; }
}

// a name that is only the part number gets maker + item type from the HSN (Sam 6 Nov: Exide bills print only the code)
const HSN_ITEM = [['8507', 'battery'], ['4011', 'tyre'], ['4013', 'tube'], ['2710', 'oil'], ['3403', 'oil'], ['8511', 'spark plug'], ['8512', 'light'], ['7318', 'nut / bolt'], ['4016', 'rubber part'], ['8714', 'part']];
const key = x => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function nameOf(l) {
  const name = s(l.name, 120), pno = s(l.pno, 40);
  if (name && key(name) !== key(pno)) return name;
  const item = (HSN_ITEM.find(([h]) => String(l.hsn || '').startsWith(h)) || [])[1];
  return item ? s(`${s(l.brand, 40) ? s(l.brand, 40) + ' ' : ''}${item} ${pno}`, 120) : name;
}
const clean = l => ({ pno: s(l.pno, 40), name: nameOf(l), brand: s(l.brand, 40), hsn: s(l.hsn, 12), qty: num(l.qty) || 1, rate: num(l.rate) ?? 0, mrp: num(l.mrp) > 0 ? num(l.mrp) : num(l.rate_incl) > 0 ? num(l.rate_incl) : 0, gst: num(l.gst), amt: num(l.amt) ?? 0 });

async function readBill(files) {
  const url = process.env.INVOICE_READER_URL;
  const list = (Array.isArray(files) ? files : [files]).slice(0, 6).map(decode);
  if (!list.length || list.some(x => !x)) return { ok: false, reason: 'Use JPG, PNG or PDF files under 8 MB (up to 6).' };
  if (!url && process.env.ANTHROPIC_API_KEY) {
    try {
      const x = await readWithClaude(list);
      if (x.fail) return { ok: false, reason: x.fail };
      const d = x.data, out = { ok: true, lines: [], no: d.no ? s(d.no, 40) : null, date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : null, gstin: d.gstin ? s(d.gstin, 15).toUpperCase() : null, total: num(d.total) || null };
      for (const l of (Array.isArray(d.lines) ? d.lines : []).slice(0, 300)) { const line = clean(l); if (line.pno || line.name) out.lines.push(line); }
      return out;
    } catch (e) { console.error('bill reader:', e.message); return { ok: false, reason: 'The AI reader did not answer. Try again or type the lines.' }; }
    finally { list.length = 0; }
  }
  if (!url) return { ok: false, reason: 'The AI bill reader is not set up on this server yet. Type the lines.' };
  const out = { ok: true, lines: [], no: null, date: null, gstin: null, total: null };
  try {
    for (const f of list) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.INVOICE_READER_KEY ? { Authorization: `Bearer ${process.env.INVOICE_READER_KEY}` } : {}) },
        body: JSON.stringify({ image: f.buf.toString('base64'), mime: f.mime }), signal: AbortSignal.timeout(60000) });
      if (!r.ok) return { ok: false, reason: `The AI reader answered ${r.status}. Type the lines.` };
      const d = await r.json();
      out.no ||= d.no ? s(d.no, 40) : null; out.date ||= d.date ? s(d.date, 10) : null; out.gstin ||= d.gstin ? s(d.gstin, 15) : null;
      if (d.total != null) out.total = num(d.total);
      for (const l of (Array.isArray(d.lines) ? d.lines : []).slice(0, 300)) {
        const line = clean(l);
        // a line printed at the end of one page and the start of the next counts once
        if (!out.lines.some(x => x.pno && x.pno === line.pno && x.qty === line.qty && x.rate === line.rate)) out.lines.push(line);
      }
    }
    return out;
  } catch (e) {
    return { ok: false, reason: 'The AI reader did not answer. Type the lines.' };
  } finally { list.length = 0; }
}

module.exports = { readBill, decode };
