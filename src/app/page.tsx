import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
    ArrowLeft,
    BarChart,
    ClipboardCheck,
    FlaskConical,
    GraduationCap,
    MonitorPlay,
    ShieldCheck,
    UserPlus,
    Wallet,
    Presentation,
} from "lucide-react"
import { getSupportSettings } from "@/lib/support-settings"
import { SupportInfo } from "@/components/support-info"
import { getPublicStats, STAT_THRESHOLDS, type PublicStats } from "@/components/landing/public-stats"

export const dynamic = "force-dynamic"

type HeroStat = { value?: string; icon?: React.ReactNode; label: string }

/**
 * Only real numbers, and only when they are meaningful. Remaining slots are filled
 * with non-numeric value props so we never show an invented or embarrassing number.
 */
function buildHeroStats(stats: PublicStats | null): HeroStat[] {
    const fmt = (n: number) => n.toLocaleString("en-US")
    const items: HeroStat[] = [{ value: "24/7", label: "تعلّم في أي وقت" }]

    if (stats) {
        if (stats.coursesCount >= STAT_THRESHOLDS.courses) {
            items.push({ value: fmt(stats.coursesCount), label: "كورس منشور" })
        }
        if (stats.instructorsCount >= STAT_THRESHOLDS.instructors) {
            items.push({ value: fmt(stats.instructorsCount), label: "مدرس على المنصة" })
        }
        if (stats.enrollmentsCount >= STAT_THRESHOLDS.enrollments) {
            items.push({ value: fmt(stats.enrollmentsCount), label: "اشتراك في الكورسات" })
        }
    }

    const fallbacks: HeroStat[] = [
        { icon: <ShieldCheck className="h-8 w-8 sm:h-9 sm:w-9 text-primary" />, label: "حماية الفيديوهات" },
        { icon: <ClipboardCheck className="h-8 w-8 sm:h-9 sm:w-9 text-primary" />, label: "اختبارات تفاعلية" },
    ]
    for (const f of fallbacks) {
        if (items.length >= 3) break
        items.push(f)
    }
    return items.slice(0, 3)
}

export default async function LandingPage() {
    const [supportSettings, stats] = await Promise.all([getSupportSettings(), getPublicStats()])
    const heroStats = buildHeroStats(stats)

    return (
        <div className="flex min-h-screen flex-col overflow-x-clip">
            <Navbar />
            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative py-12 sm:py-20 lg:py-28 lg:min-h-[80vh] flex items-center">
                    <div className="container relative z-10 mx-auto">
                        <div className="flex flex-col items-center text-center">
                            <div className="inline-flex items-center rounded-full border border-primary/20 px-4 py-1.5 text-xs sm:text-sm font-semibold mb-6 sm:mb-8 glass shadow-sm">
                                <span className="text-primary mx-1">خطوتك الأولى:</span>
                                نحو تجربة تعليمية أكثر تطوراً وتفاعلية
                            </div>
                            <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-tight sm:leading-none">
                                بناء العقول، <br /> <span className="text-primary drop-shadow-sm bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">وصناعة المستقبل</span> معاً
                            </h1>
                            <p className="mt-6 sm:mt-8 max-w-2xl text-lg text-muted-foreground sm:text-2xl leading-relaxed font-arabic">
                                أكاديمية المنارة بتجمع المدرس والطالب في بيئة رقمية آمنة: شرح بالفيديو، امتحانات تفاعلية، ومتابعة لمستواك أولاً بأول.
                            </p>
                            <div className="mt-8 sm:mt-12 flex w-full flex-col sm:w-auto sm:flex-row justify-center gap-3 sm:gap-6">
                                <Button size="lg" className="h-14 w-full sm:w-auto px-10 text-lg sm:text-xl font-bold rounded-2xl shadow-xl shadow-primary/20" asChild>
                                    <Link href="/signup">ابدأ مجاناً الآن ←</Link>
                                </Button>
                                <Button size="lg" variant="outline" className="h-14 w-full sm:w-auto px-10 text-lg sm:text-xl font-bold rounded-2xl glass hover:bg-primary/5 border-primary/20" asChild>
                                    <Link href="/courses">تصفح الكورسات</Link>
                                </Button>
                            </div>

                            {/* Real stats (or honest value props) */}
                            <div className="mt-12 sm:mt-20 w-full max-w-4xl">
                                <div className="grid grid-cols-3 py-5 sm:py-8 glass rounded-3xl border border-white/20 shadow-lg [&>*:not(:first-child)]:border-s [&>*]:border-border/50">
                                    {heroStats.map((item) => (
                                        <div key={item.label} className="flex flex-col items-center justify-center gap-1 px-2">
                                            {item.value ? (
                                                <span className="text-2xl sm:text-4xl font-black text-foreground leading-none h-8 sm:h-10 flex items-center" dir="ltr">
                                                    {item.value}
                                                </span>
                                            ) : (
                                                <span className="h-8 sm:h-10 flex items-center" aria-hidden="true">{item.icon}</span>
                                            )}
                                            <span className="text-muted-foreground font-medium text-xs sm:text-base leading-snug">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Why Manara — student-focused features */}
                <section className="py-16 sm:py-24 relative">
                    <div className="container mx-auto relative z-10">
                        <div className="mb-10 sm:mb-16 text-center">
                            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl text-primary mb-4">ليه تذاكر على المنارة؟</h2>
                            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                                كل اللي محتاجه عشان تفهم وتراجع وتعرف مستواك — في مكان واحد ومن موبايلك.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            <FeatureCard
                                icon={<MonitorPlay className="h-8 w-8 text-primary" />}
                                title="شرح بالفيديو في وقتك"
                                description="اتفرّج على دروس كورساتك من الموبايل أو الكمبيوتر في الوقت اللي يناسبك، بفيديوهات محمية ضد التحميل."
                            />
                            <FeatureCard
                                icon={<ClipboardCheck className="h-8 w-8 text-primary" />}
                                title="امتحانات تفاعلية"
                                description="اختبارات اختيار من متعدد ومقالية مع الدروس، تعرّفك مستواك أولاً بأول وتوريك محتاج تراجع إيه."
                            />
                            <FeatureCard
                                icon={<BarChart className="h-8 w-8 text-primary" />}
                                title="متابعة لولي الأمر"
                                description="المدرس يقدر يبعت لولي أمرك تقرير بمستواك ودرجاتك في الامتحانات، عشان الكل يبقى متابع."
                            />
                            <FeatureCard
                                icon={<FlaskConical className="h-8 w-8 text-primary" />}
                                title="مختبرات افتراضية"
                                description="جرّب تجارب الكيمياء والفيزياء والرياضيات بشكل تفاعلي بدل ما تحفظها من الكتاب."
                                href="/labs"
                            />
                        </div>
                    </div>
                </section>

                {/* How to start — 3 honest steps */}
                <section className="py-16 sm:py-24">
                    <div className="container mx-auto">
                        <div className="mb-10 sm:mb-16 text-center">
                            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl text-primary mb-4">إزاي تبدأ؟</h2>
                            <p className="mt-4 text-base sm:text-lg text-muted-foreground">3 خطوات بسيطة وتبدأ تذاكر</p>
                        </div>
                        <ol className="grid gap-4 sm:gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                            <StepCard
                                step={1}
                                icon={<UserPlus className="h-7 w-7 text-primary" />}
                                title="أنشئ حسابك"
                                description="سجّل ببياناتك واختار صفك الدراسي. حسابك بيتراجع ويتفعّل من فريق المنارة."
                            />
                            <StepCard
                                step={2}
                                icon={<Wallet className="h-7 w-7 text-primary" />}
                                title="اشحن محفظتك واشترك"
                                description="اشحن رصيد محفظتك، واختار الكورس اللي محتاجه واشترك فيه مباشرة."
                            />
                            <StepCard
                                step={3}
                                icon={<GraduationCap className="h-7 w-7 text-primary" />}
                                title="ذاكر وامتحن"
                                description="اتفرج على الدروس، حل الامتحانات، وتابع درجاتك من لوحة التحكم بتاعتك."
                            />
                        </ol>
                        <div className="mt-10 flex justify-center">
                            <Button size="lg" className="h-12 w-full sm:w-auto px-8 text-base font-bold rounded-2xl" asChild>
                                <Link href="/signup">أنشئ حساب طالب</Link>
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Student CTA */}
                <section className="py-12 sm:py-20">
                    <div className="container mx-auto">
                        <div className="text-center max-w-3xl mx-auto glass p-6 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 -z-10" />
                            <div className="inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl glass mb-6">
                                <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl mb-4 sm:mb-6">هل أنت طالب تبحث عن التميز الأكاديمي؟</h2>
                            <p className="text-base sm:text-lg text-muted-foreground mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto">
                                شروحات وافية عبر فيديوهات آمنة، مع اختبارات تفاعلية تقيّم مستواك أولاً بأول وتساعدك توصل للدرجة النهائية.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                                <Button size="lg" className="h-14 px-10 text-lg rounded-2xl" asChild>
                                    <Link href="/courses">ابحث عن كورساتك الآن</Link>
                                </Button>
                                <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-2xl glass border-primary/20" asChild>
                                    <Link href="/signup">أنشئ حساب طالب</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Teacher teaser → /teach */}
                <section className="pb-16 sm:pb-24">
                    <div className="container mx-auto">
                        <div className="max-w-5xl mx-auto rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
                            <div className="flex items-start gap-4">
                                <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl glass flex items-center justify-center">
                                    <Presentation className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold mb-2">أنت مدرس؟</h2>
                                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                                        ارفع كورساتك وامتحاناتك، واحمي فيديوهاتك بعلامة مائية، وتابع طلابك وأرباحك من لوحة تحكم واحدة.
                                    </p>
                                </div>
                            </div>
                            <Button size="lg" variant="outline" className="h-12 w-full md:w-auto px-6 font-bold rounded-2xl border-primary/30 shrink-0 gap-2" asChild>
                                <Link href="/teach">
                                    اعرف أكتر عن التدريس
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="border-t bg-background pb-8 pt-12 sm:pt-16 relative">
                <div className="container mx-auto relative z-10">
                    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <GraduationCap className="h-8 w-8 text-primary shrink-0" />
                                <span className="font-bold text-xl">أكاديمية المنارة</span>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                                رؤيتنا هي بناء بيئة تعليمية رقمية تجمع بين التكنولوجيا الحديثة وأفضل الكفاءات التعليمية لتقديم محتوى هادف وبنّاء للطلاب.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4 text-lg">روابط هامة</h4>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                                <FooterLink href="/courses">تصفح الكورسات</FooterLink>
                                <FooterLink href="/teach">للمدرسين</FooterLink>
                                <FooterLink href="/signup">إنشاء حساب جديد</FooterLink>
                                <FooterLink href="/login">تسجيل الدخول</FooterLink>
                                <FooterLink href="/about">عن المنصة</FooterLink>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4 text-lg">تواصل معنا</h4>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <SupportInfo type="phone" linkType="tel" className="hover:text-primary transition-colors" />
                                </li>
                                <li className="flex items-center gap-2 min-w-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                                    <a href={`mailto:${supportSettings.email}`} className="hover:text-primary transition-colors break-all">{supportSettings.email}</a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    <span>القاهرة، جمهورية مصر العربية</span>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4 text-lg">ومعلومات المنصة</h4>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                                <FooterLink href="/help">مركز المساعدة</FooterLink>
                                <FooterLink href="/faq">الأسئلة الشائعة</FooterLink>
                                <FooterLink href="/privacy">سياسة الخصوصية</FooterLink>
                                <FooterLink href="/terms">الشروط والأحكام</FooterLink>
                                <FooterLink href="/refund">سياسة الاسترجاع</FooterLink>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-muted-foreground text-sm font-medium text-center">
                        <p>© {new Date().getFullYear()} أكاديمية المنارة. جميع الحقوق محفوظة.</p>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                            <Link href="/terms" className="hover:text-primary transition-colors py-2">الشروط والأحكام</Link>
                            <Link href="/privacy" className="hover:text-primary transition-colors py-2">سياسة الخصوصية</Link>
                            <Link href="/refund" className="hover:text-primary transition-colors py-2">سياسة الاسترجاع</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <li>
            <Link href={href} className="inline-flex min-h-11 items-center hover:text-primary transition-colors">
                {children}
            </Link>
        </li>
    )
}

function FeatureCard({ icon, title, description, href }: { icon: React.ReactNode; title: string; description: string; href?: string }) {
    const content = (
        <>
            <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-bl-full -z-10 transition-transform motion-safe:group-hover:scale-150 motion-reduce:transition-none" />
            <div className="mb-5 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl glass group-hover:bg-primary/20 transition-colors shadow-sm">
                {icon}
            </div>
            <h3 className="mb-2 sm:mb-3 text-lg sm:text-xl font-bold">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            {href && (
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
                    جرّبها الآن
                    <ArrowLeft className="h-4 w-4" />
                </span>
            )}
        </>
    )
    const className = "group glass-card p-6 sm:p-8 relative overflow-hidden motion-reduce:transition-none motion-reduce:hover:transform-none block"
    return href ? (
        <Link href={href} className={className}>{content}</Link>
    ) : (
        <div className={className}>{content}</div>
    )
}

function StepCard({ step, icon, title, description }: { step: number; icon: React.ReactNode; title: string; description: string }) {
    return (
        <li className="glass-card p-6 sm:p-8 relative overflow-hidden motion-reduce:transition-none motion-reduce:hover:transform-none">
            <span className="absolute top-4 left-5 text-5xl font-black text-primary/10 select-none" aria-hidden="true">{step}</span>
            <div className="mb-4 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl glass shadow-sm">
                {icon}
            </div>
            <h3 className="mb-2 text-lg sm:text-xl font-bold">
                <span className="sr-only">الخطوة {step}: </span>
                {title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        </li>
    )
}
