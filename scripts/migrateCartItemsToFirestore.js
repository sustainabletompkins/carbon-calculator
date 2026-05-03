import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, writeBatch, doc } from "firebase/firestore";
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
 * Transform a single cart item record from the JSON format
 * Handles null values, type conversions, and data validation
 */
function transformCartItem(record) {
  return {
    id: record.id || null,
    title: record.title || "",
    cost: parseFloat(record.cost) || 0,
    pounds: parseFloat(record.pounds) || 0,
    userId: record.user_id || null,
    sessionId: record.session_id ? parseInt(record.session_id) : null,
    checkoutSessionId: record.checkout_session_id || null,
    priceId: record.price_id || null,
    schedule: record.schedule || null,
    purchased: Boolean(record.purchased),
    createdAt: record.created_at ? new Date(record.created_at) : new Date(),
    updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
    offsetType: record.offset_type || null,
    offsetInterval: record.offset_interval || null,
    frequency: record.frequency || null,
  };
}

/**
 * Read and parse JSONL file (one JSON object per line)
 */
function readCartItemsFromFile(filePath) {
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
 * Upload cart items to Firestore in batches
 */
async function uploadCartItemsToFirestore(cartItems) {
  const db_instance = getFirestore(app);
  const cartItemsCollection = collection(db_instance, "cartItems");

  const batchSize = 500; // Firestore batch limit
  let uploadedCount = 0;
  let errorCount = 0;

  console.log(`Starting migration of ${cartItems.length} cart items...`);

  for (let i = 0; i < cartItems.length; i += batchSize) {
    const batch = writeBatch(db_instance);
    const batchCartItems = cartItems.slice(i, i + batchSize);

    batchCartItems.forEach((cartItem) => {
      try {
        const transformedCartItem = transformCartItem(cartItem);
        const docRef = doc(cartItemsCollection, String(cartItem.id)); // Use ID as document ID
        batch.set(docRef, transformedCartItem);
        uploadedCount++;
      } catch (error) {
        console.error(
          `Error transforming cart item ${cartItem.id}: ${error.message}`
        );
        errorCount++;
      }
    });

    try {
      await batch.commit();
      console.log(
        `✓ Batch ${Math.floor(i / batchSize) + 1} committed (${
          batchCartItems.length
        } items)`
      );
    } catch (error) {
      console.error(`Error committing batch: ${error.message}`);
      errorCount += batchCartItems.length;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Total processed: ${cartItems.length}`);
  console.log(`Successfully uploaded: ${uploadedCount}`);
  console.log(`Errors: ${errorCount}`);
}

/**
 * Main function
 */
async function main() {
  try {
    // Path to cart items JSON file
    const cartItemsFilePath = path.join(__dirname, "../cart_items.json");

    if (!fs.existsSync(cartItemsFilePath)) {
      console.error(`❌ File not found: ${cartItemsFilePath}`);
      console.log(`\nTo generate this file, run:`);
      console.log(
        `psql -d flcf -c "COPY (SELECT row_to_json(t) FROM cart_items t) TO STDOUT" > cart_items.json`
      );
      process.exit(1);
    }

    console.log(`📂 Reading cart items from: ${cartItemsFilePath}`);
    const cartItems = readCartItemsFromFile(cartItemsFilePath);

    if (cartItems.length === 0) {
      console.error(`❌ No cart items found in file`);
      process.exit(1);
    }

    console.log(`✓ Loaded ${cartItems.length} cart items from file\n`);

    // Upload to Firestore
    await uploadCartItemsToFirestore(cartItems);

    console.log(`\n✅ Migration completed successfully!`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    process.exit(1);
  }
}

// Run the migration
main();
