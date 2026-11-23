import type { Config } from "../config.js";
import type { Db } from "../db.js";
import { createOldDb } from "./old-db.js";
import { startBridge, type BridgeDeps } from "./sync.js";

/** Builds the bridge from the settings in .env. Returns a stop function (a no-op when BRIDGE=off). */
export function bridgeFromConfig(db: Db, config: Config): BridgeDeps | null {
  if (config.BRIDGE !== "on") return null;
  const old = config.OLD_DB_USER
    ? createOldDb({
        host: config.OLD_DB_HOST,
        port: config.OLD_DB_PORT,
        user: config.OLD_DB_USER,
        password: config.OLD_DB_PASS ?? "",
        database: config.OLD_DB_BS,
        publicKey: config.OLD_DB_PUBKEY === "1",
        bin: config.MYSQL_BIN,
        writeUser: config.OLD_DB_WRITE_USER,
        writePassword: config.OLD_DB_WRITE_PASS,
      })
    : null;
  const inventory = config.INVENTORY_URL && config.INVENTORY_FEED_KEY
    ? { url: config.INVENTORY_URL, feedKey: config.INVENTORY_FEED_KEY, store: config.INVENTORY_STORE, portal: "desk" }
    : null;
  return { db, config, old, inventory, log: (line) => console.info(line) };
}

export function startBridgeFromConfig(db: Db, config: Config) {
  const deps = bridgeFromConfig(db, config);
  if (!deps) return () => {};
  console.info(`[bridge] on: old billing ${deps.old ? "linked" : "not set"}, Inventory ${deps.inventory ? "linked" : "not set"}, every ${config.BRIDGE_INTERVAL_MS / 1000}s`);
  return startBridge(deps);
}
