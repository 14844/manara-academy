"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Mail, RefreshCcw, LogOut, CheckCircle2 } from "lucide-react"
import { signOut, sendEmailVerification } from "firebase/auth"
import { auth, db } from "@/lib/firebase/config"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { doc, updateDoc } from "firebase/firestore"
import { toast } from "sonner"

export default function VerifyEmailPage() {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser)
        })
        return () => unsubscribe()
    }, [])

    const handleCheckStatus = async () => {
        if (!auth.currentUser) return

        setIsChecking(true)
        try {
            // Force reload user to get latest verification status
            await auth.currentUser.reload()
            const updatedUser = auth.currentUser

            if (updatedUser.emailVerified) {
                // Update Firestore status to pending
                await updateDoc(doc(db, "profiles", updatedUser.uid), {
                    status: "pending",
                    updated_at: new Date().toISOString()
                })
                toast.success("تم تفعيل البريد الإلكتروني بنجاح! حسابك بانتظار مراجعة الإدارة.")
                router.push("/pending-approval")
            } else {
                toast.error("البريد الإلكتروني لم يتم تفعيله بعد. يرجى مراجعة رسائل البريد (بما في ذلك الرسائل غير المرغوب فيها).")
            }
        } catch (error: any) {
            console.error("Error checking verification status:", error)
            toast.error("حدث خطأ أثناء فحص الحالة")
        } finally {
            setIsChecking(false)
        }
    }

    const handleResendEmail = async () => {
        if (!auth.currentUser) return

        setIsResending(true)
        try {
            await sendEmailVerification(auth.currentUser)
            toast.success("تم إعادة إرسال رابط التحقق بنجاح.")
        } catch (error: any) {
            console.error("Error resending verification email:", error)
            if (error.code === 'auth/too-many-requests') {
                toast.error("يرجى الانتظار قليلاً قبل محاولة الإرسال مرة أخرى.")
            } else {
                toast.error("فشل إرسال الرابط، يرجى المحاولة لاحقاً.")
            }
        } finally {
            setIsResending(false)
        }
    }

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
                        <Mail className="h-12 w-12 text-primary animate-bounce decoration-none" />
                        <CheckCircle2 className="absolute -bottom-1 -right-1 h-8 w-8 text-green-500 bg-background rounded-full p-1 border-2" />
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl font-black text-foreground">تأكيد البريد الإلكتروني</h1>
                        <p className="text-muted-foreground leading-relaxed">
                            لقد أرسلنا رابط تفعيل إلى بريدك الإلكتروني <span className="font-bold text-primary" dir="ltr">{user?.email}</span>. يرجى النقر على الرابط لتفعيل حسابك.
                        </p>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg text-sm text-right space-y-2 border">
                        <p className="font-bold text-primary">هل لم تجد الرسالة؟</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground mr-2">
                            <li>تأكد من كتابة البريد بشكل صحيح.</li>
                            <li>افحص مجلد الرسائل غير المرغوب فيها (Spam).</li>
                            <li>انتظر بضع دقائق قبل المحاولة مرة أخرى.</li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button className="w-full gap-2 h-12 text-lg" onClick={handleCheckStatus} disabled={isChecking}>
                            {isChecking ? <RefreshCcw className="h-5 w-5 animate-spin" /> : "لقد قمت بالتفعيل، فحص الحالة"}
                        </Button>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 gap-2" onClick={handleResendEmail} disabled={isResending}>
                                <RefreshCcw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
                                إعادة إرسال الرابط
                            </Button>
                            <Button variant="outline" className="flex-1 gap-2" onClick={handleSignOut}>
                                <LogOut className="h-4 w-4" />
                                خروج
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
