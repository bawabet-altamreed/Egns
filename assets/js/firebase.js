
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

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

// حسابات الإدارة العليا المعتمدة.
export const ADMIN_EMAILS = [
  "dr.tamer@egns.com",
  "dr.ahmedbassam@egns.com"
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(
    String(email || "").trim().toLowerCase()
  );
}

/*
  البريد الإلكتروني يدخل كما هو.
  الكود لا يتحول تلقائيًا إلى حساب طالب؛
  بل يُبحث عنه في users.loginCode.
*/
export function normalizeLoginIdentifier(identifier) {
  const value = String(identifier || "").trim();

  if (value.includes("@")) {
    return value.toLowerCase();
  }

  // هذه علامة مؤقتة حتى نربط الأكواد بحسابات Firebase.
  // لا تنشئ حسابًا ولا تمنح صلاحيات.
  throw new Error(
    "تسجيل الدخول بالكود يحتاج إلى ربط الكود بحساب Firebase. سنجهّز هذا الربط في الخطوة التالية."
  );
}

// الدور هو الذي يحدد اللوحة، وليس اختيار المستخدم.
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

// جلب ملف المستخدم من Firestore.
export async function getUserProfile(uid) {
  const profileRef = doc(db, "users", uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    return null;
  }

  return profileSnapshot.data();
}
