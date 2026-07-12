import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { verifyTransaction } from "../_shared/paystack.ts";
import { getServiceClient, markPaymentSuccess } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { reference } = (await req.json()) as { reference?: string };
    if (!reference?.trim()) {
      return jsonResponse({ error: "Payment reference is required." }, 400);
    }

    const supabase = getServiceClient();
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("paystack_reference", reference.trim())
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!payment) {
      return jsonResponse({ error: "Payment record not found." }, 404);
    }

    if (payment.status === "success") {
      return jsonResponse({ verified: true, payment });
    }

    const paystackData = await verifyTransaction(reference.trim());
    const paidAmount = Math.round(paystackData.amount / 100);

    if (paystackData.status !== "success") {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("paystack_reference", reference.trim());

      return jsonResponse(
        { verified: false, error: "Payment was not successful." },
        402,
      );
    }

    if (paidAmount !== payment.amount_paid) {
      return jsonResponse(
        { verified: false, error: "Paid amount does not match expected amount." },
        402,
      );
    }

    const updated = await markPaymentSuccess(
      reference.trim(),
      paystackData.id,
    );

    return jsonResponse({ verified: true, payment: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
