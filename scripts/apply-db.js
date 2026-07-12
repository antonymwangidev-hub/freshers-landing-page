/**
 * Applies DB migration + seeds app_secrets from .env using direct Postgres connection.
 * Requires SUPABASE_DB_PASSWORD in .env (Project Settings → Database → Database password)
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
  const projectRef = env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const dbPassword = env.SUPABASE_DB_PASSWORD;

  if (!projectRef || !dbPassword) {
    console.log("Skip DB apply: SUPABASE_DB_PASSWORD not set in .env");
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

  await client.connect();

  const migrationPath = path.join(
    root,
    "supabase/migrations/20260712130000_create_app_secrets.sql",
  );
  await client.query(fs.readFileSync(migrationPath, "utf8"));

  await client.query(
    `INSERT INTO public.app_secrets (key, value, updated_at)
     VALUES
       ('PAYSTACK_SECRET_KEY', $1, NOW()),
       ('SITE_URL', $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [env.PAYSTACK_SECRET_KEY, env.SITE_URL?.replace(/\/$/, "")],
  );

  await client.end();
  console.log("✓ app_secrets table created and seeded via Postgres");
  return true;
}

main().catch((err) => {
  console.error("✗ DB apply failed:", err.message);
  process.exit(1);
});
