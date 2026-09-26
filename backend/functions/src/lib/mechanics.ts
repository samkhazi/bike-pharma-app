/**
 * Pure helpers for mechanics (no Firebase imports, unit-tested).
 */

/** 1 -> "BPM-0001", 231 -> "BPM-0231", 12345 -> "BPM-12345". */
export function formatMechanicId(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error("mechanic number must be a positive integer");
  return `BPM-${String(n).padStart(4, "0")}`;
}

/** Accepts "bikepharma://mechanic/BPM-0231", "bpm-0231" or "BPM-0231"; returns the id or null. */
export function parseMechanicId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const m = input.trim().match(/^(?:bikepharma:\/\/mechanic\/)?(BPM-[0-9]{4,})$/i);
  return m ? m[1].toUpperCase() : null;
}

export interface MechanicInput {
  name: string;
  garageName: string;
  photos: string[];
  specialistBrands: string[];
  vehicleTypes: string[];
  services: string[];
  rating: number;
  experienceYears: number;
  spareBuyerSince: number;
  address: string;
  geo: { lat: number; lng: number };
  phone: string;
  openHours: string;
  verified: boolean;
  active: boolean;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isStr(v: unknown, max = 200): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function strList(v: unknown, maxItems = 30): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > maxItems) return null;
  const out: string[] = [];
  for (const s of v) {
    if (!isStr(s, 500)) return null;
    out.push(s.trim());
  }
  return out;
}

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** Validates the fields an admin sends to createMechanic. */
export function validateMechanicInput(input: unknown, currentYear = new Date().getFullYear()): Result<MechanicInput> {
  if (!input || typeof input !== "object") return { ok: false, error: "Mechanic details are required." };
  const d = input as Record<string, unknown>;
  if (!isStr(d.name, 100)) return { ok: false, error: "name is required" };
  if (!isStr(d.garageName, 150)) return { ok: false, error: "garageName is required" };
  if (!isStr(d.address, 500)) return { ok: false, error: "address is required" };
  if (!isStr(d.phone, 20)) return { ok: false, error: "phone is required" };

  const lists: Record<string, string[]> = {};
  for (const key of ["photos", "specialistBrands", "vehicleTypes", "services"]) {
    const l = strList(d[key]);
    if (!l) return { ok: false, error: `${key} must be a list of text` };
    lists[key] = l;
  }

  const geo = d.geo as Record<string, unknown> | undefined;
  const lat = geo ? num(geo.lat, -90, 90) : null;
  const lng = geo ? num(geo.lng, -180, 180) : null;
  if (lat === null || lng === null) return { ok: false, error: "geo {lat, lng} is required" };

  const rating = d.rating === undefined ? 0 : num(d.rating, 0, 5);
  if (rating === null) return { ok: false, error: "rating must be 0 to 5" };
  const experienceYears = d.experienceYears === undefined ? 0 : num(d.experienceYears, 0, 80);
  if (experienceYears === null) return { ok: false, error: "experienceYears must be 0 to 80" };
  const spareBuyerSince = d.spareBuyerSince === undefined ? currentYear : num(d.spareBuyerSince, 1950, currentYear);
  if (spareBuyerSince === null || !Number.isInteger(spareBuyerSince)) {
    return { ok: false, error: "spareBuyerSince must be a year" };
  }
  if (d.openHours !== undefined && !isStr(d.openHours, 100)) return { ok: false, error: "openHours must be text" };
  for (const key of ["verified", "active"]) {
    if (d[key] !== undefined && typeof d[key] !== "boolean") return { ok: false, error: `${key} must be true/false` };
  }

  return {
    ok: true,
    value: {
      name: (d.name as string).trim(),
      garageName: (d.garageName as string).trim(),
      photos: lists.photos,
      specialistBrands: lists.specialistBrands,
      vehicleTypes: lists.vehicleTypes,
      services: lists.services,
      rating,
      experienceYears,
      spareBuyerSince,
      address: (d.address as string).trim(),
      geo: { lat, lng },
      phone: (d.phone as string).trim(),
      openHours: typeof d.openHours === "string" ? d.openHours.trim() : "",
      verified: d.verified === undefined ? true : (d.verified as boolean),
      active: d.active === undefined ? true : (d.active as boolean),
    },
  };
}
