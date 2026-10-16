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

            const profileRef = adminDb.collection("profiles").doc(reqData.student_id);
            const profileSnap = await transaction.get(profileRef);
            if (!profileSnap.exists) {
                throw new Error("PROFILE_NOT_FOUND");
            }

            const amount = Number(reqData.amount || 0);

            transaction.update(profileRef, {
                wallet_balance: FieldValue.increment(amount),
                updated_at: new Date().toISOString(),
            });

            transaction.update(requestRef, {
                status: "approved",
                approved_by: adminUser.uid,
                updated_at: new Date().toISOString(),
                reviewed_at: new Date().toISOString(),
            });
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.message === "ALREADY_APPROVED") {
            return NextResponse.json({ error: "تم اعتماد هذا الطلب بالفعل مسبقاً" }, { status: 400 });
        }
        return NextResponse.json({ error: err.message || "فشل اعتماد الطلب" }, { status: 500 });
    }
}
