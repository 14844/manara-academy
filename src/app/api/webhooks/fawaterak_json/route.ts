import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyFawaterakWebhookHash } from "@/lib/payments/fawaterak";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        let payload: any = {};
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            payload = await request.json();
        } else {
            // Fallback for form-urlencoded
            const formData = await request.formData();
            formData.forEach((val, key) => {
                payload[key] = val;
            });
        }

        console.log("Received Fawaterak Webhook:", JSON.stringify(payload, null, 2));

        const transactionId = payload.transaction_id || payload.transactionId || payload.invoice_id || "";
        const transactionKey = payload.transaction_key || payload.transactionKey || payload.intent_key || "";
        const paymentMethod = payload.payment_method || payload.paymentMethod || "Online";
        const status = (payload.status || "").toString().toLowerCase();
        const receivedHash = payload.transactionHashKey || payload.hashKey || "";

        // Verify Hash strictly
        try {
            const isValid = await verifyFawaterakWebhookHash({
                transactionId,
                transactionKey,
                paymentMethod,
                receivedHash,
            });

            if (!isValid) {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        } catch (hashErr: any) {
            if (hashErr.message === "VENDOR_KEY_NOT_CONFIGURED") {
                return NextResponse.json({ error: "Server configuration error: missing vendor key" }, { status: 500 });
            }
            return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
        }

        if (status !== "paid") {
            return NextResponse.json({ status: "acknowledged", payment_status: status });
        }

        const intentKey = transactionKey;
        if (!intentKey) {
            return NextResponse.json({ error: "Missing intent_key" }, { status: 400 });
        }

        // Fetch student_id and amount strictly from wallet_requests by intent_key (do not trust body)
        const walletReqSnap = await adminDb
            .collection("wallet_requests")
            .where("fawaterak_intent_key", "==", intentKey)
            .limit(1)
            .get();

        if (walletReqSnap.empty) {
            return NextResponse.json({ error: "No matching wallet request found for intent" }, { status: 400 });
        }

        const walletReqDoc = walletReqSnap.docs[0];
        const walletData = walletReqDoc.data();

        if (walletData.status !== "pending_payment" && walletData.status !== "pending") {
            return NextResponse.json({ error: "Request not pending" }, { status: 400 });
        }

        const studentId = walletData.student_id;
        const requestedAmount = Number(walletData.amount || 0);
        const webhookPaidAmount = Number(payload.paidAmount || payload.amount || 0);

        if (webhookPaidAmount > 0 && webhookPaidAmount < requestedAmount) {
            return NextResponse.json({ error: "Paid amount less than requested" }, { status: 400 });
        }

        const paidAmount = requestedAmount;

        if (!studentId || paidAmount <= 0) {
            return NextResponse.json({ error: "Invalid student or amount in recorded request" }, { status: 400 });
        }

        // Fixed document ID for atomic idempotency across verify and webhook
        const txRef = adminDb.collection("transactions").doc(intentKey);
        const profileRef = adminDb.collection("profiles").doc(studentId);
        const profilePrivateRef = adminDb.collection("profiles_private").doc(studentId);

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
            const currentBal = Number(privateData?.wallet_balance ?? 0);

            t.set(profilePrivateRef, {
                wallet_balance: currentBal + paidAmount,
                updated_at: new Date().toISOString(),
            }, { merge: true });

            t.create(txRef, {
                type: "wallet_recharge",
                student_id: studentId,
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
            return NextResponse.json({ status: "already_processed" });
        }

        await walletReqDoc.ref.update({
            status: "approved",
            approved_by: "fawaterak_webhook",
            amount: paidAmount,
            fawaterak_transaction_id: transactionId,
            payment_method_name: paymentMethod,
            updated_at: new Date().toISOString(),
        });

        // Record Activity Log
        await logServerActivity({
            action: "wallet_recharge_fawaterak_success",
            category: "financial",
            title: "إتمام شحن محفظة إلكتروني فورياً (فواتيرك)",
            description: `تم تأكيد دفع مبلغ ${paidAmount} ج.م للطالب "${studentProfile?.full_name || studentId}" عبر فواتيرك (${paymentMethod}) وشحن المحفظة فورياً`,
            status: "success",
            user_id: studentId,
            user_name: studentProfile?.full_name || "طالب المنارة",
            user_email: studentProfile?.email || "",
            user_role: "student",
            amount: paidAmount,
            metadata: {
                transaction_id: transactionId,
                transaction_key: intentKey,
                payment_method: paymentMethod,
                amount: paidAmount,
            }
        });

        return NextResponse.json({ status: "success", credited_amount: paidAmount });
    } catch (error: any) {
        console.error("Fawaterak webhook processing error:", error);
        await logServerActivity({
            action: "wallet_recharge_webhook_error",
            category: "financial",
            title: "خطأ في استقبال دفع فواتيرك",
            description: `حدث خطأ أثناء معالجة ويب هوك فواتيرك: ${error.message || "خطأ غير معروف"}`,
            status: "failed",
            error_message: error.message,
        }).catch(() => {});

        return NextResponse.json({ error: "فشل معالجة إشعار الدفع" }, { status: 500 });
    }
}
