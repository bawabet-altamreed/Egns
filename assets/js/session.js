
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  isAdminEmail,
  getDashboardPath
} from "./firebase.js";

const LOGIN_PAGE = "login.html";

function goTo(page) {
  window.location.replace(page);
}

function showAccessDenied() {
  document.body.innerHTML = `
    <main style="
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 60px 20px;
      direction: rtl;
    ">
      <h2>غير مسموح بالدخول</h2>
      <p>هذا الحساب ليس لديه صلاحية لفتح هذه الصفحة.</p>
      <a href="login.html">العودة لتسجيل الدخول</a>
    </main>
  `;
}

export function requireSession(options = {}) {
  const {
    allowedRoles = [],
    adminOnly = false
  } = options;

  return new Promise((resolve) => {
    let finished = false;

    const timeout = window.setTimeout(() => {
      if (!finished) {
        finished = true;
        showAccessDenied();
        resolve(null);
      }
    }, 15000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (finished) return;

      if (!user) {
        finished = true;
        window.clearTimeout(timeout);
        unsubscribe();
        goTo(LOGIN_PAGE);
        resolve(null);
        return;
      }

      try {
        const email = (user.email || "").toLowerCase().trim();
        const isAdmin = isAdminEmail(email);

        let profile = null;

        if (!isAdmin) {
          const profileRef = doc(db, "users", user.uid);
          const profileSnap = await getDoc(profileRef);

          if (!profileSnap.exists()) {
            throw new Error("PROFILE_NOT_FOUND");
          }

          profile = profileSnap.data();

          if (profile.active !== true) {
            throw new Error("ACCOUNT_INACTIVE");
          }
        } else {
          // حسابات الإدارة العليا محددة مسبقًا
          profile = {
            uid: user.uid,
            email,
            role: "owner",
            active: true
          };
        }

        const role = profile.role;
        const correctDashboard = getDashboardPath(role);

        if (!correctDashboard) {
          throw new Error("INVALID_ROLE");
        }

        if (adminOnly && !isAdmin) {
          finished = true;
          window.clearTimeout(timeout);
          unsubscribe();
          showAccessDenied();
          resolve(null);
          return;
        }

        if (
          allowedRoles.length > 0 &&
          !allowedRoles.includes(role)
        ) {
          finished = true;
          window.clearTimeout(timeout);
          unsubscribe();
          showAccessDenied();
          resolve(null);
          return;
        }

        const currentPage = window.location.pathname
          .split("/")
          .pop();

        // لو المستخدم فتح لوحة دور آخر، نعيده للوحة الصحيحة
        if (
          currentPage &&
          currentPage.endsWith("-dashboard.html") &&
          currentPage !== correctDashboard
        ) {
          finished = true;
          window.clearTimeout(timeout);
          unsubscribe();
          goTo(correctDashboard);
          resolve(null);
          return;
        }

        finished = true;
        window.clearTimeout(timeout);
        unsubscribe();

        resolve({
          user,
          profile,
          role,
          isAdmin
        });
      } catch (error) {
        console.error("Session validation failed:", error);

        if (!finished) {
          finished = true;
          window.clearTimeout(timeout);
          unsubscribe();

          await signOut(auth);
          goTo(LOGIN_PAGE);
          resolve(null);
        }
      }
    });
  });
}

export async function logout() {
  await signOut(auth);
  goTo(LOGIN_PAGE);
}
