"use client"

import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { 
    ArrowRight, 
    CheckCircle2, 
    ChevronLeft, 
    UserPlus, 
    Wallet, 
    ShoppingBag, 
    PlayCircle,
    Info,
    ShieldCheck
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const GUIDES_CONTENT: Record<string, any> = {
    "student-signup": {
        title: "كيفية إنشاء حساب كطالب",
        icon: UserPlus,
        image: "/real-signup-student.png?v=1",
        steps: [
            "قم بالضغط على رابط 'تحتاج مساعدة؟' في صفحة الدخول أو اضغط 'ابدأ الآن'.",
            "في صفحة التسجيل، تأكد أن نوع الحساب المختار هو 'طالب'.",
            "قم بملء البيانات (الاسم، الجيميل، الهاتف، السنة الدراسية).",
            "أدخل رقم هاتف ولي الأمر للتواصل عند الضرورة.",
            "وافق على الشروط والسياسات ثم اضغط 'إنشاء حساب'.",
            "ستنتقل لصفحة قيد المراجعة حتى يقوم الأدمن بتفعيل حسابك."
        ],
        note: "تأكد من كتابة رقم الهاتف بشكل صحيح لضمان تواصل الإدارة معك بنجاح."
    },
    "instructor-signup": {
        title: "كيفية إنشاء حساب كمدرس",
        icon: UserPlus,
        image: "/real-signup-instructor.png?v=1",
        steps: [
            "في صفحة التسجيل، قم بتغيير نوع الحساب إلى 'مدرس'.",
            "ستظهر لك حقول إضافية مثل 'التخصص' و'الخبرة'.",
            "أدخل تخصصك العلمي (مثل: فيزياء، كيمياء، لغة عربية).",
            "اكتب نبذة مختصرة عن مسيرتك التعليمية لتظهر للطلاب بمجرد قبولك.",
            "بعد إرسال الطلب، سيقوم فريق المنارة بمراجعة بياناتك وتفعيل صلاحيات المدرس لك."
        ],
        note: "يرجى كتابة نبذة مهنية جذابة لأنها أول ما يراه الطالب عند تصفح كورساتك."
    },
    "login-guide": { // New Guide
        title: "كيفية تسجيل الدخول للمنصة",
        icon: ShieldCheck,
        image: "/real-login.png?v=1",
        steps: [
            "توجه لصفحة تسجيل الدخول من القائمة العلوية.",
            "أدخل بريد Gmail الخاص بك الذي سجلت به مسبقاً.",
            "أدخل كلمة المرور الخاصة بك بعناية.",
            "اضغط على زر 'تسجيل الدخول' للدخول للوحة التحكم مباشرة.",
            "إذا نسيت كلمة المرور، يمكنك التواصل مع الدعم الفني لاستعادتها."
        ],
        note: "تذكر أنه لا يمكنك الدخول من أكثر من جهازين في نفس الوقت لحماية خصوصية حسابك."
    },
    "wallet-recharge": {
        title: "كيفية شحن المحفظة",
        icon: Wallet,
        image: "/real-wallet-1.png?v=1",
        steps: [
            "ادخل إلى قسم 'المحفظة' من لوحة التحكم الخاصة بك.",
            "قم بالتحويل للمبلغ المطلوب عبر فودافون كاش أو إنستا باي.",
            "ارفع صورة السكرين شوت الخاصة بعملية التحويل الناجحة.",
            "اكتب رقم الموبايل الذي قمت بالتحويل منه لسرعة التأكد.",
            "سيقوم الأدمن بمراجعة الطلب وشحن رصيدك خلال دقائق."
        ],
        note: "يتم تحديث الرصيد يدوياً من قبل الإدارة بعد التأكد من صورة التحويل."
    },
    "buy-course": {
        title: "كيفية شراء كورس",
        icon: ShoppingBag,
        image: "/real-buy-course.png?v=1",
        steps: [
            "تصفح الكورسات المتاحة في صفحة 'تصفح الكورسات'.",
            "اضغط على الكورس المطلوب لمشاهدة تفاصيله.",
            "تأكد من وجود رصيد كافٍ في محفظتك يغطي سعر الكورس.",
            "اضغط على 'الالتحاق بالكورس الآن' ليتم خصم المبلغ وتفعيل الكورس فوراً."
        ],
        note: "بمجرد شراء الكورس وبدء المشاهدة، لا يمكن استرجاع المبلغ المدفوع."
    },
    "watch-course": {
        title: "كيفية مشاهدة الكورسات",
        icon: PlayCircle,
        image: "/real-watch-course.png?v=1",
        steps: [
            "بعد الشراء، توجه للكورس من لوحة التحكم واضغط 'دخول الكورس'.",
            "ستظهر لك قائمة الدروس والوحدات على الجانب.",
            "اضغط على الدرس المراد البدء به ليظهر لك مشغل الفيديوهات.",
            "يمكنك متابعة التقدم الخاص بك ورؤية الدروس التي اكتملت."
        ],
        note: "المحتوى مؤمن تماماً ضد السرقة أو التسجيل لضمان حقوق المعلم والمنصة."
    }
}

export default function GuideDetailPage() {
    const { slug } = useParams()
    const router = useRouter()
    const guide = GUIDES_CONTENT[slug as string]

    if (!guide) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center font-arabic">
                <h1 className="text-2xl font-bold">عذراً، هذا الدليل غير موجود</h1>
                <Button onClick={() => router.push("/help")} className="mt-4">العودة لمركز المساعدة</Button>
            </div>
        )
    }

    const Icon = guide.icon

    return (
        <div className="flex min-h-screen flex-col bg-muted/10 font-arabic">
            <Navbar />
            <main className="flex-1 container py-12 pb-32">
                <div className="max-w-4xl mx-auto space-y-10">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-8">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <Icon className="h-7 w-7 text-primary" />
                            </div>
                            <h1 className="text-3xl font-black">{guide.title}</h1>
                        </div>
                        <Button variant="outline" asChild className="rounded-xl border-2 font-bold px-6">
                            <Link href="/help" className="flex items-center gap-2">
                                <ArrowRight className="h-4 w-4" />
                                العودة للمساعدة
                            </Link>
                        </Button>
                    </div>

                    {/* Image Section */}
                    <Card className="overflow-hidden border-2 shadow-2xl rounded-3xl group">
                        <CardContent className="p-0 relative aspect-video">
                            {/* Mock path using the generated image ID - In real app, these are static files */}
                            <img 
                                src={guide.image} 
                                alt={guide.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                        </CardContent>
                    </Card>

                    {/* Content Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="md:col-span-2 space-y-6">
                            <h2 className="text-2xl font-bold border-r-4 border-primary pr-4">الخطوات بالتفصيل:</h2>
                            <div className="space-y-4">
                                {guide.steps.map((step: string, index: number) => (
                                    <div key={index} className="flex items-start gap-4 p-5 bg-white rounded-2xl border-2 hover:border-primary/30 transition-all group">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                                            {index + 1}
                                        </div>
                                        <p className="text-lg font-medium leading-relaxed">{step}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <Card className="bg-amber-500/5 border-2 border-amber-500/20 rounded-3xl">
                                <CardContent className="p-8 space-y-4">
                                    <h3 className="text-xl font-bold text-amber-700 flex items-center gap-2">
                                        <Info className="h-5 w-5" />
                                        ملاحظة هامة
                                    </h3>
                                    <p className="text-amber-800/80 leading-relaxed font-bold italic">
                                        "{guide.note}"
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-primary border-none rounded-3xl shadow-xl text-primary-foreground">
                                <CardContent className="p-8 space-y-4 text-center">
                                    <CheckCircle2 className="h-10 w-10 mx-auto opacity-50" />
                                    <h3 className="text-lg font-bold">هل انتهيت من التعلم؟</h3>
                                    <p className="text-xs opacity-80 font-medium">ابدأ الآن في تطبيق ما تعلمته على المنصة.</p>
                                    <Button variant="secondary" asChild className="w-full rounded-xl font-bold py-6">
                                        <Link href="/dashboard">اذهب للوحة التحكم</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
