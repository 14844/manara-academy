import Link from "next/link"
import { SignupForm } from "@/components/auth/signup-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { HelpCircle } from "lucide-react"

export default function SignupPage() {
    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 lg:p-8 py-8 sm:py-12 bg-background font-arabic">
            {/* Ambient Background Elements */}
            <div className="absolute top-0 right-0 w-full h-full -z-10 overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-[-5%] right-[-5%] w-[45%] h-[45%] rounded-full bg-primary/20 blur-[130px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[130px] animate-pulse" style={{ animationDelay: '1.5s' }} />
            </div>

            <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-[1150px] grid lg:grid-cols-[1fr_1.35fr] bg-card rounded-3xl border shadow-2xl my-auto overflow-hidden">
                {/* Left Side: Branding & Info */}
                <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 text-white overflow-hidden bg-primary min-h-[580px]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary to-primary/90" />
                    
                    {/* Animated Decorative Shapes */}
                    <div className="absolute -top-10 -left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-20 -right-20 w-56 h-56 bg-white/5 rounded-full blur-2xl" />

                    <div className="relative z-20 flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                        <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6 text-white"
                            >
                                <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                            </svg>
                        </div>
                        <span>أكاديمية المنارة</span>
                    </div>

                    <div className="relative z-20 my-auto py-8">
                        <blockquote className="space-y-4">
                            <div className="h-1.5 w-16 bg-white/40 rounded-full" />
                            <h2 className="text-3xl font-black leading-tight text-white drop-shadow-sm">
                                انضم لأكبر مجتمع تعليمي متطور وابدأ رحلة تميزك اليوم.
                            </h2>
                            <p className="text-white/80 text-base leading-relaxed">
                                نوفر لك كل الأدوات التي تحتاجها للنجاح في مكان واحد آمن ومنظم، مع متابعة مستمرة وتقارير دورية.
                            </p>
                        </blockquote>
                    </div>

                    <div className="relative z-20 pt-4 border-t border-white/20 text-xs text-white/70 flex items-center justify-between">
                        <span>منصة تعليمية معتمدة ومؤمنة</span>
                        <span>جميع الحقوق محفوظة © 2026</span>
                    </div>
                </div>

                {/* Right Side: Form Container */}
                <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10 bg-card">
                    <div className="mx-auto w-full max-w-[580px] space-y-6">
                        <div className="space-y-1.5 text-center lg:text-right">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">إنشاء حساب جديد</h1>
                            <p className="text-muted-foreground text-xs sm:text-sm">ابدأ رحلتك التعليمية معنا في خطوات بسيطة وسريعة</p>
                        </div>

                        <SignupForm />

                        <div className="text-center text-xs sm:text-sm space-y-3 pt-3 border-t border-border mt-3">
                            <div>
                                <span className="text-muted-foreground">لديك حساب بالفعل؟ </span>
                                <Link href="/login" className="font-bold text-primary hover:underline underline-offset-4">
                                    تسجيل الدخول الآن
                                </Link>
                            </div>
                            <div className="pt-2 border-t mt-2">
                                <Link href="/help" className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-bold transition-colors">
                                    <HelpCircle className="h-3.5 w-3.5" />
                                    تحتاج مساعدة؟ شير لدليل الاستخدام
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
