const express = require("express");
const crypto = require("node:crypto");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGINS = new Set([
  "https://ademola-2.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !FRONTEND_ORIGINS.has(origin)) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "20kb" }));

let db = null;
let firebaseAuth = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "olapay-dcf9f"
    });
    db = admin.firestore();
    firebaseAuth = admin.auth();
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not configured yet.");
  }
} catch (error) {
  console.error("Firebase Admin initialization failed:", error.message);
}

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "OlaPay API",
    status: "running",
    mode: "setup",
    firebaseAdminReady: Boolean(db && firebaseAuth),
    flutterwaveReady: Boolean(process.env.FLW_SECRET_KEY),
    message: "Payment endpoints require Firebase Admin and Flutterwave test credentials."
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

async function requireFirebaseUser(req, res, next) {
  if (!firebaseAuth || !db) {
    return res.status(503).json({ error: "Backend authentication is not configured yet." });
  }
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Sign in is required." });
  try {
    req.firebaseUser = await firebaseAuth.verifyIdToken(match[1]);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }
}

function validFundingAmount(value) {
  return Number.isFinite(value) && value >= 100 && value <= 50000 && value % 50 === 0;
}

async function flutterwaveRequest(path, options = {}) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error("Flutterwave is not configured.");
  const response = await fetch("https://api.flutterwave.com/v3" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status !== "success") {
    const error = new Error("Flutterwave request failed.");
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

app.post("/payments/initialize", requireFirebaseUser, async (req, res) => {
  if (!process.env.FLW_SECRET_KEY) {
    return res.status(503).json({ error: "Flutterwave test key is not configured." });
  }
  const amount = Number(req.body && req.body.amount);
  if (!validFundingAmount(amount)) {
    return res.status(400).json({ error: "Enter an amount from ₦100 to ₦50,000 in ₦50 increments." });
  }

  const uid = req.firebaseUser.uid;
  const email = req.firebaseUser.email;
  if (!email) return res.status(400).json({ error: "Your account must have an email address." });

  const txRef = "OLAPAY-" + Date.now() + "-" + crypto.randomUUID();
  const paymentRef = db.collection("transactions").doc(txRef);
  const amountToCharge = Math.round(amount * 100) / 100;

  try {
    const profileSnap = await db.collection("users").doc(uid).get();
    const profile = profileSnap.exists ? profileSnap.data() : {};
    await paymentRef.create({
      userId: uid,
      type: "wallet_funding",
      description: "Wallet funding",
      amount: amountToCharge,
      currency: "NGN",
      status: "pending",
      provider: "flutterwave",
      txRef,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const checkout = await flutterwaveRequest("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amountToCharge,
        currency: "NGN",
        redirect_url: "https://ademola-2.github.io/OlaPay/dashboard.html",
        customer: {
          email,
          name: typeof profile.displayName === "string" ? profile.displayName : email.split("@")[0]
        },
        customizations: {
          title: "OlaPay Wallet Funding",
          description: "Add funds to your OlaPay wallet"
        },
        payment_options: "card, banktransfer, ussd",
        configurations: {
          session_duration: 10,
          max_retry_attempt: 3
        },
        meta: { userId: uid, purpose: "wallet_funding" }
      })
    });

    if (!checkout.data || !checkout.data.link) {
      await paymentRef.update({
        status: "initialization_failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(502).json({ error: "Could not create the checkout link. Please try again." });
    }
    await paymentRef.update({ checkoutCreated: true });
    return res.status(200).json({ checkoutUrl: checkout.data.link, tx_ref: txRef });
  } catch (error) {
    console.error("Payment initialization failed:", error.message);
    try {
      await paymentRef.set({
        userId: uid,
        type: "wallet_funding",
        description: "Wallet funding",
        amount: amountToCharge,
        currency: "NGN",
        status: "initialization_failed",
        provider: "flutterwave",
        txRef,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (_writeError) {}
    return res.status(502).json({ error: "Payment checkout could not be started. Please try again." });
  }
});

app.post("/payments/verify", requireFirebaseUser, async (req, res) => {
  if (!process.env.FLW_SECRET_KEY) {
    return res.status(503).json({ error: "Flutterwave test key is not configured." });
  }
  const txRef = typeof req.body?.tx_ref === "string" ? req.body.tx_ref : "";
  const transactionId = String(req.body?.transaction_id || "");
  if (!/^OLAPAY-[A-Za-z0-9-]{10,120}$/.test(txRef) || !/^\d{1,30}$/.test(transactionId)) {
    return res.status(400).json({ error: "Payment reference is missing or invalid." });
  }

  try {
    const paymentRef = db.collection("transactions").doc(txRef);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) return res.status(404).json({ error: "Payment record was not found." });
    const payment = paymentSnap.data();
    if (payment.userId !== req.firebaseUser.uid) {
      return res.status(403).json({ error: "This payment does not belong to your account." });
    }
    if (payment.status === "successful") {
      return res.status(200).json({ success: true, alreadyCredited: true, amount: payment.amount });
    }
    if (payment.status !== "pending") {
      return res.status(409).json({ error: "This payment is not awaiting verification." });
    }

    const verified = await flutterwaveRequest("/transactions/" + encodeURIComponent(transactionId) + "/verify", {
      method: "GET"
    });
    const tx = verified.data || {};
    const expectedAmount = Number(payment.amount);
    const paidAmount = Number(tx.amount);
    if (
      tx.status !== "successful" ||
      tx.tx_ref !== txRef ||
      String(tx.currency).toUpperCase() !== "NGN" ||
      !Number.isFinite(paidAmount) ||
      paidAmount < expectedAmount
    ) {
      return res.status(400).json({ error: "Payment has not been verified as successful. Your wallet was not credited." });
    }

    const result = await db.runTransaction(async (firestoreTx) => {
      const freshPaymentSnap = await firestoreTx.get(paymentRef);
      if (!freshPaymentSnap.exists) throw new Error("PAYMENT_NOT_FOUND");
      const freshPayment = freshPaymentSnap.data();
      if (freshPayment.userId !== req.firebaseUser.uid) throw new Error("PAYMENT_OWNER_MISMATCH");
      if (freshPayment.status === "successful") {
        return { alreadyCredited: true, balance: null };
      }
      if (freshPayment.status !== "pending") throw new Error("PAYMENT_NOT_PENDING");

      const walletRef = db.collection("wallets").doc(req.firebaseUser.uid);
      const walletSnap = await firestoreTx.get(walletRef);
      const currentBalance = walletSnap.exists && Number.isFinite(walletSnap.data().balance)
        ? walletSnap.data().balance
        : 0;
      const newBalance = Math.round((currentBalance + expectedAmount) * 100) / 100;

      firestoreTx.set(walletRef, {
        userId: req.firebaseUser.uid,
        balance: newBalance,
        currency: "NGN",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      firestoreTx.update(paymentRef, {
        status: "successful",
        providerTransactionId: String(tx.id || transactionId),
        providerReference: tx.flw_ref || null,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        creditedAmount: expectedAmount
      });
      return { alreadyCredited: false, balance: newBalance };
    });

    return res.status(200).json({
      success: true,
      alreadyCredited: result.alreadyCredited,
      amount: expectedAmount,
      balance: result.balance
    });
  } catch (error) {
    console.error("Payment verification failed:", error.message);
    return res.status(502).json({ error: "We could not verify this payment yet. Please refresh and try again." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OlaPay API listening on port ${PORT}`);
});
