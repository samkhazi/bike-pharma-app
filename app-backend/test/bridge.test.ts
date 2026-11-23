/**
 * The workshop bridge against a real MySQL with the old billing database's exact table layout
 * (test/fixtures/old-billing-schema.sql, from its dump) and made-up rows, plus a stand-in Inventory server.
 *
 * Needs MySQL and the mysql command line program:
 *   OLD_DB_TEST=1 OLD_DB_HOST=127.0.0.1 OLD_DB_PORT=3307 OLD_DB_USER=root OLD_DB_PASS=root npm test
 * Skipped when OLD_DB_TEST is not set.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { createOldDb, istTime } from "../src/bridge/old-db.js";
import { runBridgeOnce, type BridgeDeps } from "../src/bridge/sync.js";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { BACKEND_ROOT, migrate, seed } from "../src/migrations.js";
import { createProviders } from "../src/providers.js";

const enabled = Boolean(process.env.OLD_DB_TEST);
const SCHEMA = "bs_bridge_test";
const OLD_DB = "bs_old_test";
const API_KEY = "bridge-test-integration-key-0123456789";
const PHONE = "9811100001";

type Json = Record<string, any>;

const mysqlArgs = (database?: string) => [
  "-h", process.env.OLD_DB_HOST ?? "127.0.0.1", "-P", process.env.OLD_DB_PORT ?? "3306", "-u", process.env.OLD_DB_USER ?? "root",
  "--get-server-public-key", "--default-character-set=utf8mb4", ...(database ? [database] : []),
];

function mysql(sql: string, database?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.env.MYSQL_BIN ?? "mysql", mysqlArgs(database), { env: { ...process.env, MYSQL_PWD: process.env.OLD_DB_PASS ?? "" } });
    let err = "";
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err))));
    child.stdin.end(sql);
  });
}

// One local server plays the bay camera and the Inventory.
const sales: Json[] = [];
const inventoryParts = [
  { id: 11, pno: "06455-KWP-901", name: "Brake shoe set", brand: "Honda", model: "", hsn: "8714", gst: 28, mrp: 500, dUser: 10, stock: 7, rack: "A1", active: true, upd: 1000 },
  { id: 12, pno: "EO-1L-20W40", name: "Engine oil 1 L", brand: "Castrol", model: "", hsn: "2710", gst: 18, mrp: 420, dUser: 0, stock: 40, rack: "B2", active: true, upd: 1001 },
];
const upstream: Server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname.startsWith("/cam/")) return void res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" }).end("#EXTM3U\nseg1.ts\n");
  if (req.headers["x-feed-key"] !== "inv-key") return void res.writeHead(401).end();
  if (url.pathname === "/api/feed/parts") {
    const since = Number(url.searchParams.get("since"));
    const parts = inventoryParts.filter((p) => p.upd > since);
    return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ parts, next: Math.max(since, ...parts.map((p) => p.upd)), more: false }));
  }
  if (url.pathname === "/api/import/sales" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      sales.push({ portal: req.headers["x-portal"], ...JSON.parse(body) });
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    });
    return;
  }
  res.writeHead(404).end();
});
const base = await new Promise<string>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(upstream.address() as AddressInfo).port}`)));

const config = loadConfig({
  ...process.env,
  NODE_ENV: "test",
  DB_SCHEMA: SCHEMA,
  JWT_SECRET: "bridge-secret-bridge-secret-bridge-1234",
  OTP_PROVIDER: "console",
  OTP_DEV_CODE: "4719",
  INTEGRATION_API_KEYS: API_KEY,
  PUBLIC_BASE_URL: "http://api.test",
  PUSH_PROVIDER: "none",
  WEBHOOK_URL: "",
  BRIDGE: "on",
  OLD_DB_USER: process.env.OLD_DB_USER ?? "root",
  OLD_DB_BS: OLD_DB,
  OLD_DB_WRITE: "on",
  INVENTORY_URL: base,
  INVENTORY_FEED_KEY: "inv-key",
});
const db = createPool(config);
const app = createApp({ db, config, providers: createProviders(config) });
const deps: BridgeDeps = {
  db,
  config,
  old: createOldDb({
    host: config.OLD_DB_HOST, port: config.OLD_DB_PORT, user: config.OLD_DB_USER!, password: config.OLD_DB_PASS ?? "", database: OLD_DB,
    publicKey: true, bin: config.MYSQL_BIN,
  }),
  inventory: { url: base, feedKey: "inv-key", store: "BS", portal: "desk" },
};

async function call(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (path.startsWith("/integration")) headers["x-api-key"] = API_KEY;
  const response = await app.request(path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const text = await response.text();
  return { status: response.status, data: (text ? JSON.parse(text) : {}) as Json };
}

async function run() {
  const summary = await runBridgeOnce(deps);
  assert.deepEqual(summary.errors, [], JSON.stringify(summary.errors));
  return summary;
}

const state: Json = {};
const camUrl = (n: number) => `${base}/cam/bay${n}/index.m3u8`;

before(async () => {
  if (!enabled) return;
  await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await migrate(db, SCHEMA, () => {});
  await seed(db, SCHEMA, ["reference"], () => {});
  await mysql(`DROP DATABASE IF EXISTS ${OLD_DB}; CREATE DATABASE ${OLD_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await mysql(readFileSync(join(BACKEND_ROOT, "test", "fixtures", "old-billing-schema.sql"), "utf8"), OLD_DB);
  // Made-up rows in the shapes the old site really writes: mixed date formats, stray spaces and line ends, prices as text.
  await mysql(`
    INSERT INTO bay (id, name, url, status) VALUES (1, 'BAY 1', '${camUrl(1)}', 'free'), (2, 'BAY 2', '${camUrl(2)}', 'free');
    INSERT INTO mechanic (id, name, address, phone, pic, status, wallet, auth) VALUES (3, 'irfan test', '', '9811100090', '', 'ACTIVE', '0', 'x');
    INSERT INTO service_adviser (id, name, email, phone, status, role, auth) VALUES (1, 'sharath test', 's@test', '9811100091', 'ACTIVE', 'manager', 'x');
    INSERT INTO user (id, userphone, username, wallet) VALUES (501, '${PHONE}', 'ravi kumar', '120'), (502, '9811100002', 'Someone Else', '0');
    INSERT INTO a_bikes (id, user_id, type, make, model, km, reg_no) VALUES
      (701, '501', 'bike', 'Honda', 'Honda sp125', '27800', 'KA17HR3447'), (702, '501', 'scooty', 'Suzuki ', 'Access 125', '-', 'ka-16 ey 5595');
    INSERT INTO cms_products (id, name, serial_no, hsn, gst_included) VALUES (9972, 'Chain sprocket kit', 'CSK-125', '8714', 'yes'), (15491, 'Air filter', 'AF-SP125', '8421', 'yes');
    INSERT INTO job_card (id, user_id, phone, name, vehicle_number, make, model, last_service_date, service_type, service_package, estimated_cost, odo_reading,
        fuel_level, image1, image2, identifier, approval, created_at, slot_start, slot_end, delivery_time, status, stream_status, dd, mm, yy, mechanic_id, bay_id, completed_at)
      VALUES
      (3001, '501', '${PHONE}', 'Ravi', 'KA17HR3447', 'Honda', 'Honda sp125', '', 'GENERAL SERVICING', '125cc', '350', '27800', '20', '', '', '', 'APPROVED',
        '2026-10-20 10:05:00', '10:00:00', '11:00:00', '2026-10-20T17:00', 'COMPLETED\\r\\n', 'STOPPED', '20', '10', '2026', '3', '2', '2026-10-20 16:40:00'),
      (3002, '501', '+91 ${PHONE}', 'Ravi', 'KA16EY5595', 'Suzuki ', 'Access 125', '', 'GENERAL SERVICING', '125cc', '330', '18045', '20', '', '', '', 'APPROVED',
        '28-10-2026 06:42:26 pm', '17:00:00', '18:00:00', '2026-10-28T19:30', 'ONGOING', 'ACTIVE', '28', '10', '2026', '3', '1', NULL),
      (3003, '502', '9811100002', 'Someone Else', 'KA17AB1111', 'TVS', 'Jupiter', '', 'GENERAL SERVICING', '110cc', '330', '1000', '20', '', '', '', 'APPROVED',
        '2026-10-28 11:00:00', '11:00:00', '12:00:00', '', 'ONGOING', 'ACTIVE', '28', '10', '2026', '3', '2', NULL);
    INSERT INTO job_labour_items (job_card_id, labour_name, labour_price, cc_type, is_custom) VALUES
      (3001, 'GENERAL SERVICING', 330, '125cc', 0), (3001, 'Additional Labour – chain set', 150, '125cc', 1), (3002, 'GENERAL SERVICING', 330, '125cc', 0);
    INSERT INTO invoice (id, invoice_no, customer_name, customer_phone, type, total_amount, discount, amount_before_discount, total_tax, payment_status, created_by_email,
        created_by_name, job_card_id, date, time, dd, mm, yy, wallet_used, payment_method, paid_date, split_cash, split_upi, net_payable, round_off, collected_at)
      VALUES (9001, 'BS2627/9001', 'Ravi', '${PHONE}', 'U', '1804', '0', '1529', '275', 'PAID', 'x@test', 'Saniya', 3001, '20-10-2026', '04:30:00pm',
        '20', '10', '2026', '0', 'split', '20-10-2026', 1000.00, 1284.00, 2284.00, 0, '2026-10-20 16:45:00');
    INSERT INTO invoice_items (product_id, name, goods_price, qty, profit, discount, discount_percent, item_price, cgst, sgst, selling_price, invoice_id, dd, mm, yy)
      VALUES (9972, NULL, '1709', '1', '0', '0', '0', '1448.31', '130.35', '130.34', '1709', '9001', '20', '10', '2026'),
             (15491, NULL, '95', '1', '0', '0', '0', '80.51', '7.25', '7.24', '95', '9001', '20', '10', '2026');
    INSERT INTO service_invoice (invoice_id, job_card_id, date) VALUES ('9001', '3001', '20-10-2026');
  `, OLD_DB);
});

after(async () => {
  if (enabled) await mysql(`DROP DATABASE IF EXISTS ${OLD_DB}`).catch(() => {});
  await db.end();
  upstream.close();
});

test("old site dates are read as India time", { skip: !enabled }, () => {
  assert.equal(istTime("2026-10-28 16:50:19"), "2026-10-28T11:20:19.000Z");
  assert.equal(istTime("28-10-2026 06:42:26 pm"), "2026-10-28T13:12:26.000Z");
  assert.equal(istTime("2026-10-28T18:55"), "2026-10-28T13:25:00.000Z");
  assert.equal(istTime(""), null);
});

test("first run: bays with cameras, staff and Inventory parts", { skip: !enabled }, async () => {
  const summary = await run();
  assert.equal(summary.bays, 2);
  assert.equal(summary.staff, 2);
  assert.equal(summary.parts, 2);
  const bay = (await db.query(`SELECT name, camera_stream_url FROM ${SCHEMA}.bays WHERE code = 'BAY-1'`)).rows[0];
  assert.deepEqual(bay, { name: "Bay 1", camera_stream_url: camUrl(1) });
  // nobody has logged in yet, so no customer data was copied
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.job_cards`)).rows[0].n, 0);
});

test("first login copies the customer's old bikes, job cards, bill and wallet once", { skip: !enabled }, async () => {
  assert.equal((await call("POST", "/v1/auth/otp/request", { body: { phone: PHONE } })).status, 200);
  const login = await call("POST", "/v1/auth/otp/verify", { body: { phone: PHONE, code: "4719" } });
  assert.equal(login.status, 200);
  state.token = login.data.accessToken;
  const summary = await run();
  assert.equal(summary.customersImported, 1);
  await run(); // a second run copies nothing again

  const me = await call("GET", "/v1/me", { token: state.token });
  assert.equal(me.data.name, "Ravi Kumar");
  const vehicles = (await call("GET", "/v1/vehicles", { token: state.token })).data;
  const list: Json[] = vehicles.vehicles ?? vehicles.items ?? vehicles;
  assert.deepEqual(list.map((v) => v.registrationNumber).sort(), ["KA16EY5595", "KA17HR3447"]);
  assert.equal(list.find((v) => v.registrationNumber === "KA16EY5595")!.bodyType, "scooter");

  const bookings = (await call("GET", "/v1/bookings", { token: state.token })).data;
  const all: Json[] = bookings.bookings ?? bookings.items ?? bookings;
  assert.equal(all.length, 2, "the other customer's card stays out");
  const done = all.find((b) => b.vehicle.registrationNumber === "KA17HR3447")!;
  const live = all.find((b) => b.vehicle.registrationNumber === "KA16EY5595")!;
  assert.equal(done.status, "delivered");
  assert.equal(done.paid, true);
  assert.deepEqual(done.services.map((s: Json) => s.price).sort(), [150, 330]);
  assert.equal(live.status, "in_service");
  assert.equal(live.bay.name, "Bay 1");
  assert.equal(live.mechanic.name, "Irfan Test");
  assert.equal(live.cameraAvailable, true);
  state.live = live;

  const invoices = (await call("GET", "/v1/invoices", { token: state.token })).data;
  const bills: Json[] = invoices.invoices ?? invoices.items ?? invoices;
  assert.equal(bills.length, 1);
  assert.equal(bills[0].number, "BS2627/9001");
  assert.equal(bills[0].total, 2284);
  assert.equal(bills[0].balanceDue, 0);
  assert.deepEqual(bills[0].payments.map((p: Json) => [p.method, p.amount]).sort(), [["cash", 1000], ["upi", 1284]]);
  assert.ok(bills[0].lines.some((l: Json) => l.label === "Chain sprocket kit" && l.amount === 1709));

  const wallet = (await call("GET", "/v1/wallet", { token: state.token })).data;
  assert.equal(wallet.balance, 120);
  // history is copied quietly: no notification storm on first login
  const notes = (await call("GET", "/v1/notifications", { token: state.token })).data;
  const items: Json[] = notes.notifications ?? notes.items ?? notes;
  assert.ok(!items.some((n) => n.title === "Delivered"));

  const camera = await call("GET", `/v1/bookings/${live.id}/camera`, { token: state.token });
  assert.equal(camera.status, 200);
});

test("live: camera off, labour change, completion with an unpaid bill, then payment", { skip: !enabled }, async () => {
  await mysql("UPDATE job_card SET stream_status = 'STOPPED' WHERE id = 3002; INSERT INTO job_labour_items (job_card_id, labour_name, labour_price) VALUES (3002, 'Brake adjust', 80);", OLD_DB);
  await run();
  let live = (await call("GET", `/v1/bookings/${state.live.id}`, { token: state.token })).data;
  assert.equal(live.cameraAvailable, false);
  assert.equal(live.estimateAmount, 410);
  assert.equal((await call("GET", `/v1/bookings/${state.live.id}/camera`, { token: state.token })).status, 409);

  await mysql(`
    UPDATE job_card SET status = 'COMPLETED', completed_at = '2026-10-28 19:20:00' WHERE id = 3002;
    INSERT INTO invoice (id, invoice_no, customer_name, customer_phone, type, total_amount, discount, amount_before_discount, total_tax, payment_status, created_by_email,
      created_by_name, job_card_id, date, time, dd, mm, yy, wallet_used, payment_method, paid_date, net_payable, round_off)
      VALUES (9002, 'BS2627/9002', 'Ravi', '${PHONE}', 'U', '420', '0', '356', '64', 'PENDING', 'x@test', 'Saniya', 3002, '28-10-2026', '07:10:00pm', '28', '10', '2026', '0', NULL, '', 830, 0);
    INSERT INTO invoice_items (product_id, name, goods_price, qty, profit, discount, discount_percent, item_price, cgst, sgst, selling_price, invoice_id, dd, mm, yy)
      VALUES (15491, 'Engine oil', '420', '1', '0', '0', '0', '355.93', '32.04', '32.03', '420', '9002', '28', '10', '2026');
    INSERT INTO service_invoice (invoice_id, job_card_id, date) VALUES ('9002', '3002', '28-10-2026');`, OLD_DB);
  await run();
  live = (await call("GET", `/v1/bookings/${state.live.id}`, { token: state.token })).data;
  assert.equal(live.status, "delivered");
  assert.equal(live.paid, false);
  const bill = (await call("GET", `/v1/bookings/${state.live.id}/bill`, { token: state.token })).data;
  assert.equal(bill.kind, "due");
  assert.equal(bill.total, 830);
  const invoices = (await call("GET", "/v1/invoices", { token: state.token })).data as Json[];
  assert.equal(invoices.find((i) => i.number === "BS2627/9002")?.source, "workshop");
  const tried = await call("POST", `/v1/bookings/${state.live.id}/pay`, { token: state.token, body: { walletAmount: 0, method: "upi" } });
  assert.equal(tried.status, 409);
  assert.equal(tried.data.error.code, "pay_at_workshop");

  await mysql("UPDATE invoice SET payment_status = 'PAID', payment_method = 'upi', collected_at = '2026-10-28 19:30:00' WHERE id = 9002;", OLD_DB);
  await run();
  live = (await call("GET", `/v1/bookings/${state.live.id}`, { token: state.token })).data;
  assert.equal(live.paid, true);
  const items: Json[] = ((d) => d.notifications ?? d.items ?? d)((await call("GET", "/v1/notifications", { token: state.token })).data);
  assert.ok(items.some((n) => n.title === "Delivered"));
  assert.ok(items.some((n) => n.title === "Paid in full"));
});

test("app booking goes to the old booking list, and reception's job card links back to it", { skip: !enabled }, async () => {
  const added = await call("POST", "/v1/vehicles", { token: state.token, body: { registrationNumber: "KA17EX2231", make: "Bajaj", model: "Pulsar 150", bodyType: "naked" } });
  assert.equal(added.status, 201, JSON.stringify(added.data));
  const services = (await call("GET", "/v1/services")).data;
  const first = (services.services ?? services.items ?? services)[0];
  const start = new Date(Date.now() + 26 * 3600_000).toISOString();
  const end = new Date(Date.now() + 28 * 3600_000).toISOString();
  const booked = await call("POST", "/v1/bookings", { token: state.token, body: { vehicleId: added.data.id, serviceIds: [first.id], mode: "visit", slotStart: start, slotEnd: end } });
  assert.equal(booked.status, 201, JSON.stringify(booked.data));
  const summary = await run();
  assert.equal(summary.bookingsSent, 1);
  const rows = await deps.old!.select("a_service_bookings", { id: "id", phone: "phone", status: "status", bike: "bike_details", pickup: "pickupType" });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].phone, rows[0].status, rows[0].pickup], [PHONE, "pending", "work"]);
  assert.match(String(rows[0].bike), /KA17EX2231/);

  await mysql(`
    INSERT INTO job_card (id, user_id, phone, name, vehicle_number, make, model, last_service_date, service_type, service_package, estimated_cost, odo_reading,
      fuel_level, image1, image2, identifier, approval, created_at, slot_start, slot_end, delivery_time, status, stream_status, dd, mm, yy, mechanic_id, bay_id)
      VALUES (3004, '501', '${PHONE}', 'Ravi', 'KA 17 EX 2231', 'Bajaj', 'Pulsar 150', '', 'GENERAL SERVICING', '150cc', '330', '5000', '20', '', '', '', 'PENDING',
      '2026-11-23 10:00:00', '10:00:00', '11:00:00', '', 'PENDING', 'ACTIVE', '23', '11', '2026', NULL, '2');
    UPDATE a_service_bookings SET status = 'converted';`, OLD_DB);
  await run();
  const same = (await call("GET", `/v1/bookings/${booked.data.id}`, { token: state.token })).data;
  assert.equal(same.status, "at_workshop", "the app booking itself moved; no second job card");
  assert.equal(same.bay.name, "Bay 2");
  state.pulsar = same;
});

test("an extra part by Inventory part number, approved, closed in the app: stock leaves the Inventory once", { skip: !enabled }, async () => {
  const raised = await call("POST", `/integration/v1/job-cards/${state.pulsar.number}/extras`, { body: { partNo: "06455 kwp 901", note: "Worn out", raisedByLabel: "Irfan, Bay 2" } });
  assert.equal(raised.status, 201, JSON.stringify(raised.data));
  const extra = raised.data.extras.find((e: Json) => e.partName === "Brake shoe set");
  assert.equal(extra.amount, 450, "MRP 500 less the 10% customer discount");
  assert.equal((await call("POST", `/v1/bookings/${state.pulsar.id}/extras/${extra.id}/decision`, { token: state.token, body: { approve: true } })).status, 200);
  const closed = await call("POST", `/integration/v1/job-cards/${state.pulsar.number}/close`, { body: {} });
  assert.equal(closed.status, 200, JSON.stringify(closed.data));
  assert.equal((await call("POST", "/integration/v1/job-cards/BS-0000-000000/extras", { body: { partNo: "NOPE-1" } })).status, 404);

  await run();
  await run();
  assert.equal(sales.length, 1, "sent once");
  assert.equal(sales[0].portal, "desk");
  assert.deepEqual(sales[0].bills[0].lines.map((l: Json) => [l.pno, l.qty]), [["06455-KWP-901", 1]]);
});

test("unknown part numbers are refused", { skip: !enabled }, async () => {
  const res = await call("POST", `/integration/v1/job-cards/${state.pulsar.number}/extras`, { body: { partNo: "NOPE-1" } });
  assert.ok(res.status === 400 || res.status === 409, JSON.stringify(res.data));
});
