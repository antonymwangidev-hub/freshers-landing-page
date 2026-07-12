/**
 * Sets Supabase Edge Function secrets via Management API.
 * Requires SUPABASE_ACCESS_TOKEN starting with sbp_ in .env
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function parseEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

async function main() {
  const env = parseEnv(envPath);
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!token?.startsWith("sbp_")) {
    console.error("SUPABASE_ACCESS_TOKEN must start with sbp_ (not your Paystack key).");
    console.error("Create one at: https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }

  const siteUrl = env.SITE_URL?.replace(/\/$/, "");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      { name: "PAYSTACK_SECRET_KEY", value: env.PAYSTACK_SECRET_KEY },
      { name: "SITE_URL", value: siteUrl },
    ]),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("Failed to set secrets:", res.status, body);
    process.exit(1);
  }

  console.log("✓ Edge Function secrets set via Supabase API");
}

main();
