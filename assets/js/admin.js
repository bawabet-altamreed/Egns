
import {
  auth,
  db,
  signOut,
  onAuthStateChanged,
  isAdminEmail
} from "./firebase.js";

import {
  getApp,
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const authLoading = $("authLoading");
const adminApp = $("adminApp");
const notice = $("notice");
const overviewSection = $("overviewSection");
const managementSection = $("managementSection");
const formSection = $("formSection");
const recordsList = $("recordsList");
const formFields = $("formFields");
const recordForm = $("recordForm");

let currentSection = "overview";
let editingId = null;
let cachedRecords = [];
let examAnswersForEdit = {};
let noticeTimer = null;
let accountAuth = null;

const stages = [
  ["الأول الثانوي التمريض", "الأول الثانوي التمريض"],
  ["الثاني الثانوي التمريض", "الثاني الثانوي التمريض"],
  ["الثالث الثانوي التمريض", "الثالث الثانوي التمريض"],
  ["الأول معهد", "الأول معهد"],
  ["الثاني معهد", "الثاني معهد"]
];

const days = [
  ["الأحد", "الأحد"],
  ["الاثنين", "الاثنين"],
  ["الثلاثاء", "الثلاثاء"],
  ["الأربعاء", "الأربعاء"],
  ["الخميس", "الخميس"],
  ["الجمعة", "الجمعة"],
  ["السبت", "السبت"]
];

function commonActive(label = "نشط / ظاهر للطلاب", value = true) {
  return {
    name: "active",
    label,
    type: "checkbox",
    defaultValue: value
  };
}

const accountFields = [
  { name: "name", label: "الاسم بالكامل", required: true },
  {
    name: "loginCode",
    label: "كود الدخول",
    required: true,
    help: "يُستخدم الكود لتسجيل الدخول."
  },
  {
    name: "password",
    label: "كلمة المرور عند إنشاء الحساب",
    type: "password",
    required: true,
    help: "مطلوبة عند إنشاء حساب جديد فقط. لا تُحفظ في Firestore."
  },
  {
    name: "stage",
    label: "المرحلة الدراسية",
    type: "select",
    options: stages,
    required: true
  },
  { name: "classId", label: "كود الفصل" },
  { name: "className", label: "اسم الفصل" },
  {
    name: "active",
    label: "الحساب نشط",
    type: "checkbox",
    defaultValue: true
  }
];

const configs = {
  classes: {
    title: "الفصول الدراسية",
    collection: "classes",
    description: "إنشاء الفصول وربط الطلاب والمحتوى بها.",
    idField: "classId",
    fields: [
      { name: "classId", label: "كود الفصل", required: true },
      { name: "name", label: "اسم الفصل", required: true },
      {
        name: "stage",
        label: "المرحلة الدراسية",
        type: "select",
        options: stages,
        required: true
      },
      { name: "section", label: "الشعبة" },
      { name: "academicYear", label: "العام الدراسي" },
      commonActive("الفصل نشط")
    ]
  },

  students: {
    title: "إدارة الطلاب",
    collection: "users",
    role: "student",
    account: true,
    description: "إنشاء حسابات الطلاب وإدارة ملفاتهم الدراسية.",
    fields: [
      ...accountFields,
      {
        name: "points",
        label: "النقاط",
        type: "number",
        min: 0,
        defaultValue: 0
      }
    ]
  },

  teachers: {
    title: "إدارة المعلمين",
    collection: "users",
    role: "teacher",
    account: true,
    description: "إنشاء حسابات المعلمين وإدارة بياناتهم.",
    fields: [
      { name: "name", label: "اسم المعلم بالكامل", required: true },
      { name: "loginCode", label: "كود الدخول", required: true },
      {
        name: "password",
        label: "كلمة المرور عند إنشاء الحساب",
        type: "password",
        required: true,
        help: "لا تُحفظ في Firestore."
      },
      { name: "specialty", label: "التخصص" },
      { name: "phone", label: "رقم التواصل" },
      { name: "assignedClasses", label: "أكواد الفصول (افصل بينها بفاصلة)" },
      { name: "assignedSubjects", label: "أسماء المواد (افصل بينها بفاصلة)" },
      commonActive("حساب المعلم نشط")
    ]
  },

  employees: {
    title: "إدارة الموظفين",
    collection: "users",
    role: "employee",
    account: true,
    description: "إنشاء حسابات الموظفين وإدارة بياناتهم.",
    fields: [
      { name: "name", label: "اسم الموظف بالكامل", required: true },
      { name: "loginCode", label: "كود الدخول", required: true },
      {
        name: "password",
        label: "كلمة المرور عند إنشاء الحساب",
        type: "password",
        required: true,
        help: "لا تُحفظ في Firestore."
      },
      {
        name: "department",
        label: "القسم الوظيفي",
        type: "select",
        options: [
          ["student_affairs", "شؤون الطلاب"],
          ["exams_affairs", "شؤون الامتحانات"],
          ["administration", "الإدارة"],
          ["other", "قسم آخر"]
        ]
      },
      { name: "phone", label: "رقم التواصل" },
      commonActive("حساب الموظف نشط")
    ]
  },

  subjects: {
    title: "المواد الدراسية",
    collection: "subjects",
    description: "إدارة المواد وربطها بالفصول.",
    fields: [
      { name: "name", label: "اسم المادة", required: true },
      { name: "description", label: "وصف المادة", type: "textarea" },
      { name: "classId", label: "كود الفصل", required: true },
      commonActive("المادة متاحة للطلاب")
    ]
  },

  announcements: {
    title: "الإعلانات",
    collection: "announcements",
    description: "نشر إعلانات عامة أو مخصصة لفصل.",
    fields: [
      { name: "title", label: "عنوان الإعلان", required: true },
      { name: "body", label: "نص الإعلان", type: "textarea", required: true },
      {
        name: "category",
        label: "نوع الإعلان",
        type: "select",
        options: [
          ["عام", "عام"],
          ["دراسي", "دراسي"],
          ["امتحانات", "امتحانات"],
          ["تنبيه", "تنبيه"]
        ]
      },
      { name: "stage", label: "المرحلة (اختياري)" },
      { name: "classId", label: "كود الفصل (اتركه فارغًا للإعلان العام)" },
      commonActive("منشور للطلاب")
    ]
  },

  timetables: {
    title: "الجداول الدراسية",
    collection: "timetables",
    description: "إدارة مواعيد الحصص لكل فصل.",
    fields: [
      {
        name: "day",
        label: "اليوم",
        type: "select",
        options: days,
        required: true
      },
      { name: "period", label: "الحصة / التوقيت", required: true },
      { name: "subjectName", label: "اسم المادة", required: true },
      { name: "teacherName", label: "اسم المعلم" },
      { name: "room", label: "القاعة" },
      { name: "classId", label: "كود الفصل", required: true },
      commonActive("ظاهر للطلاب")
    ]
  },

  exams: {
    title: "إدارة الامتحانات",
    collection: "exams",
    description: "مراجعة بيانات الامتحانات وحالة نشرها. إنشاء الأسئلة التفصيلي يكون من حساب المعلم.",
    fields: [
      { name: "title", label: "اسم الامتحان", required: true },
      { name: "description", label: "الوصف", type: "textarea" },
      { name: "subjectName", label: "اسم المادة", required: true },
      { name: "classId", label: "كود الفصل", required: true },
      { name: "teacherUid", label: "UID المعلم المسؤول" },
      {
        name: "durationMinutes",
        label: "المدة بالدقائق",
        type: "number",
        min: 1,
        required: true
      },
      {
        name: "totalMarks",
        label: "الدرجة النهائية",
        type: "number",
        min: 1,
        required: true
      },
      {
        name: "startsAt",
        label: "بداية الامتحان (تاريخ ووقت ISO)",
        help: "مثال: 2026-10-20T09:00:00"
      },
      {
        name: "endsAt",
        label: "نهاية إتاحة الامتحان (تاريخ ووقت ISO)"
      },
      commonActive("متاح للطلاب", false)
    ]
  },

  examAttempts: {
    title: "محاولات ونتائج الامتحانات",
    collection: "examAttempts",
    description: "عرض المحاولات والدرجات المحفوظة. حذف سجل محاولة لا يحذف حساب الطالب.",
    readOnly: true,
    fields: []
  },

  badges: {
    title: "الشارات والإنجازات",
    collection: "badges",
    description: "إدارة شارات الطلاب.",
    fields: [
      { name: "name", label: "اسم الشارة", required: true },
      { name: "description", label: "الوصف", type: "textarea" },
      { name: "icon", label: "رمز الشارة أو الإيموجي" },
      commonActive("الشارة متاحة")
    ]
  },

  leaderboard: {
    title: "لوحة المتصدرين",
    collection: "leaderboard",
    description: "إدارة سجلات ترتيب الطلاب. النتائج الرسمية يجب أن تأتي من محاولات مصححة.",
    fields: [
      { name: "studentUid", label: "UID الطالب", required: true },
      { name: "studentName", label: "اسم الطالب", required: true },
      { name: "classId", label: "كود الفصل", required: true },
      {
        name: "points",
        label: "النقاط",
        type: "number",
        min: 0,
        required: true
      },
      commonActive("ظاهر للطلاب")
    ]
  }
};

function getAccountAuth() {
  if (accountAuth) return accountAuth;

  const appName = "egnsAdminAccountCreator";
  let secondaryApp = getApps().find((app) => app.name === appName);

  if (!secondaryApp) {
    secondaryApp = initializeApp(getApp().options, appName);
  }

  accountAuth = getAuth(secondaryApp);
  return accountAuth;
}

function showNotice(message, type = "info") {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.className = `notice ${type}`;
  noticeTimer = setTimeout(() => notice.classList.add("hidden"), 6500);
}

function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function friendlyError(error) {
  const messages = {
    "permission-denied": "الصلاحيات تمنع العملية. راجع قواعد Firestore.",
    "unavailable": "تعذر الاتصال بقاعدة البيانات. تحقق من الإنترنت.",
    "already-exists": "هذا المعرّف موجود بالفعل.",
    "not-found": "السجل المطلوب غير موجود.",
    "auth/email-already-in-use": "كود الدخول مستخدم بالفعل. اختر كودًا آخر.",
    "auth/weak-password": "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
    "auth/invalid-email": "كود الدخول غير صالح.",
    "auth/operation-not-allowed": "فعّل Email/Password في Firebase Authentication.",
    "auth/too-many-requests": "محاولات كثيرة؛ انتظر قليلًا ثم حاول مجددًا."
  };
  return messages[error?.code] || error?.message || "حدث خطأ غير متوقع.";
}

function normalizeCode(code) {
  const value = String(code || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(value)) {
    throw new Error("كود الدخول يجب أن يتكون من 3 إلى 64 حرفًا أو رقمًا، ويسمح بالنقطة والشرطة.");
  }
  return value;
}

function getAccountEmail(code) {
  return `${normalizeCode(code)}@accounts.egns.com`;
}

function goToSection(section) {
  if (section !== "overview" && !configs[section]) return;

  currentSection = section;
  editingId = null;
  formSection.classList.add("hidden");

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  const isOverview = section === "overview";
  overviewSection.classList.toggle("hidden", !isOverview);
  managementSection.classList.toggle("hidden", isOverview);

  if (isOverview) {
    $("pageTitle").textContent = "الرئيسية والإحصائيات";
    $("pageDescription").textContent = "مركز التحكم في بيانات المدرسة ومحتواها.";
    refreshStats();
    return;
  }

  const config = configs[section];
  $("pageTitle").textContent = config.title;
  $("pageDescription").textContent = config.description;
  $("sectionHeading").textContent = config.title;
  $("sectionSubheading").textContent = config.description;
  $("addRecordBtn").classList.toggle("hidden", Boolean(config.readOnly));
  $("searchInput").value = "";
  loadRecords();
}

function getRecordTitle(record) {
  return record.name || record.title || record.studentName ||
    record.className || record.subjectName || record.loginCode ||
    record.classId || record.id || "سجل بدون عنوان";
}

function getRecordSubtitle(record) {
  const parts = [];

  if (record.role) parts.push(`الدور: ${record.role}`);
  if (record.classId) parts.push(`الفصل: ${record.classId}`);
  if (record.stage) parts.push(`المرحلة: ${record.stage}`);
  if (record.loginCode) parts.push(`كود الدخول: ${record.loginCode}`);
  if (record.points !== undefined) parts.push(`النقاط: ${record.points}`);
  if (record.score !== undefined) parts.push(`الدرجة: ${record.score}`);
  if (record.maxScore !== undefined) parts.push(`من ${record.maxScore}`);
  if (record.subjectName) parts.push(`المادة: ${record.subjectName}`);
  if (record.active !== undefined) parts.push(record.active ? "نشط / منشور" : "غير نشط");
  if (record.status) parts.push(`الحالة: ${record.status}`);

  return parts.join(" • ") || "لا توجد تفاصيل إضافية";
}

function renderRecords() {
  const search = $("searchInput").value.trim().toLowerCase();

  const filtered = cachedRecords.filter((record) => {
    const text = [
      record.id, record.name, record.title, record.studentName,
      record.loginCode, record.classId, record.stage, record.subjectName,
      record.teacherName, record.day, record.description, record.role,
      record.studentUid, record.examId, record.status
    ].join(" ").toLowerCase();

    return text.includes(search);
  });

  $("recordCount").textContent = `عدد السجلات المعروضة: ${filtered.length}`;

  if (!filtered.length) {
    recordsList.innerHTML = '<div class="empty-state">لا توجد سجلات مطابقة.</div>';
    return;
  }

  recordsList.innerHTML = filtered.map((record) => {
    const status = record.active !== undefined
      ? `<span class="pill ${record.active ? "published" : "unpublished"}">${record.active ? "نشط" : "غير نشط"}</span>`
      : "";

    const canEdit = !configs[currentSection].readOnly;

    return `
      <article class="record-card">
        <div class="record-main">
          <h3>${safeText(getRecordTitle(record))}</h3>
          <p>${safeText(getRecordSubtitle(record))}</p>
          ${status}
          <p>المعرّف: <code>${safeText(record.id)}</code></p>
        </div>
        <div class="record-actions">
          ${canEdit ? `<button class="edit-btn" data-edit="${safeText(record.id)}">تعديل</button>` : ""}
          <button class="delete-btn" data-delete="${safeText(record.id)}">حذف السجل</button>
        </div>
      </article>
    `;
  }).join("");

  recordsList.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = cachedRecords.find((item) => item.id === button.dataset.edit);
      if (record) openForm(record);
    });
  });

  recordsList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.delete));
  });
}

async function loadRecords() {
  const config = configs[currentSection];
  if (!config) return;

  recordsList.innerHTML = '<div class="empty-state">جارٍ تحميل البيانات...</div>';

  try {
    const snapshot = await getDocs(
      query(collection(db, config.collection), limit(500))
    );

    cachedRecords = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    if (config.role) {
      cachedRecords = cachedRecords.filter((item) => item.role === config.role);
    }

    if (currentSection === "examAttempts") {
      cachedRecords.sort((a, b) => {
        const aTime = a.submittedAt?.toMillis?.() || 0;
        const bTime = b.submittedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    }

    renderRecords();
  } catch (error) {
    console.error("Load records failed:", error);
    recordsList.innerHTML =
      '<div class="empty-state">تعذر تحميل البيانات. تحقق من قواعد Firestore.</div>';
    showNotice(friendlyError(error), "error");
  }
}

function createField(field, value) {
  const wrapper = document.createElement("div");
  wrapper.className = `field${field.full ? " full" : ""}`;

  if (field.help) {
    wrapper.title = field.help;
  }

  if (field.type === "checkbox") {
    const row = document.createElement("div");
    row.className = "check-field";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `field-${field.name}`;
    input.name = field.name;
    input.checked = value !== undefined ? Boolean(value) : Boolean(field.defaultValue);

    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = field.label;

    row.append(input, label);
    wrapper.append(row);
    return wrapper;
  }

  const label = document.createElement("label");
  label.htmlFor = `field-${field.name}`;
  label.textContent = field.label;

  let input;

  if (field.type === "select") {
    input = document.createElement("select");

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "اختر...";
    input.append(placeholder);

    (field.options || []).forEach(([optionValue, optionLabel]) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionLabel;
      input.append(option);
    });
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = 4;
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
  }

  input.id = `field-${field.name}`;
  input.name = field.name;
  input.required = Boolean(field.required);

  if (field.min !== undefined) input.min = String(field.min);
  if (field.type === "number") input.step = "any";

  if (value !== undefined && value !== null) {
    input.value = String(value);
  } else if (field.defaultValue !== undefined) {
    input.value = String(field.defaultValue);
  }

  wrapper.append(label, input);

  if (field.help) {
    const help = document.createElement("small");
    help.textContent = field.help;
    wrapper.append(help);
  }

  return wrapper;
}

async function openForm(record = null) {
  const config = configs[currentSection];
  if (!config || config.readOnly) return;

  editingId = record?.id || null;
  examAnswersForEdit = {};

  formFields.innerHTML = "";
  $("formTitle").textContent = record ? "تعديل سجل" : "إضافة سجل جديد";
  $("formDescription").textContent = config.description;
  $("saveRecordBtn").disabled = false;

  let formRecord = record ? { ...record } : {};

  if (currentSection === "exams" && record) {
    try {
      const keySnapshot = await getDoc(doc(db, "examKeys", record.id));
      if (keySnapshot.exists()) {
        examAnswersForEdit = keySnapshot.data().answers || {};
      }
    } catch (error) {
      console.warn("Could not load exam answer key:", error);
      showNotice("تعذر تحميل مفتاح الإجابة. لا تحفظ تعديلات الامتحان حتى تراجع قواعد examKeys.", "error");
      return;
    }
  }

  config.fields.forEach((field) => {
    // لا نعرض حقل كلمة المرور عند تعديل حساب موجود.
    if (config.account && field.name === "password" && record) return;

    formFields.append(createField(field, formRecord[field.name]));
  });

  if (config.account && record) {
    const note = document.createElement("p");
    note.className = "form-footnote";
    note.textContent = "تعديل بيانات الملف لا يغيّر كلمة مرور الحساب. لا يمكن حذف حساب Authentication من هذه الواجهة.";
    formFields.append(note);
  }

  managementSection.classList.add("hidden");
  formSection.classList.remove("hidden");
  formSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
  formSection.classList.add("hidden");
  managementSection.classList.remove("hidden");
  editingId = null;
  examAnswersForEdit = {};
  recordForm.reset();
}

function collectFormData() {
  const config = configs[currentSection];
  const result = {};

  for (const field of config.fields) {
    const input = $(`field-${field.name}`);

    if (!input) continue;
    if (config.account && field.name === "password" && editingId) continue;

    if (field.type === "checkbox") {
      result[field.name] = input.checked;
    } else if (field.type === "number") {
      result[field.name] = input.value === "" ? 0 : Number(input.value);
    } else {
      result[field.name] = input.value.trim();
    }

    if (field.required && !String(result[field.name] ?? "").trim()) {
      throw new Error(`الحقل مطلوب: ${field.label}`);
    }
  }

  return result;
}

async function createAccount(config, data) {
  const password = data.password;
  const loginCode = normalizeCode(data.loginCode);
  const email = getAccountEmail(loginCode);

  if (!password || password.length < 6) {
    throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
  }

  const duplicateSnapshot = await getDocs(
    query(collection(db, "users"), limit(500))
  );

  const duplicate = duplicateSnapshot.docs.some((item) => {
    const profile = item.data();
    return String(profile.loginCode || "").toLowerCase() === loginCode;
  });

  if (duplicate) throw new Error("كود الدخول مستخدم في ملف مستخدم موجود بالفعل.");

  const authForAccounts = getAccountAuth();
  const credential = await createUserWithEmailAndPassword(
    authForAccounts,
    email,
    password
  );

  const profile = { ...data };
  delete profile.password;

  profile.name = String(profile.name || "").trim();
  profile.loginCode = loginCode;
  profile.email = email;
  profile.role = config.role;
  profile.active = profile.active !== false;
  profile.createdAt = serverTimestamp();
  profile.updatedAt = serverTimestamp();

  if (profile.points === undefined) profile.points = 0;

  if (typeof profile.assignedClasses === "string") {
    profile.assignedClasses = profile.assignedClasses
      .split(",").map((item) => item.trim()).filter(Boolean);
  }

  if (typeof profile.assignedSubjects === "string") {
    profile.assignedSubjects = profile.assignedSubjects
      .split(",").map((item) => item.trim()).filter(Boolean);
  }

  try {
    await setDoc(doc(db, "users", credential.user.uid), profile);
  } catch (error) {
    // لا نكذب على المستخدم: حساب Authentication قد يكون أُنشئ بالفعل.
    console.error("Account created but profile save failed:", credential.user.uid, error);
    throw new Error(
      `تم إنشاء حساب الدخول، لكن تعذر حفظ ملف المستخدم في Firestore. UID: ${credential.user.uid}. لا تعاود إنشاء الحساب بنفس الكود؛ أصلح ملف users يدويًا أولًا. السبب: ${friendlyError(error)}`
    );
  }

  return credential.user.uid;
}

function cleanData(data) {
  const cleaned = { ...data };
  delete cleaned.password;
  delete cleaned.questionsJson;
  return cleaned;
}

function parseExamQuestions(jsonText) {
  let questions;

  try {
    questions = JSON.parse(jsonText);
  } catch {
    throw new Error("صيغة الأسئلة غير صحيحة. يجب أن تكون JSON صالحة.");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("أضف سؤالًا واحدًا على الأقل.");
  }

  const publicQuestions = [];
  const answers = {};

  questions.forEach((question, index) => {
    const text = String(question.text || "").trim();
    const options = Array.isArray(question.options) ? question.options : [];
    const correctAnswer = Number(question.correctAnswer);

    if (!text) throw new Error(`نص السؤال رقم ${index + 1} فارغ.`);
    if (options.length < 2) throw new Error(`السؤال رقم ${index + 1} يحتاج اختيارين على الأقل.`);
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      throw new Error(`الإجابة الصحيحة في السؤال رقم ${index + 1} غير صالحة.`);
    }

    const marks = Number(question.marks ?? 1);
    if (!Number.isFinite(marks) || marks <= 0) {
      throw new Error(`درجة السؤال رقم ${index + 1} يجب أن تكون أكبر من صفر.`);
    }

    const questionId = String(question.id || `q${index + 1}`);

    publicQuestions.push({
      id: questionId,
      type: "mcq",
      text,
      options: options.map((option) => String(option)),
      marks
    });

    answers[questionId] = correctAnswer;
  });

  return { publicQuestions, answers };
}

async function saveRecord(event) {
  event.preventDefault();

  const config = configs[currentSection];
  if (!config || config.readOnly) return;

  $("saveRecordBtn").disabled = true;

  try {
    const data = collectFormData();
    const now = serverTimestamp();

    if (config.account && !editingId) {
      const uid = await createAccount(config, data);
      showNotice(`تم إنشاء الحساب وملف المستخدم بنجاح. UID: ${uid}`, "success");
      closeForm();
      await loadRecords();
      await refreshStats();
      return;
    }

    if (config.account && editingId) {
      const update = cleanData(data);
      update.loginCode = normalizeCode(update.loginCode);
      update.updatedAt = now;

      if (typeof update.assignedClasses === "string") {
        update.assignedClasses = update.assignedClasses.split(",").map((x) => x.trim()).filter(Boolean);
      }
      if (typeof update.assignedSubjects === "string") {
        update.assignedSubjects = update.assignedSubjects.split(",").map((x) => x.trim()).filter(Boolean);
      }

      const email = getAccountEmail(update.loginCode);
      update.email = email;

      await updateDoc(doc(db, "users", editingId), update);
      showNotice("تم تحديث ملف المستخدم. لم تتغير كلمة مرور Authentication.", "success");
      closeForm();
      await loadRecords();
      await refreshStats();
      return;
    }

    let saveData = { ...data, updatedAt: now };

    if (currentSection === "exams") {
      if (!editingId) {
        saveData.createdAt = now;
      }

      saveData.active = Boolean(data.active);
      saveData.questions = Array.isArray(data.questions) ? data.questions : [];
      // أسئلة الامتحان ومفتاح الإجابة يُحفظان منفصلين.
      // هذه الواجهة الإدارية تعدّل بيانات الامتحان؛ محرر الأسئلة الكامل يُنفّذ بحساب المدرس.
    }

    if (currentSection === "classes") {
      const classId = String(data.classId || "").trim();
      if (!classId) throw new Error("كود الفصل مطلوب.");

      const ref = doc(db, "classes", classId);
      const payload = { ...saveData, classId };

      if (editingId && editingId !== classId) {
        throw new Error("لا تغيّر كود الفصل أثناء التعديل؛ أنشئ فصلًا جديدًا إذا لزم الأمر.");
      }

      if (editingId) {
        await updateDoc(ref, payload);
      } else {
        const existing = await getDoc(ref);
        if (existing.exists()) throw new Error("كود الفصل موجود بالفعل.");
        payload.createdAt = now;
        await setDoc(ref, payload);
      }
    } else if (currentSection === "exams") {
      if (editingId) {
        await updateDoc(doc(db, "exams", editingId), saveData);
      } else {
        saveData.createdAt = now;
        const created = await addDoc(collection(db, "exams"), saveData);
        editingId = created.id;
      }
    } else {
      if (editingId) {
        await updateDoc(doc(db, config.collection, editingId), saveData);
      } else {
        saveData.createdAt = now;
        await addDoc(collection(db, config.collection), saveData);
      }
    }

    showNotice("تم حفظ البيانات بنجاح.", "success");
    closeForm();
    await loadRecords();
    await refreshStats();
  } catch (error) {
    console.error("Save failed:", error);
    showNotice(friendlyError(error), "error");
  } finally {
    $("saveRecordBtn").disabled = false;
  }
}

async function deleteRecord(id) {
  const config = configs[currentSection];
  if (!config) return;

  const record = cachedRecords.find((item) => item.id === id);
  const title = record ? getRecordTitle(record) : id;

  if (!confirm(`هل أنت متأكد من حذف السجل "${title}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, config.collection, id));

    if (currentSection === "exams") {
      // حذف مفتاح الإجابة من Firestore إن وجد.
      await deleteDoc(doc(db, "examKeys", id)).catch((error) => {
        console.warn("Exam key cleanup failed:", error);
      });
    }

    if (config.account) {
      showNotice(
        "تم حذف ملف المستخدم من Firestore فقط. حساب Firebase Authentication لم يُحذف.",
        "info"
      );
    } else {
      showNotice("تم حذف السجل من Firestore.", "success");
    }

    await loadRecords();
    await refreshStats();
  } catch (error) {
    console.error("Delete failed:", error);
    showNotice(friendlyError(error), "error");
  }
}

async function countCollection(name, filterFn = null) {
  const snapshot = await getDocs(query(collection(db, name), limit(500)));
  const items = snapshot.docs.map((item) => item.data());
  return filterFn ? items.filter(filterFn).length : items.length;
}

async function refreshStats() {
  const ids = [
    "statClasses", "statStudents", "statTeachers", "statEmployees",
    "statSubjects", "statExams", "statAttempts", "statAnnouncements"
  ];
  ids.forEach((id) => { if ($(id)) $(id).textContent = "…"; });

  try {
    const [
      classes, students, teachers, employees,
      subjects, exams, attempts, announcements
    ] = await Promise.all([
      countCollection("classes"),
      countCollection("users", (u) => u.role === "student"),
      countCollection("users", (u) => u.role === "teacher"),
      countCollection("users", (u) => ["employee", "worker", "student_affairs", "exams_affairs"].includes(u.role)),
      countCollection("subjects"),
      countCollection("exams"),
      countCollection("examAttempts"),
      countCollection("announcements")
    ]);

    $("statClasses").textContent = classes;
    $("statStudents").textContent = students;
    $("statTeachers").textContent = teachers;
    $("statEmployees").textContent = employees;
    $("statSubjects").textContent = subjects;
    $("statExams").textContent = exams;
    $("statAttempts").textContent = attempts;
    $("statAnnouncements").textContent = announcements;
  } catch (error) {
    console.error("Stats failed:", error);
    showNotice("تعذر تحميل بعض الإحصائيات. تحقق من قواعد Firestore.", "error");
    ids.forEach((id) => { if ($(id)) $(id).textContent = "—"; });
  }
}

$("adminNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (button) goToSection(button.dataset.section);
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => goToSection(button.dataset.go));
});

$("addRecordBtn").addEventListener("click", () => openForm());
$("cancelFormBtn").addEventListener("click", closeForm);
$("cancelFormBtn2").addEventListener("click", closeForm);
$("refreshBtn").addEventListener("click", loadRecords);
$("searchInput").addEventListener("input", renderRecords);
recordForm.addEventListener("submit", saveRecord);

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    location.href = "login.html";
  } catch (error) {
    showNotice(friendlyError(error), "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  if (!isAdminEmail(user.email)) {
    await signOut(auth);
    location.replace("login.html");
    return;
  }

  $("adminEmail").textContent = user.email;
  authLoading.classList.add("hidden");
  adminApp.classList.remove("hidden");

  await refreshStats();
});
