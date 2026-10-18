import {
  auth, db, onAuthStateChanged, signOut, isAdminEmail,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, serverTimestamp
} from "./firebase.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const $ = id => document.getElementById(id);

const firebaseConfig = {
  apiKey: "AIzaSyC5ODDwC3w9ZsHcAAGGdipl3oUNvlUG9Tw",
  authDomain: "egns-99c3b.firebaseapp.com",
  projectId: "egns-99c3b",
  storageBucket: "egns-99c3b.firebasestorage.app",
  messagingSenderId: "920048533301",
  appId: "1:920048533301:web:9ffceba997d6db9426567c",
  measurementId: "G-9DRZGZJHEV"
};

const secondaryApp = initializeApp(firebaseConfig, "egnsAccountCreator");
const secondaryAuth = getAuth(secondaryApp);

const allowedCollections = new Set([
  "users", "classes", "subjects", "announcements", "timetables",
  "exams", "examKeys", "examAttempts", "badges", "leaderboard"
]);

let selectedId = null;

function show(id, message, error = false) {
  const el = $(id);
  if (!el) return;
  el.className = error ? "notice error" : "notice success";
  el.textContent = message;
}

function safeJson(data) {
  return JSON.stringify(data, (key, value) => {
    if (value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    return value;
  }, 2);
}

function parseJson() {
  try {
    return JSON.parse($("recordJson").value);
  } catch {
    throw new Error("صيغة JSON غير صحيحة. راجع الأقواس والفواصل.");
  }
}

function currentCollection() {
  const name = $("collectionSelect").value;
  if (!allowedCollections.has(name)) {
    throw new Error("مجموعة البيانات غير مسموح بها.");
  }
  return name;
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[ch]);
}

async function loadRecords() {
  const name = currentCollection();
  $("recordsList").innerHTML = '<div class="loading">جارٍ التحميل...</div>';

  try {
    const snap = await getDocs(collection(db, name));
    const records = snap.docs.slice(0, 100);

    $("recordsList").innerHTML = records.map(d => `
      <article class="data-card">
        <h3>${safeText(d.id)}</h3>
        <p>${safeText(d.data().name || d.data().title || d.data().loginCode || "مستند")}</p>
        <button class="btn btn-light" data-record-id="${safeText(d.id)}"
          type="button">فتح وتعديل</button>
      </article>
    `).join("") || '<div class="empty-state">لا توجد سجلات في هذه المجموعة.</div>';

    $("recordsList").querySelectorAll("[data-record-id]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.recordId;
        const snap = await getDoc(doc(db, name, id));
        if (!snap.exists()) return;

        selectedId = id;
        $("documentId").value = id;
        $("recordJson").value = safeJson(snap.data());
        show("recordMessage", `تم فتح المستند ${id}`);
      });
    });

    show("recordMessage", `تم تحميل ${records.length} مستندًا من ${name}.`);
  } catch (error) {
    console.error(error);
    show("recordMessage", "تعذر تحميل البيانات. راجع قواعد Firestore.", true);
    $("recordsList").innerHTML = "";
  }
}

async function saveRecord() {
  const name = currentCollection();
  const data = parseJson();
  const enteredId = $("documentId").value.trim();

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("اكتب كائن JSON صالحًا.");
  }

  data.updatedAt = serverTimestamp();

  if (enteredId) {
    await setDoc(doc(db, name, enteredId), data, { merge: true });
    selectedId = enteredId;
    $("documentId").value = enteredId;
    show("recordMessage", `تم حفظ المستند ${enteredId}.`);
  } else {
    data.createdAt = serverTimestamp();
    const ref = await addDoc(collection(db, name), data);
    selectedId = ref.id;
    $("documentId").value = ref.id;
    show("recordMessage", `تم إنشاء المستند ${ref.id}.`);
  }

  await loadRecords();
}

async function deleteRecord() {
  const name = currentCollection();
  const id = $("documentId").value.trim();

  if (!id) throw new Error("اكتب معرّف المستند المراد حذفه.");
  if (!confirm(`هل تريد حذف المستند ${id} من ${name}؟`)) return;

  await deleteDoc(doc(db, name, id));
  $("documentId").value = "";
  $("recordJson").value = "";
  selectedId = null;

  show("recordMessage", `تم حذف مستند Firestore ${id}.`);
  await loadRecords();
}

async function createAccount(event) {
  event.preventDefault();

  const form = $("accountForm");
  const submit = form.querySelector('[type="submit"]');
  const values = Object.fromEntries(new FormData(form).entries());

  const name = values.name.trim();
  const loginCode = values.loginCode.trim().toLowerCase();
  const password = values.password;
  const role = values.role;

  if (!/^[a-z0-9._-]{3,64}$/.test(loginCode)) {
    show("accountMessage", "كود الدخول يجب أن يتكون من حروف إنجليزية أو أرقام أو . _ -", true);
    return;
  }

  submit.disabled = true;
  submit.textContent = "جارٍ إنشاء الحساب...";

  let createdUid = null;

  try {
    const email = `${loginCode}@accounts.egns.com`;

    const credential = await createUserWithEmailAndPassword(
      secondaryAuth, email, password
    );

    createdUid = credential.user.uid;

    const profile = {
      name,
      fullName: name,
      loginCode,
      email,
      role,
      stage: values.stage || "",
      classId: values.classId.trim(),
      className: values.className.trim(),
      active: true,
      points: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    };

    await setDoc(doc(db, "users", createdUid), profile);

    show("accountMessage",
      `تم إنشاء الحساب بنجاح. كود الدخول: ${loginCode} — البريد الداخلي: ${email}`);

    form.reset();

  } catch (error) {
    console.error(error);

    if (createdUid) {
      show(
        "accountMessage",
        "تم إنشاء حساب Authentication لكن تعذر حفظ ملفه في Firestore. لا تكرر الإنشاء قبل مراجعة الحساب والملف.",
        true
      );
    } else if (error.code === "auth/email-already-in-use") {
      show("accountMessage", "كود الدخول مستخدم بالفعل. اختر كودًا آخر.", true);
    } else {
      show("accountMessage", error.message || "تعذر إنشاء الحساب.", true);
    }
  } finally {
    submit.disabled = false;
    submit.textContent = "إنشاء الحساب";

    try {
      await secondarySignOut(secondaryAuth);
    } catch {}
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  if (!isAdminEmail(user.email)) {
    location.replace("dashboard.html");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));

    // حسابات الأدمن المعتمدة بالبريد مسموح لها بالدخول
    // حتى لو لم يكن لها مستند users قديم.
    document.body.style.visibility = "visible";
  } catch (error) {
    console.error(error);
    show("recordMessage", "تعذر التحقق من الاتصال بقاعدة البيانات.", true);
  }
});

$("accountForm").addEventListener("submit", createAccount);
$("loadRecords").addEventListener("click", () =>
  loadRecords().catch(e => show("recordMessage", e.message, true))
);

$("newRecord").addEventListener("click", () => {
  selectedId = null;
  $("documentId").value = "";
  $("recordJson").value = "{\n  \n}";
  show("recordMessage", "اكتب بيانات المستند ثم اضغط حفظ المستند.");
});

$("saveRecord").addEventListener("click", () =>
  saveRecord().catch(e => {
    console.error(e);
    show("recordMessage", e.message || "تعذر الحفظ.", true);
  })
);

$("deleteRecord").addEventListener("click", () =>
  deleteRecord().catch(e => {
    console.error(e);
    show("recordMessage", e.message || "تعذر الحذف.", true);
  })
);

$("collectionSelect").addEventListener("change", () => {
  selectedId = null;
  $("documentId").value = "";
  $("recordJson").value = "";
  $("recordsList").innerHTML = "";
});

$("adminLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("login.html");
});
