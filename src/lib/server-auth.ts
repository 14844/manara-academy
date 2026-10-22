import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies, headers as nextHeaders } from "next/headers";
import crypto from "crypto";

export interface ServerUser {
    uid: string;
    email?: string;
    role: "student" | "instructor" | "admin";
    status?: string;
    profile: any;
}

/**
 * Generate a device fingerprint from request headers for session binding.
 * This provides a secondary validation layer when session_id cookie is cleared.
 */
function generateDeviceFingerprint(userAgent: string, acceptLanguage: string): string {
    return crypto
        .createHash("sha256")
        .update(`${userAgent}||${acceptLanguage}`)
        .digest("hex")
        .slice(0, 32);
}

export async function getServerAuth(request?: Request): Promise<ServerUser | null> {
    try {
        let sessionCookie: string | undefined;
        let clientSessionId: string | undefined;
        let userAgent = "";
        let acceptLanguage = "";

        if (request) {
            const cookieHeader = request.headers.get("cookie");
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
                if (match) sessionCookie = match[1];
                const matchSessId = cookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/);
                if (matchSessId) clientSessionId = matchSessId[1];
            }
            if (!clientSessionId) {
                clientSessionId = request.headers.get("x-session-id") || undefined;
            }
            userAgent = request.headers.get("user-agent") || "";
            acceptLanguage = request.headers.get("accept-language") || "";
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

        // Try to get headers if not from request
        if (!userAgent) {
            try {
                const headerStore = await nextHeaders();
                userAgent = headerStore.get("user-agent") || "";
                acceptLanguage = headerStore.get("accept-language") || "";
            } catch {
                // In contexts where headers() is unavailable
            }
        }

        if (!sessionCookie) {
            return null;
        }

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

        // Session validation: primary check via session_id, fallback to device fingerprint
        if (privateData.active_session_id) {
            if (clientSessionId) {
                // Primary check: explicit session_id match
                if (clientSessionId !== privateData.active_session_id) {
                    return null;
                }
            } else {
                // Fallback: if session_id cookie was cleared, validate device fingerprint
                // This prevents the bypass where clearing the cookie skips validation
                const currentFingerprint = generateDeviceFingerprint(userAgent, acceptLanguage);
                const storedFingerprint = privateData.device_fingerprint || "";
                if (storedFingerprint && currentFingerprint !== storedFingerprint) {
                    return null;
                }
                // If no stored fingerprint, allow (backward compatibility) but log it
            }
        }

        return {
            uid: decoded.uid,
            email: decoded.email || privateData.email || "",
            role: (profileData.role as "student" | "instructor" | "admin") || "student",
            status: privateData.status || (profileData.role === "admin" ? "active" : "pending"),
            profile: {
                ...profileData,
                ...privateData,
                wallet_balance: privateData.wallet_balance ?? 0,
                status: privateData.status || (profileData.role === "admin" ? "active" : "pending"),
                email: decoded.email || privateData.email || "",
                phone: privateData.phone || "",
            },
        };
    } catch {
        return null;
    }
}
