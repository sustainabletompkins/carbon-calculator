/**
 * Shared offsets ledger.
 *
 * The `offsets` collection is the single source of truth for offsets AND
 * straight donations, and it holds two document shapes (legacy import +
 * website). `normalizeOffset()` flattens both into one row shape, and
 * `createLedger()` caches the normalised, date-sorted list.
 *
 * Both routers share one ledger instance (see server.js), so an admin edit
 * that calls `invalidate()` is reflected in the public API on the next read.
 */

export { LBS_PER_KG } from "./offsetRates.js";

/** Firestore Timestamp | ISO string | Date → Date (or null). */
export const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

export const num = (v, fallback = 0) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export const cleanStr = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Error carrying the HTTP status the route handler should respond with. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const summarize = (rows) => ({
  count: rows.length,
  pounds: rows.reduce((s, r) => s + r.pounds, 0),
  dollars: rows.reduce((s, r) => s + r.cost, 0),
});

/** "St Lawrence" → "st-lawrence". Stable public identifier for a region. */
export const slugify = (name) =>
  String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function normalizeOffset(doc, userNames, teams) {
  const d = doc.data();
  const isLegacy = !d.source && ("individualId" in d || "checkoutSessionId" in d);
  const source = d.source || (isLegacy ? "legacy" : "website");
  const kind = d.offsetType === "donation" ? "donation" : "offset";
  const email = d.userEmail || d.email || "";
  const date = toDate(d.timestamp) || toDate(d.createdAt);
  const team =
    (d.teamDocId && teams.byDoc.get(d.teamDocId)) ||
    (d.teamId ? teams.byLegacy.get(d.teamId) : null) ||
    null;

  return {
    id: doc.id,
    kind,
    source,
    date: date ? date.toISOString() : null,
    name: d.name || userNames.get(email.toLowerCase()) || "",
    email,
    pounds: num(d.carbonPounds ?? d.pounds),
    cost: num(d.cost),
    offsetType: d.offsetType || null,
    description: d.description || d.title || "",
    note: d.note || "",
    paymentMethod: d.paymentMethod || (source === "website" ? "credit_card" : null),
    teamId: d.teamId || null,
    teamDocId: team?.docId || null,
    teamName: team?.name || null,
    regionId: d.regionId ?? team?.regionId ?? null,
    transactionId: d.stripePaymentIntentId || d.transactionId || d.checkoutSessionId || null,
    syncedToLGL: d.syncedToLGL === true && d.lglSkipped !== true,
    enteredBy: d.enteredBy || null,
    zipCode: d.zipCode || d.zipcode || null,
  };
}

/**
 * ~3k docs with two date formats makes Firestore-side sorting impractical, so
 * the ledger is loaded, normalised and sorted in memory with a short TTL.
 * Website purchases write straight to Firestore, hence the TTL rather than
 * invalidate-only.
 */
export function createLedger({ db, ttlMs = 30_000 }) {
  let cache = { at: 0, rows: null };
  const listeners = [];

  async function loadTeams() {
    const snap = await db.collection("teams").get();
    const byLegacy = new Map();
    const byDoc = new Map();
    snap.docs.forEach((doc) => {
      const t = { docId: doc.id, ...doc.data() };
      byDoc.set(doc.id, t);
      // Teams win over individuals if legacy ids ever collide.
      if (!byLegacy.has(t.legacyId) || !t.isIndividual) byLegacy.set(t.legacyId, t);
    });
    return { byLegacy, byDoc };
  }

  async function get(force = false) {
    if (!force && cache.rows && Date.now() - cache.at < ttlMs) return cache.rows;
    const [offsetSnap, userSnap, teams] = await Promise.all([
      db.collection("offsets").get(),
      db.collection("users").get(),
      loadTeams(),
    ]);
    const userNames = new Map();
    userSnap.docs.forEach((u) => {
      const d = u.data();
      if (d.email && d.name) userNames.set(String(d.email).toLowerCase(), d.name);
    });
    const rows = offsetSnap.docs
      .map((doc) => normalizeOffset(doc, userNames, teams))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    cache = { at: Date.now(), rows };
    return rows;
  }

  return {
    get,
    loadTeams,
    /** Called by the admin API after any write. */
    invalidate: () => {
      cache = { at: 0, rows: null };
      listeners.forEach((fn) => fn());
    },
    /** Lets a router drop its own derived caches when the ledger changes. */
    onInvalidate: (fn) => listeners.push(fn),
    /** When the cached rows were last loaded, for `updatedAt` in API output. */
    loadedAt: () => (cache.rows ? new Date(cache.at).toISOString() : null),
  };
}

/** Admin-editable knobs behind the public stat counters (adminSettings/publicStats). */
export const PUBLIC_STATS_DOC = "publicStats";

export const DEFAULT_PUBLIC_STATS = {
  // Grants the fund has awarded. No collection tracks these, so it is a number
  // an admin keeps current (the old site kept it in its `stats` table).
  grantsAwarded: 0,
  // Added to the live ledger totals. At cutover this absorbs the difference
  // between the old site's published totals and what the imported ledger sums
  // to, so the public numbers carry over and then grow from real activity.
  baseline: { pounds: 0, dollars: 0, offsets: 0 },
  // EPA: burning one gallon of gasoline releases ~20 lbs of CO₂.
  lbsPerGallon: 20,
};

export function readPublicStatsSettings(data = {}) {
  const b = data.baseline || {};
  return {
    grantsAwarded: Math.max(0, Math.round(num(data.grantsAwarded))),
    baseline: {
      pounds: num(b.pounds),
      dollars: num(b.dollars),
      offsets: Math.round(num(b.offsets)),
    },
    lbsPerGallon: num(data.lbsPerGallon, 0) > 0 ? num(data.lbsPerGallon) : DEFAULT_PUBLIC_STATS.lbsPerGallon,
    updatedAt: toDate(data.updatedAt)?.toISOString() || null,
    updatedBy: data.updatedBy || null,
  };
}
