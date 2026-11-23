import { loadConfig } from "../src/config.js";
import { describeError } from "../src/errors.js";
import { createPool } from "../src/db.js";
import { seed } from "../src/migrations.js";

const sets = process.argv.slice(2).filter((arg): arg is "reference" | "demo" => arg === "reference" || arg === "demo");
const config = loadConfig();
if (sets.includes("demo") && config.isProduction) {
  console.error("Refusing to load the demo customer with NODE_ENV=production.");
  process.exit(1);
}
const db = createPool(config);
try {
  await seed(db, config.DB_SCHEMA, sets.length ? sets : ["reference"]);
} catch (error) {
  console.error(describeError(error));
  process.exitCode = 1;
} finally {
  await db.end();
}
