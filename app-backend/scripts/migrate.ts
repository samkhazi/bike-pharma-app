import { loadConfig } from "../src/config.js";
import { describeError } from "../src/errors.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrations.js";

const config = loadConfig();
const db = createPool(config);
try {
  await migrate(db, config.DB_SCHEMA);
} catch (error) {
  console.error(describeError(error));
  process.exitCode = 1;
} finally {
  await db.end();
}
