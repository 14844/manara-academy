/**
 * Calculates the platform commission and net payout for an instructor BASED ON PLATFORM POLICY.
 * 
 * BASE RATE: 20% commission for everyone.
 */

export const SPECIAL_OFFER_INSTRUCTORS: string[] = [];
export const SPECIAL_RATE = 0.20; // Changed from 0.15 to match BASE_RATE
export const BASE_RATE = 0.20;
export const SPECIAL_LIMIT = 0; // Effectively disabled

export interface CommissionResult {
    commissionAmount: number;
    netAmount: number;
    rate: number;
}

/**
 * Calculates the commission for a single enrollment based on the instructor's total student count so far.
 * @param amount The total amount paid by the student.
 * @param instructorId The Firebase UID of the instructor.
 * @param enrollmentIndex The 0-based index of this enrollment in the instructor's history (chronological).
 */
export function calculateEnrollmentCommission(
    amount: number,
    instructorId: string,
    enrollmentIndex: number
): CommissionResult {
    const isSpecialInstructor = SPECIAL_OFFER_INSTRUCTORS.includes(instructorId);
    const rate = (isSpecialInstructor && enrollmentIndex < SPECIAL_LIMIT) 
        ? SPECIAL_RATE 
        : BASE_RATE;
    
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
 * Assumes the enrollments are sorted chronologically.
 */
export function calculateTotalCommission(
    enrollments: { paid_amount: number }[],
    instructorId: string,
    startingIndex: number = 0
): { totalCommission: number; totalNet: number } {
    let totalCommission = 0;
    let totalNet = 0;

    enrollments.forEach((enr, i) => {
        const result = calculateEnrollmentCommission(
            Number(enr.paid_amount) || 0,
            instructorId,
            startingIndex + i
        );
        totalCommission += result.commissionAmount;
        totalNet += result.netAmount;
    });

    return { totalCommission, totalNet };
}

/**
 * Returns the progress status for a special offer instructor.
 */
export function getSpecialOfferProgress(instructorId: string, totalStudents: number) {
    const isSpecial = SPECIAL_OFFER_INSTRUCTORS.includes(instructorId);
    if (!isSpecial) return null;

    const progress = Math.min(totalStudents, SPECIAL_LIMIT);
    const percentage = (progress / SPECIAL_LIMIT) * 100;

    return {
        isSpecial: true,
        current: progress,
        limit: SPECIAL_LIMIT,
        percentage,
        isCompleted: progress >= SPECIAL_LIMIT
    };
}
