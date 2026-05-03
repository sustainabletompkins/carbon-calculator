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

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Missing scripts/serviceAccountKey.json");
  process.exit(1);
}

initializeApp({ credential: cert(require(serviceAccountPath)) });
const db = getFirestore();

// ─── Load data ────────────────────────────────────────────────────────────────
const REGION_NAMES = loadRegionMap(); // Map<id, name>
const individualsPath = path.join(__dirname, "../individuals.json");
const individuals = readJsonLines(individualsPath);

console.log(`Loaded ${individuals.length} individuals from individuals.json`);

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seedIndividuals() {
  const BATCH_SIZE = 400;
  const teamsCollection = db.collection("teams");

  for (let i = 0; i < individuals.length; i += BATCH_SIZE) {
    const chunk = individuals.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const ind of chunk) {
      const docRef = teamsCollection.doc();
      batch.set(docRef, {
        legacyId: ind.id,
        name: ind.name,
        email: ind.email || null,
        membersCount: 1,
        pounds: ind.pounds ?? 0,
        count: ind.count ?? 0,
        totalDollars: 0,
        regionId: ind.region_id ?? null,
        regionName: ind.region_id ? (REGION_NAMES.get(ind.region_id) ?? null) : null,
        isIndividual: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(
      `  Wrote individuals ${i + 1}–${Math.min(i + BATCH_SIZE, individuals.length)}`
    );
  }

  console.log(`✅ Seeded ${individuals.length} individual accounts into Firestore.`);
}

// ─── Guard ────────────────────────────────────────────────────────────────────
async function checkExisting() {
  const snap = await db.collection("teams").where("isIndividual", "==", true).limit(1).get();
  return !snap.empty;
}

async function confirm(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

async function main() {
  if (await checkExisting()) {
    const ans = await confirm(
      "⚠️  Individual accounts already exist in Firestore. Re-seeding will create duplicates.\n   Continue? (yes/no): "
    );
    if (ans !== "yes") { console.log("Aborted."); process.exit(0); }
  }
  await seedIndividuals();
  console.log("\n🎉 Done!");
}

main().catch((err) => { console.error(err); process.exit(1); });
