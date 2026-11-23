# Open items

What is finished, what is ready but waiting on a vendor or a decision, and what is out of scope. Read this before planning the next phase.

## Delivered

- **Customer app** (`app-frontend`): every screen in the agreed flow, for iOS, Android and web, in light and dark themes, running on built-in sample data.
- **Backend API** (`app-backend`):
  - customer API for every screen
  - integration API for the CRM/ERP
  - signed, ordered webhooks and a pull event feed
  - camera proxy
  - OTP login with refresh-token rotation
  - account deletion
  - push via OneSignal
- **Database**: schema, migrations, reference and demo seed data, a schema checker (`npm run db:check`), and configurable connection and schema placement.
- **Tests**: `npm test` runs every flow end to end against PostgreSQL. That covers booking, the workshop stages, the camera, extra parts, invoice, wallet and UPI payment, delivery, referral, review, events and webhooks, walk-ins, cancellation, account deletion, and the schema check.
- **Docs**: this folder, the OpenAPI spec at `app-backend/openapi.json`, and Swagger UI at `/docs`.

## Ready, waiting on the next team

| Item | State | What is needed |
|---|---|---|
| App ↔ API wiring | The app still uses sample data. The API serves every screen. | Follow [Wiring the app to the API](06-frontend-integration.md). |
| Existing database mapping | The legacy panels' exact table and field names were never shared. | Get the legacy schema, then pick setup A, B or C in [Connecting your database](03-connecting-your-database.md). Setup A plus the integration API needs no field mapping. |
| Advisor and mechanic panels | These keep working as today. They must also report status, bay and extra-part changes to the app. | Call the integration API from the panels, or run a sync job; see [recipes](04-crm-erp-integration.md#5-common-recipes). |
| Online payments | Wallet payments work end to end. UPI, card and net banking create a `pending` payment that must be confirmed. | Choose a gateway (Razorpay, PhonePe PG, Cashfree). Start the gateway checkout from `pendingPayment`, and call `PUT /integration/v1/payments/{id}` from the gateway's webhook handler. |
| SMS / WhatsApp login codes | Generic HTTP adapter (`OTP_PROVIDER=http`). | Choose a gateway with DLT-registered templates (needed for SMS in India), and point `OTP_HTTP_URL` at it or a relay. |
| RC lookup | Generic HTTP adapter (`VEHICLE_LOOKUP_URL`). | Choose a registration-data provider. Until then, customers enter bike details by hand. |
| Push notifications | Server side done for OneSignal. | Add the OneSignal SDK to the Capacitor app and register devices (`POST /v1/me/devices`). |
| Document and photo uploads | The API stores document metadata and a `file_url`. The app keeps RC, insurance and PUC photos on the phone. | Add object storage (S3, R2, GCS) with signed upload URLs; save the resulting URL through the documents endpoint. |
| Bay cameras | The proxy supports HTTP streams (HLS, MP4, MJPEG). | An RTSP-to-HLS gateway on the workshop network, reachable from the API ([Bay cameras](07-deployment.md#bay-cameras)). |
| Maps for addresses | The Add address screen uses an illustrated map. The API accepts `latitude`/`longitude`. | A map SDK (Google Maps or Mapbox) and geolocation permission. |

## Decisions for the client

| Question | Current behaviour |
|---|---|
| **Slot capacity.** How many pickups or visits per slot? | The app offers fixed time slots and the API accepts any future slot. The workshop moves bookings with the assignment endpoint, and the customer is notified. Add a capacity table and an availability endpoint if slots must be limited. |
| **Referral reward.** The app copy says the friend gets "₹200 off your first completed service". | Both sides get ₹200 wallet credit when the friend's first job card is delivered (`REFERRAL_REWARD`). Change `rewardReferralIfDue` in `services/customers.ts` if the friend's ₹200 must come off that first bill instead. |
| **Who issues the invoice?** | The API calculates the invoice at close (package, discount, approved parts, 18% GST, rounded to the rupee) and sends it to the ERP in `job_card.closed`. If the ERP must be the invoicing authority, keep its GST rules identical, or extend the close endpoint to accept the ERP's totals and invoice number. |
| **Placeholder contact details** | The reference seed has a placeholder workshop address. The advisor and roadside numbers are the ones the app's sample data shows. Replace them with the real ones. |
| **Pickup area.** The app's sample addresses are in Bengaluru; the workshop is in Davangere. | The backend demo seed uses Davangere addresses. Update the app's sample data or remove it when wiring. |

## Out of scope for this release

- Spare-parts ordering (the existing Product/Order/Cart tables). The app links to the sister store, Bike Pharma, instead.
- An admin or operations dashboard. The workshop's existing ERP and panels remain the operations tools, connected through the integration API.
- Multiple workshops in one deployment. The schema supports several `workshops`, but each API instance serves one (`WORKSHOP_CODE`).
- Languages other than English. Customers can pick Kannada or Hindi in their profile, which the CRM can use, but the app's text is English only.

## Known limitations

- The frontend bundle is about 580 kB of JavaScript (180 kB gzipped). Vite warns about chunk size; split heavy screens with dynamic `import()` if startup time matters on low-end phones.
- Only OTP endpoints have built-in rate limits. Add per-IP limits at the load balancer.
- Webhooks go to one URL. To fan out to both the CRM and the ERP, use a small relay, or have one system read the pull feed.
