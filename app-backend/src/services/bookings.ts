import type pg from "pg";
import type { Config } from "../config.js";
import { isUniqueViolation, many, one, tx, type Db, type Queryable } from "../db.js";
import { CAMERA_STATUSES, CANCELLABLE_BY_CUSTOMER, money, stageOf, STATUS_MESSAGES, type JobStatus } from "../domain.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { getInvoice, issueInvoice } from "./billing.js";
import { rewardReferralIfDue } from "./customers.js";
import { emit } from "./events.js";
import { notify } from "./notifications.js";
import { decodeCursor, pageOf } from "./paging.js";

type BookingRow = {
  id: string;
  number: string;
  customer_id: string;
  vehicle_id: string;
  status: JobStatus;
  mode: "pickup" | "visit";
  source: "app" | "walk_in" | "phone" | "erp";
  slot_start: string;
  slot_end: string;
  promised_ready_at: string | null;
  offer_id: string | null;
  package_subtotal: number;
  discount_amount: number;
  estimate_amount: number;
  pay_at_delivery: boolean;
  odometer_km_at_intake: number | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  v_make: string;
  v_model: string;
  v_reg: string;
  c_phone: string;
  c_name: string;
  bay_code: string | null;
  bay_name: string | null;
  bay_has_camera: boolean | null;
  advisor_name: string | null;
  advisor_phone: string | null;
  mechanic_name: string | null;
  mechanic_phone: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  a_id: string | null;
  a_label: string | null;
  a_area: string | null;
  a_line: string | null;
  a_landmark: string | null;
  a_contact_name: string | null;
  a_contact_phone: string | null;
  a_latitude: number | null;
  a_longitude: number | null;
  invoice_id: string | null;
  invoice_status: "open" | "paid" | "void" | null;
};

const BASE_SELECT = `
  SELECT jc.*,
    v.make AS v_make, v.model AS v_model, v.registration_number AS v_reg,
    c.phone AS c_phone, c.name AS c_name,
    b.code AS bay_code, b.name AS bay_name, (b.camera_stream_url IS NOT NULL) AS bay_has_camera,
    adv.name AS advisor_name, adv.phone AS advisor_phone,
    mec.name AS mechanic_name, mec.phone AS mechanic_phone,
    rid.name AS rider_name, rid.phone AS rider_phone,
    ca.id AS a_id, ca.label AS a_label, ca.area AS a_area, ca.line AS a_line, ca.landmark AS a_landmark,
    ca.contact_name AS a_contact_name, ca.contact_phone AS a_contact_phone, ca.latitude AS a_latitude, ca.longitude AS a_longitude,
    i.id AS invoice_id, i.status AS invoice_status
  FROM job_cards jc
  JOIN vehicles v ON v.id = jc.vehicle_id
  JOIN customers c ON c.id = jc.customer_id
  LEFT JOIN bays b ON b.id = jc.bay_id
  LEFT JOIN staff adv ON adv.id = jc.advisor_id
  LEFT JOIN staff mec ON mec.id = jc.mechanic_id
  LEFT JOIN staff rid ON rid.id = jc.rider_id
  LEFT JOIN customer_addresses ca ON ca.id = jc.pickup_address_id
  LEFT JOIN invoices i ON i.job_card_id = jc.id AND i.status <> 'void'`;

type ExtraRow = {
  id: string;
  job_card_id: string;
  part_name: string;
  note: string;
  amount: number;
  status: "pending" | "approved" | "declined";
  raised_by_label: string | null;
  raised_by_name: string | null;
  decided_at: string | null;
  decided_via: "app" | "advisor" | "integration" | null;
};

const person = (name: string | null, phone: string | null) => (name ? { name, phone } : null);

async function hydrate(db: Queryable, rows: BookingRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  // Sequential on purpose: this may run on a transaction client, which runs one query at a time.
  const services = await many<{ job_card_id: string; service_id: string; name: string; price: number }>(
      db, "SELECT job_card_id, service_id, name, price FROM job_card_services WHERE job_card_id = ANY($1) ORDER BY name", [ids]);
  const extras = await many<ExtraRow>(
      db,
      `SELECT e.*, s.name AS raised_by_name FROM job_card_extras e LEFT JOIN staff s ON s.id = e.raised_by_staff_id
       WHERE e.job_card_id = ANY($1) ORDER BY e.created_at`, [ids]);
  const history = await many<{ job_card_id: string; to_status: JobStatus; created_at: string; note: string | null }>(
      db, "SELECT job_card_id, to_status, created_at, note FROM job_card_status_history WHERE job_card_id = ANY($1) ORDER BY created_at, id", [ids]);
  const media = await many<{ id: string; job_card_id: string; kind: "photo" | "video" | "note"; url: string | null; caption: string; created_at: string }>(
      db, "SELECT id, job_card_id, kind, url, caption, created_at FROM job_card_media WHERE job_card_id = ANY($1) ORDER BY created_at", [ids]);

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    stage: stageOf(row.status),
    mode: row.mode,
    source: row.source,
    vehicle: { id: row.vehicle_id, make: row.v_make, model: row.v_model, registrationNumber: row.v_reg },
    services: services.filter((s) => s.job_card_id === row.id).map((s) => ({ id: s.service_id, name: s.name, price: s.price })),
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    promisedReadyAt: row.promised_ready_at,
    pickupAddress: row.a_id
      ? {
          id: row.a_id,
          label: row.a_label!,
          area: row.a_area!,
          line: row.a_line!,
          landmark: row.a_landmark,
          contactName: row.a_contact_name,
          contactPhone: row.a_contact_phone,
          latitude: row.a_latitude,
          longitude: row.a_longitude,
        }
      : null,
    bay: row.bay_code ? { code: row.bay_code, name: row.bay_name! } : null,
    advisor: person(row.advisor_name, row.advisor_phone),
    mechanic: person(row.mechanic_name, row.mechanic_phone),
    rider: person(row.rider_name, row.rider_phone),
    offerId: row.offer_id,
    packageSubtotal: row.package_subtotal,
    discountAmount: row.discount_amount,
    estimateAmount: row.estimate_amount,
    payAtDelivery: row.pay_at_delivery,
    paid: row.invoice_status === "paid",
    invoiceId: row.invoice_id,
    cameraAvailable: CAMERA_STATUSES.includes(row.status) && Boolean(row.bay_has_camera),
    extras: extras.filter((e) => e.job_card_id === row.id).map((e) => ({
      id: e.id,
      partName: e.part_name,
      note: e.note,
      amount: e.amount,
      status: e.status,
      raisedBy: e.raised_by_label ?? e.raised_by_name,
      decidedAt: e.decided_at,
      decidedVia: e.decided_via,
    })),
    timeline: history.filter((h) => h.job_card_id === row.id).map((h) => ({ status: h.to_status, at: h.created_at, note: h.note })),
    media: media.filter((m) => m.job_card_id === row.id).map((m) => ({ id: m.id, kind: m.kind, url: m.url, caption: m.caption, createdAt: m.created_at })),
    customerNote: row.customer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    customer: { id: row.customer_id, phone: row.c_phone, name: row.c_name },
  }));
}

export type BookingDto = Awaited<ReturnType<typeof hydrate>>[number];

/** The customer-facing shape: identical to the integration shape minus the customer block. */
export function forCustomer({ customer: _customer, ...booking }: BookingDto) {
  return booking;
}

export async function listBookings(db: Queryable, customerId: string, vehicleId?: string) {
  const rows = await many<BookingRow>(
    db,
    `${BASE_SELECT} WHERE jc.customer_id = $1 AND ($2::uuid IS NULL OR jc.vehicle_id = $2) ORDER BY jc.slot_start DESC LIMIT 200`,
    [customerId, vehicleId ?? null],
  );
  return hydrate(db, rows);
}

export async function listBookingsUpdatedSince(db: Queryable, page: { since: string | null; cursor?: string }, limit: number, status?: JobStatus) {
  const after = decodeCursor(page.cursor);
  const rows = await many<BookingRow>(
    db,
    `${BASE_SELECT} WHERE ($1::timestamptz IS NULL OR jc.updated_at > $1)
       AND ($4::timestamptz IS NULL OR (jc.updated_at, jc.id) > ($4::timestamptz, $5::uuid))
       AND ($3::text IS NULL OR jc.status = $3)
     ORDER BY jc.updated_at, jc.id LIMIT $2`,
    [page.since, limit, status ?? null, after?.ts ?? null, after?.id ?? null],
  );
  return pageOf(db, "job_cards", await hydrate(db, rows), limit);
}

export async function getBooking(db: Queryable, id: string, customerId: string | null) {
  const row = await one<BookingRow>(db, `${BASE_SELECT} WHERE jc.id = $1 AND ($2::uuid IS NULL OR jc.customer_id = $2)`, [id, customerId]);
  if (!row) throw notFound("Booking");
  return (await hydrate(db, [row]))[0];
}

/** Integrations address job cards by number (BS-2026-000124) or by id. */
export async function getBookingByRef(db: Queryable, ref: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  const row = await one<BookingRow>(db, `${BASE_SELECT} WHERE ${isUuid ? "jc.id = $1::uuid" : "jc.number = $1"}`, [ref]);
  if (!row) throw notFound("Job card");
  return (await hydrate(db, [row]))[0];
}

async function lockJobCard(client: pg.PoolClient, id: string) {
  const row = await one<{ id: string; status: JobStatus; customer_id: string }>(
    client, "SELECT id, status, customer_id FROM job_cards WHERE id = $1 FOR UPDATE", [id]);
  if (!row) throw notFound("Job card");
  return row;
}

async function touch(client: Queryable, id: string) {
  await client.query("UPDATE job_cards SET updated_at = now() WHERE id = $1", [id]);
}

async function workshopFor(db: Queryable, config: Config) {
  const workshop = await one<{ id: string }>(db, "SELECT id FROM workshops WHERE code = $1", [config.WORKSHOP_CODE]);
  if (!workshop) throw new Error(`Workshop ${config.WORKSHOP_CODE} is missing. Run npm run db:seed or create it.`);
  const advisor = await one<{ id: string }>(
    db, "SELECT id FROM staff WHERE workshop_id = $1 AND role = 'advisor' AND active ORDER BY created_at LIMIT 1", [workshop.id]);
  return { workshopId: workshop.id, advisorId: advisor?.id ?? null };
}

function slotLabel(slotStart: string, slotEnd: string, timeZone: string) {
  const day = new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short" }).format(new Date(slotStart));
  const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(":00", "").toUpperCase();
  return `${day}, ${time(slotStart)}–${time(slotEnd)}`;
}

type CreateInput = {
  vehicleId: string;
  serviceIds: string[];
  mode: "pickup" | "visit";
  slotStart: string;
  slotEnd: string;
  pickupAddressId?: string | null;
  offerId?: string | null;
  note?: string | null;
};

export async function createBooking(db: Db, config: Config, customerId: string, input: CreateInput, source: BookingRow["source"] = "app") {
  const id = await tx(db, async (client) => {
    const vehicle = await one<{ id: string; model: string }>(
      client, "SELECT id, model FROM vehicles WHERE id = $1 AND customer_id = $2 AND archived_at IS NULL", [input.vehicleId, customerId]);
    if (!vehicle) throw notFound("Vehicle");

    const serviceIds = [...new Set(input.serviceIds)];
    const services = await many<{ id: string; name: string; price: number }>(
      client, "SELECT id, name, price FROM service_catalog WHERE id = ANY($1) AND active", [serviceIds]);
    if (services.length !== serviceIds.length) {
      const missing = serviceIds.filter((sid) => !services.some((s) => s.id === sid));
      throw badRequest("unknown_service", `Unknown or inactive service: ${missing.join(", ")}`);
    }

    const start = new Date(input.slotStart);
    const end = new Date(input.slotEnd);
    if (!(end > start)) throw badRequest("invalid_slot", "The slot must end after it starts");
    if (source === "app" && end.getTime() < Date.now()) throw badRequest("invalid_slot", "That slot has already passed");

    let addressId: string | null = null;
    if (input.mode === "pickup") {
      if (!input.pickupAddressId) {
        if (source === "app") throw badRequest("address_required", "Choose where the rider should collect the bike");
      } else {
        const address = await one<{ id: string }>(
          client, "SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL", [input.pickupAddressId, customerId]);
        if (!address) throw notFound("Address");
        addressId = address.id;
      }
    }

    const subtotal = money(services.reduce((sum, s) => sum + s.price, 0));
    let discount = 0;
    if (input.offerId) {
      const offer = await one<{ id: string; discount_amount: number; first_booking_only: boolean; requires_service_id: string | null; requires_other_service: boolean }>(
        client,
        "SELECT * FROM offers WHERE id = $1 AND active AND (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE $2)::date)",
        [input.offerId, config.TIMEZONE],
      );
      if (!offer) throw badRequest("offer_unavailable", "That offer has ended");
      if (offer.first_booking_only) {
        const prior = await one<{ n: number }>(client, "SELECT count(*) AS n FROM job_cards WHERE customer_id = $1 AND status <> 'cancelled'", [customerId]);
        if (prior && prior.n > 0) throw badRequest("offer_unavailable", "That offer is for your first service");
      }
      if (offer.requires_service_id && !serviceIds.includes(offer.requires_service_id)) {
        throw badRequest("offer_unavailable", "That offer needs a service you have not picked");
      }
      if (offer.requires_other_service && serviceIds.length < 2) throw badRequest("offer_unavailable", "That offer needs another service with it");
      discount = Math.min(offer.discount_amount, subtotal);
    }

    const { workshopId, advisorId } = await workshopFor(client, config);
    const numbered = await one<{ number: string }>(
      client,
      "SELECT 'BS-' || to_char(now() AT TIME ZONE $1, 'YYYY') || '-' || lpad(nextval('job_card_number_seq')::text, 6, '0') AS number",
      [config.TIMEZONE],
    );

    let created: { id: string } | undefined;
    try {
      await client.query("SAVEPOINT create_job_card");
      created = await one<{ id: string }>(
        client,
        `INSERT INTO job_cards (number, workshop_id, customer_id, vehicle_id, mode, source, pickup_address_id, slot_start, slot_end,
                                advisor_id, offer_id, package_subtotal, discount_amount, estimate_amount, customer_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [numbered!.number, workshopId, customerId, vehicle.id, input.mode, source, addressId, input.slotStart, input.slotEnd,
          advisorId, discount > 0 ? input.offerId : null, subtotal, discount, money(subtotal - discount), input.note ?? null],
      );
      await client.query("RELEASE SAVEPOINT create_job_card");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT create_job_card");
      if (isUniqueViolation(error, "job_cards_one_open_per_vehicle")) throw conflict("vehicle_has_open_booking", "This bike already has an open booking");
      throw error;
    }
    const jobCardId = created!.id;
    for (const service of services) {
      await client.query("INSERT INTO job_card_services (job_card_id, service_id, name, price) VALUES ($1, $2, $3, $4)", [jobCardId, service.id, service.name, service.price]);
    }
    await client.query(
      "INSERT INTO job_card_status_history (job_card_id, from_status, to_status, source) VALUES ($1, NULL, 'booked', $2)",
      [jobCardId, source === "app" ? "app" : "integration"],
    );
    const when = slotLabel(input.slotStart, input.slotEnd, config.TIMEZONE);
    await notify(client, {
      customerId,
      jobCardId,
      kind: "confirmation",
      title: "You’re booked",
      body: `${services.map((s) => s.name).join(" and ")}. ${input.mode === "pickup" ? "Pickup" : "Workshop visit"} ${when}.`,
      targetScreen: "Track + live view",
    });
    const booking = await getBooking(client, jobCardId, null);
    await emit(client, "booking.created", "job_card", jobCardId, { booking });
    return jobCardId;
  });
  return getBooking(db, id, null);
}

export async function cancelBooking(db: Db, customerId: string, id: string, reason?: string) {
  await tx(db, async (client) => {
    const job = await lockJobCard(client, id);
    if (job.customer_id !== customerId) throw notFound("Booking");
    if (!CANCELLABLE_BY_CUSTOMER.includes(job.status)) throw conflict("not_cancellable", "The bike is already with the workshop. Call the advisor to cancel.");
    await applyStatus(client, id, job.status, "cancelled", { source: "app", note: reason ?? null, cancelReason: reason ?? "Cancelled by customer" });
  });
  return getBooking(db, id, customerId);
}

export async function decideExtras(db: Db, customerId: string | null, jobCardId: string, extraIds: string[] | "all-pending", approve: boolean, via: "app" | "advisor" | "integration") {
  await tx(db, async (client) => {
    const job = await lockJobCard(client, jobCardId);
    if (customerId && job.customer_id !== customerId) throw notFound("Booking");
    if (["job_closed", "delivered", "cancelled"].includes(job.status)) throw conflict("job_closed", "This job card is closed");
    const updated = await many<{ id: string; part_name: string; amount: number; status: string }>(
      client,
      `UPDATE job_card_extras SET status = $3, decided_at = now(), decided_via = $4
       WHERE job_card_id = $1 AND status = 'pending' AND ($2::uuid[] IS NULL OR id = ANY($2))
       RETURNING id, part_name, amount, status`,
      [jobCardId, extraIds === "all-pending" ? null : extraIds, approve ? "approved" : "declined", via],
    );
    if (extraIds !== "all-pending" && updated.length !== extraIds.length) throw conflict("already_decided", "That part already has a decision");
    await touch(client, jobCardId);
    for (const extra of updated) {
      await emit(client, "job_card.extra_decided", "job_card", jobCardId, { jobCardId, extra: { id: extra.id, partName: extra.part_name, amount: extra.amount, status: extra.status }, via });
    }
  });
  return getBooking(db, jobCardId, customerId);
}

export async function setPayAtDelivery(db: Db, customerId: string, jobCardId: string) {
  await tx(db, async (client) => {
    const job = await lockJobCard(client, jobCardId);
    if (job.customer_id !== customerId) throw notFound("Booking");
    if (job.status === "cancelled" || job.status === "delivered") throw conflict("job_closed", "This booking is finished");
    await client.query("UPDATE job_cards SET pay_at_delivery = true WHERE id = $1", [jobCardId]);
    await emit(client, "job_card.pay_at_delivery", "job_card", jobCardId, { jobCardId, customerId });
  });
  return getBooking(db, jobCardId, customerId);
}

// ---------------------------------------------------------------------------
// Workshop-side operations, called by the integration API
// ---------------------------------------------------------------------------

async function staffId(db: Queryable, code: string | null | undefined, role?: string) {
  if (code === null || code === undefined) return code;
  const row = await one<{ id: string }>(db, "SELECT id FROM staff WHERE code = $1 AND ($2::text IS NULL OR role = $2)", [code, role ?? null]);
  if (!row) throw badRequest("unknown_staff", `No ${role ?? "staff member"} with code ${code}`);
  return row.id;
}

async function applyStatus(
  client: pg.PoolClient,
  jobCardId: string,
  from: JobStatus,
  to: JobStatus,
  options: { source: "app" | "integration" | "system"; note?: string | null; staffId?: string | null; cancelReason?: string | null; gstRate?: number; declinePendingExtras?: boolean },
) {
  if ((to === "job_closed" || to === "delivered") && options.gstRate !== undefined) {
    const invoice = await one<{ id: string }>(client, "SELECT id FROM invoices WHERE job_card_id = $1 AND status <> 'void'", [jobCardId]);
    if (!invoice) await issueInvoice(client, jobCardId, options.gstRate, options.declinePendingExtras ?? false);
  }
  await client.query(
    `UPDATE job_cards SET status = $2,
       closed_at = CASE WHEN $2 IN ('job_closed', 'delivered') THEN COALESCE(closed_at, now()) ELSE closed_at END,
       delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END,
       cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END,
       cancel_reason = CASE WHEN $2 = 'cancelled' THEN $3 ELSE cancel_reason END
     WHERE id = $1`,
    [jobCardId, to, options.cancelReason ?? null],
  );
  await client.query(
    "INSERT INTO job_card_status_history (job_card_id, from_status, to_status, source, changed_by_staff_id, note) VALUES ($1, $2, $3, $4, $5, $6)",
    [jobCardId, from, to, options.source, options.staffId ?? null, options.note ?? null],
  );

  const booking = await getBooking(client, jobCardId, null);
  const bike = booking.vehicle.model;
  const message = STATUS_MESSAGES[to];
  let body = message.body(bike);
  if (to === "rider_assigned" && booking.rider) body = `${booking.rider.name} is coming to collect your ${bike}.`;
  if (to === "in_service" && booking.mechanic) body = `${booking.mechanic.name} is working on your ${bike}${booking.bay ? ` in ${booking.bay.name}` : ""}.${booking.cameraAvailable ? " The camera is live." : ""}`;
  await notify(client, {
    customerId: booking.customer.id,
    jobCardId,
    kind: to === "cancelled" ? "cancelled" : to === "job_closed" ? "payment" : "update",
    title: message.title,
    body,
    targetScreen: message.screen || null,
  });

  if (to === "delivered") {
    await client.query(
      `UPDATE vehicles v SET odometer_km = jc.odometer_km_at_intake, odometer_recorded_at = now(), odometer_source = 'workshop'
       FROM job_cards jc WHERE jc.id = $1 AND v.id = jc.vehicle_id AND jc.odometer_km_at_intake IS NOT NULL
         AND (v.odometer_km IS NULL OR v.odometer_km < jc.odometer_km_at_intake)`,
      [jobCardId],
    );
    await rewardReferralIfDue(client, booking.customer.id, jobCardId);
  }
  await emit(client, to === "cancelled" ? "booking.cancelled" : "job_card.status_changed", "job_card", jobCardId, { from, to, note: options.note ?? null, booking });
  if ((to === "job_closed" || (to === "delivered" && from !== "job_closed")) && booking.invoiceId) {
    await emit(client, "job_card.closed", "job_card", jobCardId, { booking, invoice: await getInvoice(client, booking.invoiceId, null) });
  }
}

export async function updateStatus(db: Db, config: Config, ref: string, input: { status: JobStatus; note?: string; staffCode?: string; force?: boolean }) {
  const { id } = await getBookingByRef(db, ref);
  await tx(db, async (client) => {
    const job = await lockJobCard(client, id);
    if (job.status === input.status) return;
    const finished = job.status === "delivered" || job.status === "cancelled";
    const backwards = input.status !== "cancelled" && stageOf(input.status) < stageOf(job.status);
    if ((finished || backwards) && !input.force) {
      throw conflict("invalid_transition", `Cannot move from ${job.status} to ${input.status} without force: true`);
    }
    await applyStatus(client, id, job.status, input.status, {
      source: "integration",
      note: input.note,
      staffId: await staffId(client, input.staffCode),
      cancelReason: input.status === "cancelled" ? input.note ?? "Cancelled by the workshop" : null,
      gstRate: config.GST_RATE,
    });
  });
  return getBookingByRef(db, id);
}

export async function assign(
  db: Db,
  config: Config,
  ref: string,
  input: { bayCode?: string | null; advisorCode?: string | null; mechanicCode?: string | null; riderCode?: string | null; promisedReadyAt?: string | null; slotStart?: string; slotEnd?: string; odometerKm?: number },
) {
  const { id } = await getBookingByRef(db, ref);
  await tx(db, async (client) => {
    const job = await lockJobCard(client, id);
    if (job.status === "delivered" || job.status === "cancelled") throw conflict("job_closed", "This job card is finished");
    let bayId: string | null | undefined = input.bayCode;
    if (input.bayCode) {
      const bay = await one<{ id: string }>(client, "SELECT id FROM bays WHERE code = $1", [input.bayCode]);
      if (!bay) throw badRequest("unknown_bay", `No bay with code ${input.bayCode}`);
      bayId = bay.id;
    }
    const sets: string[] = [];
    const params: unknown[] = [id];
    const set = (column: string, value: unknown) => {
      if (value === undefined) return;
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    set("bay_id", bayId);
    set("advisor_id", await staffId(client, input.advisorCode, "advisor"));
    set("mechanic_id", await staffId(client, input.mechanicCode, "mechanic"));
    set("rider_id", await staffId(client, input.riderCode, "rider"));
    set("promised_ready_at", input.promisedReadyAt);
    set("slot_start", input.slotStart);
    set("slot_end", input.slotEnd);
    set("odometer_km_at_intake", input.odometerKm);
    if (!sets.length) return;
    await client.query(`UPDATE job_cards SET ${sets.join(", ")} WHERE id = $1`, params);
    const booking = await getBooking(client, id, null);
    if (input.slotStart || input.slotEnd) {
      await notify(client, {
        customerId: booking.customer.id,
        jobCardId: id,
        kind: "rescheduled",
        title: booking.mode === "pickup" ? "Pickup moved" : "Visit moved",
        body: `Your ${booking.vehicle.model} is now booked for ${slotLabel(booking.slotStart, booking.slotEnd, config.TIMEZONE)}.`,
        targetScreen: "Track + live view",
      });
    }
    await emit(client, "job_card.assigned", "job_card", id, { changes: input, booking });
  });
  return getBookingByRef(db, id);
}

export async function raiseExtra(
  db: Db,
  ref: string,
  input: { partName: string; note: string; amount: number; raisedByStaffCode?: string; raisedByLabel?: string },
) {
  const { id } = await getBookingByRef(db, ref);
  await tx(db, async (client) => {
    const job = await lockJobCard(client, id);
    if (!["at_workshop", "in_service"].includes(job.status)) throw conflict("not_in_workshop", "Extra parts can only be raised while the bike is in the workshop");
    const extra = await one<{ id: string }>(
      client,
      `INSERT INTO job_card_extras (job_card_id, part_name, note, amount, raised_by_staff_id, raised_by_label)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [id, input.partName, input.note, input.amount, await staffId(client, input.raisedByStaffCode), input.raisedByLabel ?? null],
    );
    await touch(client, id);
    const pending = await one<{ n: number }>(client, "SELECT count(*) AS n FROM job_card_extras WHERE job_card_id = $1 AND status = 'pending'", [id]);
    const count = pending?.n ?? 1;
    await notify(client, {
      customerId: job.customer_id,
      jobCardId: id,
      kind: "update",
      title: count === 1 ? "A part needs your OK" : `${count} parts need your OK`,
      body: `${input.partName}, ₹${Math.round(input.amount).toLocaleString("en-IN")}. Nothing extra is fitted until you say yes.`,
      targetScreen: "Part approval",
    });
    await emit(client, "job_card.extra_raised", "job_card", id, { jobCardId: id, extra: { id: extra!.id, ...input } });
  });
  return getBookingByRef(db, id);
}

export async function addMedia(db: Db, ref: string, input: { kind: "photo" | "video" | "note"; url?: string | null; caption: string; notifyCustomer: boolean }) {
  const { id } = await getBookingByRef(db, ref);
  await tx(db, async (client) => {
    const job = await lockJobCard(client, id);
    const media = await one<{ id: string }>(
      client, "INSERT INTO job_card_media (job_card_id, kind, url, caption) VALUES ($1, $2, $3, $4) RETURNING id", [id, input.kind, input.url ?? null, input.caption]);
    await touch(client, id);
    if (input.notifyCustomer) {
      await notify(client, {
        customerId: job.customer_id,
        jobCardId: id,
        kind: "update",
        title: input.kind === "note" ? "A note from the bay" : "New photo from the bay",
        body: input.caption || "Open the booking to see it.",
        targetScreen: "Track + live view",
      });
    }
    await emit(client, "job_card.media_added", "job_card", id, { jobCardId: id, media: { id: media!.id, ...input } });
  });
  return getBookingByRef(db, id);
}

export async function closeJob(db: Db, config: Config, ref: string, input: { declinePendingExtras: boolean; note?: string }) {
  const { id } = await getBookingByRef(db, ref);
  await tx(db, async (client) => {
    const job = await lockJobCard(client, id);
    if (!["at_workshop", "in_service"].includes(job.status)) throw conflict("invalid_transition", `Cannot close a job card that is ${job.status}`);
    await applyStatus(client, id, job.status, "job_closed", {
      source: "integration",
      note: input.note,
      gstRate: config.GST_RATE,
      declinePendingExtras: input.declinePendingExtras,
    });
  });
  return getBookingByRef(db, id);
}
