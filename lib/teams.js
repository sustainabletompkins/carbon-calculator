/**
 * Shared helpers for the `teams` collection.
 *
 * Teams and individual accounts live in the same collection, told apart by
 * `isIndividual`, and both are referenced by memberships and offsets through a
 * numeric `legacyId` carried over from the old site. Two code paths now create
 * accounts — the admin UI (adminRoutes.js) and visitor sign-up (raceRoutes.js)
 * — so id allocation and the duplicate-name rule live here instead of being
 * written twice.
 */
import admin from "firebase-admin";
import { HttpError, cleanStr, num } from "./ledger.js";

/** Counter document backing allocateLegacyId(). */
export const TEAM_ID_COUNTER_DOC = "teamIdCounter";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim, lowercase and validate an email, or throw a 400. */
export function parseEmail(value) {
  const email = cleanStr(value, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
  return email;
}

/** Highest legacyId in use. Stored shapes vary, so this reads and coerces. */
async function highestLegacyId(db) {
  const snap = await db.collection("teams").get();
  return snap.docs.reduce((max, d) => Math.max(max, num(d.data().legacyId)), 0);
}

/**
 * Reserve the next legacyId.
 *
 * Taking max(legacyId) + 1 at write time is fine for one admin clicking a
 * button, but visitors create accounts concurrently and two sharing a
 * legacyId would cross-wire their memberships and offsets — a collision the
 * migration plan already calls out as a hazard. So the id comes from a
 * counter document bumped inside a transaction.
 *
 * The floor is still recomputed from the collection every time rather than
 * trusting the counter alone: the migration reloads `teams` wholesale
 * (docs/DATA_MIGRATION_PLAN.md), and a counter left over from before a reload
 * would hand out ids the imported rows are already using. Account creation is
 * rare enough that the extra read costs nothing.
 */
export async function allocateLegacyId(db) {
  const ref = db.collection("adminSettings").doc(TEAM_ID_COUNTER_DOC);
  const floor = (await highestLegacyId(db)) + 1;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const legacyId = Math.max(num(snap.data()?.next), floor, 1);
    tx.set(
      ref,
      { next: legacyId + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return legacyId;
  });
}

/**
 * Reject a name already taken by an account of the same kind. Teams and
 * individuals are allowed to share a name — they are separate leaderboards.
 * `exceptDocId` skips the account being renamed.
 */
export async function assertNameAvailable(db, name, isIndividual, message, exceptDocId) {
  const lower = name.trim().toLowerCase();
  const snap = await db.collection("teams").get();
  const taken = snap.docs.some(
    (d) =>
      d.id !== exceptDocId &&
      (d.data().name || "").trim().toLowerCase() === lower &&
      (d.data().isIndividual === true) === isIndividual
  );
  if (taken) throw new HttpError(409, message || "A team with that name already exists");
}
