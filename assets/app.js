let currentUser = null;
let currentProfile = null;
let products = [];
let sales = [];
let movements = [];
let settings = { monthly_rent: 0 };

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function showMessage(id, text, type = "success") {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="${type}">${text}</div>`;
  setTimeout(() => el.innerHTML = "", 5000);
}

function isSupervisor() {
  return currentProfile && currentProfile.role === "supervisor";
}

function openPanel(panelId) {
  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.remove("active-panel");
  });

  const selected = document.getElementById(panelId);
  if (selected) selected.classList.add("active-panel");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const clicked = Array.from(document.querySelectorAll(".nav-btn"))
    .find(btn => btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(panelId));

  if (clicked) clicked.classList.add("active");
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage("loginMessage", error.message, "error");
    return;
  }

  currentUser = data.user;
  await loadProfile();
  await loadAll();
  render();
  openPanel("dashboardPanel");
}

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    alert("Profile not found. Add this user to the profiles table.");
    await logout();
    return;
  }

  currentProfile = data;
}

async function loadAll() {
  await Promise.all([
    loadProducts(),
    loadSales(),
    loadMovements(),
    loadSettings()
  ]);
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (!error) products = data || [];
}

async function loadSales() {
  const { data, error } = await supabaseClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!error) sales = data || [];
}

async function loadMovements() {
  const { data, error } = await supabaseClient
    .from("stock_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!error) movements = data || [];
}

async function loadSettings() {
  const { data, error } = await supabaseClient
    .from("settings")
    .select("*")
    .eq("setting_key", "monthly_rent")
    .single();

  if (!error && data) settings.monthly_rent = Number(data.setting_value || 0);
}

async function recordSale() {
  const productId = document.getElementById("saleProduct").value;
  const quantity = Number(document.getElementById("saleQuantity").value);

  if (!productId || quantity <= 0) {
    showMessage("saleMessage", "Select product and enter valid quantity.", "error");
    return;
  }

  const { error } = await supabaseClient.rpc("record_sale_rpc", {
    p_product_id: productId,
    p_quantity: quantity
  });

  if (error) {
    showMessage("saleMessage", error.message, "error");
    return;
  }

  document.getElementById("saleQuantity").value = "";
  showMessage("saleMessage", "Sale recorded successfully.");
  await loadAll();
  render();
}

async function receiveStock() {
  if (!isSupervisor()) return;

  const name = document.getElementById("productName").value.trim();
  const cost = Number(document.getElementById("costPrice").value);
  const selling = Number(document.getElementById("sellingPrice").value);
  const quantity = Number(document.getElementById("quantity").value);
  const alertLevel = Number(document.getElementById("alertLevel").value);

  const { error } = await supabaseClient.rpc("receive_stock_rpc", {
    p_name: name,
    p_cost_price: cost,
    p_selling_price: selling,
    p_quantity: quantity,
    p_alert_level: alertLevel
  });

  if (error) {
    showMessage("stockMessage", error.message, "error");
    return;
  }

  document.getElementById("productName").value = "";
  document.getElementById("costPrice").value = "";
  document.getElementById("sellingPrice").value = "";
  document.getElementById("quantity").value = "";
  document.getElementById("alertLevel").value = "5";

  showMessage("stockMessage", "Stock received successfully.");
  await loadAll();
  render();
}

async function deductStock() {
  if (!isSupervisor()) return;

  const productId = document.getElementById("deductProduct").value;
  const quantity = Number(document.getElementById("deductQuantity").value);
  const reason = document.getElementById("deductReason").value.trim();

  const { error } = await supabaseClient.rpc("deduct_stock_rpc", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reason: reason
  });

  if (error) {
    alert(error.message);
    return;
  }

  document.getElementById("deductQuantity").value = "";
  document.getElementById("deductReason").value = "";
  await loadAll();
  render();
}

async function stockTake() {
  if (!isSupervisor()) return;

  const productId = document.getElementById("stockTakeProduct").value;
  const actualQuantity = Number(document.getElementById("stockTakeQuantity").value);

  const { error } = await supabaseClient.rpc("stock_take_rpc", {
    p_product_id: productId,
    p_actual_quantity: actualQuantity
  });

  if (error) {
    alert(error.message);
    return;
  }

  document.getElementById("stockTakeQuantity").value = "";
  await loadAll();
  render();
}

async function saveSettings() {
  if (!isSupervisor()) return;

  const monthlyRent = Number(document.getElementById("monthlyRent").value || 0);

  const { error } = await supabaseClient
    .from("settings")
    .update({ setting_value: monthlyRent, updated_at: new Date().toISOString() })
    .eq("setting_key", "monthly_rent");

  if (error) {
    alert(error.message);
    return;
  }

  settings.monthly_rent = monthlyRent;
  alert("Settings saved.");
  render();
}

async function changePassword() {
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  if (!oldPassword || !newPassword || !confirmNewPassword) {
    showMessage("passwordMessage", "Fill in all password fields.", "error");
    return;
  }

  if (newPassword.length < 6) {
    showMessage("passwordMessage", "New password must be at least 6 characters.", "error");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showMessage("passwordMessage", "New passwords do not match.", "error");
    return;
  }

  const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
    email: currentUser.email,
    password: oldPassword
  });

  if (verifyError) {
    showMessage("passwordMessage", "Old password is incorrect.", "error");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    showMessage("passwordMessage", error.message, "error");
    return;
  }

  document.getElementById("oldPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmNewPassword").value = "";

  showMessage("passwordMessage", "Password changed successfully.");
}

function getPeriodSales(period) {
  const now = new Date();

  return sales.filter(s => {
    const d = new Date(s.created_at);

    if (period === "daily") return d.toDateString() === now.toDateString();

    if (period === "weekly") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return d >= sevenDaysAgo && d <= now;
    }

    if (period === "monthly") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }

    return false;
  });
}

function calculateReport(period) {
  const periodSales = getPeriodSales(period);
  const revenue = periodSales.reduce((sum, s) => sum + Number(s.revenue), 0);
  const productCost = periodSales.reduce((sum, s) => sum + Number(s.product_cost), 0);
  const grossProfit = periodSales.reduce((sum, s) => sum + Number(s.gross_profit), 0);

  const monthlyRent = Number(settings.monthly_rent || 0);
  const dailyRent = monthlyRent / 30;
  const rent = period === "daily" ? dailyRent : period === "weekly" ? dailyRent * 7 : monthlyRent;
  const netProfit = grossProfit - rent;

  const productTotals = {};
  periodSales.forEach(s => {
    productTotals[s.product_name] = (productTotals[s.product_name] || 0) + Number(s.quantity);
  });

  let topProduct = "No sales yet";
  let highestQty = 0;

  Object.entries(productTotals).forEach(([name, qty]) => {
    if (qty > highestQty) {
      highestQty = qty;
      topProduct = `${name} (${qty} sold)`;
    }
  });

  const averageProfitPerDay =
    period === "daily" ? netProfit :
    period === "weekly" ? netProfit / 7 :
    netProfit / 30;

  return { revenue, productCost, grossProfit, rent, netProfit, averageProfitPerDay, topProduct, numberOfSales: periodSales.length };
}

function showReport(period) {
  const report = calculateReport(period);

  document.getElementById("report").innerHTML = `
    <h3>${period.charAt(0).toUpperCase() + period.slice(1)} Report</h3>
    <div class="metrics">
      <div class="metric">Sales Revenue<strong>${money(report.revenue)}</strong></div>
      <div class="metric">Product Cost<strong>${money(report.productCost)}</strong></div>
      <div class="metric">Gross Profit<strong>${money(report.grossProfit)}</strong></div>
      <div class="metric">Rent Deducted<strong>${money(report.rent)}</strong></div>
      <div class="metric">Net Profit<strong>${money(report.netProfit)}</strong></div>
      <div class="metric">Average Profit / Day<strong>${money(report.averageProfitPerDay)}</strong></div>
      <div class="metric">Most Sought Product<strong>${report.topProduct}</strong></div>
      <div class="metric">Number of Sales<strong>${report.numberOfSales}</strong></div>
    </div>
  `;
}

function fillDropdowns() {
  const ids = ["saleProduct", "deductProduct", "stockTakeProduct"];

  ids.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = "";

    products.forEach(p => {
      select.innerHTML += `<option value="${p.id}">${p.name} — ${p.quantity} left — ${money(p.selling_price)}</option>`;
    });
  });
}

function render() {
  if (!currentUser || !currentProfile) return;

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  document.getElementById("userInfo").textContent = `${currentProfile.full_name} — ${currentProfile.role}`;

  document.querySelectorAll(".supervisor-only").forEach(el => {
    el.classList.toggle("hidden", !isSupervisor());
  });

  fillDropdowns();

  document.getElementById("productCount").textContent = products.length;
  document.getElementById("monthlyRent").value = settings.monthly_rent || 0;

  const today = calculateReport("daily");
  document.getElementById("todaySales").textContent = money(today.revenue);
  document.getElementById("todayProfit").textContent = money(today.netProfit);
  document.getElementById("topProduct").textContent = today.topProduct;

  const alerts = document.getElementById("alerts");
  alerts.innerHTML = "";

  products.forEach(p => {
    if (Number(p.quantity) <= Number(p.alert_level)) {
      alerts.innerHTML += `<div class="alert">${p.name} has only ${p.quantity} left. Restock soon.</div>`;
    }
  });

  if (!alerts.innerHTML) {
    alerts.innerHTML = `<div class="good">All products have enough stock.</div>`;
  }

  const stockTable = document.getElementById("stockTable");
  stockTable.innerHTML = "";

  products.forEach(p => {
    stockTable.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${money(p.cost_price)}</td>
        <td>${money(p.selling_price)}</td>
        <td>${p.quantity}</td>
        <td>${p.alert_level}</td>
      </tr>
    `;
  });

  const salesTable = document.getElementById("salesTable");
  salesTable.innerHTML = "";

  sales.slice(0, 50).forEach(s => {
    salesTable.innerHTML += `
      <tr>
        <td>${new Date(s.created_at).toLocaleString()}</td>
        <td>${s.product_name}</td>
        <td>${s.quantity}</td>
        <td>${money(s.revenue)}</td>
        <td>${money(s.gross_profit)}</td>
      </tr>
    `;
  });

  const movementTable = document.getElementById("movementTable");
  movementTable.innerHTML = "";

  movements.slice(0, 50).forEach(m => {
    movementTable.innerHTML += `
      <tr>
        <td>${new Date(m.created_at).toLocaleString()}</td>
        <td>${m.movement_type}</td>
        <td>${m.product_name}</td>
        <td>${m.quantity_change}</td>
        <td>${m.reason || ""}</td>
      </tr>
    `;
  });

  openPanel("dashboardPanel");
}

async function init() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    await loadProfile();
    await loadAll();
    render();
  }
}

init();
