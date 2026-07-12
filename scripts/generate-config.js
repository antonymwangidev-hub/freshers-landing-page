/**
 * Generates config.js for Vercel deploys from environment variables.
 * Falls back to config.example.js (public anon key only).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, "config.example.js");

function readEnvFile() {
  const env = { ...process.env };
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function readExampleConfig() {
  if (!fs.existsSync(examplePath)) return null;
  const source = fs.readFileSync(examplePath, "utf8");
  const config = {};
  const urlMatch = source.match(/url:\s*"([^"]+)"/);
  const keyMatch = source.match(/anonKey:\s*"([^"]+)"/);
  if (urlMatch) config.url = urlMatch[1];
  if (keyMatch) config.anonKey = keyMatch[1];
  return config.url && config.anonKey ? config : null;
}

const env = readEnvFile();
const example = readExampleConfig();

const url =
  env.SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  env.VITE_SUPABASE_URL ||
  example?.url;

const anonKey =
  env.SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  example?.anonKey;

if (!url || !anonKey) {
  console.error("Missing Supabase URL/anon key. Set env vars on Vercel or update config.example.js.");
  process.exit(1);
}

const content = `window.SUPABASE_CONFIG = {
  url: "${url}",
  anonKey: "${anonKey}",
};
`;

fs.writeFileSync(path.join(root, "config.js"), content);
console.log("config.js generated for deploy");
