import {
  auth, db, signInWithEmailAndPassword, onAuthStateChanged,
  setPersistence, browserLocalPersistence, doc, getDoc,
  isAdminEmail, normalizeLoginIdentifier, getDashboardPath
} from "./firebase.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");
const submit = form.querySelector('[type="submit"]');

function showMessage(text, error = false) {
  message.className = error ? "notice error" : "notice success";
  message.textContent = text;
}

function friendlyError(error) {
  if (error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found") {
    return "كود الحساب أو كلمة المرور غير صحيحة.";
  }

  if (error.code === "auth/too-many-requests") {
    return "محاولات دخول كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  }

  return "تعذر تسجيل الدخول. راجع البيانات واتصال الإنترنت.";
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const data = new FormData(form);
  const identifier = String(data.get("identifier") || "").trim();
  const password = String(data.get("password") || "");

  submit.disabled = true;
  submit.textContent = "جارٍ الدخول...";

  try {
    await setPersistence(auth, browserLocalPersistence);

    const email = normalizeLoginIdentifier(identifier);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    if (isAdminEmail(user.email)) {
      location.replace("admin.html");
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      showMessage("الحساب غير مرتبط بملف في النظام. تواصل مع الإدارة.", true);
      return;
    }

    const profile = snap.data();

    if (profile.active !== true) {
      showMessage("هذا الحساب غير نشط. تواصل مع الإدارة.", true);
      return;
    }

    if (
      profile.loginCode &&
      profile.loginCode.toLowerCase() !== identifier.toLowerCase()
    ) {
      showMessage("كود الدخول لا يطابق ملف الحساب.", true);
      return;
    }

    const path = getDashboardPath(profile.role);

    if (!path) {
      showMessage("لا توجد لوحة مرتبطة بدور هذا الحساب.", true);
      return;
    }

    location.replace(path);

  } catch (error) {
    console.error(error);
    showMessage(friendlyError(error), true);
  } finally {
    submit.disabled = false;
    submit.textContent = "دخول";
  }
});

onAuthStateChanged(auth, user => {
  if (!user) return;

  if (isAdminEmail(user.email)) {
    location.replace("admin.html");
  }
});
