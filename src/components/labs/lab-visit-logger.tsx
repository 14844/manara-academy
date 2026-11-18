"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { logActivity } from "@/lib/activity-logger"

/** Logs every lab page a signed-in user opens (identity is taken server-side by /api/logs/record). */
export function LabVisitLogger() {
    const pathname = usePathname()

    useEffect(() => {
        if (!pathname?.startsWith("/labs")) return
        const lab = pathname.split("/")[2] || "قائمة المعامل"
        logActivity({
            action: "lab_visit",
            category: "course",
            title: "دخول معمل افتراضي",
            description: `فتح المستخدم المعمل: ${lab}`,
            status: "info",
            metadata: { page: "labs", path: pathname },
        }).catch(() => {})
    }, [pathname])

    return null
}
