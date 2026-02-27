"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function StatusGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("StatusGuard: Check for path:", pathname, "| User UID:", user?.uid)

            if (!user) {
                // If we are on a protected route but auth is missing, we MUST clear any stale session
                if (pathname !== '/login' && pathname !== '/signup' && pathname !== '/') {
                    console.warn("StatusGuard: Protected path detected without auth. Clearing session...")
                    try {
                        await fetch('/api/auth/session', { method: 'DELETE' })
                    } catch (e) {
                        console.error("Failed to clear stale session:", e)
                    }
                    router.push("/login")
                    return // Keep loading to prevent content flash
                }
                setIsLoading(false)
                return
            }

            try {
                const docRef = doc(db, "profiles", user.uid)
                const docSnap = await getDoc(docRef)

                if (docSnap.exists()) {
                    const profile = docSnap.data()
                    console.log("StatusGuard: Profile role:", profile.role, "status:", profile.status)

                    // 1. Handle Pending
                    if ((profile.status === 'pending' || !profile.status) && profile.role !== 'admin') {
                        if (pathname !== '/pending-approval') {
                            router.push("/pending-approval")
                            return
                        }
                    }
                    // 2. Handle Blocked/Rejected
                    else if (profile.status === 'rejected' || profile.status === 'blocked') {
                        if (pathname !== '/restricted-access') {
                            router.push("/restricted-access?reason=account")
                            return
                        }
                    }
                    // 3. Handle Approved
                    else {
                        if (pathname === '/pending-approval' || pathname === '/restricted-access' || pathname === '/login' || pathname === '/signup') {
                            const target = profile.role === 'instructor' ? "/instructor" : "/dashboard"
                            router.push(target)
                            return
                        }
                    }
                } else {
                    console.warn("StatusGuard: Profile missing for user:", user.uid)
                }
            } catch (error) {
                console.error("StatusGuard: Error fetching profile:", error)
            } finally {
                setIsLoading(false)
            }
        })

        return () => unsubscribe()
    }, [router, pathname])

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <h2 className="text-xl font-bold font-arabic mb-2">جاري التحقق من الحساب...</h2>
                <p className="text-muted-foreground text-sm font-arabic max-w-xs">
                    إذا استغرق الأمر أكثر من ١٠ ثوانٍ، يرجى إعادة تحميل الصفحة أو تسجيل الدخول مرة أخرى.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => window.location.href = '/login'}>
                    العودة لصفحة الدخول
                </Button>
            </div>
        )
    }

    return <>{children}</>
}
