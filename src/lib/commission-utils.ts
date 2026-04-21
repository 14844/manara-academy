/**
 * Calculates the platform commission and net payout for an instructor BASED ON PLATFORM POLICY.
 * 
 * BASE RATE: 20% commission for everyone.
 */

export const BASE_RATE = 0.20;

export interface CommissionResult {
    commissionAmount: number;
    netAmount: number;
    rate: number;
}

/**
 * Calculates the commission for a single enrollment.
 * @param amount The total amount paid by the student (after any coupon discounts).
 * @param instructorId The Firebase UID of the instructor.
 */
export function calculateEnrollmentCommission(
    amount: number,
    instructorId: string,
): CommissionResult {
    const rate = BASE_RATE;
    const commissionAmount = amount * rate;
    const netAmount = amount - commissionAmount;

    return {
        commissionAmount,
        netAmount,
        rate
    };
}

/**
 * Calculates the total commission for a list of enrollments for a specific instructor.
 */
export function calculateTotalCommission(
    enrollments: { paid_amount: number }[],
    instructorId: string
): { totalCommission: number; totalNet: number } {
    let totalCommission = 0;
    let totalNet = 0;

    enrollments.forEach((enr) => {
        const result = calculateEnrollmentCommission(
            Number(enr.paid_amount) || 0,
            instructorId
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
