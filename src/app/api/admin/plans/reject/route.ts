import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { activityLogRole, logRouteFailure, requirePermission } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

/**
 * POST /api/admin/plans/reject  (plans.manage)
 * body { requestId, note? }
 */
export async function POST(request: Request) {
    let logRequestId = "";
    try {
        const user = await requirePermission(request, "plans.manage");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { requestId } = body || {};
        logRequestId = typeof requestId === "string" ? requestId.slice(0, 128) : "";
        const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

        if (!requestId || typeof requestId !== "string" || requestId.includes("/")) {
            return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
        }

        const requestRef = adminDb.collection("plan_requests").doc(requestId);
        const now = new Date().toISOString();
        let reqData: FirebaseFirestore.DocumentData = {};

        await adminDb.runTransaction(async (t) => {
            const snap = await t.get(requestRef);
            if (!snap.exists) throw new Error("REQUEST_NOT_FOUND");
            reqData = snap.data() || {};
            if (reqData.status !== "pending") throw new Error("REQUEST_NOT_PENDING");
            t.update(requestRef, {
                status: "rejected",
                note,
                reviewed_by: user.uid,
                reviewed_at: now,
            });
        });

        const actorName = user.profile?.full_name || user.email || "مسؤول المنصة";
        await logServerActivity({
            action: "admin_plan_request_rejected",
            category: "admin_action",
            title: "رفض طلب باقة مدرس",
            description: `قام "${actorName}" برفض طلب الباقة (${requestId}) للمدرس "${reqData.instructor_name || reqData.instructor_id}"${note ? `. السبب: ${note}` : ""}`,
            status: "success",
            user_id: user.uid,
            user_name: actorName,
            user_email: user.email || "",
            user_role: activityLogRole(user),
            target_user_id: reqData.instructor_id,
            target_user_name: reqData.instructor_name,
            metadata: {
                request_id: requestId,
                requested_plan_id: reqData.requested_plan_id,
                months: reqData.months,
                note,
            },
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (err: any) {
        await logRouteFailure(request, {
            action: "admin_plan_request_reject_failed",
            category: "admin_action",
            title: "فشل رفض طلب باقة",
            description: `تعذر رفض طلب الباقة ${logRequestId || "(بدون معرّف)"}`,
            error: err,
            metadata: { request_id: logRequestId },
        });
        if (err?.message === "REQUEST_NOT_FOUND") {
            return NextResponse.json({ error: "طلب الباقة غير موجود" }, { status: 404 });
        }
        if (err?.message === "REQUEST_NOT_PENDING") {
            return NextResponse.json({ error: "تمت مراجعة هذا الطلب بالفعل" }, { status: 409 });
        }
        console.error("Admin plan reject error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
