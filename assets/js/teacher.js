import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, addDoc, setDoc, getDocs,
  collection, query, where, serverTimestamp
} from "./firebase.js";

const $ = id => document.getElementById(id);
let teacher = null;

function message(text, error = false) {
  const el = $("teacherMessage");
  el.className = error ? "notice error" : "notice success";
  el.textContent = text;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function validateQuestions(raw) {
  let questions;

  try {
    questions = JSON.parse(raw);
  } catch {
    throw new Error("صيغة الأسئلة JSON غير صحيحة.");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("أضف سؤالًا واحدًا على الأقل.");
  }

  questions.forEach((q, index) => {
    if (!q.text || !Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`السؤال ${index + 1}: اكتب نص السؤال واختيارين على الأقل.`);
    }

    if (
      !Number.isInteger(q.correctAnswer) ||
      q.correctAnswer < 0 ||
      q.correctAnswer >= q.options.length
    ) {
      throw new Error(`السؤال ${index + 1}: رقم الإجابة الصحيحة غير صالح.`);
    }

    q.marks = Number(q.marks || 1);

    if (!Number.isFinite(q.marks) || q.marks <= 0) {
      throw new Error(`درجة السؤال ${index + 1} غير صالحة.`);
    }
  });

  return questions;
}

async function createExam(event) {
  event.preventDefault();

  const form = $("examForm");
  const submit = form.querySelector('[type="submit"]');
  const values = Object.fromEntries(new FormData(form).entries());

  submit.disabled = true;

  try {
    const questions = validateQuestions(values.questions);
    const totalMarks = Number(values.totalMarks);
    const durationMinutes = Number(values.durationMinutes);

    if (totalMarks <= 0 || durationMinutes <= 0) {
      throw new Error("المدة والدرجة النهائية يجب أن تكونا أكبر من صفر.");
    }

    const publicQuestions = questions.map((q, index) => ({
      id: `q${index + 1}`,
      text: q.text,
      options: q.options,
      marks: Number(q.marks)
    }));

    const examData = {
      title: values.title.trim(),
      subjectName: values.subjectName.trim(),
      stage: values.stage,
      classId: values.classId.trim(),
      durationMinutes,
      totalMarks,
      questions: publicQuestions,
      teacherUid: auth.currentUser.uid,
      teacherName: teacher.name || teacher.fullName || "",
      active: form.elements.active.checked,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const examRef = await addDoc(collection(db, "exams"), examData);

    const answerKey = {
      examId: examRef.id,
      teacherUid: auth.currentUser.uid,
      answers: questions.map((q, index) => ({
        questionId: `q${index + 1}`,
        correctAnswer: Number(q.correctAnswer),
        marks: Number(q.marks)
      })),
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "examKeys", examRef.id), answerKey);

    message(`تم حفظ الامتحان بنجاح. معرّف الامتحان: ${examRef.id}`);
    form.reset();
    await loadExams();

  } catch (error) {
    console.error(error);
    message(error.message || "تعذر حفظ الامتحان.", true);
  } finally {
    submit.disabled = false;
  }
}

async function loadExams() {
  const snap = await getDocs(query(
    collection(db, "exams"),
    where("teacherUid", "==", auth.currentUser.uid)
  ));

  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  $("teacherExams").innerHTML = rows.map(x => `
    <article class="data-card">
      <h3>${esc(x.title)}</h3>
      <p>المادة: ${esc(x.subjectName)}</p>
      <p>الفصل: ${esc(x.classId)}</p>
      <p>الحالة: ${x.active ? "منشور" : "غير منشور"}</p>
      <p>المدة: ${Number(x.durationMinutes || 0)} دقيقة</p>
      <p>المعرّف: ${esc(x.id)}</p>
    </article>
  `).join("") || '<div class="empty-state">لم تنشئ امتحانات بعد.</div>';
}

async function loadResults() {
  const snap = await getDocs(query(
    collection(db, "examAttempts"),
    where("teacherUid", "==", auth.currentUser.uid)
  ));

  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  $("teacherResults").innerHTML = rows.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>الطالب</th><th>الامتحان</th><th>الدرجة</th><th>التاريخ</th></tr></thead>
        <tbody>${rows.map(x => `
          <tr>
            <td>${esc(x.studentName || x.studentUid)}</td>
            <td>${esc(x.examTitle || x.examId)}</td>
            <td>${Number(x.score || 0)} / ${Number(x.maxScore || 0)}</td>
            <td>${esc(x.submittedAt?.toDate?.().toLocaleString("ar-EG") || "—")}</td>
          </tr>
        `).join("")}</tbody>
      </table></div>`
    : '<div class="empty-state">لا توجد محاولات مسجلة لهذا المعلم.</div>';
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("لا يوجد ملف مستخدم.");

    teacher = snap.data();

    if (teacher.active !== true || teacher.role !== "teacher") {
      throw new Error("هذا الحساب ليس حساب معلم نشطًا.");
    }

    $("teacherGreeting").textContent =
      `أهلًا بك، ${teacher.name || teacher.fullName || "معلمنا الكريم"}`;

    await loadExams();

  } catch (error) {
    console.error(error);
    message(error.message || "تعذر تحميل حساب المعلم.", true);
  }
});

$("examForm").addEventListener("submit", createExam);

$("loadTeacherExams").addEventListener("click", () =>
  loadExams().catch(e => message(e.message, true))
);

$("loadTeacherResults").addEventListener("click", () =>
  loadResults().catch(e => {
    console.error(e);
    $("teacherResults").textContent = "تعذر تحميل النتائج.";
  })
);

$("teacherLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("login.html");
});
