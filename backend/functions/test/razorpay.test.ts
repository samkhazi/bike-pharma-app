import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHmacSha256, verifyRazorpaySignature, verifyRazorpayWebhookSignature } from "../src/lib/razorpay";

const secret = "test_secret";
const sign = (payload: string, key = secret) => createHmac("sha256", key).update(payload).digest("hex");

describe("verifyRazorpaySignature", () => {
  it("accepts a correct checkout signature", () => {
    const sig = sign("order_ABC|pay_XYZ");
    expect(verifyRazorpaySignature("order_ABC", "pay_XYZ", sig, secret)).toBe(true);
  });
  it("rejects wrong ids, wrong secret, bad input", () => {
    const sig = sign("order_ABC|pay_XYZ");
    expect(verifyRazorpaySignature("order_ABC", "pay_OTHER", sig, secret)).toBe(false);
    expect(verifyRazorpaySignature("order_ABC", "pay_XYZ", sig, "other")).toBe(false);
    expect(verifyRazorpaySignature("order_ABC", "pay_XYZ", "short", secret)).toBe(false);
    expect(verifyRazorpaySignature("order_ABC", "pay_XYZ", undefined, secret)).toBe(false);
    expect(verifyRazorpaySignature("", "pay_XYZ", sig, secret)).toBe(false);
    expect(verifyRazorpaySignature("order_ABC", "pay_XYZ", sig, "")).toBe(false);
  });
});

describe("verifyRazorpayWebhookSignature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
  it("works with string and Buffer bodies", () => {
    const sig = sign(body);
    expect(verifyRazorpayWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(Buffer.from(body), sig, secret)).toBe(true);
  });
  it("rejects a tampered body", () => {
    const sig = sign(body);
    expect(verifyRazorpayWebhookSignature(body.replace("pay_1", "pay_2"), sig, secret)).toBe(false);
  });
  it("is case-insensitive on hex", () => {
    expect(verifyHmacSha256("x", sign("x").toUpperCase(), secret)).toBe(true);
  });
});
