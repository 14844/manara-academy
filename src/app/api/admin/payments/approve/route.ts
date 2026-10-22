import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { FieldValue } from "firebase-admin/firestore";

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

        const requestRef = adminDb.collection("wallet_requests").doc(requestId);
        
        await adminDb.runTransaction(async (transaction) => {
            const reqSnap = await transaction.get(requestRef);
            if (!reqSnap.exists) {
                throw new Error("REQUEST_NOT_FOUND");
            }
            const reqData = reqSnap.data()!;
            if (reqData.status === "approved") {
                throw new Error("ALREADY_APPROVED");
            }
            if (reqData.status !== "pending") {
                throw new Error("NOT_PENDING");
            }

            const profilePrivateRef = adminDb.collection("profiles_private").doc(reqData.student_id);
            const amount = Number(reqData.amount || 0);
            const txRef = adminDb.collection("transactions").doc();

            transaction.set(profilePrivateRef, {
                wallet_balance: FieldValue.increment(amount),
                updated_at: new Date().toISOString(),
            }, { merge: true });

            transaction.update(requestRef, {
                status: "approved",
                approved_by: adminUser.uid,
                updated_at: new Date().toISOString(),
                reviewed_at: new Date().toISOString(),
            });

            transaction.create(txRef, {
                type: "wallet_recharge_manual",
                student_id: reqData.student_id,
                student_name: reqData.student_name || "طالب",
                student_email: reqData.student_email || "",
                amount: amount,
                admin_id: adminUser.uid,
                admin_name: adminUser.profile?.full_name || adminUser.email || "مسؤول المنصة",
                payment_method: reqData.payment_method || "manual",
                sender_number: reqData.sender_number || "",
                proof_url: reqData.screenshot_url || reqData.proof_url || null,
                wallet_request_id: requestId,
                status: "completed",
                created_at: new Date().toISOString(),
            });
        });

        // Fetch request data to log detailed activity
        const approvedReqSnap = await requestRef.get();
        const approvedReqData = approvedReqSnap.data() || {};

        // Log server activity
        const { logServerActivity } = await import("@/lib/server-activity-logger");
        await logServerActivity({
            action: "wallet_recharge_approved",
            category: "financial",
            title: `موافقة على شحن محفظة (${approvedReqData.amount || 0} ج.م)`,
            description: `وافق المسؤول (${adminUser.profile?.full_name || adminUser.email}) على شحن محفظة الطالب "${approvedReqData.student_name || approvedReqData.student_id}" بمبلغ ${approvedReqData.amount || 0} ج.م عبر طريقة (${approvedReqData.payment_method || "تحويل يدوي"})`,
            status: "success",
            user_id: adminUser.uid,
            user_name: adminUser.profile?.full_name || "مسؤول المنصة",
            user_email: adminUser.email,
            user_role: "admin",
            target_user_id: approvedReqData.student_id,
            target_user_name: approvedReqData.student_name,
            amount: Number(approvedReqData.amount || 0),
            metadata: {
                request_id: requestId,
                student_id: approvedReqData.student_id,
                amount: approvedReqData.amount,
                payment_method: approvedReqData.payment_method,
            },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.message === "ALREADY_APPROVED") {
            return NextResponse.json({ error: "تم اعتماد هذا الطلب بالفعل مسبقاً" }, { status: 400 });
        }
        if (err.message === "NOT_PENDING") {
            return NextResponse.json({ error: "لا يمكن اعتماد هذا الطلب لأنه ليس في حالة قيد الانتظار" }, { status: 400 });
        }
        return NextResponse.json({ error: "فشل اعتماد الطلب" }, { status: 500 });
    }
}
