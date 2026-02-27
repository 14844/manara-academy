"use client"

import { useSearchParams } from "next/navigation"
import { ShieldAlert, LogOut, MessageSquare, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { auth } from "@/lib/firebase/config"
import { signOut } from "firebase/auth"
import { Navbar } from "@/components/navbar"

export default function RestrictedAccessPage() {
    const searchParams = useSearchParams()
    const reason = searchParams.get('reason')
    const courseId = searchParams.get('courseId')

    const handleSignOut = async () => {
        await signOut(auth)
        window.location.href = "/"
    }

    return (
        <div className="flex min-h-screen flex-col font-arabic">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="flex justify-center">
                        <div className="h-24 w-24 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            <ShieldAlert className="h-12 w-12" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl font-black text-foreground">
                            {reason === 'account' ? 'الحساب متوقف' : 'وصول غير مصرّح'}
                        </h1>
                        <p className="text-muted-foreground font-medium leading-relaxed">
                            {reason === 'account'
                                ? "تم حظر حسابك من قبل الإدارة. يرجى التواصل مع الدعم الفني لتفعيل الحساب أو معرفة الأسباب."
                                : "عذراً، يبدو أنك لم تعد مشتركاً في هذا الكورس أو تم استبعادك منه. للتفعيل، يرجى التواصل مع المسؤول."
                            }
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button className="h-12 text-lg gap-2 font-bold" asChild>
                            <Link href="https://wa.me/201017333215" target="_blank">
                                <MessageSquare className="h-5 w-5" />
                                تواصل مع الدعم الفني
                            </Link>
                        </Button>

                        <p className="text-xs text-muted-foreground font-bold italic">
                            أو <a href="https://mail.google.com/mail/?view=cm&fs=1&to=manaraacademyplatform@gmail.com" target="_blank" className="text-primary hover:underline">مراسلتنا عبر البريد (Gmail)</a>
                        </p>

                        <Button variant="outline" className="h-12 gap-2 font-bold" onClick={handleSignOut}>
                            <LogOut className="h-5 w-5" />
                            تسجيل الخروج
                        </Button>

                        <Button variant="ghost" className="gap-2 font-bold" asChild>
                            <Link href="/">
                                <ArrowRight className="h-4 w-4" />
                                العودة للمتجر
                            </Link>
                        </Button>
                    </div>

                    <div className="pt-8 border-t">
                        <p className="text-xs text-muted-foreground font-bold">Manara Academy &copy; {new Date().getFullYear()}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
