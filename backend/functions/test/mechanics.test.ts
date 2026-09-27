import { describe, expect, it } from "vitest";
import { formatMechanicId, parseLatLng, parseMechanicId, validateApplicationInput, validateMechanicInput } from "../src/lib/mechanics";

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

describe("validateApplicationInput", () => {
  const good = {
    name: "Imran Sayyed",
    garageName: "Speed Point Garage",
    phone: "+919800000415",
    address: "Service road, near toll naka",
    specialistBrands: ["Bajaj", "KTM"],
    vehicleTypes: ["Sports bikes"],
    services: ["Engine overhaul"],
    experienceYears: 7,
  };

  it("accepts a complete signup", () => {
    const r = validateApplicationInput(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.photos).toEqual([]);
  });

  it("needs at least one brand and one service", () => {
    expect(validateApplicationInput({ ...good, specialistBrands: [] }).ok).toBe(false);
    expect(validateApplicationInput({ ...good, services: [] }).ok).toBe(false);
  });

  it("rejects missing garage name and bad experience", () => {
    expect(validateApplicationInput({ ...good, garageName: " " }).ok).toBe(false);
    expect(validateApplicationInput({ ...good, experienceYears: 120 }).ok).toBe(false);
  });
});

describe("parseLatLng", () => {
  it("reads coordinates from a Google Maps link", () => {
    expect(parseLatLng("https://www.google.com/maps/@18.5204,73.8567,17z")).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseLatLng("https://maps.google.com/?q=18.52,73.85")).toEqual({ lat: 18.52, lng: 73.85 });
  });

  it("reads typed coordinates", () => {
    expect(parseLatLng("18.5204, 73.8567")).toEqual({ lat: 18.5204, lng: 73.8567 });
  });

  it("returns null without coordinates", () => {
    expect(parseLatLng("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(parseLatLng(undefined)).toBeNull();
  });
});
