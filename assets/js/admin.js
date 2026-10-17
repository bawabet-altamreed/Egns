
import {
  auth,
  db,
  signOut,
  onAuthStateChanged,
  isAdminEmail
} from "./firebase.js";

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
const managementSection = $("managementSection");
const overviewSection = $("overviewSection");
const formSection = $("formSection");
const recordsList = $("recordsList");
const formFields = $("formFields");
const recordForm = $("recordForm");

let currentSection = "overview";
let editingId = null;
let cachedRecords = [];
let noticeTimer = null;

const configs = {
  classes: {
    title: "الفصول الدراسية",
    collection: "classes",
    description: "إنشاء الفصول التي ستُربط بها بيانات الطلاب والمحتوى.",
    idField: "classId",
    fields: [
      { name: "classId", label: "كود الفصل (classId)", required: true, help: "مثال: NURSE-2A. استخدم قيمة ثابتة وفريدة لكل فصل." },
      { name: "name", label: "اسم الفصل", required: true },
      { name: "stage", label: "المرحلة الدراسية", type: "select", required: true, options: [
        ["الأول الثانوي التمريض", "الأول الثانوي التمريض"],
        ["الثاني الثانوي التمريض", "الثاني الثانوي التمريض"],
        ["الثالث الثانوي التمريض", "الثالث الثانوي التمريض"],
        ["الأول معهد", "الأول معهد"],
        ["الثاني معهد", "الثاني معهد"]
      ] },
      { name: "section", label: "الشعبة" },
      { name: "academicYear", label: "العام الدراسي" },
      { name: "active", label: "الفصل نشط", type: "checkbox", defaultValue: true }
    ]
  },

  students: {
    title: "الطلاب وملفاتهم",
    collection: "users",
    description: "ربط حساب Authentication موجود بملف طالب في users/{UID}.",
    idField: "uid",
    fields: [
      { name: "uid", label: "UID من Firebase Authentication", required: true, help: "أنشئ حساب الدخول في Authentication أولًا، ثم انسخ UID هنا. لا تدخل كلمة المرور." },
      { name: "name", label: "اسم الطالب", required: true },
      { name: "loginCode", label: "كود الدخول", required: true },
      { name: "stage", label: "المرحلة الدراسية", type: "select", required: true, options: [
        ["الأول الثانوي التمريض", "الأول الثانوي التمريض"],
        ["الثاني الثانوي التمريض", "الثاني الثانوي التمريض"],
        ["الثالث الثانوي التمريض", "الثالث الثانوي التمريض"],
        ["الأول معهد", "الأول معهد"],
        ["الثاني معهد", "الثاني معهد"]
      ] },
      { name: "classId", label: "كود الفصل (classId)", required: true, help: "اكتب classId نفسه الموجود في قسم الفصول." },
      { name: "className", label: "اسم الفصل", required: true },
      { name: "points", label: "النقاط", type: "number", defaultValue: 0, min: 0 },
      { name: "active", label: "الحساب نشط", type: "checkbox", defaultValue: true }
    ]
  },

  announcements: {
    title: "الإعلانات",
    collection: "announcements",
    description: "نشر إعلانات عامة أو مخصصة لفصل معيّن.",
    fields: [
      { name: "title", label: "عنوان الإعلان", required: true },
      { name: "body", label: "نص الإعلان", type: "textarea", required: true },
      { name: "category", label: "التصنيف" },
      { name: "classId", label: "كود الفصل (اتركه فارغًا للإعلان العام)" },
      { name: "published", label: "منشور للطلاب", type: "checkbox", defaultValue: true }
    ]
  },

  subjects: {
    title: "المواد الدراسية",
    collection: "subjects",
    description: "إضافة مواد وربطها بالفصل الدراسي.",
    fields: [
      { name: "name", label: "اسم المادة", required: true },
      { name: "description", label: "وصف المادة", type: "textarea" },
      { name: "classId", label: "كود الفصل (classId)", required: true },
      { name: "published", label: "متاحة للطلاب", type: "checkbox", defaultValue: true }
    ]
  },

  lectures: {
    title: "المحاضرات",
    collection: "lectures",
    description: "إضافة محاضرات وروابطها وربطها بالمواد والفصول.",
    fields: [
      { name: "title", label: "عنوان المحاضرة", required: true },
      { name: "description", label: "وصف المحاضرة", type: "textarea" },
      { name: "url", label: "رابط المحاضرة", type: "url", required: true },
      { name: "subjectId", label: "معرّف المادة (document ID)", required: true },
      { name: "subjectName", label: "اسم المادة", required: true },
      { name: "classId", label: "كود الفصل (classId)", required: true },
      { name: "published", label: "متاحة للطلاب", type: "checkbox", defaultValue: true }
    ]
  },

  timetables: {
    title: "الجداول الدراسية",
    collection: "timetables",
    description: "إضافة حصص الجدول الدراسي لكل فصل.",
    fields: [
      { name: "day", label: "اليوم", type: "select", required: true, options: [
        ["الأحد", "الأحد"], ["الاثنين", "الاثنين"], ["الثلاثاء", "الثلاثاء"],
        ["الأربعاء", "الأربعاء"], ["الخميس", "الخميس"], ["الجمعة", "الجمعة"], ["السبت", "السبت"]
      ] },
      { name: "period", label: "الحصة / التوقيت", required: true },
      { name: "subjectName", label: "اسم المادة", required: true },
      { name: "teacherName", label: "اسم المدرس" },
      { name: "room", label: "القاعة" },
      { name: "classId", label: "كود الفصل (classId)", required: true },
      { name: "published", label: "ظاهر للطلاب", type: "checkbox", defaultValue: true }
    ]
  },

  exams: {
    title: "الامتحانات",
    collection: "exams",
    description: "أسئلة اختيار من متعدد أو صح وخطأ. تُحفظ مفاتيح الإجابة في examKeys منفصلة.",
    fields: [
      { name: "title", label: "اسم الامتحان", required: true },
      { name: "description", label: "وصف الامتحان", type: "textarea" },
      { name: "subjectName", label: "اسم المادة", required: true },
      { name: "classId", label: "كود الفصل (classId)", required: true },
      { name: "durationMinutes", label: "المدة بالدقائق", type: "number", required: true, min: 1 },
      { name: "totalMarks", label: "الدرجة النهائية", type: "number", required: true, min: 1 },
      { name: "questionsJson", label: "الأسئلة بصيغة JSON", type: "textarea", required: true, full: true,
        help: 'مثال: [{"type":"mcq","text":"السؤال؟","options":["أ","ب","ج","د"],"correctAnswer":0}] أو {"type":"true_false","text":"العبارة","correctAnswer":true}. في mcq تكون الإجابة الصحيحة رقم الخيار بدءًا من 0.' },
      { name: "published", label: "متاح للطلاب", type: "checkbox", defaultValue: false }
    ]
  },

  badges: {
    title: "الشارات",
    collection: "badges",
    description: "إنشاء الشارات التي يمكن عرضها للطلاب.",
    fields: [
      { name: "name", label: "اسم الشارة", required: true },
      { name: "description", label: "وصف الشارة", type: "textarea" },
      { name: "published", label: "متاحة للعرض", type: "checkbox", defaultValue: true }
    ]
  },

  leaderboard: {
    title: "لوحة المتصدرين",
    collection: "leaderboard",
    description: "إدارة السجلات المعروضة في لوحة المتصدرين.",
    fields: [
      { name: "studentUid", label: "UID الطالب", required: true },
      { name: "studentName", label: "اسم الطالب", required: true },
      { name: "points", label: "النقاط", type: "number", required: true, min: 0 },
      { name: "classId", label: "كود الفصل (classId)", required: true },
      { name: "published", label: "ظاهر للطلاب", type: "checkbox", defaultValue: true }
    ]
  }
};

function showNotice(message, type = "info") {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.className = `notice ${type}`;
  noticeTimer = setTimeout(() => notice.classList.add("hidden"), 6000);
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
  const code = error?.code || "";
  const messages = {
    "permission-denied": "ليس لديك إذن لهذه العملية. راجع قواعد Firestore.",
    "unavailable": "تعذر الاتصال بقاعدة البيانات. تحقق من الإنترنت.",
    "already-exists": "هذا المعرّف موجود بالفعل.",
    "not-found": "السجل المطلوب غير موجود.",
    "auth/network-request-failed": "تعذر الاتصال بخدمة تسجيل الدخول.",
    "invalid-argument": "بعض البيانات غير صحيحة."
  };
  return messages[code] || error?.message || "حدث خطأ غير متوقع.";
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
    $("pageTitle").textContent = "الرئيسية";
    $("pageDescription").textContent = "إدارة بيانات المدرسة ومحتواها من مكان واحد.";
    refreshStats();
    return;
  }

  const config = configs[section];
  $("pageTitle").textContent = config.title;
  $("pageDescription").textContent = config.description;
  $("sectionHeading").textContent = config.title;
  $("sectionSubheading").textContent = config.description;
  $("searchInput").value = "";
  loadRecords();
}

function getRecordTitle(record) {
  return record.name || record.title || record.studentName ||
    record.className || record.subjectName || record.loginCode ||
    record.classId || record.uid || record.id || "سجل بدون عنوان";
}

function getRecordSubtitle(record) {
  const parts = [];
  if (record.classId) parts.push(`الفصل: ${record.classId}`);
  if (record.stage) parts.push(`المرحلة: ${record.stage}`);
  if (record.loginCode) parts.push(`كود الدخول: ${record.loginCode}`);
  if (record.points !== undefined) parts.push(`النقاط: ${record.points}`);
  if (record.day) parts.push(`اليوم: ${record.day}`);
  if (record.subjectName) parts.push(`المادة: ${record.subjectName}`);
  if (record.published !== undefined) parts.push(record.published ? "منشور" : "غير منشور");
  if (record.active !== undefined) parts.push(record.active ? "نشط" : "غير نشط");
  return parts.join(" • ") || "لا توجد تفاصيل إضافية";
}

function renderRecords() {
  const search = $("searchInput").value.trim().toLowerCase();

  const filtered = cachedRecords.filter((record) => {
    const text = [
      record.id, record.name, record.title, record.studentName,
      record.loginCode, record.classId, record.stage, record.subjectName,
      record.teacherName, record.day, record.description
    ].join(" ").toLowerCase();
    return text.includes(search);
  });

  $("recordCount").textContent = `عدد السجلات المعروضة: ${filtered.length}`;

  if (!filtered.length) {
    recordsList.innerHTML = '<div class="empty-state">لا توجد سجلات مطابقة. يمكنك إضافة سجل جديد.</div>';
    return;
  }

  recordsList.innerHTML = filtered.map((record) => {
    const status = record.published !== undefined
      ? `<span class="pill ${record.published ? "published" : "unpublished"}">${record.published ? "منشور" : "غير منشور"}</span>`
      : record.active !== undefined
        ? `<span class="pill ${record.active ? "published" : "unpublished"}">${record.active ? "نشط" : "غير نشط"}</span>`
        : "";

    return `
      <article class="record-card">
        <div class="record-main">
          <h3>${safeText(getRecordTitle(record))}</h3>
          <p>${safeText(getRecordSubtitle(record))}</p>
          ${status}
          <p>المعرّف: <code>${safeText(record.id)}</code></p>
        </div>
        <div class="record-actions">
          <button class="edit-btn" data-edit="${safeText(record.id)}">تعديل</button>
          <button class="delete-btn" data-delete="${safeText(record.id)}">حذف</button>
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
    const result = await getDocs(query(collection(db, config.collection), limit(500)));
    cachedRecords = result.docs.map((item) => ({ id: item.id, ...item.data() }));

    if (currentSection === "students") {
      cachedRecords = cachedRecords.filter((item) => item.role === "student");
    }

    renderRecords();
  } catch (error) {
    console.error("Load records failed:", error);
    recordsList.innerHTML = '<div class="empty-state">تعذر تحميل البيانات. راجع صلاحيات Firestore والاتصال.</div>';
    showNotice(friendlyError(error), "error");
  }
}

function createField(field, value) {
  const wrapper = document.createElement("div");
  wrapper.className = `field${field.full ? " full" : ""}`;

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

    field.options.forEach(([labelText, optionValue]) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = labelText;
      input.append(option);
    });
    input.value = value ?? "";
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.value = value ?? "";
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
    input.value = value ?? field.defaultValue ?? "";
  }

  input.id = `field-${field.name}`;
  input.name = field.name;

  if (field.required) input.required = true;
  if (field.min !== undefined) input.min = String(field.min);

  if (field.name === "uid" && editingId) {
    input.readOnly = true;
    input.title = "لا يمكن تغيير UID بعد إنشاء ملف الطالب.";
  }

  if (field.name === "classId" && currentSection === "classes" && editingId) {
    input.readOnly = true;
    input.title = "تغيير معرّف الفصل يتطلب إعادة ربط السجلات المرتبطة به.";
  }

  wrapper.append(label, input);

  if (field.help) {
    const help = document.createElement("small");
    help.className = "field-help";
    help.textContent = field.help;
    wrapper.append(help);
  }

  return wrapper;
}

function openForm(record = null) {
  const config = configs[currentSection];
  if (!config) return;

  editingId = record?.id ?? null;
  formFields.replaceChildren();

  $("formTitle").textContent = editingId ? `تعديل: ${config.title}` : `إضافة سجل — ${config.title}`;
  $("formDescription").textContent = config.description;

  let recordData = record ? { ...record } : {};

  if (currentSection === "exams" && record) {
    recordData.questionsJson = JSON.stringify(record.questions || [], null, 2);
    loadExamAnswersForEdit(record.id);
  }

  config.fields.forEach((field) => {
    formFields.append(createField(field, recordData[field.name]));
  });

  formSection.classList.remove("hidden");
  formSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

let examAnswersForEdit = {};

async function loadExamAnswersForEdit(examId) {
  examAnswersForEdit = {};
  try {
    const keySnapshot = await getDoc(doc(db, "examKeys", examId));
    if (keySnapshot.exists()) {
      examAnswersForEdit = keySnapshot.data().answers || {};
      const input = $("field-questionsJson");
      if (input) {
        try {
          const questions = JSON.parse(input.value || "[]");
          questions.forEach((question, index) => {
            if (Object.prototype.hasOwnProperty.call(examAnswersForEdit, String(index))) {
              question.correctAnswer = examAnswersForEdit[String(index)];
            }
          });
          input.value = JSON.stringify(questions, null, 2);
        } catch {}
      }
    }
  } catch (error) {
    console.error("Could not load answer key:", error);
    showNotice("تعذر تحميل مفتاح الإجابة. تحقق من قواعد examKeys.", "error");
  }
}

function readFormData() {
  const config = configs[currentSection];
  const data = {};

  for (const field of config.fields) {
    const input = $(`field-${field.name}`);
    if (!input) continue;

    let value;

    if (field.type === "checkbox") {
      value = input.checked;
    } else if (field.type === "number") {
      value = input.value === "" ? null : Number(input.value);
    } else {
      value = input.value.trim();
    }

    if (typeof value === "string" && value === "" && !field.required) {
      value = null;
    }

    if (field.required && (value === "" || value === null)) {
      throw new Error(`يرجى إدخال: ${field.label}`);
    }

    data[field.name] = value;
  }

  return data;
}

function cleanNullValues(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null && value !== undefined)
  );
}

function validateExamQuestions(raw) {
  let questions;
  try {
    questions = JSON.parse(raw);
  } catch {
    throw new Error("صيغة JSON للأسئلة غير صحيحة.");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("أدخل مصفوفة أسئلة JSON واحدة على الأقل.");
  }

  const answers = {};
  const publicQuestions = questions.map((question, index) => {
    if (!question || typeof question.text !== "string" || !question.text.trim()) {
      throw new Error(`نص السؤال رقم ${index + 1} غير صحيح.`);
    }

    if (question.type === "mcq") {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        throw new Error(`السؤال رقم ${index + 1}: أضف خيارين على الأقل.`);
      }
      if (!Number.isInteger(question.correctAnswer) ||
          question.correctAnswer < 0 ||
          question.correctAnswer >= question.options.length) {
        throw new Error(`السؤال رقم ${index + 1}: correctAnswer يجب أن يكون رقم خيار صحيحًا بدءًا من 0.`);
      }
      answers[String(index)] = question.correctAnswer;
      return {
        type: "mcq",
        text: question.text.trim(),
        options: question.options.map((option) => String(option))
      };
    }

    if (question.type === "true_false") {
      if (typeof question.correctAnswer !== "boolean") {
        throw new Error(`السؤال رقم ${index + 1}: correctAnswer يجب أن يكون true أو false.`);
      }
      answers[String(index)] = question.correctAnswer;
      return { type: "true_false", text: question.text.trim() };
    }

    throw new Error(`نوع السؤال رقم ${index + 1} يجب أن يكون mcq أو true_false.`);
  });

  return { publicQuestions, answers };
}

async function saveRecord(event) {
  event.preventDefault();

  const saveButton = $("saveRecordBtn");
  saveButton.disabled = true;
  saveButton.textContent = "جارٍ الحفظ...";

  try {
    const config = configs[currentSection];
    let data = cleanNullValues(readFormData());

    if (currentSection === "students") {
      const uid = data.uid;

      if (!uid || uid.includes("/")) {
        throw new Error("أدخل UID صحيحًا من Firebase Authentication.");
      }

      const profileRef = doc(db, "users", uid);
      const existingProfile = await getDoc(profileRef);

      if (!editingId && existingProfile.exists()) {
        throw new Error("يوجد ملف بالفعل لهذا UID. افتح الملف الموجود للتعديل.");
      }

      data = {
        ...data,
        role: "student",
        points: Number(data.points ?? 0),
        active: Boolean(data.active)
      };

      delete data.uid;

      await setDoc(profileRef, {
        ...data,
        updatedAt: serverTimestamp(),
        ...(existingProfile.exists() ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });

    } else if (currentSection === "classes") {
      const classId = data.classId;
      if (!classId || classId.includes("/")) {
        throw new Error("كود الفصل مطلوب ولا يجوز أن يحتوي على /.");
      }

      const classRef = doc(db, "classes", classId);

      if (editingId && editingId !== classId) {
        throw new Error("معرّف الفصل لا يمكن تغييره بعد إنشائه.");
      }

      const existing = await getDoc(classRef);
      if (!editingId && existing.exists()) {
        throw new Error("كود الفصل موجود بالفعل. اختر كودًا مختلفًا.");
      }

      await setDoc(classRef, {
        ...data,
        createdAt: existing.exists() ? (data.createdAt || null) : serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

    } else if (currentSection === "exams") {
      const examQuestions = validateExamQuestions(data.questionsJson);
      delete data.questionsJson;
      data.questions = examQuestions.publicQuestions;
      data.totalMarks = Number(data.totalMarks);
      data.durationMinutes = Number(data.durationMinutes);

      let examId = editingId;

      if (examId) {
        await updateDoc(doc(db, "exams", examId), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } else {
        const examRef = await addDoc(collection(db, "exams"), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        examId = examRef.id;
      }

      await setDoc(doc(db, "examKeys", examId), {
        answers: examQuestions.answers,
        updatedAt: serverTimestamp()
      });

    } else {
      const payload = {
        ...data,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, config.collection, editingId), payload);
      } else {
        await addDoc(collection(db, config.collection), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
    }

    showNotice("تم حفظ البيانات في Firestore بنجاح.", "success");
    formSection.classList.add("hidden");
    editingId = null;
    await loadRecords();
    await refreshStats();

  } catch (error) {
    console.error("Save failed:", error);
    showNotice(friendlyError(error), "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "حفظ في قاعدة البيانات";
  }
}

async function deleteRecord(id) {
  const config = configs[currentSection];
  if (!config) return;

  const record = cachedRecords.find((item) => item.id === id);
  const label = record ? getRecordTitle(record) : id;

  if (!confirm(`هل تريد حذف "${label}"؟ لا يمكن التراجع عن الحذف.`)) return;

  try {
    if (currentSection === "students") {
      await deleteDoc(doc(db, "users", id));
      // لا يحذف هذا الإجراء حساب Authentication.
    } else if (currentSection === "exams") {
      await deleteDoc(doc(db, "exams", id));
      await deleteDoc(doc(db, "examKeys", id));
    } else {
      await deleteDoc(doc(db, config.collection, id));
    }

    showNotice("تم حذف السجل من Firestore.", "success");
    await loadRecords();
    await refreshStats();
  } catch (error) {
    console.error("Delete failed:", error);
    showNotice(friendlyError(error), "error");
  }
}

async function refreshStats() {
  const stats = [
    ["statClasses", "classes"],
    ["statStudents", "users"],
    ["statSubjects", "subjects"],
    ["statLectures", "lectures"],
    ["statExams", "exams"],
    ["statAnnouncements", "announcements"]
  ];

  for (const [elementId, collectionName] of stats) {
    try {
      const result = await getDocs(query(collection(db, collectionName), limit(500)));
      let count = result.size;

      if (collectionName === "users") {
        count = result.docs.filter((item) => item.data().role === "student").length;
      }

      $(elementId).textContent = result.size === 500 ? `${count}+` : String(count);
    } catch (error) {
      console.warn(`Could not load ${collectionName} count:`, error);
      $(elementId).textContent = "—";
    }
  }
}

async function logout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    showNotice(friendlyError(error), "error");
  }
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => goToSection(button.dataset.section));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => goToSection(button.dataset.go));
});

$("addRecordBtn").addEventListener("click", () => openForm());
$("refreshBtn").addEventListener("click", () => {
  loadRecords();
  refreshStats();
});
$("searchInput").addEventListener("input", renderRecords);
$("cancelFormBtn").addEventListener("click", () => formSection.classList.add("hidden"));
$("cancelFormBtn2").addEventListener("click", () => formSection.classList.add("hidden"));
recordForm.addEventListener("submit", saveRecord);
$("logoutBtn").addEventListener("click", logout);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  if (!isAdminEmail(user.email)) {
    try { await signOut(auth); } catch {}
    window.location.replace("login.html");
    return;
  }

  $("adminEmail").textContent = user.email || "مدير النظام";
  authLoading.classList.add("hidden");
  adminApp.classList.remove("hidden");

  await refreshStats();
  goToSection("overview");
});
