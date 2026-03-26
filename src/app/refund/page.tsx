import { Navbar } from "@/components/navbar"
import { RefreshCcw } from "lucide-react"

export default function RefundPage() {
    return (
        <div className="flex min-h-screen flex-col bg-muted/10">
            <Navbar />
            <main className="flex-1 container py-16 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-10 border-b pb-6">
                    <div className="h-14 w-14 bg-primary/10 flex items-center justify-center rounded-xl shrink-0">
                        <RefreshCcw className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">سياسة الاسترجاع والإلغاء</h1>
                        <p className="text-muted-foreground mt-1">آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-muted-foreground leading-loose">
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">1. شراء الكورسات والباقات</h2>
                        <p>نظراً لطبيعة المنتجات الرقمية والمحتوى التعليمي المُقدم عبر منصتنا والذي يُعتبر (منتجات غير ملموسة)، يُعتبر اشتراك الطالب وموافقته على الخصم من رصيد محفظته لشراء كورس معين عملية **غير قابلة للاسترجاع** بمجرد إتمام الشراء، ولا يحق استرداد القيمة إلا في حالة حدوث خلل تقني من جانبنا يمنع تقديم الخدمة المعلنة.</p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">2. شحن محفظة المنصة (Wallet)</h2>
                        <p>الأموال التي يقوم الطالب أو ولي الأمر بشحنها داخل "محفظة أكاديمية المنارة" تستخدم حصرياً لشراء الخدمات والكورسات التعليمية المتاحة عبر الأكاديمية ولا يُسمح بسحبها أو تحويلها لحسابات خارجية أو استرجاعها كأموال نقدية مجدداً بأي شكل من الأشكال. يمكن فقط استخدامها في أي وقت لشراء الدروس.</p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">3. تكرار الدفع الخاطئ</h2>
                        <p>في حالة قيامك بالدفع الخاطئ مرتين للمحفظة نتيجة خطأ تقني أو بشري، يُرجى سرعة التواصل مع خدمة العملاء الخاصة والدعم الفني عبر وسائل الاتصال الرسمية، مرفقاً بالإيصالات الدالة على التحويل ووقت الحدوث ليتم دراسة المشكلة وتعويض الرصيد الزائد، وسيظل رصيداً قابلاً للاستخدام داخل محفظتك بالمنصة وفقاً للآلية التقنية الممكنة.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">4. تعليق الحسابات وإقفالها للمخالفين</h2>
                        <p>في حال قامت الأكاديمية بتعليق أو حظر حساب طالب لسبب متعلق بانتهاك الأمن والحقوق والإخلال الصريح بسياسة الشروط والأحكام (القيام بمحاولات تسجيل شاشة الموبايل لاصطياد فيديوهات أو سرقتها، أو مشاركة تفاصيل الحساب مع آخرين)، فإن المنصة تصادر رصيد المحفظة الخاص بالطالب المخالف، وتلغي وصوله للكورسات ولا يحق له المطالبة بأي شكل من أشكال التعويض النقدي مهما كانت قيمة الرصيد الموجود.</p>
                    </section>
                </div>
            </main>
        </div>
    )
}
