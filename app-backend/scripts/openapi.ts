/** Writes openapi.json from the route definitions. No database connection is made. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, openApiDocument } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { BACKEND_ROOT } from "../src/migrations.js";
import { createProviders } from "../src/providers.js";

const config = loadConfig({
  DATABASE_URL: "postgres://unused@localhost/unused",
  JWT_SECRET: "openapi-generation-only-not-a-real-secret",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "https://api.example.com",
});
const db = createPool(config);
const app = createApp({ db, config, providers: createProviders(config) });
const document = app.getOpenAPI31Document(openApiDocument(config));
const target = join(BACKEND_ROOT, "openapi.json");
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
await db.end();
console.info(`wrote ${target} (${Object.keys(document.paths ?? {}).length} paths)`);
