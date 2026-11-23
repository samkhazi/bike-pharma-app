/**
 * End-to-end test of the customer and integration APIs against a real PostgreSQL database.
 * Uses DATABASE_URL with a throwaway schema (bs_test), so it also exercises the DB_SCHEMA option.
 *
 *   docker compose up -d db && npm test
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { BACKEND_ROOT, migrate, seed } from "../src/migrations.js";
import { createProviders } from "../src/providers.js";
import { deliverWebhooks } from "../src/worker.js";

const SCHEMA = "bs_test";
const API_KEY = "test-integration-key-0123456789abcdef";
const WEBHOOK_SECRET = "test-webhook-secret";

const received: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
let upstream: Server;
let upstreamUrl = "";

function listen(server: Server) {
  return new Promise<string>((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)));
}

// One local server plays both the bay camera and the CRM's webhook receiver.
upstream = createServer((req, res) => {
  if (req.url?.startsWith("/hook")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.writeHead(200).end();
    });
    return;
  }
  if (req.url === "/cam/bay03/index.m3u8") return void res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" }).end("#EXTM3U\nseg1.ts\n");
  if (req.url === "/cam/bay03/seg1.ts") return void res.writeHead(200, { "content-type": "video/mp2t" }).end("segment");
  res.writeHead(404).end();
});
upstreamUrl = await listen(upstream);

const config = loadConfig({
  ...process.env,
  NODE_ENV: "test",
  DB_SCHEMA: SCHEMA,
  JWT_SECRET: "test-secret-test-secret-test-secret-1234",
  OTP_PROVIDER: "console",
  OTP_DEV_CODE: "4719",
  INTEGRATION_API_KEYS: API_KEY,
  WEBHOOK_URL: `${upstreamUrl}/hook`,
  WEBHOOK_SECRET,
  PUBLIC_BASE_URL: "http://api.test",
  PUSH_PROVIDER: "none",
});
const db = createPool(config);
const app = createApp({ db, config, providers: createProviders(config) });

type Json = Record<string, any>;

async function call(method: string, path: string, options: { token?: string; key?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (path.startsWith("/integration") && options.key !== null) headers["x-api-key"] = options.key ?? API_KEY;
  const response = await app.request(path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const text = await response.text();
  let data: Json = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

async function signIn(phone: string, referralCode?: string) {
  assert.equal((await call("POST", "/v1/auth/otp/request", { body: { phone } })).status, 200);
  const res = await call("POST", "/v1/auth/otp/verify", { body: { phone, code: "4719", referralCode } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data;
}

const tomorrow = (hour: number) => {
  const date = new Date(Date.now() + 24 * 3600 * 1000);
  date.setUTCHours(hour - 5, 30, 0, 0);
  return date.toISOString();
};

before(async () => {
  await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await migrate(db, SCHEMA, () => {});
  await seed(db, SCHEMA, ["reference"], () => {});
});

after(async () => {
  await db.end();
  upstream.close();
});

const state: Json = {};

test("health and docs", async () => {
  assert.deepEqual((await call("GET", "/health/ready")).data.status, "ready");
  const spec = await call("GET", "/openapi.json");
  assert.equal(spec.status, 200);
  assert.ok(spec.data.paths["/v1/bookings"] && spec.data.paths["/integration/v1/job-cards/{ref}/status"]);
});

test("OTP login creates accounts and links referrals", async () => {
  const referrer = await signIn("9000000001");
  assert.equal(referrer.isNewCustomer, true);
  state.referrer = referrer;

  await call("POST", "/v1/auth/otp/request", { body: { phone: "+91 90000 00002" } });
  const wrong = await call("POST", "/v1/auth/otp/verify", { body: { phone: "9000000002", code: "0000" } });
  assert.equal(wrong.status, 401);

  const rider = await signIn("9000000002", referrer.customer.referralCode);
  assert.equal(rider.customer.phone, "+919000000002");
  state.token = rider.accessToken;
  state.refresh = rider.refreshToken;

  const again = await signIn("9000000002");
  assert.equal(again.isNewCustomer, false);

  const refreshed = await call("POST", "/v1/auth/refresh", { body: { refreshToken: state.refresh } });
  assert.equal(refreshed.status, 200);
  assert.equal((await call("POST", "/v1/auth/refresh", { body: { refreshToken: state.refresh } })).status, 401, "refresh tokens rotate");

  assert.equal((await call("GET", "/v1/me")).status, 401);
  const me = await call("PATCH", "/v1/me", { token: state.token, body: { name: "Ravi Kumar", language: "Kannada" } });
  assert.equal(me.data.name, "Ravi Kumar");
});

test("garage, address and catalogue", async () => {
  const address = await call("POST", "/v1/me/addresses", {
    token: state.token,
    body: { label: "Home", area: "PJ Extension", line: "12, 4th Main, PJ Extension, Davangere", contactPhone: "9000000002" },
  });
  assert.equal(address.status, 201);
  state.addressId = address.data.id;

  const vehicle = await call("POST", "/v1/vehicles", {
    token: state.token,
    body: { registrationNumber: "ka 17 ab-1234", make: "Bajaj", model: "Pulsar 150", bodyType: "commuter", colourHex: "#1f2023", makeYear: 2021, odometerKm: 18000 },
  });
  assert.equal(vehicle.status, 201, JSON.stringify(vehicle.data));
  assert.equal(vehicle.data.registrationNumber, "KA17AB1234");
  state.vehicleId = vehicle.data.id;

  const duplicate = await call("POST", "/v1/vehicles", { token: state.token, body: { registrationNumber: "KA17AB1234", make: "Bajaj", model: "Pulsar", bodyType: "commuter" } });
  assert.equal(duplicate.status, 409);

  const services = await call("GET", "/v1/services");
  assert.equal(services.data.length, 6);
  const offers = await call("GET", "/v1/offers");
  assert.ok(offers.data.some((offer: Json) => offer.id === "first"));
  const workshop = await call("GET", "/v1/workshop");
  assert.equal(workshop.data.advisor.name, "Amit Patil");

  assert.equal((await call("POST", "/v1/vehicles/lookup", { token: state.token, body: { registrationNumber: "KA17AB1234" } })).status, 501);
});

test("booking with an offer creates a job card", async () => {
  const booking = await call("POST", "/v1/bookings", {
    token: state.token,
    body: { vehicleId: state.vehicleId, serviceIds: ["general"], mode: "pickup", slotStart: tomorrow(14), slotEnd: tomorrow(16), pickupAddressId: state.addressId, offerId: "first" },
  });
  assert.equal(booking.status, 201, JSON.stringify(booking.data));
  assert.match(booking.data.number, /^BS-\d{4}-\d{6}$/);
  assert.equal(booking.data.status, "booked");
  assert.equal(booking.data.estimateAmount, 1349);
  assert.equal(booking.data.advisor.name, "Amit Patil");
  state.bookingId = booking.data.id;
  state.number = booking.data.number;

  const second = await call("POST", "/v1/bookings", {
    token: state.token,
    body: { vehicleId: state.vehicleId, serviceIds: ["wash"], mode: "visit", slotStart: tomorrow(10), slotEnd: tomorrow(11) },
  });
  assert.equal(second.status, 409);
  assert.equal(second.data.error.code, "vehicle_has_open_booking");

  const bill = await call("GET", `/v1/bookings/${state.bookingId}/bill`, { token: state.token });
  assert.equal(bill.data.kind, "estimate");
  assert.equal(bill.data.tax, 243);
  assert.equal(bill.data.total, 1592);
});

test("integration API needs a key", async () => {
  assert.equal((await call("GET", "/integration/v1/job-cards", { key: null })).status, 401);
  assert.equal((await call("GET", "/integration/v1/job-cards", { key: "wrong-key-wrong-key-wrong" })).status, 401);
});

test("workshop moves the job through the bay and the camera follows it", async () => {
  await call("PUT", "/integration/v1/bays/BAY-03", { body: { name: "Bay 03", cameraStreamUrl: `${upstreamUrl}/cam/bay03/index.m3u8` } });
  const assigned = await call("PATCH", `/integration/v1/job-cards/${state.number}/assignment`, {
    body: { bayCode: "BAY-03", mechanicCode: "MEC-RAHUL", riderCode: "RID-ARJUN", odometerKm: 18240 },
  });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
  assert.equal(assigned.data.mechanic.name, "Rahul M.");

  assert.equal((await call("GET", `/v1/bookings/${state.bookingId}/camera`, { token: state.token })).status, 409, "no camera before the bike is in");

  for (const status of ["rider_assigned", "picked_up", "at_workshop", "in_service"]) {
    const res = await call("PUT", `/integration/v1/job-cards/${state.number}/status`, { body: { status } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
  }
  const back = await call("PUT", `/integration/v1/job-cards/${state.number}/status`, { body: { status: "booked" } });
  assert.equal(back.status, 409, "moving backwards needs force");

  const booking = await call("GET", `/v1/bookings/${state.bookingId}`, { token: state.token });
  assert.equal(booking.data.stage, 4);
  assert.equal(booking.data.cameraAvailable, true);
  assert.deepEqual(booking.data.timeline.map((t: Json) => t.status), ["booked", "rider_assigned", "picked_up", "at_workshop", "in_service"]);

  const camera = await call("GET", `/v1/bookings/${state.bookingId}/camera`, { token: state.token });
  assert.equal(camera.status, 200);
  const path = new URL(camera.data.playbackUrl).pathname;
  const playlist = await app.request(path);
  assert.equal(playlist.status, 200);
  assert.match(await playlist.text(), /seg1\.ts/);
  const segment = await app.request(path.replace("index.m3u8", "seg1.ts"));
  assert.equal(await segment.text(), "segment");
  assert.notEqual((await app.request(path.replace("index.m3u8", "..%2F..%2Fhook"))).status, 200, "cannot escape the stream directory");
  assert.equal((await app.request("/v1/camera/not-a-token/index.m3u8")).status, 403);
});

test("extra parts need the customer's approval", async () => {
  for (const [partName, amount] of [["Front brake pads", 650], ["Chain clean and tension", 199]] as const) {
    const res = await call("POST", `/integration/v1/job-cards/${state.number}/extras`, { body: { partName, amount, note: "Worn", raisedByLabel: "Amit, Bay 03" } });
    assert.equal(res.status, 201, JSON.stringify(res.data));
  }
  const booking = await call("GET", `/v1/bookings/${state.bookingId}`, { token: state.token });
  const [pads, chain] = booking.data.extras;
  assert.equal(pads.status, "pending");

  const closedEarly = await call("POST", `/integration/v1/job-cards/${state.number}/close`, { body: {} });
  assert.equal(closedEarly.status, 409, "cannot close with undecided parts");

  await call("POST", `/v1/bookings/${state.bookingId}/extras/${pads.id}/decision`, { token: state.token, body: { approve: true } });
  const decided = await call("POST", `/v1/bookings/${state.bookingId}/extras/${chain.id}/decision`, { token: state.token, body: { approve: false } });
  assert.deepEqual(decided.data.extras.map((e: Json) => e.status), ["approved", "declined"]);
  assert.equal((await call("POST", `/v1/bookings/${state.bookingId}/extras/${chain.id}/decision`, { token: state.token, body: { approve: true } })).status, 409);

  const bill = await call("GET", `/v1/bookings/${state.bookingId}/bill`, { token: state.token });
  assert.equal(bill.data.taxable, 1999);
  assert.equal(bill.data.total, 1999 + 360);

  await call("POST", `/integration/v1/job-cards/${state.number}/media`, { body: { kind: "note", caption: "Pads replaced, test ride done" } });
});

test("closing issues the invoice; wallet plus UPI pays it", async () => {
  const closed = await call("POST", `/integration/v1/job-cards/${state.number}/close`, { body: {} });
  assert.equal(closed.status, 200, JSON.stringify(closed.data));
  assert.equal(closed.data.status, "job_closed");
  assert.ok(closed.data.invoiceId);

  const bill = await call("GET", `/v1/bookings/${state.bookingId}/bill`, { token: state.token });
  assert.equal(bill.data.kind, "due");
  assert.equal(bill.data.total, 2359);

  const me = await call("GET", "/v1/me", { token: state.token });
  await call("POST", `/integration/v1/customers/${me.data.id}/wallet`, { body: { amount: 100, kind: "cashback", title: "Goodwill credit" } });
  assert.equal((await call("POST", `/v1/bookings/${state.bookingId}/pay`, { token: state.token, body: { walletAmount: 500, method: "upi" } })).status, 400, "cannot spend more than the wallet");

  const paid = await call("POST", `/v1/bookings/${state.bookingId}/pay`, { token: state.token, body: { walletAmount: 100, method: "upi" } });
  assert.equal(paid.status, 200, JSON.stringify(paid.data));
  assert.equal(paid.data.invoice.status, "open");
  assert.equal(paid.data.invoice.walletAmount, 100);
  assert.equal(paid.data.pendingPayment.amount, 2259);

  const confirmed = await call("PUT", `/integration/v1/payments/${paid.data.pendingPayment.id}`, { body: { status: "succeeded", providerReference: "UPI-523418907211" } });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.status, "paid");
  assert.equal(confirmed.data.balanceDue, 0);
  assert.equal(confirmed.data.number, state.number.replace("BS-", "INV-"));

  const invoices = await call("GET", "/v1/invoices", { token: state.token });
  assert.equal(invoices.data.length, 1);
  assert.equal((await call("GET", "/v1/wallet", { token: state.token })).data.balance, 0);
});

test("delivery pays both sides of the referral and the review goes to the CRM", async () => {
  const delivered = await call("PUT", `/integration/v1/job-cards/${state.number}/status`, { body: { status: "delivered" } });
  assert.equal(delivered.status, 200);
  assert.equal((await call("GET", "/v1/wallet", { token: state.token })).data.balance, 200);
  assert.equal((await call("GET", "/v1/wallet", { token: state.referrer.accessToken })).data.balance, 200);
  const referral = await call("GET", "/v1/referral", { token: state.referrer.accessToken });
  assert.equal(referral.data.referrals[0].status, "rewarded");

  const vehicle = await call("GET", `/v1/vehicles/${state.vehicleId}`, { token: state.token });
  assert.equal(vehicle.data.odometerKm, 18240, "odometer recorded at intake is copied on delivery");

  const review = { stars: 5, tags: ["On time"], workVotes: { "General service": "up" }, staffVote: "up", followUpInterests: ["Chain clean soon"] };
  assert.equal((await call("POST", `/v1/bookings/${state.bookingId}/review`, { token: state.token, body: review })).status, 201);
  assert.equal((await call("POST", `/v1/bookings/${state.bookingId}/review`, { token: state.token, body: review })).status, 409);

  const history = await call("GET", `/v1/vehicles/${state.vehicleId}/history`, { token: state.token });
  assert.equal(history.data[0].status, "delivered");
});

test("notifications follow the job", async () => {
  const list = await call("GET", "/v1/notifications", { token: state.token });
  assert.ok(list.data.unread >= 6, `unread ${list.data.unread}`);
  assert.ok(list.data.items.some((n: Json) => n.targetScreen === "Part approval"));
  await call("POST", "/v1/notifications/read", { token: state.token, body: {} });
  assert.equal((await call("GET", "/v1/notifications", { token: state.token })).data.unread, 0);
});

test("events are ordered, pullable and delivered as signed webhooks", async () => {
  const page = await call("GET", "/integration/v1/events?limit=500");
  const types: string[] = page.data.items.map((e: Json) => e.type);
  for (const type of ["customer.created", "vehicle.created", "booking.created", "job_card.assigned", "job_card.status_changed", "job_card.extra_raised",
    "job_card.extra_decided", "job_card.closed", "payment.pending", "payment.succeeded", "invoice.paid", "referral.rewarded", "review.submitted"]) {
    assert.ok(types.includes(type), `missing ${type}`);
  }
  assert.ok(types.indexOf("booking.created") < types.indexOf("job_card.closed"));
  const filtered = await call("GET", "/integration/v1/events?types=invoice.paid");
  assert.equal(filtered.data.items.length, 1);
  const closed = page.data.items.find((e: Json) => e.type === "job_card.closed");
  assert.equal(closed.payload.invoice.gstAmount, 360);
  const invoice = await call("GET", `/integration/v1/invoices/${closed.payload.invoice.id}`);
  assert.equal(invoice.data.status, "paid");

  while ((await deliverWebhooks(db, config)) > 0);
  assert.equal(received.length, page.data.items.length);
  const first = received[0];
  const [t, v1] = String(first.headers["x-bikesurgeon-signature"]).split(",").map((part) => part.split("=")[1]);
  assert.equal(v1, createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${first.body}`).digest("hex"));
  assert.equal(JSON.parse(first.body).type, "customer.created");
});

test("pull sync, ID mapping and walk-in bookings", async () => {
  const jobs = await call("GET", "/integration/v1/job-cards?limit=1");
  assert.equal(jobs.data.items.length, 1);
  assert.ok(jobs.data.nextUpdatedSince);

  const ref = await call("PUT", "/integration/v1/external-refs", { body: { entityType: "job_card", entityId: state.bookingId, system: "erp", externalId: "JC-88812" } });
  assert.equal(ref.status, 200);
  const found = await call("GET", "/integration/v1/external-refs?system=erp&externalId=JC-88812");
  assert.equal(found.data[0].entityId, state.bookingId);

  const walkIn = await call("POST", "/integration/v1/job-cards", {
    body: {
      source: "walk_in",
      customer: { phone: "9000000003", name: "Walk-in Rider" },
      vehicle: { registrationNumber: "KA17CD5678", make: "Honda", model: "Shine", bodyType: "commuter" },
      serviceIds: ["oil"],
      slotStart: tomorrow(9),
      slotEnd: tomorrow(10),
    },
  });
  assert.equal(walkIn.status, 201, JSON.stringify(walkIn.data));
  assert.equal(walkIn.data.source, "walk_in");
  assert.equal(walkIn.data.customer.name, "Walk-in Rider");

  const walkInRider = await signIn("9000000003");
  assert.equal(walkInRider.isNewCustomer, false, "the walk-in customer finds the booking when they install the app");
  const bookings = await call("GET", "/v1/bookings", { token: walkInRider.accessToken });
  assert.equal(bookings.data[0].number, walkIn.data.number);

  const customer = await call("GET", "/integration/v1/customers/9000000003");
  assert.equal(customer.data.vehicles[0].registrationNumber, "KA17CD5678");
});

test("cancelling and deleting an account", async () => {
  const rider = await signIn("9000000004");
  const vehicle = await call("POST", "/v1/vehicles", { token: rider.accessToken, body: { registrationNumber: "KA17EF0001", make: "TVS", model: "Jupiter", bodyType: "scooter" } });
  const booking = await call("POST", "/v1/bookings", {
    token: rider.accessToken,
    body: { vehicleId: vehicle.data.id, serviceIds: ["wash"], mode: "visit", slotStart: tomorrow(11), slotEnd: tomorrow(12) },
  });
  assert.equal((await call("DELETE", "/v1/me", { token: rider.accessToken })).status, 400, "open bookings block deletion");
  const cancelled = await call("POST", `/v1/bookings/${booking.data.id}/cancel`, { token: rider.accessToken, body: { reason: "Plans changed" } });
  assert.equal(cancelled.data.status, "cancelled");
  assert.equal((await call("DELETE", "/v1/me", { token: rider.accessToken })).status, 200);
  assert.equal((await call("POST", "/v1/auth/refresh", { body: { refreshToken: rider.refreshToken } })).status, 401);
});

test("db:check reports a missing column", async () => {
  await db.query(`ALTER TABLE ${SCHEMA}.reviews DROP COLUMN note`);
  const run = promisify(execFile);
  const result = await run("npx", ["tsx", "scripts/check-schema.ts"], { cwd: BACKEND_ROOT, env: { ...process.env, DB_SCHEMA: SCHEMA } }).then(
    () => ({ code: 0, stdout: "" }),
    (error: { code: number; stdout: string }) => ({ code: error.code, stdout: error.stdout }),
  );
  assert.equal(result.code, 1);
  assert.match(result.stdout, /MISSING COLUMNS reviews: note/);
});
