import pg from "pg";

// numeric and int8 arrive as strings by default; money here fits comfortably in a double.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
// Calendar dates stay as YYYY-MM-DD so they never shift with the server time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
const parseTimestamp = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => (parseTimestamp(value) as Date).toISOString());

export type Db = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

export type DbOptions = {
  DATABASE_URL: string;
  DB_SCHEMA: string;
  DB_POOL_MAX: number;
  DB_SSL: "off" | "require" | "no-verify";
};

export function createPool(options: DbOptions): Db {
  const ssl = options.DB_SSL === "off" ? undefined : { rejectUnauthorized: options.DB_SSL === "require" };
  return new pg.Pool({
    connectionString: options.DATABASE_URL,
    max: options.DB_POOL_MAX,
    ssl,
    options: `-c search_path=${options.DB_SCHEMA},public`,
    application_name: "bike-surgeon-api",
  });
}

export async function many<T>(db: Queryable, text: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(text, params);
  return result.rows as T[];
}

export async function one<T>(db: Queryable, text: string, params: unknown[] = []): Promise<T | undefined> {
  const result = await db.query(text, params);
  return result.rows[0] as T | undefined;
}

export async function tx<T>(db: Db, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown, constraint?: string) {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === "23505" && (!constraint || pgError.constraint === constraint);
}
