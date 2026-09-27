/**
 * Pure helpers for vehicle lookup (no Firebase imports, unit-tested).
 */

export type Emission = "BS4" | "BS6";

export interface VehicleLookupResult {
  regNo: string;
  brand: string;
  model: string;
  year: number | null;
  colour: string | null;
  emission: Emission | null;
  fuel: string | null;
  chassisMasked: string | null;
}

// Standard plates (MH12AB1234, DL3CAB1234, KA011234) and Bharat series (22BH1234AB).
const STANDARD_REG = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
const BH_SERIES_REG = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

/**
 * Uppercases a registration number and removes spaces, dashes and dots.
 * Returns null when the result does not look like an Indian registration number.
 */
export function normalizeRegNo(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 6 || cleaned.length > 11) return null;
  if (STANDARD_REG.test(cleaned) || BH_SERIES_REG.test(cleaned)) return cleaned;
  return null;
}

/**
 * Masks a chassis number keeping only the first 4 and last 4 characters,
 * e.g. ME4JC65ABCDE54521 -> ME4JXXXXXXXXX4521.
 * Short values (8 chars or fewer) are fully masked except the last 4.
 */
export function maskChassis(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!v) return null;
  if (v.length <= 8) {
    return "X".repeat(Math.max(0, v.length - 4)) + v.slice(-4);
  }
  return v.slice(0, 4) + "X".repeat(v.length - 8) + v.slice(-4);
}

/** Maps emission norm text such as "BHARAT STAGE VI", "BS IV", "BS-6" to BS4/BS6. */
export function normalizeEmission(input: unknown): Emission | null {
  if (typeof input !== "string") return null;
  const v = input.toUpperCase().replace(/BHARAT\s*STAGE/g, "BS").replace(/[^A-Z0-9]/g, "");
  if (/^BS(VI|6)/.test(v)) return "BS6";
  if (/^BS(IV|4)/.test(v)) return "BS4";
  return null;
}

/** "HONDA MOTORCYCLE" -> "Honda Motorcycle" */
export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** The product filter key: "<brand>|<model>" lowercased, e.g. "honda|shine 125". */
export function makeFitKey(brand: string, model: string): string {
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${clean(brand)}|${clean(model)}`;
}

// Manufacturer legal names (as printed on the RC) -> short brand names used in the app.
// Order matters: the first match wins.
const MAKER_BRANDS: Array<[RegExp, string]> = [
  [/ROYAL\s*ENFIELD|EICHER/, "Royal Enfield"],
  [/HERO\s*HONDA/, "Hero"],
  [/HERO/, "Hero"],
  [/HONDA/, "Honda"],
  [/BAJAJ/, "Bajaj"],
  [/TVS/, "TVS"],
  [/YAMAHA/, "Yamaha"],
  [/SUZUKI/, "Suzuki"],
  [/KTM/, "KTM"],
  [/CLASSIC\s*LEGENDS|JAWA|YEZDI/, "Jawa"],
  [/PIAGGIO|VESPA|APRILIA/, "Piaggio"],
  [/MAHINDRA/, "Mahindra"],
  [/KAWASAKI/, "Kawasaki"],
  [/ATHER/, "Ather"],
  [/OLA\s*ELECTRIC/, "Ola"],
  [/TRIUMPH/, "Triumph"],
  [/HARLEY/, "Harley-Davidson"],
];

/** Converts a manufacturer name from the RC into a short brand name. */
export function brandFromMaker(maker: unknown): string {
  if (typeof maker !== "string" || !maker.trim()) return "";
  const upper = maker.toUpperCase();
  for (const [re, brand] of MAKER_BRANDS) {
    if (re.test(upper)) return brand;
  }
  // Unknown maker: drop company suffixes and title-case what is left.
  return titleCase(
    upper
      .replace(/\b(PVT|PRIVATE|LTD|LIMITED|INDIA|MOTOR(S|CYCLES?)?|AND|SCOOTERS?|CO|COMPANY)\b\.?/g, " ")
      .replace(/[().,]/g, " "),
  );
}

/** Extracts a 4 digit year from "10/2021", "2021-10", "2021", "15-Mar-2019" etc. */
export function extractYear(input: unknown): number | null {
  if (typeof input === "number" && Number.isInteger(input)) {
    return input >= 1950 && input <= 2100 ? input : null;
  }
  if (typeof input !== "string") return null;
  const m = input.match(/(19[5-9][0-9]|20[0-9]{2})/);
  return m ? Number(m[1]) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ---------------------------------------------------------------------------
// PROVIDER MAPPING (Surepass "rc-full")
// ---------------------------------------------------------------------------
// !!! CONFIRM THESE FIELD NAMES WHEN THE SUREPASS PLAN IS BOUGHT !!!
// The field names below follow Surepass's published sample response for
// POST /api/v1/rc/rc-full:
//   { success, status_code, message, data: {
//       rc_number, maker_description, maker_model, manufacturing_date,
//       manufacturing_date_formatted, registration_date, color,
//       norms_type, fuel_type, vehicle_chasi_number, ... } }
// If the live response differs, change ONLY this function (and its tests).
// Several alternative names are tried so small differences do not break it.
// ---------------------------------------------------------------------------
export function mapSurepassResponse(
  response: unknown,
  requestedRegNo: string,
): VehicleLookupResult | null {
  if (!response || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  if (root.success === false) return null;
  const data = root.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return null;

  const makerRaw = str(data.maker_description) ?? str(data.maker) ?? str(data.manufacturer);
  const modelRaw = str(data.maker_model) ?? str(data.model) ?? str(data.vehicle_model);
  if (!makerRaw && !modelRaw) return null;

  const brand = brandFromMaker(makerRaw);
  let model = modelRaw ? titleCase(modelRaw) : "";
  // RCs often repeat the brand inside the model ("HONDA SHINE 125"): strip it.
  if (brand && model.toLowerCase().startsWith(brand.toLowerCase() + " ")) {
    model = model.slice(brand.length + 1);
  }

  const year =
    extractYear(data.manufacturing_date_formatted) ??
    extractYear(data.manufacturing_date) ??
    extractYear(data.registration_date);

  const colourRaw = str(data.color) ?? str(data.colour) ?? str(data.vehicle_colour);
  const fuelRaw = str(data.fuel_type) ?? str(data.fuel);
  const chassisRaw = str(data.vehicle_chasi_number) ?? str(data.vehicle_chassis_number) ?? str(data.chassis_number);

  return {
    regNo: normalizeRegNo(str(data.rc_number) ?? requestedRegNo) ?? requestedRegNo,
    brand,
    model,
    year,
    colour: colourRaw ? titleCase(colourRaw) : null,
    emission: normalizeEmission(str(data.norms_type) ?? str(data.emission_norms)),
    fuel: fuelRaw ? titleCase(fuelRaw) : null,
    chassisMasked: maskChassis(chassisRaw),
  };
}
