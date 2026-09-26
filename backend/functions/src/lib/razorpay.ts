/**
 * Razorpay signature checks (pure, unit-tested).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time check that `signature` == hex(HMAC-SHA256(payload, secret)). */
export function verifyHmacSha256(payload: string | Buffer, signature: unknown, secret: string): boolean {
  if (typeof signature !== "string" || !secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Checkout signature: HMAC-SHA256("<razorpay_order_id>|<razorpay_payment_id>", key_secret).
 */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: unknown,
  keySecret: string,
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId) return false;
  return verifyHmacSha256(`${razorpayOrderId}|${razorpayPaymentId}`, signature, keySecret);
}

/** Webhook signature: HMAC-SHA256(raw request body, webhook secret). */
export function verifyRazorpayWebhookSignature(rawBody: string | Buffer, signature: unknown, webhookSecret: string): boolean {
  return verifyHmacSha256(rawBody, signature, webhookSecret);
}
