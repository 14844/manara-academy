import { NextResponse } from "next/server";
import { activityLogRole, logRouteFailure, requirePermission } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const adminUser = await requirePermission(request, "payments.manage");
    if (!adminUser) {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية" }, { status: 403 });
    }

    let logRequestId = "";
    const fail = (description: string, error?: unknown) => logRouteFailure(request, {
        action: "wallet_recharge_reject_failed",
        category: "financial",
        title: "فشل رفض طلب شحن محفظة",
        description,
        error,
        user: adminUser,
        metadata: { request_id: logRequestId },
    });
    try {
        const body = await request.json();
        const { requestId, reason } = body;
        logRequestId = typeof requestId === "string" ? requestId : "";

        if (!requestId || typeof requestId !== "string" || requestId.includes("/")) {
            return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
        }

        const requestRef = adminDb.collection("wallet_requests").doc(requestId);

        // Read + update atomically: only a still-pending request can be rejected
        const outcome = await adminDb.runTransaction(async (t) => {
            const reqSnap = await t.get(requestRef);
            if (!reqSnap.exists) return { kind: "not_found" as const };
            const data = reqSnap.data()!;
            if (data.status !== "pending") return { kind: "not_pending" as const, data };
            const now = new Date().toISOString();
            t.update(requestRef, {
                status: "rejected",
                reject_reason: reason || null,
                rejected_by: adminUser.uid,
                reviewed_at: now,
                updated_at: now,
            });
            return { kind: "ok" as const, data };
        });

        if (outcome.kind === "not_found") {
            await fail(`طلب الشحن ${requestId} غير موجود`);
            return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
        }
        const reqData = outcome.data;
        if (outcome.kind === "not_pending") {
            await fail(`محاولة رفض طلب شحن ${requestId} تمت مراجعته مسبقاً (الحالة: ${reqData.status || "غير معروفة"}) للطالب "${reqData.student_name || reqData.student_id}"`);
            return NextResponse.json({
                error: reqData.status === "approved" ? "لا يمكن رفض طلب تم اعتماده مسبقاً" : "تمت مراجعة هذا الطلب بالفعل",
            }, { status: reqData.status === "approved" ? 400 : 409 });
        }

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
            user_role: activityLogRole(adminUser),
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
        await fail(`تعذر رفض طلب الشحن ${logRequestId || "(بدون معرّف)"}`, err);
        return NextResponse.json({ error: "فشل رفض الطلب" }, { status: 500 });
    }
}
