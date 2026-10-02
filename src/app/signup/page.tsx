import Link from "next/link"
import { SignupForm } from "@/components/auth/signup-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SignupPage() {
    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-background">
            {/* Ambient Background Elements */}
            <div className="absolute top-0 right-0 w-full h-full -z-10 overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-[-5%] right-[-5%] w-[45%] h-[45%] rounded-full bg-primary/20 blur-[130px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[130px] animate-pulse" style={{ animationDelay: '1.5s' }} />
            </div>

            <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-[1100px] grid lg:grid-cols-[1fr_1.2fr] bg-card rounded-3xl border shadow-2xl overflow-hidden min-h-[700px]">
                {/* Left Side: Branding & Info */}
                <div className="relative hidden lg:flex flex-col p-12 text-white overflow-hidden bg-primary">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary to-primary/90" />
                    
                    {/* Animated Decorative Shapes */}
                    <div className="absolute -top-10 -left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-20 -right-20 w-56 h-56 bg-white/5 rounded-full blur-2xl" />

                    <div className="relative z-20 flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
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
                        أكاديمية المنارة
                    </div>

                    <div className="relative z-20 mt-auto">
                        <blockquote className="space-y-4">
                            <div className="h-1.5 w-16 bg-white/30 rounded-full" />
                            <p className="text-2xl font-bold leading-tight">
                                انضم لأكبر مجتمع تعليمي متطور وابدأ رحلة تميزك اليوم.
                            </p>
                            <p className="text-white/70 text-lg">
                                نوفر لك كل الأدوات التي تحتاجها للنجاح في مكان واحد آمن ومنظم.
                            </p>
                        </blockquote>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="flex flex-col justify-center p-8 lg:p-12 bg-card overflow-y-auto max-h-[90vh]">
                    <div className="mx-auto w-full max-w-[480px] space-y-8">
                        <div className="space-y-2 text-center lg:text-right">
                            <h1 className="text-3xl font-extrabold tracking-tight">إنشاء حساب جديد</h1>
                            <p className="text-muted-foreground">ابدأ رحلتك التعليمية معنا في خطوات بسيطة</p>
                        </div>

                        <SignupForm />

                        <div className="text-center text-sm space-y-4 pt-4 border-t border-border mt-4">
                            <div>
                                <span className="text-muted-foreground">لديك حساب بالفعل؟ </span>
                                <Link href="/login" className="font-bold text-primary hover:underline underline-offset-4">
                                    تسجيل الدخول الآن
                                </Link>
                            </div>
                            <div className="pt-2 border-t mt-4">
                                <Link href="/help" className="flex items-center justify-center gap-2 text-primary/70 hover:text-primary font-bold transition-colors">
                                    <HelpCircle className="h-4 w-4" />
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

import { HelpCircle } from "lucide-react"
