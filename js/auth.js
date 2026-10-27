import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const resetButton = document.getElementById("resetPassword");
const message = document.getElementById("authMessage");

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = "alert alert-" + type;
  message.hidden = false;
}
function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists for this email. Try logging in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/weak-password": "Choose a stronger password (at least 6 characters).",
    "auth/too-many-requests": "Too many attempts. Please wait a while and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection and try again."
  };
  return messages[error.code] || "Something went wrong. Please check your details and try again.";
}

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const button = signupForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        displayName: name,
        email,
        createdAt: serverTimestamp(),
        role: "customer"
      });
      showMessage("Account created successfully. Your OlaPay account is ready for the next setup stage.", "success");
      signupForm.reset();
    } catch (error) {
      showMessage(friendlyError(error), "danger");
    } finally {
      button.disabled = false;
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Repair the customer profile if Auth succeeded but the earlier profile write failed.
      const userRef = doc(db, "users", credential.user.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        await setDoc(userRef, {
          uid: credential.user.uid,
          displayName: credential.user.displayName || email.split("@")[0],
          email: credential.user.email || email,
          createdAt: serverTimestamp(),
          role: "customer"
        });
      }

      showMessage("You're logged in successfully, and your customer profile is ready. The customer dashboard is the next stage.", "success");
    } catch (error) {
      console.error("OlaPay login/profile error:", error.code, error.message);
      showMessage(friendlyError(error), "danger");
    } finally {
      button.disabled = false;
    }
  });
}

if (resetButton) {
  resetButton.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
      showMessage("Enter your email in the login form first, then tap Forgot password.", "warning");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showMessage("If an account exists for that email, a password-reset message has been sent.", "success");
    } catch (error) {
      showMessage(friendlyError(error), "danger");
    }
  });
}

if (window.location.hash === "#signupPane") {
  const signupTab = document.getElementById("signup-tab");
  if (signupTab && window.bootstrap) {
    window.bootstrap.Tab.getOrCreateInstance(signupTab).show();
  }
}
