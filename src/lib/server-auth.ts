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
            if (!clientSessionId) {
                clientSessionId = request.headers.get("x-session-id") || undefined;
            }
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

        // Enforce active_session_id check: reject if mismatched
        if (privateData.active_session_id && clientSessionId) {
            if (clientSessionId !== privateData.active_session_id) {
                return null;
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
