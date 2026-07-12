const PAYSTACK_BASE = "https://api.paystack.co";
import { getAppSecret } from "./config.ts";

export type PaystackVerifyData = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  customer: { email: string };
};

export async function getPaystackSecret(): Promise<string> {
  const key = await getAppSecret("PAYSTACK_SECRET_KEY");
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

export function makeReference(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `NEXUS-${Date.now()}-${suffix}`;
}

export function amountToBalance(amount: number): number {
  return amount === 999 ? 1500 : 0;
}

export function amountToPaymentType(amount: number): "full" | "deposit" {
  return amount === 999 ? "deposit" : "full";
}

export async function initializeTransaction(params: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amount * 100,
      currency: "KES",
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.status) {
    throw new Error(payload.message ?? "Failed to initialize Paystack transaction");
  }

  return payload.data;
}

export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyData> {
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${await getPaystackSecret()}` },
    },
  );

  const payload = await response.json();
  if (!response.ok || !payload.status) {
    throw new Error(payload.message ?? "Failed to verify Paystack transaction");
  }

  return payload.data;
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(await getPaystackSecret()),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );

  const hash = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hash === signature;
}
