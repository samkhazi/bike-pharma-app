# Data model (Firestore) and backend API

This is the contract between the Flutter app (`app/`) and the Firebase backend (`backend/`).
Region for Cloud Functions: `asia-south1` (Mumbai).

Money is always stored as **integer paise** (₹1 = 100). Timestamps are Firestore `Timestamp`.

## Collections

### `users/{uid}`
| field | type | notes |
|---|---|---|
| name | string | |
| phone | string | E.164, from Firebase Auth phone login |
| activeVehicleId | string? | id in `users/{uid}/vehicles` |
| createdAt | timestamp | |

### `users/{uid}/vehicles/{vehicleId}`
| field | type | notes |
|---|---|---|
| type | `"bike" \| "scooter"` | |
| regNo | string? | uppercase, no spaces, e.g. `MH12AB1234` |
| brand | string | e.g. `Honda` |
| model | string | e.g. `Shine 125` |
| year | number | |
| colour | string? | |
| emission | `"BS4" \| "BS6"` | |
| fuel | string? | `Petrol`, `Electric`… |
| chassisMasked | string? | only last 4 visible, e.g. `ME4JC65XXXXXX4521` |
| source | `"vahan" \| "manual"` | |
| fitKey | string | `"<brand>\|<model>"` lowercased, used to filter products |

### `users/{uid}/cart/{productId}`
`{ qty: number, addedAt: timestamp }`

### `products/{productId}`
| field | type | notes |
|---|---|---|
| name | string | |
| category | `"spares" \| "accessories"` | |
| subCategory | string | `Brakes`, `Engine oil`, `Helmets`… |
| brand | string | part brand |
| price | int (paise) | selling price |
| mrp | int (paise) | |
| stock | int | |
| images | string[] | Storage URLs |
| fits | string[] | list of `fitKey`s this part fits |
| fitsAll | bool | universal accessory (helmet, gloves) |
| rating | number | |
| active | bool | |

App rule from Sam: Shop and search show only products where `fitsAll == true` or `fits` contains the customer's active vehicle `fitKey`.

### `warranties/{warrantyId}` (written by the shop / admin when a warranty-covered part is billed)

| field | type | notes |
|---|---|---|
| uid | string | customer who bought it |
| billNo | string | shop bill number, e.g. `BP-24117` |
| productName, brand | string | |
| serial | string? | serial number printed on the part (batteries etc.) |
| vehicle | string? | e.g. `Honda Shine 125 · BS6` |
| purchasedAt | timestamp | bill date; warranty starts here |
| months | number | warranty length |

The app's Warranty tracker (Profile > Warranty tracker) lists these, shows days left, and lets the customer start a claim on WhatsApp.

### `orders/{orderId}` (created only by the `placeOrder` function)
| field | type |
|---|---|
| uid | string |
| items | `{ productId, name, price, qty, listPrice? }[]` (`price` is what this buyer paid per piece; `listPrice` is stored only when a mechanic discount lowered it) |
| subtotal, deliveryFee, total | int (paise) |
| address | `{ name, phone, line1, line2?, city, pincode }` |
| paymentMethod | `"cod" \| "razorpay"` |
| razorpayOrderId | string? |
| paid | bool |
| status | `"pending_payment" \| "placed" \| "packed" \| "shipped" \| "delivered" \| "cancelled"` |
| mechanicId, mechanicDiscountPercent | string, int — only on a verified mechanic's discounted order |
| createdAt | timestamp |

### `serviceBookings/{bookingId}`
`{ uid, vehicleId, serviceType, date: "YYYY-MM-DD", slot: "10 AM", pickup: bool, status: "booked"|"in_progress"|"done"|"cancelled", createdAt }`

### `modifyRequests/{requestId}`
`{ uid, vehicleId, items: string[], note?, status: "new"|"quoted"|"closed", createdAt }`

### `mechanics/{mechanicId}` — id format `BPM-0001`
| field | type |
|---|---|
| name, garageName | string |
| photos | string[] |
| specialistBrands, vehicleTypes, services | string[] |
| rating | number |
| experienceYears | number |
| spareBuyerSince | number (year) |
| address | string |
| geo | `{ lat, lng }` |
| phone | string |
| openHours | string |
| verified, active | bool |

QR code content for a mechanic: `bikepharma://mechanic/BPM-0231` (the app also accepts the bare id).

The `uid` field links a mechanic to their login when they joined through the app signup.

### `mechanicApplications/{uid}` (mechanic signup, one per login)
A mechanic signs up from the app's Mechanic section. Nothing is public until the shop verifies it.

| field | type |
|---|---|
| name, garageName, phone, address, openHours | string |
| mapsLink | string (Google Maps link or `lat, lng`; the shop can type the location when verifying) |
| specialistBrands, vehicleTypes, services | string[] (at least one brand and one service) |
| photos | string[] |
| experienceYears | number |
| status | `"pending"` \| `"approved"` \| `"rejected"` |
| mechanicId | string, set on approval (`BPM-0416`) |
| reason | string, the shop's message on rejection |
| createdAt, updatedAt, reviewedAt | timestamp |

The mechanic can create it and edit it while it is pending or rejected (always saved back as pending). Only the `reviewMechanicApplication` function approves or rejects it; approval creates the `mechanics/{BPM-…}` doc.

### `offers/{offerId}`
`{ tag, title, subtitle, cta, target: "service"|"shop"|"accessories", order: number, active: bool }`

### Profiles (roles)
One app, four profiles. The login number decides which one opens:

| profile | who | how the backend knows |
|---|---|---|
| customer | anyone | default |
| mechanic | signed up in the Mechanic section | `mechanicApplications/{uid}` exists; verified once `status == "approved"` |
| team (staff) | shop staff: verify mechanics, later inventory and billing | `team/{phone}` with `role: "staff"` |
| owner | the shop owner: everything the team has, plus team members and mechanic discounts | `admins/{uid}`, or `team/{phone}` with `role: "owner"` |

Functions check this with `staffRole()` / `isAdmin()` in `functions/src/config.ts`; the rules use `isShopOwner()` / `isAdmin()`.

### `admins/{uid}`
Presence of the doc = owner. Created by hand in the Firebase console (first owner); after that the owner can add more owners by number in `team`.

### `team/{phone}` — id is the E.164 number, e.g. `+919876543210`
| field | type |
|---|---|
| name | string |
| role | `"owner"` \| `"staff"` |
| addedBy | string (uid) |
| addedAt | timestamp |

Only an owner writes it. An owner can't remove their own number or drop their own owner role. A member can read their own entry, which is how the app knows to open the team profile after OTP login.

### `mechanicDiscounts/{mechanicId}` — id is the `BPM-…` id
| field | type |
|---|---|
| percent | int, 0 to 50 |
| uid | string? (the mechanic's login, for reference) |
| updatedBy | string (uid) |
| updatedAt | timestamp |

Only an owner writes it. `placeOrder` applies it on the server when the caller is that verified, active mechanic (`mechanicApplications/{uid}.mechanicId` → `mechanics/{id}` with the same `uid`, `verified` and `active`), so customers never get it. Price per piece = list price less `percent`, rounded to the nearest rupee and never above the list price (`mechanicPrice()` in `functions/src/lib/orders.ts` and `app/lib/models/models.dart`). The mechanic can read their own entry to see the price in the app.

### `counters/mechanics`
`{ next: number }` used to generate mechanic ids.

## Callable functions

| name | input | output |
|---|---|---|
| `lookupVehicle` | `{ regNo }` | `{ regNo, brand, model, year, colour, emission, fuel, chassisMasked }` — calls the RC lookup provider (Surepass); returns `failed-precondition` if no provider key is configured |
| `placeOrder` | `{ items: {productId, qty}[], address, paymentMethod }` | `{ orderId, total, razorpay?: { orderId, keyId, amount } }` — prices and stock are read on the server, never trusted from the app; a verified mechanic gets their `mechanicDiscounts` percent |
| `verifyPayment` | `{ orderId, razorpayPaymentId, razorpaySignature }` | `{ paid: true }` |
| `createMechanic` (team) | mechanic fields | `{ mechanicId }` |
| `reviewMechanicApplication` (team) | `{ uid, approve, reason?, geo? }` | `{ status, mechanicId? }` — approve issues the next BPM id and publishes the mechanic; reject stores the reason for the mechanic to see |

HTTP function `razorpayWebhook` marks orders paid from Razorpay's `payment.captured` event (signature checked).
