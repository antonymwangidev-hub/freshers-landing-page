const WHATSAPP_SUPPORT = "https://wa.me/254746370937";

function getSupabaseFunctionsUrl() {
  const config = window.SUPABASE_CONFIG;
  if (!config?.url || config.url.includes("YOUR_PROJECT_REF")) return null;
  return `${config.url.replace(/\/$/, "")}/functions/v1`;
}

function getReferenceFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("reference") || params.get("trxref");
}

function formatKes(amount) {
  return `KSh ${Number(amount).toLocaleString()}`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showPendingState(reference) {
  setText("payment-status-title", "Confirming Your Payment...");
  setText(
    "payment-status-message",
    "Please wait while we verify your Paystack transaction.",
  );
  setText("payment-reference", reference);
}

function showSuccessState(payment) {
  setText("payment-status-title", "Payment Successful! Welcome To Nexus");
  setText(
    "payment-status-message",
    payment.payment_type === "deposit"
      ? "Your deposit is confirmed. Complete the remaining balance in 2 weeks for full access."
      : "Your access to the Freshers Money Move Bundle is ready.",
  );
  setText("payment-amount", formatKes(payment.amount_paid));
  setText("payment-email", payment.email);
  setText("payment-balance", formatKes(payment.balance));

  const balanceRow = document.getElementById("payment-balance-row");
  if (balanceRow) {
    balanceRow.hidden = payment.balance === 0;
  }

  document.getElementById("success-content").hidden = false;
  document.getElementById("pending-content").hidden = true;
  document.getElementById("error-content").hidden = true;
  document.getElementById("payment-details-section").hidden = false;
  document.getElementById("next-steps-section").hidden = false;

  const icon = document.getElementById("status-icon");
  if (icon) icon.textContent = "✓";
}

function showErrorState(message) {
  setText("payment-status-title", "Payment Not Confirmed");
  setText("payment-status-message", message);
  document.getElementById("success-content").hidden = true;
  document.getElementById("pending-content").hidden = true;
  document.getElementById("error-content").hidden = false;
  document.getElementById("payment-details-section").hidden = true;
  document.getElementById("next-steps-section").hidden = true;

  const icon = document.getElementById("status-icon");
  if (icon) icon.textContent = "!";
}

async function verifyPayment(reference) {
  const functionsUrl = getSupabaseFunctionsUrl();
  if (!functionsUrl) {
    showErrorState(
      "Payment verification is not configured. WhatsApp us with your Paystack receipt.",
    );
    return;
  }

  showPendingState(reference);

  try {
    const config = window.SUPABASE_CONFIG;
    const response = await fetch(`${functionsUrl}/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify({ reference }),
    });

    const payload = await response.json();

    if (response.ok && payload.verified && payload.payment) {
      showSuccessState(payload.payment);
      return;
    }

    showErrorState(
      payload.error ??
        "We could not confirm your payment yet. If you were charged, contact us on WhatsApp.",
    );
  } catch {
    showErrorState(
      "Verification failed due to a network error. Please refresh or contact us on WhatsApp.",
    );
  }
}

const reference = getReferenceFromUrl();
if (reference) {
  verifyPayment(reference);
} else {
  showErrorState("No payment reference found. Start from the landing page to pay.");
}

const supportLink = document.getElementById("support-link");
if (supportLink) {
  supportLink.href = WHATSAPP_SUPPORT;
}
