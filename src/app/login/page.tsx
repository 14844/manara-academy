import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-background">
            {/* Ambient Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-[1000px] grid lg:grid-cols-2 bg-card rounded-3xl border shadow-2xl overflow-hidden min-h-[600px]">
                {/* Left Side: Branding & Info */}
                <div className="relative hidden lg:flex flex-col p-12 text-white overflow-hidden bg-primary">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
                    
                    {/* Animated Decorative Shapes */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

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
                            <div className="h-1 w-12 bg-white/50 rounded-full" />
                            <p className="text-xl font-medium leading-relaxed italic">
                                "هذه المنصة غيرت طريقتي في التعلم والتدريس. الواجهة سهلة وبسيطة وكل شيء متاح بضغطة زر."
                            </p>
                            <footer className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">أ</div>
                                <div>
                                    <div className="font-bold">أحمد محمد</div>
                                    <div className="text-sm text-white/70">مدرس رياضيات</div>
                                </div>
                            </footer>
                        </blockquote>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="flex flex-col justify-center p-8 lg:p-12 bg-card">
                    <div className="mx-auto w-full max-w-[360px] space-y-8">
                        <div className="space-y-2 text-center">
                            <h1 className="text-3xl font-extrabold tracking-tight">مرحباً بك مجدداً</h1>
                            <p className="text-muted-foreground">أدخل بياناتك للمتابعة في رحلتك التعليمية</p>
                        </div>

                        <LoginForm />

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">أو من خلال</span>
                            </div>
                        </div>

                        <div className="text-center text-sm space-y-4">
                            <div>
                                <span className="text-muted-foreground">ليس لديك حساب؟ </span>
                                <Link href="/signup" className="font-bold text-primary hover:underline underline-offset-4">
                                    إنشاء حساب جديد مجاناً
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
