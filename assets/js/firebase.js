import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, limit, orderBy, serverTimestamp
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  serverTimestamp
};

export const ADMIN_EMAILS = [
  "dr.tamer@egns.com",
  "dr.ahmedbassam@egns.com"
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function normalizeLoginIdentifier(identifier) {
  const value = String(identifier || "").trim().toLowerCase();

  if (!value) {
    throw new Error("اكتب البريد الإلكتروني أو كود الحساب.");
  }

  if (value.includes("@")) return value;

  if (!/^[a-z0-9._-]{3,64}$/.test(value)) {
    throw new Error("كود الحساب غير صالح.");
  }

  return `${value}@accounts.egns.com`;
}

export function getDashboardPath(role) {
  const paths = {
    owner: "admin.html",
    director: "admin.html",
    admin: "admin.html",
    student: "dashboard.html",
    teacher: "teacher.html",
    employee: "staff.html",
    worker: "staff.html",
    student_affairs: "staff.html",
    exams_affairs: "staff.html",
    parent: "parent.html"
  };

  return paths[String(role || "").trim()] || null;
}
