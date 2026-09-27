/**
 * Public read-only API — mounted at /api/public (see server.js).
 *
 * Built for fingerlakesclimatefund.org (and any other site the fund wants to
 * put these numbers on): headline stat counters, the Carbon Race leaderboards
 * with region filtering, and the list of regions to build a filter control
 * from.
 *
 * Ground rules for anything added here:
 *   • No authentication, so no personal data. Donor emails, zip codes and
 *     individual transactions never leave this router — only the aggregate
 *     totals and the team/individual names already shown on the leaderboard.
 *   • Every response is served from an in-memory cache (PUBLIC_API_CACHE_SECONDS,
 *     default 300s) so a busy WordPress page cannot translate into Firestore
 *     reads. Admin writes call ledger.invalidate(), which clears it too.
 *   • Responses are additive-only: consumers are outside this repo, so fields
 *     get added, never renamed or removed.
 *
 * See docs/PUBLIC_API.md for the consumer-facing documentation.
 */
import express from "express";
import { num, cleanStr, slugify, summarize, readPublicStatsSettings, PUBLIC_STATS_DOC } from "./lib/ledger.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

const round2 = (n) => Math.round(n * 100) / 100;

/** Comma-separated query value → trimmed, de-duplicated list. */
const list = (v) =>
  [...new Set(String(v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))];

export function createPublicRouter({ db, ledger, regionNames = {}, cacheSeconds = 300 }) {
  const router = express.Router();

  // Region lookup built once from regions.json: id → { id, name, slug }.
  const REGIONS = Object.entries(regionNames)
    .map(([id, name]) => ({ id: Number(id), name, slug: slugify(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const regionById = new Map(REGIONS.map((r) => [r.id, r]));
  const regionBySlug = new Map(REGIONS.map((r) => [r.slug, r]));
  const regionByName = new Map(REGIONS.map((r) => [r.name.toLowerCase(), r]));

  /** Accepts an id ("34"), a slug ("st-lawrence") or a name ("Tompkins"). */
  const resolveRegion = (token) =>
    regionById.get(Number(token)) || regionBySlug.get(token) || regionByName.get(token) || null;

  // ─── Response cache ───────────────────────────────────────────────────────
  // Keyed by the normalised query, so ?region=34 and ?region=tompkins share
  // nothing but each stays hot. Cleared whenever the ledger is invalidated.
  // ?search= puts caller-controlled text in the key, so the map is bounded and
  // evicts oldest-first rather than growing with every distinct query.
  const MAX_ENTRIES = 500;
  const cache = new Map();
  const ttlMs = Math.max(0, cacheSeconds) * 1000;
  ledger.onInvalidate(() => cache.clear());

  async function cached(key, build) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = await build();
    cache.delete(key); // re-insert so Map iteration order is oldest-first
    cache.set(key, { at: Date.now(), value });
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
    return value;
  }

  /** When the response under `key` was built — what `updatedAt` reports. */
  const builtAt = (key) => new Date(cache.get(key)?.at ?? Date.now()).toISOString();

  /** Public responses are cacheable by browsers and any CDN in front of them. */
  const send = (res, body) => {
    res.set("Cache-Control", `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`);
    res.json(body);
  };

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(`Public API error [${req.method} ${req.originalUrl}]:`, err);
      res.status(status).json({ error: status >= 500 ? "Unable to load this data right now" : err.message });
    }
  };

  // ─── Shared loaders ───────────────────────────────────────────────────────

  /**
   * Leaderboard rows come from the stored totals on each `teams` doc, not from
   * summing the ledger: the legacy site's team totals were maintained
   * separately and do not equal the sum of its offsets, and the leaderboard
   * has to keep matching the old site. Admins can reconcile a team from the
   * admin UI (Carbon Race teams → Recalculate).
   */
  async function loadEntries() {
    const snap = await db.collection("teams").get();
    return snap.docs
      .map((doc) => {
        const d = doc.data();
        const regionId = d.regionId ?? null;
        const region = regionId != null ? regionById.get(Number(regionId)) : null;
        return {
          id: doc.id,
          name: cleanStr(d.name, 200),
          type: d.isIndividual === true ? "individual" : "team",
          pounds: round2(num(d.pounds)),
          offsets: Math.round(num(d.count)),
          dollars: round2(num(d.totalDollars)),
          members: Math.round(num(d.membersCount)),
          image: d.image || "",
          region: region
            ? { id: region.id, name: region.name, slug: region.slug }
            : regionId != null
            ? { id: Number(regionId), name: d.regionName || null, slug: slugify(d.regionName) || null }
            : null,
        };
      })
      .filter((e) => e.name);
  }

  async function loadSettings() {
    const snap = await db.collection("adminSettings").doc(PUBLIC_STATS_DOC).get();
    return readPublicStatsSettings(snap.exists ? snap.data() : {});
  }

  // Every endpoint needs these, so they get their own cache entries rather
  // than being reloaded once per query shape. Callers treat them as read-only.
  const entries = () => cached("entries", loadEntries);
  const settings = () => cached("settings", loadSettings);

  // ═══ Index ════════════════════════════════════════════════════════════════
  router.get("/", (_req, res) =>
    send(res, {
      name: "Finger Lakes Climate Fund public API",
      version: 1,
      docs: "https://github.com/sustainabletompkins/carbon-calculator/blob/master/docs/PUBLIC_API.md",
      cacheSeconds,
      endpoints: {
        stats: "/api/public/stats",
        leaderboard: "/api/public/leaderboard?type=teams&region=tompkins&sort=pounds&limit=10",
        regions: "/api/public/regions",
      },
    })
  );

  // ═══ Headline stats ═══════════════════════════════════════════════════════
  // The counters on the fund's home page: lbs CO₂ offset, gallons of gas
  // avoided, dollars raised, grants awarded.
  router.get(
    "/stats",
    wrap(async (req, res) => {
      const regionTokens = list(req.query.region);
      const regions = regionTokens.map(resolveRegion);
      if (regions.some((r) => !r)) throw Object.assign(new Error("Unknown region"), { status: 400 });
      const regionIds = new Set(regions.map((r) => r.id));

      const key = `stats:${[...regionIds].sort().join(",")}`;
      const body = await cached(key, async () => {
        const [rows, config, accounts] = await Promise.all([ledger.get(), settings(), entries()]);

        const scoped = regionIds.size ? rows.filter((r) => regionIds.has(Number(r.regionId))) : rows;
        const offsets = summarize(scoped.filter((r) => r.kind === "offset"));
        const donations = summarize(scoped.filter((r) => r.kind === "donation"));

        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
        const ytd = summarize(scoped.filter((r) => r.kind === "offset" && r.date && r.date >= yearStart));
        const ytdDonations = summarize(scoped.filter((r) => r.kind === "donation" && r.date && r.date >= yearStart));

        // The baseline (and the grant count) describe the fund as a whole, so
        // they only apply to an unfiltered request.
        const wholeFund = regionIds.size === 0;
        const base = wholeFund ? config.baseline : { pounds: 0, dollars: 0, offsets: 0 };

        // Donations are credited pounds at the offset price, so they count here
        // even though their dollars are reported separately.
        const pounds = Math.max(0, offsets.pounds + donations.pounds + base.pounds);
        const dollars = Math.max(0, offsets.dollars + base.dollars);
        const count = Math.max(0, offsets.count + base.offsets);
        const scopedEntries = regionIds.size
          ? accounts.filter((e) => e.region && regionIds.has(e.region.id))
          : accounts;

        return {
          // Headline counters — these four match the fund's home page.
          poundsOffset: Math.round(pounds),
          gallonsGasAvoided: Math.floor(pounds / config.lbsPerGallon),
          dollarsRaised: round2(dollars),
          grantsAwarded: wholeFund ? config.grantsAwarded : null,

          // Supporting numbers.
          offsetCount: count,
          donationsRaised: round2(donations.dollars),
          donationCount: donations.count,
          totalRaised: round2(dollars + donations.dollars),
          teamCount: scopedEntries.filter((e) => e.type === "team").length,
          individualCount: scopedEntries.filter((e) => e.type === "individual").length,
          thisYear: {
            year: new Date().getFullYear(),
            poundsOffset: Math.round(ytd.pounds + ytdDonations.pounds),
            dollarsRaised: round2(ytd.dollars),
            offsetCount: ytd.count,
          },

          region: regionIds.size
            ? regions.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
            : null,
          lbsPerGallon: config.lbsPerGallon,
        };
      });

      send(res, { ...body, updatedAt: builtAt(key) });
    })
  );

  // ═══ Leaderboard ══════════════════════════════════════════════════════════
  // ?type=teams|individuals|all  ?region=<id|slug|name,…>  ?sort=pounds|offsets|dollars|name
  // ?limit=  ?offset=  ?search=
  router.get(
    "/leaderboard",
    wrap(async (req, res) => {
      const type = ["teams", "individuals", "all"].includes(req.query.type) ? req.query.type : "teams";
      const sort = ["pounds", "offsets", "dollars", "name"].includes(req.query.sort) ? req.query.sort : "pounds";
      const limit = Math.min(Math.max(parseInt(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const search = cleanStr(req.query.search, 100).toLowerCase();
      const includeEmpty = req.query.includeEmpty === "1" || req.query.includeEmpty === "true";

      const regionTokens = list(req.query.region);
      const regions = regionTokens.map(resolveRegion);
      if (regions.some((r) => !r)) throw Object.assign(new Error("Unknown region"), { status: 400 });
      const regionIds = new Set(regions.map((r) => r.id));

      const key = `lb:${type}:${sort}:${[...regionIds].sort().join(",")}:${search}:${includeEmpty}`;
      const [{ lbsPerGallon }, ranked] = await Promise.all([
        settings(),
        cached(key, async () => {
          const all = await entries();
          const filtered = all.filter((e) => {
            if (type === "teams" && e.type !== "team") return false;
            if (type === "individuals" && e.type !== "individual") return false;
            if (regionIds.size && !(e.region && regionIds.has(e.region.id))) return false;
            // Accounts that signed up but never offset would pad the board.
            if (!includeEmpty && e.pounds <= 0 && e.offsets <= 0) return false;
            if (search && !`${e.name} ${e.region?.name || ""}`.toLowerCase().includes(search)) return false;
            return true;
          });

          filtered.sort((a, b) =>
            sort === "name"
              ? a.name.localeCompare(b.name)
              : b[sort] - a[sort] || b.pounds - a.pounds || a.name.localeCompare(b.name)
          );
          // Rank is over the filtered set, so it survives paging.
          return filtered.map((e, i) => ({ rank: i + 1, ...e }));
        }),
      ]);

      const page = ranked.slice(offset, offset + limit);
      send(res, {
        entries: page.map((e) => ({
          ...e,
          gallonsGasAvoided: Math.floor(e.pounds / lbsPerGallon),
        })),
        total: ranked.length,
        limit,
        offset,
        totals: {
          pounds: round2(ranked.reduce((s, e) => s + e.pounds, 0)),
          offsets: ranked.reduce((s, e) => s + e.offsets, 0),
          dollars: round2(ranked.reduce((s, e) => s + e.dollars, 0)),
        },
        filters: {
          type,
          sort,
          search: search || null,
          region: regions.map((r) => ({ id: r.id, name: r.name, slug: r.slug })),
        },
        updatedAt: builtAt(key),
      });
    })
  );

  // ═══ Regions ══════════════════════════════════════════════════════════════
  // For building the leaderboard's region filter. Defaults to the regions that
  // actually have entries; ?all=1 returns the full county list.
  router.get(
    "/regions",
    wrap(async (req, res) => {
      const all = req.query.all === "1" || req.query.all === "true";
      const body = await cached(`regions:${all}`, async () => {
        const stats = new Map();
        (await entries()).forEach((e) => {
          if (!e.region) return;
          const s = stats.get(e.region.id) || { teams: 0, individuals: 0, pounds: 0, offsets: 0 };
          s[e.type === "team" ? "teams" : "individuals"] += 1;
          s.pounds += e.pounds;
          s.offsets += e.offsets;
          stats.set(e.region.id, s);
        });

        return REGIONS.map((r) => {
          const s = stats.get(r.id) || { teams: 0, individuals: 0, pounds: 0, offsets: 0 };
          return { ...r, teams: s.teams, individuals: s.individuals, pounds: round2(s.pounds), offsets: s.offsets };
        }).filter((r) => all || r.teams + r.individuals > 0);
      });

      send(res, body);
    })
  );

  return router;
}
