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

                // 2. Clear Session Cookie (catch error but continue)
                try {
                    await fetch('/api/auth/session', {
                        method: 'DELETE',
                    })
                } catch (apiErr) {
                    console.error("Session API Error (non-blocking):", apiErr)
                }

                // 3. Clear any local storage/cache if any
                if (typeof window !== 'undefined') {
                    window.localStorage.clear()
                    window.sessionStorage.clear()
                }

                // 4. Force refresh redirects to ensure all auth states are re-evaluated
                window.location.href = "/"
            } catch (error) {
                console.error("Logout critical error:", error)
                window.location.href = "/"
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
