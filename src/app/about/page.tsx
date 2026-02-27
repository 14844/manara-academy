import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GraduationCap, Users, Shield, Target, Award, Rocket } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
    return (
        <div className="flex min-h-screen flex-col font-arabic">
            <Navbar />
            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative py-20 overflow-hidden bg-primary/5">
                    <div className="container relative z-10 text-center space-y-6">
                        <GraduationCap className="h-16 w-16 text-primary mx-auto mb-4" />
                        <h1 className="text-4xl md:text-6xl font-black text-foreground leading-tight">
                            بوابتك نحو <span className="text-primary">مستقبل تعليمي</span> أفضل
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                            أكاديمية المنارة هي منصة تعليمية رائدة تهدف إلى تمكين المعلمين والطلاب في الوطن العربي من خلال أدوات تعليمية ذكية وتجربة مستخدم فريدة.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4 pt-4">
                            <Button size="lg" className="rounded-full px-8" asChild>
                                <Link href="/courses">تصفح الكورسات</Link>
                            </Button>
                            <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                                <Link href="/signup">انضم إلينا كمعلم</Link>
                            </Button>
                        </div>
                    </div>
                    {/* Decorative blobs */}
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />
                </section>

                {/* Mission & Vision */}
                <section className="py-24 container">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-bold">
                                <Target className="h-4 w-4" />
                                رسالتنا
                            </div>
                            <h2 className="text-3xl font-bold leading-snug">
                                نحن نؤمن أن التعليم هو حجر الأساس لأي نجاح حقيقي
                            </h2>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                نسعى في أكاديمية المنارة إلى كسر الحواجز التقليدية للتعليم وتوفير بيئة رقمية آمنة ومتطورة تتيح للمعلم إيصال علمه بكل سهولة، وللطالب الحصول على المعرفة بأعلى جودة وبأقل التكاليف.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    "توفير محتوى تعليمي متنوع لجميع المراحل الدراسية.",
                                    "حماية حقوق الملكية الفكرية للمعلمين عبر تقنيات أمان متطورة.",
                                    "دعم الطلاب بأدوات تتبع التقدم والشهادات المعتمدة."
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 font-medium">
                                        <Award className="h-5 w-5 text-primary" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-none">
                                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                                    <Users className="h-10 w-10 text-primary" />
                                    <div className="text-2xl font-bold">+١٠,٠٠٠</div>
                                    <div className="text-sm text-muted-foreground">طالب نشط</div>
                                </CardContent>
                            </Card>
                            <Card className="mt-8 bg-gradient-to-br from-primary/20 to-transparent border-none">
                                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                                    <Rocket className="h-10 w-10 text-primary" />
                                    <div className="text-2xl font-bold">+٥٠٠</div>
                                    <div className="text-sm text-muted-foreground">كورس تدريبي</div>
                                </CardContent>
                            </Card>
                            <Card className="-mt-8 bg-gradient-to-br from-primary/20 to-transparent border-none">
                                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                                    <Award className="h-10 w-10 text-primary" />
                                    <div className="text-2xl font-bold">+١٠٠</div>
                                    <div className="text-sm text-muted-foreground">معلم متميز</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-none">
                                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                                    <Shield className="h-10 w-10 text-primary" />
                                    <div className="text-2xl font-bold">١٠٠٪</div>
                                    <div className="text-sm text-muted-foreground">حماية وأمان</div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>

                {/* Values Section */}
                <section className="py-24 bg-muted/30">
                    <div className="container text-center space-y-12">
                        <div className="space-y-4">
                            <h2 className="text-3xl font-bold">لماذا تختار أكاديمية المنارة؟</h2>
                            <p className="text-muted-foreground max-w-2xl mx-auto">
                                نحن نجمع بين التكنولوجيا والتعليم لنقدم تجربة لا تضاهى لكل من المعلم والطالب.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8 text-right underline-offset-4">
                            {[
                                {
                                    title: "سهولة الاستخدام",
                                    desc: "واجهة مستخدم عربية بسيطة وسلسة تتيح لك الوصول لكل ميزات المنصة بضغطة واحدة.",
                                    icon: Rocket
                                },
                                {
                                    title: "أمان المحتوى",
                                    desc: "نستخدم تقنيات متطورة لحماية فيديوهاتك من السرقة والتصوير، مع إضافة علامة مائية ديناميكية.",
                                    icon: Shield
                                },
                                {
                                    title: "دعم فني متواصل",
                                    desc: "فريق دعم مخصص لمساعدتك في أي وقت لحل المشكلات التقنية أو الرد على الاستفسارات.",
                                    icon: Users
                                }
                            ].map((value, i) => (
                                <div key={i} className="p-8 bg-background rounded-2xl shadow-sm border border-muted/60 space-y-4 hover:border-primary/40 transition-colors">
                                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-2">
                                        <value.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-xl font-bold">{value.title}</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {value.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
