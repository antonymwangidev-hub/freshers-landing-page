import { verifyTransaction, verifyWebhookSignature } from "../_shared/paystack.ts";
import { getServiceClient, markPaymentSuccess } from "../_shared/supabase.ts";

type WebhookEvent = {
  event: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    const valid = await verifyWebhookSignature(rawBody, signature);

    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody) as WebhookEvent;

    if (event.event !== "charge.success") {
      return new Response("Ignored", { status: 200 });
    }

    const reference = event.data.reference;
    const supabase = getServiceClient();

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (!payment) {
      return new Response("Payment not found", { status: 404 });
    }

    if (payment.status === "success") {
      return new Response("Already processed", { status: 200 });
    }

    const paystackData = await verifyTransaction(reference);
    const paidAmount = Math.round(paystackData.amount / 100);

    if (paystackData.status !== "success") {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("paystack_reference", reference);
      return new Response("Verification failed", { status: 200 });
    }

    if (paidAmount !== payment.amount_paid) {
      return new Response("Amount mismatch", { status: 200 });
    }

    await markPaymentSuccess(reference, paystackData.id);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook handler error", { status: 500 });
  }
});
