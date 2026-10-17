
import {
  auth,
  signInWithEmailAndPassword,
  isAdminEmail,
  normalizeLoginIdentifier,
  getUserProfile,
  signOut
} from "./firebase.js";

const loginForm = document.getElementById("loginForm");
const identifierInput = document.getElementById("identifier");
const passwordInput = document.getElementById("password");
const loginMessage = document.getElementById("loginMessage");

function showMessage(message, isError = false) {
  if (!loginMessage) return;
  loginMessage.textContent = message;
  loginMessage.style.color = isError ? "#b8202f" : "#16845b";
  loginMessage.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;

  if (!identifier || !password) {
    showMessage("اكتب الإيميل أو كود الدخول وكلمة المرور.", true);
    return;
  }

  const submitButton = loginForm.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (submitButton) submitButton.disabled = true;
  showMessage("جارٍ تسجيل الدخول...");

  try {
    const email = normalizeLoginIdentifier(identifier);
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;
    const userEmail = (user.email || "").trim().toLowerCase();

    // الأدمن لا يحتاج إلى مستند users/{uid} للدخول إلى لوحة الإدارة.
    if (isAdminEmail(userEmail)) {
      showMessage("تم تسجيل الدخول. جارٍ فتح لوحة الإدارة...");
      window.location.replace("./admin.html");
      return;
    }

    // بقية الحسابات تحتاج إلى ملف مستخدم نشط.
    const profile = await getUserProfile(user.uid);

    if (!profile || profile.active !== true) {
      await signOut(auth);
      showMessage("الحساب غير مفعّل أو لا يوجد له ملف مستخدم.", true);
      return;
    }

    if (
      identifier.includes("@") === false &&
      profile.loginCode &&
      profile.loginCode.toLowerCase() !== identifier.toLowerCase()
    ) {
      await signOut(auth);
      showMessage("كود الدخول لا يطابق ملف المستخدم.", true);
      return;
    }

    const routes = {
      owner: "admin.html",
      director: "admin.html",
      student_affairs: "staff.html",
      exams_affairs: "staff.html",
      employee: "staff.html",
      worker: "staff.html",
      teacher: "teacher.html",
      student: "dashboard.html",
      parent: "parent.html"
    };

    const destination = routes[profile.role];

    if (!destination) {
      await signOut(auth);
      showMessage("لا توجد صفحة محددة لهذا الدور.", true);
      return;
    }

    showMessage("تم تسجيل الدخول. جارٍ فتح حسابك...");
    window.location.replace(`./${destination}`);

  } catch (error) {
    console.error("Login error:", error);
    const messages = {
      "auth/invalid-credential": "الإيميل أو كلمة المرور غير صحيحة.",
      "auth/user-not-found": "الحساب غير موجود.",
      "auth/wrong-password": "كلمة المرور غير صحيحة.",
      "auth/too-many-requests": "محاولات كثيرة. حاول لاحقًا.",
      "auth/network-request-failed": "تحقق من اتصال الإنترنت."
    };

    showMessage(
      messages[error.code] || `تعذر إكمال تسجيل الدخول: ${error.message}`,
      true
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});
