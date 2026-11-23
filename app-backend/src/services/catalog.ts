import type { Config } from "../config.js";
import { many, one, type Queryable } from "../db.js";
import { normalizePhone } from "../domain.js";
import { badRequest, notFound } from "../errors.js";

type ServiceRow = { id: string; name: string; detail: string; category: "Service" | "Repair" | "Care"; price: number };

export async function listServices(db: Queryable) {
  const rows = await many<ServiceRow>(db, "SELECT id, name, detail, category, price FROM service_catalog WHERE active ORDER BY sort_order, name");
  return rows.map((row) => ({ id: row.id, name: row.name, detail: row.detail, category: row.category, price: row.price }));
}

type OfferRow = {
  id: string;
  title: string;
  short_label: string;
  detail: string;
  discount_amount: number;
  first_booking_only: boolean;
  requires_service_id: string | null;
  requires_other_service: boolean;
  valid_until: string | null;
};

export async function listOffers(db: Queryable, config: Config) {
  const rows = await many<OfferRow>(
    db,
    "SELECT * FROM offers WHERE active AND (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE $1)::date) ORDER BY discount_amount DESC",
    [config.TIMEZONE],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    shortLabel: row.short_label,
    detail: row.detail,
    discountAmount: row.discount_amount,
    firstBookingOnly: row.first_booking_only,
    requiresServiceId: row.requires_service_id,
    requiresOtherService: row.requires_other_service,
    validUntil: row.valid_until,
  }));
}

export async function getWorkshop(db: Queryable, config: Config) {
  const row = await one<{ id: string; name: string; address: string; city: string; phone: string | null; whatsapp: string | null; roadside_phone: string | null }>(
    db, "SELECT * FROM workshops WHERE code = $1", [config.WORKSHOP_CODE]);
  if (!row) throw notFound("Workshop");
  const advisor = await one<{ name: string; phone: string | null }>(
    db, "SELECT name, phone FROM staff WHERE workshop_id = $1 AND role = 'advisor' AND active ORDER BY created_at LIMIT 1", [row.id]);
  return {
    name: row.name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    whatsapp: row.whatsapp,
    roadsidePhone: row.roadside_phone,
    advisor: advisor ?? null,
  };
}

async function workshopId(db: Queryable, config: Config) {
  const row = await one<{ id: string }>(db, "SELECT id FROM workshops WHERE code = $1", [config.WORKSHOP_CODE]);
  if (!row) throw notFound("Workshop");
  return row.id;
}

export async function upsertStaff(db: Queryable, config: Config, code: string, input: { name: string; role: string; phone?: string | null; active: boolean }) {
  await db.query(
    `INSERT INTO staff (workshop_id, code, name, role, phone, active) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, phone = EXCLUDED.phone, active = EXCLUDED.active`,
    [await workshopId(db, config), code, input.name, input.role, input.phone ? normalizePhone(input.phone) : null, input.active],
  );
}

export async function upsertBay(db: Queryable, config: Config, code: string, input: { name: string; cameraStreamUrl?: string | null; active: boolean }) {
  await db.query(
    `INSERT INTO bays (workshop_id, code, name, camera_stream_url, active) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, camera_stream_url = EXCLUDED.camera_stream_url, active = EXCLUDED.active`,
    [await workshopId(db, config), code, input.name, input.cameraStreamUrl ?? null, input.active],
  );
}

export async function upsertService(
  db: Queryable,
  id: string,
  input: { name: string; detail: string; category: string; price: number; sacCode?: string | null; active: boolean; sortOrder: number },
) {
  if (!/^[a-z0-9_-]{1,40}$/.test(id)) throw badRequest("invalid_id", "Service ids are lowercase letters, digits, - and _");
  await db.query(
    `INSERT INTO service_catalog (id, name, detail, category, price, sac_code, active, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, detail = EXCLUDED.detail, category = EXCLUDED.category, price = EXCLUDED.price,
       sac_code = EXCLUDED.sac_code, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order`,
    [id, input.name, input.detail, input.category, input.price, input.sacCode ?? null, input.active, input.sortOrder],
  );
}

export async function upsertOffer(
  db: Queryable,
  id: string,
  input: {
    title: string;
    shortLabel: string;
    detail: string;
    discountAmount: number;
    firstBookingOnly: boolean;
    requiresServiceId?: string | null;
    requiresOtherService: boolean;
    validUntil?: string | null;
    active: boolean;
  },
) {
  if (!/^[a-z0-9_-]{1,40}$/.test(id)) throw badRequest("invalid_id", "Offer ids are lowercase letters, digits, - and _");
  await db.query(
    `INSERT INTO offers (id, title, short_label, detail, discount_amount, first_booking_only, requires_service_id, requires_other_service, valid_until, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, short_label = EXCLUDED.short_label, detail = EXCLUDED.detail,
       discount_amount = EXCLUDED.discount_amount, first_booking_only = EXCLUDED.first_booking_only, requires_service_id = EXCLUDED.requires_service_id,
       requires_other_service = EXCLUDED.requires_other_service, valid_until = EXCLUDED.valid_until, active = EXCLUDED.active`,
    [id, input.title, input.shortLabel, input.detail, input.discountAmount, input.firstBookingOnly, input.requiresServiceId ?? null,
      input.requiresOtherService, input.validUntil ?? null, input.active],
  );
}
