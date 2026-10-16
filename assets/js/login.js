
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
const submitButton = loginForm?.querySelector(
  'button[type="submit"]'
);

function showMessage(message, type = "error") {
  if (!messageElement) {
    alert(message);
    return;
  }

  messageElement.textContent = message;
  messageElement.style.display = "block";
  messageElement.style.color =
    type === "success" ? "#187044" : "#b8202f";
}

function setLoading(loading) {
  if (!submitButton) return;

  submitButton.disabled = loading;
  submitButton.textContent = loading
    ? "جارٍ تسجيل الدخول..."
    : "تسجيل الدخول";
}

function getFriendlyError(error) {
  const code = error?.code || "";

  const errors = {
    "auth/invalid-credential":
      "الكود أو البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/user-not-found":
      "الحساب غير موجود. راجع بيانات الدخول مع الإدارة.",
    "auth/wrong-password":
      "كلمة المرور غير صحيحة.",
    "auth/invalid-email":
      "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/too-many-requests":
      "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.",
    "auth/network-request-failed":
      "تعذّر الاتصال بالإنترنت. تحقق من اتصالك وحاول مجددًا.",
    "auth/user-disabled":
      "هذا الحساب موقوف. راجع إدارة المدرسة."
  };

  return errors[code] ||
    "تعذّر تسجيل الدخول. تحقق من البيانات وحاول مجددًا.";
}

async function getRoleAndDashboard(user) {
  const email = (user.email || "").trim().toLowerCase();

  // حسابا الإدارة المحددان مسبقًا
  if (isAdminEmail(email)) {
    return {
      role: "owner",
      dashboard: "admin.html"
    };
  }

  // باقي المستخدمين: الدور يُقرأ من ملفهم في Firestore
  const profileRef = doc(db, "users", user.uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    throw new Error(
      "لم يتم إعداد ملف هذا الحساب بعد. تواصل مع إدارة المدرسة."
    );
  }

  const profile = profileSnap.data();

  if (profile.active !== true) {
    throw new Error(
      "هذا الحساب غير مفعّل حاليًا. تواصل مع إدارة المدرسة."
    );
  }

  const dashboard = getDashboardPath(profile.role);

  if (!dashboard) {
    throw new Error(
      "لم يتم تحديد لوحة مناسبة لهذا الحساب. تواصل مع الإدارة."
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
      showMessage("اكتب كود الحساب أو البريد وكلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      const email = normalizeLoginIdentifier(identifier);

      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = credential.user;

      let destination;

      try {
        const account = await getRoleAndDashboard(user);
        destination = account.dashboard;
      } catch (error) {
        await signOut(auth);
        throw error;
      }

      showMessage("تم تسجيل الدخول بنجاح.", "success");

      window.location.replace(destination);
    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        error.message && !error.code
          ? error.message
          : getFriendlyError(error)
      );

      setLoading(false);
    }
  });
}
