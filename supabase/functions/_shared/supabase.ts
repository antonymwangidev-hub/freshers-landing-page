import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(url, key);
}

export type PaymentRecord = {
  id: string;
  student_name: string;
  email: string;
  phone: string;
  amount_paid: number;
  balance: number;
  payment_type: "full" | "deposit";
  paystack_reference: string;
  paystack_access_code: string | null;
  paystack_transaction_id: string | null;
  status: "pending" | "success" | "failed";
};

export async function markPaymentSuccess(
  reference: string,
  transactionId: string,
): Promise<PaymentRecord | null> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("payments")
    .select("*")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!existing) return null;
  if (existing.status === "success") return existing as PaymentRecord;

  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "success",
      paystack_transaction_id: String(transactionId),
    })
    .eq("paystack_reference", reference)
    .select("*")
    .single();

  if (error) throw error;
  return data as PaymentRecord;
}
