import { logger } from "firebase-functions";

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

/** Creates a Razorpay order via REST (basic auth key_id:key_secret). Amount in paise. */
export async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  amount: number,
  receipt: string,
  notes: Record<string, string>,
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(RAZORPAY_ORDERS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount, currency: "INR", receipt: receipt.slice(0, 40), notes }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || typeof body.id !== "string") {
    logger.error("Razorpay order create failed", { status: res.status, error: body?.error ?? null });
    throw new Error(`Razorpay order create failed with HTTP ${res.status}`);
  }
  return body as unknown as RazorpayOrder;
}
