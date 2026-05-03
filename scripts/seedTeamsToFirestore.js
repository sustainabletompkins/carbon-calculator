import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "module";
import dotenv from "dotenv";
import { readJsonLines, loadRegionMap } from "./utils.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load service account key
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Missing scripts/serviceAccountKey.json");
  console.log(
    "   Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key"
  );
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Load source JSON files ───────────────────────────────────────────────────

const REGION_NAMES = loadRegionMap(); // Map<id, name>

const teamsPath = path.join(__dirname, "../teams.json");
const teamMembersPath = path.join(__dirname, "../team_members.json");

const teamsData = readJsonLines(teamsPath);
const teamMembersData = readJsonLines(teamMembersPath);

console.log(
  `Loaded ${teamsData.length} teams and ${teamMembersData.length} team members from JSON files.`
);

// Build a quick lookup: legacyId → team name (for denormalizing into teamMembers)
const teamNameById = {};
teamsData.forEach((t) => {
  teamNameById[t.id] = t.name;
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedTeams() {
  const batch = db.batch();
  const teamsCollection = db.collection("teams");

  for (const team of teamsData) {
    const docRef = teamsCollection.doc(); // auto-id
    batch.set(docRef, {
      legacyId: team.id,
      name: team.name,
      membersCount: team.members ?? 0,
      pounds: team.pounds ?? 0,
      count: team.count ?? 0,
      totalDollars: 0,
      regionId: team.region_id ?? null,
      regionName: team.region_id ? (REGION_NAMES.get(team.region_id) ?? null) : null,
      isIndividual: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`✅ Seeded ${teamsData.length} teams into Firestore.`);
}

async function seedTeamMembers() {
  // Firestore batches are limited to 500 writes
  const BATCH_SIZE = 400;
  const teamMembersCollection = db.collection("teamMembers");

  for (let i = 0; i < teamMembersData.length; i += BATCH_SIZE) {
    const chunk = teamMembersData.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const member of chunk) {
      const docRef = teamMembersCollection.doc();
      batch.set(docRef, {
        legacyId: member.id,
        email: member.email,
        name: member.name || "",
        teamId: member.team_id,
        teamName: teamNameById[member.team_id] || "",
        offsets: member.offsets ?? 0,
        founder: member.founder ?? false,
        createdAt: member.created_at
          ? new Date(member.created_at)
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(
      `  Wrote team members ${i + 1}–${Math.min(i + BATCH_SIZE, teamMembersData.length)}`
    );
  }

  console.log(
    `✅ Seeded ${teamMembersData.length} team members into Firestore.`
  );
}

// ─── Guard against accidental double-runs ─────────────────────────────────────

async function checkExisting() {
  const existing = await db.collection("teams").limit(1).get();
  return !existing.empty;
}

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const alreadySeeded = await checkExisting();
  if (alreadySeeded) {
    const answer = await confirm(
      "⚠️  The 'teams' collection already has documents. Re-seeding will create duplicates.\n   Continue anyway? (yes/no): "
    );
    if (answer !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  await seedTeams();
  await seedTeamMembers();
  console.log("\n🎉 Done! Teams and team members are now in Firestore.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
