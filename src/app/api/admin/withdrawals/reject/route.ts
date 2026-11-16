import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { activityLogRole, logRouteFailure, requirePermission } from "@/lib/server-auth";
import { FieldValue } from "firebase-admin/firestore";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    let logRequestId = "";
    try {
        const adminUser = await requirePermission(request, "withdrawals.manage");
        if (!adminUser) {
            return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
        }

        const body = await request.json();
        const { requestId, reason } = body;
        logRequestId = typeof requestId === "string" ? requestId : "";

        if (!requestId) {
            return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
        }

        const reqRef = adminDb.collection("withdrawal_requests").doc(requestId);
        let rejectedData: any = null;

        await adminDb.runTransaction(async (transaction) => {
            const reqSnap = await transaction.get(reqRef);
            if (!reqSnap.exists) {
                throw new Error("REQUEST_NOT_FOUND");
            }
            const reqData = reqSnap.data()!;
            if (reqData.status !== "pending") {
                throw new Error("REQUEST_NOT_PENDING");
            }

            const instructorPrivateRef = adminDb.collection("profiles_private").doc(reqData.instructor_id);
            const netAmount = Number(reqData.net_amount || reqData.amount || 0);

            transaction.update(reqRef, {
                status: "rejected",
                rejection_reason: reason || "تم الرفض بواسطة الإدارة",
                rejected_at: new Date().toISOString(),
                rejected_by: adminUser.uid,
                updated_at: new Date().toISOString(),
            });

            transaction.set(instructorPrivateRef, {
                wallet_balance: FieldValue.increment(netAmount),
                updated_at: new Date().toISOString(),
            }, { merge: true });

            rejectedData = {
                instructor_id: reqData.instructor_id,
                instructor_name: reqData.instructor_name || "المحاضر",
                net_amount: netAmount,
            };
        });

        if (rejectedData) {
            await logServerActivity({
                action: "admin_withdrawal_rejected",
                category: "financial",
                title: "رفض طلب سحب أرباح",
                description: `قام المسؤول برفض طلب سحب الأرباح (${requestId}) للمحاضر "${rejectedData.instructor_name}" وإعادة مبلغ ${rejectedData.net_amount} ج.م لمحفظته. سبب الرفض: ${reason || "تم الرفض بواسطة الإدارة"}`,
                status: "failed",
                user_id: adminUser.uid,
                user_name: adminUser.profile?.full_name || adminUser.email || "مسؤول المنصة",
                user_email: adminUser.email || "",
                user_role: activityLogRole(adminUser),
                target_user_id: rejectedData.instructor_id,
                target_user_name: rejectedData.instructor_name,
                amount: rejectedData.net_amount,
                metadata: {
                    request_id: requestId,
                    rejection_reason: reason || "تم الرفض بواسطة الإدارة",
                }
            }).catch(() => {});
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        await logRouteFailure(request, {
            action: "withdrawal_reject_failed",
            category: "financial",
            title: "فشل رفض طلب سحب أرباح",
            description: `تعذر رفض طلب السحب ${logRequestId || "(بدون معرّف)"}`,
            error: err,
            metadata: { request_id: logRequestId },
        });
        return NextResponse.json({ error: "فشل رفض الطلب" }, { status: 500 });
    }
}
