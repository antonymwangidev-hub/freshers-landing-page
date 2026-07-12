/**
 * Generates config.js for production deploys (e.g. Vercel) from environment variables.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function readEnv() {
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return env;
}

const env = readEnv();
const url = env.SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY for config.js generation.");
  process.exit(1);
}

const content = `window.SUPABASE_CONFIG = {
  url: "${url}",
  anonKey: "${anonKey}",
};
`;

fs.writeFileSync(path.join(root, "config.js"), content);
console.log("✓ config.js generated for deploy");
