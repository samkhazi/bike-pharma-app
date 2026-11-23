import { createRoute, z } from "@hono/zod-openapi";
import { refreshSession, requestOtp, requireCustomer, revokeSession, signCameraToken, verifyOtp } from "../auth.js";
import { one, tx } from "../db.js";
import { CAMERA_STATUSES, normalizePlate } from "../domain.js";
import { AppError, conflict } from "../errors.js";
import * as S from "../schemas.js";
import { billFor, getInvoice, listInvoices, pay } from "../services/billing.js";
import { cancelBooking, createBooking, decideExtras, forCustomer, getBooking, listBookings, setPayAtDelivery } from "../services/bookings.js";
import { listOffers, listServices, getWorkshop } from "../services/catalog.js";
import * as customers from "../services/customers.js";
import { submitReview } from "../services/integration.js";
import { listNotifications, markRead } from "../services/notifications.js";
import * as vehicles from "../services/vehicles.js";
import { bearer, body, errors, json, type App, type Deps } from "./shared.js";

const IdParam = z.object({ id: z.uuid() });

export function registerCustomerRoutes(app: App, { db, config, providers }: Deps) {
  const auth = requireCustomer(config);
  const secured = { security: bearer, middleware: auth } as const;

  // ---------------------------------------------------------------- auth

  app.openapi(
    createRoute({
      method: "post", path: "/v1/auth/otp/request", tags: ["Auth"], summary: "Send a login code by SMS or WhatsApp",
      request: body(S.OtpRequest),
      responses: { 200: json(S.OtpRequested, "Code sent"), 429: json(S.ErrorBody, "Too many codes requested"), ...errors },
    }),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(await requestOtp(db, config, providers, input.phone, input.channel), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/auth/otp/verify", tags: ["Auth"], summary: "Exchange the code for a session; creates the account on first login",
      request: body(S.OtpVerify),
      responses: { 200: json(S.Session, "Signed in"), 429: json(S.ErrorBody, "Too many wrong codes"), ...errors },
    }),
    async (c) => c.json(await verifyOtp(db, config, c.req.valid("json"), c.req.header("user-agent") ?? null), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/auth/refresh", tags: ["Auth"], summary: "Rotate the refresh token and get a new access token",
      request: body(S.RefreshRequest),
      responses: { 200: json(z.object({ accessToken: z.string(), refreshToken: z.string(), expiresInSeconds: z.number().int() }), "New tokens"), ...errors },
    }),
    async (c) => c.json(await refreshSession(db, config, c.req.valid("json").refreshToken, c.req.header("user-agent") ?? null), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/auth/logout", tags: ["Auth"], summary: "Revoke a refresh token",
      request: body(S.RefreshRequest),
      responses: { 200: json(S.Ok, "Signed out"), ...errors },
    }),
    async (c) => {
      await revokeSession(db, c.req.valid("json").refreshToken);
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- profile

  app.openapi(
    createRoute({ method: "get", path: "/v1/me", tags: ["Profile"], summary: "The signed-in customer", ...secured, responses: { 200: json(S.Customer, "Customer"), ...errors } }),
    async (c) => c.json(await customers.getCustomer(db, c.get("customerId")), 200),
  );

  app.openapi(
    createRoute({
      method: "patch", path: "/v1/me", tags: ["Profile"], summary: "Update name, email, language or backup contact", ...secured,
      request: body(S.CustomerUpdate), responses: { 200: json(S.Customer, "Updated customer"), ...errors },
    }),
    async (c) => c.json(await customers.updateCustomer(db, c.get("customerId"), c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "delete", path: "/v1/me", tags: ["Profile"], summary: "Delete the account (scrubs personal data, keeps invoices)", ...secured,
      responses: { 200: json(S.Ok, "Deleted"), ...errors },
    }),
    async (c) => {
      await tx(db, (client) => customers.deleteCustomer(client, c.get("customerId")));
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/me/addresses", tags: ["Profile"], summary: "Saved pickup addresses", ...secured, responses: { 200: json(z.array(S.Address), "Addresses"), ...errors } }),
    async (c) => c.json(await customers.listAddresses(db, c.get("customerId")), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/me/addresses", tags: ["Profile"], summary: "Save an address (replaces one with the same label)", ...secured,
      request: body(S.AddressInput), responses: { 201: json(S.Address, "Saved"), ...errors },
    }),
    async (c) => c.json(await tx(db, (client) => customers.saveAddress(client, c.get("customerId"), c.req.valid("json"))), 201),
  );

  app.openapi(
    createRoute({
      method: "delete", path: "/v1/me/addresses/{id}", tags: ["Profile"], summary: "Remove an address", ...secured,
      request: { params: IdParam }, responses: { 200: json(S.Ok, "Removed"), ...errors },
    }),
    async (c) => {
      await customers.deleteAddress(db, c.get("customerId"), c.req.valid("param").id);
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/me/devices", tags: ["Profile"], summary: "Register this phone for push notifications", ...secured,
      request: body(S.DeviceInput), responses: { 200: json(S.Ok, "Registered"), ...errors },
    }),
    async (c) => {
      await customers.registerDevice(db, c.get("customerId"), c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete", path: "/v1/me/devices", tags: ["Profile"], summary: "Stop push notifications to a device (call on logout)", ...secured,
      request: { query: z.object({ token: z.string().min(8) }) }, responses: { 200: json(S.Ok, "Removed"), ...errors },
    }),
    async (c) => {
      await customers.removeDevice(db, c.get("customerId"), c.req.valid("query").token);
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- catalogue

  app.openapi(
    createRoute({ method: "get", path: "/v1/workshop", tags: ["Catalogue"], summary: "Workshop contact details, advisor and roadside number", responses: { 200: json(S.Workshop, "Workshop"), ...errors } }),
    async (c) => c.json(await getWorkshop(db, config), 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/services", tags: ["Catalogue"], summary: "Bookable services and their prices (before GST)", responses: { 200: json(z.array(S.Service), "Services"), ...errors } }),
    async (c) => c.json(await listServices(db), 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/offers", tags: ["Catalogue"], summary: "Offers that are live today", responses: { 200: json(z.array(S.Offer), "Offers"), ...errors } }),
    async (c) => c.json(await listOffers(db, config), 200),
  );

  // ---------------------------------------------------------------- vehicles

  app.openapi(
    createRoute({ method: "get", path: "/v1/vehicles", tags: ["Garage"], summary: "The customer's vehicles", ...secured, responses: { 200: json(z.array(S.Vehicle), "Vehicles"), ...errors } }),
    async (c) => c.json((await vehicles.listVehicles(db, [c.get("customerId")])).map(({ customerId: _c, ...v }) => v), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/vehicles", tags: ["Garage"], summary: "Add a vehicle", ...secured,
      request: body(S.VehicleInput), responses: { 201: json(S.Vehicle, "Added"), ...errors },
    }),
    async (c) => c.json(await vehicles.createVehicle(db, c.get("customerId"), c.req.valid("json")), 201),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/vehicles/lookup", tags: ["Garage"], summary: "Fill in make, model and year from the registration (RC) number", ...secured,
      request: body(S.VehicleLookup),
      responses: { 200: json(S.VehicleLookupResult, "Found"), 501: json(S.ErrorBody, "No lookup provider configured"), 502: json(S.ErrorBody, "Lookup provider failed"), ...errors },
    }),
    async (c) => {
      const plate = normalizePlate(c.req.valid("json").registrationNumber);
      const result = await providers.vehicleLookup.lookup(plate);
      if (!result) throw new AppError(404, "not_found_in_registry", "We could not find that number. Enter the details yourself.");
      return c.json(result, 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/vehicles/{id}", tags: ["Garage"], summary: "One vehicle", ...secured, request: { params: IdParam }, responses: { 200: json(S.Vehicle, "Vehicle"), ...errors } }),
    async (c) => {
      const { customerId: _c, ...vehicle } = await vehicles.getVehicle(db, c.req.valid("param").id, c.get("customerId"));
      return c.json(vehicle, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "patch", path: "/v1/vehicles/{id}", tags: ["Garage"], summary: "Update colour, odometer and other details", ...secured,
      request: { params: IdParam, ...body(S.VehicleUpdate) }, responses: { 200: json(S.Vehicle, "Updated"), ...errors },
    }),
    async (c) => c.json(await vehicles.updateVehicle(db, c.req.valid("param").id, c.get("customerId"), c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "delete", path: "/v1/vehicles/{id}", tags: ["Garage"], summary: "Remove a vehicle from the garage (history is kept)", ...secured,
      request: { params: IdParam }, responses: { 200: json(S.Ok, "Removed"), ...errors },
    }),
    async (c) => {
      await vehicles.archiveVehicle(db, c.req.valid("param").id, c.get("customerId"));
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "put", path: "/v1/vehicles/{id}/documents/{kind}", tags: ["Garage"], summary: "Save RC, insurance or PUC details (upload the photo elsewhere and pass its URL)", ...secured,
      request: { params: z.object({ id: z.uuid(), kind: z.enum(["rc", "insurance", "puc"]) }), ...body(S.VehicleDocumentInput) },
      responses: { 200: json(S.VehicleDocument, "Saved"), ...errors },
    }),
    async (c) => {
      const { id, kind } = c.req.valid("param");
      await vehicles.getVehicle(db, id, c.get("customerId"));
      return c.json(await vehicles.upsertDocument(db, id, kind, c.req.valid("json")), 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/vehicles/{id}/warranties", tags: ["Garage"], summary: "Warranties for the bike and parts fitted", ...secured, request: { params: IdParam }, responses: { 200: json(z.array(S.Warranty), "Warranties"), ...errors } }),
    async (c) => {
      const { id } = c.req.valid("param");
      await vehicles.getVehicle(db, id, c.get("customerId"));
      return c.json(await vehicles.listWarranties(db, id), 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/vehicles/{id}/maintenance", tags: ["Garage"], summary: "Kilometre-based wear items (oil, chain, pads)", ...secured, request: { params: IdParam }, responses: { 200: json(z.array(S.MaintenanceItem), "Items"), ...errors } }),
    async (c) => {
      const { id } = c.req.valid("param");
      await vehicles.getVehicle(db, id, c.get("customerId"));
      return c.json(await vehicles.listMaintenance(db, id), 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/vehicles/{id}/history", tags: ["Garage"], summary: "Every job card for this vehicle, newest first", ...secured, request: { params: IdParam }, responses: { 200: json(z.array(S.Booking), "Service history"), ...errors } }),
    async (c) => {
      const { id } = c.req.valid("param");
      await vehicles.getVehicle(db, id, c.get("customerId"));
      return c.json((await listBookings(db, c.get("customerId"), id)).map(forCustomer), 200);
    },
  );

  // ---------------------------------------------------------------- bookings

  app.openapi(
    createRoute({ method: "get", path: "/v1/bookings", tags: ["Bookings"], summary: "All bookings (job cards), newest first", ...secured, responses: { 200: json(z.array(S.Booking), "Bookings"), ...errors } }),
    async (c) => c.json((await listBookings(db, c.get("customerId"))).map(forCustomer), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings", tags: ["Bookings"], summary: "Book a service. Creates a job card the service advisor sees like any other booking.", ...secured,
      request: body(S.BookingCreate), responses: { 201: json(S.Booking, "Booked"), ...errors },
    }),
    async (c) => c.json(forCustomer(await createBooking(db, config, c.get("customerId"), c.req.valid("json"))), 201),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/bookings/{id}", tags: ["Bookings"], summary: "One booking with live status, extras and timeline", ...secured, request: { params: IdParam }, responses: { 200: json(S.Booking, "Booking"), ...errors } }),
    async (c) => c.json(forCustomer(await getBooking(db, c.req.valid("param").id, c.get("customerId"))), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings/{id}/cancel", tags: ["Bookings"], summary: "Cancel before pickup", ...secured,
      request: { params: IdParam, ...body(S.CancelRequest) }, responses: { 200: json(S.Booking, "Cancelled"), ...errors },
    }),
    async (c) => c.json(forCustomer(await cancelBooking(db, c.get("customerId"), c.req.valid("param").id, c.req.valid("json").reason)), 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/bookings/{id}/bill", tags: ["Bookings"], summary: "Estimate before the job card closes, invoice after", ...secured, request: { params: IdParam }, responses: { 200: json(S.Bill, "Bill"), ...errors } }),
    async (c) => c.json(await billFor(db, forCustomer(await getBooking(db, c.req.valid("param").id, c.get("customerId"))), config.GST_RATE), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings/{id}/extras/{extraId}/decision", tags: ["Bookings"], summary: "Approve or decline one extra part", ...secured,
      request: { params: z.object({ id: z.uuid(), extraId: z.uuid() }), ...body(S.ExtraDecision) }, responses: { 200: json(S.Booking, "Updated booking"), ...errors },
    }),
    async (c) => {
      const { id, extraId } = c.req.valid("param");
      return c.json(forCustomer(await decideExtras(db, c.get("customerId"), id, [extraId], c.req.valid("json").approve, "app")), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings/{id}/extras/approve-all", tags: ["Bookings"], summary: "Approve every pending extra part", ...secured,
      request: { params: IdParam }, responses: { 200: json(S.Booking, "Updated booking"), ...errors },
    }),
    async (c) => c.json(forCustomer(await decideExtras(db, c.get("customerId"), c.req.valid("param").id, "all-pending", true, "app")), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings/{id}/pay", tags: ["Payments"], summary: "Pay the invoice: wallet first, then UPI/card/net banking", ...secured,
      request: { params: IdParam, ...body(S.PayRequest) }, responses: { 200: json(S.PayResult, "Payment recorded"), ...errors },
    }),
    async (c) => c.json(await pay(db, c.get("customerId"), c.req.valid("param").id, c.req.valid("json")), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings/{id}/pay-at-delivery", tags: ["Payments"], summary: "Pay the rider in cash or UPI when the bike comes back", ...secured,
      request: { params: IdParam }, responses: { 200: json(S.Booking, "Updated booking"), ...errors },
    }),
    async (c) => c.json(forCustomer(await setPayAtDelivery(db, c.get("customerId"), c.req.valid("param").id)), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/bookings/{id}/review", tags: ["Bookings"], summary: "Rate a finished service", ...secured,
      request: { params: IdParam, ...body(S.ReviewInput) }, responses: { 201: json(S.Ok, "Saved"), ...errors },
    }),
    async (c) => {
      await submitReview(db, c.get("customerId"), c.req.valid("param").id, c.req.valid("json"));
      return c.json({ ok: true as const }, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/v1/bookings/{id}/camera", tags: ["Bookings"], summary: "Live bay camera for a bike that is in the workshop", ...secured,
      description: "Returns a short-lived playbackUrl that proxies the assigned bay's stream. Only available while the job card is at_workshop or in_service and its bay has a camera.",
      request: { params: IdParam }, responses: { 200: json(S.Camera, "Playback URL"), ...errors },
    }),
    async (c) => {
      const booking = await getBooking(db, c.req.valid("param").id, c.get("customerId"));
      if (!booking.bay || !CAMERA_STATUSES.includes(booking.status) || !booking.cameraAvailable) {
        throw conflict("camera_unavailable", "The camera is available while your bike is in a bay");
      }
      const bay = await one<{ camera_stream_url: string }>(db, "SELECT camera_stream_url FROM bays WHERE code = $1", [booking.bay.code]);
      const file = new URL(bay!.camera_stream_url).pathname.split("/").pop() || "stream";
      const { token, expiresAt } = await signCameraToken(config, booking.id);
      return c.json({ bay: booking.bay, playbackUrl: `${config.PUBLIC_BASE_URL}/v1/camera/${token}/${file}`, expiresAt }, 200);
    },
  );

  // ---------------------------------------------------------------- money

  app.openapi(
    createRoute({ method: "get", path: "/v1/invoices", tags: ["Payments"], summary: "Payment history", ...secured, responses: { 200: json(z.array(S.Invoice), "Invoices"), ...errors } }),
    async (c) => c.json(await listInvoices(db, c.get("customerId")), 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/invoices/{id}", tags: ["Payments"], summary: "One invoice with lines and payments", ...secured, request: { params: IdParam }, responses: { 200: json(S.Invoice, "Invoice"), ...errors } }),
    async (c) => c.json(await getInvoice(db, c.req.valid("param").id, c.get("customerId")), 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/wallet", tags: ["Wallet"], summary: "Workshop credit balance and history", ...secured, responses: { 200: json(S.Wallet, "Wallet"), ...errors } }),
    async (c) => c.json(await customers.getWallet(db, c.get("customerId")), 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/v1/referral", tags: ["Wallet"], summary: "Referral code, share text and friends who joined", ...secured, responses: { 200: json(S.Referral, "Referral"), ...errors } }),
    async (c) => c.json(await customers.getReferral(db, c.get("customerId"), config.REFERRAL_REWARD), 200),
  );

  // ---------------------------------------------------------------- notifications

  app.openapi(
    createRoute({ method: "get", path: "/v1/notifications", tags: ["Notifications"], summary: "Latest 100 notifications", ...secured, responses: { 200: json(S.NotificationList, "Notifications"), ...errors } }),
    async (c) => c.json(await listNotifications(db, c.get("customerId")), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/v1/notifications/read", tags: ["Notifications"], summary: "Mark some or all notifications read", ...secured,
      request: body(S.MarkRead), responses: { 200: json(S.Ok, "Marked"), ...errors },
    }),
    async (c) => {
      await markRead(db, c.get("customerId"), c.req.valid("json").ids);
      return c.json({ ok: true as const }, 200);
    },
  );
}
