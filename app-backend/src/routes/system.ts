import { createRoute, z } from "@hono/zod-openapi";
import { verifyCameraToken } from "../auth.js";
import { one } from "../db.js";
import { CAMERA_STATUSES, type JobStatus } from "../domain.js";
import { AppError, describeError } from "../errors.js";
import { json, type App, type Deps } from "./shared.js";

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

export function registerSystemRoutes(app: App, { db, config }: Deps) {
  app.openapi(
    createRoute({
      method: "get", path: "/health", tags: ["System"], summary: "Liveness: the process is up",
      responses: { 200: json(z.object({ status: z.literal("ok") }), "Up") },
    }),
    (c) => c.json({ status: "ok" as const }, 200),
  );

  app.openapi(
    createRoute({
      method: "get", path: "/health/ready", tags: ["System"], summary: "Readiness: the database is reachable and migrated",
      responses: {
        200: json(z.object({ status: z.literal("ready"), schema: z.string(), migration: z.string() }), "Ready"),
        503: json(z.object({ status: z.literal("unavailable"), reason: z.string() }), "Not ready"),
      },
    }),
    async (c) => {
      try {
        const row = await one<{ name: string }>(db, "SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1");
        if (!row) return c.json({ status: "unavailable" as const, reason: "No migrations applied. Run npm run db:migrate." }, 503);
        return c.json({ status: "ready" as const, schema: config.DB_SCHEMA, migration: row.name }, 200);
      } catch (error) {
        return c.json({ status: "unavailable" as const, reason: describeError(error) }, 503);
      }
    },
  );

  // Camera proxy. The token in the path is short-lived and scoped to one job card, so a <video> or HLS player
  // can load the stream and every segment without headers. Access ends as soon as the job leaves the bay.
  app.get("/v1/camera/:token/*", async (c) => {
    const token = c.req.param("token");
    const jobCardId = await verifyCameraToken(config, token);
    const row = await one<{ status: JobStatus; camera_stream_url: string | null; camera_paused: boolean }>(
      db,
      "SELECT jc.status, jc.camera_paused, b.camera_stream_url FROM job_cards jc JOIN bays b ON b.id = jc.bay_id WHERE jc.id = $1",
      [jobCardId],
    );
    if (!row?.camera_stream_url || row.camera_paused || !CAMERA_STATUSES.includes(row.status)) {
      throw new AppError(403, "camera_unavailable", "The camera is available while your bike is in a bay");
    }
    const upstreamBase = new URL(row.camera_stream_url);
    const rest = c.req.path.slice(`/v1/camera/${token}/`.length);
    const target = new URL(rest, upstreamBase);
    const directory = upstreamBase.pathname.slice(0, upstreamBase.pathname.lastIndexOf("/") + 1);
    if (target.origin !== upstreamBase.origin || !target.pathname.startsWith(directory)) {
      throw new AppError(400, "invalid_path", "Outside the camera stream");
    }
    target.search = new URL(c.req.url).search;
    const range = c.req.header("range");
    const upstream = await fetch(target, { headers: range ? { range } : {}, signal: c.req.raw.signal });
    const headers = new Headers({ "cache-control": "no-store" });
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  });
}
