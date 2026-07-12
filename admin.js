const ADMIN_EMAIL = "antony.mwangi.dev@gmail.com";

let supabase = null;
let payments = [];

function getClient() {
  const config = window.SUPABASE_CONFIG;
  if (!config?.url || !config?.anonKey) {
    throw new Error("Supabase config is missing.");
  }
  return window.supabase.createClient(config.url, config.anonKey);
}

function formatKes(amount) {
  return `KSh ${Number(amount).toLocaleString()}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusBadge(status) {
  return `<span class="badge badge--${status}">${status}</span>`;
}

function showLogin() {
  document.getElementById("login-panel").hidden = false;
  document.getElementById("dashboard").hidden = true;
}

function showDashboard() {
  document.getElementById("login-panel").hidden = true;
  document.getElementById("dashboard").hidden = false;
}

function setLoginError(message) {
  const el = document.getElementById("login-error");
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setEditError(message) {
  const el = document.getElementById("edit-error");
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function updateStats(rows) {
  document.getElementById("stat-total").textContent = String(rows.length);
  document.getElementById("stat-success").textContent = String(
    rows.filter((row) => row.status === "success").length,
  );
  document.getElementById("stat-pending").textContent = String(
    rows.filter((row) => row.status === "pending").length,
  );
  const balance = rows
    .filter((row) => row.status === "success")
    .reduce((sum, row) => sum + Number(row.balance || 0), 0);
  document.getElementById("stat-balance").textContent = formatKes(balance);
}

function renderPayments() {
  const filter = document.getElementById("status-filter").value;
  const tbody = document.getElementById("payments-body");
  const rows = payments.filter((row) => filter === "all" || row.status === filter);

  updateStats(payments);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">No payments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td><strong>${row.student_name}</strong></td>
        <td>
          ${row.email}<br />
          <small>${row.phone}</small>
        </td>
        <td>${formatKes(row.amount_paid)}</td>
        <td>${formatKes(row.balance)}</td>
        <td>${row.payment_type}</td>
        <td>${statusBadge(row.status)}</td>
        <td><small>${row.paystack_reference}</small></td>
        <td><small>${formatDate(row.created_at)}</small></td>
        <td><button type="button" class="btn btn--ghost btn--small" data-edit="${row.id}">Edit</button></td>
      </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openEditModal(button.dataset.edit));
  });
}

async function loadPayments() {
  const tbody = document.getElementById("payments-body");
  tbody.innerHTML = `<tr><td colspan="9" class="empty">Loading payments...</td></tr>`;

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">${error.message}</td></tr>`;
    return;
  }

  payments = data || [];
  renderPayments();
}

function openEditModal(id) {
  const payment = payments.find((row) => row.id === id);
  if (!payment) return;

  document.getElementById("edit-id").value = payment.id;
  document.getElementById("edit-name").value = payment.student_name;
  document.getElementById("edit-email").value = payment.email;
  document.getElementById("edit-phone").value = payment.phone;
  document.getElementById("edit-amount").value = String(payment.amount_paid);
  document.getElementById("edit-balance").value = String(payment.balance);
  document.getElementById("edit-type").value = payment.payment_type;
  document.getElementById("edit-status").value = payment.status;
  setEditError("");
  document.getElementById("edit-modal").showModal();
}

function syncTypeFromAmount() {
  const amount = Number(document.getElementById("edit-amount").value);
  document.getElementById("edit-type").value = amount === 999 ? "deposit" : "full";
  document.getElementById("edit-balance").value = amount === 999 ? "1500" : "0";
}

async function initSession() {
  supabase = getClient();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user?.email?.toLowerCase() === ADMIN_EMAIL) {
    showDashboard();
    await loadPayments();
    return;
  }
  showLogin();
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");

  const form = event.currentTarget;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;

  if (email !== ADMIN_EMAIL) {
    setLoginError("This account is not authorized for admin access.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setLoginError(error.message);
    return;
  }

  showDashboard();
  await loadPayments();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
});

document.getElementById("refresh-btn").addEventListener("click", loadPayments);
document.getElementById("status-filter").addEventListener("change", renderPayments);
document.getElementById("edit-amount").addEventListener("change", syncTypeFromAmount);

document.getElementById("close-modal").addEventListener("click", () => {
  document.getElementById("edit-modal").close();
});

document.getElementById("cancel-edit").addEventListener("click", () => {
  document.getElementById("edit-modal").close();
});

document.getElementById("edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setEditError("");

  const id = document.getElementById("edit-id").value;
  const amount = Number(document.getElementById("edit-amount").value);
  const balance = Number(document.getElementById("edit-balance").value);
  const paymentType = document.getElementById("edit-type").value;

  const payload = {
    student_name: document.getElementById("edit-name").value.trim(),
    email: document.getElementById("edit-email").value.trim().toLowerCase(),
    phone: document.getElementById("edit-phone").value.trim(),
    amount_paid: amount,
    balance,
    payment_type: paymentType,
    status: document.getElementById("edit-status").value,
  };

  const { error } = await supabase.from("payments").update(payload).eq("id", id);
  if (error) {
    setEditError(error.message);
    return;
  }

  document.getElementById("edit-modal").close();
  await loadPayments();
});

initSession().catch((error) => {
  setLoginError(error.message);
  showLogin();
});
