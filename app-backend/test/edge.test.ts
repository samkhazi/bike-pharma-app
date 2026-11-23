/** Adversarial tests: access control, races, malformed input, pagination, production config. Uses schema bs_edge. */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { migrate, seed } from "../src/migrations.js";
import { createProviders } from "../src/providers.js";

const SCHEMA = "bs_edge";
const KEY = "edge-integration-key-0123456789abcdef";
const env = {
  ...process.env,
  NODE_ENV: "test",
  DB_SCHEMA: SCHEMA,
  JWT_SECRET: "edge-secret-edge-secret-edge-secret-12",
  OTP_PROVIDER: "console",
  OTP_DEV_CODE: "4719",
  INTEGRATION_API_KEYS: KEY,
  PUBLIC_BASE_URL: "http://api.test",
};
const config = loadConfig(env);
const db = createPool(config);
const app = createApp({ db, config, providers: createProviders(config) });

type Json = Record<string, any>;
async function call(method: string, path: string, o: { token?: string; body?: unknown; raw?: string; integration?: boolean } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.integration) headers["x-api-key"] = KEY;
  const res = await app.request(path, { method, headers, body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body)) });
  const text = await res.text();
  let data: Json = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}
const int = (method: string, path: string, body?: unknown) => call(method, path, { body, integration: true });

async function signIn(phone: string) {
  await call("POST", "/v1/auth/otp/request", { body: { phone } });
  const res = await call("POST", "/v1/auth/otp/verify", { body: { phone, code: "4719" } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data;
}
const slot = (hour: number, days = 1) => {
  const d = new Date(Date.now() + days * 86400000);
  d.setUTCHours(hour - 5, 30, 0, 0);
  return d.toISOString();
};
async function bike(token: string, plate: string) {
  const res = await call("POST", "/v1/vehicles", { token, body: { registrationNumber: plate, make: "Honda", model: "Shine", bodyType: "commuter" } });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.id as string;
}
async function book(token: string, vehicleId: string, services = ["general"]) {
  return call("POST", "/v1/bookings", { token, body: { vehicleId, serviceIds: services, mode: "visit", slotStart: slot(10), slotEnd: slot(11) } });
}

const stubHits: string[] = [];
const stub: Server = createServer((req, res) => {
  stubHits.push(req.url ?? "");
  res.writeHead(200).end("ok");
});
await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

before(async () => {
  await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await migrate(db, SCHEMA, () => {});
  await seed(db, SCHEMA, ["reference"], () => {});
});
after(async () => {
  await db.end();
  stub.closeAllConnections();
  stub.close();
});

const s: Json = {};

test("one customer cannot see or change another's records", async () => {
  const a = await signIn("9100000001");
  const b = await signIn("9100000002");
  s.a = a; s.b = b;
  const vehicleId = await bike(a.accessToken, "KA01AA0001");
  const booking = (await book(a.accessToken, vehicleId)).data;
  const address = (await call("POST", "/v1/me/addresses", { token: a.accessToken, body: { label: "Home", area: "x", line: "y" } })).data;
  s.vehicleId = vehicleId; s.booking = booking;

  const bt = b.accessToken;
  for (const [method, path, body] of [
    ["GET", `/v1/vehicles/${vehicleId}`], ["PATCH", `/v1/vehicles/${vehicleId}`, { model: "Hacked" }], ["DELETE", `/v1/vehicles/${vehicleId}`],
    ["GET", `/v1/vehicles/${vehicleId}/history`], ["GET", `/v1/vehicles/${vehicleId}/warranties`],
    ["PUT", `/v1/vehicles/${vehicleId}/documents/puc`, { reading: "x" }],
    ["GET", `/v1/bookings/${booking.id}`], ["GET", `/v1/bookings/${booking.id}/bill`], ["GET", `/v1/bookings/${booking.id}/camera`],
    ["POST", `/v1/bookings/${booking.id}/cancel`, {}], ["POST", `/v1/bookings/${booking.id}/pay`, { walletAmount: 0, method: "upi" }],
    ["POST", `/v1/bookings/${booking.id}/pay-at-delivery`], ["POST", `/v1/bookings/${booking.id}/extras/approve-all`],
    ["POST", `/v1/bookings/${booking.id}/review`, { stars: 5 }], ["DELETE", `/v1/me/addresses/${address.id}`],
  ] as [string, string, unknown?][]) {
    const res = await call(method, path, { token: bt, body });
    assert.ok([404, 409].includes(res.status), `${method} ${path} -> ${res.status} ${JSON.stringify(res.data)}`);
  }
  // B books using A's vehicle / address
  const steal = await call("POST", "/v1/bookings", { token: bt, body: { vehicleId, serviceIds: ["oil"], mode: "visit", slotStart: slot(10), slotEnd: slot(11) } });
  assert.equal(steal.status, 404);
  const bVehicle = await bike(bt, "KA01BB0002");
  const stealAddr = await call("POST", "/v1/bookings", { token: bt, body: { vehicleId: bVehicle, serviceIds: ["oil"], mode: "pickup", pickupAddressId: address.id, slotStart: slot(10), slotEnd: slot(11) } });
  assert.equal(stealAddr.status, 404);
  assert.deepEqual((await call("GET", "/v1/bookings", { token: bt })).data, []);
  assert.equal((await call("GET", `/v1/vehicles/${vehicleId}`, { token: a.accessToken })).data.model, "Shine", "A's data is unchanged");
});

test("tokens: tampered, wrong audience, expired, camera token reused as bearer", async () => {
  const secret = new TextEncoder().encode(config.JWT_SECRET);
  const good = s.a.accessToken as string;
  assert.equal((await call("GET", "/v1/me", { token: good.slice(0, -2) + "xx" })).status, 401);
  const forged = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(s.a.customer.id).setAudience("camera").setExpirationTime("1h").sign(secret);
  assert.equal((await call("GET", "/v1/me", { token: forged })).status, 401, "camera token is not a session");
  const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(s.a.customer.id).setAudience("customer").setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(secret);
  assert.equal((await call("GET", "/v1/me", { token: expired })).status, 401);
  const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: s.a.customer.id, aud: "customer" })).toString("base64url")}.`;
  assert.equal((await call("GET", "/v1/me", { token: none })).status, 401, "alg none rejected");
  const otherSecret = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(s.a.customer.id).setAudience("customer").setExpirationTime("1h").sign(new TextEncoder().encode("another-secret-another-secret-123456"));
  assert.equal((await call("GET", "/v1/me", { token: otherSecret })).status, 401);
});

test("malformed input is rejected cleanly, never a 500", async () => {
  const t = s.a.accessToken;
  const cases: [string, string, unknown, number[]][] = [
    ["POST", "/v1/auth/otp/request", { phone: "123" }, [400]],
    ["POST", "/v1/auth/otp/request", { phone: "5876543210" }, [400]],
    ["POST", "/v1/auth/otp/verify", { phone: "9100000001", code: "12" }, [400]],
    ["POST", "/v1/vehicles", { registrationNumber: "!!", make: "a", model: "b", bodyType: "commuter" }, [400]],
    ["POST", "/v1/vehicles", { registrationNumber: "KA01ZZ0009", make: "a", model: "b", bodyType: "spaceship" }, [400]],
    ["POST", "/v1/vehicles", { registrationNumber: "KA01ZZ0009", make: "a", model: "b", bodyType: "commuter", makeYear: 1800 }, [400]],
    ["POST", "/v1/vehicles", { registrationNumber: "KA01ZZ0009", make: "a", model: "b", bodyType: "commuter", odometerKm: -5 }, [400]],
    ["POST", "/v1/vehicles", { registrationNumber: "KA01ZZ0009", make: "a'; DROP TABLE vehicles;--", model: "b", bodyType: "commuter" }, [201]],
    ["POST", "/v1/bookings", { vehicleId: "not-a-uuid", serviceIds: ["general"], mode: "visit", slotStart: slot(10), slotEnd: slot(11) }, [400]],
    ["POST", "/v1/bookings", { vehicleId: s.vehicleId, serviceIds: [], mode: "visit", slotStart: slot(10), slotEnd: slot(11) }, [400]],
    ["POST", "/v1/bookings", { vehicleId: s.vehicleId, serviceIds: ["nope"], mode: "visit", slotStart: slot(10), slotEnd: slot(11) }, [400, 409]],
    ["POST", "/v1/bookings", { vehicleId: s.vehicleId, serviceIds: ["general"], mode: "visit", slotStart: slot(11), slotEnd: slot(10) }, [400]],
    ["POST", "/v1/bookings", { vehicleId: s.vehicleId, serviceIds: ["general"], mode: "visit", slotStart: "yesterday", slotEnd: "today" }, [400]],
    ["POST", "/v1/bookings", { vehicleId: s.vehicleId, serviceIds: ["general"], mode: "pickup", slotStart: slot(10), slotEnd: slot(11) }, [400, 409]],
    ["PATCH", "/v1/me", { email: "not-an-email" }, [400]],
    ["PATCH", "/v1/me", { language: "Klingon" }, [400]],
    ["POST", "/v1/me/addresses", { label: "", area: "x", line: "y" }, [400]],
    ["POST", "/v1/me/addresses", { label: "x", area: "x", line: "y", latitude: 999 }, [400]],
    ["POST", "/v1/me/devices", { provider: "onesignal", platform: "ios", token: "x" }, [400]],
  ];
  for (const [method, path, body, ok] of cases) {
    const res = await call(method, path, { token: t, body });
    assert.ok(ok.includes(res.status), `${method} ${path} ${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(res.data)}`);
  }
  assert.equal((await call("POST", "/v1/vehicles", { token: t, raw: "{not json" })).status, 400);
  assert.equal((await call("GET", "/v1/bookings/not-a-uuid", { token: t })).status, 400);
  assert.equal((await call("GET", "/integration/v1/job-cards/'; DROP TABLE job_cards;--", { integration: true })).status, 404);
  assert.equal((await call("GET", "/integration/v1/customers/abc", { integration: true })).status, 400, "bad phone");
  const count = await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.vehicles`);
  assert.ok(count.rows[0].n >= 2, "tables survived");
});

test("racing requests cannot double-book, double-decide or double-pay", async () => {
  const c = await signIn("9100000003");
  const vehicleId = await bike(c.accessToken, "KA01CC0003");
  const results = await Promise.all(Array.from({ length: 8 }, () => book(c.accessToken, vehicleId)));
  assert.equal(results.filter((r) => r.status === 201).length, 1, results.map((r) => r.status).join(","));
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409), "losers get 409");
  const open = await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.job_cards WHERE vehicle_id = $1`, [vehicleId]);
  assert.equal(open.rows[0].n, 1);

  const booking = results.find((r) => r.status === 201)!.data;
  await int("PUT", `/integration/v1/job-cards/${booking.number}/status`, { status: "in_service" });
  const extra = (await int("POST", `/integration/v1/job-cards/${booking.number}/extras`, { partName: "Pads", amount: 500, note: "" })).data.extras[0];
  const decisions = await Promise.all([true, false, true, false].map((approve) =>
    call("POST", `/v1/bookings/${booking.id}/extras/${extra.id}/decision`, { token: c.accessToken, body: { approve } })));
  assert.equal(decisions.filter((r) => r.status === 200).length, 1, decisions.map((r) => r.status).join(","));

  await int("POST", `/integration/v1/job-cards/${booking.number}/close`, {});
  const me = (await call("GET", "/v1/me", { token: c.accessToken })).data;
  await int("POST", `/integration/v1/customers/${me.id}/wallet`, { amount: 300, kind: "cashback", title: "Credit" });
  const pays = await Promise.all(Array.from({ length: 5 }, () => call("POST", `/v1/bookings/${booking.id}/pay`, { token: c.accessToken, body: { walletAmount: 300, method: "upi" } })));
  const wallet = (await call("GET", "/v1/wallet", { token: c.accessToken })).data;
  assert.ok(wallet.balance >= 0, `wallet went negative: ${wallet.balance} (${pays.map((r) => r.status).join(",")})`);
  const spent = await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.wallet_transactions WHERE customer_id = $1 AND kind = 'service_payment'`, [me.id]);
  assert.equal(spent.rows[0].n, 1, "wallet spent once");
  const pending = await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.payments p JOIN ${SCHEMA}.invoices i ON i.id = p.invoice_id WHERE i.customer_id = $1 AND p.status = 'pending'`, [me.id]);
  assert.equal(pending.rows[0].n, 1, "one live pending payment");

  const payment = await db.query(`SELECT id FROM ${SCHEMA}.payments WHERE status = 'pending' AND customer_id = $1`, [me.id]);
  const confirms = await Promise.all([1, 2, 3].map(() => int("PUT", `/integration/v1/payments/${payment.rows[0].id}`, { status: "succeeded" })));
  assert.equal(confirms.filter((r) => r.status === 200).length, 1, "confirm once");
  const paid = await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.integration_events WHERE event_type = 'invoice.paid'`);
  assert.equal(paid.rows[0].n, 1, "invoice.paid fires once");
});

test("a cash payment cannot overpay, and cannot be recorded twice", async () => {
  const c = await signIn("9100000004");
  const vehicleId = await bike(c.accessToken, "KA01DD0004");
  const booking = (await book(c.accessToken, vehicleId, ["wash"])).data;
  const n = booking.number;
  assert.equal((await int("POST", `/integration/v1/job-cards/${n}/payments`, { method: "cash", amount: 10 })).status, 409, "no invoice yet");
  await int("PUT", `/integration/v1/job-cards/${n}/status`, { status: "in_service" });
  await int("POST", `/integration/v1/job-cards/${n}/close`, {});
  assert.equal((await int("POST", `/integration/v1/job-cards/${n}/payments`, { method: "cash", amount: 99999 })).status, 400);
  assert.equal((await int("POST", `/integration/v1/job-cards/${n}/payments`, { method: "cash", amount: 0 })).status, 400);
  assert.equal((await int("POST", `/integration/v1/job-cards/${n}/payments`, { method: "cash", amount: 100 })).data.status, "open", "partial");
  const rest = await int("POST", `/integration/v1/job-cards/${n}/payments`, { method: "cash", amount: 76 });
  assert.equal(rest.data.status, "paid", JSON.stringify(rest.data));
  assert.equal((await int("POST", `/integration/v1/job-cards/${n}/payments`, { method: "cash", amount: 1 })).status, 409);
});

test("camera: scoped to the bay and the stage, cannot be steered elsewhere", async () => {
  await int("PUT", "/integration/v1/bays/BAY-09", { name: "Bay 09", cameraStreamUrl: `${stubUrl}/cam/bay9/index.m3u8` });
  const c = await signIn("9100000005");
  const booking = (await book(c.accessToken, await bike(c.accessToken, "KA01EE0005"))).data;
  await int("PATCH", `/integration/v1/job-cards/${booking.number}/assignment`, { bayCode: "BAY-09" });
  await int("PUT", `/integration/v1/job-cards/${booking.number}/status`, { status: "in_service" });
  const cam = await call("GET", `/v1/bookings/${booking.id}/camera`, { token: c.accessToken });
  assert.equal(cam.status, 200);
  const base = new URL(cam.data.playbackUrl).pathname;
  for (const evil of ["../../admin", "..%2F..%2Fadmin", "%2e%2e/%2e%2e/admin", "http://evil.test/x", "//evil.test/x", "%2F%2Fevil.test/x"]) {
    const res = await app.request(base.replace("index.m3u8", evil));
    const text = await res.text();
    assert.notEqual(res.status, 500, `${evil} -> 500`);
    void text;
  }
  const outside = stubHits.filter((u) => !u.startsWith("/cam/bay9/"));
  assert.deepEqual(outside, [], "camera proxy only ever fetched paths under the bay's stream directory");
  assert.ok(stubHits.length > 0, "proxy did reach the stub");
  await int("PUT", `/integration/v1/job-cards/${booking.number}/status`, { status: "job_closed" });
  assert.equal((await app.request(base)).status, 403, "link stops working once the bike leaves the bay");
});

test("integration pagination does not skip rows that share a timestamp", async () => {
  await db.query(`ALTER TABLE ${SCHEMA}.job_cards DISABLE TRIGGER USER`);
  await db.query(`UPDATE ${SCHEMA}.job_cards SET updated_at = '2030-01-01T00:00:00.123456Z' WHERE id IN (SELECT id FROM ${SCHEMA}.job_cards ORDER BY id LIMIT 4)`);
  await db.query(`ALTER TABLE ${SCHEMA}.job_cards ENABLE TRIGGER USER`);
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: { data: Json } = await int("GET", `/integration/v1/job-cards?limit=1&updatedSince=2029-12-31T00:00:00Z${cursor ? `&cursor=${cursor}` : ""}`);
    for (const item of page.data.items) seen.add(item.id);
    cursor = page.data.nextCursor;
    pages += 1;
  } while (cursor && pages < 20);
  assert.equal(seen.size, 4, `saw ${seen.size} of 4 job cards in ${pages} pages`);
  assert.equal((await int("GET", "/integration/v1/job-cards?cursor=garbage")).status, 400);
  const customers = await int("GET", "/integration/v1/customers?limit=1");
  assert.ok(customers.data.nextCursor);
  assert.equal((await int("GET", `/integration/v1/customers?limit=1&cursor=${customers.data.nextCursor}`)).status, 200);
});

test("webhook outage: events stay ordered and nothing is lost", async () => {
  const { deliverWebhooks } = await import("../src/worker.js");
  const got: string[] = [];
  let fail = true;
  const hook = createServer((req, res) => {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", () => {
      if (fail) return void res.writeHead(500).end();
      got.push(JSON.parse(b).id);
      res.writeHead(200).end();
    });
  });
  await new Promise<void>((r) => hook.listen(0, "127.0.0.1", r));
  test.after(() => { hook.closeAllConnections(); hook.close(); });
  const cfg = loadConfig({ ...env, WEBHOOK_URL: `http://127.0.0.1:${(hook.address() as AddressInfo).port}`, WEBHOOK_SECRET: "x" });
  await db.query(`UPDATE ${SCHEMA}.integration_events SET delivered_at = now()`);
  const c = await signIn("9100000006");
  await bike(c.accessToken, "KA01FF0006");
  await deliverWebhooks(db, cfg);
  const failed = await db.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.integration_events WHERE delivered_at IS NULL AND attempts > 0`);
  assert.equal(failed.rows[0].n, 1, "only the head event is attempted during an outage");
  fail = false;
  assert.equal(await deliverWebhooks(db, cfg), 0, "backoff holds the retry back");
  await db.query(`UPDATE ${SCHEMA}.integration_events SET next_attempt_at = now()`);
  await deliverWebhooks(db, cfg);
  const ids = got.map(Number);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "in order");
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.ok(ids.length >= 2);
  hook.closeAllConnections();
  hook.close();
});

test("production config refuses unsafe settings", () => {
  const base = { DATABASE_URL: "postgres://x@y/z", JWT_SECRET: "x".repeat(40), NODE_ENV: "production" };
  assert.throws(() => loadConfig({ ...base, OTP_PROVIDER: "console" }), /OTP_PROVIDER/);
  assert.throws(() => loadConfig({ ...base, OTP_PROVIDER: "http", OTP_HTTP_URL: "https://sms.test/send", OTP_DEV_CODE: "1234" }), /OTP_DEV_CODE/);
  assert.throws(() => loadConfig({ ...base, OTP_PROVIDER: "http", OTP_HTTP_URL: "https://sms.test/send", INTEGRATION_API_KEYS: "short" }), /INTEGRATION_API_KEYS/);
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: "short", OTP_PROVIDER: "http", OTP_HTTP_URL: "https://sms.test/send" }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ ...base, DB_SCHEMA: "bad; DROP", OTP_PROVIDER: "http", OTP_HTTP_URL: "https://sms.test/send" }), /DB_SCHEMA/);
  assert.throws(() => loadConfig({ ...base, WEBHOOK_URL: "https://x.test/h", OTP_PROVIDER: "http", OTP_HTTP_URL: "https://sms.test/send" }), /WEBHOOK_SECRET/);
  assert.ok(loadConfig({ ...base, OTP_PROVIDER: "http", OTP_HTTP_URL: "https://sms.test/send" }));
});

test("OTP brute force is limited", async () => {
  await call("POST", "/v1/auth/otp/request", { body: { phone: "9100000007" } });
  const codes = ["0001", "0002", "0003", "0004", "0005", "0006", "4719"];
  const statuses: number[] = [];
  for (const code of codes) statuses.push((await call("POST", "/v1/auth/otp/verify", { body: { phone: "9100000007", code } })).status);
  assert.notEqual(statuses[6], 200, `the right code still worked after 6 wrong guesses: ${statuses}`);
  const sends = [];
  for (let i = 0; i < 7; i += 1) sends.push((await call("POST", "/v1/auth/otp/request", { body: { phone: "9100000008" } })).status);
  assert.ok(sends.includes(429), `no rate limit on code requests: ${sends}`);
});
