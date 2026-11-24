"use client"

import Link from "next/link"
import { ArrowUpLeft, Crown } from "lucide-react"
import { PLANS } from "@/lib/plans"
import { useInstructorPlan } from "./instructor-plan-context"
import { nextPlanUp } from "./plan-types"

/** Small persistent "باقتك: X — رقّي" chip for the instructor sidebar. Not dismissible, low-key. */
export function PlanChip({ onNavigate }: { onNavigate?: () => void }) {
    const { plan } = useInstructorPlan()
    if (!plan) return null
    const current = PLANS[plan.planId] ?? PLANS.starter
    const canUpgrade = !!nextPlanUp(current.id)

    return (
        <Link
            href="/instructor/plan"
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
        >
            <Crown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
                باقتك: <span className="font-bold text-foreground">{current.name}</span>
            </span>
            {canUpgrade && (
                <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-primary">
                    رقّي
                    <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden />
                </span>
            )}
        </Link>
    )
}
