# Bike Surgeon API

Node.js 22, TypeScript, [Hono](https://hono.dev), PostgreSQL 13+. It serves the customer app (`/v1`) and the workshop's CRM/ERP (`/integration/v1`), delivers events as signed webhooks, sends push notifications, and proxies the bay cameras.

```bash
cp .env.example .env
docker compose up -d db        # PostgreSQL on localhost:5433
npm install
npm run db:migrate
npm run db:seed:demo           # or db:seed for reference data only
npm run dev                    # http://localhost:8080 · Swagger UI at /docs
```

| Script | Does |
|---|---|
| `npm run dev` | API with reload on change |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | TypeScript check |
| `npm test` | End-to-end tests against the database in `DATABASE_URL`, in a throwaway `bs_test` schema |
| `npm run db:migrate` | Apply new files in `db/migrations/` to `DB_SCHEMA` |
| `npm run db:check` | Compare the target schema with what the API expects, without writing anything |
| `npm run db:seed` | Workshop, staff, bays, services, offers |
| `npm run db:seed:demo` | The above plus the demo customer (not allowed in production) |
| `npm run openapi` | Regenerate `openapi.json` from the routes |

## Connecting a database

Set `DATABASE_URL` and `DB_SCHEMA`, then run `npm run db:migrate` and `npm run db:check`. To share the workshop's existing PostgreSQL database, use a dedicated schema such as `DB_SCHEMA=bike_surgeon_app`. Full guide: [Connecting your database](../docs/03-connecting-your-database.md).

## Where things are

| Path | Contents |
|---|---|
| `src/routes/customer.ts` | Endpoints the app calls |
| `src/routes/integration.ts` | Endpoints the CRM/ERP calls |
| `src/services/` | Business rules and SQL: bookings and job cards, billing, customers, vehicles, catalogue, events, notifications |
| `src/schemas.ts` | Request and response schemas; also produce the OpenAPI document |
| `src/providers.ts` | SMS/WhatsApp, push and RC lookup adapters |
| `src/worker.ts` | Webhook delivery and push sending |
| `db/migrations/` | Schema |
| `db/seeds/` | Reference and demo data |

Every variable in `.env.example` is explained in [Deployment](../docs/07-deployment.md#environment-variables).
