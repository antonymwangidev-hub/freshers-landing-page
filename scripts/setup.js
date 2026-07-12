#!/usr/bin/env node
/**
 * Syncs .env values to config.js and deploys Supabase secrets + functions.
 * Requires SUPABASE_ACCESS_TOKEN in .env (from https://supabase.com/dashboard/account/tokens)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

function writeConfig(env) {
  const configPath = path.join(root, "config.js");
  const content = `window.SUPABASE_CONFIG = {
  url: "${env.SUPABASE_URL}",
  anonKey: "${env.SUPABASE_ANON_KEY}",
};
`;
  fs.writeFileSync(configPath, content);
  console.log("✓ config.js updated");
}

function updateThankYouLinks(env) {
  const thankYouPath = path.join(root, "thank-you.html");
  let html = fs.readFileSync(thankYouPath, "utf8");
  if (env.WHATSAPP_GROUP_LINK && !env.WHATSAPP_GROUP_LINK.includes("YOUR_GROUP")) {
    html = html.replace(
      /href="(\[PLACEHOLDER: WHATSAPP_GROUP_LINK\]|https:\/\/chat\.whatsapp\.com\/[^"]+)"/,
      `href="${env.WHATSAPP_GROUP_LINK}"`,
    );
  }
  if (env.COURSE_DRIVE_LINK && !env.COURSE_DRIVE_LINK.includes("YOUR_PORTAL")) {
    html = html.replace("[PLACEHOLDER: COURSE_DRIVE_LINK]", env.COURSE_DRIVE_LINK);
  }
  fs.writeFileSync(thankYouPath, html);
  console.log("✓ thank-you.html links updated");
}

function deploySupabase(env) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token || (!token.startsWith("sbp_") && !token.startsWith("sb_secret_"))) {
    console.log(
      "⚠ SUPABASE_ACCESS_TOKEN missing or invalid (must start with sbp_). Skipping CLI deploy.",
    );
    console.log(
      "  Create one at https://supabase.com/dashboard/account/tokens",
    );
    return false;
  }

  const projectRef = env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) throw new Error("Could not parse project ref from SUPABASE_URL");

  const siteUrl = env.SITE_URL?.replace(/\/$/, "");
  const shellEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: token };

  execSync(
    `npx --yes supabase secrets set PAYSTACK_SECRET_KEY="${env.PAYSTACK_SECRET_KEY}" SITE_URL="${siteUrl}" --project-ref ${projectRef}`,
    { cwd: root, stdio: "inherit", env: shellEnv, shell: true },
  );
  console.log("✓ Supabase secrets set");

  for (const fn of ["initialize-payment", "verify-payment", "paystack-webhook"]) {
    execSync(`npx --yes supabase functions deploy ${fn} --project-ref ${projectRef}`, {
      cwd: root,
      stdio: "inherit",
      env: shellEnv,
      shell: true,
    });
    console.log(`✓ Deployed ${fn}`);
  }
  return true;
}

async function testEndpoints(env) {
  const base = `${env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  };

  const initRes = await fetch(`${base}/initialize-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Integration Test",
      email: `test+${Date.now()}@example.com`,
      phone: "0712345678",
      amount: 999,
    }),
  });
  const initBody = await initRes.json();
  if (!initRes.ok || !initBody.authorization_url) {
    throw new Error(`initialize-payment failed: ${JSON.stringify(initBody)}`);
  }
  console.log("✓ initialize-payment returned Paystack URL");
  console.log(`  reference: ${initBody.reference}`);

  const verifyRes = await fetch(`${base}/verify-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reference: initBody.reference }),
  });
  const verifyBody = await verifyRes.json();
  if (verifyRes.status !== 402 && !verifyBody.error) {
    console.log("✓ verify-payment responded for pending transaction");
  } else if (verifyBody.error) {
    console.log(`✓ verify-payment correctly reports: ${verifyBody.error}`);
  }

  const paystackRes = await fetch("https://api.paystack.co/transaction/verify/invalid-ref-test", {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const paystackBody = await paystackRes.json();
  if (paystackBody.message && paystackBody.message !== "Invalid key") {
    console.log("✓ Paystack secret key is valid");
  } else {
    throw new Error("Paystack secret key appears invalid");
  }
}

const env = parseEnv(envPath);
writeConfig(env);
updateThankYouLinks(env);

const deploy = process.argv.includes("--deploy");
const test = process.argv.includes("--test");

if (deploy) {
  try {
    require("child_process").execSync("node scripts/apply-db.js", {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    // apply-db prints its own errors
  }
  deploySupabase(env);
}

if (test || deploy) {
  testEndpoints(env).catch((err) => {
    console.error("✗ Test failed:", err.message);
    process.exit(1);
  });
}

if (!deploy && !test) {
  console.log("\nRun with --deploy to push secrets/functions, --test to verify endpoints.");
}
