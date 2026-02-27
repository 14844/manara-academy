import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, BookOpen, Users, Award, ShieldCheck } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background py-20 lg:py-32">
          <div className="container relative z-10 mx-auto px-4">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mb-8 bg-muted/50">
                <span className="text-primary ml-1 font-semibold">جديد:</span>
                تحديثات نظام الاختبارات أصبحت متاحة الآن
              </div>
              <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                مستقبلك في التعلم يبدأ من <span className="text-primary">أكاديمية المنارة</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                المنصة التعليمية الأحدث لربط أفضل المدرسين بطلابهم. دروس تفاعلية، اختبارات، وشهادات معتمدة في مكان واحد.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Button size="lg" className="h-12 px-8 text-lg" asChild>
                  <Link href="/signup">
                    ابدأ رحلتك الآن
                    <ArrowLeft className="mr-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-lg" asChild>
                  <Link href="/courses">تصفح الكورسات</Link>
                </Button>
              </div>
              <div className="mt-16 flex items-center justify-center gap-8 text-muted-foreground grayscale opacity-70">
                {/* Simulated Partner Logos */}
                <div className="text-xl font-bold">كلية الهندسة</div>
                <div className="text-xl font-bold">أكاديمية المعرفة</div>
                <div className="text-xl font-bold">مدرسة النجاح</div>
              </div>
            </div>
          </div>
          {/* Background Gradient Ornaments */}
          <div className="absolute top-0 -z-10 h-full w-full opacity-30 dark:opacity-10">
            <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[120px]" />
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">لماذا تختار المنارة أكاديمية؟</h2>
              <p className="mt-4 text-lg text-muted-foreground">نقدم لك كل ما تحتاجه لتجربة تعليمية ناجحة ومتطورة</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<BookOpen className="h-10 w-10 text-primary" />}
                title="محتوى غني"
                description="آلاف الدروس والمحاضرات المصورة في مختلف المجالات الدراسية."
              />
              <FeatureCard
                icon={<Users className="h-10 w-10 text-primary" />}
                title="أفضل المدرسين"
                description="نخبة من أفضل المدرسين المعتمدين بخبرات سنوات طويلة."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-10 w-10 text-primary" />}
                title="أمان وحماية"
                description="حماية كاملة للمحتوى من التجسس أو التحميل غير القانوني."
              />
              <FeatureCard
                icon={<Award className="h-10 w-10 text-primary" />}
                title="شهادات معتمدة"
                description="احصل علي شهادة إتمام عند نهاية كل كورس لتعزيز مسيرتك."
              />
            </div>
          </div>
        </section>

        {/* Subjects & Services Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary">المواد والخدمات التي نقدمها</h2>
              <p className="mt-4 text-lg text-muted-foreground">تغطية شاملة لمناهجك الدراسية بأحدث الوسائل التعليمية</p>
            </div>

            <div className="grid gap-12 md:grid-cols-2">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold border-r-4 border-primary pr-4">أهم المواد الدراسية</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    "اللغة العربية", "الرياضيات", "اللغة الإنجليزية",
                    "الفيزياء", "الكيمياء", "العلوم"
                  ].map((subject) => (
                    <div key={subject} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-bold">{subject}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-bold border-r-4 border-primary pr-4">خدماتنا التعليمية</h3>
                <div className="space-y-4">
                  {[
                    { title: "محاضرات فيديو", desc: "بجودة عالية وحماية كاملة" },
                    { title: "اختبارات تفاعلية", desc: "تقييم فوري لمستواك بعد كل درس" },
                    { title: "متابعة دورية", desc: "تقارير أداء للطلاب وأولياء الأمور" },
                    { title: "نتائج موثقة", desc: "شهادات إتمام للكورسات والبرامج" }
                  ].map((service) => (
                    <div key={service.title} className="flex gap-4 p-4 border rounded-xl hover:border-primary/50 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold">{service.title}</h4>
                        <p className="text-xs text-muted-foreground">{service.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} أكاديمية المنارة. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
      <div className="mb-4">{icon}</div>
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}
