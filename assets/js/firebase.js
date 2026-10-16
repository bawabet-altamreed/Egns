
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5ODDwC3w9ZsHcAAGGdipl3oUNvlUG9Tw",
  authDomain: "egns-99c3b.firebaseapp.com",
  projectId: "egns-99c3b",
  storageBucket: "egns-99c3b.firebasestorage.app",
  messagingSenderId: "920048533301",
  appId: "1:920048533301:web:9ffceba997d6db9426567c",
  measurementId: "G-9DRZGZJHEV"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export { signInWithEmailAndPassword, signOut };

export const ADMIN_EMAILS = [
  "dr.tamer@egns.com",
  "dr.ahmedbassam@egns.com"
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase().trim());
}
