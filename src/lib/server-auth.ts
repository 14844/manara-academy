import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { hasPermission, isBackofficeRole, isStaffRole, type Permission, type UserRole } from "@/lib/permissions";
import type { ActivityLogInput } from "@/lib/activity-logger";
import { actorFields, ipFromHeaders, logServerActivity } from "@/lib/server-activity-logger";

// ---------------------------------------------------------------------------
// Security event logging (denied access / rejected sessions) with in-memory dedupe so a
// client stuck in a retry loop cannot flood activity_logs.
// ---------------------------------------------------------------------------
const securityLogSeen = new Map<string, number>();

function shouldLogSecurityEvent(key: string, windowMs: number): boolean {
    const now = Date.now();
    const last = securityLogSeen.get(key);
    if (last && now - last < windowMs) return false;
    securityLogSeen.set(key, now);
    if (securityLogSeen.size > 5000) {
        for (const [k, t] of securityLogSeen) {
            if (now - t > 10 * 60 * 1000) securityLogSeen.delete(k);
        }
        if (securityLogSeen.size > 5000) securityLogSeen.clear();
    }
    return true;
}

function requestPath(request?: Request): string {
    if (!request) return "";
    try {
        return new URL(request.url).pathname;
    } catch {
        return "";
    }
}

const SESSION_REJECT_REASONS: Record<string, string> = {
    invalid_session: "جلسة غير صالحة أو منتهية أو تم إلغاؤها",
    account_blocked: "الحساب محظور / موقوف / مرفوض",
    session_mismatch: "الجلسة لا تطابق الجلسة النشطة (تم تسجيل الدخول من جهاز آخر)",
    missing_session_id: "معرّف الجلسة مفقود",
};

function logSessionRejected(request: Request | undefined, reason: keyof typeof SESSION_REJECT_REASONS, uid?: string, profile?: any) {
    try {
        const ip = request ? ipFromHeaders(request.headers) : "";
        const key = `session:${uid || ip || "unknown"}:${reason}`;
        if (!shouldLogSecurityEvent(key, 10 * 60 * 1000)) return;
        void logServerActivity({
            action: "session_rejected",
            category: "security",
            title: "رفض جلسة دخول",
            description: `تم رفض طلب بجلسة غير مقبولة: ${SESSION_REJECT_REASONS[reason]}${request ? ` — المسار: ${requestPath(request)}` : ""}`,
            status: "failed",
            ...(uid ? {
                user_id: uid,
                user_name: profile?.full_name || profile?.email || uid,
                user_email: profile?.email || "",
                user_role: (profile?.role || "student") as ActivityLogInput["user_role"],
            } : { user_id: "guest", user_name: "زائر غير معروف", user_role: "guest" as const }),
            metadata: { reason, path: requestPath(request) },
        }, request);
    } catch {
        // never throw from logging
    }
}

/**
 * Logs an "access_denied" security event (deduped per actor + path + permission per minute).
 * Safe to call from any route; never throws.
 */
export function logAccessDenied(
    request: Request | undefined,
    user: ServerUser | null,
    permission: string,
    reason: "unauthenticated" | "missing_permission" | "inactive_account" | string,
) {
    try {
        const path = requestPath(request);
        const ip = request ? ipFromHeaders(request.headers) : "";
        const key = `denied:${user?.uid || `ip:${ip}`}:${path}:${permission}`;
        if (!shouldLogSecurityEvent(key, 60 * 1000)) return;
        const reasonText = reason === "unauthenticated"
            ? "بدون تسجيل دخول صالح"
            : reason === "inactive_account"
                ? "الحساب غير مفعّل"
                : reason === "missing_permission"
                    ? "لا يملك الصلاحية المطلوبة"
                    : reason;
        void logServerActivity({
            action: "access_denied",
            category: "security",
            title: "محاولة وصول مرفوضة",
            description: `تم رفض محاولة ${user ? `(${user.profile?.full_name || user.email || user.uid})` : "زائر غير مسجل"} للوصول إلى ${path || "عملية محمية"} — الصلاحية المطلوبة: ${permission} — السبب: ${reasonText}`,
            status: "failed",
            ...(user ? actorFields(user) : { user_id: "guest", user_name: "زائر غير مسجل", user_role: "guest" as const }),
            metadata: { permission, reason, path },
        }, request);
    } catch {
        // never throw from logging
    }
}

export interface ServerUser {
    uid: string;
    email?: string;
    role: UserRole;
    status?: string;
    profile: any;
}

/** Role value to store in server activity logs (the real server-side role of the actor). */
export function activityLogRole(user: ServerUser): ActivityLogInput["user_role"] {
    return user.role as ActivityLogInput["user_role"];
}

export async function getServerAuth(request?: Request): Promise<ServerUser | null> {
    try {
        let sessionCookie: string | undefined;
        let clientSessionId: string | undefined;

        if (request) {
            const cookieHeader = request.headers.get("cookie");
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
                if (match) sessionCookie = match[1];
                const matchSessId = cookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/);
                if (matchSessId) clientSessionId = matchSessId[1];
            }
            // Only trust httpOnly cookies (no x-session-id header fallback)
        }

        if (!sessionCookie || !clientSessionId) {
            try {
                const cookieStore = await cookies();
                if (!sessionCookie) sessionCookie = cookieStore.get("session")?.value;
                if (!clientSessionId) clientSessionId = cookieStore.get("session_id")?.value;
            } catch {
                // In contexts where cookies() is unavailable
            }
        }

        if (!sessionCookie) {
            return null;
        }

        // checkRevoked = true ensures revoked tokens are rejected
        let decoded: Awaited<ReturnType<typeof adminAuth.verifySessionCookie>> | null = null;
        try {
            decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        } catch {
            decoded = null;
        }
        if (!decoded || !decoded.uid) {
            logSessionRejected(request, "invalid_session");
            return null;
        }

        const [profileDoc, privateDoc] = await Promise.all([
            adminDb.collection("profiles").doc(decoded.uid).get(),
            adminDb.collection("profiles_private").doc(decoded.uid).get(),
        ]);
        const profileData = profileDoc.data() || {};
        const privateData = privateDoc.data() || {};

        // Item 10: Central blocked/suspended/rejected check
        // Admin and staff (backoffice) roles default to "active" when no status is stored;
        // an explicit blocked/suspended/rejected status still blocks them below.
        const accountStatus = privateData.status || profileData.status || (isBackofficeRole(profileData.role) ? "active" : "pending");
        const logProfile = { full_name: profileData.full_name, email: decoded.email || privateData.email || "", role: profileData.role };
        if (accountStatus === "blocked" || accountStatus === "suspended" || accountStatus === "rejected") {
            logSessionRejected(request, "account_blocked", decoded.uid, logProfile);
            return null;
        }

        // Session validation: primary check via session_id, fallback to device fingerprint
        if (privateData.active_session_id) {
            if (clientSessionId) {
                // Primary check: explicit session_id match
                if (clientSessionId !== privateData.active_session_id) {
                    logSessionRejected(request, "session_mismatch", decoded.uid, logProfile);
                    return null;
                }
            } else {
                // session_id is an httpOnly cookie set together with the session cookie;
                // if it's missing the session cannot be bound to the active login -> fail closed.
                logSessionRejected(request, "missing_session_id", decoded.uid, logProfile);
                return null;
            }
        }

        return {
            uid: decoded.uid,
            email: decoded.email || privateData.email || "",
            role: (profileData.role as UserRole) || "student",
            status: accountStatus,
            profile: {
                ...profileData,
                ...privateData,
                wallet_balance: privateData.wallet_balance ?? 0,
                status: accountStatus,
                email: decoded.email || privateData.email || "",
                phone: privateData.phone || "",
            },
        };
    } catch {
        return null;
    }
}

/** Account statuses that are allowed to perform sensitive actions (payments, uploads, instructor ops). */
export function isAccountActive(user: ServerUser | null): user is ServerUser {
    if (!user) return false;
    if (user.role === "admin") return true;
    // Mirrors isAccountActive() in firestore.rules.
    // Staff roles get "active" as their default status in getServerAuth when none is stored.
    const st = String(user.status || (isStaffRole(user.role) ? "active" : "pending"));
    return st === "active" || st === "approved";
}

/** Like getServerAuth, but also rejects pending (not yet approved/verified) accounts. */
export async function getActiveServerAuth(request?: Request): Promise<ServerUser | null> {
    const user = await getServerAuth(request);
    return isAccountActive(user) ? user : null;
}

/**
 * Returns the authenticated user if their role grants `permission` (admin has every permission)
 * and their account is active; otherwise null. Admin behaviour is identical to the old
 * `role === "admin"` checks (admin is always considered active).
 */
export async function requirePermission(request: Request | undefined, permission: Permission): Promise<ServerUser | null> {
    const user = await getServerAuth(request);
    if (!user) {
        logAccessDenied(request, null, permission, "unauthenticated");
        return null;
    }
    if (!hasPermission(user.role, permission)) {
        logAccessDenied(request, user, permission, "missing_permission");
        return null;
    }
    if (!isAccountActive(user)) {
        logAccessDenied(request, user, permission, "inactive_account");
        return null;
    }
    return user;
}

/** Fields for an activity log entry describing `user` as the actor. */
export function logActor(user: ServerUser) {
    return actorFields(user);
}

/**
 * Records a failed mutation (validation rejection, business-rule rejection or exception) with the
 * actor resolved from the session when not provided. Never throws.
 */
export async function logRouteFailure(
    request: Request | undefined,
    opts: {
        action: string;
        title: string;
        description: string;
        category?: ActivityLogInput["category"];
        error?: unknown;
        user?: ServerUser | null;
        target_user_id?: string;
        target_user_name?: string;
        amount?: number;
        metadata?: Record<string, any>;
    },
): Promise<void> {
    try {
        const user = opts.user !== undefined ? opts.user : await getServerAuth(request).catch(() => null);
        let errorMessage: string | undefined;
        if (opts.error !== undefined) {
            errorMessage = opts.error instanceof Error ? opts.error.message : String(opts.error);
            errorMessage = errorMessage.slice(0, 500);
        }
        await logServerActivity({
            action: opts.action,
            category: opts.category || "admin_action",
            title: opts.title,
            description: `${opts.description}${user ? ` — بواسطة ${user.profile?.full_name || user.email || user.uid}` : ""}${errorMessage ? ` — السبب: ${errorMessage}` : ""}`,
            status: "failed",
            ...(user ? actorFields(user) : {}),
            target_user_id: opts.target_user_id,
            target_user_name: opts.target_user_name,
            amount: opts.amount,
            error_message: errorMessage,
            metadata: opts.metadata,
        }, request);
    } catch {
        // never throw from logging
    }
}
