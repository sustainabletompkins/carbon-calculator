import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
import dotenv from "dotenv";

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

/**
 * Transform a single user record from the JSON format
 */
function transformUser(record) {
  return {
    id: record.id || null,
    createdAt: record.created_at ? new Date(record.created_at) : new Date(),
    email: record.email || "",
    firstName: record.first_name || "",
    sessionId: record.session_id || null,
    name: record.name || "",
    zipcode: record.zipcode ? parseInt(record.zipcode) : null,
  };
}

/**
 * Read and parse JSONL file (one JSON object per line)
 */
function readUsersFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content
    .trim()
    .split("\n")
    .filter((line) => line.trim());

  return lines
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.error(`Error parsing line ${index + 1}: ${error.message}`);
        return null;
      }
    })
    .filter((record) => record !== null);
}

/**
 * Upload users to Firestore in batches
 */
async function uploadUsersToFirestore(users) {
  const batchSize = 500;
  let uploadedCount = 0;
  let errorCount = 0;

  console.log(`Starting migration of ${users.length} users...`);

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = db.batch();
    const batchUsers = users.slice(i, i + batchSize);

    batchUsers.forEach((user) => {
      try {
        const transformedUser = transformUser(user);
        const docRef = db.collection("users").doc(String(user.id));
        batch.set(docRef, transformedUser);
        uploadedCount++;
      } catch (error) {
        console.error(`Error transforming user ${user.id}: ${error.message}`);
        errorCount++;
      }
    });

    try {
      await batch.commit();
      console.log(
        `✓ Batch ${Math.floor(i / batchSize) + 1} committed (${batchUsers.length} users)`
      );
    } catch (error) {
      console.error(`Error committing batch: ${error.message}`);
      errorCount += batchUsers.length;
      uploadedCount -= batchUsers.length;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Total processed: ${users.length}`);
  console.log(`Successfully uploaded: ${uploadedCount}`);
  console.log(`Errors: ${errorCount}`);
}

/**
 * Main function
 */
async function main() {
  const usersFilePath = path.join(__dirname, "../users.json");

  if (!fs.existsSync(usersFilePath)) {
    console.error(`❌ File not found: ${usersFilePath}`);
    console.log(`\nTo generate this file, run:`);
    console.log(
      `psql -d flcf -c "COPY (SELECT row_to_json(t) FROM users t) TO STDOUT" > users.json`
    );
    process.exit(1);
  }

  console.log(`📂 Reading users from: ${usersFilePath}`);
  const users = readUsersFromFile(usersFilePath);

  if (users.length === 0) {
    console.error(`❌ No users found in file`);
    process.exit(1);
  }

  console.log(`✓ Loaded ${users.length} users from file\n`);

  await uploadUsersToFirestore(users);

  console.log(`\n✅ Migration completed successfully!`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`❌ Migration failed:`, error);
  process.exit(1);
});
