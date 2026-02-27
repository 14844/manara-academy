"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase/config"
import { signOut } from "firebase/auth"
import { Loader2 } from "lucide-react"

export default function LogoutPage() {
    const router = useRouter()

    useEffect(() => {
        const performLogout = async () => {
            try {
                // 1. Firebase Sign Out
                await signOut(auth)

                // 2. Clear Session Cookie
                await fetch('/api/auth/session', {
                    method: 'DELETE',
                })

                // 3. Redirect to home
                router.push("/")
                router.refresh()
            } catch (error) {
                console.error("Logout error:", error)
                router.push("/")
            }
        }

        performLogout()
    }, [router])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background font-arabic">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-lg font-bold">جاري تسجيل الخروج...</p>
                <p className="text-sm text-muted-foreground">شكراً لزيارتك لأكاديمية المنارة</p>
            </div>
        </div>
    )
}
