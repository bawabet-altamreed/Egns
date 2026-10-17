
import {
  auth,
  db,
  signOut,
  onAuthStateChanged,
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

const $ = (id) => document.getElementById(id);

let currentUser = null;
let profile = null;
let content = {
  announcements: [],
  subjects: [],
  lectures: [],
  timetables: [],
  exams: [],
  badges: [],
  leaderboard: []
};
let activeExam = null;
let examTimer = null;
let examDeadline = 0;
let examSubmitted = false;

const sectionNames = {
  overview: "الرئيسية",
  announcements: "الإعلانات المدرسية",
  timetable: "الجدول الدراسي",
  subjects: "المواد والمحاضرات",
  exams: "الامتحانات الإلكترونية",
  achievements: "النقاط والإنجازات",
  profile: "ملفي الشخصي"
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showPageMessage(text) {
  const box = $("pageMessage");
  box.textContent = text;
  box.hidden = false;
}

function hidePageMessage() {
  $("pageMessage").hidden = true;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value ?? "—";
}

function displayName() {
  return profile?.name || profile?.fullName || "الطالب";
}

function classId() {
  return String(profile?.classId || profile?.classCode || "").trim();
}

function stageName() {
  return profile?.stage || profile?.grade || "غير محدد";
}

function className() {
  return profile?.className || profile?.classId || profile?.classCode || "غير محدد";
}

function showLoading(containerId, text = "جاري تحميل البيانات...") {
  const element = $(containerId);
  if (element) element.innerHTML = `<div class="loading-state">${escapeHTML(text)}</div>`;
}

function showEmpty(containerId, text) {
  const element = $(containerId);
  if (element) element.innerHTML = `<div class="empty-state">${escapeHTML(text)}</div>`;
}

function showError(containerId, text) {
  const element = $(containerId);
  if (element) element.innerHTML = `<div class="error-state">${escapeHTML(text)}</div>`;
}

function formatDate(value) {
  if (!value) return "التاريخ غير محدد";

  try {
    const date = typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "التاريخ غير محدد";

    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  } catch {
    return "التاريخ غير محدد";
  }
}

function normalizeCode(value) {
  return String(value || "").trim().toLowerCase();
}

function isPublished(item) {
  return item.published === true || item.status === "published";
}

function matchesStudentClass(item) {
  const myClass = classId();

  // لا نعرض محتوى صف آخر.
  // المحتوى العام مسموح فقط إذا كان منشورًا وموسومًا صراحة بأنه عام.
  if (item.audience === "all" || item.classId === "all") {
    return true;
  }

  return Boolean(myClass) && String(item.classId || "") === myClass;
}

async function loadCollection(collectionName, targetKey, options = {}) {
  try {
    const ref = collection(db, collectionName);
    const constraints = [];

    if (options.publishedField) {
      constraints.push(where(options.publishedField, "==", true));
    }

    if (options.classFilter && classId()) {
      constraints.push(where("classId", "==", classId()));
    }

    constraints.push(limit(options.limit || 100));

    const snapshot = await getDocs(query(ref, ...constraints));

    content[targetKey] = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => {
        if (options.publishedOnly && !isPublished(item)) return false;
        if (options.matchClass && !matchesStudentClass(item)) return false;
        return true;
      });

    return content[targetKey];
  } catch (error) {
    console.warn(`تعذر تحميل ${collectionName}:`, error.code || error.message);
    content[targetKey] = [];
    return [];
  }
}

async function loadStudentData() {
  const tasks = [
    loadCollection("announcements", "announcements", {
      publishedOnly: true,
      matchClass: true
    }),
    loadCollection("subjects", "subjects", {
      publishedOnly: true,
      matchClass: true
    }),
    loadCollection("lectures", "lectures", {
      publishedOnly: true,
      matchClass: true
    }),
    loadCollection("timetables", "timetables", {
      publishedOnly: true,
      matchClass: true
    }),
    loadCollection("exams", "exams", {
      publishedOnly: true,
      matchClass: true
    }),
    loadCollection("badges", "badges", {
      publishedOnly: true,
      matchClass: false
    }),
    loadCollection("leaderboard", "leaderboard", {
      publishedOnly: true,
      matchClass: true,
      limit: 50
    })
  ];

  await Promise.all(tasks);
  renderAll();
}

function renderProfile() {
  const name = displayName();
  const code = profile?.loginCode || "—";
  const initial = [...name][0] || "ط";

  [
    "sideName", "welcomeName", "profileName", "profileNameDetail"
  ].forEach((id) => setText(id, name));

  setText("sideClass", className());
  setText("welcomeClass", `${stageName()} — ${className()}`);
  setText("profileCode", `كود الحساب: ${code}`);
  setText("profileCodeDetail", code);
  setText("profileStage", stageName());
  setText("profileClass", className());
  setText("sideAvatar", initial);
  setText("profileAvatar", initial);

  const profileCodeElement = $("profileCode");
  if (profileCodeElement) profileCodeElement.textContent = `كود الحساب: ${code}`;
}

function renderAnnouncements() {
  const items = content.announcements;

  setText("statAnnouncements", items.length);
  setText("announcementCount", items.length);

  if (!items.length) {
    showEmpty("announcementsList", "لا توجد إعلانات منشورة لك حاليًا.");
    showEmpty("overviewAnnouncements", "لا توجد إعلانات جديدة.");
    return;
  }

  const card = (item) => `
    <article class="announcement-card">
      <span class="pill gold">${escapeHTML(item.category || "إعلان مدرسي")}</span>
      <h3 style="margin-top:12px">${escapeHTML(item.title || "إعلان")}</h3>
      <p>${escapeHTML(item.body || item.content || item.description || "لا يوجد نص إضافي.")}</p>
      <div class="card-meta"><span>◷ ${escapeHTML(formatDate(item.createdAt || item.date))}</span></div>
    </article>`;

  $("announcementsList").innerHTML = items.map(card).join("");

  $("overviewAnnouncements").innerHTML = items.slice(0, 3).map((item) => `
    <div class="compact-item">
      <div class="compact-icon">▤</div>
      <div>
        <strong>${escapeHTML(item.title || "إعلان مدرسي")}</strong>
        <p>${escapeHTML((item.body || item.content || "").slice(0, 110))}</p>
        <small>${escapeHTML(formatDate(item.createdAt || item.date))}</small>
      </div>
    </div>
  `).join("");
}

function renderTimetable() {
  const body = $("timetableBody");
  const items = [...content.timetables];

  if (!items.length) {
    body.innerHTML = `<tr><td colspan="5">لم يتم نشر جدول دراسي لصفك حتى الآن.</td></tr>`;
    return;
  }

  const dayOrder = {
    "الأحد": 0, "الاحد": 0, "Sunday": 0,
    "الاثنين": 1, "الإثنين": 1, "Monday": 1,
    "الثلاثاء": 2, "Tuesday": 2,
    "الأربعاء": 3, "الاربعاء": 3, "Wednesday": 3,
    "الخميس": 4, "Thursday": 4,
    "الجمعة": 5, "Friday": 5,
    "السبت": 6, "Saturday": 6
  };

  items.sort((a, b) =>
    (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7) ||
    String(a.period || a.startTime || "").localeCompare(
      String(b.period || b.startTime || ""), "ar"
    )
  );

  body.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHTML(item.day || "—")}</td>
      <td>${escapeHTML(item.period || item.time || item.startTime || "—")}</td>
      <td>${escapeHTML(item.subjectName || item.subject || "—")}</td>
      <td>${escapeHTML(item.teacherName || item.teacher || "—")}</td>
      <td>${escapeHTML(item.room || item.location || "—")}</td>
    </tr>
  `).join("");
}

function renderSubjects() {
  const search = normalizeCode($("subjectSearch")?.value);
  const subjects = content.subjects.filter((subject) => {
    const text = normalizeCode(`${subject.name || ""} ${subject.title || ""} ${subject.description || ""}`);
    return !search || text.includes(search);
  });

  setText("statSubjects", content.subjects.length);

  if (!subjects.length) {
    showEmpty("subjectsList", search ? "لا توجد نتائج مطابقة للبحث." : "لم تُنشر مواد دراسية لصفك حتى الآن.");
    return;
  }

  $("subjectsList").innerHTML = subjects.map((subject) => {
    const lectures = content.lectures.filter((lecture) =>
      lecture.subjectId === subject.id ||
      lecture.subjectName === subject.name
    );

    return `
      <article class="subject-card">
        <div class="subject-symbol">▧</div>
        <h3>${escapeHTML(subject.name || subject.title || "مادة دراسية")}</h3>
        <p>${escapeHTML(subject.description || "المحتوى الدراسي المتاح لهذه المادة.")}</p>
        <span class="subject-count">${lectures.length} محاضرة منشورة</span>
        <div class="lecture-list">
          ${lectures.length ? lectures.map((lecture) => `
            <div class="lecture-item">
              <strong>${escapeHTML(lecture.title || "محاضرة")}</strong>
              <p>${escapeHTML(lecture.description || "")}</p>
              ${lecture.url ? `<a href="${escapeHTML(lecture.url)}" target="_blank" rel="noopener noreferrer">فتح المحاضرة ↗</a>` : ""}
            </div>
          `).join("") : `<div class="lecture-item"><p>لا توجد محاضرات منشورة لهذه المادة حاليًا.</p></div>`}
        </div>
      </article>`;
  }).join("");
}

function renderExams() {
  const items = content.exams;
  setText("statExams", items.length);

  if (!items.length) {
    showEmpty("examsList", "لا توجد امتحانات منشورة لصفك حاليًا.");
    showEmpty("overviewExams", "لا توجد امتحانات متاحة الآن.");
    return;
  }

  $("examsList").innerHTML = items.map((exam) => `
    <article class="exam-card">
      <div class="card-meta">
        <span class="pill">${escapeHTML(exam.subjectName || "امتحان")}</span>
        <span class="pill gold">${Number(exam.durationMinutes) || 15} دقيقة</span>
      </div>
      <h3 style="margin-top:13px">${escapeHTML(exam.title || "امتحان إلكتروني")}</h3>
      <p>${escapeHTML(exam.description || "اقرأ الأسئلة بعناية قبل التسليم.")}</p>
      <div class="card-meta">
        <span>عدد الأسئلة: ${Array.isArray(exam.questions) ? exam.questions.length : "—"}</span>
        <span>الدرجة النهائية: ${Number(exam.totalMarks) || (exam.questions?.length || 0)}</span>
      </div>
      <div class="exam-action"><button class="primary-btn start-exam" data-exam-id="${escapeHTML(exam.id)}">بدء الامتحان ←</button></div>
    </article>
  `).join("");

  $("overviewExams").innerHTML = items.slice(0, 3).map((exam) => `
    <div class="compact-item">
      <div class="compact-icon">✓</div>
      <div>
        <strong>${escapeHTML(exam.title || "امتحان")}</strong>
        <p>${escapeHTML(exam.subjectName || "امتحان إلكتروني")} · ${Number(exam.durationMinutes) || 15} دقيقة</p>
        <small>${Array.isArray(exam.questions) ? exam.questions.length : 0} سؤال</small>
      </div>
    </div>
  `).join("");
}

function renderAchievements() {
  const points = Number(profile?.points) || 0;
  setText("statPoints", points);
  setText("achievementPoints", points);

  const badges = content.badges;
  if (!badges.length) {
    showEmpty("badgesList", "لم تُنشر إنجازات بعد.");
  } else {
    $("badgesList").innerHTML = badges.map((badge) => `
      <div class="badge-item">
        <span>★</span>
        <strong>${escapeHTML(badge.name || badge.title || "إنجاز")}</strong>
        <small>${escapeHTML(badge.description || "إنجاز مدرسي")}</small>
      </div>
    `).join("");
  }

  const rows = content.leaderboard
    .sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0))
    .slice(0, 20);

  if (!rows.length) {
    showEmpty("leaderboardList", "لا توجد نتائج منشورة في لوحة المتصدرين.");
  } else {
    $("leaderboardList").innerHTML = rows.map((row, index) => {
      const mine = row.uid === currentUser.uid || row.studentUid === currentUser.uid;
      return `
        <div class="leaderboard-item ${mine ? "mine" : ""}">
          <span class="leaderboard-rank">${index + 1}</span>
          <strong>${escapeHTML(mine ? displayName() : (row.studentName || "طالب"))}${mine ? " (أنت)" : ""}</strong>
          <small>${Number(row.points) || 0} نقطة</small>
        </div>`;
    }).join("");
  }
}

function renderAll() {
  renderProfile();
  renderAnnouncements();
  renderTimetable();
  renderSubjects();
  renderExams();
  renderAchievements();
}

function navigate(section) {
  if (!sectionNames[section]) return;

  document.querySelectorAll(".content-section").forEach((element) => {
    element.classList.toggle("active", element.id === `section-${section}`);
  });

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  setText("pageTitle", sectionNames[section]);
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("open");
  hidePageMessage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSidebar() {
  $("sidebar").classList.add("open");
  $("sidebarOverlay").classList.add("open");
}

function closeExamDialog() {
  if (examTimer) clearInterval(examTimer);
  examTimer = null;
  activeExam = null;
  examSubmitted = false;

  const dialog = $("examDialog");
  if (dialog.open) dialog.close();
}

function renderExamQuestions(exam) {
  const questions = Array.isArray(exam.questions) ? exam.questions : [];

  if (!questions.length) {
    $("examDialogContent").innerHTML =
      `<div class="empty-state">الامتحان لا يحتوي على أسئلة منشورة.</div>`;
    return;
  }

  const html = questions.map((question, index) => {
    const type = question.type || "mcq";
    let options = Array.isArray(question.options) ? question.options : [];

    if (type === "true_false") options = ["صح", "خطأ"];

    return `
      <div class="question-card" data-question-index="${index}">
        <h4>${index + 1}. ${escapeHTML(question.text || question.question || "سؤال")}</h4>
        ${options.map((option, optionIndex) => `
          <label class="answer-option">
            <input
              type="radio"
              name="question-${index}"
              value="${optionIndex}"
              required
            >
            <span>${escapeHTML(typeof option === "object" ? option.text : option)}</span>
          </label>
        `).join("")}
      </div>`;
  }).join("");

  $("examDialogContent").innerHTML = `
    <div class="exam-timer">الوقت المتبقي: <span id="examTimeLeft">--:--</span></div>
    <p class="muted-note">اختر إجابة واحدة لكل سؤال ثم اضغط تسليم الامتحان.</p>
    <form id="activeExamForm">
      ${html}
      <button class="primary-btn red" type="submit">تسليم الامتحان</button>
    </form>
  `;

  $("activeExamForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submitExam(exam);
  });
}

function startTimer(minutes) {
  if (examTimer) clearInterval(examTimer);

  const duration = Math.max(1, Number(minutes) || 15) * 60 * 1000;
  examDeadline = Date.now() + duration;

  const tick = () => {
    const remaining = Math.max(0, examDeadline - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timer = $("examTimeLeft");

    if (timer) {
      timer.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    if (remaining <= 0) {
      clearInterval(examTimer);
      examTimer = null;
      submitExam(activeExam, true);
    }
  };

  tick();
  examTimer = setInterval(tick, 1000);
}

function openExam(examId) {
  const exam = content.exams.find((item) => item.id === examId);
  if (!exam) return;

  if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
    showPageMessage("هذا الامتحان لا يحتوي على أسئلة جاهزة.");
    return;
  }

  activeExam = exam;
  examSubmitted = false;
  $("examDialogTitle").textContent = exam.title || "الامتحان الإلكتروني";
  renderExamQuestions(exam);

  const dialog = $("examDialog");
  if (!dialog.open) dialog.showModal();

  startTimer(exam.durationMinutes);
}

function submitExam(exam, timeExpired = false) {
  if (!exam || examSubmitted) return;
  examSubmitted = true;

  if (examTimer) clearInterval(examTimer);
  examTimer = null;

  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  let correct = 0;
  let answered = 0;

  questions.forEach((question, index) => {
    const selected = document.querySelector(`input[name="question-${index}"]:checked`);
    if (!selected) return;

    answered++;

    // correctAnswer يجب أن يكون فهرس الاختيار الصحيح (رقمًا يبدأ من الصفر).
    // لا تُعرض إجابات الأسئلة الصحيحة في بيانات عامة للطلاب.
    const expected = Number(question.correctAnswer);
    if (Number(selected.value) === expected) correct++;
  });

  const percent = questions.length
    ? Math.round((correct / questions.length) * 100)
    : 0;

  $("examDialogContent").innerHTML = `
    <div class="exam-result">
      <div class="achievement-star" style="margin:0 auto 15px">✓</div>
      <h3>${timeExpired ? "انتهى وقت الامتحان" : "تم إنهاء المحاولة"}</h3>
      <strong>${correct} / ${questions.length}</strong>
      <p>الإجابات التي أجبت عنها: ${answered} من ${questions.length}<br>النسبة المحسوبة على هذا الجهاز: ${percent}%</p>
      <p>هذه نتيجة مبدئية محسوبة داخل المتصفح وليست نتيجة رسمية معتمدة.</p>
      <button class="primary-btn" id="closeExamResult" type="button">العودة للامتحانات</button>
    </div>
  `;

  $("closeExamResult").addEventListener("click", () => {
    closeExamDialog();
  });

  /*
    لا نحفظ الدرجة من المتصفح كدرجة رسمية.
    اعتماد النتائج والنقاط يتطلب تحققًا موثوقًا من جهة خادمية،
    وإلا يمكن تعديل الإجابات والنتيجة من أدوات المتصفح.
  */
}

async function initializeStudent(user) {
  currentUser = user;

  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));

    if (!snapshot.exists()) {
      await signOut(auth);
      window.location.replace("login.html");
      return;
    }

    profile = snapshot.data();

    if (profile.active !== true || profile.role !== "student") {
      await signOut(auth);
      window.location.replace("login.html");
      return;
    }

    // لا نعرض المحتوى المخصص للصف قبل وجود معرّف صف واضح.
    renderProfile();

    if (!classId()) {
      showPageMessage(
        "حسابك نشط، لكن لم يتم ربطه بفصل دراسي بعد. تواصل مع إدارة المدرسة لإكمال بيانات الصف."
      );
    }

    await loadStudentData();
  } catch (error) {
    console.error("Student initialization failed:", error);
    showPageMessage(
      "تعذر تحميل بيانات الحساب. تحقق من اتصال الإنترنت وقواعد Firestore، ثم أعد المحاولة."
    );
  }
}

document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.section));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.go));
});

$("menuToggle").addEventListener("click", openSidebar);
$("sidebarOverlay").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("open");
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch {
    showPageMessage("تعذر تسجيل الخروج الآن. حاول مرة أخرى.");
  }
});

$("subjectSearch").addEventListener("input", renderSubjects);

$("examsList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-exam-id]");
  if (button) openExam(button.dataset.examId);
});

$("examDialog").addEventListener("close", () => {
  if (examTimer) clearInterval(examTimer);
  examTimer = null;
  activeExam = null;
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  await initializeStudent(user);
});
