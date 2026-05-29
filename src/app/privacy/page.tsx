import { Navbar } from "@/components/navbar"
import { ShieldCheck } from "lucide-react"

export default function PrivacyPage() {
    return (
        <div className="flex min-h-screen flex-col bg-muted/10">
            <Navbar />
            <main className="flex-1 container py-16 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-10 border-b pb-6">
                    <div className="h-14 w-14 bg-primary/10 flex items-center justify-center rounded-xl shrink-0">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">سياسة الخصوصية واستخدام البيانات</h1>
                        <p className="text-muted-foreground mt-1">آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-muted-foreground leading-loose">
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">1. المعلومات التي نقوم بجمعها</h2>
                        <p>نحن نقوم بجمع البيانات الأساسية التي تقدمها لنا طواعية عند إنشاء الحساب مثل: الاسم الكامل، عنوان البريد الإلكتروني، رقم الهاتف، والمرحلة الدراسية. إضافة إلى ذلك، نجمع تلقائياً معلومات فنية تتعلق بأجهزة تسجيل الدخول وعناوين (IP) الخاصة بك بهدف حماية حساباتك ومنع المشاركة غير القانونية للحسابات بين عدة أشخاص.</p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">2. استخدام البيانات والكوكيز (Cookies)</h2>
                        <p>استخدام الكوكيز محصور بصلاحيات الوصول الآمن وتحسين وتخصيص تجربتك التعليمية بالمنصة. نحن لا نشارك، ولا نبيع، ولا نقوم بتأجير بياناتك لأي جهات تسويقية خارجية. تقتصر مشاركة بعض الإحصاءات العامة فقط داخل المنصة على المعلمين التابعين لدوراتك المسجلة بها لمعرفة مستوى إنجازك وإرسال تقارير الدرجات الخاصة بك.</p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">3. حماية وحفظ البيانات</h2>
                        <p>تُحفظ جميع البيانات داخل خوادم آمنة ومشفرة. وتتم حماية الاتصال عبر طبقات التشفير القياسية (SSL). نعمل جاهدين لمنع الوصول غير المصرح به للبيانات ونقوم بعمل صيانة مستمرة لضمان أعلى مستويات الأمان المتاحة وفق المعايير العالمية.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">4. الخصوصية حول أرقام هواتف الطلاب</h2>
                        <p>يتم استخدام الأرقام للتواصل الضروري فقط لحل مشكلات الحسابات أو للتأكد من هوية الطالب عند طلب المساعدة عبر الدعم الفني، وربما إرسال إشعارات لتنبيه الطالب بتوافر مقاطع جديدة أو ظهور نتائج الامتحانات.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">5. حذف الحساب والبيانات</h2>
                        <p>يحق لأي مستخدم التواصل مع إدارة الأكاديمية والمطالبة بإلغاء حسابه وحذف معلوماته الشخصية نهائياً من قاعدة بياناتنا، وسيتم تنفيذ ذلك ما لم يكن هناك تعارض مع الشروط المحاسبية أو التزامات قانونية تقتضي احتفاظ المنصة ببعض السجلات المحدودة.</p>
                    </section>
                </div>
            </main>
        </div>
    )
}
