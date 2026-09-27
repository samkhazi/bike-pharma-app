/**
 * Pure helpers for orders (no Firebase imports, unit-tested).
 * All money values are integer paise.
 */

export const FREE_DELIVERY_THRESHOLD = 49900; // Rs 499
export const DELIVERY_FEE = 4900; // Rs 49
export const MAX_QTY_PER_ITEM = 20;
export const MAX_LINES = 50;

export type PaymentMethod = "cod" | "razorpay";

export interface Address {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
}

export interface Totals {
  subtotal: number;
  deliveryFee: number;
  total: number;
}

/** subtotal + delivery fee (free at or above Rs 499). */
export function computeTotals(lines: Array<{ price: number; qty: number }>): Totals {
  let subtotal = 0;
  for (const { price, qty } of lines) {
    if (!Number.isInteger(price) || price < 0) throw new Error("price must be a non-negative integer (paise)");
    if (!Number.isInteger(qty) || qty < 1) throw new Error("qty must be a positive integer");
    subtotal += price * qty;
  }
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function trimmed(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t && t.length <= max ? t : null;
}

/** Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX). */
export function normalizeIndianPhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let digits = v.replace(/[^0-9]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9][0-9]{9}$/.test(digits) ? `+91${digits}` : null;
}

/** Validates and cleans a delivery address from the app. */
export function validateAddress(input: unknown): Result<Address> {
  if (!input || typeof input !== "object") return { ok: false, error: "Address is required." };
  const a = input as Record<string, unknown>;
  const name = trimmed(a.name, 80);
  if (!name) return { ok: false, error: "Enter the receiver's name." };
  const phone = normalizeIndianPhone(a.phone);
  if (!phone) return { ok: false, error: "Enter a valid 10 digit mobile number." };
  const line1 = trimmed(a.line1, 200);
  if (!line1) return { ok: false, error: "Enter the address." };
  let line2: string | undefined;
  if (a.line2 !== undefined && a.line2 !== null && a.line2 !== "") {
    const l2 = trimmed(a.line2, 200);
    if (!l2) return { ok: false, error: "Address line 2 is too long." };
    line2 = l2;
  }
  const city = trimmed(a.city, 80);
  if (!city) return { ok: false, error: "Enter the city." };
  const pincode = typeof a.pincode === "number" ? String(a.pincode) : typeof a.pincode === "string" ? a.pincode.trim() : "";
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return { ok: false, error: "Enter a valid 6 digit pincode." };

  const value: Address = { name, phone, line1, city, pincode };
  if (line2) value.line2 = line2;
  return { ok: true, value };
}

/** Validates the cart lines sent by the app and merges duplicate product ids. */
export function validateOrderItems(input: unknown): Result<Array<{ productId: string; qty: number }>> {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "Your cart is empty." };
  if (input.length > MAX_LINES) return { ok: false, error: "Too many items in one order." };
  const merged = new Map<string, number>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid item." };
    const { productId, qty } = raw as Record<string, unknown>;
    if (typeof productId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(productId)) {
      return { ok: false, error: "Invalid product." };
    }
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) {
      return { ok: false, error: "Invalid quantity." };
    }
    merged.set(productId, (merged.get(productId) ?? 0) + qty);
  }
  for (const qty of merged.values()) {
    if (qty > MAX_QTY_PER_ITEM) return { ok: false, error: `Maximum ${MAX_QTY_PER_ITEM} of one item per order.` };
  }
  return { ok: true, value: [...merged].map(([productId, qty]) => ({ productId, qty })) };
}

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "cod" || v === "razorpay";
}
