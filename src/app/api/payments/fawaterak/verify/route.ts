import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
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

        // 1. Check if intent belongs to a course order
        const courseOrderSnap = await adminDb
            .collection("course_orders")
            .where("fawaterak_intent_key", "==", intentKey)
            .limit(1)
            .get();

        if (!courseOrderSnap.empty) {
            const orderDoc = courseOrderSnap.docs[0];
            const orderData = orderDoc.data();

            if (orderData.student_id !== user.uid) {
                return NextResponse.json({ error: "غير مصرح لك بتأكيد هذا الدفع" }, { status: 403 });
            }

            const txRef = adminDb.collection("transactions").doc(intentKey);
            const existingTx = await txRef.get();

            if (existingTx.exists || orderData.status === "completed") {
                return NextResponse.json({
                    status: "success",
                    type: "course_purchase",
                    course_id: orderData.course_id,
                    already_credited: true,
                    message: "تم تأكيد اشتراكك في الكورس بنجاح!",
                });
            }

            // Query Fawaterak API for status
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
                const requestedAmount = Number(orderData.amount || 0);
                const finalPaid = requestedAmount;
                const instructorEarnings = Number(orderData.instructor_share ?? (finalPaid * 0.95));
                const platformCommission = Number(orderData.platform_commission ?? (finalPaid * 0.05));
                const transactionId = data.id || data.transaction_id || intentKey;
                const paymentMethod = data.payment_method || "Online";

                const enrollmentRef = adminDb.collection("enrollments").doc(`${user.uid}_${orderData.course_id}`);
                const courseRef = adminDb.collection("courses").doc(orderData.course_id);
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

                    t.set(enrollmentRef, {
                        id: `${user.uid}_${orderData.course_id}`,
                        student_id: user.uid,
                        student_name: orderData.student_name || "طالب",
                        student_unique_id: orderData.student_unique_id || "N/A",
                        course_id: orderData.course_id,
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

                    t.update(courseRef, { students_count: FieldValue.increment(1) });

                    if (instructorPrivateRef) {
                        t.set(instructorPrivateRef, {
                            wallet_balance: FieldValue.increment(instructorEarnings),
                            updated_at: new Date().toISOString(),
                        }, { merge: true });
                    }

                    t.create(txRef, {
                        type: "course_purchase_fawaterak",
                        student_id: user.uid,
                        student_name: orderData.student_name || "طالب",
                        student_email: orderData.student_email || "",
                        course_id: orderData.course_id,
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
                    return NextResponse.json({
                        status: "success",
                        type: "course_purchase",
                        course_id: orderData.course_id,
                        already_credited: true,
                        message: "تم تفعيل الكورس بنجاح مسبقاً!",
                    });
                }

                await orderDoc.ref.update({
                    status: "completed",
                    fawaterak_transaction_id: transactionId,
                    payment_method_name: paymentMethod,
                    updated_at: new Date().toISOString(),
                });

                await logServerActivity({
                    action: "course_purchased_fawaterak_verified",
                    category: "financial",
                    title: `تأكيد شراء كورس إلكترونياً (${orderData.course_title})`,
                    description: `تم التحقق وتأكيد دفع كورس "${orderData.course_title}" للطالب "${orderData.student_name}" عبر فواتيرك`,
                    status: "success",
                    user_id: user.uid,
                    user_name: orderData.student_name || "طالب",
                    user_email: orderData.student_email || "",
                    user_role: "student",
                    amount: finalPaid,
                    metadata: {
                        course_id: orderData.course_id,
                        course_title: orderData.course_title,
                        amount: finalPaid,
                    },
                });

                return NextResponse.json({
                    status: "success",
                    type: "course_purchase",
                    course_id: orderData.course_id,
                    message: "تم تفعيل الكورس بنجاح!",
                });
            }

            return NextResponse.json({
                status: txStatus || "pending",
                message: "حالة المعاملة قيد المعالجة أو لم تكتمل بعد.",
            });
        }

        // 2. Fallback to wallet_requests
        const walletReqSnap = await adminDb
            .collection("wallet_requests")
            .where("fawaterak_intent_key", "==", intentKey)
            .limit(1)
            .get();

        if (walletReqSnap.empty) {
            return NextResponse.json({ error: "طلب الدفع غير مسجل" }, { status: 404 });
        }

        const walletReqDoc = walletReqSnap.docs[0];
        const walletData = walletReqDoc.data();

        if (walletData.student_id !== user.uid) {
            return NextResponse.json({ error: "غير مصرح لك بتأكيد هذا الدفع" }, { status: 403 });
        }

        const txRef = adminDb.collection("transactions").doc(intentKey);
        const existingTx = await txRef.get();

        if (existingTx.exists) {
            return NextResponse.json({
                status: "success",
                already_credited: true,
                message: "تم شحن الرصيد بنجاح!",
            });
        }

        // Query Fawaterak API for status
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
            const requestedAmount = Number(walletData.amount || 0);
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
                    const currentBal = Number(privateData?.wallet_balance ?? 0);

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
