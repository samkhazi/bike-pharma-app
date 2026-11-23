import { many, type Queryable } from "../db.js";

/**
 * Every event a CRM/ERP can receive, by webhook or by polling GET /integration/v1/events.
 * Events are written in the same transaction as the change, so a committed change always has its event.
 */
export const EVENT_TYPES = [
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "vehicle.created",
  "vehicle.updated",
  "vehicle.archived",
  "booking.created",
  "booking.cancelled",
  "job_card.status_changed",
  "job_card.assigned",
  "job_card.extra_raised",
  "job_card.extra_decided",
  "job_card.media_added",
  "job_card.closed",
  "job_card.pay_at_delivery",
  "payment.pending",
  "payment.succeeded",
  "payment.failed",
  "invoice.paid",
  "review.submitted",
  "wallet.transaction",
  "referral.rewarded",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export async function emit(db: Queryable, type: EventType, entityType: string, entityId: string, payload: unknown) {
  await db.query(
    "INSERT INTO integration_events (event_type, entity_type, entity_id, payload) VALUES ($1, $2, $3, $4)",
    [type, entityType, entityId, JSON.stringify(payload)],
  );
}

type EventRow = { id: number; event_type: string; entity_type: string; entity_id: string; payload: unknown; created_at: string };

export async function listEvents(db: Queryable, after: number, limit: number, types?: string[]) {
  const rows = await many<EventRow>(
    db,
    `SELECT id, event_type, entity_type, entity_id, payload, created_at FROM integration_events
     WHERE id > $1 AND ($3::text[] IS NULL OR event_type = ANY($3))
     ORDER BY id LIMIT $2`,
    [after, limit, types?.length ? types : null],
  );
  const items = rows.map((row) => ({
    id: row.id,
    type: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    createdAt: row.created_at,
  }));
  return { items, nextAfter: items.length ? items[items.length - 1].id : null };
}
