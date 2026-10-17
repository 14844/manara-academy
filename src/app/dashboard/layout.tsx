"use client"

import { StatusGuard } from "@/components/auth/status-guard"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isStudent, setIsStudent] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login")
                return
            }

            // Verify student role in Firestore
            const docRef = doc(db, "profiles", user.uid)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists() && docSnap.data().role === 'student') {
                setIsStudent(true)
            } else {
                toast.error("عذراً، لا تمتلك صلاحيات الوصول لهذه الصفحة")
                const role = docSnap.exists() ? docSnap.data().role : ''
                if (role === 'admin') {
                    router.push("/admin")
                } else if (role === 'instructor') {
                    router.push("/instructor")
                } else {
                    router.push("/login")
                }
            }
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [router])

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground italic font-arabic">جاري التحقق من الصلاحيات...</p>
            </div>
        )
    }

    if (!isStudent) return null

    return (
        <StatusGuard>
            {children}
        </StatusGuard>
    )
}
