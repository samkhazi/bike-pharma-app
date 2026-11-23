import { one, type Queryable } from "../db.js";
import { badRequest } from "../errors.js";

/**
 * Pull-sync paging. Rows are ordered by (updated_at, id) and the cursor carries both values at full
 * microsecond precision, so rows that share a timestamp are never skipped or repeated.
 */
export type Cursor = { ts: string; id: string };

export function decodeCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (ts && id && !Number.isNaN(Date.parse(ts)) && /^[0-9a-f-]{36}$/i.test(id)) return { ts, id };
  } catch {
    // fall through
  }
  throw badRequest("invalid_cursor", "cursor is not a value returned by this API");
}

export async function encodeCursor(db: Queryable, table: "job_cards" | "customers", id: string) {
  const row = await one<{ ts: string }>(
    db,
    `SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ts FROM ${table} WHERE id = $1`,
    [id],
  );
  return row ? Buffer.from(`${row.ts}|${id}`).toString("base64url") : null;
}

/** Shared page tail: the cursor is only returned when the page is full. */
export async function pageOf<T extends { id: string; updatedAt: string }>(db: Queryable, table: "job_cards" | "customers", items: T[], limit: number) {
  const last = items[items.length - 1];
  const full = items.length === limit && last;
  return { items, nextCursor: full ? await encodeCursor(db, table, last.id) : null, nextUpdatedSince: full ? last.updatedAt : null };
}
