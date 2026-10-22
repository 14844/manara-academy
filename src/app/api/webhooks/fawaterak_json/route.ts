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

        const intentKey = transactionKey;

        if (status !== "paid") {
            const isRefundEvent = ["refunded", "refund", "chargeback", "reversed", "canceled", "cancelled"].includes(status);
            if (isRefundEvent) {
                return await processRefundEvent({
                    intentKey,
                    transactionId,
                    payload,
                    status,
                });
            }
            return NextResponse.json({ status: "acknowledged", payment_status: status });
        }

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

/**
 * Handle refund and chargeback webhook events from Fawaterak
 * - Revokes student course enrollment immediately
 * - Deducts 95% earnings from instructor's wallet (allows negative balance to protect the platform)
 * - Decrements course students_count
 * - Records refund transaction in the financial ledger
 * - Logs server security activity
 */
async function processRefundEvent({
    intentKey,
    transactionId,
    payload,
    status,
}: {
    intentKey: string;
    transactionId: string;
    payload: any;
    status: string;
}) {
    try {
        console.warn(`[REFUND] Processing Fawaterak refund/chargeback event for intentKey: ${intentKey}, txId: ${transactionId}, status: ${status}`);

        // 1. Check Course Orders
        let orderDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        if (intentKey) {
            const snap = await adminDb
                .collection("course_orders")
                .where("fawaterak_intent_key", "==", intentKey)
                .limit(1)
                .get();
            if (!snap.empty) orderDoc = snap.docs[0];
        }

        if (!orderDoc && transactionId) {
            const snap = await adminDb
                .collection("course_orders")
                .where("fawaterak_transaction_id", "==", transactionId)
                .limit(1)
                .get();
            if (!snap.empty) orderDoc = snap.docs[0];
        }

        if (orderDoc) {
            const orderData = orderDoc.data();

            if (orderData.status === "refunded") {
                return NextResponse.json({ status: "already_refunded" });
            }

            const studentId = orderData.student_id;
            const courseId = orderData.course_id;
            const instructorId = orderData.instructor_id;
            const finalPaid = Number(orderData.amount || 0);
            const instructorShare = Number(orderData.instructor_share ?? (finalPaid * 0.95));

            const enrollmentRef = adminDb.collection("enrollments").doc(`${studentId}_${courseId}`);
            const courseRef = adminDb.collection("courses").doc(courseId);
            const instructorProfileRef = instructorId ? adminDb.collection("profiles").doc(instructorId) : null;
            const instructorPrivateRef = instructorId ? adminDb.collection("profiles_private").doc(instructorId) : null;
            const studentProfileRef = adminDb.collection("profiles").doc(studentId);
            const refundLockId = `refund_${intentKey || transactionId}`;
            const refundLockRef = adminDb.collection("refund_locks").doc(refundLockId);
            const refundTxRef = adminDb.collection("transactions").doc(refundLockId);

            let alreadyRefunded = false;

            try {
            await adminDb.runTransaction(async (t) => {
                // Idempotency guard: check if refund lock already exists
                const lockDoc = await t.get(refundLockRef);
                if (lockDoc.exists) {
                    alreadyRefunded = true;
                    return;
                }

                // Create lock doc atomically (prevents race condition with concurrent webhooks)
                t.create(refundLockRef, {
                    intent_key: intentKey,
                    transaction_id: transactionId,
                    processed_at: new Date().toISOString(),
                    status: "processed",
                });

                // A. Update order status to refunded
                t.update(orderDoc!.ref, {
                    status: "refunded",
                    refund_status: status,
                    refund_reason: payload.reason || payload.message || "fawaterak_chargeback_or_refund",
                    refunded_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

                // B. Revoke student enrollment
                t.set(enrollmentRef, {
                    status: "refunded",
                    revoked_at: new Date().toISOString(),
                    refund_reason: "fawaterak_chargeback_or_refund",
                }, { merge: true });

                // C. Remove course from student's enrolled courses list
                t.update(studentProfileRef, {
                    enrolled_courses: FieldValue.arrayRemove(courseId),
                    updated_at: new Date().toISOString(),
                });

                // D. Decrement course student counter
                t.update(courseRef, {
                    students_count: FieldValue.increment(-1),
                });

                // E. Deduct instructor share (can go negative to protect platform)
                if (instructorPrivateRef) {
                    t.set(instructorPrivateRef, {
                        wallet_balance: FieldValue.increment(-instructorShare),
                        updated_at: new Date().toISOString(),
                    }, { merge: true });
                }
                if (instructorProfileRef) {
                    t.set(instructorProfileRef, {
                        wallet_balance: FieldValue.increment(-instructorShare),
                        total_earned: FieldValue.increment(-instructorShare),
                        updated_at: new Date().toISOString(),
                    }, { merge: true });
                }

                // F. Record refund transaction in ledger
                t.set(refundTxRef, {
                    type: "course_refund_fawaterak",
                    original_intent_key: intentKey || "N/A",
                    original_transaction_id: transactionId || "N/A",
                    student_id: studentId,
                    student_name: orderData.student_name || "طالب",
                    student_email: orderData.student_email || "",
                    course_id: courseId,
                    course_title: orderData.course_title || "",
                    instructor_id: instructorId || "",
                    amount: finalPaid,
                    instructor_deduction: instructorShare,
                    platform_deduction: Number(orderData.platform_commission || 0),
                    status: "refunded",
                    refund_type: status,
                    payment_gateway: "fawaterak",
                    created_at: new Date().toISOString(),
                });
            });
            } catch (txErr: any) {
                // If the lock doc already exists (race condition), treat as already processed
                if (txErr.code === 6 || txErr.message?.includes("ALREADY_EXISTS")) {
                    return NextResponse.json({ status: "already_refunded", reason: "concurrent_duplicate" });
                }
                throw txErr;
            }

            if (alreadyRefunded) {
                return NextResponse.json({ status: "already_refunded" });
            }

            // Log server activity
            await logServerActivity({
                action: "fawaterak_course_refund_processed",
                category: "financial",
                title: `تم تنفيذ استرداد وإلغاء كورس (${orderData.course_title})`,
                description: `تم استرداد مبلغ ${finalPaid} ج.م وإلغاء اشتراك الطالب "${orderData.student_name}" وخصم ${instructorShare} ج.م من محفظة المحاضر (${status})`,
                status: "info",
                user_id: studentId,
                user_name: orderData.student_name,
                amount: finalPaid,
                metadata: {
                    course_id: courseId,
                    instructor_id: instructorId,
                    intent_key: intentKey,
                    transaction_id: transactionId,
                    instructor_deduction: instructorShare,
                    refund_status: status,
                },
            });

            return NextResponse.json({
                status: "refund_processed",
                type: "course_purchase",
                refunded_amount: finalPaid,
                instructor_deduction: instructorShare,
            });
        }

        // 2. Check Wallet Recharge
        let reqDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        if (intentKey) {
            const snap = await adminDb
                .collection("wallet_requests")
                .where("fawaterak_intent_key", "==", intentKey)
                .limit(1)
                .get();
            if (!snap.empty) reqDoc = snap.docs[0];
        }

        if (!reqDoc && transactionId) {
            const snap = await adminDb
                .collection("wallet_requests")
                .where("fawaterak_transaction_id", "==", transactionId)
                .limit(1)
                .get();
            if (!snap.empty) reqDoc = snap.docs[0];
        }

        if (reqDoc) {
            const reqData = reqDoc.data();
            if (reqData.status === "refunded") {
                return NextResponse.json({ status: "already_refunded" });
            }

            const studentId = reqData.student_id;
            const amount = Number(reqData.amount || 0);

            const studentPrivateRef = adminDb.collection("profiles_private").doc(studentId);
            const studentProfileRef = adminDb.collection("profiles").doc(studentId);
            const rechargeLockId = `refund_recharge_${intentKey || transactionId}`;
            const rechargeLockRef = adminDb.collection("refund_locks").doc(rechargeLockId);
            const refundTxRef = adminDb.collection("transactions").doc(rechargeLockId);

            let alreadyRefunded = false;

            try {
            await adminDb.runTransaction(async (t) => {
                // Idempotency guard for wallet recharge refunds
                const lockDoc = await t.get(rechargeLockRef);
                if (lockDoc.exists) {
                    alreadyRefunded = true;
                    return;
                }

                t.create(rechargeLockRef, {
                    intent_key: intentKey,
                    transaction_id: transactionId,
                    processed_at: new Date().toISOString(),
                    status: "processed",
                });

                t.update(reqDoc!.ref, {
                    status: "refunded",
                    refunded_at: new Date().toISOString(),
                    refund_reason: payload.reason || status,
                });

                t.set(studentPrivateRef, {
                    wallet_balance: FieldValue.increment(-amount),
                    updated_at: new Date().toISOString(),
                }, { merge: true });

                t.set(studentProfileRef, {
                    wallet_balance: FieldValue.increment(-amount),
                    updated_at: new Date().toISOString(),
                }, { merge: true });

                t.set(refundTxRef, {
                    type: "wallet_recharge_refund",
                    original_intent_key: intentKey || "N/A",
                    student_id: studentId,
                    amount: amount,
                    status: "refunded",
                    payment_gateway: "fawaterak",
                    created_at: new Date().toISOString(),
                });
            });
            } catch (txErr: any) {
                if (txErr.code === 6 || txErr.message?.includes("ALREADY_EXISTS")) {
                    return NextResponse.json({ status: "already_refunded", reason: "concurrent_duplicate" });
                }
                throw txErr;
            }

            if (alreadyRefunded) {
                return NextResponse.json({ status: "already_refunded" });
            }

            await logServerActivity({
                action: "wallet_recharge_refund_processed",
                category: "financial",
                title: `استرداد شحن محفظة عبر فواتيرك (${amount} ج.م)`,
                description: `تم سحب ${amount} ج.م من محفظة الطالب نتيجة استرداد عملية الشحن (${status})`,
                status: "info",
                user_id: studentId,
                amount: amount,
            });

            return NextResponse.json({
                status: "refund_processed",
                type: "wallet_recharge",
                deducted_amount: amount,
            });
        }

        return NextResponse.json({ error: "Order or recharge not found for refund" }, { status: 404 });
    } catch (err: any) {
        console.error("Error processing refund event:", err);
        return NextResponse.json({ error: "Internal error processing refund" }, { status: 500 });
    }
}
