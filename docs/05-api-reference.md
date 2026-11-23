# API reference

Generated from [`app-backend/openapi.json`](../app-backend/openapi.json); `npm run openapi` regenerates the JSON; update the tables below by hand if you add or remove a route. Field-level detail and "Try it out" are in Swagger UI at `/docs` on any running API.

- **Customer API** (`/v1`): called by the app. Send `Authorization: Bearer <accessToken>` from `POST /v1/auth/otp/verify`. Access tokens last `ACCESS_TOKEN_TTL_SECONDS` (1 hour); refresh with `POST /v1/auth/refresh`, which rotates the refresh token.
- **Integration API** (`/integration/v1`): called by the CRM/ERP with `X-Api-Key`. See [CRM and ERP integration](04-crm-erp-integration.md).
- Request and response bodies are JSON. Amounts are rupees. Timestamps are ISO 8601 with offset. Errors are always `{ "error": { "code", "message", "issues?" } }`.

## System

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/health` | Public | Liveness: the process is up |
| GET | `/health/ready` | Public | Readiness: the database is reachable and migrated |

## Auth

| Method | Path | Auth | Summary |
|---|---|---|---|
| POST | `/v1/auth/otp/request` | Public | Send a login code by SMS or WhatsApp |
| POST | `/v1/auth/otp/verify` | Public | Exchange the code for a session; creates the account on first login |
| POST | `/v1/auth/refresh` | Public | Rotate the refresh token and get a new access token |
| POST | `/v1/auth/logout` | Public | Revoke a refresh token |

## Profile

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/me` | Bearer | The signed-in customer |
| PATCH | `/v1/me` | Bearer | Update name, email, language or backup contact |
| DELETE | `/v1/me` | Bearer | Delete the account (scrubs personal data, keeps invoices) |
| GET | `/v1/me/addresses` | Bearer | Saved pickup addresses |
| POST | `/v1/me/addresses` | Bearer | Save an address (replaces one with the same label) |
| DELETE | `/v1/me/addresses/{id}` | Bearer | Remove an address |
| POST | `/v1/me/devices` | Bearer | Register this phone for push notifications |
| DELETE | `/v1/me/devices` | Bearer | Stop push notifications to a device (call on logout) |

## Catalogue

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/workshop` | Public | Workshop contact details, advisor and roadside number |
| GET | `/v1/services` | Public | Bookable services and their prices (before GST) |
| GET | `/v1/offers` | Public | Offers that are live today |

## Garage

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/vehicles` | Bearer | The customer's vehicles |
| POST | `/v1/vehicles` | Bearer | Add a vehicle |
| POST | `/v1/vehicles/lookup` | Bearer | Fill in make, model and year from the registration (RC) number |
| GET | `/v1/vehicles/{id}` | Bearer | One vehicle |
| PATCH | `/v1/vehicles/{id}` | Bearer | Update colour, odometer and other details |
| DELETE | `/v1/vehicles/{id}` | Bearer | Remove a vehicle from the garage (history is kept) |
| PUT | `/v1/vehicles/{id}/documents/{kind}` | Bearer | Save RC, insurance or PUC details (upload the photo elsewhere and pass its URL) |
| GET | `/v1/vehicles/{id}/warranties` | Bearer | Warranties for the bike and parts fitted |
| GET | `/v1/vehicles/{id}/maintenance` | Bearer | Kilometre-based wear items (oil, chain, pads) |
| GET | `/v1/vehicles/{id}/history` | Bearer | Every job card for this vehicle, newest first |

## Bookings

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/bookings` | Bearer | All bookings (job cards), newest first |
| POST | `/v1/bookings` | Bearer | Book a service. Creates a job card the service advisor sees like any other booking. |
| GET | `/v1/bookings/{id}` | Bearer | One booking with live status, extras and timeline |
| POST | `/v1/bookings/{id}/cancel` | Bearer | Cancel before pickup |
| GET | `/v1/bookings/{id}/bill` | Bearer | Estimate before the job card closes, invoice after |
| POST | `/v1/bookings/{id}/extras/{extraId}/decision` | Bearer | Approve or decline one extra part |
| POST | `/v1/bookings/{id}/extras/approve-all` | Bearer | Approve every pending extra part |
| POST | `/v1/bookings/{id}/review` | Bearer | Rate a finished service |
| GET | `/v1/bookings/{id}/camera` | Bearer | Live bay camera for a bike that is in the workshop |

## Payments

| Method | Path | Auth | Summary |
|---|---|---|---|
| POST | `/v1/bookings/{id}/pay` | Bearer | Pay the invoice: wallet first, then UPI/card/net banking |
| POST | `/v1/bookings/{id}/pay-at-delivery` | Bearer | Pay the rider in cash or UPI when the bike comes back |
| GET | `/v1/invoices` | Bearer | Payment history |
| GET | `/v1/invoices/{id}` | Bearer | One invoice with lines and payments |

## Wallet

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/wallet` | Bearer | Workshop credit balance and history |
| GET | `/v1/referral` | Bearer | Referral code, share text and friends who joined |

## Notifications

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/notifications` | Bearer | Latest 100 notifications |
| POST | `/v1/notifications/read` | Bearer | Mark some or all notifications read |

## Integration: Customers

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/integration/v1/customers` | API key | Customers changed since a point in time, with vehicles and wallet balance |
| GET | `/integration/v1/customers/{ref}` | API key | One customer by id or phone number |
| POST | `/integration/v1/customers/{id}/wallet` | API key | Credit or debit workshop credit (refunds, cashback, corrections) |
| POST | `/integration/v1/notifications` | API key | Send a notification (reminders, campaigns) to a customer's app |

## Integration: Job cards

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/integration/v1/job-cards` | API key | Job cards changed since a point in time (pull sync) |
| POST | `/integration/v1/job-cards` | API key | Create a walk-in or phone booking so it shows in the customer's app |
| GET | `/integration/v1/job-cards/{ref}` | API key | One job card |
| PUT | `/integration/v1/job-cards/{ref}/status` | API key | Move the job card to a new stage (drives the customer's tracker) |
| PATCH | `/integration/v1/job-cards/{ref}/assignment` | API key | Assign bay, advisor, mechanic, rider; set ready-by time or move the slot |
| POST | `/integration/v1/job-cards/{ref}/extras` | API key | Raise an extra part for the customer to approve |
| PUT | `/integration/v1/job-cards/{ref}/extras/{extraId}` | API key | Record a decision the customer gave the advisor by phone |
| POST | `/integration/v1/job-cards/{ref}/media` | API key | Attach a photo, video or note from the bay |
| POST | `/integration/v1/job-cards/{ref}/close` | API key | Close the job card and issue the invoice |

## Integration: Master data

| Method | Path | Auth | Summary |
|---|---|---|---|
| PUT | `/integration/v1/staff/{code}` | API key | Create or update an advisor, mechanic or rider by employee code |
| PUT | `/integration/v1/bays/{code}` | API key | Create or update a bay and its camera stream URL |
| PUT | `/integration/v1/services/{code}` | API key | Create or update a bookable service and its price |
| PUT | `/integration/v1/offers/{code}` | API key | Create, update or end an offer |

## Integration: Payments

| Method | Path | Auth | Summary |
|---|---|---|---|
| POST | `/integration/v1/job-cards/{ref}/payments` | API key | Record money the workshop collected (cash or UPI at the door, card at the counter) |
| GET | `/integration/v1/invoices/{id}` | API key | One invoice with lines, GST and payments |
| PUT | `/integration/v1/payments/{id}` | API key | Confirm or fail a pending online payment |

## Integration: Sync

| Method | Path | Auth | Summary |
|---|---|---|---|
| PUT | `/integration/v1/external-refs` | API key | Link one of our records to its id in your CRM/ERP |
| GET | `/integration/v1/external-refs` | API key | Look up links in either direction |
| GET | `/integration/v1/events` | API key | Read the event log in order (alternative or backup to webhooks) |

## Integration: Vehicles

| Method | Path | Auth | Summary |
|---|---|---|---|
| PUT | `/integration/v1/vehicles/{id}/documents/{kind}` | API key | Set insurance, PUC or RC details |
| POST | `/integration/v1/vehicles/{id}/warranties` | API key | Register a warranty (bike, battery, tyres, parts fitted) |
| PUT | `/integration/v1/vehicles/{id}/maintenance/{item}` | API key | Set when a wear item was last done and its interval |

## Not in the OpenAPI document

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/v1/camera/{token}/{file}` | Token in the path | Camera stream proxy. Use the `playbackUrl` from `GET /v1/bookings/{id}/camera` as-is; HLS segment URLs resolve relative to it. |
| GET | `/openapi.json` | Public | The OpenAPI 3.1 document |
| GET | `/docs` | Public | Swagger UI |

## Login sequence

```text
POST /v1/auth/otp/request   {"phone":"98765 43210","channel":"sms"}
POST /v1/auth/otp/verify    {"phone":"98765 43210","code":"4719","referralCode":"BS7K2QXM"}
  -> {accessToken, refreshToken, expiresInSeconds, isNewCustomer, customer}
   isNewCustomer = true  -> show "Add your bike" (PATCH /v1/me with the name, POST /v1/vehicles)
   isNewCustomer = false -> Home
POST /v1/auth/refresh       {"refreshToken":"..."}   when a call returns 401
POST /v1/auth/logout        {"refreshToken":"..."}   and DELETE /v1/me/devices?token=...
```

Rate limits: 5 codes per phone per 15 minutes, and 5 wrong attempts per code (`429`). Put the API behind a gateway or load balancer with per-IP limits as well.
