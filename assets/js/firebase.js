
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
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

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  doc,
  getDoc
};

export const ADMIN_EMAILS = [
  "dr.tamer@egns.com",
  "dr.ahmedbassam@egns.com"
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(
    String(email || "").trim().toLowerCase()
  );
}

export function normalizeLoginIdentifier(identifier) {
  const value = String(identifier || "").trim();

  if (!value) {
    throw new Error("اكتب البريد الإلكتروني أو كود الحساب.");
  }

  if (value.includes("@")) {
    return value.toLowerCase();
  }

  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(value)) {
    throw new Error("كود الحساب غير صالح.");
  }

  return `${value.toLowerCase()}@accounts.egns.com`;
}

const DASHBOARDS = {
  owner: "admin.html",
  director: "admin.html",
  student_affairs: "staff.html",
  exams_affairs: "staff.html",
  teacher: "teacher.html",
  student: "dashboard.html",
  employee: "staff.html",
  worker: "staff.html",
  parent: "parent.html"
};

export function getDashboardPath(role) {
  return DASHBOARDS[String(role || "").trim()] || null;
}

export async function getUserProfile(uid) {
  const profileRef = doc(db, "users", uid);
  const profileSnapshot = await getDoc(profileRef);

  return profileSnapshot.exists()
    ? profileSnapshot.data()
    : null;
}
