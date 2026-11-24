"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { InstructorPlanResponse } from "./plan-types"

interface InstructorPlanContextValue {
    plan: InstructorPlanResponse | null
    isLoading: boolean
    error: string | null
    refresh: () => Promise<void>
    /** Marks the welcome intro as seen (optimistic + server call). */
    markIntroSeen: () => void
}

const InstructorPlanContext = createContext<InstructorPlanContextValue | null>(null)

/** Loads GET /api/instructor/plan once for the whole instructor area (sidebar chip, intro, nudges, plan page). */
export function InstructorPlanProvider({ children }: { children: ReactNode }) {
    const [plan, setPlan] = useState<InstructorPlanResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/instructor/plan", { cache: "no-store" })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || "تعذر تحميل بيانات باقتك")
            setPlan(json as InstructorPlanResponse)
        } catch (err: any) {
            setError(err?.message || "تعذر تحميل بيانات باقتك")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const markIntroSeen = useCallback(() => {
        setPlan((prev) => (prev ? { ...prev, introSeen: true } : prev))
        fetch("/api/instructor/plan/intro-seen", { method: "POST" }).catch(() => {})
    }, [])

    const value = useMemo(
        () => ({ plan, isLoading, error, refresh, markIntroSeen }),
        [plan, isLoading, error, refresh, markIntroSeen],
    )

    return <InstructorPlanContext.Provider value={value}>{children}</InstructorPlanContext.Provider>
}

export function useInstructorPlan(): InstructorPlanContextValue {
    const ctx = useContext(InstructorPlanContext)
    if (!ctx) {
        // Outside the instructor layout: inert value (components render nothing plan-specific).
        return { plan: null, isLoading: false, error: null, refresh: async () => {}, markIntroSeen: () => {} }
    }
    return ctx
}
