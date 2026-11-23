import { createHash } from "node:crypto";
import type pg from "pg";
import type { Config } from "../config.js";
import { many, one, tx, type Db, type Queryable } from "../db.js";
import { money, stageOf, type JobStatus } from "../domain.js";
import { applyStatus, lockJobCard, touch } from "../services/bookings.js";
import { upsertBay, upsertStaff } from "../services/catalog.js";
import { addWalletTransaction } from "../services/customers.js";
import { notify } from "../services/notifications.js";
import { getState, sendSales, setState, syncParts, type InventorySettings } from "./inventory.js";
import { int, istAt, istNowText, istTime, num, PHONE10, phone10, plateOf, sqlIds, sqlText, str, type OldDb, type OldRow } from "./old-db.js";

/**
 * The workshop bridge. Every BRIDGE_INTERVAL_MS it:
 *   1. copies bays (with their camera links) and mechanics/advisors from the old billing database;
 *   2. copies the Inventory's parts, and sends the parts of invoices the app issued to the Inventory (stock goes down once);
 *   3. for every customer who has logged in to the app, copies their old bikes, job cards and bills once;
 *   4. follows the job cards of app customers live: bay, mechanic, camera on/off, labour, status, the bill and its payment.
 *      The customer gets the same notifications as for any other change, and the tracker and the live camera work as built;
 *   5. (OLD_DB_WRITE=on) puts app bookings in the old site's booking list, so reception converts them as before.
 *
 * The old database is only read, except step 5 when it is switched on. Ids from the old site are kept in
 * external_references (system "old_bs"), so nothing is copied twice.
 */

export const SYSTEM = "old_bs";

export type BridgeDeps = {
  db: Db;
  config: Config;
  old: OldDb | null;
  inventory: InventorySettings | null;
  log?: (line: string) => void;
  fetcher?: typeof fetch;
};

export type BridgeSummary = {
  at: string;
  bays: number;
  staff: number;
  parts: number;
  salesSent: number;
  customersImported: number;
  jobCards: number;
  bookingsSent: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// External ids
// ---------------------------------------------------------------------------

async function refOf(db: Queryable, entityType: string, externalId: string | number) {
  return (await one<{ entity_id: string }>(
    db, "SELECT entity_id FROM external_references WHERE entity_type = $1 AND system = $2 AND external_id = $3", [entityType, SYSTEM, String(externalId)],
  ))?.entity_id ?? null;
}

async function putRef(db: Queryable, entityType: string, entityId: string, externalId: string | number) {
  await db.query(
    `INSERT INTO external_references (entity_type, entity_id, system, external_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (entity_type, entity_id, system) DO UPDATE SET external_id = EXCLUDED.external_id`,
    [entityType, entityId, SYSTEM, String(externalId)],
  );
}

// ---------------------------------------------------------------------------
// 1. Bays, cameras and people
// ---------------------------------------------------------------------------

const titleCase = (text: string) => text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

async function syncMaster(deps: BridgeDeps) {
  const { db, config, old } = deps;
  const bays = await old!.select("bay", { id: "id", name: "name", url: "url", status: "status" });
  for (const bay of bays) {
    const url = str(bay.url, 500);
    await upsertBay(db, config, `BAY-${int(bay.id)}`, {
      name: titleCase(str(bay.name, 60) || `Bay ${int(bay.id)}`),
      cameraStreamUrl: /^https?:\/\//i.test(url) ? url : null,
      active: !/^(inactive|deleted|off)$/i.test(str(bay.status)),
    });
  }
  let staff = 0;
  const people: [string, OldRow[]][] = [
    ["MEC", await old!.select("mechanic", { id: "id", name: "name", phone: "phone", status: "status" })],
    ["ADV", await old!.select("service_adviser", { id: "id", name: "name", phone: "phone", status: "status", role: "role" })],
  ];
  for (const [prefix, rows] of people) {
    for (const person of rows) {
      const name = str(person.name, 80);
      if (!name) continue;
      const role = prefix === "MEC" ? "mechanic" : /manager/i.test(str(person.role)) ? "manager" : "advisor";
      await upsertStaff(db, config, `${prefix}-${int(person.id)}`, {
        name: titleCase(name),
        role,
        phone: phone10(person.phone),
        active: !/^inactive$/i.test(str(person.status)),
      });
      staff += 1;
    }
  }
  return { bays: bays.length, staff };
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

const SCOOTERS = /activa|access|jupiter|dio\b|ntorq|fascino|ray\b|rayzr|pleasure|maestro|destini|burgman|aerox|avenis|vespa|chetak|iqube|ather|\bola\b|zest|scooty|wego|pep|grazia|aviator|let'?s|swish|ronin scooter|xoom|\bsr ?1[25]0|storm|dolce|scooter/i;
const bodyTypeOf = (make: string, model: string, oldType = "") => {
  const text = `${make} ${model}`;
  if (/scoot/i.test(oldType) || SCOOTERS.test(text)) return "scooter";
  if (/himalayan|adventure|\badv\b|xpulse|v-?strom|scram|explorer/i.test(text)) return "adventure";
  if (/classic|bullet|meteor|hunter|electra|thunderbird|standard|jawa|yezdi roadster|cb350|hness/i.test(text)) return "classic";
  if (/\br ?15|\brc ?\d|ninja|karizma|cbr|yzf|gixxer sf|rr ?310|\brs ?200|apache rr/i.test(text)) return "sports";
  if (/duke|\bns ?\d|\bmt[- ]?\d|\bfz|gixxer|apache|pulsar|dominar|trigger|hornet|xtreme|shine 125 sp|sp ?160|unicorn|rtr/i.test(text)) return "naked";
  if (/luna|tvs xl|heavy duty|moped/i.test(text)) return "moped";
  return "commuter";
};

async function vehicleFor(client: pg.PoolClient, customerId: string, plate: string, make: string, model: string, km: number | null, oldType = "") {
  const existing = await one<{ id: string; customer_id: string }>(
    client, "SELECT id, customer_id FROM vehicles WHERE registration_number = $1 AND archived_at IS NULL", [plate]);
  if (existing) return existing.customer_id === customerId ? existing.id : null;
  const cleanMake = titleCase(make) || "Bike";
  const cleanModel = model.replace(new RegExp(`^${make.replace(/[^a-z0-9 ]/gi, "")}\\s+`, "i"), "").trim() || model || "Bike";
  const row = await one<{ id: string }>(
    client,
    `INSERT INTO vehicles (customer_id, registration_number, make, model, body_type, odometer_km, odometer_recorded_at, odometer_source)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6::int IS NULL THEN NULL ELSE now() END, CASE WHEN $6::int IS NULL THEN NULL ELSE 'workshop' END)
     RETURNING id`,
    [customerId, plate, cleanMake.slice(0, 60), cleanModel.slice(0, 60), bodyTypeOf(make, model, oldType), km && km > 0 && km < 2_000_000 ? km : null],
  );
  return row!.id;
}

// ---------------------------------------------------------------------------
// Old job cards
// ---------------------------------------------------------------------------

const JC_COLS = {
  id: "id", user_id: "user_id", phone: "phone", name: "name", plate: "vehicle_number", make: "make", model: "model",
  service_type: "service_type", package: "service_package", estimate: "estimated_cost", odo: "odo_reading", created: "created_at",
  dd: "dd", mm: "mm", yy: "yy", slot_start: "slot_start", slot_end: "slot_end", delivery: "delivery_time", status: "status",
  stream: "stream_status", mechanic: "mechanic_id", bay: "bay_id", completed: "completed_at", initiated: "initiated_at", note: "issue_text",
};

type OldJob = OldRow;

type JobExtras = {
  labour: Map<number, { name: string; price: number }[]>;
  bills: Map<number, OldRow>;
  billItems: Map<number, OldRow[]>;
  products: Map<number, OldRow>;
};

async function loadJobExtras(old: OldDb, jobs: OldJob[]): Promise<JobExtras> {
  const ids = jobs.map((job) => int(job.id));
  const extras: JobExtras = { labour: new Map(), bills: new Map(), billItems: new Map(), products: new Map() };
  if (!ids.length) return extras;
  for (const row of await old.select("job_labour_items", { job: "job_card_id", name: "labour_name", price: "labour_price" }, `job_card_id IN (${sqlIds(ids)}) ORDER BY id`)) {
    const list = extras.labour.get(int(row.job)) ?? [];
    list.push({ name: str(row.name, 120), price: Math.max(0, num(row.price)) });
    extras.labour.set(int(row.job), list);
  }
  const links = await old.select("service_invoice", { job: "job_card_id", invoice: "invoice_id" }, `job_card_id IN (${ids.map((id) => sqlText(String(id))).join(", ")}) ORDER BY id`);
  const invoiceIds = links.map((link) => int(link.invoice));
  if (invoiceIds.length) {
    const bills = await old.select("invoice", {
      id: "id", no: "invoice_no", total: "total_amount", tax: "total_tax", status: "payment_status", method: "payment_method", net: "net_payable",
      round: "round_off", wallet: "wallet_used", cash: "split_cash", upi: "split_upi", card: "split_card", paid_date: "paid_date",
      collected: "collected_at", date: "date", time: "time", coupon: "coupon_discount", special: "special_discount",
    }, `id IN (${sqlIds(invoiceIds)})`);
    const byId = new Map(bills.map((bill) => [int(bill.id), bill]));
    for (const link of links) {
      const bill = byId.get(int(link.invoice));
      if (bill) extras.bills.set(int(link.job), bill);
    }
    const items = await old.select("invoice_items", {
      invoice: "invoice_id", product: "product_id", name: "name", qty: "qty", selling: "selling_price", item: "item_price", cgst: "cgst", sgst: "sgst",
      serial: "serial_no", hsn: "hsn",
    }, `invoice_id IN (${sqlIds(invoiceIds)}) ORDER BY id`);
    const productIds = items.map((item) => int(item.product));
    if (productIds.length) {
      for (const p of await old.select("cms_products", { id: "id", name: "name", serial: "serial_no", hsn: "hsn", tax: "tax_rate" }, `id IN (${sqlIds(productIds)})`)) {
        extras.products.set(int(p.id), p);
      }
    }
    for (const link of links) {
      const invoiceId = int(link.invoice);
      extras.billItems.set(int(link.job), items.filter((item) => int(item.invoice) === invoiceId));
    }
  }
  return extras;
}

/** The app stage for an old job card. Completed cards close once their bill is there. */
function statusFor(job: OldJob, hasBill: boolean, history: boolean): JobStatus {
  const s = str(job.status).toUpperCase();
  if (s.startsWith("COMPLETED")) {
    if (hasBill || history) return "delivered";
    const done = istTime(job.completed);
    // A finished job whose bill never came: close it after a day so the app does not show it as open for ever.
    return done && Date.now() - new Date(done).getTime() > 24 * 3600_000 ? "delivered" : "in_service";
  }
  if (/^CANCEL/.test(s)) return "cancelled";
  if (s === "ONGOING" || s === "STREAM_STOPPED" || s === "WORK IN PROGRESS" || s === "IN_PROGRESS") return "in_service";
  return "at_workshop"; // PENDING, NOT_APPROVED and anything new: the bike is checked in
}

function slotOf(job: OldJob) {
  const created = istTime(job.created) ?? new Date().toISOString();
  const day = { y: int(job.yy), m: int(job.mm), d: int(job.dd) };
  let start = istAt(day, job.slot_start) ?? created;
  let end = istAt(day, job.slot_end);
  if (!end || !(new Date(end) > new Date(start))) end = new Date(new Date(start).getTime() + 3600_000).toISOString();
  if (!(new Date(end) > new Date(start))) start = created;
  return { start, end, created };
}

const serviceIdFor = (name: string) => `old-${createHash("sha1").update(name.toLowerCase()).digest("hex").slice(0, 12)}`;

/** Labour lines become the job card's services. Catalogue rows for them are inactive, so the booking screen never lists them. */
async function setServices(client: pg.PoolClient, jobCardId: string, job: OldJob, labour: { name: string; price: number }[]) {
  let lines = labour.filter((line) => line.name);
  if (!lines.length) {
    const name = str(job.service_type, 80) || (str(job.package) ? `Service (${str(job.package, 20)})` : "Workshop service");
    lines = [{ name, price: Math.max(0, num(job.estimate)) }];
  }
  const merged = new Map<string, { name: string; price: number }>();
  for (const line of lines) {
    const id = serviceIdFor(line.name);
    const had = merged.get(id);
    merged.set(id, { name: line.name, price: money((had?.price ?? 0) + line.price) });
  }
  await client.query("DELETE FROM job_card_services WHERE job_card_id = $1", [jobCardId]);
  for (const [id, line] of merged) {
    await client.query(
      `INSERT INTO service_catalog (id, name, detail, category, price, active, sort_order) VALUES ($1, $2, 'From the workshop', 'Service', $3, false, 9999)
       ON CONFLICT (id) DO NOTHING`,
      [id, line.name.slice(0, 120), line.price],
    );
    await client.query("INSERT INTO job_card_services (job_card_id, service_id, name, price) VALUES ($1, $2, $3, $4)", [jobCardId, id, line.name.slice(0, 120), line.price]);
  }
  const subtotal = money([...merged.values()].reduce((sum, line) => sum + line.price, 0));
  await client.query("UPDATE job_cards SET package_subtotal = $2, estimate_amount = GREATEST(0, $2 - discount_amount) WHERE id = $1", [jobCardId, subtotal]);
}

type PaymentPart = { method: "upi" | "card" | "cash" | "wallet"; amount: number };

function paymentsOf(bill: OldRow, total: number): PaymentPart[] {
  const wallet = Math.min(Math.max(0, num(bill.wallet)), total);
  const rest = money(total - wallet);
  const parts: PaymentPart[] = wallet > 0 ? [{ method: "wallet", amount: wallet }] : [];
  const method = str(bill.method).toLowerCase();
  if (method === "split") {
    const split: PaymentPart[] = [
      { method: "cash", amount: num(bill.cash) }, { method: "upi", amount: num(bill.upi) }, { method: "card", amount: num(bill.card) },
    ].filter((part) => part.amount > 0) as PaymentPart[];
    const sum = split.reduce((s, p) => s + p.amount, 0);
    if (split.length && Math.abs(sum - rest) < 1.01) {
      split[split.length - 1].amount = money(split[split.length - 1].amount + rest - sum);
      return [...parts, ...split];
    }
    return rest > 0 ? [...parts, { method: "cash", amount: rest }] : parts;
  }
  const m: PaymentPart["method"] = method === "upi" ? "upi" : method === "card" ? "card" : "cash";
  return rest > 0 ? [...parts, { method: m, amount: rest }] : parts;
}

/** Copies the workshop's bill for a job card as the app's invoice (source = workshop). */
async function copyBill(client: pg.PoolClient, jobCardId: string, customerId: string, bill: OldRow, items: OldRow[], labour: { name: string; price: number }[], products: Map<number, OldRow>, quiet: boolean) {
  const number = str(bill.no, 40) || `OLD-${int(bill.id)}`;
  const existing = await one<{ id: string; status: string; job_card_id: string }>(client, "SELECT id, status, job_card_id FROM invoices WHERE number = $1", [number]);
  const paidOld = /^paid$/i.test(str(bill.status));
  if (existing) {
    if (existing.job_card_id !== jobCardId) return;
    if (existing.status === "open" && paidOld) await markPaid(client, existing.id, customerId, jobCardId, bill, quiet);
    return;
  }
  const partLines = items.map((item) => {
    const product = products.get(int(item.product));
    const name = str(item.name) && str(item.name) !== "NULL" ? str(item.name, 120) : str(product?.name, 120) || "Spare part";
    const qty = Math.max(1, num(item.qty));
    const amount = money(num(item.selling));
    const gst = money(num(item.cgst) + num(item.sgst));
    const base = num(item.item);
    return {
      label: name, amount, quantity: qty, unit: money(amount / qty), gst,
      gstPercent: base > 0 ? Math.round((gst / base) * 100) : null,
      partNo: str(item.serial) || str(product?.serial) || null, hsn: str(item.hsn) || str(product?.hsn) || null,
    };
  });
  const labourLines = labour.filter((line) => line.name && line.price > 0);
  const labourSum = money(labourLines.reduce((s, l) => s + l.price, 0));
  const partsSum = money(partLines.reduce((s, l) => s + l.amount, 0));
  const gst = money(num(bill.tax));
  let total = money(num(bill.net));
  if (!(total > 0)) total = money(num(bill.total) + labourSum + num(bill.round));
  if (!(total > 0)) total = money(labourSum + partsSum);
  const other = money(total - labourSum - partsSum);
  const taxable = money(Math.max(0, total - gst));
  const invoice = await one<{ id: string }>(
    client,
    `INSERT INTO invoices (number, job_card_id, customer_id, status, subtotal, discount_amount, extras_amount, taxable_amount, gst_rate, gst_amount, total, issued_at, source)
     VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $8, $9, $10, $11, 'workshop') RETURNING id`,
    [number, jobCardId, customerId, labourSum, other < 0 ? -other : 0, partsSum, taxable, taxable > 0 ? Math.min(9.9999, Number((gst / taxable).toFixed(4))) : 0, gst, total,
      istTime(`${str(bill.date)} ${str(bill.time)}`) ?? istTime(bill.date) ?? new Date().toISOString()],
  );
  let order = 0;
  const line = (kind: string, label: string, code: string | null, quantity: number, unit: number, amount: number, extra: { partNo?: string | null; gstPercent?: number | null; gst?: number | null } = {}) =>
    client.query(
      `INSERT INTO invoice_lines (invoice_id, kind, label, sac_hsn_code, quantity, unit_amount, amount, sort_order, part_no, gst_percent, gst_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [invoice!.id, kind, label, code, quantity, unit, amount, order++, extra.partNo ?? null, extra.gstPercent ?? null, extra.gst ?? null],
    );
  for (const l of labourLines) await line("service", l.name, null, 1, l.price, l.price);
  for (const p of partLines) await line("part", p.label, p.hsn, p.quantity, p.unit, p.amount, { partNo: p.partNo, gstPercent: p.gstPercent, gst: p.gst });
  if (Math.abs(other) >= 0.01) await line(other < 0 ? "discount" : "other", other < 0 ? "Discount and round off" : "Round off", null, 1, other, other);
  if (paidOld) await markPaid(client, invoice!.id, customerId, jobCardId, bill, quiet);
}

async function markPaid(client: pg.PoolClient, invoiceId: string, customerId: string, jobCardId: string, bill: OldRow, quiet: boolean) {
  const inv = await one<{ total: number }>(client, "SELECT total FROM invoices WHERE id = $1", [invoiceId]);
  const paidAt = istTime(bill.collected) ?? istTime(bill.paid_date) ?? new Date().toISOString();
  for (const part of paymentsOf(bill, inv!.total)) {
    await client.query(
      `INSERT INTO payments (invoice_id, customer_id, method, amount, status, provider, created_at, confirmed_at) VALUES ($1, $2, $3, $4, 'succeeded', 'workshop', $5, $5)`,
      [invoiceId, customerId, part.method, part.amount, paidAt],
    );
  }
  await client.query("UPDATE invoices SET status = 'paid', paid_at = $2 WHERE id = $1", [invoiceId, paidAt]);
  await client.query("UPDATE job_cards SET pay_at_delivery = false WHERE id = $1", [jobCardId]);
  if (!quiet) {
    await notify(client, { customerId, jobCardId, kind: "payment", title: "Paid in full", body: `We received ₹${Math.round(inv!.total).toLocaleString("en-IN")}. Thank you.`, targetScreen: "Invoices" });
  }
}

async function staffIdByCode(db: Queryable, code: string) {
  return (await one<{ id: string }>(db, "SELECT id FROM staff WHERE code = $1", [code]))?.id ?? null;
}

async function bayIdByCode(db: Queryable, code: string) {
  return (await one<{ id: string }>(db, "SELECT id FROM bays WHERE code = $1", [code]))?.id ?? null;
}

/**
 * One old job card into the app. history = first copy for a customer (no notifications, final state written directly);
 * otherwise it is a live change and the customer is told, exactly as when the workshop uses the integration API.
 */
async function upsertOldJob(deps: BridgeDeps, job: OldJob, extras: JobExtras, history: boolean) {
  const { db, config } = deps;
  const oldId = int(job.id);
  const phone = phone10(job.phone);
  if (!phone) return false;
  return tx(db, async (client) => {
    const customer = await one<{ id: string }>(client, "SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL", [`+91${phone}`]);
    if (!customer) return false;
    const bill = extras.bills.get(oldId);
    const labour = extras.labour.get(oldId) ?? [];
    const target = statusFor(job, Boolean(bill), history);
    const slot = slotOf(job);
    const odometer = int(job.odo) > 0 && int(job.odo) < 2_000_000 ? int(job.odo) : null;
    const bayId = int(job.bay) ? await bayIdByCode(client, `BAY-${int(job.bay)}`) : null;
    const mechanicId = int(job.mechanic) ? await staffIdByCode(client, `MEC-${int(job.mechanic)}`) : null;
    const ready = istTime(job.delivery);
    const paused = !/^active$/i.test(str(job.stream)) || /^STREAM_STOPPED$/i.test(str(job.status));

    let jobCardId = await refOf(client, "job_card", oldId);
    let created = false;
    if (!jobCardId) {
      const plate = plateOf(job.plate);
      if (!plate) return false; // no number plate yet: try again on the next run
      const vehicleId = await vehicleFor(client, customer.id, plate, str(job.make, 60), str(job.model, 60), odometer);
      if (!vehicleId) return false; // that plate belongs to another app customer; leave it for the workshop to sort out
      // An app booking for this bike that reception has now turned into a job card: link the two.
      const open = await one<{ id: string }>(
        client, "SELECT id FROM job_cards WHERE vehicle_id = $1 AND status NOT IN ('delivered', 'cancelled') ORDER BY created_at DESC LIMIT 1", [vehicleId]);
      if (open) {
        jobCardId = open.id;
      } else {
        const workshop = await one<{ id: string }>(client, "SELECT id FROM workshops WHERE code = $1", [config.WORKSHOP_CODE]);
        if (!workshop) throw new Error(`Workshop ${config.WORKSHOP_CODE} is missing. Run npm run db:seed.`);
        const first: JobStatus = history ? target : "booked";
        const done = istTime(job.completed) ?? slot.end;
        const row = await one<{ id: string }>(
          client,
          `INSERT INTO job_cards (number, workshop_id, customer_id, vehicle_id, status, mode, source, slot_start, slot_end, odometer_km_at_intake, customer_note, created_at,
                                  closed_at, delivered_at, cancelled_at)
           VALUES ('BS-' || to_char($10::timestamptz AT TIME ZONE $11, 'YYYY') || '-' || lpad(nextval('job_card_number_seq')::text, 6, '0'),
                   $1, $2, $3, $4, 'visit', 'walk_in', $5, $6, $7, $8, $10, $9, $12, $13) RETURNING id`,
          [workshop.id, customer.id, vehicleId, first, slot.start, slot.end, odometer, str(job.note, 500) || null,
            first === "delivered" ? done : null, slot.created, config.TIMEZONE, first === "delivered" ? done : null, first === "cancelled" ? done : null],
        );
        jobCardId = row!.id;
        created = true;
        await client.query(
          "INSERT INTO job_card_status_history (job_card_id, from_status, to_status, source, created_at) VALUES ($1, NULL, 'booked', 'integration', $2)",
          [jobCardId, slot.created],
        );
        if (history && first !== "booked") {
          await client.query(
            "INSERT INTO job_card_status_history (job_card_id, from_status, to_status, source, note, created_at) VALUES ($1, 'booked', $2, 'integration', 'From the workshop records', $3)",
            [jobCardId, first, first === "delivered" || first === "cancelled" ? done : slot.created],
          );
        }
      }
      await putRef(client, "job_card", jobCardId, oldId);
    }

    const current = await lockJobCard(client, jobCardId);
    const finished = current.status === "delivered" || current.status === "cancelled";
    const hasInvoice = await one<{ id: string }>(client, "SELECT id FROM invoices WHERE job_card_id = $1 AND status <> 'void'", [jobCardId]);
    if (!finished || created) {
      await client.query(
        `UPDATE job_cards SET bay_id = COALESCE($2, bay_id), mechanic_id = COALESCE($3, mechanic_id), promised_ready_at = COALESCE($4, promised_ready_at),
           odometer_km_at_intake = COALESCE($5, odometer_km_at_intake), camera_paused = $6 WHERE id = $1`,
        [jobCardId, bayId, mechanicId, ready, odometer, paused],
      );
      if (!hasInvoice) await setServices(client, jobCardId, job, labour);
    }
    if (bill) await copyBill(client, jobCardId, customer.id, bill, extras.billItems.get(oldId) ?? [], labour, extras.products, history);

    // Forward only: the workshop's status never moves the app backwards.
    if (!finished && current.status !== target && (target === "cancelled" || stageOf(target) > stageOf(current.status))) {
      if (history) {
        await client.query(
          `UPDATE job_cards SET status = $2, closed_at = CASE WHEN $2 = 'delivered' THEN COALESCE(closed_at, $3) ELSE closed_at END,
             delivered_at = CASE WHEN $2 = 'delivered' THEN $3 ELSE delivered_at END, cancelled_at = CASE WHEN $2 = 'cancelled' THEN $3 ELSE cancelled_at END
           WHERE id = $1`,
          [jobCardId, target, istTime(job.completed) ?? slot.end],
        );
        await client.query(
          "INSERT INTO job_card_status_history (job_card_id, from_status, to_status, source, note) VALUES ($1, $2, $3, 'integration', 'From the workshop records')",
          [jobCardId, current.status, target],
        );
      } else {
        await applyStatus(client, jobCardId, current.status, target, {
          source: "integration",
          note: "From the workshop",
          staffId: target === "in_service" ? mechanicId : null,
          cancelReason: target === "cancelled" ? "Cancelled by the workshop" : null,
        });
      }
    } else {
      await touch(client, jobCardId);
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// 3. First login: copy a customer's old records once
// ---------------------------------------------------------------------------

async function importCustomers(deps: BridgeDeps, limit = 25) {
  const { db, config, old } = deps;
  const waiting = await many<{ id: string; phone: string; name: string }>(
    db,
    `SELECT c.id, c.phone, c.name FROM customers c LEFT JOIN bridge_imported_customers b ON b.customer_id = c.id
     WHERE b.customer_id IS NULL AND c.deleted_at IS NULL ORDER BY c.created_at LIMIT $1`,
    [limit],
  );
  let imported = 0;
  for (const customer of waiting) {
    const phone = phone10(customer.phone);
    if (!phone) continue;
    const users = await old!.select("user", { id: "id", name: "username", wallet: "wallet" }, `${PHONE10("userphone")} = ${sqlText(phone)}`);
    const userIds = users.map((u) => int(u.id)).filter((id) => id > 0);
    const name = users.map((u) => str(u.name, 80)).find((n) => n && !/^null$/i.test(n));
    const jobs = await old!.select("job_card", JC_COLS,
      `${PHONE10("phone")} = ${sqlText(phone)}${userIds.length ? ` OR user_id IN (${userIds.map((id) => sqlText(String(id))).join(", ")})` : ""} ORDER BY id`);
    const bikes = userIds.length ? await old!.select("a_bikes", { id: "id", make: "make", model: "model", km: "km", plate: "reg_no", type: "type" }, `user_id IN (${userIds.map((id) => sqlText(String(id))).join(", ")}) ORDER BY id`) : [];

    await tx(db, async (client) => {
      const jobName = jobs.map((j) => str(j.name, 80)).filter(Boolean).pop();
      if (!customer.name && (name || jobName)) await client.query("UPDATE customers SET name = $2 WHERE id = $1 AND name = ''", [customer.id, titleCase(name || jobName!)]);
      for (const bike of bikes) {
        const plate = plateOf(bike.plate);
        if (plate) await vehicleFor(client, customer.id, plate, str(bike.make, 60), str(bike.model, 60), int(bike.km) || null, str(bike.type));
      }
      const wallet = Math.max(0, ...users.map((u) => num(u.wallet)));
      if (config.BRIDGE_IMPORT_WALLET === "on" && wallet >= 1) {
        await addWalletTransaction(client, { customerId: customer.id, amount: money(wallet), kind: "adjustment", title: "Wallet from the old Bike Surgeon app", detail: "Your balance moved to this app" });
      }
      await client.query(
        "INSERT INTO bridge_imported_customers (customer_id, old_user_ids) VALUES ($1, $2) ON CONFLICT (customer_id) DO NOTHING",
        [customer.id, userIds],
      );
    });

    const extras = await loadJobExtras(old!, jobs);
    for (const job of jobs) {
      try {
        // Old cards that are still open are followed live from now on; everything is copied quietly the first time.
        await upsertOldJob(deps, job, extras, true);
      } catch (error) {
        deps.log?.(`[bridge] job card ${int(job.id)}: ${(error as Error).message}`);
      }
    }
    imported += 1;
  }
  return imported;
}

// ---------------------------------------------------------------------------
// 4. Live: new job cards and every open one
// ---------------------------------------------------------------------------

async function syncLiveJobs(deps: BridgeDeps) {
  const { db, old } = deps;
  let cursor = Number(await getState(db, "old_job_card_last_id"));
  if (!(await getState(db, "old_job_card_last_id"))) {
    const top = await old!.select("job_card", { m: "MAX(id)" });
    cursor = int(top[0]?.m);
    await setState(db, "old_job_card_last_id", String(cursor));
  }
  // Old ids of app job cards that are still moving, or whose bill is not paid yet.
  const following = await many<{ external_id: string }>(
    db,
    `SELECT er.external_id FROM external_references er JOIN job_cards jc ON jc.id::text = er.entity_id
     WHERE er.entity_type = 'job_card' AND er.system = $1
       AND (jc.status NOT IN ('delivered', 'cancelled') OR EXISTS (SELECT 1 FROM invoices i WHERE i.job_card_id = jc.id AND i.status = 'open' AND i.source = 'workshop'))`,
    [SYSTEM],
  );
  const followIds = following.map((row) => Number(row.external_id)).filter(Number.isInteger);
  const rows = await old!.select("job_card", JC_COLS,
    `id > ${int(cursor)}${followIds.length ? ` OR id IN (${sqlIds(followIds)})` : ""} ORDER BY id LIMIT 1000`);
  if (!rows.length) return 0;
  // Only customers of the app matter; the rest are copied when they first log in.
  const phones = [...new Set(rows.map((row) => phone10(row.phone)).filter(Boolean))].map((p) => `+91${p}`);
  const known = new Set((await many<{ phone: string }>(db, "SELECT phone FROM customers WHERE phone = ANY($1) AND deleted_at IS NULL", [phones])).map((r) => r.phone.slice(3)));
  const ours = rows.filter((row) => known.has(phone10(row.phone) ?? ""));
  const extras = await loadJobExtras(old!, ours);
  let changed = 0;
  for (const job of ours) {
    try {
      if (await upsertOldJob(deps, job, extras, false)) changed += 1;
    } catch (error) {
      deps.log?.(`[bridge] job card ${int(job.id)}: ${(error as Error).message}`);
    }
  }
  const top = Math.max(cursor, ...rows.map((row) => int(row.id)));
  if (top > cursor) await setState(db, "old_job_card_last_id", String(top));
  return changed;
}

// ---------------------------------------------------------------------------
// 5. App bookings into the old site's booking list (OLD_DB_WRITE=on)
// ---------------------------------------------------------------------------

async function sendBookings(deps: BridgeDeps) {
  const { db, config, old } = deps;
  await db.query(
    `INSERT INTO bridge_booking_requests (job_card_id)
     SELECT id FROM job_cards WHERE source = 'app' AND status = 'booked' AND created_at > now() - interval '3 days'
     ON CONFLICT DO NOTHING`,
  );
  const due = await many<{ job_card_id: string }>(db, "SELECT job_card_id FROM bridge_booking_requests WHERE sent_at IS NULL AND attempts < 20 ORDER BY created_at LIMIT 20");
  let sent = 0;
  for (const { job_card_id } of due) {
    const job = await one<{
      number: string; status: string; mode: string; slot_start: string; slot_end: string; customer_note: string | null; phone: string; name: string;
      make: string; model: string; plate: string; label: string | null; line: string | null; lat: number | null; lng: number | null; services: string | null;
    }>(
      db,
      `SELECT jc.number, jc.status, jc.mode, jc.slot_start, jc.slot_end, jc.customer_note, c.phone, c.name, v.make, v.model, v.registration_number AS plate,
              a.label, a.line, a.latitude AS lat, a.longitude AS lng,
              (SELECT string_agg(name, ', ' ORDER BY name) FROM job_card_services WHERE job_card_id = jc.id) AS services
       FROM job_cards jc JOIN customers c ON c.id = jc.customer_id JOIN vehicles v ON v.id = jc.vehicle_id LEFT JOIN customer_addresses a ON a.id = jc.pickup_address_id
       WHERE jc.id = $1`,
      [job_card_id],
    );
    if (!job || job.status !== "booked") {
      await db.query("UPDATE bridge_booking_requests SET sent_at = now(), last_error = 'not booked any more' WHERE job_card_id = $1", [job_card_id]);
      continue;
    }
    const phone = job.phone.slice(3);
    const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: config.TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: config.TIMEZONE }).format(new Date(job.slot_start));
    try {
      const users = await old!.select("user", { id: "id" }, `${PHONE10("userphone")} = ${sqlText(phone)} ORDER BY id DESC LIMIT 1`);
      const pickup = job.mode === "pickup";
      const address = pickup ? `${job.label ?? "Pickup"}: ${job.line ?? ""}` : "Service Center - Bike Surgeon, Davanagere";
      const note = `${job.customer_note ? `${job.customer_note} | ` : ""}New app ${job.number}, ${day} ${when(job.slot_start)}-${when(job.slot_end)}`;
      const sql = `INSERT INTO a_service_bookings (user_id, name, phone, type, pickupType, address, latitude, longitude, bike_details, note, date_time, scheduled_for, status)
        VALUES (${int(users[0]?.id)}, ${sqlText(job.name.slice(0, 200))}, ${sqlText(phone)}, ${sqlText((job.services ?? "Service").slice(0, 200))}, ${sqlText(pickup ? "home" : "work")},
          ${sqlText(address.slice(0, 200))}, ${sqlText(job.lat === null ? "" : String(job.lat))}, ${sqlText(job.lng === null ? "" : String(job.lng))},
          ${sqlText(`${job.make} ${job.model}, ${job.plate}`.slice(0, 200))}, ${sqlText(note.slice(0, 200))}, ${sqlText(istNowText())}, ${sqlText(day)}, 'pending');
        SELECT LAST_INSERT_ID();`;
      const out = await old!.write(sql);
      const oldId = int(out.trim().split("\n").pop());
      await db.query("UPDATE bridge_booking_requests SET sent_at = now(), old_booking_id = $2, attempts = attempts + 1, last_error = NULL WHERE job_card_id = $1", [job_card_id, oldId || null]);
      sent += 1;
    } catch (error) {
      await db.query("UPDATE bridge_booking_requests SET attempts = attempts + 1, last_error = $2 WHERE job_card_id = $1", [job_card_id, String((error as Error).message).slice(0, 300)]);
    }
  }
  // A booking the customer cancelled in the app is marked cancelled in the old list too, unless reception already converted it.
  const cancelled = await many<{ job_card_id: string; old_booking_id: number }>(
    db,
    `SELECT b.job_card_id, b.old_booking_id FROM bridge_booking_requests b JOIN job_cards jc ON jc.id = b.job_card_id
     WHERE jc.status = 'cancelled' AND b.old_booking_id IS NOT NULL AND b.last_error IS DISTINCT FROM 'cancel sent' LIMIT 20`,
  );
  for (const row of cancelled) {
    try {
      await old!.write(`UPDATE a_service_bookings SET status = 'cancelled' WHERE id = ${int(row.old_booking_id)} AND status NOT IN ('converted', 'cancelled')`);
      await db.query("UPDATE bridge_booking_requests SET last_error = 'cancel sent' WHERE job_card_id = $1", [row.job_card_id]);
    } catch {
      // tried again next run
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export async function runBridgeOnce(deps: BridgeDeps): Promise<BridgeSummary> {
  const summary: BridgeSummary = { at: new Date().toISOString(), bays: 0, staff: 0, parts: 0, salesSent: 0, customersImported: 0, jobCards: 0, bookingsSent: 0, errors: [] };
  const step = async (name: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      const line = `${name}: ${(error as Error).message}`;
      summary.errors.push(line);
      deps.log?.(`[bridge] ${line}`);
    }
  };
  if (deps.old) {
    await step("bays and staff", async () => { Object.assign(summary, await syncMaster(deps)); });
  }
  if (deps.inventory) {
    await step("inventory parts", async () => { summary.parts = await syncParts(deps.db, deps.inventory!, deps.fetcher); });
    await step("inventory sales", async () => { summary.salesSent = await sendSales(deps.db, deps.inventory!, deps.fetcher); });
  }
  if (deps.old) {
    await step("customers", async () => { summary.customersImported = await importCustomers(deps); });
    await step("job cards", async () => { summary.jobCards = await syncLiveJobs(deps); });
    if (deps.config.OLD_DB_WRITE === "on") await step("bookings to the old site", async () => { summary.bookingsSent = await sendBookings(deps); });
  }
  await setState(deps.db, "last_run", JSON.stringify(summary)).catch(() => {});
  return summary;
}

export function startBridge(deps: BridgeDeps) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // A session lock on one held connection, so only one API instance runs the bridge at a time.
      const holder = await deps.db.connect();
      try {
        const lock = await holder.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(727002) AS locked");
        if (!lock.rows[0]?.locked) return;
        try {
          await runBridgeOnce(deps);
        } finally {
          await holder.query("SELECT pg_advisory_unlock(727002)").catch(() => {});
        }
      } finally {
        holder.release();
      }
    } catch (error) {
      deps.log?.(`[bridge] ${(error as Error).message}`);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(tick, 3000);
  const timer = setInterval(tick, deps.config.BRIDGE_INTERVAL_MS);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
