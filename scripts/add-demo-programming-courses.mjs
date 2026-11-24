// Adds 3 demo programming courses (add-only: never deletes, skips titles that already exist).
// Run from the project root:  node scripts/add-demo-programming-courses.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

// Existing instructor account ("teacher") so the courses are manageable from its dashboard
const instructorId = 'TXi7SScaXIWgVjIgukkvzen6jR23';
const instructorName = 'فريق أكاديمية المنارة';

const courses = [
  {
    title: 'أساسيات البرمجة بلغة Python من الصفر',
    description: 'ابدأ رحلتك في البرمجة بلغة Python خطوة بخطوة: المتغيرات، الشروط، التكرار، الدوال، والتعامل مع الملفات، مع مشاريع عملية صغيرة بعد كل وحدة. مناسب للمبتدئين تماماً بدون أي خبرة سابقة.',
    price: 199,
    duration: 20,
    thumbnail_url: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?q=80&w=1200&auto=format&fit=crop',
    modules: [
      {
        id: 1,
        title: 'الوحدة الأولى: مدخل إلى Python',
        lessons: [
          { id: 101, title: 'تثبيت Python وكتابة أول برنامج', duration: '30 دقيقة' },
          { id: 102, title: 'المتغيرات وأنواع البيانات', duration: '40 دقيقة' },
          { id: 103, title: 'الشروط والتكرار (if / for / while)', duration: '50 دقيقة' },
        ],
      },
      {
        id: 2,
        title: 'الوحدة الثانية: الدوال والمشاريع العملية',
        lessons: [
          { id: 201, title: 'الدوال والقوائم والقواميس', duration: '45 دقيقة' },
          { id: 202, title: 'التعامل مع الملفات', duration: '35 دقيقة' },
          { id: 203, title: 'مشروع: برنامج إدارة مصروفات بسيط', duration: '60 دقيقة' },
        ],
      },
    ],
  },
  {
    title: 'تطوير مواقع الويب: HTML و CSS و JavaScript',
    description: 'تعلّم بناء مواقع ويب حديثة ومتجاوبة من البداية: هيكلة الصفحات بـ HTML، التصميم بـ CSS و Flexbox و Grid، وإضافة التفاعل بـ JavaScript. الكورس ينتهي ببناء موقع شخصي كامل ونشره على الإنترنت.',
    price: 249,
    duration: 26,
    thumbnail_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&auto=format&fit=crop',
    modules: [
      {
        id: 1,
        title: 'الوحدة الأولى: HTML و CSS',
        lessons: [
          { id: 101, title: 'هيكل صفحة الويب وعناصر HTML', duration: '40 دقيقة' },
          { id: 102, title: 'التنسيق بـ CSS والألوان والخطوط', duration: '45 دقيقة' },
          { id: 103, title: 'Flexbox و Grid والتصميم المتجاوب', duration: '60 دقيقة' },
        ],
      },
      {
        id: 2,
        title: 'الوحدة الثانية: JavaScript والمشروع النهائي',
        lessons: [
          { id: 201, title: 'أساسيات JavaScript', duration: '50 دقيقة' },
          { id: 202, title: 'التعامل مع الصفحة (DOM) والأحداث', duration: '55 دقيقة' },
          { id: 203, title: 'مشروع: بناء موقع شخصي ونشره', duration: '70 دقيقة' },
        ],
      },
    ],
  },
  {
    title: 'الذكاء الاصطناعي وأتمتة الأعمال بـ n8n',
    description: 'تعلّم بناء أنظمة أتمتة ذكية بدون كتابة كود معقد: ربط التطبيقات ببعض، بناء Chatbot بالذكاء الاصطناعي يرد على العملاء، وحفظ البيانات تلقائياً باستخدام n8n و Webhooks و Gemini.',
    price: 299,
    duration: 18,
    thumbnail_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop',
    modules: [
      {
        id: 1,
        title: 'الوحدة الأولى: أساسيات n8n',
        lessons: [
          { id: 101, title: 'ما هي الأتمتة؟ وتثبيت n8n', duration: '35 دقيقة' },
          { id: 102, title: 'الـ Nodes والـ Triggers والـ Webhooks', duration: '45 دقيقة' },
          { id: 103, title: 'ربط Google Sheets و Telegram', duration: '50 دقيقة' },
        ],
      },
      {
        id: 2,
        title: 'الوحدة الثانية: الذكاء الاصطناعي داخل n8n',
        lessons: [
          { id: 201, title: 'AI Agent node والربط مع Gemini', duration: '50 دقيقة' },
          { id: 202, title: 'إضافة ذاكرة وأدوات للـ AI Agent', duration: '55 دقيقة' },
          { id: 203, title: 'مشروع: Chatbot لخدمة العملاء على موقعك', duration: '70 دقيقة' },
        ],
      },
    ],
  },
];

async function main() {
  const existing = await db.collection('courses').get();
  const titles = new Set(existing.docs.map((d) => d.data().title));
  const now = new Date().toISOString();

  for (const c of courses) {
    if (titles.has(c.title)) {
      console.log(`[=] Skipped (already exists): ${c.title}`);
      continue;
    }
    const ref = db.collection('courses').doc();
    await ref.set({
      id: ref.id,
      instructor_id: instructorId,
      instructor_name: instructorName,
      title: c.title,
      description: c.description,
      category: 'other',
      grade_level: null,
      price: c.price,
      duration: c.duration,
      thumbnail_url: c.thumbnail_url,
      status: 'approved',
      is_published: true,
      students_count: 0,
      modules: c.modules,
      created_at: now,
      updated_at: now,
    });
    console.log(`[+] Added: ${c.title} (${c.price} EGP) -> ${ref.id}`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
