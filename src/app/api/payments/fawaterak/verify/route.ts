import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getFawaterakTransactionData } from "@/lib/payments/fawaterak";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getServerAuth } from "@/lib/server-auth";

export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { intentKey } = body;

        if (!intentKey) {
            return NextResponse.json({ error: "Missing intentKey" }, { status: 400 });
        }

        // 1. Verify intentKey ownership from wallet_requests
        const walletReqSnap = await adminDb
            .collection("wallet_requests")
            .where("fawaterak_intent_key", "==", intentKey)
            .limit(1)
            .get();

        if (walletReqSnap.empty) {
            return NextResponse.json({ error: "طلب الشحن غير مسجل" }, { status: 404 });
        }

        const walletReqDoc = walletReqSnap.docs[0];
        const walletData = walletReqDoc.data();

        if (walletData.student_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بتأكيد هذا الدفع" }, { status: 403 });
        }

        if (walletData.status !== "pending_payment" && walletData.status !== "pending") {
            return NextResponse.json({ error: "طلب الشحن تم معالجته مسبقاً أو غير صالح" }, { status: 400 });
        }

        // 2. Fixed doc id for unified idempotency check with webhook
        const txRef = adminDb.collection("transactions").doc(intentKey);
        const existingTx = await txRef.get();

        if (existingTx.exists) {
            return NextResponse.json({
                status: "success",
                already_credited: true,
                message: "تم شحن الرصيد بنجاح!",
            });
        }

        // 3. Query Fawaterak API for status
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
            const rawAmount =
                data.paid_amount ??
                data.paidAmount ??
                data.amount ??
                data.total ??
                data.cartTotal ??
                data.payment_data?.amount ??
                data.payment_data?.paid_amount ??
                data.invoice?.total ??
                data.invoice?.paid_amount ??
                data.invoice_total ??
                null;

            const requestedAmount = Number(walletData.amount || 0);

            if (rawAmount !== null && rawAmount !== undefined) {
                const fawaterakPaid = Number(rawAmount);
                if (!isNaN(fawaterakPaid) && fawaterakPaid > 0 && fawaterakPaid < requestedAmount) {
                    return NextResponse.json({ error: "المبلغ المدفوع غير مطابق للطلب" }, { status: 400 });
                }
            }

            const paidAmount = requestedAmount;
            const transactionId = data.id || data.transaction_id || intentKey;
            const paymentMethod = data.payment_method || "Online";

            if (paidAmount > 0) {
                const profileRef = adminDb.collection("profiles").doc(user.uid);
                const profilePrivateRef = adminDb.collection("profiles_private").doc(user.uid);
                let alreadyProcessed = false;
                let studentProfile: any = null;

                await adminDb.runTransaction(async (t) => {
                    const txDoc = await t.get(txRef);
                    if (txDoc.exists) {
                        alreadyProcessed = true;
                        return;
                    }

                    const [profileSnap, privateSnap] = await Promise.all([
                        t.get(profileRef),
                        t.get(profilePrivateRef),
                    ]);
                    studentProfile = profileSnap.exists ? profileSnap.data() : null;
                    const privateData = privateSnap.exists ? privateSnap.data() : null;
                    const currentBal = Number(privateData?.wallet_balance ?? studentProfile?.wallet_balance ?? 0);

                    t.set(profilePrivateRef, {
                        wallet_balance: currentBal + paidAmount,
                        updated_at: new Date().toISOString(),
                    }, { merge: true });

                    t.create(txRef, {
                        type: "wallet_recharge",
                        student_id: user.uid,
                        student_name: studentProfile?.full_name || "طالب المنارة",
                        amount: paidAmount,
                        payment_method: "fawaterak",
                        provider_method: paymentMethod,
                        fawaterak_transaction_id: transactionId,
                        fawaterak_transaction_key: intentKey,
                        intent_key: intentKey,
                        status: "completed",
                        created_at: new Date().toISOString(),
                    });
                });

                if (alreadyProcessed) {
                    return NextResponse.json({
                        status: "success",
                        already_credited: true,
                        message: "تم شحن الرصيد مسبقاً!",
                    });
                }

                await walletReqDoc.ref.update({
                    status: "approved",
                    approved_by: "fawaterak_verify",
                    fawaterak_transaction_id: transactionId,
                    payment_method_name: paymentMethod,
                    updated_at: new Date().toISOString(),
                });

                // Log activity
                await logServerActivity({
                    action: "wallet_recharge_fawaterak_verified",
                    category: "financial",
                    title: "تأكيد فوري لشحن محفظة (فواتيرك)",
                    description: `تم التحقق وتأكيد دفع مبلغ ${paidAmount} ج.م للطالب "${studentProfile?.full_name || user.uid}" عبر فواتيرك وشحن المحفظة`,
                    status: "success",
                    user_id: user.uid,
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
        return NextResponse.json({ error: "حدث خطأ أثناء التحقق من حالة الدفع" }, { status: 500 });
    }
}
