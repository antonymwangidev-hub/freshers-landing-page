import { getServiceClient } from "./supabase.ts";

const secretCache = new Map<string, string>();

export async function getAppSecret(key: string): Promise<string | null> {
  const fromEnv = Deno.env.get(key);
  if (fromEnv) return fromEnv;

  if (secretCache.has(key)) return secretCache.get(key)!;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.value) return null;

  secretCache.set(key, data.value);
  return data.value;
}

export async function getSiteUrl(): Promise<string> {
  const url = await getAppSecret("SITE_URL");
  if (!url) throw new Error("SITE_URL is not configured");
  return url.replace(/\/$/, "");
}
