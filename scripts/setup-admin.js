/**
 * Applies admin migration and bootstraps the admin auth user.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function parseEnv() {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function applyMigration(env) {
  const projectRef = env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const dbPassword = env.SUPABASE_DB_PASSWORD;
  if (!projectRef || !dbPassword) {
    console.log("Skip SQL migration: add SUPABASE_DB_PASSWORD to .env or run SQL manually.");
    return false;
  }

  const { Client } = require("pg");
  const client = new Client({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  const migrationPath = path.join(
    root,
    "supabase/migrations/20260712140000_admin_access.sql",
  );

  await client.connect();
  await client.query(fs.readFileSync(migrationPath, "utf8"));
  await client.end();
  console.log("Admin migration applied via Postgres.");
  return true;
}

async function bootstrapAdmin(env) {
  const base = `${env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/bootstrap-admin`;
  const response = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Bootstrap failed (${response.status})`);
  }
  console.log(body.message || "Admin user ready.");
}

async function main() {
  const env = parseEnv();
  await applyMigration(env);
  await bootstrapAdmin(env);
}

main().catch((error) => {
  console.error("Setup admin failed:", error.message);
  console.error(
    "Manual fallback: run supabase/migrations/20260712140000_admin_access.sql in Supabase SQL Editor, deploy bootstrap-admin, then POST to /functions/v1/bootstrap-admin",
  );
  process.exit(1);
});
