import type { Queryable } from "../db.js";
import { many, one } from "../db.js";
import { money } from "../domain.js";

/**
 * The Bike Surgeon Inventory (portals/12-inventory). Two calls, both with the Inventory's FEED_KEY:
 *   GET  /api/feed/parts?since=<ms>&store=BS   parts changed since a stamp (2000 a page)
 *   POST /api/import/sales                     a bill's parts leave stock (sending the same bill again changes only the difference)
 */
export type InventorySettings = { url: string; feedKey: string; store: string; portal: string };

type FeedPart = {
  id: number; pno: string; name: string; brand?: string; model?: string; hsn?: string; gst?: number; mrp?: number;
  dUser?: number; stock?: number; rack?: string; active?: boolean; upd: number;
};

const headers = (s: InventorySettings) => ({
  "content-type": "application/json",
  "x-feed-key": s.feedKey,
  "x-portal": s.portal,
  "x-by": "Bike Surgeon customer app",
});

export const partKey = (pno: string) => String(pno ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function getState(db: Queryable, key: string) {
  return (await one<{ value: string }>(db, "SELECT value FROM bridge_state WHERE key = $1", [key]))?.value ?? null;
}

export async function setState(db: Queryable, key: string, value: string) {
  await db.query(
    "INSERT INTO bridge_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [key, value],
  );
}
export { getState };

/** Copies changed parts into inventory_parts. Returns how many rows changed. */
export async function syncParts(db: Queryable, s: InventorySettings, fetcher: typeof fetch = fetch) {
  let since = Number((await getState(db, `inventory_since_${s.store}`)) ?? 0);
  let total = 0;
  for (let page = 0; page < 200; page += 1) {
    const response = await fetcher(`${s.url.replace(/\/$/, "")}/api/feed/parts?since=${since}&store=${encodeURIComponent(s.store)}`, {
      headers: headers(s), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Inventory parts feed: HTTP ${response.status}`);
    const body = (await response.json()) as { parts: FeedPart[]; next: number; more: boolean };
    for (const p of body.parts ?? []) {
      await db.query(
        `INSERT INTO inventory_parts (id, store, part_no, part_key, name, brand, model, hsn, gst_percent, mrp, customer_discount_percent, stock, rack, active, inventory_updated, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
         ON CONFLICT (id) DO UPDATE SET store = EXCLUDED.store, part_no = EXCLUDED.part_no, part_key = EXCLUDED.part_key, name = EXCLUDED.name,
           brand = EXCLUDED.brand, model = EXCLUDED.model, hsn = EXCLUDED.hsn, gst_percent = EXCLUDED.gst_percent, mrp = EXCLUDED.mrp,
           customer_discount_percent = EXCLUDED.customer_discount_percent, stock = EXCLUDED.stock, rack = EXCLUDED.rack, active = EXCLUDED.active,
           inventory_updated = EXCLUDED.inventory_updated, synced_at = now()`,
        [p.id, s.store, String(p.pno ?? ""), partKey(p.pno), String(p.name ?? p.pno ?? ""), p.brand ?? "", p.model ?? "", p.hsn ?? "",
          Number(p.gst ?? 18), Math.max(0, Number(p.mrp ?? 0)), Number(p.dUser ?? 0), Math.trunc(Number(p.stock ?? 0)), p.rack ?? "",
          p.active !== false, Math.trunc(Number(p.upd ?? 0))],
      );
      total += 1;
    }
    since = Math.max(since, Number(body.next ?? since));
    await setState(db, `inventory_since_${s.store}`, String(since));
    if (!body.more) break;
  }
  return total;
}

export type PartQuote = { id: number; partNo: string; name: string; hsn: string; gstPercent: number; unitPrice: number; stock: number; quantity: number; amount: number };

/**
 * A part by its number (or barcode-free key), priced for a customer: MRP less the Inventory's customer discount %,
 * times the quantity, rounded to the rupee. MRP already includes GST in the Inventory, the same as the workshop's bills.
 */
export async function quotePart(db: Queryable, store: string, partNo: string, quantity = 1): Promise<PartQuote | null> {
  const rows = await many<{ id: number; part_no: string; name: string; hsn: string; gst_percent: number; mrp: number; customer_discount_percent: number; stock: number }>(
    db,
    `SELECT id, part_no, name, hsn, gst_percent, mrp, customer_discount_percent, stock FROM inventory_parts
     WHERE store = $1 AND part_key = $2 ORDER BY active DESC, stock DESC LIMIT 1`,
    [store, partKey(partNo)],
  );
  const p = rows[0];
  if (!p) return null;
  const unit = money(Number(p.mrp) * (1 - Number(p.customer_discount_percent) / 100));
  return {
    id: p.id, partNo: p.part_no, name: p.name, hsn: p.hsn, gstPercent: Number(p.gst_percent), unitPrice: unit, stock: Number(p.stock),
    quantity, amount: Math.round(unit * quantity),
  };
}

/**
 * Invoices the APP issued (source = 'app') take their Inventory parts out of stock once.
 * Bills made in the workshop's own billing are NOT sent from here: the admin panel already sends those to the
 * Inventory, so sending them again would take the stock out twice.
 */
export async function sendSales(db: Queryable, s: InventorySettings, fetcher: typeof fetch = fetch) {
  await db.query(
    `INSERT INTO bridge_inventory_sales (invoice_id)
     SELECT i.id FROM invoices i
     WHERE i.source = 'app' AND i.status <> 'void' AND EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND l.part_no IS NOT NULL)
     ON CONFLICT DO NOTHING`,
  );
  const due = await many<{ invoice_id: string; number: string; issued_at: string }>(
    db,
    `SELECT b.invoice_id, i.number, i.issued_at FROM bridge_inventory_sales b JOIN invoices i ON i.id = b.invoice_id
     WHERE b.sent_at IS NULL AND b.attempts < 50 ORDER BY b.created_at LIMIT 50`,
  );
  let sent = 0;
  for (const bill of due) {
    const lines = await many<{ part_no: string; quantity: number; unit_amount: number; label: string }>(
      db, "SELECT part_no, quantity, unit_amount, label FROM invoice_lines WHERE invoice_id = $1 AND part_no IS NOT NULL ORDER BY sort_order", [bill.invoice_id]);
    const day = new Date(new Date(bill.issued_at).getTime() + 330 * 60_000).toISOString().slice(0, 10);
    try {
      const response = await fetcher(`${s.url.replace(/\/$/, "")}/api/import/sales`, {
        method: "POST",
        headers: headers(s),
        body: JSON.stringify({ store: s.store, bills: [{ no: bill.number, day, lines: lines.map((l) => ({ pno: l.part_no, qty: Number(l.quantity), rate: Number(l.unit_amount), name: l.label })) }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      await db.query("UPDATE bridge_inventory_sales SET sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE invoice_id = $1", [bill.invoice_id]);
      sent += 1;
    } catch (error) {
      await db.query("UPDATE bridge_inventory_sales SET attempts = attempts + 1, last_error = $2 WHERE invoice_id = $1", [bill.invoice_id, String((error as Error).message).slice(0, 300)]);
    }
  }
  return sent;
}
