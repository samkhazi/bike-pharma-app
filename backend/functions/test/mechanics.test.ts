import { describe, expect, it } from "vitest";
import { formatMechanicId, parseMechanicId, validateMechanicInput } from "../src/lib/mechanics";

describe("formatMechanicId", () => {
  it("pads to 4 digits", () => {
    expect(formatMechanicId(1)).toBe("BPM-0001");
    expect(formatMechanicId(231)).toBe("BPM-0231");
    expect(formatMechanicId(9999)).toBe("BPM-9999");
    expect(formatMechanicId(12345)).toBe("BPM-12345");
  });
  it("rejects invalid numbers", () => {
    expect(() => formatMechanicId(0)).toThrow();
    expect(() => formatMechanicId(1.5)).toThrow();
  });
});

describe("parseMechanicId", () => {
  it("accepts QR and bare ids", () => {
    expect(parseMechanicId("bikepharma://mechanic/BPM-0231")).toBe("BPM-0231");
    expect(parseMechanicId("bpm-0231")).toBe("BPM-0231");
    expect(parseMechanicId("https://evil.com/BPM-0231")).toBeNull();
    expect(parseMechanicId("BPM-12")).toBeNull();
  });
});

describe("validateMechanicInput", () => {
  const base = {
    name: "Ravi Kumar",
    garageName: "Ravi Auto Garage",
    address: "Shop 4, Main Road",
    phone: "+919876543210",
    geo: { lat: 18.5, lng: 73.8 },
  };
  it("fills defaults", () => {
    const r = validateMechanicInput(base, 2026);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ photos: [], services: [], rating: 0, spareBuyerSince: 2026, verified: true, active: true });
    }
  });
  it("rejects bad data", () => {
    expect(validateMechanicInput({ ...base, name: "" }).ok).toBe(false);
    expect(validateMechanicInput({ ...base, geo: { lat: 200, lng: 0 } }).ok).toBe(false);
    expect(validateMechanicInput({ ...base, rating: 6 }).ok).toBe(false);
    expect(validateMechanicInput({ ...base, services: "Oil change" }).ok).toBe(false);
    expect(validateMechanicInput({ ...base, verified: "yes" }).ok).toBe(false);
    expect(validateMechanicInput({ ...base, spareBuyerSince: 2030 }, 2026).ok).toBe(false);
  });
});
