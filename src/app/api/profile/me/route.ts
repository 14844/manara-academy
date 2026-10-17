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

/**
 * PUT /api/profile/me
 * Updates current user's profile.
 * Public fields -> profiles/{uid}
 * Private fields (phone) -> profiles_private/{uid}
 */
export async function PUT(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { full_name, specialty, bio, phone, avatar_url } = body;

        const now = new Date().toISOString();
        const publicUpdate: Record<string, any> = { updated_at: now };
        if (full_name !== undefined) publicUpdate.full_name = full_name;
        if (specialty !== undefined) publicUpdate.specialty = specialty;
        if (bio !== undefined) publicUpdate.bio = bio;
        if (avatar_url !== undefined) publicUpdate.avatar_url = avatar_url;

        const privateUpdate: Record<string, any> = { updated_at: now };
        if (phone !== undefined) privateUpdate.phone = phone;

        await Promise.all([
            adminDb.doc(`profiles/${user.uid}`).set(publicUpdate, { merge: true }),
            adminDb.doc(`profiles_private/${user.uid}`).set(privateUpdate, { merge: true }),
        ]);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Profile update error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
