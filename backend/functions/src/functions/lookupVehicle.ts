import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, requireAuth, secretValue, SUREPASS_TOKEN } from "../config";
import { mapSurepassResponse, normalizeRegNo, type VehicleLookupResult } from "../lib/vehicle";

const SUREPASS_RC_URL = "https://kyc-api.surepass.io/api/v1/rc/rc-full";
// Each lookup costs money, so limit how many one customer can do per day.
const MAX_LOOKUPS_PER_DAY = 10;

async function consumeDailyQuota(uid: string): Promise<boolean> {
  // Server-only collection (no client rules), keyed by uid.
  const ref = db.doc(`rcLookups/${uid}`);
  const today = new Date().toISOString().slice(0, 10);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const count = data?.day === today ? Number(data.count ?? 0) : 0;
    if (count >= MAX_LOOKUPS_PER_DAY) return false;
    tx.set(ref, { day: today, count: count + 1, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export const lookupVehicle = onCall(
  { secrets: [SUREPASS_TOKEN], timeoutSeconds: 30 },
  async (req): Promise<VehicleLookupResult> => {
    const uid = requireAuth(req);
    const regNo = normalizeRegNo((req.data as { regNo?: unknown } | undefined)?.regNo);
    if (!regNo) {
      throw new HttpsError("invalid-argument", "Enter a valid registration number, e.g. MH12AB1234.");
    }

    const token = secretValue(SUREPASS_TOKEN);
    if (!token) {
      throw new HttpsError("failed-precondition", "Vehicle lookup is not set up yet. Please add your bike details manually.");
    }

    if (!(await consumeDailyQuota(uid))) {
      throw new HttpsError("resource-exhausted", "Too many lookups today. Please add your bike details manually.");
    }

    let res: Response;
    try {
      res = await fetch(SUREPASS_RC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id_number: regNo }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      logger.error("Surepass request failed", { err: String(err) });
      throw new HttpsError("unavailable", "Vehicle lookup is not responding. Please try again or add details manually.");
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        logger.error("Surepass rejected the token (check SUREPASS_TOKEN / plan balance)", { status: res.status });
        throw new HttpsError("unavailable", "Vehicle lookup is not available right now. Please add details manually.");
      }
      if (res.status === 404 || res.status === 422 || res.status === 400) {
        throw new HttpsError("not-found", "We could not find this registration number. Please check it or add details manually.");
      }
      logger.error("Surepass error", { status: res.status, body });
      throw new HttpsError("unavailable", "Vehicle lookup failed. Please try again or add details manually.");
    }

    const result = mapSurepassResponse(body, regNo);
    if (!result) {
      // Log the shape (not the owner's personal data) to help fix the mapping.
      const data = (body as { data?: Record<string, unknown> } | null)?.data;
      logger.warn("Surepass response could not be mapped", { keys: data ? Object.keys(data) : null });
      throw new HttpsError("not-found", "We could not read this vehicle's details. Please add them manually.");
    }
    return result;
  },
);
