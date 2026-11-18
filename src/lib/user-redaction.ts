import { hasPermission, type UserRole } from "@/lib/permissions";

/** Contact fields only visible with users.view_contact. */
export const CONTACT_FIELDS = ["email", "phone", "parent_phone"];
/** Money fields only visible with wallet.view. */
export const MONEY_FIELDS = ["wallet_balance", "total_earned", "total_spent", "total_withdrawn", "pending_balance", "balance", "earnings"];
// Whole snake_case words only (e.g. total_earned, pending_balance) so names like "learning_goal" are not caught
export const MONEY_FIELD_PATTERN = /(^|_)(balance|earned|earnings?|spent|withdrawn|revenue|payouts?)(_|$)/i;
/** Session / device binding secrets — admin only. */
export const SESSION_FIELDS = ["active_session_id", "device_fingerprint"];

/**
 * Strips a merged (profiles + profiles_private) user document according to the viewer's permissions.
 * Admin gets the document unchanged. Shared by GET /api/admin/users and GET /api/admin/users/[id].
 */
export function redactUserForRole(userDoc: Record<string, any>, role: UserRole): Record<string, any> {
    // Admin gets the exact same payload as before.
    if (role === "admin") return userDoc;

    const out: Record<string, any> = { ...userDoc };
    if (!hasPermission(role, "users.view_contact")) {
        for (const f of CONTACT_FIELDS) delete out[f];
    }
    if (!hasPermission(role, "wallet.view")) {
        for (const key of Object.keys(out)) {
            if (MONEY_FIELDS.includes(key) || MONEY_FIELD_PATTERN.test(key)) delete out[key];
        }
    }
    for (const f of SESSION_FIELDS) delete out[f];
    return out;
}
