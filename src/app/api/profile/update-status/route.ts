import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

            await profileRef.update({
                status: "pending",
                updated_at: new Date().toISOString(),
            });

            return NextResponse.json({ success: true });
        }

        if (action === "update_profile") {
            const allowedFields = [
                "full_name",
                "phone",
                "parent_phone",
                "grade_level",
                "specialty",
                "bio",
                "avatar_url",
            ];

            const updateData: Record<string, any> = {
                status: "pending", // Re-trigger admin approval upon profile edit
                updated_at: new Date().toISOString(),
            };

            if (profile && typeof profile === "object") {
                for (const key of allowedFields) {
                    if (key in profile) {
                        updateData[key] = profile[key];
                    }
                }
            }

            await profileRef.update(updateData);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    } catch (err: any) {
        console.error("Profile status update error:", err);
        return NextResponse.json({ error: "فشل تحديث حالة الحساب" }, { status: 500 });
    }
}
