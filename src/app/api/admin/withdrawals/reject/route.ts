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
        const { requestId, reason } = body;

        if (!requestId) {
            return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
        }

        const reqRef = adminDb.collection("withdrawal_requests").doc(requestId);

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
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: "فشل رفض الطلب" }, { status: 500 });
    }
}
