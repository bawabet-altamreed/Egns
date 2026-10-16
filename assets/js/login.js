
import {
  auth,
  signInWithEmailAndPassword,
  isAdminEmail
} from "./firebase.js";

const form = document.getElementById("loginForm");
const adminTab = document.getElementById("adminTab");
const userTab = document.getElementById("userTab");
const emailField = document.getElementById("emailField");
const codeField = document.getElementById("codeField");
const emailInput = document.getElementById("email");
const codeInput = document.getElementById("schoolCode");
const passwordInput = document.getElementById("password");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");

let loginMode = "admin";

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
}

function setMode(mode) {
  loginMode = mode;
  const isAdmin = mode === "admin";

  emailField.hidden = !isAdmin;
  codeField.hidden = isAdmin;
  emailInput.required = isAdmin;
  codeInput.required = !isAdmin;

  adminTab.classList.toggle("active", isAdmin);
  userTab.classList.toggle("active", !isAdmin);
  submitButton.textContent = isAdmin
    ? "دخول الإدارة"
    : "دخول الطلاب والموظفين";

  message.className = "message";
}

adminTab.addEventListener("click", () => setMode("admin"));
userTab.addEventListener("click", () => setMode("user"));

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

function getSafeLoginEmail(code) {
  // حسابات الطلاب يجب إنشاؤها مسبقًا بهذا التنسيق في Firebase Auth.
  // الكود ليس بريدًا حقيقيًا ولا يُستخدم لاستقبال الرسائل.
  const normalized = normalizeCode(code);

  if (!/^[A-Z0-9-]{3,40}$/.test(normalized)) {
    throw new Error("تأكد من كتابة الكود المدرسي بصورة صحيحة.");
  }

  return `${normalized}@students.egns.com`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = passwordInput.value;
  let email = "";

  try {
    if (loginMode === "admin") {
      email = emailInput.value.trim().toLowerCase();

      if (!isAdminEmail(email)) {
        showMessage("هذا الحساب غير مسموح له بالدخول من بوابة الإدارة.");
        return;
      }
    } else {
      email = getSafeLoginEmail(codeInput.value);
    }

    submitButton.disabled = true;
    submitButton.textContent = "جارٍ التحقق...";
    message.className = "message";

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const actualEmail = (credential.user.email || "").toLowerCase();

    if (loginMode === "admin" && !isAdminEmail(actualEmail)) {
      await auth.signOut();
      showMessage("الحساب غير مصرح له بالإدارة.");
      return;
    }

    if (loginMode === "admin") {
      // لوحة الإدارة سننشئها في الخطوة التالية.
      window.location.href = "admin.html";
    } else {
      // لوحة المستخدمين سننشئها بعد تحديد بنية بيانات الطلاب.
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error("Login error:", error.code || error.message);

    const messages = {
      "auth/invalid-credential": "بيانات الدخول غير صحيحة.",
      "auth/user-not-found": "الحساب غير موجود أو بيانات الدخول غير صحيحة.",
      "auth/wrong-password": "بيانات الدخول غير صحيحة.",
      "auth/too-many-requests": "محاولات كثيرة. حاول مرة أخرى لاحقًا.",
      "auth/network-request-failed": "تعذر الاتصال. تحقق من الإنترنت."
    };

    showMessage(
      messages[error.code] ||
      error.message ||
      "تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى."
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = loginMode === "admin"
      ? "دخول الإدارة"
      : "دخول الطلاب والموظفين";
  }
});
