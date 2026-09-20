const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const https = require("https");
const nodemailer = require("nodemailer");

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

    // Records imported from the old site were already sent to LGL by that site
    if (offsetData.source === "legacy") return null;

    // Idempotency check - if already synced, skip
    if (offsetData.syncedToLGL) {
      console.log(`Offset ${offsetId} already synced to LGL, skipping.`);
      return null;
    }

    // Kill switch: LGL only receives gifts when explicitly enabled in functions/.env.
    // Keep this off while importing data or while the client is testing.
    const lglUrl = process.env.LGL_WEBHOOK_URL;
    if (process.env.LGL_SYNC_ENABLED !== "true" || !lglUrl) {
      console.log(`LGL sync disabled — offset ${offsetId} not sent.`);
      await snapshot.ref.update({ lglSkipped: true });
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
      // Entries added in the admin section carry their own name, payment
      // method and gift date; website purchases fall back to the defaults.
      const PAYMENT_TYPE_LABELS = {
        check: "Check",
        cash: "Cash",
        credit_card: "Credit Card",
        ach: "ACH",
        stock: "Stock",
        in_kind: "In-Kind",
        other: "Other",
      };
      if (offsetData.name) userName = offsetData.name;
      if (offsetData.zipCode) userZipCode = offsetData.zipCode;
      const giftDate =
        offsetData.source === "manual" && offsetData.timestamp?.toDate
          ? offsetData.timestamp.toDate()
          : new Date();

      const lglPayload = {
        payment_type: PAYMENT_TYPE_LABELS[offsetData.paymentMethod] || "Credit Card",
        email: offsetData.userEmail || "unknown@example.com",
        amount: offsetData.cost || 0,
        name: userName,
        zip_code: userZipCode,
        date: giftDate.toISOString().split("T")[0], // YYYY-MM-DD format
        fund: "Finger Lakes Climate Fund",
        // Additional metadata for tracking
        offsetType: offsetData.offsetType || null,
        carbonOffset: offsetData.carbonKg || offsetData.carbonPounds || 0,
        transactionId: offsetData.transactionId || offsetId,
        stripePaymentIntentId: offsetData.stripePaymentIntentId || null,
      };

      // Send to Little Green Light webhook
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

    const { hostname, pathname, search } = new URL(url);

    const options = {
      hostname,
      path: pathname + search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
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

// ─── Email notification ───────────────────────────────────────────────────────

/**
 * Firebase Cloud Function: Sends a notification email when an offset is
 * attributed to a team or individual account (i.e. teamId is first set).
 *
 * Required Firebase Functions config (set with `firebase functions:config:set`):
 *   mail.smtp_host   e.g. smtp.gmail.com
 *   mail.smtp_port   e.g. 587
 *   mail.smtp_user   your SMTP username / email
 *   mail.smtp_pass   your SMTP password / app password
 *   mail.from        e.g. "Finger Lakes Climate Fund <noreply@example.com>"
 *   app.url          e.g. https://your-app.web.app
 */
exports.notifyOnAttribution = functions.firestore
  .document("offsets/{offsetId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Never email donors about records imported from the old site
    if (after.source === "legacy") return null;

    // Only fire when teamId is newly set (wasn't set before)
    if (before.teamId || !after.teamId) return null;

    const email = after.userEmail;
    if (!email || !email.includes("@")) {
      console.log("No valid email on offset — skipping notification.");
      return null;
    }

    try {
      const db = admin.firestore();

      // Fetch team/individual account for cumulative stats
      // teamDocId is authoritative. The numeric legacy teamId is only a fallback:
      // teams and individuals share the collection and a few legacy ids overlap.
      let teamData = null;
      if (after.teamDocId) {
        const teamSnap = await db.collection("teams").doc(after.teamDocId).get();
        if (teamSnap.exists) teamData = teamSnap.data();
      } else {
        const teamSnap = await db
          .collection("teams")
          .where("legacyId", "==", after.teamId)
          .get();
        const docs = teamSnap.docs.map((d) => d.data());
        teamData = docs.find((d) => !d.isIndividual) || docs[0] || null;
      }

      let accountName = "your account";
      let totalPounds = 0;
      let isIndividual = false;

      if (teamData) {
        accountName = teamData.name;
        totalPounds = teamData.pounds ?? 0;
        isIndividual = teamData.isIndividual ?? false;
      }

      // Fetch user's display name
      const usersRef = db.collection("users");
      const userSnap = await usersRef
        .where("email", "==", email)
        .limit(1)
        .get();
      const firstName = userSnap.empty
        ? "there"
        : (userSnap.docs[0].data().name || "there").split(" ")[0];

      const smtpHost = process.env.MAIL_SMTP_HOST;
      const smtpPort = process.env.MAIL_SMTP_PORT || "587";
      const smtpUser = process.env.MAIL_SMTP_USER;
      const smtpPass = process.env.MAIL_SMTP_PASS;
      const mailFrom = process.env.MAIL_FROM;
      const appUrl = process.env.APP_URL || "https://your-app.web.app";

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn(
          "Mail env vars not set — skipping notification. " +
          "Add MAIL_SMTP_HOST, MAIL_SMTP_USER, MAIL_SMTP_PASS to functions/.env"
        );
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const thisPounds = Math.round(after.carbonPounds ?? 0);
      const totalFormatted = new Intl.NumberFormat("en-US").format(Math.round(totalPounds));
      const thisFormatted = new Intl.NumberFormat("en-US").format(thisPounds);
      const accountLabel = isIndividual ? "individual account" : "team";

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:system-ui,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#16a34a,#0d9488);padding:32px 32px 24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:32px;">🌿</p>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Carbon Offset Confirmed</h1>
      <p style="margin:8px 0 0;color:#bbf7d0;font-size:14px;">Finger Lakes Climate Fund</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi ${firstName},</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        Thank you for your purchase! Your offset of
        <strong style="color:#16a34a;">${thisFormatted} lbs CO₂</strong>
        has been credited to your ${accountLabel}
        <strong>${accountName}</strong>.
      </p>

      <!-- Stats card -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">
          ${accountLabel === "team" ? "Team" : "Your"} Total CO₂ Offset
        </p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#16a34a;">${totalFormatted} lbs</p>
      </div>

      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        See how you rank against other ${accountLabel === "team" ? "teams" : "individuals"} on the leaderboard:
      </p>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${appUrl}"
           style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                  font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">
          View Leaderboard →
        </a>
      </div>

      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6;">
        Finger Lakes Climate Fund · <a href="${appUrl}" style="color:#16a34a;">fingerlakesclimatefund.org</a><br>
        You're receiving this because you made a carbon offset purchase.
      </p>
    </div>

  </div>
</body>
</html>`;

      await transporter.sendMail({
        from: mailFrom || `"Finger Lakes Climate Fund" <${smtpUser}>`,
        to: email,
        subject: `Your ${thisFormatted} lb CO₂ offset is confirmed 🌿`,
        html,
      });

      console.log(`Notification email sent to ${email} for offset attributed to team ${after.teamId}`);
      return null;
    } catch (err) {
      console.error("Error sending notification email:", err);
      // Don't throw — email failure shouldn't block other processing
      return null;
    }
  });
