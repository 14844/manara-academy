"use client"

import { useEffect, useId, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLANS, formatRate } from "@/lib/plans"
import { useInstructorPlan } from "./instructor-plan-context"
import { formatEGP, nextPlanUp, type EarningsResponse } from "./plan-types"

const DISMISS_KEY = "manara:upgrade-nudge:dismissed-at"
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

// ---- "at most one nudge visible at a time": a tiny module-level slot ----
let slotOwner: string | null = null
const listeners = new Set<() => void>()
function emit() {
    listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
    listeners.add(l)
    return () => {
        listeners.delete(l)
    }
}
function claimSlot(id: string) {
    if (slotOwner === null) {
        slotOwner = id
        emit()
    }
}
function releaseSlot(id: string) {
    if (slotOwner === id) {
        slotOwner = null
        emit()
    }
}

function readDismissed(): boolean {
    try {
        const raw = window.localStorage.getItem(DISMISS_KEY)
        const at = raw ? Number(raw) : 0
        return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS
    } catch {
        return false
    }
}

function writeDismissed() {
    try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
        // storage unavailable (private mode etc.) — dismissal lasts for this page view only
    }
}

interface UpgradeNudgeProps {
    /** whatIf from GET /api/instructor/earnings for the period described by periodLabel. */
    whatIf?: EarningsResponse["whatIf"] | null
    /** e.g. "آخر 30 يوم" / "الشهر ده" */
    periodLabel: string
    /** Length of the whatIf period in days (savings are compared to the subscription cost for that length). */
    periodDays: number
    /** The instructor has real activity (sales / students), so a locked feature actually matters. */
    hasActivity?: boolean
    className?: string
}

/**
 * Upgrade nudge for the next plan up. Shows only when the savings beat the subscription price,
 * or when a locked feature matters. Dismissible for 7 days; one visible at a time; never on
 * /instructor/plan; nothing for the top plan.
 */
export function UpgradeNudge({ whatIf, periodLabel, periodDays, hasActivity, className }: UpgradeNudgeProps) {
    const id = useId()
    const pathname = usePathname()
    const { plan } = useInstructorPlan()
    const owner = useSyncExternalStore(subscribe, () => slotOwner, () => null)
    const [dismissed, setDismissed] = useState(true) // assume dismissed until storage is read (no flash)

    useEffect(() => {
        setDismissed(readDismissed())
    }, [])

    const current = plan ? PLANS[plan.planId] ?? PLANS.starter : null
    const next = current ? nextPlanUp(current.id) : null

    let message: string | null = null
    if (current && next && plan?.introSeen !== false && !pathname?.startsWith("/instructor/plan")) {
        const savings = whatIf ? Number(whatIf[next.id as "pro" | "center"]?.savings) || 0 : 0
        const periods = Math.max(1, Math.round(periodDays / 30))
        const cost = next.monthlyPrice * periods
        if (savings > cost) {
            message = `لو كنت على باقة ${next.name} كنت وفّرت ${formatEGP(savings)} في ${periodLabel} — أكتر من اشتراكها (${formatEGP(cost)}).`
        } else if (hasActivity) {
            if (next.access.labs && !current.access.labs) {
                message = `طلابك مش بيقدروا يدخلوا المعامل الافتراضية على باقة ${current.name}. باقة ${next.name} بتفتحها ليهم وبتنزّل عمولتك لـ ${formatRate(next.commissionRate)}.`
            } else if (next.access.autoParentReports && !current.access.autoParentReports) {
                message = `في باقة ${next.name} تقارير أولياء الأمور بتتبعت تلقائياً كل أسبوع، وعمولتك بتبقى ${formatRate(next.commissionRate)} بس.`
            }
        }
    }

    const eligible = !!message && !dismissed

    useEffect(() => {
        if (eligible) claimSlot(id)
        else releaseSlot(id)
        return () => releaseSlot(id)
    }, [eligible, id])

    if (!eligible || owner !== id || !next) return null

    return (
        <div
            role="status"
            className={`relative flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 pl-12 text-sm sm:flex-row sm:items-center ${className ?? ""}`}
        >
            <Sparkles className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden />
            <p className="flex-1 leading-relaxed">{message}</p>
            <Button asChild size="sm" className="min-h-11 shrink-0 rounded-xl font-bold">
                <Link href="/instructor/plan">شوف باقة {next.name}</Link>
            </Button>
            <button
                type="button"
                aria-label="إخفاء لمدة أسبوع"
                title="إخفاء لمدة أسبوع"
                onClick={() => {
                    writeDismissed()
                    setDismissed(true)
                }}
                className="absolute left-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
