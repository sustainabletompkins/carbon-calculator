/**
 * Grant, revoke, or list the `admin` custom claim on Firebase Auth users.
 *
 *   npm run admin:grant  -- someone@example.com
 *   npm run admin:revoke -- someone@example.com
 *   npm run admin:list
 *
 * The user must have signed in to the app at least once (so the Auth user
 * exists). After a change, they should sign out and back in, or the app will
 * pick it up on next token refresh (AuthContext forces a refresh on load).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Missing scripts/serviceAccountKey.json");
  console.log(
    "   Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key"
  );
  process.exit(1);
}
initializeApp({ credential: cert(require(serviceAccountPath)) });
const auth = getAuth();

const [action, email] = process.argv.slice(2);

async function setAdmin(email, value) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌ No Firebase Auth user for ${email}. They must sign in once first.`);
    process.exit(1);
  }
  const claims = { ...(user.customClaims || {}) };
  if (value) claims.admin = true;
  else delete claims.admin;
  await auth.setCustomUserClaims(user.uid, claims);
  // Revoke existing tokens so the change takes effect on next refresh.
  await auth.revokeRefreshTokens(user.uid);
  console.log(`✅ ${value ? "Granted" : "Revoked"} admin for ${email} (${user.uid})`);
}

async function listAdmins() {
  const admins = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (u.customClaims?.admin === true) admins.push(u.email || u.uid);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  if (admins.length === 0) console.log("No admins yet.");
  else console.log("Admins:\n  " + admins.join("\n  "));
}

if (action === "grant" && email) await setAdmin(email, true);
else if (action === "revoke" && email) await setAdmin(email, false);
else if (action === "list") await listAdmins();
else {
  console.log("Usage:\n  node scripts/setAdminClaim.js grant <email>\n  node scripts/setAdminClaim.js revoke <email>\n  node scripts/setAdminClaim.js list");
  process.exit(1);
}
process.exit(0);
