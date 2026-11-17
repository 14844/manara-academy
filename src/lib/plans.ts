/**
 * Instructor plans (باقات المدرسين) — ONE system: tiered commission.
 *
 *   البداية (starter): every instructor starts here. Platform takes 15%.
 *   المحترف (pro):     platform takes 10%. + discount coupons for own courses + featured listing (courses shown first with a badge).
 *   النخبة (elite):    platform takes 5%.  + everything in pro + automatic weekly parent reports.
 * Plans gate INSTRUCTOR features only. Students (incl. virtual labs) are never gated by plan.
 *
 * Higher plans are paid monthly (monthlyPrice) — the goal is to move instructors up.
 * Edit prices / rates / features HERE ONLY; server (commission on each sale, feature gating)
 * and UI (/teach, /instructor/plan, /admin/plans, nudges) all read this file.
 *
 * Storage (server-only writes, profiles_private/{instructorUid}):
 *   plan_id:          PlanId           (missing => starter)
 *   plan_expires_at:  ISO string|null  (null for starter; a paid plan past expiry falls back to starter)
 *
 * Every sale stores the plan/rate that applied AT THAT MOMENT (see computeSaleSplit), so an
 * instructor who changed plans has each sale settled at the rate of the plan active when it happened.
 */

export type PlanId = "starter" | "pro" | "center"

/** Instructor-side features only (students are never gated by plan — a student may study with several instructors). */
export type PlanFeature = "coupons" | "featuredListing" | "autoParentReports"

export interface Plan {
    id: PlanId
    name: string
    tagline: string
    /** Monthly price in EGP (0 = free). */
    monthlyPrice: number
    /** Platform commission on each sale, 0..1 */
    commissionRate: number
    /** Feature flags used for gating (server + UI). */
    access: Record<PlanFeature, boolean>
    /** Marketing bullet points shown on plan cards. */
    features: string[]
    highlighted?: boolean
}

export const DEFAULT_PLAN_ID: PlanId = "starter"

export const PLANS: Record<PlanId, Plan> = {
    starter: {
        id: "starter",
        name: "البداية",
        tagline: "باقتك الحالية عند التسجيل — ابدأ وبيع فوراً",
        monthlyPrice: 0,
        commissionRate: 0.15,
        access: { coupons: false, featuredListing: false, autoParentReports: false },
        features: [
            "رفع كورسات وامتحانات بلا حدود",
            "حماية الفيديوهات والعلامة المائية",
            "تقارير أولياء الأمور يدوياً",
            "محفظة وسحب أرباح",
        ],
    },
    pro: {
        id: "pro",
        name: "المحترف",
        tagline: "عمولة أقل + أدوات تكبّر بيها مبيعاتك",
        monthlyPrice: 499,
        commissionRate: 0.10,
        highlighted: true,
        access: { coupons: true, featuredListing: true, autoParentReports: false },
        features: [
            "كل مميزات البداية",
            "عمولة 10% بدل 15%",
            "كوبونات خصم لكورساتك تجذب بيها طلاب جداد",
            "كورساتك تظهر في الأول بعلامة مميز",
        ],
    },
    center: {
        id: "center",
        name: "النخبة",
        tagline: "أقل عمولة + كل الأدوات أوتوماتيك",
        monthlyPrice: 1499,
        commissionRate: 0.05,
        access: { coupons: true, featuredListing: true, autoParentReports: true },
        features: [
            "كل مميزات المحترف",
            "عمولة 5% بس",
            "تقارير أولياء الأمور بتتبعت تلقائياً كل أسبوع",
            "دعم فني بأولوية",
        ],
    },
}

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro, PLANS.center]

export function isPlanId(v: unknown): v is PlanId {
    return v === "starter" || v === "pro" || v === "center"
}

export interface EffectivePlan {
    planId: PlanId
    plan: Plan
    commissionRate: number
    expiresAt: string | null
    /** true when a paid plan's expiry has passed (fell back to starter) */
    expired: boolean
}

/** Resolve the plan that applies right now from profiles_private data. Missing/unknown => starter. */
export function getEffectivePlan(
    privateData: { plan_id?: unknown; plan_expires_at?: unknown } | null | undefined,
    now: Date = new Date(),
): EffectivePlan {
    const starter = PLANS[DEFAULT_PLAN_ID]
    const rawId = privateData?.plan_id
    const expiresAt = typeof privateData?.plan_expires_at === "string" ? privateData.plan_expires_at : null
    if (!isPlanId(rawId)) {
        return { planId: starter.id, plan: starter, commissionRate: starter.commissionRate, expiresAt: null, expired: false }
    }
    const plan = PLANS[rawId]
    if (plan.monthlyPrice > 0 && (!expiresAt || new Date(expiresAt).getTime() < now.getTime())) {
        return { planId: starter.id, plan: starter, commissionRate: starter.commissionRate, expiresAt, expired: true }
    }
    return { planId: plan.id, plan, commissionRate: plan.commissionRate, expiresAt, expired: false }
}

export function planHasAccess(planId: PlanId, feature: PlanFeature): boolean {
    return PLANS[planId].access[feature]
}

/** Cheapest plan that unlocks a feature (for upsell messages). */
export function cheapestPlanWith(feature: PlanFeature): Plan {
    return PLAN_LIST.find((p) => p.access[feature]) || PLANS.center
}

const r2 = (n: number) => Math.round(n * 100) / 100

export type CouponSource = "instructor" | "platform" | null

/**
 * The ONE place a sale is split. Coupon rules:
 *  - Instructor coupon: the instructor chose to discount, so commission is taken on the discounted price.
 *  - Platform coupon (admin/marketing): the platform pays for it. The instructor is paid as if
 *    there were no coupon; the discount comes out of the platform's commission (platformNet can be < 0).
 * Only one coupon applies per purchase.
 */
export function computeSaleSplit(input: {
    listPrice: number
    discountAmount: number
    couponSource: CouponSource
    commissionRate: number
}) {
    const listPrice = Math.max(0, r2(input.listPrice))
    const discount = Math.min(listPrice, Math.max(0, r2(input.discountAmount)))
    const paidAmount = r2(listPrice - discount)
    const commissionBase = input.couponSource === "platform" ? listPrice : paidAmount
    const grossCommission = r2(commissionBase * input.commissionRate)
    const instructorShare = r2(commissionBase - grossCommission)
    const platformNet = r2(paidAmount - instructorShare)
    return {
        listPrice,
        discountAmount: discount,
        paidAmount,
        commissionRate: input.commissionRate,
        /** commission at the plan rate before any platform-funded discount */
        grossCommission,
        instructorShare,
        /** what the platform actually keeps (grossCommission minus platform coupon cost) */
        platformNet,
        platformCouponCost: input.couponSource === "platform" ? discount : 0,
    }
}

/** @deprecated use computeSaleSplit. Kept for simple no-coupon splits. */
export function splitSale(amount: number, commissionRate: number) {
    const s = computeSaleSplit({ listPrice: amount, discountAmount: 0, couponSource: null, commissionRate })
    return { platformCommission: s.grossCommission, instructorShare: s.instructorShare }
}

export function formatRate(rate: number): string {
    return `${Math.round(rate * 100)}%`
}
