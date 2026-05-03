import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "module";
import dotenv from "dotenv";
import { readJsonLines } from "./utils.js";

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
const regionsPath = path.join(__dirname, "../regions.json");
const regions = readJsonLines(regionsPath);
console.log(`Loaded ${regions.length} regions from regions.json`);

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seedRegions() {
  // Regions fit in a single batch (< 500)
  const batch = db.batch();
  const regionsCollection = db.collection("regions");

  for (const region of regions) {
    // Use the legacyId as the document ID for easy lookups
    const docRef = regionsCollection.doc(String(region.id));
    batch.set(docRef, {
      legacyId: region.id,
      name: region.name,
      counties: region.counties ?? null,
      zipcodes: region.zipcodes ?? [],
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`✅ Seeded ${regions.length} regions into Firestore (collection: "regions").`);
}

// ─── Guard ────────────────────────────────────────────────────────────────────
async function checkExisting() {
  const snap = await db.collection("regions").limit(1).get();
  return !snap.empty;
}

async function confirm(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(q, (a) => { rl.close(); resolve(a.trim().toLowerCase()); })
  );
}

async function main() {
  if (await checkExisting()) {
    const ans = await confirm(
      "⚠️  The 'regions' collection already has documents. Re-seeding will overwrite them.\n   Continue? (yes/no): "
    );
    if (ans !== "yes") { console.log("Aborted."); process.exit(0); }
  }
  await seedRegions();
  console.log("\n🎉 Done!");
}

main().catch((err) => { console.error(err); process.exit(1); });
