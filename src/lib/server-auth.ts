import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export interface ServerUser {
    uid: string;
    email?: string;
    role: "student" | "instructor" | "admin";
    status?: string;
    profile: any;
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
        const accountStatus = privateData.status || profileData.status || (profileData.role === "admin" ? "active" : "pending");
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
            role: (profileData.role as "student" | "instructor" | "admin") || "student",
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
    // Mirrors isAccountActive() in firestore.rules
    const st = String(user.status || "pending");
    return st === "active" || st === "approved";
}

/** Like getServerAuth, but also rejects pending (not yet approved/verified) accounts. */
export async function getActiveServerAuth(request?: Request): Promise<ServerUser | null> {
    const user = await getServerAuth(request);
    return isAccountActive(user) ? user : null;
}
