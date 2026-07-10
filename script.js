const PAYSTACK_PUBLIC_KEY = "pk_live_REPLACE_WITH_YOUR_PUBLIC_KEY";
const BUSINESS_NAME = "NEXUS AI ACADEMY";
const WHATSAPP_URL = "https://wa.me/254746370937";

function makeReference(amount) {
  return `NEXUS-${amount}-${Date.now()}`;
}

function fallbackToWhatsApp(amount) {
  const message = encodeURIComponent(
    `Hi Nexus AI Academy, I want to enroll for the Freshers Bundle. Amount: KSh ${amount}.`
  );
  window.location.href = `${WHATSAPP_URL}?text=${message}`;
}

function startPaystack(amount) {
  if (
    !window.PaystackPop ||
    PAYSTACK_PUBLIC_KEY.includes("REPLACE_WITH_YOUR_PUBLIC_KEY")
  ) {
    fallbackToWhatsApp(amount);
    return;
  }

  const email = window.prompt("Enter your email for payment receipt:");
  if (!email) return;

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: amount * 100,
    currency: "KES",
    ref: makeReference(amount),
    label: BUSINESS_NAME,
    metadata: {
      custom_fields: [
        {
          display_name: "Product",
          variable_name: "product",
          value: "Freshers Money Move Bundle",
        },
      ],
    },
    callback(response) {
      const message = encodeURIComponent(
        `Hi Nexus AI Academy, I have paid KSh ${amount} for the Freshers Bundle. Paystack ref: ${response.reference}`
      );
      window.location.href = `${WHATSAPP_URL}?text=${message}`;
    },
    onClose() {
      console.info("Paystack checkout closed.");
    },
  });

  handler.openIframe();
}

document.querySelectorAll("[data-paystack]").forEach((button) => {
  button.addEventListener("click", () => {
    const amount = Number(button.dataset.paystack);
    startPaystack(amount);
  });
});
