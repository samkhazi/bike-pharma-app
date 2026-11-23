/**
 * Checks that the database in DATABASE_URL / DB_SCHEMA has every table and column the API uses.
 *
 * It builds a throwaway reference copy of the schema from db/migrations inside a transaction, compares
 * information_schema for both, then rolls back. Nothing is written. Views count as tables, so this also
 * validates a compatibility layer of views mapped onto an existing database (see docs/03-connecting-your-database.md).
 */
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { describeError } from "../src/errors.js";
import { applyRawMigrations, quoteIdent } from "../src/migrations.js";

type Column = { table_name: string; column_name: string; data_type: string };

const config = loadConfig();
const db = createPool(config);
const client = await db.connect();
const reference = `bs_schema_check_${process.pid}`;
let missing = 0;

try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA ${quoteIdent(reference)}`);
  await client.query(`SET LOCAL search_path TO ${quoteIdent(reference)}, public`);
  await applyRawMigrations(client);
  const columns = async (schema: string) =>
    (await client.query<Column>(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position",
      [schema],
    )).rows;
  const expected = await columns(reference);
  const actual = await columns(config.DB_SCHEMA);
  const sequences = (await client.query<{ sequence_name: string }>(
    "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = $1", [config.DB_SCHEMA])).rows.map((r) => r.sequence_name);
  await client.query("ROLLBACK");

  const actualByKey = new Map(actual.map((col) => [`${col.table_name}.${col.column_name}`, col]));
  const actualTables = new Set(actual.map((col) => col.table_name));
  const expectedTables = [...new Set(expected.map((col) => col.table_name))];
  const warnings: string[] = [];

  console.info(`Checking schema "${config.DB_SCHEMA}" against ${expectedTables.length} tables from db/migrations\n`);
  for (const table of expectedTables) {
    if (!actualTables.has(table)) {
      console.info(`  MISSING TABLE  ${table}`);
      missing += 1;
      continue;
    }
    const gaps: string[] = [];
    for (const col of expected.filter((c) => c.table_name === table)) {
      const found = actualByKey.get(`${table}.${col.column_name}`);
      if (!found) gaps.push(col.column_name);
      else if (found.data_type !== col.data_type) warnings.push(`${table}.${col.column_name} is ${found.data_type}, expected ${col.data_type}`);
    }
    if (gaps.length) {
      console.info(`  MISSING COLUMNS ${table}: ${gaps.join(", ")}`);
      missing += gaps.length;
    } else {
      console.info(`  ok             ${table}`);
    }
  }
  if (!sequences.includes("job_card_number_seq")) {
    console.info("  MISSING SEQUENCE job_card_number_seq");
    missing += 1;
  }
  if (warnings.length) {
    console.info("\nType differences (usually fine if the values convert):");
    for (const warning of warnings) console.info(`  ${warning}`);
  }
  console.info(missing ? `\n${missing} missing object(s). The API will fail on the routes that use them.` : "\nAll tables and columns are present.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(describeError(error));
  missing = 1;
} finally {
  client.release();
  await db.end();
}
process.exitCode = missing ? 1 : 0;
