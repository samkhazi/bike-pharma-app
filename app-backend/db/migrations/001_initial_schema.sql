-- Bike Surgeon application schema, version 1.
-- Objects are created unqualified so the migration runner can place them in any schema (DB_SCHEMA).
-- Enumerations are text + CHECK constraints instead of Postgres enum types, so an ERP can add values with a plain ALTER.
-- Money is numeric(12,2) in Indian rupees. Stored estimates are before GST; GST is computed when an invoice is issued.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Workshop, people and bays
-- ---------------------------------------------------------------------------

CREATE TABLE workshops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  address         text NOT NULL DEFAULT '',
  city            text NOT NULL DEFAULT '',
  phone           text,
  whatsapp        text,
  roadside_phone  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL REFERENCES workshops(id),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  role         text NOT NULL CHECK (role IN ('advisor', 'mechanic', 'rider', 'manager')),
  phone        text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bays (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id        uuid NOT NULL REFERENCES workshops(id),
  code               text NOT NULL UNIQUE,
  name               text NOT NULL,
  camera_stream_url  text,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE service_catalog (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  category    text NOT NULL CHECK (category IN ('Service', 'Repair', 'Care')),
  price       numeric(12,2) NOT NULL CHECK (price >= 0),
  sac_code    text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offers (
  id                      text PRIMARY KEY,
  title                   text NOT NULL,
  short_label             text NOT NULL DEFAULT '',
  detail                  text NOT NULL DEFAULT '',
  discount_amount         numeric(12,2) NOT NULL CHECK (discount_amount >= 0),
  first_booking_only      boolean NOT NULL DEFAULT false,
  requires_service_id     text REFERENCES service_catalog(id),
  requires_other_service  boolean NOT NULL DEFAULT false,
  valid_until             date,
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Customers and authentication
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                    text NOT NULL UNIQUE,
  name                     text NOT NULL DEFAULT '',
  email                    text,
  language                 text NOT NULL DEFAULT 'English' CHECK (language IN ('English', 'Kannada', 'Hindi')),
  backup_contact_name      text,
  backup_contact_phone     text,
  referral_code            text NOT NULL UNIQUE,
  referred_by_customer_id  uuid REFERENCES customers(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE TABLE customer_addresses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES customers(id),
  label          text NOT NULL,
  area           text NOT NULL,
  line           text NOT NULL,
  landmark       text,
  contact_name   text,
  contact_phone  text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX customer_addresses_customer ON customer_addresses (customer_id) WHERE deleted_at IS NULL;

CREATE TABLE otp_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,
  code_hash    text NOT NULL,
  channel      text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  attempts     integer NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_challenges_phone ON otp_challenges (phone, created_at DESC);

CREATE TABLE auth_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id),
  refresh_token_hash  text NOT NULL UNIQUE,
  user_agent          text,
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  last_used_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_customer ON auth_sessions (customer_id);

CREATE TABLE device_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id),
  provider      text NOT NULL CHECK (provider IN ('onesignal', 'fcm', 'apns')),
  platform      text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, token)
);
CREATE INDEX device_tokens_customer ON device_tokens (customer_id);

-- ---------------------------------------------------------------------------
-- Vehicles (the "garage")
-- ---------------------------------------------------------------------------

CREATE TABLE vehicles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES customers(id),
  registration_number   text NOT NULL CHECK (registration_number ~ '^[A-Z0-9]{4,12}$'),
  make                  text NOT NULL,
  model                 text NOT NULL,
  body_type             text NOT NULL CHECK (body_type IN (
                          'commuter', 'naked', 'classic', 'cruiser', 'touring', 'sports', 'superbike', 'adventure',
                          'chopper', 'cafe', 'scrambler', 'scooter', 'moped', 'dirt', 'bobber', 'powercruiser')),
  colour_name           text,
  colour_hex            text CHECK (colour_hex ~ '^#[0-9a-fA-F]{6}$'),
  make_year             smallint CHECK (make_year BETWEEN 1950 AND 2100),
  chassis_last4         text,
  odometer_km           integer CHECK (odometer_km >= 0),
  odometer_recorded_at  timestamptz,
  odometer_source       text CHECK (odometer_source IN ('customer', 'workshop')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  archived_at           timestamptz
);
CREATE UNIQUE INDEX vehicles_active_registration ON vehicles (registration_number) WHERE archived_at IS NULL;
CREATE INDEX vehicles_customer ON vehicles (customer_id);

CREATE TABLE vehicle_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   uuid NOT NULL REFERENCES vehicles(id),
  kind         text NOT NULL CHECK (kind IN ('rc', 'insurance', 'puc')),
  file_url     text,
  provider     text,
  policy_type  text,
  reading      text,
  valid_until  date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, kind)
);

CREATE TABLE maintenance_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid NOT NULL REFERENCES vehicles(id),
  item             text NOT NULL,
  last_done_km     integer NOT NULL DEFAULT 0 CHECK (last_done_km >= 0),
  interval_km      integer CHECK (interval_km > 0),
  interval_months  integer CHECK (interval_months > 0),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, item)
);

-- ---------------------------------------------------------------------------
-- Job cards: the central service record. Status drives every customer-visible stage.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE job_card_number_seq;

CREATE TABLE job_cards (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number                 text NOT NULL UNIQUE,
  workshop_id            uuid NOT NULL REFERENCES workshops(id),
  customer_id            uuid NOT NULL REFERENCES customers(id),
  vehicle_id             uuid NOT NULL REFERENCES vehicles(id),
  status                 text NOT NULL DEFAULT 'booked' CHECK (status IN (
                           'booked', 'rider_assigned', 'picked_up', 'at_workshop', 'in_service', 'job_closed', 'delivered', 'cancelled')),
  mode                   text NOT NULL CHECK (mode IN ('pickup', 'visit')),
  source                 text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'walk_in', 'phone', 'erp')),
  pickup_address_id      uuid REFERENCES customer_addresses(id),
  slot_start             timestamptz NOT NULL,
  slot_end               timestamptz NOT NULL,
  promised_ready_at      timestamptz,
  bay_id                 uuid REFERENCES bays(id),
  advisor_id             uuid REFERENCES staff(id),
  mechanic_id            uuid REFERENCES staff(id),
  rider_id               uuid REFERENCES staff(id),
  offer_id               text REFERENCES offers(id),
  package_subtotal       numeric(12,2) NOT NULL DEFAULT 0 CHECK (package_subtotal >= 0),
  discount_amount        numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  estimate_amount        numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimate_amount >= 0),
  pay_at_delivery        boolean NOT NULL DEFAULT false,
  odometer_km_at_intake  integer CHECK (odometer_km_at_intake >= 0),
  customer_note          text,
  cancel_reason          text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  closed_at              timestamptz,
  delivered_at           timestamptz,
  cancelled_at           timestamptz,
  CHECK (slot_end > slot_start),
  CHECK (mode = 'visit' OR pickup_address_id IS NOT NULL OR source <> 'app')
);
CREATE INDEX job_cards_customer ON job_cards (customer_id, created_at DESC);
CREATE INDEX job_cards_vehicle ON job_cards (vehicle_id, created_at DESC);
CREATE INDEX job_cards_updated ON job_cards (updated_at);
CREATE INDEX job_cards_open_status ON job_cards (status) WHERE status NOT IN ('delivered', 'cancelled');
CREATE UNIQUE INDEX job_cards_one_open_per_vehicle ON job_cards (vehicle_id) WHERE status NOT IN ('delivered', 'cancelled');

CREATE TABLE job_card_services (
  job_card_id  uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  service_id   text NOT NULL REFERENCES service_catalog(id),
  name         text NOT NULL,
  price        numeric(12,2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (job_card_id, service_id)
);

CREATE TABLE job_card_status_history (
  id                   bigserial PRIMARY KEY,
  job_card_id          uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  from_status          text,
  to_status            text NOT NULL,
  source               text NOT NULL CHECK (source IN ('app', 'integration', 'system')),
  changed_by_staff_id  uuid REFERENCES staff(id),
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_card_status_history_job ON job_card_status_history (job_card_id, created_at);

CREATE TABLE job_card_extras (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id         uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  part_name           text NOT NULL,
  note                text NOT NULL DEFAULT '',
  amount              numeric(12,2) NOT NULL CHECK (amount >= 0),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  raised_by_staff_id  uuid REFERENCES staff(id),
  raised_by_label     text,
  decided_at          timestamptz,
  decided_via         text CHECK (decided_via IN ('app', 'advisor', 'integration')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_card_extras_job ON job_card_extras (job_card_id);

CREATE TABLE job_card_media (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id          uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  kind                 text NOT NULL CHECK (kind IN ('photo', 'video', 'note')),
  url                  text,
  caption              text NOT NULL DEFAULT '',
  created_by_staff_id  uuid REFERENCES staff(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_card_media_job ON job_card_media (job_card_id, created_at);

CREATE TABLE warranties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     uuid NOT NULL REFERENCES vehicles(id),
  job_card_id    uuid REFERENCES job_cards(id),
  title          text NOT NULL,
  brand          text NOT NULL DEFAULT '',
  serial_number  text,
  starts_on      date,
  ends_on        date,
  ends_at_km     integer CHECK (ends_at_km > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warranties_vehicle ON warranties (vehicle_id);

-- ---------------------------------------------------------------------------
-- Billing, payments and wallet
-- ---------------------------------------------------------------------------

CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text NOT NULL UNIQUE,
  job_card_id      uuid NOT NULL UNIQUE REFERENCES job_cards(id),
  customer_id      uuid NOT NULL REFERENCES customers(id),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
  subtotal         numeric(12,2) NOT NULL,
  discount_amount  numeric(12,2) NOT NULL DEFAULT 0,
  extras_amount    numeric(12,2) NOT NULL DEFAULT 0,
  taxable_amount   numeric(12,2) NOT NULL,
  gst_rate         numeric(5,4) NOT NULL,
  gst_amount       numeric(12,2) NOT NULL,
  total            numeric(12,2) NOT NULL CHECK (total >= 0),
  issued_at        timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_customer ON invoices (customer_id, issued_at DESC);

CREATE TABLE invoice_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('service', 'part', 'discount', 'other')),
  label         text NOT NULL,
  sac_hsn_code  text,
  quantity      numeric(10,2) NOT NULL DEFAULT 1,
  unit_amount   numeric(12,2) NOT NULL,
  amount        numeric(12,2) NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0
);
CREATE INDEX invoice_lines_invoice ON invoice_lines (invoice_id, sort_order);

CREATE TABLE payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id             uuid NOT NULL REFERENCES invoices(id),
  customer_id            uuid NOT NULL REFERENCES customers(id),
  method                 text NOT NULL CHECK (method IN ('upi', 'card', 'netbanking', 'cash', 'wallet')),
  amount                 numeric(12,2) NOT NULL CHECK (amount > 0),
  status                 text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  provider               text NOT NULL DEFAULT 'manual',
  provider_reference     text,
  collected_by_staff_id  uuid REFERENCES staff(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  confirmed_at           timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice ON payments (invoice_id);

CREATE TABLE wallet_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customers(id),
  amount       numeric(12,2) NOT NULL CHECK (amount <> 0),
  kind         text NOT NULL CHECK (kind IN ('welcome', 'referral', 'refund', 'cashback', 'service_payment', 'adjustment')),
  title        text NOT NULL,
  detail       text NOT NULL DEFAULT '',
  job_card_id  uuid REFERENCES job_cards(id),
  payment_id   uuid REFERENCES payments(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_transactions_customer ON wallet_transactions (customer_id, created_at DESC);

CREATE VIEW customer_wallet_balances AS
  SELECT customer_id, sum(amount)::numeric(12,2) AS balance
  FROM wallet_transactions
  GROUP BY customer_id;

CREATE TABLE referrals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id  uuid NOT NULL REFERENCES customers(id),
  referee_customer_id   uuid NOT NULL UNIQUE REFERENCES customers(id),
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded', 'void')),
  reward_amount         numeric(12,2) NOT NULL,
  rewarded_job_card_id  uuid REFERENCES job_cards(id),
  rewarded_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_referrer ON referrals (referrer_customer_id);

-- ---------------------------------------------------------------------------
-- Notifications and reviews
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES customers(id),
  job_card_id    uuid REFERENCES job_cards(id),
  kind           text NOT NULL CHECK (kind IN ('confirmation', 'update', 'reminder', 'rescheduled', 'cancelled', 'payment', 'offer')),
  title          text NOT NULL,
  body           text NOT NULL,
  target_screen  text,
  read_at        timestamptz,
  pushed_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_customer ON notifications (customer_id, created_at DESC);
CREATE INDEX notifications_unpushed ON notifications (created_at) WHERE pushed_at IS NULL;

CREATE TABLE reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id          uuid NOT NULL UNIQUE REFERENCES job_cards(id),
  customer_id          uuid NOT NULL REFERENCES customers(id),
  stars                smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags                 text[] NOT NULL DEFAULT '{}',
  note                 text,
  work_votes           jsonb NOT NULL DEFAULT '{}',
  staff_vote           text CHECK (staff_vote IN ('up', 'down')),
  follow_up_interests  text[] NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Integration: ID mapping to CRM/ERP records and the event outbox
-- ---------------------------------------------------------------------------

CREATE TABLE external_references (
  entity_type  text NOT NULL CHECK (entity_type IN (
                 'customer', 'vehicle', 'job_card', 'invoice', 'payment', 'staff', 'bay', 'service', 'offer')),
  entity_id    text NOT NULL,
  system       text NOT NULL CHECK (system ~ '^[a-z0-9_-]{2,32}$'),
  external_id  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, system),
  UNIQUE (entity_type, system, external_id)
);

CREATE TABLE integration_events (
  id               bigserial PRIMARY KEY,
  event_type       text NOT NULL,
  entity_type      text NOT NULL,
  entity_id        text NOT NULL,
  payload          jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  delivered_at     timestamptz,
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_error       text
);
CREATE INDEX integration_events_pending ON integration_events (next_attempt_at) WHERE delivered_at IS NULL;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workshops', 'staff', 'bays', 'service_catalog', 'offers', 'customers', 'customer_addresses', 'vehicles',
    'vehicle_documents', 'maintenance_items', 'job_cards', 'job_card_extras', 'warranties', 'invoices', 'payments',
    'external_references'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t || '_updated_at', t);
  END LOOP;
END;
$$;
