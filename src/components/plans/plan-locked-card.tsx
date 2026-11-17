import Link from "next/link"
import { Check, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cheapestPlanWith, formatRate, type PlanFeature } from "@/lib/plans"
import { cn } from "@/lib/utils"

interface PlanLockedCardProps {
    feature: PlanFeature
    title: string
    description: string
    /** What the instructor gets once unlocked. */
    benefits: string[]
    className?: string
}

/** Shown instead of a plan-gated instructor feature when the current plan lacks it. */
export function PlanLockedCard({ feature, title, description, benefits, className }: PlanLockedCardProps) {
    const plan = cheapestPlanWith(feature)
    return (
        <div className={cn("rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:p-8", className)} dir="rtl">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Lock className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        متاحة من باقة <strong className="text-foreground">{plan.name}</strong> (عمولة {formatRate(plan.commissionRate)}).
                    </p>
                </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
                {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>{b}</span>
                    </li>
                ))}
            </ul>
            <Button asChild className="mt-6 min-h-11 rounded-xl font-bold">
                <Link href="/instructor/plan">رقّي لباقة {plan.name}</Link>
            </Button>
        </div>
    )
}
