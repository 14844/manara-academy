"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { logActivity } from "@/lib/activity-logger"

/**
 * Logs every lab page a signed-in user opens (identity is taken server-side by /api/logs/record).
 * Also logs the moment a visitor signs in from inside a lab (the guest gate), since uid changes.
 */
export function LabVisitLogger() {
    const pathname = usePathname()
    const [uid, setUid] = useState<string | null>(null)

    useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), [])

    useEffect(() => {
        if (!uid || !pathname?.startsWith("/labs")) return
        const lab = pathname.split("/")[2] || "قائمة المعامل"
        logActivity({
            action: "lab_visit",
            category: "course",
            title: "دخول معمل افتراضي",
            description: `فتح المستخدم المعمل: ${lab}`,
            status: "info",
            metadata: { page: "labs", path: pathname },
        }).catch(() => {})
    }, [pathname, uid])

    return null
}
