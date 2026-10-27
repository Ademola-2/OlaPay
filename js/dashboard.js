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
    list.replaceChildren();
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
  await Promise.all([loadWallet(user.uid), loadTransactions(user.uid)]);
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
byId("fundWalletButton").addEventListener("click", () => showToast("Wallet funding is not live yet. It will be connected after secure payment setup."));
document.querySelectorAll("[data-service]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.service + " purchases are coming soon. No payment has been made."));
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