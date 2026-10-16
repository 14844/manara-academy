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

        if (request) {
            const cookieHeader = request.headers.get("cookie");
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
                if (match) sessionCookie = match[1];
            }
        }

        if (!sessionCookie) {
            try {
                const cookieStore = await cookies();
                sessionCookie = cookieStore.get("session")?.value;
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

        const profileDoc = await adminDb.collection("profiles").doc(decoded.uid).get();
        const profileData = profileDoc.data() || {};

        return {
            uid: decoded.uid,
            email: decoded.email || profileData.email,
            role: (profileData.role as "student" | "instructor" | "admin") || "student",
            status: profileData.status || "pending",
            profile: profileData,
        };
    } catch {
        return null;
    }
}
