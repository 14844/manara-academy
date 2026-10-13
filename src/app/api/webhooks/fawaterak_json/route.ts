import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyFawaterakWebhookHash } from "@/lib/payments/fawaterak";

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

        // Verify Hash if vendor key is present
        const isValid = verifyFawaterakWebhookHash({
            transactionId,
            transactionKey,
            paymentMethod,
            receivedHash,
        });

        if (!isValid) {
            console.error("Fawaterak Webhook Signature Verification Failed!");
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        if (status !== "paid") {
            console.log(`Fawaterak Webhook status is [${status}]. No balance credited.`);
            return NextResponse.json({ status: "acknowledged", payment_status: status });
        }

        // Parse custom payload
        let customData: any = {};
        if (typeof payload.pay_load === "string") {
            try {
                customData = JSON.parse(payload.pay_load);
            } catch (e) {
                console.warn("Could not parse pay_load string:", payload.pay_load);
            }
        } else if (typeof payload.pay_load === "object" && payload.pay_load !== null) {
            customData = payload.pay_load;
        }

        const studentId = customData.student_id || payload.customerData?.customer_unique_id;
        const paidAmount = Number(payload.paidAmount || payload.amount || customData.amount || 0);

        if (!studentId || paidAmount <= 0) {
            console.error("Missing studentId or invalid paidAmount in Fawaterak webhook:", { studentId, paidAmount });
            return NextResponse.json({ error: "Invalid student or amount" }, { status: 400 });
        }

        // Idempotency check: has this transaction already been processed?
        const existingTx = await adminDb
            .collection("transactions")
            .where("fawaterak_transaction_id", "==", transactionId)
            .limit(1)
            .get();

        if (!existingTx.empty) {
            console.log(`Transaction ${transactionId} already processed. Skipping duplicate crediting.`);
            return NextResponse.json({ status: "already_processed" });
        }

        // 1. Atomically increment student's wallet balance
        const profileRef = adminDb.collection("profiles").doc(studentId);
        const profileSnap = await profileRef.get();
        const studentProfile = profileSnap.exists ? profileSnap.data() : null;

        await profileRef.update({
            wallet_balance: FieldValue.increment(paidAmount),
            updated_at: new Date().toISOString(),
        });

        // 2. Add to transactions audit collection
        await adminDb.collection("transactions").add({
            type: "wallet_recharge",
            student_id: studentId,
            student_name: studentProfile?.full_name || "طالب المنارة",
            amount: paidAmount,
            payment_method: "fawaterak",
            provider_method: paymentMethod,
            fawaterak_transaction_id: transactionId,
            fawaterak_transaction_key: transactionKey,
            status: "completed",
            created_at: new Date().toISOString(),
        });

        // 3. Update or create wallet_requests for history
        const pendingReqSnap = await adminDb
            .collection("wallet_requests")
            .where("student_id", "==", studentId)
            .where("status", "==", "pending_payment")
            .get();

        if (!pendingReqSnap.empty) {
            // Sort by created_at desc in memory to avoid needing Firestore composite index
            const sortedDocs = [...pendingReqSnap.docs].sort((a, b) => {
                const aTime = new Date(a.data().created_at || 0).getTime();
                const bTime = new Date(b.data().created_at || 0).getTime();
                return bTime - aTime;
            });
            const reqDoc = sortedDocs[0];
            await reqDoc.ref.update({
                status: "approved",
                approved_by: "fawaterak_webhook",
                amount: paidAmount,
                fawaterak_transaction_id: transactionId,
                payment_method_name: paymentMethod,
                updated_at: new Date().toISOString(),
            });
        } else {
            await adminDb.collection("wallet_requests").add({
                student_id: studentId,
                student_name: studentProfile?.full_name || "طالب المنارة",
                student_email: studentProfile?.email || "",
                student_unique_id: studentProfile?.student_id || "N/A",
                amount: paidAmount,
                sender_number: `فواتيرك (${paymentMethod})`,
                payment_gateway: "fawaterak",
                fawaterak_transaction_id: transactionId,
                status: "approved",
                approved_by: "fawaterak_webhook",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }

        console.log(`Successfully credited ${paidAmount} EGP to student ${studentId} via Fawaterak!`);
        return NextResponse.json({ status: "success", credited_amount: paidAmount });
    } catch (error: any) {
        console.error("Fawaterak webhook processing error:", error);
        return NextResponse.json({ error: error.message || "Internal webhook error" }, { status: 500 });
    }
}
