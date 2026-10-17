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

        // Validate full_name
        if (full_name !== undefined) {
            if (typeof full_name !== "string" || full_name.trim().length < 2 || full_name.trim().length > 70) {
                return NextResponse.json({ error: "الاسم بالكامل يجب أن يكون بين حرفين و 70 حرفاً" }, { status: 400 });
            }
            publicUpdate.full_name = full_name.trim();
        }

        if (specialty !== undefined) {
            publicUpdate.specialty = typeof specialty === "string" ? specialty.slice(0, 100).trim() : "";
        }

        if (bio !== undefined) {
            publicUpdate.bio = typeof bio === "string" ? bio.slice(0, 500).trim() : "";
        }

        // Validate avatar_url: length limit and must belong strictly to platform storage
        if (avatar_url !== undefined && avatar_url !== "") {
            if (typeof avatar_url !== "string" || avatar_url.length > 500) {
                return NextResponse.json({ error: "رابط الصورة غير صالح" }, { status: 400 });
            }
            const isStoragePath = avatar_url.startsWith("avatars/") || avatar_url.startsWith("/api/storage/");
            let isAllowedDomain = false;
            try {
                if (avatar_url.startsWith("http://") || avatar_url.startsWith("https://")) {
                    const parsed = new URL(avatar_url);
                    const hostname = parsed.hostname.toLowerCase();
                    if (
                        hostname.endsWith(".supabase.co") ||
                        hostname === "manara-academy.b-cdn.net" ||
                        hostname === "storage.bunnycdn.com"
                    ) {
                        isAllowedDomain = true;
                    }
                }
            } catch {
                isAllowedDomain = false;
            }

            if (!isStoragePath && !isAllowedDomain) {
                return NextResponse.json({ error: "رابط الصورة الرمزية يجب أن يكون من مساحة تخزين المنصة فقط" }, { status: 400 });
            }
            publicUpdate.avatar_url = avatar_url.trim();
        } else if (avatar_url === "") {
            publicUpdate.avatar_url = "";
        }

        const privateUpdate: Record<string, any> = { updated_at: now };
        if (phone !== undefined) {
            if (typeof phone === "string" && phone.trim().length > 30) {
                return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
            }
            privateUpdate.phone = phone ? phone.trim() : "";
        }

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
