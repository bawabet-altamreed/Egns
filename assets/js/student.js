import {
  auth, db, onAuthStateChanged, signOut, isAdminEmail,
  doc, getDoc, collection, getDocs, query, where, limit,
  addDoc, serverTimestamp
} from "./firebase.js";

const $ = id => document.getElementById(id);
const root = $("app");
const page = document.body.dataset.page || "dashboard";

let currentUser = null;
let profile = null;
let activeTimer = null;
let submitting = false;

const pageNames = {
  dashboard: "الرئيسية",
  schedule: "الجدول الدراسي",
  announcements: "الإعلانات",
  exams: "الامتحانات",
  results: "النتائج",
  leaderboard: "لوحة الشرف",
  profile: "حساب الطالب"
};

const navItems = [
  ["dashboard", "الرئيسية", "dashboard.html"],
  ["schedule", "الجدول الدراسي", "schedule.html"],
  ["announcements", "الإعلانات", "announcements.html"],
  ["exams", "الامتحانات", "exams.html"],
  ["results", "النتائج", "results.html"],
  ["leaderboard", "لوحة الشرف", "leaderboard.html"],
  ["profile", "حسابي", "profile.html"]
];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function dateText(v) {
  if (!v) return "—";
  const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? "—" :
    new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium", timeStyle: "short"
    }).format(d);
}

function displayName() {
  return profile?.name || profile?.fullName ||
    currentUser?.displayName || "الطالب";
}

function matchesStudent(item) {
  const stageOK = !item.stage || item.stage === profile.stage;
  const classOK = !item.classId ||
    item.classId === profile.classId ||
    item.classId === profile.className;
  return stageOK && classOK;
}

function empty(title, detail = "") {
  return `<div class="empty-state"><strong>${esc(title)}</strong>${esc(detail)}</div>`;
}

function notify(text, error = false) {
  const old = $("studentNotice");
  if (old) old.remove();

  const el = document.createElement("div");
  el.id = "studentNotice";
  el.className = error ? "notice error" : "notice success";
  el.textContent = text;

  const content = $("pageContent");
  if (content) content.prepend(el);
}

function shell() {
  root.innerHTML = `
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
        <nav class="nav-menu">
          ${navItems.map(([key, label, href]) => `
            <a class="nav-link ${page === key ? "active" : ""}"
               href="${href}">${label}</a>
          `).join("")}
        </nav>
        <div class="sidebar-footer">بوابتك التعليمية</div>
      </aside>

      <main class="main-area">
        <header class="topbar">
          <div>
            <h1 class="page-heading">${pageNames[page] || "الرئيسية"}</h1>
            <p class="page-subtitle">EGNS Smart Campus</p>
          </div>
          <div class="user-chip">
            <div class="avatar">${esc(displayName().charAt(0))}</div>
            <div>
              <div class="user-name">${esc(displayName())}</div>
              <div class="user-role">حساب طالب</div>
            </div>
          </div>
        </header>

        <div id="pageContent"><div class="loading">جارٍ تحميل البيانات...</div></div>
        <footer class="footer">EGNS Smart Campus</footer>
      </main>
    </div>
  `;
}

async function readRows(name, max = 100) {
  const snap = await getDocs(query(collection(db, name), limit(max)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function readMyAttempts() {
  const snap = await getDocs(query(
    collection(db, "examAttempts"),
    where("studentUid", "==", currentUser.uid),
    limit(100)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function announcementCard(x) {
  return `<article class="data-card">
    <div class="card-meta">${dateText(x.createdAt)}</div>
    <h3>${esc(x.title || "إعلان")}</h3>
    <p>${esc(x.body || x.message || x.content || "")}</p>
  </article>`;
}

async function dashboardPage() {
  const [announcements, exams, attempts] = await Promise.all([
    getDocs(query(collection(db, "announcements"), where("active", "==", true), limit(100))),
    getDocs(query(collection(db, "exams"), where("active", "==", true), limit(100))),
    readMyAttempts()
  ]);

  const news = announcements.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(matchesStudent);
  const available = exams.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(matchesStudent);

  $("pageContent").innerHTML = `
    <section class="welcome-banner">
      <h2>أهلًا بك، ${esc(displayName())} 👋</h2>
      <p>تابع جدولك الدراسي وإعلانات المدرسة والامتحانات المنشورة لفصلك.</p>
    </section>

    <section class="stats-grid">
      <article class="stat-card">
        <span class="stat-label">المرحلة</span>
        <strong class="stat-value" style="font-size:16px">${esc(profile.stage || "غير محددة")}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">الفصل</span>
        <strong class="stat-value" style="font-size:16px">${esc(profile.className || profile.classId || "غير محدد")}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">الامتحانات المتاحة</span>
        <strong class="stat-value">${available.length}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">المحاولات المسجلة</span>
        <strong class="stat-value">${attempts.length}</strong>
      </article>
    </section>

    <section class="panel">
      <div class="panel-heading"><h2>آخر الإعلانات</h2>
      <a class="btn btn-light" href="announcements.html">كل الإعلانات</a></div>
      <div class="cards-grid">${news.slice(0, 4).map(announcementCard).join("") ||
        empty("لا توجد إعلانات", "ستظهر الإعلانات المنشورة هنا.")}</div>
    </section>

    <section class="panel">
      <div class="panel-heading"><h2>روابط سريعة</h2></div>
      <div class="cards-grid">
        <article class="data-card"><h3>الجدول الدراسي</h3>
          <a class="btn" href="schedule.html">عرض الجدول</a></article>
        <article class="data-card"><h3>الامتحانات</h3>
          <a class="btn" href="exams.html">عرض الامتحانات</a></article>
      </div>
    </section>
  `;
}

async function schedulePage() {
  const rows = (await readRows("timetables"))
    .filter(matchesStudent)
    .filter(x => x.active !== false);

  $("pageContent").innerHTML = `
    <section class="panel">
      <h2>الجدول الدراسي</h2>
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>اليوم</th><th>المادة</th><th>الوقت</th><th>المكان</th><th>المعلم</th></tr></thead>
        <tbody>${rows.map(x => `<tr>
          <td>${esc(x.dayName || x.day || "—")}</td>
          <td>${esc(x.subjectName || x.subject || "—")}</td>
          <td>${esc(x.time || [x.startTime, x.endTime].filter(Boolean).join(" - ") || "—")}</td>
          <td>${esc(x.room || x.className || "—")}</td>
          <td>${esc(x.teacherName || "—")}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : empty("لم يُنشر جدول دراسي بعد.") }
    </section>`;
}

async function announcementsPage() {
  const rows = (await getDocs(query(
    collection(db, "announcements"),
    where("active", "==", true),
    limit(100)
  ))).docs.map(d => ({ id: d.id, ...d.data() })).filter(matchesStudent);

  $("pageContent").innerHTML = `
    <section class="panel"><h2>إعلانات المدرسة</h2>
      <div class="cards-grid">${rows.map(announcementCard).join("") ||
        empty("لا توجد إعلانات حاليًا.")}</div>
    </section>`;
}

function stopTimer() {
  if (activeTimer) clearInterval(activeTimer);
  activeTimer = null;
}

async function examsPage() {
  stopTimer();

  const rows = (await getDocs(query(
    collection(db, "exams"),
    where("active", "==", true),
    limit(100)
  ))).docs.map(d => ({ id: d.id, ...d.data() })).filter(matchesStudent);

  $("pageContent").innerHTML = `
    <section class="panel">
      <h2>الامتحانات المتاحة</h2>
      <div class="cards-grid">
        ${rows.map(x => `<article class="data-card">
          <h3>${esc(x.title)}</h3>
          <p>المادة: ${esc(x.subjectName || "—")}</p>
          <p>المدة: ${Number(x.durationMinutes || 0)} دقيقة</p>
          <p>الدرجة النهائية: ${Number(x.totalMarks || 0)}</p>
          <button class="btn" data-start-exam="${esc(x.id)}" type="button">بدء الامتحان</button>
        </article>`).join("") || empty("لا توجد امتحانات متاحة حاليًا.")}
      </div>
    </section>`;

  document.querySelectorAll("[data-start-exam]").forEach(button => {
    button.addEventListener("click", () => startExam(button.dataset.startExam));
  });
}

async function startExam(examId) {
  if (!confirm("بعد بدء الامتحان سيبدأ المؤقت. هل تريد المتابعة؟")) return;

  stopTimer();

  try {
    const [examSnap, keySnap] = await Promise.all([
      getDoc(doc(db, "exams", examId)),
      getDoc(doc(db, "examKeys", examId))
    ]);

    if (!examSnap.exists() || !keySnap.exists()) {
      throw new Error("بيانات الامتحان أو مفتاح الإجابة غير متاحة.");
    }

    const exam = examSnap.data();
    const key = keySnap.data();

    if (!exam.active || !matchesStudent(exam)) {
      throw new Error("هذا الامتحان غير متاح لحسابك.");
    }

    if (!Array.isArray(exam.questions) || !Array.isArray(key.answers)) {
      throw new Error("تركيب بيانات الامتحان غير صحيح.");
    }

    renderExam(examId, exam, key.answers);

  } catch (error) {
    console.error(error);
    notify(error.message || "تعذر فتح الامتحان.", true);
  }
}

function renderExam(examId, exam, answerKey) {
  const duration = Math.max(1, Number(exam.durationMinutes || 30));
  let secondsLeft = duration * 60;
  submitting = false;

  $("pageContent").innerHTML = `
    <section class="panel">
      <div class="panel-heading">
        <div><h2>${esc(exam.title)}</h2><p>${esc(exam.subjectName || "")}</p></div>
        <div class="badge badge-success" id="examTimer">${duration}:00</div>
      </div>

      <form id="examAnswerForm">
        ${exam.questions.map((q, i) => `
          <article class="data-card" style="margin-bottom:14px">
            <h3>السؤال ${i + 1}: ${esc(q.text)}</h3>
            ${(q.options || []).map((option, j) => `
              <label style="display:flex;gap:8px;align-items:center;padding:8px 0">
                <input type="radio" name="q_${esc(q.id || `q${i + 1}`)}" value="${j}">
                <span>${esc(option)}</span>
              </label>
            `).join("")}
          </article>
        `).join("")}

        <button id="submitExam" class="btn" type="submit">تسليم الامتحان</button>
      </form>
    </section>`;

  const timer = $("examTimer");

  activeTimer = setInterval(() => {
    secondsLeft--;
    timer.textContent =
      `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

    if (secondsLeft <= 0) {
      stopTimer();
      submitExam(examId, exam, answerKey, true);
    }
  }, 1000);

  $("examAnswerForm").addEventListener("submit", event => {
    event.preventDefault();
    submitExam(examId, exam, answerKey, false);
  });
}

async function submitExam(examId, exam, answerKey, timeExpired) {
  if (submitting) return;
  submitting = true;
  stopTimer();

  const form = $("examAnswerForm");
  if (!form) return;

  const submitButton = $("submitExam");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "جارٍ تصحيح وحفظ النتيجة...";
  }

  try {
    const formData = new FormData(form);
    const answers = [];
    let score = 0;
    let maxScore = 0;

    exam.questions.forEach((q, index) => {
      const qid = q.id || `q${index + 1}`;
      const selected = formData.get(`q_${qid}`);
      const key = answerKey.find(a => a.questionId === qid);
      const marks = Number(key?.marks ?? q.marks ?? 1);
      maxScore += marks;

      const chosen = selected === null ? null : Number(selected);
      const correct = chosen !== null &&
        chosen === Number(key?.correctAnswer);

      if (correct) score += marks;

      answers.push({
        questionId: qid,
        selectedAnswer: chosen,
        correct: Boolean(correct)
      });
    });

    await addDoc(collection(db, "examAttempts"), {
      examId,
      examTitle: exam.title || "",
      studentUid: currentUser.uid,
      studentName: displayName(),
      teacherUid: exam.teacherUid || "",
      classId: profile.classId || "",
      stage: profile.stage || "",
      answers,
      score,
      maxScore: Number(exam.totalMarks || maxScore),
      status: timeExpired ? "time_expired" : "submitted",
      submittedAt: serverTimestamp()
    });

    $("pageContent").innerHTML = `
      <section class="panel">
        <h2>تم تسليم الامتحان</h2>
        <div class="welcome-banner">
          <h2>درجتك: ${score} من ${Number(exam.totalMarks || maxScore)}</h2>
          <p>${timeExpired ? "انتهى الوقت وتم تسليم الإجابات." : "تم حفظ محاولتك بنجاح."}</p>
        </div>
        <a class="btn" href="results.html">عرض النتائج</a>
        <a class="btn btn-light" href="exams.html">العودة للامتحانات</a>
      </section>`;

  } catch (error) {
    console.error(error);
    submitting = false;
    notify("تعذر حفظ المحاولة. لا تغلق الصفحة؛ حاول التسليم مرة أخرى.", true);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "إعادة محاولة التسليم";
    }
  }
}

async function resultsPage() {
  const rows = (await readMyAttempts()).sort((a, b) =>
    (b.submittedAt?.toMillis?.() || 0) -
    (a.submittedAt?.toMillis?.() || 0)
  );

  $("pageContent").innerHTML = `
    <section class="panel"><h2>نتائجي</h2>
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>الامتحان</th><th>الدرجة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
        <tbody>${rows.map(x => `<tr>
          <td>${esc(x.examTitle || x.examId)}</td>
          <td>${Number(x.score || 0)} / ${Number(x.maxScore || 0)}</td>
          <td>${esc(x.status || "مسجلة")}</td>
          <td>${dateText(x.submittedAt)}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : empty("لا توجد نتائج مسجلة بعد.") }
    </section>`;
}

async function leaderboardPage() {
  const rows = (await readRows("leaderboard"))
    .filter(matchesStudent)
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));

  $("pageContent").innerHTML = `
    <section class="panel"><h2>لوحة الشرف</h2>
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>الترتيب</th><th>الطالب</th><th>الفصل</th><th>النقاط</th></tr></thead>
        <tbody>${rows.map((x, i) => `<tr>
          <td>${i + 1}</td><td>${esc(x.studentName || "طالب")}</td>
          <td>${esc(x.className || x.classId || "—")}</td>
          <td>${Number(x.points || 0)}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : empty("لوحة الشرف فارغة حاليًا.") }
    </section>`;
}

async function profilePage() {
  const fields = [
    ["الاسم", profile.name || profile.fullName],
    ["المرحلة", profile.stage],
    ["الفصل", profile.className || profile.classId],
    ["كود الدخول", profile.loginCode],
    ["البريد الإلكتروني", currentUser.email],
    ["حالة الحساب", profile.active ? "نشط" : "غير نشط"]
  ];

  $("pageContent").innerHTML = `
    <section class="panel"><h2>ملفي الشخصي</h2>
      <div class="profile-list">${fields.map(([k, v]) => `
        <div class="profile-field"><span>${esc(k)}</span><strong>${esc(v || "غير محدد")}</strong></div>
      `).join("")}</div>
      <button id="studentLogout" class="btn btn-red" style="margin-top:20px">تسجيل الخروج</button>
    </section>`;

  $("studentLogout").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("login.html");
  });
}

async function renderPage() {
  switch (page) {
    case "dashboard": return dashboardPage();
    case "schedule": return schedulePage();
    case "announcements": return announcementsPage();
    case "exams": return examsPage();
    case "results": return resultsPage();
    case "leaderboard": return leaderboardPage();
    case "profile": return profilePage();
    default: return dashboardPage();
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  if (isAdminEmail(user.email)) {
    location.replace("admin.html");
    return;
  }

  currentUser = user;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("ملف الطالب غير موجود.");

    profile = snap.data();

    if (profile.role !== "student" || profile.active !== true) {
      throw new Error("هذا الحساب ليس حساب طالب نشطًا.");
    }

    shell();
    await renderPage();

  } catch (error) {
    console.error(error);
    root.innerHTML = `<main class="main-area">
      <div class="notice error">${esc(error.message || "تعذر تحميل حساب الطالب.")}</div>
      <a class="btn" href="login.html">العودة لتسجيل الدخول</a>
    </main>`;
  }
});
