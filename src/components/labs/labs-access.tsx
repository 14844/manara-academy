"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Lock, LogIn, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cheapestPlanWith } from "@/lib/plans"

export type LabsAccessReason = "ok" | "guest" | "no_plan_access" | "instructor_preview"

export interface LabsAccess {
    allowed: boolean
    reason: LabsAccessReason
    role: string | null
}

export const LABS_STUDENT_LOCKED_MESSAGE =
    "المعامل الافتراضية متاحة لطلاب الكورسات المشتركة في باقات المعامل. اسأل مدرسك عنها."

// One request per page load, shared by every component that asks.
let accessPromise: Promise<LabsAccess | null> | null = null

function loadLabsAccess(): Promise<LabsAccess | null> {
    if (!accessPromise) {
        accessPromise = fetch("/api/labs/access", { cache: "no-store", credentials: "same-origin" })
            .then(async (res) => (res.ok ? ((await res.json()) as LabsAccess) : null))
            .catch(() => null)
            .then((r) => {
                // Don't keep a failed result around; allow a retry on next mount.
                if (!r) accessPromise = null
                return r
            })
    }
    return accessPromise
}

/** `undefined` while loading, `null` if the check failed. */
export function useLabsAccess(): LabsAccess | null | undefined {
    const [access, setAccess] = useState<LabsAccess | null | undefined>(undefined)
    useEffect(() => {
        let alive = true
        loadLabsAccess().then((r) => {
            if (alive) setAccess(r)
        })
        return () => {
            alive = false
        }
    }, [])
    return access
}

const labsPlanNames = () => {
    const first = cheapestPlanWith("labs")
    return first.id === "pro" ? "المحترف والنخبة" : first.name
}

/** Small lock badge on a lab card (listing page) when the viewer can't open experiments. */
export function LabCardLockBadge() {
    const access = useLabsAccess()
    if (!access || access.allowed) return null
    return (
        <div className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Lock className="w-3 h-3" />
            {access.reason === "guest" ? "سجّل دخولك" : "مقفل"}
        </div>
    )
}

/** Banner on the listing page explaining the viewer's access state. */
export function LabsAccessBanner() {
    const access = useLabsAccess()
    if (!access) return null
    if (access.reason === "ok") return null

    if (access.reason === "instructor_preview") {
        return <InstructorPreviewBanner />
    }

    return (
        <div className="mb-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm" dir="rtl">
            <div className="flex items-center gap-3 font-bold text-foreground">
                <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                {access.reason === "guest"
                    ? "سجّل دخولك لفتح التجارب — المعامل متاحة لطلاب الكورسات المشتركة في باقات المعامل."
                    : LABS_STUDENT_LOCKED_MESSAGE}
            </div>
            {access.reason === "guest" && (
                <Button asChild className="rounded-xl font-bold shrink-0">
                    <Link href="/login">
                        <LogIn className="w-4 h-4 ml-2" />
                        تسجيل الدخول
                    </Link>
                </Button>
            )}
        </div>
    )
}

export function InstructorPreviewBanner() {
    return (
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm" dir="rtl">
            <div className="flex items-center gap-2 font-bold text-foreground">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                معاينة للمدرس — متاح لطلابك في باقة {labsPlanNames()}
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-xl font-bold shrink-0">
                <Link href="/instructor/plan">عرض الباقات</Link>
            </Button>
        </div>
    )
}

/** Full-page locked state for an experiment (lab components are NOT rendered). */
export function LabLockedState({ reason }: { reason: LabsAccessReason | "error" }) {
    const isGuest = reason === "guest"
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 md:p-14 rounded-[2rem] border-2 border-dashed border-border bg-muted/20 space-y-5" dir="rtl">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                {isGuest ? <LogIn className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
            </div>
            <h2 className="text-2xl font-black text-foreground">
                {isGuest ? "سجّل دخولك لبدء التجربة" : reason === "error" ? "تعذر التحقق من الصلاحية" : "هذه التجربة مقفلة"}
            </h2>
            <p className="text-muted-foreground font-medium max-w-lg leading-relaxed">
                {isGuest
                    ? "المعامل الافتراضية متاحة لطلاب الكورسات المشتركة في باقات المعامل. سجّل دخولك بحسابك للمتابعة."
                    : reason === "error"
                        ? "حدث خطأ أثناء التحقق من إمكانية الوصول. حاول تحديث الصفحة."
                        : LABS_STUDENT_LOCKED_MESSAGE}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
                {isGuest && (
                    <Button asChild className="rounded-xl font-bold h-11 px-6">
                        <Link href="/login">تسجيل الدخول</Link>
                    </Button>
                )}
                <Button asChild variant="outline" className="rounded-xl font-bold h-11 px-6">
                    <Link href="/labs">العودة للمختبرات</Link>
                </Button>
            </div>
        </div>
    )
}
