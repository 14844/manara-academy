import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/server-auth";

/**
 * GET /api/admin/team/lookup?email=...
 * Finds an existing (already signed-up) user by email so the admin can give them a staff role.
 * Requires users.manage_roles (admin only).
 */
export async function GET(request: Request) {
    try {
        const user = await requirePermission(request, "users.manage_roles");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const email = (new URL(request.url).searchParams.get("email") || "").trim().toLowerCase();
        if (!email || !email.includes("@") || email.length > 254) {
            return NextResponse.json({ error: "أدخل بريدًا إلكترونيًا صحيحًا" }, { status: 400 });
        }

        let uid: string | null = null;
        try {
            uid = (await adminAuth.getUserByEmail(email)).uid;
        } catch {
            // Not in Firebase Auth under that exact email — try the stored profile email.
            const privSnap = await adminDb.collection("profiles_private").where("email", "==", email).limit(1).get();
            uid = privSnap.docs[0]?.id || null;
        }

        if (!uid) {
            return NextResponse.json({ error: "لا يوجد مستخدم مسجل بهذا البريد" }, { status: 404 });
        }

        const [pubSnap, privSnap] = await Promise.all([
            adminDb.doc(`profiles/${uid}`).get(),
            adminDb.doc(`profiles_private/${uid}`).get(),
        ]);
        if (!pubSnap.exists) {
            return NextResponse.json({ error: "المستخدم ليس لديه ملف شخصي على المنصة بعد" }, { status: 404 });
        }
        const pub = pubSnap.data() || {};
        const priv = privSnap.data() || {};

        return NextResponse.json({
            user: {
                id: uid,
                full_name: pub.full_name || "",
                email: priv.email || email,
                role: pub.role || "student",
                status: priv.status || null,
                is_self: uid === user.uid,
            },
        });
    } catch (err) {
        console.error("Team lookup error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
