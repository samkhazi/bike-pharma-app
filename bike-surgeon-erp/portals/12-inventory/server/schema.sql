-- Bike Surgeon Inventory portal. One SQLite file (DB_FILE). Every table is created on start when missing.
-- Money is in rupees (REAL, 2 decimals), stock in whole pieces. Dates: at = 'YYYY-MM-DD HH:MM', day = 'YYYY-MM-DD'.
-- Stores: BS = Bike Surgeon workshop spares, ML = The Moto Lab (its own business, never added into BS totals).

CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL,                 -- owner | manager | store | accountant
  pin_hash   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,              -- sha256 of the cookie value
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- The parts list (old cms_products). pno = part / serial number (the barcode on the sticker when bar is empty).
CREATE TABLE IF NOT EXISTS parts (
  id        INTEGER PRIMARY KEY,
  store     TEXT NOT NULL DEFAULT 'BS' CHECK (store IN ('BS','ML','BP')),
  pno       TEXT NOT NULL,
  pkey      TEXT NOT NULL DEFAULT '',       -- pno in capitals without spaces / dashes (search and matching)
  name      TEXT NOT NULL,
  descr     TEXT NOT NULL DEFAULT '',
  brand     TEXT NOT NULL DEFAULT '',
  model     TEXT NOT NULL DEFAULT '',
  cat       TEXT NOT NULL DEFAULT '',       -- Moto Lab category (Helmets, Riding gear ...); free text for BS
  size      TEXT NOT NULL DEFAULT '',       -- Moto Lab size (S, M, L ...)
  hsn       TEXT NOT NULL DEFAULT '',
  gst       REAL NOT NULL DEFAULT 18,       -- GST % (old tax_rate)
  gst_incl  INTEGER NOT NULL DEFAULT 1,     -- 1 = MRP includes GST (old gst_included 'yes')
  mrp       REAL NOT NULL DEFAULT 0 CHECK (mrp >= 0),   -- old gross_selling_price
  cost      REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),  -- old net_cost_price (hidden from the store role)
  d_user    REAL NOT NULL DEFAULT 0,        -- discount % for a customer
  d_whole   REAL NOT NULL DEFAULT 0,        -- discount % for a wholesaler / dealer
  d_mech    REAL NOT NULL DEFAULT 0,        -- discount % for a mechanic
  stock     INTEGER NOT NULL DEFAULT 0,
  alert     INTEGER NOT NULL DEFAULT 0,     -- low-stock alert at this many (old stock_alert_on); 0 = no alert
  rack      TEXT NOT NULL DEFAULT '',
  batch     TEXT NOT NULL DEFAULT '',
  bar       TEXT NOT NULL DEFAULT '',       -- printed barcode when it is not the part number
  wty       INTEGER NOT NULL DEFAULT 0,     -- brand warranty in months (Moto Lab items)
  active    INTEGER NOT NULL DEFAULT 1,     -- 0 = removed from the list (kept for old bills)
  last_sale TEXT,                           -- day of the last sale
  added_by  TEXT NOT NULL DEFAULT '',
  added_at  TEXT NOT NULL,
  upd       INTEGER NOT NULL DEFAULT 0,     -- ms of the last change (GET /api/feed/parts?since=)
  v         INTEGER NOT NULL DEFAULT 1,     -- version: two people saving at once get "someone else changed this"
  old_id    INTEGER                         -- id in the old billing database
);
CREATE INDEX IF NOT EXISTS parts_pno ON parts(store, pkey);
CREATE INDEX IF NOT EXISTS parts_bar ON parts(bar);
CREATE INDEX IF NOT EXISTS parts_upd ON parts(upd);
CREATE INDEX IF NOT EXISTS parts_old ON parts(store, old_id);

-- Photos: files in PHOTO_DIR, kept exactly as uploaded (no resizing). Old billing photos keep their file name.
CREATE TABLE IF NOT EXISTS photos (
  id    INTEGER PRIMARY KEY,
  part  INTEGER NOT NULL REFERENCES parts(id),
  file  TEXT NOT NULL,
  old   INTEGER NOT NULL DEFAULT 0,         -- 1 = file from the old billing site (OLD_PHOTO_URL)
  at    TEXT NOT NULL,
  who   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS photos_part ON photos(part);

-- Every stock change, + in / - out. why: sale | sale-cancel | stock-in | transfer-in | transfer-out | count | reduce |
-- return-in | vendor-return | edit | import | workshop
CREATE TABLE IF NOT EXISTS stock_moves (
  id     INTEGER PRIMARY KEY,
  at     TEXT NOT NULL,
  part   INTEGER NOT NULL REFERENCES parts(id),
  qty    INTEGER NOT NULL,
  before INTEGER NOT NULL,
  after  INTEGER NOT NULL,
  why    TEXT NOT NULL,
  ref    TEXT NOT NULL DEFAULT '',          -- bill no, vendor bill, TR-, RC-, RT-, VR-, push no ...
  src    TEXT NOT NULL DEFAULT '',          -- portal that sent it (cashier, counter, desk, motolab) or 'inventory'
  who    TEXT NOT NULL DEFAULT '',
  note   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS moves_part ON stock_moves(part, id);
CREATE INDEX IF NOT EXISTS moves_at ON stock_moves(at);

-- Sales seen by the inventory (from the other portals, or the old billing site's invoice_items). Used for fast movers,
-- dead stock and reorder. One row per bill line; a cancelled bill gets cancelled = 1 (stock went back).
CREATE TABLE IF NOT EXISTS sales (
  id        INTEGER PRIMARY KEY,
  store     TEXT NOT NULL DEFAULT 'BS',
  bill      TEXT NOT NULL,
  day       TEXT NOT NULL,
  part      INTEGER REFERENCES parts(id),
  pno       TEXT NOT NULL DEFAULT '',
  name      TEXT NOT NULL DEFAULT '',
  qty       INTEGER NOT NULL,
  rate      REAL NOT NULL DEFAULT 0,
  src       TEXT NOT NULL DEFAULT '',
  cancelled INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sales_bill ON sales(src, bill);
CREATE INDEX IF NOT EXISTS sales_part ON sales(part, day);
CREATE INDEX IF NOT EXISTS sales_day ON sales(day);

CREATE TABLE IF NOT EXISTS vendors (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  phone    TEXT NOT NULL DEFAULT '',
  address  TEXT NOT NULL DEFAULT '',
  gstin    TEXT NOT NULL DEFAULT '',
  opening  REAL NOT NULL DEFAULT 0,         -- old pending dues before this portal
  days     INTEGER NOT NULL DEFAULT 30,     -- credit days: due date = bill date + days
  active   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  old_id   INTEGER
);

-- Vendor bills (purchases). posted = 1 when its lines went into stock.
CREATE TABLE IF NOT EXISTS vendor_bills (
  id       INTEGER PRIMARY KEY,
  no       TEXT NOT NULL UNIQUE,            -- VB-0001
  store    TEXT NOT NULL DEFAULT 'BS',
  vendor   INTEGER NOT NULL REFERENCES vendors(id),
  inv_no   TEXT NOT NULL,                   -- the vendor's invoice number
  inv_date TEXT NOT NULL,
  due      TEXT,
  amount   REAL NOT NULL DEFAULT 0,
  paid     REAL NOT NULL DEFAULT 0,
  status   TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CLEARED','CANCELLED')),
  posted   INTEGER NOT NULL DEFAULT 0,
  notes    TEXT NOT NULL DEFAULT '',
  by       TEXT NOT NULL DEFAULT '',
  at       TEXT NOT NULL,
  cleared_at TEXT,
  old_id   INTEGER
);
CREATE INDEX IF NOT EXISTS vbills_vendor ON vendor_bills(vendor, status);
CREATE TABLE IF NOT EXISTS vendor_bill_lines (
  id     INTEGER PRIMARY KEY,
  bill   INTEGER NOT NULL REFERENCES vendor_bills(id),
  part   INTEGER REFERENCES parts(id),
  pno    TEXT NOT NULL DEFAULT '',
  name   TEXT NOT NULL,
  hsn    TEXT NOT NULL DEFAULT '',
  gst    REAL NOT NULL DEFAULT 0,
  qty    INTEGER NOT NULL,
  rate   REAL NOT NULL DEFAULT 0,           -- cost per piece before GST
  mrp    REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0            -- line total with GST
);
CREATE TABLE IF NOT EXISTS vendor_payments (
  id     INTEGER PRIMARY KEY,
  bill   INTEGER NOT NULL REFERENCES vendor_bills(id),
  amount REAL NOT NULL CHECK (amount > 0),
  mode   TEXT NOT NULL DEFAULT 'Bank',      -- Cash | UPI | Bank | Cheque
  ref    TEXT NOT NULL DEFAULT '',
  day    TEXT NOT NULL,
  by     TEXT NOT NULL DEFAULT '',
  at     TEXT NOT NULL
);
-- Goods sent back to a vendor (purchase return, VR-0001): stock goes down, the vendor owes us the amount.
CREATE TABLE IF NOT EXISTS vendor_returns (
  id     INTEGER PRIMARY KEY,
  no     TEXT NOT NULL UNIQUE,
  vendor INTEGER NOT NULL REFERENCES vendors(id),
  part   INTEGER NOT NULL REFERENCES parts(id),
  qty    INTEGER NOT NULL CHECK (qty > 0),
  rate   REAL NOT NULL DEFAULT 0,
  why    TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Sent' CHECK (status IN ('Sent','Credit received','Replaced')),
  day    TEXT NOT NULL,
  by     TEXT NOT NULL DEFAULT ''
);

-- Branch transfers Davanagere (DVG) ⇄ Ranebennur (RNR) (old stock_transfers). dvg-rnr takes stock out, rnr-dvg adds it.
CREATE TABLE IF NOT EXISTS transfers (
  id      INTEGER PRIMARY KEY,
  no      TEXT NOT NULL UNIQUE,             -- TR-0001
  dir     TEXT NOT NULL CHECK (dir IN ('dvg-rnr','rnr-dvg')),
  part    INTEGER REFERENCES parts(id),
  pno     TEXT NOT NULL DEFAULT '',
  name    TEXT NOT NULL,
  hsn     TEXT NOT NULL DEFAULT '',
  mrp     REAL NOT NULL DEFAULT 0,
  margin  REAL NOT NULL DEFAULT 0,          -- margin %
  profit  REAL NOT NULL DEFAULT 0,          -- mrp × margin %
  qty     INTEGER NOT NULL CHECK (qty > 0),
  before  INTEGER NOT NULL DEFAULT 0,
  after   INTEGER NOT NULL DEFAULT 0,
  new_item INTEGER NOT NULL DEFAULT 0,
  day     TEXT NOT NULL,
  by      TEXT NOT NULL DEFAULT '',
  note    TEXT NOT NULL DEFAULT '',
  at      TEXT NOT NULL
);

-- Daily order sheet (old daily_order_sheet): what to order, from whom, promised day, how much came.
CREATE TABLE IF NOT EXISTS order_sheet (
  id       INTEGER PRIMARY KEY,
  day      TEXT NOT NULL,
  store    TEXT NOT NULL DEFAULT 'BS',
  part     INTEGER REFERENCES parts(id),
  brand    TEXT NOT NULL DEFAULT '',
  pno      TEXT NOT NULL DEFAULT '',
  name     TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty > 0),
  vendor   TEXT NOT NULL DEFAULT '',
  promise  TEXT NOT NULL DEFAULT '',
  got      INTEGER NOT NULL DEFAULT 0,
  status   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','done','cancelled','carried')),
  carried_from INTEGER,                     -- the row of an earlier day it came from (that row is 'carried')
  by       TEXT NOT NULL DEFAULT '',
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_day ON order_sheet(day, status);

-- Rack checks: count a rack, the difference goes into stock only after a manager applies it.
CREATE TABLE IF NOT EXISTS counts (
  id      INTEGER PRIMARY KEY,
  no      TEXT NOT NULL,                    -- RC-0001 (one per rack check, many rows)
  rack    TEXT NOT NULL DEFAULT '',
  part    INTEGER NOT NULL REFERENCES parts(id),
  system  INTEGER NOT NULL,
  counted INTEGER NOT NULL CHECK (counted >= 0),
  status  TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','applied','dropped')),
  by      TEXT NOT NULL DEFAULT '',
  at      TEXT NOT NULL,
  done_by TEXT,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS counts_no ON counts(no);

-- Notifications for the bell (low stock, vendor due, big stock reduce, link refused). Also sent on WhatsApp / push.
CREATE TABLE IF NOT EXISTS alerts (
  id    INTEGER PRIMARY KEY,
  at    TEXT NOT NULL,
  kind  TEXT NOT NULL,                      -- low | out | due | late | reduce | count | link
  ref   TEXT NOT NULL DEFAULT '',
  text  TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT 'owner,manager',
  seen  TEXT NOT NULL DEFAULT '[]',         -- JSON array of account ids that opened it
  key   TEXT UNIQUE                         -- same key = same alert, never sent twice
);

-- Messages to other portals and to WhatsApp / push, saved in the same transaction as the change, sent every minute.
CREATE TABLE IF NOT EXISTS outbox (
  id         INTEGER PRIMARY KEY,
  target     TEXT NOT NULL,                 -- desk | motolab | accounts | admin | whatsapp | push
  path       TEXT NOT NULL,
  body       TEXT NOT NULL,
  ext_id     TEXT,                          -- a newer body with the same ext_id replaces the waiting one
  tries      INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at    TEXT,
  dead       INTEGER NOT NULL DEFAULT 0     -- refused (4xx): shown on Settings > Links, not retried
);
CREATE INDEX IF NOT EXISTS outbox_wait ON outbox(sent_at, dead, id);
CREATE UNIQUE INDEX IF NOT EXISTS outbox_ext ON outbox(ext_id) WHERE ext_id IS NOT NULL AND sent_at IS NULL;

-- What was already pulled from the other portals (05 stock moves after id, 11 bills per day)
CREATE TABLE IF NOT EXISTS pull_marks (src TEXT PRIMARY KEY, mark TEXT NOT NULL);

-- Browser push (OneSignal): one row per signed-in device. external id = account phone.
CREATE TABLE IF NOT EXISTS push_devices (
  id      INTEGER PRIMARY KEY,
  account INTEGER NOT NULL REFERENCES accounts(id),
  player  TEXT NOT NULL UNIQUE,
  at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  at         TEXT NOT NULL,
  account_id INTEGER,
  who        TEXT,
  action     TEXT NOT NULL,
  detail     TEXT
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at);

-- Inventory 2.0 (5 Nov 2026): every due date change of a vendor bill, with the reason (cannot be deleted)
CREATE TABLE IF NOT EXISTS due_edits (
  id    INTEGER PRIMARY KEY,
  bill  INTEGER NOT NULL REFERENCES vendor_bills(id),
  old   TEXT,
  new   TEXT NOT NULL,
  why   TEXT NOT NULL,
  by    TEXT NOT NULL DEFAULT '',
  at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS due_edits_bill ON due_edits(bill);
CREATE INDEX IF NOT EXISTS vlines_bill ON vendor_bill_lines(bill);
