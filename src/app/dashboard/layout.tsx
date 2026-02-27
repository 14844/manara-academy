"use client"

import { StatusGuard } from "@/components/auth/status-guard"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <StatusGuard>
            {children}
        </StatusGuard>
    )
}
