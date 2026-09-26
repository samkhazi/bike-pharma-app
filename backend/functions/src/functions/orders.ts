import { logger } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import {
  db,
  requireAuth,
  secretValue,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
} from "../config";
import { computeTotals, isPaymentMethod, validateAddress, validateOrderItems } from "../lib/orders";
import { verifyRazorpaySignature, verifyRazorpayWebhookSignature } from "../lib/razorpay";
import { createRazorpayOrder } from "./razorpayApi";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
}

interface PlaceOrderResult {
  orderId: string;
  total: number;
  razorpay?: { orderId: string; keyId: string; amount: number };
}

/**
 * Creates an order. Prices and stock are read on the server inside a transaction.
 * COD orders start as "placed"; Razorpay orders start as "pending_payment".
 */
export const placeOrder = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET], timeoutSeconds: 60 },
  async (req): Promise<PlaceOrderResult> => {
    const uid = requireAuth(req);
    const data = (req.data ?? {}) as Record<string, unknown>;

    const items = validateOrderItems(data.items);
    if (!items.ok) throw new HttpsError("invalid-argument", items.error);
    const address = validateAddress(data.address);
    if (!address.ok) throw new HttpsError("invalid-argument", address.error);
    const paymentMethod = data.paymentMethod;
    if (!isPaymentMethod(paymentMethod)) throw new HttpsError("invalid-argument", "Choose a payment method.");

    let keyId: string | null = null;
    let keySecret: string | null = null;
    if (paymentMethod === "razorpay") {
      keyId = secretValue(RAZORPAY_KEY_ID);
      keySecret = secretValue(RAZORPAY_KEY_SECRET);
      if (!keyId || !keySecret) {
        throw new HttpsError("failed-precondition", "Online payment is not set up yet. Please choose Cash on Delivery.");
      }
    }

    const orderRef = db.collection("orders").doc();

    const { orderItems, totals } = await db.runTransaction(async (tx) => {
      const refs = items.value.map((i) => db.collection("products").doc(i.productId));
      const snaps = await tx.getAll(...refs);

      const orderItems: OrderItem[] = [];
      const stockUpdates: Array<{ ref: DocumentReference; stock: number }> = [];
      snaps.forEach((snap, idx) => {
        const { productId, qty } = items.value[idx];
        const p = snap.data();
        if (!snap.exists || !p || p.active !== true) {
          throw new HttpsError("failed-precondition", "A product in your cart is no longer available.", { productId });
        }
        const stock = typeof p.stock === "number" ? p.stock : 0;
        if (stock < qty) {
          const msg = stock <= 0 ? `${p.name} is out of stock.` : `Only ${stock} of ${p.name} left in stock.`;
          throw new HttpsError("failed-precondition", msg, { productId, available: Math.max(0, stock) });
        }
        if (!Number.isInteger(p.price) || p.price < 0) {
          logger.error("Product has an invalid price", { productId, price: p.price });
          throw new HttpsError("failed-precondition", `${p.name} cannot be ordered right now.`, { productId });
        }
        orderItems.push({ productId, name: String(p.name ?? ""), price: p.price, qty });
        stockUpdates.push({ ref: snap.ref, stock: stock - qty });
      });

      const totals = computeTotals(orderItems);

      for (const u of stockUpdates) tx.update(u.ref, { stock: u.stock });
      tx.set(orderRef, {
        uid,
        items: orderItems,
        ...totals,
        address: address.value,
        paymentMethod,
        razorpayOrderId: null,
        paid: false,
        status: paymentMethod === "cod" ? "placed" : "pending_payment",
        createdAt: FieldValue.serverTimestamp(),
      });
      for (const i of orderItems) tx.delete(db.doc(`users/${uid}/cart/${i.productId}`));

      return { orderItems, totals };
    });

    if (paymentMethod === "cod") {
      return { orderId: orderRef.id, total: totals.total };
    }

    try {
      const rzp = await createRazorpayOrder(keyId as string, keySecret as string, totals.total, orderRef.id, {
        orderId: orderRef.id,
        uid,
      });
      await orderRef.update({ razorpayOrderId: rzp.id });
      return {
        orderId: orderRef.id,
        total: totals.total,
        razorpay: { orderId: rzp.id, keyId: keyId as string, amount: totals.total },
      };
    } catch (err) {
      logger.error("Could not create Razorpay order; rolling back", { orderId: orderRef.id, err: String(err) });
      await rollBackOrder(orderRef, uid, orderItems);
      throw new HttpsError(
        "unavailable",
        "Online payment is not available right now. Please try again or choose Cash on Delivery.",
      );
    }
  },
);

/** Cancels an order that never reached payment: puts stock and cart items back. */
async function rollBackOrder(orderRef: DocumentReference, uid: string, items: OrderItem[]): Promise<void> {
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists || snap.get("status") !== "pending_payment") return;
      for (const i of items) {
        tx.update(db.collection("products").doc(i.productId), { stock: FieldValue.increment(i.qty) });
        tx.set(db.doc(`users/${uid}/cart/${i.productId}`), { qty: i.qty, addedAt: FieldValue.serverTimestamp() });
      }
      tx.update(orderRef, { status: "cancelled", cancelReason: "payment_setup_failed" });
    });
  } catch (err) {
    logger.error("Rollback failed; fix stock by hand", { orderId: orderRef.id, err: String(err) });
  }
}

/** Marks an order paid (idempotent). Shared by verifyPayment and the webhook. */
async function markOrderPaid(orderRef: DocumentReference, razorpayPaymentId: string, via: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists || snap.get("paid") === true) return;
    const update: Record<string, unknown> = {
      paid: true,
      razorpayPaymentId,
      paidVia: via,
      paidAt: FieldValue.serverTimestamp(),
    };
    const status = snap.get("status");
    if (status === "pending_payment") {
      update.status = "placed";
    } else if (status === "cancelled") {
      // Money arrived for a cancelled order: the shop must refund it from the Razorpay dashboard.
      update.needsRefund = true;
      logger.error("Payment received for a cancelled order - refund needed", { orderId: orderRef.id });
    }
    tx.update(orderRef, update);
  });
}

/** Called by the app after Razorpay Checkout succeeds. */
export const verifyPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (req): Promise<{ paid: true }> => {
  const uid = requireAuth(req);
  const data = (req.data ?? {}) as Record<string, unknown>;
  const { orderId, razorpayPaymentId, razorpaySignature } = data;
  if (typeof orderId !== "string" || !/^[A-Za-z0-9]{1,64}$/.test(orderId)) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  if (typeof razorpayPaymentId !== "string" || !razorpayPaymentId || typeof razorpaySignature !== "string") {
    throw new HttpsError("invalid-argument", "Payment details are missing.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists || snap.get("uid") !== uid) throw new HttpsError("not-found", "Order not found.");
  if (snap.get("paid") === true) return { paid: true };

  const razorpayOrderId = snap.get("razorpayOrderId");
  if (snap.get("paymentMethod") !== "razorpay" || typeof razorpayOrderId !== "string") {
    throw new HttpsError("failed-precondition", "This order is not an online payment order.");
  }

  const keySecret = secretValue(RAZORPAY_KEY_SECRET);
  if (!keySecret) throw new HttpsError("failed-precondition", "Online payment is not set up.");

  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, keySecret)) {
    logger.warn("Invalid Razorpay signature", { orderId, uid });
    throw new HttpsError("permission-denied", "We could not verify this payment. If money was deducted, it will be confirmed shortly.");
  }

  await markOrderPaid(orderRef, razorpayPaymentId, "checkout");
  return { paid: true };
});

/**
 * Razorpay webhook (set it up in Razorpay Dashboard > Settings > Webhooks,
 * event "payment.captured"). Backup for when the app closes before verifyPayment.
 */
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const secret = secretValue(RAZORPAY_WEBHOOK_SECRET);
  if (!secret) {
    logger.error("RAZORPAY_WEBHOOK_SECRET is not set");
    res.status(500).send("Webhook not configured");
    return;
  }
  const signature = req.get("x-razorpay-signature");
  if (!req.rawBody || !verifyRazorpayWebhookSignature(req.rawBody, signature, secret)) {
    logger.warn("Invalid webhook signature");
    res.status(400).send("Invalid signature");
    return;
  }

  const event = req.body as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } } };
  };
  if (event?.event !== "payment.captured") {
    res.status(200).send("ignored");
    return;
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) {
    res.status(200).send("ignored: no payment");
    return;
  }

  const q = await db.collection("orders").where("razorpayOrderId", "==", payment.order_id).limit(1).get();
  if (q.empty) {
    logger.warn("Webhook for unknown Razorpay order", { razorpayOrderId: payment.order_id });
    res.status(200).send("ignored: unknown order");
    return;
  }
  const orderDoc = q.docs[0];
  if (typeof payment.amount === "number" && payment.amount !== orderDoc.get("total")) {
    logger.error("Captured amount does not match order total", {
      orderId: orderDoc.id,
      amount: payment.amount,
      total: orderDoc.get("total"),
    });
    res.status(200).send("ignored: amount mismatch");
    return;
  }

  await markOrderPaid(orderDoc.ref, payment.id, "webhook");
  res.status(200).send("ok");
});
