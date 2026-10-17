
import {
  auth,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  isAdminEmail,
  normalizeLoginIdentifier,
  getUserProfile,
  getDashboardPath
} from "./firebase.js";

const loginForm = document.getElementById("loginForm");
const identifierInput = document.getElementById("identifier");
const passwordInput = document.getElementById("password");
const loginMessage = document.getElementById("loginMessage");

function showMessage(message, isError = false) {
  if (!loginMessage) return;

  loginMessage.textContent = message;
  loginMessage.style.display = "block";
  loginMessage.style.color = isError ? "#b8202f" : "#16845b";
  loginMessage.classList.remove("hidden");
}

if (!loginForm || !identifierInput || !passwordInput) {
  console.error("Login form elements were not found.");
  showMessage("تعذر تحميل نموذج تسجيل الدخول. راجع login.html.", true);
} else {
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
      // تثبيت جلسة الدخول على المتصفح.
      await setPersistence(auth, browserLocalPersistence);

      const email = normalizeLoginIdentifier(identifier);

      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = credential.user;
      const userEmail = String(user.email || "")
        .trim()
        .toLowerCase();

      console.info("LOGIN SUCCESS", {
        uid: user.uid,
        email: userEmail,
        isAdmin: isAdminEmail(userEmail),
        currentUrl: window.location.href
      });

      // الأدمن يدخل مباشرة دون الحاجة إلى مستند users/{uid}.
      if (isAdminEmail(userEmail)) {
        showMessage("تم الدخول بنجاح. جارٍ فتح لوحة الإدارة...");

        window.location.replace(
          new URL("./admin.html", window.location.href).href
        );

        return;
      }

      // الحسابات الأخرى تحتاج ملف مستخدم نشطًا.
      const profile = await getUserProfile(user.uid);

      if (!profile || profile.active !== true) {
        await signOut(auth);

        showMessage(
          "الحساب غير مفعّل أو لا يوجد له ملف مستخدم نشط.",
          true
        );

        return;
      }

      // التحقق من كود الدخول عند استخدام الكود بدل الإيميل.
      if (
        !identifier.includes("@") &&
        profile.loginCode &&
        String(profile.loginCode).toLowerCase() !==
          identifier.toLowerCase()
      ) {
        await signOut(auth);

        showMessage("كود الدخول لا يطابق ملف المستخدم.", true);
        return;
      }

      const destination = getDashboardPath(profile.role);

      if (!destination) {
        await signOut(auth);

        showMessage("لا توجد صفحة محددة لهذا الدور.", true);
        return;
      }

      showMessage("تم الدخول بنجاح. جارٍ فتح حسابك...");

      window.location.replace(
        new URL(`./${destination}`, window.location.href).href
      );

    } catch (error) {
      console.error("LOGIN ERROR", {
        code: error?.code,
        message: error?.message,
        currentUrl: window.location.href
      });

      const messages = {
        "auth/invalid-credential":
          "الإيميل أو كلمة المرور غير صحيحة.",
        "auth/user-not-found":
          "الحساب غير موجود.",
        "auth/wrong-password":
          "كلمة المرور غير صحيحة.",
        "auth/too-many-requests":
          "محاولات كثيرة. حاول لاحقًا.",
        "auth/network-request-failed":
          "تحقق من اتصال الإنترنت.",
        "auth/operation-not-allowed":
          "تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase.",
        "auth/unauthorized-domain":
          "الدومين الحالي غير مسموح به في إعدادات Firebase."
      };

      showMessage(
        messages[error?.code] ||
          `تعذر إكمال تسجيل الدخول: ${error?.message || "خطأ غير معروف"}`,
        true
      );

    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
