-- Workshop bridge, version 2.
-- Links the app to the workshop's own systems without changing anything the app already does:
--   * the old billing database (MySQL bikesurgeonoff): customers, bikes, bays + cameras, job cards, bills
--   * the Bike Surgeon Inventory (inventory.bikesurgeon.online): parts with part number, MRP, GST, HSN and stock
-- Everything here only ADDS columns and tables. Existing columns, checks and app behaviour stay as in version 1.

-- Parts from the Inventory, copied every minute (read only here; the Inventory stays the place to edit them).
CREATE TABLE inventory_parts (
  id          integer PRIMARY KEY,            -- part id in the Inventory
  store       text NOT NULL DEFAULT 'BS',
  part_no     text NOT NULL,
  part_key    text NOT NULL DEFAULT '',       -- part number in capitals without spaces or dashes
  name        text NOT NULL,
  brand       text NOT NULL DEFAULT '',
  model       text NOT NULL DEFAULT '',
  hsn         text NOT NULL DEFAULT '',
  gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  mrp         numeric(12,2) NOT NULL DEFAULT 0,
  customer_discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  stock       integer NOT NULL DEFAULT 0,
  rack        text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  inventory_updated bigint NOT NULL DEFAULT 0, -- the Inventory's own change stamp (ms)
  synced_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_parts_key ON inventory_parts (store, part_key);

-- Extra parts can point at a real Inventory part. Old rows keep working with only a name and an amount.
ALTER TABLE job_card_extras
  ADD COLUMN inventory_part_id integer,
  ADD COLUMN part_no text,
  ADD COLUMN quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  ADD COLUMN hsn text,
  ADD COLUMN gst_percent numeric(5,2);

-- Invoice lines can carry the part number, quantity and the line's own GST (workshop bills have a GST per part).
ALTER TABLE invoice_lines
  ADD COLUMN part_no text,
  ADD COLUMN gst_percent numeric(5,2),
  ADD COLUMN gst_amount numeric(12,2);

-- Where an invoice came from: issued by the app at close, or copied from the workshop's billing.
ALTER TABLE invoices
  ADD COLUMN source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'workshop'));

-- The workshop can stop a bay camera for one job card (the old site's "stream stopped"); the app then shows no live view.
ALTER TABLE job_cards ADD COLUMN camera_paused boolean NOT NULL DEFAULT false;

-- Bridge bookkeeping: cursors, the last run and its counts, one row per key.
CREATE TABLE bridge_state (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Customers whose old records were copied in (once per customer, at first sight).
CREATE TABLE bridge_imported_customers (
  customer_id  uuid PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  old_user_ids integer[] NOT NULL DEFAULT '{}',
  imported_at  timestamptz NOT NULL DEFAULT now()
);

-- App invoices whose parts were sent to the Inventory as a sale (so stock goes down once, never twice).
CREATE TABLE bridge_inventory_sales (
  invoice_id  uuid PRIMARY KEY REFERENCES invoices(id),
  sent_at     timestamptz,
  attempts    integer NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- App bookings copied to the old system's booking list (a_service_bookings), when that is switched on.
CREATE TABLE bridge_booking_requests (
  job_card_id     uuid PRIMARY KEY REFERENCES job_cards(id) ON DELETE CASCADE,
  old_booking_id  integer,
  sent_at         timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Which system an external id belongs to is already in external_references; add the kinds the bridge uses.
ALTER TABLE external_references DROP CONSTRAINT IF EXISTS external_references_entity_type_check;
ALTER TABLE external_references ADD CONSTRAINT external_references_entity_type_check CHECK (entity_type IN (
  'customer', 'vehicle', 'job_card', 'invoice', 'payment', 'staff', 'bay', 'service', 'offer', 'extra'));
