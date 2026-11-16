"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, CalendarClock, Clock, Crown, Info, Loader2, RefreshCw, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { PlanCard, formatPlanPrice } from "@/components/plans/plan-card"
import { MonthsSelector, monthsLabel, type PlanMonths } from "@/components/plans/months-selector"
import { PLANS, PLAN_LIST, formatRate, isPlanId, type Plan, type PlanId } from "@/lib/plans"

interface PendingRequest {
    id: string
    requested_plan_id: PlanId
    months: number
    amount: number
    created_at: string
}

interface MyPlan {
    planId: PlanId | null
    expiresAt: string | null
    expired: boolean
    commissionRate: number
    pendingRequest: PendingRequest | null
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })
}

export default function InstructorPlanPage() {
    const [data, setData] = useState<MyPlan | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [months, setMonths] = useState<Record<PlanId, PlanMonths>>({ starter: 1, pro: 1, center: 1 })
    const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const fetchPlan = useCallback(async () => {
        setIsLoading(true)
        setLoadError(null)
        try {
            const res = await fetch("/api/instructor/plan", { cache: "no-store" })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || "تعذر تحميل بيانات باقتك")
            setData(json as MyPlan)
        } catch (err: any) {
            setLoadError(err?.message || "تعذر تحميل بيانات باقتك")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPlan()
    }, [fetchPlan])

    async function submitRequest() {
        if (!confirmPlan) return
        const plan = confirmPlan
        const isFree = plan.monthlyPrice === 0
        setIsSubmitting(true)
        try {
            const res = await fetch("/api/instructor/plan/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan.id, months: isFree ? 1 : months[plan.id] }),
            })
            const json = await res.json().catch(() => ({}))
            if (res.status === 409) {
                throw new Error(json.error || "عندك طلب باقة قيد المراجعة بالفعل")
            }
            if (!res.ok) throw new Error(json.error || "تعذر إرسال الطلب")
            if (json.applied) {
                toast.success(`تم تحويلك لباقة ${plan.name}`)
            } else {
                toast.success("تم إرسال طلبك، وفريق المنارة هيتواصل معاك قريباً")
            }
            setConfirmPlan(null)
            fetchPlan()
        } catch (err: any) {
            toast.error(err?.message || "تعذر إرسال الطلب")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading && !data) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-36 w-full rounded-2xl" />
                <div className="grid gap-6 md:grid-cols-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}
                </div>
            </div>
        )
    }

    if (loadError && !data) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <p className="font-bold">{loadError}</p>
                    <Button variant="outline" className="min-h-11 gap-2" onClick={fetchPlan}>
                        <RefreshCw className="h-4 w-4" /> إعادة المحاولة
                    </Button>
                </CardContent>
            </Card>
        )
    }

    // An expired paid plan falls back to the free plan (server does the same for commission)
    const effectivePlanId: PlanId | null = data?.expired ? "starter" : data?.planId ?? null
    const currentPlan = effectivePlanId && isPlanId(effectivePlanId) ? PLANS[effectivePlanId] : null
    const isLegacy = !!data && data.planId === null
    const pending = data?.pendingRequest ?? null
    const pendingPlan = pending && isPlanId(pending.requested_plan_id) ? PLANS[pending.requested_plan_id] : null

    const confirmIsFree = confirmPlan?.monthlyPrice === 0
    const confirmMonths = confirmPlan ? months[confirmPlan.id] : 1
    const confirmTotal = confirmPlan ? confirmPlan.monthlyPrice * confirmMonths : 0

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl sm:text-3xl font-bold">باقتي</h1>
                <p className="text-muted-foreground">اعرف باقتك الحالية والعمولة اللي بتتخصم على مبيعاتك، أو اطلب باقة تانية.</p>
            </div>

            {/* Current plan */}
            <Card className="overflow-hidden">
                <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                                <Crown className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-muted-foreground">باقتك الحالية</p>
                                <h2 className="text-xl font-bold">
                                    {isLegacy
                                        ? "الباقة الحالية — عمولة 5%"
                                        : currentPlan?.name ?? "—"}
                                </h2>
                                <p className="mt-1 text-sm">
                                    عمولة المنصة على كل اشتراك:{" "}
                                    <span className="font-bold text-primary">{formatRate(data?.commissionRate ?? 0)}</span>
                                </p>
                                {isLegacy && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        إنت على النظام القديم للمدرسين الحاليين، وتقدر تفضل عليه أو تختار باقة من الباقات الجديدة.
                                    </p>
                                )}
                            </div>
                        </div>
                        {!isLegacy && data?.expiresAt && (data.expired || (currentPlan && currentPlan.monthlyPrice > 0)) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarClock className="h-4 w-4" />
                                <span>
                                    {data?.expired ? "انتهت في" : "تنتهي في"}{" "}
                                    <span className="font-bold text-foreground">{formatDate(data?.expiresAt)}</span>
                                </span>
                            </div>
                        )}
                    </div>

                    {data?.expired && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                اشتراكك في الباقة المدفوعة انتهى بتاريخ {formatDate(data.expiresAt)}، وحالياً بتتحسب عليك عمولة
                                باقة {PLANS.starter.name} ({formatRate(PLANS.starter.commissionRate)}). جدّد اشتراكك عشان ترجع للعمولة الأقل.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending request */}
            {pending && (
                <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-1">
                        <p className="font-bold">
                            طلبك لباقة {pendingPlan?.name ?? pending.requested_plan_id} ({monthsLabel(pending.months)}) قيد المراجعة
                        </p>
                        <p className="text-muted-foreground">
                            المبلغ: {pending.amount.toLocaleString("ar-EG")} ج.م — اتبعت في {formatDate(pending.created_at)}.
                            فريق المنارة هيتواصل معاك للدفع، أو المبلغ هيتخصم من محفظتك عند الموافقة.
                        </p>
                    </div>
                </div>
            )}

            {/* How it works */}
            <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                    بعد ما تطلب باقة مدفوعة، فريق المنارة هيتواصل معاك عشان الدفع، أو المبلغ بيتخصم من رصيد{" "}
                    <Link href="/instructor/withdrawals" className="font-bold text-primary hover:underline underline-offset-4">
                        محفظتك
                    </Link>{" "}
                    لما الطلب يتوافق عليه. الباقة بتتفعّل وعمولتها بتتطبق على المبيعات من وقت التفعيل.
                </p>
            </div>

            {/* Plans */}
            <div className="grid gap-6 pt-3 md:grid-cols-3">
                {PLAN_LIST.map((plan) => {
                    const isFree = plan.monthlyPrice === 0
                    const isCurrent = effectivePlanId === plan.id
                    const disabled = !!pending || isSubmitting
                    return (
                        <PlanCard key={plan.id} plan={plan} current={isCurrent}>
                            {isFree ? (
                                <Button
                                    variant="outline"
                                    className="min-h-11 w-full rounded-xl font-bold"
                                    disabled={disabled || isCurrent}
                                    onClick={() => setConfirmPlan(plan)}
                                >
                                    {isCurrent ? "باقتك الحالية" : "التحويل للباقة المجانية"}
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <MonthsSelector
                                        value={months[plan.id]}
                                        onChange={(m) => setMonths((prev) => ({ ...prev, [plan.id]: m }))}
                                        disabled={disabled}
                                    />
                                    <p className="text-center text-sm text-muted-foreground">
                                        الإجمالي:{" "}
                                        <span className="font-bold text-foreground">
                                            {(plan.monthlyPrice * months[plan.id]).toLocaleString("ar-EG")} ج.م
                                        </span>
                                    </p>
                                    <Button
                                        variant={plan.highlighted ? "default" : "outline"}
                                        className="min-h-11 w-full rounded-xl font-bold"
                                        disabled={disabled}
                                        onClick={() => setConfirmPlan(plan)}
                                    >
                                        {isCurrent ? "تجديد الباقة" : "اطلب الباقة"}
                                    </Button>
                                </div>
                            )}
                        </PlanCard>
                    )
                })}
            </div>
            {pending && (
                <p className="text-center text-sm text-muted-foreground">
                    مش هتقدر تطلب باقة تانية لحد ما طلبك الحالي يتراجع.
                </p>
            )}

            {/* Confirm dialog */}
            <Dialog open={!!confirmPlan} onOpenChange={(open) => !open && !isSubmitting && setConfirmPlan(null)}>
                <DialogContent className="max-w-md font-arabic">
                    <DialogHeader>
                        <DialogTitle>
                            {confirmIsFree ? "التحويل للباقة المجانية" : `طلب باقة ${confirmPlan?.name ?? ""}`}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmIsFree
                                ? `هيتم تحويلك فوراً لباقة ${confirmPlan?.name ?? ""} وعمولتها ${formatRate(confirmPlan?.commissionRate ?? 0)} على كل اشتراك جديد.`
                                : "راجع تفاصيل طلبك قبل الإرسال."}
                        </DialogDescription>
                    </DialogHeader>

                    {confirmPlan && !confirmIsFree && (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4 border-b pb-2">
                                <span className="text-muted-foreground">الباقة</span>
                                <span className="font-bold">{confirmPlan.name}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b pb-2">
                                <span className="text-muted-foreground">المدة</span>
                                <span className="font-bold">{monthsLabel(confirmMonths)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b pb-2">
                                <span className="text-muted-foreground">السعر الشهري</span>
                                <span>{formatPlanPrice(confirmPlan.monthlyPrice)}</span>
                            </div>
                            <div className="flex justify-between gap-4 font-bold">
                                <span>الإجمالي</span>
                                <span className="text-primary">{confirmTotal.toLocaleString("ar-EG")} ج.م</span>
                            </div>
                            <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-muted-foreground">
                                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <p>فريق المنارة هيتواصل معاك للدفع، أو المبلغ هيتخصم من محفظتك عند الموافقة على الطلب.</p>
                            </div>
                        </div>
                    )}
                    {confirmIsFree && isLegacy && (
                        <p className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-300">
                            تنبيه: إنت حالياً على عمولة 5%، والتحويل للباقة المجانية هيخلي العمولة{" "}
                            {formatRate(PLANS.starter.commissionRate)}، ومش هتقدر ترجع للنظام القديم.
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            className="min-h-11"
                            disabled={isSubmitting}
                            onClick={() => setConfirmPlan(null)}
                        >
                            إلغاء
                        </Button>
                        <Button className="min-h-11 gap-2" disabled={isSubmitting} onClick={submitRequest}>
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {confirmIsFree ? "تأكيد التحويل" : "إرسال الطلب"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
