
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";

import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const appRoot = document.getElementById("app");
const page = document.body.dataset.page || "dashboard";

const pageInfo = {
  dashboard: {
    title: "الرئيسية",
    subtitle: "ملخص حسابك الدراسي"
  },
  schedule: {
    title: "الجدول الدراسي",
    subtitle: "مواعيد الدراسة والمواد"
  },
  announcements: {
    title: "الإعلانات",
    subtitle: "آخر أخبار وتنبيهات المدرسة"
  },
  exams: {
    title: "الامتحانات",
    subtitle: "الامتحانات المتاحة لصفك"
  },
  results: {
    title: "النتائج",
    subtitle: "ملخص محاولاتك ودرجاتك المنشورة"
  },
  leaderboard: {
    title: "لوحة الشرف",
    subtitle: "ترتيب الطلاب حسب النقاط المنشورة"
  },
  profile: {
    title: "حساب الطالب",
    subtitle: "بيانات حسابك الدراسي"
  }
};

const navigation = [
  ["dashboard", "الرئيسية", "⌂", "dashboard.html"],
  ["schedule", "الجدول الدراسي", "▦", "schedule.html"],
  ["announcements", "الإعلانات", "◉", "announcements.html"],
  ["exams", "الامتحانات", "✓", "exams.html"],
  ["results", "النتائج", "▤", "results.html"],
  ["leaderboard", "لوحة الشرف", "★", "leaderboard.html"],
  ["profile", "حسابي", "♙", "profile.html"]
];

let currentUser = null;
let currentProfile = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "—";

  const date = typeof value?.toDate === "function"
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function displayValue(value) {
  return value === undefined || value === null || value === ""
    ? "غير محدد"
    : escapeHTML(value);
}

function emptyState(title, description) {
  return `
    <div class="empty-state">
      <strong>${escapeHTML(title)}</strong>
      ${escapeHTML(description)}
    </div>
  `;
}

function showError(message) {
  if (!appRoot) return;

  appRoot.innerHTML = `
    <main class="main-area">
      <div class="notice error">${escapeHTML(message)}</div>
      <button class="btn" id="retryButton">إعادة المحاولة</button>
    </main>
  `;

  document.getElementById("retryButton")?.addEventListener("click", () => {
    window.location.reload();
  });
}

function getStudentName() {
  return currentProfile?.fullName ||
    currentProfile?.name ||
    currentUser?.displayName ||
    "الطالب";
}

function getStage() {
  return currentProfile?.stage || "";
}

function getClassId() {
  return currentProfile?.classId || "";
}

function buildShell() {
  const info = pageInfo[page] || pageInfo.dashboard;

  const navHTML = navigation.map(([key, label, icon, href]) => `
    <a class="nav-link ${key === page ? "active" : ""}"
       href="${href}" ${key === page ? 'aria-current="page"' : ""}>
      <span class="nav-icon">${icon}</span>
      <span>${label}</span>
    </a>
  `).join("");

  appRoot.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">E</div>
          <div>
            <div class="brand-name">EGNS Smart Campus</div>
            <div class="brand-subtitle">المدرسة المصرية الألمانية للتمريض</div>
          </div>
        </div>

        <div class="nav-label">القائمة الرئيسية</div>
        <nav class="nav-menu" aria-label="القائمة الرئيسية">
          ${navHTML}
        </nav>

        <div class="sidebar-footer">
          بوابتك التعليمية داخل المدرسة
        </div>
      </aside>

      <main class="main-area">
        <header class="topbar">
          <div>
            <h1 class="page-heading">${info.title}</h1>
            <p class="page-subtitle">${info.subtitle}</p>
          </div>

          <div class="user-chip">
            <div class="avatar" id="studentAvatar">ط</div>
            <div>
              <div class="user-name" id="studentName">الطالب</div>
              <div class="user-role">حساب طالب</div>
            </div>
          </div>
        </header>

        <div id="pageContent">
          <div class="loading">جارٍ تحميل البيانات...</div>
        </div>

        <footer class="footer">
          EGNS Smart Campus · نظام المدرسة المصرية الألمانية للتمريض
        </footer>
      </main>
    </div>
  `;

  document.getElementById("studentName").textContent = getStudentName();
  document.getElementById("studentAvatar").textContent =
    getStudentName().trim().charAt(0) || "ط";
}

function setContent(html) {
  const container = document.getElementById("pageContent");
  if (container) container.innerHTML = html;
}

function renderProfileFields(profile) {
  const fields = [
    ["الاسم", profile.fullName || profile.name],
    ["الصف الدراسي", profile.stage],
    ["الفصل", profile.className || profile.classId],
    ["الكود المدرسي", profile.loginCode],
    ["البريد الإلكتروني", currentUser.email],
    ["حالة الحساب", profile.active === true ? "نشط" : "غير نشط"]
  ];

  return `
    <div class="profile-list">
      ${fields.map(([label, value]) => `
        <div class="profile-field">
          <span>${escapeHTML(label)}</span>
          <strong>${displayValue(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function matchesStudentScope(data) {
  const stageMatches =
    !data.stage || data.stage === getStage();

  const classMatches =
    !data.classId || data.classId === getClassId();

  return stageMatches && classMatches;
}

async function readCollection(name, max = 100) {
  const result = await getDocs(
    query(collection(db, name), limit(max))
  );

  return result.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadDashboard() {
  const [announcements, exams, timetable, attempts] = await Promise.all([
    readCollection("announcements", 100),
    readCollection("exams", 100),
    readCollection("timetables", 100),
    readOwnAttempts()
  ]);

  const visibleAnnouncements = announcements
    .filter(matchesStudentScope)
    .filter((item) => item.active !== false);

  const visibleExams = exams
    .filter(matchesStudentScope)
    .filter((item) => item.active === true);

  const visibleTimetable = timetable.filter(matchesStudentScope);

  setContent(`
    <section class="welcome-banner">
      <h2>أهلًا بك، ${escapeHTML(getStudentName())} 👋</h2>
      <p>
        دي مساحتك الدراسية على EGNS Smart Campus.
        تابع جدولك وإعلانات المدرسة وامتحاناتك من مكان واحد.
      </p>
    </section>

    <section class="stats-grid">
      <article class="stat-card">
        <span class="stat-label">الصف الدراسي</span>
        <strong class="stat-value" style="font-size:18px">
          ${displayValue(getStage())}
        </strong>
        <div class="stat-note">الصف المرتبط بحسابك</div>
      </article>

      <article class="stat-card">
        <span class="stat-label">الامتحانات المتاحة</span>
        <strong class="stat-value">${visibleExams.length}</strong>
        <div class="stat-note">حسب البيانات المنشورة</div>
      </article>

      <article class="stat-card">
        <span class="stat-label">محاولاتك المسجلة</span>
        <strong class="stat-value">${attempts.length}</strong>
        <div class="stat-note">المحاولات المرتبطة بحسابك</div>
      </article>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>آخر الإعلانات</h2>
          <p>التنبيهات المنشورة للطلاب</p>
        </div>
        <a class="btn btn-light" href="announcements.html">كل الإعلانات</a>
      </div>

      ${visibleAnnouncements.length
        ? `<div class="cards-grid">
            ${visibleAnnouncements.slice(0, 4).map((item) => `
              <article class="data-card">
                <h3>${displayValue(item.title)}</h3>
                <p>${displayValue(item.body || item.message || item.content)}</p>
                <p class="card-meta">${formatDate(item.createdAt)}</p>
              </article>
            `).join("")}
          </div>`
        : emptyState("لا توجد إعلانات حاليًا", "ستظهر هنا الإعلانات المنشورة التي تخصك.")}
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>روابط سريعة</h2>
          <p>انتقل إلى الخدمات الدراسية</p>
        </div>
      </div>

      <div class="cards-grid">
        <article class="data-card">
          <h3>الجدول الدراسي</h3>
          <p>راجع المواعيد والمواد المنشورة لفصلك.</p>
          <a class="btn" href="schedule.html">عرض الجدول</a>
        </article>

        <article class="data-card">
          <h3>الامتحانات</h3>
          <p>تابع الامتحانات المنشورة لصفك.</p>
          <a class="btn" href="exams.html">عرض الامتحانات</a>
        </article>
      </div>
    </section>
  `);
}

async function readOwnAttempts() {
  const result = await getDocs(
    query(
      collection(db, "examAttempts"),
      where("studentUid", "==", currentUser.uid),
      limit(100)
    )
  );

  return result.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadSchedule() {
  const rows = (await readCollection("timetables", 100))
    .filter(matchesStudentScope)
    .filter((item) => item.active !== false);

  if (!rows.length) {
    setContent(`
      <section class="panel">
        ${emptyState("لم يتم نشر جدول بعد", "سيظهر الجدول هنا بعد إضافته إلى قاعدة بيانات المدرسة.")}
      </section>
    `);
    return;
  }

  const days = {
    sunday: "الأحد",
    monday: "الإثنين",
    tuesday: "الثلاثاء",
    wednesday: "الأربعاء",
    thursday: "الخميس",
    friday: "الجمعة",
    saturday: "السبت"
  };

  rows.sort((a, b) =>
    String(a.day || "").localeCompare(String(b.day || ""), "ar")
  );

  setContent(`
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>الجدول الدراسي</h2>
          <p>المواعيد المعتمدة والمنشورة من إدارة المدرسة</p>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>اليوم</th>
              <th>المادة</th>
              <th>الموعد</th>
              <th>الفصل / المكان</th>
              <th>المدرس</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((item) => `
              <tr>
                <td>${displayValue(days[String(item.day || "").toLowerCase()] || item.dayName || item.day)}</td>
                <td>${displayValue(item.subjectName || item.subject)}</td>
                <td>${displayValue(item.time || [item.startTime, item.endTime].filter(Boolean).join(" - "))}</td>
                <td>${displayValue(item.room || item.className || item.classId)}</td>
                <td>${displayValue(item.teacherName)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `);
}

async function loadAnnouncements() {
  const rows = (await readCollection("announcements", 100))
    .filter(matchesStudentScope)
    .filter((item) => item.active !== false)
    .sort((a, b) => {
      const aDate = a.createdAt?.toMillis?.() || 0;
      const bDate = b.createdAt?.toMillis?.() || 0;
      return bDate - aDate;
    });

  setContent(`
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>إعلانات المدرسة</h2>
          <p>الإعلانات العامة والإعلانات الموجهة لصفك</p>
        </div>
      </div>

      ${rows.length
        ? `<div class="cards-grid">
            ${rows.map((item) => `
              <article class="data-card">
                <div class="card-meta">${formatDate(item.createdAt)}</div>
                <h3>${displayValue(item.title)}</h3>
                <p>${displayValue(item.body || item.message || item.content)}</p>
              </article>
            `).join("")}
          </div>`
        : emptyState("لا توجد إعلانات", "لم يتم نشر إعلانات متاحة لحسابك حتى الآن.")}
    </section>
  `);
}

async function loadExams() {
  const rows = (await readCollection("exams", 100))
    .filter(matchesStudentScope)
    .filter((item) => item.active === true);

  setContent(`
    <section class="notice">
      الامتحانات المعروضة هنا هي الامتحانات المنشورة والمرتبطة ببيانات صفك.
      لن يظهر امتحان غير مفعّل.
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>الامتحانات المتاحة</h2>
          <p>تفاصيل الامتحان وموعده حسب إعدادات الإدارة</p>
        </div>
      </div>

      ${rows.length
        ? `<div class="cards-grid">
            ${rows.map((item) => `
              <article class="data-card">
                <h3>${displayValue(item.title)}</h3>
                <p>${displayValue(item.subjectName || item.subject || "المادة غير محددة")}</p>
                <p>${displayValue(item.description || "لا يوجد وصف إضافي.")}</p>
                <p>عدد الأسئلة: ${displayValue(item.questionCount)}</p>
                <p>المدة: ${displayValue(item.durationMinutes)} دقيقة</p>
                <span class="badge badge-success">منشور</span>
              </article>
            `).join("")}
          </div>`
        : emptyState("لا توجد امتحانات متاحة", "سيظهر الامتحان هنا عندما تنشره الإدارة وتفعّله.")}
    </section>

    <section class="panel">
      <h2 class="page-heading" style="font-size:17px">ملاحظة حول حل الامتحانات</h2>
      <p class="page-subtitle">
        هذه النسخة تعرض الامتحانات المنشورة فقط. قبل تفعيل الحل والتصحيح،
        يجب تحديد آلية آمنة لحفظ الإجابات ومنع تعديل الدرجات من المتصفح.
      </p>
    </section>
  `);
}

async function loadResults() {
  const rows = await readOwnAttempts();

  setContent(`
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>نتائجي</h2>
          <p>المحاولات المسجلة تحت حسابك</p>
        </div>
      </div>

      ${rows.length
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الامتحان</th>
                  <th>الدرجة</th>
                  <th>الدرجة النهائية</th>
                  <th>تاريخ المحاولة</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${displayValue(item.examTitle || item.examId)}</td>
                    <td>${displayValue(item.score)}</td>
                    <td>${displayValue(item.maxScore)}</td>
                    <td>${formatDate(item.submittedAt)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>`
        : emptyState("لا توجد نتائج مسجلة", "ستظهر نتائجك بعد تفعيل نظام الامتحانات وتسجيل المحاولات.")}
    </section>
  `);
}

async function loadLeaderboard() {
  // هذه المجموعة مخصصة لبيانات ترتيب منشورة، لا لإجابات الامتحانات.
  const rows = (await readCollection("leaderboard", 100))
    .filter(matchesStudentScope)
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));

  setContent(`
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>لوحة الشرف</h2>
          <p>النقاط المنشورة لكل طالب</p>
        </div>
      </div>

      ${rows.length
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الترتيب</th>
                  <th>الطالب</th>
                  <th>الصف</th>
                  <th>النقاط</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${displayValue(item.studentName)}</td>
                    <td>${displayValue(item.stage)}</td>
                    <td><strong class="points-highlight">${Number(item.points || 0)}</strong></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>`
        : emptyState("لوحة الشرف فارغة", "ستظهر هنا النقاط بعد إعداد نظام النقاط ونشر بيانات الترتيب.")}
    </section>
  `);
}

async function loadProfile() {
  setContent(`
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>بياناتي الدراسية</h2>
          <p>البيانات المسجلة في ملف حسابك</p>
        </div>
      </div>

      ${renderProfileFields(currentProfile)}

      <div style="margin-top:20px">
        <button class="btn btn-red" id="logoutButton">تسجيل الخروج</button>
      </div>
    </section>
  `);

  document.getElementById("logoutButton")?.addEventListener("click", async () => {
    const button = document.getElementById("logoutButton");
    button.disabled = true;
    button.textContent = "جارٍ تسجيل الخروج...";

    try {
      await signOut(auth);
      window.location.replace(
        new URL("./login.html", window.location.href).href
      );
    } catch (error) {
      console.error("Logout error:", error);
      button.disabled = false;
      button.textContent = "تسجيل الخروج";
      showError("تعذر تسجيل الخروج. حاول مرة أخرى.");
    }
  });
}

async function renderPage() {
  switch (page) {
    case "dashboard":
      return loadDashboard();
    case "schedule":
      return loadSchedule();
    case "announcements":
      return loadAnnouncements();
    case "exams":
      return loadExams();
    case "results":
      return loadResults();
    case "leaderboard":
      return loadLeaderboard();
    case "profile":
      return loadProfile();
    default:
      return loadDashboard();
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace(
      new URL("./login.html", window.location.href).href
    );
    return;
  }

  currentUser = user;

  try {
    const profileRef = doc(db, "users", user.uid);
    const profileSnapshot = await getDoc(profileRef);

    if (!profileSnapshot.exists()) {
      await signOut(auth);
      window.location.replace(
        new URL("./login.html", window.location.href).href
      );
      return;
    }

    currentProfile = profileSnapshot.data();

    if (
      currentProfile.active !== true ||
      currentProfile.role !== "student"
    ) {
      await signOut(auth);
      window.location.replace(
        new URL("./login.html", window.location.href).href
      );
      return;
    }

    buildShell();
    await renderPage();

  } catch (error) {
    console.error("Student section error:", error);

    showError(
      "تعذر تحميل بيانات الطالب. تأكد من إعدادات Firestore وصلاحيات القراءة."
    );
  }
});
