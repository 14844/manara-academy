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
        let profileUnsubscribe: (() => void) | undefined;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("StatusGuard: Check for path:", pathname, "| User UID:", user?.uid)

            if (!user) {
                if (profileUnsubscribe) profileUnsubscribe();
                // If we are on a protected route but auth is missing, we MUST clear any stale session
                const isPublicRoute = [
                    '/', '/login', '/signup', '/about', '/faq', '/terms', '/privacy', '/refund'
                ].includes(pathname) || pathname.startsWith('/courses') || pathname.startsWith('/help')
                
                if (!isPublicRoute) {
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
                // Real-time Session Monitoring
                const { onSnapshot } = await import("firebase/firestore")
                profileUnsubscribe = onSnapshot(doc(db, "profiles", user.uid), async (docSnap) => {
                    if (docSnap.exists()) {
                        const profile = docSnap.data()
                        
                        // Single Session Enforcement (Students only)
                        if (profile.role === 'student') {
                            const localSessionId = localStorage.getItem('manara_active_session_id')
                            if (profile.active_session_id && localSessionId && profile.active_session_id !== localSessionId) {
                                console.warn("StatusGuard: Session mismatch detected! Taking hard action...")
                                
                                // Perform logout cleanup
                                try {
                                    await auth.signOut()
                                    await fetch('/api/auth/session', { method: 'DELETE' })
                                } catch (err) {
                                    console.error("Logout error:", err)
                                }
                                
                                localStorage.removeItem('manara_active_session_id')
                                
                                // FORCE hard redirect to login to kill all states
                                window.location.replace("/login?error=session_conflict")
                                return
                            }
                        }

                        // Handle Status Redirects
                        if ((profile.status === 'pending' || !profile.status) && profile.role !== 'admin') {
                            if (pathname !== '/pending-approval') {
                                router.push("/pending-approval")
                            }
                        }
                        else if (profile.status === 'rejected' || profile.status === 'blocked') {
                            if (pathname !== '/restricted-access') {
                                router.push("/restricted-access?reason=account")
                            }
                        }
                        else {
                            if (pathname === '/pending-approval' || pathname === '/restricted-access' || pathname === '/login' || pathname === '/signup') {
                                const target = profile.role === 'instructor' ? "/instructor" : "/dashboard"
                                router.push(target)
                            }
                        }
                        setIsLoading(false)
                    }
                })
            } catch (error) {
                console.error("StatusGuard: Error setting up profile listener:", error)
                setIsLoading(false)
            }
        })

        return () => {
            unsubscribe()
            if (profileUnsubscribe) profileUnsubscribe()
        }
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
