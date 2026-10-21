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

        // -------------------------------------------------------------
        // CASE A: Check if intent belongs to a direct Course Order
        // -------------------------------------------------------------
        const courseOrderSnap = await adminDb
            .collection("course_orders")
            .where("fawaterak_intent_key", "==", intentKey)
            .limit(1)
            .get();

        if (!courseOrderSnap.empty) {
            const orderDoc = courseOrderSnap.docs[0];
            const orderData = orderDoc.data();

            if (orderData.status !== "pending_payment" && orderData.status !== "pending") {
                return NextResponse.json({ status: "already_processed" });
            }

            const studentId = orderData.student_id;
            const courseId = orderData.course_id;
            const requestedAmount = Number(orderData.amount || 0);
            const webhookPaidAmount = Number(payload.paidAmount || payload.amount || 0);

            if (webhookPaidAmount > 0 && webhookPaidAmount < requestedAmount) {
                return NextResponse.json({ error: "Paid amount less than requested" }, { status: 400 });
            }

            const finalPaid = requestedAmount;
            const instructorEarnings = Number(orderData.instructor_share ?? (finalPaid * 0.95));
            const platformCommission = Number(orderData.platform_commission ?? (finalPaid * 0.05));

            const txRef = adminDb.collection("transactions").doc(intentKey);
            const enrollmentRef = adminDb.collection("enrollments").doc(`${studentId}_${courseId}`);
            const courseRef = adminDb.collection("courses").doc(courseId);
            const instructorPrivateRef = orderData.instructor_id
                ? adminDb.collection("profiles_private").doc(orderData.instructor_id)
                : null;

            let alreadyProcessed = false;

            await adminDb.runTransaction(async (t) => {
                const txDoc = await t.get(txRef);
                if (txDoc.exists) {
                    alreadyProcessed = true;
                    return;
                }

                // 1. Enroll student
                t.set(enrollmentRef, {
                    id: `${studentId}_${courseId}`,
                    student_id: studentId,
                    student_name: orderData.student_name || "طالب",
                    student_unique_id: orderData.student_unique_id || "N/A",
                    course_id: courseId,
                    course_title: orderData.course_title || "",
                    instructor_id: orderData.instructor_id || "",
                    instructor_name: orderData.instructor_name || "",
                    enrolled_at: new Date().toISOString(),
                    progress: 0,
                    status: "active",
                    paid_amount: finalPaid,
                    original_price: orderData.original_price || finalPaid,
                    coupon_used: orderData.coupon_code || null,
                    payment_method: "fawaterak_online",
                }, { merge: true });

                // 2. Increment students count on course
                t.update(courseRef, { students_count: FieldValue.increment(1) });

                // 3. Deposit 95% into instructor wallet
                if (instructorPrivateRef) {
                    t.set(instructorPrivateRef, {
                        wallet_balance: FieldValue.increment(instructorEarnings),
                        updated_at: new Date().toISOString(),
                    }, { merge: true });
                }

                // 4. Create transaction record (Idempotent by intentKey)
                t.create(txRef, {
                    type: "course_purchase_fawaterak",
                    student_id: studentId,
                    student_name: orderData.student_name || "طالب",
                    student_email: orderData.student_email || "",
                    course_id: courseId,
                    course_title: orderData.course_title || "",
                    instructor_id: orderData.instructor_id || "",
                    instructor_name: orderData.instructor_name || "",
                    amount: finalPaid,
                    instructor_share: instructorEarnings,
                    platform_commission: platformCommission,
                    payment_method: "fawaterak",
                    provider_method: paymentMethod,
                    fawaterak_transaction_id: transactionId,
                    fawaterak_transaction_key: intentKey,
                    intent_key: intentKey,
                    coupon_used: orderData.coupon_code || null,
                    status: "completed",
                    created_at: new Date().toISOString(),
                });
            });

            if (alreadyProcessed) {
                return NextResponse.json({ status: "already_processed" });
            }

            // Update order doc
            await orderDoc.ref.update({
                status: "completed",
                fawaterak_transaction_id: transactionId,
                payment_method_name: paymentMethod,
                updated_at: new Date().toISOString(),
            });

            // Activity Log
            await logServerActivity({
                action: "course_purchased_fawaterak",
                category: "financial",
                title: `شراء كورس إلكترونياً (${orderData.course_title})`,
                description: `تم إتمام دفع كورس "${orderData.course_title}" بنجاح للطالب "${orderData.student_name}" عبر فواتيرك (${paymentMethod}) بقيمة ${finalPaid} ج.م وإيداع ${instructorEarnings} ج.م للمحاضر`,
                status: "success",
                user_id: studentId,
                user_name: orderData.student_name || "طالب",
                user_email: orderData.student_email || "",
                user_role: "student",
                target_user_id: orderData.instructor_id,
                target_user_name: orderData.instructor_name,
                amount: finalPaid,
                metadata: {
                    course_id: courseId,
                    course_title: orderData.course_title,
                    final_paid: finalPaid,
                    instructor_share: instructorEarnings,
                    platform_commission: platformCommission,
                    transaction_id: transactionId,
                    intent_key: intentKey,
                    payment_method: paymentMethod,
                },
            });

            return NextResponse.json({ status: "success", type: "course_purchase", course_id: courseId });
        }

        // -------------------------------------------------------------
        // CASE B: Fallback for Wallet Recharges (if any existing)
        // -------------------------------------------------------------
        const walletReqSnap = await adminDb
            .collection("wallet_requests")
            .where("fawaterak_intent_key", "==", intentKey)
            .limit(1)
            .get();

        if (walletReqSnap.empty) {
            return NextResponse.json({ error: "No matching order or wallet request found for intent" }, { status: 400 });
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
