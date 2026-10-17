import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const adminUser = await getServerAuth(request);
    if (!adminUser || adminUser.role !== "admin") {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { requestId, reason } = body;

        if (!requestId) {
            return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
        }

        const requestRef = adminDb.collection("wallet_requests").doc(requestId);
        const reqSnap = await requestRef.get();

        if (!reqSnap.exists) {
            return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
        }

        const reqData = reqSnap.data()!;
        if (reqData.status === "approved") {
            return NextResponse.json({ error: "لا يمكن رفض طلب تم اعتماده مسبقاً" }, { status: 400 });
        }

        await requestRef.update({
            status: "rejected",
            reject_reason: reason || null,
            rejected_by: adminUser.uid,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        // Log server activity
        await logServerActivity({
            action: "wallet_recharge_manual_rejected",
            category: "financial",
            title: "رفض طلب شحن محفظة (يدوي)",
            description: `رفض المسؤول طلب شحن محفظة بمبلغ ${reqData.amount} ج.م للطالب "${reqData.student_name || reqData.student_id}"`,
            status: "failed",
            user_id: adminUser.uid,
            user_name: adminUser.profile?.full_name || "مسؤول المنصة",
            user_email: adminUser.email,
            user_role: "admin",
            target_user_id: reqData.student_id,
            target_user_name: reqData.student_name,
            amount: reqData.amount,
            metadata: {
                request_id: requestId,
                reason: reason || null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Reject payment error:", err);
        return NextResponse.json({ error: "فشل رفض الطلب" }, { status: 500 });
    }
}
