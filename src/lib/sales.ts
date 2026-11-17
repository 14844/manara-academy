/**
 * Sale records (server + client safe, no Firebase imports).
 *
 * Every paid enrollment (and its "enrollment_payout" transaction) stores the canonical split
 * produced by computeSaleSplit() in src/lib/plans.ts:
 *   sale_plan_id, sale_commission_rate, sale_list_price, sale_discount, sale_paid,
 *   sale_gross_commission, sale_instructor_share, sale_platform_net, sale_platform_coupon_cost,
 *   coupon_code, coupon_source
 *
 * readSaleRecord() normalizes any enrollment / transaction doc: canonical sale_* fields first,
 * then older stored fields (paid_amount / original_price / commission_rate / platform_commission /
 * instructor_share), then a fresh computeSaleSplit() at the starter rate.
 */

import {
    DEFAULT_PLAN_ID,
    PLANS,
    PLAN_LIST,
    computeSaleSplit,
    isPlanId,
    type CouponSource,
    type PlanId,
} from "./plans"

const r2 = (n: number) => Math.round(n * 100) / 100

function num(v: unknown): number | null {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
    return Number.isFinite(n) ? n : null
}

function rateOrNull(v: unknown): number | null {
    const n = num(v)
    return n !== null && n >= 0 && n <= 1 ? n : null
}

/**
 * Who funds a coupon. A coupon with no instructor_id (admin / marketing), instructor_id "admin"
 * or is_admin === true is a platform coupon; otherwise it is the instructor's own coupon.
 */
export function couponSourceOf(
    coupon: { instructor_id?: unknown; is_admin?: unknown } | null | undefined,
): CouponSource {
    if (!coupon) return null
    if (coupon.is_admin === true || coupon.instructor_id === "admin" || !coupon.instructor_id) return "platform"
    return "instructor"
}

/** Best-effort plan for an older record that only stored a rate. */
export function planIdForRate(rate: number): PlanId {
    return PLAN_LIST.find((p) => Math.abs(p.commissionRate - rate) < 1e-9)?.id ?? DEFAULT_PLAN_ID
}

export interface SaleRecord {
    planId: PlanId
    rate: number
    listPrice: number
    discount: number
    paid: number
    /** commission at the plan rate as it applies to the instructor (on list price for platform coupons) */
    grossCommission: number
    instructorShare: number
    /** what the platform actually keeps (can be negative with a platform coupon) */
    platformNet: number
    platformCouponCost: number
    couponCode: string | null
    /** stored coupon source; null when no coupon (or an older record that didn't store it) */
    couponSource: CouponSource
    /** coupon rule used for the math (older records with a coupon were settled on the paid price) */
    ruleSource: CouponSource
}

/** Canonical fields written on enrollments + transactions for one sale. */
export function saleFields(input: {
    planId: PlanId
    split: ReturnType<typeof computeSaleSplit>
    couponCode: string | null
    couponSource: CouponSource
}) {
    const { split } = input
    return {
        sale_plan_id: input.planId,
        sale_commission_rate: split.commissionRate,
        sale_list_price: split.listPrice,
        sale_discount: split.discountAmount,
        sale_paid: split.paidAmount,
        sale_gross_commission: split.grossCommission,
        sale_instructor_share: split.instructorShare,
        sale_platform_net: split.platformNet,
        sale_platform_coupon_cost: split.platformCouponCost,
        coupon_code: input.couponCode || null,
        coupon_source: input.couponCode ? input.couponSource : null,
    }
}

export function readSaleRecord(d: Record<string, any> | null | undefined): SaleRecord {
    const data = d || {}
    const couponCode =
        typeof data.coupon_code === "string" && data.coupon_code
            ? data.coupon_code
            : typeof data.coupon_used === "string" && data.coupon_used
                ? data.coupon_used
                : null
    const storedSource: CouponSource =
        data.coupon_source === "platform" || data.coupon_source === "instructor" ? data.coupon_source : null
    // Older records were always settled on the paid (discounted) price = instructor-coupon rule.
    const ruleSource: CouponSource = storedSource ?? (couponCode ? "instructor" : null)

    const paid = Math.max(0, num(data.sale_paid) ?? num(data.paid_amount) ?? num(data.amount) ?? 0)
    const listPrice = Math.max(paid, num(data.sale_list_price) ?? num(data.original_price) ?? paid)
    const discount = Math.max(0, num(data.sale_discount) ?? r2(listPrice - paid))

    const storedRate = rateOrNull(data.sale_commission_rate) ?? rateOrNull(data.commission_rate)
    const legacyCommission = num(data.platform_commission)
    let rate: number
    if (storedRate !== null) rate = storedRate
    else if (legacyCommission !== null && paid > 0) rate = Math.min(1, Math.max(0, legacyCommission / paid))
    else rate = PLANS[DEFAULT_PLAN_ID].commissionRate

    const planId: PlanId = isPlanId(data.sale_plan_id)
        ? data.sale_plan_id
        : storedRate !== null || legacyCommission !== null
            ? planIdForRate(rate)
            : DEFAULT_PLAN_ID

    const computed = computeSaleSplit({ listPrice, discountAmount: discount, couponSource: ruleSource, commissionRate: rate })

    const instructorShare = num(data.sale_instructor_share) ?? num(data.instructor_share) ?? computed.instructorShare
    const grossCommission =
        num(data.sale_gross_commission) ??
        (ruleSource !== "platform" && legacyCommission !== null ? legacyCommission : null) ??
        computed.grossCommission
    const platformNet = num(data.sale_platform_net) ?? legacyCommission ?? r2(paid - instructorShare)
    const platformCouponCost = num(data.sale_platform_coupon_cost) ?? computed.platformCouponCost

    return {
        planId,
        rate,
        listPrice,
        discount,
        paid,
        grossCommission,
        instructorShare,
        platformNet,
        platformCouponCost,
        couponCode,
        couponSource: storedSource,
        ruleSource,
    }
}

/** A record that moved money (paid by the student and/or credited to the instructor). */
export function isMoneySale(s: SaleRecord): boolean {
    return s.paid > 0 || s.instructorShare > 0
}

/** Re-settle a sale at another rate with the same coupon rule (for "what if" comparisons). */
export function resettleAtRate(s: SaleRecord, commissionRate: number) {
    return computeSaleSplit({
        listPrice: s.listPrice,
        discountAmount: s.discount,
        couponSource: s.ruleSource,
        commissionRate,
    })
}

export { r2 as roundMoney }

/* ---------------- date range query params (YYYY-MM-DD, UTC days, inclusive) ---------------- */

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDay(v: string): Date | null {
    if (!DATE_RE.test(v)) return null
    const d = new Date(`${v}T00:00:00.000Z`)
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null
    return d
}

export type DateRangeResult =
    | { ok: true; from: string; to: string; fromIso: string; toIso: string }
    | { ok: false; error: string }

/** ?from&to — defaults to the last `defaultDays` days (including today); max `maxDays` days. */
export function parseDateRange(params: URLSearchParams, defaultDays = 30, maxDays = 366): DateRangeResult {
    const rawFrom = params.get("from")
    const rawTo = params.get("to")
    const today = parseDay(new Date().toISOString().slice(0, 10))!

    const toDay = rawTo ? parseDay(rawTo) : today
    if (!toDay) return { ok: false, error: "تاريخ النهاية غير صالح (YYYY-MM-DD)" }
    const fromDay = rawFrom ? parseDay(rawFrom) : new Date(toDay.getTime() - (defaultDays - 1) * DAY_MS)
    if (!fromDay) return { ok: false, error: "تاريخ البداية غير صالح (YYYY-MM-DD)" }
    if (fromDay.getTime() > toDay.getTime()) return { ok: false, error: "تاريخ البداية بعد تاريخ النهاية" }
    const days = Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1
    if (days > maxDays) return { ok: false, error: `أقصى مدة ${maxDays} يوم` }

    return {
        ok: true,
        from: fromDay.toISOString().slice(0, 10),
        to: toDay.toISOString().slice(0, 10),
        fromIso: fromDay.toISOString(),
        toIso: new Date(toDay.getTime() + DAY_MS - 1).toISOString(),
    }
}

/** ISO timestamp string inside [fromIso, toIso]. */
export function inRange(iso: unknown, fromIso: string, toIso: string): iso is string {
    if (typeof iso !== "string" || !iso) return false
    return iso >= fromIso && iso <= toIso
}
