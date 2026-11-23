import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { createProviders } from "./providers.js";
import { startWorker } from "./worker.js";

const config = loadConfig();
const db = createPool(config);
const providers = createProviders(config);
const app = createApp({ db, config, providers });
const stopWorker = startWorker(db, config, providers);

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.info(`Bike Surgeon API on http://localhost:${info.port} (schema "${config.DB_SCHEMA}", docs at /docs)`);
});

function shutdown(signal: string) {
  console.info(`${signal} received, shutting down`);
  stopWorker();
  server.close(() => {
    db.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
