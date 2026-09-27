import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue, Transaction } from "firebase-admin/firestore";
import { authPhone, db, isAdmin, requireAuth } from "../config";
import { formatMechanicId, validateMechanicInput } from "../lib/mechanics";

/** Bike Pharma team only. Creates mechanics/BPM-xxxx using the counters/mechanics counter. */
export const createMechanic = onCall(async (req): Promise<{ mechanicId: string }> => {
  const uid = requireAuth(req);
  if (!(await isAdmin(uid, authPhone(req)))) {
    throw new HttpsError("permission-denied", "Only the Bike Pharma team can add mechanics.");
  }

  const input = validateMechanicInput(req.data);
  if (!input.ok) throw new HttpsError("invalid-argument", input.error);

  const mechanicId = await allocateMechanic({ ...input.value, createdBy: uid });
  return { mechanicId };
});

/**
 * Creates mechanics/BPM-xxxx from [data] inside a transaction, using the
 * counters/mechanics counter. [extra] lets callers write more docs in the same
 * transaction (e.g. marking a signup application approved).
 */
export async function allocateMechanic(
  data: Record<string, unknown>,
  extra?: (tx: Transaction, mechanicId: string) => void,
): Promise<string> {
  const counterRef = db.doc("counters/mechanics");
  return db.runTransaction(async (tx) => {
    const counter = await tx.get(counterRef);
    let next = Number(counter.get("next") ?? 1);
    if (!Number.isInteger(next) || next < 1) next = 1;

    // Skip ids that already exist (e.g. mechanics added by the seed script or by hand).
    const candidates = [];
    for (let tries = 0; tries < 50; tries++) candidates.push(db.collection("mechanics").doc(formatMechanicId(next + tries)));
    for (const candidate of candidates) {
      const existing = await tx.get(candidate);
      if (!existing.exists) {
        tx.set(candidate, { ...data, createdAt: FieldValue.serverTimestamp() });
        tx.set(counterRef, { next: Number(candidate.id.slice(4)) + 1 }, { merge: true });
        extra?.(tx, candidate.id);
        return candidate.id;
      }
    }
    throw new HttpsError("aborted", "Could not find a free mechanic id. Check counters/mechanics.");
  });
}
