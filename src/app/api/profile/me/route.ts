import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";

/**
 * GET /api/profile/me
 * Returns the current user's full profile (public + private).
 * Only the authenticated user can access their own data.
 */
export async function GET(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [publicSnap, privateSnap] = await Promise.all([
            adminDb.doc(`profiles/${user.uid}`).get(),
            adminDb.doc(`profiles_private/${user.uid}`).get(),
        ]);

        if (!publicSnap.exists) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const publicData = publicSnap.data() || {};
        const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

        return NextResponse.json({
            ...publicData,
            ...privateData,
        });
    } catch {
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
