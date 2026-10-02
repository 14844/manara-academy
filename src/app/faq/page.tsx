import { Navbar } from "@/components/navbar"
import { HelpCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { getSupportSettings } from "@/lib/support-settings"
import { SupportInfo } from "@/components/support-info"

export const dynamic = "force-dynamic"

export default async function FAQPage() {
    const supportSettings = await getSupportSettings()
    
    return (
        <div className="flex min-h-screen flex-col bg-muted/30">
            <Navbar />
            <main className="flex-1 container py-16 max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6 border border-primary/20">
                        <HelpCircle className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">الأسئلة الشائعة</h1>
                    <p className="text-lg text-muted-foreground w-full max-w-2xl mx-auto leading-relaxed">
                        كل ما تحتاج معرفته عن أكاديمية المنارة وكيفية عمل المنصة مبسط هنا. إذا كان لديك سؤال لم يتم الإجابة عنه، تواصل معنا دوماً.
                    </p>
                </div>

                <div className="space-y-4">
                    <details className="group rounded-xl border border-border bg-card p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden open:border-primary/50 transition-all cursor-pointer">
                        <summary className="flex items-center justify-between gap-1.5 text-foreground hover:text-primary transition-colors outline-none">
                            <h2 className="text-lg font-bold leading-relaxed pr-2 pointer-events-none">كيف أبدأ التعلم على المنصة؟</h2>
                            <span className="shrink-0 rounded-full bg-primary/10 p-2 text-primary sm:p-3 group-open:-rotate-180 transition-transform duration-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-muted-foreground px-2 pb-2 text-base border-t border-border pt-4">
                            تبدأ رحلتك بإنشاء حساب جديد كطالب من خلال صفحة التسجيل. بعد تأكيد المرحلة الدراسية، يمكنك تصفح الكورسات المتاحة والاشتراك في الدورة التي تناسبك للبدء فوراً في مشاهدة الفيديوهات المخصصة لك، والتحضير للدروس.
                        </p>
                    </details>

                    <details className="group rounded-xl border border-border bg-card p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden open:border-primary/50 transition-all cursor-pointer">
                        <summary className="flex items-center justify-between gap-1.5 text-foreground hover:text-primary transition-colors outline-none">
                            <h2 className="text-lg font-bold leading-relaxed pr-2 pointer-events-none">ما هي طرق الدفع المتاحة للاشتراك في الكورسات التابعة للمنصة؟</h2>
                            <span className="shrink-0 rounded-full bg-primary/10 p-2 text-primary sm:p-3 group-open:-rotate-180 transition-transform duration-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-muted-foreground px-2 pb-2 text-base border-t border-border pt-4">
                            نوفر نظام دفع مرن من خلال (المحفظة الإلكترونية) الخاصة بالطالب على المنصة. يمكنك التواصل مع الإدارة أو المدرس لشحن محفظتك، وسيضاف الرصيد في حسابك فوراً لتسهيل شراء الكورسات بضغطة زر واحدة.
                        </p>
                    </details>

                    <details className="group rounded-xl border border-border bg-card p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden open:border-primary/50 transition-all cursor-pointer">
                        <summary className="flex items-center justify-between gap-1.5 text-foreground hover:text-primary transition-colors outline-none">
                            <h2 className="text-lg font-bold leading-relaxed pr-2 pointer-events-none">ما الذي يميز أكاديمية المنارة عن المنصات التعليمية التقليدية؟</h2>
                            <span className="shrink-0 rounded-full bg-primary/10 p-2 text-primary sm:p-3 group-open:-rotate-180 transition-transform duration-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-muted-foreground px-2 pb-2 text-base border-t border-border pt-4">
                            المنارة ليست مجرد مكان لعرض الفيديوهات؛ إنها بيئة متكاملة تضمن حماية فائقة لحقوق المعلمين بمنع تحميل وتصوير الشروحات، وتقدم للطلاب أدوات تقييم تفاعلية كالأسئلة المقالية والاختيارية مع تصحيح لحظي، بالإضافة إلى تقارير تقييم مستوى دقيقة للطلاب وأولياء الأمور.
                        </p>
                    </details>

                    <details className="group rounded-xl border border-border bg-card p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden open:border-primary/50 transition-all cursor-pointer">
                        <summary className="flex items-center justify-between gap-1.5 text-foreground hover:text-primary transition-colors outline-none">
                            <h2 className="text-lg font-bold leading-relaxed pr-2 pointer-events-none">أنا مدرس وأرغب في الانضمام لأكاديمية المنارة، كيف أقوم بفتح حساب مدرس؟</h2>
                            <span className="shrink-0 rounded-full bg-primary/10 p-2 text-primary sm:p-3 group-open:-rotate-180 transition-transform duration-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-muted-foreground px-2 pb-2 text-base border-t border-border pt-4">
                            يمكن لأي صانع محتوى تعليمي تسجيل حساب 'كمدرس' من صفحة التسجيل، أو التواصل المباشر مع المنصة. ستقوم الإدارة بمراجعة طلبك لتبدأ فوراً في إدارة كورساتك الخاصة وتحقيق مبيعاتك بشكل مستقل.
                        </p>
                    </details>

                    <details className="group rounded-xl border border-border bg-card p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden open:border-primary/50 transition-all cursor-pointer">
                        <summary className="flex items-center justify-between gap-1.5 text-foreground hover:text-primary transition-colors outline-none">
                            <h2 className="text-lg font-bold leading-relaxed pr-2 pointer-events-none">كيف يمكنني التواصل مع الدعم الفني للمنصة في حال واجهتني مشكلة تقنية؟</h2>
                            <span className="shrink-0 rounded-full bg-primary/10 p-2 text-primary sm:p-3 group-open:-rotate-180 transition-transform duration-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-muted-foreground px-2 pb-2 text-base border-t border-border pt-4">
                            إذا واجهتك أي مشكلة تقنية، لا تتردد في التواصل معنا عبر البريد الإلكتروني (<SupportInfo type="email" linkType="mailto" className="text-primary hover:underline" />) أو الاتصال/مراسلة رقم الدعم المخصص (<SupportInfo type="phone" linkType="wa" className="text-primary hover:underline" />) خلال أوقات العمل الرسمية وسنسعد بمساعدتك وحل المشكلة فوراً.
                        </p>
                    </details>
                </div>
            </main>
        </div>
    )
}
