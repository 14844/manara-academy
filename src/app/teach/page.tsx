import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { SupportInfo } from "@/components/support-info"
import { PlanCard } from "@/components/plans/plan-card"
import { PLAN_LIST } from "@/lib/plans"
import {
    ArrowLeft,
    BarChart,
    ClipboardList,
    FlaskConical,
    MessageCircle,
    Presentation,
    ShieldCheck,
    TicketPercent,
    Upload,
    UserPlus,
    Wallet,
} from "lucide-react"

export const metadata: Metadata = {
    title: "للمدرسين | أكاديمية المنارة",
    description: "انشر كورساتك على أكاديمية المنارة: حماية للفيديوهات بعلامة مائية، امتحانات مقالية واختيار من متعدد، تقارير للطلاب وأولياء الأمور، ومحفظة لسحب أرباحك.",
}

/**
 * The signup form has a role picker (طالب / مدرس). `?role=instructor` is passed so the form
 * can preselect it if/when it supports the param; until then the hint text tells the teacher what to pick.
 */
const INSTRUCTOR_SIGNUP_HREF = "/signup?role=instructor"

const FEATURES = [
    {
        icon: ShieldCheck,
        title: "حماية الفيديوهات والعلامة المائية",
        description: "فيديوهاتك محمية ضد التحميل وتسجيل الشاشة، مع علامة مائية متحركة على الفيديو تحفظ حقك في المحتوى.",
    },
    {
        icon: ClipboardList,
        title: "امتحانات مقالية واختيار من متعدد",
        description: "أنشئ امتحانات اختيار من متعدد أو مقالية لكل درس، وصحّح الإجابات المقالية من صفحة التصحيح.",
    },
    {
        icon: BarChart,
        title: "تقارير الطلاب وأولياء الأمور",
        description: "تابع مستوى كل طالب ودرجاته، وابعت لولي الأمر تقرير واضح بمستوى ابنه.",
    },
    {
        icon: Wallet,
        title: "محفظة وسحب أرباح",
        description: "مبيعات كورساتك بتتجمع في محفظتك على المنصة، وتقدر تطلب سحب أرباحك من لوحة التحكم.",
    },
    {
        icon: FlaskConical,
        title: "مختبرات افتراضية",
        description: "مختبرات تفاعلية للكيمياء والفيزياء والرياضيات تقدر تستخدمها مع طلابك في الشرح.",
    },
    {
        icon: TicketPercent,
        title: "كوبونات خصم",
        description: "اعمل كوبونات خصم لكورساتك وشاركها مع طلابك وقت ما تحب.",
    },
] as const

const STEPS = [
    {
        icon: UserPlus,
        title: "سجّل حساب مدرس",
        description: "سجّل كمدرس واكتب تخصصك. حسابك بيتراجع ويتفعّل من فريق المنارة.",
    },
    {
        icon: Upload,
        title: "جهّز كورسك",
        description: "ارفع الدروس والملفات وأضف الامتحانات من لوحة التحكم. الكورس بيتراجع من فريق المنارة قبل ما يتنشر.",
    },
    {
        icon: Presentation,
        title: "اشرح وتابع",
        description: "بعد النشر طلابك يشتركوا من المنصة، وإنت تتابع درجاتهم وتقاريرهم وأرباحك من مكان واحد.",
    },
] as const

export default function TeachPage() {
    return (
        <div className="flex min-h-screen flex-col overflow-x-clip">
            <Navbar />
            <main className="flex-1">
                {/* Hero */}
                <section className="py-12 sm:py-20 lg:py-24">
                    <div className="container mx-auto">
                        <div className="flex flex-col items-center text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-1.5 text-xs sm:text-sm font-semibold mb-6 glass shadow-sm">
                                <Presentation className="h-4 w-4 text-primary" />
                                للمدرسين
                            </div>
                            <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
                                أنت مدرس؟ <br className="hidden sm:block" />
                                <span className="text-primary">ركّز في الشرح</span>، والمنارة عليها الباقي
                            </h1>
                            <p className="mt-6 max-w-2xl text-base sm:text-xl text-muted-foreground leading-relaxed">
                                انشر كورساتك أونلاين بفيديوهات محمية، وامتحانات وتقارير لطلابك وأولياء أمورهم، ومحفظة تسحب منها أرباحك — من غير ما تشيل هم أي حاجة تقنية.
                            </p>
                            <div className="mt-8 sm:mt-10 flex w-full flex-col sm:w-auto sm:flex-row justify-center gap-3 sm:gap-4">
                                <Button size="lg" className="h-14 w-full sm:w-auto px-10 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" asChild>
                                    <Link href={INSTRUCTOR_SIGNUP_HREF}>سجّل كمدرس ←</Link>
                                </Button>
                                <Button size="lg" variant="outline" className="h-14 w-full sm:w-auto px-8 text-lg font-bold rounded-2xl glass border-primary/20 gap-2" asChild>
                                    <SupportInfo type="phone" linkType="wa">
                                        <MessageCircle className="h-5 w-5" />
                                        كلّمنا على واتساب
                                    </SupportInfo>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="py-12 sm:py-20">
                    <div className="container mx-auto">
                        <div className="mb-10 sm:mb-14 text-center">
                            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl text-primary mb-4">كل اللي محتاجه عشان تدرّس أونلاين</h2>
                            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                                أدوات جاهزة على المنصة من أول رفع الدرس لحد ما تسحب أرباحك.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
                            {FEATURES.map(({ icon: Icon, title, description }) => (
                                <div key={title} className="glass-card p-6 sm:p-8 motion-reduce:transition-none motion-reduce:hover:transform-none">
                                    <div className="mb-5 flex items-center justify-center w-14 h-14 rounded-2xl glass shadow-sm">
                                        <Icon className="h-7 w-7 text-primary" />
                                    </div>
                                    <h3 className="mb-2 text-lg sm:text-xl font-bold">{title}</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section className="py-12 sm:py-20">
                    <div className="container mx-auto">
                        <div className="mb-10 sm:mb-14 text-center">
                            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl text-primary mb-4">إزاي تبدأ تدرّس على المنارة؟</h2>
                        </div>
                        <ol className="grid gap-4 sm:gap-6 md:grid-cols-3 max-w-5xl mx-auto">
                            {STEPS.map(({ icon: Icon, title, description }, i) => (
                                <li key={title} className="glass-card p-6 sm:p-8 relative overflow-hidden motion-reduce:transition-none motion-reduce:hover:transform-none">
                                    <span className="absolute top-4 left-5 text-5xl font-black text-primary/10 select-none" aria-hidden="true">{i + 1}</span>
                                    <div className="mb-4 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl glass shadow-sm">
                                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                                    </div>
                                    <h3 className="mb-2 text-lg sm:text-xl font-bold">
                                        <span className="sr-only">الخطوة {i + 1}: </span>
                                        {title}
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Pricing */}
                <section id="pricing" className="py-12 sm:py-20 scroll-mt-20">
                    <div className="container mx-auto">
                        <div className="mb-10 sm:mb-14 text-center">
                            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl text-primary mb-4">الباقات</h2>
                            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                                ابدأ مجاناً، ولما طلابك يزيدوا رقّي باقتك وقلّل العمولة اللي بتدفعها على كل اشتراك.
                            </p>
                        </div>
                        <div className="grid gap-6 pt-3 md:grid-cols-3 max-w-6xl mx-auto">
                            {PLAN_LIST.map((plan) => (
                                <PlanCard key={plan.id} plan={plan}>
                                    <Button
                                        size="lg"
                                        variant={plan.highlighted ? "default" : "outline"}
                                        className="h-12 w-full rounded-2xl font-bold"
                                        asChild
                                    >
                                        <Link href={INSTRUCTOR_SIGNUP_HREF}>
                                            {plan.monthlyPrice === 0 ? "ابدأ مجاناً" : "سجّل واختار الباقة"}
                                        </Link>
                                    </Button>
                                </PlanCard>
                            ))}
                        </div>
                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            كل مدرس جديد بيبدأ على باقة البداية، وتقدر تغيّر باقتك في أي وقت من لوحة التحكم.
                        </p>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="pt-4 pb-16 sm:pb-24">
                    <div className="container mx-auto">
                        <div className="max-w-3xl mx-auto text-center glass p-6 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 -z-10" />
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">جاهز تبدأ؟</h2>
                            <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed">
                                سجّل حسابك كمدرس، ولو عندك أي سؤال عن طريقة النشر أو الأرباح كلّمنا وهنرد عليك.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                                <Button size="lg" className="h-14 px-10 text-lg font-bold rounded-2xl" asChild>
                                    <Link href={INSTRUCTOR_SIGNUP_HREF}>سجّل كمدرس</Link>
                                </Button>
                                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold rounded-2xl glass border-primary/20 gap-2" asChild>
                                    <Link href="/help">
                                        مركز المساعدة
                                        <ArrowLeft className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                            <p className="mt-6 text-sm text-muted-foreground">
                                عندك حساب بالفعل؟{" "}
                                <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-primary hover:underline underline-offset-4">
                                    سجّل دخولك
                                </Link>
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="border-t py-8">
                <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground text-center">
                    <p>© {new Date().getFullYear()} أكاديمية المنارة. جميع الحقوق محفوظة.</p>
                    <div className="flex flex-wrap justify-center gap-x-4">
                        <Link href="/" className="inline-flex min-h-11 items-center hover:text-primary transition-colors">الرئيسية</Link>
                        <Link href="/about" className="inline-flex min-h-11 items-center hover:text-primary transition-colors">عن المنصة</Link>
                        <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-primary transition-colors">الشروط والأحكام</Link>
                        <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-primary transition-colors">سياسة الخصوصية</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
