"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Clock, LogOut } from "lucide-react"
import Link from "next/link"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { useRouter } from "next/navigation"

export default function PendingApprovalPage() {
    const router = useRouter()

    const handleSignOut = async () => {
        await signOut(auth)
        await fetch('/api/auth/session', { method: 'DELETE' })
        router.push("/login")
    }

    return (
        <div className="flex min-h-screen flex-col font-arabic">
            <Navbar />
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-8 p-8 bg-card border rounded-2xl shadow-xl animate-in zoom-in duration-300">
                    <div className="relative mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                        <Clock className="h-12 w-12 text-primary animate-pulse" />
                        <ShieldCheck className="absolute -bottom-1 -right-1 h-8 w-8 text-primary bg-background rounded-full p-1 border-2" />
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl font-black text-foreground">حسابك قيد المراجعة</h1>
                        <p className="text-muted-foreground leading-relaxed">
                            شكراً لانضمامك لأكاديمية المنارة! حسابك الآن بانتظار تفعيل الإدارة. سيتم إشعارك فور تفعيل الحساب لتتمكن من الوصول لكورساتك ومميزات المنصة.
                        </p>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg text-sm text-right space-y-2">
                        <p className="font-bold text-primary">لماذا يتم مراجعة الحساب؟</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground mr-2">
                            <li>للتأكد من صحة البيانات المسجلة.</li>
                            <li>للحفاظ على أمان وخصوصية مجتمعنا التعليمي.</li>
                            <li>لمنع الحسابات الوهمية وضمان جودة الخدمة.</li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
                            <LogOut className="h-4 w-4" />
                            تسجيل الخروج والعودة لاحقاً
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href="/about">تعرف أكثر على المنصة</Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    )
}
