import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const byId = (id) => document.getElementById(id);
const toast = byId("toastMessage");
let toastTimer;
function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3300);
}
function safeText(value, fallback = "Customer") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function firstName(fullName) {
  return safeText(fullName, "there").split(/\s+/)[0];
}
function setCustomer(user, profile = {}) {
  const name = safeText(profile.displayName || user.displayName || user.email?.split("@")[0], "Customer");
  const email = safeText(profile.email || user.email, "Email not available");
  const initial = name.charAt(0).toUpperCase();
  byId("welcomeName").textContent = firstName(name);
  byId("headerName").textContent = name;
  byId("headerAvatar").textContent = initial;
  byId("profileAvatar").textContent = initial;
  byId("profileName").textContent = name;
  byId("profileEmail").textContent = email;
}
function formatDate(value) {
  if (!value) return "—";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function formatNaira(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(amount) : "—";
}
const DEMO_STORAGE_PREFIX = "olapay_demo_wallet_v1:";
function demoStorageKey(uid) { return DEMO_STORAGE_PREFIX + uid; }
function readDemoWallet(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(demoStorageKey(uid)) || "null");
    if (!parsed || typeof parsed.balance !== "number" || !Array.isArray(parsed.transactions)) {
      return { balance: 0, transactions: [] };
    }
    return { balance: Math.max(0, parsed.balance), transactions: parsed.transactions.slice(0, 20) };
  } catch {
    return { balance: 0, transactions: [] };
  }
}
function writeDemoWallet(uid, wallet) {
  localStorage.setItem(demoStorageKey(uid), JSON.stringify(wallet));
}
function renderDemoTransactions(uid) {
  const list = byId("transactionList");
  list.querySelectorAll(".demo-transaction-row").forEach((row) => row.remove());
  const wallet = readDemoWallet(uid);
  if (!wallet.transactions.length) return;
  const empty = list.querySelector(".empty-transactions");
  if (empty) empty.remove();
  wallet.transactions.forEach((transaction) => {
    const row = document.createElement("div");
    row.className = "transaction-row demo-transaction-row";
    const name = document.createElement("span");
    name.className = "transaction-name";
    const icon = document.createElement("i");
    icon.className = "bi bi-flask";
    name.append(icon, document.createTextNode(transaction.description));
    const date = document.createElement("span");
    date.className = "transaction-date";
    date.textContent = formatDate(transaction.createdAt);
    const status = document.createElement("span");
    status.className = "transaction-status";
    status.textContent = "DEMO";
    const amount = document.createElement("span");
    amount.className = "transaction-amount";
    amount.textContent = "+ " + formatNaira(transaction.amount);
    amount.style.color = "#07885e";
    row.append(name, date, status, amount);
    list.prepend(row);
  });
}
function loadDemoWallet(uid) {
  const wallet = readDemoWallet(uid);
  byId("walletBalance").textContent = formatNaira(wallet.balance);
  byId("walletNote").textContent = "Demo funds only. Not real money and cannot be spent.";
  const status = document.querySelector(".wallet-status");
  if (status) status.innerHTML = '<span></span> Demo only';
  renderDemoTransactions(uid);
}
let activeDemoUid = null;
const demoModal = byId("demoWalletModal");
function openDemoModal() {
  if (!activeDemoUid) { showToast("Please wait while your account loads."); return; }
  demoModal.hidden = false;
  document.body.style.overflow = "hidden";
  byId("demoAmount").focus();
}
function closeDemoModal() {
  demoModal.hidden = true;
  document.body.style.overflow = "";
}
async function loadWallet(uid) {
  try {
    const snapshot = await getDoc(doc(db, "wallets", uid));
    if (!snapshot.exists()) return;
    const wallet = snapshot.data();
    if (typeof wallet.balance === "number" && Number.isFinite(wallet.balance)) {
      byId("walletBalance").textContent = formatNaira(wallet.balance);
      byId("walletNote").textContent = "Balance shown from your wallet record.";
      document.querySelector(".wallet-status").innerHTML = '<span></span> Wallet record found';
    }
  } catch (error) {
    console.warn("OlaPay wallet read:", error.code || error.message);
  }
}
async function loadTransactions(uid) {
  const list = byId("transactionList");
  try {
    const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", uid), limit(5));
    const snapshot = await getDocs(transactionsQuery);
    if (snapshot.empty) return;
    list.querySelectorAll(".transaction-row:not(.demo-transaction-row)").forEach((row) => row.remove());
    const empty = list.querySelector(".empty-transactions");
    if (empty) empty.remove();
    snapshot.forEach((item) => {
      const data = item.data();
      const row = document.createElement("div");
      row.className = "transaction-row";
      const name = document.createElement("span");
      name.className = "transaction-name";
      const icon = document.createElement("i");
      icon.className = "bi bi-receipt";
      name.append(icon, document.createTextNode(safeText(data.description || data.type, "Transaction")));
      const date = document.createElement("span");
      date.className = "transaction-date";
      date.textContent = formatDate(data.createdAt);
      const status = document.createElement("span");
      status.className = "transaction-status";
      status.textContent = safeText(data.status, "Pending");
      const amount = document.createElement("span");
      amount.className = "transaction-amount";
      amount.textContent = typeof data.amount === "number" ? formatNaira(data.amount) : "—";
      row.append(name, date, status, amount);
      list.append(row);
    });
  } catch (error) {
    console.warn("OlaPay transaction read:", error.code || error.message);
    list.innerHTML = '<div class="empty-transactions"><span class="empty-icon"><i class="bi bi-shield-lock"></i></span><strong>History is not available yet</strong><p>Your account is safe. Transaction history will be enabled with the backend.</p></div>';
  }
}

byId("todayDate").textContent = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date());
byId("year").textContent = new Date().getFullYear();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("auth.html#loginPane");
    return;
  }
  setCustomer(user);
  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    if (profileSnapshot.exists()) setCustomer(user, profileSnapshot.data());
  } catch (error) {
    console.warn("OlaPay profile read:", error.code || error.message);
    showToast("You are signed in, but your profile details could not be loaded.");
  }
  activeDemoUid = user.uid;
  await Promise.all([loadDemoWallet(user.uid), loadTransactions(user.uid)]);
});

byId("logoutButton").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("auth.html#loginPane");
  } catch (error) {
    console.error("OlaPay logout error:", error.code || error.message);
    showToast("Could not log out. Please try again.");
  }
});
byId("fundWalletButton").addEventListener("click", openDemoModal);
byId("closeDemoModal").addEventListener("click", closeDemoModal);
demoModal.addEventListener("click", (event) => { if (event.target === demoModal) closeDemoModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !demoModal.hidden) closeDemoModal(); });
document.querySelectorAll("[data-demo-amount]").forEach((button) => {
  button.addEventListener("click", () => { byId("demoAmount").value = button.dataset.demoAmount; });
});
byId("demoFundingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!activeDemoUid) { showToast("Please wait while your account loads."); return; }
  const amount = Number(byId("demoAmount").value);
  const method = new FormData(event.currentTarget).get("method");
  if (!Number.isFinite(amount) || amount < 100 || amount > 50000 || amount % 50 !== 0) {
    showToast("Enter an amount from ₦100 to ₦50,000 in ₦50 increments.");
    return;
  }
  const wallet = readDemoWallet(activeDemoUid);
  wallet.balance = Math.round((wallet.balance + amount) * 100) / 100;
  wallet.transactions.unshift({
    description: "Demo funding · " + (method === "Card simulation" ? "Card" : "Bank transfer"),
    amount,
    createdAt: new Date().toISOString()
  });
  wallet.transactions = wallet.transactions.slice(0, 10);
  try {
    writeDemoWallet(activeDemoUid, wallet);
    byId("walletBalance").textContent = formatNaira(wallet.balance);
    byId("walletNote").textContent = "Demo funds only. Not real money and cannot be spent.";
    renderDemoTransactions(activeDemoUid);
    closeDemoModal();
    event.currentTarget.reset();
    showToast("Demo funding successful. No real payment was made.");
  } catch (error) {
    console.warn("Demo wallet storage unavailable:", error);
    showToast("Demo wallet could not save in this browser. Check browser storage settings.");
  }
});
const airtimeModal = byId("airtimeModal");
function openAirtimeModal() {
  airtimeModal.hidden = false;
  document.body.style.overflow = "hidden";
  byId("airtimeNetwork").focus();
}
function closeAirtimeModal() {
  airtimeModal.hidden = true;
  document.body.style.overflow = "";
}
function updateAirtimeSummary() {
  const amount = Number(byId("airtimeAmount").value);
  byId("airtimeSummary").querySelector("strong").textContent = formatNaira(Number.isFinite(amount) && amount > 0 ? amount : 0);
}
document.querySelectorAll("[data-airtime-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    byId("airtimeAmount").value = button.dataset.airtimeAmount;
    updateAirtimeSummary();
  });
});
byId("airtimeAmount").addEventListener("input", updateAirtimeSummary);
byId("closeAirtimeModal").addEventListener("click", closeAirtimeModal);
airtimeModal.addEventListener("click", (event) => { if (event.target === airtimeModal) closeAirtimeModal(); });
byId("airtimeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const network = byId("airtimeNetwork").value;
  const phone = byId("airtimePhone").value.trim();
  const amount = Number(byId("airtimeAmount").value);
  if (!network) { showToast("Choose a mobile network."); return; }
  if (!/^0\\d{10}$/.test(phone)) { showToast("Enter a valid 11-digit Nigerian phone number."); return; }
  if (!Number.isFinite(amount) || amount < 50 || amount > 50000 || amount % 50 !== 0) {
    showToast("Enter an amount from ₦50 to ₦50,000 in ₦50 increments.");
    return;
  }
  closeAirtimeModal();
  showToast("Preview ready: " + network + " airtime for " + phone + " — " + formatNaira(amount) + ". No payment was made.");
  event.currentTarget.reset();
  updateAirtimeSummary();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !airtimeModal.hidden) closeAirtimeModal(); });
document.querySelectorAll("[data-service]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.service === "Airtime") {
      openAirtimeModal();
      return;
    }
    showToast(button.dataset.service + " purchases are coming soon. No payment has been made.");
  });
});
byId("mobileMenu").addEventListener("click", () => byId("sidebar").classList.toggle("open"));
document.querySelectorAll(".side-link[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    byId("sidebar").classList.remove("open");
    document.querySelectorAll(".side-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});
document.addEventListener("click", (event) => {
  const sidebar = byId("sidebar");
  if (window.innerWidth <= 767 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && !byId("mobileMenu").contains(event.target)) {
    sidebar.classList.remove("open");
  }
});