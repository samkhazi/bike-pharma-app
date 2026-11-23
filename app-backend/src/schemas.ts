import { z } from "@hono/zod-openapi";
import { JOB_STATUSES } from "./domain.js";

const id = z.uuid();
const timestamp = z.iso.datetime({ offset: true }).openapi({ example: "2026-11-19T13:00:00.000Z" });
const date = z.iso.date().openapi({ example: "2027-03-31" });
const amount = z.number().openapi({ description: "Indian rupees", example: 1499 });
const phone = z.string().openapi({ example: "+919876543210", description: "E.164. Inputs also accept 10-digit national numbers." });

export const BODY_TYPES = [
  "commuter", "naked", "classic", "cruiser", "touring", "sports", "superbike", "adventure",
  "chopper", "cafe", "scrambler", "scooter", "moped", "dirt", "bobber", "powercruiser",
] as const;

export const ErrorBody = z
  .object({ error: z.object({ code: z.string(), message: z.string(), issues: z.array(z.unknown()).optional() }) })
  .openapi("Error");

export const Ok = z.object({ ok: z.literal(true) }).openapi("Ok");

// ---------------------------------------------------------------------------
// Auth and profile
// ---------------------------------------------------------------------------

export const OtpRequest = z
  .object({ phone, channel: z.enum(["sms", "whatsapp"]).default("sms") })
  .openapi("OtpRequest");

export const OtpRequested = z
  .object({ phone, channel: z.enum(["sms", "whatsapp"]), expiresInSeconds: z.number().int() })
  .openapi("OtpRequested");

export const OtpVerify = z
  .object({
    phone,
    code: z.string().regex(/^\d{4}$/),
    referralCode: z.string().max(32).optional().openapi({ description: "Only used when this creates a new account" }),
  })
  .openapi("OtpVerify");

export const Customer = z
  .object({
    id,
    phone,
    name: z.string(),
    email: z.string().nullable(),
    language: z.enum(["English", "Kannada", "Hindi"]),
    backupContactName: z.string().nullable(),
    backupContactPhone: z.string().nullable(),
    referralCode: z.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .openapi("Customer");

export const CustomerUpdate = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.email().nullable(),
    language: z.enum(["English", "Kannada", "Hindi"]),
    backupContactName: z.string().trim().max(80).nullable(),
    backupContactPhone: phone.nullable(),
  })
  .partial()
  .openapi("CustomerUpdate");

export const Session = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresInSeconds: z.number().int(),
    isNewCustomer: z.boolean(),
    customer: Customer,
  })
  .openapi("Session");

export const RefreshRequest = z.object({ refreshToken: z.string().min(20) }).openapi("RefreshRequest");

export const Address = z
  .object({
    id,
    label: z.string(),
    area: z.string(),
    line: z.string(),
    landmark: z.string().nullable(),
    contactName: z.string().nullable(),
    contactPhone: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  })
  .openapi("Address");

export const AddressInput = z
  .object({
    label: z.string().trim().min(1).max(40).openapi({ example: "Home" }),
    area: z.string().trim().min(1).max(120),
    line: z.string().trim().min(1).max(300),
    landmark: z.string().trim().max(120).nullable().optional(),
    contactName: z.string().trim().max(80).nullable().optional(),
    contactPhone: phone.nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .openapi("AddressInput");

export const DeviceInput = z
  .object({
    provider: z.enum(["onesignal", "fcm", "apns"]),
    platform: z.enum(["ios", "android", "web"]),
    token: z.string().min(8).max(512).openapi({ description: "OneSignal subscription id, or the FCM/APNs device token" }),
  })
  .openapi("DeviceInput");

// ---------------------------------------------------------------------------
// Catalogue and workshop
// ---------------------------------------------------------------------------

export const Service = z
  .object({ id: z.string(), name: z.string(), detail: z.string(), category: z.enum(["Service", "Repair", "Care"]), price: amount })
  .openapi("Service");

export const Offer = z
  .object({
    id: z.string(),
    title: z.string(),
    shortLabel: z.string(),
    detail: z.string(),
    discountAmount: amount,
    firstBookingOnly: z.boolean(),
    requiresServiceId: z.string().nullable(),
    requiresOtherService: z.boolean(),
    validUntil: date.nullable(),
  })
  .openapi("Offer");

export const Person = z.object({ name: z.string(), phone: z.string().nullable() }).openapi("Person");

export const Workshop = z
  .object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    roadsidePhone: z.string().nullable(),
    advisor: Person.nullable(),
  })
  .openapi("Workshop");

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const VehicleDocument = z
  .object({
    kind: z.enum(["rc", "insurance", "puc"]),
    fileUrl: z.string().nullable(),
    provider: z.string().nullable(),
    policyType: z.string().nullable(),
    reading: z.string().nullable(),
    validUntil: date.nullable(),
  })
  .openapi("VehicleDocument");

export const VehicleDocumentInput = VehicleDocument.omit({ kind: true }).partial().openapi("VehicleDocumentInput");

export const Vehicle = z
  .object({
    id,
    registrationNumber: z.string().openapi({ example: "KA01MY4500" }),
    make: z.string(),
    model: z.string(),
    bodyType: z.enum(BODY_TYPES),
    colourName: z.string().nullable(),
    colourHex: z.string().nullable(),
    makeYear: z.number().int().nullable(),
    chassisLast4: z.string().nullable(),
    odometerKm: z.number().int().nullable(),
    odometerRecordedAt: timestamp.nullable(),
    documents: z.array(VehicleDocument),
    createdAt: timestamp,
  })
  .openapi("Vehicle");

export const VehicleInput = z
  .object({
    registrationNumber: z.string().min(4).max(20).openapi({ example: "KA 01 MY 4500" }),
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(60),
    bodyType: z.enum(BODY_TYPES),
    colourName: z.string().trim().max(40).nullable().optional(),
    colourHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    makeYear: z.number().int().min(1950).max(2100).nullable().optional(),
    chassisLast4: z.string().max(8).nullable().optional(),
    odometerKm: z.number().int().min(0).nullable().optional(),
  })
  .openapi("VehicleInput");

export const VehicleUpdate = VehicleInput.omit({ registrationNumber: true }).partial().openapi("VehicleUpdate");

export const VehicleLookup = z.object({ registrationNumber: z.string().min(4).max(20) }).openapi("VehicleLookupRequest");

export const VehicleLookupResult = z
  .object({
    registrationNumber: z.string(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    bodyType: z.enum(BODY_TYPES).nullable(),
    colourName: z.string().nullable(),
    makeYear: z.number().int().nullable(),
    chassisLast4: z.string().nullable(),
  })
  .openapi("VehicleLookupResult");

export const Warranty = z
  .object({
    id,
    vehicleId: id,
    jobCardId: id.nullable(),
    title: z.string(),
    brand: z.string(),
    serialNumber: z.string().nullable(),
    startsOn: date.nullable(),
    endsOn: date.nullable(),
    endsAtKm: z.number().int().nullable(),
  })
  .openapi("Warranty");

export const WarrantyInput = Warranty.omit({ id: true, vehicleId: true }).partial({ jobCardId: true, brand: true, serialNumber: true, startsOn: true, endsOn: true, endsAtKm: true }).openapi("WarrantyInput");

export const MaintenanceItem = z
  .object({ item: z.string(), lastDoneKm: z.number().int(), intervalKm: z.number().int().nullable(), intervalMonths: z.number().int().nullable() })
  .openapi("MaintenanceItem");

// ---------------------------------------------------------------------------
// Bookings / job cards
// ---------------------------------------------------------------------------

export const JobStatus = z.enum(JOB_STATUSES).openapi("JobStatus", {
  description: "booked → rider_assigned → picked_up → at_workshop → in_service → job_closed → delivered, or cancelled. Visits skip the rider steps.",
});

export const Extra = z
  .object({
    id,
    partName: z.string(),
    note: z.string(),
    amount,
    status: z.enum(["pending", "approved", "declined"]),
    raisedBy: z.string().nullable(),
    decidedAt: timestamp.nullable(),
    decidedVia: z.enum(["app", "advisor", "integration"]).nullable(),
  })
  .openapi("Extra");

export const Booking = z
  .object({
    id,
    number: z.string().openapi({ example: "BS-2026-000124" }),
    status: JobStatus,
    stage: z.number().int().openapi({ description: "Index into the tracker's stages (0–6), -1 when cancelled" }),
    mode: z.enum(["pickup", "visit"]),
    source: z.enum(["app", "walk_in", "phone", "erp"]),
    vehicle: z.object({ id, make: z.string(), model: z.string(), registrationNumber: z.string() }),
    services: z.array(z.object({ id: z.string(), name: z.string(), price: amount })),
    slotStart: timestamp,
    slotEnd: timestamp,
    promisedReadyAt: timestamp.nullable(),
    pickupAddress: Address.nullable(),
    bay: z.object({ code: z.string(), name: z.string() }).nullable(),
    advisor: Person.nullable(),
    mechanic: Person.nullable(),
    rider: Person.nullable(),
    offerId: z.string().nullable(),
    packageSubtotal: amount,
    discountAmount: amount,
    estimateAmount: amount.openapi({ description: "Package price after discount, before GST" }),
    payAtDelivery: z.boolean(),
    paid: z.boolean(),
    invoiceId: id.nullable(),
    cameraAvailable: z.boolean(),
    extras: z.array(Extra),
    timeline: z.array(z.object({ status: JobStatus, at: timestamp, note: z.string().nullable() })),
    media: z.array(z.object({ id, kind: z.enum(["photo", "video", "note"]), url: z.string().nullable(), caption: z.string(), createdAt: timestamp })),
    customerNote: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: timestamp.nullable(),
    deliveredAt: timestamp.nullable(),
    cancelledAt: timestamp.nullable(),
  })
  .openapi("Booking");

export const BookingCreate = z
  .object({
    vehicleId: id,
    serviceIds: z.array(z.string()).min(1).max(20),
    mode: z.enum(["pickup", "visit"]),
    slotStart: timestamp,
    slotEnd: timestamp,
    pickupAddressId: id.nullable().optional(),
    offerId: z.string().nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .openapi("BookingCreate");

export const CancelRequest = z.object({ reason: z.string().max(300).optional() }).openapi("CancelRequest");

export const ExtraDecision = z.object({ approve: z.boolean() }).openapi("ExtraDecision");

export const BillLine = z.object({ kind: z.enum(["service", "part", "discount", "other"]), label: z.string(), amount }).openapi("BillLine");

export const Bill = z
  .object({
    kind: z.enum(["estimate", "due", "paid"]),
    lines: z.array(BillLine),
    subtotal: amount,
    discount: amount,
    extras: amount,
    taxable: amount,
    gstRate: z.number(),
    tax: amount,
    total: amount,
    paidAmount: amount,
    balanceDue: amount,
  })
  .openapi("Bill");

export const Payment = z
  .object({
    id,
    method: z.enum(["upi", "card", "netbanking", "cash", "wallet"]),
    amount,
    status: z.enum(["pending", "succeeded", "failed", "refunded"]),
    provider: z.string(),
    providerReference: z.string().nullable(),
    createdAt: timestamp,
    confirmedAt: timestamp.nullable(),
  })
  .openapi("Payment");

export const Invoice = z
  .object({
    id,
    number: z.string().openapi({ example: "INV-2026-000109" }),
    jobCardId: id,
    bookingNumber: z.string(),
    vehicleId: id,
    vehicleLabel: z.string(),
    mode: z.enum(["pickup", "visit"]),
    status: z.enum(["open", "paid", "void"]),
    source: z.enum(["app", "workshop"]).openapi({ description: "workshop: issued by the workshop's own billing; pay it at the counter" }),
    lines: z.array(BillLine),
    subtotal: amount,
    discountAmount: amount,
    extrasAmount: amount,
    taxableAmount: amount,
    gstRate: z.number(),
    gstAmount: amount,
    total: amount,
    paidAmount: amount,
    walletAmount: amount,
    balanceDue: amount,
    payments: z.array(Payment),
    issuedAt: timestamp,
    paidAt: timestamp.nullable(),
  })
  .openapi("Invoice");

export const PayRequest = z
  .object({
    walletAmount: z.number().min(0).default(0).openapi({ description: "Workshop credit to apply first" }),
    method: z.enum(["upi", "card", "netbanking"]).optional().openapi({ description: "How the rest is paid. Required when the wallet does not cover the balance." }),
  })
  .openapi("PayRequest");

export const PayResult = z
  .object({ invoice: Invoice, pendingPayment: Payment.nullable() })
  .openapi("PayResult", { description: "pendingPayment is set when the remainder needs confirming by the payment gateway or ERP" });

export const ReviewInput = z
  .object({
    stars: z.number().int().min(1).max(5),
    tags: z.array(z.string().max(40)).max(10).default([]),
    note: z.string().max(1000).nullable().optional(),
    workVotes: z.record(z.string(), z.enum(["up", "down"])).default({}),
    staffVote: z.enum(["up", "down"]).nullable().optional(),
    followUpInterests: z.array(z.string().max(60)).max(10).default([]),
  })
  .openapi("ReviewInput");

export const Camera = z
  .object({ bay: z.object({ code: z.string(), name: z.string() }), playbackUrl: z.url(), expiresAt: timestamp })
  .openapi("Camera");

// ---------------------------------------------------------------------------
// Wallet, referral, notifications
// ---------------------------------------------------------------------------

export const WalletTransaction = z
  .object({
    id,
    kind: z.enum(["welcome", "referral", "refund", "cashback", "service_payment", "adjustment"]),
    title: z.string(),
    detail: z.string(),
    amount,
    createdAt: timestamp,
  })
  .openapi("WalletTransaction");

export const Wallet = z.object({ balance: amount, transactions: z.array(WalletTransaction) }).openapi("Wallet");

export const Referral = z
  .object({
    code: z.string(),
    rewardAmount: amount,
    shareText: z.string(),
    referrals: z.array(z.object({ name: z.string(), status: z.enum(["pending", "rewarded", "void"]), createdAt: timestamp, rewardedAt: timestamp.nullable() })),
  })
  .openapi("Referral");

export const Notification = z
  .object({
    id,
    kind: z.enum(["confirmation", "update", "reminder", "rescheduled", "cancelled", "payment", "offer"]),
    title: z.string(),
    body: z.string(),
    jobCardId: id.nullable(),
    bookingNumber: z.string().nullable(),
    vehicleLabel: z.string().nullable(),
    targetScreen: z.string().nullable().openapi({ description: "App screen name to open, e.g. \"Part approval\"" }),
    read: z.boolean(),
    createdAt: timestamp,
  })
  .openapi("Notification");

export const NotificationList = z.object({ unread: z.number().int(), items: z.array(Notification) }).openapi("NotificationList");

export const MarkRead = z
  .object({ ids: z.array(id).max(200).optional().openapi({ description: "Omit to mark everything read" }) })
  .openapi("MarkRead");

// ---------------------------------------------------------------------------
// Integration (CRM / ERP)
// ---------------------------------------------------------------------------

export const IntegrationBooking = Booking.extend({
  customer: z.object({ id, phone, name: z.string() }),
}).openapi("IntegrationBooking");

export const IntegrationBookingPage = z
  .object({ items: z.array(IntegrationBooking), nextCursor: z.string().nullable().openapi({ description: "Pass as cursor to fetch the next page; null on the last page" }), nextUpdatedSince: timestamp.nullable().openapi({ description: "Deprecated: use nextCursor. Can skip rows that share a timestamp." }) })
  .openapi("IntegrationBookingPage");

export const IntegrationBookingCreate = z
  .object({
    source: z.enum(["walk_in", "phone", "erp"]).default("erp"),
    customer: z.object({ phone, name: z.string().trim().max(80).default("") }),
    vehicle: VehicleInput,
    serviceIds: z.array(z.string()).min(1),
    mode: z.enum(["pickup", "visit"]).default("visit"),
    slotStart: timestamp,
    slotEnd: timestamp,
    note: z.string().max(500).nullable().optional(),
  })
  .openapi("IntegrationBookingCreate");

export const StatusUpdate = z
  .object({
    status: JobStatus,
    note: z.string().max(500).optional(),
    staffCode: z.string().optional(),
    force: z.boolean().default(false).openapi({ description: "Allow moving backwards. Forward moves, including skipped stages, never need it." }),
  })
  .openapi("StatusUpdate");

export const Assignment = z
  .object({
    bayCode: z.string().nullable(),
    advisorCode: z.string().nullable(),
    mechanicCode: z.string().nullable(),
    riderCode: z.string().nullable(),
    promisedReadyAt: timestamp.nullable(),
    slotStart: timestamp,
    slotEnd: timestamp,
    odometerKm: z.number().int().min(0),
  })
  .partial()
  .openapi("Assignment", { description: "Send only the fields that change. null clears a field." });

export const ExtraCreate = z
  .object({
    partName: z.string().trim().min(1).max(120).optional().openapi({ description: "Needed unless partNo is sent; then the Inventory's name is used" }),
    note: z.string().max(500).default(""),
    amount: z.number().min(0).optional().openapi({ description: "Needed unless partNo is sent; then MRP less the customer discount, times quantity" }),
    partNo: z.string().trim().min(1).max(60).optional().openapi({ description: "Part number in the Bike Surgeon Inventory", example: "06455-KWP-901" }),
    quantity: z.number().positive().max(999).optional().openapi({ description: "Default 1" }),
    raisedByStaffCode: z.string().optional(),
    raisedByLabel: z.string().max(80).optional().openapi({ example: "Amit, Bay 03" }),
  })
  .openapi("ExtraCreate");

export const IntegrationExtraDecision = z
  .object({ status: z.enum(["approved", "declined"]), via: z.enum(["advisor", "integration"]).default("advisor") })
  .openapi("IntegrationExtraDecision");

export const CloseJob = z
  .object({ declinePendingExtras: z.boolean().default(false), note: z.string().max(500).optional() })
  .openapi("CloseJob");

export const PaymentRecord = z
  .object({
    method: z.enum(["upi", "card", "netbanking", "cash"]),
    amount: z.number().positive(),
    reference: z.string().max(120).optional(),
    collectedByStaffCode: z.string().optional(),
  })
  .openapi("PaymentRecord");

export const PaymentConfirm = z
  .object({ status: z.enum(["succeeded", "failed"]), providerReference: z.string().max(120).optional() })
  .openapi("PaymentConfirm");

export const MediaCreate = z
  .object({ kind: z.enum(["photo", "video", "note"]), url: z.url().nullable().optional(), caption: z.string().max(500).default(""), notifyCustomer: z.boolean().default(true) })
  .openapi("MediaCreate");

export const IntegrationCustomer = Customer.extend({
  vehicles: z.array(Vehicle),
  walletBalance: amount,
}).openapi("IntegrationCustomer");

export const IntegrationCustomerPage = z
  .object({ items: z.array(IntegrationCustomer), nextCursor: z.string().nullable().openapi({ description: "Pass as cursor to fetch the next page; null on the last page" }), nextUpdatedSince: timestamp.nullable().openapi({ description: "Deprecated: use nextCursor. Can skip rows that share a timestamp." }) })
  .openapi("IntegrationCustomerPage");

export const ENTITY_TYPES = ["customer", "vehicle", "job_card", "invoice", "payment", "staff", "bay", "service", "offer"] as const;

export const ExternalReference = z
  .object({
    entityType: z.enum(ENTITY_TYPES),
    entityId: z.string().openapi({ description: "Our id: a uuid, or the code for services, offers, staff and bays" }),
    system: z.string().regex(/^[a-z0-9_-]{2,32}$/).openapi({ example: "erp" }),
    externalId: z.string().min(1).max(120),
  })
  .openapi("ExternalReference");

export const StaffUpsert = z
  .object({ name: z.string().min(1), role: z.enum(["advisor", "mechanic", "rider", "manager"]), phone: phone.nullable().optional(), active: z.boolean().default(true) })
  .openapi("StaffUpsert");

export const BayUpsert = z
  .object({ name: z.string().min(1), cameraStreamUrl: z.url().nullable().optional(), active: z.boolean().default(true) })
  .openapi("BayUpsert");

export const ServiceUpsert = z
  .object({
    name: z.string().min(1),
    detail: z.string().default(""),
    category: z.enum(["Service", "Repair", "Care"]),
    price: z.number().min(0),
    sacCode: z.string().nullable().optional(),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .openapi("ServiceUpsert");

export const OfferUpsert = z
  .object({
    title: z.string().min(1),
    shortLabel: z.string().default(""),
    detail: z.string().default(""),
    discountAmount: z.number().min(0),
    firstBookingOnly: z.boolean().default(false),
    requiresServiceId: z.string().nullable().optional(),
    requiresOtherService: z.boolean().default(false),
    validUntil: date.nullable().optional(),
    active: z.boolean().default(true),
  })
  .openapi("OfferUpsert");

export const NotificationCreate = z
  .object({
    customerId: id,
    kind: z.enum(["confirmation", "update", "reminder", "rescheduled", "cancelled", "payment", "offer"]),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(500),
    jobCardId: id.nullable().optional(),
    targetScreen: z.string().max(60).nullable().optional(),
  })
  .openapi("NotificationCreate");

export const WalletAdjustment = z
  .object({
    amount: z.number().refine((value) => value !== 0, "amount must not be zero"),
    kind: z.enum(["welcome", "refund", "cashback", "adjustment"]),
    title: z.string().min(1).max(80),
    detail: z.string().max(200).default(""),
    jobCardId: id.nullable().optional(),
  })
  .openapi("WalletAdjustment");

export const IntegrationEvent = z
  .object({ id: z.number().int(), type: z.string(), entityType: z.string(), entityId: z.string(), payload: z.unknown(), createdAt: timestamp })
  .openapi("IntegrationEvent");

export const IntegrationEventPage = z
  .object({ items: z.array(IntegrationEvent), nextAfter: z.number().int().nullable() })
  .openapi("IntegrationEventPage");
