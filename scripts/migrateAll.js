/**
 * Legacy Postgres → Firestore migration. Wipe-and-reload, safe to re-run.
 *
 *   npm run migrate:all -- --dry-run                     preflight only, no writes
 *   npm run migrate:all -- --project <firebase-project>  wipe + load + verify
 *   npm run migrate:all -- --dump data_dump/2026-09-27 --project <id>   (default dump: data_dump/2025-11)
 *   npm run migrate:all -- --project <id> --final        cutover run; locks the script afterwards
 *
 * Until cutover the old site is the only source of truth, so every run deletes
 * the collections below and rebuilds them from the dump. Anything created on the
 * new site in the meantime (test purchases, manual admin entries) is discarded.
 * After a --final run the script refuses to run again.
 *
 * See docs/DATA_MIGRATION_PLAN.md.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readJsonLines } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const LBS_PER_KG = 2.20462;
const WIPE_COLLECTIONS = ["offsets", "teams", "teamMembers", "regions", "users", "cartItems"];
const LOCK_DOC = "adminSettings/migration";

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const DRY_RUN = flag("dry-run");
const FINAL = flag("final");
const dumpDir = path.resolve(__dirname, "..", option("dump") || "data_dump/2025-11");

// ─── Load dump ────────────────────────────────────────────────────────────────
const load = (name) => {
  const file = path.join(dumpDir, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing dump file: ${file}`);
  return readJsonLines(file, { strict: true });
};

const dump = {
  offsets: load("offsets"),
  teams: load("teams"),
  individuals: load("individuals"),
  teamMembers: load("team_members"),
  regions: load("regions"),
  users: load("users"),
};

const teamIds = new Set(dump.teams.map((t) => t.id));
const individualIds = new Set(dump.individuals.map((i) => i.id));
const regionNames = new Map(dump.regions.map((r) => [r.id, r.name]));
const purchased = dump.offsets.filter((o) => o.purchased);

// The app looks accounts up by exact email match, so store one spelling.
const normalizeEmail = (e) => (e || "").trim().toLowerCase();

/** Teams and individuals share the `teams` collection; legacy ids overlap, so the doc ID carries the type. */
const teamDocIdFor = (o) => {
  if (o.team_id > 0 && teamIds.has(o.team_id)) return `team-${o.team_id}`;
  if (o.individual_id > 0 && individualIds.has(o.individual_id)) return `ind-${o.individual_id}`;
  return null;
};

const dollarsByAccount = new Map();
for (const o of purchased) {
  const key = teamDocIdFor(o);
  if (key) dollarsByAccount.set(key, (dollarsByAccount.get(key) || 0) + (o.cost || 0));
}

// ─── Transforms ───────────────────────────────────────────────────────────────
// Offsets carry both the legacy field names and the ones the new app writes
// (userEmail, carbonPounds, status, timestamp) so every reader sees one shape.
function offsetDoc(o) {
  const pounds = parseFloat(o.pounds) || 0;
  const email = normalizeEmail(o.email);
  const created = o.created_at ? new Date(o.created_at) : null;
  return {
    legacyId: o.id,
    source: "legacy",
    // The old site already sent these gifts to Little Green Light.
    syncedToLGL: true,
    userId: o.user_id || null,
    userEmail: email,
    email,
    name: o.name || "",
    title: o.title || "",
    description: o.title || "",
    pounds,
    carbonPounds: pounds,
    carbonKg: pounds / LBS_PER_KG,
    cost: parseFloat(o.cost) || 0,
    purchased: true,
    status: "completed",
    zipcode: o.zipcode ? parseInt(o.zipcode) : null,
    zipCode: o.zipcode ? String(o.zipcode) : null,
    timestamp: created,
    createdAt: created,
    updatedAt: o.updated_at ? new Date(o.updated_at) : created,
    teamId: o.team_id || 0,
    individualId: o.individual_id || 0,
    teamDocId: teamDocIdFor(o),
    regionId: o.region_id || null,
    checkoutSessionId: o.checkout_session_id || null,
    offsetType: o.offset_type || null,
    offsetInterval: o.offset_interval || null,
  };
}

// pounds/count are the old site's stored totals, imported as-is (they don't
// equal the sum of offsets for most teams, and the leaderboard should match the old site).
const accountDoc = (a, isIndividual) => ({
  legacyId: a.id,
  source: "legacy",
  name: a.name,
  ...(isIndividual ? { email: normalizeEmail(a.email) || null } : {}),
  membersCount: isIndividual ? 1 : a.members ?? 0,
  pounds: a.pounds ?? 0,
  count: a.count ?? 0,
  totalDollars: dollarsByAccount.get(`${isIndividual ? "ind" : "team"}-${a.id}`) || 0,
  regionId: a.region_id ?? null,
  regionName: a.region_id ? regionNames.get(a.region_id) ?? null : null,
  isIndividual,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});

const teamNames = new Map(dump.teams.map((t) => [t.id, t.name]));
const memberDoc = (m) => ({
  legacyId: m.id,
  source: "legacy",
  email: normalizeEmail(m.email),
  name: m.name || "",
  teamId: m.team_id,
  teamDocId: `team-${m.team_id}`,
  teamName: teamNames.get(m.team_id) || "",
  offsets: m.offsets ?? 0,
  founder: m.founder ?? false,
  createdAt: m.created_at ? new Date(m.created_at) : FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});

const regionDoc = (r) => ({
  legacyId: r.id,
  name: r.name,
  counties: r.counties ?? null,
  zipcodes: r.zipcodes ?? [],
  createdAt: FieldValue.serverTimestamp(),
});

// Explicit allow-list: the users dump also holds password hashes, tokens and IPs.
const userDoc = (u) => ({
  id: u.id,
  source: "legacy",
  createdAt: u.created_at ? new Date(u.created_at) : new Date(),
  email: normalizeEmail(u.email),
  firstName: u.first_name || "",
  name: u.name || "",
  zipcode: u.zipcode ? parseInt(u.zipcode) : null,
});

const plan = [
  { collection: "regions", docs: dump.regions.map((r) => [String(r.id), regionDoc(r)]) },
  {
    collection: "teams",
    docs: [
      ...dump.teams.map((t) => [`team-${t.id}`, accountDoc(t, false)]),
      ...dump.individuals.map((i) => [`ind-${i.id}`, accountDoc(i, true)]),
    ],
  },
  {
    collection: "teamMembers",
    docs: dump.teamMembers.filter((m) => teamIds.has(m.team_id)).map((m) => [String(m.id), memberDoc(m)]),
  },
  { collection: "users", docs: dump.users.map((u) => [String(u.id), userDoc(u)]) },
  { collection: "offsets", docs: purchased.map((o) => [String(o.id), offsetDoc(o)]) },
];

// ─── Preflight ────────────────────────────────────────────────────────────────
const sum = (rows, f) => rows.reduce((s, r) => s + (parseFloat(f(r)) || 0), 0);
const expected = {
  counts: Object.fromEntries(plan.map((p) => [p.collection, p.docs.length])),
  pounds: sum(purchased, (o) => o.pounds),
  dollars: sum(purchased, (o) => o.cost),
};

function preflight() {
  const dates = dump.offsets.map((o) => o.created_at).filter(Boolean).sort();
  console.log(`Dump: ${dumpDir}`);
  console.log(`  offsets       ${dump.offsets.length} rows, ${purchased.length} purchased (unpurchased are skipped)`);
  console.log(`                ${dates[0]?.slice(0, 10)} → ${dates.at(-1)?.slice(0, 10)}`);
  console.log(`  teams         ${dump.teams.length}`);
  console.log(`  individuals   ${dump.individuals.length}`);
  console.log(`  team members  ${dump.teamMembers.length}`);
  console.log(`  regions       ${dump.regions.length}`);
  console.log(`  users         ${dump.users.length}`);
  console.log(`  purchased totals: ${Math.round(expected.pounds).toLocaleString()} lbs, $${Math.round(expected.dollars).toLocaleString()}`);

  const warnings = [
    [purchased.filter((o) => o.individual_id > 0 && !individualIds.has(o.individual_id)).length, "offsets reference an individual that no longer exists (imported without an account link)"],
    [purchased.filter((o) => o.team_id > 0 && !teamIds.has(o.team_id)).length, "offsets reference a team that no longer exists (imported without an account link)"],
    [purchased.filter((o) => o.team_id > 0 && o.individual_id > 0).length, "offsets have both a team and an individual (linked to the team)"],
    [dump.teamMembers.filter((m) => !teamIds.has(m.team_id)).length, "team members belong to a missing team (skipped)"],
    [purchased.filter((o) => !o.created_at).length, "offsets have no created_at"],
  ].filter(([n]) => n > 0);
  warnings.forEach(([n, msg]) => console.log(`  ⚠️  ${n} ${msg}`));

  const ids = plan.flatMap((p) => p.docs.map(([id]) => `${p.collection}/${id}`));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate ids in dump");
}

// ─── Firestore steps ──────────────────────────────────────────────────────────
async function wipe(db) {
  for (const name of WIPE_COLLECTIONS) {
    const before = (await db.collection(name).count().get()).data().count;
    await db.recursiveDelete(db.collection(name));
    console.log(`  wiped ${name} (${before} docs)`);
  }
}

async function loadAll(db) {
  for (const { collection, docs } of plan) {
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach(([id, data]) => batch.set(db.collection(collection).doc(id), data));
      await batch.commit();
    }
    console.log(`  loaded ${collection} (${docs.length})`);
  }
}

async function verify(db) {
  const problems = [];
  const actual = { counts: {} };
  for (const { collection } of plan) {
    const n = (await db.collection(collection).count().get()).data().count;
    actual.counts[collection] = n;
    if (n !== expected.counts[collection]) problems.push(`${collection}: expected ${expected.counts[collection]}, found ${n}`);
  }
  const offsets = (await db.collection("offsets").get()).docs.map((d) => d.data());
  actual.pounds = sum(offsets, (o) => o.carbonPounds);
  actual.dollars = sum(offsets, (o) => o.cost);
  if (Math.abs(actual.pounds - expected.pounds) > 1) problems.push(`pounds: expected ${expected.pounds}, found ${actual.pounds}`);
  if (Math.abs(actual.dollars - expected.dollars) > 0.01) problems.push(`dollars: expected ${expected.dollars}, found ${actual.dollars}`);
  const unsafe = offsets.filter((o) => o.source !== "legacy" || o.syncedToLGL !== true).length;
  if (unsafe) problems.push(`${unsafe} offsets are missing the legacy/LGL markers`);
  return { actual, problems };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  preflight();
  if (DRY_RUN) {
    console.log("\nDry run — nothing written. Would load:", expected.counts);
    return;
  }

  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) throw new Error("Missing scripts/serviceAccountKey.json");
  const serviceAccount = require(keyPath);
  if (option("project") !== serviceAccount.project_id) {
    throw new Error(
      `This deletes and rebuilds ${WIPE_COLLECTIONS.join(", ")} in "${serviceAccount.project_id}".\n` +
        `Re-run with --project ${serviceAccount.project_id} to confirm (or --dry-run to preview).`
    );
  }
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const lock = await db.doc(LOCK_DOC).get();
  if (lock.exists && lock.data().locked) {
    throw new Error(`Migration is locked (final cutover ran ${lock.data().lastRunAt?.toDate?.().toISOString()}). The new site is live; this script would destroy real data.`);
  }

  console.log(`\nWiping ${serviceAccount.project_id}…`);
  await wipe(db);
  console.log("Loading…");
  await loadAll(db);
  console.log("Verifying…");
  const { actual, problems } = await verify(db);

  const report = { project: serviceAccount.project_id, dump: dumpDir, ranAt: new Date().toISOString(), final: FINAL, expected, actual, problems };
  const reportDir = path.join(__dirname, "../data_dump/reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `migration-${report.ranAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (problems.length) {
    problems.forEach((p) => console.error(`  ❌ ${p}`));
    throw new Error(`Verification failed — see ${reportPath}`);
  }
  await db.doc(LOCK_DOC).set({ locked: FINAL, lastRunAt: FieldValue.serverTimestamp(), counts: actual.counts });
  console.log(`✅ Verified. Report: ${reportPath}`);
  if (FINAL) console.log("🔒 Final run — migration is now locked.");
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
