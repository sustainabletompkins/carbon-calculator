const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();

/**
 * Firebase Cloud Function: Sends offset purchase data to Little Green Light webhook
 * Triggers when a new offset record is created in Firestore
 */
exports.syncOffsetToLittleGreenLight = functions.firestore
  .document("offsets/{offsetId}")
  .onCreate(async (snapshot, context) => {
    const offsetData = snapshot.data();
    const offsetId = context.params.offsetId;

    // Idempotency check - if already synced, skip
    if (offsetData.syncedToLGL) {
      console.log(`Offset ${offsetId} already synced to LGL, skipping.`);
      return null;
    }

    try {
      // Retrieve user data to get full name if available
      let userName = "Carbon Offset Supporter";
      let userZipCode = "12314"; // Default zip code

      if (offsetData.userEmail) {
        try {
          const db = admin.firestore();
          const usersRef = db.collection("users");
          const userQuery = await usersRef
            .where("email", "==", offsetData.userEmail)
            .limit(1)
            .get();

          if (!userQuery.empty) {
            const userData = userQuery.docs[0].data();
            userName = userData.name || userData.email || userName;
            userZipCode = userData.zipCode || userZipCode;
          }
        } catch (userError) {
          console.warn("Could not retrieve user data:", userError.message);
          // Continue with default values
        }
      }

      // Prepare payload for Little Green Light webhook
      const lglPayload = {
        payment_type: "Credit Card",
        email: offsetData.userEmail || "unknown@example.com",
        amount: offsetData.cost || 0,
        name: userName,
        zip_code: userZipCode,
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
        fund: "Finger Lakes Climate Fund",
        // Additional metadata for tracking
        offsetType: offsetData.offsetType || null,
        carbonOffset: offsetData.carbonKg || offsetData.carbonPounds || 0,
        transactionId: offsetData.transactionId || offsetId,
        stripePaymentIntentId: offsetData.stripePaymentIntentId || null,
      };

      // Send to Little Green Light webhook
      const lglUrl =
        "https://sustainabletompkins.littlegreenlight.com/integrations/e43d9598-3876-47a8-9411-9a6afdff1647/listener";

      await sendWebhookRequest(lglUrl, lglPayload);

      // Mark as synced in Firestore
      await snapshot.ref.update({
        syncedToLGL: true,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `Successfully synced offset ${offsetId} to Little Green Light`
      );
      return null;
    } catch (error) {
      console.error(
        `Error syncing offset ${offsetId} to Little Green Light:`,
        error
      );
      // Log the error to Firestore for manual inspection
      await logSyncError(offsetId, error);
      // Throw error to enable automatic retry by Firebase Functions
      throw new Error(`Sync to Little Green Light failed: ${error.message}`);
    }
  });

/**
 * Helper function: Send HTTPS POST request to webhook
 * @param {string} url - The webhook URL
 * @param {Object} payload - The data to send
 * @returns {Promise<void>}
 */
function sendWebhookRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: "sustainabletompkins.littlegreenlight.com",
      path: "/integrations/e43d9598-3876-47a8-9411-9a6afdff1647/listener",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
      timeout: 30000, // 30 second timeout
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(
            `Webhook sent successfully. Status: ${res.statusCode}`,
            responseData
          );
          resolve();
        } else {
          reject(
            new Error(
              `Webhook returned status ${res.statusCode}: ${responseData}`
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Webhook request timeout"));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Helper function: Log sync errors to Firestore for debugging
 * @param {string} offsetId - The offset document ID
 * @param {Error} error - The error that occurred
 * @returns {Promise<void>}
 */
async function logSyncError(offsetId, error) {
  try {
    const db = admin.firestore();
    await db.collection("syncErrors").add({
      offsetId,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Logged sync error for offset ${offsetId} to Firestore`);
  } catch (logError) {
    console.error("Failed to log sync error:", logError);
  }
}
