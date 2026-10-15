import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFawaterakTransactionData } from "@/lib/payments/fawaterak";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { intentKey, idToken } = body;

        let uid = "";
        if (idToken) {
            try {
                const decoded = await adminAuth.verifyIdToken(idToken);
                uid = decoded.uid;
            } catch (e) {}
        }
        if (!uid) {
            const cookieStore = await cookies();
            const session = cookieStore.get("session")?.value;
            if (session) {
                try {
                    const decoded = await adminAuth.verifySessionCookie(session);
                    uid = decoded.uid;
                } catch (e) {}
            }
        }

        if (!uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!intentKey) {
            return NextResponse.json({ error: "Missing intentKey" }, { status: 400 });
        }

        // 1. Check if already processed by Webhook
        const existingTx = await adminDb
            .collection("transactions")
            .where("fawaterak_transaction_key", "==", intentKey)
            .limit(1)
            .get();

        if (!existingTx.empty) {
            return NextResponse.json({
                status: "success",
                already_credited: true,
                message: "تم شحن الرصيد بنجاح!",
            });
        }

        // 2. Query Fawaterak API for status
        const txData = await getFawaterakTransactionData(intentKey);
        if (!txData || !txData.data) {
            return NextResponse.json({
                status: "pending",
                message: "جاري تأكيد المعاملة من البنك...",
            });
        }

        const data = txData.data;
        const txStatus = (data.status || "").toLowerCase();

        if (txStatus === "paid" || txStatus === "success") {
            const paidAmount = Number(data.paid_amount || data.total || data.cartTotal || 0);
            const transactionId = data.id || data.transaction_id || intentKey;
            const paymentMethod = data.payment_method || "Online";

            if (paidAmount > 0) {
                // Credit user
                const profileRef = adminDb.collection("profiles").doc(uid);
                const profileSnap = await profileRef.get();
                const studentProfile = profileSnap.exists ? profileSnap.data() : null;

                await profileRef.update({
                    wallet_balance: FieldValue.increment(paidAmount),
                    updated_at: new Date().toISOString(),
                });

                await adminDb.collection("transactions").add({
                    type: "wallet_recharge",
                    student_id: uid,
                    student_name: studentProfile?.full_name || "طالب المنارة",
                    amount: paidAmount,
                    payment_method: "fawaterak",
                    provider_method: paymentMethod,
                    fawaterak_transaction_id: transactionId,
                    fawaterak_transaction_key: intentKey,
                    status: "completed",
                    created_at: new Date().toISOString(),
                });

                // Log activity
                await logServerActivity({
                    action: "wallet_recharge_fawaterak_verified",
                    category: "financial",
                    title: "تأكيد فوري لشحن محفظة (فواتيرك)",
                    description: `تم التحقق وتأكيد دفع مبلغ ${paidAmount} ج.م للطالب "${studentProfile?.full_name || uid}" عبر فواتيرك وشحن المحفظة`,
                    status: "success",
                    user_id: uid,
                    user_name: studentProfile?.full_name || "طالب المنارة",
                    user_email: studentProfile?.email || "",
                    user_role: "student",
                    amount: paidAmount,
                    metadata: {
                        intent_key: intentKey,
                        transaction_id: transactionId,
                        amount: paidAmount,
                        method: paymentMethod,
                    }
                });

                return NextResponse.json({
                    status: "success",
                    credited: true,
                    amount: paidAmount,
                    message: "تم شحن المحفظة بنجاح!",
                });
            }
        }

        return NextResponse.json({
            status: txStatus || "pending",
            message: "حالة المعاملة قيد المعالجة أو لم تكتمل بعد.",
        });
    } catch (err: any) {
        console.error("Fawaterak verify error:", err);
        return NextResponse.json({ error: err.message || "Verification error" }, { status: 500 });
    }
}
