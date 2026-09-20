/**
 * Carbon Race sign-up API — mounted at /api/race (see server.js).
 *
 * Unauthenticated, like the rest of the visitor-facing flow: email is the
 * identity key across carts, offsets and team membership, and this app has no
 * passwords. Until now the only way onto the leaderboard was for an admin to
 * create the account by hand, so a visitor could offset carbon with nowhere to
 * put the credit. These endpoints let them look up what their email is already
 * attached to, join a team, start one, or register as an individual.
 *
 * The writes happen here rather than in the browser because they have to be
 * constrained: a unique legacyId, no duplicate names, membersCount kept in
 * step with the membership rows. What a visitor can never do through this
 * router is set an account's pounds/count/totalDollars — only a verified
 * purchase moves those (POST /api/attribute-offset in server.js).
 *
 * Privacy: /me answers for whatever email is typed in, which is the same
 * assumption the cart and offset lookups already make. It returns only the
 * account names that are public on the leaderboard anyway — never the other
 * members of a team, and never anyone's offsets.
 */
import express from "express";
import admin from "firebase-admin";
import { HttpError, cleanStr, num } from "./lib/ledger.js";
import { allocateLegacyId, assertNameAvailable, parseEmail } from "./lib/teams.js";

const TEAM_INDEX_TTL_MS = 30_000;

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`Race API error [${req.method} ${req.path}]:`, err);
    res.status(status).json({ error: status >= 500 ? "Something went wrong — please try again." : err.message });
  }
};

/** Behind App Engine's load balancer req.ip is the proxy, so prefer XFF. */
const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "unknown";

/**
 * Sliding-window limiter for the write endpoints. Creating accounts is
 * unauthenticated, so without this one script could fill the leaderboard.
 */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(clientIp(req)) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: "Too many attempts — please wait a minute and try again." });
    }
    recent.push(now);
    hits.set(clientIp(req), recent);
    // Bound the map: drop anyone whose window has fully expired.
    if (hits.size > 5000) {
      for (const [ip, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(ip);
      }
    }
    return next();
  };
}

export function createRaceRouter({ db, ledger, regionNames = {} }) {
  const router = express.Router();
  const { FieldValue } = admin.firestore;

  // ─── Team index ───────────────────────────────────────────────────────────
  // Every endpoint here needs the teams collection. Short TTL, and cleared
  // whenever anything invalidates the ledger (including our own writes).
  let index = { at: 0, value: null };
  ledger.onInvalidate(() => {
    index = { at: 0, value: null };
  });
  async function teamIndex() {
    if (index.value && Date.now() - index.at < TEAM_INDEX_TTL_MS) return index.value;
    const value = await ledger.loadTeams();
    index = { at: Date.now(), value };
    return value;
  }

  /** The public face of a team or individual account. */
  const accountOut = (t) => ({
    docId: t.docId,
    name: t.name || "",
    isIndividual: t.isIndividual === true,
    regionId: t.regionId ?? null,
    regionName: regionNames[t.regionId] ?? t.regionName ?? null,
    pounds: num(t.pounds),
    count: num(t.count),
    membersCount: num(t.membersCount),
  });

  function parseRegionId(value) {
    if (value === null || value === undefined || value === "") return null;
    const id = Number(value);
    if (!regionNames[id]) throw new HttpError(400, "Unknown region");
    return id;
  }

  function parseName(value, { label = "name", max = 200 } = {}) {
    const name = cleanStr(value, max);
    if (!name) throw new HttpError(400, `Enter a ${label}`);
    if (name.length < 2) throw new HttpError(400, `That ${label} is too short`);
    return name;
  }

  // Writes are cheap to attempt and expensive to clean up, so they are capped
  // per IP; the read endpoints are left alone so the page stays responsive.
  const limitWrites = rateLimit({ windowMs: 60_000, max: 8 });

  // ═══ Regions ══════════════════════════════════════════════════════════════
  // Served from regions.json, the same list parseRegionId() validates
  // against, so the dropdown can never offer a region the server rejects.
  // (/api/regions reads the Firestore collection instead and can drift.)
  router.get("/regions", (_req, res) => {
    res.json(
      Object.entries(regionNames)
        .map(([id, name]) => ({ id: Number(id), name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  });

  // ═══ What is this email already signed up for? ════════════════════════════
  router.get(
    "/me",
    wrap(async (req, res) => {
      const email = parseEmail(req.query.email);
      const [teams, membershipSnap] = await Promise.all([
        teamIndex(),
        db.collection("teamMembers").where("email", "==", email).get(),
      ]);

      const individualDoc = [...teams.byDoc.values()].find(
        (t) => t.isIndividual === true && String(t.email || "").toLowerCase() === email
      );

      // Memberships added through the admin UI carry only the legacy numeric
      // id, so fall back to that. One whose team has since been deleted is
      // dropped rather than shown as something the visitor can't act on.
      const memberships = membershipSnap.docs
        .map((doc) => {
          const m = doc.data();
          const team = (m.teamDocId && teams.byDoc.get(m.teamDocId)) || teams.byLegacy.get(m.teamId);
          return team && !team.isIndividual
            ? { ...accountOut(team), memberId: doc.id, founder: m.founder === true }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.founder) - Number(a.founder) || a.name.localeCompare(b.name));

      res.json({
        email,
        individual: individualDoc ? accountOut(individualDoc) : null,
        teams: memberships,
      });
    })
  );

  // ═══ Teams a visitor can join ═════════════════════════════════════════════
  router.get(
    "/teams",
    wrap(async (_req, res) => {
      const teams = await teamIndex();
      res.json(
        [...teams.byDoc.values()]
          .filter((t) => t.isIndividual !== true && (t.name || "").trim())
          .map(accountOut)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    })
  );

  // ═══ Start a new team ═════════════════════════════════════════════════════
  // The creator becomes its founding member, so their purchases can be
  // credited to it straight away.
  router.post(
    "/teams",
    limitWrites,
    wrap(async (req, res) => {
      const email = parseEmail(req.body?.email);
      const name = parseName(req.body?.name, { label: "team name" });
      const regionId = parseRegionId(req.body?.regionId);
      const memberName = cleanStr(req.body?.memberName, 200);

      await assertNameAvailable(db, name, false, "A team with that name already exists — try another.");

      const legacyId = await allocateLegacyId(db);
      const teamRef = db.collection("teams").doc();
      const memberRef = db.collection("teamMembers").doc();
      const now = FieldValue.serverTimestamp();

      const batch = db.batch();
      batch.set(teamRef, {
        legacyId,
        name,
        email: null, // only individual accounts key off an email
        image: "",
        isIndividual: false,
        membersCount: 1,
        pounds: 0,
        count: 0,
        totalDollars: 0,
        regionId,
        regionName: regionId !== null ? regionNames[regionId] : null,
        createdAt: now,
        updatedAt: now,
        createdBy: email,
        createdVia: "signup",
      });
      batch.set(memberRef, {
        email,
        name: memberName,
        teamId: legacyId,
        // Attribution at checkout resolves the team by doc id.
        teamDocId: teamRef.id,
        teamName: name,
        offsets: 0,
        founder: true,
        createdAt: now,
        updatedAt: now,
        createdVia: "signup",
      });
      await batch.commit();

      ledger.invalidate();
      console.log(`Carbon Race: ${email} created team "${name}" (${teamRef.id})`);
      res.status(201).json({ docId: teamRef.id, legacyId, memberId: memberRef.id });
    })
  );

  // ═══ Register as an individual ════════════════════════════════════════════
  router.post(
    "/individuals",
    limitWrites,
    wrap(async (req, res) => {
      const email = parseEmail(req.body?.email);
      const name = parseName(req.body?.name, { label: "display name" });
      const regionId = parseRegionId(req.body?.regionId);

      // One individual account per email: checkout looks it up by email, so a
      // second one would be unreachable.
      const teams = await teamIndex();
      const existing = [...teams.byDoc.values()].find(
        (t) => t.isIndividual === true && String(t.email || "").toLowerCase() === email
      );
      if (existing) {
        throw new HttpError(409, `${email} already has an individual account ("${existing.name}").`);
      }

      await assertNameAvailable(
        db,
        name,
        true,
        "Someone is already on the leaderboard under that name — try adding an initial."
      );

      const legacyId = await allocateLegacyId(db);
      const now = FieldValue.serverTimestamp();
      const ref = await db.collection("teams").add({
        legacyId,
        name,
        email,
        image: "",
        isIndividual: true,
        membersCount: 1,
        pounds: 0,
        count: 0,
        totalDollars: 0,
        regionId,
        regionName: regionId !== null ? regionNames[regionId] : null,
        createdAt: now,
        updatedAt: now,
        createdBy: email,
        createdVia: "signup",
      });

      ledger.invalidate();
      console.log(`Carbon Race: ${email} registered as individual "${name}" (${ref.id})`);
      res.status(201).json({ docId: ref.id, legacyId });
    })
  );

  // ═══ Join an existing team ════════════════════════════════════════════════
  router.post(
    "/teams/:docId/members",
    limitWrites,
    wrap(async (req, res) => {
      const email = parseEmail(req.body?.email);
      const memberName = cleanStr(req.body?.name, 200);

      const teamRef = db.collection("teams").doc(req.params.docId);
      const snap = await teamRef.get();
      if (!snap.exists) throw new HttpError(404, "That team no longer exists");
      const team = snap.data();
      if (team.isIndividual === true) throw new HttpError(400, "Individual accounts don't have members");

      const dup = await db
        .collection("teamMembers")
        .where("teamId", "==", team.legacyId)
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!dup.empty) throw new HttpError(409, `You're already on ${team.name}.`);

      const memberRef = db.collection("teamMembers").doc();
      const now = FieldValue.serverTimestamp();
      const batch = db.batch();
      batch.set(memberRef, {
        email,
        name: memberName,
        teamId: team.legacyId,
        teamDocId: teamRef.id,
        teamName: team.name,
        offsets: 0,
        founder: false,
        createdAt: now,
        updatedAt: now,
        createdVia: "signup",
      });
      batch.update(teamRef, { membersCount: FieldValue.increment(1), updatedAt: now });
      await batch.commit();

      ledger.invalidate();
      console.log(`Carbon Race: ${email} joined team "${team.name}" (${teamRef.id})`);
      res.status(201).json({ memberId: memberRef.id, docId: teamRef.id, name: team.name });
    })
  );

  return router;
}
