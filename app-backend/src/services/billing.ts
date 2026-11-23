import type pg from "pg";
import { many, one, tx, type Db, type Queryable } from "../db.js";
import { gstOn, money } from "../domain.js";
import { badRequest, conflict, notFound } from "../errors.js";
import type { BookingDto } from "./bookings.js";
import { addWalletTransaction, walletBalance } from "./customers.js";
import { emit } from "./events.js";
import { notify } from "./notifications.js";

type LineKind = "service" | "part" | "discount" | "other";

type InvoiceRow = {
  id: string;
  number: string;
  job_card_id: string;
  customer_id: string;
  status: "open" | "paid" | "void";
  subtotal: number;
  discount_amount: number;
  extras_amount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
  issued_at: string;
  paid_at: string | null;
  booking_number: string;
  vehicle_id: string;
  vehicle_label: string;
  mode: "pickup" | "visit";
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  method: "upi" | "card" | "netbanking" | "cash" | "wallet";
  amount: number;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: string;
  provider_reference: string | null;
  created_at: string;
  confirmed_at: string | null;
};

const toPayment = (row: PaymentRow) => ({
  id: row.id,
  method: row.method,
  amount: row.amount,
  status: row.status,
  provider: row.provider,
  providerReference: row.provider_reference,
  createdAt: row.created_at,
  confirmedAt: row.confirmed_at,
});

const INVOICE_SELECT = `
  SELECT i.*, jc.number AS booking_number, jc.vehicle_id, jc.mode, v.make || ' ' || v.model AS vehicle_label
  FROM invoices i JOIN job_cards jc ON jc.id = i.job_card_id JOIN vehicles v ON v.id = jc.vehicle_id`;

async function hydrateInvoices(db: Queryable, rows: InvoiceRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const lines = await many<{ invoice_id: string; kind: LineKind; label: string; amount: number }>(
      db, "SELECT invoice_id, kind, label, amount FROM invoice_lines WHERE invoice_id = ANY($1) ORDER BY sort_order", [ids]);
  const payments = await many<PaymentRow>(db, "SELECT * FROM payments WHERE invoice_id = ANY($1) ORDER BY created_at", [ids]);
  return rows.map((row) => {
    const own = payments.filter((p) => p.invoice_id === row.id);
    const succeeded = own.filter((p) => p.status === "succeeded");
    const paidAmount = money(succeeded.reduce((sum, p) => sum + p.amount, 0));
    return {
      id: row.id,
      number: row.number,
      jobCardId: row.job_card_id,
      bookingNumber: row.booking_number,
      vehicleId: row.vehicle_id,
      vehicleLabel: row.vehicle_label,
      mode: row.mode,
      status: row.status,
      lines: lines.filter((l) => l.invoice_id === row.id).map(({ kind, label, amount }) => ({ kind, label, amount })),
      subtotal: row.subtotal,
      discountAmount: row.discount_amount,
      extrasAmount: row.extras_amount,
      taxableAmount: row.taxable_amount,
      gstRate: row.gst_rate,
      gstAmount: row.gst_amount,
      total: row.total,
      paidAmount,
      walletAmount: money(succeeded.filter((p) => p.method === "wallet").reduce((sum, p) => sum + p.amount, 0)),
      balanceDue: money(Math.max(0, row.total - paidAmount)),
      payments: own.map(toPayment),
      issuedAt: row.issued_at,
      paidAt: row.paid_at,
    };
  });
}

export type InvoiceDto = Awaited<ReturnType<typeof hydrateInvoices>>[number];

export async function listInvoices(db: Queryable, customerId: string) {
  const rows = await many<InvoiceRow>(db, `${INVOICE_SELECT} WHERE i.customer_id = $1 AND i.status <> 'void' ORDER BY i.issued_at DESC`, [customerId]);
  return hydrateInvoices(db, rows);
}

export async function getInvoice(db: Queryable, id: string, customerId: string | null) {
  const row = await one<InvoiceRow>(db, `${INVOICE_SELECT} WHERE i.id = $1 AND ($2::uuid IS NULL OR i.customer_id = $2)`, [id, customerId]);
  if (!row) throw notFound("Invoice");
  return (await hydrateInvoices(db, [row]))[0];
}

/** The estimate before the job card closes, the invoice after. Same shape either way, so the app can render one card. */
export async function billFor(db: Queryable, booking: Omit<BookingDto, "customer">, gstRate: number) {
  if (booking.invoiceId) {
    const invoice = await getInvoice(db, booking.invoiceId, null);
    return {
      kind: invoice.status === "paid" ? ("paid" as const) : ("due" as const),
      lines: invoice.lines,
      subtotal: invoice.subtotal,
      discount: invoice.discountAmount,
      extras: invoice.extrasAmount,
      taxable: invoice.taxableAmount,
      gstRate: invoice.gstRate,
      tax: invoice.gstAmount,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      balanceDue: invoice.balanceDue,
    };
  }
  const approved = booking.extras.filter((extra) => extra.status === "approved");
  const extras = money(approved.reduce((sum, extra) => sum + extra.amount, 0));
  const taxable = money(booking.estimateAmount + extras);
  const tax = gstOn(taxable, gstRate);
  const lines: { kind: LineKind; label: string; amount: number }[] = [
    ...booking.services.map((service) => ({ kind: "service" as const, label: service.name, amount: service.price })),
    ...(booking.discountAmount > 0 ? [{ kind: "discount" as const, label: "Offer", amount: -booking.discountAmount }] : []),
    ...approved.map((extra) => ({ kind: "part" as const, label: extra.partName, amount: extra.amount })),
  ];
  return {
    kind: "estimate" as const,
    lines,
    subtotal: booking.packageSubtotal,
    discount: booking.discountAmount,
    extras,
    taxable,
    gstRate,
    tax,
    total: money(taxable + tax),
    paidAmount: 0,
    balanceDue: money(taxable + tax),
  };
}

/** Freezes the job card into an invoice: package lines, discount, approved parts and GST. */
export async function issueInvoice(client: pg.PoolClient, jobCardId: string, gstRate: number, declinePendingExtras: boolean) {
  const job = await one<{ number: string; customer_id: string; package_subtotal: number; discount_amount: number; estimate_amount: number; offer_id: string | null }>(
    client, "SELECT number, customer_id, package_subtotal, discount_amount, estimate_amount, offer_id FROM job_cards WHERE id = $1", [jobCardId]);
  if (!job) throw notFound("Job card");
  const pending = await one<{ n: number }>(client, "SELECT count(*) AS n FROM job_card_extras WHERE job_card_id = $1 AND status = 'pending'", [jobCardId]);
  if (pending && pending.n > 0) {
    if (!declinePendingExtras) throw conflict("pending_extras", "Parts are still waiting for the customer's decision. Send declinePendingExtras: true to leave them out.");
    await client.query(
      "UPDATE job_card_extras SET status = 'declined', decided_at = now(), decided_via = 'integration' WHERE job_card_id = $1 AND status = 'pending'",
      [jobCardId],
    );
  }
  const services = await many<{ name: string; price: number; sac_code: string | null }>(
    client,
    "SELECT jcs.name, jcs.price, sc.sac_code FROM job_card_services jcs JOIN service_catalog sc ON sc.id = jcs.service_id WHERE jcs.job_card_id = $1 ORDER BY jcs.name",
    [jobCardId],
  );
  const extras = await many<{ part_name: string; amount: number }>(
    client, "SELECT part_name, amount FROM job_card_extras WHERE job_card_id = $1 AND status = 'approved' ORDER BY created_at", [jobCardId]);
  const extrasAmount = money(extras.reduce((sum, extra) => sum + extra.amount, 0));
  const taxable = money(job.estimate_amount + extrasAmount);
  const gst = gstOn(taxable, gstRate);
  const invoice = await one<{ id: string }>(
    client,
    `INSERT INTO invoices (number, job_card_id, customer_id, subtotal, discount_amount, extras_amount, taxable_amount, gst_rate, gst_amount, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [job.number.replace(/^BS-/, "INV-"), jobCardId, job.customer_id, job.package_subtotal, job.discount_amount, extrasAmount, taxable, gstRate, gst, money(taxable + gst)],
  );
  const lines: [LineKind, string, string | null, number][] = [
    ...services.map((s) => ["service", s.name, s.sac_code, s.price] as [LineKind, string, string | null, number]),
    ...(job.discount_amount > 0 ? [["discount", "Offer", null, -job.discount_amount] as [LineKind, string, string | null, number]] : []),
    ...extras.map((e) => ["part", e.part_name, null, e.amount] as [LineKind, string, string | null, number]),
  ];
  for (const [index, [kind, label, code, amount]] of lines.entries()) {
    await client.query(
      "INSERT INTO invoice_lines (invoice_id, kind, label, sac_hsn_code, unit_amount, amount, sort_order) VALUES ($1, $2, $3, $4, $5, $5, $6)",
      [invoice!.id, kind, label, code, amount, index],
    );
  }
  return invoice!.id;
}

async function settleIfPaid(client: pg.PoolClient, invoiceId: string) {
  const row = await one<{ total: number; paid: number; status: string; customer_id: string; job_card_id: string }>(
    client,
    `SELECT i.total, i.status, i.customer_id, i.job_card_id,
            COALESCE((SELECT sum(amount) FROM payments WHERE invoice_id = i.id AND status = 'succeeded'), 0)::numeric(12,2) AS paid
     FROM invoices i WHERE i.id = $1`,
    [invoiceId],
  );
  if (!row || row.status !== "open" || row.paid + 0.005 < row.total) return false;
  await client.query("UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1", [invoiceId]);
  await client.query("UPDATE job_cards SET pay_at_delivery = false WHERE id = $1", [row.job_card_id]);
  await notify(client, { customerId: row.customer_id, jobCardId: row.job_card_id, kind: "payment", title: "Paid in full", body: `We received ₹${Math.round(row.total).toLocaleString("en-IN")}. Thank you.`, targetScreen: "Invoices" });
  await emit(client, "invoice.paid", "invoice", invoiceId, { invoice: await getInvoice(client, invoiceId, null) });
  return true;
}

async function lockOpenInvoice(client: pg.PoolClient, jobCardId: string, customerId: string | null) {
  const invoice = await one<{ id: string; total: number; status: string; customer_id: string }>(
    client, "SELECT id, total, status, customer_id FROM invoices WHERE job_card_id = $1 AND status <> 'void' FOR UPDATE", [jobCardId]);
  if (!invoice || (customerId && invoice.customer_id !== customerId)) throw conflict("no_invoice", "There is no invoice yet. It is issued when the job card closes.");
  if (invoice.status === "paid") throw conflict("already_paid", "This invoice is already paid");
  const paid = await one<{ paid: number }>(client, "SELECT COALESCE(sum(amount), 0)::numeric(12,2) AS paid FROM payments WHERE invoice_id = $1 AND status = 'succeeded'", [invoice.id]);
  return { ...invoice, balance: money(invoice.total - (paid?.paid ?? 0)) };
}

/** Customer checkout: optional wallet credit first, then a pending payment for the rest that the gateway or ERP confirms. */
export async function pay(db: Db, customerId: string, jobCardId: string, input: { walletAmount: number; method?: "upi" | "card" | "netbanking" }) {
  const result = await tx(db, async (client) => {
    const invoice = await lockOpenInvoice(client, jobCardId, customerId);
    const available = await walletBalance(client, customerId);
    if (input.walletAmount > available + 0.005) throw badRequest("insufficient_wallet", "That is more than your wallet balance");
    const fromWallet = money(Math.min(input.walletAmount, invoice.balance));
    const rest = money(invoice.balance - fromWallet);
    if (rest > 0 && !input.method) throw badRequest("method_required", "Choose how to pay the rest");

    if (fromWallet > 0) {
      const walletPayment = await one<{ id: string }>(
        client,
        `INSERT INTO payments (invoice_id, customer_id, method, amount, status, provider, confirmed_at)
         VALUES ($1, $2, 'wallet', $3, 'succeeded', 'wallet', now()) RETURNING id`,
        [invoice.id, customerId, fromWallet],
      );
      const job = await one<{ number: string }>(client, "SELECT number FROM job_cards WHERE id = $1", [jobCardId]);
      await addWalletTransaction(client, { customerId, amount: -fromWallet, kind: "service_payment", title: "Used on a service", detail: job?.number ?? "", jobCardId, paymentId: walletPayment!.id });
      await emit(client, "payment.succeeded", "payment", walletPayment!.id, { invoiceId: invoice.id, jobCardId, method: "wallet", amount: fromWallet });
    }

    let pendingId: string | null = null;
    if (rest > 0) {
      await client.query("UPDATE payments SET status = 'failed', updated_at = now() WHERE invoice_id = $1 AND status = 'pending'", [invoice.id]);
      const pending = await one<{ id: string }>(
        client,
        "INSERT INTO payments (invoice_id, customer_id, method, amount, status, provider) VALUES ($1, $2, $3, $4, 'pending', 'manual') RETURNING id",
        [invoice.id, customerId, input.method, rest],
      );
      pendingId = pending!.id;
      await emit(client, "payment.pending", "payment", pendingId, { invoiceId: invoice.id, jobCardId, customerId, method: input.method, amount: rest });
    } else {
      await settleIfPaid(client, invoice.id);
    }
    return { invoiceId: invoice.id, pendingId };
  });
  const invoice = await getInvoice(db, result.invoiceId, customerId);
  return { invoice, pendingPayment: invoice.payments.find((p) => p.id === result.pendingId) ?? null };
}

/** Money taken by the workshop: cash or UPI at the door, card at the counter. */
export async function recordPayment(db: Db, jobCardId: string, input: { method: "upi" | "card" | "netbanking" | "cash"; amount: number; reference?: string; collectedByStaffCode?: string }) {
  const invoiceId = await tx(db, async (client) => {
    const invoice = await lockOpenInvoice(client, jobCardId, null);
    if (input.amount > invoice.balance + 0.005) throw badRequest("overpayment", `The balance due is ₹${invoice.balance}`);
    const staff = input.collectedByStaffCode
      ? await one<{ id: string }>(client, "SELECT id FROM staff WHERE code = $1", [input.collectedByStaffCode])
      : undefined;
    if (input.collectedByStaffCode && !staff) throw badRequest("unknown_staff", `No staff member with code ${input.collectedByStaffCode}`);
    const payment = await one<{ id: string }>(
      client,
      `INSERT INTO payments (invoice_id, customer_id, method, amount, status, provider, provider_reference, collected_by_staff_id, confirmed_at)
       VALUES ($1, $2, $3, $4, 'succeeded', 'workshop', $5, $6, now()) RETURNING id`,
      [invoice.id, invoice.customer_id, input.method, input.amount, input.reference ?? null, staff?.id ?? null],
    );
    await client.query("UPDATE payments SET status = 'failed', updated_at = now() WHERE invoice_id = $1 AND status = 'pending'", [invoice.id]);
    await emit(client, "payment.succeeded", "payment", payment!.id, { invoiceId: invoice.id, jobCardId, ...input });
    await settleIfPaid(client, invoice.id);
    return invoice.id;
  });
  return getInvoice(db, invoiceId, null);
}

/** Confirms or fails a pending online payment, from the gateway webhook handler or the ERP's reconciliation. */
export async function confirmPayment(db: Db, paymentId: string, input: { status: "succeeded" | "failed"; providerReference?: string }) {
  const invoiceId = await tx(db, async (client) => {
    const payment = await one<{ id: string; invoice_id: string; status: string; method: string; amount: number }>(
      client, "SELECT id, invoice_id, status, method, amount FROM payments WHERE id = $1 FOR UPDATE", [paymentId]);
    if (!payment) throw notFound("Payment");
    if (payment.status !== "pending") throw conflict("not_pending", `This payment is already ${payment.status}`);
    await client.query(
      "UPDATE payments SET status = $2, provider_reference = COALESCE($3, provider_reference), confirmed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE NULL END WHERE id = $1",
      [paymentId, input.status, input.providerReference ?? null],
    );
    await emit(client, input.status === "succeeded" ? "payment.succeeded" : "payment.failed", "payment", paymentId, {
      invoiceId: payment.invoice_id, method: payment.method, amount: payment.amount, providerReference: input.providerReference ?? null,
    });
    if (input.status === "succeeded") await settleIfPaid(client, payment.invoice_id);
    return payment.invoice_id;
  });
  return getInvoice(db, invoiceId, null);
}
