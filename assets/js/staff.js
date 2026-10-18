import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, collection, getDocs, query, limit
} from "./firebase.js";

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? "غير محدد").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

const roleNames = {
  employee: "موظف",
  worker: "عامل",
  student_affairs: "شؤون الطلاب",
  exams_affairs: "شؤون الامتحانات"
};

async function loadAnnouncements() {
  const snap = await getDocs(query(collection(db, "announcements"), limit(100)));
  const rows = snap.docs
    .map(d => d.data())
    .filter(x => x.active !== false);

  $("staffAnnouncements").innerHTML = rows.map(x => `
    <article class="data-card">
      <h3>${esc(x.title)}</h3>
      <p>${esc(x.body || x.message || x.content || "")}</p>
    </article>
  `).join("") || '<div class="empty-state">لا توجد إعلانات حاليًا.</div>';
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("لا يوجد ملف مرتبط بالحساب.");

    const p = snap.data();

    const staffRoles = [
      "employee", "worker", "student_affairs", "exams_affairs"
    ];

    if (!p.active || !staffRoles.includes(p.role)) {
      throw new Error("هذا الحساب ليس حساب موظف نشطًا.");
    }

    $("staffGreeting").textContent = `أهلًا بك، ${p.name || p.fullName || "زميلنا"}`;

    const fields = [
      ["الاسم", p.name || p.fullName],
      ["الدور", roleNames[p.role] || p.role],
      ["القسم", p.department],
      ["كود الدخول", p.loginCode],
      ["المرحلة", p.stage],
      ["الفصل", p.className || p.classId]
    ];

    $("staffProfile").innerHTML = fields.map(([label, value]) => `
      <div class="profile-field">
        <span>${esc(label)}</span><strong>${esc(value || "غير محدد")}</strong>
      </div>
    `).join("");

    await loadAnnouncements();

  } catch (error) {
    console.error(error);
    $("staffProfile").innerHTML =
      `<div class="notice error">${esc(error.message || "تعذر تحميل البيانات.")}</div>`;
  }
});

$("staffLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("login.html");
});
