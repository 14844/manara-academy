import { STAFF_ROLES } from "@/lib/permissions";

/** Roles shown on the team page: the admin(s) and every staff role. */
export const TEAM_ROLES: string[] = ["admin", ...STAFF_ROLES];

/** Max docs read when a composite index is missing and we fall back to in-memory filtering. */
export const FALLBACK_SCAN_LIMIT = 5000;

/** Firestore throws FAILED_PRECONDITION (code 9) when a composite index is missing. */
export function isMissingIndexError(err: any): boolean {
    const msg = String(err?.message || "");
    return err?.code === 9 || msg.includes("FAILED_PRECONDITION") || msg.toLowerCase().includes("index");
}

/** Numeric timestamp of a log (server logs store both `timestamp` and `created_at`). */
export function logTime(data: Record<string, any>): number {
    if (typeof data.timestamp === "number") return data.timestamp;
    const parsed = Date.parse(data.created_at || "");
    return Number.isFinite(parsed) ? parsed : 0;
}
