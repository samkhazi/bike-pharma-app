# CRM and ERP integration

This is the guide for connecting the workshop's CRM, ERP and existing panels to the app. Data moves both ways.

- **Into the app** through the **Integration API** (`/integration/v1/*`). The ERP and panels call it to move job cards through stages, assign bays and people, raise extra parts, close job cards, record cash, and manage the catalogue.
- **Out of the app** through **events**. Every change becomes an event, delivered to your webhook URL (push) and readable from `GET /integration/v1/events` (pull).

Interactive reference with "Try it out": `http://<api>/docs`. Machine-readable spec: [`app-backend/openapi.json`](../app-backend/openapi.json). It imports into Postman, Insomnia or a client generator.

## 1. Get access

| Setting | Purpose |
|---|---|
| `INTEGRATION_API_KEYS` | Comma-separated keys accepted in the `X-Api-Key` header. Give each system its own key (`erp`, `crm`). Rotate by adding the new key, switching the caller, then removing the old one. |
| `WEBHOOK_URL` | Where events are POSTed. Leave empty to use only the pull feed. |
| `WEBHOOK_SECRET` | Shared secret for the webhook signature. |

Generate keys and secrets with `openssl rand -hex 24`. The integration API is server-to-server only: never ship a key inside the mobile app.

```bash
API=https://api.bikesurgeon.example
KEY=<one of INTEGRATION_API_KEYS>
curl $API/integration/v1/job-cards?limit=5 -H "X-Api-Key: $KEY"
```

## 2. Who owns what

Agree on this before writing code. The "source of truth" is where a value is edited; everywhere else is a copy.

| Data | Source of truth | How it flows |
|---|---|---|
| Customer profile, addresses | App (the customer edits it) | `customer.*` events to the CRM; `GET /integration/v1/customers` for full sync |
| Vehicles | App | `vehicle.*` events |
| App bookings | App | `booking.created` event → ERP opens its own job card → `PUT /external-refs` to link them |
| Walk-in and phone bookings | ERP | `POST /integration/v1/job-cards` so the rider sees them in the app |
| Job card status, bay, advisor, mechanic, rider, ready-by time | ERP and panels | `PUT .../status`, `PATCH .../assignment` |
| Extra parts (what and how much) | Mechanic / ERP | `POST .../extras` |
| Extra part decision | Customer (app), or advisor on the phone | `job_card.extra_decided` event; phone decisions via `PUT .../extras/{id}` |
| Invoice amounts and GST | App, computed at close from the package, discount and approved parts | `job_card.closed` event carries the full invoice for the ERP to book |
| Online payments | Payment gateway | Pending in the app until confirmed with `PUT /integration/v1/payments/{id}` |
| Cash and UPI collected by the workshop | ERP / rider | `POST .../payments` |
| Service catalogue, prices, offers | ERP | `PUT /integration/v1/services/{code}`, `PUT /integration/v1/offers/{code}` |
| Staff and bays (incl. camera URLs) | ERP | `PUT /integration/v1/staff/{code}`, `PUT /integration/v1/bays/{code}` |
| Wallet credit adjustments (refunds, cashback) | ERP / CRM | `POST /integration/v1/customers/{id}/wallet` |
| Reviews and "line up next" interests | App | `review.submitted` event; treat follow-up interests as CRM leads |
| Reminders and campaigns | CRM | `POST /integration/v1/notifications` |
| Insurance, PUC, warranties, wear items | ERP | `PUT .../documents/{kind}`, `POST .../warranties`, `PUT .../maintenance/{item}` |

## 3. Integration API

Job cards are addressed by their number (`BS-2026-000124`) or id. Staff and bays are addressed by their codes (`MEC-RAHUL`, `BAY-03`). Every response is JSON; every error looks like this:

```json
{ "error": { "code": "invalid_transition", "message": "Cannot move from delivered to in_service without force: true" } }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input. `validation_failed` includes an `issues` array naming each bad field. |
| 401 | Missing or wrong `X-Api-Key` |
| 404 | No such job card, customer, invoice or payment |
| 409 | The change conflicts with the record's state (closing with undecided parts, paying a paid invoice, a second open job card for one vehicle) |
| 501 | The integration API is disabled because `INTEGRATION_API_KEYS` is empty |

### Job cards

| Call | Does |
|---|---|
| `GET /integration/v1/job-cards?updatedSince=&limit=&status=` | Job cards changed since a time, oldest change first. Page by passing `nextCursor` back as `cursor` (keep the same `updatedSince`); `nextCursor` is `null` on the last page. |
| `GET /integration/v1/job-cards/{ref}` | One job card with customer, vehicle, services, extras, timeline, people and bay |
| `POST /integration/v1/job-cards` | Walk-in or phone booking. Finds or creates the customer by phone and the vehicle by plate. |
| `PUT /integration/v1/job-cards/{ref}/status` | Move to a stage. Notifies the customer. Moving to `job_closed` or `delivered` issues the invoice. |
| `PATCH /integration/v1/job-cards/{ref}/assignment` | Bay, advisor, mechanic, rider, ready-by time, slot (a slot change notifies "Pickup moved"), intake odometer |
| `POST /integration/v1/job-cards/{ref}/extras` | Raise a part for approval. The customer gets "A part needs your OK". |
| `PUT /integration/v1/job-cards/{ref}/extras/{extraId}` | Record a decision the customer gave the advisor by phone |
| `POST /integration/v1/job-cards/{ref}/media` | Photo, video or note from the bay, optionally notifying the customer |
| `POST /integration/v1/job-cards/{ref}/close` | Close and issue the invoice. Refuses while parts are pending unless `declinePendingExtras: true`. |

Moving through the stages:

```bash
curl -X PATCH $API/integration/v1/job-cards/BS-2026-000124/assignment -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"bayCode":"BAY-03","mechanicCode":"MEC-RAHUL","riderCode":"RID-ARJUN","promisedReadyAt":"2026-11-19T14:00:00Z"}'

curl -X PUT $API/integration/v1/job-cards/BS-2026-000124/status -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"status":"in_service","staffCode":"MEC-RAHUL"}'
```

Statuses can skip forward (a workshop visit goes `booked` → `at_workshop`). Going backwards, or reopening a delivered or cancelled job card, needs `"force": true`. The full lifecycle is in [Database](02-database.md#job-card-lifecycle).

Raising a part and closing:

```bash
curl -X POST $API/integration/v1/job-cards/BS-2026-000124/extras -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"partName":"Front brake pads","amount":650,"note":"Below the thickness we recommend.","raisedByStaffCode":"ADV-AMIT","raisedByLabel":"Amit, Bay 03"}'

curl -X POST $API/integration/v1/job-cards/BS-2026-000124/close -H "X-Api-Key: $KEY" -H 'content-type: application/json' -d '{}'
```

A walk-in from the counter:

```bash
curl -X POST $API/integration/v1/job-cards -H "X-Api-Key: $KEY" -H 'content-type: application/json' -d '{
  "source": "walk_in",
  "customer": { "phone": "9845012345", "name": "Manju" },
  "vehicle": { "registrationNumber": "KA 17 EX 2231", "make": "Honda", "model": "Shine", "bodyType": "commuter" },
  "serviceIds": ["general"], "mode": "visit",
  "slotStart": "2026-11-19T04:30:00Z", "slotEnd": "2026-11-19T05:30:00Z"
}'
```

When that customer later installs the app and logs in with the same phone number, the booking and bike are already there.

### Payments

| Call | Does |
|---|---|
| `POST /integration/v1/job-cards/{ref}/payments` | Record money the workshop took: `cash`, `upi`, `card`, `netbanking`, with an optional reference and `collectedByStaffCode`. Marks the invoice paid when fully covered. |
| `PUT /integration/v1/payments/{id}` | Confirm (`succeeded`) or fail a pending online payment from the app. Call it from your payment gateway's webhook handler or your reconciliation job. |
| `GET /integration/v1/invoices/{id}` | Invoice with lines, GST and payments |

The app's checkout applies wallet credit first. Anything left is a `pending` payment, and a `payment.pending` event fires with its id and amount. Until a gateway is wired in, the ERP confirms these once the money shows up.

### Customers, vehicles and messages

| Call | Does |
|---|---|
| `GET /integration/v1/customers?updatedSince=&limit=` | Customers with their vehicles and wallet balance, for CRM sync |
| `GET /integration/v1/customers/{id or phone}` | One customer |
| `POST /integration/v1/customers/{id}/wallet` | Credit or debit workshop credit (`refund`, `cashback`, `welcome`, `adjustment`) |
| `POST /integration/v1/notifications` | Put a message in the customer's inbox, pushed to the phone if push is set up. `targetScreen` opens a screen, for example `"Book service"`. |
| `PUT /integration/v1/vehicles/{id}/documents/{rc,insurance,puc}` | Insurer, policy type, PUC reading, expiry, photo URL |
| `POST /integration/v1/vehicles/{id}/warranties` | A warranty for the bike or a part fitted on a job card |
| `PUT /integration/v1/vehicles/{id}/maintenance/{item}` | When a wear item (engine oil, chain, pads) was last done, and how often it is due |

### Master data

| Call | Does |
|---|---|
| `PUT /integration/v1/services/{code}` | Create or update a service: name, detail, category, price before GST, SAC code, active, sort order |
| `PUT /integration/v1/offers/{code}` | Create, change or end an offer (`active: false`) |
| `PUT /integration/v1/staff/{code}` | Advisor, mechanic, rider or manager by employee code |
| `PUT /integration/v1/bays/{code}` | Bay name, camera stream URL, active |

### ID mapping

`PUT /integration/v1/external-refs` stores "app record X is ERP record Y" and `GET /integration/v1/external-refs?...` looks it up in either direction. See [Connecting your database](03-connecting-your-database.md#keeping-ids-in-step).

## 4. Events

### Webhook delivery

Each event is POSTed to `WEBHOOK_URL` as JSON:

```http
POST /bike-surgeon/webhook HTTP/1.1
Content-Type: application/json
X-BikeSurgeon-Event: job_card.status_changed
X-BikeSurgeon-Delivery: 1042
X-BikeSurgeon-Signature: t=1763550000,v1=5d41402abc4b2a76b9719d911017c592...

{
  "id": 1042,
  "type": "job_card.status_changed",
  "entityType": "job_card",
  "entityId": "6c1f...",
  "createdAt": "2026-11-19T13:10:00.000Z",
  "payload": { "from": "at_workshop", "to": "in_service", "note": null, "booking": { "...": "full job card" } }
}
```

- Reply with any `2xx` within 10 seconds. Anything else is retried after 10 s, 20 s, 40 s and so on, up to once an hour, until it succeeds.
- Events are delivered **in order**. A failing event holds back the ones after it, so a broken receiver never sees `delivered` before `in_service`.
- Delivery is **at least once**. Use `id` (also in `X-BikeSurgeon-Delivery`) to ignore duplicates.
- Delivery state lives in `integration_events` (`delivered_at`, `attempts`, `last_error`), which is useful when debugging a receiver.

Verify the signature before trusting the body. It is HMAC-SHA256 over `"<t>.<raw body>"` with `WEBHOOK_SECRET`:

```js
// Node.js (Express): use the raw body, not the parsed JSON
import crypto from "node:crypto";

function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const given = Buffer.from(parts.v1 ?? "");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) <= toleranceSeconds;
  return fresh && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), given);
}
```

```python
# Python
import hashlib, hmac, time

def verify(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    expected = hmac.new(secret.encode(), f"{parts['t']}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return abs(time.time() - int(parts["t"])) <= tolerance and hmac.compare_digest(expected, parts.get("v1", ""))
```

### Pull feed

`GET /integration/v1/events?after=<last id>&limit=100&types=booking.created,invoice.paid` returns events oldest first with `nextAfter`. Store the last id you processed and poll every few seconds. Use the feed instead of webhooks when your system cannot accept inbound HTTP, or alongside them to backfill after an outage. The feed keeps every event, including those already delivered by webhook.

### Event catalogue

`booking` in a payload is the full job card, in the same shape as `GET /integration/v1/job-cards/{ref}`.

| Event | When | Payload |
|---|---|---|
| `customer.created` | First login, or first walk-in booking for a new phone number | `customer`, `referredBy` |
| `customer.updated` | Profile edited | `customer` |
| `customer.deleted` | Customer deleted their account (personal data already scrubbed) | `customerId` |
| `vehicle.created` / `vehicle.updated` | Bike added or edited | `customerId`, `vehicle` |
| `vehicle.archived` | Bike removed from the garage | `customerId`, `vehicleId` |
| `booking.created` | New job card from the app or the integration API | `booking` |
| `booking.cancelled` | Cancelled by the customer or the workshop | `from`, `to`, `note`, `booking` |
| `job_card.status_changed` | Any other status change | `from`, `to`, `note`, `booking` |
| `job_card.assigned` | Bay, people, slot, ready-by time or odometer changed | `changes`, `booking` |
| `job_card.extra_raised` | A part was sent for approval | `jobCardId`, `extra` |
| `job_card.extra_decided` | A part was approved or declined | `jobCardId`, `extra` (`id`, `partName`, `amount`, `status`), `via` |
| `job_card.media_added` | Photo, video or note added | `jobCardId`, `media` |
| `job_card.closed` | Invoice issued | `booking`, `invoice` (lines, GST, totals) |
| `job_card.pay_at_delivery` | Customer chose to pay the rider at the door | `jobCardId`, `customerId` |
| `payment.pending` | Online payment started in the app; needs confirming | `invoiceId`, `jobCardId`, `customerId`, `method`, `amount` (entityId is the payment id) |
| `payment.succeeded` / `payment.failed` | A payment settled or failed | `invoiceId`, `method`, `amount`, reference |
| `invoice.paid` | Invoice fully paid | `invoice` |
| `review.submitted` | Customer rated a service | `stars`, `tags`, `note`, `workVotes`, `staffVote`, `followUpInterests` |
| `wallet.transaction` | Wallet credited or debited | `customerId`, `amount`, `kind`, `title`, `detail` |
| `referral.rewarded` | Referred friend's first job card was delivered; both got credit | `referrerId`, `refereeId`, `amount` |

## 5. Common recipes

**Mirror app bookings into the ERP.** On `booking.created`, create the ERP job card with the customer's phone, plate, services and slot. Then store the link with `PUT /external-refs` (`entityType: "job_card"`, `system: "erp"`). From then on, the ERP drives the job with the job card number.

**Keep the advisor and mechanic panels in step.** Wherever a panel saves a status, bay or mechanic, also call `PUT .../status` or `PATCH .../assignment`. If changing the panels is not possible, run a small sync job that polls the legacy job card table for changes and makes the same calls.

**Close and bill.** Call `POST .../close`, then book the invoice in the ERP from the `job_card.closed` payload (`invoice.lines`, `gstAmount`, `total`). The invoice number is `INV-` plus the job card's digits.

**Cash at the door.** When the rider collects, call `POST .../payments` with `method: "cash"` (or `upi` with the UTR as `reference`), then `PUT .../status` `delivered`.

**CRM follow-ups.** On `review.submitted`, create leads from `followUpInterests` and flag reviews below 4 stars for a call back. Use `POST /notifications` for service reminders; insurance and PUC dates come from the vehicle documents.

**Nightly reconciliation.** Always page with `cursor`/`nextCursor`. `nextUpdatedSince` is kept for old clients but can skip rows that were changed at the same instant. Page through `GET /integration/v1/job-cards?updatedSince=` and `GET /integration/v1/customers?updatedSince=` to catch anything missed.

## 6. Testing an integration

1. Start the API with the demo data (see the [README](../README.md#run-it-locally)). The demo customer has a job card in Bay 03 with two parts waiting for approval.
2. Open `http://localhost:8080/docs`, click **Authorize**, and enter the `X-Api-Key` from `.env` (`INTEGRATION_API_KEYS`).
3. Point `WEBHOOK_URL` at a request inspector (a webhook.site URL in staging, or any small local HTTP server that logs requests) to see the events as you make calls.
4. `npm test` in `app-backend` runs the whole lifecycle end to end. It is the most complete worked example of these calls.
