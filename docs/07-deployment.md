# Deployment

## Backend

The API is a single Node.js 22 process (HTTP server plus background worker) with PostgreSQL behind it. It is stateless, so run as many instances as you like behind a load balancer. The worker uses `FOR UPDATE SKIP LOCKED`, so several instances can deliver webhooks without sending an event twice at the same time.

### With Docker

```bash
cd app-backend
docker build -t bike-surgeon-api .
docker run --env-file .env -p 8080:8080 bike-surgeon-api node dist/scripts/migrate.js   # release step
docker run --env-file .env -p 8080:8080 bike-surgeon-api                                # serve
```

`docker-compose.yml` runs PostgreSQL and the API together for local use or a single small server.

### Without Docker

```bash
cd app-backend
npm ci && npm run build
NODE_ENV=production node --env-file=.env dist/scripts/migrate.js
NODE_ENV=production node --env-file=.env dist/src/index.js
```

### Health checks

- `GET /health`: liveness (the process is up)
- `GET /health/ready`: readiness (database reachable and migrated). Route traffic only when this returns 200.

### Release checklist

- [ ] PostgreSQL 13+ with daily backups and point-in-time recovery. Decide on [schema placement](03-connecting-your-database.md).
- [ ] `npm run db:migrate` runs as a release step before new instances start.
- [ ] `npm run db:seed` once, then replace the placeholder workshop address and phone numbers in `workshops` and `staff`, or let the ERP own them through the integration API.
- [ ] Never load `db:seed:demo` into production (the script refuses when `NODE_ENV=production`).
- [ ] `NODE_ENV=production`. The API then refuses to start with `OTP_DEV_CODE` set, with `OTP_PROVIDER=console`, or with integration keys shorter than 24 characters.
- [ ] `JWT_SECRET` is 32+ random characters, kept in a secret manager. Changing it signs everyone out.
- [ ] HTTPS in front of the API (load balancer or reverse proxy). `PUBLIC_BASE_URL` is the public HTTPS URL.
- [ ] `CORS_ORIGINS` lists only the app origins you ship.
- [ ] Per-IP rate limiting at the load balancer or gateway, especially on `/v1/auth/*`.
- [ ] Logs collected from stdout and stderr. Watch for `[worker]` and `[push]` errors and for rows in `integration_events` where `attempts > 5`.

## Environment variables

Defaults are in parentheses. The API validates all of them at startup and lists every problem at once.

| Variable | Purpose |
|---|---|
| `NODE_ENV` (`development`) | `production` turns on the safety checks above |
| `PORT` (`8080`) | HTTP port |
| `PUBLIC_BASE_URL` | Public URL of the API; used to build camera links |
| `CORS_ORIGINS` | Comma-separated browser origins allowed on `/v1` |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `DB_SCHEMA` (`public`) | Schema for the app's tables |
| `DB_POOL_MAX` (`10`) | Connections per instance |
| `DB_SSL` (`off`) | `off`, `require` (verify certificate), `no-verify` |
| `JWT_SECRET` | Signs access tokens and camera links (required, 32+ chars) |
| `ACCESS_TOKEN_TTL_SECONDS` (`3600`) | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` (`60`) | How long a phone stays signed in without opening the app |
| `WORKSHOP_CODE` (`DVG-01`) | Which `workshops.code` this API serves |
| `GST_RATE` (`0.18`) | GST applied when invoices are issued |
| `REFERRAL_REWARD` (`200`) | Wallet credit for each side of a referral |
| `TIMEZONE` (`Asia/Kolkata`) | Used for booking numbers, offer expiry and message times |
| `OTP_PROVIDER` (`console`) | `console` prints codes to the log; `http` posts them to your gateway |
| `OTP_HTTP_URL`, `OTP_HTTP_TOKEN` | Gateway endpoint. Receives `POST {phone, code, channel, purpose}` with `Authorization: Bearer <token>`. |
| `OTP_TTL_SECONDS` (`300`) | Code lifetime |
| `OTP_DEV_CODE` | Fixed code for development and staging; forbidden in production |
| `PUSH_PROVIDER` (`none`) | `onesignal` to send push notifications |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` | OneSignal app id and REST API key |
| `VEHICLE_LOOKUP_URL`, `VEHICLE_LOOKUP_TOKEN` | RC lookup service: `GET {url}?registration=KA01MY4500` returning `{make, model, colourName, makeYear, chassisLast4}` |
| `INTEGRATION_API_KEYS` | Comma-separated keys for `/integration/v1`. Empty disables the integration API. |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Event delivery target and signing secret |
| `WORKER_INTERVAL_MS` (`3000`) | How often the worker looks for events and push notifications |
| `CAMERA_TOKEN_TTL_SECONDS` (`900`) | Camera link lifetime |

## Plugging in providers

Each provider is a small adapter in `app-backend/src/providers.ts`.

- **SMS / WhatsApp codes.** The `http` provider posts `{phone, code, channel}` to any URL. Either point it at a small relay in front of your gateway (MSG91, Gupshup, Twilio, a WhatsApp Business provider), or add a vendor-specific branch next to it.
- **Push.** OneSignal's REST API is implemented: it sends to the subscription ids in `device_tokens`. For FCM or APNs directly, add another branch to `push`.
- **RC lookup.** The `http` provider calls one URL with the registration number. Without it, `/v1/vehicles/lookup` returns `501` and the app falls back to manual entry.

## Bay cameras

The API proxies the bay camera's HTTP stream to the customer. The camera address is never sent to the phone, and each link is tied to one job card and expires.

- Store an HTTP URL in `bays.camera_stream_url`: an HLS playlist (`http://cam-gw.local:8888/bay03/index.m3u8`), an MP4, or an MJPEG stream.
- Most IP cameras speak **RTSP**, which browsers cannot play. Run a small gateway such as [MediaMTX](https://github.com/bluenviron/mediamtx) or [go2rtc](https://github.com/AlexxIT/go2rtc) on the workshop network to republish each camera as HLS. Put the HLS URL in `camera_stream_url`.
- The API server must be able to reach that URL, over a VPN or tunnel if the cameras sit on the workshop LAN.
- Bandwidth passes through the API. For many simultaneous viewers, put the gateway behind a CDN and adapt the camera route to return signed CDN URLs instead of proxying.

## Mobile apps

```bash
cd app-frontend
npm ci
cp .env.example .env.production     # VITE_TEST_TOOLS=off, plus VITE_API_URL once wired
npm run ios:sync && npm run ios:open           # Xcode: set the signing team, archive, upload
npm run android:sync && npm run android:open   # Android Studio: build a signed bundle
```

- Capacitor 8. iOS: minimum iOS 15, Swift Package Manager (no CocoaPods), a current Xcode and an Apple Developer account. `npm run ios:device` (`scripts/ios-device.sh`) installs a debug build on a connected iPhone.
- Android: `compileSdk`/`targetSdk` 36, `minSdk` 24 (`android/variables.gradle`). Use a current Android Studio.
- App icons and splash screens come from `assets/`; regenerate them with `npm run icons`.
- Bundle id / application id: `com.bikesurgeon.customer`.
