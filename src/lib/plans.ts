/**
 * Instructor subscription plans (باقات المدرسين).
 *
 * Edit prices / commission here — this is the single source of truth used by the
 * server (commission on every sale) and the UI (/teach pricing, /instructor/plan, /admin/plans).
 *
 * Storage (server-only writes, profiles_private/{instructorUid}):
 *   plan_id:          PlanId
 *   plan_expires_at:  ISO string (null/absent for the free plan)
 * Instructors with NO plan_id stored are "legacy": they keep the old flat rate
 * (LEGACY_COMMISSION_RATE) so existing instructors' earnings don't change silently.
 * New instructor signups are created with plan_id = DEFAULT_PLAN_ID.
 */

export type PlanId = "starter" | "pro" | "center"

export interface Plan {
    id: PlanId
    name: string
    tagline: string
    /** Monthly price in EGP (0 = free). */
    monthlyPrice: number
    /** Platform commission on each sale, 0..1 */
    commissionRate: number
    features: string[]
    highlighted?: boolean
}

export const LEGACY_COMMISSION_RATE = 0.05
export const DEFAULT_PLAN_ID: PlanId = "starter"

export const PLANS: Record<PlanId, Plan> = {
    starter: {
        id: "starter",
        name: "البداية",
        tagline: "ابدأ مجاناً وادفع بس لما تبيع",
        monthlyPrice: 0,
        commissionRate: 0.15,
        features: [
            "رفع كورسات وامتحانات بلا حدود",
            "حماية الفيديوهات والعلامة المائية",
            "تقارير الطلاب وأولياء الأمور",
            "محفظة وسحب أرباح",
        ],
    },
    pro: {
        id: "pro",
        name: "المحترف",
        tagline: "لمدرس عنده طلاب ثابتين",
        monthlyPrice: 499,
        commissionRate: 0.05,
        highlighted: true,
        features: [
            "كل مميزات البداية",
            "عمولة أقل على كل اشتراك",
            "جدولة تقارير أولياء الأمور تلقائياً",
            "أولوية في مراجعة الكورسات والدعم",
        ],
    },
    center: {
        id: "center",
        name: "السنتر",
        tagline: "للسناتر والمدرسين الكبار",
        monthlyPrice: 1499,
        commissionRate: 0,
        features: [
            "كل مميزات المحترف",
            "بدون أي عمولة على المبيعات",
            "مدير حساب مخصص",
            "دعم فني على مدار الساعة",
        ],
    },
}

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro, PLANS.center]

export function isPlanId(v: unknown): v is PlanId {
    return v === "starter" || v === "pro" || v === "center"
}

export interface EffectivePlan {
    /** null = legacy instructor (no plan stored) */
    planId: PlanId | null
    plan: Plan | null
    commissionRate: number
    expiresAt: string | null
    /** true when a paid plan's expiry has passed (falls back to the free plan) */
    expired: boolean
}

/** Resolve the plan that applies right now from profiles_private data. */
export function getEffectivePlan(
    privateData: { plan_id?: unknown; plan_expires_at?: unknown } | null | undefined,
    now: Date = new Date(),
): EffectivePlan {
    const rawId = privateData?.plan_id
    if (!isPlanId(rawId)) {
        return { planId: null, plan: null, commissionRate: LEGACY_COMMISSION_RATE, expiresAt: null, expired: false }
    }
    const expiresAt = typeof privateData?.plan_expires_at === "string" ? privateData.plan_expires_at : null
    const plan = PLANS[rawId]
    if (plan.monthlyPrice > 0 && expiresAt && new Date(expiresAt).getTime() < now.getTime()) {
        const fallback = PLANS[DEFAULT_PLAN_ID]
        return { planId: fallback.id, plan: fallback, commissionRate: fallback.commissionRate, expiresAt, expired: true }
    }
    return { planId: plan.id, plan, commissionRate: plan.commissionRate, expiresAt, expired: false }
}

/** Split an amount paid by a student into platform commission / instructor share (rounded to piasters). */
export function splitSale(amount: number, commissionRate: number) {
    const commission = Math.round(amount * commissionRate * 100) / 100
    return { platformCommission: commission, instructorShare: Math.round((amount - commission) * 100) / 100 }
}

export function formatRate(rate: number): string {
    return `${Math.round(rate * 100)}%`
}
