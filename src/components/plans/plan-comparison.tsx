import type { ReactNode } from "react"
import { Check, X } from "lucide-react"
import { PLAN_LIST, formatRate, type PlanId } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { formatPlanPrice } from "./plan-card"
import { PLAN_FEATURES } from "./plan-types"

/**
 * Compact plan comparison table (commission, your share, coupons, analytics, auto reports, price).
 * Fits 375px: label column + 3 narrow plan columns. Server-safe.
 */
export function PlanComparison({ currentPlanId, nextPlanId }: { currentPlanId?: PlanId; nextPlanId?: PlanId | null }) {
    const yes = (on: boolean) =>
        on ? (
            <Check className="mx-auto h-4 w-4 text-primary" aria-label="متاح" />
        ) : (
            <X className="mx-auto h-4 w-4 text-muted-foreground" aria-label="غير متاح" />
        )

    const rows: { label: string; cell: (p: (typeof PLAN_LIST)[number]) => ReactNode }[] = [
        { label: "عمولة المنصة", cell: (p) => <span className="font-bold">{formatRate(p.commissionRate)}</span> },
        { label: "بيوصلك من كل 100 ج.م", cell: (p) => `${Math.round((1 - p.commissionRate) * 100)} ج.م` },
        ...PLAN_FEATURES.map((f) => ({ label: f.label, cell: (p: (typeof PLAN_LIST)[number]) => yes(p.access[f.key]) })),
        {
            label: "السعر الشهري",
            cell: (p) => <span className="font-bold">{formatPlanPrice(p.monthlyPrice)}</span>,
        },
    ]

    const colClass = (id: PlanId) =>
        cn(
            id === currentPlanId && "bg-green-500/5",
            id === nextPlanId && "bg-primary/10",
        )

    return (
        <div className="overflow-hidden rounded-2xl border">
            <table className="w-full table-fixed text-center text-xs sm:text-sm">
                <caption className="sr-only">مقارنة الباقات</caption>
                <thead className="bg-muted/50">
                    <tr>
                        <th scope="col" className="w-[34%] p-2 text-right sm:p-3">
                            <span className="sr-only">الميزة</span>
                        </th>
                        {PLAN_LIST.map((p) => (
                            <th key={p.id} scope="col" className={cn("p-2 align-top sm:p-3", colClass(p.id))}>
                                <span className="block font-bold">{p.name}</span>
                                {p.id === currentPlanId && (
                                    <span className="block text-[10px] font-medium text-green-600 dark:text-green-400">باقتك</span>
                                )}
                                {p.id === nextPlanId && (
                                    <span className="block text-[10px] font-medium text-primary">الخطوة الجاية</span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {rows.map((r) => (
                        <tr key={r.label}>
                            <th scope="row" className="p-2 text-right font-medium text-muted-foreground sm:p-3">
                                {r.label}
                            </th>
                            {PLAN_LIST.map((p) => (
                                <td key={p.id} className={cn("p-2 sm:p-3", colClass(p.id))}>
                                    {r.cell(p)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
