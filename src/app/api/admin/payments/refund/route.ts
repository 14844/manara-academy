import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "غير مصرح لك بإجراء هذه العملية (مخصصة للمسؤول فقط)" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { orderId, intentKey, reason } = body;

        if (!orderId && !intentKey) {
            return NextResponse.json({ error: "معرّف الطلب أو مفتاح المعاملة مطلوب" }, { status: 400 });
        }

        let targetOrderRef: FirebaseFirestore.DocumentReference | null = null;
        if (orderId) {
            targetOrderRef = adminDb.collection("course_orders").doc(orderId);
        } else if (intentKey) {
            const snap = await adminDb
                .collection("course_orders")
                .where("fawaterak_intent_key", "==", intentKey)
                .limit(1)
                .get();
            if (!snap.empty) {
                targetOrderRef = snap.docs[0].ref;
            }
        }

        if (!targetOrderRef) {
            return NextResponse.json({ error: "لم يتم العثور على طلب الكورس المطلوب استرداده" }, { status: 404 });
        }

        let orderDataSnapshot: any = null;

        await adminDb.runTransaction(async (t) => {
            // Item 6: Read order strictly inside the transaction
            const orderSnap = await t.get(targetOrderRef!);
            if (!orderSnap.exists) {
                throw new Error("ORDER_NOT_FOUND");
            }

            const orderData = orderSnap.data()!;
            orderDataSnapshot = orderData;

            // Item 6: Require status == completed (rejects pending, failed, already refunded)
            if (orderData.status !== "completed") {
                throw new Error("ORDER_NOT_COMPLETED");
            }

            const effectiveIntentKey = orderData.fawaterak_intent_key || orderSnap.id;
            const lockRef = adminDb.collection("refund_locks").doc(`refund_${effectiveIntentKey}`);

            // Item 6: Use t.create() with the exact refund_<intent> lock ID shared with webhook
            t.create(lockRef, {
                created_at: new Date().toISOString(),
                by: user.uid,
                type: "admin_manual_refund",
                order_id: orderSnap.id,
            });

            const studentId = orderData.student_id;
            const courseId = orderData.course_id;
            const instructorId = orderData.instructor_id;
            const finalPaid = Number(orderData.amount || 0);
            const instructorShare = Number(orderData.instructor_share ?? (finalPaid * 0.95));

            const enrollmentRef = adminDb.collection("enrollments").doc(`${studentId}_${courseId}`);
            const courseRef = adminDb.collection("courses").doc(courseId);
            const instructorPrivateRef = instructorId ? adminDb.collection("profiles_private").doc(instructorId) : null;
            const studentProfileRef = adminDb.collection("profiles").doc(studentId);
            const refundTxRef = adminDb.collection("transactions").doc(`refund_admin_${orderSnap.id}`);

            // A. Mark order as refunded
            t.update(targetOrderRef!, {
                status: "refunded",
                refund_reason: reason || "admin_manual_refund",
                refunded_by: user.uid,
                refunded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            // B. Revoke enrollment
            t.set(enrollmentRef, {
                status: "refunded",
                revoked_at: new Date().toISOString(),
                refund_reason: reason || "admin_manual_refund",
            }, { merge: true });

            // C. Remove course from student profile
            t.update(studentProfileRef, {
                enrolled_courses: FieldValue.arrayRemove(courseId),
                updated_at: new Date().toISOString(),
            });

            // D. Decrement course student counter
            t.update(courseRef, {
                students_count: FieldValue.increment(-1),
            });

            // Item 12: Write wallet_balance and total_earned in profiles_private ONLY (not public profiles)
            if (instructorPrivateRef) {
                t.set(instructorPrivateRef, {
                    wallet_balance: FieldValue.increment(-instructorShare),
                    total_earned: FieldValue.increment(-instructorShare),
                    updated_at: new Date().toISOString(),
                }, { merge: true });
            }

            // F. Add record in transactions
            t.set(refundTxRef, {
                type: "course_refund_manual_admin",
                order_id: orderSnap.id,
                original_intent_key: effectiveIntentKey,
                student_id: studentId,
                student_name: orderData.student_name || "طالب",
                course_id: courseId,
                course_title: orderData.course_title || "",
                instructor_id: instructorId || "",
                amount: finalPaid,
                instructor_deduction: instructorShare,
                platform_deduction: Number(orderData.platform_commission || 0),
                status: "refunded",
                refund_reason: reason || "admin_manual_refund",
                refunded_by: user.uid,
                created_at: new Date().toISOString(),
            });
        });

        // Audit log
        await logServerActivity({
            action: "admin_course_refund",
            category: "financial",
            title: `استرداد يدوي لكورس بواسطة الإدارة (${orderDataSnapshot?.course_title || ""})`,
            description: `قام المسؤول "${user.email}" بإلغاء اشتراك الطالب "${orderDataSnapshot?.student_name || ""}" واسترداد مبلغ ${orderDataSnapshot?.amount || 0} ج.م`,
            status: "info",
            user_id: user.uid,
            user_name: user.profile?.full_name || "مسؤول",
            amount: Number(orderDataSnapshot?.amount || 0),
            metadata: {
                order_id: targetOrderRef.id,
                course_id: orderDataSnapshot?.course_id,
                instructor_id: orderDataSnapshot?.instructor_id,
                student_id: orderDataSnapshot?.student_id,
                reason,
            },
        });

        return NextResponse.json({
            success: true,
            message: "تم استرداد الكورس وإلغاء اشتراك الطالب وخصم حصة المدرس بنجاح",
            refundedAmount: Number(orderDataSnapshot?.amount || 0),
        });
    } catch (err: any) {
        console.error("Admin refund error:", err);
        if (err.message === "ORDER_NOT_FOUND") {
            return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
        }
        if (err.message === "ORDER_NOT_COMPLETED") {
            return NextResponse.json({ error: "لا يمكن استرداد طلب لم يكتمل بنجاح أو تم استرداده مسبقاً" }, { status: 400 });
        }
        if (err.code === 6 || err.message?.includes("ALREADY_EXISTS")) {
            return NextResponse.json({ error: "تم استرداد هذا الطلب مسبقاً أو جاري معالجته الآن" }, { status: 409 });
        }
        return NextResponse.json({ error: err.message || "فشل تنفيذ الاسترداد" }, { status: 500 });
    }
}
