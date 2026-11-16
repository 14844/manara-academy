import type { ReactNode } from "react"
import { Check, Crown } from "lucide-react"
import { formatRate, type Plan } from "@/lib/plans"
import { cn } from "@/lib/utils"

export function formatPlanPrice(monthlyPrice: number): string {
    return monthlyPrice === 0 ? "مجاناً" : `${monthlyPrice.toLocaleString("ar-EG")} ج.م`
}

interface PlanCardProps {
    plan: Plan
    /** Marks the instructor's current plan (shown as a badge). */
    current?: boolean
    /** Extra content rendered at the bottom of the card (CTA, months selector, ...). */
    children?: ReactNode
    className?: string
}

/** Pricing card for one instructor plan — shared by /teach and /instructor/plan. Server-safe. */
export function PlanCard({ plan, current, children, className }: PlanCardProps) {
    const isFree = plan.monthlyPrice === 0
    return (
        <div
            className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-6 sm:p-8 shadow-sm",
                plan.highlighted && "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/40",
                className,
            )}
        >
            {plan.highlighted && (
                <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">
                    <Crown className="h-3.5 w-3.5" />
                    الأكثر طلباً
                </span>
            )}
            <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                {current && (
                    <span className="shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                        باقتك الحالية
                    </span>
                )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

            <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black">{formatPlanPrice(plan.monthlyPrice)}</span>
                {!isFree && <span className="text-sm text-muted-foreground">/ شهرياً</span>}
            </div>
            <p className="mt-2 text-sm">
                عمولة المنصة:{" "}
                <span className="font-bold text-primary">
                    {plan.commissionRate === 0 ? "بدون عمولة" : `${formatRate(plan.commissionRate)} على كل اشتراك`}
                </span>
            </p>

            <ul className="mt-6 space-y-3 text-sm flex-1">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                    </li>
                ))}
            </ul>

            {children && <div className="mt-6">{children}</div>}
        </div>
    )
}
