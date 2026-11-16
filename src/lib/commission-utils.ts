/**
 * Calculates the platform commission and net payout for an instructor.
 *
 * New sales store the exact split (platform_commission / instructor_share / commission_rate)
 * on the enrollment / order / transaction, based on the instructor's plan (see src/lib/plans.ts).
 * Older records without a stored split fall back to the legacy flat rate (5%).
 */

import { LEGACY_COMMISSION_RATE } from "./plans";

export const BASE_RATE = LEGACY_COMMISSION_RATE;

export interface CommissionResult {
    commissionAmount: number;
    netAmount: number;
    rate: number;
}

export interface StoredCommission {
    commission_rate?: number | null;
    platform_commission?: number | null;
}

/**
 * Calculates the commission for a single enrollment.
 * @param amount The total amount paid by the student (after any coupon discounts).
 * @param instructorId The Firebase UID of the instructor.
 * @param rate Optional commission rate (0..1). Defaults to the legacy rate.
 * @param stored Optional split stored on the enrollment; a stored platform_commission wins,
 *               then a stored commission_rate, then `rate`.
 */
export function calculateEnrollmentCommission(
    amount: number,
    instructorId: string,
    rate: number = BASE_RATE,
    stored?: StoredCommission | null,
): CommissionResult {
    const storedCommission = stored?.platform_commission;
    const storedRate = stored?.commission_rate;
    let effectiveRate = rate;
    if (typeof storedRate === "number" && Number.isFinite(storedRate) && storedRate >= 0 && storedRate <= 1) {
        effectiveRate = storedRate;
    }

    let commissionAmount: number;
    if (typeof storedCommission === "number" && Number.isFinite(storedCommission)) {
        commissionAmount = storedCommission;
        if (!(typeof storedRate === "number") && amount > 0) {
            effectiveRate = storedCommission / amount;
        }
    } else {
        commissionAmount = amount * effectiveRate;
    }
    const netAmount = amount - commissionAmount;

    return {
        commissionAmount,
        netAmount,
        rate: effectiveRate,
    };
}

/**
 * Calculates the total commission for a list of enrollments for a specific instructor.
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

    return { totalCommission, totalNet };
}

/**
 * Returns null as special offers are currently disabled per user request.
 */
export function getSpecialOfferProgress(instructorId: string, totalStudents: number) {
    return null;
}
