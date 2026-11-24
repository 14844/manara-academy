import { Navbar } from "@/components/navbar"
import { Scale } from "lucide-react"

export default function TermsPage() {
    return (
        <div className="flex min-h-screen flex-col bg-muted/10">
            <Navbar />
            <main className="flex-1 container py-16 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-10 border-b pb-6">
                    <div className="h-14 w-14 bg-primary/10 flex items-center justify-center rounded-xl shrink-0">
                        <Scale className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">الشروط والأحكام</h1>
                        <p className="text-muted-foreground mt-1">آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-muted-foreground leading-loose">
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">1. القبول والالتزام</h2>
                        <p>بمجرد استخدامك لمنصة "أكاديمية المنارة" كطالب أو كمحاضر، فإنك تقر بأنك قد قرأت وتفهمت جميع الشروط والأحكام الموضحة هنا، وتوافق على الالتزام بها التزاماً كاملاً. في حال عدم موافقتك على أي من هذه الشروط، يُرجى عدم استخدام خدماتنا.</p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">2. حقوق الملكية الفكرية</h2>
                        <p>جميع حقوق الفيديوهات، المذكرات، والأسئلة مملوكة حصرياً للمعلمين وصناع المحتوى. تُحظر تماماً أي محاولة لتحميل، نسخ، إعادة إنتاج، أو مشاركة المحتوى التعليمي في مواقع أو منصات أخرى. استخدامك لطرق ملتوية (Screen Recording وغيرها) يعرض الحساب للإلغاء الفوري دون تعويض فضلاً عن المساءلة القانونية القصوى.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">3. التزامات الطالب</h2>
                        <p>يلتزم الطالب بالحفاظ على سرية بيانات تسجيل الدخول الخاصة به وعدم مشاركتها مع أطراف أخرى. يتم تسجيل الحساب ببيانات حقيقية وخاصة رقم الهاتف كونه وسيلة التواصل الأساسية. المنصة غير مسؤولة عن إغلاق الحساب في حالة التلاعب بالأنظمة لتخطي الحماية الفنية.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">4. التزامات المعلم والإدارة المالية</h2>
                        <p>يلتزم العميل بتقديم محتوى تعليمي هادف ومناسب للثقافة العليمة. يتم احتساب أرباح المعلمين بشفافية تامة من خلال نسبة مقطوعة يتم الاتفاق عليها مسبقاً لحساب المنصة مقابل تقديم خدمات الاستضافة، البث المباشر، والحماية. يحق للمنصة تعديل أسعار الخدمة مستقبلاً مع إخطار المعلمين بفترة زمنية محددة مسبقاً.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">5. إنهاء الخدمة وإغلاق الحسابات</h2>
                        <p>يحق لإدارة أكاديمية المنارة إغلاق، تجميد أو تعليق أي حساب ينتهك السياسات الموضحة أو يحاول القيام بأعمال احتيالية سواء في عمليات الدفع أو في التعدي على حقوق الآخرين الفكرية دون توجيه إنذار مسبق، ولا يستحق صاحب الحساب المخالف أي تعويض.</p>
                    </section>
                </div>
            </main>
        </div>
    )
}
