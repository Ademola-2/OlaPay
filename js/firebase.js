// OlaPay Firebase client setup.
// Firebase web config is intended for client-side use; protect data with Security Rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLNxr8sJh8ecOC5ki7CSwNd4A6eTRiMc0",
  authDomain: "olapay-dcf9f.firebaseapp.com",
  projectId: "olapay-dcf9f",
  storageBucket: "olapay-dcf9f.firebasestorage.app",
  messagingSenderId: "1049251992335",
  appId: "1:1049251992335:web:035431b38fbe777e9a647a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
