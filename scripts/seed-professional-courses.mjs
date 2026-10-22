import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

// Instructor ID to own all courses so the user can manage them from dashboard
const instructorId = "wAxgSBMXbdSMQZesdmvXbVcOiPr1";
const instructorName = "أكاديمية المنارة التعليمية";

const coursesData = [
  {
    title: "الكيمياء للثانوية العامة - شرح وتطبيقات الباب الأول والثاني",
    description: "دورة متكاملة لتغطية العناصر الانتقالية والتحليل الكيميائي لطلاب الصف الثالث الثانوي، تشمل حل أكثر من 500 سؤال وتدريب عملي على النظام الحديث وفق أحدث مواصفات وزارة التربية والتعليم.",
    category: "chemistry",
    grade_level: "sec_3",
    price: 120,
    duration: 28,
    thumbnail_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1200&auto=format&fit=crop",
    modules: [
      {
        id: 1,
        title: "الوحدة الأولى: العناصر الانتقالية وخواص الحديد",
        lessons: [
          { id: 101, title: "المحاضرة 1: مدخل العناصر الانتقالية والتوزيع الإلكتروني وحالات التأكسد", duration: "45 دقيقة" },
          { id: 102, title: "المحاضرة 2: الخواص العامة لعناصر السلسلة الانتقالية الأولى", duration: "50 دقيقة" },
          { id: 103, title: "المحاضرة 3: استخلاص الحديد وخاماته وإنتاج الصلب والسبائك", duration: "60 دقيقة" },
          { id: 104, title: "المحاضرة 4: أكاسيد الحديد والتفاعلات الكيميائية الهامة", duration: "55 دقيقة" },
          { id: 105, title: "ورشة حل وتطبيقات بنك الأسئلة الشاملة على الباب الأول", duration: "75 دقيقة" }
        ]
      },
      {
        id: 2,
        title: "الوحدة الثانية: التحليل الكيميائي الوصفي والكمي",
        lessons: [
          { id: 201, title: "المحاضرة 1: الكشف عن أنيونات حمض الهيدروكلوريك وحمض الكبريتيك المركز", duration: "55 دقيقة" },
          { id: 202, title: "المحاضرة 2: الكشف عن الكاتيونات والمجموعات التحليلية", duration: "50 دقيقة" },
          { id: 203, title: "المحاضرة 3: التحليل الكمي الحجمي (المعايرة) ومسائل التطاير والترسيب", duration: "65 دقيقة" }
        ]
      }
    ]
  },
  {
    title: "الفيزياء الكهربية والحديثة - الصف الثالث الثانوي",
    description: "شرح شامل لقوانين كيرشوف، الحث الكهرومغناطيسي، وأجهزة القياس الكهربي، مع تدريبات مكثفة على حل الدوائر المعقدة ومقدمة الفيزياء الحديثة وازدواجية الموجة والجسيم.",
    category: "physics",
    grade_level: "sec_3",
    price: 150,
    duration: 32,
    thumbnail_url: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=1200&auto=format&fit=crop",
    modules: [
      {
        id: 1,
        title: "الفصل الأول: التيار الكهربي وقانون أوم وقوانين كيرشوف",
        lessons: [
          { id: 101, title: "المحاضرة 1: شدة التيار وفرق الجهد والمقاومة النوعية والتوصيلية", duration: "50 دقيقة" },
          { id: 102, title: "المحاضرة 2: توصيل المقاومات وحساب المقاومة المكافئة بطرق الاختزال", duration: "65 دقيقة" },
          { id: 103, title: "المحاضرة 3: قانون أوم للدائرة المغلقة وفروق الجهد بين النقاط", duration: "60 دقيقة" },
          { id: 104, title: "المحاضرة 4: قوانين كيرشوف للدوائر الكهربية المعقدة وحل المسائل", duration: "70 دقيقة" }
        ]
      },
      {
        id: 2,
        title: "الفصل الثاني: التأثير المغناطيسي وأجهزة القياس",
        lessons: [
          { id: 201, title: "المحاضرة 1: الفيض المغناطيسي لسلك مستقيم وملف دائري ولولبي", duration: "55 دقيقة" },
          { id: 202, title: "المحاضرة 2: القوة المغناطيسية وعزم الازدواج", duration: "50 دقيقة" },
          { id: 203, title: "المحاضرة 3: الجلفانومتر الحساس وتحويله إلى أميتر وفولتميتر وأوميتر", duration: "75 دقيقة" }
        ]
      }
    ]
  },
  {
    title: "التفاضل والتكامل لطلاب الثانوية العامة (علمي رياضة)",
    description: "كورس متقدم في اشتقاق الدوال المثلثية وتطبيقات المعدلات الزمنية وسلوك الدوال ونقاط الانقلاب، مع حل نماذج الامتحانات التجريبية وبنك المعرفة المصري.",
    category: "math",
    grade_level: "sec_3",
    price: 110,
    duration: 24,
    thumbnail_url: "https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=1200&auto=format&fit=crop",
    modules: [
      {
        id: 1,
        title: "الوحدة الأولى: تفاضل الدوال المثلثية والاشتقاق الضمني والبارامتري",
        lessons: [
          { id: 101, title: "المحاضرة 1: مراجعة قواعد الاشتقاق واشتقاق الدوال المثلثية الأساسية", duration: "45 دقيقة" },
          { id: 102, title: "المحاضرة 2: الاشتقاق الضمني والبارامتري والمشتقات العليا", duration: "55 دقيقة" },
          { id: 103, title: "المحاضرة 3: معادلات المماس والعمودي وتطبيقات هندسية وفيزيائية", duration: "60 دقيقة" },
          { id: 104, title: "المحاضرة 4: المعدلات الزمنية المرتبطة ومسائل تفوق", duration: "70 دقيقة" }
        ]
      },
      {
        id: 2,
        title: "الوحدة الثانية: سلوك الدالة ورسم المنحنيات",
        lessons: [
          { id: 201, title: "المحاضرة 1: فترات التزايد والتناقص والقيم العظمى والصغرى المحلية", duration: "50 دقيقة" },
          { id: 202, title: "المحاضرة 2: التحدب لأعلى ولأسفل ونقاط الانقلاب ورسم المنحنيات", duration: "60 دقيقة" },
          { id: 203, title: "المحاضرة 3: تطبيقات على القيم العظمى والصغرى المطلقة (المسائل العملية)", duration: "65 دقيقة" }
        ]
      }
    ]
  },
  {
    title: "Grammar & Writing Masterclass - لغة إنجليزية ثانوية عامة",
    description: "شرح شامل ومبسط لأهم أزمنة وقواعد اللغة الإنجليزية المقررة، مهارات كتابة المقال، التعامل مع أسئلة الترجمة، وحل قطع الفهم الصعبة وفق نظام الامتحانات الجديد.",
    category: "english",
    grade_level: "sec_2",
    price: 85,
    duration: 18,
    thumbnail_url: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop",
    modules: [
      {
        id: 1,
        title: "Module 1: Advanced Grammar & Structure",
        lessons: [
          { id: 101, title: "Lesson 1: Past Tenses & Narrative Habits (Used to vs. Would)", duration: "40 mins" },
          { id: 102, title: "Lesson 2: Present Perfect Simple vs. Present Perfect Continuous", duration: "45 mins" },
          { id: 103, title: "Lesson 3: Conditionals & Wish Clauses in Depth", duration: "50 mins" },
          { id: 104, title: "Lesson 4: Relative Clauses & Passive Structures", duration: "55 mins" }
        ]
      },
      {
        id: 2,
        title: "Module 2: Essay Writing & Translation Skills",
        lessons: [
          { id: 201, title: "Lesson 1: Academic Essay Structure & Transitions", duration: "45 mins" },
          { id: 202, title: "Lesson 2: Punctuation Rules & Identifying Errors", duration: "40 mins" },
          { id: 203, title: "Lesson 3: Translation Strategies & Common Traps", duration: "50 mins" }
        ]
      }
    ]
  },
  {
    title: "ورشة تأسيس ومراجعة مبادئ الكيمياء ومعادلات المادة",
    description: "ورشة مكثفة لطلاب المرحلة الثانوية لتأسيس حساب الصيغ الكيميائية، وزن المعادلات، حسابات المول، وقوانين الغازات بطرق سهلة ومباشرة لضمان التفوق.",
    category: "chemistry",
    grade_level: "sec_1",
    price: 20,
    duration: 8,
    thumbnail_url: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?q=80&w=1200&auto=format&fit=crop",
    modules: [
      {
        id: 1,
        title: "المحور الأول: أسس الحساب الكيميائي وكتابة الصيغ",
        lessons: [
          { id: 101, title: "الدرس 1: التكافؤات وكتابة الصيغ الكيميائية وتسمية المركبات", duration: "35 دقيقة" },
          { id: 102, title: "الدرس 2: وزن المعادلات الكيميائية وموازنة الشحنات", duration: "40 دقيقة" },
          { id: 103, title: "الدرس 3: حساب كتل المواد وعلاقة المول بعدد أفوجادرو", duration: "50 دقيقة" }
        ]
      },
      {
        id: 2,
        title: "المحور الثاني: تطبيقات مسائل المول والنسبة المئوية",
        lessons: [
          { id: 201, title: "الدرس 1: المادة المحددة للتفاعل وحجم الغازات في STP", duration: "45 دقيقة" },
          { id: 202, title: "الدرس 2: حل اختبار الورشة الشامل وتوزيع شهادات الإتمام", duration: "40 دقيقة" }
        ]
      }
    ]
  }
];

async function seedCourses() {
  console.log("=========================================");
  console.log("   SEEDING PROFESSIONAL COURSES          ");
  console.log("=========================================");

  // 1. Delete old test course
  const existingCourses = await db.collection("courses").get();
  for (const doc of existingCourses.docs) {
    console.log(`[-] Deleting existing course: ${doc.id} (${doc.data().title})`);
    await doc.ref.delete();
  }

  // 2. Insert new professional courses
  const now = new Date().toISOString();
  for (let i = 0; i < coursesData.length; i++) {
    const c = coursesData[i];
    const courseRef = db.collection("courses").doc();
    const docData = {
      id: courseRef.id,
      instructor_id: instructorId,
      instructor_name: instructorName,
      title: c.title,
      description: c.description,
      category: c.category,
      grade_level: c.grade_level,
      price: c.price,
      duration: c.duration,
      thumbnail_url: c.thumbnail_url,
      status: "approved",
      is_published: true,
      students_count: 0,
      modules: c.modules,
      created_at: now,
      updated_at: now,
    };

    await courseRef.set(docData);
    console.log(`[+] Added Course: "${c.title}" (Price: ${c.price} EGP, Grade: ${c.grade_level}) -> ID: ${courseRef.id}`);
  }

  console.log("=========================================");
  console.log("   ALL COURSES SEEDED SUCCESSFULLY!      ");
  console.log("=========================================");
}

seedCourses().catch(err => {
  console.error("Error seeding courses:", err);
  process.exit(1);
});
