import { createHmac } from "node:crypto";
import type { Config } from "./config.js";
import { many, one, tx, type Db } from "./db.js";
import type { Providers } from "./providers.js";

const BATCH = 25;
const MAX_BACKOFF_SECONDS = 3600;

/** HMAC-SHA256 over "<timestamp>.<raw body>", sent as X-BikeSurgeon-Signature: t=<timestamp>,v1=<hex>. */
export function signWebhook(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export async function deliverWebhooks(db: Db, config: Config) {
  if (!config.WEBHOOK_URL || !config.WEBHOOK_SECRET) return 0;
  return tx(db, async (client) => {
    // One deliverer at a time, so several API instances cannot send events out of order.
    const lock = await one<{ locked: boolean }>(client, "SELECT pg_try_advisory_xact_lock(727001) AS locked");
    if (!lock?.locked) return 0;
    // The oldest undelivered event goes first. While it is waiting out a retry delay, nothing behind it is sent.
    const events = await many<{ id: number; event_type: string; entity_type: string; entity_id: string; payload: unknown; created_at: string; attempts: number; due: boolean }>(
      client,
      `SELECT id, event_type, entity_type, entity_id, payload, created_at, attempts, next_attempt_at <= now() AS due FROM integration_events
       WHERE delivered_at IS NULL ORDER BY id LIMIT $1`,
      [BATCH],
    );
    if (!events[0]?.due) return 0;
    let delivered = 0;
    for (const event of events) {
      const body = JSON.stringify({ id: event.id, type: event.event_type, entityType: event.entity_type, entityId: event.entity_id, createdAt: event.created_at, payload: event.payload });
      try {
        const response = await fetch(config.WEBHOOK_URL!, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-bikesurgeon-event": event.event_type,
            "x-bikesurgeon-delivery": String(event.id),
            "x-bikesurgeon-signature": signWebhook(config.WEBHOOK_SECRET!, body),
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await client.query("UPDATE integration_events SET delivered_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1", [event.id]);
        delivered += 1;
      } catch (error) {
        const backoff = Math.min(MAX_BACKOFF_SECONDS, 10 * 2 ** event.attempts);
        await client.query(
          "UPDATE integration_events SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + make_interval(secs => $3) WHERE id = $1",
          [event.id, String((error as Error).message ?? error).slice(0, 500), backoff],
        );
        // Keep delivery in order: stop at the first failure and retry from here next time.
        break;
      }
    }
    return delivered;
  });
}

async function deliverPush(db: Db, config: Config, providers: Providers) {
  if (config.PUSH_PROVIDER === "none") return 0;
  const pending = await many<{ id: string; customer_id: string; title: string; body: string; target_screen: string | null; job_card_id: string | null }>(
    db,
    `SELECT id, customer_id, title, body, target_screen, job_card_id FROM notifications
     WHERE pushed_at IS NULL AND created_at > now() - interval '1 day' ORDER BY created_at LIMIT $1`,
    [BATCH],
  );
  for (const notice of pending) {
    const tokens = await many<{ provider: string; token: string }>(db, "SELECT provider, token FROM device_tokens WHERE customer_id = $1", [notice.customer_id]);
    try {
      await providers.push.send(
        { customerId: notice.customer_id, tokens },
        { title: notice.title, body: notice.body, data: { notificationId: notice.id, screen: notice.target_screen ?? "", jobCardId: notice.job_card_id ?? "" } },
      );
      await db.query("UPDATE notifications SET pushed_at = now() WHERE id = $1", [notice.id]);
    } catch (error) {
      console.error(`[push] ${notice.id}: ${(error as Error).message}`);
    }
  }
  return pending.length;
}

export function startWorker(db: Db, config: Config, providers: Providers) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await deliverWebhooks(db, config);
      await deliverPush(db, config, providers);
    } catch (error) {
      console.error("[worker]", error);
    } finally {
      running = false;
    }
  }, config.WORKER_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
