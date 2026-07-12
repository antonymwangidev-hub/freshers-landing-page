import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getSiteUrl } from "../_shared/config.ts";
import {
  amountToBalance,
  amountToPaymentType,
  initializeTransaction,
  makeReference,
} from "../_shared/paystack.ts";
import { getServiceClient } from "../_shared/supabase.ts";

type InitBody = {
  name?: string;
  email?: string;
  phone?: string;
  amount?: number;
};

function validateInput(body: InitBody) {
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim();
  const amount = body.amount;

  if (!name || name.length < 2) {
    return { error: "Please enter your full name." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return { error: "Please enter a valid phone number." };
  }
  if (amount !== 999 && amount !== 2499) {
    return { error: "Invalid payment amount." };
  }

  return { name, email, phone, amount };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as InitBody;
    const validated = validateInput(body);
    if ("error" in validated) {
      return jsonResponse({ error: validated.error }, 400);
    }

    const { name, email, phone, amount } = validated;
    const reference = makeReference();
    const balance = amountToBalance(amount);
    const paymentType = amountToPaymentType(amount);

    const callbackBase = await getSiteUrl();

    const callbackUrl =
      `${callbackBase}/thank-you.html?reference=${encodeURIComponent(reference)}`;

    const supabase = getServiceClient();
    const { error: insertError } = await supabase.from("payments").insert({
      student_name: name,
      email,
      phone,
      amount_paid: amount,
      balance,
      payment_type: paymentType,
      paystack_reference: reference,
      status: "pending",
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    const paystack = await initializeTransaction({
      email,
      amount,
      reference,
      callbackUrl,
      metadata: {
        student_name: name,
        phone,
        payment_type: paymentType,
        product: "Freshers Money Move Bundle",
      },
    });

    await supabase
      .from("payments")
      .update({ paystack_access_code: paystack.access_code })
      .eq("paystack_reference", reference);

    return jsonResponse({
      authorization_url: paystack.authorization_url,
      reference: paystack.reference,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
