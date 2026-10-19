import {
  auth, db, onAuthStateChanged, signOut, isAdminEmail
} from "./firebase.js";

import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  query, limit, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  getApps, initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

/* =========================================================
   الإعدادات الأساسية
   ========================================================= */

const $ = (id) => document.getElementById(id);

const STAGES = [
  "الأول الثانوي التمريض",
  "الثاني الثانوي التمريض",
  "الثالث الثانوي التمريض",
  "الأول معهد",
  "الثاني معهد"
];

const ROLE_OPTIONS = [
  ["student", "طالب"],
  ["teacher", "معلم"],
  ["employee", "موظف"],
  ["student_affairs", "شؤون الطلاب"],
  ["exams_affairs", "شؤون الامتحانات"],
  ["owner", "المالك / الإدارة العليا"],
  ["director", "مدير"]
];

const ACTIVE_OPTIONS = [
  ["true", "نشط"],
  ["false", "غير نشط"]
];

const PAGE_CONFIG = {
  users: {
    title: "الحسابات",
    collection: "users",
    description: "إنشاء حسابات الطلاب والمعلمين والموظفين وتعديل بيانات ملفاتهم.",
    columns: ["name", "loginCode", "role", "stage", "className", "active"],
    fields: [
      { key: "name", label: "الاسم الكامل", required: true },
      { key: "loginCode", label: "كود الدخول", required: true, createOnly: true },
      { key: "password", label: "كلمة المرور", type: "password", required: true, createOnly: true },
      { key: "role", label: "نوع الحساب", type: "select", options: ROLE_OPTIONS, required: true },
      { key: "stage", label: "المرحلة الدراسية", type: "select", options: STAGES.map(x => [x, x]) },
      { key: "classId", label: "معرّف الفصل" },
      { key: "className", label: "اسم الفصل" },
      { key: "points", label: "النقاط", type: "number", default: "0" },
      { key: "active", label: "حالة الحساب", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  },

  classes: {
    title: "الفصول",
    collection: "classes",
    description: "إدارة الفصول وربطها بالمرحلة الدراسية.",
    columns: ["name", "stage", "classCode", "active"],
    fields: [
      { key: "name", label: "اسم الفصل", required: true },
      { key: "classCode", label: "كود الفصل" },
      { key: "stage", label: "المرحلة", type: "select", options: STAGES.map(x => [x, x]), required: true },
      { key: "active", label: "الحالة", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  },

  subjects: {
    title: "المواد الدراسية",
    collection: "subjects",
    description: "إضافة المواد وتحديد المرحلة والمعلم المسؤول عند توفر معرّفه.",
    columns: ["name", "stage", "teacherUid", "active"],
    fields: [
      { key: "name", label: "اسم المادة", required: true },
      { key: "subjectCode", label: "كود المادة" },
      { key: "stage", label: "المرحلة", type: "select", options: STAGES.map(x => [x, x]), required: true },
      { key: "teacherUid", label: "معرّف حساب المعلم UID" },
      { key: "active", label: "الحالة", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  },

  timetables: {
    title: "الجداول",
    collection: "timetables",
    description: "إضافة الحصص ومواعيدها وربطها بالفصل والمادة.",
    columns: ["day", "startTime", "endTime", "subjectName", "className", "teacherName"],
    fields: [
      { key: "day", label: "اليوم", type: "select", options: [
        ["الأحد","الأحد"], ["الاثنين","الاثنين"], ["الثلاثاء","الثلاثاء"],
        ["الأربعاء","الأربعاء"], ["الخميس","الخميس"], ["الجمعة","الجمعة"], ["السبت","السبت"]
      ], required: true },
      { key: "startTime", label: "وقت البداية", type: "time", required: true },
      { key: "endTime", label: "وقت النهاية", type: "time", required: true },
      { key: "stage", label: "المرحلة", type: "select", options: STAGES.map(x => [x, x]) },
      { key: "classId", label: "معرّف الفصل" },
      { key: "className", label: "اسم الفصل" },
      { key: "subjectId", label: "معرّف المادة" },
      { key: "subjectName", label: "اسم المادة", required: true },
      { key: "teacherUid", label: "معرّف المعلم UID" },
      { key: "teacherName", label: "اسم المعلم" },
      { key: "room", label: "القاعة / المكان" },
      { key: "active", label: "الحالة", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  },

  announcements: {
    title: "الإعلانات",
    collection: "announcements",
    description: "نشر الإعلانات وتحديد الجمهور المستهدف.",
    columns: ["title", "targetRole", "stage", "active", "createdAt"],
    fields: [
      { key: "title", label: "عنوان الإعلان", required: true },
      { key: "body", label: "محتوى الإعلان", type: "textarea", required: true, full: true },
      { key: "targetRole", label: "الجمهور", type: "select", options: [
        ["all", "الجميع"], ...ROLE_OPTIONS
      ], default: "all" },
      { key: "stage", label: "مرحلة محددة (اختياري)", type: "select", options: [
        ["", "كل المراحل"], ...STAGES.map(x => [x, x])
      ] },
      { key: "active", label: "منشور / نشط", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  },

  exams: {
    title: "الاختبارات",
    collection: "exams",
    description: "إدارة بيانات الاختبار. حقل الأسئلة يقبل مصفوفة JSON، ويمكن تركه فارغًا لإنشاء الاختبار أولًا.",
    columns: ["title", "subjectName", "stage", "durationMinutes", "active"],
    fields: [
      { key: "title", label: "عنوان الاختبار", required: true },
      { key: "subjectId", label: "معرّف المادة" },
      { key: "subjectName", label: "اسم المادة" },
      { key: "stage", label: "المرحلة", type: "select", options: STAGES.map(x => [x, x]), required: true },
      { key: "classId", label: "معرّف الفصل (اختياري)" },
      { key: "className", label: "اسم الفصل (اختياري)" },
      { key: "durationMinutes", label: "المدة بالدقائق", type: "number", default: "30", required: true },
      { key: "totalMarks", label: "الدرجة النهائية", type: "number", default: "0" },
      { key: "startAt", label: "موعد البداية (نص أو ISO)" },
      { key: "endAt", label: "موعد النهاية (نص أو ISO)" },
      { key: "questions", label: "الأسئلة بصيغة JSON (اختياري)", type: "textarea", full: true, json: true,
        placeholder: '[{"question":"مثال؟","type":"mcq","options":["أ","ب"],"correctAnswer":"أ","marks":1}]' },
      { key: "active", label: "متاح للطلاب", type: "select", options: ACTIVE_OPTIONS, default: "false" }
    ]
  },

  results: {
    title: "المحاولات والنتائج",
    collection: "examAttempts",
    description: "عرض محاولات الاختبارات. هذا القسم للقراءة فقط من لوحة الإدارة.",
    columns: ["studentName", "studentUid", "examTitle", "score", "totalMarks", "status", "submittedAt"],
    fields: [],
    readOnly: true
  },

  badges: {
    title: "الشارات",
    collection: "badges",
    description: "إضافة الشارات وربطها بنظام النقاط والإنجازات.",
    columns: ["name", "description", "pointsRequired", "active"],
    fields: [
      { key: "name", label: "اسم الشارة", required: true },
      { key: "description", label: "الوصف", type: "textarea", full: true },
      { key: "pointsRequired", label: "النقاط المطلوبة", type: "number", default: "0" },
      { key: "icon", label: "رمز أو إيموجي الشارة" },
      { key: "active", label: "الحالة", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  },

  leaderboard: {
    title: "النقاط والترتيب",
    collection: "leaderboard",
    description: "إدارة سجلات النقاط. يجب ربط كل سجل بمعرّف حساب الطالب الصحيح.",
    columns: ["studentName", "studentUid", "points", "stage", "className"],
    fields: [
      { key: "studentUid", label: "معرّف الطالب UID", required: true },
      { key: "studentName", label: "اسم الطالب", required: true },
      { key: "points", label: "النقاط", type: "number", default: "0", required: true },
      { key: "stage", label: "المرحلة", type: "select", options: STAGES.map(x => [x, x]) },
      { key: "className", label: "الفصل" }
    ]
  },

  roles: {
    title: "تعريف الأدوار",
    collection: "roleDefinitions",
    description: "حفظ تعريف الدور وقائمة الصلاحيات المطلوبة. تخزين الصلاحيات هنا وحده لا يفعّلها في قواعد Firestore تلقائيًا.",
    columns: ["name", "code", "description", "permissions", "active"],
    fields: [
      { key: "name", label: "اسم الدور", required: true },
      { key: "code", label: "رمز الدور (إنجليزي)", required: true },
      { key: "description", label: "وصف الدور", type: "textarea", full: true },
      { key: "permissions", label: "الصلاحيات المطلوبة مفصولة بفاصلة", type: "textarea", full: true,
        placeholder: "users.read,announcements.create,timetables.read" },
      { key: "active", label: "الحالة", type: "select", options: ACTIVE_OPTIONS, default: "true" }
    ]
  }
};

const PAGE_IDS = {
  overview: "overviewPage",
  users: "dataPage",
  classes: "dataPage",
  subjects: "dataPage",
  timetables: "dataPage",
  announcements: "dataPage",
  exams: "dataPage",
  results: "dataPage",
  badges: "dataPage",
  leaderboard: "dataPage",
  roles: "dataPage"
};

let currentPage = "overview";
let currentRows = [];
let editingId = null;
let isCreating = false;
let currentUser = null;
let secondaryAuth = null;
let busy = false;

/* =========================================================
   أدوات عامة
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function showStatus(message, type = "info") {
  const box = $("status");
  box.className = `status ${type}`;
  box.textContent = message;
}

function showFormError(message) {
  const el = $("formError");
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearFormError() {
  $("formError").textContent = "";
  $("formError").classList.add("hidden");
}

function toBoolean(value) {
  return value === true || value === "true";
}

function displayValue(key, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (key === "active") {
    return toBoolean(value)
      ? '<span class="pill">نشط</span>'
      : '<span class="pill off">غير نشط</span>';
  }
  if (Array.isArray(value)) return escapeHTML(value.join(", "));
  if (typeof value === "object") return escapeHTML(JSON.stringify(value));
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return escapeHTML(value);
  if (key.toLowerCase().includes("password")) return "••••••";
  if (key.toLowerCase().includes("at") && value?.toDate) {
    return escapeHTML(value.toDate().toLocaleString("ar-EG"));
  }
  return escapeHTML(value);
}

function prettyLabel(key) {
  const labels = {
    name: "الاسم", fullName: "الاسم الكامل", loginCode: "كود الدخول",
    role: "نوع الحساب", stage: "المرحلة", classId: "معرّف الفصل",
    className: "الفصل", active: "الحالة", points: "النقاط",
    title: "العنوان", body: "المحتوى", targetRole: "الجمهور",
    createdAt: "تاريخ الإنشاء", studentName: "اسم الطالب",
    studentUid: "UID الطالب", examTitle: "الاختبار", score: "الدرجة",
    totalMarks: "الدرجة النهائية", status: "الحالة", submittedAt: "وقت التسليم",
    durationMinutes: "المدة بالدقائق", subjectName: "المادة",
    teacherName: "المعلم", startTime: "من", endTime: "إلى",
    classCode: "كود الفصل", teacherUid: "UID المعلم",
    subjectId: "معرّف المادة", name: "الاسم", code: "الرمز",
    description: "الوصف", permissions: "الصلاحيات", pointsRequired: "النقاط المطلوبة"
  };
  return labels[key] || key;
}

function setBusy(value) {
  busy = value;
  $("saveBtn").disabled = value;
  $("saveBtn").textContent = value ? "جارٍ الحفظ…" : "حفظ البيانات";
  $("addBtn").disabled = value || Boolean(PAGE_CONFIG[currentPage]?.readOnly);
  $("reloadBtn").disabled = value;
}

/* =========================================================
   الاتصال والتحقق من حساب الإدارة
   ========================================================= */

function getSecondaryAuth() {
  const config = {
    apiKey: "AIzaSyC5ODDwC3w9ZsHcAAGGdipl3oUNvlUG9Tw",
    authDomain: "egns-99c3b.firebaseapp.com",
    projectId: "egns-99c3b",
    storageBucket: "egns-99c3b.firebasestorage.app",
    messagingSenderId: "920048533301",
    appId: "1:920048533301:web:9ffceba997d6db9426567c",
    measurementId: "G-9DRZGZJHEV"
  };

  let app = getApps().find(item => item.name === "egnsAccountCreator");
  if (!app) app = initializeApp(config, "egnsAccountCreator");
  return getAuth(app);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }

  if (!isAdminEmail(user.email)) {
    showStatus("هذا الحساب ليس ضمن حسابات الإدارة المسموح لها. سيتم إنهاء الجلسة.", "err");
    await signOut(auth);
    window.location.replace("./login.html");
    return;
  }

  currentUser = user;
  $("adminEmail").textContent = user.email || "";
  try {
    secondaryAuth = getSecondaryAuth();
    await loadOverview();
    showStatus("تم تسجيل الدخول كإدارة. نجاح قراءة البيانات يعتمد على قواعد Firestore الحالية.", "ok");
    $("connectionInfo").textContent =
      "تم تسجيل الدخول عبر Firebase Authentication. اختبر كل مجموعة على حدة؛ قد تمنع قواعد Firestore الوصول لبعض المجموعات.";
  } catch (error) {
    showStatus(`تم تسجيل الدخول، لكن تعذّر تحميل الملخص: ${error.message}`, "err");
    $("connectionInfo").textContent = `خطأ: ${error.message}`;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("./login.html");
  } catch (error) {
    showStatus(`تعذّر تسجيل الخروج: ${error.message}`, "err");
  }
});

/* =========================================================
   التنقل والملخص
   ========================================================= */

$("navigation").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  await openPage(button.dataset.page);
});

$("refreshBtn").addEventListener("click", async () => {
  if (currentPage === "overview") await loadOverview();
  else await loadPageData(currentPage);
});

$("overviewReload").addEventListener("click", loadOverview);
$("reloadBtn").addEventListener("click", () => loadPageData(currentPage));
$("searchInput").addEventListener("input", renderCurrentTable);
$("addBtn").addEventListener("click", () => openForm(null));
$("closeModal").addEventListener("click", closeForm);
$("cancelBtn").addEventListener("click", closeForm);
$("modal").addEventListener("click", (event) => {
  if (event.target === $("modal")) closeForm();
});

async function openPage(page) {
  if (!PAGE_IDS[page]) return;
  currentPage = page;

  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("overviewPage").classList.toggle("hidden", page !== "overview");
  $("dataPage").classList.toggle("hidden", page === "overview");

  if (page === "overview") {
    await loadOverview();
    return;
  }

  const config = PAGE_CONFIG[page];
  $("pageTitle").textContent = config.title;
  $("pageDescription").textContent = config.description;
  $("addBtn").classList.toggle("hidden", Boolean(config.readOnly));
  $("searchInput").value = "";
  await loadPageData(page);
}

async function safeRead(collectionName) {
  const result = await getDocs(query(collection(db, collectionName), limit(300)));
  return result.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
}

async function loadOverview() {
  $("connectionInfo").textContent = "جارٍ الاتصال بقاعدة البيانات…";
  const targets = [
    ["users", "statUsers"],
    ["classes", "statClasses"],
    ["subjects", "statSubjects"],
    ["exams", "statExams"]
  ];

  let successes = 0;
  const errors = [];

  for (const [collectionName, targetId] of targets) {
    try {
      const rows = await safeRead(collectionName);
      $(targetId).textContent = rows.length;
      successes++;
    } catch (error) {
      $(targetId).textContent = "—";
      errors.push(`${collectionName}: ${error.code || error.message}`);
    }
  }

  if (errors.length) {
    $("connectionInfo").textContent =
      `نجحت قراءة ${successes} من ${targets.length} مجموعات.\n` +
      `تعذّر الوصول إلى:\n${errors.join("\n")}\n` +
      "راجع قواعد Firestore وصلاحيات الحساب لهذه المجموعات.";
    showStatus("الاتصال بحساب Firebase موجود، لكن توجد مجموعات لا تسمح قواعد Firestore بقراءتها.", "err");
  } else {
    $("connectionInfo").textContent = "نجحت قراءة مجموعات الملخص الأربع.";
    showStatus("تم تحميل ملخص البيانات من Firestore.", "ok");
  }
}

/* =========================================================
   تحميل وعرض السجلات
   ========================================================= */

async function loadPageData(page) {
  const config = PAGE_CONFIG[page];
  if (!config) return;

  $("loading").classList.remove("hidden");
  $("tableContainer").innerHTML = "";
  showStatus(`جارٍ تحميل قسم ${config.title}…`, "info");

  try {
    currentRows = await safeRead(config.collection);
    renderCurrentTable();
    showStatus(`تم تحميل ${currentRows.length} سجل من ${config.collection}.`, "ok");
  } catch (error) {
    currentRows = [];
    $("tableContainer").innerHTML =
      `<div class="empty">تعذّر تحميل البيانات من <b>${escapeHTML(config.collection)}</b>.<br>` +
      `رمز الخطأ: ${escapeHTML(error.code || "غير متوفر")}<br>` +
      `${escapeHTML(error.message)}<br><br>` +
      `تحقّق من قواعد Firestore واسم المجموعة.</div>`;
    showStatus(`فشل تحميل ${config.collection}: ${error.message}`, "err");
  } finally {
    $("loading").classList.add("hidden");
  }
}

function renderCurrentTable() {
  const config = PAGE_CONFIG[currentPage];
  if (!config || currentPage === "overview") return;

  const search = $("searchInput").value.trim().toLowerCase();
  const rows = currentRows.filter(row => {
    if (!search) return true;
    return Object.entries(row).some(([key, value]) => {
      if (key === "password") return false;
      const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      return `${key} ${text}`.toLowerCase().includes(search);
    });
  });

  if (!rows.length) {
    $("tableContainer").innerHTML = '<div class="empty">لا توجد سجلات مطابقة. يمكنك إضافة سجل جديد إذا كانت صلاحيات Firestore تسمح بذلك.</div>';
    return;
  }

  const columns = config.columns;
  const headers = columns.map(key => `<th>${escapeHTML(prettyLabel(key))}</th>`).join("");
  const body = rows.map(row => {
    const cells = columns.map(key => `<td>${displayValue(key, row[key])}</td>`).join("");
    const actions = config.readOnly
      ? ""
      : `<td><div class="actions">
          <button class="btn secondary" data-action="edit" data-id="${escapeHTML(row.id)}">تعديل</button>
          <button class="btn danger" data-action="delete" data-id="${escapeHTML(row.id)}">حذف</button>
        </div></td>`;

    return `<tr>${cells}${config.readOnly ? "" : actions}</tr>`;
  }).join("");

  $("tableContainer").innerHTML = `
    <table>
      <thead><tr>${headers}${config.readOnly ? "" : "<th>إجراءات</th>"}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="muted">المعروض ${rows.length} سجل من أصل ${currentRows.length} سجل تم تحميله. الحد الأقصى للتحميل في القسم 300 سجل.</p>
  `;
}

$("tableContainer").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const row = currentRows.find(item => item.id === id);
  if (!row) return;

  if (action === "edit") {
    openForm(row);
  } else if (action === "delete") {
    await deleteRecord(row);
  }
});

/* =========================================================
   إنشاء النموذج وتعبئته
   ========================================================= */

function openForm(row = null) {
  const config = PAGE_CONFIG[currentPage];
  if (!config || config.readOnly) return;

  editingId = row?.id || null;
  isCreating = !row;

  $("formTitle").textContent = row
    ? `تعديل: ${config.title}`
    : `إضافة إلى: ${config.title}`;

  clearFormError();
  const container = $("formFields");
  container.innerHTML = "";

  config.fields.forEach(field => {
    if (field.createOnly && row) return;

    const wrapper = document.createElement("div");
    wrapper.className = `field${field.full ? " full" : ""}`;

    const label = document.createElement("label");
    label.textContent = field.label;
    label.htmlFor = `field-${field.key}`;
    wrapper.appendChild(label);

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      (field.options || []).forEach(([value, labelText]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = labelText;
        input.appendChild(option);
      });
    } else if (field.type === "textarea") {
      input = document.createElement("textarea");
      if (field.placeholder) input.placeholder = field.placeholder;
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
      if (field.type === "password") input.autocomplete = "new-password";
    }

    input.id = `field-${field.key}`;
    input.name = field.key;
    if (field.required) input.required = true;

    let value = row?.[field.key];
    if (value === undefined || value === null) value = field.default ?? "";

    if (field.key === "active") value = String(value);
    if (field.json && typeof value !== "string") value = value?.length ? JSON.stringify(value, null, 2) : "";
    if (field.key === "permissions" && Array.isArray(value)) value = value.join(", ");
    if (value && typeof value === "object" && value.toDate) value = value.toDate().toISOString();

    input.value = String(value);
    if (field.createOnly && !isCreating) input.disabled = true;

    wrapper.appendChild(input);

    if (field.key === "loginCode") {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "سيكون اسم الدخول: الكود@accounts.egns.com";
      wrapper.appendChild(hint);
    }
    if (field.key === "password") {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "تُنشأ كلمة المرور في Firebase Authentication ولا تُحفظ في ملف Firestore.";
      wrapper.appendChild(hint);
    }

    container.appendChild(wrapper);
  });

  $("modal").classList.remove("hidden");
}

function closeForm() {
  $("modal").classList.add("hidden");
  $("recordForm").reset();
  clearFormError();
  editingId = null;
  isCreating = false;
}

function collectFormData() {
  const config = PAGE_CONFIG[currentPage];
  const data = {};

  for (const field of config.fields) {
    if (field.createOnly && !isCreating) continue;
    const input = $(`field-${field.key}`);
    if (!input) continue;

    let value = input.value.trim();

    if (field.required && !value) {
      throw new Error(`الحقل "${field.label}" مطلوب.`);
    }

    if (field.key === "password" && isCreating) {
      if (value.length < 6) throw new Error("كلمة المرور يجب ألا تقل عن 6 أحرف.");
      data.password = value;
      continue;
    }

    if (field.key === "loginCode" && isCreating) {
      if (!/^[a-zA-Z0-9._-]{3,64}$/.test(value)) {
        throw new Error("كود الدخول يجب أن يتكون من 3 إلى 64 حرفًا أو رقمًا، ويمكن استخدام النقطة والشرطة.");
      }
      data.loginCode = value.toLowerCase();
      continue;
    }

    if (field.type === "number") {
      if (value === "") value = "0";
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`القيمة في "${field.label}" يجب أن تكون رقمًا.`);
      data[field.key] = number;
      continue;
    }

    if (field.key === "active") {
      data.active = toBoolean(value);
      continue;
    }

    if (field.json) {
      if (!value) {
        data[field.key] = [];
      } else {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error("يجب أن تكون البيانات مصفوفة.");
          data[field.key] = parsed;
        } catch (error) {
          throw new Error(`صيغة JSON في "${field.label}" غير صحيحة: ${error.message}`);
        }
      }
      continue;
    }

    if (field.key === "permissions") {
      data.permissions = value
        ? value.split(",").map(item => item.trim()).filter(Boolean)
        : [];
      continue;
    }

    data[field.key] = value;
  }

  if (currentPage === "roles") {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,39}$/.test(data.code || "")) {
      throw new Error("رمز الدور يجب أن يبدأ بحرف إنجليزي ويحتوي على حروف أو أرقام أو _ أو -.");
    }
  }

  if (currentPage === "users" && isCreating) {
    data.role = data.role || "student";
    data.points = Number(data.points || 0);
    data.active = data.active !== false;
  }

  return data;
}

/* =========================================================
   حفظ السجلات وإنشاء حسابات المستخدمين
   ========================================================= */

$("recordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  setBusy(true);
  clearFormError();

  try {
    const config = PAGE_CONFIG[currentPage];
    const data = collectFormData();

    if (currentPage === "users" && isCreating) {
      await createAccountAndProfile(data);
    } else if (editingId) {
      delete data.password;
      delete data.loginCode;
      data.updatedAt = serverTimestamp();
      await updateDoc(doc(db, config.collection, editingId), data);
    } else {
      data.createdAt = serverTimestamp();
      data.createdBy = currentUser?.uid || "";
      await addDoc(collection(db, config.collection), data);
    }

    closeForm();
    showStatus("تم إرسال عملية الحفظ إلى Firebase بنجاح.", "ok");
    await loadPageData(currentPage);
    if (currentPage === "users" || currentPage === "classes" ||
        currentPage === "subjects" || currentPage === "exams") {
      await loadOverview();
    }
  } catch (error) {
    showFormError(error.message || "تعذّر حفظ البيانات.");
    showStatus(`فشلت عملية الحفظ: ${error.message || error}`, "err");
  } finally {
    setBusy(false);
  }
});

async function createAccountAndProfile(data) {
  const password = data.password;
  const loginCode = data.loginCode.toLowerCase();
  const email = `${loginCode}@accounts.egns.com`;

  if (!secondaryAuth) secondaryAuth = getSecondaryAuth();

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "كود الدخول مستخدم بالفعل. اختر كودًا آخر.",
      "auth/weak-password": "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.",
      "auth/invalid-email": "كود الدخول ينتج عنه بريد غير صالح.",
      "auth/network-request-failed": "تعذّر الاتصال بالإنترنت أثناء إنشاء الحساب."
    };
    throw new Error(messages[error.code] || `فشل إنشاء حساب Authentication: ${error.message}`);
  }

  const uid = credential.user.uid;
  const profile = { ...data };
  delete profile.password;

  profile.loginCode = loginCode;
  profile.name = profile.name || "";
  profile.role = profile.role || "student";
  profile.active = profile.active !== false;
  profile.points = Number(profile.points || 0);
  profile.createdAt = serverTimestamp();
  profile.createdBy = currentUser?.uid || "";
  profile.email = email;

  try {
    await setDoc(doc(db, "users", uid), profile);
  } catch (error) {
    throw new Error(
      `تم إنشاء حساب Authentication بالفعل (${email})، لكن تعذّر حفظ ملفه في users/${uid}. ` +
      `لا تعاود إنشاء الحساب بنفس الكود. أصلح صلاحيات Firestore ثم أكمل ملف المستخدم. السبب: ${error.message}`
    );
  } finally {
    try {
      if (secondaryAuth.currentUser) await signOutSecondary(secondaryAuth);
    } catch (_) {
      // لا نغيّر نتيجة العملية الأساسية بسبب فشل تسجيل الخروج من جلسة الإنشاء.
    }
  }
}

/* =========================================================
   حذف السجلات
   ========================================================= */

async function deleteRecord(row) {
  const config = PAGE_CONFIG[currentPage];
  if (!config || config.readOnly) return;

  if (currentPage === "users") {
    const confirmed = window.confirm(
      `هل تريد تعطيل حساب ${row.name || row.loginCode || row.id}؟\n` +
      "سيتم تعطيل ملف Firestore فقط، ولن يُحذف مستخدم Firebase Authentication من هنا."
    );
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "users", row.id), {
        active: false,
        updatedAt: serverTimestamp()
      });
      showStatus("تم تعطيل ملف المستخدم في Firestore. قد يظل تسجيل الدخول إلى Authentication ممكنًا ما لم يتحقق التطبيق من active.", "ok");
      await loadPageData(currentPage);
    } catch (error) {
      showStatus(`تعذّر تعطيل المستخدم: ${error.message}`, "err");
    }
    return;
  }

  const confirmed = window.confirm(`هل تريد حذف هذا السجل من ${config.collection}؟ لا يمكن التراجع عن هذا الحذف.`);
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, config.collection, row.id));
    showStatus("تم حذف السجل من Firestore.", "ok");
    await loadPageData(currentPage);
  } catch (error) {
    showStatus(`فشل حذف السجل: ${error.message}`, "err");
  }
}
