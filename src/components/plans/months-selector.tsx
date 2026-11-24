"use client"

import { cn } from "@/lib/utils"

export const PLAN_MONTH_OPTIONS = [1, 3, 6, 12] as const
export type PlanMonths = (typeof PLAN_MONTH_OPTIONS)[number]

export function monthsLabel(m: number): string {
    if (m === 1) return "شهر"
    if (m === 12) return "سنة"
    return `${m} شهور`
}

/** Segmented 1/3/6/12-month picker (44px tap targets). */
export function MonthsSelector({
    value,
    onChange,
    disabled,
    label = "مدة الاشتراك",
}: {
    value: PlanMonths
    onChange: (m: PlanMonths) => void
    disabled?: boolean
    label?: string
}) {
    return (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
            {PLAN_MONTH_OPTIONS.map((m) => {
                const active = m === value
                return (
                    <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => onChange(m)}
                        className={cn(
                            "min-h-11 rounded-lg px-1 text-sm font-bold transition-colors disabled:opacity-50",
                            active
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {monthsLabel(m)}
                    </button>
                )
            })}
        </div>
    )
}
