import { PLAN_LIST, PLANS, type Plan, type PlanFeature, type PlanId } from "@/lib/plans"

/** GET /api/instructor/plan */
export interface InstructorPlanResponse {
    planId: PlanId
    planName: string
    commissionRate: number
    access: Record<PlanFeature, boolean>
    expiresAt: string | null
    expired: boolean
    pendingRequest: {
        id: string
        requested_plan_id: PlanId
        months: number
        amount: number
        created_at: string
    } | null
    introSeen: boolean
}

/** Display order + short labels of the gated instructor features (plan cards, comparison, intro, admin). */
export const PLAN_FEATURES: { key: PlanFeature; label: string }[] = [
    { key: "coupons", label: "كوبونات خصم لكورساتك" },
    { key: "featuredListing", label: "كورساتك تظهر في الأول بعلامة مميز" },
    { key: "autoParentReports", label: "تقارير أولياء أمور تلقائية كل أسبوع" },
]

export type CouponSourceValue = "instructor" | "platform" | null

export interface EarningsSale {
    id: string
    date: string
    course_id: string
    course_title: string
    student_label: string
    list_price: number
    discount: number
    coupon_code: string | null
    coupon_source: CouponSourceValue
    paid: number
    plan_id: PlanId | string | null
    rate: number
    commission: number
    instructor_share: number
}

export interface WhatIfEntry {
    commission: number
    savings: number
}

/** GET /api/instructor/earnings */
export interface EarningsResponse {
    currentPlan: { planId: PlanId; commissionRate: number; expiresAt: string | null; expired: boolean }
    summary: {
        sales: number
        listTotal: number
        discountTotal: number
        paidTotal: number
        instructorShare: number
        commission: number
        byPlan: { planId: PlanId | string; rate: number; sales: number; paidTotal: number; commission: number; instructorShare: number }[]
        byMonth: { month: string; sales: number; instructorShare: number; commission: number }[]
    }
    sales: EarningsSale[]
    whatIf: { pro: WhatIfEntry; center: WhatIfEntry }
    wallet: { balance: number; pendingWithdrawals: number }
}

/** The next plan up from `planId`, or null when already on the top plan. */
export function nextPlanUp(planId: PlanId): Plan | null {
    const i = PLAN_LIST.findIndex((p) => p.id === planId)
    return i >= 0 && i < PLAN_LIST.length - 1 ? PLAN_LIST[i + 1] : null
}

export function planName(planId: string | null | undefined): string {
    return planId && planId in PLANS ? PLANS[planId as PlanId].name : "—"
}

/** "1,234.5 ج.م" in Arabic digits, max 2 decimals. */
export function formatEGP(n: number | null | undefined): string {
    const v = Number(n) || 0
    return `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`
}

/** Local-date YYYY-MM-DD (no UTC shift). */
export function toYMD(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

export function last30DaysRange(now: Date = new Date()): { from: string; to: string } {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return { from: toYMD(from), to: toYMD(now) }
}
