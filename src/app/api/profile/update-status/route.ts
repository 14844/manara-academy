import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentStatus = user.status;
    if (currentStatus === "blocked" || currentStatus === "suspended" || currentStatus === "rejected") {
        return NextResponse.json({ error: "الحساب موقوف أو مرفوض، لا يمكن تحديث الحالة" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { action, profile } = body;
        const profileRef = adminDb.collection("profiles").doc(user.uid);

        if (action === "email_verified") {
            // Verify from Firebase Auth directly
            const authUser = await adminAuth.getUser(user.uid);
            if (!authUser.emailVerified) {
                return NextResponse.json({ error: "البريد الإلكتروني لم يتم تأكيده بعد" }, { status: 400 });
            }

            const privateRef = adminDb.collection("profiles_private").doc(user.uid);
            await privateRef.set({
                status: "pending",
                updated_at: new Date().toISOString(),
            }, { merge: true });

            return NextResponse.json({ success: true });
        }

        if (action === "update_profile") {
            const publicFields = ["full_name", "grade_level", "specialty", "bio", "avatar_url"];
            const privateFields = ["phone", "parent_phone"];

            const now = new Date().toISOString();
            const publicUpdate: Record<string, any> = { updated_at: now };
            const privateUpdate: Record<string, any> = { status: "pending", updated_at: now };

            if (profile && typeof profile === "object") {
                for (const key of publicFields) {
                    if (key in profile) publicUpdate[key] = profile[key];
                }
                for (const key of privateFields) {
                    if (key in profile) privateUpdate[key] = profile[key];
                }
            }

            const privateRef = adminDb.collection("profiles_private").doc(user.uid);
            await Promise.all([
                profileRef.update(publicUpdate),
                privateRef.set(privateUpdate, { merge: true }),
            ]);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    } catch (err: any) {
        console.error("Profile status update error:", err);
        return NextResponse.json({ error: "فشل تحديث حالة الحساب" }, { status: 500 });
    }
}
