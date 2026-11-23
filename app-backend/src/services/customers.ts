import { randomInt } from "node:crypto";
import type pg from "pg";
import { isUniqueViolation, many, one, type Queryable } from "../db.js";
import { normalizePhone } from "../domain.js";
import { badRequest, notFound } from "../errors.js";
import { emit } from "./events.js";

type CustomerRow = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  language: "English" | "Kannada" | "Hindi";
  backup_contact_name: string | null;
  backup_contact_phone: string | null;
  referral_code: string;
  created_at: string;
  updated_at: string;
};

export function toCustomer(row: CustomerRow) {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    language: row.language,
    backupContactName: row.backup_contact_name,
    backupContactPhone: row.backup_contact_phone,
    referralCode: row.referral_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CustomerDto = ReturnType<typeof toCustomer>;

export async function getCustomer(db: Queryable, id: string) {
  const row = await one<CustomerRow>(db, "SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!row) throw notFound("Customer");
  return toCustomer(row);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function referralCode() {
  let code = "BS";
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Finds the customer for a verified phone number, creating the account on first login. */
export async function findOrCreateByPhone(client: pg.PoolClient, phone: string, referralCodeUsed: string | undefined, referralReward: number) {
  const existing = await one<CustomerRow>(client, "SELECT * FROM customers WHERE phone = $1 AND deleted_at IS NULL", [phone]);
  if (existing) return { customer: toCustomer(existing), isNew: false };

  const referrer = referralCodeUsed
    ? await one<{ id: string }>(client, "SELECT id FROM customers WHERE referral_code = $1 AND deleted_at IS NULL", [referralCodeUsed.trim().toUpperCase()])
    : undefined;

  let created: CustomerRow | undefined;
  for (let attempt = 0; !created; attempt += 1) {
    try {
      await client.query("SAVEPOINT create_customer");
      created = await one<CustomerRow>(
        client,
        "INSERT INTO customers (phone, referral_code, referred_by_customer_id) VALUES ($1, $2, $3) RETURNING *",
        [phone, referralCode(), referrer?.id ?? null],
      );
      await client.query("RELEASE SAVEPOINT create_customer");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT create_customer");
      if (!isUniqueViolation(error, "customers_referral_code_key") || attempt > 5) throw error;
    }
  }
  if (referrer) {
    await client.query(
      "INSERT INTO referrals (referrer_customer_id, referee_customer_id, reward_amount) VALUES ($1, $2, $3)",
      [referrer.id, created.id, referralReward],
    );
  }
  const customer = toCustomer(created);
  await emit(client, "customer.created", "customer", customer.id, { customer, referredBy: referrer?.id ?? null });
  return { customer, isNew: true };
}

export async function updateCustomer(
  db: Queryable,
  id: string,
  patch: { name?: string; email?: string | null; language?: string; backupContactName?: string | null; backupContactPhone?: string | null },
) {
  const backupPhone = patch.backupContactPhone ? normalizePhone(patch.backupContactPhone) : patch.backupContactPhone;
  const row = await one<CustomerRow>(
    db,
    `UPDATE customers SET
       name = COALESCE($2, name),
       email = CASE WHEN $3::boolean THEN $4 ELSE email END,
       language = COALESCE($5, language),
       backup_contact_name = CASE WHEN $6::boolean THEN $7 ELSE backup_contact_name END,
       backup_contact_phone = CASE WHEN $8::boolean THEN $9 ELSE backup_contact_phone END
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [
      id,
      patch.name ?? null,
      patch.email !== undefined,
      patch.email ?? null,
      patch.language ?? null,
      patch.backupContactName !== undefined,
      patch.backupContactName ?? null,
      backupPhone !== undefined,
      backupPhone ?? null,
    ],
  );
  if (!row) throw notFound("Customer");
  const customer = toCustomer(row);
  await emit(db, "customer.updated", "customer", id, { customer });
  return customer;
}

/** Account deletion (required by the App Store). Personal data is scrubbed; job cards and invoices stay for the books. */
export async function deleteCustomer(client: pg.PoolClient, id: string) {
  const open = await one<{ n: number }>(
    client,
    "SELECT count(*) AS n FROM job_cards WHERE customer_id = $1 AND status NOT IN ('delivered', 'cancelled')",
    [id],
  );
  if (open && open.n > 0) throw badRequest("open_booking", "Finish or cancel your open bookings before deleting the account");
  await client.query(
    `UPDATE customers SET deleted_at = now(), phone = 'deleted:' || id, name = '', email = NULL,
       backup_contact_name = NULL, backup_contact_phone = NULL
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE customer_id = $1 AND revoked_at IS NULL", [id]);
  await client.query("DELETE FROM device_tokens WHERE customer_id = $1", [id]);
  await client.query("UPDATE customer_addresses SET deleted_at = now() WHERE customer_id = $1 AND deleted_at IS NULL", [id]);
  await emit(client, "customer.deleted", "customer", id, { customerId: id });
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

type AddressRow = {
  id: string;
  label: string;
  area: string;
  line: string;
  landmark: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function toAddress(row: AddressRow) {
  return {
    id: row.id,
    label: row.label,
    area: row.area,
    line: row.line,
    landmark: row.landmark,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function listAddresses(db: Queryable, customerId: string) {
  const rows = await many<AddressRow>(
    db,
    "SELECT * FROM customer_addresses WHERE customer_id = $1 AND deleted_at IS NULL ORDER BY created_at",
    [customerId],
  );
  return rows.map(toAddress);
}

type AddressInput = {
  label: string;
  area: string;
  line: string;
  landmark?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Saving an address with a label the customer already uses replaces it, as the app's Add address screen expects. */
export async function saveAddress(client: pg.PoolClient, customerId: string, input: AddressInput) {
  await client.query(
    "UPDATE customer_addresses SET deleted_at = now() WHERE customer_id = $1 AND lower(label) = lower($2) AND deleted_at IS NULL",
    [customerId, input.label],
  );
  const row = await one<AddressRow>(
    client,
    `INSERT INTO customer_addresses (customer_id, label, area, line, landmark, contact_name, contact_phone, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      customerId,
      input.label,
      input.area,
      input.line,
      input.landmark ?? null,
      input.contactName ?? null,
      input.contactPhone ? normalizePhone(input.contactPhone) : null,
      input.latitude ?? null,
      input.longitude ?? null,
    ],
  );
  return toAddress(row!);
}

export async function deleteAddress(db: Queryable, customerId: string, id: string) {
  const result = await db.query(
    "UPDATE customer_addresses SET deleted_at = now() WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL",
    [id, customerId],
  );
  if (result.rowCount === 0) throw notFound("Address");
}

// ---------------------------------------------------------------------------
// Push devices
// ---------------------------------------------------------------------------

export async function registerDevice(db: Queryable, customerId: string, input: { provider: string; platform: string; token: string }) {
  await db.query(
    `INSERT INTO device_tokens (customer_id, provider, platform, token) VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, token) DO UPDATE SET customer_id = EXCLUDED.customer_id, platform = EXCLUDED.platform, last_seen_at = now()`,
    [customerId, input.provider, input.platform, input.token],
  );
}

export async function removeDevice(db: Queryable, customerId: string, token: string) {
  await db.query("DELETE FROM device_tokens WHERE customer_id = $1 AND token = $2", [customerId, token]);
}

// ---------------------------------------------------------------------------
// Wallet and referrals
// ---------------------------------------------------------------------------

export async function walletBalance(db: Queryable, customerId: string) {
  const row = await one<{ balance: number }>(db, "SELECT COALESCE(sum(amount), 0)::numeric(12,2) AS balance FROM wallet_transactions WHERE customer_id = $1", [customerId]);
  return row?.balance ?? 0;
}

type WalletRow = { id: string; kind: string; title: string; detail: string; amount: number; created_at: string };

export async function getWallet(db: Queryable, customerId: string) {
  const rows = await many<WalletRow>(
    db,
    "SELECT id, kind, title, detail, amount, created_at FROM wallet_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 200",
    [customerId],
  );
  return {
    balance: await walletBalance(db, customerId),
    transactions: rows.map((row) => ({
      id: row.id,
      kind: row.kind as "welcome" | "referral" | "refund" | "cashback" | "service_payment" | "adjustment",
      title: row.title,
      detail: row.detail,
      amount: row.amount,
      createdAt: row.created_at,
    })),
  };
}

export async function addWalletTransaction(
  db: Queryable,
  input: { customerId: string; amount: number; kind: string; title: string; detail?: string; jobCardId?: string | null; paymentId?: string | null },
) {
  const row = await one<{ id: string; created_at: string }>(
    db,
    `INSERT INTO wallet_transactions (customer_id, amount, kind, title, detail, job_card_id, payment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
    [input.customerId, input.amount, input.kind, input.title, input.detail ?? "", input.jobCardId ?? null, input.paymentId ?? null],
  );
  await emit(db, "wallet.transaction", "customer", input.customerId, { transactionId: row!.id, ...input, createdAt: row!.created_at });
  return row!.id;
}

export async function getReferral(db: Queryable, customerId: string, rewardAmount: number) {
  const customer = await getCustomer(db, customerId);
  const rows = await many<{ name: string; status: "pending" | "rewarded" | "void"; created_at: string; rewarded_at: string | null }>(
    db,
    `SELECT COALESCE(NULLIF(c.name, ''), 'A friend') AS name, r.status, r.created_at, r.rewarded_at
     FROM referrals r JOIN customers c ON c.id = r.referee_customer_id
     WHERE r.referrer_customer_id = $1 ORDER BY r.created_at DESC`,
    [customerId],
  );
  const reward = Math.round(rewardAmount);
  return {
    code: customer.referralCode,
    rewardAmount,
    shareText: `Use my Bike Surgeon code ${customer.referralCode}. You get ₹${reward} off your first completed service, and I get ₹${reward} in wallet credit.`,
    referrals: rows.map((row) => ({ name: row.name, status: row.status, createdAt: row.created_at, rewardedAt: row.rewarded_at })),
  };
}

/** Pays both sides of a pending referral when the referred customer's first job card is delivered. */
export async function rewardReferralIfDue(client: pg.PoolClient, customerId: string, jobCardId: string) {
  const referral = await one<{ id: string; referrer_customer_id: string; reward_amount: number }>(
    client,
    "SELECT id, referrer_customer_id, reward_amount FROM referrals WHERE referee_customer_id = $1 AND status = 'pending' FOR UPDATE",
    [customerId],
  );
  if (!referral || referral.reward_amount <= 0) return;
  await client.query("UPDATE referrals SET status = 'rewarded', rewarded_at = now(), rewarded_job_card_id = $2 WHERE id = $1", [referral.id, jobCardId]);
  await addWalletTransaction(client, { customerId: referral.referrer_customer_id, amount: referral.reward_amount, kind: "referral", title: "Referral bonus", detail: "A friend completed their first service" });
  await addWalletTransaction(client, { customerId, amount: referral.reward_amount, kind: "referral", title: "Referral bonus", detail: "For joining with a friend's code", jobCardId });
  await emit(client, "referral.rewarded", "customer", customerId, { referralId: referral.id, referrerId: referral.referrer_customer_id, refereeId: customerId, amount: referral.reward_amount });
}
