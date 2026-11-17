import type { ReactNode } from "react"
import { Check, Crown, FlaskConical, Mail, X } from "lucide-react"
import { formatRate, type Plan } from "@/lib/plans"
import { cn } from "@/lib/utils"

export function formatPlanPrice(monthlyPrice: number): string {
    return monthlyPrice === 0 ? "مجاناً" : `${monthlyPrice.toLocaleString("ar-EG")} ج.م`
}

interface PlanCardProps {
    plan: Plan
    /** Marks the instructor's current plan (shown as a badge). */
    current?: boolean
    /** Top ribbon text. Defaults to "الأكثر طلباً" for plan.highlighted. Pass null to hide. */
    ribbon?: string | null
    /** Visual emphasis (border/ring). Defaults to plan.highlighted. */
    emphasized?: boolean
    /** Extra content rendered at the bottom of the card (CTA, months selector, ...). */
    children?: ReactNode
    className?: string
}

/** Pricing card for one instructor plan — shared by /teach and /instructor/plan. Server-safe. */
export function PlanCard({ plan, current, ribbon, emphasized, children, className }: PlanCardProps) {
    const isFree = plan.monthlyPrice === 0
    const isEmphasized = emphasized ?? !!plan.highlighted
    const ribbonText = ribbon === undefined ? (plan.highlighted ? "الأكثر طلباً" : null) : ribbon
    const keepPer100 = Math.round((1 - plan.commissionRate) * 100)

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-5 sm:p-8 shadow-sm",
                isEmphasized && "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/40",
                className,
            )}
        >
            {ribbonText && (
                <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">
                    <Crown className="h-3.5 w-3.5" aria-hidden />
                    {ribbonText}
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
            <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
                <p>
                    عمولة المنصة: <span className="font-bold text-primary">{formatRate(plan.commissionRate)}</span> من كل بيع
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    من كل 100 ج.م بيدفعها الطالب، بيوصلك {keepPer100} ج.م
                </p>
            </div>

            <ul className="mt-4 space-y-2 text-sm">
                <AccessRow on={plan.access.labs} icon={FlaskConical} label="طلابك يدخلوا المعامل الافتراضية" />
                <AccessRow on={plan.access.autoParentReports} icon={Mail} label="تقارير أولياء الأمور تتبعت تلقائياً" />
            </ul>

            <ul className="mt-4 space-y-3 border-t pt-4 text-sm flex-1">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>{f}</span>
                    </li>
                ))}
            </ul>

            {children && <div className="mt-6">{children}</div>}
        </div>
    )
}

function AccessRow({ on, icon: Icon, label }: { on: boolean; icon: typeof Check; label: string }) {
    return (
        <li className={cn("flex items-start gap-2", !on && "text-muted-foreground")}>
            {on ? (
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>
                {!on && <span className="sr-only">غير متاح: </span>}
                {label}
            </span>
        </li>
    )
}
