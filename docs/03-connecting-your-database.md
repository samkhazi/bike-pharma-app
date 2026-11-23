# Connecting your database

The API runs on any PostgreSQL 13+ server. Point it at the server with two settings, create the tables with one command, and check them with another.

```bash
# app-backend/.env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
DB_SCHEMA=bike_surgeon_app      # the schema the app's tables live in
DB_SSL=require                  # off | require | no-verify

npm run db:migrate              # creates the schema and tables (safe to re-run)
npm run db:seed                 # workshop, staff, bays, services, offers
npm run db:check                # confirms every table and column the API uses exists
```

`GET /health/ready` reports the schema and the last migration once the API is running.

## Choose a setup

| | Setup | When | Effort |
|---|---|---|---|
| **A** | Same database server, separate schema | The workshop's panels already run on PostgreSQL and you want one database to back up and secure | Lowest; recommended |
| **B** | Separate database | The existing system is not PostgreSQL (MySQL, SQL Server, a hosted ERP), or you want hard isolation | Low |
| **C** | App tables replaced by views over existing tables | You must read the legacy rows directly and cannot sync through the API | High; advanced |

In A and B the existing panels and ERP talk to the app through the [Integration API and webhooks](04-crm-erp-integration.md). In C they keep writing their own tables and the app reads them through views.

### A. Same database server, separate schema (recommended)

```bash
DATABASE_URL=postgres://bike_surgeon_app:...@prod-db:5432/workshop
DB_SCHEMA=bike_surgeon_app
```

`npm run db:migrate` runs `CREATE SCHEMA IF NOT EXISTS bike_surgeon_app` and creates every table inside it. Nothing outside that schema is created, altered or read. Every API connection sets `search_path` to `bike_surgeon_app, public`.

Give the API its own database role:

```sql
CREATE ROLE bike_surgeon_app LOGIN PASSWORD '...';
CREATE SCHEMA bike_surgeon_app AUTHORIZATION bike_surgeon_app;
-- Nothing else. The role needs no access to the existing billing/advisor/mechanic tables.
```

If your reporting or ERP needs to read app data with SQL, grant it read access to the schema:

```sql
GRANT USAGE ON SCHEMA bike_surgeon_app TO reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA bike_surgeon_app TO reporting;
ALTER DEFAULT PRIVILEGES FOR ROLE bike_surgeon_app IN SCHEMA bike_surgeon_app GRANT SELECT ON TABLES TO reporting;
```

Keep writes going through the Integration API, even when SQL access is possible. A direct `UPDATE job_cards SET status = ...` changes the row, but skips the timeline entry, the customer's notification, the invoice and the webhook event.

### B. Separate database

Same as A with a dedicated database, so `DB_SCHEMA=public` is fine. Use this when the existing system is not PostgreSQL. Data moves between the two through the Integration API (into the app) and webhooks or the events feed (out of the app).

### C. Views over existing tables (advanced)

This option makes the app read and write the existing panels' rows directly. It is only worth it if the legacy database is PostgreSQL and an API-based sync is ruled out. Expect to adapt the schema in a few places:

1. Run `npm run db:migrate` into the app schema as usual.
2. For each table you want to source from the legacy system, drop the app's table and create a view with the **same name and columns**:

   ```sql
   -- Example only: bay_master and its columns stand in for whatever the legacy table is called.
   SET search_path TO bike_surgeon_app;
   ALTER TABLE job_cards DROP CONSTRAINT job_cards_bay_id_fkey;   -- foreign keys cannot point at a view
   DROP TABLE bays;
   CREATE VIEW bays AS
     SELECT b.bay_uuid      AS id,
            w.id            AS workshop_id,
            b.bay_code      AS code,
            b.bay_name      AS name,
            b.rtsp_http_url AS camera_stream_url,
            b.is_active     AS active,
            b.created_on    AS created_at,
            b.modified_on   AS updated_at
     FROM public.bay_master b CROSS JOIN workshops w;
   ```

3. Run `npm run db:check`. It lists every missing table or column and any type differences, and exits non-zero until the views are complete.
4. Views the API writes to (`job_cards`, `job_card_extras`, `customers`, `vehicles`, ...) must be [automatically updatable](https://www.postgresql.org/docs/current/sql-createview.html#SQL-CREATEVIEW-UPDATABLE-VIEWS): one table, no aggregates. Otherwise they need `INSTEAD OF` triggers. Columns the legacy table lacks (for example `pay_at_delivery`) must be added to it or kept in a side table joined by the trigger.
5. Ids must be uuids, or you change the matching columns in the migration before running it.
6. Keep the constraint names the API relies on: `job_cards_one_open_per_vehicle`, `vehicles_active_registration` and `customers_referral_code_key`. They turn duplicate bookings, vehicles and referral codes into clean `409` errors.

Start with read-mostly master data (`bays`, `staff`, `service_catalog`) and keep the transactional tables as real tables synced through the API. Mapping `job_cards` itself onto a legacy table is possible, but it is the most work and the hardest to test.

## Mapping the existing system's tables

The previous developer's notes list these tables in the shared production database. The exact column names were never shared, so the mapping below is by meaning. Confirm it against the real schema before choosing option C.

| Existing table (per previous notes) | App table(s) | Notes |
|---|---|---|
| Job card (status field drives every stage, tied to a bay) | `job_cards`, `job_card_status_history`, `job_card_services`, `job_card_extras` | Map the legacy status values onto the eight statuses in [Database](02-database.md#job-card-lifecycle). |
| Bay (each has a live camera stream address) | `bays` | `camera_stream_url` must be reachable over HTTP from the API server. For RTSP cameras, see [Deployment](07-deployment.md#bay-cameras). |
| Customer / User (phone-based accounts) | `customers` | Match on phone in E.164 (`+91XXXXXXXXXX`). |
| Device-token table (OneSignal) | `device_tokens` | Same idea; `provider = 'onesignal'`, `token` = subscription id. |
| Product / Order / Cart (spare parts) | (none) | Spare-parts ordering is out of scope for this release. |

## Keeping ids in step

Use `external_references` to remember which ERP or CRM record each app record corresponds to:

```bash
curl -X PUT $API/integration/v1/external-refs -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"entityType":"job_card","entityId":"<app job card uuid>","system":"erp","externalId":"JC-88812"}'

curl "$API/integration/v1/external-refs?system=erp&externalId=JC-88812" -H "X-Api-Key: $KEY"
```

Most integration endpoints also accept the human job card number (`BS-2026-000124`) wherever they take a job card, and staff and bays are addressed by their codes. Many integrations need no id mapping at all.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `connect ECONNREFUSED` | Wrong host or port, or the database is not running. Local Docker uses port 5433. |
| `no pg_hba.conf entry` / SSL errors | Set `DB_SSL=require` (or `no-verify` for providers with self-signed certificates). |
| `permission denied for schema` | The role needs `CREATE` on the database (to create the schema) or ownership of `DB_SCHEMA`. |
| `/health/ready` says no migrations | Run `npm run db:migrate` with the same `DATABASE_URL` and `DB_SCHEMA` as the API. |
| `function gen_random_uuid() does not exist` | PostgreSQL older than 13. Upgrade, or run `CREATE EXTENSION pgcrypto;` first. |
| `Workshop DVG-01 is missing` | Run `npm run db:seed`, or set `WORKSHOP_CODE` to your workshop's code. |
