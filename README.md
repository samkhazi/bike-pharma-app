# Bike Surgeon

A two-wheeler service workshop app for riders in Davangere. Riders book a pickup or workshop visit, see the price first, and follow their bike through the bay on a live camera. They approve extra parts with the price shown, then pay by wallet, UPI or cash at delivery.

This repository contains the two agreed deliverables:

| Folder | What it is |
|---|---|
| [`app-frontend/`](app-frontend/README.md) | The customer app: React 19 + TypeScript + Vite, shipped to iOS and Android with Capacitor 8 |
| [`app-backend/`](app-backend/README.md) | The API: Node.js 22 + TypeScript + Hono + PostgreSQL, with a customer API for the app and an integration API for the CRM/ERP |

## Documentation

Start with the guide that matches your job.

| Guide | For |
|---|---|
| [1. Architecture](docs/01-architecture.md) | Everyone: the pieces, how a service flows, design decisions, code map |
| [2. Database](docs/02-database.md) | Backend, data and ERP teams: every table and column, the job card lifecycle, conventions |
| [3. Connecting your database](docs/03-connecting-your-database.md) | Whoever runs the database: plugging the API into a new or existing PostgreSQL |
| [4. CRM and ERP integration](docs/04-crm-erp-integration.md) | CRM/ERP developers: integration API, webhooks, events, recipes |
| [5. API reference](docs/05-api-reference.md) | Every endpoint, generated from the OpenAPI spec |
| [6. Wiring the app to the API](docs/06-frontend-integration.md) | Mobile developers: replacing the app's sample data, screen by screen |
| [7. Deployment](docs/07-deployment.md) | DevOps: Docker, environment variables, providers, cameras, app store builds |
| [8. Open items](docs/08-open-items.md) | Project leads: what is done, what waits on vendors or decisions, what is out of scope |

## Run it locally

You need Node.js 22+ and Docker.

```bash
# 1. Database and API
cd app-backend
cp .env.example .env
docker compose up -d db              # PostgreSQL 16 on localhost:5433
npm install
npm run db:migrate                   # create tables
npm run db:seed:demo                 # workshop data + the demo customer
npm run dev                          # http://localhost:8080, API docs at http://localhost:8080/docs

# 2. App (in another terminal)
cd app-frontend
npm install
npm run dev                          # http://localhost:5173
```

If your Docker has no `compose` command, start the database with:

```bash
docker run -d --name bike-surgeon-db -p 5433:5432 \
  -e POSTGRES_USER=bikesurgeon -e POSTGRES_PASSWORD=bikesurgeon -e POSTGRES_DB=bikesurgeon postgres:16-alpine
```

Try the API as the demo customer: request a code for `9876543210` with `POST /v1/auth/otp/request`, then verify it with code `4719` (`OTP_DEV_CODE`). Try the integration API from `/docs` with the `X-Api-Key` from `INTEGRATION_API_KEYS` in `.env`.

```bash
cd app-backend && npm test           # end-to-end test of every flow (needs the database running)
```

## Current state

The app and the API are each complete and tested. **The app still runs on built-in sample data and is not yet wired to the API.** Wiring it, choosing a payment gateway, an SMS gateway and an RC lookup provider, and connecting the workshop's existing panels are the next steps. See [Open items](docs/08-open-items.md).
