import { Navbar } from "@/components/navbar"
// Footer is missing in this project
import { 
    UserPlus, 
    Wallet, 
    ShoppingBag, 
    PlayCircle, 
    HelpCircle,
    ArrowLeft,
    CheckCircle2,
    ShieldCheck
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

const GUIDES = [
    {
        title: "كيفية تسجيل الدخول",
        slug: "login-guide",
        icon: ShieldCheck,
        description: "دليل سريع لكيفية الوصول لحسابك الشخصي في ثوانٍ."
    },
    {
        title: "كيفية إنشاء حساب كطالب",
        slug: "student-signup",
        icon: UserPlus,
        description: "دليل خطوة بخطوة للبدء في رحلتك التعليمية كطالب."
    },
    {
        title: "كيفية إنشاء حساب كمدرس",
        slug: "instructor-signup",
        icon: ShieldCheck,
        description: "انضم إلينا كخبير تعليمي وابدأ في بناء أكاديميتك الخاصة."
    },
    {
        title: "كيفية شحن المحفظة",
        slug: "wallet-recharge",
        icon: Wallet,
        description: "تعرف على طرق الدفع المتاحة وكيفية تفعيل رصيدك."
    },
    {
        title: "كيفية شراء كورس",
        slug: "buy-course",
        icon: ShoppingBag,
        description: "طريقة اختيار الكورسات والاشتراك فيها من رصيد محفظتك."
    },
    {
        title: "كيفية مشاهدة الكورسات",
        slug: "watch-course",
        icon: PlayCircle,
        description: "دليل استخدام مشغل الفيديوهات والوصول للمحتوى التعليمي."
    }
]

export default function HelpCenterPage() {
    return (
        <div className="flex min-h-screen flex-col bg-muted/10 font-arabic">
            <Navbar />
            <main className="flex-1 container py-16 pb-32">
                <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <HelpCircle className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight">مركز المساعدة والدعم</h1>
                    <p className="text-muted-foreground text-lg italic">هنا ستجد كل ما تحتاجه للتعامل مع المنصة باحترافية وسهولة.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {GUIDES.map((guide) => (
                        <Link key={guide.slug} href={`/help/${guide.slug}`}>
                            <Card className="group hover:border-primary/50 transition-all cursor-pointer border-2 shadow-sm hover:shadow-xl hover:-translate-y-1 h-full">
                                <CardContent className="p-8 pt-10 text-center space-y-4">
                                    <div className="h-14 w-14 bg-muted rounded-2xl flex items-center justify-center mx-auto group-hover:bg-primary/10 transition-colors">
                                        <guide.icon className="h-7 w-7 group-hover:text-primary transition-colors text-muted-foreground" />
                                    </div>
                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{guide.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{guide.description}</p>
                                    <div className="pt-4 flex items-center justify-center text-primary text-xs font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span>عرض الدليل كاملاً</span>
                                        <ArrowLeft className="h-3 w-3" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                <div className="mt-24 p-10 bg-primary rounded-3xl text-primary-foreground text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <h2 className="text-3xl font-black">ما زلت بحاجة للمساعدة؟</h2>
                    <p className="opacity-90 max-w-xl mx-auto font-medium leading-relaxed">فريق الدعم الفني جاهز للرد على استفساراتكم عبر الواتساب على مدار الساعة.</p>
                    <div className="pt-4">
                        <Link href="https://wa.me/201017333215" target="_blank">
                            <button className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/90 transition-all shadow-lg active:scale-95">
                                تواصل معنا الآن
                            </button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}
