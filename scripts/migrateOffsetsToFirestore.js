import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  writeBatch,
  doc,
} from "firebase/firestore";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Transform a single offset record from the JSON format
 * Handles null values, type conversions, and data validation
 */
function transformOffset(record) {
  return {
    id: record.id || null,
    userId: record.user_id || null,
    title: record.title || "",
    pounds: parseFloat(record.pounds) || 0,
    cost: parseFloat(record.cost) || 0,
    purchased: Boolean(record.purchased),
    name: record.name || "",
    zipcode: record.zipcode ? parseInt(record.zipcode) : null,
    createdAt: record.created_at ? new Date(record.created_at) : new Date(),
    updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
    email: record.email || "",
    teamId: record.team_id || 0,
    individualId: record.individual_id || 0,
    regionId: record.region_id || null,
    checkoutSessionId: record.checkout_session_id || null,
    offsetType: record.offset_type || null,
    offsetInterval: record.offset_interval || null,
  };
}

/**
 * Read and parse JSONL file (one JSON object per line)
 */
function readOffsetsFromFile(filePath) {
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
 * Upload offsets to Firestore in batches
 */
async function uploadOffsetsToFirestore(offsets) {
  const db_instance = getFirestore(app);
  const offsetsCollection = collection(db_instance, "offsets");

  const batchSize = 500; // Firestore batch limit
  let uploadedCount = 0;
  let errorCount = 0;

  console.log(`Starting migration of ${offsets.length} offsets...`);

  for (let i = 0; i < offsets.length; i += batchSize) {
    const batch = writeBatch(db_instance);
    const batchOffsets = offsets.slice(i, i + batchSize);

    batchOffsets.forEach((offset) => {
      try {
        const transformedOffset = transformOffset(offset);
        const docRef = doc(offsetsCollection, String(offset.id)); // Use ID as document ID
        batch.set(docRef, transformedOffset);
        uploadedCount++;
      } catch (error) {
        console.error(
          `Error transforming offset ${offset.id}: ${error.message}`
        );
        errorCount++;
      }
    });

    try {
      await batch.commit();
      console.log(
        `✓ Uploaded batch ${
          Math.floor(i / batchSize) + 1
        } (${uploadedCount} total records)`
      );
    } catch (error) {
      console.error(`Error committing batch: ${error.message}`);
      errorCount += batchOffsets.length;
    }
  }

  return { uploadedCount, errorCount };
}

/**
 * Main migration function
 */
async function main() {
  try {
    const offsetsFilePath = path.join(__dirname, "../offsets.json");

    console.log(`Reading offsets from: ${offsetsFilePath}`);

    if (!fs.existsSync(offsetsFilePath)) {
      throw new Error(`File not found: ${offsetsFilePath}`);
    }

    const offsets = readOffsetsFromFile(offsetsFilePath);
    console.log(`Loaded ${offsets.length} offset records from file`);

    if (offsets.length === 0) {
      console.warn("No offsets found to migrate");
      process.exit(0);
    }

    // Display sample of first record
    console.log("\nSample record (before transformation):");
    console.log(JSON.stringify(offsets[0], null, 2));

    console.log("\nSample record (after transformation):");
    console.log(JSON.stringify(transformOffset(offsets[0]), null, 2));

    // Ask for confirmation (in automated scenarios, you can remove this)
    console.log(
      `\nReady to upload ${offsets.length} records to Firestore collection 'offsets'`
    );
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const { uploadedCount, errorCount } = await uploadOffsetsToFirestore(
      offsets
    );

    console.log(`\n✅ Migration complete!`);
    console.log(`   Successfully uploaded: ${uploadedCount} records`);
    console.log(`   Errors: ${errorCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
}

// Run the migration
main();
