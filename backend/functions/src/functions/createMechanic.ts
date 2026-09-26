import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, isAdmin, requireAuth } from "../config";
import { formatMechanicId, validateMechanicInput } from "../lib/mechanics";

/** Admin only. Creates mechanics/BPM-xxxx using the counters/mechanics counter. */
export const createMechanic = onCall(async (req): Promise<{ mechanicId: string }> => {
  const uid = requireAuth(req);
  if (!(await isAdmin(uid))) throw new HttpsError("permission-denied", "Only the shop admin can add mechanics.");

  const input = validateMechanicInput(req.data);
  if (!input.ok) throw new HttpsError("invalid-argument", input.error);

  const counterRef = db.doc("counters/mechanics");
  const mechanicId = await db.runTransaction(async (tx) => {
    const counter = await tx.get(counterRef);
    let next = Number(counter.get("next") ?? 1);
    if (!Number.isInteger(next) || next < 1) next = 1;

    // Skip ids that already exist (e.g. mechanics added by the seed script or by hand).
    for (let tries = 0; tries < 50; tries++) {
      const candidate = db.collection("mechanics").doc(formatMechanicId(next));
      const existing = await tx.get(candidate);
      if (!existing.exists) {
        tx.set(candidate, { ...input.value, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
        tx.set(counterRef, { next: next + 1 }, { merge: true });
        return candidate.id;
      }
      next++;
    }
    throw new HttpsError("aborted", "Could not find a free mechanic id. Check counters/mechanics.");
  });

  return { mechanicId };
});
