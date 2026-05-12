import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, BookOpen, Users, ShieldCheck, TrendingUp, MonitorPlay, BarChart, Quote, GraduationCap } from "lucide-react"
import { getSupportSettings } from "@/lib/support-settings"
import { SupportInfo } from "@/components/support-info"

export const dynamic = "force-dynamic"

export default async function LandingPage() {
    const supportSettings = await getSupportSettings()
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background py-20 lg:py-32 min-h-[85vh] flex items-center">
          {/* Animated Interactive Bubbles */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-full w-full opacity-60">
              <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-primary/10 blur-[90px] animate-float" />
              <div className="absolute top-[40%] right-[10%] w-96 h-96 rounded-full bg-primary/15 blur-[100px] animate-float-delayed" />
              <div className="absolute bottom-[20%] left-[15%] w-64 h-64 rounded-full bg-primary/10 blur-[80px] animate-float" style={{ animationDuration: '18s' }} />
              <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
              
              {/* Floating Shape Accents */}
              <div className="absolute top-[20%] left-[10%] h-4 w-4 rounded-full bg-primary/30 animate-pulse" />
              <div className="absolute top-[60%] right-[20%] h-6 w-6 rounded-full bg-primary/20 animate-bounce" style={{ animationDuration: '6s' }} />
          </div>

          <div className="container relative z-10 mx-auto px-4">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold transition-all hover:border-primary/50 mb-8 bg-muted/30 backdrop-blur-sm">
                <span className="text-primary mx-1">خطوتك الأولى:</span>
                نحو تجربة تعليمية أكثر تطوراً وتفاعلية
              </div>
              <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl leading-none">
                بناء العقول، <br/> <span className="text-primary drop-shadow-sm">وصناعة المستقبل</span> معاً
              </h1>
              <p className="mt-8 max-w-2xl text-xl text-muted-foreground sm:text-2xl leading-relaxed font-arabic">
                أكاديمية المنارة تجمع بين أفضل المعلمين وأطمح الطلاب في بيئة رقمية آمنة. نوفر أحدث الأدوات لمتابعة التطور العلمي وتحقيق أعلى الدرجات.
              </p>
              <div className="mt-12 flex flex-wrap justify-center gap-6">
                <Button size="lg" className="h-14 px-10 text-xl font-bold rounded-2xl shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90 text-white" asChild>
                  <Link href="/signup">
                    ابدأ مجاناً الآن ←
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-10 text-xl font-bold rounded-2xl backdrop-blur-sm hover:bg-muted/50 transition-transform hover:scale-105 active:scale-95 border-2" asChild>
                  <Link href="/courses">تصفح الكورسات</Link>
                </Button>
              </div>

              {/* Social Proofs Section */}
              <div className="mt-20 w-full max-w-4xl px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-y md:border-y-0 md:border-x-0 relative">
                  {/* Vertical separators for desktop */}
                  <div className="hidden md:block absolute top-1/2 left-1/3 h-12 w-[1px] bg-border -translate-y-1/2" />
                  <div className="hidden md:block absolute top-1/2 left-2/3 h-12 w-[1px] bg-border -translate-y-1/2" />
                  
                  <div className="flex flex-col items-center">
                    <span className="text-4xl font-black text-foreground mb-1">24/7</span>
                    <span className="text-muted-foreground font-medium">تعلّم في أي وقت</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-4xl font-black text-foreground mb-1">+10</span>
                    <span className="text-muted-foreground font-medium">معلم متميز</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-4xl font-black text-foreground mb-1">+50</span>
                    <span className="text-muted-foreground font-medium">كورس متاح</span>
                  </div>
                </div>

                {/* Join Students Section */}
                <div className="mt-12 flex items-center justify-center gap-4 flex-wrap">
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    <div className="h-10 w-10 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold border-2 border-background shadow-sm ring-1 ring-black/5">م أ</div>
                    <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold border-2 border-background shadow-sm ring-1 ring-black/5">س م</div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold border-2 border-background shadow-sm ring-1 ring-black/5">م ع</div>
                    <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold border-2 border-background shadow-sm ring-1 ring-black/5">أ م</div>
                  </div>
                  <p className="text-muted-foreground font-medium">
                    انضم لـ <span className="text-foreground font-bold">آلاف الطلاب</span> اللي بيتعلموا مع أفضل المعلمين في مصر
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value Proposition for Instructors */}
        <section className="bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary mb-4">لماذا نعتبر الخيار الأول للمصداقية والتطوير؟</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">صممنا المنصة لتريحك من الأعباء التقنية وتركز فقط على الإبداع والدرجة النهائية، بيئة داعمة للطالب والمعلم.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<TrendingUp className="h-10 w-10 text-primary" />}
                title="استقرار وضمان حقوق"
                description="بيئة آمنة تضمن حقوق الطرفين، مع نظام محفظة مالي دقيق يضمن الشفافية والوضوح الدائم في تحديث الأرصدة وإجراء العمليات."
              />
              <FeatureCard
                icon={<MonitorPlay className="h-10 w-10 text-primary" />}
                title="إدارة بسيطة للكورسات"
                description="ارفع الفيديوهات والملخصات، وأنشئ امتحانات مقالية أو حتى اختيار من متعدد لتختبر طلابك بسهولة تامة من لوحة تحكم واحدة."
              />
              <FeatureCard
                icon={<BarChart className="h-10 w-10 text-primary" />}
                title="تقارير لحظية وحية"
                description="تابع أداء كل طالب بدقة، حلل مستوى استيعاب الطلاب ودرجاتهم في الاختبارات عبر تحليلات مفصلة وسهلة القراءة."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-10 w-10 text-primary" />}
                title="أمان تام للفيديوهات"
                description="نظام حماية متطور من المنارة يمنع التحميل وتسجيل الشاشة، مع حقوق ملكية مضمنة تفصلها علامتك المائية المتحركة الخاصة."
              />
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary mb-4">قالوا عن أكاديمية المنارة</h2>
              <p className="mt-4 text-lg text-muted-foreground">آراء بعض المعلمين والطلاب الذين وثقوا في منصتنا</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
                <div className="relative rounded-2xl bg-muted/10 p-8 shadow-[0_0_20px_rgba(0,0,0,0.02)] border hover:border-primary/50 transition-colors">
                    <Quote className="absolute top-4 left-4 h-12 w-12 text-primary/10" />
                    <p className="text-lg leading-relaxed text-muted-foreground mb-8 font-medium italic">
                        "من أفضل المنصات التي تعاملت معها بفضل الشفافية التامة ونظام الأمان الرائع لحماية شروحاتي ومحاضراتي. أصبح التواصل مع الطلاب وتقييم مستواهم أسهل من أي وقت مضى."
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-2xl shadow-inner">م</div>
                        <div>
                            <h4 className="font-bold text-foreground text-lg">أ. محمود سليم</h4>
                            <p className="text-sm text-primary font-medium mt-1">مدرس فيزياء للثانوية العامة</p>
                        </div>
                    </div>
                </div>

                <div className="relative rounded-2xl bg-muted/10 p-8 shadow-[0_0_20px_rgba(0,0,0,0.02)] border hover:border-primary/50 transition-colors">
                    <Quote className="absolute top-4 left-4 h-12 w-12 text-primary/10" />
                    <p className="text-lg leading-relaxed text-muted-foreground mb-8 font-medium italic">
                        "أخيراً منصة منظمة تتيح لي التركيز في المذاكرة! الاختبارات التفاعلية ومتابعة الدرجات ساعدتني جداً في تحسين مستواي بشكل ملحوظ دون تعقيد تقني أو أعطال مستمرة."
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-2xl shadow-inner">ع</div>
                        <div>
                            <h4 className="font-bold text-foreground text-lg">عمر خالد</h4>
                            <p className="text-sm text-primary font-medium mt-1">طالب بالصف الثالث الثانوي</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </section>

        {/* Target Audience Section (Students & Instructors combined) */}
        <section className="bg-primary/5 py-24 border-y border-primary/10">
            <div className="container mx-auto px-4 text-center max-w-3xl">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
                    <GraduationCap className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">هل أنت طالب تبحث عن التميز الأكاديمي؟</h2>
                <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
                    وفرنا لك تجربة تعليمية سلسة، تجمع بين شروحات وافية عبر فيديوهات آمنة وعالية الدقة، مع اختبارات تفاعلية تقيم مستواك أولاً بأول، وتدعم تفوقك للوصول للدرجة النهائية.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button size="lg" className="h-14 px-10 text-lg rounded-full" asChild>
                        <Link href="/courses">ابحث عن كورساتك الآن</Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full" asChild>
                        <Link href="/signup">أنشئ حساب طالب</Link>
                    </Button>
                </div>
            </div>
        </section>

      </main>
      <footer className="border-t bg-muted/20 pb-8 pt-16">
        <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-12">
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
                    <ul className="space-y-3 text-sm text-muted-foreground">
                        <li><Link href="/courses" className="hover:text-primary transition-colors">تصفح الكورسات</Link></li>
                        <li><Link href="/signup" className="hover:text-primary transition-colors">إنشاء حساب جديد</Link></li>
                        <li><Link href="/login" className="hover:text-primary transition-colors">تسجيل الدخول</Link></li>
                        <li><Link href="/about" className="hover:text-primary transition-colors">من نحن</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold mb-4 text-lg">تواصل معنا</h4>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            <SupportInfo type="phone" linkType="tel" className="hover:text-primary transition-colors" />
                        </li>
                        <li className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                            <a href={`mailto:${supportSettings.email}`} className="hover:text-primary transition-colors">{supportSettings.email}</a>
                        </li>
                        <li className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>القاهرة، جمهورية مصر العربية</span>
                        </li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold mb-4 text-lg">ومعلومات المنصة</h4>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                        <li><Link href="/faq" className="hover:text-primary transition-colors">الأسئلة الشائعة</Link></li>
                        <li><Link href="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية</Link></li>
                        <li><Link href="/terms" className="hover:text-primary transition-colors">الشروط والأحكام</Link></li>
                        <li><Link href="/refund" className="hover:text-primary transition-colors">سياسة الاسترجاع</Link></li>
                    </ul>
                </div>
            </div>
            
            <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-muted-foreground text-sm font-medium">
                <p>© {new Date().getFullYear()} أكاديمية المنارة. جميع الحقوق محفوظة.</p>
                <div className="flex gap-4">
                    <Link href="/terms" className="hover:text-primary transition-colors">الشروط والأحكام</Link>
                    <Link href="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية</Link>
                    <Link href="/refund" className="hover:text-primary transition-colors">سياسة الاسترجاع</Link>
                </div>
            </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-2 hover:border-primary/50 relative overflow-hidden">
      <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
      <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
          {icon}
      </div>
      <h3 className="mb-3 text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}
