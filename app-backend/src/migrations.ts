import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import type { Db } from "./db.js";
import { describeError } from "./errors.js";

/** Works from src/ (tsx) and from dist/src/ (compiled). */
export const BACKEND_ROOT = [new URL("..", import.meta.url), new URL("../..", import.meta.url)]
  .map((url) => fileURLToPath(url))
  .find((dir) => existsSync(join(dir, "db", "migrations")))!;

export const MIGRATIONS_DIR = join(BACKEND_ROOT, "db", "migrations");
export const SEEDS_DIR = join(BACKEND_ROOT, "db", "seeds");

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();
}

/** Runs the migration SQL directly, without bookkeeping. Used by db:check to build a reference copy of the schema. */
export async function applyRawMigrations(client: pg.PoolClient) {
  for (const file of migrationFiles()) await client.query(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
}

export async function migrate(db: Db, schema: string, log: (line: string) => void = console.info) {
  const client = await db.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('bike_surgeon_migrations'))");
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
    await client.query(`SET search_path TO ${quoteIdent(schema)}, public`);
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
    const pending = migrationFiles().filter((file) => !applied.has(file));
    for (const file of pending) {
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${describeError(error)}`);
      }
    }
    if (!pending.length) log(`schema "${schema}" is up to date`);
    return pending;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('bike_surgeon_migrations'))").catch(() => {});
    client.release();
  }
}

export async function seed(db: Db, schema: string, sets: ("reference" | "demo")[], log: (line: string) => void = console.info) {
  const prefixes = { reference: "01_", demo: "02_" };
  const files = readdirSync(SEEDS_DIR).filter((file) => sets.some((set) => file.startsWith(prefixes[set]))).sort();
  const client = await db.connect();
  try {
    await client.query(`SET search_path TO ${quoteIdent(schema)}, public`);
    for (const file of files) {
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(join(SEEDS_DIR, file), "utf8"));
        await client.query("COMMIT");
        log(`seeded ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Seed ${file} failed: ${describeError(error)}`);
      }
    }
  } finally {
    client.release();
  }
}
