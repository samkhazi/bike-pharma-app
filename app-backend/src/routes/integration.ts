import { createRoute, z } from "@hono/zod-openapi";
import { requireIntegrationKey } from "../auth.js";
import { JOB_STATUSES } from "../domain.js";
import * as S from "../schemas.js";
import { confirmPayment, getInvoice, recordPayment } from "../services/billing.js";
import { addMedia, assign, closeJob, decideExtras, getBookingByRef, listBookingsUpdatedSince, raiseExtra, updateStatus } from "../services/bookings.js";
import { upsertBay, upsertOffer, upsertService, upsertStaff } from "../services/catalog.js";
import { addWalletTransaction } from "../services/customers.js";
import { EVENT_TYPES, listEvents } from "../services/events.js";
import {
  createBookingFromIntegration,
  findExternalRefs,
  getCustomerForIntegration,
  listCustomersUpdatedSince,
  putExternalRef,
} from "../services/integration.js";
import { notify } from "../services/notifications.js";
import { addWarranty, getVehicle, upsertDocument, upsertMaintenance } from "../services/vehicles.js";
import { apiKey, body, errors, json, type App, type Deps } from "./shared.js";

const JobRef = z.object({ ref: z.string().openapi({ description: "Job card number (BS-2026-000124) or id", example: "BS-2026-000124" }) });
const Code = z.object({ code: z.string().min(1).max(40) });
const Page = z.object({
  updatedSince: z.iso.datetime({ offset: true }).optional().openapi({ description: "Start of a sync: return records changed after this time." }),
  cursor: z.string().max(200).optional().openapi({ description: "Pass nextCursor from the previous page to get the next one. Keep the same updatedSince and filters." }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export function registerIntegrationRoutes(app: App, { db, config }: Deps) {
  const secured = { security: apiKey, middleware: requireIntegrationKey(config) } as const;
  const tags = (tag: string) => [`Integration: ${tag}`];

  // ---------------------------------------------------------------- job cards

  app.openapi(
    createRoute({
      method: "get", path: "/integration/v1/job-cards", tags: tags("Job cards"), summary: "Job cards changed since a point in time (pull sync)", ...secured,
      request: { query: Page.extend({ status: z.enum(JOB_STATUSES).optional() }) },
      responses: { 200: json(S.IntegrationBookingPage, "Page of job cards, oldest change first"), ...errors },
    }),
    async (c) => {
      const q = c.req.valid("query");
      return c.json(await listBookingsUpdatedSince(db, { since: q.updatedSince ?? null, cursor: q.cursor }, q.limit, q.status), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/job-cards", tags: tags("Job cards"), summary: "Create a walk-in or phone booking so it shows in the customer's app", ...secured,
      description: "Finds or creates the customer by phone and the vehicle by registration number, then opens a job card.",
      request: body(S.IntegrationBookingCreate), responses: { 201: json(S.IntegrationBooking, "Created"), ...errors },
    }),
    async (c) => c.json(await createBookingFromIntegration(db, config, c.req.valid("json")), 201),
  );

  app.openapi(
    createRoute({ method: "get", path: "/integration/v1/job-cards/{ref}", tags: tags("Job cards"), summary: "One job card", ...secured, request: { params: JobRef }, responses: { 200: json(S.IntegrationBooking, "Job card"), ...errors } }),
    async (c) => c.json(await getBookingByRef(db, c.req.valid("param").ref), 200),
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/job-cards/{ref}/status", tags: tags("Job cards"), summary: "Move the job card to a new stage (drives the customer's tracker)", ...secured,
      description: "Moving to job_closed or delivered issues the invoice if there is none yet. Moving backwards needs force: true.",
      request: { params: JobRef, ...body(S.StatusUpdate) }, responses: { 200: json(S.IntegrationBooking, "Updated"), ...errors },
    }),
    async (c) => c.json(await updateStatus(db, config, c.req.valid("param").ref, c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "patch", path: "/integration/v1/job-cards/{ref}/assignment", tags: tags("Job cards"), summary: "Assign bay, advisor, mechanic, rider; set ready-by time or move the slot", ...secured,
      request: { params: JobRef, ...body(S.Assignment) }, responses: { 200: json(S.IntegrationBooking, "Updated"), ...errors },
    }),
    async (c) => c.json(await assign(db, config, c.req.valid("param").ref, c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/job-cards/{ref}/extras", tags: tags("Job cards"), summary: "Raise an extra part for the customer to approve", ...secured,
      request: { params: JobRef, ...body(S.ExtraCreate) }, responses: { 201: json(S.IntegrationBooking, "Raised; the customer is notified"), ...errors },
    }),
    async (c) => c.json(await raiseExtra(db, c.req.valid("param").ref, c.req.valid("json")), 201),
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/job-cards/{ref}/extras/{extraId}", tags: tags("Job cards"), summary: "Record a decision the customer gave the advisor by phone", ...secured,
      request: { params: JobRef.extend({ extraId: z.uuid() }), ...body(S.IntegrationExtraDecision) }, responses: { 200: json(S.IntegrationBooking, "Updated"), ...errors },
    }),
    async (c) => {
      const { ref, extraId } = c.req.valid("param");
      const input = c.req.valid("json");
      const { id } = await getBookingByRef(db, ref);
      await decideExtras(db, null, id, [extraId], input.status === "approved", input.via);
      return c.json(await getBookingByRef(db, id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/job-cards/{ref}/media", tags: tags("Job cards"), summary: "Attach a photo, video or note from the bay", ...secured,
      request: { params: JobRef, ...body(S.MediaCreate) }, responses: { 201: json(S.IntegrationBooking, "Attached"), ...errors },
    }),
    async (c) => c.json(await addMedia(db, c.req.valid("param").ref, c.req.valid("json")), 201),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/job-cards/{ref}/close", tags: tags("Job cards"), summary: "Close the job card and issue the invoice", ...secured,
      request: { params: JobRef, ...body(S.CloseJob) }, responses: { 200: json(S.IntegrationBooking, "Closed"), ...errors },
    }),
    async (c) => c.json(await closeJob(db, config, c.req.valid("param").ref, c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/job-cards/{ref}/payments", tags: tags("Payments"), summary: "Record money the workshop collected (cash or UPI at the door, card at the counter)", ...secured,
      request: { params: JobRef, ...body(S.PaymentRecord) }, responses: { 201: json(S.Invoice, "Recorded"), ...errors },
    }),
    async (c) => {
      const { id } = await getBookingByRef(db, c.req.valid("param").ref);
      return c.json(await recordPayment(db, id, c.req.valid("json")), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/integration/v1/invoices/{id}", tags: tags("Payments"), summary: "One invoice with lines, GST and payments", ...secured,
      request: { params: z.object({ id: z.uuid() }) }, responses: { 200: json(S.Invoice, "Invoice"), ...errors },
    }),
    async (c) => c.json(await getInvoice(db, c.req.valid("param").id, null), 200),
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/payments/{id}", tags: tags("Payments"), summary: "Confirm or fail a pending online payment", ...secured,
      request: { params: z.object({ id: z.uuid() }), ...body(S.PaymentConfirm) }, responses: { 200: json(S.Invoice, "Updated invoice"), ...errors },
    }),
    async (c) => c.json(await confirmPayment(db, c.req.valid("param").id, c.req.valid("json")), 200),
  );

  // ---------------------------------------------------------------- customers

  app.openapi(
    createRoute({
      method: "get", path: "/integration/v1/customers", tags: tags("Customers"), summary: "Customers changed since a point in time, with vehicles and wallet balance", ...secured,
      request: { query: Page }, responses: { 200: json(S.IntegrationCustomerPage, "Page of customers"), ...errors },
    }),
    async (c) => {
      const q = c.req.valid("query");
      return c.json(await listCustomersUpdatedSince(db, { since: q.updatedSince ?? null, cursor: q.cursor }, q.limit), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/integration/v1/customers/{ref}", tags: tags("Customers"), summary: "One customer by id or phone number", ...secured,
      request: { params: z.object({ ref: z.string().openapi({ example: "+919876543210" }) }) }, responses: { 200: json(S.IntegrationCustomer, "Customer"), ...errors },
    }),
    async (c) => c.json(await getCustomerForIntegration(db, c.req.valid("param").ref), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/customers/{id}/wallet", tags: tags("Customers"), summary: "Credit or debit workshop credit (refunds, cashback, corrections)", ...secured,
      request: { params: z.object({ id: z.uuid() }), ...body(S.WalletAdjustment) }, responses: { 201: json(S.Ok, "Recorded"), ...errors },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      await getCustomerForIntegration(db, id);
      await addWalletTransaction(db, { customerId: id, ...c.req.valid("json") });
      return c.json({ ok: true as const }, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/notifications", tags: tags("Customers"), summary: "Send a notification (reminders, campaigns) to a customer's app", ...secured,
      request: body(S.NotificationCreate), responses: { 201: json(z.object({ id: z.uuid() }), "Queued; pushed by the worker if push is configured"), ...errors },
    }),
    async (c) => {
      const input = c.req.valid("json");
      await getCustomerForIntegration(db, input.customerId);
      return c.json({ id: await notify(db, input) }, 201);
    },
  );

  // ---------------------------------------------------------------- vehicles

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/vehicles/{id}/documents/{kind}", tags: tags("Vehicles"), summary: "Set insurance, PUC or RC details", ...secured,
      request: { params: z.object({ id: z.uuid(), kind: z.enum(["rc", "insurance", "puc"]) }), ...body(S.VehicleDocumentInput) },
      responses: { 200: json(S.VehicleDocument, "Saved"), ...errors },
    }),
    async (c) => {
      const { id, kind } = c.req.valid("param");
      await getVehicle(db, id, null);
      return c.json(await upsertDocument(db, id, kind, c.req.valid("json")), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/integration/v1/vehicles/{id}/warranties", tags: tags("Vehicles"), summary: "Register a warranty (bike, battery, tyres, parts fitted)", ...secured,
      request: { params: z.object({ id: z.uuid() }), ...body(S.WarrantyInput) }, responses: { 201: json(S.Warranty, "Created"), ...errors },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      await getVehicle(db, id, null);
      return c.json(await addWarranty(db, id, c.req.valid("json")), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/vehicles/{id}/maintenance/{item}", tags: tags("Vehicles"), summary: "Set when a wear item was last done and its interval", ...secured,
      request: { params: z.object({ id: z.uuid(), item: z.string().min(1).max(60) }), ...body(S.MaintenanceItem.omit({ item: true })) },
      responses: { 200: json(S.Ok, "Saved"), ...errors },
    }),
    async (c) => {
      const { id, item } = c.req.valid("param");
      await getVehicle(db, id, null);
      await upsertMaintenance(db, id, item, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- master data owned by the ERP

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/staff/{code}", tags: tags("Master data"), summary: "Create or update an advisor, mechanic or rider by employee code", ...secured,
      request: { params: Code, ...body(S.StaffUpsert) }, responses: { 200: json(S.Ok, "Saved"), ...errors },
    }),
    async (c) => {
      await upsertStaff(db, config, c.req.valid("param").code, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/bays/{code}", tags: tags("Master data"), summary: "Create or update a bay and its camera stream URL", ...secured,
      request: { params: Code, ...body(S.BayUpsert) }, responses: { 200: json(S.Ok, "Saved"), ...errors },
    }),
    async (c) => {
      await upsertBay(db, config, c.req.valid("param").code, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/services/{code}", tags: tags("Master data"), summary: "Create or update a bookable service and its price", ...secured,
      request: { params: Code, ...body(S.ServiceUpsert) }, responses: { 200: json(S.Ok, "Saved"), ...errors },
    }),
    async (c) => {
      await upsertService(db, c.req.valid("param").code, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/offers/{code}", tags: tags("Master data"), summary: "Create, update or end an offer", ...secured,
      request: { params: Code, ...body(S.OfferUpsert) }, responses: { 200: json(S.Ok, "Saved"), ...errors },
    }),
    async (c) => {
      await upsertOffer(db, c.req.valid("param").code, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- id mapping and events

  app.openapi(
    createRoute({
      method: "put", path: "/integration/v1/external-refs", tags: tags("Sync"), summary: "Link one of our records to its id in your CRM/ERP", ...secured,
      request: body(S.ExternalReference), responses: { 200: json(S.ExternalReference, "Saved"), ...errors },
    }),
    async (c) => c.json(await putExternalRef(db, c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "get", path: "/integration/v1/external-refs", tags: tags("Sync"), summary: "Look up links in either direction", ...secured,
      request: { query: S.ExternalReference.partial() }, responses: { 200: json(z.array(S.ExternalReference), "Matches"), ...errors },
    }),
    async (c) => c.json(await findExternalRefs(db, c.req.valid("query")), 200),
  );

  app.openapi(
    createRoute({
      method: "get", path: "/integration/v1/events", tags: tags("Sync"), summary: "Read the event log in order (alternative or backup to webhooks)", ...secured,
      request: {
        query: z.object({
          after: z.coerce.number().int().min(0).default(0).openapi({ description: "Last event id you processed" }),
          limit: z.coerce.number().int().min(1).max(500).default(100),
          types: z.string().optional().openapi({ description: `Comma-separated filter. One of: ${EVENT_TYPES.join(", ")}` }),
        }),
      },
      responses: { 200: json(S.IntegrationEventPage, "Events, oldest first"), ...errors },
    }),
    async (c) => {
      const q = c.req.valid("query");
      return c.json(await listEvents(db, q.after, q.limit, q.types?.split(",").map((t) => t.trim()).filter(Boolean)), 200);
    },
  );
}
