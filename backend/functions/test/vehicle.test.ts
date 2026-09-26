import { describe, expect, it } from "vitest";
import {
  brandFromMaker,
  extractYear,
  makeFitKey,
  mapSurepassResponse,
  maskChassis,
  normalizeEmission,
  normalizeRegNo,
} from "../src/lib/vehicle";

describe("normalizeRegNo", () => {
  it("uppercases and strips spaces/dashes", () => {
    expect(normalizeRegNo("mh 12 ab 1234")).toBe("MH12AB1234");
    expect(normalizeRegNo("KA-01-HH-1234")).toBe("KA01HH1234");
    expect(normalizeRegNo(" dl3cab1234 ")).toBe("DL3CAB1234");
  });
  it("accepts Bharat series", () => {
    expect(normalizeRegNo("22 BH 1234 AA")).toBe("22BH1234AA");
  });
  it("rejects junk", () => {
    expect(normalizeRegNo("")).toBeNull();
    expect(normalizeRegNo("hello")).toBeNull();
    expect(normalizeRegNo("1234567")).toBeNull();
    expect(normalizeRegNo(12345)).toBeNull();
    expect(normalizeRegNo(undefined)).toBeNull();
  });
});

describe("maskChassis", () => {
  it("keeps first 4 and last 4", () => {
    expect(maskChassis("ME4JC65ABCDE54521")).toBe("ME4JXXXXXXXXX4521");
    expect(maskChassis("me4jc65abcde54521")).toBe("ME4JXXXXXXXXX4521");
  });
  it("handles short and empty values", () => {
    expect(maskChassis("ABCD1234")).toBe("XXXX1234");
    expect(maskChassis("1234")).toBe("1234");
    expect(maskChassis("")).toBeNull();
    expect(maskChassis(null)).toBeNull();
  });
  it("output length equals input length", () => {
    const v = "MBLHAR073HHA12345";
    expect(maskChassis(v)).toHaveLength(v.length);
  });
});

describe("normalizeEmission", () => {
  it.each([
    ["BS IV", "BS4"],
    ["BS-IV", "BS4"],
    ["BHARAT STAGE IV", "BS4"],
    ["BS4", "BS4"],
    ["BS VI", "BS6"],
    ["BHARAT STAGE VI", "BS6"],
    ["bs-vi", "BS6"],
    ["BS6 Phase 2", "BS6"],
  ])("%s -> %s", (input, out) => {
    expect(normalizeEmission(input)).toBe(out);
  });
  it("returns null for unknown", () => {
    expect(normalizeEmission("NOT AVAILABLE")).toBeNull();
    expect(normalizeEmission("BS III")).toBeNull();
    expect(normalizeEmission(undefined)).toBeNull();
  });
});

describe("brandFromMaker / extractYear / makeFitKey", () => {
  it("maps manufacturer names", () => {
    expect(brandFromMaker("HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD")).toBe("Honda");
    expect(brandFromMaker("HERO MOTOCORP LTD")).toBe("Hero");
    expect(brandFromMaker("HERO HONDA MOTORS LTD")).toBe("Hero");
    expect(brandFromMaker("BAJAJ AUTO LTD")).toBe("Bajaj");
    expect(brandFromMaker("ROYAL ENFIELD (UNIT OF EICHER MOTORS LTD)")).toBe("Royal Enfield");
    expect(brandFromMaker("TVS MOTOR COMPANY LTD")).toBe("TVS");
    expect(brandFromMaker("ACME MOTORS PVT LTD")).toBe("Acme");
    expect(brandFromMaker(null)).toBe("");
  });
  it("extracts years", () => {
    expect(extractYear("10/2021")).toBe(2021);
    expect(extractYear("2019-03")).toBe(2019);
    expect(extractYear("15-Mar-2018")).toBe(2018);
    expect(extractYear(2020)).toBe(2020);
    expect(extractYear("n/a")).toBeNull();
  });
  it("builds fit keys", () => {
    expect(makeFitKey("Honda", "Shine  125")).toBe("honda|shine 125");
  });
});

describe("mapSurepassResponse", () => {
  const sample = {
    success: true,
    status_code: 200,
    message: "",
    data: {
      rc_number: "MH12AB1234",
      owner_name: "SOMEONE",
      maker_description: "HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD",
      maker_model: "SHINE 125",
      manufacturing_date: "10/2021",
      manufacturing_date_formatted: "2021-10",
      registration_date: "2021-11-02",
      color: "BLACK",
      norms_type: "BHARAT STAGE VI",
      fuel_type: "PETROL",
      vehicle_chasi_number: "ME4JC65ABCDE54521",
    },
  };

  it("maps the documented sample", () => {
    expect(mapSurepassResponse(sample, "MH12AB1234")).toEqual({
      regNo: "MH12AB1234",
      brand: "Honda",
      model: "Shine 125",
      year: 2021,
      colour: "Black",
      emission: "BS6",
      fuel: "Petrol",
      chassisMasked: "ME4JXXXXXXXXX4521",
    });
  });

  it("does not leak owner name or full chassis", () => {
    const out = JSON.stringify(mapSurepassResponse(sample, "MH12AB1234"));
    expect(out).not.toContain("SOMEONE");
    expect(out).not.toContain("ME4JC65ABCDE54521");
  });

  it("strips brand repeated in model and tolerates missing fields", () => {
    const out = mapSurepassResponse(
      { success: true, data: { maker_description: "BAJAJ AUTO LTD", maker_model: "BAJAJ PULSAR 150", norms_type: "BS IV" } },
      "KA01HH1234",
    );
    expect(out).toMatchObject({ brand: "Bajaj", model: "Pulsar 150", emission: "BS4", year: null, chassisMasked: null });
  });

  it("returns null for failures", () => {
    expect(mapSurepassResponse({ success: false, data: {} }, "X")).toBeNull();
    expect(mapSurepassResponse({ success: true, data: {} }, "X")).toBeNull();
    expect(mapSurepassResponse(null, "X")).toBeNull();
  });
});
