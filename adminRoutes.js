/**
 * Admin API — mounted at /api/admin behind requireAdmin (see server.js).
 *
 * All admin reads/writes go through here using the Firebase Admin SDK, so the
 * browser never needs elevated Firestore permissions.
 *
 * Collections touched:
 *   offsets       – the single ledger for offsets AND straight donations.
 *                   Two document shapes coexist (legacy import + website);
 *                   normalizeOffset() (lib/ledger.js) flattens both for the UI.
 *   teams         – Carbon Race teams and individual accounts (isIndividual).
 *   teamMembers   – membership rows keyed by the team's numeric legacyId.
 *   adminSettings – site configuration, incl. the public stat counters served
 *                   to fingerlakesclimatefund.org (see publicRoutes.js).
 */
import express from "express";
import admin from "firebase-admin";
import {
  LBS_PER_KG,
  HttpError,
  toDate,
  num,
  cleanStr,
  summarize,
  readPublicStatsSettings,
  PUBLIC_STATS_DOC,
} from "./lib/ledger.js";
import { allocateLegacyId, assertNameAvailable } from "./lib/teams.js";
import { poundsForDollars } from "./lib/offsetRates.js";

const PAYMENT_METHODS = ["check", "cash", "credit_card", "ach", "stock", "in_kind", "other"];

// ─── helpers ────────────────────────────────────────────────────────────────

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`Admin API error [${req.method} ${req.path}]:`, err);
    res.status(status).json({ error: err.message || "Unexpected error" });
  }
};

function csvCell(v) {
  if (v == null) return "";
  let s = String(v);
  // Neutralise spreadsheet formula injection from user-entered text
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function createAdminRouter({ db, ledger, regionNames = {} }) {
  const router = express.Router();
  const { FieldValue, Timestamp } = admin.firestore;

  // The normalised offsets ledger is shared with the public API (lib/ledger.js),
  // so invalidating here also refreshes what fingerlakesclimatefund.org sees.
  const getLedger = ledger.get;
  const invalidate = ledger.invalidate;
  const loadTeamsByLegacyId = ledger.loadTeams;

  // Columns the ledger table can be sorted by. getLedger() returns
  // newest-first, which stays the default.
  const SORT_FIELDS = {
    date: (r) => r.date || "",
    name: (r) => (r.name || r.email || "").toLowerCase(),
    description: (r) => (r.description || "").toLowerCase(),
    source: (r) => r.source,
    pounds: (r) => r.pounds,
    cost: (r) => r.cost,
  };

  function sortLedger(rows, sort, dir) {
    const pick = SORT_FIELDS[sort];
    if (!pick) return rows;
    const sign = dir === "asc" ? 1 : -1;
    const blank = (v) => v === "" || v === null || v === undefined;
    return [...rows].sort((a, b) => {
      const x = pick(a);
      const y = pick(b);
      // Keep blanks at the bottom whichever way the column is sorted.
      if (blank(x) !== blank(y)) return blank(x) ? 1 : -1;
      const cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y));
      // Fall back to the newest-first default so equal values keep a stable order.
      return cmp !== 0 ? cmp * sign : (b.date || "").localeCompare(a.date || "");
    });
  }

  function filterLedger(rows, q) {
    const kind = q.kind === "offset" || q.kind === "donation" ? q.kind : null;
    const source = ["website", "manual", "legacy"].includes(q.source) ? q.source : null;
    const search = cleanStr(q.search, 100).toLowerCase();
    const from = q.from ? new Date(`${q.from}T00:00:00`) : null;
    const to = q.to ? new Date(`${q.to}T23:59:59.999`) : null;
    const teamDocId = cleanStr(q.teamDocId, 100) || null;

    return rows.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (source && r.source !== source) return false;
      if (teamDocId && r.teamDocId !== teamDocId) return false;
      if (from && (!r.date || new Date(r.date) < from)) return false;
      if (to && (!r.date || new Date(r.date) > to)) return false;
      if (search) {
        const hay = `${r.name} ${r.email} ${r.description} ${r.teamName || ""} ${r.note} ${r.transactionId || ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  // ─── Team total adjustments (used inside transactions) ────────────────────
  function applyTeamDelta(tx, teamDocId, { pounds, dollars, count }) {
    if (!teamDocId) return;
    tx.update(db.collection("teams").doc(teamDocId), {
      pounds: FieldValue.increment(pounds),
      totalDollars: FieldValue.increment(dollars),
      count: FieldValue.increment(count),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async function resolveTeam(teamDocId) {
    if (!teamDocId) return null;
    const snap = await db.collection("teams").doc(teamDocId).get();
    if (!snap.exists) throw new HttpError(400, "Selected team no longer exists");
    return { docId: snap.id, ...snap.data() };
  }

  /** Which team doc (if any) is an offsets doc currently credited to? */
  async function currentTeamDocId(d) {
    if (d.teamDocId) return d.teamDocId;
    if (!d.teamId) return null;
    const teams = await loadTeamsByLegacyId();
    return teams.byLegacy.get(d.teamId)?.docId || null;
  }

  // ─── Validation for manual entries / edits ────────────────────────────────
  function parseEntry(body, { partial = false } = {}) {
    const out = {};
    const has = (k) => body[k] !== undefined;

    if (!partial || has("kind")) {
      if (!["offset", "donation"].includes(body.kind)) throw new HttpError(400, "Type must be offset or donation");
      out.kind = body.kind;
    }
    if (!partial || has("cost")) {
      const cost = num(body.cost, NaN);
      if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) throw new HttpError(400, "Enter a valid dollar amount");
      out.cost = Math.round(cost * 100) / 100;
    }
    if (!partial || has("pounds")) {
      const pounds = num(body.pounds, 0);
      if (pounds < 0 || pounds > 1e10) throw new HttpError(400, "Enter a valid number of pounds");
      out.pounds = pounds;
    }
    if (!partial || has("date")) {
      // Noon avoids the date shifting a day across time zones.
      const d = body.date ? new Date(`${String(body.date).slice(0, 10)}T12:00:00`) : new Date();
      if (isNaN(d)) throw new HttpError(400, "Enter a valid date");
      if (d > new Date(Date.now() + 86_400_000)) throw new HttpError(400, "Date cannot be in the future");
      out.date = d;
    }
    if (!partial || has("email")) {
      const email = cleanStr(body.email, 254).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
      out.email = email;
    }
    if (!partial || has("name")) out.name = cleanStr(body.name, 200);
    if (!partial || has("zipCode")) out.zipCode = cleanStr(body.zipCode, 10);
    if (!partial || has("description")) out.description = cleanStr(body.description, 500);
    if (!partial || has("note")) out.note = cleanStr(body.note, 1000);
    if (!partial || has("paymentMethod")) {
      out.paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : "other";
    }
    if (!partial || has("teamDocId")) out.teamDocId = cleanStr(body.teamDocId, 100) || null;
    if (has("syncToLGL")) out.syncToLGL = body.syncToLGL === true;
    return out;
  }

  // ═══ Overview ═════════════════════════════════════════════════════════════
  router.get("/me", (req, res) => {
    res.json({ uid: req.user.uid, email: req.user.email, admin: true });
  });

  router.get(
    "/stats",
    wrap(async (_req, res) => {
      const rows = await getLedger();
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const thisYear = rows.filter((r) => r.date && r.date >= yearStart);
      const of = (list, kind) => summarize(list.filter((r) => r.kind === kind));
      const [teamsCount, usersCount] = await Promise.all([
        db.collection("teams").count().get(),
        db.collection("users").count().get(),
      ]);
      res.json({
        allTime: { offsets: of(rows, "offset"), donations: of(rows, "donation") },
        thisYear: { offsets: of(thisYear, "offset"), donations: of(thisYear, "donation") },
        bySource: {
          website: summarize(rows.filter((r) => r.source === "website")),
          manual: summarize(rows.filter((r) => r.source === "manual")),
          legacy: summarize(rows.filter((r) => r.source === "legacy")),
        },
        teams: teamsCount.data().count,
        users: usersCount.data().count,
        recent: rows.slice(0, 8),
      });
    })
  );

  router.get("/regions", (_req, res) => {
    const regions = Object.entries(regionNames)
      .map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(regions);
  });

  // ═══ Ledger: offsets + donations ══════════════════════════════════════════
  router.get(
    "/transactions",
    wrap(async (req, res) => {
      const all = await getLedger(req.query.refresh === "1");
      const filtered = sortLedger(
        filterLedger(all, req.query),
        req.query.sort,
        req.query.dir === "asc" ? "asc" : "desc"
      );

      if (req.query.format === "csv") {
        const cols = ["date", "kind", "source", "name", "email", "pounds", "cost", "paymentMethod", "teamName", "description", "note", "transactionId", "enteredBy", "id"];
        const lines = [cols.join(",")].concat(
          filtered.map((r) =>
            cols.map((c) => csvCell(c === "date" && r.date ? r.date.slice(0, 10) : c === "pounds" ? Math.round(r.pounds * 100) / 100 : r[c])).join(",")
          )
        );
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="flcf-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.send(lines.join("\n"));
      }

      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 50, 1), 200);
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      res.json({
        rows: filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: filtered.length,
        summary: summarize(filtered),
      });
    })
  );

  router.post(
    "/transactions",
    wrap(async (req, res) => {
      const e = parseEntry(req.body);
      if (e.kind === "offset" && !(e.pounds > 0)) throw new HttpError(400, "Offsets need a pounds of CO₂ value greater than zero");
      if (e.kind === "donation") {
        if (!(e.cost > 0)) throw new HttpError(400, "Donations need an amount greater than zero");
        e.pounds = poundsForDollars(e.cost); // credited at the offset price, as the old site did
        e.teamDocId = null; // straight donations don't count toward Carbon Race totals
      }
      const team = await resolveTeam(e.teamDocId);

      const record = {
        userEmail: e.email || null,
        name: e.name,
        zipCode: e.zipCode || null,
        offsetType: e.kind === "donation" ? "donation" : "manual",
        carbonPounds: e.pounds,
        carbonKg: e.pounds / LBS_PER_KG,
        cost: e.cost,
        description: e.description || (e.kind === "donation" ? "Direct Donation" : `Manual offset: ${Math.round(e.pounds).toLocaleString()} lbs CO2`),
        note: e.note,
        paymentMethod: e.paymentMethod,
        status: "completed",
        source: "manual",
        enteredBy: req.user.email || req.user.uid,
        timestamp: Timestamp.fromDate(e.date),
        createdAt: new Date().toISOString(),
        teamId: team?.legacyId ?? null,
        teamDocId: team?.docId ?? null,
      };
      // The syncOffsetToLittleGreenLight function fires on every new offsets
      // doc and skips ones already flagged as synced. Most manual entries
      // (cheques etc.) are already in LGL, so syncing is opt-in.
      if (!e.syncToLGL) {
        record.syncedToLGL = true;
        record.lglSkipped = true;
      }

      const ref = db.collection("offsets").doc();
      await db.runTransaction(async (tx) => {
        tx.set(ref, record);
        if (team) applyTeamDelta(tx, team.docId, { pounds: e.pounds, dollars: e.cost, count: 1 });
      });
      invalidate();
      res.status(201).json({ id: ref.id });
    })
  );

  router.patch(
    "/transactions/:id",
    wrap(async (req, res) => {
      const e = parseEntry(req.body, { partial: true });
      const ref = db.collection("offsets").doc(req.params.id);
      const before = await ref.get();
      if (!before.exists) throw new HttpError(404, "Record not found");
      const old = before.data();
      const oldKind = old.offsetType === "donation" ? "donation" : "offset";
      if (e.kind && e.kind !== oldKind) throw new HttpError(400, "Type cannot be changed. Delete and re-add instead.");

      const oldPounds = num(old.carbonPounds ?? old.pounds);
      const oldCost = num(old.cost);
      const oldTeamDocId = await currentTeamDocId(old);

      const newCost = e.cost ?? oldCost;
      const newPounds = oldKind === "donation" ? poundsForDollars(newCost) : e.pounds ?? oldPounds;
      const newTeamDocId = oldKind === "donation" ? null : e.teamDocId !== undefined ? e.teamDocId : oldTeamDocId;
      if (oldKind === "offset" && !(newPounds > 0)) throw new HttpError(400, "Offsets need a pounds value greater than zero");
      const newTeam = await resolveTeam(newTeamDocId);

      // Write back using whichever field names the document already uses, so
      // legacy-shaped records stay internally consistent.
      const isLegacyShape = "pounds" in old && !("carbonPounds" in old);
      const update = { updatedAt: FieldValue.serverTimestamp(), lastEditedBy: req.user.email || req.user.uid };
      if (oldKind === "donation" ? e.cost !== undefined : e.pounds !== undefined) {
        if (isLegacyShape) update.pounds = newPounds;
        else Object.assign(update, { carbonPounds: newPounds, carbonKg: newPounds / LBS_PER_KG });
      }
      if (e.cost !== undefined) update.cost = newCost;
      if (e.name !== undefined) update.name = e.name;
      if (e.email !== undefined) update[isLegacyShape ? "email" : "userEmail"] = e.email || null;
      if (e.zipCode !== undefined) update[isLegacyShape ? "zipcode" : "zipCode"] = e.zipCode || null;
      if (e.description !== undefined) update[isLegacyShape ? "title" : "description"] = e.description;
      if (e.note !== undefined) update.note = e.note;
      if (e.paymentMethod !== undefined) update.paymentMethod = e.paymentMethod;
      if (e.date !== undefined) {
        if (isLegacyShape) update.createdAt = Timestamp.fromDate(e.date);
        else update.timestamp = Timestamp.fromDate(e.date);
      }
      update.teamId = newTeam?.legacyId ?? (isLegacyShape ? 0 : null);
      update.teamDocId = newTeam?.docId ?? null;

      await db.runTransaction(async (tx) => {
        const teamChanged = oldTeamDocId !== (newTeam?.docId ?? null);
        // Firestore requires every read before the first write.
        const oldTeamExists =
          teamChanged && oldTeamDocId
            ? (await tx.get(db.collection("teams").doc(oldTeamDocId))).exists
            : false;
        tx.update(ref, update);
        if (teamChanged) {
          if (oldTeamExists) {
            applyTeamDelta(tx, oldTeamDocId, { pounds: -oldPounds, dollars: -oldCost, count: -1 });
          }
          if (newTeam) applyTeamDelta(tx, newTeam.docId, { pounds: newPounds, dollars: newCost, count: 1 });
        } else if (newTeam && (newPounds !== oldPounds || newCost !== oldCost)) {
          applyTeamDelta(tx, newTeam.docId, { pounds: newPounds - oldPounds, dollars: newCost - oldCost, count: 0 });
        }
      });
      invalidate();
      res.json({ ok: true });
    })
  );

  router.delete(
    "/transactions/:id",
    wrap(async (req, res) => {
      const ref = db.collection("offsets").doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, "Record not found");
      const old = snap.data();
      const isDonation = old.offsetType === "donation";
      const teamDocId = isDonation ? null : await currentTeamDocId(old);

      await db.runTransaction(async (tx) => {
        const teamExists = teamDocId && (await tx.get(db.collection("teams").doc(teamDocId))).exists;
        tx.delete(ref);
        if (teamExists) {
          applyTeamDelta(tx, teamDocId, {
            pounds: -num(old.carbonPounds ?? old.pounds),
            dollars: -num(old.cost),
            count: -1,
          });
        }
      });
      console.log(`Admin ${req.user.email} deleted offsets/${req.params.id}`);
      invalidate();
      res.json({ ok: true });
    })
  );

  // ═══ Carbon Race teams ════════════════════════════════════════════════════
  const teamOut = (doc) => {
    const d = doc.data();
    return {
      docId: doc.id,
      legacyId: d.legacyId ?? null,
      name: d.name || "",
      email: d.email || "",
      isIndividual: d.isIndividual === true,
      pounds: num(d.pounds),
      count: num(d.count),
      totalDollars: num(d.totalDollars),
      membersCount: num(d.membersCount),
      regionId: d.regionId ?? null,
      regionName: regionNames[d.regionId] ?? d.regionName ?? null,
      image: d.image || "",
      updatedAt: toDate(d.updatedAt)?.toISOString() || null,
    };
  };

  function parseTeam(body, { partial = false } = {}) {
    const out = {};
    const has = (k) => body[k] !== undefined;
    if (!partial || has("name")) {
      out.name = cleanStr(body.name, 200);
      if (!out.name) throw new HttpError(400, "Team name is required");
    }
    if (has("email")) out.email = cleanStr(body.email, 254).toLowerCase() || null;
    if (has("image")) out.image = cleanStr(body.image, 1000);
    if (!partial || has("isIndividual")) out.isIndividual = body.isIndividual === true;
    if (!partial || has("regionId")) {
      const id = body.regionId === null || body.regionId === "" || body.regionId === undefined ? null : Number(body.regionId);
      if (id !== null && !regionNames[id]) throw new HttpError(400, "Unknown region");
      out.regionId = id;
      out.regionName = id !== null ? regionNames[id] : null;
    }
    for (const k of ["pounds", "count", "totalDollars"]) {
      if (has(k)) {
        const v = num(body[k], NaN);
        if (!Number.isFinite(v) || v < 0) throw new HttpError(400, `Enter a valid value for ${k}`);
        out[k] = k === "count" ? Math.round(v) : v;
      }
    }
    return out;
  }

  router.get(
    "/teams",
    wrap(async (_req, res) => {
      const snap = await db.collection("teams").get();
      res.json(snap.docs.map(teamOut).sort((a, b) => b.pounds - a.pounds));
    })
  );

  router.post(
    "/teams",
    wrap(async (req, res) => {
      const t = parseTeam(req.body);
      await assertNameAvailable(db, t.name, t.isIndividual);
      // legacyId is what memberships and offsets reference; it has to stay
      // unique across teams AND individuals, and visitors create accounts
      // through /api/race at the same time — hence the shared allocator.
      const nextLegacyId = await allocateLegacyId(db);
      const ref = await db.collection("teams").add({
        legacyId: nextLegacyId,
        name: t.name,
        email: t.email ?? null,
        image: t.image ?? "",
        isIndividual: t.isIndividual,
        membersCount: t.isIndividual ? 1 : 0,
        pounds: t.pounds ?? 0,
        count: t.count ?? 0,
        totalDollars: t.totalDollars ?? 0,
        regionId: t.regionId,
        regionName: t.regionName,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: req.user.email || req.user.uid,
      });
      invalidate();
      res.status(201).json({ docId: ref.id, legacyId: nextLegacyId });
    })
  );

  router.patch(
    "/teams/:docId",
    wrap(async (req, res) => {
      const t = parseTeam(req.body, { partial: true });
      delete t.isIndividual; // changing account type would orphan memberships
      const ref = db.collection("teams").doc(req.params.docId);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, "Team not found");
      const old = snap.data();
      if (t.name && t.name !== old.name) {
        await assertNameAvailable(db, t.name, old.isIndividual === true, undefined, req.params.docId);
      }

      await ref.update({ ...t, updatedAt: FieldValue.serverTimestamp(), lastEditedBy: req.user.email || req.user.uid });

      // teamName is denormalised onto membership rows
      if (t.name && t.name !== old.name && !old.isIndividual) {
        const members = await db.collection("teamMembers").where("teamId", "==", old.legacyId).get();
        for (let i = 0; i < members.docs.length; i += 400) {
          const batch = db.batch();
          members.docs.slice(i, i + 400).forEach((m) => batch.update(m.ref, { teamName: t.name, updatedAt: FieldValue.serverTimestamp() }));
          await batch.commit();
        }
      }
      invalidate();
      res.json({ ok: true });
    })
  );

  router.delete(
    "/teams/:docId",
    wrap(async (req, res) => {
      const ref = db.collection("teams").doc(req.params.docId);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, "Team not found");
      const team = snap.data();
      const rows = (await getLedger(true)).filter((r) => r.teamDocId === req.params.docId);
      if (rows.length > 0) {
        throw new HttpError(409, `This team has ${rows.length} offsets credited to it. Reassign or remove those first.`);
      }
      if (!team.isIndividual) {
        const members = await db.collection("teamMembers").where("teamId", "==", team.legacyId).get();
        const batch = db.batch();
        members.docs.forEach((m) => batch.delete(m.ref));
        batch.delete(ref);
        await batch.commit();
      } else {
        await ref.delete();
      }
      console.log(`Admin ${req.user.email} deleted team ${team.name} (${req.params.docId})`);
      invalidate();
      res.json({ ok: true });
    })
  );

  // Compare stored totals with what the ledger says. Legacy totals were
  // imported separately from the legacy offsets, so they may legitimately
  // differ — this only reports, and POST applies on the admin's say-so.
  async function computeTeamTotals(docId) {
    const rows = (await getLedger(true)).filter((r) => r.teamDocId === docId && r.kind === "offset");
    const purchases = new Set(rows.map((r) => r.transactionId || r.id));
    return { pounds: rows.reduce((s, r) => s + r.pounds, 0), totalDollars: rows.reduce((s, r) => s + r.cost, 0), count: purchases.size, records: rows.length };
  }

  router.get(
    "/teams/:docId/recalculate",
    wrap(async (req, res) => {
      const snap = await db.collection("teams").doc(req.params.docId).get();
      if (!snap.exists) throw new HttpError(404, "Team not found");
      res.json({ stored: teamOut(snap), computed: await computeTeamTotals(req.params.docId) });
    })
  );

  router.post(
    "/teams/:docId/recalculate",
    wrap(async (req, res) => {
      const ref = db.collection("teams").doc(req.params.docId);
      if (!(await ref.get()).exists) throw new HttpError(404, "Team not found");
      const { pounds, totalDollars, count } = await computeTeamTotals(req.params.docId);
      await ref.update({ pounds, totalDollars, count, updatedAt: FieldValue.serverTimestamp(), lastEditedBy: req.user.email || req.user.uid });
      res.json({ pounds, totalDollars, count });
    })
  );

  // ─── Team members ─────────────────────────────────────────────────────────
  async function getTeamOr404(docId) {
    const snap = await db.collection("teams").doc(docId).get();
    if (!snap.exists) throw new HttpError(404, "Team not found");
    return { ref: snap.ref, ...snap.data() };
  }

  router.get(
    "/teams/:docId/members",
    wrap(async (req, res) => {
      const team = await getTeamOr404(req.params.docId);
      const snap = await db.collection("teamMembers").where("teamId", "==", team.legacyId).get();
      res.json(
        snap.docs
          .map((m) => ({ id: m.id, name: m.data().name || "", email: m.data().email || "", founder: m.data().founder === true, offsets: num(m.data().offsets) }))
          .sort((a, b) => Number(b.founder) - Number(a.founder) || a.name.localeCompare(b.name))
      );
    })
  );

  router.post(
    "/teams/:docId/members",
    wrap(async (req, res) => {
      const team = await getTeamOr404(req.params.docId);
      if (team.isIndividual) throw new HttpError(400, "Individual accounts do not have members");
      const email = cleanStr(req.body.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
      const dup = await db.collection("teamMembers").where("teamId", "==", team.legacyId).where("email", "==", email).limit(1).get();
      if (!dup.empty) throw new HttpError(409, "That email is already on this team");

      const memberRef = db.collection("teamMembers").doc();
      const batch = db.batch();
      batch.set(memberRef, {
        email,
        name: cleanStr(req.body.name, 200),
        teamId: team.legacyId,
        // Attribution resolves the team by doc ID; without this the checkout
        // flow has only legacyId to go on.
        teamDocId: team.ref.id,
        teamName: team.name,
        offsets: 0,
        founder: req.body.founder === true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(team.ref, { membersCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      res.status(201).json({ id: memberRef.id });
    })
  );

  router.delete(
    "/teams/:docId/members/:memberId",
    wrap(async (req, res) => {
      const team = await getTeamOr404(req.params.docId);
      const memberRef = db.collection("teamMembers").doc(req.params.memberId);
      const member = await memberRef.get();
      if (!member.exists || member.data().teamId !== team.legacyId) throw new HttpError(404, "Member not found on this team");
      const batch = db.batch();
      batch.delete(memberRef);
      batch.update(team.ref, { membersCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      res.json({ ok: true });
    })
  );

  // ═══ Public site stats ════════════════════════════════════════════════════
  // Feeds the counters the public API serves to fingerlakesclimatefund.org
  // (see publicRoutes.js and docs/PUBLIC_API.md).
  //
  // `computed` is what this site's ledger adds up to. `baseline` is added on
  // top so the published numbers can carry over totals the old site counted
  // but the imported ledger does not, and `grantsAwarded` has no collection
  // behind it at all — it is a number an admin keeps current.
  const publicStatsRef = () => db.collection("adminSettings").doc(PUBLIC_STATS_DOC);

  async function publicStatsPayload() {
    const [snap, rows] = await Promise.all([publicStatsRef().get(), getLedger()]);
    const settings = readPublicStatsSettings(snap.exists ? snap.data() : {});
    const computed = summarize((rows || []).filter((r) => r.kind === "offset"));
    const pounds = Math.max(0, computed.pounds + settings.baseline.pounds);
    return {
      settings,
      computed: { pounds: computed.pounds, dollars: computed.dollars, offsets: computed.count },
      published: {
        poundsOffset: Math.round(pounds),
        gallonsGasAvoided: Math.floor(pounds / settings.lbsPerGallon),
        dollarsRaised: Math.round((computed.dollars + settings.baseline.dollars) * 100) / 100,
        offsetCount: Math.max(0, computed.count + settings.baseline.offsets),
        grantsAwarded: settings.grantsAwarded,
      },
    };
  }

  router.get("/public-stats", wrap(async (_req, res) => res.json(await publicStatsPayload())));

  router.put(
    "/public-stats",
    wrap(async (req, res) => {
      const b = req.body?.baseline || {};
      const grants = num(req.body?.grantsAwarded, NaN);
      const lbsPerGallon = num(req.body?.lbsPerGallon, NaN);
      if (!Number.isFinite(grants) || grants < 0 || grants > 1e6) throw new HttpError(400, "Enter a valid number of grants awarded");
      if (!Number.isFinite(lbsPerGallon) || lbsPerGallon <= 0 || lbsPerGallon > 1000) throw new HttpError(400, "Enter a valid lbs of CO₂ per gallon of gas");
      const baseline = {};
      for (const [k, max] of [["pounds", 1e12], ["dollars", 1e10], ["offsets", 1e7]]) {
        const v = num(b[k], NaN);
        // A negative baseline is legitimate: it subtracts double-counted history.
        if (!Number.isFinite(v) || Math.abs(v) > max) throw new HttpError(400, `Enter a valid baseline for ${k}`);
        baseline[k] = k === "offsets" ? Math.round(v) : v;
      }

      await publicStatsRef().set(
        {
          grantsAwarded: Math.round(grants),
          lbsPerGallon,
          baseline,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: req.user.email || req.user.uid,
        },
        { merge: true }
      );
      invalidate(); // drops the public API's cached responses too
      res.json(await publicStatsPayload());
    })
  );

  return router;
}
