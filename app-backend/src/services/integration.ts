import { many, one, tx, type Db, type Queryable } from "../db.js";
import { normalizePhone, normalizePlate } from "../domain.js";
import { conflict, notFound } from "../errors.js";
import { createBooking } from "./bookings.js";
import type { Config } from "../config.js";
import type { ENTITY_TYPES } from "../schemas.js";
import { emit } from "./events.js";
import { decodeCursor, pageOf } from "./paging.js";
import { findOrCreateByPhone, toCustomer } from "./customers.js";
import { createVehicle, listVehicles } from "./vehicles.js";

// ---------------------------------------------------------------------------
// External references: our id <-> CRM/ERP id
// ---------------------------------------------------------------------------

type RefRow = { entity_type: (typeof ENTITY_TYPES)[number]; entity_id: string; system: string; external_id: string };

const toRef = (row: RefRow) => ({ entityType: row.entity_type, entityId: row.entity_id, system: row.system, externalId: row.external_id });

export async function putExternalRef(db: Queryable, input: { entityType: string; entityId: string; system: string; externalId: string }) {
  const row = await one<RefRow>(
    db,
    `INSERT INTO external_references (entity_type, entity_id, system, external_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (entity_type, entity_id, system) DO UPDATE SET external_id = EXCLUDED.external_id
     RETURNING *`,
    [input.entityType, input.entityId, input.system, input.externalId],
  );
  return toRef(row!);
}

export async function findExternalRefs(db: Queryable, filter: { entityType?: string; entityId?: string; system?: string; externalId?: string }) {
  const rows = await many<RefRow>(
    db,
    `SELECT * FROM external_references
     WHERE ($1::text IS NULL OR entity_type = $1) AND ($2::text IS NULL OR entity_id = $2)
       AND ($3::text IS NULL OR system = $3) AND ($4::text IS NULL OR external_id = $4)
     ORDER BY updated_at DESC LIMIT 500`,
    [filter.entityType ?? null, filter.entityId ?? null, filter.system ?? null, filter.externalId ?? null],
  );
  return rows.map(toRef);
}

// ---------------------------------------------------------------------------
// Customers for CRM sync
// ---------------------------------------------------------------------------

type CustomerRow = Parameters<typeof toCustomer>[0];

async function withGarage(db: Queryable, rows: CustomerRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const vehicles = await listVehicles(db, ids);
  const balances = await many<{ customer_id: string; balance: number }>(db, "SELECT customer_id, balance FROM customer_wallet_balances WHERE customer_id = ANY($1)", [ids]);
  return rows.map((row) => ({
    ...toCustomer(row),
    vehicles: vehicles.filter((v) => v.customerId === row.id).map(({ customerId: _customerId, ...vehicle }) => vehicle),
    walletBalance: balances.find((b) => b.customer_id === row.id)?.balance ?? 0,
  }));
}

export async function listCustomersUpdatedSince(db: Queryable, page: { since: string | null; cursor?: string }, limit: number) {
  const after = decodeCursor(page.cursor);
  const rows = await many<CustomerRow>(
    db,
    `SELECT * FROM customers WHERE deleted_at IS NULL AND ($1::timestamptz IS NULL OR updated_at > $1)
       AND ($3::timestamptz IS NULL OR (updated_at, id) > ($3::timestamptz, $4::uuid))
     ORDER BY updated_at, id LIMIT $2`,
    [page.since, limit, after?.ts ?? null, after?.id ?? null],
  );
  return pageOf(db, "customers", await withGarage(db, rows), limit);
}

export async function getCustomerForIntegration(db: Queryable, ref: string) {
  const byPhone = !/^[0-9a-f-]{36}$/i.test(ref);
  const row = await one<CustomerRow>(
    db,
    `SELECT * FROM customers WHERE deleted_at IS NULL AND ${byPhone ? "phone = $1" : "id = $1::uuid"}`,
    [byPhone ? normalizePhone(ref) : ref],
  );
  if (!row) throw notFound("Customer");
  return (await withGarage(db, [row]))[0];
}

// ---------------------------------------------------------------------------
// Walk-in and phone bookings created in the ERP, so they show in the customer's app
// ---------------------------------------------------------------------------

type IntegrationBookingInput = {
  source: "walk_in" | "phone" | "erp";
  customer: { phone: string; name: string };
  vehicle: Parameters<typeof createVehicle>[2];
  serviceIds: string[];
  mode: "pickup" | "visit";
  slotStart: string;
  slotEnd: string;
  note?: string | null;
};

export async function createBookingFromIntegration(db: Db, config: Config, input: IntegrationBookingInput) {
  const phone = normalizePhone(input.customer.phone);
  const plate = normalizePlate(input.vehicle.registrationNumber);
  const { customerId, vehicleId } = await tx(db, async (client) => {
    const { customer } = await findOrCreateByPhone(client, phone, undefined, config.REFERRAL_REWARD);
    if (input.customer.name && !customer.name) {
      await client.query("UPDATE customers SET name = $2 WHERE id = $1", [customer.id, input.customer.name]);
      await emit(client, "customer.updated", "customer", customer.id, { customer: { ...customer, name: input.customer.name } });
    }
    const existing = await one<{ id: string; customer_id: string }>(
      client, "SELECT id, customer_id FROM vehicles WHERE registration_number = $1 AND archived_at IS NULL", [plate]);
    if (existing && existing.customer_id !== customer.id) {
      throw conflict("vehicle_registered_elsewhere", `${plate} belongs to a different customer in the app`);
    }
    const vehicle = existing ?? (await createVehicle(client, customer.id, input.vehicle, "workshop"));
    return { customerId: customer.id, vehicleId: vehicle.id };
  });
  return createBooking(db, config, customerId, {
    vehicleId,
    serviceIds: input.serviceIds,
    mode: input.mode,
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    note: input.note,
  }, input.source);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function submitReview(
  db: Db,
  customerId: string,
  jobCardId: string,
  input: { stars: number; tags: string[]; note?: string | null; workVotes: Record<string, "up" | "down">; staffVote?: "up" | "down" | null; followUpInterests: string[] },
) {
  await tx(db, async (client) => {
    const job = await one<{ status: string }>(client, "SELECT status FROM job_cards WHERE id = $1 AND customer_id = $2", [jobCardId, customerId]);
    if (!job) throw notFound("Booking");
    if (job.status !== "job_closed" && job.status !== "delivered") throw conflict("not_finished", "You can review the service once it is done");
    const existing = await one<{ id: string }>(client, "SELECT id FROM reviews WHERE job_card_id = $1", [jobCardId]);
    if (existing) throw conflict("already_reviewed", "You have already reviewed this service");
    const review = await one<{ id: string }>(
      client,
      `INSERT INTO reviews (job_card_id, customer_id, stars, tags, note, work_votes, staff_vote, follow_up_interests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [jobCardId, customerId, input.stars, input.tags, input.note ?? null, JSON.stringify(input.workVotes), input.staffVote ?? null, input.followUpInterests],
    );
    await emit(client, "review.submitted", "job_card", jobCardId, { reviewId: review!.id, jobCardId, customerId, ...input });
  });
}
