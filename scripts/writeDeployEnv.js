/**
 * Writes env_variables.yaml (git-ignored) for App Engine from the server-only
 * values in .env. Run before the first deploy and whenever a secret changes:
 *
 *   npm run deploy:env
 *
 * Only server-side variables are copied. VITE_* values are baked into dist/
 * at build time and are not needed at runtime.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = dotenv.parse(fs.readFileSync(path.join(root, ".env")));

const REQUIRED = ["STRIPE_SECRET_KEY"];
const OPTIONAL = ["STRIPE_WEBHOOK_SECRET", "PUBLIC_API_ORIGINS", "PUBLIC_API_CACHE_SECONDS"];

const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) {
  console.error(`❌ Missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}

const lines = ["env_variables:"];
for (const key of [...REQUIRED, ...OPTIONAL]) {
  if (env[key]) lines.push(`  ${key}: ${JSON.stringify(env[key])}`);
}
fs.writeFileSync(path.join(root, "env_variables.yaml"), lines.join("\n") + "\n", { mode: 0o600 });
console.log(`✅ Wrote env_variables.yaml with: ${lines.slice(1).map((l) => l.trim().split(":")[0]).join(", ")}`);
if (env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  console.log("ℹ️  STRIPE_SECRET_KEY is a TEST key. Swap in the live key before taking real payments.");
}
