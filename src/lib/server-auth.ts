import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { hasPermission, isBackofficeRole, isStaffRole, type Permission, type UserRole } from "@/lib/permissions";
import type { ActivityLogInput } from "@/lib/activity-logger";

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
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        if (!decoded || !decoded.uid) {
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
        if (accountStatus === "blocked" || accountStatus === "suspended" || accountStatus === "rejected") {
            return null;
        }

        // Session validation: primary check via session_id, fallback to device fingerprint
        if (privateData.active_session_id) {
            if (clientSessionId) {
                // Primary check: explicit session_id match
                if (clientSessionId !== privateData.active_session_id) {
                    return null;
                }
            } else {
                // session_id is an httpOnly cookie set together with the session cookie;
                // if it's missing the session cannot be bound to the active login -> fail closed.
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
    if (!user) return null;
    if (!hasPermission(user.role, permission)) return null;
    if (!isAccountActive(user)) return null;
    return user;
}
