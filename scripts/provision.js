#!/usr/bin/env node
/**
 * Full provisioning: sync frontend config, push Supabase secrets, deploy functions, test.
 * Usage: node scripts/provision.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
}

function parseEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

console.log("=== Freshers Bundle Payment Provision ===\n");

run("node scripts/setup.js");

const env = parseEnv();

if (env.SUPABASE_ACCESS_TOKEN?.startsWith("sbp_")) {
  run("node scripts/set-secrets-api.js");
  run("node scripts/setup.js --deploy");
} else if (env.SUPABASE_DB_PASSWORD) {
  run("node scripts/apply-db.js");
  console.log("\n⚠ DB secrets seeded. Redeploy functions with a valid sbp_ token.");
} else {
  console.log("\n--- Edge Function secrets ---");
  console.log("Secrets appear configured if tests pass below.");
  console.log("To redeploy functions, add SUPABASE_ACCESS_TOKEN (sbp_...) from:");
  console.log("https://supabase.com/dashboard/account/tokens");
}

console.log("\nRunning endpoint tests...");
run("node scripts/setup.js --test");
