# Wiring the app to the API

The customer app in `app-frontend/` is complete as a product, but every screen still runs on **sample data built into the app**. It does not call the API yet. This page lists where each piece of sample data lives and which endpoint replaces it. The API returns the shapes the screens already use, so wiring is mostly swapping sources rather than redesigning screens.

Run both side by side while you work:

```bash
cd app-backend && npm run dev          # http://localhost:8080, demo data loaded (see README)
cd app-frontend && npm run dev         # http://localhost:5173
```

The demo seed (`npm run db:seed:demo`) matches the app's **Returning** sample customer: same bikes, the live job in Bay 03 with two parts to approve, a paid invoice, wallet ₹420. Screens should look the same before and after wiring. Log in as `98765 43210` with code `4719`.

## Suggested approach

1. **Add an API client.** Put a small `src/api.ts` around `fetch` with `VITE_API_URL` as the base URL. It should add the bearer token, call `/v1/auth/refresh` once on a `401`, and unwrap `{ error: { code, message } }` into toasts. You can generate types from `app-backend/openapi.json` with `npx openapi-typescript ../app-backend/openapi.json -o src/api-types.ts`.
2. **Store tokens on the device.** `src/native.ts` has a `store` helper over `localStorage`. Keep the refresh token in the Keychain/Keystore via a secure-storage Capacitor plugin rather than `localStorage`.
3. **Swap the fake loading for real loading.** `useFetched` / `Fetching` in `customer-app.tsx` (around line 709) wait a fixed 700 ms (`FETCH_MS`) and then show the screen. They already render skeletons for every list screen. Keep the skeletons and wait on the real request instead.
4. **Replace `DemoState`.** `CustomerApp` holds everything in one `DemoState` seeded from `presets` (around line 5369). Swap that for server data (a query library such as TanStack Query works well) and turn each `setState` that changes data into the matching API call.
5. **Remove the test tools for store builds.** `VITE_TEST_TOOLS=off` hides the "Test build" section on Profile (the sample-customer switcher). See `app-frontend/.env.example`.

## Screen by screen

Line numbers refer to `app-frontend/src/customer-app.tsx` at handoff.

| Screen | Sample data today | Replace with |
|---|---|---|
| Login / Sign up, OTP | `Auth` (~1176); fixed code `otpCode = "4719"` (~1266) with an animated "SMS arrived" demo | `POST /v1/auth/otp/request`, then `POST /v1/auth/otp/verify`. "Get the code on WhatsApp" sends `channel: "whatsapp"`. Pass a referral code if the user arrived through a referral link. |
| Create account ("Add your bike") | `CreateAccount` (~1504); "Find" pretends to look up `MH12AB1234` as a Hero Xtreme 160R | `PATCH /v1/me` (name), `POST /v1/vehicles/lookup` (needs `VEHICLE_LOOKUP_URL`; on `501`/`404` fall back to manual entry), `POST /v1/vehicles`. Show this screen only when `isNewCustomer` is true. |
| Home | `HomeScreen` (~1932) reads `state.bookings`, `vehicles`, `offerList`, `advisor` | `GET /v1/bookings`, `GET /v1/vehicles`, `GET /v1/offers`, `GET /v1/workshop`, `GET /v1/notifications` (unread badge) |
| Book service | `BookingScreen` (~2155): `services` (~233), `offerList` (~244), hardcoded `days` and slot list (~2238), `confirm()` builds a booking locally | `GET /v1/services`, `GET /v1/offers`, `GET /v1/vehicles`, `GET /v1/me/addresses`; `confirm()` → `POST /v1/bookings` with `slotStart`/`slotEnd` as ISO times. A `409 vehicle_has_open_booking` matches the screen's existing "bike unavailable" state. |
| Track + live view | `Tracker` (~2702), `stages` (~259), `CameraFeed` (~2531) plays `/bay-cam.mp4` | `GET /v1/bookings/{id}`. `stage` is the tracker index and `timeline` has the time of each step. Refresh on push or every 20–30 s while open. Camera: `GET /v1/bookings/{id}/camera` and play `playbackUrl` (see below). |
| Part approval | `Approval` (~2893), `bayNotes` (~284) | `extras` on the booking; `POST /v1/bookings/{id}/extras/{extraId}/decision` with `{approve}`, or `POST .../extras/approve-all` |
| Price estimate | `Estimate` (~3138), `billFor()` (~308) | `GET /v1/bookings/{id}/bill`. The server applies the same rules: GST at 18% rounded to the rupee; `kind` is `estimate`, `due` or `paid`. |
| Job card closed + pay | `Pay` (~3017), `paymentFromBooking()` (~489) | `GET /v1/bookings/{id}/bill`; `POST /v1/bookings/{id}/pay` with `{walletAmount, method}`; "Pay at delivery" → `POST /v1/bookings/{id}/pay-at-delivery`. Online methods return a `pendingPayment` that a payment gateway must complete (see [Open items](08-open-items.md)). |
| Invoices / payment history | `Invoices` (~3178), `returningPayments` (~387) | `GET /v1/invoices`, `GET /v1/invoices/{id}`. `walletAmount` and `payments` give the "Paid with" breakdown. |
| Wallet | `WalletScreen` (~3271), `returningTxns` (~291) | `GET /v1/wallet` |
| Refer a friend | `referralCode = "SANATH200"` (~3334) | `GET /v1/referral` (`code`, `shareText`, `referrals`). Sharing keeps using `@capacitor/share`. |
| Offers | `OffersScreen` (~3438), `offerList` | `GET /v1/offers`; apply by passing `offerId` when booking |
| Garage & history | `Garage` (~4216), `vehicles` (~271), `garageBook` (~3462), `kmSchedule` (~3568); document photos saved to `localStorage` (`saveDoc`, ~3744) | `GET /v1/vehicles` (with `documents`), `GET /v1/vehicles/{id}/history`, `GET /v1/vehicles/{id}/maintenance`, `PATCH /v1/vehicles/{id}` (odometer), `PUT /v1/vehicles/{id}/documents/{kind}` (upload the photo to file storage first and send its URL), `DELETE /v1/vehicles/{id}` |
| Add vehicle (from garage) | `AddVehicle` (~3972), same fake lookup | `POST /v1/vehicles/lookup`, `POST /v1/vehicles` |
| Warranty tracker | `Warranty` (~4621), hardcoded `items` | `GET /v1/vehicles/{id}/warranties`. "Add a warranty" is a toast placeholder today. |
| Profile, Edit profile | `Profile` (~4755), `EditProfile` (~4877), `defaultProfile` (~195) | `GET /v1/me`, `PATCH /v1/me`. Add an account-deletion entry (required by the App Store) → `DELETE /v1/me`. |
| Saved addresses, Add address | `savedAddresses` (~219); `AddAddress` (~5076) uses an illustrated map (`CityMap`, `mapAreas`) and a sample contact list | `GET /v1/me/addresses`, `POST /v1/me/addresses` (send `latitude`/`longitude` once a real map is in), `DELETE /v1/me/addresses/{id}` |
| Notifications | `Notifications` (~5304), `notices` (~5290) | `GET /v1/notifications`; `POST /v1/notifications/read`. Each item's `targetScreen` is one of the app's screen names, so `open(item.targetScreen)` works as it does today. |
| Call the advisor, Roadside help | `advisor` (~4671), `roadside` (~4738) | `GET /v1/workshop` (`advisor.phone`, `whatsapp`, `roadsidePhone`) |
| Service review | `ServiceReview` (~2583) | `POST /v1/bookings/{id}/review`. `followUpInterests` and the thumbs (`workVotes`, `staffVote`) map one to one. |
| Spares card | `SparesNote` (~1819) | No change: links to the sister store, Bike Pharma. |

## Field mapping for bookings

The app's `ServiceBooking` type (~145) and the API's `Booking`:

| App (`ServiceBooking`) | API (`Booking`) |
|---|---|
| `id` (`BS-2026-000124`) | `number` (use `id`, a uuid, in URLs) |
| `vehicleId` (`"guerrilla"`) | `vehicle.id` (uuid), plus `vehicle.make/model/registrationNumber` |
| `serviceIds` | `services[].id` (with `name` and `price`) |
| `stage` (0–6) | `stage` (0–6, `-1` if cancelled); `status` is the named stage |
| `extras[].part / note / amount / status / by` | `extras[].partName / note / amount / status / raisedBy` |
| `paid` | `paid` |
| `scheduled` ("Today, 2–4 PM") | Format from `slotStart`, `slotEnd` |
| `eta` ("Ready by 7:30 PM today") | Format from `promisedReadyAt` |
| `mode` | `mode` |
| `estimate` | `estimateAmount` (before GST) |
| `walletPaid` | `walletAmount` on the invoice |
| `collectAtDoor` | `payAtDelivery` |
| Hardcoded "Rahul in Bay 03", "Arjun" | `mechanic.name`, `bay.name`, `rider.name`, `advisor` |

The tracker's stage labels ("Booked", "Rider assigned", "Picked up", "At the workshop", "Being serviced", "Job card closed", "Delivered") match the API's statuses in the same order.

## Live camera

`GET /v1/bookings/{id}/camera` returns `{ bay, playbackUrl, expiresAt }` while the bike is in a bay, and `409 camera_unavailable` otherwise. `playbackUrl` works without headers, so put it straight into the existing `<video>` element:

- **MP4 or MJPEG cameras**: `video.src = playbackUrl` works everywhere.
- **HLS (`.m3u8`)**: Safari and the iOS WebView play it natively. Android's WebView needs [hls.js](https://github.com/video-dev/hls.js): `if (Hls.isSupported()) { const hls = new Hls(); hls.loadSource(playbackUrl); hls.attachMedia(video); }`.
- Links expire after `CAMERA_TOKEN_TTL_SECONDS` (15 minutes); fetch a new one when playback errors.
- Keep the "Camera stopped" and "Live" controls; they work unchanged.

## Push notifications

The API already writes every customer-facing update to `notifications`. When `PUSH_PROVIDER=onesignal`, the worker sends each one to the customer's registered devices. On the app side:

1. Add the OneSignal Capacitor SDK, and initialise it with the app id.
2. After login, register the subscription id: `POST /v1/me/devices` `{ provider: "onesignal", platform: "ios" | "android", token: <subscription id> }`.
3. On a notification tap, read `data.screen` and `data.jobCardId` and `open()` that screen with that booking selected.
4. On logout, `DELETE /v1/me/devices?token=...`.

## Native configuration to check

- `capacitor.config.ts`: `appId` is `com.bikesurgeon.customer`. Signing teams and store listings belong to the client's Apple and Google accounts.
- The API's `CORS_ORIGINS` must include `capacitor://localhost` (iOS) and `https://localhost` (Android) for the native apps, and your web origin if you ship the web build.
- Use HTTPS for `VITE_API_URL` in builds. iOS blocks plain HTTP by default.
