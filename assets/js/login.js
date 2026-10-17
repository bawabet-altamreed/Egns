
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

const loginForm = document.getElementById("loginForm");
const identifierInput = document.getElementById("identifier");
const passwordInput = document.getElementById("password");
const messageElement = document.getElementById("loginMessage");
const submitButton = loginForm?.querySelector('button[type="submit"]');

function showMessage(message, type = "error") {
  if (!messageElement) {
    alert(message);
    return;
  }

  messageElement.textContent = message;
  messageElement.style.display = "block";
  messageElement.className =
    type === "success" ? "form-success" : "form-error";
}

function setLoading(loading) {
  if (!submitButton) return;

  submitButton.disabled = loading;
  submitButton.textContent = loading
    ? "جارٍ التحقق من الحساب..."
    : "تسجيل الدخول ←";
}

function friendlyError(error) {
  const errors = {
    "auth/invalid-credential":
      "بيانات الدخول غير صحيحة.",
    "auth/user-not-found":
      "بيانات الدخول غير صحيحة.",
    "auth/wrong-password":
      "بيانات الدخول غير صحيحة.",
    "auth/invalid-email":
      "تعذّر التحقق من بيانات الحساب.",
    "auth/too-many-requests":
      "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.",
    "auth/network-request-failed":
      "تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا.",
    "auth/user-disabled":
      "هذا الحساب موقوف. تواصل مع إدارة المدرسة."
  };

  return errors[error?.code] ||
    "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.";
}

async function resolveAccount(user) {
  const email = (user.email || "").trim().toLowerCase();

  // حسابا الإدارة العليا المحددان مسبقًا.
  if (isAdminEmail(email)) {
    return {
      role: "owner",
      dashboard: "admin.html"
    };
  }

  // كل حساب آخر يجب أن يكون له ملف مستخدم في Firestore.
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    throw new Error(
      "الحساب غير مكتمل الإعداد. تواصل مع إدارة المدرسة."
    );
  }

  const profile = profileSnapshot.data();

  if (profile.active !== true) {
    throw new Error(
      "الحساب غير مفعّل. تواصل مع إدارة المدرسة."
    );
  }

  const dashboard = getDashboardPath(profile.role);

  if (!dashboard) {
    throw new Error(
      "لم يتم تحديد لوحة لهذا الحساب. تواصل مع الإدارة."
    );
  }

  return {
    role: profile.role,
    dashboard
  };
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier = identifierInput?.value.trim();
    const password = passwordInput?.value;

    if (!identifier || !password) {
      showMessage("أدخل بيانات الحساب وكلمة المرور.");
      return;
    }

    setLoading(true);
    showMessage("");

    let authenticatedUser = null;

    try {
      // البريد يُستخدم كما هو، والكود يُحوّل وفق قاعدة موحدة.
      const email = normalizeLoginIdentifier(identifier);

      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      authenticatedUser = credential.user;

      const account = await resolveAccount(authenticatedUser);

      showMessage("تم تسجيل الدخول بنجاح.", "success");

      window.location.replace(account.dashboard);
    } catch (error) {
      console.error("EGNS login error:", error);

      // لا نترك جلسة مفتوحة لو تعذّر تحديد صلاحية الحساب.
      if (authenticatedUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Sign out error:", signOutError);
        }
      }

      showMessage(
        error.message && !error.code
          ? error.message
          : friendlyError(error)
      );

      setLoading(false);
    }
  });
}
