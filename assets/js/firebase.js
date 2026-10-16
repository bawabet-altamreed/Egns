
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
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
  doc,
  getDoc
};

export const ADMIN_EMAILS = [
  "dr.tamer@egns.com",
  "dr.ahmedbassam@egns.com"
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(
    (email || "").trim().toLowerCase()
  );
}

// توحيد طريقة تحويل كود المستخدم إلى بريد تسجيل الدخول
export function normalizeLoginIdentifier(identifier) {
  const value = (identifier || "").trim().toLowerCase();

  if (value.includes("@")) {
    return value;
  }

  return `${value}@students.egns.com`;
}

// جلب دور المستخدم من قاعدة البيانات
export async function getUserProfile(uid) {
  const profileRef = doc(db, "users", uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    return null;
  }

  return profileSnap.data();
}

// تحديد لوحة المستخدم من دوره
export function getDashboardPath(role) {
  const dashboards = {
    owner: "admin.html",
    admin: "admin.html",
    school_director: "director-dashboard.html",
    student_affairs: "student-affairs-dashboard.html",
    exams_affairs: "exams-dashboard.html",
    teacher: "teacher-dashboard.html",
    student: "student-dashboard.html",
    parent: "parent-dashboard.html",
    staff: "staff-dashboard.html"
  };

  return dashboards[role] || null;
}
