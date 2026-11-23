# Workshop bridge: old billing + Inventory

The customer app keeps its own PostgreSQL database (setup A in [03](03-connecting-your-database.md)). With `BRIDGE=on`
the API fills it from the systems the workshop already uses, every `BRIDGE_INTERVAL_MS` (20 s):

| From | What | Into the app |
|---|---|---|
| Old billing MySQL `bay` | name, camera link (`url`), status | Bays, live bay camera (HLS links play through `/v1/camera/...`) |
| `mechanic`, `service_adviser` | names, phones | Mechanic and advisor on the tracker |
| `user`, `a_bikes` | name, bikes, wallet | At the customer's **first login** (matched by mobile number): bikes, all old job cards and bills, wallet once |
| `job_card` | status, bay, mechanic, `stream_status`, km, ready time | Live tracker stage, bay, mechanic, camera on/off |
| `job_labour_items` | labour lines | Services on the job card and the estimate |
| `service_invoice`, `invoice`, `invoice_items` | bill, parts, GST, payment status, split cash/UPI/card, wallet | Invoice (marked *workshop*), payment history, "Paid in full" |
| Inventory `GET /api/feed/parts` | part no, name, HSN, GST, MRP, customer discount, stock | `inventory_parts`; extras can be raised by part number at MRP less the discount |

Back to the workshop:

- Bills issued **in the app** take their parts out of Inventory stock once (`POST /api/import/sales`). Bills made at the
  counter are not sent from here, because the admin panel already sends them (stock never drops twice).
- With `OLD_DB_WRITE=on`, app bookings are added to `a_service_bookings` (status `pending`) so reception sees them. When
  reception opens the job card for that bike, the app booking follows it.
- Workshop bills are paid at the counter. The app shows them and refuses to take payment for them (`pay_at_workshop`).

Status mapping: `PENDING`/`NOT_APPROVED` → at the workshop; `ONGOING`/`Work in progress`/`STREAM_STOPPED` → being serviced;
`COMPLETED` → delivered once a bill exists (or 24 h after completion); `CANCEL…` → cancelled. Stages only move forward.
`stream_status = STOPPED` turns the camera off. Old dates (IST, several formats) are read as India time.

The old database is only read, except `a_service_bookings` when `OLD_DB_WRITE=on`. Old ids are kept in
`external_references` (system `old_bs`), so nothing is copied twice. Only one server runs the bridge at a time (advisory lock).
