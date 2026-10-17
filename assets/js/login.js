
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  isAdminEmail,
  normalizeLoginIdentifier,
  getDashboardPath
} from "./firebase.js";

const form = document.getElementById("loginForm");
const identifierInput = document.getElementById("identifier");
const passwordInput = document.getElementById("password");
const message = document.getElementById("loginMessage");

function showMessage(text, type = "error") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
  message.hidden = false;
}

function normalizeCode(value) {
  return String(value || "").trim().toLowerCase();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = identifierInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (!identifier || !password) {
    showMessage("اكتب بيانات الدخول كاملة.");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');

  try {
    if (submitButton) submitButton.disabled = true;
    if (message) message.hidden = true;

    const email = normalizeLoginIdentifier(identifier);

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;
    let role;
    let dashboard;

    if (isAdminEmail(user.email)) {
      // حسابات الإدارة المحددة مسبقًا فقط.
      role = user.email.toLowerCase() === "dr.tamer@egns.com"
        ? "owner"
        : "director";

      dashboard = getDashboardPath(role);
    } else {
      const snapshot = await getDoc(doc(db, "users", user.uid));

      if (!snapshot.exists()) {
        throw new Error("لا يوجد ملف صلاحيات لهذا الحساب. تواصل مع إدارة المدرسة.");
      }

      const profile = snapshot.data();

      if (profile.active !== true) {
        throw new Error("هذا الحساب غير نشط. تواصل مع إدارة المدرسة.");
      }

      // لا نسمح بالدخول بكود لا يطابق ملف المستخدم.
      if (
        !identifier.includes("@") &&
        normalizeCode(profile.loginCode) !== normalizeCode(identifier)
      ) {
        throw new Error("كود الحساب غير مطابق للملف المسجل.");
      }

      role = String(profile.role || "").trim();
      dashboard = getDashboardPath(role);

      if (!dashboard) {
        throw new Error("صلاحية الحساب غير صحيحة. راجع إدارة المدرسة.");
      }
    }

    window.location.replace(dashboard);
  } catch (error) {
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }

    const knownErrors = {
      "auth/invalid-credential": "بيانات الدخول غير صحيحة.",
      "auth/user-not-found": "بيانات الدخول غير صحيحة.",
      "auth/wrong-password": "بيانات الدخول غير صحيحة.",
      "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
      "auth/network-request-failed": "تعذر الاتصال. تحقق من الإنترنت."
    };

    showMessage(
      knownErrors[error.code] ||
      error.message ||
      "تعذر تسجيل الدخول. حاول مرة أخرى."
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});
