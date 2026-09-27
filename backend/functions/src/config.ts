import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

export const db = getFirestore();

export const REGION = "asia-south1";

// Set here (not in index.ts) so it runs before any function is defined.
setGlobalOptions({ region: REGION, maxInstances: 10 });

// Secrets are stored in Google Secret Manager. Set them with:
//   firebase functions:secrets:set SUREPASS_TOKEN
// Until you have a real key, set the value to `none` (deploy needs the secret to exist).
export const SUREPASS_TOKEN = defineSecret("SUREPASS_TOKEN");
export const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
export const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
export const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");

/** Treats empty values and placeholders like "none" as "not configured". */
export function secretValue(secret: { value(): string }): string | null {
  let v = "";
  try {
    v = (secret.value() ?? "").trim();
  } catch {
    return null;
  }
  if (!v || ["none", "na", "n/a", "todo", "placeholder", "-"].includes(v.toLowerCase())) return null;
  return v;
}

/** Returns the signed-in user's uid or throws `unauthenticated`. */
export function requireAuth(req: CallableRequest<unknown>): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in first.");
  return uid;
}

/** The caller's verified mobile number from Firebase phone sign-in, e.g. "+919876543210". */
export function authPhone(req: CallableRequest<unknown>): string | null {
  const p = req.auth?.token?.phone_number;
  return typeof p === "string" ? p : null;
}

export type StaffRole = "owner" | "staff";

/**
 * The caller's Bike Pharma team role. Owner: admins/{uid}, or team/{phone}
 * with role "owner". Staff: any other team/{phone} (added by mobile number).
 * Customers and mechanics are on neither list, so they get null.
 */
export async function staffRole(uid: string, phone?: string | null): Promise<StaffRole | null> {
  if ((await db.doc(`admins/${uid}`).get()).exists) return "owner";
  if (!phone || !/^\+\d{8,15}$/.test(phone)) return null;
  const member = await db.doc(`team/${phone}`).get();
  if (!member.exists) return null;
  return member.get("role") === "owner" ? "owner" : "staff";
}

/** Bike Pharma team check (staff or owner). */
export async function isAdmin(uid: string, phone?: string | null): Promise<boolean> {
  return (await staffRole(uid, phone)) !== null;
}
