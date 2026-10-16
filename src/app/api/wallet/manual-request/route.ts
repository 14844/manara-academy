import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (user.status === "blocked" || user.status === "suspended") {
            return NextResponse.json({ error: "الحساب موقوف" }, { status: 403 });
        }

        const body = await request.json();
        const { amount, senderNumber, screenshotUrl } = body;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return NextResponse.json({ error: "المبلغ المدخل غير صالح" }, { status: 400 });
        }

        if (!senderNumber || !screenshotUrl) {
            return NextResponse.json({ error: "بيانات التحويل وصورة الإيصال مطلوبة" }, { status: 400 });
        }

        const profileSnap = await adminDb.collection("profiles").doc(user.uid).get();
        const profile = profileSnap.exists ? profileSnap.data() : null;

        const docRef = await adminDb.collection("wallet_requests").add({
            student_id: user.uid,
            student_name: profile?.full_name || user.email,
            student_email: user.email,
            student_unique_id: profile?.student_id || "N/A",
            amount: numAmount,
            sender_number: senderNumber,
            screenshot_url: screenshotUrl,
            payment_gateway: "manual",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        await logServerActivity({
            action: "wallet_recharge_manual_request",
            category: "financial",
            title: "طلب شحن محفظة (يدوي)",
            description: `قام الطالب بتقديم طلب شحن محفظة بقيمة ${numAmount} ج.م من رقم (${senderNumber}) بانتظار مراجعة الإدارة`,
            status: "pending",
            user_id: user.uid,
            user_name: profile?.full_name || user.email || "طالب",
            user_email: user.email || "",
            user_role: "student",
            amount: numAmount,
            metadata: {
                request_id: docRef.id,
                sender_number: senderNumber,
            },
        });

        return NextResponse.json({ success: true, requestId: docRef.id });
    } catch (err: any) {
        console.error("Manual wallet request error:", err);
        return NextResponse.json({ error: "حدث خطأ أثناء إرسال طلب الشحن" }, { status: 500 });
    }
}
