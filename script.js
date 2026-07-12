const WHATSAPP_URL = "https://wa.me/254746370937";

const AMOUNT_LABELS = {
  2499: "Pay KSh 2,499 in full for instant access.",
  999: "Pay KSh 999 deposit. Balance of KSh 1,500 due in 2 weeks.",
};

function getSupabaseFunctionsUrl() {
  const config = window.SUPABASE_CONFIG;
  if (!config?.url || config.url.includes("YOUR_PROJECT_REF")) {
    return null;
  }
  return `${config.url.replace(/\/$/, "")}/functions/v1`;
}

function openModal(amount) {
  const modal = document.getElementById("payment-modal");
  const summary = document.getElementById("payment-modal-summary");
  const amountInput = document.getElementById("payment-amount");
  const errorEl = document.getElementById("payment-form-error");
  const submitBtn = document.getElementById("payment-submit");

  amountInput.value = String(amount);
  summary.textContent = AMOUNT_LABELS[amount] ?? `Pay KSh ${amount}.`;
  errorEl.hidden = true;
  errorEl.textContent = "";
  submitBtn.disabled = false;
  submitBtn.textContent = `Continue to Paystack - KSh ${amount.toLocaleString()}`;

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const firstField = modal.querySelector('input[name="name"]');
  if (firstField) firstField.focus();
}

function closeModal() {
  const modal = document.getElementById("payment-modal");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function fallbackToWhatsApp(amount) {
  const message = encodeURIComponent(
    `Hi Nexus AI Academy, I want to enroll for the Freshers Bundle. Amount: KSh ${amount}.`,
  );
  window.location.href = `${WHATSAPP_URL}?text=${message}`;
}

async function initializePayment(formData) {
  const functionsUrl = getSupabaseFunctionsUrl();
  if (!functionsUrl) {
    throw new Error(
      "Payment is not configured yet. Copy config.example.js to config.js and add your Supabase URL.",
    );
  }

  const config = window.SUPABASE_CONFIG;
  const response = await fetch(`${functionsUrl}/initialize-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      amount: Number(formData.get("amount")),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not start payment. Please try again.");
  }

  return payload;
}

function bindPaymentButtons() {
  document.querySelectorAll("[data-pay-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      const amount = Number(button.dataset.payAmount);
      if (amount !== 999 && amount !== 2499) return;
      openModal(amount);
    });
  });
}

function bindModalControls() {
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function bindPaymentForm() {
  const form = document.getElementById("payment-form");
  const errorEl = document.getElementById("payment-form-error");
  const submitBtn = document.getElementById("payment-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = "";

    if (!form.reportValidity()) return;

    const amount = Number(form.amount.value);
    submitBtn.disabled = true;
    submitBtn.textContent = "Redirecting to Paystack...";

    try {
      const payload = await initializePayment(new FormData(form));
      if (!payload.authorization_url) {
        throw new Error("Paystack did not return a checkout URL.");
      }
      window.location.href = payload.authorization_url;
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = `Continue to Paystack - KSh ${amount.toLocaleString()}`;

      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      errorEl.textContent = message;
      errorEl.hidden = false;

      if (message.includes("not configured")) {
        fallbackToWhatsApp(amount);
      }
    }
  });
}

bindPaymentButtons();
bindModalControls();
bindPaymentForm();
