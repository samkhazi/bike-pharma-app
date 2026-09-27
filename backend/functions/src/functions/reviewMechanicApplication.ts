import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, isAdmin, requireAuth } from "../config";
import { parseLatLng, validateApplicationInput } from "../lib/mechanics";
import { allocateMechanic } from "./createMechanic";

/**
 * Admin only. Approves or rejects a mechanic signup (mechanicApplications/{uid}).
 * Approving creates mechanics/BPM-xxxx (verified, active) and stores the new id
 * on the application so the mechanic sees it in the app.
 *
 * data: { uid, approve: boolean, reason?: string, geo?: {lat, lng} }
 */
export const reviewMechanicApplication = onCall(async (req): Promise<{ status: string; mechanicId?: string }> => {
  const adminUid = requireAuth(req);
  if (!(await isAdmin(adminUid))) throw new HttpsError("permission-denied", "Only the shop admin can verify mechanics.");

  const d = (req.data ?? {}) as Record<string, unknown>;
  if (typeof d.uid !== "string" || !d.uid) throw new HttpsError("invalid-argument", "uid is required");
  const ref = db.collection("mechanicApplications").doc(d.uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "No signup found for this mechanic.");
  if (snap.get("status") !== "pending") throw new HttpsError("failed-precondition", "This signup was already reviewed.");

  if (d.approve !== true) {
    const reason = typeof d.reason === "string" ? d.reason.trim().slice(0, 300) : "";
    await ref.update({ status: "rejected", reason, reviewedBy: adminUid, reviewedAt: FieldValue.serverTimestamp() });
    return { status: "rejected" };
  }

  const app = validateApplicationInput(snap.data());
  if (!app.ok) throw new HttpsError("failed-precondition", `Signup is incomplete: ${app.error}`);
  const given = d.geo as Record<string, unknown> | undefined;
  const geo =
    given && typeof given.lat === "number" && typeof given.lng === "number"
      ? parseLatLng(`${given.lat},${given.lng}`)
      : parseLatLng(app.value.mapsLink);
  if (!geo) {
    throw new HttpsError("invalid-argument", "Location missing. Add the garage's lat,lng before approving.");
  }

  const fields: Record<string, unknown> = { ...app.value };
  delete fields.mapsLink;
  const mechanicId = await allocateMechanic(
    {
      ...fields,
      geo,
      uid: d.uid,
      rating: 0,
      spareBuyerSince: new Date().getFullYear(),
      verified: true,
      active: true,
      createdBy: adminUid,
    },
    (tx, id) =>
      tx.update(ref, { status: "approved", mechanicId: id, reviewedBy: adminUid, reviewedAt: FieldValue.serverTimestamp() }),
  );
  return { status: "approved", mechanicId };
});
