import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        const adminUser = await getServerAuth(request);
        if (!adminUser || adminUser.role !== "admin") {
            return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
        }

        const body = await request.json();
        const { requestId } = body;

        if (!requestId) {
            return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
        }

        const reqRef = adminDb.collection("withdrawal_requests").doc(requestId);
        let reqData: FirebaseFirestore.DocumentData = {};

        await adminDb.runTransaction(async (transaction) => {
            const reqSnap = await transaction.get(reqRef);
            if (!reqSnap.exists) {
                throw new Error("REQUEST_NOT_FOUND");
            }
            reqData = reqSnap.data()!;
            if (reqData.status === "paid" || reqData.status === "approved") {
                throw new Error("ALREADY_PAID");
            }
            if (reqData.status !== "pending") {
                throw new Error("REQUEST_NOT_PENDING");
            }

            transaction.update(reqRef, {
                status: "paid",
                paid_at: new Date().toISOString(),
                approved_by: adminUser.uid,
                updated_at: new Date().toISOString(),
            });
        });

        const netAmount = Number(reqData.net_amount || reqData.amount || 0);

        // Server-side audit log
        await logServerActivity({
            action: "withdrawal_approved",
            category: "financial",
            title: `موافقة على سحب أرباح محاضر (${netAmount} ج.م)`,
            description: `وافق المسؤول (${adminUser.profile?.full_name || adminUser.email}) على تحويل أرباح بقيمة ${netAmount} ج.م للمحاضر "${reqData.instructor_name || reqData.instructor_id}"`,
            status: "success",
            user_id: adminUser.uid,
            user_name: adminUser.profile?.full_name || "مسؤول المنصة",
            user_email: adminUser.email,
            user_role: "admin",
            target_user_id: reqData.instructor_id,
            target_user_name: reqData.instructor_name,
            amount: netAmount,
            metadata: {
                request_id: requestId,
                net_amount: netAmount,
                gross_amount: reqData.amount,
                commission: reqData.commission,
                instructor_id: reqData.instructor_id,
            },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.message === "ALREADY_PAID") {
            return NextResponse.json({ error: "تم تحويل هذا الطلب بالفعل مسبقاً" }, { status: 400 });
        }
        if (err.message === "REQUEST_NOT_PENDING") {
            return NextResponse.json({ error: "الطلب ليس في حالة قيد الانتظار" }, { status: 400 });
        }
        console.error("Error approving withdrawal:", err);
        return NextResponse.json({ error: "فشل اعتماد طلب السحب" }, { status: 500 });
    }
}
