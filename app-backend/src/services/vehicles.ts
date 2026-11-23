import { isUniqueViolation, many, one, type Queryable } from "../db.js";
import { normalizePlate } from "../domain.js";
import { conflict, notFound } from "../errors.js";
import type { BODY_TYPES } from "../schemas.js";
import { emit } from "./events.js";

type BodyType = (typeof BODY_TYPES)[number];

type VehicleRow = {
  id: string;
  customer_id: string;
  registration_number: string;
  make: string;
  model: string;
  body_type: BodyType;
  colour_name: string | null;
  colour_hex: string | null;
  make_year: number | null;
  chassis_last4: string | null;
  odometer_km: number | null;
  odometer_recorded_at: string | null;
  created_at: string;
};

type DocumentRow = {
  vehicle_id: string;
  kind: "rc" | "insurance" | "puc";
  file_url: string | null;
  provider: string | null;
  policy_type: string | null;
  reading: string | null;
  valid_until: string | null;
};

const toDocument = (row: DocumentRow) => ({
  kind: row.kind,
  fileUrl: row.file_url,
  provider: row.provider,
  policyType: row.policy_type,
  reading: row.reading,
  validUntil: row.valid_until,
});

async function withDocuments(db: Queryable, rows: VehicleRow[]) {
  const docs = rows.length
    ? await many<DocumentRow>(db, "SELECT * FROM vehicle_documents WHERE vehicle_id = ANY($1) ORDER BY kind", [rows.map((row) => row.id)])
    : [];
  return rows.map((row) => ({
    id: row.id,
    registrationNumber: row.registration_number,
    make: row.make,
    model: row.model,
    bodyType: row.body_type,
    colourName: row.colour_name,
    colourHex: row.colour_hex,
    makeYear: row.make_year,
    chassisLast4: row.chassis_last4,
    odometerKm: row.odometer_km,
    odometerRecordedAt: row.odometer_recorded_at,
    documents: docs.filter((doc) => doc.vehicle_id === row.id).map(toDocument),
    createdAt: row.created_at,
  }));
}

export type VehicleDto = Awaited<ReturnType<typeof withDocuments>>[number];

export async function listVehicles(db: Queryable, customerIds: string[]) {
  const rows = await many<VehicleRow>(
    db,
    "SELECT * FROM vehicles WHERE customer_id = ANY($1) AND archived_at IS NULL ORDER BY created_at",
    [customerIds],
  );
  const vehicles = await withDocuments(db, rows);
  return vehicles.map((vehicle, index) => ({ ...vehicle, customerId: rows[index].customer_id }));
}

/** Loads a vehicle and checks it belongs to the customer (pass null to skip the check, for integrations). */
export async function getVehicle(db: Queryable, id: string, customerId: string | null) {
  const row = await one<VehicleRow>(
    db,
    "SELECT * FROM vehicles WHERE id = $1 AND archived_at IS NULL AND ($2::uuid IS NULL OR customer_id = $2)",
    [id, customerId],
  );
  if (!row) throw notFound("Vehicle");
  const [vehicle] = await withDocuments(db, [row]);
  return { ...vehicle, customerId: row.customer_id };
}

type VehicleInput = {
  registrationNumber: string;
  make: string;
  model: string;
  bodyType: BodyType;
  colourName?: string | null;
  colourHex?: string | null;
  makeYear?: number | null;
  chassisLast4?: string | null;
  odometerKm?: number | null;
};

export async function createVehicle(db: Queryable, customerId: string, input: VehicleInput, odometerSource: "customer" | "workshop" = "customer") {
  const plate = normalizePlate(input.registrationNumber);
  const taken = await one<{ customer_id: string }>(db, "SELECT customer_id FROM vehicles WHERE registration_number = $1 AND archived_at IS NULL", [plate]);
  if (taken) {
    throw taken.customer_id === customerId
      ? conflict("vehicle_exists", "That vehicle is already in your garage")
      : conflict("vehicle_registered_elsewhere", "That vehicle is registered to another account. Call the workshop to move it.");
  }
  try {
    const row = await one<VehicleRow>(
      db,
      `INSERT INTO vehicles (customer_id, registration_number, make, model, body_type, colour_name, colour_hex, make_year, chassis_last4,
                             odometer_km, odometer_recorded_at, odometer_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $10::int IS NULL THEN NULL ELSE now() END, CASE WHEN $10::int IS NULL THEN NULL ELSE $11 END)
       RETURNING *`,
      [customerId, plate, input.make, input.model, input.bodyType, input.colourName ?? null, input.colourHex ?? null, input.makeYear ?? null,
        input.chassisLast4 ?? null, input.odometerKm ?? null, odometerSource],
    );
    const [vehicle] = await withDocuments(db, [row!]);
    await emit(db, "vehicle.created", "vehicle", vehicle.id, { customerId, vehicle });
    return vehicle;
  } catch (error) {
    if (isUniqueViolation(error, "vehicles_active_registration")) throw conflict("vehicle_exists", "That vehicle is already registered");
    throw error;
  }
}

export async function updateVehicle(db: Queryable, id: string, customerId: string, patch: Partial<Omit<VehicleInput, "registrationNumber">>) {
  const row = await one<VehicleRow>(
    db,
    `UPDATE vehicles SET
       make = COALESCE($3, make),
       model = COALESCE($4, model),
       body_type = COALESCE($5, body_type),
       colour_name = CASE WHEN $6::boolean THEN $7 ELSE colour_name END,
       colour_hex = CASE WHEN $8::boolean THEN $9 ELSE colour_hex END,
       make_year = CASE WHEN $10::boolean THEN $11 ELSE make_year END,
       chassis_last4 = CASE WHEN $12::boolean THEN $13 ELSE chassis_last4 END,
       odometer_km = CASE WHEN $14::int IS NULL THEN odometer_km ELSE $14 END,
       odometer_recorded_at = CASE WHEN $14::int IS NULL THEN odometer_recorded_at ELSE now() END,
       odometer_source = CASE WHEN $14::int IS NULL THEN odometer_source ELSE 'customer' END
     WHERE id = $1 AND customer_id = $2 AND archived_at IS NULL RETURNING *`,
    [id, customerId, patch.make ?? null, patch.model ?? null, patch.bodyType ?? null,
      patch.colourName !== undefined, patch.colourName ?? null,
      patch.colourHex !== undefined, patch.colourHex ?? null,
      patch.makeYear !== undefined, patch.makeYear ?? null,
      patch.chassisLast4 !== undefined, patch.chassisLast4 ?? null,
      patch.odometerKm ?? null],
  );
  if (!row) throw notFound("Vehicle");
  const [vehicle] = await withDocuments(db, [row]);
  await emit(db, "vehicle.updated", "vehicle", id, { customerId, vehicle });
  return vehicle;
}

export async function archiveVehicle(db: Queryable, id: string, customerId: string) {
  const open = await one<{ n: number }>(db, "SELECT count(*) AS n FROM job_cards WHERE vehicle_id = $1 AND status NOT IN ('delivered', 'cancelled')", [id]);
  if (open && open.n > 0) throw conflict("open_booking", "This vehicle has an open booking");
  const result = await db.query("UPDATE vehicles SET archived_at = now() WHERE id = $1 AND customer_id = $2 AND archived_at IS NULL", [id, customerId]);
  if (result.rowCount === 0) throw notFound("Vehicle");
  await emit(db, "vehicle.archived", "vehicle", id, { customerId, vehicleId: id });
}

export async function upsertDocument(
  db: Queryable,
  vehicleId: string,
  kind: "rc" | "insurance" | "puc",
  input: { fileUrl?: string | null; provider?: string | null; policyType?: string | null; reading?: string | null; validUntil?: string | null },
) {
  const row = await one<DocumentRow>(
    db,
    `INSERT INTO vehicle_documents (vehicle_id, kind, file_url, provider, policy_type, reading, valid_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (vehicle_id, kind) DO UPDATE SET
       file_url = COALESCE(EXCLUDED.file_url, vehicle_documents.file_url),
       provider = COALESCE(EXCLUDED.provider, vehicle_documents.provider),
       policy_type = COALESCE(EXCLUDED.policy_type, vehicle_documents.policy_type),
       reading = COALESCE(EXCLUDED.reading, vehicle_documents.reading),
       valid_until = COALESCE(EXCLUDED.valid_until, vehicle_documents.valid_until)
     RETURNING *`,
    [vehicleId, kind, input.fileUrl ?? null, input.provider ?? null, input.policyType ?? null, input.reading ?? null, input.validUntil ?? null],
  );
  await db.query("UPDATE vehicles SET updated_at = now() WHERE id = $1", [vehicleId]);
  return toDocument(row!);
}

type WarrantyRow = {
  id: string;
  vehicle_id: string;
  job_card_id: string | null;
  title: string;
  brand: string;
  serial_number: string | null;
  starts_on: string | null;
  ends_on: string | null;
  ends_at_km: number | null;
};

const toWarranty = (row: WarrantyRow) => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  jobCardId: row.job_card_id,
  title: row.title,
  brand: row.brand,
  serialNumber: row.serial_number,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  endsAtKm: row.ends_at_km,
});

export async function listWarranties(db: Queryable, vehicleId: string) {
  const rows = await many<WarrantyRow>(db, "SELECT * FROM warranties WHERE vehicle_id = $1 ORDER BY ends_on NULLS LAST, created_at", [vehicleId]);
  return rows.map(toWarranty);
}

export async function addWarranty(
  db: Queryable,
  vehicleId: string,
  input: { title: string; brand?: string; serialNumber?: string | null; startsOn?: string | null; endsOn?: string | null; endsAtKm?: number | null; jobCardId?: string | null },
) {
  const row = await one<WarrantyRow>(
    db,
    `INSERT INTO warranties (vehicle_id, job_card_id, title, brand, serial_number, starts_on, ends_on, ends_at_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [vehicleId, input.jobCardId ?? null, input.title, input.brand ?? "", input.serialNumber ?? null, input.startsOn ?? null, input.endsOn ?? null, input.endsAtKm ?? null],
  );
  return toWarranty(row!);
}

export async function listMaintenance(db: Queryable, vehicleId: string) {
  const rows = await many<{ item: string; last_done_km: number; interval_km: number | null; interval_months: number | null }>(
    db,
    "SELECT item, last_done_km, interval_km, interval_months FROM maintenance_items WHERE vehicle_id = $1 ORDER BY item",
    [vehicleId],
  );
  return rows.map((row) => ({ item: row.item, lastDoneKm: row.last_done_km, intervalKm: row.interval_km, intervalMonths: row.interval_months }));
}

export async function upsertMaintenance(db: Queryable, vehicleId: string, item: string, input: { lastDoneKm: number; intervalKm: number | null; intervalMonths: number | null }) {
  await db.query(
    `INSERT INTO maintenance_items (vehicle_id, item, last_done_km, interval_km, interval_months) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (vehicle_id, item) DO UPDATE SET last_done_km = EXCLUDED.last_done_km, interval_km = EXCLUDED.interval_km,
       interval_months = EXCLUDED.interval_months, updated_at = now()`,
    [vehicleId, item, input.lastDoneKm, input.intervalKm, input.intervalMonths],
  );
}
