/**
 * Commission helpers for UI pages (kept for existing callers).
 *
 * Every sale stores its exact split at sale time (sale_* fields, see src/lib/sales.ts), using the
 * instructor's plan at that moment (src/lib/plans.ts). These helpers read, in order:
 *   1. the canonical sale_* fields,
 *   2. older stored fields (commission_rate / platform_commission / instructor_share),
 *   3. computeSaleSplit() at the given rate (default: the starter plan rate).
 *
 * Note: with a platform-funded coupon the instructor is paid on the list price, so
 * commissionAmount + netAmount can exceed the amount the student paid.
 */

import { DEFAULT_PLAN_ID, PLANS } from "./plans";
import { readSaleRecord } from "./sales";

/** Fallback rate for records that never stored a split: the starter plan rate. */
export const BASE_RATE = PLANS[DEFAULT_PLAN_ID].commissionRate;

export interface CommissionResult {
    /** commission at the plan rate as it applies to the instructor (gross commission) */
    commissionAmount: number;
    /** what the instructor earned (instructor share) */
    netAmount: number;
    rate: number;
    /** what the platform actually kept (can be negative with a platform coupon) */
    platformNet: number;
}

export interface StoredCommission {
    commission_rate?: number | null;
    platform_commission?: number | null;
    instructor_share?: number | null;
    original_price?: number | null;
    coupon_used?: string | null;
    sale_plan_id?: string | null;
    sale_commission_rate?: number | null;
    sale_list_price?: number | null;
    sale_discount?: number | null;
    sale_paid?: number | null;
    sale_gross_commission?: number | null;
    sale_instructor_share?: number | null;
    sale_platform_net?: number | null;
    sale_platform_coupon_cost?: number | null;
    coupon_code?: string | null;
    coupon_source?: string | null;
    [key: string]: unknown;
}

/**
 * Commission for a single enrollment.
 * @param amount The amount paid by the student (after any coupon discount).
 * @param instructorId The Firebase UID of the instructor (unused; kept for API compatibility).
 * @param rate Rate (0..1) used only when nothing is stored. Defaults to the starter rate.
 * @param stored The enrollment / transaction doc; stored values win over `amount`/`rate`.
 */
export function calculateEnrollmentCommission(
    amount: number,
    instructorId: string,
    rate: number = BASE_RATE,
    stored?: StoredCommission | null,
): CommissionResult {
    void instructorId;
    const hasStoredRate =
        stored != null &&
        (typeof stored.sale_commission_rate === "number" ||
            typeof stored.commission_rate === "number" ||
            typeof stored.platform_commission === "number");
    const safeRate = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : BASE_RATE;
    const sale = readSaleRecord({
        ...(stored || {}),
        // explicit amount is the fallback for the paid price
        paid_amount: stored?.paid_amount ?? amount,
        ...(hasStoredRate ? {} : { commission_rate: safeRate }),
    });
    return {
        commissionAmount: sale.grossCommission,
        netAmount: sale.instructorShare,
        rate: sale.rate,
        platformNet: sale.platformNet,
    };
}

/**
 * Total commission for a list of enrollments of one instructor.
 */
export function calculateTotalCommission(
    enrollments: ({ paid_amount: number } & StoredCommission)[],
    instructorId: string
): { totalCommission: number; totalNet: number } {
    let totalCommission = 0;
    let totalNet = 0;

    enrollments.forEach((enr) => {
        const result = calculateEnrollmentCommission(
            Number(enr.paid_amount) || 0,
            instructorId,
            BASE_RATE,
            enr,
        );
        totalCommission += result.commissionAmount;
        totalNet += result.netAmount;
    });

    return {
        totalCommission: Math.round(totalCommission * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
    };
}

/**
 * Returns null as special offers are currently disabled per user request.
 */
export function getSpecialOfferProgress(instructorId: string, totalStudents: number) {
    void instructorId;
    void totalStudents;
    return null;
}
