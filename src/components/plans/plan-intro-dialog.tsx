"use client"

import { useRouter } from "next/navigation"
import { Check, Percent, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PLAN_LIST, PLANS, formatRate } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { FEATURE_ICONS, formatPlanPrice } from "./plan-card"
import { PLAN_FEATURES } from "./plan-types"
import { useInstructorPlan } from "./instructor-plan-context"

/** One-time welcome modal shown in the instructor area while `introSeen` is false. */
export function PlanIntroDialog() {
    const router = useRouter()
    const { plan, markIntroSeen } = useInstructorPlan()
    const open = !!plan && plan.introSeen === false

    const starter = PLANS.starter

    function close(goToPlans: boolean) {
        markIntroSeen()
        if (goToPlans) router.push("/instructor/plan")
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto font-arabic sm:max-w-xl" dir="rtl">
                <DialogHeader className="text-right sm:text-right">
                    <DialogTitle className="text-xl leading-snug">أهلاً بيك في المنارة!</DialogTitle>
                    <DialogDescription className="leading-relaxed">
                        إنت على باقة {starter.name} — بناخد {formatRate(starter.commissionRate)} من كل بيعة
                    </DialogDescription>
                </DialogHeader>

                <ul className="space-y-2">
                    {PLAN_LIST.map((p) => (
                        <li
                            key={p.id}
                            className={cn(
                                "rounded-xl border p-3 text-sm",
                                p.id === "starter" && "border-primary/40 bg-primary/5",
                            )}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <span className="font-bold">{p.name}</span>
                                <span className="text-muted-foreground">
                                    {formatPlanPrice(p.monthlyPrice)}
                                    {p.monthlyPrice > 0 && " / شهر"}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                <span className="inline-flex items-center gap-1">
                                    <Percent className="h-3.5 w-3.5 text-primary" />
                                    عمولة {formatRate(p.commissionRate)}
                                </span>
                                {PLAN_FEATURES.map((f) => (
                                    <FeatureFlag key={f.key} on={p.access[f.key]} icon={FEATURE_ICONS[f.key]} label={f.label} />
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" className="min-h-11 rounded-xl font-bold" onClick={() => close(false)}>
                        ابدأ دلوقتي
                    </Button>
                    <Button className="min-h-11 rounded-xl font-bold" onClick={() => close(true)}>
                        شوف الباقات
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FeatureFlag({ on, icon: Icon, label }: { on: boolean; icon: typeof Check; label: string }) {
    return (
        <span className={cn("inline-flex items-center gap-1", !on && "text-muted-foreground line-through decoration-muted-foreground/50")}>
            {on ? <Icon className="h-3.5 w-3.5 text-primary" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
            {!on && <span className="sr-only">غير متاح: </span>}
            {label}
        </span>
    )
}
