import { describe, expect, it } from "vitest";
import {
  computeTotals,
  DELIVERY_FEE,
  discountPercent,
  MAX_MECHANIC_DISCOUNT,
  mechanicPrice,
  isPaymentMethod,
  normalizeIndianPhone,
  validateAddress,
  validateOrderItems,
} from "../src/lib/orders";

describe("computeTotals", () => {
  it("charges delivery below Rs 499", () => {
    expect(computeTotals([{ price: 20000, qty: 2 }])).toEqual({ subtotal: 40000, deliveryFee: DELIVERY_FEE, total: 44900 });
  });
  it("free delivery at exactly Rs 499", () => {
    expect(computeTotals([{ price: 49900, qty: 1 }])).toEqual({ subtotal: 49900, deliveryFee: 0, total: 49900 });
  });
  it("free delivery above threshold across lines", () => {
    expect(computeTotals([{ price: 25000, qty: 1 }, { price: 12500, qty: 2 }])).toEqual({ subtotal: 50000, deliveryFee: 0, total: 50000 });
  });
  it("one paisa below threshold pays delivery", () => {
    expect(computeTotals([{ price: 49899, qty: 1 }]).deliveryFee).toBe(4900);
  });
  it("rejects non-integer money and bad qty", () => {
    expect(() => computeTotals([{ price: 10.5, qty: 1 }])).toThrow();
    expect(() => computeTotals([{ price: 100, qty: 0 }])).toThrow();
  });
});

describe("validateAddress", () => {
  const good = { name: " Sam  K ", phone: "98765 43210", line1: "12, MG Road", city: "Pune", pincode: "411001" };
  it("accepts and cleans a good address", () => {
    expect(validateAddress(good)).toEqual({
      ok: true,
      value: { name: "Sam K", phone: "+919876543210", line1: "12, MG Road", city: "Pune", pincode: "411001" },
    });
  });
  it("keeps optional line2, accepts numeric pincode", () => {
    const r = validateAddress({ ...good, line2: "Near temple", pincode: 411001 });
    expect(r.ok && r.value.line2).toBe("Near temple");
    expect(r.ok && r.value.pincode).toBe("411001");
  });
  it.each([
    [{ ...good, name: "" }],
    [{ ...good, phone: "12345" }],
    [{ ...good, phone: "5876543210" }],
    [{ ...good, line1: "   " }],
    [{ ...good, city: undefined }],
    [{ ...good, pincode: "011001" }],
    [{ ...good, pincode: "41100" }],
    [null],
  ])("rejects %j", (input) => {
    expect(validateAddress(input).ok).toBe(false);
  });
});

describe("normalizeIndianPhone", () => {
  it("normalises formats", () => {
    expect(normalizeIndianPhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("919876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("12345")).toBeNull();
  });
});

describe("validateOrderItems", () => {
  it("merges duplicates", () => {
    expect(validateOrderItems([{ productId: "a", qty: 1 }, { productId: "b", qty: 2 }, { productId: "a", qty: 3 }])).toEqual({
      ok: true,
      value: [{ productId: "a", qty: 4 }, { productId: "b", qty: 2 }],
    });
  });
  it("rejects bad input", () => {
    expect(validateOrderItems([]).ok).toBe(false);
    expect(validateOrderItems([{ productId: "a", qty: 0 }]).ok).toBe(false);
    expect(validateOrderItems([{ productId: "a", qty: 1.5 }]).ok).toBe(false);
    expect(validateOrderItems([{ productId: "../x", qty: 1 }]).ok).toBe(false);
    expect(validateOrderItems([{ productId: "a", qty: 21 }]).ok).toBe(false);
    expect(validateOrderItems("nope").ok).toBe(false);
  });
  it("checks payment methods", () => {
    expect(isPaymentMethod("cod")).toBe(true);
    expect(isPaymentMethod("razorpay")).toBe(true);
    expect(isPaymentMethod("upi")).toBe(false);
  });
});

describe("mechanicPrice", () => {
  it("takes the percent off and rounds to the rupee, like the app", () => {
    expect(mechanicPrice(44900, 10)).toBe(40400); // Rs 404.10 -> Rs 404
    expect(mechanicPrice(5000, 50)).toBe(2500);
    expect(mechanicPrice(14900, 15)).toBe(12700); // Rs 126.65 -> Rs 127
    expect(mechanicPrice(44900, 15)).toBe(38200); // Rs 381.65 -> Rs 382
  });
  it("caps at the maximum discount", () => {
    expect(mechanicPrice(10000, 80)).toBe(5000);
    expect(MAX_MECHANIC_DISCOUNT).toBe(50);
  });
  it("gives no discount for zero, negative or bad percents", () => {
    expect(mechanicPrice(44900, 0)).toBe(44900);
    expect(mechanicPrice(44900, -5)).toBe(44900);
    expect(mechanicPrice(44900, 12.5)).toBe(44900);
    expect(mechanicPrice(44900, Number.NaN)).toBe(44900);
  });
  it("never charges more than the list price", () => {
    expect(mechanicPrice(99, 1)).toBe(99);
  });
});

describe("discountPercent", () => {
  it.each([
    [10, 10],
    [50, 50],
    [75, 50],
    [0, 0],
    [-3, 0],
    [2.5, 0],
    ["10", 0],
    [undefined, 0],
    [null, 0],
  ])("%j -> %j", (input, want) => {
    expect(discountPercent(input)).toBe(want);
  });
});
