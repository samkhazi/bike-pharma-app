import { many, one, type Queryable } from "../db.js";

export type NotificationKind = "confirmation" | "update" | "reminder" | "rescheduled" | "cancelled" | "payment" | "offer";

export async function notify(
  db: Queryable,
  input: { customerId: string; kind: NotificationKind; title: string; body: string; jobCardId?: string | null; targetScreen?: string | null },
) {
  const row = await one<{ id: string }>(
    db,
    `INSERT INTO notifications (customer_id, job_card_id, kind, title, body, target_screen)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.customerId, input.jobCardId ?? null, input.kind, input.title, input.body, input.targetScreen ?? null],
  );
  return row!.id;
}

type Row = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  job_card_id: string | null;
  booking_number: string | null;
  vehicle_label: string | null;
  target_screen: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(db: Queryable, customerId: string) {
  const rows = await many<Row>(
    db,
    `SELECT n.id, n.kind, n.title, n.body, n.job_card_id, jc.number AS booking_number,
            CASE WHEN v.id IS NULL THEN NULL ELSE v.model END AS vehicle_label,
            n.target_screen, n.read_at, n.created_at
     FROM notifications n
     LEFT JOIN job_cards jc ON jc.id = n.job_card_id
     LEFT JOIN vehicles v ON v.id = jc.vehicle_id
     WHERE n.customer_id = $1
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [customerId],
  );
  const items = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    jobCardId: row.job_card_id,
    bookingNumber: row.booking_number,
    vehicleLabel: row.vehicle_label,
    targetScreen: row.target_screen,
    read: row.read_at !== null,
    createdAt: row.created_at,
  }));
  return { unread: items.filter((item) => !item.read).length, items };
}

export async function markRead(db: Queryable, customerId: string, ids?: string[]) {
  await db.query(
    `UPDATE notifications SET read_at = now()
     WHERE customer_id = $1 AND read_at IS NULL AND ($2::uuid[] IS NULL OR id = ANY($2))`,
    [customerId, ids?.length ? ids : null],
  );
}
